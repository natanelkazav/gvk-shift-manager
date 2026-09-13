begin;

-- Phase 10.5.4 · Dynamic employee runtime cleanup.
-- Legacy-seeded Job Types remain in the database for recovery, but are no longer
-- valid employee memberships in the Dynamic-first runtime.
delete from public.job_type_memberships m
using public.job_types jt
where m.job_type_id = jt.id
  and jt.legacy_role is not null;

create or replace function public.get_my_dynamic_schedule_periods()
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  current_user_id uuid := auth.uid();
  result jsonb;
begin
  if current_user_id is null then
    raise exception 'not authenticated';
  end if;

  select coalesce(
    jsonb_agg(
      item
      order by (item->>'year')::integer desc,
               (item->>'month')::integer desc,
               item->>'jobTypeName'
    ),
    '[]'::jsonb
  )
  into result
  from (
    select jsonb_build_object(
      'publicationId', p.id,
      'jobTypeId', jt.id,
      'jobTypeName', jt.name,
      'year', p.year,
      'month', p.month,
      'status', p.status,
      'publishedAt', p.published_at,
      'assignmentCount', (
        select count(*)::integer
        from public.dynamic_schedule_published_assignments a
        where a.publication_id = p.id
          and a.user_id = current_user_id
      ),
      'workMode', coalesce(
        mat.work_mode,
        p.config_snapshot #>> '{jobType,shiftPattern,workMode}',
        jt.scheduling_config #>> '{shiftPattern,workMode}',
        'shifts'
      ),
      'scheduleChangeMode', coalesce(
        mat.schedule_change_mode,
        p.config_snapshot #>> '{jobType,scheduleChangeMode}',
        jt.scheduling_config #>> '{scheduleChangeMode}',
        'none'
      )
    ) as item
    from public.dynamic_schedule_publications p
    join public.job_types jt
      on jt.id = p.job_type_id
     and jt.legacy_role is null
    join public.job_type_memberships membership
      on membership.job_type_id = p.job_type_id
     and membership.user_id = current_user_id
    left join public.job_type_schedule_materializations mat
      on mat.job_type_id = p.job_type_id
     and mat.effective_month = make_date(p.year, p.month, 1)
    where p.status in ('published', 'archived')
  ) rows;

  return result;
end;
$function$;

revoke all on function public.get_my_dynamic_schedule_periods() from public;
grant execute on function public.get_my_dynamic_schedule_periods() to authenticated;

create or replace function public.get_my_dynamic_schedule_workspace(
  requested_publication_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  current_user_id uuid := auth.uid();
  target_publication public.dynamic_schedule_publications%rowtype;
  target_job public.job_types%rowtype;
  assignments_json jsonb;
  change_mode text;
  work_mode text;
begin
  if current_user_id is null then
    raise exception 'not authenticated';
  end if;

  select * into target_publication
  from public.dynamic_schedule_publications
  where id = requested_publication_id;

  if target_publication.id is null then
    raise exception 'publication not found';
  end if;

  select * into target_job
  from public.job_types
  where id = target_publication.job_type_id
    and legacy_role is null;

  if target_job.id is null then
    raise exception 'dynamic job type not found';
  end if;

  if not exists (
    select 1
    from public.job_type_memberships m
    where m.job_type_id = target_publication.job_type_id
      and m.user_id = current_user_id
  ) then
    raise exception 'not allowed';
  end if;

  work_mode := coalesce(
    target_publication.config_snapshot #>> '{jobType,shiftPattern,workMode}',
    target_job.scheduling_config #>> '{shiftPattern,workMode}',
    'shifts'
  );

  change_mode := coalesce(
    (
      select mat.schedule_change_mode
      from public.job_type_schedule_materializations mat
      where mat.job_type_id = target_job.id
        and mat.effective_month <= make_date(target_publication.year, target_publication.month, 1)
      order by mat.effective_month desc
      limit 1
    ),
    target_publication.config_snapshot #>> '{jobType,scheduleChangeMode}',
    target_job.scheduling_config #>> '{scheduleChangeMode}',
    'none'
  );

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', q.id,
      'shiftDate', q.shift_date,
      'shiftCode', q.shift_code,
      'shiftName', q.display_shift_name,
      'startTime', q.start_time,
      'endTime', q.end_time,
      'assignmentTier', q.assignment_tier,
      'managerEdited', q.manager_edited,
      'managerOverrideNote', q.manager_override_note,
      'holidayName', q.holiday_name,
      'sourceDayKind', q.source_day_kind,
      'contains200Percent', q.contains_200_percent,
      'premium200Hours', q.premium_200_hours
    ) order by q.shift_date, q.start_time, q.display_shift_name
  ), '[]'::jsonb)
  into assignments_json
  from (
    select
      a.id,
      a.shift_date,
      a.shift_code,
      coalesce(
        nullif(tmpl.name, ''),
        nullif(sl.shift_name, sl.shift_code),
        nullif(a.shift_name, a.shift_code),
        a.shift_name
      ) as display_shift_name,
      a.start_time,
      a.end_time,
      a.assignment_tier,
      a.manager_edited,
      a.manager_override_note,
      coalesce(sl.holiday_name, legacy_shift.holiday_name, holiday.event_name) as holiday_name,
      coalesce(sl.source_day_kind, legacy_shift.schedule_type::text, holiday.schedule_type) as source_day_kind,
      coalesce(
        case
          when sl.metadata ? 'contains200Percent'
            then (sl.metadata->>'contains200Percent')::boolean
          else null
        end,
        legacy_shift.is_premium,
        tmpl.contains_200_percent,
        false
      ) as contains_200_percent,
      coalesce(
        case
          when sl.metadata ? 'premium200Hours'
            then (sl.metadata->>'premium200Hours')::numeric
          else null
        end,
        tmpl.premium_200_hours,
        0
      ) as premium_200_hours
    from public.dynamic_schedule_published_assignments a
    left join public.dynamic_availability_slots sl
      on sl.id = a.slot_id
    left join public.schedule_shifts legacy_shift
      on legacy_shift.id = case
        when coalesce(sl.metadata->>'sourceRecordId','') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
          then (sl.metadata->>'sourceRecordId')::uuid
        else null
      end
    left join lateral (
      select csd.event_name, csd.schedule_type
      from public.calendar_special_days csd
      where csd.event_date = a.shift_date
      order by
        case when csd.source_name = 'manual' then 0 else 1 end,
        case csd.schedule_type
          when 'holiday_full' then 1
          when 'holiday_end' then 2
          when 'holiday_eve' then 3
          when 'chol_hamoed' then 4
          else 5
        end
      limit 1
    ) holiday on true
    left join lateral (
      select st.name, st.contains_200_percent, st.premium_200_hours
      from public.job_type_schedule_materializations mat
      join public.job_type_materialized_shift_templates st
        on st.materialization_id = mat.id
       and st.is_active = true
      where mat.job_type_id = target_job.id
        and mat.effective_month <= make_date(target_publication.year, target_publication.month, 1)
        and st.start_time = a.start_time
        and st.end_time = a.end_time
      order by
        mat.effective_month desc,
        case when st.code = a.shift_code then 0 else 1 end,
        st.sort_order,
        st.name
      limit 1
    ) tmpl on true
    where a.publication_id = target_publication.id
      and a.user_id = current_user_id
  ) q;

  return jsonb_build_object(
    'publicationId', target_publication.id,
    'jobTypeId', target_job.id,
    'jobTypeName', target_job.name,
    'year', target_publication.year,
    'month', target_publication.month,
    'status', target_publication.status,
    'publishedAt', target_publication.published_at,
    'workMode', work_mode,
    'scheduleChangeMode', change_mode,
    'assignments', assignments_json
  );
end;
$function$;

revoke all on function public.get_my_dynamic_schedule_workspace(uuid) from public;
grant execute on function public.get_my_dynamic_schedule_workspace(uuid) to authenticated;

-- Dashboard context uses only real Dynamic Job Types and resolves the next-shift
-- display name from the effective role template when imported legacy rows still
-- carry technical shift codes as their old display names.
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
          'publicationId', x.publication_id,
          'assignmentId', x.assignment_id,
          'year', x.year,
          'month', x.month,
          'shiftDate', x.shift_date,
          'shiftCode', x.shift_code,
          'shiftName', x.display_shift_name,
          'startTime', x.start_time,
          'endTime', x.end_time
        )
        from (
          select
            p.id as publication_id,
            a.id as assignment_id,
            p.year,
            p.month,
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
        ) x
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
