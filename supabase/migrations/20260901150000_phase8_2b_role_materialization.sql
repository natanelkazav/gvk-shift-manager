begin;

-- Phase 8.2B: materialize each effective job-type configuration into a stable,
-- month-versioned operational model. This is additive and Shadow-only.
-- It does NOT create one physical table per role; all dynamic roles share the
-- same normalized tables and are isolated by job_type_id + effective_month.

create table if not exists public.job_type_schedule_materializations (
  id uuid primary key default gen_random_uuid(),
  job_type_id uuid not null references public.job_types(id) on delete cascade,
  effective_month date not null,
  work_mode text not null,
  scheduling_strategy text not null,
  employment_scope text not null,
  source_snapshot jsonb not null,
  schema_version integer not null default 1,
  generated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(job_type_id,effective_month),
  constraint job_type_schedule_materializations_first_day
    check (effective_month=date_trunc('month',effective_month)::date),
  constraint job_type_schedule_materializations_work_mode_valid
    check (work_mode in ('shifts','on_call_hourly','on_call_daily')),
  constraint job_type_schedule_materializations_strategy_valid
    check (scheduling_strategy in ('availability_optimizer','monthly_rotation_constraints')),
  constraint job_type_schedule_materializations_employment_scope_valid
    check (employment_scope in ('full_time','part_time','flexible')),
  constraint job_type_schedule_materializations_snapshot_object
    check (jsonb_typeof(source_snapshot)='object')
);

create table if not exists public.job_type_materialized_day_rules (
  id uuid primary key default gen_random_uuid(),
  materialization_id uuid not null references public.job_type_schedule_materializations(id) on delete cascade,
  day_kind text not null,
  works boolean not null default true,
  behavior text not null default 'own_templates',
  inherit_day_kind text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(materialization_id,day_kind),
  constraint job_type_materialized_day_rules_behavior_valid
    check (behavior in ('own_templates','inherit','no_work','calendar_default')),
  constraint job_type_materialized_day_rules_metadata_object
    check (jsonb_typeof(metadata)='object')
);

create table if not exists public.job_type_materialized_shift_templates (
  id uuid primary key default gen_random_uuid(),
  materialization_id uuid not null references public.job_type_schedule_materializations(id) on delete cascade,
  source_shift_id text,
  code text not null,
  name text not null,
  day_kind text not null,
  start_time time not null,
  end_time time not null,
  required_workers integer not null default 1,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  contains_200_percent boolean not null default false,
  premium_200_hours numeric(6,2) not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(materialization_id,code),
  constraint job_type_materialized_shift_required_workers_valid check(required_workers>=0),
  constraint job_type_materialized_shift_premium_hours_valid check(premium_200_hours>=0 and premium_200_hours<=24),
  constraint job_type_materialized_shift_metadata_object check(jsonb_typeof(metadata)='object')
);

-- The UI currently records how many hours are paid at 200%, but not the exact
-- start/end boundary inside the shift. Preserve that fact explicitly without
-- inventing a time segment. A later payroll phase can request the boundary if needed.
create table if not exists public.job_type_materialized_pay_components (
  id uuid primary key default gen_random_uuid(),
  shift_template_id uuid not null references public.job_type_materialized_shift_templates(id) on delete cascade,
  component_type text not null,
  multiplier numeric(6,3) not null,
  hours numeric(6,2),
  label text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint job_type_materialized_pay_components_type_valid
    check(component_type in ('premium_hours','fixed','informational')),
  constraint job_type_materialized_pay_components_multiplier_positive check(multiplier>0),
  constraint job_type_materialized_pay_components_hours_valid check(hours is null or (hours>=0 and hours<=24)),
  constraint job_type_materialized_pay_components_metadata_object check(jsonb_typeof(metadata)='object')
);

alter table public.job_type_schedule_materializations enable row level security;
alter table public.job_type_materialized_day_rules enable row level security;
alter table public.job_type_materialized_shift_templates enable row level security;
alter table public.job_type_materialized_pay_components enable row level security;

drop trigger if exists set_job_type_schedule_materializations_updated_at on public.job_type_schedule_materializations;
create trigger set_job_type_schedule_materializations_updated_at
before update on public.job_type_schedule_materializations
for each row execute function public.set_updated_at();

drop trigger if exists set_job_type_materialized_day_rules_updated_at on public.job_type_materialized_day_rules;
create trigger set_job_type_materialized_day_rules_updated_at
before update on public.job_type_materialized_day_rules
for each row execute function public.set_updated_at();

drop trigger if exists set_job_type_materialized_shift_templates_updated_at on public.job_type_materialized_shift_templates;
create trigger set_job_type_materialized_shift_templates_updated_at
before update on public.job_type_materialized_shift_templates
for each row execute function public.set_updated_at();

create or replace function public.materialize_dynamic_job_type_snapshot(
  requested_job_type_id uuid,
  requested_effective_month date,
  requested_snapshot jsonb
)
returns uuid
language plpgsql
security definer
set search_path=''
as $function$
declare
  target_materialization_id uuid;
  scheduling_config jsonb := coalesce(requested_snapshot->'schedulingConfig','{}'::jsonb);
  shift_pattern jsonb := coalesce(requested_snapshot#>'{schedulingConfig,shiftPattern}','{}'::jsonb);
  work_mode text := coalesce(requested_snapshot#>>'{schedulingConfig,shiftPattern,workMode}','shifts');
  strategy text := coalesce(requested_snapshot->>'schedulingStrategy','availability_optimizer');
  employment text := coalesce(requested_snapshot->>'employmentScope','flexible');
  day_source jsonb;
  shift_value jsonb;
  target_shift_id uuid;
  day_name text;
  day_kind_value text;
  works_value boolean;
  shift_index integer;
  shift_start time;
  shift_end time;
  premium_hours numeric(6,2);
  shift_hours numeric;
  apply_holiday_eve boolean := coalesce((shift_pattern#>>'{friday,applyToHolidayEve}')::boolean,false);
  apply_holiday_end boolean := coalesce((shift_pattern#>>'{saturday,applyToHolidayEnd}')::boolean,false);
begin
  if requested_job_type_id is null then raise exception 'job type is required'; end if;
  if requested_effective_month is null then raise exception 'effective month is required'; end if;
  if jsonb_typeof(requested_snapshot)<>'object' then raise exception 'snapshot must be an object'; end if;
  if work_mode not in ('shifts','on_call_hourly','on_call_daily') then raise exception 'invalid work mode: %',work_mode; end if;

  insert into public.job_type_schedule_materializations(
    job_type_id,effective_month,work_mode,scheduling_strategy,employment_scope,source_snapshot,schema_version,generated_at
  ) values(
    requested_job_type_id,date_trunc('month',requested_effective_month)::date,work_mode,strategy,employment,requested_snapshot,1,now()
  )
  on conflict(job_type_id,effective_month) do update set
    work_mode=excluded.work_mode,
    scheduling_strategy=excluded.scheduling_strategy,
    employment_scope=excluded.employment_scope,
    source_snapshot=excluded.source_snapshot,
    schema_version=excluded.schema_version,
    generated_at=now(),
    updated_at=now()
  returning id into target_materialization_id;

  -- A re-save of the same effective month is a deterministic rebuild.
  delete from public.job_type_materialized_day_rules where materialization_id=target_materialization_id;
  delete from public.job_type_materialized_shift_templates where materialization_id=target_materialization_id;

  foreach day_name in array array['weekday','friday','saturday','holiday'] loop
    day_source := coalesce(shift_pattern->day_name,'{}'::jsonb);
    works_value := coalesce((day_source->>'works')::boolean,true);
    day_kind_value := case day_name when 'holiday' then 'holiday_full' else day_name end;

    insert into public.job_type_materialized_day_rules(materialization_id,day_kind,works,behavior,inherit_day_kind,metadata)
    values(
      target_materialization_id,
      day_kind_value,
      works_value,
      case when works_value then 'own_templates' else 'no_work' end,
      null,
      jsonb_build_object('sourceDay',day_name)
    );

    if works_value then
      if work_mode='on_call_daily' then
        insert into public.job_type_materialized_shift_templates(
          materialization_id,source_shift_id,code,name,day_kind,start_time,end_time,required_workers,sort_order,is_active,metadata
        ) values(
          target_materialization_id,day_name||'-daily',day_name||'_daily_on_call','כוננות יומית',day_kind_value,
          time '00:00',time '23:59',1,10,true,jsonb_build_object('allDay',true,'workMode',work_mode)
        );
      else
        shift_index := 0;
        for shift_value in select value from jsonb_array_elements(coalesce(day_source->'shifts','[]'::jsonb)) loop
          shift_index := shift_index + 1;
          shift_start := coalesce(nullif(shift_value->>'startTime','')::time,time '00:00');
          shift_end := coalesce(nullif(shift_value->>'endTime','')::time,time '00:00');
          premium_hours := greatest(0,coalesce(nullif(shift_value->>'premium200Hours','')::numeric,0));
          shift_hours := mod(
            (extract(hour from shift_end)::integer*60 + extract(minute from shift_end)::integer)
            - (extract(hour from shift_start)::integer*60 + extract(minute from shift_start)::integer)
            + 1440,
            1440
          ) / 60.0;
          if shift_hours=0 then shift_hours:=24; end if;
          premium_hours := least(premium_hours,shift_hours);

          insert into public.job_type_materialized_shift_templates(
            materialization_id,source_shift_id,code,name,day_kind,start_time,end_time,required_workers,sort_order,is_active,
            contains_200_percent,premium_200_hours,metadata
          ) values(
            target_materialization_id,
            nullif(shift_value->>'id',''),
            day_name||'_'||shift_index::text,
            coalesce(nullif(shift_value->>'name',''),case when work_mode='on_call_hourly' then 'חלון כוננות '||shift_index else 'משמרת '||shift_index end),
            day_kind_value,
            shift_start,
            shift_end,
            greatest(1,coalesce(nullif(shift_value->>'requiredWorkers','')::integer,1)),
            shift_index*10,
            true,
            coalesce((shift_value->>'contains200Percent')::boolean,false),
            case when coalesce((shift_value->>'contains200Percent')::boolean,false) then premium_hours else 0 end,
            jsonb_build_object('workMode',work_mode,'sourceDefinition',shift_value)
          ) returning id into target_shift_id;

          if coalesce((shift_value->>'contains200Percent')::boolean,false) and premium_hours>0 then
            insert into public.job_type_materialized_pay_components(
              shift_template_id,component_type,multiplier,hours,label,metadata
            ) values(
              target_shift_id,'premium_hours',2.0,premium_hours,'רכיב 200%',
              jsonb_build_object('boundaryKnown',false,'source','role_definition')
            );
          end if;
        end loop;
      end if;
    end if;
  end loop;

  -- Calendar-special-day inheritance is explicit and versioned with the role.
  insert into public.job_type_materialized_day_rules(materialization_id,day_kind,works,behavior,inherit_day_kind,metadata)
  values(
    target_materialization_id,'holiday_eve',true,'inherit',case when apply_holiday_eve then 'friday' else 'weekday' end,
    jsonb_build_object('usesFridayTemplate',apply_holiday_eve)
  )
  on conflict(materialization_id,day_kind) do update set
    works=excluded.works,behavior=excluded.behavior,inherit_day_kind=excluded.inherit_day_kind,metadata=excluded.metadata;

  insert into public.job_type_materialized_day_rules(materialization_id,day_kind,works,behavior,inherit_day_kind,metadata)
  values(
    target_materialization_id,'holiday_end',true,'inherit',case when apply_holiday_end then 'saturday' else 'weekday' end,
    jsonb_build_object('usesSaturdayTemplate',apply_holiday_end)
  )
  on conflict(materialization_id,day_kind) do update set
    works=excluded.works,behavior=excluded.behavior,inherit_day_kind=excluded.inherit_day_kind,metadata=excluded.metadata;

  insert into public.job_type_materialized_day_rules(materialization_id,day_kind,works,behavior,inherit_day_kind,metadata)
  values(target_materialization_id,'chol_hamoed',true,'inherit','weekday','{"source":"default"}'::jsonb)
  on conflict(materialization_id,day_kind) do update set
    works=excluded.works,behavior=excluded.behavior,inherit_day_kind=excluded.inherit_day_kind,metadata=excluded.metadata;

  return target_materialization_id;
end;
$function$;

revoke all on function public.materialize_dynamic_job_type_snapshot(uuid,date,jsonb) from public;

create or replace function public.trigger_materialize_dynamic_job_type_version()
returns trigger
language plpgsql
security definer
set search_path=''
as $function$
begin
  perform public.materialize_dynamic_job_type_snapshot(new.job_type_id,new.effective_month,new.snapshot);
  return new;
end;
$function$;

revoke all on function public.trigger_materialize_dynamic_job_type_version() from public;

drop trigger if exists materialize_dynamic_job_type_version on public.job_type_configuration_versions;
create trigger materialize_dynamic_job_type_version
after insert or update of snapshot,effective_month on public.job_type_configuration_versions
for each row execute function public.trigger_materialize_dynamic_job_type_version();

-- Backfill every configuration version that already exists. This is safe to rerun
-- because materialization is an idempotent rebuild for job_type + effective_month.
do $block$
declare
  version_row record;
begin
  for version_row in
    select job_type_id,effective_month,snapshot
    from public.job_type_configuration_versions
    order by effective_month,job_type_id
  loop
    perform public.materialize_dynamic_job_type_snapshot(
      version_row.job_type_id,
      version_row.effective_month,
      version_row.snapshot
    );
  end loop;
end;
$block$;

create or replace function public.get_dynamic_job_type_materialization(
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
  current_user_id uuid:=auth.uid();
  target_month date;
  target_materialization_id uuid;
  result jsonb;
begin
  if current_user_id is null then raise exception 'not authenticated'; end if;
  if not exists(
    select 1 from public.user_permissions up
    where up.user_id=current_user_id and up.permission_key in ('users.view','users.manage')
  ) then raise exception 'not allowed'; end if;
  if requested_month not between 1 and 12 then raise exception 'invalid month'; end if;

  target_month:=make_date(requested_year,requested_month,1);
  select m.id into target_materialization_id
  from public.job_type_schedule_materializations m
  where m.job_type_id=requested_job_type_id and m.effective_month<=target_month
  order by m.effective_month desc
  limit 1;

  if target_materialization_id is null then return null; end if;

  select jsonb_build_object(
    'id',m.id,
    'jobTypeId',m.job_type_id,
    'effectiveMonth',m.effective_month,
    'workMode',m.work_mode,
    'schedulingStrategy',m.scheduling_strategy,
    'employmentScope',m.employment_scope,
    'schemaVersion',m.schema_version,
    'generatedAt',m.generated_at,
    'dayRules',coalesce((
      select jsonb_agg(jsonb_build_object(
        'dayKind',d.day_kind,'works',d.works,'behavior',d.behavior,
        'inheritDayKind',d.inherit_day_kind,'metadata',d.metadata
      ) order by d.day_kind)
      from public.job_type_materialized_day_rules d
      where d.materialization_id=m.id
    ),'[]'::jsonb),
    'shiftTemplates',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',s.id,'sourceShiftId',s.source_shift_id,'code',s.code,'name',s.name,
        'dayKind',s.day_kind,'startTime',s.start_time,'endTime',s.end_time,
        'requiredWorkers',s.required_workers,'sortOrder',s.sort_order,'isActive',s.is_active,
        'contains200Percent',s.contains_200_percent,'premium200Hours',s.premium_200_hours,
        'metadata',s.metadata,
        'payComponents',coalesce((
          select jsonb_agg(jsonb_build_object(
            'type',p.component_type,'multiplier',p.multiplier,'hours',p.hours,
            'label',p.label,'metadata',p.metadata
          ) order by p.created_at)
          from public.job_type_materialized_pay_components p
          where p.shift_template_id=s.id
        ),'[]'::jsonb)
      ) order by s.day_kind,s.sort_order)
      from public.job_type_materialized_shift_templates s
      where s.materialization_id=m.id
    ),'[]'::jsonb)
  ) into result
  from public.job_type_schedule_materializations m
  where m.id=target_materialization_id;

  return result;
end;
$function$;

revoke all on function public.get_dynamic_job_type_materialization(uuid,integer,integer) from public;
grant execute on function public.get_dynamic_job_type_materialization(uuid,integer,integer) to authenticated;

commit;
