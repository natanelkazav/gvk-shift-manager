-- Availability-aware per-shift-type balancing for dynamic draft generation.
-- Preferred/available/avoid remain soft signals; unavailable is never an opportunity.
create or replace function public.dynamic_shadow_shift_type_assigned_count(requested_draft_id uuid, requested_user_id uuid, requested_slot_id uuid)
returns integer language sql stable security definer set search_path='' as $function$
  select count(*)::integer
  from public.dynamic_schedule_shadow_assignments a
  join public.dynamic_availability_slots assigned_slot on assigned_slot.id=a.slot_id
  join public.dynamic_availability_slots requested_slot on requested_slot.id=requested_slot_id
  where a.draft_id=requested_draft_id and a.user_id=requested_user_id
    and assigned_slot.shift_code=requested_slot.shift_code
    and assigned_slot.start_time=requested_slot.start_time and assigned_slot.end_time=requested_slot.end_time;
$function$;

create or replace function public.dynamic_shadow_shift_type_opportunity_weight(requested_draft_id uuid, requested_user_id uuid, requested_slot_id uuid)
returns numeric language sql stable security definer set search_path='' as $function$
  select coalesce(sum(case e.availability_status when 'preferred' then 1.25 when 'available' then 1.0 when 'avoid' then 0.20 else 0 end),0)::numeric
  from public.dynamic_schedule_shadow_drafts d
  join public.dynamic_availability_slots requested_slot on requested_slot.id=requested_slot_id
  join public.dynamic_availability_slots candidate_slot on candidate_slot.period_id=d.availability_period_id
   and candidate_slot.shift_code=requested_slot.shift_code and candidate_slot.start_time=requested_slot.start_time and candidate_slot.end_time=requested_slot.end_time
  left join public.dynamic_availability_submissions sub on sub.period_id=d.availability_period_id and sub.user_id=requested_user_id
  left join public.dynamic_availability_entries e on e.submission_id=sub.id and e.slot_id=candidate_slot.id
  where d.id=requested_draft_id;
$function$;

create or replace function public.dynamic_shadow_shift_type_expected_count(requested_draft_id uuid, requested_user_id uuid, requested_slot_id uuid)
returns numeric language sql stable security definer set search_path='' as $function$
  with requested as (
    select sl.shift_code,sl.start_time,sl.end_time,d.job_type_id
    from public.dynamic_schedule_shadow_drafts d join public.dynamic_availability_slots sl on sl.id=requested_slot_id
    where d.id=requested_draft_id
  ), member_weights as (
    select m.user_id,public.dynamic_shadow_shift_type_opportunity_weight(requested_draft_id,m.user_id,requested_slot_id) weight
    from requested r join public.job_type_memberships m on m.job_type_id=r.job_type_id
    join public.profiles p on p.id=m.user_id and p.is_active=true
  ), assignment_total as (
    select count(*)::numeric + 1 positions
    from public.dynamic_schedule_shadow_assignments a join public.dynamic_availability_slots sl on sl.id=a.slot_id cross join requested r
    where a.draft_id=requested_draft_id and sl.shift_code=r.shift_code and sl.start_time=r.start_time and sl.end_time=r.end_time
  )
  select case when coalesce(sum(weight),0)<=0 then 0 else (select positions from assignment_total)
    * coalesce(max(weight) filter(where user_id=requested_user_id),0) / sum(weight) end from member_weights;
$function$;

grant execute on function public.dynamic_shadow_shift_type_assigned_count(uuid,uuid,uuid) to authenticated;
grant execute on function public.dynamic_shadow_shift_type_opportunity_weight(uuid,uuid,uuid) to authenticated;
grant execute on function public.dynamic_shadow_shift_type_expected_count(uuid,uuid,uuid) to authenticated;

create or replace function public.create_dynamic_schedule_shadow_draft(
  requested_job_type_id uuid,
  requested_year integer,
  requested_month integer
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  current_user_id uuid := auth.uid();
  job public.job_types%rowtype;
  period public.dynamic_availability_periods%rowtype;
  v_draft_id uuid;
  feasibility jsonb;
  sl record;
  chosen_user uuid;
  chosen_score numeric;
  chosen_status text;
  chosen_assigned integer;
  chosen_min integer;
  chosen_target integer;
  chosen_max integer;
  assigned_required integer := 0;
  assigned_optional integer := 0;
  unfilled integer := 0;
  avoid_assignments integer := 0;
  above_target_assignments integer := 0;
  no_consecutive boolean;
  max_per_day integer;
  min_rest integer;
  max_hard boolean;
  coverage_weight numeric;
  fairness_weight numeric;
  preference_weight numeric;
  optional_weight numeric;
  blocked_slots uuid[] := array[]::uuid[];
  remaining_positions integer;
begin
  if current_user_id is null then raise exception 'not authenticated'; end if;
  if not public.has_dynamic_job_type_permission('schedule.create_draft', requested_job_type_id, current_user_id) then raise exception 'not allowed'; end if;
  select * into job from public.job_types where id=requested_job_type_id;
  if job.id is null then raise exception 'job type not found'; end if;
  select * into period from public.dynamic_availability_periods where job_type_id=job.id and year=requested_year and month=requested_month;
  if period.id is null then raise exception 'shadow availability period not found'; end if;

  feasibility := public.analyze_dynamic_schedule_feasibility(job.id,requested_year,requested_month);
  no_consecutive := coalesce((job.scheduling_config#>>'{rules,noConsecutive,enabled}')::boolean,true);
  max_per_day := case when coalesce((job.scheduling_config#>>'{rules,maxShiftsPerDay,enabled}')::boolean,true) then coalesce((job.scheduling_config#>>'{rules,maxShiftsPerDay,value}')::integer,1) else 999 end;
  min_rest := case when coalesce((job.scheduling_config#>>'{rules,minimumRestMinutes,enabled}')::boolean,false) then coalesce((job.scheduling_config#>>'{rules,minimumRestMinutes,value}')::integer,0) else 0 end;
  max_hard := coalesce(job.scheduling_config->>'maximumMode','hard')='hard';
  coverage_weight := coalesce((job.scheduling_config#>>'{weights,coverage}')::numeric,1000);
  fairness_weight := coalesce((job.scheduling_config#>>'{weights,proportionalFairness}')::numeric,100);
  preference_weight := coalesce((job.scheduling_config#>>'{weights,preference}')::numeric,30);
  optional_weight := coalesce((job.scheduling_config#>>'{weights,targetOptional}')::numeric,15);

  insert into public.dynamic_schedule_shadow_drafts(job_type_id,availability_period_id,year,month,status,feasibility_snapshot,rules_snapshot,created_by)
  values(job.id,period.id,requested_year,requested_month,'shadow',feasibility,job.scheduling_config,current_user_id)
  returning id into v_draft_id;

  insert into public.dynamic_schedule_shadow_targets(
    draft_id,user_id,requested_min,requested_target,requested_max,available_slots,
    proportional_weight,proportional_target,employment_scope,employment_factor
  )
  select
    v_draft_id,(m->>'userId')::uuid,(m->>'minimum')::integer,(m->>'target')::integer,
    nullif(m->>'maximum','')::integer,(m->>'availableSlots')::integer,
    coalesce((m->>'weight')::numeric,1),coalesce((m->>'proportionalTarget')::numeric,0),
    nullif(m->>'employmentScope',''),coalesce((m->>'employmentFactor')::numeric,1)
  from jsonb_array_elements(coalesce(feasibility->'members','[]'::jsonb)) m;

  loop
    select candidate_slot.* into sl
    from public.dynamic_availability_slots candidate_slot
    where candidate_slot.period_id=period.id
      and not (candidate_slot.id = any(blocked_slots))
      and (select count(*) from public.dynamic_schedule_shadow_assignments a
           where a.draft_id=v_draft_id and a.slot_id=candidate_slot.id and a.assignment_tier='required') < candidate_slot.min_workers
    order by
      (select count(*) from public.dynamic_schedule_shadow_targets t
       join public.dynamic_availability_submissions sub on sub.period_id=period.id and sub.user_id=t.user_id
       join public.dynamic_availability_entries e on e.submission_id=sub.id and e.slot_id=candidate_slot.id and e.availability_status in ('preferred','available','avoid')
       where t.draft_id=v_draft_id
         and (not max_hard or t.requested_max is null or t.assigned_count<t.requested_max)
         and public.dynamic_shadow_candidate_allowed(v_draft_id,t.user_id,candidate_slot.id,max_per_day,no_consecutive,min_rest)) asc,
      candidate_slot.shift_date,candidate_slot.start_time,candidate_slot.id
    limit 1;
    exit when not found;

    chosen_user:=null; chosen_score:=null; chosen_status:=null; chosen_assigned:=null; chosen_min:=null; chosen_target:=null; chosen_max:=null;

    select c.user_id,c.score,c.availability_status,c.assigned_count,c.requested_min,c.requested_target,c.requested_max
    into chosen_user,chosen_score,chosen_status,chosen_assigned,chosen_min,chosen_target,chosen_max
    from (
      select t.user_id,t.assigned_count,t.requested_min,t.requested_target,t.requested_max,e.availability_status,
        coverage_weight
        + greatest(t.requested_min-t.assigned_count,0)*fairness_weight*2
        -- Employment factor changes balancing pressure only. It never removes eligibility.
        + greatest(t.requested_target-t.assigned_count,0)*fairness_weight*t.employment_factor
        + greatest(t.proportional_target-t.assigned_count,0)*fairness_weight*0.5
        + (public.dynamic_shadow_shift_type_expected_count(v_draft_id,t.user_id,sl.id)
           - public.dynamic_shadow_shift_type_assigned_count(v_draft_id,t.user_id,sl.id))*fairness_weight*0.8
        + case e.availability_status when 'preferred' then preference_weight when 'available' then 0 when 'avoid' then -preference_weight*4 else -1000000 end
        + case when not max_hard and t.requested_max is not null and t.assigned_count>=t.requested_max
            then -fairness_weight*4*(t.assigned_count-t.requested_max+1) else 0 end as score
      from public.dynamic_schedule_shadow_targets t
      join public.dynamic_availability_submissions sub on sub.period_id=period.id and sub.user_id=t.user_id
      join public.dynamic_availability_entries e on e.submission_id=sub.id and e.slot_id=sl.id and e.availability_status in ('preferred','available','avoid')
      where t.draft_id=v_draft_id
        and (not max_hard or t.requested_max is null or t.assigned_count<t.requested_max)
        and public.dynamic_shadow_candidate_allowed(v_draft_id,t.user_id,sl.id,max_per_day,no_consecutive,min_rest)
      order by score desc,t.assigned_count asc,t.user_id limit 1
    ) c;

    if chosen_user is null then
      select greatest(sl.min_workers-count(*),0) into remaining_positions
      from public.dynamic_schedule_shadow_assignments a
      where a.draft_id=v_draft_id and a.slot_id=sl.id and a.assignment_tier='required';
      unfilled:=unfilled+remaining_positions;
      blocked_slots:=array_append(blocked_slots,sl.id);
      continue;
    end if;

    insert into public.dynamic_schedule_shadow_assignments(draft_id,slot_id,user_id,assignment_tier,score,reasons)
    values(v_draft_id,sl.id,chosen_user,'required',chosen_score,jsonb_build_array(
      'כיסוי משמרת','קדימות למשמרות עם מעט מועמדים',
      case when chosen_assigned<coalesce(chosen_min,0) then 'השלמת מינימום חודשי'
           when chosen_assigned<coalesce(chosen_target,0) then 'איזון לכיוון היעד החודשי'
           else 'העובד נשאר מועמד גם לאחר הגעה ליעד' end,
      case chosen_status when 'preferred' then 'מעדיף' when 'available' then 'זמין' when 'avoid' then 'מעדיף שלא — נבחר רק לאחר שקלול עדיפות נמוכה' else chosen_status end
    ));
    update public.dynamic_schedule_shadow_targets t set assigned_count=t.assigned_count+1
    where t.draft_id=v_draft_id and t.user_id=chosen_user;
    if chosen_status='avoid' then avoid_assignments:=avoid_assignments+1; end if;
    if chosen_assigned>=coalesce(chosen_target,0) then above_target_assignments:=above_target_assignments+1; end if;
    assigned_required:=assigned_required+1;
  end loop;

  for sl in select * from public.dynamic_availability_slots s where s.period_id=period.id and s.target_workers>s.min_workers order by s.shift_date,s.start_time,s.id loop
    loop
      exit when (select count(*) from public.dynamic_schedule_shadow_assignments a where a.draft_id=v_draft_id and a.slot_id=sl.id)>=sl.target_workers;
      chosen_user:=null; chosen_score:=null; chosen_status:=null; chosen_assigned:=null; chosen_target:=null;
      select c.user_id,c.score,c.availability_status,c.assigned_count,c.requested_target
      into chosen_user,chosen_score,chosen_status,chosen_assigned,chosen_target
      from (
        select t.user_id,t.assigned_count,t.requested_target,e.availability_status,
          optional_weight
          + greatest(t.requested_target-t.assigned_count,0)*fairness_weight*t.employment_factor
          + greatest(t.proportional_target-t.assigned_count,0)*fairness_weight*0.5
        + (public.dynamic_shadow_shift_type_expected_count(v_draft_id,t.user_id,sl.id)
           - public.dynamic_shadow_shift_type_assigned_count(v_draft_id,t.user_id,sl.id))*fairness_weight*0.8
          + case when e.availability_status='preferred' then preference_weight else 0 end
          + case when not max_hard and t.requested_max is not null and t.assigned_count>=t.requested_max
              then -fairness_weight*4*(t.assigned_count-t.requested_max+1) else 0 end as score
        from public.dynamic_schedule_shadow_targets t
        join public.dynamic_availability_submissions sub on sub.period_id=period.id and sub.user_id=t.user_id
        join public.dynamic_availability_entries e on e.submission_id=sub.id and e.slot_id=sl.id and e.availability_status in ('preferred','available')
        where t.draft_id=v_draft_id
          and (not max_hard or t.requested_max is null or t.assigned_count<t.requested_max)
          and public.dynamic_shadow_candidate_allowed(v_draft_id,t.user_id,sl.id,max_per_day,no_consecutive,min_rest)
        order by score desc,t.assigned_count asc,t.user_id limit 1
      ) c;
      exit when chosen_user is null;
      insert into public.dynamic_schedule_shadow_assignments(draft_id,slot_id,user_id,assignment_tier,score,reasons)
      values(v_draft_id,sl.id,chosen_user,'target_optional',chosen_score,jsonb_build_array(
        'עובד נוסף עד יעד האיוש למשמרת',
        case when chosen_assigned<coalesce(chosen_target,0) then 'איזון לכיוון היעד החודשי' else 'היעד החודשי הוא העדפה ולא חסם' end,
        case when chosen_status='preferred' then 'מעדיף' else 'זמין' end
      ));
      update public.dynamic_schedule_shadow_targets t set assigned_count=t.assigned_count+1
      where t.draft_id=v_draft_id and t.user_id=chosen_user;
      if chosen_assigned>=coalesce(chosen_target,0) then above_target_assignments:=above_target_assignments+1; end if;
      assigned_optional:=assigned_optional+1;
    end loop;
  end loop;

  update public.dynamic_schedule_shadow_drafts d
  set status=case when unfilled=0 then 'generated' else 'incomplete' end,
      metrics=jsonb_build_object(
        'requiredAssignmentsCreated',assigned_required,'optionalAssignmentsCreated',assigned_optional,
        'unfilledRequiredPositions',unfilled,'avoidAssignments',avoid_assignments,
        'aboveTargetAssignments',above_target_assignments,
        'algorithm','scarcity_first_availability_type_balance_v2_2','wholePeriodScarcity',true,
        'targetIsEligibilityCutoff',false,'employmentScopeIsEligibilityCutoff',false,
        'partTimeRecommendationFactor',0.5
      ),updated_at=now()
  where d.id=v_draft_id;

  return jsonb_build_object(
    'draftId',v_draft_id,'mode','shadow','requiredAssignmentsCreated',assigned_required,
    'optionalAssignmentsCreated',assigned_optional,'unfilledRequiredPositions',unfilled,
    'avoidAssignments',avoid_assignments,'aboveTargetAssignments',above_target_assignments,
    'algorithm','scarcity_first_availability_type_balance_v2_2','wholePeriodScarcity',true,
    'targetIsEligibilityCutoff',false,'employmentScopeIsEligibilityCutoff',false,
    'partTimeRecommendationFactor',0.5,'feasibility',feasibility
  );
end;
$function$;

