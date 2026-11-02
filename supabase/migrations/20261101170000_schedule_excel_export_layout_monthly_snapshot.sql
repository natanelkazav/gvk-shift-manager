-- קובץ: supabase/migrations/20261101170000_schedule_excel_export_layout_monthly_snapshot.sql
-- מטרה: הגדרת פעולות מסד נתונים עבור שיבוץ / Excel / ייצוא / פריסת מסך.
-- מטרות עיקריות:
-- - הגדרת פונקציות: public.capture_schedule_excel_export_layout_snapshot.
-- - מבני טבלאות: public.schedule_excel_export_layout_monthly_snapshots.
-- - סדר הפקודות, התנאים וההרשאות בקובץ נשמר כפי שהיה במקור.
-- Immutable monthly mapping snapshots for the archive. Does not alter live layout.
-- הגדרת מבנה הטבלה public.schedule_excel_export_layout_monthly_snapshots והאילוצים המופיעים בהמשך.
create table if not exists public.schedule_excel_export_layout_monthly_snapshots (
  year integer not null check (year between 2020 and 2100),
  month integer not null check (month between 1 and 12),
  layout jsonb not null,
  captured_at timestamptz not null default now(),
  primary key (year, month)
);
-- עדכון מבנה או הגדרות הטבלה public.schedule_excel_export_layout_monthly_snapshots.
alter table public.schedule_excel_export_layout_monthly_snapshots enable row level security;
-- הסרת ההרשאות המפורטות בפקודה מהתפקידים המצוינים בה.
revoke all on public.schedule_excel_export_layout_monthly_snapshots from anon, authenticated;

-- Called by a trusted server process using the service-role key only.
-- The ON CONFLICT DO NOTHING policy deliberately prevents historical drift.
-- פונקציית מסד public.capture_schedule_excel_export_layout_snapshot: שיבוץ / Excel / ייצוא / פריסת מסך.
create or replace function public.capture_schedule_excel_export_layout_snapshot(
  p_year integer, p_month integer
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_layout jsonb;
begin
  -- הסתעפות לפי התנאי auth.role() is distinct from 'service_role'.
  if auth.role() is distinct from 'service_role' then
    -- עצירת הפעולה עם שגיאה כאשר התנאי בבלוק מתקיים.
    raise exception 'Only the archive service can capture monthly layout';
  end if;
  -- הסתעפות לפי התנאי p_year not between 2020 and 2100 or p_month not between 1 and 12.
  if p_year not between 2020 and 2100 or p_month not between 1 and 12 then
    -- עצירת הפעולה עם שגיאה כאשר התנאי בבלוק מתקיים.
    raise exception 'Invalid archive month';
  end if;
  select layout into v_layout from public.schedule_excel_export_layout where id = 1;
  -- הסתעפות לפי התנאי v_layout is null.
  if v_layout is null then
    -- עצירת הפעולה עם שגיאה כאשר התנאי בבלוק מתקיים.
    raise exception 'No central Excel export layout has been saved';
  end if;
  -- הוספת רשומות ל־public.schedule_excel_export_layout_monthly_snapshots בהתאם לקלט ולתנאים להלן.
  insert into public.schedule_excel_export_layout_monthly_snapshots(year, month, layout)
  values (p_year, p_month, v_layout)
  on conflict (year, month) do nothing;
  select layout into v_layout from public.schedule_excel_export_layout_monthly_snapshots
  where year = p_year and month = p_month;
  return v_layout;
end $$;
-- הסרת ההרשאות המפורטות בפקודה מהתפקידים המצוינים בה.
revoke all on function public.capture_schedule_excel_export_layout_snapshot(integer, integer) from public, anon, authenticated;
-- הקצאת ההרשאות המפורטות בפקודה לתפקידים המצוינים בה.
grant execute on function public.capture_schedule_excel_export_layout_snapshot(integer, integer) to service_role;
