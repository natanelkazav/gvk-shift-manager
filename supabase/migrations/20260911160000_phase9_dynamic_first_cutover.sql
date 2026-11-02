-- קובץ: supabase/migrations/20260911160000_phase9_dynamic_first_cutover.sql
-- מטרה: הגדרת פעולות מסד נתונים עבור דינמי / מעבר למנגנון הדינמי.
-- מטרות עיקריות:
-- - הגדרת פונקציות: public.get_dynamic_cutover_state, public.set_dynamic_cutover_state.
-- - מבני טבלאות: public.dynamic_cutover_settings.
-- - סדר הפקודות, התנאים וההרשאות בקובץ נשמר כפי שהיה במקור.
-- Phase 9.0: central Dynamic-first pilot cutover switch.
-- הגדרת מבנה הטבלה public.dynamic_cutover_settings והאילוצים המופיעים בהמשך.
create table if not exists public.dynamic_cutover_settings (
  singleton boolean primary key default true check (singleton),
  dynamic_first_enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid null references public.profiles(id)
);

-- הוספת רשומות ל־public.dynamic_cutover_settings בהתאם לקלט ולתנאים להלן.
insert into public.dynamic_cutover_settings(singleton, dynamic_first_enabled)
values (true, false)
on conflict (singleton) do nothing;

-- עדכון מבנה או הגדרות הטבלה public.dynamic_cutover_settings.
alter table public.dynamic_cutover_settings enable row level security;
-- הסרת ההרשאות המפורטות בפקודה מהתפקידים המצוינים בה.
revoke all on public.dynamic_cutover_settings from anon, authenticated;

drop function if exists public.get_dynamic_cutover_state();
-- פונקציית מסד public.get_dynamic_cutover_state: שליפה או חישוב של דינמי / מעבר למנגנון הדינמי / מצב.
create function public.get_dynamic_cutover_state()
returns jsonb
language plpgsql security definer set search_path=public
as $$
declare v_enabled boolean := false; v_user uuid := auth.uid(); v_has_membership boolean := false;
begin
  select dynamic_first_enabled into v_enabled from public.dynamic_cutover_settings where singleton=true;
  -- הסתעפות לפי התנאי v_user is not null.
  if v_user is not null then
    select exists(
      select 1 from public.job_type_memberships m
      join public.job_types jt on jt.id=m.job_type_id and jt.is_active=true
      where m.user_id=v_user
    ) into v_has_membership;
  end if;
  -- הרכבת תוצאת הפעולה והחזרתה לקורא.
  return jsonb_build_object(
    'dynamicFirstEnabled', coalesce(v_enabled,false),
    'hasDynamicMembership', v_has_membership,
    'useDynamicRuntime', coalesce(v_enabled,false) and v_has_membership
  );
end $$;
-- הקצאת ההרשאות המפורטות בפקודה לתפקידים המצוינים בה.
grant execute on function public.get_dynamic_cutover_state() to authenticated;

drop function if exists public.set_dynamic_cutover_state(boolean);
-- פונקציית מסד public.set_dynamic_cutover_state: קביעת קבוצה ייחודית / דינמי / מעבר למנגנון הדינמי / מצב.
create function public.set_dynamic_cutover_state(p_enabled boolean)
returns jsonb
language plpgsql security definer set search_path=public
as $$
declare v_user uuid := auth.uid();
begin
  -- הסתעפות לפי התנאי v_user is null then raise exception 'not authenticated'; end if;.
  if v_user is null then raise exception 'not authenticated'; end if;
  -- הסתעפות לפי התנאי not exists(select 1 from public.user_permissions up where up.user_id=v_user and up.permission_key='users.manage').
  if not exists(select 1 from public.user_permissions up where up.user_id=v_user and up.permission_key='users.manage') then
    -- עצירת הפעולה עם שגיאה כאשר התנאי בבלוק מתקיים.
    raise exception 'not allowed';
  end if;
  -- הוספת רשומות ל־public.dynamic_cutover_settings בהתאם לקלט ולתנאים להלן.
  insert into public.dynamic_cutover_settings(singleton,dynamic_first_enabled,updated_at,updated_by)
  values(true,p_enabled,now(),v_user)
  on conflict(singleton) do update set dynamic_first_enabled=excluded.dynamic_first_enabled,updated_at=now(),updated_by=v_user;
  return public.get_dynamic_cutover_state();
end $$;
-- הקצאת ההרשאות המפורטות בפקודה לתפקידים המצוינים בה.
grant execute on function public.set_dynamic_cutover_state(boolean) to authenticated;
