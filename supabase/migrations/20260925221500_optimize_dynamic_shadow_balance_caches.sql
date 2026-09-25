-- Performance fix for availability/type/200% draft balancing.
-- Precomputes static opportunity and premium inputs once per draft and keeps only small
-- in-memory counters during assignment, avoiding repeated whole-period scans per candidate.

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
  slot_200_hours numeric;
  type_expected numeric;
  type_assigned integer;
  premium_expected numeric;
  premium_assigned numeric;
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

  -- Cache all period-wide fairness inputs once. The previous implementation recomputed
  -- opportunity weights and premium totals inside every candidate score, which caused
  -- hundreds/thousands of repeated scans and statement timeouts.
  create temporary table tmp_shadow_slot_metrics on commit drop as
  select s.id as slot_id,s.start_time,s.end_time,
         coalesce(sum(case when coalesce(nullif(seg->>'multiplier','')::numeric,1)>=2
                           then coalesce(nullif(seg->>'hours','')::numeric,0) else 0 end),0)::numeric as premium_200_hours
  from public.dynamic_availability_slots s
  left join lateral jsonb_array_elements(coalesce(s.pay_segments_snapshot,'[]'::jsonb)) seg on true
  where s.period_id=period.id
  group by s.id,s.start_time,s.end_time;
  create index on tmp_shadow_slot_metrics(slot_id);
  create index on tmp_shadow_slot_metrics(start_time,end_time);

  create temporary table tmp_shadow_opportunities on commit drop as
  select t.user_id,sm.start_time,sm.end_time,
         coalesce(sum(case e.availability_status when 'preferred' then 1.25 when 'available' then 1.0 when 'avoid' then 0.15 else 0 end),0)::numeric as type_weight,
         coalesce(sum(sm.premium_200_hours * case e.availability_status when 'preferred' then 1.25 when 'available' then 1.0 when 'avoid' then 0.15 else 0 end),0)::numeric as premium_weight
  from public.dynamic_schedule_shadow_targets t
  join public.dynamic_availability_submissions sub on sub.period_id=period.id and sub.user_id=t.user_id
  join public.dynamic_availability_entries e on e.submission_id=sub.id
  join tmp_shadow_slot_metrics sm on sm.slot_id=e.slot_id
  where t.draft_id=v_draft_id
  group by t.user_id,sm.start_time,sm.end_time;
  create index on tmp_shadow_opportunities(user_id,start_time,end_time);

  create temporary table tmp_shadow_type_totals on commit drop as
  select start_time,end_time,sum(type_weight)::numeric as total_weight
  from tmp_shadow_opportunities group by start_time,end_time;
  create unique index on tmp_shadow_type_totals(start_time,end_time);

  create temporary table tmp_shadow_premium_weights on commit drop as
  select user_id,sum(premium_weight)::numeric as user_weight
  from tmp_shadow_opportunities group by user_id;
  create unique index on tmp_shadow_premium_weights(user_id);

  create temporary table tmp_shadow_premium_total on commit drop as
  select coalesce(sum(user_weight),0)::numeric as total_weight from tmp_shadow_premium_weights;

  create temporary table tmp_shadow_type_counts(
    user_id uuid not null,start_time time not null,end_time time not null,assigned_count integer not null default 0,
    primary key(user_id,start_time,end_time)
  ) on commit drop;

  create temporary table tmp_shadow_type_positions(
    start_time time not null,end_time time not null,assigned_count integer not null default 0,
    primary key(start_time,end_time)
  ) on commit drop;
  insert into tmp_shadow_type_positions(start_time,end_time)
  select distinct start_time,end_time from tmp_shadow_slot_metrics;

  create temporary table tmp_shadow_premium_counts(
    user_id uuid primary key,assigned_hours numeric not null default 0
  ) on commit drop;
  insert into tmp_shadow_premium_counts(user_id) select user_id from public.dynamic_schedule_shadow_targets where draft_id=v_draft_id;

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
        + (
            case when coalesce((select tt.total_weight from tmp_shadow_type_totals tt where tt.start_time=sl.start_time and tt.end_time=sl.end_time),0)>0
              then ((coalesce((select tp.assigned_count::numeric from tmp_shadow_type_positions tp where tp.start_time=sl.start_time and tp.end_time=sl.end_time),0) + 1)
                    * coalesce((select o.type_weight from tmp_shadow_opportunities o where o.user_id=t.user_id and o.start_time=sl.start_time and o.end_time=sl.end_time),0)
                    / (select tt.total_weight from tmp_shadow_type_totals tt where tt.start_time=sl.start_time and tt.end_time=sl.end_time))
              else 0 end
            - coalesce((select tc.assigned_count from tmp_shadow_type_counts tc where tc.user_id=t.user_id and tc.start_time=sl.start_time and tc.end_time=sl.end_time),0)
          )*fairness_weight*1.5
        + (
            case when coalesce((select total_weight from tmp_shadow_premium_total),0)>0
              then (((select coalesce(sum(pc.assigned_hours),0) from tmp_shadow_premium_counts pc)
                     + coalesce((select sm.premium_200_hours from tmp_shadow_slot_metrics sm where sm.slot_id=sl.id),0))
                    * coalesce((select pw.user_weight from tmp_shadow_premium_weights pw where pw.user_id=t.user_id),0)
                    / (select total_weight from tmp_shadow_premium_total))
              else 0 end
            - coalesce((select pc.assigned_hours from tmp_shadow_premium_counts pc where pc.user_id=t.user_id),0)
          )*fairness_weight*0.45
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
    insert into tmp_shadow_type_counts(user_id,start_time,end_time,assigned_count)
    values(chosen_user,sl.start_time,sl.end_time,1)
    on conflict(user_id,start_time,end_time) do update set assigned_count=tmp_shadow_type_counts.assigned_count+1;
    update tmp_shadow_type_positions tp set assigned_count=tp.assigned_count+1
    where tp.start_time=sl.start_time and tp.end_time=sl.end_time;
    update tmp_shadow_premium_counts pc
    set assigned_hours=pc.assigned_hours+coalesce((select sm.premium_200_hours from tmp_shadow_slot_metrics sm where sm.slot_id=sl.id),0)
    where pc.user_id=chosen_user;
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
        + (
            case when coalesce((select tt.total_weight from tmp_shadow_type_totals tt where tt.start_time=sl.start_time and tt.end_time=sl.end_time),0)>0
              then ((coalesce((select tp.assigned_count::numeric from tmp_shadow_type_positions tp where tp.start_time=sl.start_time and tp.end_time=sl.end_time),0) + 1)
                    * coalesce((select o.type_weight from tmp_shadow_opportunities o where o.user_id=t.user_id and o.start_time=sl.start_time and o.end_time=sl.end_time),0)
                    / (select tt.total_weight from tmp_shadow_type_totals tt where tt.start_time=sl.start_time and tt.end_time=sl.end_time))
              else 0 end
            - coalesce((select tc.assigned_count from tmp_shadow_type_counts tc where tc.user_id=t.user_id and tc.start_time=sl.start_time and tc.end_time=sl.end_time),0)
          )*fairness_weight*1.5
        + (
            case when coalesce((select total_weight from tmp_shadow_premium_total),0)>0
              then (((select coalesce(sum(pc.assigned_hours),0) from tmp_shadow_premium_counts pc)
                     + coalesce((select sm.premium_200_hours from tmp_shadow_slot_metrics sm where sm.slot_id=sl.id),0))
                    * coalesce((select pw.user_weight from tmp_shadow_premium_weights pw where pw.user_id=t.user_id),0)
                    / (select total_weight from tmp_shadow_premium_total))
              else 0 end
            - coalesce((select pc.assigned_hours from tmp_shadow_premium_counts pc where pc.user_id=t.user_id),0)
          )*fairness_weight*0.45
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
      insert into tmp_shadow_type_counts(user_id,start_time,end_time,assigned_count)
      values(chosen_user,sl.start_time,sl.end_time,1)
      on conflict(user_id,start_time,end_time) do update set assigned_count=tmp_shadow_type_counts.assigned_count+1;
      update tmp_shadow_type_positions tp set assigned_count=tp.assigned_count+1
      where tp.start_time=sl.start_time and tp.end_time=sl.end_time;
      update tmp_shadow_premium_counts pc
      set assigned_hours=pc.assigned_hours+coalesce((select sm.premium_200_hours from tmp_shadow_slot_metrics sm where sm.slot_id=sl.id),0)
      where pc.user_id=chosen_user;
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
        'algorithm','scarcity_first_cached_availability_type_premium_balance_v2_4','wholePeriodScarcity',true,
        'targetIsEligibilityCutoff',false,'employmentScopeIsEligibilityCutoff',false,
        'partTimeRecommendationFactor',0.5
      ),updated_at=now()
  where d.id=v_draft_id;

  return jsonb_build_object(
    'draftId',v_draft_id,'mode','shadow','requiredAssignmentsCreated',assigned_required,
    'optionalAssignmentsCreated',assigned_optional,'unfilledRequiredPositions',unfilled,
    'avoidAssignments',avoid_assignments,'aboveTargetAssignments',above_target_assignments,
    'algorithm','scarcity_first_cached_availability_type_premium_balance_v2_4','wholePeriodScarcity',true,
    'targetIsEligibilityCutoff',false,'employmentScopeIsEligibilityCutoff',false,
    'partTimeRecommendationFactor',0.5,'feasibility',feasibility
  );
end;
$function$;

