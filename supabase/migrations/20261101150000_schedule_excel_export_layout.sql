-- קובץ: supabase/migrations/20261101150000_schedule_excel_export_layout.sql
-- מטרה: הגדרת פעולות מסד נתונים עבור שיבוץ / Excel / ייצוא / פריסת מסך.
-- מטרות עיקריות:
-- - הגדרת פונקציות: public.get_schedule_excel_export_layout, public.save_schedule_excel_export_layout.
-- - מבני טבלאות: public.schedule_excel_export_layout.
-- - סדר הפקודות, התנאים וההרשאות בקובץ נשמר כפי שהיה במקור.
-- Central export mapping, shared across users. No changes to published schedules.
-- הגדרת מבנה הטבלה public.schedule_excel_export_layout והאילוצים המופיעים בהמשך.
create table if not exists public.schedule_excel_export_layout (
  id integer primary key default 1 check (id = 1),
  layout jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);
-- עדכון מבנה או הגדרות הטבלה public.schedule_excel_export_layout.
alter table public.schedule_excel_export_layout enable row level security;
-- הסרת ההרשאות המפורטות בפקודה מהתפקידים המצוינים בה.
revoke all on public.schedule_excel_export_layout from anon, authenticated;

-- פונקציית מסד public.get_schedule_excel_export_layout: שליפה או חישוב של שיבוץ / Excel / ייצוא / פריסת מסך.
create or replace function public.get_schedule_excel_export_layout()
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  -- הסתעפות לפי התנאי auth.uid() is null or not exists (.
  if auth.uid() is null or not exists (
    select 1 from public.user_permissions up
    where up.user_id = auth.uid() and up.permission_key = 'schedule_export.manage'
  ) then raise exception 'Not authorized to view export mapping'; end if;
  return (select layout from public.schedule_excel_export_layout where id = 1);
end $$;

-- פונקציית מסד public.save_schedule_excel_export_layout: שמירת שיבוץ / Excel / ייצוא / פריסת מסך.
create or replace function public.save_schedule_excel_export_layout(p_layout jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare
  field text;
  -- role_id — מזהה.
  role_id uuid;
begin
  -- הסתעפות לפי התנאי auth.uid() is null or not exists (.
  if auth.uid() is null or not exists (
    select 1 from public.user_permissions up
    where up.user_id = auth.uid() and up.permission_key = 'schedule_export.manage'
  ) then raise exception 'Not authorized to change export mapping'; end if;
  -- הסתעפות לפי התנאי jsonb_typeof(p_layout) is distinct from 'object'.
  if jsonb_typeof(p_layout) is distinct from 'object' then
    -- עצירת הפעולה עם שגיאה כאשר התנאי בבלוק מתקיים.
    raise exception 'Export mapping must be an object';
  end if;
  -- הסתעפות לפי התנאי (select count(*) from jsonb_object_keys(p_layout)) <> 5.
  if (select count(*) from jsonb_object_keys(p_layout)) <> 5 then
    -- עצירת הפעולה עם שגיאה כאשר התנאי בבלוק מתקיים.
    raise exception 'Export mapping must contain exactly five fields';
  end if;
  foreach field in array array['morningRowJobTypeId','eveningRowJobTypeId','nightRowJobTypeId','parallelMorningJobTypeId','dailyJobTypeId'] loop
    -- הסתעפות לפי התנאי not (p_layout ? field) or jsonb_typeof(p_layout -> field) not in ('null','string').
    if not (p_layout ? field) or jsonb_typeof(p_layout -> field) not in ('null','string') then
      -- עצירת הפעולה עם שגיאה כאשר התנאי בבלוק מתקיים.
      raise exception 'Invalid mapping field: %', field;
    end if;
    -- הסתעפות לפי התנאי jsonb_typeof(p_layout -> field) = 'string'.
    if jsonb_typeof(p_layout -> field) = 'string' then
      begin
        role_id := (p_layout ->> field)::uuid;
      exception when invalid_text_representation then
        -- עצירת הפעולה עם שגיאה כאשר התנאי בבלוק מתקיים.
        raise exception 'Invalid role UUID in field %', field;
      end;
      -- הסתעפות לפי התנאי not exists (select 1 from public.job_types where id = role_id).
      if not exists (select 1 from public.job_types where id = role_id) then
        -- עצירת הפעולה עם שגיאה כאשר התנאי בבלוק מתקיים.
        raise exception 'Unknown role in field %', field;
      end if;
    end if;
  end loop;
  -- הוספת רשומות ל־public.schedule_excel_export_layout בהתאם לקלט ולתנאים להלן.
  insert into public.schedule_excel_export_layout(id, layout, updated_at, updated_by)
  values (1, p_layout, now(), auth.uid())
  on conflict (id) do update set layout = excluded.layout,
    updated_at = excluded.updated_at, updated_by = excluded.updated_by;
end $$;
-- הסרת ההרשאות המפורטות בפקודה מהתפקידים המצוינים בה.
revoke all on function public.get_schedule_excel_export_layout() from public;
-- הסרת ההרשאות המפורטות בפקודה מהתפקידים המצוינים בה.
revoke all on function public.save_schedule_excel_export_layout(jsonb) from public;
-- הקצאת ההרשאות המפורטות בפקודה לתפקידים המצוינים בה.
grant execute on function public.get_schedule_excel_export_layout() to authenticated;
-- הקצאת ההרשאות המפורטות בפקודה לתפקידים המצוינים בה.
grant execute on function public.save_schedule_excel_export_layout(jsonb) to authenticated;
