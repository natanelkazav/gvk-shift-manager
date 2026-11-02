-- קובץ: supabase/migrations/20260828160000_fix_dynamic_shadow_legacy_comparison.sql
-- מטרה: הגדרת פעולות מסד נתונים עבור דינמי / טיוטות שיבוץ במנגנון הדינמי.
-- מטרות עיקריות:
-- - הגדרת פונקציות: public.compare_dynamic_availability_shadow_to_legacy.
-- - סדר הפקודות, התנאים וההרשאות בקובץ נשמר כפי שהיה במקור.
begin;

-- Phase 6.1 hotfix:
-- The legacy dispatcher availability model no longer points directly to
-- schedule_shifts. It uses availability_periods + availability_shift_slots,
-- and dispatcher_availability references those slots through shift_slot_id.
-- Keep the Shadow comparison read-only and aligned with the current legacy
-- availability schema.

-- פונקציית מסד public.compare_dynamic_availability_shadow_to_legacy: השוואת דינמי / אילוצים וזמינות / טיוטות שיבוץ במנגנון הדינמי.
create or replace function public.compare_dynamic_availability_shadow_to_legacy(
  requested_job_type_id uuid,
  requested_year integer,
  requested_month integer
)
returns jsonb
language plpgsql
-- הפונקציה רצה בהרשאות הבעלים; בדיקות הרשאה פנימיות והרשאות EXECUTE נבחנות בנפרד.
security definer
set search_path=''
as $function$
declare
  -- current_user_id — המשתמש הנוכחי הנוכחי.
  current_user_id uuid := auth.uid();
  job public.job_types%rowtype;
  -- dynamic_period — דינמי / תקופה.
  dynamic_period public.dynamic_availability_periods%rowtype;
  -- legacy_period_id — מזהה התקופה.
  legacy_period_id uuid;
  -- dynamic_slots — דינמי.
  dynamic_slots integer := 0;
  -- dynamic_members — דינמי / חברי התפקיד.
  dynamic_members integer := 0;
  -- dynamic_entries — דינמי / רשומות.
  dynamic_entries integer := 0;
  legacy_slots integer := 0;
  -- legacy_entries — רשומות.
  legacy_entries integer := 0;
  -- legacy_members — חברי התפקיד.
  legacy_members integer := 0;
  supported boolean := true;
  -- note — הערה.
  note text := null;
begin
  -- הסתעפות לפי התנאי current_user_id is null.
  if current_user_id is null then
    -- עצירת הפעולה עם שגיאה כאשר התנאי בבלוק מתקיים.
    raise exception 'not authenticated';
  end if;

  -- הסתעפות לפי התנאי not exists (.
  if not exists (
    select 1
    from public.user_permissions up
    where up.user_id = current_user_id
      and up.permission_key in ('users.view', 'users.manage')
  ) then
    -- עצירת הפעולה עם שגיאה כאשר התנאי בבלוק מתקיים.
    raise exception 'not allowed';
  end if;

  select *
  into job
  from public.job_types jt
  where jt.id = requested_job_type_id;

  -- הסתעפות לפי התנאי job.id is null.
  if job.id is null then
    -- עצירת הפעולה עם שגיאה כאשר התנאי בבלוק מתקיים.
    raise exception 'job type not found';
  end if;

  select *
  into dynamic_period
  from public.dynamic_availability_periods dap
  where dap.job_type_id = job.id
    and dap.year = requested_year
    and dap.month = requested_month;

  -- הסתעפות לפי התנאי dynamic_period.id is not null.
  if dynamic_period.id is not null then
    select count(*)::integer
    into dynamic_slots
    from public.dynamic_availability_slots das
    where das.period_id = dynamic_period.id;

    select count(*)::integer
    into dynamic_members
    from public.job_type_memberships jtm
    where jtm.job_type_id = job.id;

    select count(*)::integer
    into dynamic_entries
    from public.dynamic_availability_entries dae
    join public.dynamic_availability_submissions dasub
      on dasub.id = dae.submission_id
    where dasub.period_id = dynamic_period.id;
  end if;

  -- הסתעפות לפי התנאי job.legacy_role = 'dispatcher'.
  if job.legacy_role = 'dispatcher' then
    select ap.id
    into legacy_period_id
    from public.availability_periods ap
    where ap.year = requested_year
      and ap.month = requested_month
    order by ap.created_at desc
    limit 1;

    -- הסתעפות לפי התנאי legacy_period_id is not null.
    if legacy_period_id is not null then
      select count(*)::integer
      into legacy_slots
      from public.availability_shift_slots ass
      where ass.period_id = legacy_period_id;

      select
        count(distinct da.user_id)::integer,
        count(*)::integer
      into
        legacy_members,
        legacy_entries
      from public.dispatcher_availability da
      where da.period_id = legacy_period_id;
    end if;
  else
    supported := false;
    note := 'השוואה אוטומטית מלאה ל־Legacy עבור סוג תפקיד זה תתווסף בזמן הסבת ה־flow הישן. נתוני ה־Dynamic עדיין מוצגים במלואם.';
  end if;

  -- הרכבת תוצאת הפעולה והחזרתה לקורא.
  return jsonb_build_object(
    'mode', 'shadow',
    'supported', supported,
    'legacyRole', job.legacy_role,
    'note', note,
    'dynamic', jsonb_build_object(
      'slots', dynamic_slots,
      'members', dynamic_members,
      'entries', dynamic_entries
    ),
    'legacy', jsonb_build_object(
      'slots', legacy_slots,
      'members', legacy_members,
      'entries', legacy_entries
    ),
    'slotDelta', dynamic_slots - legacy_slots,
    'memberDelta', dynamic_members - legacy_members,
    'entryDelta', dynamic_entries - legacy_entries
  );
end;
$function$;

-- הסרת ההרשאות המפורטות בפקודה מהתפקידים המצוינים בה.
revoke all on function public.compare_dynamic_availability_shadow_to_legacy(uuid, integer, integer) from public;
-- הקצאת ההרשאות המפורטות בפקודה לתפקידים המצוינים בה.
grant execute on function public.compare_dynamic_availability_shadow_to_legacy(uuid, integer, integer) to authenticated;

commit;
