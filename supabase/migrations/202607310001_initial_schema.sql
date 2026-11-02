-- קובץ: supabase/migrations/202607310001_initial_schema.sql
-- מטרה: הקמת הסכמה הראשונית של טבלאות, טיפוסים ופעולות מסד הנתונים.
-- מטרות עיקריות:
-- - הגדרת פונקציות: public.set_updated_at, public.handle_new_auth_user, public.current_user_role, public.is_admin, public.is_manager_or_admin, public.record_schedule_assignment_change.
-- - מבני טבלאות: public.profiles, public.schedule_periods, public.holidays, public.schedule_shifts, public.dispatcher_availability, public.schedule_assignment_history, public.audit_logs.
-- - סדר הפקודות, התנאים וההרשאות בקובץ נשמר כפי שהיה במקור.
begin;

-- =========================================================
-- Extensions
-- =========================================================

create extension if not exists pgcrypto;


-- =========================================================
-- Enums
-- =========================================================

do $$
begin
  create type public.user_role as enum (
    'admin',
    'manager',
    'dispatcher',
    'on_call',
    'viewer'
  );
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type public.schedule_period_status as enum (
    'draft',
    'collecting_availability',
    'scheduling',
    'published',
    'archived'
  );
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type public.schedule_type as enum (
    'weekday',
    'friday',
    'saturday',
    'holiday_eve',
    'holiday_full',
    'holiday_end',
    'chol_hamoed'
  );
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type public.assignment_source as enum (
    'manual',
    'automatic',
    'shift_swap',
    'import'
  );
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type public.availability_status as enum (
    'available',
    'unavailable',
    'preferred',
    'not_submitted'
  );
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type public.assignment_change_type as enum (
    'initial_assignment',
    'manual_edit',
    'automatic_assignment',
    'shift_swap',
    'import',
    'clear_assignment'
  );
exception
  when duplicate_object then null;
end
$$;


-- =========================================================
-- Shared utility function: updated_at
-- =========================================================

-- פונקציית מסד public.set_updated_at: קביעת מועד עדכון.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;


-- =========================================================
-- Profiles
-- =========================================================

-- הגדרת מבנה הטבלה public.profiles והאילוצים המופיעים בהמשך.
create table if not exists public.profiles (
  id uuid primary key
    references auth.users(id)
    on delete cascade,

  email text not null,
  display_name text not null,
  schedule_name text,
  role public.user_role not null default 'dispatcher',
  is_active boolean not null default true,
  must_change_password boolean not null default false,
  last_login_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint profiles_email_not_blank
    check (length(trim(email)) > 0),

  constraint profiles_display_name_not_blank
    check (length(trim(display_name)) > 0),

  constraint profiles_schedule_name_not_blank
    check (
      schedule_name is null
      or length(trim(schedule_name)) > 0
    )
);

-- הגדרת האינדקס profiles_email_unique_lower_idx עבור העמודות והתנאים המפורטים בפקודה.
create unique index if not exists profiles_email_unique_lower_idx
  on public.profiles (lower(email));

-- הגדרת האינדקס profiles_role_idx עבור העמודות והתנאים המפורטים בפקודה.
create index if not exists profiles_role_idx
  on public.profiles (role);

-- הגדרת האינדקס profiles_active_idx עבור העמודות והתנאים המפורטים בפקודה.
create index if not exists profiles_active_idx
  on public.profiles (is_active);

drop trigger if exists set_profiles_updated_at
  on public.profiles;

create trigger set_profiles_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();


-- =========================================================
-- Profile creation after Supabase Auth signup
-- =========================================================

-- פונקציית מסד public.handle_new_auth_user: טיפול באירוע עבור אימות משתמשים / משתמש.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
-- הפונקציה רצה בהרשאות הבעלים; בדיקות הרשאה פנימיות והרשאות EXECUTE נבחנות בנפרד.
security definer
set search_path = ''
as $$
declare
  -- resolved_display_name — שם תצוגה.
  resolved_display_name text;
begin
  resolved_display_name :=
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(split_part(new.email, '@', 1), ''),
      'משתמש חדש'
    );

  -- הוספת רשומות ל־public.profiles בהתאם לקלט ולתנאים להלן.
  insert into public.profiles (
    id,
    email,
    display_name,
    schedule_name,
    role,
    is_active
  )
  values (
    new.id,
    coalesce(new.email, new.id::text),
    resolved_display_name,
    resolved_display_name,
    'dispatcher',
    true
  )
  on conflict (id) do update
  set
    email = excluded.email,
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created
  on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_auth_user();


-- =========================================================
-- Backfill profiles for users that already exist
-- =========================================================

-- הוספת רשומות ל־public.profiles בהתאם לקלט ולתנאים להלן.
insert into public.profiles (
  id,
  email,
  display_name,
  schedule_name,
  role,
  is_active
)
select
  auth_user.id,
  coalesce(auth_user.email, auth_user.id::text),
  coalesce(
    nullif(trim(auth_user.raw_user_meta_data ->> 'display_name'), ''),
    nullif(trim(auth_user.raw_user_meta_data ->> 'full_name'), ''),
    nullif(split_part(auth_user.email, '@', 1), ''),
    'משתמש חדש'
  ),
  coalesce(
    nullif(trim(auth_user.raw_user_meta_data ->> 'display_name'), ''),
    nullif(trim(auth_user.raw_user_meta_data ->> 'full_name'), ''),
    nullif(split_part(auth_user.email, '@', 1), ''),
    'משתמש חדש'
  ),
  'dispatcher',
  true
from auth.users as auth_user
on conflict (id) do nothing;


-- =========================================================
-- Permission helper functions
-- =========================================================

-- פונקציית מסד public.current_user_role: המשתמש הנוכחי הנוכחי.
create or replace function public.current_user_role()
returns public.user_role
language sql
stable
-- הפונקציה רצה בהרשאות הבעלים; בדיקות הרשאה פנימיות והרשאות EXECUTE נבחנות בנפרד.
security definer
set search_path = ''
as $$
  select profile.role
  from public.profiles as profile
  where profile.id = (select auth.uid())
    and profile.is_active = true
  limit 1;
$$;

-- פונקציית מסד public.is_admin: בדיקת תנאי עבור הנתון is_admin בהקשר הפעולה.
create or replace function public.is_admin()
returns boolean
language sql
stable
-- הפונקציה רצה בהרשאות הבעלים; בדיקות הרשאה פנימיות והרשאות EXECUTE נבחנות בנפרד.
security definer
set search_path = ''
as $$
  select coalesce(
    public.current_user_role() = 'admin',
    false
  );
$$;

-- פונקציית מסד public.is_manager_or_admin: בדיקת תנאי עבור הנתון is_manager_or_admin בהקשר הפעולה.
create or replace function public.is_manager_or_admin()
returns boolean
language sql
stable
-- הפונקציה רצה בהרשאות הבעלים; בדיקות הרשאה פנימיות והרשאות EXECUTE נבחנות בנפרד.
security definer
set search_path = ''
as $$
  select coalesce(
    public.current_user_role() in ('admin', 'manager'),
    false
  );
$$;

-- הסרת ההרשאות המפורטות בפקודה מהתפקידים המצוינים בה.
revoke all on function public.current_user_role() from public;
-- הסרת ההרשאות המפורטות בפקודה מהתפקידים המצוינים בה.
revoke all on function public.is_admin() from public;
-- הסרת ההרשאות המפורטות בפקודה מהתפקידים המצוינים בה.
revoke all on function public.is_manager_or_admin() from public;

-- הקצאת ההרשאות המפורטות בפקודה לתפקידים המצוינים בה.
grant execute on function public.current_user_role()
  to authenticated;

-- הקצאת ההרשאות המפורטות בפקודה לתפקידים המצוינים בה.
grant execute on function public.is_admin()
  to authenticated;

-- הקצאת ההרשאות המפורטות בפקודה לתפקידים המצוינים בה.
grant execute on function public.is_manager_or_admin()
  to authenticated;


-- =========================================================
-- Schedule periods
-- =========================================================

-- הגדרת מבנה הטבלה public.schedule_periods והאילוצים המופיעים בהמשך.
create table if not exists public.schedule_periods (
  id uuid primary key default gen_random_uuid(),

  year integer not null,
  month integer not null,
  status public.schedule_period_status not null default 'draft',

  availability_deadline timestamptz,
  published_at timestamptz,
  archived_at timestamptz,

  created_by uuid
    references public.profiles(id)
    on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint schedule_periods_year_valid
    check (year between 2020 and 2100),

  constraint schedule_periods_month_valid
    check (month between 1 and 12),

  constraint schedule_periods_year_month_unique
    unique (year, month),

  constraint schedule_periods_published_state_valid
    check (
      published_at is null
      or status in ('published', 'archived')
    ),

  constraint schedule_periods_archived_state_valid
    check (
      archived_at is null
      or status = 'archived'
    )
);

-- הגדרת האינדקס schedule_periods_status_idx עבור העמודות והתנאים המפורטים בפקודה.
create index if not exists schedule_periods_status_idx
  on public.schedule_periods (status);

-- הגדרת האינדקס schedule_periods_date_idx עבור העמודות והתנאים המפורטים בפקודה.
create index if not exists schedule_periods_date_idx
  on public.schedule_periods (year desc, month desc);

drop trigger if exists set_schedule_periods_updated_at
  on public.schedule_periods;

create trigger set_schedule_periods_updated_at
before update on public.schedule_periods
for each row
execute function public.set_updated_at();


-- =========================================================
-- Holidays
-- =========================================================

-- הגדרת מבנה הטבלה public.holidays והאילוצים המופיעים בהמשך.
create table if not exists public.holidays (
  id uuid primary key default gen_random_uuid(),

  holiday_date date not null,
  name text not null,
  schedule_type public.schedule_type not null,
  holiday_group text,
  source text not null default 'manual',
  is_manual_override boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint holidays_name_not_blank
    check (length(trim(name)) > 0),

  constraint holidays_source_not_blank
    check (length(trim(source)) > 0),

  constraint holidays_date_name_unique
    unique (holiday_date, name)
);

-- הגדרת האינדקס holidays_date_idx עבור העמודות והתנאים המפורטים בפקודה.
create index if not exists holidays_date_idx
  on public.holidays (holiday_date);

-- הגדרת האינדקס holidays_schedule_type_idx עבור העמודות והתנאים המפורטים בפקודה.
create index if not exists holidays_schedule_type_idx
  on public.holidays (schedule_type);

drop trigger if exists set_holidays_updated_at
  on public.holidays;

create trigger set_holidays_updated_at
before update on public.holidays
for each row
execute function public.set_updated_at();


-- =========================================================
-- Schedule shifts
-- =========================================================

-- הגדרת מבנה הטבלה public.schedule_shifts והאילוצים המופיעים בהמשך.
create table if not exists public.schedule_shifts (
  id uuid primary key default gen_random_uuid(),

  period_id uuid not null
    references public.schedule_periods(id)
    on delete cascade,

  shift_date date not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,

  shift_code text not null,
  schedule_type public.schedule_type not null,
  is_premium boolean not null default false,
  holiday_name text,

  assigned_user_id uuid
    references public.profiles(id)
    on delete set null,

  assignment_source public.assignment_source,
  is_locked boolean not null default false,
  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint schedule_shifts_time_valid
    check (ends_at > starts_at),

  constraint schedule_shifts_code_not_blank
    check (length(trim(shift_code)) > 0),

  constraint schedule_shifts_assignment_source_valid
    check (
      assigned_user_id is not null
      or assignment_source is null
    ),

  constraint schedule_shifts_unique_period_start
    unique (period_id, starts_at)
);

-- הגדרת האינדקס schedule_shifts_period_idx עבור העמודות והתנאים המפורטים בפקודה.
create index if not exists schedule_shifts_period_idx
  on public.schedule_shifts (period_id);

-- הגדרת האינדקס schedule_shifts_date_idx עבור העמודות והתנאים המפורטים בפקודה.
create index if not exists schedule_shifts_date_idx
  on public.schedule_shifts (shift_date);

-- הגדרת האינדקס schedule_shifts_assigned_user_idx עבור העמודות והתנאים המפורטים בפקודה.
create index if not exists schedule_shifts_assigned_user_idx
  on public.schedule_shifts (assigned_user_id);

-- הגדרת האינדקס schedule_shifts_period_date_idx עבור העמודות והתנאים המפורטים בפקודה.
create index if not exists schedule_shifts_period_date_idx
  on public.schedule_shifts (period_id, shift_date, starts_at);

drop trigger if exists set_schedule_shifts_updated_at
  on public.schedule_shifts;

create trigger set_schedule_shifts_updated_at
before update on public.schedule_shifts
for each row
execute function public.set_updated_at();


-- =========================================================
-- Dispatcher availability
-- =========================================================

-- הגדרת מבנה הטבלה public.dispatcher_availability והאילוצים המופיעים בהמשך.
create table if not exists public.dispatcher_availability (
  id uuid primary key default gen_random_uuid(),

  shift_id uuid not null
    references public.schedule_shifts(id)
    on delete cascade,

  user_id uuid not null
    references public.profiles(id)
    on delete cascade,

  availability_status public.availability_status
    not null
    default 'not_submitted',

  note text,
  submitted_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint dispatcher_availability_shift_user_unique
    unique (shift_id, user_id),

  constraint dispatcher_availability_submission_valid
    check (
      availability_status = 'not_submitted'
      or submitted_at is not null
    )
);

-- הגדרת האינדקס dispatcher_availability_shift_idx עבור העמודות והתנאים המפורטים בפקודה.
create index if not exists dispatcher_availability_shift_idx
  on public.dispatcher_availability (shift_id);

-- הגדרת האינדקס dispatcher_availability_user_idx עבור העמודות והתנאים המפורטים בפקודה.
create index if not exists dispatcher_availability_user_idx
  on public.dispatcher_availability (user_id);

-- הגדרת האינדקס dispatcher_availability_status_idx עבור העמודות והתנאים המפורטים בפקודה.
create index if not exists dispatcher_availability_status_idx
  on public.dispatcher_availability (availability_status);

drop trigger if exists set_dispatcher_availability_updated_at
  on public.dispatcher_availability;

create trigger set_dispatcher_availability_updated_at
before update on public.dispatcher_availability
for each row
execute function public.set_updated_at();


-- =========================================================
-- Schedule assignment history
-- =========================================================

-- הגדרת מבנה הטבלה public.schedule_assignment_history והאילוצים המופיעים בהמשך.
create table if not exists public.schedule_assignment_history (
  id uuid primary key default gen_random_uuid(),

  shift_id uuid not null
    references public.schedule_shifts(id)
    on delete cascade,

  previous_user_id uuid
    references public.profiles(id)
    on delete set null,

  new_user_id uuid
    references public.profiles(id)
    on delete set null,

  change_type public.assignment_change_type not null,

  changed_by uuid
    references public.profiles(id)
    on delete set null,

  reason text,
  created_at timestamptz not null default now(),

  constraint schedule_assignment_history_has_change
    check (
      previous_user_id is distinct from new_user_id
    )
);

-- הגדרת האינדקס schedule_assignment_history_shift_idx עבור העמודות והתנאים המפורטים בפקודה.
create index if not exists schedule_assignment_history_shift_idx
  on public.schedule_assignment_history (shift_id);

-- הגדרת האינדקס schedule_assignment_history_changed_by_idx עבור העמודות והתנאים המפורטים בפקודה.
create index if not exists schedule_assignment_history_changed_by_idx
  on public.schedule_assignment_history (changed_by);

-- הגדרת האינדקס schedule_assignment_history_created_at_idx עבור העמודות והתנאים המפורטים בפקודה.
create index if not exists schedule_assignment_history_created_at_idx
  on public.schedule_assignment_history (created_at desc);


-- =========================================================
-- Automatic assignment history trigger
-- =========================================================

-- פונקציית מסד public.record_schedule_assignment_change: שיבוץ / הקצאה.
create or replace function public.record_schedule_assignment_change()
returns trigger
language plpgsql
-- הפונקציה רצה בהרשאות הבעלים; בדיקות הרשאה פנימיות והרשאות EXECUTE נבחנות בנפרד.
security definer
set search_path = ''
as $$
declare
  resolved_change_type public.assignment_change_type;
begin
  -- הסתעפות לפי התנאי old.assigned_user_id is not distinct from new.assigned_user_id.
  if old.assigned_user_id is not distinct from new.assigned_user_id then
    return new;
  end if;

  resolved_change_type :=
    case
      when new.assigned_user_id is null then
        'clear_assignment'::public.assignment_change_type

      when old.assigned_user_id is null
        and new.assignment_source = 'automatic' then
        'automatic_assignment'::public.assignment_change_type

      when old.assigned_user_id is null
        and new.assignment_source = 'import' then
        'import'::public.assignment_change_type

      when old.assigned_user_id is null
        and new.assignment_source = 'shift_swap' then
        'shift_swap'::public.assignment_change_type

      when old.assigned_user_id is null then
        'initial_assignment'::public.assignment_change_type

      when new.assignment_source = 'automatic' then
        'automatic_assignment'::public.assignment_change_type

      when new.assignment_source = 'import' then
        'import'::public.assignment_change_type

      when new.assignment_source = 'shift_swap' then
        'shift_swap'::public.assignment_change_type

      else
        'manual_edit'::public.assignment_change_type
    end;

  -- הוספת רשומות ל־public.schedule_assignment_history בהתאם לקלט ולתנאים להלן.
  insert into public.schedule_assignment_history (
    shift_id,
    previous_user_id,
    new_user_id,
    change_type,
    changed_by
  )
  values (
    new.id,
    old.assigned_user_id,
    new.assigned_user_id,
    resolved_change_type,
    (select auth.uid())
  );

  return new;
end;
$$;

drop trigger if exists record_schedule_assignment_change
  on public.schedule_shifts;

create trigger record_schedule_assignment_change
after update of assigned_user_id
on public.schedule_shifts
for each row
execute function public.record_schedule_assignment_change();


-- =========================================================
-- Audit logs
-- =========================================================

-- הגדרת מבנה הטבלה public.audit_logs והאילוצים המופיעים בהמשך.
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),

  user_id uuid
    references public.profiles(id)
    on delete set null,

  action text not null,
  entity_type text not null,
  entity_id uuid,

  old_values jsonb,
  new_values jsonb,
  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),

  constraint audit_logs_action_not_blank
    check (length(trim(action)) > 0),

  constraint audit_logs_entity_type_not_blank
    check (length(trim(entity_type)) > 0)
);

-- הגדרת האינדקס audit_logs_user_idx עבור העמודות והתנאים המפורטים בפקודה.
create index if not exists audit_logs_user_idx
  on public.audit_logs (user_id);

-- הגדרת האינדקס audit_logs_entity_idx עבור העמודות והתנאים המפורטים בפקודה.
create index if not exists audit_logs_entity_idx
  on public.audit_logs (entity_type, entity_id);

-- הגדרת האינדקס audit_logs_created_at_idx עבור העמודות והתנאים המפורטים בפקודה.
create index if not exists audit_logs_created_at_idx
  on public.audit_logs (created_at desc);


-- =========================================================
-- Grants
-- =========================================================

-- הקצאת ההרשאות המפורטות בפקודה לתפקידים המצוינים בה.
grant usage on schema public to authenticated;

-- הקצאת ההרשאות המפורטות בפקודה לתפקידים המצוינים בה.
grant select on public.profiles
  to authenticated;

-- הקצאת ההרשאות המפורטות בפקודה לתפקידים המצוינים בה.
grant select, insert, update, delete on public.schedule_periods
  to authenticated;

-- הקצאת ההרשאות המפורטות בפקודה לתפקידים המצוינים בה.
grant select, insert, update, delete on public.holidays
  to authenticated;

-- הקצאת ההרשאות המפורטות בפקודה לתפקידים המצוינים בה.
grant select, insert, update, delete on public.schedule_shifts
  to authenticated;

-- הקצאת ההרשאות המפורטות בפקודה לתפקידים המצוינים בה.
grant select, insert, update, delete on public.dispatcher_availability
  to authenticated;

-- הקצאת ההרשאות המפורטות בפקודה לתפקידים המצוינים בה.
grant select, insert on public.schedule_assignment_history
  to authenticated;

-- הקצאת ההרשאות המפורטות בפקודה לתפקידים המצוינים בה.
grant select on public.audit_logs
  to authenticated;


-- =========================================================
-- Enable Row Level Security
-- =========================================================

-- עדכון מבנה או הגדרות הטבלה public.profiles.
alter table public.profiles
  enable row level security;

-- עדכון מבנה או הגדרות הטבלה public.schedule_periods.
alter table public.schedule_periods
  enable row level security;

-- עדכון מבנה או הגדרות הטבלה public.holidays.
alter table public.holidays
  enable row level security;

-- עדכון מבנה או הגדרות הטבלה public.schedule_shifts.
alter table public.schedule_shifts
  enable row level security;

-- עדכון מבנה או הגדרות הטבלה public.dispatcher_availability.
alter table public.dispatcher_availability
  enable row level security;

-- עדכון מבנה או הגדרות הטבלה public.schedule_assignment_history.
alter table public.schedule_assignment_history
  enable row level security;

-- עדכון מבנה או הגדרות הטבלה public.audit_logs.
alter table public.audit_logs
  enable row level security;


-- =========================================================
-- Profiles policies
-- =========================================================

drop policy if exists "Authenticated users can view active profiles"
  on public.profiles;

-- הגדרת מדיניות RLS: "Authenticated users can view active profiles". תנאי USING/WITH CHECK להלן קובעים את ההיקף.
create policy "Authenticated users can view active profiles"
on public.profiles
for select
to authenticated
using (
  is_active = true
  or id = (select auth.uid())
  or (select public.is_manager_or_admin())
);

drop policy if exists "Admins can insert profiles"
  on public.profiles;

-- הגדרת מדיניות RLS: "Admins can insert profiles". תנאי USING/WITH CHECK להלן קובעים את ההיקף.
create policy "Admins can insert profiles"
on public.profiles
for insert
to authenticated
with check (
  (select public.is_admin())
);

drop policy if exists "Admins can update profiles"
  on public.profiles;

-- הגדרת מדיניות RLS: "Admins can update profiles". תנאי USING/WITH CHECK להלן קובעים את ההיקף.
create policy "Admins can update profiles"
on public.profiles
for update
to authenticated
using (
  (select public.is_admin())
)
with check (
  (select public.is_admin())
);

drop policy if exists "Admins can delete profiles"
  on public.profiles;

-- הגדרת מדיניות RLS: "Admins can delete profiles". תנאי USING/WITH CHECK להלן קובעים את ההיקף.
create policy "Admins can delete profiles"
on public.profiles
for delete
to authenticated
using (
  (select public.is_admin())
);


-- =========================================================
-- Schedule period policies
-- =========================================================

drop policy if exists "Authenticated users can view schedule periods"
  on public.schedule_periods;

-- הגדרת מדיניות RLS: "Authenticated users can view schedule periods". תנאי USING/WITH CHECK להלן קובעים את ההיקף.
create policy "Authenticated users can view schedule periods"
on public.schedule_periods
for select
to authenticated
using (true);

drop policy if exists "Managers can create schedule periods"
  on public.schedule_periods;

-- הגדרת מדיניות RLS: "Managers can create schedule periods". תנאי USING/WITH CHECK להלן קובעים את ההיקף.
create policy "Managers can create schedule periods"
on public.schedule_periods
for insert
to authenticated
with check (
  (select public.is_manager_or_admin())
  and created_by = (select auth.uid())
);

drop policy if exists "Managers can update schedule periods"
  on public.schedule_periods;

-- הגדרת מדיניות RLS: "Managers can update schedule periods". תנאי USING/WITH CHECK להלן קובעים את ההיקף.
create policy "Managers can update schedule periods"
on public.schedule_periods
for update
to authenticated
using (
  (select public.is_manager_or_admin())
)
with check (
  (select public.is_manager_or_admin())
);

drop policy if exists "Admins can delete schedule periods"
  on public.schedule_periods;

-- הגדרת מדיניות RLS: "Admins can delete schedule periods". תנאי USING/WITH CHECK להלן קובעים את ההיקף.
create policy "Admins can delete schedule periods"
on public.schedule_periods
for delete
to authenticated
using (
  (select public.is_admin())
);


-- =========================================================
-- Holiday policies
-- =========================================================

drop policy if exists "Authenticated users can view holidays"
  on public.holidays;

-- הגדרת מדיניות RLS: "Authenticated users can view holidays". תנאי USING/WITH CHECK להלן קובעים את ההיקף.
create policy "Authenticated users can view holidays"
on public.holidays
for select
to authenticated
using (true);

drop policy if exists "Managers can create holidays"
  on public.holidays;

-- הגדרת מדיניות RLS: "Managers can create holidays". תנאי USING/WITH CHECK להלן קובעים את ההיקף.
create policy "Managers can create holidays"
on public.holidays
for insert
to authenticated
with check (
  (select public.is_manager_or_admin())
);

drop policy if exists "Managers can update holidays"
  on public.holidays;

-- הגדרת מדיניות RLS: "Managers can update holidays". תנאי USING/WITH CHECK להלן קובעים את ההיקף.
create policy "Managers can update holidays"
on public.holidays
for update
to authenticated
using (
  (select public.is_manager_or_admin())
)
with check (
  (select public.is_manager_or_admin())
);

drop policy if exists "Admins can delete holidays"
  on public.holidays;

-- הגדרת מדיניות RLS: "Admins can delete holidays". תנאי USING/WITH CHECK להלן קובעים את ההיקף.
create policy "Admins can delete holidays"
on public.holidays
for delete
to authenticated
using (
  (select public.is_admin())
);


-- =========================================================
-- Schedule shift policies
-- =========================================================

drop policy if exists "Authenticated users can view schedule shifts"
  on public.schedule_shifts;

-- הגדרת מדיניות RLS: "Authenticated users can view schedule shifts". תנאי USING/WITH CHECK להלן קובעים את ההיקף.
create policy "Authenticated users can view schedule shifts"
on public.schedule_shifts
for select
to authenticated
using (true);

drop policy if exists "Managers can create schedule shifts"
  on public.schedule_shifts;

-- הגדרת מדיניות RLS: "Managers can create schedule shifts". תנאי USING/WITH CHECK להלן קובעים את ההיקף.
create policy "Managers can create schedule shifts"
on public.schedule_shifts
for insert
to authenticated
with check (
  (select public.is_manager_or_admin())
);

drop policy if exists "Managers can update schedule shifts"
  on public.schedule_shifts;

-- הגדרת מדיניות RLS: "Managers can update schedule shifts". תנאי USING/WITH CHECK להלן קובעים את ההיקף.
create policy "Managers can update schedule shifts"
on public.schedule_shifts
for update
to authenticated
using (
  (select public.is_manager_or_admin())
)
with check (
  (select public.is_manager_or_admin())
);

drop policy if exists "Admins can delete schedule shifts"
  on public.schedule_shifts;

-- הגדרת מדיניות RLS: "Admins can delete schedule shifts". תנאי USING/WITH CHECK להלן קובעים את ההיקף.
create policy "Admins can delete schedule shifts"
on public.schedule_shifts
for delete
to authenticated
using (
  (select public.is_admin())
);


-- =========================================================
-- Availability policies
-- =========================================================

drop policy if exists "Users can view their own availability"
  on public.dispatcher_availability;

-- הגדרת מדיניות RLS: "Users can view their own availability". תנאי USING/WITH CHECK להלן קובעים את ההיקף.
create policy "Users can view their own availability"
on public.dispatcher_availability
for select
to authenticated
using (
  user_id = (select auth.uid())
  or (select public.is_manager_or_admin())
);

drop policy if exists "Users can create their own availability"
  on public.dispatcher_availability;

-- הגדרת מדיניות RLS: "Users can create their own availability". תנאי USING/WITH CHECK להלן קובעים את ההיקף.
create policy "Users can create their own availability"
on public.dispatcher_availability
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  or (select public.is_manager_or_admin())
);

drop policy if exists "Users can update their own availability"
  on public.dispatcher_availability;

-- הגדרת מדיניות RLS: "Users can update their own availability". תנאי USING/WITH CHECK להלן קובעים את ההיקף.
create policy "Users can update their own availability"
on public.dispatcher_availability
for update
to authenticated
using (
  user_id = (select auth.uid())
  or (select public.is_manager_or_admin())
)
with check (
  user_id = (select auth.uid())
  or (select public.is_manager_or_admin())
);

drop policy if exists "Managers can delete availability"
  on public.dispatcher_availability;

-- הגדרת מדיניות RLS: "Managers can delete availability". תנאי USING/WITH CHECK להלן קובעים את ההיקף.
create policy "Managers can delete availability"
on public.dispatcher_availability
for delete
to authenticated
using (
  (select public.is_manager_or_admin())
);


-- =========================================================
-- Assignment history policies
-- =========================================================

drop policy if exists "Authenticated users can view assignment history"
  on public.schedule_assignment_history;

-- הגדרת מדיניות RLS: "Authenticated users can view assignment history". תנאי USING/WITH CHECK להלן קובעים את ההיקף.
create policy "Authenticated users can view assignment history"
on public.schedule_assignment_history
for select
to authenticated
using (true);

drop policy if exists "Managers can create assignment history"
  on public.schedule_assignment_history;

-- הגדרת מדיניות RLS: "Managers can create assignment history". תנאי USING/WITH CHECK להלן קובעים את ההיקף.
create policy "Managers can create assignment history"
on public.schedule_assignment_history
for insert
to authenticated
with check (
  (select public.is_manager_or_admin())
);


-- =========================================================
-- Audit policies
-- =========================================================

drop policy if exists "Managers can view audit logs"
  on public.audit_logs;

-- הגדרת מדיניות RLS: "Managers can view audit logs". תנאי USING/WITH CHECK להלן קובעים את ההיקף.
create policy "Managers can view audit logs"
on public.audit_logs
for select
to authenticated
using (
  (select public.is_manager_or_admin())
);


commit;