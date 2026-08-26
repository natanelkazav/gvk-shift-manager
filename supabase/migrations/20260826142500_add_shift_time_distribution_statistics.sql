-- ============================================================
-- GVK Shift Manager
-- Shift-time distribution statistics for stacked bar charts.
--
-- Read-only statistics RPC:
-- - Dispatchers: actual published/archived schedule times.
-- - Morning drivers: actual published/archived schedule times,
--   including per-draft/per-schedule time overrides.
-- ============================================================

create or replace function public.get_shift_time_distribution_statistics(
  requested_year integer default null,
  requested_month integer default null
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  current_user_id uuid := auth.uid();
  current_permissions text[];
  dispatcher_rows jsonb;
  morning_driver_rows jsonb;
begin
  if current_user_id is null then
    raise exception 'not authenticated';
  end if;

  if not exists (
    select 1
    from public.profiles profile_row
    where profile_row.id = current_user_id
      and profile_row.is_active = true
  ) then
    raise exception 'user not active';
  end if;

  current_permissions :=
    coalesce(public.get_my_permissions(), array[]::text[]);

  if not (
    'statistics.view' = any(current_permissions)
    or 'users.manage' = any(current_permissions)
  ) then
    raise exception 'not allowed';
  end if;

  if requested_year is not null
    and (requested_year < 2020 or requested_year > 2100)
  then
    raise exception 'statistics year is invalid';
  end if;

  if requested_month is not null
    and (requested_month < 1 or requested_month > 12)
  then
    raise exception 'statistics month is invalid';
  end if;

  if requested_month is not null
    and requested_year is null
  then
    raise exception 'statistics year is required when month is selected';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'userId', row_data.user_id,
        'displayName', row_data.display_name,
        'scheduleName', row_data.schedule_name,
        'shiftTime', row_data.shift_time,
        'shiftCount', row_data.shift_count
      )
      order by row_data.display_name, row_data.shift_time
    ),
    '[]'::jsonb
  )
  into dispatcher_rows
  from (
    select
      profile_row.id as user_id,
      profile_row.display_name,
      profile_row.schedule_name,
      concat(
        to_char(
          (schedule_shift.starts_at at time zone 'Asia/Jerusalem')::time,
          'HH24:MI'
        ),
        '–',
        to_char(
          (schedule_shift.ends_at at time zone 'Asia/Jerusalem')::time,
          'HH24:MI'
        )
      ) as shift_time,
      count(*)::integer as shift_count
    from public.schedule_shifts schedule_shift
    join public.schedule_periods schedule_period
      on schedule_period.id = schedule_shift.period_id
    join public.profiles profile_row
      on profile_row.id = schedule_shift.assigned_user_id
    where profile_row.role = 'dispatcher'
      and schedule_shift.assigned_user_id is not null
      and schedule_period.status in (
        'published'::public.schedule_period_status,
        'archived'::public.schedule_period_status
      )
      and (
        requested_year is null
        or schedule_period.year = requested_year
      )
      and (
        requested_month is null
        or schedule_period.month = requested_month
      )
    group by
      profile_row.id,
      profile_row.display_name,
      profile_row.schedule_name,
      shift_time
  ) row_data;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'userId', row_data.user_id,
        'displayName', row_data.display_name,
        'scheduleName', row_data.schedule_name,
        'shiftTime', row_data.shift_time,
        'shiftCount', row_data.shift_count
      )
      order by row_data.display_name, row_data.shift_time
    ),
    '[]'::jsonb
  )
  into morning_driver_rows
  from (
    select
      profile_row.id as user_id,
      profile_row.display_name,
      profile_row.schedule_name,
      concat(
        to_char(
          coalesce(
            assignment.scheduled_start_time,
            shift_item.start_time
          ),
          'HH24:MI'
        ),
        '–',
        to_char(
          coalesce(
            assignment.scheduled_end_time,
            shift_item.end_time
          ),
          'HH24:MI'
        )
      ) as shift_time,
      count(*)::integer as shift_count
    from public.morning_driver_schedule_assignments assignment
    join public.morning_driver_schedule_periods schedule_period
      on schedule_period.id = assignment.schedule_period_id
    join public.morning_driver_availability_shifts shift_item
      on shift_item.id = assignment.availability_shift_id
    join public.profiles profile_row
      on profile_row.id = assignment.assigned_user_id
    where profile_row.role = 'morning_driver'
      and assignment.assigned_user_id is not null
      and schedule_period.status::text in (
        'published',
        'archived'
      )
      and (
        requested_year is null
        or schedule_period.year = requested_year
      )
      and (
        requested_month is null
        or schedule_period.month = requested_month
      )
    group by
      profile_row.id,
      profile_row.display_name,
      profile_row.schedule_name,
      shift_time
  ) row_data;

  return jsonb_build_object(
    'dispatchers', dispatcher_rows,
    'morningDrivers', morning_driver_rows,
    'generatedAt', now()
  );
end;
$function$;

grant execute
on function public.get_shift_time_distribution_statistics(integer, integer)
to authenticated;
