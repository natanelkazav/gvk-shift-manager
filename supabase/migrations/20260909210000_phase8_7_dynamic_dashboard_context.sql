begin;

-- Phase 8.7: one generic runtime context for Dashboard and Dynamic-first navigation.
-- The RPC intentionally knows only job_type_id + configuration. It does not branch
-- on dispatcher/on_call/morning_driver and therefore works for future customer roles.
create or replace function public.get_my_dynamic_runtime_context()
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  current_user_id uuid := auth.uid();
  current_month date := date_trunc('month', now() at time zone 'Asia/Jerusalem')::date;
  can_manage boolean := false;
  result jsonb;
begin
  if current_user_id is null then
    raise exception 'not authenticated';
  end if;

  can_manage :=
    public.current_user_has_permission('availability.manage')
    or public.current_user_has_permission('driver_availability.manage')
    or public.current_user_has_permission('morning_driver_availability.manage')
    or public.current_user_has_permission('users.manage');

  with memberships as (
    select
      m.job_type_id,
      m.is_primary,
      jt.name,
      jt.description,
      jt.availability_config,
      jt.scheduling_strategy,
      jt.scheduling_config,
      mat.work_mode as materialized_work_mode,
      mat.schedule_change_mode as materialized_change_mode
    from public.job_type_memberships m
    join public.job_types jt
      on jt.id = m.job_type_id
     and jt.is_active = true
    left join public.job_type_schedule_materializations mat
      on mat.job_type_id = jt.id
     and mat.effective_month = current_month
    where m.user_id = current_user_id
  ),
  role_rows as (
    select jsonb_build_object(
      'jobTypeId', m.job_type_id,
      'jobTypeName', m.name,
      'description', m.description,
      'isPrimary', m.is_primary,
      'workMode', coalesce(
        m.materialized_work_mode,
        m.scheduling_config #>> '{shiftPattern,workMode}',
        'shifts'
      ),
      'schedulingStrategy', coalesce(m.scheduling_strategy, 'availability_optimizer'),
      'scheduleChangeMode', coalesce(
        m.materialized_change_mode,
        m.scheduling_config #>> '{scheduleChangeMode}',
        'none'
      ),
      'availabilityEnabled', coalesce((m.availability_config->>'enabled')::boolean, true),
      'publishedAssignmentCount', (
        select count(*)::integer
        from public.dynamic_schedule_publications p
        join public.dynamic_schedule_published_assignments a
          on a.publication_id = p.id
        where p.job_type_id = m.job_type_id
          and p.status in ('published','archived')
          and a.user_id = current_user_id
          and a.shift_date >= current_month
      ),
      'nextAssignment', (
        select jsonb_build_object(
          'publicationId', p.id,
          'assignmentId', a.id,
          'year', p.year,
          'month', p.month,
          'shiftDate', a.shift_date,
          'shiftCode', a.shift_code,
          'shiftName', a.shift_name,
          'startTime', a.start_time,
          'endTime', a.end_time
        )
        from public.dynamic_schedule_publications p
        join public.dynamic_schedule_published_assignments a
          on a.publication_id = p.id
        where p.job_type_id = m.job_type_id
          and p.status = 'published'
          and a.user_id = current_user_id
          and (
            a.shift_date > (now() at time zone 'Asia/Jerusalem')::date
            or (
              a.shift_date = (now() at time zone 'Asia/Jerusalem')::date
              and a.end_time >= (now() at time zone 'Asia/Jerusalem')::time
            )
          )
        order by a.shift_date, a.start_time
        limit 1
      ),
      'availability', (
        select jsonb_build_object(
          'periodId', ap.id,
          'year', ap.year,
          'month', ap.month,
          'status', ap.status,
          'submissionDeadline', ap.submission_deadline,
          'slotCount', (select count(*)::integer from public.dynamic_availability_slots s where s.period_id = ap.id),
          'filledCount', (
            select count(*)::integer
            from public.dynamic_availability_entries e
            where e.submission_id = sub.id
          ),
          'submissionStatus', sub.status
        )
        from public.dynamic_availability_periods ap
        left join public.dynamic_availability_submissions sub
          on sub.period_id = ap.id
         and sub.user_id = current_user_id
        where ap.job_type_id = m.job_type_id
          and ap.status in ('open','closed')
          and make_date(ap.year, ap.month, 1) >= current_month
        order by ap.year, ap.month
        limit 1
      )
    ) as item,
    m.is_primary,
    m.name
    from memberships m
  ),
  managed_rows as (
    select jsonb_build_object(
      'jobTypeId', jt.id,
      'jobTypeName', jt.name,
      'memberCount', (select count(*)::integer from public.job_type_memberships mm where mm.job_type_id = jt.id),
      'currentPeriodStatus', (
        select ap.status
        from public.dynamic_availability_periods ap
        where ap.job_type_id = jt.id
          and ap.year = extract(year from current_month)::integer
          and ap.month = extract(month from current_month)::integer
        limit 1
      ),
      'publishedAssignmentCount', (
        select count(*)::integer
        from public.dynamic_schedule_publications p
        join public.dynamic_schedule_published_assignments a on a.publication_id = p.id
        where p.job_type_id = jt.id
          and p.year = extract(year from current_month)::integer
          and p.month = extract(month from current_month)::integer
          and p.status = 'published'
      )
    ) as item,
    jt.name
    from public.job_types jt
    where can_manage and jt.is_active = true
  )
  select jsonb_build_object(
    'hasDynamicMemberships', exists(select 1 from memberships),
    'primaryJobTypeName', (
      select m.name
      from memberships m
      order by m.is_primary desc, m.name
      limit 1
    ),
    'roles', coalesce((select jsonb_agg(r.item order by r.is_primary desc, r.name) from role_rows r), '[]'::jsonb),
    'canManageDynamicScheduling', can_manage,
    'managedRoles', coalesce((select jsonb_agg(mr.item order by mr.name) from managed_rows mr), '[]'::jsonb),
    'generatedAt', now()
  )
  into result;

  return result;
end;
$function$;

revoke all on function public.get_my_dynamic_runtime_context() from public;
grant execute on function public.get_my_dynamic_runtime_context() to authenticated;

commit;
