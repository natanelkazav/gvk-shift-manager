begin;

-- Phase 4: Generic availability engine foundation.
-- ADDITIVE + SHADOW ONLY. No production availability RPC/table is replaced.

create table if not exists public.dynamic_availability_periods (
  id uuid primary key default gen_random_uuid(),
  schedule_group_id uuid not null references public.schedule_groups(id) on delete restrict,
  job_type_id uuid not null references public.job_types(id) on delete restrict,
  year integer not null check (year between 2020 and 2100),
  month integer not null check (month between 1 and 12),
  title text not null,
  status text not null default 'shadow',
  submission_deadline timestamptz,
  config_snapshot jsonb not null default '{}'::jsonb,
  source text not null default 'shadow',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (job_type_id, year, month),
  constraint dynamic_availability_period_status_valid check (status in ('shadow','draft','open','closed','archived')),
  constraint dynamic_availability_period_config_object check (jsonb_typeof(config_snapshot) = 'object')
);

create table if not exists public.dynamic_availability_slots (
  id uuid primary key default gen_random_uuid(),
  period_id uuid not null references public.dynamic_availability_periods(id) on delete cascade,
  shift_date date not null,
  template_id uuid references public.schedule_group_shift_templates(id) on delete set null,
  shift_code text not null,
  shift_name text not null,
  start_time time not null,
  end_time time not null,
  source_day_kind text not null,
  effective_day_kind text,
  holiday_name text,
  min_workers integer not null default 1 check (min_workers >= 0),
  target_workers integer not null default 1 check (target_workers >= 0),
  max_workers integer not null default 1 check (max_workers >= 0),
  pay_segments_snapshot jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (period_id, shift_date, shift_code),
  constraint dynamic_availability_slot_worker_order check (min_workers <= target_workers and target_workers <= max_workers),
  constraint dynamic_availability_slot_pay_array check (jsonb_typeof(pay_segments_snapshot) = 'array'),
  constraint dynamic_availability_slot_metadata_object check (jsonb_typeof(metadata) = 'object')
);

create table if not exists public.dynamic_availability_submissions (
  id uuid primary key default gen_random_uuid(),
  period_id uuid not null references public.dynamic_availability_periods(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'draft',
  min_shifts integer,
  target_shifts integer,
  max_shifts integer,
  max_nights integer,
  max_weekends integer,
  max_holidays integer,
  note text,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (period_id, user_id),
  constraint dynamic_availability_submission_status_valid check (status in ('draft','submitted','reopened')),
  constraint dynamic_availability_submission_nonnegative check (
    coalesce(min_shifts,0) >= 0 and coalesce(target_shifts,0) >= 0 and coalesce(max_shifts,0) >= 0 and
    coalesce(max_nights,0) >= 0 and coalesce(max_weekends,0) >= 0 and coalesce(max_holidays,0) >= 0
  ),
  constraint dynamic_availability_submission_capacity_order check (
    (min_shifts is null or target_shifts is null or min_shifts <= target_shifts) and
    (target_shifts is null or max_shifts is null or target_shifts <= max_shifts) and
    (min_shifts is null or max_shifts is null or min_shifts <= max_shifts)
  )
);

create table if not exists public.dynamic_availability_entries (
  submission_id uuid not null references public.dynamic_availability_submissions(id) on delete cascade,
  slot_id uuid not null references public.dynamic_availability_slots(id) on delete cascade,
  availability_status text not null,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (submission_id, slot_id),
  constraint dynamic_availability_entry_status_valid check (availability_status in ('available','unavailable','preferred','avoid'))
);

create index if not exists dynamic_availability_slots_period_date_idx on public.dynamic_availability_slots(period_id, shift_date);
create index if not exists dynamic_availability_submissions_period_idx on public.dynamic_availability_submissions(period_id);

-- Direct table access stays closed while the feature is shadow-only.
alter table public.dynamic_availability_periods enable row level security;
alter table public.dynamic_availability_slots enable row level security;
alter table public.dynamic_availability_submissions enable row level security;
alter table public.dynamic_availability_entries enable row level security;
revoke all on public.dynamic_availability_periods from anon, authenticated;
revoke all on public.dynamic_availability_slots from anon, authenticated;
revoke all on public.dynamic_availability_submissions from anon, authenticated;
revoke all on public.dynamic_availability_entries from anon, authenticated;

-- Keep legacy seeded job types aligned with the generic configuration shape.
update public.job_types
set availability_config = case code
  when 'dispatcher' then jsonb_build_object(
    'enabled', true,
    'statuses', jsonb_build_array('available','unavailable'),
    'allowNotes', true,
    'monthlyCapacity', jsonb_build_object('enabled',true,'minEnabled',false,'targetEnabled',true,'maxEnabled',true,'defaultMin',null,'defaultTarget',null,'defaultMax',null),
    'limits', jsonb_build_object('maxNightsEnabled',false,'defaultMaxNights',null,'maxWeekendsEnabled',false,'defaultMaxWeekends',null,'maxHolidaysEnabled',false,'defaultMaxHolidays',null)
  )
  else jsonb_build_object(
    'enabled', true,
    'statuses', jsonb_build_array('available','unavailable'),
    'allowNotes', true,
    'monthlyCapacity', jsonb_build_object('enabled',false,'minEnabled',false,'targetEnabled',false,'maxEnabled',false,'defaultMin',null,'defaultTarget',null,'defaultMax',null),
    'limits', jsonb_build_object('maxNightsEnabled',false,'defaultMaxNights',null,'maxWeekendsEnabled',false,'defaultMaxWeekends',null,'maxHolidaysEnabled',false,'defaultMaxHolidays',null)
  )
end,
updated_at = now()
where code in ('dispatcher','on_call','morning_driver')
  and coalesce((availability_config->>'enabled')::boolean, false) = false;

create or replace function public.create_dynamic_availability_shadow_period(
  requested_job_type_id uuid,
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
  target_job public.job_types%rowtype;
  preview jsonb;
  target_period_id uuid;
  day_value jsonb;
  shift_value jsonb;
  created_slots integer := 0;
begin
  if current_user_id is null then raise exception 'not authenticated'; end if;
  if not exists (select 1 from public.user_permissions up where up.user_id=current_user_id and up.permission_key='users.manage') then
    raise exception 'not allowed';
  end if;
  if requested_month not between 1 and 12 then raise exception 'invalid month'; end if;

  select * into target_job from public.job_types where id=requested_job_type_id;
  if target_job.id is null then raise exception 'job type not found'; end if;
  if coalesce((target_job.availability_config->>'enabled')::boolean,false) is not true then raise exception 'availability is disabled for job type'; end if;

  preview := public.preview_dynamic_schedule_group(target_job.schedule_group_id, requested_year, requested_month);

  insert into public.dynamic_availability_periods(schedule_group_id,job_type_id,year,month,title,status,config_snapshot,source,created_by)
  values(target_job.schedule_group_id,target_job.id,requested_year,requested_month,target_job.name || ' · ' || requested_month || '/' || requested_year,'shadow',target_job.availability_config,'shadow',current_user_id)
  on conflict (job_type_id,year,month) do update set
    schedule_group_id=excluded.schedule_group_id,
    config_snapshot=excluded.config_snapshot,
    updated_at=now()
  returning id into target_period_id;

  delete from public.dynamic_availability_slots where period_id=target_period_id;

  for day_value in select value from jsonb_array_elements(coalesce(preview->'days','[]'::jsonb)) loop
    if coalesce((day_value->>'isNoWork')::boolean,false) then continue; end if;
    for shift_value in select value from jsonb_array_elements(coalesce(day_value->'shifts','[]'::jsonb)) loop
      insert into public.dynamic_availability_slots(
        period_id,shift_date,template_id,shift_code,shift_name,start_time,end_time,source_day_kind,effective_day_kind,
        holiday_name,min_workers,target_workers,max_workers,pay_segments_snapshot
      ) values (
        target_period_id,(day_value->>'date')::date,nullif(shift_value->>'templateId','')::uuid,
        shift_value->>'code',shift_value->>'name',(shift_value->>'startTime')::time,(shift_value->>'endTime')::time,
        day_value->>'sourceDayKind',day_value->>'effectiveDayKind',day_value->>'holidayName',
        coalesce((shift_value->>'minWorkers')::integer,1),coalesce((shift_value->>'targetWorkers')::integer,1),coalesce((shift_value->>'maxWorkers')::integer,1),
        coalesce(shift_value->'paySegments','[]'::jsonb)
      );
      created_slots := created_slots + 1;
    end loop;
  end loop;

  return jsonb_build_object('periodId',target_period_id,'createdSlots',created_slots,'mode','shadow');
end;
$function$;

revoke all on function public.create_dynamic_availability_shadow_period(uuid,integer,integer) from public;
grant execute on function public.create_dynamic_availability_shadow_period(uuid,integer,integer) to authenticated;

create or replace function public.get_dynamic_availability_shadow_summary(
  requested_job_type_id uuid,
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
  target_job public.job_types%rowtype;
  period_row public.dynamic_availability_periods%rowtype;
begin
  if current_user_id is null then raise exception 'not authenticated'; end if;
  if not exists (select 1 from public.user_permissions up where up.user_id=current_user_id and up.permission_key in ('users.view','users.manage')) then
    raise exception 'not allowed';
  end if;
  select * into target_job from public.job_types where id=requested_job_type_id;
  if target_job.id is null then raise exception 'job type not found'; end if;
  select * into period_row from public.dynamic_availability_periods where job_type_id=requested_job_type_id and year=requested_year and month=requested_month;

  return jsonb_build_object(
    'jobTypeId', target_job.id,
    'jobTypeName', target_job.name,
    'availabilityConfig', target_job.availability_config,
    'periodId', period_row.id,
    'materialized', period_row.id is not null,
    'slotCount', case when period_row.id is null then 0 else (select count(*) from public.dynamic_availability_slots s where s.period_id=period_row.id) end,
    'memberCount', (select count(*) from public.job_type_memberships m where m.job_type_id=target_job.id),
    'submissionCount', case when period_row.id is null then 0 else (select count(*) from public.dynamic_availability_submissions s where s.period_id=period_row.id) end,
    'mode', 'shadow'
  );
end;
$function$;

revoke all on function public.get_dynamic_availability_shadow_summary(uuid,integer,integer) from public;
grant execute on function public.get_dynamic_availability_shadow_summary(uuid,integer,integer) to authenticated;

update public.scheduling_feature_flags
set config = config || jsonb_build_object('phase','4','mode','shadow','availability_engine','shadow'), updated_at=now()
where key='dynamic_job_types';

commit;
