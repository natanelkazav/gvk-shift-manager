-- Morning-driver draft coverage priority and explicit unassigned support

alter table public.morning_driver_schedule_assignments
  add column if not exists is_intentionally_unassigned boolean not null default false;

CREATE OR REPLACE FUNCTION public.create_morning_driver_schedule_draft(requested_availability_period_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
declare
  current_user_id uuid := auth.uid();
  current_permissions text[];
  availability_period public.morning_driver_availability_periods%rowtype;
  schedule_period public.morning_driver_schedule_periods%rowtype;
  current_shift public.morning_driver_availability_shifts%rowtype;
  candidate_user_id uuid;
  slot_number integer;
  created_assignments integer := 0;
  assigned_assignments integer := 0;
  warning_count integer := 0;
begin
  if current_user_id is null then
    raise exception 'not authenticated';
  end if;

  current_permissions := coalesce(public.get_my_permissions(), array[]::text[]);
  if not ('morning_driver_schedule.edit' = any(current_permissions)) then
    raise exception 'not allowed';
  end if;

  select * into availability_period
  from public.morning_driver_availability_periods period
  where period.id = requested_availability_period_id
  for update;

  if not found then
    raise exception 'morning driver availability period not found';
  end if;
  if availability_period.status <> 'closed' then
    raise exception 'availability period must be closed before scheduling';
  end if;

  insert into public.morning_driver_schedule_periods (
    year, month, status, availability_period_id, title, created_by, updated_by
  ) values (
    availability_period.year,
    availability_period.month,
    'draft',
    availability_period.id,
    coalesce(availability_period.title, format('לוח כונני בוקר %s/%s', availability_period.month, availability_period.year)),
    current_user_id,
    current_user_id
  )
  on conflict (availability_period_id)
  do update set updated_by = excluded.updated_by, updated_at = now()
  returning * into schedule_period;

  delete from public.morning_driver_schedule_assignments assignment
  where assignment.schedule_period_id = schedule_period.id
    and assignment.is_locked = false;

  /*
   * Two-pass scheduler:
   * Pass 1 fills the minimum slot of EVERY shift first.
   * Pass 2 fills only recommended extra slots.
   * This prevents a second driver from consuming availability while another
   * shift is still left without its minimum morning driver.
   */
  for slot_number in 1..2 loop
    for current_shift in
      select *
      from public.morning_driver_availability_shifts shift_item
      where shift_item.period_id = availability_period.id
        and least(greatest(coalesce(shift_item.required_workers, 1), 1), 2) >= slot_number
      order by shift_item.shift_date, shift_item.sort_order
    loop
      candidate_user_id := null;

      select candidate.id
      into candidate_user_id
      from public.profiles candidate
      where candidate.role = 'morning_driver'::public.user_role
        and candidate.is_active = true
        and exists (
          select 1
          from public.morning_driver_availability_entries entry
          where entry.period_id = availability_period.id
            and entry.shift_id = current_shift.id
            and entry.user_id = candidate.id
            and entry.availability_status = 'available'
        )
        and not exists (
          select 1
          from public.morning_driver_schedule_assignments same_shift
          where same_shift.schedule_period_id = schedule_period.id
            and same_shift.availability_shift_id = current_shift.id
            and same_shift.assigned_user_id = candidate.id
        )
        and not exists (
          select 1
          from public.morning_driver_schedule_assignments same_day
          join public.morning_driver_availability_shifts other_shift
            on other_shift.id = same_day.availability_shift_id
          where same_day.schedule_period_id = schedule_period.id
            and same_day.assigned_user_id = candidate.id
            and other_shift.shift_date = current_shift.shift_date
        )
      order by
        (
          select count(*)
          from public.morning_driver_schedule_assignments existing_assignment
          where existing_assignment.schedule_period_id = schedule_period.id
            and existing_assignment.assigned_user_id = candidate.id
        ) asc,
        candidate.id
      limit 1;

      insert into public.morning_driver_schedule_assignments (
        schedule_period_id,
        availability_shift_id,
        assignment_slot,
        assigned_user_id,
        assignment_source,
        is_locked,
        is_intentionally_unassigned,
        notes
      ) values (
        schedule_period.id,
        current_shift.id,
        slot_number,
        candidate_user_id,
        case when candidate_user_id is null then null else 'automatic' end,
        false,
        false,
        case
          when candidate_user_id is null and slot_number = 1
            then 'לא נמצא כונן זמין למינימום הנדרש.'
          when candidate_user_id is null and slot_number > 1
            then 'לא נמצא כונן נוסף להשלמת ההמלצה.'
          else null
        end
      )
      on conflict (schedule_period_id, availability_shift_id, assignment_slot)
      do update set
        assigned_user_id = case
          when public.morning_driver_schedule_assignments.is_locked
            then public.morning_driver_schedule_assignments.assigned_user_id
          else excluded.assigned_user_id
        end,
        assignment_source = case
          when public.morning_driver_schedule_assignments.is_locked
            then public.morning_driver_schedule_assignments.assignment_source
          else excluded.assignment_source
        end,
        is_intentionally_unassigned = case
          when public.morning_driver_schedule_assignments.is_locked
            then public.morning_driver_schedule_assignments.is_intentionally_unassigned
          else false
        end,
        notes = case
          when public.morning_driver_schedule_assignments.is_locked
            then public.morning_driver_schedule_assignments.notes
          else excluded.notes
        end,
        updated_at = now();

      created_assignments := created_assignments + 1;
      if candidate_user_id is null then
        warning_count := warning_count + 1;
      else
        assigned_assignments := assigned_assignments + 1;
      end if;
    end loop;
  end loop;

  return jsonb_build_object(
    'schedulePeriodId', schedule_period.id,
    'year', schedule_period.year,
    'month', schedule_period.month,
    'status', schedule_period.status,
    'createdAssignments', created_assignments,
    'assignedAssignments', assigned_assignments,
    'warningCount', warning_count
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.update_morning_driver_schedule_assignment(requested_assignment_id uuid, requested_assigned_user_id uuid DEFAULT NULL::uuid, requested_is_locked boolean DEFAULT false, requested_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  current_user_id uuid;
  current_permissions text[];

  target_assignment
    public.morning_driver_schedule_assignments%rowtype;

  target_period
    public.morning_driver_schedule_periods%rowtype;

  target_shift
    public.morning_driver_availability_shifts%rowtype;

  selected_driver
    public.profiles%rowtype;

  warning_messages text[] :=
    array[]::text[];

  normalized_note text;
begin
  current_user_id :=
    auth.uid();

  if current_user_id is null then
    raise exception
      'not authenticated';
  end if;

  if not exists (
    select 1
    from public.profiles profile
    where profile.id =
      current_user_id
      and profile.is_active = true
  ) then
    raise exception
      'user not active';
  end if;

  current_permissions :=
    coalesce(
      public.get_my_permissions(),
      array[]::text[]
    );

  if not (
    'morning_driver_schedule.edit' =
      any(current_permissions)
  ) then
    raise exception
      'not allowed';
  end if;

  if requested_assignment_id is null then
    raise exception
      'morning driver schedule assignment id is required';
  end if;

  select *
  into target_assignment
  from public.morning_driver_schedule_assignments
    assignment
  where assignment.id =
    requested_assignment_id
  for update;

  if not found then
    raise exception
      'morning driver schedule assignment not found';
  end if;

  select *
  into target_period
  from public.morning_driver_schedule_periods
    period
  where period.id =
    target_assignment.schedule_period_id
  for update;

  if not found then
    raise exception
      'morning driver schedule period not found';
  end if;

  /*
   * Managers with the edit permission may correct both
   * draft and already-published schedules.
   *
   * Archived historical schedules stay read-only.
   */
  if target_period.status not in (
    'draft',
    'published'
  ) then
    raise exception
      'only draft or published schedules can be edited';
  end if;

  select *
  into target_shift
  from public.morning_driver_availability_shifts
    shift_item
  where shift_item.id =
    target_assignment.availability_shift_id;

  if not found then
    raise exception
      'morning driver availability shift not found';
  end if;

  normalized_note :=
    nullif(
      trim(
        coalesce(
          requested_note,
          ''
        )
      ),
      ''
    );

  if requested_assigned_user_id is not null then
    select *
    into selected_driver
    from public.profiles profile
    where profile.id =
        requested_assigned_user_id
      and profile.role =
        'morning_driver'
          ::public.user_role
      and profile.is_active =
        true;

    if not found then
      raise exception
        'selected morning driver not found or inactive';
    end if;

    /*
     * Do not assign the same morning driver twice
     * to different slots of the same shift.
     */
    if exists (
      select 1
      from public.morning_driver_schedule_assignments
        duplicate_assignment
      where duplicate_assignment.schedule_period_id =
          target_assignment.schedule_period_id
        and duplicate_assignment.availability_shift_id =
          target_assignment.availability_shift_id
        and duplicate_assignment.id <>
          target_assignment.id
        and duplicate_assignment.assigned_user_id =
          requested_assigned_user_id
    ) then
      raise exception
        'driver is already assigned to this shift';
    end if;

    /*
     * Same-day assignment is kept as a warning,
     * matching the existing behavior.
     */
    if exists (
      select 1
      from public.morning_driver_schedule_assignments
        same_day_assignment
      join public.morning_driver_availability_shifts
        other_shift
        on other_shift.id =
          same_day_assignment.availability_shift_id
      where same_day_assignment.schedule_period_id =
          target_assignment.schedule_period_id
        and same_day_assignment.id <>
          target_assignment.id
        and same_day_assignment.assigned_user_id =
          requested_assigned_user_id
        and other_shift.shift_date =
          target_shift.shift_date
    ) then
      warning_messages :=
        array_append(
          warning_messages,
          'הכונן כבר משובץ במשמרת אחרת באותו יום'
        );
    end if;

    /*
     * Availability remains a warning for manual manager edits,
     * rather than a hard blocker.
     */
    if not exists (
      select 1
      from public.morning_driver_availability_entries
        entry
      where entry.period_id =
          target_period.availability_period_id
        and entry.shift_id =
          target_shift.id
        and entry.user_id =
          requested_assigned_user_id
        and entry.availability_status =
          'available'
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
    assigned_user_id =
      requested_assigned_user_id,

    assignment_source =
      case
        when requested_assigned_user_id
          is null
        then null

        else 'manual'
      end,

    is_intentionally_unassigned =
      case
        when requested_assigned_user_id is not null
        then false
        else coalesce(
          target_assignment.is_intentionally_unassigned,
          false
        )
      end,

    is_locked =
      coalesce(
        requested_is_locked,
        false
      ),

    notes =
      nullif(
        concat_ws(
          E'\n',
          normalized_note,
          case
            when cardinality(
              warning_messages
            ) > 0
            then
              'אזהרות: '
              ||
              array_to_string(
                warning_messages,
                '; '
              )

            else null
          end
        ),
        ''
      ),

    updated_at =
      now()

  where id =
    target_assignment.id

  returning *
  into target_assignment;

  return jsonb_build_object(
    'assignmentId',
      target_assignment.id,

    'schedulePeriodId',
      target_assignment.schedule_period_id,

    'scheduleStatus',
      target_period.status,

    'shiftDate',
      target_shift.shift_date,

    'assignedUserId',
      target_assignment.assigned_user_id,

    'assignedUserName',
      case
        when target_assignment.assigned_user_id
          is null
        then null

        else coalesce(
          selected_driver.schedule_name,
          selected_driver.display_name
        )
      end,

    'assignmentSource',
      target_assignment.assignment_source,

    'isLocked',
      target_assignment.is_locked,

    'notes',
      target_assignment.notes,

    'hasWarnings',
      cardinality(
        warning_messages
      ) > 0,

    'warnings',
      to_jsonb(
        warning_messages
      )
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.set_morning_driver_assignment_intentionally_unassigned(
  requested_assignment_id uuid,
  requested_is_intentionally_unassigned boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
declare
  current_user_id uuid := auth.uid();
  current_permissions text[];
  target_assignment public.morning_driver_schedule_assignments%rowtype;
  target_period public.morning_driver_schedule_periods%rowtype;
begin
  if current_user_id is null then raise exception 'not authenticated'; end if;
  current_permissions := coalesce(public.get_my_permissions(), array[]::text[]);
  if not ('morning_driver_schedule.edit' = any(current_permissions)) then raise exception 'not allowed'; end if;

  select * into target_assignment
  from public.morning_driver_schedule_assignments assignment
  where assignment.id = requested_assignment_id
  for update;
  if not found then raise exception 'morning driver schedule assignment not found'; end if;

  select * into target_period
  from public.morning_driver_schedule_periods period
  where period.id = target_assignment.schedule_period_id
  for update;
  if target_period.status <> 'draft' then raise exception 'only draft schedules can mark intentionally unassigned shifts'; end if;
  if target_assignment.assignment_slot <> 1 then raise exception 'only minimum morning driver slot can be intentionally unassigned'; end if;
  if coalesce(requested_is_intentionally_unassigned, false) and target_assignment.assigned_user_id is not null then
    raise exception 'assigned morning driver slot cannot be marked intentionally unassigned';
  end if;

  update public.morning_driver_schedule_assignments
  set is_intentionally_unassigned = coalesce(requested_is_intentionally_unassigned, false),
      updated_at = now()
  where id = target_assignment.id
  returning * into target_assignment;

  return jsonb_build_object(
    'assignmentId', target_assignment.id,
    'isIntentionallyUnassigned', target_assignment.is_intentionally_unassigned
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_morning_driver_schedule(requested_schedule_period_id uuid DEFAULT NULL::uuid, requested_year integer DEFAULT NULL::integer, requested_month integer DEFAULT NULL::integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  current_user_id uuid;

  current_permissions text[];

  schedule_period
    public.morning_driver_schedule_periods%rowtype;

  can_view_team boolean;

  can_edit boolean;

  can_view_personal boolean;

  drivers_json jsonb;

  assignments_json jsonb;

  total_assignments integer := 0;

  assigned_assignments integer := 0;

  minimum_unfilled integer := 0;

  recommendation_unfilled integer := 0;

  intentionally_unassigned_minimum integer := 0;
begin
  current_user_id :=
    auth.uid();

  if current_user_id is null then
    raise exception
      'not authenticated';
  end if;

  current_permissions :=
    coalesce(
      public.get_my_permissions(),
      array[]::text[]
    );

  can_view_personal :=
    'morning_driver_schedule.view'
      = any(current_permissions);

  can_view_team :=
    'morning_driver_schedule.view_team'
      = any(current_permissions);

  can_edit :=
    'morning_driver_schedule.edit'
      = any(current_permissions)
    or
    'morning_driver_schedule.edit_any'
      = any(current_permissions);

  if not (
    can_view_personal
    or can_view_team
    or can_edit
  ) then
    raise exception
      'not allowed';
  end if;

  if requested_schedule_period_id
    is not null
  then
    select *
    into schedule_period
    from public.morning_driver_schedule_periods period
    where period.id =
      requested_schedule_period_id;

  elsif requested_year is not null
    and requested_month is not null
  then
    select *
    into schedule_period
    from public.morning_driver_schedule_periods period
    where period.year =
      requested_year
      and period.month =
        requested_month
    limit 1;

  else
    select *
    into schedule_period
    from public.morning_driver_schedule_periods period
    order by
      period.year desc,
      period.month desc
    limit 1;
  end if;

  if not found then
    return null;
  end if;

  select
    coalesce(
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
  into
    drivers_json
  from public.profiles profile
  where profile.role =
      'morning_driver'
        ::public.user_role
    and (
      profile.is_active = true
      or exists (
        select 1
        from public.morning_driver_schedule_assignments historical_assignment
        where historical_assignment.schedule_period_id = schedule_period.id
          and historical_assignment.assigned_user_id = profile.id
      )
    );

  select
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id',
            assignment.id,

          'schedulePeriodId',
            assignment.schedule_period_id,

          'availabilityShiftId',
            shift_item.id,

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

          /*
           * במבנה הקיים:
           * המינימום הוא תמיד עובד אחד.
           */
          'minimumWorkers',
            1,

          /*
           * required_workers משמש
           * ככמות העובדים המומלצת.
           *
           * בוקר רגיל:
           * 2.
           *
           * ערב או שישי:
           * 1.
           */
          'recommendedWorkers',
            coalesce(
              shift_item.required_workers,
              1
            ),

          'assignmentSlot',
            assignment.assignment_slot,

          'assignedUserId',
            assignment.assigned_user_id,

          'assignedUserName',
            coalesce(
              assigned_profile.schedule_name,
              assigned_profile.display_name
            ),

          'assignmentSource',
            assignment.assignment_source,

          'isLocked',
            assignment.is_locked,

          'isIntentionallyUnassigned',
            coalesce(assignment.is_intentionally_unassigned, false),

          'notes',
            assignment.notes,

          'updatedAt',
            assignment.updated_at
        )
        order by
          shift_item.shift_date,
          shift_item.sort_order,
          assignment.assignment_slot
      ),
      '[]'::jsonb
    )
  into
    assignments_json
  from public.morning_driver_schedule_assignments assignment

  join public.morning_driver_availability_shifts shift_item
    on shift_item.id =
      assignment.availability_shift_id

  left join public.profiles assigned_profile
    on assigned_profile.id =
      assignment.assigned_user_id

  where assignment.schedule_period_id =
      schedule_period.id

    and (
      can_view_team
      or can_edit
      or assignment.assigned_user_id =
        current_user_id
    );

  select
    count(*)
  into
    total_assignments
  from public.morning_driver_schedule_assignments assignment
  where assignment.schedule_period_id =
    schedule_period.id;

  select
    count(*)
  into
    assigned_assignments
  from public.morning_driver_schedule_assignments assignment
  where assignment.schedule_period_id =
      schedule_period.id
    and assignment.assigned_user_id
      is not null;

  select
    count(*)
  into
    minimum_unfilled
  from public.morning_driver_schedule_assignments assignment
  where assignment.schedule_period_id =
      schedule_period.id
    and assignment.assignment_slot = 1
    and assignment.assigned_user_id
      is null
    and coalesce(assignment.is_intentionally_unassigned, false) = false;

  select
    count(*)
  into
    recommendation_unfilled
  from public.morning_driver_schedule_assignments assignment
  where assignment.schedule_period_id =
      schedule_period.id
    and assignment.assignment_slot > 1
    and assignment.assigned_user_id
      is null;

  select
    count(*)
  into
    intentionally_unassigned_minimum
  from public.morning_driver_schedule_assignments assignment
  where assignment.schedule_period_id =
      schedule_period.id
    and assignment.assignment_slot = 1
    and assignment.assigned_user_id is null
    and coalesce(assignment.is_intentionally_unassigned, false) = true;

  return jsonb_build_object(
    'period',
      jsonb_build_object(
        'id',
          schedule_period.id,

        'year',
          schedule_period.year,

        'month',
          schedule_period.month,

        'status',
          schedule_period.status,

        'availabilityPeriodId',
          schedule_period.availability_period_id,

        'title',
          schedule_period.title,

        'publishedAt',
          schedule_period.published_at,

        'createdAt',
          schedule_period.created_at,

        'updatedAt',
          schedule_period.updated_at
      ),

    'drivers',
      drivers_json,

    'assignments',
      assignments_json,

    'statistics',
      jsonb_build_object(
        'totalAssignments',
          total_assignments,

        'assignedAssignments',
          assigned_assignments,

        'unassignedAssignments',
          greatest(
            total_assignments -
            assigned_assignments,
            0
          ),

        'minimumUnfilled',
          minimum_unfilled,

        'recommendationUnfilled',
          recommendation_unfilled,

        'intentionallyUnassignedMinimum',
          intentionally_unassigned_minimum
      )
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.publish_morning_driver_schedule(requested_schedule_period_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  current_user_id uuid;
  current_permissions text[];

  target_period
    public.morning_driver_schedule_periods%rowtype;

  minimum_unfilled integer := 0;
  recommendation_unfilled integer := 0;
  published_at_value timestamptz := now();
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
    'morning_driver_schedule.edit'
      = any(current_permissions)
  ) then
    raise exception 'not allowed';
  end if;

  select *
  into target_period
  from public.morning_driver_schedule_periods period
  where period.id = requested_schedule_period_id
  for update;

  if not found then
    raise exception 'morning driver schedule period not found';
  end if;

  if target_period.status = 'published' then
    return jsonb_build_object(
      'schedulePeriodId',
        target_period.id,
      'status',
        target_period.status,
      'publishedAt',
        target_period.published_at,
      'recommendationWarnings',
        0,
      'alreadyPublished',
        true
    );
  end if;

  if target_period.status <> 'draft' then
    raise exception 'only draft schedules can be published';
  end if;

  select count(*)
  into minimum_unfilled
  from public.morning_driver_schedule_assignments assignment
  where assignment.schedule_period_id = target_period.id
    and assignment.assignment_slot = 1
    and assignment.assigned_user_id is null
    and coalesce(assignment.is_intentionally_unassigned, false) = false;

  if minimum_unfilled > 0 then
    raise exception 'minimum morning driver staffing is incomplete unless explicitly marked unassigned';
  end if;

  select count(*)
  into recommendation_unfilled
  from public.morning_driver_schedule_assignments assignment
  where assignment.schedule_period_id = target_period.id
    and assignment.assignment_slot > 1
    and assignment.assigned_user_id is null;

  update public.morning_driver_schedule_periods
  set
    status = 'published',
    published_at = published_at_value,
    updated_by = current_user_id,
    updated_at = published_at_value
  where id = target_period.id
  returning *
  into target_period;

  return jsonb_build_object(
    'schedulePeriodId',
      target_period.id,
    'status',
      target_period.status,
    'publishedAt',
      target_period.published_at,
    'recommendationWarnings',
      recommendation_unfilled,
    'alreadyPublished',
      false
  );
end;
$function$
;

grant execute on function public.set_morning_driver_assignment_intentionally_unassigned(uuid, boolean) to authenticated;
