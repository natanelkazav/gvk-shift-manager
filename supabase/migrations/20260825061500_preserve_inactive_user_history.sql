-- Preserve inactive workforce history while excluding inactive users from future scheduling candidates.

alter table public.profiles
  add column if not exists deactivated_at timestamptz;

update public.profiles
set deactivated_at = coalesce(deactivated_at, updated_at, now())
where is_active = false
  and deactivated_at is null;

create or replace function public.track_profile_deactivation()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if old.is_active = true and new.is_active = false then
    new.deactivated_at := now();
  elsif old.is_active = false and new.is_active = true then
    new.deactivated_at := null;
  end if;
  return new;
end;
$function$;

drop trigger if exists track_profiles_deactivation on public.profiles;
create trigger track_profiles_deactivation
before update of is_active on public.profiles
for each row execute function public.track_profile_deactivation();


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
    and (
      profile.is_active = true
      or exists (
        select 1
        from public.driver_schedule_days historical_day
        where historical_day.period_id = target_period.id
          and historical_day.assigned_user_id = profile.id
      )
      or exists (
        select 1
        from public.driver_schedule_days historical_day
        where historical_day.period_id = target_period.id
          and historical_day.original_user_id = profile.id
      )
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
$function$;


create or replace function public.get_statistics_people()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  current_user_id uuid := auth.uid();
  current_permissions text[];
begin
  if current_user_id is null then raise exception 'not authenticated'; end if;
  current_permissions := coalesce(public.get_my_permissions(), array[]::text[]);
  if not ('statistics.view' = any(current_permissions) or 'users.manage' = any(current_permissions)) then
    raise exception 'not allowed';
  end if;
  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'userId', profile.id,
        'displayName', profile.display_name,
        'scheduleName', profile.schedule_name,
        'isActive', profile.is_active,
        'userType', case profile.role::text
          when 'dispatcher' then 'dispatchers'
          when 'on_call' then 'drivers'
          when 'morning_driver' then 'morning_drivers'
        end
      )
      order by
        case profile.role::text when 'dispatcher' then 1 when 'on_call' then 2 when 'morning_driver' then 3 else 4 end,
        case when profile.is_active then 0 else 1 end,
        coalesce(profile.schedule_name, profile.display_name)
    )
    from public.profiles profile
    where profile.role::text in ('dispatcher', 'on_call', 'morning_driver')
  ), '[]'::jsonb);
end;
$function$;


CREATE OR REPLACE FUNCTION public.get_statistics_dashboard(requested_year integer DEFAULT NULL::integer, requested_month integer DEFAULT NULL::integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  current_user_id uuid;
  current_permissions text[];

  dispatcher_statistics jsonb;
  driver_statistics jsonb;
  monthly_statistics jsonb;

  dispatcher_monthly_breakdown jsonb;
  driver_monthly_breakdown jsonb;
  summary_statistics jsonb;

  selected_year integer;
  selected_month integer;
begin
  current_user_id :=
    auth.uid();

  if current_user_id is null then
    raise exception
      'not authenticated';
  end if;

  if not exists (
    select 1
    from public.profiles profile_row
    where profile_row.id =
      current_user_id
      and profile_row.is_active = true
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
    'statistics.view' =
      any(current_permissions)
    or
    'users.manage' =
      any(current_permissions)
  ) then
    raise exception
      'not allowed';
  end if;

  if (
    requested_month is not null
    and (
      requested_month < 1
      or requested_month > 12
    )
  ) then
    raise exception
      'statistics month is invalid';
  end if;

  if (
    requested_year is not null
    and (
      requested_year < 2020
      or requested_year > 2100
    )
  ) then
    raise exception
      'statistics year is invalid';
  end if;

  if (
    requested_month is not null
    and requested_year is null
  ) then
    raise exception
      'statistics year is required when month is selected';
  end if;

  selected_year :=
    requested_year;

  selected_month :=
    requested_month;

  /*
   * סטטיסטיקות מוקדנים לתקופה שנבחרה.
   */
  select
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'userId',
            dispatcher_row.user_id,

          'displayName',
            dispatcher_row.display_name,

          'scheduleName',
            dispatcher_row.schedule_name,

          'totalShifts',
            dispatcher_row.total_shifts,

          'premiumShifts',
            dispatcher_row.premium_shifts,

          'regularShifts',
            dispatcher_row.regular_shifts,

          'weekdayShifts',
            dispatcher_row.weekday_shifts,

          'fridayShifts',
            dispatcher_row.friday_shifts,

          'saturdayShifts',
            dispatcher_row.saturday_shifts,

          'holidayShifts',
            dispatcher_row.holiday_shifts,

          'nightShifts',
            dispatcher_row.night_shifts,

          'importedShifts',
            dispatcher_row.imported_shifts
        )
        order by
          dispatcher_row.total_shifts desc,
          dispatcher_row.display_name
      ),
      '[]'::jsonb
    )
  into dispatcher_statistics
  from (
    select
      profile_row.id
        as user_id,

      profile_row.display_name,

      profile_row.schedule_name,

      count(schedule_shift.id)::integer
        as total_shifts,

      count(schedule_shift.id) filter (
        where schedule_shift.is_premium = true
      )::integer
        as premium_shifts,

      count(schedule_shift.id) filter (
        where schedule_shift.is_premium = false
      )::integer
        as regular_shifts,

      count(schedule_shift.id) filter (
        where schedule_shift.schedule_type =
          'weekday'::public.schedule_type
      )::integer
        as weekday_shifts,

      count(schedule_shift.id) filter (
        where schedule_shift.schedule_type =
          'friday'::public.schedule_type
      )::integer
        as friday_shifts,

      count(schedule_shift.id) filter (
        where schedule_shift.schedule_type =
          'saturday'::public.schedule_type
      )::integer
        as saturday_shifts,

      count(schedule_shift.id) filter (
        where schedule_shift.schedule_type in (
          'holiday_eve'::public.schedule_type,
          'holiday_full'::public.schedule_type,
          'holiday_end'::public.schedule_type,
          'chol_hamoed'::public.schedule_type
        )
      )::integer
        as holiday_shifts,

      count(schedule_shift.id) filter (
        where
          (
            schedule_shift.starts_at
              at time zone 'Asia/Jerusalem'
          )::time >= time '22:00'
          or
          (
            schedule_shift.starts_at
              at time zone 'Asia/Jerusalem'
          )::time < time '06:00'
      )::integer
        as night_shifts,

      count(schedule_shift.id) filter (
        where schedule_shift.assignment_source::text =
          'import'
      )::integer
        as imported_shifts

    from public.profiles profile_row

    join public.schedule_shifts schedule_shift
      on schedule_shift.assigned_user_id =
        profile_row.id

    join public.schedule_periods schedule_period
      on schedule_period.id =
        schedule_shift.period_id

    where
      profile_row.role =
        'dispatcher'

      and (
        selected_year is null
        or schedule_period.year =
          selected_year
      )

      and (
        selected_month is null
        or schedule_period.month =
          selected_month
      )

      and schedule_period.status in (
        'published'::public.schedule_period_status,
        'archived'::public.schedule_period_status
      )

    group by
      profile_row.id,
      profile_row.display_name,
      profile_row.schedule_name
  ) dispatcher_row;

  /*
   * סטטיסטיקות כוננים לתקופה שנבחרה.
   */
  select
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'userId',
            driver_row.user_id,

          'displayName',
            driver_row.display_name,

          'scheduleName',
            driver_row.schedule_name,

          'totalDuties',
            driver_row.total_duties,

          'weekdayDuties',
            driver_row.weekday_duties,

          'fridayDuties',
            driver_row.friday_duties,

          'saturdayDuties',
            driver_row.saturday_duties,

          'weekendDuties',
            driver_row.weekend_duties,

          'holidayDuties',
            driver_row.holiday_duties,

          'importedDuties',
            driver_row.imported_duties
        )
        order by
          driver_row.total_duties desc,
          driver_row.display_name
      ),
      '[]'::jsonb
    )
  into driver_statistics
  from (
    select
      profile_row.id
        as user_id,

      profile_row.display_name,

      profile_row.schedule_name,

      count(driver_day.id)::integer
        as total_duties,

      count(driver_day.id) filter (
        where driver_day.weekday_number
          between 0 and 4
      )::integer
        as weekday_duties,

      count(driver_day.id) filter (
        where driver_day.weekday_number = 5
      )::integer
        as friday_duties,

      count(driver_day.id) filter (
        where driver_day.weekday_number = 6
      )::integer
        as saturday_duties,

      count(driver_day.id) filter (
        where driver_day.weekday_number
          in (5, 6)
      )::integer
        as weekend_duties,

      count(driver_day.id) filter (
        where exists (
          select 1
          from public.schedule_periods schedule_period_for_day
          join public.schedule_shifts holiday_shift
            on holiday_shift.period_id =
              schedule_period_for_day.id
          where holiday_shift.shift_date =
            driver_day.duty_date
            and holiday_shift.schedule_type in (
              'holiday_eve'::public.schedule_type,
              'holiday_full'::public.schedule_type,
              'holiday_end'::public.schedule_type,
              'chol_hamoed'::public.schedule_type
            )
        )
      )::integer
        as holiday_duties,

      count(driver_day.id) filter (
        where driver_day.assignment_source::text =
          'import'
      )::integer
        as imported_duties

    from public.profiles profile_row

    join public.driver_schedule_days driver_day
      on driver_day.assigned_user_id =
        profile_row.id

    join public.driver_schedule_periods driver_period
      on driver_period.id =
        driver_day.period_id

    where
      profile_row.role =
        'on_call'

      and (
        selected_year is null
        or driver_period.year =
          selected_year
      )

      and (
        selected_month is null
        or driver_period.month =
          selected_month
      )

      and driver_period.status in (
        'published'::public.driver_schedule_period_status,
        'archived'::public.driver_schedule_period_status
      )

    group by
      profile_row.id,
      profile_row.display_name,
      profile_row.schedule_name
  ) driver_row;

  /*
   * סיכום לפי חודש.
   */
  select
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'year',
            monthly_row.year,

          'month',
            monthly_row.month,

          'dispatcherShiftCount',
            monthly_row.dispatcher_shift_count,

          'driverDutyCount',
            monthly_row.driver_duty_count,

          'dispatcherPeriodStatus',
            monthly_row.dispatcher_period_status,

          'driverPeriodStatus',
            monthly_row.driver_period_status
        )
        order by
          monthly_row.year desc,
          monthly_row.month desc
      ),
      '[]'::jsonb
    )
  into monthly_statistics
  from (
    select
      coalesce(
        schedule_period.year,
        driver_period.year
      ) as year,

      coalesce(
        schedule_period.month,
        driver_period.month
      ) as month,

      schedule_period.status::text
        as dispatcher_period_status,

      driver_period.status::text
        as driver_period_status,

      coalesce(
        schedule_count.shift_count,
        0
      )::integer
        as dispatcher_shift_count,

      coalesce(
        driver_count.duty_count,
        0
      )::integer
        as driver_duty_count

    from public.schedule_periods schedule_period

    full join public.driver_schedule_periods driver_period
      on driver_period.year =
        schedule_period.year
      and driver_period.month =
        schedule_period.month

    left join lateral (
      select
        count(*)::integer
          as shift_count
      from public.schedule_shifts schedule_shift
      where schedule_shift.period_id =
        schedule_period.id
    ) schedule_count
      on true

    left join lateral (
      select
        count(*)::integer
          as duty_count
      from public.driver_schedule_days driver_day
      where driver_day.period_id =
        driver_period.id
    ) driver_count
      on true

    where
      (
        selected_year is null
        or coalesce(
          schedule_period.year,
          driver_period.year
        ) = selected_year
      )

      and (
        selected_month is null
        or coalesce(
          schedule_period.month,
          driver_period.month
        ) = selected_month
      )

      and (
        schedule_period.status in (
          'published'::public.schedule_period_status,
          'archived'::public.schedule_period_status
        )
        or
        driver_period.status in (
          'published'::public.driver_schedule_period_status,
          'archived'::public.driver_schedule_period_status
        )
      )
  ) monthly_row;

  /*
   * פירוט מוקדנים לפי חודש.
   */
  select
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'userId',
            dispatcher_month_row.user_id,

          'displayName',
            dispatcher_month_row.display_name,

          'scheduleName',
            dispatcher_month_row.schedule_name,

          'year',
            dispatcher_month_row.year,

          'month',
            dispatcher_month_row.month,

          'totalShifts',
            dispatcher_month_row.total_shifts,

          'premiumShifts',
            dispatcher_month_row.premium_shifts,

          'regularShifts',
            dispatcher_month_row.regular_shifts,

          'weekdayShifts',
            dispatcher_month_row.weekday_shifts,

          'fridayShifts',
            dispatcher_month_row.friday_shifts,

          'saturdayShifts',
            dispatcher_month_row.saturday_shifts,

          'holidayShifts',
            dispatcher_month_row.holiday_shifts,

          'nightShifts',
            dispatcher_month_row.night_shifts
        )
        order by
          dispatcher_month_row.year,
          dispatcher_month_row.month,
          dispatcher_month_row.display_name
      ),
      '[]'::jsonb
    )
  into dispatcher_monthly_breakdown
  from (
    select
      profile_row.id
        as user_id,

      profile_row.display_name,

      profile_row.schedule_name,

      schedule_period.year,

      schedule_period.month,

      count(schedule_shift.id)::integer
        as total_shifts,

      count(schedule_shift.id) filter (
        where schedule_shift.is_premium = true
      )::integer
        as premium_shifts,

      count(schedule_shift.id) filter (
        where schedule_shift.is_premium = false
      )::integer
        as regular_shifts,

      count(schedule_shift.id) filter (
        where schedule_shift.schedule_type =
          'weekday'::public.schedule_type
      )::integer
        as weekday_shifts,

      count(schedule_shift.id) filter (
        where schedule_shift.schedule_type =
          'friday'::public.schedule_type
      )::integer
        as friday_shifts,

      count(schedule_shift.id) filter (
        where schedule_shift.schedule_type =
          'saturday'::public.schedule_type
      )::integer
        as saturday_shifts,

      count(schedule_shift.id) filter (
        where schedule_shift.schedule_type in (
          'holiday_eve'::public.schedule_type,
          'holiday_full'::public.schedule_type,
          'holiday_end'::public.schedule_type,
          'chol_hamoed'::public.schedule_type
        )
      )::integer
        as holiday_shifts,

      count(schedule_shift.id) filter (
        where
          (
            schedule_shift.starts_at
              at time zone 'Asia/Jerusalem'
          )::time >= time '22:00'
          or
          (
            schedule_shift.starts_at
              at time zone 'Asia/Jerusalem'
          )::time < time '06:00'
      )::integer
        as night_shifts

    from public.profiles profile_row

    join public.schedule_shifts schedule_shift
      on schedule_shift.assigned_user_id =
        profile_row.id

    join public.schedule_periods schedule_period
      on schedule_period.id =
        schedule_shift.period_id

    where
      profile_row.role =
        'dispatcher'

      and (
        selected_year is null
        or schedule_period.year =
          selected_year
      )

      and (
        selected_month is null
        or schedule_period.month =
          selected_month
      )

      and schedule_period.status in (
        'published'::public.schedule_period_status,
        'archived'::public.schedule_period_status
      )

    group by
      profile_row.id,
      profile_row.display_name,
      profile_row.schedule_name,
      schedule_period.year,
      schedule_period.month
  ) dispatcher_month_row;

  /*
   * פירוט כוננים לפי חודש.
   */
  select
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'userId',
            driver_month_row.user_id,

          'displayName',
            driver_month_row.display_name,

          'scheduleName',
            driver_month_row.schedule_name,

          'year',
            driver_month_row.year,

          'month',
            driver_month_row.month,

          'totalDuties',
            driver_month_row.total_duties,

          'weekdayDuties',
            driver_month_row.weekday_duties,

          'fridayDuties',
            driver_month_row.friday_duties,

          'saturdayDuties',
            driver_month_row.saturday_duties,

          'weekendDuties',
            driver_month_row.weekend_duties,

          'holidayDuties',
            driver_month_row.holiday_duties
        )
        order by
          driver_month_row.year,
          driver_month_row.month,
          driver_month_row.display_name
      ),
      '[]'::jsonb
    )
  into driver_monthly_breakdown
  from (
    select
      profile_row.id
        as user_id,

      profile_row.display_name,

      profile_row.schedule_name,

      driver_period.year,

      driver_period.month,

      count(driver_day.id)::integer
        as total_duties,

      count(driver_day.id) filter (
        where driver_day.weekday_number
          between 0 and 4
      )::integer
        as weekday_duties,

      count(driver_day.id) filter (
        where driver_day.weekday_number = 5
      )::integer
        as friday_duties,

      count(driver_day.id) filter (
        where driver_day.weekday_number = 6
      )::integer
        as saturday_duties,

      count(driver_day.id) filter (
        where driver_day.weekday_number
          in (5, 6)
      )::integer
        as weekend_duties,

      count(driver_day.id) filter (
        where exists (
          select 1
          from public.schedule_periods schedule_period_for_day
          join public.schedule_shifts holiday_shift
            on holiday_shift.period_id =
              schedule_period_for_day.id
          where holiday_shift.shift_date =
            driver_day.duty_date
            and holiday_shift.schedule_type in (
              'holiday_eve'::public.schedule_type,
              'holiday_full'::public.schedule_type,
              'holiday_end'::public.schedule_type,
              'chol_hamoed'::public.schedule_type
            )
        )
      )::integer
        as holiday_duties

    from public.profiles profile_row

    join public.driver_schedule_days driver_day
      on driver_day.assigned_user_id =
        profile_row.id

    join public.driver_schedule_periods driver_period
      on driver_period.id =
        driver_day.period_id

    where
      profile_row.role =
        'on_call'

      and (
        selected_year is null
        or driver_period.year =
          selected_year
      )

      and (
        selected_month is null
        or driver_period.month =
          selected_month
      )

      and driver_period.status in (
        'published'::public.driver_schedule_period_status,
        'archived'::public.driver_schedule_period_status
      )

    group by
      profile_row.id,
      profile_row.display_name,
      profile_row.schedule_name,
      driver_period.year,
      driver_period.month
  ) driver_month_row;

  /*
   * סיכום כולל לתקופה.
   */
  select
    jsonb_build_object(
      'dispatcherCount',
        (
          select count(distinct statistics_row->>'userId')
          from jsonb_array_elements(
            dispatcher_statistics
          ) statistics_row
        ),

      'driverCount',
        (
          select count(distinct statistics_row->>'userId')
          from jsonb_array_elements(
            driver_statistics
          ) statistics_row
        ),

      'totalDispatcherShifts',
        coalesce(
          (
            select sum(
              (statistics_row->>'totalShifts')::integer
            )
            from jsonb_array_elements(
              dispatcher_statistics
            ) statistics_row
          ),
          0
        ),

      'totalDriverDuties',
        coalesce(
          (
            select sum(
              (statistics_row->>'totalDuties')::integer
            )
            from jsonb_array_elements(
              driver_statistics
            ) statistics_row
          ),
          0
        ),

      'premiumShifts',
        coalesce(
          (
            select sum(
              (statistics_row->>'premiumShifts')::integer
            )
            from jsonb_array_elements(
              dispatcher_statistics
            ) statistics_row
          ),
          0
        ),

      'regularShifts',
        coalesce(
          (
            select sum(
              (statistics_row->>'regularShifts')::integer
            )
            from jsonb_array_elements(
              dispatcher_statistics
            ) statistics_row
          ),
          0
        ),

      'nightShifts',
        coalesce(
          (
            select sum(
              (statistics_row->>'nightShifts')::integer
            )
            from jsonb_array_elements(
              dispatcher_statistics
            ) statistics_row
          ),
          0
        ),

      'holidayShifts',
        coalesce(
          (
            select sum(
              (statistics_row->>'holidayShifts')::integer
            )
            from jsonb_array_elements(
              dispatcher_statistics
            ) statistics_row
          ),
          0
        ),

      'weekendShifts',
        coalesce(
          (
            select sum(
              (statistics_row->>'fridayShifts')::integer +
              (statistics_row->>'saturdayShifts')::integer
            )
            from jsonb_array_elements(
              dispatcher_statistics
            ) statistics_row
          ),
          0
        ),

      'weekdayDriverDuties',
        coalesce(
          (
            select sum(
              (statistics_row->>'weekdayDuties')::integer
            )
            from jsonb_array_elements(
              driver_statistics
            ) statistics_row
          ),
          0
        ),

      'weekendDriverDuties',
        coalesce(
          (
            select sum(
              (statistics_row->>'weekendDuties')::integer
            )
            from jsonb_array_elements(
              driver_statistics
            ) statistics_row
          ),
          0
        ),

      'holidayDriverDuties',
        coalesce(
          (
            select sum(
              (statistics_row->>'holidayDuties')::integer
            )
            from jsonb_array_elements(
              driver_statistics
            ) statistics_row
          ),
          0
        )
    )
  into summary_statistics;

  return jsonb_build_object(
    'filters',
      jsonb_build_object(
        'year',
          selected_year,

        'month',
          selected_month
      ),

    'summary',
      summary_statistics,

    'dispatcherStatistics',
      dispatcher_statistics,

    'driverStatistics',
      driver_statistics,

    'monthlyStatistics',
      monthly_statistics,

    'dispatcherMonthlyBreakdown',
      dispatcher_monthly_breakdown,

    'driverMonthlyBreakdown',
      driver_monthly_breakdown,

    'generatedAt',
      now()
  );
end;
$function$;


create or replace function public.get_dispatcher_availability_statistics(
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
  summary_json jsonb;
  dispatcher_json jsonb;
  monthly_json jsonb;
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
    coalesce(public.get_my_permissions(), array[]::text[]);

  if not (
    'statistics.view' = any(current_permissions)
    or 'users.manage' = any(current_permissions)
  ) then
    raise exception 'not allowed';
  end if;

  if requested_month is not null
     and (requested_month < 1 or requested_month > 12) then
    raise exception 'statistics month is invalid';
  end if;

  if requested_year is not null
     and (requested_year < 2020 or requested_year > 2100) then
    raise exception 'statistics year is invalid';
  end if;

  if requested_month is not null and requested_year is null then
    raise exception 'statistics year is required when month is selected';
  end if;

  with selected_periods as (
    select period.*
    from public.availability_periods period
    where period.status = 'closed'
      and (requested_year is null or period.year = requested_year)
      and (requested_month is null or period.month = requested_month)
  ),
  period_dispatchers as (
    select
      period.id as period_id,
      period.year,
      period.month,
      profile.id as user_id,
      profile.display_name,
      profile.schedule_name,
      coalesce(submission.submission_source, 'auto_no_submission') as submission_source
    from selected_periods period
    cross join public.profiles profile
    left join public.availability_submissions submission
      on submission.period_id = period.id
     and submission.user_id = profile.id
    where profile.role::text = 'dispatcher'
      and profile.created_at < (make_date(period.year, period.month, 1) + interval '1 month')
      and (
        profile.deactivated_at is null
        or profile.deactivated_at >= make_date(period.year, period.month, 1)
      )
  ),
  entry_stats as (
    select
      base.period_id,
      base.year,
      base.month,
      base.user_id,
      base.display_name,
      base.schedule_name,
      base.submission_source,
      count(entry.id) filter (
        where entry.availability_status = 'available'
          and not entry.is_auto_completed
      )::integer as declared_available_count,
      count(entry.id) filter (
        where entry.availability_status = 'unavailable'
          and not entry.is_auto_completed
      )::integer as declared_unavailable_count,
      count(entry.id) filter (
        where entry.availability_status = 'available'
          and entry.is_auto_completed
      )::integer as auto_completed_available_count,
      count(entry.id) filter (
        where entry.availability_status = 'available'
          and not entry.is_auto_completed
          and slot.weekday_number = 5
          and slot.start_time < time '12:00'
      )::integer as friday_morning_available_count,
      count(entry.id) filter (
        where entry.availability_status = 'available'
          and not entry.is_auto_completed
          and slot.weekday_number = 5
          and slot.start_time >= time '12:00'
          and slot.start_time < time '21:00'
      )::integer as friday_afternoon_available_count,
      count(entry.id) filter (
        where entry.availability_status = 'available'
          and not entry.is_auto_completed
          and slot.weekday_number = 5
          and slot.start_time >= time '21:00'
      )::integer as friday_night_available_count,
      count(entry.id) filter (
        where entry.availability_status = 'available'
          and not entry.is_auto_completed
          and slot.weekday_number = 6
          and slot.start_time < time '12:00'
      )::integer as saturday_morning_available_count,
      count(entry.id) filter (
        where entry.availability_status = 'available'
          and not entry.is_auto_completed
          and slot.weekday_number = 6
          and slot.start_time >= time '12:00'
          and slot.start_time < time '21:00'
      )::integer as saturday_afternoon_available_count,
      count(entry.id) filter (
        where entry.availability_status = 'available'
          and not entry.is_auto_completed
          and slot.weekday_number = 6
          and slot.start_time >= time '21:00'
      )::integer as saturday_night_available_count,
      count(entry.id) filter (
        where entry.availability_status = 'available'
          and not entry.is_auto_completed
          and (slot.start_time >= time '21:00' or slot.start_time < time '06:00')
      )::integer as night_available_count,
      count(entry.id) filter (
        where entry.availability_status = 'available'
          and not entry.is_auto_completed
          and slot.is_premium = true
      )::integer as premium_available_count,
      count(entry.id) filter (
        where entry.availability_status = 'available'
          and not entry.is_auto_completed
          and slot.schedule_type in ('holiday_eve', 'holiday_full', 'holiday_end', 'chol_hamoed')
      )::integer as holiday_available_count,
      count(entry.id) filter (
        where entry.availability_status = 'available'
          and not entry.is_auto_completed
          and slot.weekday_number in (5, 6)
      )::integer as weekend_available_count
    from period_dispatchers base
    left join public.dispatcher_availability entry
      on entry.period_id = base.period_id
     and entry.user_id = base.user_id
    left join public.availability_shift_slots slot
      on slot.id = entry.shift_slot_id
    group by
      base.period_id, base.year, base.month, base.user_id,
      base.display_name, base.schedule_name, base.submission_source
  ),
  dispatcher_totals as (
    select
      user_id,
      display_name,
      schedule_name,
      count(*)::integer as period_count,
      count(*) filter (where submission_source = 'manual')::integer as manual_submission_periods,
      count(*) filter (where submission_source = 'auto_partial')::integer as auto_partial_periods,
      count(*) filter (where submission_source = 'auto_no_submission')::integer as no_submission_periods,
      sum(declared_available_count)::integer as declared_available_count,
      sum(declared_unavailable_count)::integer as declared_unavailable_count,
      sum(auto_completed_available_count)::integer as auto_completed_available_count,
      sum(friday_morning_available_count)::integer as friday_morning_available_count,
      sum(friday_afternoon_available_count)::integer as friday_afternoon_available_count,
      sum(friday_night_available_count)::integer as friday_night_available_count,
      sum(saturday_morning_available_count)::integer as saturday_morning_available_count,
      sum(saturday_afternoon_available_count)::integer as saturday_afternoon_available_count,
      sum(saturday_night_available_count)::integer as saturday_night_available_count,
      sum(night_available_count)::integer as night_available_count,
      sum(premium_available_count)::integer as premium_available_count,
      sum(holiday_available_count)::integer as holiday_available_count,
      sum(weekend_available_count)::integer as weekend_available_count
    from entry_stats
    group by user_id, display_name, schedule_name
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'userId', user_id,
        'displayName', display_name,
        'scheduleName', schedule_name,
        'periodCount', period_count,
        'manualSubmissionPeriods', manual_submission_periods,
        'autoPartialPeriods', auto_partial_periods,
        'noSubmissionPeriods', no_submission_periods,
        'declaredAvailableCount', declared_available_count,
        'declaredUnavailableCount', declared_unavailable_count,
        'autoCompletedAvailableCount', auto_completed_available_count,
        'declaredAvailabilityRate',
          case
            when declared_available_count + declared_unavailable_count = 0 then 0
            else round(
              declared_available_count::numeric * 1000
              / (declared_available_count + declared_unavailable_count)
            ) / 10
          end,
        'fridayMorningAvailableCount', friday_morning_available_count,
        'fridayAfternoonAvailableCount', friday_afternoon_available_count,
        'fridayNightAvailableCount', friday_night_available_count,
        'saturdayMorningAvailableCount', saturday_morning_available_count,
        'saturdayAfternoonAvailableCount', saturday_afternoon_available_count,
        'saturdayNightAvailableCount', saturday_night_available_count,
        'nightAvailableCount', night_available_count,
        'premiumAvailableCount', premium_available_count,
        'holidayAvailableCount', holiday_available_count,
        'weekendAvailableCount', weekend_available_count
      )
      order by declared_available_count desc, display_name
    ),
    '[]'::jsonb
  )
  into dispatcher_json
  from dispatcher_totals;

  with selected_periods as (
    select period.*
    from public.availability_periods period
    where period.status = 'closed'
      and (requested_year is null or period.year = requested_year)
      and (requested_month is null or period.month = requested_month)
  ),
  stats as (
    select
      period.id as period_id, period.year, period.month,
      profile.id as user_id, profile.display_name, profile.schedule_name,
      coalesce(submission.submission_source, 'auto_no_submission') as submission_source,
      count(entry.id) filter (where entry.availability_status = 'available' and not entry.is_auto_completed)::integer as declared_available_count,
      count(entry.id) filter (where entry.availability_status = 'unavailable' and not entry.is_auto_completed)::integer as declared_unavailable_count,
      count(entry.id) filter (where entry.availability_status = 'available' and entry.is_auto_completed)::integer as auto_completed_available_count,
      count(entry.id) filter (where entry.availability_status = 'available' and not entry.is_auto_completed and slot.weekday_number = 5 and slot.start_time < time '12:00')::integer as friday_morning_available_count,
      count(entry.id) filter (where entry.availability_status = 'available' and not entry.is_auto_completed and (slot.start_time >= time '21:00' or slot.start_time < time '06:00'))::integer as night_available_count,
      count(entry.id) filter (where entry.availability_status = 'available' and not entry.is_auto_completed and slot.is_premium = true)::integer as premium_available_count
    from selected_periods period
    cross join public.profiles profile
    left join public.availability_submissions submission
      on submission.period_id = period.id and submission.user_id = profile.id
    left join public.dispatcher_availability entry
      on entry.period_id = period.id and entry.user_id = profile.id
    left join public.availability_shift_slots slot on slot.id = entry.shift_slot_id
    where profile.role::text = 'dispatcher' and profile.is_active = true
    group by period.id, period.year, period.month, profile.id, profile.display_name, profile.schedule_name, submission.submission_source
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'userId', user_id,
        'displayName', display_name,
        'scheduleName', schedule_name,
        'year', year,
        'month', month,
        'submissionSource', submission_source,
        'declaredAvailableCount', declared_available_count,
        'declaredUnavailableCount', declared_unavailable_count,
        'autoCompletedAvailableCount', auto_completed_available_count,
        'fridayMorningAvailableCount', friday_morning_available_count,
        'nightAvailableCount', night_available_count,
        'premiumAvailableCount', premium_available_count
      )
      order by year, month, display_name
    ),
    '[]'::jsonb
  )
  into monthly_json
  from stats;

  select jsonb_build_object(
    'periodCount', (
      select count(*)::integer from public.availability_periods period
      where period.status = 'closed'
        and (requested_year is null or period.year = requested_year)
        and (requested_month is null or period.month = requested_month)
    ),
    'dispatcherCount', jsonb_array_length(dispatcher_json),
    'manualSubmissionPeriods', coalesce((select sum((item ->> 'manualSubmissionPeriods')::integer) from jsonb_array_elements(dispatcher_json) item), 0),
    'autoPartialPeriods', coalesce((select sum((item ->> 'autoPartialPeriods')::integer) from jsonb_array_elements(dispatcher_json) item), 0),
    'noSubmissionPeriods', coalesce((select sum((item ->> 'noSubmissionPeriods')::integer) from jsonb_array_elements(dispatcher_json) item), 0),
    'declaredAvailableCount', coalesce((select sum((item ->> 'declaredAvailableCount')::integer) from jsonb_array_elements(dispatcher_json) item), 0),
    'declaredUnavailableCount', coalesce((select sum((item ->> 'declaredUnavailableCount')::integer) from jsonb_array_elements(dispatcher_json) item), 0),
    'autoCompletedAvailableCount', coalesce((select sum((item ->> 'autoCompletedAvailableCount')::integer) from jsonb_array_elements(dispatcher_json) item), 0),
    'fridayMorningAvailableCount', coalesce((select sum((item ->> 'fridayMorningAvailableCount')::integer) from jsonb_array_elements(dispatcher_json) item), 0),
    'nightAvailableCount', coalesce((select sum((item ->> 'nightAvailableCount')::integer) from jsonb_array_elements(dispatcher_json) item), 0),
    'premiumAvailableCount', coalesce((select sum((item ->> 'premiumAvailableCount')::integer) from jsonb_array_elements(dispatcher_json) item), 0),
    'holidayAvailableCount', coalesce((select sum((item ->> 'holidayAvailableCount')::integer) from jsonb_array_elements(dispatcher_json) item), 0)
  ) into summary_json;

  return jsonb_build_object(
    'summary', summary_json,
    'dispatcherStatistics', dispatcher_json,
    'monthlyBreakdown', monthly_json,
    'generatedAt', now()
  );
end;
$function$;


create or replace function public.get_morning_driver_statistics(
  requested_year integer default null,
  requested_month integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  current_user_id uuid := auth.uid();
  current_permissions text[];
begin
  if current_user_id is null then
    raise exception 'not authenticated';
  end if;

  current_permissions := coalesce(public.get_my_permissions(), array[]::text[]);
  if not (
    'statistics.view' = any(current_permissions)
    or 'users.manage' = any(current_permissions)
  ) then
    raise exception 'not allowed';
  end if;

  return jsonb_build_object(
    'statistics', coalesce((
      select jsonb_agg(row_data order by (row_data->>'displayName'))
      from (
        select jsonb_build_object(
          'userId', profile.id,
          'displayName', profile.display_name,
          'scheduleName', profile.schedule_name,
          'totalShifts', count(shift_item.id)::integer,
          'morningShifts', count(shift_item.id) filter (where shift_item.start_time < time '12:00')::integer,
          'afternoonShifts', count(shift_item.id) filter (
            where shift_item.start_time >= time '12:00'
              and shift_item.start_time < time '18:00'
          )::integer,
          'eveningShifts', count(shift_item.id) filter (where shift_item.start_time >= time '18:00')::integer,
          'fridayShifts', count(shift_item.id) filter (where shift_item.weekday_number = 5)::integer,
          'weekendShifts', count(shift_item.id) filter (where shift_item.weekday_number in (5, 6))::integer
        ) as row_data
        from public.profiles profile
        left join public.morning_driver_schedule_assignments assignment
          on assignment.assigned_user_id = profile.id
        left join public.morning_driver_schedule_periods period
          on period.id = assignment.schedule_period_id
         and period.status in ('published', 'archived')
         and (requested_year is null or period.year = requested_year)
         and (requested_month is null or period.month = requested_month)
        left join public.morning_driver_availability_shifts shift_item
          on shift_item.id = assignment.availability_shift_id
         and period.id is not null
        where profile.role = 'morning_driver'::public.user_role
          and (
            profile.is_active = true
            or exists (
              select 1
              from public.morning_driver_schedule_assignments historical_assignment
              join public.morning_driver_schedule_periods historical_period
                on historical_period.id = historical_assignment.schedule_period_id
               and historical_period.status in ('published', 'archived')
              where historical_assignment.assigned_user_id = profile.id
                and (requested_year is null or historical_period.year = requested_year)
                and (requested_month is null or historical_period.month = requested_month)
            )
          )
        group by profile.id, profile.display_name, profile.schedule_name
      ) aggregated
    ), '[]'::jsonb),
    'monthlyBreakdown', coalesce((
      select jsonb_agg(
        row_data
        order by (row_data->>'year')::integer,
                 (row_data->>'month')::integer,
                 row_data->>'displayName'
      )
      from (
        select jsonb_build_object(
          'userId', profile.id,
          'displayName', profile.display_name,
          'scheduleName', profile.schedule_name,
          'year', period.year,
          'month', period.month,
          'totalShifts', count(assignment.id)::integer
        ) as row_data
        from public.morning_driver_schedule_assignments assignment
        join public.morning_driver_schedule_periods period
          on period.id = assignment.schedule_period_id
         and period.status in ('published', 'archived')
        join public.profiles profile
          on profile.id = assignment.assigned_user_id
        where (requested_year is null or period.year = requested_year)
          and (requested_month is null or period.month = requested_month)
        group by profile.id, profile.display_name, profile.schedule_name, period.year, period.month
      ) aggregated
    ), '[]'::jsonb),
    'generatedAt', now()
  );
end;
$function$;


create or replace function public.get_payroll_statistics(
  requested_years integer[] default null::integer[],
  requested_months integer[] default null::integer[]
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  current_user_id uuid := auth.uid();
  current_permissions text[];
  dispatchers_json jsonb := '[]'::jsonb;
  drivers_json jsonb := '[]'::jsonb;
  morning_drivers_json jsonb := '[]'::jsonb;
  projected_dispatcher_pay numeric := 0;
  projected_driver_pay numeric := 0;
  projected_morning_driver_pay numeric := 0;
begin
  if current_user_id is null then raise exception 'not authenticated'; end if;
  current_permissions := coalesce(public.get_my_permissions(), array[]::text[]);
  if not ('payroll.view' = any(current_permissions)) then raise exception 'payroll view permission required'; end if;

  with dispatcher_totals as (
    select profile.id user_id, profile.display_name, profile.schedule_name, profile.hourly_rate,
      round(coalesce(sum(case when schedule_period.id is not null then extract(epoch from (schedule_shift.ends_at-schedule_shift.starts_at))/3600.0 else 0 end),0)::numeric,2) scheduled_hours,
      round(coalesce(sum(case when schedule_period.id is not null and schedule_shift.is_premium then extract(epoch from (schedule_shift.ends_at-schedule_shift.starts_at))/3600.0 else 0 end),0)::numeric,2) premium_hours
    from public.profiles profile
    left join public.schedule_shifts schedule_shift on schedule_shift.assigned_user_id=profile.id
    left join public.schedule_periods schedule_period on schedule_period.id=schedule_shift.period_id
      and schedule_period.status::text in ('published','archived')
      and (requested_years is null or cardinality(requested_years)=0 or schedule_period.year=any(requested_years))
      and (requested_months is null or cardinality(requested_months)=0 or schedule_period.month=any(requested_months))
    where profile.role='dispatcher'::public.user_role
      and (
        profile.is_active = true
        or exists (
          select 1
          from public.schedule_shifts historical_shift
          join public.schedule_periods historical_period
            on historical_period.id = historical_shift.period_id
           and historical_period.status::text in ('published','archived')
          where historical_shift.assigned_user_id = profile.id
            and (requested_years is null or cardinality(requested_years)=0 or historical_period.year=any(requested_years))
            and (requested_months is null or cardinality(requested_months)=0 or historical_period.month=any(requested_months))
        )
      )
    group by profile.id,profile.display_name,profile.schedule_name,profile.hourly_rate
  ), rows as (select *, case when hourly_rate is null then null else round(hourly_rate*(scheduled_hours+premium_hours),2) end projected_pay from dispatcher_totals)
  select coalesce(jsonb_agg(jsonb_build_object('userId',user_id,'displayName',display_name,'scheduleName',schedule_name,'hourlyRate',hourly_rate,'scheduledHours',scheduled_hours,'premiumHours',premium_hours,'projectedPay',projected_pay) order by coalesce(schedule_name,display_name)),'[]'::jsonb), coalesce(sum(projected_pay),0) into dispatchers_json,projected_dispatcher_pay from rows;

  with driver_totals as (
    select profile.id user_id, profile.display_name, profile.schedule_name, profile.daily_duty_rate, count(schedule_day.id) filter(where schedule_period.id is not null)::integer total_duties
    from public.profiles profile
    left join public.driver_schedule_days schedule_day on schedule_day.assigned_user_id=profile.id
    left join public.driver_schedule_periods schedule_period on schedule_period.id=schedule_day.period_id and schedule_period.status::text in ('published','archived')
      and (requested_years is null or cardinality(requested_years)=0 or schedule_period.year=any(requested_years))
      and (requested_months is null or cardinality(requested_months)=0 or schedule_period.month=any(requested_months))
    where profile.role='on_call'::public.user_role
      and (
        profile.is_active = true
        or exists (
          select 1
          from public.driver_schedule_days historical_day
          join public.driver_schedule_periods historical_period
            on historical_period.id = historical_day.period_id
           and historical_period.status::text in ('published','archived')
          where historical_day.assigned_user_id = profile.id
            and (requested_years is null or cardinality(requested_years)=0 or historical_period.year=any(requested_years))
            and (requested_months is null or cardinality(requested_months)=0 or historical_period.month=any(requested_months))
        )
      )
    group by profile.id,profile.display_name,profile.schedule_name,profile.daily_duty_rate
  ), rows as (select *,case when daily_duty_rate is null then null else round(daily_duty_rate*total_duties,2) end projected_pay from driver_totals)
  select coalesce(jsonb_agg(jsonb_build_object('userId',user_id,'displayName',display_name,'scheduleName',schedule_name,'dailyDutyRate',daily_duty_rate,'totalDuties',total_duties,'projectedPay',projected_pay) order by coalesce(schedule_name,display_name)),'[]'::jsonb),coalesce(sum(projected_pay),0) into drivers_json,projected_driver_pay from rows;

  with morning_totals as (
    select profile.id user_id, profile.display_name, profile.schedule_name, profile.hourly_rate,
      round(coalesce(sum(case when schedule_period.id is not null then (extract(epoch from (shift_item.end_time-shift_item.start_time))/3600.0 + case when shift_item.end_time<=shift_item.start_time then 24 else 0 end) else 0 end),0)::numeric,2) scheduled_hours
    from public.profiles profile
    left join public.morning_driver_schedule_assignments assignment on assignment.assigned_user_id=profile.id
    left join public.morning_driver_schedule_periods schedule_period on schedule_period.id=assignment.schedule_period_id and schedule_period.status::text in ('published','archived')
      and (requested_years is null or cardinality(requested_years)=0 or schedule_period.year=any(requested_years))
      and (requested_months is null or cardinality(requested_months)=0 or schedule_period.month=any(requested_months))
    left join public.morning_driver_availability_shifts shift_item on shift_item.id=assignment.availability_shift_id
    where profile.role='morning_driver'::public.user_role
      and (
        profile.is_active = true
        or exists (
          select 1
          from public.morning_driver_schedule_assignments historical_assignment
          join public.morning_driver_schedule_periods historical_period
            on historical_period.id = historical_assignment.schedule_period_id
           and historical_period.status::text in ('published','archived')
          where historical_assignment.assigned_user_id = profile.id
            and (requested_years is null or cardinality(requested_years)=0 or historical_period.year=any(requested_years))
            and (requested_months is null or cardinality(requested_months)=0 or historical_period.month=any(requested_months))
        )
      )
    group by profile.id,profile.display_name,profile.schedule_name,profile.hourly_rate
  ), rows as (select *,case when hourly_rate is null then null else round(hourly_rate*scheduled_hours,2) end projected_pay from morning_totals)
  select coalesce(jsonb_agg(jsonb_build_object('userId',user_id,'displayName',display_name,'scheduleName',schedule_name,'hourlyRate',hourly_rate,'scheduledHours',scheduled_hours,'projectedPay',projected_pay) order by coalesce(schedule_name,display_name)),'[]'::jsonb),coalesce(sum(projected_pay),0) into morning_drivers_json,projected_morning_driver_pay from rows;

  return jsonb_build_object('dispatchers',dispatchers_json,'drivers',drivers_json,'morningDrivers',morning_drivers_json,'projectedDispatcherPay',projected_dispatcher_pay,'projectedDriverPay',projected_driver_pay,'projectedMorningDriverPay',projected_morning_driver_pay,'actualPayAvailable',false,'attendanceAvailable',false);
end;
$function$;
