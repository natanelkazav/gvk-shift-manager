begin;

-- Phase 5: Generic scheduling / optimization engine foundation.
-- SHADOW ONLY. No production schedule or availability flow is replaced.

alter table public.job_types
  add column if not exists scheduling_config jsonb not null default '{}'::jsonb;

alter table public.job_types
  drop constraint if exists job_types_scheduling_config_object;
alter table public.job_types
  add constraint job_types_scheduling_config_object
  check (jsonb_typeof(scheduling_config) = 'object');

create table if not exists public.scheduling_rule_registry (
  rule_key text primary key,
  name text not null,
  description text,
  category text not null,
  supported_severities text[] not null default array['hard','soft']::text[],
  parameter_schema jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint scheduling_rule_registry_category_valid check (category in ('coverage','capacity','rest','fairness','distribution','custom')),
  constraint scheduling_rule_registry_schema_object check (jsonb_typeof(parameter_schema)='object')
);

insert into public.scheduling_rule_registry(rule_key,name,description,category,supported_severities,parameter_schema)
values
('no_overlap','מניעת חפיפת משמרות','אותו עובד לא יכול להיות משובץ לשתי משמרות חופפות.','rest',array['hard']::text[],'{}'::jsonb),
('no_consecutive','מניעת משמרות רצופות','מונע 06–14 ולאחריה 14–22 לאותו עובד.','rest',array['hard','soft']::text[],'{}'::jsonb),
('minimum_rest_minutes','מנוחה מינימלית','מספר דקות מנוחה מינימלי בין שתי משמרות.','rest',array['hard','soft']::text[],'{"minutes":{"type":"integer","minimum":0}}'::jsonb),
('max_shifts_per_day','מקסימום משמרות ביום','מגביל את מספר המשמרות לעובד ביום קלנדרי.','capacity',array['hard','soft']::text[],'{"count":{"type":"integer","minimum":1}}'::jsonb),
('monthly_maximum','מקסימום חודשי','המקסימום שהעובד הגיש הוא מגבלה קשיחה כברירת מחדל.','capacity',array['hard','soft']::text[],'{}'::jsonb),
('monthly_minimum','מינימום חודשי','מינימום חודשי יכול להיות יעד יחסי או דרישה קשיחה.','capacity',array['hard','soft']::text[],'{}'::jsonb),
('proportional_fairness','איזון פרופורציונלי','מחלק עומס יחסית ליעד/היקף המשרה ולא לפי מספר מוחלט בלבד.','fairness',array['soft']::text[],'{}'::jsonb),
('balance_nights','איזון לילות','מאזן משמרות לילה בין העובדים בהתאם ליעד היחסי.','distribution',array['soft']::text[],'{}'::jsonb),
('balance_weekends','איזון סופי שבוע','מאזן שישי ושבת בין העובדים.','distribution',array['soft']::text[],'{}'::jsonb),
('balance_holidays','איזון חגים','מאזן משמרות חג בין העובדים.','distribution',array['soft']::text[],'{}'::jsonb),
('coverage_priority','עדיפות לכיסוי','ממלא קודם את דרישת המינימום בכל המשמרות ורק לאחר מכן עובדים נוספים עד היעד.','coverage',array['hard']::text[],'{}'::jsonb)
on conflict (rule_key) do update set
  name=excluded.name,description=excluded.description,category=excluded.category,
  supported_severities=excluded.supported_severities,parameter_schema=excluded.parameter_schema,is_active=true,updated_at=now();

create table if not exists public.dynamic_schedule_shadow_drafts (
  id uuid primary key default gen_random_uuid(),
  job_type_id uuid not null references public.job_types(id) on delete restrict,
  availability_period_id uuid not null references public.dynamic_availability_periods(id) on delete cascade,
  year integer not null,
  month integer not null,
  status text not null default 'shadow',
  feasibility_snapshot jsonb not null default '{}'::jsonb,
  rules_snapshot jsonb not null default '{}'::jsonb,
  metrics jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dynamic_schedule_shadow_draft_status_valid check (status in ('shadow','generated','incomplete','failed')),
  constraint dynamic_schedule_shadow_json_objects check (
    jsonb_typeof(feasibility_snapshot)='object' and jsonb_typeof(rules_snapshot)='object' and jsonb_typeof(metrics)='object'
  )
);

create table if not exists public.dynamic_schedule_shadow_targets (
  draft_id uuid not null references public.dynamic_schedule_shadow_drafts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  requested_min integer,
  requested_target integer,
  requested_max integer,
  available_slots integer not null default 0,
  proportional_weight numeric not null default 1,
  proportional_target numeric not null default 0,
  assigned_count integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  primary key (draft_id,user_id),
  constraint dynamic_schedule_shadow_target_nonnegative check (
    coalesce(requested_min,0)>=0 and coalesce(requested_target,0)>=0 and coalesce(requested_max,0)>=0 and available_slots>=0 and assigned_count>=0
  )
);

create table if not exists public.dynamic_schedule_shadow_assignments (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid not null references public.dynamic_schedule_shadow_drafts(id) on delete cascade,
  slot_id uuid not null references public.dynamic_availability_slots(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  assignment_tier text not null default 'required',
  score numeric not null default 0,
  reasons jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique(draft_id,slot_id,user_id),
  constraint dynamic_schedule_shadow_assignment_tier_valid check (assignment_tier in ('required','target_optional')),
  constraint dynamic_schedule_shadow_assignment_reasons_array check (jsonb_typeof(reasons)='array')
);

create index if not exists dynamic_schedule_shadow_assignments_draft_slot_idx on public.dynamic_schedule_shadow_assignments(draft_id,slot_id);
create index if not exists dynamic_schedule_shadow_assignments_draft_user_idx on public.dynamic_schedule_shadow_assignments(draft_id,user_id);

alter table public.scheduling_rule_registry enable row level security;
alter table public.dynamic_schedule_shadow_drafts enable row level security;
alter table public.dynamic_schedule_shadow_targets enable row level security;
alter table public.dynamic_schedule_shadow_assignments enable row level security;
revoke all on public.scheduling_rule_registry from anon, authenticated;
revoke all on public.dynamic_schedule_shadow_drafts from anon, authenticated;
revoke all on public.dynamic_schedule_shadow_targets from anon, authenticated;
revoke all on public.dynamic_schedule_shadow_assignments from anon, authenticated;

-- Default rule configuration for seeded roles. Still configuration only.
update public.job_types
set scheduling_config = jsonb_build_object(
  'minimumMode','soft',
  'maximumMode','hard',
  'proportionalFairness',true,
  'rules',jsonb_build_object(
    'noOverlap',jsonb_build_object('enabled',true,'severity','hard'),
    'noConsecutive',jsonb_build_object('enabled',true,'severity','hard'),
    'minimumRestMinutes',jsonb_build_object('enabled',false,'severity','hard','value',0),
    'maxShiftsPerDay',jsonb_build_object('enabled',true,'severity','hard','value',1),
    'balanceNights',jsonb_build_object('enabled',true,'severity','soft','weight',60),
    'balanceWeekends',jsonb_build_object('enabled',true,'severity','soft','weight',50),
    'balanceHolidays',jsonb_build_object('enabled',true,'severity','soft','weight',50)
  ),
  'weights',jsonb_build_object('coverage',1000,'proportionalFairness',100,'preference',30,'targetOptional',15)
), updated_at=now()
where code in ('dispatcher','on_call','morning_driver')
  and scheduling_config='{}'::jsonb;

-- Admin payload now exposes scheduling configuration and rule registry.
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
        'memberCount',(select count(*) from public.job_type_memberships m where m.job_type_id=jt.id)
      ) order by jt.is_active desc,jt.name) from public.job_types jt
    ),'[]'::jsonb)
  );
end;
$function$;

-- Job type save now persists scheduling_config as part of the same reviewed configuration.
create or replace function public.save_dynamic_job_type(requested_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path=''
as $function$
declare
  current_user_id uuid:=auth.uid(); target_id uuid; target_group_id uuid; target_code text; target_name text; target_description text;
  target_scope text; target_pay_model text; target_is_active boolean; target_pay_config jsonb; target_availability_config jsonb;
  target_scheduling_config jsonb; target_statistics_config jsonb; capability_value jsonb; permission_value jsonb;
begin
  if current_user_id is null then raise exception 'not authenticated'; end if;
  if not exists(select 1 from public.profiles p where p.id=current_user_id and p.is_active=true) then raise exception 'user not active'; end if;
  if not exists(select 1 from public.user_permissions up where up.user_id=current_user_id and up.permission_key='users.manage') then raise exception 'not allowed'; end if;
  target_id:=nullif(requested_payload->>'id','')::uuid; target_group_id:=nullif(requested_payload->>'scheduleGroupId','')::uuid;
  target_code:=lower(trim(coalesce(requested_payload->>'code',''))); target_name:=trim(coalesce(requested_payload->>'name',''));
  target_description:=nullif(trim(coalesce(requested_payload->>'description','')),''); target_scope:=coalesce(requested_payload->>'employmentScope','flexible');
  target_pay_model:=coalesce(requested_payload->>'payModel','none'); target_is_active:=coalesce((requested_payload->>'isActive')::boolean,true);
  target_pay_config:=coalesce(requested_payload->'payConfig','{}'::jsonb); target_availability_config:=coalesce(requested_payload->'availabilityConfig','{}'::jsonb);
  target_scheduling_config:=coalesce(requested_payload->'schedulingConfig','{}'::jsonb); target_statistics_config:=coalesce(requested_payload->'statisticsConfig','{}'::jsonb);
  if target_group_id is null or not exists(select 1 from public.schedule_groups sg where sg.id=target_group_id) then raise exception 'schedule group not found'; end if;
  if target_code='' or target_code !~ '^[a-z0-9_]+$' then raise exception 'invalid job type code'; end if;
  if target_name='' then raise exception 'job type name is required'; end if;
  if target_scope not in ('full_time','part_time','flexible','other') then raise exception 'invalid employment scope'; end if;
  if target_pay_model not in ('hourly','per_shift','per_day','mixed','none') then raise exception 'invalid pay model'; end if;
  if target_id is null then
    insert into public.job_types(schedule_group_id,code,name,description,is_active,employment_scope,pay_model,pay_config,availability_config,scheduling_config,statistics_config,ai_config)
    values(target_group_id,target_code,target_name,target_description,target_is_active,target_scope,target_pay_model,target_pay_config,target_availability_config,target_scheduling_config,target_statistics_config,'{"allow_suggestions":true,"auto_apply":false}'::jsonb)
    returning id into target_id;
  else
    update public.job_types set schedule_group_id=target_group_id,code=case when legacy_role is null then target_code else code end,name=target_name,
      description=target_description,is_active=target_is_active,employment_scope=target_scope,pay_model=target_pay_model,pay_config=target_pay_config,
      availability_config=target_availability_config,scheduling_config=target_scheduling_config,statistics_config=target_statistics_config
    where id=target_id;
    if not found then raise exception 'job type not found'; end if;
  end if;
  delete from public.job_type_capabilities where job_type_id=target_id;
  for capability_value in select value from jsonb_array_elements(coalesce(requested_payload->'capabilities','[]'::jsonb)) loop
    insert into public.job_type_capabilities(job_type_id,capability_key,enabled,source) values(target_id,trim(both '"' from capability_value::text),true,'manual') on conflict(job_type_id,capability_key) do update set enabled=true,source='manual';
  end loop;
  delete from public.job_type_default_permissions where job_type_id=target_id;
  for permission_value in select value from jsonb_array_elements(coalesce(requested_payload->'defaultPermissions','[]'::jsonb)) loop
    insert into public.job_type_default_permissions(job_type_id,permission_key,source) values(target_id,trim(both '"' from permission_value::text),'manual') on conflict(job_type_id,permission_key) do nothing;
  end loop;
  return target_id;
end;
$function$;

create or replace function public.analyze_dynamic_schedule_feasibility(requested_job_type_id uuid,requested_year integer,requested_month integer)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  current_user_id uuid:=auth.uid(); job public.job_types%rowtype; period public.dynamic_availability_periods%rowtype;
  required_total integer:=0; target_total integer:=0; aggregate_min integer:=0; aggregate_target integer:=0; aggregate_max integer:=0;
  shortage_slots integer:=0; member_json jsonb; min_mode text; max_mode text;
begin
  if current_user_id is null then raise exception 'not authenticated'; end if;
  if not exists(select 1 from public.user_permissions up where up.user_id=current_user_id and up.permission_key in ('users.view','users.manage')) then raise exception 'not allowed'; end if;
  select * into job from public.job_types where id=requested_job_type_id; if job.id is null then raise exception 'job type not found'; end if;
  select * into period from public.dynamic_availability_periods where job_type_id=job.id and year=requested_year and month=requested_month;
  if period.id is null then return jsonb_build_object('materialized',false,'mode','shadow','message','יש ליצור קודם תקופת אילוצים ב־Shadow Mode.'); end if;
  select coalesce(sum(min_workers),0),coalesce(sum(target_workers),0) into required_total,target_total from public.dynamic_availability_slots where period_id=period.id;
  min_mode:=coalesce(job.scheduling_config->>'minimumMode','soft'); max_mode:=coalesce(job.scheduling_config->>'maximumMode','hard');

  with members as (
    select m.user_id,p.display_name,
      coalesce(s.min_shifts,(job.availability_config#>>'{monthlyCapacity,defaultMin}')::integer,0) req_min,
      coalesce(s.target_shifts,(job.availability_config#>>'{monthlyCapacity,defaultTarget}')::integer,
               s.min_shifts,(job.availability_config#>>'{monthlyCapacity,defaultMin}')::integer,1) req_target,
      coalesce(s.max_shifts,(job.availability_config#>>'{monthlyCapacity,defaultMax}')::integer,2147483647) req_max,
      (select count(*) from public.dynamic_availability_entries e join public.dynamic_availability_submissions ss on ss.id=e.submission_id where ss.period_id=period.id and ss.user_id=m.user_id and e.availability_status in ('available','preferred')) available_slots
    from public.job_type_memberships m join public.profiles p on p.id=m.user_id
    left join public.dynamic_availability_submissions s on s.period_id=period.id and s.user_id=m.user_id
    where m.job_type_id=job.id and p.is_active=true
  ), weighted as (
    select *,greatest(req_target,req_min,1)::numeric weight from members
  ), totals as (select greatest(sum(weight),1) total_weight from weighted), calculated as (
    select w.*,round(required_total * w.weight/t.total_weight,2) raw_share,
      least(w.req_max,w.available_slots)::integer capacity_cap
    from weighted w cross join totals t
  )
  select coalesce(sum(req_min),0),coalesce(sum(req_target),0),coalesce(sum(case when req_max=2147483647 then required_total else req_max end),0),
    coalesce(jsonb_agg(jsonb_build_object(
      'userId',user_id,'displayName',display_name,'minimum',req_min,'target',req_target,'maximum',case when req_max=2147483647 then null else req_max end,
      'availableSlots',available_slots,'weight',weight,'rawProportionalTarget',raw_share,'capacityCap',capacity_cap,
      'proportionalTarget',least(raw_share,capacity_cap::numeric)
    ) order by display_name),'[]'::jsonb)
  into aggregate_min,aggregate_target,aggregate_max,member_json from calculated;

  select count(*) into shortage_slots from (
    select sl.id from public.dynamic_availability_slots sl
    where sl.period_id=period.id and (
      select count(distinct ss.user_id) from public.dynamic_availability_entries e
      join public.dynamic_availability_submissions ss on ss.id=e.submission_id
      join public.job_type_memberships m on m.user_id=ss.user_id and m.job_type_id=job.id
      where e.slot_id=sl.id and e.availability_status in ('available','preferred')
    ) < sl.min_workers
  ) q;

  return jsonb_build_object(
    'materialized',true,'periodId',period.id,'jobTypeId',job.id,'year',requested_year,'month',requested_month,'mode','shadow',
    'requiredAssignments',required_total,'targetAssignments',target_total,'aggregateMinimum',aggregate_min,'aggregateTarget',aggregate_target,'aggregateMaximum',aggregate_max,
    'minimumMode',min_mode,'maximumMode',max_mode,
    'minimumDemandExcess',greatest(aggregate_min-required_total,0),'maximumCapacityShortage',greatest(required_total-aggregate_max,0),
    'slotsWithoutEnoughCandidates',shortage_slots,
    'canMeetAllMinimums',aggregate_min<=required_total,'canCoverRequiredByMaximums',aggregate_max>=required_total,'hasCandidateShortages',shortage_slots>0,
    'members',member_json,
    'warnings',jsonb_strip_nulls(jsonb_build_object(
      'minimums',case when aggregate_min>required_total then 'סכום המינימום של העובדים גבוה מכמות ההקצאות הקיימת; המנוע יעבור לחלוקה פרופורציונלית.' end,
      'maximums',case when aggregate_max<required_total then 'גם אם כל עובד יקבל את המקסימום שלו, אין מספיק קיבולת לכיסוי כל המשמרות.' end,
      'candidates',case when shortage_slots>0 then shortage_slots || ' משמרות ללא מספיק מועמדים זמינים.' end
    ))
  );
end;
$function$;


create or replace function public.dynamic_shadow_candidate_allowed(
  requested_draft_id uuid,
  requested_user_id uuid,
  requested_slot_id uuid,
  requested_max_shifts_per_day integer,
  requested_no_consecutive boolean,
  requested_min_rest_minutes integer
)
returns boolean
language plpgsql
security definer
set search_path=''
as $function$
declare
  candidate_slot public.dynamic_availability_slots%rowtype;
  candidate_start timestamp;
  candidate_end timestamp;
  existing record;
begin
  select * into candidate_slot from public.dynamic_availability_slots where id=requested_slot_id;
  if candidate_slot.id is null then return false; end if;

  candidate_start := candidate_slot.shift_date + candidate_slot.start_time;
  candidate_end := candidate_slot.shift_date + candidate_slot.end_time;
  if candidate_slot.end_time <= candidate_slot.start_time then candidate_end := candidate_end + interval '1 day'; end if;

  if exists(select 1 from public.dynamic_schedule_shadow_assignments a where a.draft_id=requested_draft_id and a.slot_id=requested_slot_id and a.user_id=requested_user_id) then return false; end if;

  if (select count(*) from public.dynamic_schedule_shadow_assignments a join public.dynamic_availability_slots x on x.id=a.slot_id where a.draft_id=requested_draft_id and a.user_id=requested_user_id and x.shift_date=candidate_slot.shift_date) >= requested_max_shifts_per_day then return false; end if;

  for existing in
    select x.* from public.dynamic_schedule_shadow_assignments a
    join public.dynamic_availability_slots x on x.id=a.slot_id
    where a.draft_id=requested_draft_id and a.user_id=requested_user_id
  loop
    declare
      existing_start timestamp := existing.shift_date + existing.start_time;
      existing_end timestamp := existing.shift_date + existing.end_time;
    begin
      if existing.end_time <= existing.start_time then existing_end := existing_end + interval '1 day'; end if;
      if candidate_start < existing_end and existing_start < candidate_end then return false; end if;
      if requested_no_consecutive and (candidate_start=existing_end or candidate_end=existing_start) then return false; end if;
      if requested_min_rest_minutes > 0 then
        if existing_end <= candidate_start and extract(epoch from (candidate_start-existing_end))/60 < requested_min_rest_minutes then return false; end if;
        if candidate_end <= existing_start and extract(epoch from (existing_start-candidate_end))/60 < requested_min_rest_minutes then return false; end if;
      end if;
    end;
  end loop;
  return true;
end;
$function$;

create or replace function public.create_dynamic_schedule_shadow_draft(requested_job_type_id uuid,requested_year integer,requested_month integer)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  current_user_id uuid:=auth.uid(); job public.job_types%rowtype; period public.dynamic_availability_periods%rowtype; draft_id uuid;
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
  values(job.id,period.id,requested_year,requested_month,'shadow',feasibility,job.scheduling_config,current_user_id) returning id into draft_id;

  insert into public.dynamic_schedule_shadow_targets(draft_id,user_id,requested_min,requested_target,requested_max,available_slots,proportional_weight,proportional_target)
  select draft_id,(m->>'userId')::uuid,(m->>'minimum')::integer,(m->>'target')::integer,nullif(m->>'maximum','')::integer,
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
        where t.draft_id=draft_id
          and (not max_hard or t.requested_max is null or t.assigned_count<t.requested_max)
          and public.dynamic_shadow_candidate_allowed(draft_id,t.user_id,sl.id,max_per_day,no_consecutive,min_rest)
        order by score desc,t.assigned_count asc,t.user_id
        limit 1
      ) cand;
      if chosen_user is null then unfilled:=unfilled+1; exit; end if;
      insert into public.dynamic_schedule_shadow_assignments(draft_id,slot_id,user_id,assignment_tier,score,reasons)
      values(draft_id,sl.id,chosen_user,'required',chosen_score,jsonb_build_array('כיסוי משמרת','איזון פרופורציונלי',case when chosen_status='preferred' then 'העדפת עובד' else 'זמין' end));
      update public.dynamic_schedule_shadow_targets set assigned_count=assigned_count+1 where draft_id=draft_id and user_id=chosen_user;
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
        where t.draft_id=draft_id and (not max_hard or t.requested_max is null or t.assigned_count<t.requested_max)
          and public.dynamic_shadow_candidate_allowed(draft_id,t.user_id,sl.id,max_per_day,no_consecutive,min_rest)
        order by score desc,t.assigned_count asc,t.user_id limit 1
      ) cand;
      if chosen_user is null then exit; end if;
      insert into public.dynamic_schedule_shadow_assignments(draft_id,slot_id,user_id,assignment_tier,score,reasons)
      values(draft_id,sl.id,chosen_user,'target_optional',chosen_score,jsonb_build_array('עובד נוסף עד היעד','איזון פרופורציונלי',case when chosen_status='preferred' then 'העדפת עובד' else 'זמין' end));
      update public.dynamic_schedule_shadow_targets set assigned_count=assigned_count+1 where draft_id=draft_id and user_id=chosen_user;
      assigned_optional:=assigned_optional+1;
    end loop;
  end loop;

  update public.dynamic_schedule_shadow_drafts set status=case when unfilled=0 then 'generated' else 'incomplete' end,
    metrics=jsonb_build_object('requiredAssignmentsCreated',assigned_required,'optionalAssignmentsCreated',assigned_optional,'unfilledRequiredPositions',unfilled,'algorithm','coverage_first_proportional_v1'),updated_at=now()
  where id=draft_id;
  return jsonb_build_object('draftId',draft_id,'mode','shadow','requiredAssignmentsCreated',assigned_required,'optionalAssignmentsCreated',assigned_optional,'unfilledRequiredPositions',unfilled,'feasibility',feasibility);
end;
$function$;

create or replace function public.get_dynamic_schedule_shadow_draft(requested_draft_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $function$
declare current_user_id uuid:=auth.uid(); d public.dynamic_schedule_shadow_drafts%rowtype;
begin
  if current_user_id is null then raise exception 'not authenticated'; end if;
  if not exists(select 1 from public.user_permissions up where up.user_id=current_user_id and up.permission_key in ('users.view','users.manage')) then raise exception 'not allowed'; end if;
  select * into d from public.dynamic_schedule_shadow_drafts where id=requested_draft_id; if d.id is null then raise exception 'draft not found'; end if;
  return jsonb_build_object('draftId',d.id,'jobTypeId',d.job_type_id,'year',d.year,'month',d.month,'status',d.status,'mode','shadow','feasibility',d.feasibility_snapshot,'metrics',d.metrics,
    'targets',coalesce((select jsonb_agg(jsonb_build_object('userId',t.user_id,'displayName',p.display_name,'minimum',t.requested_min,'target',t.requested_target,'maximum',t.requested_max,'availableSlots',t.available_slots,'proportionalTarget',t.proportional_target,'assigned',t.assigned_count) order by p.display_name) from public.dynamic_schedule_shadow_targets t join public.profiles p on p.id=t.user_id where t.draft_id=d.id),'[]'::jsonb),
    'assignments',coalesce((select jsonb_agg(jsonb_build_object('slotId',a.slot_id,'date',s.shift_date,'shiftName',s.shift_name,'startTime',s.start_time,'endTime',s.end_time,'userId',a.user_id,'displayName',p.display_name,'tier',a.assignment_tier,'score',a.score,'reasons',a.reasons) order by s.shift_date,s.start_time,a.assignment_tier,p.display_name) from public.dynamic_schedule_shadow_assignments a join public.dynamic_availability_slots s on s.id=a.slot_id join public.profiles p on p.id=a.user_id where a.draft_id=d.id),'[]'::jsonb)
  );
end;$function$;

create or replace function public.submit_dynamic_scheduling_rule_proposal(requested_job_type_id uuid,requested_text text)
returns uuid language plpgsql security definer set search_path='' as $function$
declare current_user_id uuid:=auth.uid(); suggestion_id uuid;
begin
  if current_user_id is null then raise exception 'not authenticated'; end if;
  if not exists(select 1 from public.user_permissions up where up.user_id=current_user_id and up.permission_key='users.manage') then raise exception 'not allowed'; end if;
  if length(trim(coalesce(requested_text,'')))<5 then raise exception 'rule text is too short'; end if;
  insert into public.job_type_ai_suggestions(job_type_id,suggestion_type,status,input_context,suggestion,created_by)
  values(requested_job_type_id,'scheduling_rule_natural_language','pending',jsonb_build_object('text',trim(requested_text)),jsonb_build_object('state','awaiting_ai_interpretation','autoApply',false),current_user_id)
  returning id into suggestion_id;
  return suggestion_id;
end;$function$;

grant execute on function public.dynamic_shadow_candidate_allowed(uuid,uuid,uuid,integer,boolean,integer) to authenticated;
grant execute on function public.analyze_dynamic_schedule_feasibility(uuid,integer,integer) to authenticated;
grant execute on function public.create_dynamic_schedule_shadow_draft(uuid,integer,integer) to authenticated;
grant execute on function public.get_dynamic_schedule_shadow_draft(uuid) to authenticated;
grant execute on function public.submit_dynamic_scheduling_rule_proposal(uuid,text) to authenticated;

update public.scheduling_feature_flags set config=config || jsonb_build_object('phase','5','mode','shadow','availability_engine','shadow','scheduling_engine','shadow','optimizer','coverage_first_proportional_v1'),updated_at=now() where key='dynamic_job_types';

commit;
