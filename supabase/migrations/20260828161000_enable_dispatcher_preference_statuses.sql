-- קובץ: supabase/migrations/20260828161000_enable_dispatcher_preference_statuses.sql
-- מטרה: הגדרת פעולות מסד נתונים עבור מוקדנים.
-- מטרות עיקריות:
-- - סדר הפקודות, התנאים וההרשאות בקובץ נשמר כפי שהיה במקור.
-- Phase 6.1 hotfix: expose the full dynamic availability scale for dispatchers.
-- The Shadow UI and optimizer already support preferred/avoid, but the original
-- dispatcher seed kept only available/unavailable in availability_config.statuses.
-- Preserve every other availability setting exactly as configured by the admin.

-- עדכון רשומות ב־public.job_types בהתאם לקלט ולתנאים להלן.
update public.job_types
set
  availability_config = jsonb_set(
    coalesce(availability_config, '{}'::jsonb),
    '{statuses}',
    '["available","preferred","avoid","unavailable"]'::jsonb,
    true
  ),
  updated_at = now()
where code = 'dispatcher';
