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
      profile_row.is_active = true

      and profile_row.role =
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
      profile_row.is_active = true

      and profile_row.role =
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
      profile_row.is_active = true

      and profile_row.role =
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
      profile_row.is_active = true

      and profile_row.role =
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
$function$
;

-- Stable people source for the statistics selectors.
-- The selectors must not depend on whether the selected period already has statistics rows.
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

  return coalesce((
    select jsonb_agg(person_row order by person_row->>'userType', person_row->>'displayName')
    from (
      select distinct jsonb_build_object(
        'userId', profile.id,
        'displayName', profile.display_name,
        'scheduleName', profile.schedule_name,
        'userType', category.user_type
      ) as person_row
      from public.profiles profile
      cross join lateral (
        values
          ('dispatchers'::text, 'schedule.view'::text),
          ('drivers'::text, 'driver_schedule.view'::text),
          ('morning_drivers'::text, 'morning_driver_schedule.view'::text)
      ) as category(user_type, permission_key)
      where profile.is_active = true
        and exists (
          select 1
          from public.user_permissions permission
          where permission.user_id = profile.id
            and permission.permission_key = category.permission_key
        )
    ) people
  ), '[]'::jsonb);
end;
$function$;

-- Morning-driver statistics. This replaces the previous function and fixes the
-- monthly query that referenced shift_item without joining it.
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
        where profile.is_active = true
          and exists (
            select 1
            from public.user_permissions permission
            where permission.user_id = profile.id
              and permission.permission_key = 'morning_driver_schedule.view'
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
