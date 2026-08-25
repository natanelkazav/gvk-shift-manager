-- Fix morning-driver holiday context and keep full-holiday mornings out of availability views.

CREATE OR REPLACE FUNCTION public.get_my_morning_driver_availability(requested_period_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  current_user_id uuid := auth.uid();
  current_permissions text[];
  target_period public.morning_driver_availability_periods%rowtype;
  target_submission public.morning_driver_availability_submissions%rowtype;
  shifts_json jsonb;
begin
  if current_user_id is null then
    raise exception 'not authenticated';
  end if;

  if not exists (
    select 1
    from public.profiles profile
    where profile.id = current_user_id
      and profile.is_active = true
  ) then
    raise exception 'user not active';
  end if;

  current_permissions :=
    coalesce(
      public.get_my_permissions(),
      array[]::text[]
    );

  if not (
    'morning_driver_availability.view'
      = any(current_permissions)
  ) then
    raise exception 'not allowed';
  end if;

  if requested_period_id is null then
    select *
    into target_period
    from public.morning_driver_availability_periods period
    where period.status = 'open'
    order by
      period.year desc,
      period.month desc,
      period.opened_at desc nulls last
    limit 1;
  else
    select *
    into target_period
    from public.morning_driver_availability_periods period
    where period.id = requested_period_id
      and period.status in (
        'open',
        'closed',
        'archived'
      )
    limit 1;
  end if;

  if not found then
    return null;
  end if;

  select *
  into target_submission
  from public.morning_driver_availability_submissions submission
  where submission.period_id = target_period.id
    and submission.user_id = current_user_id
  limit 1;

  if not found then
    insert into public.morning_driver_availability_submissions (
      period_id,
      user_id,
      status
    )
    values (
      target_period.id,
      current_user_id,
      'draft'
    )
    returning *
    into target_submission;
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id',
          shift_item.id,
        'periodId',
          shift_item.period_id,
        'shiftDate',
          shift_item.shift_date,
        'weekdayNumber',
          shift_item.weekday_number,
        'weekdayName',
          shift_item.weekday_name,
        'shiftType',
          shift_item.shift_type,
        'startTime',
          shift_item.start_time,
        'endTime',
          shift_item.end_time,
        'minimumWorkers',
          1,

        'recommendedWorkers',
          shift_item.required_workers,
        'sortOrder',
          shift_item.sort_order,
        'holidayName',
          holiday_row.holiday_name,
        'holidayScheduleType',
          holiday_row.schedule_type,
        'availabilityStatus',
          entry.availability_status,
        'note',
          entry.note
      )
      order by
        shift_item.shift_date,
        shift_item.sort_order
    ),
    '[]'::jsonb
  )
  into shifts_json
  from public.morning_driver_availability_shifts shift_item
  left join public.morning_driver_availability_entries entry
    on entry.shift_id = shift_item.id
   and entry.user_id = current_user_id
  left join lateral (
    select
      string_agg(holiday.name, ' / ' order by holiday.name) as holiday_name,
      case
        when bool_or(holiday.schedule_type::text = 'holiday_full') then 'holiday_full'
        when bool_or(holiday.schedule_type::text = 'holiday_eve') then 'holiday_eve'
        when bool_or(holiday.schedule_type::text = 'holiday_end') then 'holiday_end'
        else max(holiday.schedule_type::text)
      end as schedule_type
    from public.holidays holiday
    where holiday.holiday_date = shift_item.shift_date
  ) holiday_row on true
  where shift_item.period_id = target_period.id
    and coalesce(holiday_row.schedule_type, '') <> 'holiday_full';

  return jsonb_build_object(
    'period',
      jsonb_build_object(
        'id',
          target_period.id,
        'year',
          target_period.year,
        'month',
          target_period.month,
        'status',
          target_period.status,
        'title',
          target_period.title,
        'instructions',
          target_period.instructions,
        'submissionDeadline',
          target_period.submission_deadline,
        'openedAt',
          target_period.opened_at,
        'closedAt',
          target_period.closed_at,
        'createdAt',
          target_period.created_at
      ),
    'submission',
      jsonb_build_object(
        'id',
          target_submission.id,
        'periodId',
          target_submission.period_id,
        'userId',
          target_submission.user_id,
        'status',
          target_submission.status,
        'submittedAt',
          target_submission.submitted_at,
        'lastSavedAt',
          target_submission.last_saved_at,
        'createdAt',
          target_submission.created_at,
        'updatedAt',
          target_submission.updated_at
      ),
    'shifts',
      shifts_json
  );
end;
$function$
;


CREATE OR REPLACE FUNCTION public.get_morning_driver_availability_management(requested_period_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  current_user_id uuid;
  current_permissions text[];

  target_period
    public.morning_driver_availability_periods%rowtype;

  drivers_json jsonb;
  submissions_json jsonb;
  shifts_json jsonb;
  entries_json jsonb;

  total_drivers integer := 0;
  submitted_drivers integer := 0;
  draft_drivers integer := 0;
  reopened_drivers integer := 0;
  not_started_drivers integer := 0;
begin
  current_user_id := auth.uid();

  if current_user_id is null then
    raise exception 'not authenticated';
  end if;

  current_permissions :=
    coalesce(
      public.get_my_permissions(),
      array[]::text[]
    );

  if not (
    'morning_driver_availability.manage'
      = any(current_permissions)
  ) then
    raise exception 'not allowed';
  end if;

  if requested_period_id is null then
    raise exception 'period id is required';
  end if;

  select *
  into target_period
  from public.morning_driver_availability_periods period
  where period.id = requested_period_id;

  if not found then
    raise exception 'morning driver availability period not found';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id',
          profile.id,

        'displayName',
          profile.display_name,

        'scheduleName',
          profile.schedule_name,

        'email',
          profile.email,

        'isActive',
          profile.is_active
      )
      order by
        coalesce(
          profile.schedule_name,
          profile.display_name
        )
    ),
    '[]'::jsonb
  )
  into drivers_json
  from public.profiles profile
  where profile.role =
      'morning_driver'::public.user_role
    and profile.is_active = true;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id',
          submission.id,

        'periodId',
          submission.period_id,

        'userId',
          submission.user_id,

        'status',
          submission.status,

        'submittedAt',
          submission.submitted_at,

        'lastSavedAt',
          submission.last_saved_at,

        'createdAt',
          submission.created_at,

        'updatedAt',
          submission.updated_at,

        'availableCount',
          (
            select count(*)
            from public.morning_driver_availability_entries entry
            where entry.period_id = target_period.id
              and entry.user_id = submission.user_id
              and entry.availability_status = 'available'
          ),

        'unavailableCount',
          (
            select count(*)
            from public.morning_driver_availability_entries entry
            where entry.period_id = target_period.id
              and entry.user_id = submission.user_id
              and entry.availability_status = 'unavailable'
          ),

        'unmarkedCount',
          (
            select count(*)
            from public.morning_driver_availability_shifts shift_item
            left join public.morning_driver_availability_entries entry
              on entry.shift_id = shift_item.id
             and entry.user_id = submission.user_id
            where shift_item.period_id = target_period.id
              and entry.id is null
          )
      )
      order by submission.created_at
    ),
    '[]'::jsonb
  )
  into submissions_json
  from public.morning_driver_availability_submissions submission
  where submission.period_id = target_period.id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id',
          shift_item.id,

        'periodId',
          shift_item.period_id,

        'shiftDate',
          shift_item.shift_date,

        'weekdayNumber',
          shift_item.weekday_number,

        'weekdayName',
          shift_item.weekday_name,

        'shiftType',
          shift_item.shift_type,

        'startTime',
          shift_item.start_time,

        'endTime',
          shift_item.end_time,

        'minimumWorkers',
          1,

        'recommendedWorkers',
          shift_item.required_workers,

        'sortOrder',
          shift_item.sort_order,

        'holidayName',
          holiday_row.holiday_name,

        'holidayScheduleType',
          holiday_row.schedule_type
      )
      order by
        shift_item.shift_date,
        shift_item.sort_order
    ),
    '[]'::jsonb
  )
  into shifts_json
  from public.morning_driver_availability_shifts shift_item
  left join lateral (
    select
      string_agg(holiday.name, ' / ' order by holiday.name) as holiday_name,
      case
        when bool_or(holiday.schedule_type::text = 'holiday_full') then 'holiday_full'
        when bool_or(holiday.schedule_type::text = 'holiday_eve') then 'holiday_eve'
        when bool_or(holiday.schedule_type::text = 'holiday_end') then 'holiday_end'
        else max(holiday.schedule_type::text)
      end as schedule_type
    from public.holidays holiday
    where holiday.holiday_date = shift_item.shift_date
  ) holiday_row on true
  where shift_item.period_id = target_period.id
    and coalesce(holiday_row.schedule_type, '') <> 'holiday_full';

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id',
          entry.id,

        'periodId',
          entry.period_id,

        'shiftId',
          entry.shift_id,

        'userId',
          entry.user_id,

        'availabilityStatus',
          entry.availability_status,

        'note',
          entry.note,

        'createdAt',
          entry.created_at,

        'updatedAt',
          entry.updated_at
      )
      order by entry.created_at
    ),
    '[]'::jsonb
  )
  into entries_json
  from public.morning_driver_availability_entries entry
  where entry.period_id = target_period.id;

  select count(*)
  into total_drivers
  from public.profiles profile
  where profile.role =
      'morning_driver'::public.user_role
    and profile.is_active = true;

  select count(*)
  into submitted_drivers
  from public.morning_driver_availability_submissions submission
  where submission.period_id = target_period.id
    and submission.status = 'submitted';

  select count(*)
  into draft_drivers
  from public.morning_driver_availability_submissions submission
  where submission.period_id = target_period.id
    and submission.status = 'draft';

  select count(*)
  into reopened_drivers
  from public.morning_driver_availability_submissions submission
  where submission.period_id = target_period.id
    and submission.status = 'reopened';

  not_started_drivers :=
    greatest(
      total_drivers
      - submitted_drivers
      - draft_drivers
      - reopened_drivers,
      0
    );

  return jsonb_build_object(
    'period',
      jsonb_build_object(
        'id',
          target_period.id,

        'year',
          target_period.year,

        'month',
          target_period.month,

        'status',
          target_period.status,

        'title',
          target_period.title,

        'instructions',
          target_period.instructions,

        'submissionDeadline',
          target_period.submission_deadline,

        'openedAt',
          target_period.opened_at,

        'closedAt',
          target_period.closed_at,

        'createdAt',
          target_period.created_at
      ),

    'drivers',
      drivers_json,

    'submissions',
      submissions_json,

    'shifts',
      shifts_json,

    'entries',
      entries_json,

    'statistics',
      jsonb_build_object(
        'totalDrivers',
          total_drivers,

        'submittedDrivers',
          submitted_drivers,

        'draftDrivers',
          draft_drivers,

        'reopenedDrivers',
          reopened_drivers,

        'notStartedDrivers',
          not_started_drivers
      )
  );
end;
$function$
;
