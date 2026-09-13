begin;

-- Phase 7.1
-- 1) Explain every uncovered required Shadow position.
-- 2) For a job type whose employment_scope is "flexible", allow each member to
--    be marked full-time / part-time. This changes fairness recommendations only;
--    it is not an eligibility rule and never blocks a part-time member.

alter table public.dynamic_schedule_shadow_targets
  add column if not exists employment_scope text,
  add column if not exists employment_factor numeric not null default 1;

alter table public.dynamic_schedule_shadow_targets
  drop constraint if exists dynamic_schedule_shadow_targets_employment_scope_valid;
alter table public.dynamic_schedule_shadow_targets
  add constraint dynamic_schedule_shadow_targets_employment_scope_valid
  check (employment_scope is null or employment_scope in ('full_time','part_time'));

alter table public.dynamic_schedule_shadow_targets
  drop constraint if exists dynamic_schedule_shadow_targets_employment_factor_valid;
alter table public.dynamic_schedule_shadow_targets
  add constraint dynamic_schedule_shadow_targets_employment_factor_valid
  check (employment_factor > 0 and employment_factor <= 1);

create or replace function public.save_dynamic_job_type_member_employment_scope(
  requested_job_type_id uuid,
  requested_user_id uuid,
  requested_employment_scope text
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  current_user_id uuid := auth.uid();
  job public.job_types%rowtype;
  normalized_scope text := nullif(trim(coalesce(requested_employment_scope,'')),'');
begin
  if current_user_id is null then raise exception 'not authenticated'; end if;
  if not exists(
    select 1 from public.user_permissions up
    where up.user_id=current_user_id and up.permission_key='users.manage'
  ) then raise exception 'not allowed'; end if;

  select * into job from public.job_types where id=requested_job_type_id;
  if job.id is null then raise exception 'job type not found'; end if;
  if job.employment_scope <> 'flexible' then
    raise exception 'member employment scope is available only for flexible job types';
  end if;
  if normalized_scope is not null and normalized_scope not in ('full_time','part_time') then
    raise exception 'invalid member employment scope';
  end if;
  if not exists(
    select 1 from public.job_type_memberships m
    where m.job_type_id=job.id and m.user_id=requested_user_id
  ) then raise exception 'user is not a member of this job type'; end if;

  update public.job_type_memberships m
  set metadata = case
        when normalized_scope is null then m.metadata - 'employmentScope'
        else jsonb_set(m.metadata,'{employmentScope}',to_jsonb(normalized_scope),true)
      end,
      updated_at=now()
  where m.job_type_id=job.id and m.user_id=requested_user_id;

  return jsonb_build_object(
    'saved',true,
    'jobTypeId',job.id,
    'userId',requested_user_id,
    'employmentScope',normalized_scope,
    'recommendationFactor',case normalized_scope when 'part_time' then 0.5 else 1 end
  );
end;
$function$;

-- Admin payload: expose members and their per-member flexible-employment setting.
create or replace function public.get_dynamic_scheduling_admin()
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then raise exception 'not authenticated'; end if;
  if not exists(select 1 from public.profiles p where p.id=current_user_id and p.is_active=true) then raise exception 'user not active'; end if;
  if not exists(select 1 from public.user_permissions up where up.user_id=current_user_id and up.permission_key in ('users.view','users.manage')) then raise exception 'not allowed'; end if;

  return jsonb_build_object(
    'featureEnabled',coalesce((select enabled from public.scheduling_feature_flags where key='dynamic_job_types'),false),
    'featureMode',coalesce((select config->>'mode' from public.scheduling_feature_flags where key='dynamic_job_types'),'shadow'),
    'ruleRegistry',coalesce((select jsonb_agg(jsonb_build_object('key',r.rule_key,'name',r.name,'description',r.description,'category',r.category,'supportedSeverities',r.supported_severities,'parameterSchema',r.parameter_schema) order by r.category,r.name) from public.scheduling_rule_registry r where r.is_active),'[]'::jsonb),
    'scheduleGroups',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',sg.id,'code',sg.code,'name',sg.name,'description',sg.description,'isActive',sg.is_active,'legacyKind',sg.legacy_kind,'config',sg.config,
        'versionCount',(select count(*) from public.schedule_group_versions v where v.schedule_group_id=sg.id),
        'currentVersion',coalesce((select max(v.version_number) from public.schedule_group_versions v where v.schedule_group_id=sg.id),0),
        'shiftTemplates',coalesce((select jsonb_agg(jsonb_build_object(
          'id',st.id,'code',st.code,'name',st.name,'dayKind',st.day_kind,'startTime',st.start_time,'endTime',st.end_time,
          'minWorkers',st.required_workers,'targetWorkers',st.target_workers,'maxWorkers',st.max_workers,'sortOrder',st.sort_order,'isActive',st.is_active,'metadata',st.metadata,
          'paySegments',coalesce((select jsonb_agg(jsonb_build_object('id',ps.id,'startTime',ps.start_time,'endTime',ps.end_time,'multiplier',ps.multiplier,'label',ps.label,'sortOrder',ps.sort_order) order by ps.sort_order) from public.schedule_shift_pay_segments ps where ps.shift_template_id=st.id),'[]'::jsonb)
        ) order by st.day_kind,st.sort_order,st.start_time) from public.schedule_group_shift_templates st where st.schedule_group_id=sg.id),'[]'::jsonb),
        'dayRules',coalesce((select jsonb_agg(jsonb_build_object('dayKind',dr.day_kind,'behavior',dr.behavior,'inheritDayKind',dr.inherit_day_kind,'metadata',dr.metadata) order by dr.day_kind) from public.schedule_group_day_rules dr where dr.schedule_group_id=sg.id),'[]'::jsonb)
      ) order by sg.name) from public.schedule_groups sg
    ),'[]'::jsonb),
    'jobTypes',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',jt.id,'scheduleGroupId',jt.schedule_group_id,'code',jt.code,'name',jt.name,'description',jt.description,'isActive',jt.is_active,
        'legacyRole',jt.legacy_role,'employmentScope',jt.employment_scope,'payModel',jt.pay_model,'payConfig',jt.pay_config,
        'availabilityConfig',jt.availability_config,'schedulingConfig',jt.scheduling_config,'statisticsConfig',jt.statistics_config,'aiConfig',jt.ai_config,
        'capabilities',coalesce((select jsonb_agg(c.capability_key order by c.capability_key) from public.job_type_capabilities c where c.job_type_id=jt.id and c.enabled),'[]'::jsonb),
        'defaultPermissions',coalesce((select jsonb_agg(dp.permission_key order by dp.permission_key) from public.job_type_default_permissions dp where dp.job_type_id=jt.id),'[]'::jsonb),
        'memberCount',(select count(*) from public.job_type_memberships m where m.job_type_id=jt.id),
        'members',coalesce((
          select jsonb_agg(jsonb_build_object(
            'userId',m.user_id,
            'displayName',p.display_name,
            'isActive',p.is_active,
            'employmentScope',nullif(m.metadata->>'employmentScope',''),
            'recommendationFactor',case m.metadata->>'employmentScope' when 'part_time' then 0.5 else 1 end
          ) order by p.is_active desc,p.display_name)
          from public.job_type_memberships m
          join public.profiles p on p.id=m.user_id
          where m.job_type_id=jt.id
        ),'[]'::jsonb)
      ) order by jt.is_active desc,jt.name) from public.job_types jt
    ),'[]'::jsonb)
  );
end;
$function$;

-- Feasibility: per-member scope is a fairness recommendation only. For
-- flexible job types, part-time receives 0.5 of the proportional weight of a
-- comparable full-time member. It does not alter availability or eligibility.
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
    select *,greatest(req_target,req_min,1)::numeric * employment_factor weight
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
      'userId',user_id,'displayName',display_name,'minimum',req_min,'target',req_target,
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

-- Replace Phase-7 draft function only where employment weighting needs to be
-- carried into the target table and scoring. All Phase-7 scarcity semantics are preserved.
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
  if not exists(select 1 from public.user_permissions up where up.user_id=current_user_id and up.permission_key='users.manage') then raise exception 'not allowed'; end if;
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
        'algorithm','scarcity_first_soft_target_employment_v2_1','wholePeriodScarcity',true,
        'targetIsEligibilityCutoff',false,'employmentScopeIsEligibilityCutoff',false,
        'partTimeRecommendationFactor',0.5
      ),updated_at=now()
  where d.id=v_draft_id;

  return jsonb_build_object(
    'draftId',v_draft_id,'mode','shadow','requiredAssignmentsCreated',assigned_required,
    'optionalAssignmentsCreated',assigned_optional,'unfilledRequiredPositions',unfilled,
    'avoidAssignments',avoid_assignments,'aboveTargetAssignments',above_target_assignments,
    'algorithm','scarcity_first_soft_target_employment_v2_1','wholePeriodScarcity',true,
    'targetIsEligibilityCutoff',false,'employmentScopeIsEligibilityCutoff',false,
    'partTimeRecommendationFactor',0.5,'feasibility',feasibility
  );
end;
$function$;

-- Detailed rule-level diagnostic for one candidate on one Shadow slot.
create or replace function public.dynamic_shadow_candidate_block_reason(
  requested_draft_id uuid,
  requested_user_id uuid,
  requested_slot_id uuid,
  requested_max_shifts_per_day integer,
  requested_no_consecutive boolean,
  requested_min_rest_minutes integer,
  requested_max_hard boolean
)
returns text
language plpgsql
security definer
set search_path=''
as $function$
declare
  candidate_slot public.dynamic_availability_slots%rowtype;
  candidate_start timestamp;
  candidate_end timestamp;
  existing record;
  target_row public.dynamic_schedule_shadow_targets%rowtype;
begin
  select * into candidate_slot from public.dynamic_availability_slots where id=requested_slot_id;
  if candidate_slot.id is null then return 'משמרת לא נמצאה'; end if;
  select * into target_row from public.dynamic_schedule_shadow_targets where draft_id=requested_draft_id and user_id=requested_user_id;
  if target_row.user_id is null then return 'העובד אינו חלק מטיוטת ה־Shadow'; end if;
  if requested_max_hard and target_row.requested_max is not null and target_row.assigned_count>=target_row.requested_max then return 'הגיע למקסימום החודשי (Hard)'; end if;
  if exists(select 1 from public.dynamic_schedule_shadow_assignments a where a.draft_id=requested_draft_id and a.slot_id=requested_slot_id and a.user_id=requested_user_id) then return 'כבר משובץ במשמרת'; end if;
  if (select count(*) from public.dynamic_schedule_shadow_assignments a join public.dynamic_availability_slots s on s.id=a.slot_id where a.draft_id=requested_draft_id and a.user_id=requested_user_id and s.shift_date=candidate_slot.shift_date)>=requested_max_shifts_per_day then return 'הגיע למגבלת המשמרות ליום'; end if;

  candidate_start:=candidate_slot.shift_date+candidate_slot.start_time;
  candidate_end:=candidate_slot.shift_date+candidate_slot.end_time;
  if candidate_slot.end_time<=candidate_slot.start_time then candidate_end:=candidate_end+interval '1 day'; end if;

  for existing in
    select s.* from public.dynamic_schedule_shadow_assignments a
    join public.dynamic_availability_slots s on s.id=a.slot_id
    where a.draft_id=requested_draft_id and a.user_id=requested_user_id
  loop
    declare
      existing_start timestamp := existing.shift_date+existing.start_time;
      existing_end timestamp := existing.shift_date+existing.end_time;
    begin
      if existing.end_time<=existing.start_time then existing_end:=existing_end+interval '1 day'; end if;
      if candidate_start<existing_end and existing_start<candidate_end then return 'חפיפה עם משמרת שכבר שובצה'; end if;
      if requested_no_consecutive and (candidate_start=existing_end or candidate_end=existing_start) then return 'חוק מניעת משמרות רצופות'; end if;
      if requested_min_rest_minutes>0 then
        if existing_end<=candidate_start and extract(epoch from (candidate_start-existing_end))/60<requested_min_rest_minutes then return 'אין מספיק זמן מנוחה לפני המשמרת'; end if;
        if candidate_end<=existing_start and extract(epoch from (existing_start-candidate_end))/60<requested_min_rest_minutes then return 'אין מספיק זמן מנוחה אחרי המשמרת'; end if;
      end if;
    end;
  end loop;
  return null;
end;
$function$;

create or replace function public.get_dynamic_schedule_shadow_diagnostics(requested_draft_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  current_user_id uuid:=auth.uid();
  d public.dynamic_schedule_shadow_drafts%rowtype;
  job public.job_types%rowtype;
  period public.dynamic_availability_periods%rowtype;
  no_consecutive boolean;
  max_per_day integer;
  min_rest integer;
  max_hard boolean;
begin
  if current_user_id is null then raise exception 'not authenticated'; end if;
  if not exists(select 1 from public.user_permissions up where up.user_id=current_user_id and up.permission_key in ('users.view','users.manage')) then raise exception 'not allowed'; end if;
  select * into d from public.dynamic_schedule_shadow_drafts where id=requested_draft_id;
  if d.id is null then raise exception 'draft not found'; end if;
  select * into job from public.job_types where id=d.job_type_id;
  select * into period from public.dynamic_availability_periods where id=d.availability_period_id;

  no_consecutive:=coalesce((job.scheduling_config#>>'{rules,noConsecutive,enabled}')::boolean,true);
  max_per_day:=case when coalesce((job.scheduling_config#>>'{rules,maxShiftsPerDay,enabled}')::boolean,true) then coalesce((job.scheduling_config#>>'{rules,maxShiftsPerDay,value}')::integer,1) else 999 end;
  min_rest:=case when coalesce((job.scheduling_config#>>'{rules,minimumRestMinutes,enabled}')::boolean,false) then coalesce((job.scheduling_config#>>'{rules,minimumRestMinutes,value}')::integer,0) else 0 end;
  max_hard:=coalesce(job.scheduling_config->>'maximumMode','hard')='hard';

  return jsonb_build_object(
    'draftId',d.id,'mode','shadow',
    'unfilledSlots',coalesce((
      select jsonb_agg(jsonb_build_object(
        'slotId',sl.id,'date',sl.shift_date,'shiftName',sl.shift_name,
        'startTime',sl.start_time,'endTime',sl.end_time,'requiredWorkers',sl.min_workers,
        'assignedWorkers',(select count(*) from public.dynamic_schedule_shadow_assignments a where a.draft_id=d.id and a.slot_id=sl.id and a.assignment_tier='required'),
        'unfilledPositions',greatest(sl.min_workers-(select count(*) from public.dynamic_schedule_shadow_assignments a where a.draft_id=d.id and a.slot_id=sl.id and a.assignment_tier='required'),0),
        'assignedNames',coalesce((select jsonb_agg(p.display_name order by p.display_name) from public.dynamic_schedule_shadow_assignments a join public.profiles p on p.id=a.user_id where a.draft_id=d.id and a.slot_id=sl.id),'[]'::jsonb),
        'candidates',coalesce((
          select jsonb_agg(jsonb_build_object(
            'userId',t.user_id,'displayName',p.display_name,
            'availabilityStatus',e.availability_status,
            'assigned',t.assigned_count,'maximum',t.requested_max,
            'employmentScope',t.employment_scope,'employmentFactor',t.employment_factor,
            'eligible',case
              when e.availability_status is null then false
              when e.availability_status='unavailable' then false
              when public.dynamic_shadow_candidate_block_reason(d.id,t.user_id,sl.id,max_per_day,no_consecutive,min_rest,max_hard) is not null then false
              else true end,
            'reason',case
              when sub.id is null then 'לא הוגשו אילוצים לתקופה'
              when e.availability_status is null then 'לא סומן אילוץ למשמרת'
              when e.availability_status='unavailable' then 'סומן לא זמין'
              else coalesce(public.dynamic_shadow_candidate_block_reason(d.id,t.user_id,sl.id,max_per_day,no_consecutive,min_rest,max_hard),'כשיר כעת — אם העמדה נשארה ריקה יש מקום לשיפור נוסף באופטימיזציה') end
          ) order by p.display_name)
          from public.dynamic_schedule_shadow_targets t
          join public.profiles p on p.id=t.user_id
          left join public.dynamic_availability_submissions sub on sub.period_id=period.id and sub.user_id=t.user_id
          left join public.dynamic_availability_entries e on e.submission_id=sub.id and e.slot_id=sl.id
          where t.draft_id=d.id
        ),'[]'::jsonb)
      ) order by sl.shift_date,sl.start_time)
      from public.dynamic_availability_slots sl
      where sl.period_id=period.id
        and (select count(*) from public.dynamic_schedule_shadow_assignments a where a.draft_id=d.id and a.slot_id=sl.id and a.assignment_tier='required')<sl.min_workers
    ),'[]'::jsonb)
  );
end;
$function$;

grant execute on function public.save_dynamic_job_type_member_employment_scope(uuid,uuid,text) to authenticated;
grant execute on function public.analyze_dynamic_schedule_feasibility(uuid,integer,integer) to authenticated;
grant execute on function public.create_dynamic_schedule_shadow_draft(uuid,integer,integer) to authenticated;
grant execute on function public.dynamic_shadow_candidate_block_reason(uuid,uuid,uuid,integer,boolean,integer,boolean) to authenticated;
grant execute on function public.get_dynamic_schedule_shadow_diagnostics(uuid) to authenticated;

update public.scheduling_feature_flags
set config=config || jsonb_build_object(
  'phase','7.1','mode','shadow','optimizer','scarcity_first_soft_target_employment_v2_1',
  'unfilled_diagnostics',true,'flexible_employment_recommendations',true
),updated_at=now()
where key='dynamic_job_types';

commit;
