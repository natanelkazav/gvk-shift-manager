-- Phase 10.6.8 - Configurable operational window for daily on-call roles
-- Daily on-call remains a day-based scheduling unit. Admin-defined start/end hours
-- are private operational metadata used when the system needs a real time interval,
-- especially cross-Job-Type dashboard overlap.

begin;

create or replace function public.dynamic_resolve_assignment_local_interval(
  requested_shift_date date,
  requested_start_time time,
  requested_end_time time,
  requested_work_mode text,
  requested_scheduling_config jsonb
)
returns table(start_at timestamp without time zone, end_at timestamp without time zone)
language sql
stable
set search_path = ''
as $function$
  with resolved as (
    select
      case
        when requested_work_mode = 'on_call_daily'
          then coalesce(
            nullif(requested_scheduling_config #>> '{shiftPattern,dailyOnCallWindow,startTime}', '')::time,
            '00:00'::time
          )
        else coalesce(requested_start_time, '00:00'::time)
      end as resolved_start,
      case
        when requested_work_mode = 'on_call_daily'
          then coalesce(
            nullif(requested_scheduling_config #>> '{shiftPattern,dailyOnCallWindow,endTime}', '')::time,
            '00:00'::time
          )
        else coalesce(requested_end_time, '00:00'::time)
      end as resolved_end
  )
  select
    requested_shift_date + resolved_start,
    requested_shift_date + resolved_end
      + case when resolved_end <= resolved_start then interval '1 day' else interval '0 day' end
  from resolved;
$function$;

revoke all on function public.dynamic_resolve_assignment_local_interval(date,time,time,text,jsonb) from public;
grant execute on function public.dynamic_resolve_assignment_local_interval(date,time,time,text,jsonb) to authenticated;

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
     and jt.legacy_role is null
    left join public.job_type_schedule_materializations mat
      on mat.job_type_id = jt.id
     and mat.effective_month = current_month
    where m.user_id = current_user_id
  ),
  role_with_next as (
    select
      m.*,
      next_assignment.publication_id,
      next_assignment.assignment_id,
      next_assignment.assignment_year,
      next_assignment.assignment_month,
      next_assignment.shift_date,
      next_assignment.shift_code,
      next_assignment.display_shift_name,
      next_assignment.start_time,
      next_assignment.end_time,
      next_assignment.assignment_start_at,
      next_assignment.assignment_end_at
    from memberships m
    left join lateral (
      select
        p.id as publication_id,
        a.id as assignment_id,
        p.year as assignment_year,
        p.month as assignment_month,
        a.shift_date,
        a.shift_code,
        coalesce(nullif(tmpl.name,''), nullif(a.shift_name,a.shift_code), a.shift_name) as display_shift_name,
        a.start_time,
        a.end_time,
        assignment_bounds.start_at as assignment_start_at,
        assignment_bounds.end_at as assignment_end_at
      from public.dynamic_schedule_publications p
      join public.dynamic_schedule_published_assignments a
        on a.publication_id = p.id
      cross join lateral public.dynamic_resolve_assignment_local_interval(
        a.shift_date,
        a.start_time,
        a.end_time,
        coalesce(
          m.materialized_work_mode,
          m.scheduling_config #>> '{shiftPattern,workMode}',
          'shifts'
        ),
        m.scheduling_config
      ) assignment_bounds
      left join lateral (
        select st.name
        from public.job_type_schedule_materializations mat2
        join public.job_type_materialized_shift_templates st
          on st.materialization_id = mat2.id
         and st.is_active = true
        where mat2.job_type_id = m.job_type_id
          and mat2.effective_month <= make_date(p.year,p.month,1)
          and st.start_time = a.start_time
          and st.end_time = a.end_time
        order by mat2.effective_month desc,
                 case when st.code = a.shift_code then 0 else 1 end,
                 st.sort_order,
                 st.name
        limit 1
      ) tmpl on true
      where p.job_type_id = m.job_type_id
        and p.status = 'published'
        and a.user_id = current_user_id
        and assignment_bounds.end_at >= (now() at time zone 'Asia/Jerusalem')
      order by
        case
          when assignment_bounds.start_at <= (now() at time zone 'Asia/Jerusalem')
           and assignment_bounds.end_at >= (now() at time zone 'Asia/Jerusalem')
          then 0
          else 1
        end,
        assignment_bounds.start_at
      limit 1
    ) next_assignment on true
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
      'nextAssignment', case when m.assignment_id is null then null else jsonb_build_object(
        'publicationId', m.publication_id,
        'assignmentId', m.assignment_id,
        'year', m.assignment_year,
        'month', m.assignment_month,
        'shiftDate', m.shift_date,
        'shiftCode', m.shift_code,
        'shiftName', m.display_shift_name,
        'startTime', m.start_time,
        'endTime', m.end_time
      ) end,
      'parallelAssignments', case when m.assignment_id is null then '[]'::jsonb else coalesce((
        select jsonb_agg(context_row.item order by context_row.job_type_name, context_row.shift_date, context_row.start_time, context_row.display_name)
        from (
          select
            target_jt.name as job_type_name,
            target_a.shift_date,
            target_a.start_time,
            coalesce(target_profile.display_name, 'לא משובץ') as display_name,
            jsonb_build_object(
              'jobTypeId', target_jt.id,
              'jobTypeName', target_jt.name,
              'workMode', coalesce(
                target_mode.work_mode,
                target_jt.scheduling_config #>> '{shiftPattern,workMode}',
                'shifts'
              ),
              'assignmentId', target_a.id,
              'shiftDate', target_a.shift_date,
              'shiftCode', target_a.shift_code,
              'shiftName', coalesce(nullif(target_tmpl.name,''), nullif(target_a.shift_name,target_a.shift_code), target_a.shift_name),
              'startTime', target_a.start_time,
              'endTime', target_a.end_time,
              'userId', target_a.user_id,
              'displayName', target_profile.display_name
            ) as item
          from public.job_type_dashboard_context_rules context_rule
          join public.job_types target_jt
            on target_jt.id = context_rule.target_job_type_id
           and target_jt.is_active = true
           and target_jt.legacy_role is null
          join public.dynamic_schedule_publications target_pub
            on target_pub.job_type_id = target_jt.id
           and target_pub.status = 'published'
          join public.dynamic_schedule_published_assignments target_a
            on target_a.publication_id = target_pub.id
          left join public.profiles target_profile
            on target_profile.id = target_a.user_id
          left join lateral (
            select mat_mode.work_mode
            from public.job_type_schedule_materializations mat_mode
            where mat_mode.job_type_id = target_jt.id
              and mat_mode.effective_month <= make_date(target_pub.year,target_pub.month,1)
            order by mat_mode.effective_month desc
            limit 1
          ) target_mode on true
          cross join lateral public.dynamic_resolve_assignment_local_interval(
            target_a.shift_date,
            target_a.start_time,
            target_a.end_time,
            coalesce(
              target_mode.work_mode,
              target_jt.scheduling_config #>> '{shiftPattern,workMode}',
              'shifts'
            ),
            target_jt.scheduling_config
          ) target_bounds
          left join lateral (
            select st.name
            from public.job_type_schedule_materializations mat3
            join public.job_type_materialized_shift_templates st
              on st.materialization_id = mat3.id
             and st.is_active = true
            where mat3.job_type_id = target_jt.id
              and mat3.effective_month <= make_date(target_pub.year,target_pub.month,1)
              and st.start_time = target_a.start_time
              and st.end_time = target_a.end_time
            order by mat3.effective_month desc,
                     case when st.code = target_a.shift_code then 0 else 1 end,
                     st.sort_order,
                     st.name
            limit 1
          ) target_tmpl on true
          where context_rule.source_job_type_id = m.job_type_id
            and context_rule.enabled = true
            and target_a.user_id is not null
            and target_bounds.start_at < m.assignment_end_at
            and target_bounds.end_at > m.assignment_start_at
        ) context_row
      ), '[]'::jsonb) end,
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
    from role_with_next m
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
    where can_manage
      and jt.is_active = true
      and jt.legacy_role is null
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
