-- Holiday context for driver/morning-driver availability + morning-driver hourly payroll



CREATE OR REPLACE FUNCTION public.update_user_compensation(target_user_id uuid, requested_hourly_rate numeric DEFAULT NULL::numeric, requested_daily_duty_rate numeric DEFAULT NULL::numeric)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  current_user_id uuid := auth.uid();
  current_permissions text[];
  target_role public.user_role;
begin
  if current_user_id is null then
    raise exception 'not authenticated';
  end if;

  current_permissions :=
    coalesce(
      public.get_my_permissions(),
      array[]::text[]
    );

  if not (
    'payroll.manage' =
      any(current_permissions)
  ) then
    raise exception 'payroll manage permission required';
  end if;

  if requested_hourly_rate is not null
    and requested_hourly_rate < 0
  then
    raise exception 'hourly rate cannot be negative';
  end if;

  if requested_daily_duty_rate is not null
    and requested_daily_duty_rate < 0
  then
    raise exception 'daily duty rate cannot be negative';
  end if;

  select role
  into target_role
  from public.profiles
  where id = target_user_id
  for update;

  if not found then
    raise exception 'target user was not found';
  end if;

  if target_role =
    'dispatcher'::public.user_role
  then
    update public.profiles
    set
      hourly_rate = requested_hourly_rate,
      daily_duty_rate = null,
      updated_at = now()
    where id = target_user_id;

  elsif target_role =
    'on_call'::public.user_role
  then
    update public.profiles
    set
      hourly_rate = null,
      daily_duty_rate = requested_daily_duty_rate,
      updated_at = now()
    where id = target_user_id;

  else
    raise exception
      'compensation can currently be configured only for dispatchers, morning drivers and on-call drivers';
  end if;

  return true;
end;
$function$
;


CREATE OR REPLACE FUNCTION public.create_morning_driver_availability_period(requested_year integer, requested_month integer, requested_title text DEFAULT NULL::text, requested_instructions text DEFAULT NULL::text, requested_submission_deadline timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  current_user_id uuid;
  current_permissions text[];

  created_period
    public.morning_driver_availability_periods%rowtype;

  current_date_value date;
  last_date_value date;

  weekday_number_value integer;
  weekday_name_value text;

  created_shifts integer := 0;
  current_sort_order integer := 1;
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
    where id = current_user_id
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
    'morning_driver_availability.manage'
      = any(current_permissions)
  ) then
    raise exception
      'not allowed';
  end if;

  if requested_year is null
     or requested_year < 2020
     or requested_year > 2100
  then
    raise exception
      'invalid year';
  end if;

  if requested_month is null
     or requested_month < 1
     or requested_month > 12
  then
    raise exception
      'invalid month';
  end if;

  if requested_submission_deadline is null then
    raise exception
      'submission deadline is required';
  end if;

  if exists (
    select 1
    from public.morning_driver_availability_periods
    where year = requested_year
      and month = requested_month
  ) then
    raise exception
      'morning driver availability period already exists';
  end if;

  insert into public.morning_driver_availability_periods (
    year,
    month,
    status,
    title,
    instructions,
    submission_deadline,
    created_by,
    updated_by
  )
  values (
    requested_year,
    requested_month,
    'draft',
    nullif(
      trim(
        coalesce(
          requested_title,
          ''
        )
      ),
      ''
    ),
    nullif(
      trim(
        coalesce(
          requested_instructions,
          ''
        )
      ),
      ''
    ),
    requested_submission_deadline,
    current_user_id,
    current_user_id
  )
  returning *
  into created_period;

  current_date_value :=
    make_date(
      requested_year,
      requested_month,
      1
    );

  last_date_value :=
    (
      current_date_value
      + interval '1 month'
      - interval '1 day'
    )::date;

  while current_date_value <= last_date_value loop
    weekday_number_value :=
      extract(
        dow
        from current_date_value
      )::integer;

    weekday_name_value :=
      case weekday_number_value
        when 0 then 'ראשון'
        when 1 then 'שני'
        when 2 then 'שלישי'
        when 3 then 'רביעי'
        when 4 then 'חמישי'
        when 5 then 'שישי'
        when 6 then 'שבת'
      end;

    /*
     * ימים א׳–ה׳:
     * 06:00–16:00 — שני עובדים.
     * 15:00–23:00 — עובד אחד.
     */
    if holiday_schedule_type_value = 'holiday_full'::public.schedule_type then
      null;
    elsif weekday_number_value between 0 and 4 then
      insert into public.morning_driver_availability_shifts (
        period_id,
        shift_date,
        weekday_number,
        weekday_name,
        shift_type,
        start_time,
        end_time,
        required_workers,
        sort_order
      )
      values (
        created_period.id,
        current_date_value,
        weekday_number_value,
        weekday_name_value,
        'weekday_morning',
        time '06:00',
        time '16:00',
        2,
        current_sort_order
      );

      created_shifts :=
        created_shifts + 1;

      current_sort_order :=
        current_sort_order + 1;

      insert into public.morning_driver_availability_shifts (
        period_id,
        shift_date,
        weekday_number,
        weekday_name,
        shift_type,
        start_time,
        end_time,
        required_workers,
        sort_order
      )
      values (
        created_period.id,
        current_date_value,
        weekday_number_value,
        weekday_name_value,
        'weekday_evening',
        time '15:00',
        time '23:00',
        1,
        current_sort_order
      );

      created_shifts :=
        created_shifts + 1;

      current_sort_order :=
        current_sort_order + 1;

    /*
     * יום שישי:
     * 06:00–14:00 — עובד אחד.
     */
    elsif weekday_number_value = 5 then
      insert into public.morning_driver_availability_shifts (
        period_id,
        shift_date,
        weekday_number,
        weekday_name,
        shift_type,
        start_time,
        end_time,
        required_workers,
        sort_order
      )
      values (
        created_period.id,
        current_date_value,
        weekday_number_value,
        weekday_name_value,
        'friday_morning',
        time '06:00',
        time '14:00',
        1,
        current_sort_order
      );

      created_shifts :=
        created_shifts + 1;

      current_sort_order :=
        current_sort_order + 1;
    end if;

    current_date_value :=
      current_date_value + 1;
  end loop;

  perform public.write_audit_log(
    requested_action :=
      'morning_driver_availability_period_created'
        ::public.audit_action_type,

    requested_target_user_id :=
      null,

    requested_summary :=
      'נוצר חודש אילוצים לכונני בוקר',

    requested_old_values :=
      null,

    requested_new_values :=
      jsonb_build_object(
        'periodId',
          created_period.id,

        'year',
          created_period.year,

        'month',
          created_period.month,

        'status',
          created_period.status,

        'createdShifts',
          created_shifts
      ),

    requested_metadata :=
      jsonb_build_object(
        'entityType',
          'morning_driver_availability_period'
      )
  );

  return jsonb_build_object(
    'periodId',
      created_period.id,

    'year',
      created_period.year,

    'month',
      created_period.month,

    'status',
      created_period.status,

    'title',
      created_period.title,

    'instructions',
      created_period.instructions,

    'submissionDeadline',
      created_period.submission_deadline,

    'createdShifts',
      created_shifts
  );
end;
$function$
;


CREATE OR REPLACE FUNCTION public.get_my_driver_availability(requested_period_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  current_user_id uuid;

  current_permissions text[];

  selected_period
    public.driver_availability_periods%rowtype;

  days_json jsonb :=
    '[]'::jsonb;

  entries_json jsonb :=
    '[]'::jsonb;

  submission_json jsonb :=
    null;
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
    'driver_availability.view' =
      any(current_permissions)
  ) then
    raise exception
      'not allowed';
  end if;

  if requested_period_id is not null then
    select *
    into selected_period
    from public.driver_availability_periods
    where id =
      requested_period_id
      and status in (
        'open',
        'closed'
      )
    limit 1;
  else
    select *
    into selected_period
    from public.driver_availability_periods
    where status =
      'open'
    order by
      year desc,
      month desc
    limit 1;
  end if;

  if not found then
    return jsonb_build_object(
      'period',
        null,

      'days',
        '[]'::jsonb,

      'entries',
        '[]'::jsonb,

      'submission',
        null
    );
  end if;

  select
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id',
            day_row.id,

          'periodId',
            day_row.period_id,

          'availabilityDate',
            day_row.availability_date,

          'weekdayNumber',
            day_row.weekday_number,

          'weekdayName',
            day_row.weekday_name,

          'sortOrder',
            day_row.sort_order,

          'createdAt',
            day_row.created_at
        )
        order by
          day_row.availability_date
      ),
      '[]'::jsonb
    )
  into days_json
  from public.driver_availability_days
    day_row
  where day_row.period_id =
    selected_period.id;

  select
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id',
            entry.id,

          'periodId',
            entry.period_id,

          'dayId',
            entry.day_id,

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
        order by
          day_row.availability_date
      ),
      '[]'::jsonb
    )
  into entries_json
  from public.driver_availability_entries
    entry
  join public.driver_availability_days
    day_row
    on day_row.id =
      entry.day_id
  where entry.period_id =
    selected_period.id
    and entry.user_id =
      current_user_id;

  select
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

      'reopenedAt',
        submission.reopened_at,

      'lastSavedAt',
        submission.last_saved_at,

      'availableCount',
        submission.available_count,

      'unavailableCount',
        submission.unavailable_count,

      'createdAt',
        submission.created_at,

      'updatedAt',
        submission.updated_at
    )
  into submission_json
  from public.driver_availability_submissions
    submission
  where submission.period_id =
    selected_period.id
    and submission.user_id =
      current_user_id
  limit 1;

  return jsonb_build_object(
    'period',
      jsonb_build_object(
        'id',
          selected_period.id,

        'year',
          selected_period.year,

        'month',
          selected_period.month,

        'status',
          selected_period.status,

        'title',
          selected_period.title,

        'instructions',
          selected_period.instructions,

        'submissionDeadline',
          selected_period.submission_deadline,

        'openedAt',
          selected_period.opened_at,

        'closedAt',
          selected_period.closed_at,

        'createdBy',
          selected_period.created_by,

        'updatedBy',
          selected_period.updated_by,

        'createdAt',
          selected_period.created_at,

        'updatedAt',
          selected_period.updated_at
      ),

    'days',
      days_json,

    'entries',
      entries_json,

    'submission',
      submission_json
  );
end;
$function$
;


CREATE OR REPLACE FUNCTION public.get_driver_availability_management(requested_period_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  current_user_id uuid;
  current_permissions text[];

  target_period
    public.driver_availability_periods%rowtype;

  days_json jsonb :=
    '[]'::jsonb;

  drivers_json jsonb :=
    '[]'::jsonb;

  submissions_json jsonb :=
    '[]'::jsonb;

  entries_json jsonb :=
    '[]'::jsonb;
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
    'driver_availability.manage' =
      any(current_permissions)
  ) then
    raise exception
      'not allowed';
  end if;

  if requested_period_id is null then
    raise exception
      'driver availability period id is required';
  end if;

  select *
  into target_period
  from public.driver_availability_periods
  where id =
    requested_period_id;

  if not found then
    raise exception
      'driver availability period not found';
  end if;

  select
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id',
            day_row.id,

          'periodId',
            day_row.period_id,

          'availabilityDate',
            day_row.availability_date,

          'weekdayNumber',
            day_row.weekday_number,

          'weekdayName',
            day_row.weekday_name,

          'sortOrder',
            day_row.sort_order,

          'createdAt',
            day_row.created_at
        )
        order by
          day_row.availability_date
      ),
      '[]'::jsonb
    )
  into days_json
  from public.driver_availability_days
    day_row
  where day_row.period_id =
    target_period.id;

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

          'role',
            profile.role::text,

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

  select
    coalesce(
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

          'reopenedAt',
            submission.reopened_at,

          'lastSavedAt',
            submission.last_saved_at,

          'availableCount',
            submission.available_count,

          'unavailableCount',
            submission.unavailable_count,

          'createdAt',
            submission.created_at,

          'updatedAt',
            submission.updated_at
        )
        order by
          submission.user_id
      ),
      '[]'::jsonb
    )
  into submissions_json
  from public.driver_availability_submissions
    submission
  where submission.period_id =
    target_period.id;

  select
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id',
            entry.id,

          'periodId',
            entry.period_id,

          'dayId',
            entry.day_id,

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
        order by
          day_row.availability_date,
          entry.user_id
      ),
      '[]'::jsonb
    )
  into entries_json
  from public.driver_availability_entries
    entry
  join public.driver_availability_days
    day_row
    on day_row.id =
      entry.day_id
  where entry.period_id =
    target_period.id;

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

    'submissions',
      submissions_json,

    'entries',
      entries_json,

    'statistics',
      jsonb_build_object(
        'totalDrivers',
          jsonb_array_length(
            drivers_json
          ),

        'submittedDrivers',
          (
            select
              count(*)::integer
            from public.driver_availability_submissions
            where period_id =
              target_period.id
              and status =
                'submitted'
          ),

        'draftDrivers',
          (
            select
              count(*)::integer
            from public.driver_availability_submissions
            where period_id =
              target_period.id
              and status in (
                'draft',
                'reopened'
              )
          ),

        'notStartedDrivers',
          greatest(
            jsonb_array_length(
              drivers_json
            ) -
            (
              select
                count(
                  distinct user_id
                )::integer
              from public.driver_availability_submissions
              where period_id =
                target_period.id
            ),
            0
          )
      )
  );
end;
$function$
;


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
  where shift_item.period_id = target_period.id
    and coalesce(holiday_row.schedule_type::text, '') <> 'holiday_full';

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
          shift_item.sort_order
      )
      order by
        shift_item.shift_date,
        shift_item.sort_order
    ),
    '[]'::jsonb
  )
  into shifts_json
  from public.morning_driver_availability_shifts shift_item
  where shift_item.period_id = target_period.id;

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



-- Remove full-holiday morning-driver slots from editable periods.
delete from public.morning_driver_availability_entries entry
using public.morning_driver_availability_shifts shift_item, public.morning_driver_availability_periods period
where entry.shift_id = shift_item.id
  and shift_item.period_id = period.id
  and period.status in ('draft','open','closed')
  and exists (select 1 from public.holidays h where h.holiday_date = shift_item.shift_date and h.schedule_type::text = 'holiday_full')
  and not exists (select 1 from public.morning_driver_schedule_assignments a join public.morning_driver_schedule_periods sp on sp.id=a.schedule_period_id where a.availability_shift_id=shift_item.id and sp.status='published');

delete from public.morning_driver_schedule_assignments a
using public.morning_driver_availability_shifts shift_item, public.morning_driver_schedule_periods sp
where a.availability_shift_id = shift_item.id
  and a.schedule_period_id = sp.id
  and sp.status = 'draft'
  and exists (select 1 from public.holidays h where h.holiday_date = shift_item.shift_date and h.schedule_type::text = 'holiday_full');

delete from public.morning_driver_availability_shifts shift_item
using public.morning_driver_availability_periods period
where shift_item.period_id = period.id
  and period.status in ('draft','open','closed')
  and exists (select 1 from public.holidays h where h.holiday_date = shift_item.shift_date and h.schedule_type::text = 'holiday_full')
  and not exists (select 1 from public.morning_driver_schedule_assignments a where a.availability_shift_id=shift_item.id);



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
    where profile.role='dispatcher'::public.user_role and profile.is_active=true
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
    where profile.role='on_call'::public.user_role and profile.is_active=true
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
    where profile.role='morning_driver'::public.user_role and profile.is_active=true
    group by profile.id,profile.display_name,profile.schedule_name,profile.hourly_rate
  ), rows as (select *,case when hourly_rate is null then null else round(hourly_rate*scheduled_hours,2) end projected_pay from morning_totals)
  select coalesce(jsonb_agg(jsonb_build_object('userId',user_id,'displayName',display_name,'scheduleName',schedule_name,'hourlyRate',hourly_rate,'scheduledHours',scheduled_hours,'projectedPay',projected_pay) order by coalesce(schedule_name,display_name)),'[]'::jsonb),coalesce(sum(projected_pay),0) into morning_drivers_json,projected_morning_driver_pay from rows;

  return jsonb_build_object('dispatchers',dispatchers_json,'drivers',drivers_json,'morningDrivers',morning_drivers_json,'projectedDispatcherPay',projected_dispatcher_pay,'projectedDriverPay',projected_driver_pay,'projectedMorningDriverPay',projected_morning_driver_pay,'actualPayAvailable',false,'attendanceAvailable',false);
end;
$function$;
