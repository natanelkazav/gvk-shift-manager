-- קובץ: supabase/migrations/20260925200500_fix_shadow_target_as_much_as_possible_scope.sql
-- מטרה: הגדרת פעולות מסד נתונים עבור טיוטות שיבוץ במנגנון הדינמי / יעד.
-- מטרות עיקריות:
-- - מבני טבלאות: public.dynamic_schedule_shadow_targets.
-- - סדר הפקודות, התנאים וההרשאות בקובץ נשמר כפי שהיה במקור.
begin;

-- Flexible job-type memberships support three per-member employment scopes:
-- full_time, part_time and as_much_as_possible. Shadow targets still carried
-- the older Phase 7.1 constraint that only accepted the first two values,
-- causing draft creation to fail when a member selected "as much as possible".
-- עדכון מבנה או הגדרות הטבלה public.dynamic_schedule_shadow_targets.
alter table public.dynamic_schedule_shadow_targets
  drop constraint if exists dynamic_schedule_shadow_targets_employment_scope_valid;

-- עדכון מבנה או הגדרות הטבלה public.dynamic_schedule_shadow_targets.
alter table public.dynamic_schedule_shadow_targets
  add constraint dynamic_schedule_shadow_targets_employment_scope_valid
  check (
    employment_scope is null
    or employment_scope in ('full_time', 'part_time', 'as_much_as_possible')
  );

commit;
