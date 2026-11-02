-- קובץ: supabase/migrations/20261017040000_audit_trigger_order.sql
-- מטרה: הגדרת פעולות מסד נתונים עבור יומן שינויים.
-- מטרות עיקריות:
-- - סדר הפקודות, התנאים וההרשאות בקובץ נשמר כפי שהיה במקור.
-- Fix trigger execution order: classification must precede context snapshot.
-- PostgreSQL fires same-kind triggers in alphabetical order by trigger name.
-- Idempotent and does not modify historical audit rows.
DO $$
BEGIN
  -- הסתעפות לפי התנאי EXISTS (.
  IF EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.audit_logs'::regclass
      AND tgname = 'audit_classify_generic_action_before_insert'
      AND NOT tgisinternal
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.audit_logs'::regclass
      AND tgname = 'audit_00_classify_generic_action_before_insert'
      AND NOT tgisinternal
  ) THEN
    ALTER TRIGGER audit_classify_generic_action_before_insert
      ON public.audit_logs
      RENAME TO audit_00_classify_generic_action_before_insert;
  END IF;
  -- הסתעפות לפי התנאי NOT EXISTS (.
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.audit_logs'::regclass
      AND tgname = 'audit_00_classify_generic_action_before_insert'
      AND NOT tgisinternal
  ) THEN
    -- עצירת הפעולה עם שגיאה כאשר התנאי בבלוק מתקיים.
    RAISE EXCEPTION 'Missing audit classification trigger: apply RC44 audit classification migration first';
  END IF;
  -- הסתעפות לפי התנאי NOT EXISTS (.
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.audit_logs'::regclass
      AND tgname = 'audit_capture_context_before_insert'
      AND NOT tgisinternal
  ) THEN
    -- עצירת הפעולה עם שגיאה כאשר התנאי בבלוק מתקיים.
    RAISE EXCEPTION 'Missing audit context trigger: apply context snapshot migration first';
  END IF;
END $$;
