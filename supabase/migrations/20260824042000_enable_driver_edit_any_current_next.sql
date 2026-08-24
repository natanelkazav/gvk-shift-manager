-- Allow on-call and morning-driver users with edit_any to truly edit any published assignment
-- in the current month and next month. Dispatcher behavior is intentionally unchanged.

update public.permissions
set
  display_name = 'עריכת כל כוננות בחודש הנוכחי והבא',
  description = 'מאפשרת לשנות כל כונן משובץ בלוח שפורסם של החודש הנוכחי או החודש הבא, גם כוננות של משתמש אחר וגם תאריך שכבר עבר בחודש הנוכחי.'
where permission_key = 'driver_schedule.edit_any';

update public.permissions
set
  display_name = 'עריכת כל משמרת כונן בוקר בחודש הנוכחי והבא',
  description = 'מאפשרת לשנות כל שיבוץ בלוח כונני בוקר שפורסם של החודש הנוכחי או החודש הבא, גם משמרת של משתמש אחר וגם משמרת מתאריך שכבר עבר בחודש הנוכחי.'
where permission_key = 'morning_driver_schedule.edit_any';

-- Make the capability part of the normal defaults for these two user types.
insert into public.role_default_permissions (role_name, permission_key)
values
  ('on_call', 'driver_schedule.edit_any'),
  ('morning_driver', 'morning_driver_schedule.edit_any')
on conflict do nothing;

-- Existing users should receive the new default as well. Authorization still remains
-- permission-based everywhere; this is only a one-time grant to existing users.
insert into public.user_permissions (user_id, permission_key)
select profile.id,
       case
         when profile.role = 'on_call'::public.user_role
           then 'driver_schedule.edit_any'
         else 'morning_driver_schedule.edit_any'
       end
from public.profiles profile
where profile.is_active = true
  and profile.role in (
    'on_call'::public.user_role,
    'morning_driver'::public.user_role
  )
on conflict do nothing;

CREATE OR REPLACE FUNCTION public.get_driver_schedule_draft(requested_schedule_period_id uuid DEFAULT NULL::uuid, requested_year integer DEFAULT NULL::integer, requested_month integer DEFAULT NULL::integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  current_user_id uuid;
  current_permissions text[];

  target_period
    public.driver_schedule_periods%rowtype;

  days_json jsonb :=
    '[]'::jsonb;

  drivers_json jsonb :=
    '[]'::jsonb;

  assigned_days_count integer := 0;
  unassigned_days_count integer := 0;
  warning_count integer := 0;
begin
  current_user_id :=
    auth.uid();

  if current_user_id is null then
    raise exception
      'not authenticated';
  end if;

  if not exists (
    select 1
    from public.profiles
    where id =
      current_user_id
      and is_active = true
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
    'driver_schedule.view' =
      any(current_permissions)
    or
    'driver_schedule.view_team' =
      any(current_permissions)
    or
    'driver_schedule.edit' =
      any(current_permissions)
    or
    'driver_schedule.edit_any' =
      any(current_permissions)
  ) then
    raise exception
      'not allowed';
  end if;

  if requested_schedule_period_id
    is not null
  then
    select *
    into target_period
    from public.driver_schedule_periods
    where id =
      requested_schedule_period_id
    limit 1;
  elsif (
    requested_year is not null
    and requested_month is not null
  ) then
    select *
    into target_period
    from public.driver_schedule_periods
    where year =
      requested_year
      and month =
        requested_month
    limit 1;
  else
    select *
    into target_period
    from public.driver_schedule_periods
    order by
      year desc,
      month desc,
      created_at desc
    limit 1;
  end if;

  if not found then
    return jsonb_build_object(
      'period',
        null,

      'days',
        '[]'::jsonb,

      'drivers',
        '[]'::jsonb,

      'statistics',
        jsonb_build_object(
          'totalDays',
            0,

          'assignedDays',
            0,

          'unassignedDays',
            0,

          'warningCount',
            0
        )
    );
  end if;

  select
    count(*) filter (
      where assigned_user_id
        is not null
    )::integer,

    count(*) filter (
      where assigned_user_id
        is null
    )::integer,

    count(*) filter (
      where notes is not null
    )::integer

  into
    assigned_days_count,
    unassigned_days_count,
    warning_count

  from public.driver_schedule_days
  where period_id =
    target_period.id;

  select
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id',
            schedule_day.id,

          'periodId',
            schedule_day.period_id,

          'dutyDate',
            schedule_day.duty_date,

          'weekdayNumber',
            schedule_day.weekday_number,

          'weekdayName',
            schedule_day.weekday_name,

          'originalUserId',
            schedule_day.original_user_id,

          'originalUserName',
            coalesce(
              original_profile.schedule_name,
              original_profile.display_name
            ),

          'assignedUserId',
            schedule_day.assigned_user_id,

          'assignedUserName',
            coalesce(
              assigned_profile.schedule_name,
              assigned_profile.display_name
            ),

          'assignmentSource',
            schedule_day.assignment_source,

          'isLocked',
            schedule_day.is_locked,

          'notes',
            schedule_day.notes,

          'spacingWarning',
            schedule_day.notes
              is not null,

          'createdAt',
            schedule_day.created_at,

          'updatedAt',
            schedule_day.updated_at
        )
        order by
          schedule_day.duty_date
      ),
      '[]'::jsonb
    )
  into days_json
  from public.driver_schedule_days
    schedule_day

  left join public.profiles
    original_profile
    on original_profile.id =
      schedule_day.original_user_id

  left join public.profiles
    assigned_profile
    on assigned_profile.id =
      schedule_day.assigned_user_id

  where schedule_day.period_id =
    target_period.id

    and (
      'driver_schedule.view_team' =
        any(current_permissions)

      or

      'driver_schedule.edit' =
        any(current_permissions)

      or

      'driver_schedule.edit_any' =
        any(current_permissions)

      or

      schedule_day.assigned_user_id =
        current_user_id
    );

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
  into drivers_json
  from public.profiles
    profile
  where profile.role =
    'on_call'::public.user_role
    and profile.is_active = true;

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

        'availabilityPeriodId',
          target_period.availability_period_id,

        'title',
          target_period.title,

        'publishedAt',
          target_period.published_at,

        'archivedAt',
          target_period.archived_at,

        'createdBy',
          target_period.created_by,

        'updatedBy',
          target_period.updated_by,

        'createdAt',
          target_period.created_at,

        'updatedAt',
          target_period.updated_at
      ),

    'days',
      days_json,

    'drivers',
      drivers_json,

    'statistics',
      jsonb_build_object(
        'totalDays',
          assigned_days_count +
          unassigned_days_count,

        'assignedDays',
          assigned_days_count,

        'unassignedDays',
          unassigned_days_count,

        'warningCount',
          warning_count
      )
  );
end;
$function$
;

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
            profile.email
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
    and profile.is_active = true;

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
      is null;

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
          recommendation_unfilled
      )
  );
end;
$function$
;

notify pgrst, 'reload schema';
