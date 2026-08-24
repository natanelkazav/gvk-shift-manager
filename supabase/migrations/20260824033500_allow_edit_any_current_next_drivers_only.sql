-- Extend edit_any ONLY for on-call drivers and morning drivers.
-- Dispatcher shift-change behavior is intentionally unchanged.
--
-- Current month:
--   edit_any may edit any assignment, including past dates.
-- Next month:
--   edit_any may edit any assignment only after the schedule is published.
-- Previous months / archive:
--   blocked.

create or replace function public.update_current_driver_schedule_day(
  requested_schedule_day_id uuid,
  requested_assigned_user_id uuid default null::uuid,
  requested_is_locked boolean default false,
  requested_note text default null::text
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  current_user_id uuid;
  current_permissions text[];
  target_day public.driver_schedule_days%rowtype;
  target_period public.driver_schedule_periods%rowtype;
  selected_driver public.profiles%rowtype;
  linked_availability_day_id uuid;
  selected_availability_status text;
  previous_assignment_date date;
  next_assignment_date date;
  previous_gap_days integer;
  next_gap_days integer;
  current_date_in_israel date;
  current_year integer;
  current_month integer;
  current_period_value integer;
  target_period_value integer;
  normalized_note text;
  warning_messages text[] := array[]::text[];
  final_note text;
begin
  current_user_id := auth.uid();

  if current_user_id is null then
    raise exception 'not authenticated';
  end if;

  if not exists (
    select 1
    from public.profiles
    where id = current_user_id
      and is_active = true
  ) then
    raise exception 'user not active';
  end if;

  current_permissions :=
    coalesce(
      public.get_my_permissions(),
      array[]::text[]
    );

  if not (
    'driver_schedule.edit_any' =
      any(current_permissions)
  ) then
    raise exception 'not allowed';
  end if;

  if requested_schedule_day_id is null then
    raise exception 'driver schedule day id is required';
  end if;

  current_date_in_israel :=
    (now() at time zone 'Asia/Jerusalem')::date;
  current_year :=
    extract(year from current_date_in_israel)::integer;
  current_month :=
    extract(month from current_date_in_israel)::integer;

  current_period_value :=
    current_year * 12 +
    current_month - 1;

  select *
  into target_day
  from public.driver_schedule_days
  where id = requested_schedule_day_id
  for update;

  if not found then
    raise exception 'driver schedule day not found';
  end if;

  select *
  into target_period
  from public.driver_schedule_periods
  where id = target_day.period_id
  for update;

  if not found then
    raise exception 'driver schedule period not found';
  end if;

  if target_period.status <>
    'published'::public.driver_schedule_period_status
  then
    raise exception
      'only published current or next month driver schedules can be edited';
  end if;

  target_period_value :=
    target_period.year * 12 +
    target_period.month - 1;

  if target_period_value not in (
    current_period_value,
    current_period_value + 1
  ) then
    raise exception
      'only current or next month driver schedule can be edited';
  end if;

  normalized_note :=
    nullif(trim(coalesce(requested_note, '')), '');

  if requested_assigned_user_id is null then
    update public.driver_schedule_days
    set
      assigned_user_id = null,
      assignment_source = null,
      is_locked = coalesce(requested_is_locked, false),
      notes = normalized_note,
      updated_at = now()
    where id = target_day.id
    returning *
    into target_day;

    return jsonb_build_object(
      'scheduleDayId', target_day.id,
      'periodId', target_day.period_id,
      'dutyDate', target_day.duty_date,
      'assignedUserId', null,
      'assignedUserName', null,
      'assignmentSource', null,
      'isLocked', target_day.is_locked,
      'notes', target_day.notes,
      'hasWarnings', false,
      'warnings', '[]'::jsonb
    );
  end if;

  select *
  into selected_driver
  from public.profiles
  where id = requested_assigned_user_id
    and role = 'on_call'::public.user_role
    and is_active = true;

  if not found then
    raise exception
      'selected on-call driver was not found or is inactive';
  end if;

  if exists (
    select 1
    from public.driver_schedule_days adjacent_day
    where adjacent_day.id <> target_day.id
      and adjacent_day.assigned_user_id =
        requested_assigned_user_id
      and adjacent_day.duty_date in (
        target_day.duty_date - 1,
        target_day.duty_date + 1
      )
  ) then
    warning_messages :=
      array_append(
        warning_messages,
        'לכונן קיימת כוננות ביום סמוך'
      );
  end if;

  select max(schedule_day.duty_date)
  into previous_assignment_date
  from public.driver_schedule_days schedule_day
  where schedule_day.id <> target_day.id
    and schedule_day.assigned_user_id =
      requested_assigned_user_id
    and schedule_day.duty_date < target_day.duty_date;

  select min(schedule_day.duty_date)
  into next_assignment_date
  from public.driver_schedule_days schedule_day
  where schedule_day.id <> target_day.id
    and schedule_day.assigned_user_id =
      requested_assigned_user_id
    and schedule_day.duty_date > target_day.duty_date;

  if previous_assignment_date is not null then
    previous_gap_days :=
      target_day.duty_date - previous_assignment_date;

    if previous_gap_days between 2 and 4 then
      warning_messages :=
        array_append(
          warning_messages,
          format(
            'מרווח של %s ימים בלבד מהכוננות הקודמת',
            previous_gap_days
          )
        );
    end if;
  end if;

  if next_assignment_date is not null then
    next_gap_days :=
      next_assignment_date - target_day.duty_date;

    if next_gap_days between 2 and 4 then
      warning_messages :=
        array_append(
          warning_messages,
          format(
            'מרווח של %s ימים בלבד עד הכוננות הבאה',
            next_gap_days
          )
        );
    end if;
  end if;

  if target_period.availability_period_id is not null then
    select availability_day.id
    into linked_availability_day_id
    from public.driver_availability_days availability_day
    where availability_day.period_id =
        target_period.availability_period_id
      and availability_day.availability_date =
        target_day.duty_date
    limit 1;

    if linked_availability_day_id is not null then
      select availability_entry.availability_status
      into selected_availability_status
      from public.driver_availability_entries availability_entry
      where availability_entry.period_id =
          target_period.availability_period_id
        and availability_entry.day_id =
          linked_availability_day_id
        and availability_entry.user_id =
          requested_assigned_user_id
      limit 1;

      if selected_availability_status = 'unavailable' then
        warning_messages :=
          array_append(
            warning_messages,
            'הכונן סימן שאינו זמין בתאריך זה'
          );
      elsif selected_availability_status is null then
        warning_messages :=
          array_append(
            warning_messages,
            'לא נמצא סימון זמינות של הכונן לתאריך זה'
          );
      end if;
    end if;
  end if;

  final_note :=
    concat_ws(
      E'\n',
      normalized_note,
      case
        when cardinality(warning_messages) > 0
        then
          'אזהרות: ' ||
          array_to_string(warning_messages, '; ')
        else null
      end
    );

  update public.driver_schedule_days
  set
    assigned_user_id = requested_assigned_user_id,
    assignment_source = 'manual',
    is_locked = coalesce(requested_is_locked, false),
    notes = nullif(final_note, ''),
    updated_at = now()
  where id = target_day.id
  returning *
  into target_day;

  return jsonb_build_object(
    'scheduleDayId', target_day.id,
    'periodId', target_day.period_id,
    'dutyDate', target_day.duty_date,
    'assignedUserId', target_day.assigned_user_id,
    'assignedUserName',
      coalesce(
        selected_driver.schedule_name,
        selected_driver.display_name
      ),
    'assignmentSource', target_day.assignment_source,
    'isLocked', target_day.is_locked,
    'notes', target_day.notes,
    'hasWarnings',
      cardinality(warning_messages) > 0,
    'warnings', to_jsonb(warning_messages)
  );
end;
$function$;

create or replace function public.update_morning_driver_schedule_assignment(
  requested_assignment_id uuid,
  requested_assigned_user_id uuid default null::uuid,
  requested_is_locked boolean default false,
  requested_note text default null::text
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  current_user_id uuid;
  current_permissions text[];
  target_assignment public.morning_driver_schedule_assignments%rowtype;
  target_period public.morning_driver_schedule_periods%rowtype;
  target_shift public.morning_driver_availability_shifts%rowtype;
  selected_driver public.profiles%rowtype;
  current_date_in_israel date;
  current_year integer;
  current_month integer;
  current_period_value integer;
  target_period_value integer;
  warning_messages text[] := array[]::text[];
  normalized_note text;
begin
  current_user_id := auth.uid();

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
    'morning_driver_schedule.edit_any' =
      any(current_permissions)
  ) then
    raise exception 'not allowed';
  end if;

  if requested_assignment_id is null then
    raise exception
      'morning driver schedule assignment id is required';
  end if;

  current_date_in_israel :=
    (now() at time zone 'Asia/Jerusalem')::date;
  current_year :=
    extract(year from current_date_in_israel)::integer;
  current_month :=
    extract(month from current_date_in_israel)::integer;

  current_period_value :=
    current_year * 12 +
    current_month - 1;

  select *
  into target_assignment
  from public.morning_driver_schedule_assignments assignment
  where assignment.id = requested_assignment_id
  for update;

  if not found then
    raise exception
      'morning driver schedule assignment not found';
  end if;

  select *
  into target_period
  from public.morning_driver_schedule_periods period
  where period.id = target_assignment.schedule_period_id
  for update;

  if not found then
    raise exception
      'morning driver schedule period not found';
  end if;

  if target_period.status <> 'published' then
    raise exception
      'only published current or next month morning driver schedules can be edited';
  end if;

  target_period_value :=
    target_period.year * 12 +
    target_period.month - 1;

  if target_period_value not in (
    current_period_value,
    current_period_value + 1
  ) then
    raise exception
      'only current or next month morning driver schedule can be edited';
  end if;

  select *
  into target_shift
  from public.morning_driver_availability_shifts shift_item
  where shift_item.id =
    target_assignment.availability_shift_id;

  if not found then
    raise exception
      'morning driver availability shift not found';
  end if;

  normalized_note :=
    nullif(trim(coalesce(requested_note, '')), '');

  if requested_assigned_user_id is not null then
    select *
    into selected_driver
    from public.profiles profile
    where profile.id = requested_assigned_user_id
      and profile.role =
        'morning_driver'::public.user_role
      and profile.is_active = true;

    if not found then
      raise exception
        'selected morning driver not found or inactive';
    end if;

    if exists (
      select 1
      from public.morning_driver_schedule_assignments duplicate_assignment
      where duplicate_assignment.schedule_period_id =
          target_assignment.schedule_period_id
        and duplicate_assignment.availability_shift_id =
          target_assignment.availability_shift_id
        and duplicate_assignment.id <> target_assignment.id
        and duplicate_assignment.assigned_user_id =
          requested_assigned_user_id
    ) then
      raise exception
        'driver is already assigned to this shift';
    end if;

    if exists (
      select 1
      from public.morning_driver_schedule_assignments same_day_assignment
      join public.morning_driver_availability_shifts other_shift
        on other_shift.id =
          same_day_assignment.availability_shift_id
      where same_day_assignment.schedule_period_id =
          target_assignment.schedule_period_id
        and same_day_assignment.id <> target_assignment.id
        and same_day_assignment.assigned_user_id =
          requested_assigned_user_id
        and other_shift.shift_date = target_shift.shift_date
    ) then
      warning_messages :=
        array_append(
          warning_messages,
          'הכונן כבר משובץ במשמרת אחרת באותו יום'
        );
    end if;

    if not exists (
      select 1
      from public.morning_driver_availability_entries entry
      where entry.period_id =
          target_period.availability_period_id
        and entry.shift_id = target_shift.id
        and entry.user_id = requested_assigned_user_id
        and entry.availability_status = 'available'
    ) then
      warning_messages :=
        array_append(
          warning_messages,
          'הכונן לא סימן זמינות למשמרת זו'
        );
    end if;
  end if;

  update public.morning_driver_schedule_assignments
  set
    assigned_user_id = requested_assigned_user_id,
    assignment_source =
      case
        when requested_assigned_user_id is null
        then null
        else 'manual'
      end,
    is_locked = coalesce(requested_is_locked, false),
    notes =
      nullif(
        concat_ws(
          E'\n',
          normalized_note,
          case
            when cardinality(warning_messages) > 0
            then
              'אזהרות: ' ||
              array_to_string(warning_messages, '; ')
            else null
          end
        ),
        ''
      ),
    updated_at = now()
  where id = target_assignment.id
  returning *
  into target_assignment;

  return jsonb_build_object(
    'assignmentId', target_assignment.id,
    'schedulePeriodId', target_assignment.schedule_period_id,
    'scheduleStatus', target_period.status,
    'shiftDate', target_shift.shift_date,
    'assignedUserId', target_assignment.assigned_user_id,
    'assignedUserName',
      case
        when target_assignment.assigned_user_id is null
        then null
        else coalesce(
          selected_driver.schedule_name,
          selected_driver.display_name
        )
      end,
    'assignmentSource', target_assignment.assignment_source,
    'isLocked', target_assignment.is_locked,
    'notes', target_assignment.notes,
    'hasWarnings',
      cardinality(warning_messages) > 0,
    'warnings', to_jsonb(warning_messages)
  );
end;
$function$;

notify pgrst, 'reload schema';
