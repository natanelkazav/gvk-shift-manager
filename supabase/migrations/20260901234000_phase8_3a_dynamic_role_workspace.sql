begin;

-- Phase 8.3A: read-only dynamic role workspace.
-- Gives managers one generic view of a dynamic role and proves that imported
-- historical data is queryable by job_type_id before any production cutover.

create or replace function public.get_dynamic_role_workspace(requested_job_type_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  current_user_id uuid := auth.uid();
  role_record public.job_types%rowtype;
  historical_period_count integer := 0;
  historical_assignment_count integer := 0;
  historical_availability_count integer := 0;
  membership_count integer := 0;
  materialization_count integer := 0;
begin
  if current_user_id is null then
    raise exception 'not authenticated';
  end if;

  if not exists (
    select 1
    from public.user_permissions up
    where up.user_id = current_user_id
      and up.permission_key in ('users.view', 'users.manage', 'statistics.view')
  ) then
    raise exception 'not allowed';
  end if;

  select * into role_record
  from public.job_types jt
  where jt.id = requested_job_type_id;

  if not found then
    raise exception 'job type not found';
  end if;

  select count(*) into membership_count
  from public.job_type_memberships m
  where m.job_type_id = requested_job_type_id;

  select count(*) into materialization_count
  from public.job_type_schedule_materializations m
  where m.job_type_id = requested_job_type_id;

  select count(*) into historical_period_count
  from public.dynamic_historical_periods hp
  where hp.job_type_id = requested_job_type_id;

  select count(*) into historical_assignment_count
  from public.dynamic_historical_assignments ha
  join public.dynamic_historical_periods hp on hp.id = ha.historical_period_id
  where hp.job_type_id = requested_job_type_id;

  select count(*) into historical_availability_count
  from public.dynamic_historical_availability hv
  join public.dynamic_historical_periods hp on hp.id = hv.historical_period_id
  where hp.job_type_id = requested_job_type_id;

  return jsonb_build_object(
    'jobTypeId', role_record.id,
    'jobTypeName', role_record.name,
    'isActive', role_record.is_active,
    'schedulingStrategy', role_record.scheduling_strategy,
    'memberCount', membership_count,
    'materializationCount', materialization_count,
    'historicalTotals', jsonb_build_object(
      'periods', historical_period_count,
      'assignments', historical_assignment_count,
      'availability', historical_availability_count
    ),
    'periods', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', hp.id,
          'year', hp.year,
          'month', hp.month,
          'sourceKind', hp.source_kind,
          'sourceStatus', hp.source_status,
          'importedAt', hp.imported_at,
          'assignments', (
            select count(*) from public.dynamic_historical_assignments ha
            where ha.historical_period_id = hp.id
          ),
          'availability', (
            select count(*) from public.dynamic_historical_availability hv
            where hv.historical_period_id = hp.id
          ),
          'assignedUsers', coalesce((
            select jsonb_agg(distinct jsonb_build_object(
              'userId', p.id,
              'displayName', p.display_name
            ))
            from public.dynamic_historical_assignments ha
            join public.profiles p on p.id = ha.assigned_user_id
            where ha.historical_period_id = hp.id
          ), '[]'::jsonb)
        ) order by hp.year desc, hp.month desc
      )
      from public.dynamic_historical_periods hp
      where hp.job_type_id = requested_job_type_id
    ), '[]'::jsonb)
  );
end;
$function$;

grant execute on function public.get_dynamic_role_workspace(uuid) to authenticated;

commit;
