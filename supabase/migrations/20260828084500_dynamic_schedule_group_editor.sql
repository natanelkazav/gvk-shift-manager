begin;

-- Phase 3: editable schedule-group configuration in shadow mode.
-- This remains additive/configuration-only. No production scheduling RPC reads these rows yet.

alter table public.schedule_group_shift_templates
  add column if not exists target_workers integer,
  add column if not exists max_workers integer;

update public.schedule_group_shift_templates
set target_workers = coalesce(target_workers, required_workers),
    max_workers = coalesce(max_workers, coalesce(target_workers, required_workers));

alter table public.schedule_group_shift_templates
  alter column target_workers set default 1,
  alter column max_workers set default 1;

alter table public.schedule_group_shift_templates
  drop constraint if exists schedule_group_shift_templates_worker_targets_valid;

alter table public.schedule_group_shift_templates
  add constraint schedule_group_shift_templates_worker_targets_valid
  check (
    required_workers >= 0
    and target_workers is not null
    and max_workers is not null
    and target_workers >= required_workers
    and max_workers >= target_workers
    and max_workers <= 50
  );

create table if not exists public.schedule_group_versions (
  id uuid primary key default gen_random_uuid(),
  schedule_group_id uuid not null references public.schedule_groups(id) on delete cascade,
  version_number integer not null,
  snapshot jsonb not null,
  change_summary text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (schedule_group_id, version_number),
  constraint schedule_group_versions_snapshot_object check (jsonb_typeof(snapshot) = 'object')
);

alter table public.schedule_group_versions enable row level security;

create or replace function public.dynamic_time_minutes(value_time time)
returns integer
language sql
immutable
set search_path = ''
as $function$
  select (extract(hour from value_time)::integer * 60)
       + extract(minute from value_time)::integer;
$function$;

create or replace function public.dynamic_minutes_after(base_time time, target_time time)
returns integer
language sql
immutable
set search_path = ''
as $function$
  select mod(
    public.dynamic_time_minutes(target_time)
      - public.dynamic_time_minutes(base_time)
      + 1440,
    1440
  );
$function$;

create or replace function public.get_dynamic_schedule_group_snapshot(requested_group_id uuid)
returns jsonb
language sql
security definer
set search_path = ''
as $function$
  select jsonb_build_object(
    'id', sg.id,
    'code', sg.code,
    'name', sg.name,
    'description', sg.description,
    'isActive', sg.is_active,
    'legacyKind', sg.legacy_kind,
    'config', sg.config,
    'shiftTemplates', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', st.id,
          'code', st.code,
          'name', st.name,
          'dayKind', st.day_kind,
          'startTime', st.start_time,
          'endTime', st.end_time,
          'minWorkers', st.required_workers,
          'targetWorkers', st.target_workers,
          'maxWorkers', st.max_workers,
          'sortOrder', st.sort_order,
          'isActive', st.is_active,
          'metadata', st.metadata,
          'paySegments', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'id', ps.id,
                'startTime', ps.start_time,
                'endTime', ps.end_time,
                'multiplier', ps.multiplier,
                'label', ps.label,
                'sortOrder', ps.sort_order
              )
              order by ps.sort_order, ps.start_time
            )
            from public.schedule_shift_pay_segments ps
            where ps.shift_template_id = st.id
          ), '[]'::jsonb)
        )
        order by st.day_kind, st.sort_order, st.start_time
      )
      from public.schedule_group_shift_templates st
      where st.schedule_group_id = sg.id
    ), '[]'::jsonb),
    'dayRules', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'dayKind', dr.day_kind,
          'behavior', dr.behavior,
          'inheritDayKind', dr.inherit_day_kind,
          'metadata', dr.metadata
        )
        order by dr.day_kind
      )
      from public.schedule_group_day_rules dr
      where dr.schedule_group_id = sg.id
    ), '[]'::jsonb)
  )
  from public.schedule_groups sg
  where sg.id = requested_group_id;
$function$;

revoke all on function public.get_dynamic_schedule_group_snapshot(uuid) from public;

-- Seed/complete legacy schedule groups in the shadow model.
-- Dispatcher: current/intended business structure including partial Friday premium.
insert into public.schedule_group_shift_templates
  (schedule_group_id, code, name, day_kind, start_time, end_time, sort_order, required_workers, target_workers, max_workers)
select g.id, v.code, v.name, v.day_kind, v.start_time::time, v.end_time::time, v.sort_order, v.min_workers, v.target_workers, v.max_workers
from public.schedule_groups g
cross join (values
  ('holiday_full_06_14','06:00–14:00','holiday_full','06:00','14:00',10,1,1,1),
  ('holiday_full_14_22','14:00–22:00','holiday_full','14:00','22:00',20,1,1,1),
  ('holiday_full_22_06','22:00–06:00','holiday_full','22:00','06:00',30,1,1,1)
) as v(code,name,day_kind,start_time,end_time,sort_order,min_workers,target_workers,max_workers)
where g.code = 'dispatch_center'
on conflict (schedule_group_id, code) do update set
  name=excluded.name, day_kind=excluded.day_kind, start_time=excluded.start_time,
  end_time=excluded.end_time, sort_order=excluded.sort_order,
  required_workers=excluded.required_workers, target_workers=excluded.target_workers, max_workers=excluded.max_workers;

update public.schedule_group_shift_templates st
set target_workers = 1, max_workers = 1
from public.schedule_groups sg
where st.schedule_group_id = sg.id
  and sg.code = 'dispatch_center';

insert into public.schedule_group_day_rules (schedule_group_id, day_kind, behavior, inherit_day_kind)
select g.id, v.day_kind, v.behavior, v.inherit_day_kind
from public.schedule_groups g
cross join (values
  ('weekday','own_templates',null::text),
  ('friday','own_templates',null::text),
  ('saturday','own_templates',null::text),
  ('holiday_eve','inherit','friday'),
  ('holiday_full','own_templates',null::text),
  ('holiday_end','inherit','saturday'),
  ('chol_hamoed','inherit','weekday')
) as v(day_kind,behavior,inherit_day_kind)
where g.code = 'dispatch_center'
on conflict (schedule_group_id, day_kind) do update set behavior=excluded.behavior, inherit_day_kind=excluded.inherit_day_kind;

-- Morning on-call: one required worker on weekday morning, optional second worker target.
insert into public.schedule_group_shift_templates
  (schedule_group_id, code, name, day_kind, start_time, end_time, sort_order, required_workers, target_workers, max_workers)
select g.id, v.code, v.name, v.day_kind, v.start_time::time, v.end_time::time, v.sort_order, v.min_workers, v.target_workers, v.max_workers
from public.schedule_groups g
cross join (values
  ('weekday_morning','בוקר 06:00–16:00','weekday','06:00','16:00',10,1,2,2),
  ('weekday_evening','ערב 15:00–23:00','weekday','15:00','23:00',20,1,1,1),
  ('friday_morning','שישי 06:00–14:00','friday','06:00','14:00',10,1,1,1)
) as v(code,name,day_kind,start_time,end_time,sort_order,min_workers,target_workers,max_workers)
where g.code = 'morning_on_call'
on conflict (schedule_group_id, code) do update set
  name=excluded.name, day_kind=excluded.day_kind, start_time=excluded.start_time,
  end_time=excluded.end_time, sort_order=excluded.sort_order,
  required_workers=excluded.required_workers, target_workers=excluded.target_workers, max_workers=excluded.max_workers;

insert into public.schedule_group_day_rules (schedule_group_id, day_kind, behavior, inherit_day_kind)
select g.id, v.day_kind, v.behavior, v.inherit_day_kind
from public.schedule_groups g
cross join (values
  ('weekday','own_templates',null::text),
  ('friday','own_templates',null::text),
  ('saturday','no_work',null::text),
  ('holiday_eve','inherit','friday'),
  ('holiday_full','no_work',null::text),
  ('holiday_end','no_work',null::text),
  ('chol_hamoed','inherit','weekday')
) as v(day_kind,behavior,inherit_day_kind)
where g.code = 'morning_on_call'
on conflict (schedule_group_id, day_kind) do update set behavior=excluded.behavior, inherit_day_kind=excluded.inherit_day_kind;

-- On-call is an all-day pool. This is shadow configuration only and does not alter the legacy system.
insert into public.schedule_group_shift_templates
  (schedule_group_id, code, name, day_kind, start_time, end_time, sort_order, required_workers, target_workers, max_workers, metadata)
select g.id, v.code, v.name, v.day_kind, time '00:00', time '23:59', 10, 1, 1, 1, '{"all_day":true}'::jsonb
from public.schedule_groups g
cross join (values
  ('weekday_on_call','כוננות יומית','weekday'),
  ('friday_on_call','כוננות שישי','friday'),
  ('saturday_on_call','כוננות שבת','saturday'),
  ('holiday_full_on_call','כוננות חג','holiday_full')
) as v(code,name,day_kind)
where g.code = 'on_call'
on conflict (schedule_group_id, code) do update set
  name=excluded.name, day_kind=excluded.day_kind, start_time=excluded.start_time,
  end_time=excluded.end_time, required_workers=excluded.required_workers,
  target_workers=excluded.target_workers, max_workers=excluded.max_workers,
  metadata=excluded.metadata;

insert into public.schedule_group_day_rules (schedule_group_id, day_kind, behavior, inherit_day_kind)
select g.id, v.day_kind, v.behavior, v.inherit_day_kind
from public.schedule_groups g
cross join (values
  ('weekday','own_templates',null::text),
  ('friday','own_templates',null::text),
  ('saturday','own_templates',null::text),
  ('holiday_eve','inherit','friday'),
  ('holiday_full','own_templates',null::text),
  ('holiday_end','inherit','saturday'),
  ('chol_hamoed','inherit','weekday')
) as v(day_kind,behavior,inherit_day_kind)
where g.code = 'on_call'
on conflict (schedule_group_id, day_kind) do update set behavior=excluded.behavior, inherit_day_kind=excluded.inherit_day_kind;

-- Seed pay segments for the dispatcher shadow configuration.
-- Delete only previous seed-generated segments so manual Phase-3 edits are not overwritten on reruns.
delete from public.schedule_shift_pay_segments ps
using public.schedule_group_shift_templates st, public.schedule_groups sg
where ps.shift_template_id = st.id
  and st.schedule_group_id = sg.id
  and sg.code = 'dispatch_center'
  and coalesce(ps.metadata ->> 'source', '') = 'phase3_seed';

insert into public.schedule_shift_pay_segments
  (shift_template_id, start_time, end_time, multiplier, label, sort_order, metadata)
select st.id, v.start_time::time, v.end_time::time, v.multiplier, v.label, v.sort_order, '{"source":"phase3_seed"}'::jsonb
from public.schedule_group_shift_templates st
join public.schedule_groups sg on sg.id = st.schedule_group_id
join (values
  ('weekday_16_23','16:00','23:00',1.0,'100%',10),
  ('weekday_23_06','23:00','06:00',1.0,'100%',10),
  ('friday_06_14','06:00','14:00',1.0,'100%',10),
  ('friday_14_22','14:00','16:00',1.0,'100%',10),
  ('friday_14_22','16:00','22:00',2.0,'200%',20),
  ('friday_22_06','22:00','06:00',2.0,'200%',10),
  ('saturday_06_14','06:00','14:00',2.0,'200%',10),
  ('saturday_14_22','14:00','22:00',2.0,'200%',10),
  ('saturday_22_06','22:00','06:00',1.0,'100%',10),
  ('holiday_full_06_14','06:00','14:00',2.0,'200%',10),
  ('holiday_full_14_22','14:00','22:00',2.0,'200%',10),
  ('holiday_full_22_06','22:00','06:00',2.0,'200%',10)
) as v(code,start_time,end_time,multiplier,label,sort_order)
  on v.code = st.code
where sg.code = 'dispatch_center'
  and not exists (
    select 1 from public.schedule_shift_pay_segments existing
    where existing.shift_template_id = st.id
  );

create or replace function public.get_dynamic_scheduling_admin()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then raise exception 'not authenticated'; end if;
  if not exists (select 1 from public.profiles p where p.id=current_user_id and p.is_active=true) then raise exception 'user not active'; end if;
  if not exists (
    select 1 from public.user_permissions up
    where up.user_id=current_user_id and up.permission_key in ('users.view','users.manage')
  ) then raise exception 'not allowed'; end if;

  return jsonb_build_object(
    'featureEnabled', coalesce((select f.enabled from public.scheduling_feature_flags f where f.key='dynamic_job_types'), false),
    'featureMode', coalesce((select f.config->>'mode' from public.scheduling_feature_flags f where f.key='dynamic_job_types'), 'shadow'),
    'scheduleGroups', coalesce((
      select jsonb_agg(
        public.get_dynamic_schedule_group_snapshot(sg.id)
        || jsonb_build_object(
          'versionCount', (select count(*) from public.schedule_group_versions v where v.schedule_group_id=sg.id),
          'currentVersion', coalesce((select max(v.version_number) from public.schedule_group_versions v where v.schedule_group_id=sg.id), 0)
        )
        order by sg.name
      ) from public.schedule_groups sg
    ), '[]'::jsonb),
    'jobTypes', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', jt.id,
          'scheduleGroupId', jt.schedule_group_id,
          'code', jt.code,
          'name', jt.name,
          'description', jt.description,
          'isActive', jt.is_active,
          'legacyRole', jt.legacy_role,
          'employmentScope', jt.employment_scope,
          'payModel', jt.pay_model,
          'payConfig', jt.pay_config,
          'availabilityConfig', jt.availability_config,
          'statisticsConfig', jt.statistics_config,
          'aiConfig', jt.ai_config,
          'capabilities', coalesce((select jsonb_agg(c.capability_key order by c.capability_key) from public.job_type_capabilities c where c.job_type_id=jt.id and c.enabled=true), '[]'::jsonb),
          'defaultPermissions', coalesce((select jsonb_agg(dp.permission_key order by dp.permission_key) from public.job_type_default_permissions dp where dp.job_type_id=jt.id), '[]'::jsonb),
          'memberCount', (select count(*) from public.job_type_memberships m where m.job_type_id=jt.id)
        ) order by jt.is_active desc, jt.name
      ) from public.job_types jt
    ), '[]'::jsonb)
  );
end;
$function$;

revoke all on function public.get_dynamic_scheduling_admin() from public;
grant execute on function public.get_dynamic_scheduling_admin() to authenticated;

create or replace function public.save_dynamic_schedule_group(requested_payload jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $function$
declare
  current_user_id uuid := auth.uid();
  target_group_id uuid := nullif(requested_payload->>'id','')::uuid;
  template_value jsonb;
  rule_value jsonb;
  segment_value jsonb;
  target_template_id uuid;
  template_codes text[] := array[]::text[];
  target_code text;
  target_name text;
  target_day_kind text;
  target_start time;
  target_end time;
  min_workers integer;
  target_workers_value integer;
  max_workers_value integer;
  shift_duration integer;
  segment_start_offset integer;
  segment_end_offset integer;
  new_version integer;
begin
  if current_user_id is null then raise exception 'not authenticated'; end if;
  if not exists (select 1 from public.profiles p where p.id=current_user_id and p.is_active=true) then raise exception 'user not active'; end if;
  if not exists (select 1 from public.user_permissions up where up.user_id=current_user_id and up.permission_key='users.manage') then raise exception 'not allowed'; end if;
  if target_group_id is null or not exists (select 1 from public.schedule_groups sg where sg.id=target_group_id) then raise exception 'schedule group not found'; end if;

  target_name := trim(coalesce(requested_payload->>'name',''));
  if target_name = '' then raise exception 'schedule group name is required'; end if;

  update public.schedule_groups
  set name=target_name,
      description=nullif(trim(coalesce(requested_payload->>'description','')), ''),
      is_active=coalesce((requested_payload->>'isActive')::boolean, true)
  where id=target_group_id;

  for template_value in select value from jsonb_array_elements(coalesce(requested_payload->'shiftTemplates','[]'::jsonb)) loop
    target_code := lower(trim(coalesce(template_value->>'code','')));
    target_name := trim(coalesce(template_value->>'name',''));
    target_day_kind := coalesce(template_value->>'dayKind','weekday');
    target_start := (template_value->>'startTime')::time;
    target_end := (template_value->>'endTime')::time;
    min_workers := coalesce((template_value->>'minWorkers')::integer, 1);
    target_workers_value := coalesce((template_value->>'targetWorkers')::integer, min_workers);
    max_workers_value := coalesce((template_value->>'maxWorkers')::integer, target_workers_value);

    if target_code = '' or target_code !~ '^[a-z0-9_]+$' then raise exception 'invalid shift code: %', target_code; end if;
    if target_name = '' then raise exception 'shift name is required'; end if;
    if target_day_kind not in ('weekday','friday','saturday','holiday_eve','holiday_full','holiday_end','chol_hamoed','custom') then raise exception 'invalid day kind'; end if;
    if target_start = target_end then raise exception 'shift start and end cannot be equal'; end if;
    if min_workers < 0 or target_workers_value < min_workers or max_workers_value < target_workers_value or max_workers_value > 50 then
      raise exception 'invalid worker requirements for shift %', target_code;
    end if;

    template_codes := array_append(template_codes, target_code);

    insert into public.schedule_group_shift_templates (
      schedule_group_id, code, name, day_kind, start_time, end_time,
      sort_order, required_workers, target_workers, max_workers, is_active, metadata
    ) values (
      target_group_id, target_code, target_name, target_day_kind, target_start, target_end,
      coalesce((template_value->>'sortOrder')::integer, 0), min_workers, target_workers_value, max_workers_value,
      coalesce((template_value->>'isActive')::boolean, true), coalesce(template_value->'metadata','{}'::jsonb)
    )
    on conflict (schedule_group_id, code) do update set
      name=excluded.name, day_kind=excluded.day_kind, start_time=excluded.start_time, end_time=excluded.end_time,
      sort_order=excluded.sort_order, required_workers=excluded.required_workers,
      target_workers=excluded.target_workers, max_workers=excluded.max_workers,
      is_active=excluded.is_active, metadata=excluded.metadata, updated_at=now()
    returning id into target_template_id;

    delete from public.schedule_shift_pay_segments where shift_template_id=target_template_id;
    shift_duration := public.dynamic_minutes_after(target_start, target_end);

    for segment_value in select value from jsonb_array_elements(coalesce(template_value->'paySegments','[]'::jsonb)) loop
      segment_start_offset := public.dynamic_minutes_after(target_start, (segment_value->>'startTime')::time);
      segment_end_offset := public.dynamic_minutes_after(target_start, (segment_value->>'endTime')::time);

      if segment_end_offset <= segment_start_offset
         or segment_start_offset < 0
         or segment_end_offset > shift_duration then
        raise exception 'pay segment is outside shift %', target_code;
      end if;

      insert into public.schedule_shift_pay_segments (
        shift_template_id, start_time, end_time, multiplier, label, sort_order, metadata
      ) values (
        target_template_id,
        (segment_value->>'startTime')::time,
        (segment_value->>'endTime')::time,
        coalesce((segment_value->>'multiplier')::numeric,1),
        nullif(trim(coalesce(segment_value->>'label','')), ''),
        coalesce((segment_value->>'sortOrder')::integer,0),
        '{"source":"phase3_editor"}'::jsonb
      );
    end loop;

    if exists (
      select 1
      from public.schedule_shift_pay_segments a
      join public.schedule_shift_pay_segments b
        on a.shift_template_id=b.shift_template_id and a.id < b.id
      where a.shift_template_id=target_template_id
        and public.dynamic_minutes_after(target_start,a.start_time) < public.dynamic_minutes_after(target_start,b.end_time)
        and public.dynamic_minutes_after(target_start,b.start_time) < public.dynamic_minutes_after(target_start,a.end_time)
    ) then
      raise exception 'overlapping pay segments for shift %', target_code;
    end if;
  end loop;

  if cardinality(template_codes) = 0 then
    delete from public.schedule_group_shift_templates where schedule_group_id=target_group_id;
  else
    delete from public.schedule_group_shift_templates
    where schedule_group_id=target_group_id and not (code = any(template_codes));
  end if;

  delete from public.schedule_group_day_rules where schedule_group_id=target_group_id;
  for rule_value in select value from jsonb_array_elements(coalesce(requested_payload->'dayRules','[]'::jsonb)) loop
    if coalesce(rule_value->>'dayKind','') not in ('weekday','friday','saturday','holiday_eve','holiday_full','holiday_end','chol_hamoed','custom') then
      raise exception 'invalid rule day kind';
    end if;
    if coalesce(rule_value->>'behavior','') not in ('own_templates','inherit','no_work') then raise exception 'invalid day behavior'; end if;
    if rule_value->>'behavior'='inherit' and nullif(rule_value->>'inheritDayKind','') is null then raise exception 'inherit day kind is required'; end if;

    insert into public.schedule_group_day_rules (schedule_group_id,day_kind,behavior,inherit_day_kind,metadata)
    values (
      target_group_id,
      rule_value->>'dayKind',
      rule_value->>'behavior',
      case when rule_value->>'behavior'='inherit' then rule_value->>'inheritDayKind' else null end,
      coalesce(rule_value->'metadata','{}'::jsonb)
    );
  end loop;

  select coalesce(max(v.version_number),0)+1 into new_version
  from public.schedule_group_versions v where v.schedule_group_id=target_group_id;

  insert into public.schedule_group_versions (schedule_group_id,version_number,snapshot,change_summary,created_by)
  values (
    target_group_id,
    new_version,
    public.get_dynamic_schedule_group_snapshot(target_group_id),
    nullif(trim(coalesce(requested_payload->>'changeSummary','')), ''),
    current_user_id
  );

  update public.scheduling_feature_flags
  set config = jsonb_set(jsonb_set(config,'{phase}','3'::jsonb,true),'{mode}','"shadow"'::jsonb,true),
      updated_at=now()
  where key='dynamic_job_types';

  return new_version;
end;
$function$;

revoke all on function public.save_dynamic_schedule_group(jsonb) from public;
grant execute on function public.save_dynamic_schedule_group(jsonb) to authenticated;

create or replace function public.preview_dynamic_schedule_group(
  requested_group_id uuid,
  requested_year integer,
  requested_month integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  current_user_id uuid := auth.uid();
  first_date date;
  next_month date;
begin
  if current_user_id is null then raise exception 'not authenticated'; end if;
  if not exists (select 1 from public.profiles p where p.id=current_user_id and p.is_active=true) then raise exception 'user not active'; end if;
  if not exists (select 1 from public.user_permissions up where up.user_id=current_user_id and up.permission_key in ('users.view','users.manage')) then raise exception 'not allowed'; end if;
  if not exists (select 1 from public.schedule_groups sg where sg.id=requested_group_id) then raise exception 'schedule group not found'; end if;
  if requested_year not between 2020 and 2100 or requested_month not between 1 and 12 then raise exception 'invalid year or month'; end if;

  first_date := make_date(requested_year,requested_month,1);
  next_month := (first_date + interval '1 month')::date;

  return jsonb_build_object(
    'year', requested_year,
    'month', requested_month,
    'groupId', requested_group_id,
    'days', coalesce((
      with dates as (
        select d::date as day_date, extract(dow from d)::integer as dow
        from generate_series(first_date, next_month-1, interval '1 day') d
      ), classified as (
        select d.day_date, d.dow,
          coalesce(sd.schedule_type,
            case when d.dow=5 then 'friday' when d.dow=6 then 'saturday' else 'weekday' end
          ) as source_day_kind,
          sd.event_name as holiday_name
        from dates d
        left join lateral (
          select csd.schedule_type, csd.event_name
          from public.calendar_special_days csd
          where csd.event_date=d.day_date
          order by case when csd.source_name='manual' then 0 else 1 end,
                   case csd.schedule_type when 'holiday_full' then 1 when 'holiday_end' then 2 when 'holiday_eve' then 3 when 'chol_hamoed' then 4 else 5 end
          limit 1
        ) sd on true
      ), resolved as (
        select c.*,
          coalesce(dr.behavior,'own_templates') as behavior,
          dr.inherit_day_kind,
          case
            when dr.behavior='no_work' then null
            when dr.behavior='inherit' then dr.inherit_day_kind
            else c.source_day_kind
          end as effective_day_kind
        from classified c
        left join public.schedule_group_day_rules dr
          on dr.schedule_group_id=requested_group_id and dr.day_kind=c.source_day_kind
      )
      select jsonb_agg(
        jsonb_build_object(
          'date', r.day_date,
          'weekdayName', case r.dow when 0 then 'ראשון' when 1 then 'שני' when 2 then 'שלישי' when 3 then 'רביעי' when 4 then 'חמישי' when 5 then 'שישי' when 6 then 'שבת' end,
          'sourceDayKind', r.source_day_kind,
          'effectiveDayKind', r.effective_day_kind,
          'holidayName', r.holiday_name,
          'isNoWork', r.behavior='no_work',
          'shifts', case when r.behavior='no_work' then '[]'::jsonb else coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'templateId', st.id,
                'code', st.code,
                'name', st.name,
                'startTime', st.start_time,
                'endTime', st.end_time,
                'minWorkers', st.required_workers,
                'targetWorkers', st.target_workers,
                'maxWorkers', st.max_workers,
                'paySegments', coalesce((
                  select jsonb_agg(jsonb_build_object(
                    'startTime', ps.start_time,
                    'endTime', ps.end_time,
                    'multiplier', ps.multiplier,
                    'label', ps.label
                  ) order by ps.sort_order, ps.start_time)
                  from public.schedule_shift_pay_segments ps
                  where ps.shift_template_id=st.id
                ), '[]'::jsonb)
              ) order by st.sort_order, st.start_time
            )
            from public.schedule_group_shift_templates st
            where st.schedule_group_id=requested_group_id
              and st.day_kind=r.effective_day_kind
              and st.is_active=true
          ), '[]'::jsonb) end
        ) order by r.day_date
      ) from resolved r
    ), '[]'::jsonb)
  );
end;
$function$;

revoke all on function public.preview_dynamic_schedule_group(uuid,integer,integer) from public;
grant execute on function public.preview_dynamic_schedule_group(uuid,integer,integer) to authenticated;

update public.scheduling_feature_flags
set enabled=false,
    config=jsonb_set(jsonb_set(config,'{phase}','3'::jsonb,true),'{mode}',to_jsonb('shadow'::text),true),
    updated_at=now()
where key='dynamic_job_types';

commit;
