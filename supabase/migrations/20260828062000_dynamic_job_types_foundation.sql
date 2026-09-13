begin;

-- Phase 1: Dynamic scheduling/job-type foundation.
-- ADDITIVE ONLY. No existing scheduling table, enum, RPC, role or profile column is changed.
-- The feature flag remains disabled until later phases are explicitly enabled.

create table if not exists public.scheduling_feature_flags (
  key text primary key,
  enabled boolean not null default false,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint scheduling_feature_flags_key_not_blank check (length(trim(key)) > 0),
  constraint scheduling_feature_flags_config_object check (jsonb_typeof(config) = 'object')
);

create table if not exists public.schedule_groups (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  is_active boolean not null default true,
  legacy_kind text,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint schedule_groups_code_not_blank check (length(trim(code)) > 0),
  constraint schedule_groups_name_not_blank check (length(trim(name)) > 0),
  constraint schedule_groups_config_object check (jsonb_typeof(config) = 'object')
);

create table if not exists public.job_types (
  id uuid primary key default gen_random_uuid(),
  schedule_group_id uuid not null references public.schedule_groups(id) on delete restrict,
  code text not null unique,
  name text not null,
  description text,
  is_active boolean not null default true,
  legacy_role text,
  employment_scope text not null default 'flexible',
  pay_model text not null default 'none',
  pay_config jsonb not null default '{}'::jsonb,
  availability_config jsonb not null default '{}'::jsonb,
  statistics_config jsonb not null default '{}'::jsonb,
  ai_config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint job_types_code_not_blank check (length(trim(code)) > 0),
  constraint job_types_name_not_blank check (length(trim(name)) > 0),
  constraint job_types_employment_scope_valid check (employment_scope in ('full_time','part_time','flexible','other')),
  constraint job_types_pay_model_valid check (pay_model in ('hourly','per_shift','per_day','mixed','none')),
  constraint job_types_json_objects check (
    jsonb_typeof(pay_config) = 'object' and
    jsonb_typeof(availability_config) = 'object' and
    jsonb_typeof(statistics_config) = 'object' and
    jsonb_typeof(ai_config) = 'object'
  )
);

-- One shift template is one reusable shift definition in a schedule group.
-- day_kind is deliberately text in Phase 1 so new day categories do not require enum migrations.
create table if not exists public.schedule_group_shift_templates (
  id uuid primary key default gen_random_uuid(),
  schedule_group_id uuid not null references public.schedule_groups(id) on delete cascade,
  code text not null,
  name text not null,
  day_kind text not null,
  start_time time not null,
  end_time time not null,
  sort_order integer not null default 0,
  required_workers integer not null default 1,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (schedule_group_id, code),
  constraint schedule_group_shift_templates_required_workers_positive check (required_workers >= 0),
  constraint schedule_group_shift_templates_day_kind_valid check (
    day_kind in ('weekday','friday','saturday','holiday_eve','holiday_full','holiday_end','chol_hamoed','custom')
  ),
  constraint schedule_group_shift_templates_metadata_object check (jsonb_typeof(metadata) = 'object')
);

-- Allows a holiday/day category to inherit another template family, have custom templates, or have no work.
create table if not exists public.schedule_group_day_rules (
  id uuid primary key default gen_random_uuid(),
  schedule_group_id uuid not null references public.schedule_groups(id) on delete cascade,
  day_kind text not null,
  behavior text not null default 'own_templates',
  inherit_day_kind text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (schedule_group_id, day_kind),
  constraint schedule_group_day_rules_behavior_valid check (behavior in ('own_templates','inherit','no_work')),
  constraint schedule_group_day_rules_inherit_consistent check (
    (behavior = 'inherit' and inherit_day_kind is not null)
    or (behavior <> 'inherit' and inherit_day_kind is null)
  ),
  constraint schedule_group_day_rules_metadata_object check (jsonb_typeof(metadata) = 'object')
);

-- Pay can change inside a shift (e.g. Friday 14-16 at 100%, 16-22 at 200%).
create table if not exists public.schedule_shift_pay_segments (
  id uuid primary key default gen_random_uuid(),
  shift_template_id uuid not null references public.schedule_group_shift_templates(id) on delete cascade,
  start_time time not null,
  end_time time not null,
  multiplier numeric(6,3) not null default 1,
  label text,
  sort_order integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint schedule_shift_pay_segments_multiplier_positive check (multiplier > 0),
  constraint schedule_shift_pay_segments_metadata_object check (jsonb_typeof(metadata) = 'object')
);

-- Job types can share the same schedule-group shift pool while differing in eligibility.
create table if not exists public.job_type_shift_eligibility (
  job_type_id uuid not null references public.job_types(id) on delete cascade,
  shift_template_id uuid not null references public.schedule_group_shift_templates(id) on delete cascade,
  is_eligible boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (job_type_id, shift_template_id),
  constraint job_type_shift_eligibility_metadata_object check (jsonb_typeof(metadata) = 'object')
);

create table if not exists public.job_type_capabilities (
  job_type_id uuid not null references public.job_types(id) on delete cascade,
  capability_key text not null,
  enabled boolean not null default true,
  config jsonb not null default '{}'::jsonb,
  source text not null default 'manual',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (job_type_id, capability_key),
  constraint job_type_capabilities_key_not_blank check (length(trim(capability_key)) > 0),
  constraint job_type_capabilities_source_valid check (source in ('manual','seed','ai_suggested','ai_approved')),
  constraint job_type_capabilities_config_object check (jsonb_typeof(config) = 'object')
);

-- Text keys intentionally reference the existing permission registry logically rather than by FK,
-- because migration history for the current permission tables is incomplete.
create table if not exists public.job_type_default_permissions (
  job_type_id uuid not null references public.job_types(id) on delete cascade,
  permission_key text not null,
  source text not null default 'manual',
  created_at timestamptz not null default now(),
  primary key (job_type_id, permission_key),
  constraint job_type_default_permissions_key_not_blank check (length(trim(permission_key)) > 0),
  constraint job_type_default_permissions_source_valid check (source in ('manual','seed','ai_suggested','ai_approved'))
);

-- Shadow membership only. Existing profiles.role remains the production source of truth in Phase 1.
create table if not exists public.job_type_memberships (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  job_type_id uuid not null references public.job_types(id) on delete restrict,
  is_primary boolean not null default true,
  source text not null default 'legacy_seed',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint job_type_memberships_metadata_object check (jsonb_typeof(metadata) = 'object')
);

-- AI suggestions are drafts only; no suggestion grants permissions or changes scheduling by itself.
create table if not exists public.job_type_ai_suggestions (
  id uuid primary key default gen_random_uuid(),
  job_type_id uuid references public.job_types(id) on delete cascade,
  suggestion_type text not null,
  status text not null default 'pending',
  input_context jsonb not null default '{}'::jsonb,
  suggestion jsonb not null,
  created_by uuid references public.profiles(id) on delete set null,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint job_type_ai_suggestions_status_valid check (status in ('pending','approved','rejected','applied')),
  constraint job_type_ai_suggestions_json_objects check (
    jsonb_typeof(input_context) = 'object' and jsonb_typeof(suggestion) = 'object'
  )
);

-- Reuse the project's existing updated_at trigger function.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'scheduling_feature_flags','schedule_groups','job_types','schedule_group_shift_templates',
    'schedule_group_day_rules','schedule_shift_pay_segments','job_type_shift_eligibility',
    'job_type_capabilities','job_type_memberships'
  ] loop
    execute format('drop trigger if exists set_%I_updated_at on public.%I', table_name, table_name);
    execute format(
      'create trigger set_%I_updated_at before update on public.%I for each row execute function public.set_updated_at()',
      table_name, table_name
    );
  end loop;
end $$;

-- Foundation is backend-only for now. RLS is enabled and no authenticated policies are added.
alter table public.scheduling_feature_flags enable row level security;
alter table public.schedule_groups enable row level security;
alter table public.job_types enable row level security;
alter table public.schedule_group_shift_templates enable row level security;
alter table public.schedule_group_day_rules enable row level security;
alter table public.schedule_shift_pay_segments enable row level security;
alter table public.job_type_shift_eligibility enable row level security;
alter table public.job_type_capabilities enable row level security;
alter table public.job_type_default_permissions enable row level security;
alter table public.job_type_memberships enable row level security;
alter table public.job_type_ai_suggestions enable row level security;

insert into public.scheduling_feature_flags (key, enabled, config)
values ('dynamic_job_types', false, '{"phase":1,"mode":"shadow"}'::jsonb)
on conflict (key) do update set enabled = false, config = excluded.config;

-- Seed schedule groups. These rows DO NOT drive the current production scheduling engine yet.
insert into public.schedule_groups (code, name, description, legacy_kind)
values
  ('dispatch_center', 'מוקד', 'מערך המשמרות הקיים של המוקדנים', 'dispatcher'),
  ('on_call', 'כוננויות', 'מערך הכוננויות הקיים', 'on_call'),
  ('morning_on_call', 'כוננות בוקר', 'מערך כונני הבוקר הקיים', 'morning_driver')
on conflict (code) do update set name = excluded.name, description = excluded.description, legacy_kind = excluded.legacy_kind;

insert into public.job_types (
  schedule_group_id, code, name, description, legacy_role, employment_scope, pay_model,
  availability_config, statistics_config, ai_config
)
select g.id, seed.code, seed.name, seed.description, seed.legacy_role, seed.employment_scope, seed.pay_model,
       seed.availability_config::jsonb, seed.statistics_config::jsonb, '{"allow_suggestions":true,"auto_apply":false}'::jsonb
from public.schedule_groups g
join (values
  ('dispatch_center','dispatcher','מוקדן','תפקיד המוקדן הקיים','dispatcher','full_time','hourly',
   '{"enabled":true,"monthly_capacity":true}', '{"enabled":true,"payroll":true}'),
  ('on_call','on_call','כונן','תפקיד הכונן הקיים','on_call','flexible','per_day',
   '{"enabled":true}', '{"enabled":true,"payroll":true}'),
  ('morning_on_call','morning_driver','כונן בוקר','תפקיד כונן הבוקר הקיים','morning_driver','flexible','per_shift',
   '{"enabled":true}', '{"enabled":true,"payroll":true}')
) as seed(group_code,code,name,description,legacy_role,employment_scope,pay_model,availability_config,statistics_config)
  on seed.group_code = g.code
on conflict (code) do update set
  schedule_group_id = excluded.schedule_group_id,
  name = excluded.name,
  description = excluded.description,
  legacy_role = excluded.legacy_role,
  employment_scope = excluded.employment_scope,
  pay_model = excluded.pay_model;

-- Seed the known dispatcher shift pool. Other legacy pools are intentionally left as config-only
-- until their current production rules are mapped and verified in Phase 2.
insert into public.schedule_group_shift_templates
  (schedule_group_id, code, name, day_kind, start_time, end_time, sort_order, required_workers)
select g.id, v.code, v.name, v.day_kind, v.start_time::time, v.end_time::time, v.sort_order, 1
from public.schedule_groups g
cross join (values
  ('weekday_16_23','16:00–23:00','weekday','16:00','23:00',10),
  ('weekday_23_06','23:00–06:00','weekday','23:00','06:00',20),
  ('friday_06_14','06:00–14:00','friday','06:00','14:00',10),
  ('friday_14_22','14:00–22:00','friday','14:00','22:00',20),
  ('friday_22_06','22:00–06:00','friday','22:00','06:00',30),
  ('saturday_06_14','06:00–14:00','saturday','06:00','14:00',10),
  ('saturday_14_22','14:00–22:00','saturday','14:00','22:00',20),
  ('saturday_22_06','22:00–06:00','saturday','22:00','06:00',30)
) as v(code,name,day_kind,start_time,end_time,sort_order)
where g.code = 'dispatch_center'
on conflict (schedule_group_id, code) do update set
  name=excluded.name, day_kind=excluded.day_kind, start_time=excluded.start_time,
  end_time=excluded.end_time, sort_order=excluded.sort_order;

-- Holiday behavior for the dispatcher schedule group mirrors the current production rules.
insert into public.schedule_group_day_rules (schedule_group_id, day_kind, behavior, inherit_day_kind)
select g.id, v.day_kind, v.behavior, v.inherit_day_kind
from public.schedule_groups g
cross join (values
  ('holiday_eve','inherit','friday'),
  ('holiday_end','inherit','saturday'),
  ('chol_hamoed','inherit','weekday')
) as v(day_kind,behavior,inherit_day_kind)
where g.code = 'dispatch_center'
on conflict (schedule_group_id, day_kind) do update set behavior=excluded.behavior, inherit_day_kind=excluded.inherit_day_kind;

-- Current legacy users are shadow-mapped. This does not alter profiles.role or current permissions.
insert into public.job_type_memberships (user_id, job_type_id, source)
select p.id, jt.id, 'legacy_seed'
from public.profiles p
join public.job_types jt on jt.legacy_role = p.role::text
where p.role::text in ('dispatcher','on_call','morning_driver')
on conflict (user_id) do nothing;

-- Seed capabilities only as descriptive configuration; no current feature reads these rows yet.
insert into public.job_type_capabilities (job_type_id, capability_key, enabled, source)
select jt.id, capability_key, true, 'seed'
from public.job_types jt
cross join lateral unnest(array['availability','schedule','statistics','schedule_publication_notifications']) capability_key
where jt.code in ('dispatcher','on_call','morning_driver')
on conflict (job_type_id, capability_key) do nothing;

comment on table public.schedule_groups is 'Phase-1 dynamic scheduling foundation. Not a production scheduling source while dynamic_job_types is disabled.';
comment on table public.job_types is 'Dynamic employment/job variants that share a schedule-group shift pool.';
comment on table public.job_type_ai_suggestions is 'Human-review queue for future AI configuration suggestions; never auto-applies permissions or scheduling changes.';

commit;
