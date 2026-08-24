-- Dispatcher availability statistics and submission provenance.
-- Auto-filled availability stays valid for scheduling, but is tracked separately
-- so management statistics never treat it as a dispatcher-declared preference.

alter table public.dispatcher_availability
  add column if not exists is_auto_completed boolean not null default false;

alter table public.availability_submissions
  add column if not exists submission_source text not null default 'manual';

alter table public.availability_submissions
  add column if not exists auto_completed_count integer not null default 0;

alter table public.availability_submissions
  drop constraint if exists availability_submissions_submission_source_check;

alter table public.availability_submissions
  add constraint availability_submissions_submission_source_check
  check (submission_source in ('manual', 'auto_partial', 'auto_no_submission'));

-- Backfill entries created by the existing automatic close-period behavior.
update public.dispatcher_availability
set is_auto_completed = true
where note = 'סומן כזמין אוטומטית עקב אי־הגשה עד מועד סגירת התקופה.';

update public.availability_submissions submission
set
  auto_completed_count = stats.auto_count,
  submission_source =
    case
      when stats.auto_count = 0 then 'manual'
      when stats.auto_count >= stats.total_count then 'auto_no_submission'
      else 'auto_partial'
    end
from (
  select
    entry.period_id,
    entry.user_id,
    count(*)::integer as total_count,
    count(*) filter (where entry.is_auto_completed)::integer as auto_count
  from public.dispatcher_availability entry
  group by entry.period_id, entry.user_id
) stats
where submission.period_id = stats.period_id
  and submission.user_id = stats.user_id;

CREATE OR REPLACE FUNCTION public.save_my_shift_availability(requested_shift_slot_id uuid, requested_availability_status text, requested_note text DEFAULT NULL::text)
 RETURNS TABLE(shift_slot_id uuid, availability_status text, availability_note text, availability_updated_at timestamp with time zone, available_count integer, unavailable_count integer, answered_count integer, total_shift_count integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  current_user_id uuid;

  target_period_id uuid;
  target_period_status text;
  target_submission_deadline timestamptz;

  target_submission_status text;

  normalized_note text;
  saved_at timestamptz;

  calculated_available_count integer;
  calculated_unavailable_count integer;
  calculated_total_shift_count integer;
begin
  current_user_id := auth.uid();

  if current_user_id is null then
    raise exception
      'User is not authenticated';
  end if;

  if not exists (
    select 1
    from public.profiles profile
    where profile.id = current_user_id
      and profile.is_active = true
  ) then
    raise exception
      'Authenticated user is not active';
  end if;

  if not exists (
    select 1
    from public.user_permissions permission
    where permission.user_id =
      current_user_id
      and permission.permission_key =
        'availability.view'
  ) then
    raise exception
      'User is not allowed to submit availability';
  end if;

  if requested_shift_slot_id is null then
    raise exception
      'Shift slot id is required';
  end if;

  if requested_availability_status not in (
    'available',
    'unavailable'
  ) then
    raise exception
      'Invalid availability status';
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

  if (
    normalized_note is not null
    and length(normalized_note) > 1000
  ) then
    raise exception
      'Availability note is too long';
  end if;

  select
    period.id,
    period.status,
    period.submission_deadline
  into
    target_period_id,
    target_period_status,
    target_submission_deadline
  from public.availability_shift_slots slot
  join public.availability_periods period
    on period.id = slot.period_id
  where slot.id =
    requested_shift_slot_id;

  if target_period_id is null then
    raise exception
      'Shift slot was not found';
  end if;

  if target_period_status <> 'open' then
    raise exception
      'Availability period is not open';
  end if;

  if (
    target_submission_deadline is not null
    and target_submission_deadline <= now()
  ) then
    raise exception
      'Availability submission deadline has passed';
  end if;

  select
    submission.status
  into
    target_submission_status
  from public.availability_submissions submission
  where submission.period_id =
    target_period_id
    and submission.user_id =
      current_user_id
  for update;

  if target_submission_status is null then
    insert into
      public.availability_submissions (
        period_id,
        user_id,
        status,
        available_count,
        unavailable_count
      )
    values (
      target_period_id,
      current_user_id,
      'draft',
      0,
      0
    );

    target_submission_status :=
      'draft';
  end if;

  if target_submission_status =
    'submitted' then
    raise exception
      'Availability submission is already submitted';
  end if;

  saved_at := now();

  insert into
    public.dispatcher_availability (
      period_id,
      shift_slot_id,
      user_id,
      availability_status,
      note,
      is_auto_completed,
      created_at,
      updated_at
    )
  values (
    target_period_id,
    requested_shift_slot_id,
    current_user_id,
    requested_availability_status,
    normalized_note,
    false,
    saved_at,
    saved_at
  )
  on conflict on constraint
    dispatcher_availability_unique
  do update set
    availability_status =
      excluded.availability_status,

    note =
      excluded.note,

    is_auto_completed =
      false,

    updated_at =
      excluded.updated_at;

  select
    count(*) filter (
      where availability.availability_status =
        'available'
    )::integer,

    count(*) filter (
      where availability.availability_status =
        'unavailable'
    )::integer
  into
    calculated_available_count,
    calculated_unavailable_count
  from public.dispatcher_availability
    availability
  where availability.period_id =
    target_period_id
    and availability.user_id =
      current_user_id;

  select
    count(*)::integer
  into
    calculated_total_shift_count
  from public.availability_shift_slots slot
  where slot.period_id =
    target_period_id;

  update public.availability_submissions
  set
    available_count =
      calculated_available_count,

    unavailable_count =
      calculated_unavailable_count,

    last_saved_at =
      saved_at,

    submission_source =
      'manual',

    updated_at =
      saved_at
  where period_id =
    target_period_id
    and user_id =
      current_user_id;

  return query
  select
    requested_shift_slot_id,

    requested_availability_status,

    normalized_note,

    saved_at,

    calculated_available_count,

    calculated_unavailable_count,

    calculated_available_count
      + calculated_unavailable_count,

    calculated_total_shift_count;
end;
$function$;

CREATE OR REPLACE FUNCTION public.submit_my_availability()
 RETURNS TABLE(period_id uuid, submission_status text, submitted_at timestamp with time zone, available_count integer, unavailable_count integer, answered_count integer, total_shift_count integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  current_user_id uuid;

  current_user_email text;
  current_user_display_name text;

  target_period_id uuid;
  target_period_title text;
  target_period_year integer;
  target_period_month integer;
  target_period_status text;
  target_submission_deadline timestamptz;

  current_submission_status text;

  calculated_available_count integer;
  calculated_unavailable_count integer;
  calculated_answered_count integer;
  calculated_total_shift_count integer;
  calculated_auto_completed_count integer;

  submitted_timestamp timestamptz;
begin
  current_user_id := auth.uid();

  if current_user_id is null then
    raise exception
      'User is not authenticated';
  end if;

  select
    profile.email,
    profile.display_name
  into
    current_user_email,
    current_user_display_name
  from public.profiles profile
  where profile.id = current_user_id
    and profile.is_active = true;

  if current_user_email is null then
    raise exception
      'Authenticated user is not active';
  end if;

  if not exists (
    select 1
    from public.user_permissions permission
    where permission.user_id =
      current_user_id
      and permission.permission_key =
        'availability.view'
  ) then
    raise exception
      'User is not allowed to submit availability';
  end if;

  select
    period.id,
    period.title,
    period.year,
    period.month,
    period.status,
    period.submission_deadline
  into
    target_period_id,
    target_period_title,
    target_period_year,
    target_period_month,
    target_period_status,
    target_submission_deadline
  from public.availability_periods period
  where period.status = 'open'
  order by
    period.year desc,
    period.month desc,
    period.opened_at desc nulls last
  limit 1;

  if target_period_id is null then
    raise exception
      'Open availability period was not found';
  end if;

  if target_period_status <> 'open' then
    raise exception
      'Availability period is not open';
  end if;

  if (
    target_submission_deadline is not null
    and target_submission_deadline <= now()
  ) then
    raise exception
      'Availability submission deadline has passed';
  end if;

  select
    submission.status
  into
    current_submission_status
  from public.availability_submissions submission
  where submission.period_id =
    target_period_id
    and submission.user_id =
      current_user_id
  for update;

  if current_submission_status is null then
    raise exception
      'Availability submission record was not found';
  end if;

  if current_submission_status = 'submitted' then
    raise exception
      'Availability submission is already submitted';
  end if;

  select
    count(*) filter (
      where availability.availability_status =
        'available'
    )::integer,

    count(*) filter (
      where availability.availability_status =
        'unavailable'
    )::integer
  into
    calculated_available_count,
    calculated_unavailable_count
  from public.dispatcher_availability availability
  where availability.period_id =
    target_period_id
    and availability.user_id =
      current_user_id;

  calculated_answered_count :=
    calculated_available_count
    + calculated_unavailable_count;

  select
    count(*) filter (
      where availability.is_auto_completed = true
    )::integer
  into
    calculated_auto_completed_count
  from public.dispatcher_availability availability
  where availability.period_id =
    target_period_id
    and availability.user_id =
      current_user_id;

  select
    count(*)::integer
  into
    calculated_total_shift_count
  from public.availability_shift_slots slot
  where slot.period_id =
    target_period_id;

  if calculated_total_shift_count = 0 then
    raise exception
      'Availability period does not contain shift slots';
  end if;

  if (
    calculated_answered_count <>
    calculated_total_shift_count
  ) then
    raise exception
      'All shift slots must be answered before submission';
  end if;

  submitted_timestamp := now();

  update public.availability_submissions submission
  set
    status = 'submitted',

    submitted_at =
      submitted_timestamp,

    last_saved_at =
      coalesce(
        submission.last_saved_at,
        submitted_timestamp
      ),

    available_count =
      calculated_available_count,

    unavailable_count =
      calculated_unavailable_count,

    submission_source =
      case
        when calculated_auto_completed_count = 0
          then 'manual'
        when calculated_auto_completed_count >= calculated_total_shift_count
          then 'auto_no_submission'
        else 'auto_partial'
      end,

    auto_completed_count =
      calculated_auto_completed_count,

    updated_at =
      submitted_timestamp

  where submission.period_id =
    target_period_id
    and submission.user_id =
      current_user_id;

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
    'availability_submitted',

    current_user_id,
    current_user_email,
    current_user_display_name,

    current_user_id,
    current_user_email,
    current_user_display_name,

    'availability_submission',
    target_period_id,

    format(
      'הוגשו אילוצים לחודש %s/%s על ידי %s',
      target_period_month,
      target_period_year,
      current_user_display_name
    ),

    jsonb_build_object(
      'status',
      current_submission_status
    ),

    jsonb_build_object(
      'status',
      'submitted',

      'submitted_at',
      submitted_timestamp,

      'available_count',
      calculated_available_count,

      'unavailable_count',
      calculated_unavailable_count,

      'answered_count',
      calculated_answered_count,

      'total_shift_count',
      calculated_total_shift_count
    ),

    jsonb_build_object(
      'source',
      'submit-my-availability-rpc',

      'period_id',
      target_period_id,

      'period_title',
      target_period_title,

      'year',
      target_period_year,

      'month',
      target_period_month
    )
  );

  return query
  select
    target_period_id,
    'submitted'::text,
    submitted_timestamp,
    calculated_available_count,
    calculated_unavailable_count,
    calculated_answered_count,
    calculated_total_shift_count;
end;
$function$;

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
    is_auto_completed,
    created_at,
    updated_at
  )
  select
    requested_period_id,
    slot.id,
    profile.id,
    'available',
    auto_note,
    true,
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
    submission_source = (
      select
        case
          when count(*) filter (where entry.is_auto_completed) = 0
            then 'manual'
          when count(*) filter (where entry.is_auto_completed) >= count(*)
            then 'auto_no_submission'
          else 'auto_partial'
        end
      from public.dispatcher_availability entry
      where entry.period_id = requested_period_id
        and entry.user_id = submission.user_id
    ),
    auto_completed_count = (
      select count(*)::integer
      from public.dispatcher_availability entry
      where entry.period_id = requested_period_id
        and entry.user_id = submission.user_id
        and entry.is_auto_completed = true
    ),
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
      and profile.is_active = true
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
