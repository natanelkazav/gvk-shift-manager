begin;

-- Phase 6.1 hotfix.
-- 1) Dispatcher Shadow submissions must expose all three monthly-capacity fields.
--    The legacy dispatcher seed had minEnabled=false, which hid "minimum" in the
--    Shadow workspace even though the optimizer already supports requested_min.
update public.job_types jt
set availability_config = jsonb_set(
  jt.availability_config,
  '{monthlyCapacity,minEnabled}',
  'true'::jsonb,
  true
),
updated_at = now()
where jt.code = 'dispatcher'
  and coalesce((jt.availability_config#>>'{monthlyCapacity,enabled}')::boolean, true)
  and coalesce((jt.availability_config#>>'{monthlyCapacity,minEnabled}')::boolean, false) = false;

-- 2) Avoid PL/pgSQL name collisions between the local variable and
--    dynamic_availability_entries.submission_id (SQLSTATE 42702).
create or replace function public.save_dynamic_availability_shadow_submission(
  requested_job_type_id uuid,
  requested_year integer,
  requested_month integer,
  requested_user_id uuid,
  requested_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  current_user_id uuid:=auth.uid();
  job public.job_types%rowtype;
  period public.dynamic_availability_periods%rowtype;
  v_submission_id uuid;
  entry_item jsonb;
  allowed_statuses jsonb;
  requested_status text;
begin
  if current_user_id is null then raise exception 'not authenticated'; end if;
  if not exists(select 1 from public.user_permissions up where up.user_id=current_user_id and up.permission_key='users.manage') then raise exception 'not allowed'; end if;
  select * into job from public.job_types where id=requested_job_type_id;
  if job.id is null then raise exception 'job type not found'; end if;
  if not exists(select 1 from public.job_type_memberships m where m.job_type_id=job.id and m.user_id=requested_user_id) then raise exception 'user is not a member of this job type'; end if;
  select * into period from public.dynamic_availability_periods where job_type_id=job.id and year=requested_year and month=requested_month;
  if period.id is null then raise exception 'shadow period not materialized'; end if;

  insert into public.dynamic_availability_submissions(period_id,user_id,status,min_shifts,target_shifts,max_shifts,max_nights,max_weekends,max_holidays,note,submitted_at)
  values(period.id,requested_user_id,coalesce(requested_payload->>'submissionStatus','draft'),
    nullif(requested_payload->>'minimum','')::integer,nullif(requested_payload->>'target','')::integer,nullif(requested_payload->>'maximum','')::integer,
    nullif(requested_payload->>'maxNights','')::integer,nullif(requested_payload->>'maxWeekends','')::integer,nullif(requested_payload->>'maxHolidays','')::integer,
    nullif(trim(coalesce(requested_payload->>'note','')),''),case when coalesce(requested_payload->>'submissionStatus','draft')='submitted' then now() else null end)
  on conflict(period_id,user_id) do update set
    status=excluded.status,min_shifts=excluded.min_shifts,target_shifts=excluded.target_shifts,max_shifts=excluded.max_shifts,
    max_nights=excluded.max_nights,max_weekends=excluded.max_weekends,max_holidays=excluded.max_holidays,note=excluded.note,
    submitted_at=excluded.submitted_at,updated_at=now()
  returning id into v_submission_id;

  allowed_statuses:=coalesce(job.availability_config->'statuses','["available","unavailable"]'::jsonb);
  for entry_item in select value from jsonb_array_elements(coalesce(requested_payload->'entries','[]'::jsonb)) loop
    requested_status:=entry_item->>'status';
    if not (allowed_statuses ? requested_status) then raise exception 'availability status % is not enabled for this job type',requested_status; end if;
    if not exists(select 1 from public.dynamic_availability_slots s where s.id=(entry_item->>'slotId')::uuid and s.period_id=period.id) then raise exception 'slot does not belong to period'; end if;
    insert into public.dynamic_availability_entries(submission_id,slot_id,availability_status,note)
    values(v_submission_id,(entry_item->>'slotId')::uuid,requested_status,nullif(trim(coalesce(entry_item->>'note','')),''))
    on conflict on constraint dynamic_availability_entries_pkey do update
      set availability_status=excluded.availability_status,note=excluded.note,updated_at=now();
  end loop;

  return jsonb_build_object('saved',true,'mode','shadow','submissionId',v_submission_id);
end;
$function$;

-- 3) Avoid the same local-variable/column collision for draft_id while the
--    optimizer creates targets, assignments and metrics (SQLSTATE 42702).
create or replace function public.create_dynamic_schedule_shadow_draft(requested_job_type_id uuid,requested_year integer,requested_month integer)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  current_user_id uuid:=auth.uid(); job public.job_types%rowtype; period public.dynamic_availability_periods%rowtype; v_draft_id uuid;
  feasibility jsonb; sl record; position_no integer; chosen_user uuid; chosen_score numeric; chosen_status text; assigned_required integer:=0; assigned_optional integer:=0; unfilled integer:=0;
  no_consecutive boolean; max_per_day integer; min_rest integer; max_hard boolean; coverage_weight numeric; fairness_weight numeric; preference_weight numeric; optional_weight numeric;
begin
  if current_user_id is null then raise exception 'not authenticated'; end if;
  if not exists(select 1 from public.user_permissions up where up.user_id=current_user_id and up.permission_key='users.manage') then raise exception 'not allowed'; end if;
  select * into job from public.job_types where id=requested_job_type_id; if job.id is null then raise exception 'job type not found'; end if;
  select * into period from public.dynamic_availability_periods where job_type_id=job.id and year=requested_year and month=requested_month;
  if period.id is null then raise exception 'shadow availability period not found'; end if;
  feasibility:=public.analyze_dynamic_schedule_feasibility(job.id,requested_year,requested_month);
  no_consecutive:=coalesce((job.scheduling_config#>>'{rules,noConsecutive,enabled}')::boolean,true);
  max_per_day:=case when coalesce((job.scheduling_config#>>'{rules,maxShiftsPerDay,enabled}')::boolean,true) then coalesce((job.scheduling_config#>>'{rules,maxShiftsPerDay,value}')::integer,1) else 999 end;
  min_rest:=case when coalesce((job.scheduling_config#>>'{rules,minimumRestMinutes,enabled}')::boolean,false) then coalesce((job.scheduling_config#>>'{rules,minimumRestMinutes,value}')::integer,0) else 0 end;
  max_hard:=coalesce(job.scheduling_config->>'maximumMode','hard')='hard';
  coverage_weight:=coalesce((job.scheduling_config#>>'{weights,coverage}')::numeric,1000); fairness_weight:=coalesce((job.scheduling_config#>>'{weights,proportionalFairness}')::numeric,100);
  preference_weight:=coalesce((job.scheduling_config#>>'{weights,preference}')::numeric,30); optional_weight:=coalesce((job.scheduling_config#>>'{weights,targetOptional}')::numeric,15);

  insert into public.dynamic_schedule_shadow_drafts(job_type_id,availability_period_id,year,month,status,feasibility_snapshot,rules_snapshot,created_by)
  values(job.id,period.id,requested_year,requested_month,'shadow',feasibility,job.scheduling_config,current_user_id) returning id into v_draft_id;

  insert into public.dynamic_schedule_shadow_targets(draft_id,user_id,requested_min,requested_target,requested_max,available_slots,proportional_weight,proportional_target)
  select v_draft_id,(m->>'userId')::uuid,(m->>'minimum')::integer,(m->>'target')::integer,nullif(m->>'maximum','')::integer,
    (m->>'availableSlots')::integer,coalesce((m->>'weight')::numeric,1),coalesce((m->>'proportionalTarget')::numeric,0)
  from jsonb_array_elements(coalesce(feasibility->'members','[]'::jsonb)) m;

  -- Pass 1: satisfy minimum staffing for every shift before optional staffing.
  for sl in select * from public.dynamic_availability_slots where period_id=period.id order by shift_date,start_time,id loop
    for position_no in 1..sl.min_workers loop
      chosen_user:=null; chosen_score:=null; chosen_status:=null;
      select cand.user_id,cand.score,cand.availability_status into chosen_user,chosen_score,chosen_status
      from (
        select t.user_id,e.availability_status,
          coverage_weight + (greatest(t.proportional_target-t.assigned_count,0)*fairness_weight) + case when e.availability_status='preferred' then preference_weight else 0 end as score
        from public.dynamic_schedule_shadow_targets t
        join public.dynamic_availability_submissions sub on sub.period_id=period.id and sub.user_id=t.user_id
        join public.dynamic_availability_entries e on e.submission_id=sub.id and e.slot_id=sl.id and e.availability_status in ('available','preferred')
        where t.draft_id=v_draft_id
          and (not max_hard or t.requested_max is null or t.assigned_count<t.requested_max)
          and public.dynamic_shadow_candidate_allowed(v_draft_id,t.user_id,sl.id,max_per_day,no_consecutive,min_rest)
        order by score desc,t.assigned_count asc,t.user_id
        limit 1
      ) cand;
      if chosen_user is null then unfilled:=unfilled+1; exit; end if;
      insert into public.dynamic_schedule_shadow_assignments(draft_id,slot_id,user_id,assignment_tier,score,reasons)
      values(v_draft_id,sl.id,chosen_user,'required',chosen_score,jsonb_build_array('כיסוי משמרת','איזון פרופורציונלי',case when chosen_status='preferred' then 'העדפת עובד' else 'זמין' end));
      update public.dynamic_schedule_shadow_targets as t set assigned_count=t.assigned_count+1 where t.draft_id=v_draft_id and t.user_id=chosen_user;
      assigned_required:=assigned_required+1;
    end loop;
  end loop;

  -- Pass 2: only after coverage, try to move each shift from minimum to target staffing.
  for sl in select * from public.dynamic_availability_slots where period_id=period.id and target_workers>min_workers order by shift_date,start_time,id loop
    for position_no in 1..greatest(sl.target_workers-sl.min_workers,0) loop
      chosen_user:=null; chosen_score:=null; chosen_status:=null;
      select cand.user_id,cand.score,cand.availability_status into chosen_user,chosen_score,chosen_status
      from (
        select t.user_id,e.availability_status,
          optional_weight + greatest(t.proportional_target-t.assigned_count,0)*fairness_weight + case when e.availability_status='preferred' then preference_weight else 0 end as score
        from public.dynamic_schedule_shadow_targets t
        join public.dynamic_availability_submissions sub on sub.period_id=period.id and sub.user_id=t.user_id
        join public.dynamic_availability_entries e on e.submission_id=sub.id and e.slot_id=sl.id and e.availability_status in ('available','preferred')
        where t.draft_id=v_draft_id and (not max_hard or t.requested_max is null or t.assigned_count<t.requested_max)
          and public.dynamic_shadow_candidate_allowed(v_draft_id,t.user_id,sl.id,max_per_day,no_consecutive,min_rest)
        order by score desc,t.assigned_count asc,t.user_id limit 1
      ) cand;
      if chosen_user is null then exit; end if;
      insert into public.dynamic_schedule_shadow_assignments(draft_id,slot_id,user_id,assignment_tier,score,reasons)
      values(v_draft_id,sl.id,chosen_user,'target_optional',chosen_score,jsonb_build_array('עובד נוסף עד היעד','איזון פרופורציונלי',case when chosen_status='preferred' then 'העדפת עובד' else 'זמין' end));
      update public.dynamic_schedule_shadow_targets as t set assigned_count=t.assigned_count+1 where t.draft_id=v_draft_id and t.user_id=chosen_user;
      assigned_optional:=assigned_optional+1;
    end loop;
  end loop;

  update public.dynamic_schedule_shadow_drafts as d set status=case when unfilled=0 then 'generated' else 'incomplete' end,
    metrics=jsonb_build_object('requiredAssignmentsCreated',assigned_required,'optionalAssignmentsCreated',assigned_optional,'unfilledRequiredPositions',unfilled,'algorithm','coverage_first_proportional_v1'),updated_at=now()
  where d.id=v_draft_id;
  return jsonb_build_object('draftId',v_draft_id,'mode','shadow','requiredAssignmentsCreated',assigned_required,'optionalAssignmentsCreated',assigned_optional,'unfilledRequiredPositions',unfilled,'feasibility',feasibility);
end;
$function$;

grant execute on function public.save_dynamic_availability_shadow_submission(uuid,integer,integer,uuid,jsonb) to authenticated;
grant execute on function public.create_dynamic_schedule_shadow_draft(uuid,integer,integer) to authenticated;

commit;
