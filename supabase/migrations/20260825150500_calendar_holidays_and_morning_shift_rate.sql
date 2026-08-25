-- Calendar holiday labels + fixed per-shift pay for morning drivers.

alter table public.profiles
add column if not exists morning_shift_rate numeric null;

alter table public.profiles
drop constraint if exists profiles_morning_shift_rate_non_negative;

alter table public.profiles
add constraint profiles_morning_shift_rate_non_negative
check (morning_shift_rate is null or morning_shift_rate >= 0);

create or replace function public.get_calendar_holidays(
  requested_year integer,
  requested_month integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  current_user_id uuid := auth.uid();
  first_date date;
  next_month date;
begin
  if current_user_id is null then
    raise exception 'not authenticated';
  end if;

  if not exists (
    select 1 from public.profiles
    where id = current_user_id and is_active = true
  ) then
    raise exception 'user not active';
  end if;

  if requested_year < 2020 or requested_year > 2100
     or requested_month < 1 or requested_month > 12 then
    raise exception 'invalid year or month';
  end if;

  first_date := make_date(requested_year, requested_month, 1);
  next_month := (first_date + interval '1 month')::date;

  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'date', holiday.holiday_date,
        'name', holiday.name,
        'scheduleType', holiday.schedule_type::text
      )
      order by holiday.holiday_date, holiday.name
    )
    from public.holidays holiday
    where holiday.holiday_date >= first_date
      and holiday.holiday_date < next_month
  ), '[]'::jsonb);
end;
$function$;

grant execute on function public.get_calendar_holidays(integer, integer)
to authenticated;

drop function if exists public.update_user_compensation(uuid, numeric, numeric);

create or replace function public.update_user_compensation(
  target_user_id uuid,
  requested_hourly_rate numeric default null,
  requested_daily_duty_rate numeric default null,
  requested_morning_shift_rate numeric default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  current_user_id uuid := auth.uid();
  current_permissions text[];
  target_role public.user_role;
begin
  if current_user_id is null then raise exception 'not authenticated'; end if;
  current_permissions := coalesce(public.get_my_permissions(), array[]::text[]);
  if not ('payroll.manage' = any(current_permissions)) then
    raise exception 'payroll manage permission required';
  end if;

  if requested_hourly_rate is not null and requested_hourly_rate < 0 then
    raise exception 'hourly rate cannot be negative';
  end if;
  if requested_daily_duty_rate is not null and requested_daily_duty_rate < 0 then
    raise exception 'daily duty rate cannot be negative';
  end if;
  if requested_morning_shift_rate is not null and requested_morning_shift_rate < 0 then
    raise exception 'morning shift rate cannot be negative';
  end if;

  select role into target_role
  from public.profiles
  where id = target_user_id
  for update;

  if not found then raise exception 'target user was not found'; end if;

  if target_role = 'dispatcher'::public.user_role then
    update public.profiles
    set hourly_rate = requested_hourly_rate,
        daily_duty_rate = null,
        morning_shift_rate = null,
        updated_at = now()
    where id = target_user_id;
  elsif target_role = 'on_call'::public.user_role then
    update public.profiles
    set hourly_rate = null,
        daily_duty_rate = requested_daily_duty_rate,
        morning_shift_rate = null,
        updated_at = now()
    where id = target_user_id;
  elsif target_role = 'morning_driver'::public.user_role then
    update public.profiles
    set hourly_rate = null,
        daily_duty_rate = null,
        morning_shift_rate = requested_morning_shift_rate,
        updated_at = now()
    where id = target_user_id;
  else
    raise exception 'compensation can be configured only for dispatchers, morning drivers and on-call drivers';
  end if;

  return true;
end;
$function$;

grant execute on function public.update_user_compensation(uuid, numeric, numeric, numeric)
to authenticated;

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
      and (profile.is_active=true or schedule_period.id is not null)
    group by profile.id,profile.display_name,profile.schedule_name,profile.hourly_rate
  ), rows as (
    select *, case when hourly_rate is null then null else round(hourly_rate*(scheduled_hours+premium_hours),2) end projected_pay from dispatcher_totals
  )
  select coalesce(jsonb_agg(jsonb_build_object('userId',user_id,'displayName',display_name,'scheduleName',schedule_name,'hourlyRate',hourly_rate,'scheduledHours',scheduled_hours,'premiumHours',premium_hours,'projectedPay',projected_pay) order by coalesce(schedule_name,display_name)),'[]'::jsonb), coalesce(sum(projected_pay),0)
  into dispatchers_json,projected_dispatcher_pay from rows;

  with driver_totals as (
    select profile.id user_id, profile.display_name, profile.schedule_name, profile.daily_duty_rate,
      count(schedule_day.id) filter(where schedule_period.id is not null)::integer total_duties
    from public.profiles profile
    left join public.driver_schedule_days schedule_day on schedule_day.assigned_user_id=profile.id
    left join public.driver_schedule_periods schedule_period on schedule_period.id=schedule_day.period_id
      and schedule_period.status::text in ('published','archived')
      and (requested_years is null or cardinality(requested_years)=0 or schedule_period.year=any(requested_years))
      and (requested_months is null or cardinality(requested_months)=0 or schedule_period.month=any(requested_months))
    where profile.role='on_call'::public.user_role
      and (profile.is_active=true or schedule_period.id is not null)
    group by profile.id,profile.display_name,profile.schedule_name,profile.daily_duty_rate
  ), rows as (
    select *,case when daily_duty_rate is null then null else round(daily_duty_rate*total_duties,2) end projected_pay from driver_totals
  )
  select coalesce(jsonb_agg(jsonb_build_object('userId',user_id,'displayName',display_name,'scheduleName',schedule_name,'dailyDutyRate',daily_duty_rate,'totalDuties',total_duties,'projectedPay',projected_pay) order by coalesce(schedule_name,display_name)),'[]'::jsonb),coalesce(sum(projected_pay),0)
  into drivers_json,projected_driver_pay from rows;

  with morning_totals as (
    select profile.id user_id, profile.display_name, profile.schedule_name, profile.morning_shift_rate,
      count(assignment.id) filter(where schedule_period.id is not null)::integer total_shifts
    from public.profiles profile
    left join public.morning_driver_schedule_assignments assignment on assignment.assigned_user_id=profile.id
    left join public.morning_driver_schedule_periods schedule_period on schedule_period.id=assignment.schedule_period_id
      and schedule_period.status::text in ('published','archived')
      and (requested_years is null or cardinality(requested_years)=0 or schedule_period.year=any(requested_years))
      and (requested_months is null or cardinality(requested_months)=0 or schedule_period.month=any(requested_months))
    where profile.role='morning_driver'::public.user_role
      and (profile.is_active=true or schedule_period.id is not null)
    group by profile.id,profile.display_name,profile.schedule_name,profile.morning_shift_rate
  ), rows as (
    select *,case when morning_shift_rate is null then null else round(morning_shift_rate*total_shifts,2) end projected_pay from morning_totals
  )
  select coalesce(jsonb_agg(jsonb_build_object('userId',user_id,'displayName',display_name,'scheduleName',schedule_name,'shiftRate',morning_shift_rate,'totalShifts',total_shifts,'projectedPay',projected_pay) order by coalesce(schedule_name,display_name)),'[]'::jsonb),coalesce(sum(projected_pay),0)
  into morning_drivers_json,projected_morning_driver_pay from rows;

  return jsonb_build_object('dispatchers',dispatchers_json,'drivers',drivers_json,'morningDrivers',morning_drivers_json,'projectedDispatcherPay',projected_dispatcher_pay,'projectedDriverPay',projected_driver_pay,'projectedMorningDriverPay',projected_morning_driver_pay,'actualPayAvailable',false,'attendanceAvailable',false);
end;
$function$;
