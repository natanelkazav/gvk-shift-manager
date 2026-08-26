-- Morning-driver draft shift-time overrides.
-- Times belong to the schedule draft, not the availability source, so editing a
-- draft never rewrites historical availability submissions.

alter table public.morning_driver_schedule_assignments
  add column if not exists scheduled_start_time time,
  add column if not exists scheduled_end_time time;

create or replace function public.update_morning_driver_schedule_shift_time(
  requested_assignment_id uuid,
  requested_start_time time,
  requested_end_time time
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  current_user_id uuid := auth.uid();
  current_permissions text[];
  target_assignment public.morning_driver_schedule_assignments%rowtype;
  target_period public.morning_driver_schedule_periods%rowtype;
begin
  if current_user_id is null then
    raise exception 'not authenticated';
  end if;

  current_permissions := coalesce(public.get_my_permissions(), array[]::text[]);
  if not ('morning_driver_schedule.edit' = any(current_permissions)) then
    raise exception 'not allowed';
  end if;

  if requested_start_time is null or requested_end_time is null then
    raise exception 'start and end time are required';
  end if;

  select * into target_assignment
  from public.morning_driver_schedule_assignments a
  where a.id = requested_assignment_id
  for update;

  if not found then
    raise exception 'morning driver schedule assignment not found';
  end if;

  select * into target_period
  from public.morning_driver_schedule_periods p
  where p.id = target_assignment.schedule_period_id;

  if target_period.status <> 'draft' then
    raise exception 'shift time can be changed only while schedule is draft';
  end if;

  update public.morning_driver_schedule_assignments a
  set scheduled_start_time = requested_start_time,
      scheduled_end_time = requested_end_time,
      updated_at = now()
  where a.schedule_period_id = target_assignment.schedule_period_id
    and a.availability_shift_id = target_assignment.availability_shift_id;

  return jsonb_build_object(
    'schedulePeriodId', target_assignment.schedule_period_id,
    'availabilityShiftId', target_assignment.availability_shift_id,
    'startTime', requested_start_time,
    'endTime', requested_end_time
  );
end;
$function$;

grant execute on function public.update_morning_driver_schedule_shift_time(uuid, time, time) to authenticated;

-- Keep the existing schedule contract, but expose draft/published schedule-time
-- overrides. We patch the latest function body in-place by redefining it from
-- the current project migration and replacing only the two JSON fields.


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
            coalesce(assignment.scheduled_start_time, shift_item.start_time),

          'endTime',
            coalesce(assignment.scheduled_end_time, shift_item.end_time),

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
