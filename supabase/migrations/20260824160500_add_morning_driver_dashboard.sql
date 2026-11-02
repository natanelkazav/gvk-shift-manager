-- קובץ: supabase/migrations/20260824160500_add_morning_driver_dashboard.sql
-- מטרה: הגדרת פעולות מסד נתונים עבור כונני בוקר.
-- מטרות עיקריות:
-- - הגדרת פונקציות: public.get_my_morning_driver_dashboard.
-- - סדר הפקודות, התנאים וההרשאות בקובץ נשמר כפי שהיה במקור.
-- =========================================================
-- Morning driver dashboard
-- Adds a dedicated personal dashboard payload for users with
-- role = morning_driver without changing the existing dashboard RPC.
-- =========================================================

-- פונקציית מסד public.get_my_morning_driver_dashboard: שליפה או חישוב של כונני בוקר.
create or replace function public.get_my_morning_driver_dashboard()
returns jsonb
language plpgsql
-- הפונקציה רצה בהרשאות הבעלים; בדיקות הרשאה פנימיות והרשאות EXECUTE נבחנות בנפרד.
security definer
set search_path = ''
as $function$
declare
  -- current_user_id — המשתמש הנוכחי הנוכחי.
  current_user_id uuid;
  current_local_timestamp timestamp;
  -- current_local_date — תאריך.
  current_local_date date;
  -- current_year — שנה.
  current_year integer;
  -- current_month — חודש.
  current_month integer;
  -- current_shift_json — משמרת.
  current_shift_json jsonb := null;
  -- next_shift_json — משמרת.
  next_shift_json jsonb := null;
  -- total_assignments — סך הכול / הקצאות.
  total_assignments integer := 0;
  -- completed_assignments — הקצאות.
  completed_assignments integer := 0;
begin
  current_user_id := auth.uid();

  -- הסתעפות לפי התנאי current_user_id is null.
  if current_user_id is null then
    -- עצירת הפעולה עם שגיאה כאשר התנאי בבלוק מתקיים.
    raise exception 'not authenticated';
  end if;

  -- הסתעפות לפי התנאי not exists (.
  if not exists (
    select 1
    from public.profiles profile
    where profile.id = current_user_id
      and profile.is_active = true
      and profile.role = 'morning_driver'::public.user_role
  ) then
    -- עצירת הפעולה עם שגיאה כאשר התנאי בבלוק מתקיים.
    raise exception 'morning driver profile not found';
  end if;

  -- הסתעפות לפי התנאי not (.
  if not (
    'dashboard.view' = any(
      coalesce(
        public.get_my_permissions(),
        array[]::text[]
      )
    )
  ) then
    -- עצירת הפעולה עם שגיאה כאשר התנאי בבלוק מתקיים.
    raise exception 'not allowed';
  end if;

  current_local_timestamp :=
    now() at time zone 'Asia/Jerusalem';

  current_local_date :=
    current_local_timestamp::date;

  current_year :=
    extract(year from current_local_date)::integer;

  current_month :=
    extract(month from current_local_date)::integer;

  with personal_assignments as (
    select
      assignment.id as assignment_id,
      assignment.schedule_period_id,
      assignment.availability_shift_id,
      assignment.assignment_slot,
      shift_item.shift_date,
      shift_item.weekday_name,
      shift_item.shift_type,
      shift_item.start_time,
      shift_item.end_time,
      (
        shift_item.shift_date +
        shift_item.start_time
      ) at time zone 'Asia/Jerusalem' as starts_at,
      (
        shift_item.shift_date +
        shift_item.end_time +
        case
          when shift_item.end_time <= shift_item.start_time
          then interval '1 day'
          else interval '0 day'
        end
      ) at time zone 'Asia/Jerusalem' as ends_at
    from public.morning_driver_schedule_assignments assignment
    join public.morning_driver_schedule_periods period
      on period.id = assignment.schedule_period_id
    join public.morning_driver_availability_shifts shift_item
      on shift_item.id = assignment.availability_shift_id
    where assignment.assigned_user_id = current_user_id
      and period.status = 'published'::public.morning_driver_schedule_period_status
  ),
  current_assignment as (
    select *
    from personal_assignments
    where starts_at <= now()
      and ends_at > now()
    order by starts_at
    limit 1
  )
  select
    jsonb_build_object(
      'assignmentId', current_assignment.assignment_id,
      'shiftDate', current_assignment.shift_date,
      'weekdayName', current_assignment.weekday_name,
      'startTime', current_assignment.start_time,
      'endTime', current_assignment.end_time,
      'shiftType', current_assignment.shift_type,
      'parallelDrivers',
        coalesce(
          (
            select jsonb_agg(
              jsonb_build_object(
                'id', profile.id,
                'displayName', profile.display_name,
                'scheduleName', profile.schedule_name
              )
              order by coalesce(
                profile.schedule_name,
                profile.display_name
              )
            )
            from public.morning_driver_schedule_assignments parallel_assignment
            join public.profiles profile
              on profile.id = parallel_assignment.assigned_user_id
            where parallel_assignment.schedule_period_id = current_assignment.schedule_period_id
              and parallel_assignment.availability_shift_id = current_assignment.availability_shift_id
              and parallel_assignment.assigned_user_id is not null
              and parallel_assignment.assigned_user_id <> current_user_id
          ),
          '[]'::jsonb
        )
    )
  into current_shift_json
  from current_assignment;

  with personal_assignments as (
    select
      assignment.id as assignment_id,
      assignment.schedule_period_id,
      assignment.availability_shift_id,
      assignment.assignment_slot,
      shift_item.shift_date,
      shift_item.weekday_name,
      shift_item.shift_type,
      shift_item.start_time,
      shift_item.end_time,
      (
        shift_item.shift_date +
        shift_item.start_time
      ) at time zone 'Asia/Jerusalem' as starts_at,
      (
        shift_item.shift_date +
        shift_item.end_time +
        case
          when shift_item.end_time <= shift_item.start_time
          then interval '1 day'
          else interval '0 day'
        end
      ) at time zone 'Asia/Jerusalem' as ends_at
    from public.morning_driver_schedule_assignments assignment
    join public.morning_driver_schedule_periods period
      on period.id = assignment.schedule_period_id
    join public.morning_driver_availability_shifts shift_item
      on shift_item.id = assignment.availability_shift_id
    where assignment.assigned_user_id = current_user_id
      and period.status = 'published'::public.morning_driver_schedule_period_status
  ),
  next_assignment as (
    select *
    from personal_assignments
    where starts_at > now()
    order by starts_at
    limit 1
  )
  select
    jsonb_build_object(
      'assignmentId', next_assignment.assignment_id,
      'shiftDate', next_assignment.shift_date,
      'weekdayName', next_assignment.weekday_name,
      'startTime', next_assignment.start_time,
      'endTime', next_assignment.end_time,
      'shiftType', next_assignment.shift_type,
      'parallelDrivers',
        coalesce(
          (
            select jsonb_agg(
              jsonb_build_object(
                'id', profile.id,
                'displayName', profile.display_name,
                'scheduleName', profile.schedule_name
              )
              order by coalesce(
                profile.schedule_name,
                profile.display_name
              )
            )
            from public.morning_driver_schedule_assignments parallel_assignment
            join public.profiles profile
              on profile.id = parallel_assignment.assigned_user_id
            where parallel_assignment.schedule_period_id = next_assignment.schedule_period_id
              and parallel_assignment.availability_shift_id = next_assignment.availability_shift_id
              and parallel_assignment.assigned_user_id is not null
              and parallel_assignment.assigned_user_id <> current_user_id
          ),
          '[]'::jsonb
        )
    )
  into next_shift_json
  from next_assignment;

  select
    count(*)::integer,
    count(*) filter (
      where (
        shift_item.shift_date +
        shift_item.end_time +
        case
          when shift_item.end_time <= shift_item.start_time
          then interval '1 day'
          else interval '0 day'
        end
      ) at time zone 'Asia/Jerusalem' <= now()
    )::integer
  into
    total_assignments,
    completed_assignments
  from public.morning_driver_schedule_assignments assignment
  join public.morning_driver_schedule_periods period
    on period.id = assignment.schedule_period_id
  join public.morning_driver_availability_shifts shift_item
    on shift_item.id = assignment.availability_shift_id
  where assignment.assigned_user_id = current_user_id
    and period.status = 'published'::public.morning_driver_schedule_period_status
    and period.year = current_year
    and period.month = current_month;

  -- הרכבת תוצאת הפעולה והחזרתה לקורא.
  return jsonb_build_object(
    'currentShift', current_shift_json,
    'nextShift', next_shift_json,
    'monthlyProgress',
      jsonb_build_object(
        'year', current_year,
        'month', current_month,
        'completed', completed_assignments,
        'total', total_assignments,
        'percentage',
          case
            when total_assignments = 0 then 0
            else round(
              (
                completed_assignments::numeric /
                total_assignments::numeric
              ) * 100,
              1
            )
          end
      )
  );
end;
$function$;

-- הסרת ההרשאות המפורטות בפקודה מהתפקידים המצוינים בה.
revoke all on function public.get_my_morning_driver_dashboard() from public;
-- הקצאת ההרשאות המפורטות בפקודה לתפקידים המצוינים בה.
grant execute on function public.get_my_morning_driver_dashboard() to authenticated;
