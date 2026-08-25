-- =========================================================
-- Calendar special days as the single active holiday source
-- =========================================================
--
-- The existing Hebcal import writes to:
--   public.calendar_special_days
--
-- A number of older RPCs still read from:
--   public.holidays
--
-- This migration makes calendar_special_days the source of
-- truth, keeps public.holidays synchronized for backwards
-- compatibility, and makes the shared calendar RPC read
-- directly from calendar_special_days.
-- =========================================================


-- =========================================================
-- 1. Synchronization trigger
-- =========================================================

create or replace function
public.sync_calendar_special_day_to_holidays()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if tg_op = 'DELETE' then
    delete from public.holidays holiday
    where holiday.holiday_date =
        old.event_date
      and holiday.name =
        old.event_name
      and holiday.source =
        'calendar_special_days'
      and holiday.is_manual_override =
        false;

    return old;
  end if;


  /*
   * If an UPDATE changed the identifying fields,
   * remove the old synchronized row first.
   */
  if tg_op = 'UPDATE'
    and (
      old.event_date is distinct from
        new.event_date
      or
      old.event_name is distinct from
        new.event_name
    )
  then
    delete from public.holidays holiday
    where holiday.holiday_date =
        old.event_date
      and holiday.name =
        old.event_name
      and holiday.source =
        'calendar_special_days'
      and holiday.is_manual_override =
        false;
  end if;


  insert into public.holidays (
    holiday_date,
    name,
    schedule_type,
    holiday_group,
    source,
    is_manual_override
  )
  values (
    new.event_date,
    new.event_name,
    new.schedule_type
      ::public.schedule_type,
    new.holiday_group,
    'calendar_special_days',
    false
  )

  on conflict (
    holiday_date,
    name
  )
  do update set
    schedule_type =
      excluded.schedule_type,

    holiday_group =
      excluded.holiday_group,

    source =
      excluded.source,

    updated_at =
      now()

  /*
   * Never overwrite an explicit manual override.
   */
  where public.holidays
    .is_manual_override =
      false;


  return new;
end;
$function$;


drop trigger if exists
  sync_calendar_special_days_to_holidays
on public.calendar_special_days;


create trigger
  sync_calendar_special_days_to_holidays
after insert or update or delete
on public.calendar_special_days
for each row
execute function
  public.sync_calendar_special_day_to_holidays();


-- =========================================================
-- 2. Backfill existing imported special days
-- =========================================================

insert into public.holidays (
  holiday_date,
  name,
  schedule_type,
  holiday_group,
  source,
  is_manual_override
)

select
  special_day.event_date,
  special_day.event_name,
  special_day.schedule_type
    ::public.schedule_type,
  special_day.holiday_group,
  'calendar_special_days',
  false

from public.calendar_special_days
  special_day

where special_day.schedule_type
  in (
    'holiday_eve',
    'holiday_full',
    'holiday_end',
    'chol_hamoed'
  )

on conflict (
  holiday_date,
  name
)
do update set
  schedule_type =
    excluded.schedule_type,

  holiday_group =
    excluded.holiday_group,

  source =
    excluded.source,

  updated_at =
    now()

where public.holidays
  .is_manual_override =
    false;


-- =========================================================
-- 3. Shared monthly calendar holiday RPC
-- =========================================================

create or replace function
public.get_calendar_holidays(
  requested_year integer,
  requested_month integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  current_user_id uuid :=
    auth.uid();

  first_date date;
  next_month date;
begin
  if current_user_id is null then
    raise exception
      'not authenticated';
  end if;

  if not exists (
    select 1
    from public.profiles profile
    where profile.id =
        current_user_id
      and profile.is_active =
        true
  ) then
    raise exception
      'user not active';
  end if;

  if requested_year < 2020
    or requested_year > 2100
    or requested_month < 1
    or requested_month > 12
  then
    raise exception
      'invalid year or month';
  end if;

  first_date :=
    make_date(
      requested_year,
      requested_month,
      1
    );

  next_month :=
    (
      first_date +
      interval '1 month'
    )::date;


  return coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'date',
            holiday_source.event_date,

          'name',
            holiday_source.event_name,

          'scheduleType',
            holiday_source.schedule_type,

          'holidayGroup',
            holiday_source.holiday_group
        )
        order by
          holiday_source.event_date,
          holiday_source.event_name
      )

      from public.calendar_special_days
        holiday_source

      where holiday_source.event_date >=
          first_date

        and holiday_source.event_date <
          next_month

        and holiday_source.schedule_type
          in (
            'holiday_eve',
            'holiday_full',
            'holiday_end',
            'chol_hamoed'
          )
    ),

    '[]'::jsonb
  );
end;
$function$;


grant execute
on function
  public.get_calendar_holidays(
    integer,
    integer
  )
to authenticated;


-- =========================================================
-- 4. Keep the compatibility table clean
-- =========================================================
--
-- Remove synchronized rows that no longer have a matching
-- source row. Manual rows / manual overrides are preserved.
-- =========================================================

delete from public.holidays holiday

where holiday.source =
    'calendar_special_days'

  and holiday.is_manual_override =
    false

  and not exists (
    select 1
    from public.calendar_special_days
      special_day

    where special_day.event_date =
        holiday.holiday_date

      and special_day.event_name =
        holiday.name
  );
