-- Keep statistical populations and dispatcher scheduling candidates role-based.
-- This is intentional: permissions control access, while role defines which
-- workforce population a profile belongs to for these screens.

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
    select jsonb_agg(
      jsonb_build_object(
        'userId', profile.id,
        'displayName', profile.display_name,
        'scheduleName', profile.schedule_name,
        'userType', case profile.role::text
          when 'dispatcher' then 'dispatchers'
          when 'on_call' then 'drivers'
          when 'morning_driver' then 'morning_drivers'
        end
      )
      order by
        case profile.role::text
          when 'dispatcher' then 1
          when 'on_call' then 2
          when 'morning_driver' then 3
          else 4
        end,
        coalesce(profile.schedule_name, profile.display_name)
    )
    from public.profiles profile
    where profile.is_active = true
      and profile.role::text in ('dispatcher', 'on_call', 'morning_driver')
  ), '[]'::jsonb);
end;
$function$;


create or replace function public.get_schedule_draft_edit_context(
  requested_schedule_period_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  current_user_id uuid := auth.uid();
  target_period public.schedule_periods%rowtype;
  current_permissions text[];
begin
  if current_user_id is null then
    raise exception 'not authenticated';
  end if;

  current_permissions := coalesce(public.get_my_permissions(), array[]::text[]);

  if not ('schedule.edit' = any(current_permissions)) then
    raise exception 'not allowed';
  end if;

  select *
  into target_period
  from public.schedule_periods period
  where period.id = requested_schedule_period_id;

  if not found then
    raise exception 'schedule period not found';
  end if;

  if target_period.status not in (
    'draft'::public.schedule_period_status,
    'scheduling'::public.schedule_period_status
  ) then
    raise exception 'schedule period is not editable as draft';
  end if;

  return jsonb_build_object(
    'periodId', target_period.id,

    'dispatchers', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', profile.id,
          'displayName', profile.display_name,
          'scheduleName', profile.schedule_name
        )
        order by coalesce(profile.schedule_name, profile.display_name)
      )
      from public.profiles profile
      where profile.is_active = true
        and profile.role::text = 'dispatcher'
    ), '[]'::jsonb),

    'shifts', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'scheduleShiftId', schedule_shift.id,
          'availabilityShiftSlotId', schedule_shift.availability_shift_slot_id,

          'availableCount', (
            select count(*)::integer
            from public.dispatcher_availability availability
            join public.profiles profile
              on profile.id = availability.user_id
             and profile.is_active = true
             and profile.role::text = 'dispatcher'
            where availability.period_id = target_period.availability_period_id
              and availability.shift_slot_id = schedule_shift.availability_shift_slot_id
              and availability.availability_status = 'available'
          ),

          'totalDispatchers', (
            select count(*)::integer
            from public.profiles profile
            where profile.is_active = true
              and profile.role::text = 'dispatcher'
          ),

          'candidates', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'userId', profile.id,
                'displayName', profile.display_name,
                'scheduleName', profile.schedule_name,
                'isAvailable', coalesce(availability.availability_status = 'available', false)
              )
              order by coalesce(profile.schedule_name, profile.display_name)
            )
            from public.profiles profile
            left join public.dispatcher_availability availability
              on availability.user_id = profile.id
             and availability.period_id = target_period.availability_period_id
             and availability.shift_slot_id = schedule_shift.availability_shift_slot_id
            where profile.is_active = true
              and profile.role::text = 'dispatcher'
          ), '[]'::jsonb)
        )
        order by schedule_shift.starts_at
      )
      from public.schedule_shifts schedule_shift
      where schedule_shift.period_id = target_period.id
    ), '[]'::jsonb)
  );
end;
$function$;


create or replace function public.update_schedule_draft_shift(
  requested_shift_id uuid,
  requested_new_user_id uuid default null,
  requested_intentionally_unassigned boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  current_user_id uuid := auth.uid();
  current_permissions text[];
  target_shift public.schedule_shifts%rowtype;
  target_period public.schedule_periods%rowtype;
  selected_name text;
begin
  if current_user_id is null then
    raise exception 'not authenticated';
  end if;

  current_permissions := coalesce(public.get_my_permissions(), array[]::text[]);
  if not ('schedule.edit' = any(current_permissions)) then
    raise exception 'not allowed';
  end if;

  select *
  into target_shift
  from public.schedule_shifts shift
  where shift.id = requested_shift_id
  for update;

  if not found then
    raise exception 'schedule shift not found';
  end if;

  select *
  into target_period
  from public.schedule_periods period
  where period.id = target_shift.period_id
  for update;

  if target_period.status not in (
    'draft'::public.schedule_period_status,
    'scheduling'::public.schedule_period_status
  ) then
    raise exception 'only draft schedules can be edited with this action';
  end if;

  if requested_intentionally_unassigned then
    update public.schedule_shifts
    set
      assigned_user_id = null,
      is_intentionally_unassigned = true,
      assignment_source = null,
      assignment_score = null,
      assignment_reasons = jsonb_build_array('המשמרת סומנה במפורש כלא מאוישת.'),
      updated_at = now()
    where id = target_shift.id;

    return jsonb_build_object(
      'shiftId', target_shift.id,
      'assignedUserId', null,
      'assignedUserName', null,
      'isIntentionallyUnassigned', true
    );
  end if;

  if requested_new_user_id is null then
    raise exception 'new user id is required';
  end if;

  select coalesce(profile.schedule_name, profile.display_name)
  into selected_name
  from public.profiles profile
  where profile.id = requested_new_user_id
    and profile.is_active = true
    and profile.role::text = 'dispatcher';

  if selected_name is null then
    raise exception 'selected dispatcher is missing, inactive, or is not a dispatcher';
  end if;

  if exists (
    select 1
    from public.schedule_shifts other_shift
    where other_shift.period_id = target_shift.period_id
      and other_shift.id <> target_shift.id
      and other_shift.assigned_user_id = requested_new_user_id
      and other_shift.starts_at < target_shift.ends_at
      and other_shift.ends_at > target_shift.starts_at
  ) then
    raise exception 'the selected dispatcher has an overlapping shift';
  end if;

  if exists (
    select 1
    from public.schedule_shifts other_shift
    where other_shift.period_id = target_shift.period_id
      and other_shift.id <> target_shift.id
      and other_shift.assigned_user_id = requested_new_user_id
      and (
        other_shift.ends_at = target_shift.starts_at
        or other_shift.starts_at = target_shift.ends_at
      )
  ) then
    raise exception 'the selected dispatcher has a consecutive shift';
  end if;

  update public.schedule_shifts
  set
    assigned_user_id = requested_new_user_id,
    is_intentionally_unassigned = false,
    assignment_source = 'manual'::public.assignment_source,
    assignment_score = null,
    assignment_reasons = jsonb_build_array('שיבוץ ידני מתוך מסך עריכת הטיוטה.'),
    updated_at = now()
  where id = target_shift.id;

  return jsonb_build_object(
    'shiftId', target_shift.id,
    'assignedUserId', requested_new_user_id,
    'assignedUserName', selected_name,
    'isIntentionallyUnassigned', false
  );
end;
$function$;
