-- Fix dispatcher availability period lifecycle:
-- 1. Closing a period auto-completes every unmarked shift as available.
-- 2. Auto-completed dispatcher submissions are finalized as submitted.
-- 3. Reopening a closed period uses the current audit_logs schema and
--    moves submitted forms to reopened so dispatchers can edit again.

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
  originally_submitted_dispatchers integer;
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
  into originally_submitted_dispatchers
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
    status = 'submitted',
    submitted_at = coalesce(submission.submitted_at, target_closed_at),
    reopened_at = null,
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
    last_saved_at = coalesce(submission.last_saved_at, target_closed_at),
    updated_at = target_closed_at
  where submission.period_id = requested_period_id
    and submission.status <> 'submitted';

  select count(*)::integer
  into calculated_submitted_dispatchers
  from public.availability_submissions submission
  join public.profiles profile
    on profile.id = submission.user_id
  where submission.period_id = requested_period_id
    and submission.status = 'submitted'
    and profile.role::text = 'dispatcher'
    and profile.is_active = true;

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
    jsonb_build_object('status', 'open'),
    jsonb_build_object(
      'status', 'closed',
      'closed_at', target_closed_at,
      'total_dispatchers', calculated_total_dispatchers,
      'submitted_dispatchers', calculated_submitted_dispatchers,
      'originally_submitted_dispatchers', originally_submitted_dispatchers,
      'auto_completed_users', auto_completed_users,
      'auto_completed_entries', auto_completed_entries
    ),
    jsonb_build_object(
      'source', 'close-availability-period-rpc',
      'period_id', requested_period_id,
      'year', target_period_year,
      'month', target_period_month,
      'auto_fill_unmarked_as_available', true,
      'auto_submit_completed_forms', true
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


create or replace function public.reopen_availability_period(
  requested_period_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  current_user_id uuid := auth.uid();
  current_actor_email text;
  current_actor_display_name text;
  target_period public.availability_periods%rowtype;
  reopened_at_value timestamptz := now();
begin
  if current_user_id is null then
    raise exception 'not authenticated';
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
    raise exception 'user not active';
  end if;

  if not exists (
    select 1
    from public.user_permissions permission
    where permission.user_id = current_user_id
      and permission.permission_key = 'availability.manage'
  ) then
    raise exception 'not allowed';
  end if;

  if requested_period_id is null then
    raise exception 'availability period id is required';
  end if;

  select *
  into target_period
  from public.availability_periods period
  where period.id = requested_period_id
  for update;

  if not found then
    raise exception 'availability period not found';
  end if;

  if target_period.status <> 'closed' then
    raise exception 'only closed availability periods can be reopened';
  end if;

  update public.availability_periods
  set
    status = 'open',
    opened_at = reopened_at_value,
    closed_at = null,
    updated_by = current_user_id,
    updated_at = reopened_at_value
  where id = target_period.id;

  update public.availability_submissions
  set
    status = 'reopened',
    reopened_at = reopened_at_value,
    updated_at = reopened_at_value
  where period_id = target_period.id
    and status = 'submitted';

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
    'availability_period_opened',
    current_user_id,
    current_actor_email,
    current_actor_display_name,
    null,
    null,
    null,
    'availability_period',
    target_period.id,
    format(
      'נפתחה מחדש תקופת אילוצים: %s',
      coalesce(
        target_period.title,
        format('%s/%s', target_period.month, target_period.year)
      )
    ),
    jsonb_build_object(
      'status', 'closed',
      'closed_at', target_period.closed_at
    ),
    jsonb_build_object(
      'status', 'open',
      'opened_at', reopened_at_value,
      'closed_at', null
    ),
    jsonb_build_object(
      'source', 'reopen-availability-period-rpc',
      'period_id', target_period.id,
      'year', target_period.year,
      'month', target_period.month
    )
  );

  return jsonb_build_object(
    'periodId', target_period.id,
    'periodStatus', 'open',
    'openedAt', reopened_at_value
  );
end;
$function$;
