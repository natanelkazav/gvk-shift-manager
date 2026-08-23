-- Auto-complete unmarked availability as available when a manager closes a period.
-- Existing answers are preserved.
-- Users who did not submit remain draft/reopened for tracking purposes.

create or replace function public.close_availability_period(
  requested_period_id uuid
)
returns table(
  period_id uuid,
  period_status text,
  closed_at timestamp with time zone,
  total_dispatchers integer,
  submitted_dispatchers integer
)
language plpgsql
security definer
set search_path to ''
as $function$
declare
  current_user_id uuid;
  current_actor_email text;
  current_actor_display_name text;
  target_period_title text;
  target_period_year integer;
  target_period_month integer;
  target_period_status text;
  calculated_total_dispatchers integer;
  calculated_submitted_dispatchers integer;
  target_closed_at timestamptz;
  auto_completed_entries integer := 0;
  auto_completed_users integer := 0;
  auto_note constant text :=
    'סומן כזמין אוטומטית עקב אי־הגשה עד מועד סגירת התקופה.';
begin
  current_user_id := auth.uid();

  if current_user_id is null then
    raise exception 'User is not authenticated';
  end if;

  select
    profile.email,
    profile.display_name
  into
    current_actor_email,
    current_actor_display_name
  from public.profiles profile
  where profile.id = current_user_id
    and profile.is_active = true;

  if current_actor_email is null then
    raise exception 'Authenticated user is not active';
  end if;

  if not exists (
    select 1
    from public.user_permissions permission
    where permission.user_id = current_user_id
      and permission.permission_key = 'availability.manage'
  ) then
    raise exception 'User is not allowed to manage availability periods';
  end if;

  if requested_period_id is null then
    raise exception 'Availability period id is required';
  end if;

  select
    period.title,
    period.year,
    period.month,
    period.status
  into
    target_period_title,
    target_period_year,
    target_period_month,
    target_period_status
  from public.availability_periods period
  where period.id = requested_period_id
  for update;

  if target_period_year is null then
    raise exception 'Availability period was not found';
  end if;

  if target_period_status <> 'open' then
    raise exception 'Only open availability periods can be closed';
  end if;

  select count(*)::integer
  into calculated_total_dispatchers
  from public.profiles profile
  where profile.role::text = 'dispatcher'
    and profile.is_active = true;

  select count(*)::integer
  into calculated_submitted_dispatchers
  from public.availability_submissions submission
  join public.profiles profile
    on profile.id = submission.user_id
  where submission.period_id = requested_period_id
    and submission.status = 'submitted'
    and profile.role::text = 'dispatcher'
    and profile.is_active = true;

  if calculated_total_dispatchers = 0 then
    raise exception 'No active dispatchers were found';
  end if;

  target_closed_at := now();

  select count(*)::integer
  into auto_completed_users
  from public.profiles profile
  left join public.availability_submissions submission
    on submission.period_id = requested_period_id
   and submission.user_id = profile.id
  where profile.role::text = 'dispatcher'
    and profile.is_active = true
    and coalesce(submission.status, 'draft') <> 'submitted';

  insert into public.availability_submissions (
    period_id,
    user_id,
    status,
    last_saved_at,
    available_count,
    unavailable_count
  )
  select
    requested_period_id,
    profile.id,
    'draft',
    target_closed_at,
    0,
    0
  from public.profiles profile
  where profile.role::text = 'dispatcher'
    and profile.is_active = true
    and not exists (
      select 1
      from public.availability_submissions existing_submission
      where existing_submission.period_id = requested_period_id
        and existing_submission.user_id = profile.id
    );

  insert into public.dispatcher_availability (
    period_id,
    shift_slot_id,
    user_id,
    availability_status,
    note,
    created_at,
    updated_at
  )
  select
    requested_period_id,
    slot.id,
    profile.id,
    'available',
    auto_note,
    target_closed_at,
    target_closed_at
  from public.profiles profile
  cross join public.availability_shift_slots slot
  left join public.availability_submissions submission
    on submission.period_id = requested_period_id
   and submission.user_id = profile.id
  where slot.period_id = requested_period_id
    and profile.role::text = 'dispatcher'
    and profile.is_active = true
    and coalesce(submission.status, 'draft') <> 'submitted'
    and not exists (
      select 1
      from public.dispatcher_availability existing_entry
      where existing_entry.period_id = requested_period_id
        and existing_entry.shift_slot_id = slot.id
        and existing_entry.user_id = profile.id
    )
  on conflict on constraint dispatcher_availability_unique
  do nothing;

  get diagnostics auto_completed_entries = row_count;

  update public.availability_submissions submission
  set
    available_count = (
      select count(*)::integer
      from public.dispatcher_availability entry
      where entry.period_id = requested_period_id
        and entry.user_id = submission.user_id
        and entry.availability_status = 'available'
    ),
    unavailable_count = (
      select count(*)::integer
      from public.dispatcher_availability entry
      where entry.period_id = requested_period_id
        and entry.user_id = submission.user_id
        and entry.availability_status = 'unavailable'
    ),
    last_saved_at = coalesce(
      submission.last_saved_at,
      target_closed_at
    ),
    updated_at = target_closed_at
  where submission.period_id = requested_period_id
    and submission.status <> 'submitted';

  update public.availability_periods period
  set
    status = 'closed',
    closed_at = target_closed_at,
    updated_by = current_user_id,
    updated_at = target_closed_at
  where period.id = requested_period_id;

  insert into public.audit_logs (
    action,
    actor_user_id,
    actor_email,
    actor_display_name,
    target_user_id,
    target_email,
    target_display_name,
    entity_type,
    entity_id,
    summary,
    old_values,
    new_values,
    metadata
  )
  values (
    'availability_period_closed',
    current_user_id,
    current_actor_email,
    current_actor_display_name,
    null,
    null,
    null,
    'availability_period',
    requested_period_id,
    format(
      'נסגרה תקופת אילוצים: %s',
      coalesce(
        target_period_title,
        format('%s/%s', target_period_month, target_period_year)
      )
    ),
    jsonb_build_object(
      'status', 'open'
    ),
    jsonb_build_object(
      'status', 'closed',
      'closed_at', target_closed_at,
      'total_dispatchers', calculated_total_dispatchers,
      'submitted_dispatchers', calculated_submitted_dispatchers,
      'auto_completed_users', auto_completed_users,
      'auto_completed_entries', auto_completed_entries
    ),
    jsonb_build_object(
      'source', 'close-availability-period-rpc',
      'period_id', requested_period_id,
      'year', target_period_year,
      'month', target_period_month,
      'auto_fill_unmarked_as_available', true
    )
  );

  return query
  select
    requested_period_id,
    'closed'::text,
    target_closed_at,
    calculated_total_dispatchers,
    calculated_submitted_dispatchers;
end;
$function$;


create or replace function public.close_driver_availability_period(
  requested_period_id uuid,
  requested_force boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  current_user_id uuid;
  current_permissions text[];
  target_period public.driver_availability_periods%rowtype;
  total_drivers_count integer := 0;
  submitted_drivers_count integer := 0;
  missing_drivers_count integer := 0;
  auto_completed_entries integer := 0;
  auto_completed_users integer := 0;
  closed_at_value timestamptz := now();
  auto_note constant text :=
    'סומן כזמין אוטומטית עקב אי־הגשה עד מועד סגירת התקופה.';
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
    'driver_availability.manage' =
      any(current_permissions)
  ) then
    raise exception 'not allowed';
  end if;

  if requested_period_id is null then
    raise exception 'driver availability period id is required';
  end if;

  select *
  into target_period
  from public.driver_availability_periods
  where id = requested_period_id
  for update;

  if not found then
    raise exception 'driver availability period not found';
  end if;

  select count(*)::integer
  into total_drivers_count
  from public.profiles
  where role = 'on_call'::public.user_role
    and is_active = true;

  select count(distinct submission.user_id)::integer
  into submitted_drivers_count
  from public.driver_availability_submissions submission
  join public.profiles profile
    on profile.id = submission.user_id
  where submission.period_id = target_period.id
    and submission.status = 'submitted'
    and profile.role = 'on_call'::public.user_role
    and profile.is_active = true;

  missing_drivers_count :=
    greatest(
      total_drivers_count - submitted_drivers_count,
      0
    );

  if target_period.status = 'closed' then
    return jsonb_build_object(
      'periodId', target_period.id,
      'year', target_period.year,
      'month', target_period.month,
      'status', target_period.status,
      'closedAt', target_period.closed_at,
      'totalDrivers', total_drivers_count,
      'submittedDrivers', submitted_drivers_count,
      'missingDrivers', missing_drivers_count,
      'autoCompletedUsers', 0,
      'autoCompletedEntries', 0,
      'forced', false,
      'alreadyClosed', true
    );
  end if;

  if target_period.status <> 'open' then
    raise exception
      'only open driver availability periods can be closed';
  end if;

  select count(*)::integer
  into auto_completed_users
  from public.profiles profile
  left join public.driver_availability_submissions submission
    on submission.period_id = target_period.id
   and submission.user_id = profile.id
  where profile.role = 'on_call'::public.user_role
    and profile.is_active = true
    and coalesce(submission.status, 'draft') <> 'submitted';

  insert into public.driver_availability_submissions (
    period_id,
    user_id,
    status,
    last_saved_at,
    available_count,
    unavailable_count
  )
  select
    target_period.id,
    profile.id,
    'draft',
    closed_at_value,
    0,
    0
  from public.profiles profile
  where profile.role = 'on_call'::public.user_role
    and profile.is_active = true
    and not exists (
      select 1
      from public.driver_availability_submissions existing_submission
      where existing_submission.period_id = target_period.id
        and existing_submission.user_id = profile.id
    );

  insert into public.driver_availability_entries (
    period_id,
    day_id,
    user_id,
    availability_status,
    note,
    updated_at
  )
  select
    target_period.id,
    day_row.id,
    profile.id,
    'available',
    auto_note,
    closed_at_value
  from public.profiles profile
  cross join public.driver_availability_days day_row
  left join public.driver_availability_submissions submission
    on submission.period_id = target_period.id
   and submission.user_id = profile.id
  where day_row.period_id = target_period.id
    and profile.role = 'on_call'::public.user_role
    and profile.is_active = true
    and coalesce(submission.status, 'draft') <> 'submitted'
    and not exists (
      select 1
      from public.driver_availability_entries existing_entry
      where existing_entry.period_id = target_period.id
        and existing_entry.day_id = day_row.id
        and existing_entry.user_id = profile.id
    )
  on conflict (day_id, user_id)
  do nothing;

  get diagnostics auto_completed_entries = row_count;

  update public.driver_availability_submissions submission
  set
    available_count = (
      select count(*)::integer
      from public.driver_availability_entries entry
      where entry.period_id = target_period.id
        and entry.user_id = submission.user_id
        and entry.availability_status = 'available'
    ),
    unavailable_count = (
      select count(*)::integer
      from public.driver_availability_entries entry
      where entry.period_id = target_period.id
        and entry.user_id = submission.user_id
        and entry.availability_status = 'unavailable'
    ),
    last_saved_at = coalesce(
      submission.last_saved_at,
      closed_at_value
    ),
    updated_at = closed_at_value
  where submission.period_id = target_period.id
    and submission.status <> 'submitted';

  update public.driver_availability_periods
  set
    status = 'closed',
    closed_at = closed_at_value,
    updated_by = current_user_id,
    updated_at = closed_at_value
  where id = target_period.id
  returning *
  into target_period;

  return jsonb_build_object(
    'periodId', target_period.id,
    'year', target_period.year,
    'month', target_period.month,
    'status', target_period.status,
    'closedAt', target_period.closed_at,
    'totalDrivers', total_drivers_count,
    'submittedDrivers', submitted_drivers_count,
    'missingDrivers', missing_drivers_count,
    'autoCompletedUsers', auto_completed_users,
    'autoCompletedEntries', auto_completed_entries,
    'forced', false,
    'alreadyClosed', false
  );
end;
$function$;


create or replace function public.close_morning_driver_availability_period(
  requested_period_id uuid,
  requested_force boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  current_user_id uuid;
  current_permissions text[];
  target_period public.morning_driver_availability_periods%rowtype;
  total_drivers integer := 0;
  submitted_drivers integer := 0;
  missing_drivers integer := 0;
  auto_completed_entries integer := 0;
  auto_completed_users integer := 0;
  closed_at_value timestamptz := now();
  auto_note constant text :=
    'סומן כזמין אוטומטית עקב אי־הגשה עד מועד סגירת התקופה.';
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
    'morning_driver_availability.manage' =
      any(current_permissions)
  ) then
    raise exception 'not allowed';
  end if;

  if requested_period_id is null then
    raise exception 'period id is required';
  end if;

  select *
  into target_period
  from public.morning_driver_availability_periods period
  where period.id = requested_period_id
  for update;

  if not found then
    raise exception
      'morning driver availability period not found';
  end if;

  select count(*)
  into total_drivers
  from public.profiles profile
  where profile.role =
      'morning_driver'::public.user_role
    and profile.is_active = true;

  select count(*)
  into submitted_drivers
  from public.morning_driver_availability_submissions submission
  join public.profiles profile
    on profile.id = submission.user_id
  where submission.period_id = target_period.id
    and submission.status = 'submitted'
    and profile.role =
      'morning_driver'::public.user_role
    and profile.is_active = true;

  missing_drivers :=
    greatest(
      total_drivers - submitted_drivers,
      0
    );

  if target_period.status = 'closed' then
    return jsonb_build_object(
      'periodId', target_period.id,
      'year', target_period.year,
      'month', target_period.month,
      'status', target_period.status,
      'closedAt', target_period.closed_at,
      'totalDrivers', total_drivers,
      'submittedDrivers', submitted_drivers,
      'missingDrivers', missing_drivers,
      'autoCompletedUsers', 0,
      'autoCompletedEntries', 0,
      'forced', false,
      'alreadyClosed', true
    );
  end if;

  if target_period.status <> 'open' then
    raise exception 'only open periods can be closed';
  end if;

  select count(*)::integer
  into auto_completed_users
  from public.profiles profile
  left join public.morning_driver_availability_submissions submission
    on submission.period_id = target_period.id
   and submission.user_id = profile.id
  where profile.role =
      'morning_driver'::public.user_role
    and profile.is_active = true
    and coalesce(submission.status, 'draft') <> 'submitted';

  insert into public.morning_driver_availability_submissions (
    period_id,
    user_id,
    status
  )
  select
    target_period.id,
    profile.id,
    'draft'
  from public.profiles profile
  where profile.role =
      'morning_driver'::public.user_role
    and profile.is_active = true
    and not exists (
      select 1
      from public.morning_driver_availability_submissions existing_submission
      where existing_submission.period_id = target_period.id
        and existing_submission.user_id = profile.id
    );

  insert into public.morning_driver_availability_entries (
    period_id,
    shift_id,
    user_id,
    availability_status,
    note,
    updated_at
  )
  select
    target_period.id,
    shift_item.id,
    profile.id,
    'available',
    auto_note,
    closed_at_value
  from public.profiles profile
  cross join public.morning_driver_availability_shifts shift_item
  left join public.morning_driver_availability_submissions submission
    on submission.period_id = target_period.id
   and submission.user_id = profile.id
  where shift_item.period_id = target_period.id
    and profile.role =
      'morning_driver'::public.user_role
    and profile.is_active = true
    and coalesce(submission.status, 'draft') <> 'submitted'
    and not exists (
      select 1
      from public.morning_driver_availability_entries existing_entry
      where existing_entry.period_id = target_period.id
        and existing_entry.shift_id = shift_item.id
        and existing_entry.user_id = profile.id
    )
  on conflict (shift_id, user_id)
  do nothing;

  get diagnostics auto_completed_entries = row_count;

  update public.morning_driver_availability_submissions submission
  set
    last_saved_at = coalesce(
      submission.last_saved_at,
      closed_at_value
    ),
    updated_at = closed_at_value
  where submission.period_id = target_period.id
    and submission.status <> 'submitted';

  update public.morning_driver_availability_periods
  set
    status = 'closed',
    closed_at = closed_at_value,
    updated_by = current_user_id,
    updated_at = closed_at_value
  where id = target_period.id
  returning *
  into target_period;

  return jsonb_build_object(
    'periodId', target_period.id,
    'year', target_period.year,
    'month', target_period.month,
    'status', target_period.status,
    'closedAt', target_period.closed_at,
    'totalDrivers', total_drivers,
    'submittedDrivers', submitted_drivers,
    'missingDrivers', missing_drivers,
    'autoCompletedUsers', auto_completed_users,
    'autoCompletedEntries', auto_completed_entries,
    'forced', false,
    'alreadyClosed', false
  );
end;
$function$;

notify pgrst, 'reload schema';
