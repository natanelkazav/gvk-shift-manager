-- Fix explicit unlimited monthly target without changing fairness or weekly-rest retry logic.
-- aggregateTarget sums only numeric targets; unlimited members contribute no numeric target.
begin;


create or replace function public.analyze_dynamic_schedule_feasibility(
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
  required_total integer := 0;
  target_total integer := 0;
  aggregate_min integer := 0;
  aggregate_target integer := 0;
  aggregate_max integer := 0;
  shortage_slots integer := 0;
  avoid_fallback_slots integer := 0;
  member_json jsonb;
  min_mode text;
  max_mode text;
begin
  if current_user_id is null then raise exception 'not authenticated'; end if;
  if not exists(select 1 from public.user_permissions up where up.user_id=current_user_id and up.permission_key in ('users.view','users.manage')) then raise exception 'not allowed'; end if;

  select * into job from public.job_types where id=requested_job_type_id;
  if job.id is null then raise exception 'job type not found'; end if;

  select * into period from public.dynamic_availability_periods
  where job_type_id=job.id and year=requested_year and month=requested_month;
  if period.id is null then
    return jsonb_build_object('materialized',false,'mode','shadow','message','יש ליצור קודם תקופת אילוצים ב־Shadow Mode.');
  end if;

  select coalesce(sum(min_workers),0),coalesce(sum(target_workers),0)
  into required_total,target_total
  from public.dynamic_availability_slots where period_id=period.id;

  min_mode:=coalesce(job.scheduling_config->>'minimumMode','soft');
  max_mode:=coalesce(job.scheduling_config->>'maximumMode','hard');

  with members as (
    select
      m.user_id,
      p.display_name,
      coalesce(s.min_shifts,(job.availability_config#>>'{monthlyCapacity,defaultMin}')::integer,0) req_min,
      coalesce(s.target_shifts,(job.availability_config#>>'{monthlyCapacity,defaultTarget}')::integer,
               s.min_shifts,(job.availability_config#>>'{monthlyCapacity,defaultMin}')::integer,1) req_target,
      coalesce(s.max_shifts,(job.availability_config#>>'{monthlyCapacity,defaultMax}')::integer,2147483647) req_max,
      case when job.employment_scope='flexible' then nullif(m.metadata->>'employmentScope','') else job.employment_scope end member_scope,
      case
        when job.employment_scope='flexible' and m.metadata->>'employmentScope'='part_time' then 0.5::numeric
        else 1::numeric
      end employment_factor,
      (select count(*) from public.dynamic_availability_entries e
       join public.dynamic_availability_submissions ss on ss.id=e.submission_id
       where ss.period_id=period.id and ss.user_id=m.user_id
         and e.availability_status in ('available','preferred','avoid')) available_slots
    from public.job_type_memberships m
    join public.profiles p on p.id=m.user_id
    left join public.dynamic_availability_submissions s on s.period_id=period.id and s.user_id=m.user_id
    where m.job_type_id=job.id and p.is_active=true
  ), weighted as (
    select *,greatest(case when target_unlimited then available_slots else req_target end,req_min,1)::numeric * employment_factor weight
    from members
  ), totals as (
    select greatest(sum(weight),1) total_weight from weighted
  ), calculated as (
    select w.*,round(required_total*w.weight/t.total_weight,2) raw_share,
      least(w.req_max,w.available_slots)::integer capacity_cap
    from weighted w cross join totals t
  )
  select
    coalesce(sum(req_min),0),
    coalesce(sum(req_target),0),
    coalesce(sum(case when req_max=2147483647 then required_total else req_max end),0),
    coalesce(jsonb_agg(jsonb_build_object(
      'userId',user_id,'displayName',display_name,'minimum',req_min,'target',req_target,'targetUnlimited',target_unlimited,
      'maximum',case when req_max=2147483647 then null else req_max end,
      'availableSlots',available_slots,'weight',weight,
      'employmentScope',member_scope,'employmentFactor',employment_factor,
      'rawProportionalTarget',raw_share,'capacityCap',capacity_cap,
      'proportionalTarget',least(raw_share,capacity_cap::numeric)
    ) order by display_name),'[]'::jsonb)
  into aggregate_min,aggregate_target,aggregate_max,member_json
  from calculated;

  select count(*) into shortage_slots
  from public.dynamic_availability_slots sl
  where sl.period_id=period.id and (
    select count(distinct ss.user_id)
    from public.dynamic_availability_entries e
    join public.dynamic_availability_submissions ss on ss.id=e.submission_id
    join public.job_type_memberships m on m.user_id=ss.user_id and m.job_type_id=job.id
    where e.slot_id=sl.id and e.availability_status in ('available','preferred','avoid')
  ) < sl.min_workers;

  select count(*) into avoid_fallback_slots
  from public.dynamic_availability_slots sl
  where sl.period_id=period.id
    and (select count(distinct ss.user_id) from public.dynamic_availability_entries e
         join public.dynamic_availability_submissions ss on ss.id=e.submission_id
         join public.job_type_memberships m on m.user_id=ss.user_id and m.job_type_id=job.id
         where e.slot_id=sl.id and e.availability_status in ('available','preferred')) < sl.min_workers
    and (select count(distinct ss.user_id) from public.dynamic_availability_entries e
         join public.dynamic_availability_submissions ss on ss.id=e.submission_id
         join public.job_type_memberships m on m.user_id=ss.user_id and m.job_type_id=job.id
         where e.slot_id=sl.id and e.availability_status in ('available','preferred','avoid')) >= sl.min_workers;

  return jsonb_build_object(
    'materialized',true,'periodId',period.id,'jobTypeId',job.id,'year',requested_year,'month',requested_month,'mode','shadow',
    'requiredAssignments',required_total,'targetAssignments',target_total,
    'aggregateMinimum',aggregate_min,'aggregateTarget',aggregate_target,'aggregateMaximum',aggregate_max,
    'minimumMode',min_mode,'maximumMode',max_mode,
    'minimumDemandExcess',greatest(aggregate_min-required_total,0),
    'maximumCapacityShortage',greatest(required_total-aggregate_max,0),
    'slotsWithoutEnoughCandidates',shortage_slots,'slotsRequiringAvoidCandidates',avoid_fallback_slots,
    'canMeetAllMinimums',aggregate_min<=required_total,'canCoverRequiredByMaximums',aggregate_max>=required_total,
    'hasCandidateShortages',shortage_slots>0,'members',member_json,
    'employmentRecommendationEnabled',job.employment_scope='flexible',
    'warnings',jsonb_strip_nulls(jsonb_build_object(
      'minimums',case when aggregate_min>required_total then 'סכום המינימום של העובדים גבוה מכמות ההקצאות הקיימת; המנוע יעבור לחלוקה פרופורציונלית.' end,
      'maximums',case when aggregate_max<required_total then 'גם אם כל עובד יקבל את המקסימום שלו, אין מספיק קיבולת לכיסוי כל המשמרות.' end,
      'candidates',case when shortage_slots>0 then shortage_slots || ' משמרות ללא מספיק מועמדים גם לאחר שימוש ב״מעדיף שלא״.' end,
      'avoidFallback',case when avoid_fallback_slots>0 then avoid_fallback_slots || ' משמרות ניתנות לכיסוי רק באמצעות לפחות עובד אחד שסימן ״מעדיף שלא״.' end
    ))
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.create_dynamic_schedule_shadow_draft(requested_job_type_id uuid, requested_year integer, requested_month integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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

  -- Whole-month opportunity share. This is the central v5 target: required monthly demand is
  -- distributed proportionally to weighted availability (preferred > available > avoid).
  create temporary table tmp_shadow_user_opportunity_totals on commit drop as
  select user_id,coalesce(sum(type_weight),0)::numeric as opportunity_weight
  from tmp_shadow_opportunities
  group by user_id;
  create unique index on tmp_shadow_user_opportunity_totals(user_id);

  create temporary table tmp_shadow_month_demand on commit drop as
  select coalesce(sum(s.min_workers),0)::numeric as required_positions
  from public.dynamic_availability_slots s
  where s.period_id=period.id;

  create temporary table tmp_shadow_month_opportunity_total on commit drop as
  select coalesce(sum(opportunity_weight),0)::numeric as total_weight
  from tmp_shadow_user_opportunity_totals;

  create temporary table tmp_shadow_user_fair_targets on commit drop as
  select t.user_id,
         case when mot.total_weight>0
              then md.required_positions * coalesce(uot.opportunity_weight,0) / mot.total_weight
              else 0 end::numeric as fair_target
  from public.dynamic_schedule_shadow_targets t
  cross join tmp_shadow_month_demand md
  cross join tmp_shadow_month_opportunity_total mot
  left join tmp_shadow_user_opportunity_totals uot on uot.user_id=t.user_id
  where t.draft_id=v_draft_id;
  create unique index on tmp_shadow_user_fair_targets(user_id);

  create temporary table tmp_shadow_type_totals on commit drop as
  select start_time,end_time,sum(type_weight)::numeric as total_weight
  from tmp_shadow_opportunities group by start_time,end_time;
  create unique index on tmp_shadow_type_totals(start_time,end_time);

  create temporary table tmp_shadow_type_demand on commit drop as
  select sm.start_time,sm.end_time,coalesce(sum(s.min_workers),0)::numeric as required_positions
  from public.dynamic_availability_slots s
  join tmp_shadow_slot_metrics sm on sm.slot_id=s.id
  where s.period_id=period.id
  group by sm.start_time,sm.end_time;
  create unique index on tmp_shadow_type_demand(start_time,end_time);

  create temporary table tmp_shadow_type_fair_targets on commit drop as
  select o.user_id,o.start_time,o.end_time,
         case when tt.total_weight>0 then td.required_positions*o.type_weight/tt.total_weight else 0 end::numeric as fair_target
  from tmp_shadow_opportunities o
  join tmp_shadow_type_totals tt using(start_time,end_time)
  join tmp_shadow_type_demand td using(start_time,end_time);
  create unique index on tmp_shadow_type_fair_targets(user_id,start_time,end_time);

  create temporary table tmp_shadow_premium_weights on commit drop as
  select user_id,sum(premium_weight)::numeric as user_weight
  from tmp_shadow_opportunities group by user_id;
  create unique index on tmp_shadow_premium_weights(user_id);

  create temporary table tmp_shadow_premium_total on commit drop as
  select coalesce(sum(user_weight),0)::numeric as total_weight from tmp_shadow_premium_weights;

  create temporary table tmp_shadow_premium_demand on commit drop as
  select coalesce(sum(sm.premium_200_hours*s.min_workers),0)::numeric as required_hours
  from public.dynamic_availability_slots s
  join tmp_shadow_slot_metrics sm on sm.slot_id=s.id
  where s.period_id=period.id;

  create temporary table tmp_shadow_premium_fair_targets on commit drop as
  select t.user_id,
         case when pt.total_weight>0 then pd.required_hours*coalesce(pw.user_weight,0)/pt.total_weight else 0 end::numeric as fair_hours
  from public.dynamic_schedule_shadow_targets t
  cross join tmp_shadow_premium_total pt
  cross join tmp_shadow_premium_demand pd
  left join tmp_shadow_premium_weights pw on pw.user_id=t.user_id
  where t.draft_id=v_draft_id;
  create unique index on tmp_shadow_premium_fair_targets(user_id);

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

  -- Cache slot scarcity and required-fill state once. The previous version called
  -- dynamic_shadow_candidate_allowed() for every remaining slot on every required
  -- assignment iteration, causing tens of thousands of expensive checks.
  create temporary table tmp_shadow_slot_state(
    slot_id uuid primary key,
    static_candidate_count integer not null default 0,
    required_assigned integer not null default 0
  ) on commit drop;

  insert into tmp_shadow_slot_state(slot_id,static_candidate_count,required_assigned)
  select s.id,
         count(distinct t.user_id) filter (where e.availability_status in ('preferred','available','avoid'))::integer,
         0
  from public.dynamic_availability_slots s
  left join public.dynamic_availability_entries e on e.slot_id=s.id
  left join public.dynamic_availability_submissions sub on sub.id=e.submission_id and sub.period_id=period.id
  left join public.dynamic_schedule_shadow_targets t on t.draft_id=v_draft_id and t.user_id=sub.user_id
  where s.period_id=period.id
  group by s.id;

  loop
    select candidate_slot.* into sl
    from public.dynamic_availability_slots candidate_slot
    join tmp_shadow_slot_state ss on ss.slot_id=candidate_slot.id
    where candidate_slot.period_id=period.id
      and not (candidate_slot.id = any(blocked_slots))
      and ss.required_assigned < candidate_slot.min_workers
    order by ss.static_candidate_count asc,
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
        + greatest(coalesce(t.requested_target,0)-t.assigned_count,0)*fairness_weight*t.employment_factor
        + greatest(t.proportional_target-t.assigned_count,0)*fairness_weight*0.35
        -- Fixed whole-month fair share, normalized by the employee's weighted availability.
        + (coalesce((select ft.fair_target from tmp_shadow_user_fair_targets ft where ft.user_id=t.user_id),0)
           - t.assigned_count)*fairness_weight*2.25
        -- Fixed fair share for this visual shift type. Unlike v4, this does not start near zero
        -- and slowly move during generation; the full-month destination is known from the start.
        + (coalesce((select tf.fair_target from tmp_shadow_type_fair_targets tf
                     where tf.user_id=t.user_id and tf.start_time=sl.start_time and tf.end_time=sl.end_time),0)
           - coalesce((select tc.assigned_count from tmp_shadow_type_counts tc
                       where tc.user_id=t.user_id and tc.start_time=sl.start_time and tc.end_time=sl.end_time),0))
          *fairness_weight*1.75
        -- Balance 200% hours against the employee's share of premium opportunities.
        + (coalesce((select pf.fair_hours from tmp_shadow_premium_fair_targets pf where pf.user_id=t.user_id),0)
           - coalesce((select pc.assigned_hours from tmp_shadow_premium_counts pc where pc.user_id=t.user_id),0))
          *fairness_weight*0.55
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
      select greatest(sl.min_workers-ss.required_assigned,0) into remaining_positions
      from tmp_shadow_slot_state ss where ss.slot_id=sl.id;
      unfilled:=unfilled+remaining_positions;
      blocked_slots:=array_append(blocked_slots,sl.id);
      continue;
    end if;

    insert into public.dynamic_schedule_shadow_assignments(draft_id,slot_id,user_id,assignment_tier,score,reasons)
    values(v_draft_id,sl.id,chosen_user,'required',chosen_score,jsonb_build_array(
      'כיסוי משמרת','קדימות למשמרות עם מעט מועמדים',
      case when chosen_assigned<coalesce(chosen_min,0) then 'השלמת מינימום חודשי'
           when chosen_target is not null and chosen_assigned<chosen_target then 'איזון לכיוון היעד החודשי'
           when chosen_target is null then 'כמה שיותר — חלוקה לפי זמינות והוגנות' else 'העובד נשאר מועמד גם לאחר הגעה ליעד' end,
      case chosen_status when 'preferred' then 'מעדיף' when 'available' then 'זמין' when 'avoid' then 'מעדיף שלא — נבחר רק לאחר שקלול עדיפות נמוכה' else chosen_status end
    ));
    update public.dynamic_schedule_shadow_targets t set assigned_count=t.assigned_count+1
    where t.draft_id=v_draft_id and t.user_id=chosen_user;
    update tmp_shadow_slot_state ss set required_assigned=ss.required_assigned+1 where ss.slot_id=sl.id;
    insert into tmp_shadow_type_counts(user_id,start_time,end_time,assigned_count)
    values(chosen_user,sl.start_time,sl.end_time,1)
    on conflict(user_id,start_time,end_time) do update set assigned_count=tmp_shadow_type_counts.assigned_count+1;
    update tmp_shadow_type_positions tp set assigned_count=tp.assigned_count+1
    where tp.start_time=sl.start_time and tp.end_time=sl.end_time;
    update tmp_shadow_premium_counts pc
    set assigned_hours=pc.assigned_hours+coalesce((select sm.premium_200_hours from tmp_shadow_slot_metrics sm where sm.slot_id=sl.id),0)
    where pc.user_id=chosen_user;
    if chosen_status='avoid' then avoid_assignments:=avoid_assignments+1; end if;
    if chosen_target is not null and chosen_assigned>=chosen_target then above_target_assignments:=above_target_assignments+1; end if;
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
          + greatest(coalesce(t.requested_target,0)-t.assigned_count,0)*fairness_weight*t.employment_factor
          + greatest(t.proportional_target-t.assigned_count,0)*fairness_weight*0.35
          + (coalesce((select ft.fair_target from tmp_shadow_user_fair_targets ft where ft.user_id=t.user_id),0)
             - t.assigned_count)*fairness_weight*2.25
          + (coalesce((select tf.fair_target from tmp_shadow_type_fair_targets tf
                       where tf.user_id=t.user_id and tf.start_time=sl.start_time and tf.end_time=sl.end_time),0)
             - coalesce((select tc.assigned_count from tmp_shadow_type_counts tc
                         where tc.user_id=t.user_id and tc.start_time=sl.start_time and tc.end_time=sl.end_time),0))
            *fairness_weight*1.75
          + (coalesce((select pf.fair_hours from tmp_shadow_premium_fair_targets pf where pf.user_id=t.user_id),0)
             - coalesce((select pc.assigned_hours from tmp_shadow_premium_counts pc where pc.user_id=t.user_id),0))
            *fairness_weight*0.55
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
        case when chosen_target is not null and chosen_assigned<chosen_target then 'איזון לכיוון היעד החודשי' else 'היעד החודשי הוא העדפה ולא חסם' end,
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
      if chosen_target is not null and chosen_assigned>=chosen_target then above_target_assignments:=above_target_assignments+1; end if;
      assigned_optional:=assigned_optional+1;
    end loop;
  end loop;

  update public.dynamic_schedule_shadow_drafts d
  set status=case when unfilled=0 then 'generated' else 'incomplete' end,
      metrics=jsonb_build_object(
        'requiredAssignmentsCreated',assigned_required,'optionalAssignmentsCreated',assigned_optional,
        'unfilledRequiredPositions',unfilled,'avoidAssignments',avoid_assignments,
        'aboveTargetAssignments',above_target_assignments,
        'algorithm','availability_normalized_fair_share_v2_6','wholePeriodScarcity',true,'availabilityNormalizedFairShare',true,
        'targetIsEligibilityCutoff',false,'employmentScopeIsEligibilityCutoff',false,
        'partTimeRecommendationFactor',0.5
      ),updated_at=now()
  where d.id=v_draft_id;

  return jsonb_build_object(
    'draftId',v_draft_id,'mode','shadow','requiredAssignmentsCreated',assigned_required,
    'optionalAssignmentsCreated',assigned_optional,'unfilledRequiredPositions',unfilled,
    'avoidAssignments',avoid_assignments,'aboveTargetAssignments',above_target_assignments,
    'algorithm','availability_normalized_fair_share_v2_6','wholePeriodScarcity',true,'availabilityNormalizedFairShare',true,
    'targetIsEligibilityCutoff',false,'employmentScopeIsEligibilityCutoff',false,
    'partTimeRecommendationFactor',0.5,'feasibility',feasibility
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.create_dynamic_schedule_shadow_draft_attempt(requested_job_type_id uuid, requested_year integer, requested_month integer, requested_attempt integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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

  -- Whole-month opportunity share. This is the central v5 target: required monthly demand is
  -- distributed proportionally to weighted availability (preferred > available > avoid).
  create temporary table tmp_shadow_user_opportunity_totals on commit drop as
  select user_id,coalesce(sum(type_weight),0)::numeric as opportunity_weight
  from tmp_shadow_opportunities
  group by user_id;
  create unique index on tmp_shadow_user_opportunity_totals(user_id);

  create temporary table tmp_shadow_month_demand on commit drop as
  select coalesce(sum(s.min_workers),0)::numeric as required_positions
  from public.dynamic_availability_slots s
  where s.period_id=period.id;

  create temporary table tmp_shadow_month_opportunity_total on commit drop as
  select coalesce(sum(opportunity_weight),0)::numeric as total_weight
  from tmp_shadow_user_opportunity_totals;

  create temporary table tmp_shadow_user_fair_targets on commit drop as
  select t.user_id,
         case when mot.total_weight>0
              then md.required_positions * coalesce(uot.opportunity_weight,0) / mot.total_weight
              else 0 end::numeric as fair_target
  from public.dynamic_schedule_shadow_targets t
  cross join tmp_shadow_month_demand md
  cross join tmp_shadow_month_opportunity_total mot
  left join tmp_shadow_user_opportunity_totals uot on uot.user_id=t.user_id
  where t.draft_id=v_draft_id;
  create unique index on tmp_shadow_user_fair_targets(user_id);

  create temporary table tmp_shadow_type_totals on commit drop as
  select start_time,end_time,sum(type_weight)::numeric as total_weight
  from tmp_shadow_opportunities group by start_time,end_time;
  create unique index on tmp_shadow_type_totals(start_time,end_time);

  create temporary table tmp_shadow_type_demand on commit drop as
  select sm.start_time,sm.end_time,coalesce(sum(s.min_workers),0)::numeric as required_positions
  from public.dynamic_availability_slots s
  join tmp_shadow_slot_metrics sm on sm.slot_id=s.id
  where s.period_id=period.id
  group by sm.start_time,sm.end_time;
  create unique index on tmp_shadow_type_demand(start_time,end_time);

  create temporary table tmp_shadow_type_fair_targets on commit drop as
  select o.user_id,o.start_time,o.end_time,
         case when tt.total_weight>0 then td.required_positions*o.type_weight/tt.total_weight else 0 end::numeric as fair_target
  from tmp_shadow_opportunities o
  join tmp_shadow_type_totals tt using(start_time,end_time)
  join tmp_shadow_type_demand td using(start_time,end_time);
  create unique index on tmp_shadow_type_fair_targets(user_id,start_time,end_time);

  create temporary table tmp_shadow_premium_weights on commit drop as
  select user_id,sum(premium_weight)::numeric as user_weight
  from tmp_shadow_opportunities group by user_id;
  create unique index on tmp_shadow_premium_weights(user_id);

  create temporary table tmp_shadow_premium_total on commit drop as
  select coalesce(sum(user_weight),0)::numeric as total_weight from tmp_shadow_premium_weights;

  create temporary table tmp_shadow_premium_demand on commit drop as
  select coalesce(sum(sm.premium_200_hours*s.min_workers),0)::numeric as required_hours
  from public.dynamic_availability_slots s
  join tmp_shadow_slot_metrics sm on sm.slot_id=s.id
  where s.period_id=period.id;

  create temporary table tmp_shadow_premium_fair_targets on commit drop as
  select t.user_id,
         case when pt.total_weight>0 then pd.required_hours*coalesce(pw.user_weight,0)/pt.total_weight else 0 end::numeric as fair_hours
  from public.dynamic_schedule_shadow_targets t
  cross join tmp_shadow_premium_total pt
  cross join tmp_shadow_premium_demand pd
  left join tmp_shadow_premium_weights pw on pw.user_id=t.user_id
  where t.draft_id=v_draft_id;
  create unique index on tmp_shadow_premium_fair_targets(user_id);

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

  -- Cache slot scarcity and required-fill state once. The previous version called
  -- dynamic_shadow_candidate_allowed() for every remaining slot on every required
  -- assignment iteration, causing tens of thousands of expensive checks.
  create temporary table tmp_shadow_slot_state(
    slot_id uuid primary key,
    static_candidate_count integer not null default 0,
    required_assigned integer not null default 0
  ) on commit drop;

  insert into tmp_shadow_slot_state(slot_id,static_candidate_count,required_assigned)
  select s.id,
         count(distinct t.user_id) filter (where e.availability_status in ('preferred','available','avoid'))::integer,
         0
  from public.dynamic_availability_slots s
  left join public.dynamic_availability_entries e on e.slot_id=s.id
  left join public.dynamic_availability_submissions sub on sub.id=e.submission_id and sub.period_id=period.id
  left join public.dynamic_schedule_shadow_targets t on t.draft_id=v_draft_id and t.user_id=sub.user_id
  where s.period_id=period.id
  group by s.id;

  loop
    select candidate_slot.* into sl
    from public.dynamic_availability_slots candidate_slot
    join tmp_shadow_slot_state ss on ss.slot_id=candidate_slot.id
    where candidate_slot.period_id=period.id
      and not (candidate_slot.id = any(blocked_slots))
      and ss.required_assigned < candidate_slot.min_workers
    order by ss.static_candidate_count asc,
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
        + greatest(coalesce(t.requested_target,0)-t.assigned_count,0)*fairness_weight*t.employment_factor
        + greatest(t.proportional_target-t.assigned_count,0)*fairness_weight*0.35
        -- Fixed whole-month fair share, normalized by the employee's weighted availability.
        + (coalesce((select ft.fair_target from tmp_shadow_user_fair_targets ft where ft.user_id=t.user_id),0)
           - t.assigned_count)*fairness_weight*2.25
        -- Fixed fair share for this visual shift type. Unlike v4, this does not start near zero
        -- and slowly move during generation; the full-month destination is known from the start.
        + (coalesce((select tf.fair_target from tmp_shadow_type_fair_targets tf
                     where tf.user_id=t.user_id and tf.start_time=sl.start_time and tf.end_time=sl.end_time),0)
           - coalesce((select tc.assigned_count from tmp_shadow_type_counts tc
                       where tc.user_id=t.user_id and tc.start_time=sl.start_time and tc.end_time=sl.end_time),0))
          *fairness_weight*1.75
        -- Balance 200% hours against the employee's share of premium opportunities.
        + (coalesce((select pf.fair_hours from tmp_shadow_premium_fair_targets pf where pf.user_id=t.user_id),0)
           - coalesce((select pc.assigned_hours from tmp_shadow_premium_counts pc where pc.user_id=t.user_id),0))
          *fairness_weight*0.55
        + case e.availability_status when 'preferred' then preference_weight when 'available' then 0 when 'avoid' then -preference_weight*4 else -1000000 end
        + case when not max_hard and t.requested_max is not null and t.assigned_count>=t.requested_max
            then -fairness_weight*4*(t.assigned_count-t.requested_max+1) else 0 end as score
      from public.dynamic_schedule_shadow_targets t
      join public.dynamic_availability_submissions sub on sub.period_id=period.id and sub.user_id=t.user_id
      join public.dynamic_availability_entries e on e.submission_id=sub.id and e.slot_id=sl.id and e.availability_status in ('preferred','available','avoid')
      where t.draft_id=v_draft_id
        and (not max_hard or t.requested_max is null or t.assigned_count<t.requested_max)
        and public.dynamic_shadow_candidate_allowed(v_draft_id,t.user_id,sl.id,max_per_day,no_consecutive,min_rest)
      order by (score + ((abs(hashtext(user_id::text || ':' || sl.id::text || ':' || requested_attempt::text)) % 1000)::numeric / 1000) * fairness_weight * 0.20) desc,t.assigned_count asc,t.user_id limit 1
    ) c;

    if chosen_user is null then
      select greatest(sl.min_workers-ss.required_assigned,0) into remaining_positions
      from tmp_shadow_slot_state ss where ss.slot_id=sl.id;
      unfilled:=unfilled+remaining_positions;
      blocked_slots:=array_append(blocked_slots,sl.id);
      continue;
    end if;

    insert into public.dynamic_schedule_shadow_assignments(draft_id,slot_id,user_id,assignment_tier,score,reasons)
    values(v_draft_id,sl.id,chosen_user,'required',chosen_score,jsonb_build_array(
      'כיסוי משמרת','קדימות למשמרות עם מעט מועמדים',
      case when chosen_assigned<coalesce(chosen_min,0) then 'השלמת מינימום חודשי'
           when chosen_target is not null and chosen_assigned<chosen_target then 'איזון לכיוון היעד החודשי'
           when chosen_target is null then 'כמה שיותר — חלוקה לפי זמינות והוגנות' else 'העובד נשאר מועמד גם לאחר הגעה ליעד' end,
      case chosen_status when 'preferred' then 'מעדיף' when 'available' then 'זמין' when 'avoid' then 'מעדיף שלא — נבחר רק לאחר שקלול עדיפות נמוכה' else chosen_status end
    ));
    update public.dynamic_schedule_shadow_targets t set assigned_count=t.assigned_count+1
    where t.draft_id=v_draft_id and t.user_id=chosen_user;
    update tmp_shadow_slot_state ss set required_assigned=ss.required_assigned+1 where ss.slot_id=sl.id;
    insert into tmp_shadow_type_counts(user_id,start_time,end_time,assigned_count)
    values(chosen_user,sl.start_time,sl.end_time,1)
    on conflict(user_id,start_time,end_time) do update set assigned_count=tmp_shadow_type_counts.assigned_count+1;
    update tmp_shadow_type_positions tp set assigned_count=tp.assigned_count+1
    where tp.start_time=sl.start_time and tp.end_time=sl.end_time;
    update tmp_shadow_premium_counts pc
    set assigned_hours=pc.assigned_hours+coalesce((select sm.premium_200_hours from tmp_shadow_slot_metrics sm where sm.slot_id=sl.id),0)
    where pc.user_id=chosen_user;
    if chosen_status='avoid' then avoid_assignments:=avoid_assignments+1; end if;
    if chosen_target is not null and chosen_assigned>=chosen_target then above_target_assignments:=above_target_assignments+1; end if;
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
          + greatest(coalesce(t.requested_target,0)-t.assigned_count,0)*fairness_weight*t.employment_factor
          + greatest(t.proportional_target-t.assigned_count,0)*fairness_weight*0.35
          + (coalesce((select ft.fair_target from tmp_shadow_user_fair_targets ft where ft.user_id=t.user_id),0)
             - t.assigned_count)*fairness_weight*2.25
          + (coalesce((select tf.fair_target from tmp_shadow_type_fair_targets tf
                       where tf.user_id=t.user_id and tf.start_time=sl.start_time and tf.end_time=sl.end_time),0)
             - coalesce((select tc.assigned_count from tmp_shadow_type_counts tc
                         where tc.user_id=t.user_id and tc.start_time=sl.start_time and tc.end_time=sl.end_time),0))
            *fairness_weight*1.75
          + (coalesce((select pf.fair_hours from tmp_shadow_premium_fair_targets pf where pf.user_id=t.user_id),0)
             - coalesce((select pc.assigned_hours from tmp_shadow_premium_counts pc where pc.user_id=t.user_id),0))
            *fairness_weight*0.55
          + case when e.availability_status='preferred' then preference_weight else 0 end
          + case when not max_hard and t.requested_max is not null and t.assigned_count>=t.requested_max
              then -fairness_weight*4*(t.assigned_count-t.requested_max+1) else 0 end as score
        from public.dynamic_schedule_shadow_targets t
        join public.dynamic_availability_submissions sub on sub.period_id=period.id and sub.user_id=t.user_id
        join public.dynamic_availability_entries e on e.submission_id=sub.id and e.slot_id=sl.id and e.availability_status in ('preferred','available')
        where t.draft_id=v_draft_id
          and (not max_hard or t.requested_max is null or t.assigned_count<t.requested_max)
          and public.dynamic_shadow_candidate_allowed(v_draft_id,t.user_id,sl.id,max_per_day,no_consecutive,min_rest)
        order by (score + ((abs(hashtext(user_id::text || ':' || sl.id::text || ':' || requested_attempt::text)) % 1000)::numeric / 1000) * fairness_weight * 0.20) desc,t.assigned_count asc,t.user_id limit 1
      ) c;
      exit when chosen_user is null;
      insert into public.dynamic_schedule_shadow_assignments(draft_id,slot_id,user_id,assignment_tier,score,reasons)
      values(v_draft_id,sl.id,chosen_user,'target_optional',chosen_score,jsonb_build_array(
        'עובד נוסף עד יעד האיוש למשמרת',
        case when chosen_target is not null and chosen_assigned<chosen_target then 'איזון לכיוון היעד החודשי' else 'היעד החודשי הוא העדפה ולא חסם' end,
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
      if chosen_target is not null and chosen_assigned>=chosen_target then above_target_assignments:=above_target_assignments+1; end if;
      assigned_optional:=assigned_optional+1;
    end loop;
  end loop;

  update public.dynamic_schedule_shadow_drafts d
  set status=case when unfilled=0 then 'generated' else 'incomplete' end,
      metrics=jsonb_build_object(
        'requiredAssignmentsCreated',assigned_required,'optionalAssignmentsCreated',assigned_optional,
        'unfilledRequiredPositions',unfilled,'avoidAssignments',avoid_assignments,
        'aboveTargetAssignments',above_target_assignments,
        'algorithm','availability_normalized_fair_share_v2_7_weekly_rest_retry','wholePeriodScarcity',true,'availabilityNormalizedFairShare',true,
        'targetIsEligibilityCutoff',false,'employmentScopeIsEligibilityCutoff',false,
        'partTimeRecommendationFactor',0.5
      ),updated_at=now()
  where d.id=v_draft_id;

  return jsonb_build_object(
    'draftId',v_draft_id,'mode','shadow','requiredAssignmentsCreated',assigned_required,
    'optionalAssignmentsCreated',assigned_optional,'unfilledRequiredPositions',unfilled,
    'avoidAssignments',avoid_assignments,'aboveTargetAssignments',above_target_assignments,
    'algorithm','availability_normalized_fair_share_v2_7_weekly_rest_retry','wholePeriodScarcity',true,'availabilityNormalizedFairShare',true,
    'targetIsEligibilityCutoff',false,'employmentScopeIsEligibilityCutoff',false,
    'partTimeRecommendationFactor',0.5,'feasibility',feasibility
  );
end;
$function$;

commit;
