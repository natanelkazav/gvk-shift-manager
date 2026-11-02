-- קובץ: supabase/migrations/20261001231500_fix_no_work_structure_materialization_constraint.sql
-- מטרה: הגדרת פעולות מסד נתונים עבור מימוש תצורת השיבוץ לחודש.
-- מטרות עיקריות:
-- - מבני טבלאות: public.job_type_schedule_materializations.
-- - סדר הפקודות, התנאים וההרשאות בקובץ נשמר כפי שהיה במקור.
begin;

-- The original materialization table uses the *_work_mode_valid constraint name.
-- "none" is a valid work mode for capability-only roles such as Activity Tracking.
-- עדכון מבנה או הגדרות הטבלה public.job_type_schedule_materializations.
alter table public.job_type_schedule_materializations
  drop constraint if exists job_type_schedule_materializations_work_mode_check;

-- עדכון מבנה או הגדרות הטבלה public.job_type_schedule_materializations.
alter table public.job_type_schedule_materializations
  drop constraint if exists job_type_schedule_materializations_work_mode_valid;

-- עדכון מבנה או הגדרות הטבלה public.job_type_schedule_materializations.
alter table public.job_type_schedule_materializations
  add constraint job_type_schedule_materializations_work_mode_valid
  check (work_mode in ('none','shifts','on_call_hourly','on_call_daily'));

comment on constraint job_type_schedule_materializations_work_mode_valid
  on public.job_type_schedule_materializations is
  'Allows scheduling work modes plus none for job types that use capabilities without a schedule.';

commit;
