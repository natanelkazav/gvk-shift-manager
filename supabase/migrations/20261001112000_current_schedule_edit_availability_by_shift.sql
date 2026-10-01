-- Show the original submitted dispatcher availability while editing a published
-- current/next-month schedule shift. Availability is resolved for the exact
-- availability slot that produced the published schedule shift.

create or replace function public.get_current_schedule_edit_options(
  requested_shift_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  actor_user_id uuid := auth.uid();
  target_shift public.schedule_shifts%rowtype;
  target_period public.schedule_periods%rowtype;
  dispatcher_rows jsonb;
begin
  if actor_user_id is null then
    raise exception 'not authenticated';
  end if;

  if not exists (
    select 1
    from public.profiles profile
    where profile.id = actor_user_id
      and profile.is_active = true
  ) then
    raise exception 'user not active';
  end if;

  if not ('schedule.edit' = any(coalesce(public.get_my_permissions(), array[]::text[]))) then
    raise exception 'schedule edit permission required';
  end if;

  select *
  into target_shift
  from public.schedule_shifts shift
  where shift.id = requested_shift_id;

  if not found then
    raise exception 'schedule shift not found';
  end if;

  select *
  into target_period
  from public.schedule_periods period
  where period.id = target_shift.period_id;

  if not found then
    raise exception 'schedule period not found';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', profile.id,
        'displayName', profile.display_name,
        'scheduleName', profile.schedule_name,
        'availabilityStatus', availability.availability_status,
        'isAutoCompleted', coalesce(availability.is_auto_completed, false)
      )
      order by
        case
          when availability.availability_status = 'available'
            and not coalesce(availability.is_auto_completed, false) then 0
          when availability.availability_status = 'unavailable' then 1
          when availability.availability_status = 'available'
            and coalesce(availability.is_auto_completed, false) then 2
          else 3
        end,
        coalesce(profile.schedule_name, profile.display_name)
    ),
    '[]'::jsonb
  )
  into dispatcher_rows
  from public.profiles profile
  left join public.dispatcher_availability availability
    on availability.user_id = profile.id
   and availability.period_id = target_period.availability_period_id
   and availability.shift_slot_id = target_shift.availability_shift_slot_id
  where profile.is_active = true
    and profile.role::text = 'dispatcher';

  return jsonb_build_object(
    'dispatchers', dispatcher_rows
  );
end;
$function$;

revoke all on function public.get_current_schedule_edit_options(uuid) from public;
grant execute on function public.get_current_schedule_edit_options(uuid) to authenticated;
