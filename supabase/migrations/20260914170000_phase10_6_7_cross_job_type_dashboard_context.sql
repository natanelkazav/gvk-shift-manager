-- Phase 10.6.7 - Generic cross Job Type dashboard context
-- A Job Type can expose selected other Job Types on its members' dashboard,
-- but only when assignments actually overlap the member's current/next assignment.

begin;

create table if not exists public.job_type_dashboard_context_rules (
  source_job_type_id uuid not null references public.job_types(id) on delete cascade,
  target_job_type_id uuid not null references public.job_types(id) on delete cascade,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (source_job_type_id, target_job_type_id),
  constraint job_type_dashboard_context_rules_no_self check (source_job_type_id <> target_job_type_id)
);

create index if not exists job_type_dashboard_context_rules_target_idx
  on public.job_type_dashboard_context_rules(target_job_type_id)
  where enabled = true;

alter table public.job_type_dashboard_context_rules enable row level security;
revoke all on public.job_type_dashboard_context_rules from anon, authenticated;

create or replace function public.get_dynamic_dashboard_context_policy(requested_job_type_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  actor uuid := auth.uid();
  source_name text;
begin
  if actor is null then
    raise exception 'not authenticated';
  end if;

  if not (
    public.current_user_has_permission('users.view')
    or public.current_user_has_permission('users.manage')
  ) then
    raise exception 'not allowed';
  end if;

  select jt.name
    into source_name
  from public.job_types jt
  where jt.id = requested_job_type_id
    and jt.legacy_role is null;

  if source_name is null then
    raise exception 'dynamic job type not found';
  end if;

  return jsonb_build_object(
    'jobTypeId', requested_job_type_id,
    'jobTypeName', source_name,
    'targetJobTypeIds', coalesce((
      select jsonb_agg(r.target_job_type_id order by jt.name)
      from public.job_type_dashboard_context_rules r
      join public.job_types jt on jt.id = r.target_job_type_id
      where r.source_job_type_id = requested_job_type_id
        and r.enabled = true
        and jt.is_active = true
        and jt.legacy_role is null
    ), '[]'::jsonb)
  );
end;
$function$;

revoke all on function public.get_dynamic_dashboard_context_policy(uuid) from public;
grant execute on function public.get_dynamic_dashboard_context_policy(uuid) to authenticated;

create or replace function public.save_dynamic_dashboard_context_policy(
  requested_job_type_id uuid,
  requested_target_job_type_ids uuid[] default array[]::uuid[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  actor uuid := auth.uid();
  invalid_target_count integer;
begin
  if actor is null then
    raise exception 'not authenticated';
  end if;

  if not public.current_user_has_permission('users.manage') then
    raise exception 'not allowed';
  end if;

  if not exists (
    select 1
    from public.job_types jt
    where jt.id = requested_job_type_id
      and jt.legacy_role is null
  ) then
    raise exception 'dynamic job type not found';
  end if;

  if requested_job_type_id = any(coalesce(requested_target_job_type_ids, array[]::uuid[])) then
    raise exception 'a job type cannot expose itself as additional dashboard context';
  end if;

  select count(*)::integer
    into invalid_target_count
  from unnest(coalesce(requested_target_job_type_ids, array[]::uuid[])) requested(id)
  left join public.job_types jt
    on jt.id = requested.id
   and jt.is_active = true
   and jt.legacy_role is null
  where jt.id is null;

  if invalid_target_count > 0 then
    raise exception 'one or more dashboard context job types are invalid or inactive';
  end if;

  delete from public.job_type_dashboard_context_rules r
  where r.source_job_type_id = requested_job_type_id;

  insert into public.job_type_dashboard_context_rules (
    source_job_type_id,
    target_job_type_id,
    enabled,
    created_at,
    updated_at
  )
  select distinct
    requested_job_type_id,
    requested.id,
    true,
    now(),
    now()
  from unnest(coalesce(requested_target_job_type_ids, array[]::uuid[])) requested(id);
end;
$function$;

revoke all on function public.save_dynamic_dashboard_context_policy(uuid, uuid[]) from public;
grant execute on function public.save_dynamic_dashboard_context_policy(uuid, uuid[]) to authenticated;

-- Dynamic employee dashboard context. The current/next assignment stays the anchor.
-- For every configured target Job Type we return all published assignments whose
-- actual time interval overlaps that anchor. Overnight shifts are handled by
-- advancing the end timestamp to the following day when end <= start.
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
      next_assignment.end_time
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
        a.end_time
      from public.dynamic_schedule_publications p
      join public.dynamic_schedule_published_assignments a
        on a.publication_id = p.id
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
        and (
          a.shift_date > (now() at time zone 'Asia/Jerusalem')::date
          or (
            a.shift_date = (now() at time zone 'Asia/Jerusalem')::date
            and a.end_time >= (now() at time zone 'Asia/Jerusalem')::time
          )
        )
      order by a.shift_date, a.start_time
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
            and (
              (target_a.shift_date + target_a.start_time)
              < (
                m.shift_date + m.end_time
                + case when m.end_time <= m.start_time then interval '1 day' else interval '0 day' end
              )
            )
            and (
              target_a.shift_date + target_a.end_time
              + case when target_a.end_time <= target_a.start_time then interval '1 day' else interval '0 day' end
            ) > (m.shift_date + m.start_time)
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
