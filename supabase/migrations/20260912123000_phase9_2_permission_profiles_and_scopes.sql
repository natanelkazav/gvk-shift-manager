-- קובץ: supabase/migrations/20260912123000_phase9_2_permission_profiles_and_scopes.sql
-- מטרה: הגדרת פעולות מסד נתונים עבור פרופילי הרשאות.
-- מטרות עיקריות:
-- - הגדרת פונקציות: public.get_permission_admin_catalog, public.get_user_permission_policy, public.save_user_permission_policy, public.has_job_type_permission.
-- - מבני טבלאות: public.permission_profiles, public.permission_profile_permissions, public.user_permission_policies, public.user_permission_job_type_scopes.
-- - סדר הפקודות, התנאים וההרשאות בקובץ נשמר כפי שהיה במקור.
-- Phase 9.2 - Generic permission profiles + dynamic job type scopes

-- הגדרת מבנה הטבלה public.permission_profiles והאילוצים המופיעים בהמשך.
create table if not exists public.permission_profiles (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text not null default '',
  is_system boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- הגדרת מבנה הטבלה public.permission_profile_permissions והאילוצים המופיעים בהמשך.
create table if not exists public.permission_profile_permissions (
  profile_id uuid not null references public.permission_profiles(id) on delete cascade,
  permission_key text not null,
  created_at timestamptz not null default now(),
  primary key (profile_id, permission_key)
);

-- הגדרת מבנה הטבלה public.user_permission_policies והאילוצים המופיעים בהמשך.
create table if not exists public.user_permission_policies (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  profile_id uuid null references public.permission_profiles(id) on delete set null,
  scope_mode text not null default 'all' check (scope_mode in ('all','selected')),
  updated_by uuid null references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

-- הגדרת מבנה הטבלה public.user_permission_job_type_scopes והאילוצים המופיעים בהמשך.
create table if not exists public.user_permission_job_type_scopes (
  user_id uuid not null references public.profiles(id) on delete cascade,
  job_type_id uuid not null references public.job_types(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, job_type_id)
);

-- הגדרת האינדקס idx_permission_profile_permissions_key עבור העמודות והתנאים המפורטים בפקודה.
create index if not exists idx_permission_profile_permissions_key
  on public.permission_profile_permissions(permission_key);
-- הגדרת האינדקס idx_user_permission_job_type_scopes_job עבור העמודות והתנאים המפורטים בפקודה.
create index if not exists idx_user_permission_job_type_scopes_job
  on public.user_permission_job_type_scopes(job_type_id);

-- System profiles are templates. Existing per-user permissions remain the effective
-- permission source during the pilot, so applying a profile in the UI is explicit.
-- הוספת רשומות ל־public.permission_profiles בהתאם לקלט ולתנאים להלן.
insert into public.permission_profiles (code, name, description, is_system, is_active)
values
  ('system_admin', 'מנהל מערכת', 'גישה מלאה לכל יכולות המערכת.', true, true),
  ('manager', 'מנהל', 'ניהול תפעולי, משתמשים, שיבוצים, אילוצים ואישורים.', true, true),
  ('employee', 'עובד', 'פעולות אישיות: לוח בקרה, התראות ובקשות אישיות.', true, true),
  ('viewer', 'צפייה בלבד', 'גישה בסיסית ללא פעולות ניהול.', true, true)
on conflict (code) do update
set name = excluded.name,
    description = excluded.description,
    is_system = excluded.is_system,
    is_active = excluded.is_active,
    updated_at = now();

-- Re-seed system profile permission lists idempotently.
-- מחיקת הרשומות שנבחרו מתוך public.permission_profile_permissions בהתאם לקלט ולתנאים להלן.
delete from public.permission_profile_permissions ppp
using public.permission_profiles pp
where ppp.profile_id = pp.id
  and pp.code in ('system_admin','manager','employee','viewer');

-- הוספת רשומות ל־public.permission_profile_permissions בהתאם לקלט ולתנאים להלן.
insert into public.permission_profile_permissions (profile_id, permission_key)
select pp.id, permissions.permission_key
from public.permission_profiles pp
cross join lateral (
  select unnest(case pp.code
    when 'system_admin' then array[
      'dashboard.view','schedule.view','schedule.view_team','schedule.edit',
      'availability.view','availability.manage','driver_availability.view','driver_availability.manage',
      'driver_schedule.view','driver_schedule.view_team','driver_schedule.edit','driver_schedule.edit_any',
      'morning_driver_availability.view','morning_driver_availability.manage',
      'morning_driver_schedule.view','morning_driver_schedule.view_team','morning_driver_schedule.edit','morning_driver_schedule.edit_any',
      'notifications.view','notifications.manage','statistics.view','payroll.view','payroll.manage',
      'attendance.view','attendance.manage','shift_swaps.view','shift_swaps.approve','archive.view',
      'users.view','users.manage','schedule_import.manage','schedule_export.manage','audit.view'
    ]::text[]
    when 'manager' then array[
      'dashboard.view','schedule.view_team','schedule.edit','availability.manage',
      'driver_availability.view','driver_availability.manage','driver_schedule.view','driver_schedule.view_team','driver_schedule.edit',
      'morning_driver_availability.manage','morning_driver_schedule.view','morning_driver_schedule.view_team','morning_driver_schedule.edit',
      'notifications.view','notifications.manage','statistics.view','payroll.view','attendance.view',
      'shift_swaps.view','shift_swaps.approve','archive.view','users.view'
    ]::text[]
    when 'employee' then array['dashboard.view','notifications.view','shift_swaps.view']::text[]
    else array['dashboard.view']::text[]
  end) as permission_key
) permissions
where pp.code in ('system_admin','manager','employee','viewer');

-- פונקציית מסד public.get_permission_admin_catalog: שליפה או חישוב של הרשאות.
create or replace function public.get_permission_admin_catalog()
returns jsonb
language plpgsql
-- הפונקציה רצה בהרשאות הבעלים; בדיקות הרשאה פנימיות והרשאות EXECUTE נבחנות בנפרד.
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
begin
  -- הסתעפות לפי התנאי v_actor is null.
  if v_actor is null then
    -- עצירת הפעולה עם שגיאה כאשר התנאי בבלוק מתקיים.
    raise exception 'not authenticated';
  end if;

  -- הסתעפות לפי התנאי not exists (.
  if not exists (
    select 1 from public.user_permissions up
    where up.user_id = v_actor and up.permission_key = 'users.manage'
  ) then
    -- עצירת הפעולה עם שגיאה כאשר התנאי בבלוק מתקיים.
    raise exception 'not allowed';
  end if;

  -- הרכבת תוצאת הפעולה והחזרתה לקורא.
  return jsonb_build_object(
    'profiles', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', pp.id,
        'code', pp.code,
        'name', pp.name,
        'description', pp.description,
        'isSystem', pp.is_system,
        'permissions', coalesce((
          select jsonb_agg(ppp.permission_key order by ppp.permission_key)
          from public.permission_profile_permissions ppp
          where ppp.profile_id = pp.id
        ), '[]'::jsonb)
      ) order by case pp.code
        when 'employee' then 1
        when 'manager' then 2
        when 'system_admin' then 3
        when 'viewer' then 4
        else 5 end, pp.name)
      from public.permission_profiles pp
      where pp.is_active = true
    ), '[]'::jsonb),
    'jobTypes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', jt.id,
        'name', jt.name,
        'code', jt.code
      ) order by jt.name)
      from public.job_types jt
      where jt.is_active = true
    ), '[]'::jsonb)
  );
end;
$$;

-- פונקציית מסד public.get_user_permission_policy: שליפה או חישוב של משתמש / הרשאות / מדיניות.
create or replace function public.get_user_permission_policy(target_user_id uuid)
returns jsonb
language plpgsql
-- הפונקציה רצה בהרשאות הבעלים; בדיקות הרשאה פנימיות והרשאות EXECUTE נבחנות בנפרד.
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
begin
  -- הסתעפות לפי התנאי v_actor is null then raise exception 'not authenticated'; end if;.
  if v_actor is null then raise exception 'not authenticated'; end if;
  -- הסתעפות לפי התנאי not exists (.
  if not exists (
    select 1 from public.user_permissions up
    where up.user_id = v_actor and up.permission_key = 'users.manage'
  ) then raise exception 'not allowed'; end if;

  -- הרכבת תוצאת הפעולה והחזרתה לקורא.
  return jsonb_build_object(
    'profileCode', (
      select pp.code
      from public.user_permission_policies upp
      left join public.permission_profiles pp on pp.id = upp.profile_id
      where upp.user_id = target_user_id
    ),
    'scopeMode', coalesce((
      select upp.scope_mode from public.user_permission_policies upp where upp.user_id = target_user_id
    ), 'all'),
    'jobTypeIds', coalesce((
      select jsonb_agg(ups.job_type_id order by ups.job_type_id)
      from public.user_permission_job_type_scopes ups
      where ups.user_id = target_user_id
    ), '[]'::jsonb)
  );
end;
$$;

-- פונקציית מסד public.save_user_permission_policy: שמירת משתמש / הרשאות / מדיניות.
create or replace function public.save_user_permission_policy(
  target_user_id uuid,
  requested_profile_code text,
  requested_scope_mode text,
  requested_job_type_ids uuid[] default array[]::uuid[]
)
returns void
language plpgsql
-- הפונקציה רצה בהרשאות הבעלים; בדיקות הרשאה פנימיות והרשאות EXECUTE נבחנות בנפרד.
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  -- v_profile_id — פרופיל / מזהה.
  v_profile_id uuid;
  -- v_scope_mode — מצב פעולה.
  v_scope_mode text := coalesce(requested_scope_mode, 'all');
begin
  -- הסתעפות לפי התנאי v_actor is null then raise exception 'not authenticated'; end if;.
  if v_actor is null then raise exception 'not authenticated'; end if;
  -- הסתעפות לפי התנאי not exists (.
  if not exists (
    select 1 from public.user_permissions up
    where up.user_id = v_actor and up.permission_key = 'users.manage'
  ) then raise exception 'not allowed'; end if;
  -- הסתעפות לפי התנאי not exists (select 1 from public.profiles p where p.id = target_user_id).
  if not exists (select 1 from public.profiles p where p.id = target_user_id) then
    -- עצירת הפעולה עם שגיאה כאשר התנאי בבלוק מתקיים.
    raise exception 'target user not found';
  end if;
  -- הסתעפות לפי התנאי v_scope_mode not in ('all','selected') then raise exception 'invalid scope mode'; end if;.
  if v_scope_mode not in ('all','selected') then raise exception 'invalid scope mode'; end if;

  -- הסתעפות לפי התנאי nullif(trim(coalesce(requested_profile_code,'')), '') is not null.
  if nullif(trim(coalesce(requested_profile_code,'')), '') is not null then
    select pp.id into v_profile_id
    from public.permission_profiles pp
    where pp.code = requested_profile_code and pp.is_active = true;
    -- הסתעפות לפי התנאי v_profile_id is null then raise exception 'permission profile not found'; end if;.
    if v_profile_id is null then raise exception 'permission profile not found'; end if;
  end if;

  -- הוספת רשומות ל־public.user_permission_policies בהתאם לקלט ולתנאים להלן.
  insert into public.user_permission_policies (user_id, profile_id, scope_mode, updated_by, updated_at)
  values (target_user_id, v_profile_id, v_scope_mode, v_actor, now())
  on conflict (user_id) do update set
    profile_id = excluded.profile_id,
    scope_mode = excluded.scope_mode,
    updated_by = excluded.updated_by,
    updated_at = excluded.updated_at;

  -- מחיקת הרשומות שנבחרו מתוך public.user_permission_job_type_scopes בהתאם לקלט ולתנאים להלן.
  delete from public.user_permission_job_type_scopes where user_id = target_user_id;

  -- הסתעפות לפי התנאי v_scope_mode = 'selected'.
  if v_scope_mode = 'selected' then
    -- הוספת רשומות ל־public.user_permission_job_type_scopes בהתאם לקלט ולתנאים להלן.
    insert into public.user_permission_job_type_scopes (user_id, job_type_id)
    select target_user_id, jt.id
    from public.job_types jt
    where jt.is_active = true
      and jt.id = any(coalesce(requested_job_type_ids, array[]::uuid[]))
    on conflict do nothing;
  end if;
end;
$$;

-- Generic helper for dynamic RPCs. Phase 9.2 introduces it without changing legacy RPC semantics.
-- פונקציית מסד public.has_job_type_permission: בדיקת קיום עבור סוג תפקיד.
create or replace function public.has_job_type_permission(
  requested_permission_key text,
  requested_job_type_id uuid,
  requested_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
-- הפונקציה רצה בהרשאות הבעלים; בדיקות הרשאה פנימיות והרשאות EXECUTE נבחנות בנפרד.
security definer
set search_path = public
as $$
  select
    requested_user_id is not null
    and exists (
      select 1 from public.user_permissions up
      where up.user_id = requested_user_id
        and up.permission_key = requested_permission_key
    )
    and (
      not exists (
        select 1 from public.user_permission_policies upp
        where upp.user_id = requested_user_id
          and upp.scope_mode = 'selected'
      )
      or exists (
        select 1 from public.user_permission_job_type_scopes ups
        where ups.user_id = requested_user_id
          and ups.job_type_id = requested_job_type_id
      )
    );
$$;

-- הקצאת ההרשאות המפורטות בפקודה לתפקידים המצוינים בה.
grant execute on function public.get_permission_admin_catalog() to authenticated;
-- הקצאת ההרשאות המפורטות בפקודה לתפקידים המצוינים בה.
grant execute on function public.get_user_permission_policy(uuid) to authenticated;
-- הקצאת ההרשאות המפורטות בפקודה לתפקידים המצוינים בה.
grant execute on function public.save_user_permission_policy(uuid,text,text,uuid[]) to authenticated;
-- הקצאת ההרשאות המפורטות בפקודה לתפקידים המצוינים בה.
grant execute on function public.has_job_type_permission(text,uuid,uuid) to authenticated;
