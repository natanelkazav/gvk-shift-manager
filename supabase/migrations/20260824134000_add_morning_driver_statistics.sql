-- Morning-driver statistics for the management statistics workspace.

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
  if not ('statistics.view' = any(current_permissions) or 'users.manage' = any(current_permissions)) then
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
          'afternoonShifts', count(shift_item.id) filter (where shift_item.start_time >= time '12:00' and shift_item.start_time < time '18:00')::integer,
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
      select jsonb_agg(row_data order by (row_data->>'year')::integer, (row_data->>'month')::integer, row_data->>'displayName')
      from (
        select jsonb_build_object(
          'userId', profile.id,
          'displayName', profile.display_name,
          'scheduleName', profile.schedule_name,
          'year', period.year,
          'month', period.month,
          'totalShifts', count(shift_item.id)::integer
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
