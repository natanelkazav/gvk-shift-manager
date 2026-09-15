-- Phase 10.13.5 - Daily-duty operational window is the real responsibility interval
-- A daily on-call assignment belongs to the date on which it STARTS.
-- Example: 14:00 -> 06:00 means 14:00 on shift_date through 06:00 next day.
-- The scheduling/pay unit remains one daily duty; only operational time resolution changes.

begin;

create or replace function public.get_dynamic_schedule_calendar_workspace(
  requested_year integer,
  requested_month integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  actor uuid := auth.uid();
  result jsonb;
begin
  if actor is null then
    raise exception 'not authenticated';
  end if;

  if requested_year not between 2020 and 2100 or requested_month not between 1 and 12 then
    raise exception 'invalid year or month';
  end if;

  if not exists (
    select 1
    from public.job_types jt
    where jt.is_active = true
      and jt.legacy_role is null
      and (
        public.has_dynamic_job_type_permission('availability.view_team', jt.id, actor)
        or public.has_dynamic_job_type_permission('availability.open_period', jt.id, actor)
        or public.has_dynamic_job_type_permission('availability.close_period', jt.id, actor)
        or public.has_dynamic_job_type_permission('availability.manage_submissions', jt.id, actor)
        or public.has_dynamic_job_type_permission('schedule.view_team', jt.id, actor)
        or public.has_dynamic_job_type_permission('schedule.create_draft', jt.id, actor)
        or public.has_dynamic_job_type_permission('schedule.edit_draft', jt.id, actor)
        or public.has_dynamic_job_type_permission('schedule.publish', jt.id, actor)
        or public.has_dynamic_job_type_permission('schedule.edit_published', jt.id, actor)
        or public.has_dynamic_job_type_permission('rotation.generate', jt.id, actor)
      )
  ) then
    raise exception 'not allowed';
  end if;

  with eligible_jobs as (
    select
      jt.id,
      jt.name,
      jt.scheduling_config,
      coalesce(
        (
          select mat.work_mode
          from public.job_type_schedule_materializations mat
          where mat.job_type_id = jt.id
            and mat.effective_month <= make_date(requested_year, requested_month, 1)
          order by mat.effective_month desc
          limit 1
        ),
        jt.scheduling_config #>> '{shiftPattern,workMode}',
        'shifts'
      ) as work_mode
    from public.job_types jt
    where jt.is_active = true
      and jt.legacy_role is null
      and (
        public.has_dynamic_job_type_permission('availability.view_team', jt.id, actor)
        or public.has_dynamic_job_type_permission('availability.open_period', jt.id, actor)
        or public.has_dynamic_job_type_permission('availability.close_period', jt.id, actor)
        or public.has_dynamic_job_type_permission('availability.manage_submissions', jt.id, actor)
        or public.has_dynamic_job_type_permission('schedule.view_team', jt.id, actor)
        or public.has_dynamic_job_type_permission('schedule.create_draft', jt.id, actor)
        or public.has_dynamic_job_type_permission('schedule.edit_draft', jt.id, actor)
        or public.has_dynamic_job_type_permission('schedule.publish', jt.id, actor)
        or public.has_dynamic_job_type_permission('schedule.edit_published', jt.id, actor)
        or public.has_dynamic_job_type_permission('rotation.generate', jt.id, actor)
      )
  ),
  live_slot_rows as (
    select
      pub.id as source_period_id,
      sl.id as source_slot_id,
      ej.id as job_type_id,
      ej.name as job_type_name,
      sl.shift_date,
      sl.shift_code,
      coalesce(nullif(tmpl.name, ''), nullif(sl.shift_name, ''), sl.shift_code) as shift_name,
      to_char(display_bounds.start_at::time, 'HH24:MI:SS') as start_time,
      to_char(display_bounds.end_at::time, 'HH24:MI:SS') as end_time,
      sl.holiday_name,
      coalesce(
        case
          when sl.metadata ? 'contains200Percent'
            and lower(coalesce(sl.metadata->>'contains200Percent','')) in ('true','false')
            then (sl.metadata->>'contains200Percent')::boolean
          else null
        end,
        tmpl.contains_200_percent,
        false
      ) as contains_200_percent,
      coalesce(
        case when sl.metadata ? 'premium200Hours' then nullif(sl.metadata->>'premium200Hours','')::numeric else null end,
        tmpl.premium_200_hours,
        0
      ) as premium_200_hours,
      coalesce(sl.target_workers, 1)::integer as target_workers,
      coalesce(slot_assignment_count.assigned_count, 0)::integer as assigned_count
    from public.dynamic_schedule_publications pub
    join eligible_jobs ej on ej.id = pub.job_type_id
    join public.dynamic_availability_periods ap on ap.id = pub.availability_period_id
    join public.dynamic_availability_slots sl on sl.period_id = ap.id
    cross join lateral public.dynamic_resolve_assignment_local_interval(
      sl.shift_date,
      sl.start_time,
      sl.end_time,
      ej.work_mode,
      ej.scheduling_config
    ) display_bounds
    left join lateral (
      select count(a.id)::integer as assigned_count
      from public.dynamic_schedule_published_assignments a
      where a.publication_id = pub.id
        and a.slot_id = sl.id
    ) slot_assignment_count on true
    left join lateral (
      select st.name, st.contains_200_percent, st.premium_200_hours
      from public.job_type_schedule_materializations mat
      left join public.job_type_materialized_day_rules dr
        on dr.materialization_id = mat.id
       and dr.day_kind = coalesce(
         nullif(sl.source_day_kind, ''),
         nullif(sl.effective_day_kind, ''),
         case extract(dow from sl.shift_date)::integer
           when 5 then 'friday'
           when 6 then 'saturday'
           else 'weekday'
         end
       )
      join public.job_type_materialized_shift_templates st
        on st.materialization_id = mat.id
       and st.is_active = true
       and st.day_kind = (
         case
           when nullif(sl.effective_day_kind, '') in ('weekday','friday','saturday','holiday_full')
             then sl.effective_day_kind
           when dr.behavior = 'inherit' and dr.inherit_day_kind is not null
             then dr.inherit_day_kind
           when dr.day_kind is not null
             then dr.day_kind
           else case extract(dow from sl.shift_date)::integer
             when 5 then 'friday'
             when 6 then 'saturday'
             else 'weekday'
           end
         end
       )
      where mat.job_type_id = ej.id
        and mat.effective_month <= make_date(requested_year, requested_month, 1)
        and st.start_time = sl.start_time
        and st.end_time = sl.end_time
      order by mat.effective_month desc,
        case when st.code = sl.shift_code then 0 else 1 end,
        st.sort_order,
        st.name
      limit 1
    ) tmpl on true
    where pub.year = requested_year
      and pub.month = requested_month
      and pub.status in ('published', 'archived')
  ),
  live_groups as (
    select
      lsr.source_period_id,
      lsr.job_type_id,
      lsr.job_type_name,
      lsr.shift_date,
      (array_agg(
        lsr.shift_code
        order by lsr.assigned_count desc, lsr.source_slot_id
      ))[1] as shift_code,
      lsr.shift_name,
      lsr.start_time,
      lsr.end_time,
      max(lsr.holiday_name) as holiday_name,
      bool_or(lsr.contains_200_percent) as contains_200_percent,
      max(lsr.premium_200_hours) as premium_200_hours,
      max(lsr.target_workers)::integer as required_count,
      array_agg(
        lsr.source_slot_id
        order by lsr.assigned_count desc, lsr.source_slot_id
      ) as source_slot_ids
    from live_slot_rows lsr
    group by
      lsr.source_period_id,
      lsr.job_type_id,
      lsr.job_type_name,
      lsr.shift_date,
      lsr.shift_name,
      lsr.start_time,
      lsr.end_time
  ),
  live_slots as (
    select
      'publication'::text as period_source,
      lg.source_period_id,
      lg.source_slot_ids[1] as source_slot_id,
      lg.job_type_id,
      lg.job_type_name,
      lg.shift_date,
      lg.shift_code,
      lg.shift_name,
      lg.start_time,
      lg.end_time,
      lg.holiday_name,
      lg.contains_200_percent,
      lg.premium_200_hours,
      coalesce(assignment_data.assignments, '[]'::jsonb) as assignments,
      greatest(lg.required_count - coalesce(assignment_data.assigned_count, 0), 0)::integer as unassigned_count,
      greatest(lg.required_count, coalesce(assignment_data.assigned_count, 0), 1)::integer as required_count
    from live_groups lg
    left join lateral (
      select
        count(*)::integer as assigned_count,
        coalesce(
          jsonb_agg(
            jsonb_build_object(
              'userId', assignee.user_id,
              'displayName', assignee.display_name,
              'scheduleName', assignee.schedule_name
            ) order by coalesce(assignee.schedule_name, assignee.display_name)
          ),
          '[]'::jsonb
        ) as assignments
      from (
        select distinct on (a.user_id)
          a.user_id,
          coalesce(p.display_name, 'משתמש לא פעיל') as display_name,
          nullif(trim(p.schedule_name), '') as schedule_name
        from public.dynamic_schedule_published_assignments a
        left join public.profiles p on p.id = a.user_id
        where a.publication_id = lg.source_period_id
          and a.slot_id = any(lg.source_slot_ids)
        order by a.user_id, coalesce(nullif(trim(p.schedule_name), ''), p.display_name, 'משתמש לא פעיל')
      ) assignee
    ) assignment_data on true
  ),
  historical_rows as (
    select
      hp.id as source_period_id,
      ej.id as job_type_id,
      ej.name as job_type_name,
      hp.source_kind,
      ha.id as historical_assignment_id,
      ha.work_date as shift_date,
      coalesce(ha.shift_code, hp.source_kind || '-' || ha.work_date::text) as shift_code,
      coalesce(
        nullif(tmpl.name, ''),
        nullif(ha.source_payload->>'shift_name', ''),
        nullif(ha.source_payload #>> '{shift,name}', ''),
        case hp.source_kind
          when 'on_call' then 'כוננות יומית'
          when 'morning_driver' then 'כוננות בוקר'
          else null
        end,
        nullif(ha.shift_code, ''),
        'שיבוץ'
      ) as shift_name,
      coalesce(
        to_char(ha.starts_at at time zone 'Asia/Jerusalem', 'HH24:MI:SS'),
        nullif(ha.source_payload #>> '{shift,start_time}', ''),
        case when hp.source_kind = 'on_call' then '00:00:00' else '00:00:00' end
      ) as start_time,
      coalesce(
        to_char(ha.ends_at at time zone 'Asia/Jerusalem', 'HH24:MI:SS'),
        nullif(ha.source_payload #>> '{shift,end_time}', ''),
        case when hp.source_kind = 'on_call' then '23:59:00' else '00:00:00' end
      ) as end_time,
      coalesce(
        nullif(ha.source_payload->>'holiday_name', ''),
        nullif(ha.source_payload #>> '{shift,holiday_name}', ''),
        holiday.event_name
      ) as holiday_name,
      coalesce(
        case
          when lower(coalesce(ha.source_payload->>'is_premium','')) in ('true','false')
            then (ha.source_payload->>'is_premium')::boolean
          else null
        end,
        case
          when lower(coalesce(ha.source_payload #>> '{shift,is_premium}','')) in ('true','false')
            then (ha.source_payload #>> '{shift,is_premium}')::boolean
          else null
        end,
        tmpl.contains_200_percent,
        false
      ) as contains_200_percent,
      coalesce(tmpl.premium_200_hours, 0) as premium_200_hours,
      ha.assigned_user_id,
      p.display_name,
      nullif(trim(p.schedule_name), '') as schedule_name,
      ha.is_intentionally_unassigned
    from public.dynamic_historical_periods hp
    join eligible_jobs ej on ej.id = hp.job_type_id
    join public.dynamic_historical_assignments ha on ha.historical_period_id = hp.id
    left join public.profiles p on p.id = ha.assigned_user_id
    left join lateral (
      select csd.event_name
      from public.calendar_special_days csd
      where csd.event_date = ha.work_date
      order by
        case when csd.source_name = 'manual' then 0 else 1 end,
        csd.event_name
      limit 1
    ) holiday on true
    left join lateral (
      select st.name, st.contains_200_percent, st.premium_200_hours
      from public.job_type_schedule_materializations mat
      join public.job_type_materialized_shift_templates st
        on st.materialization_id = mat.id
       and st.is_active = true
      where mat.job_type_id = ej.id
      order by
        case when mat.effective_month <= make_date(requested_year, requested_month, 1) then 0 else 1 end,
        abs(mat.effective_month - make_date(requested_year, requested_month, 1)),
        case when st.code = ha.shift_code then 0 else 1 end,
        case
          when ha.starts_at is not null and ha.ends_at is not null
            and st.start_time = (ha.starts_at at time zone 'Asia/Jerusalem')::time
            and st.end_time = (ha.ends_at at time zone 'Asia/Jerusalem')::time
          then 0 else 1
        end,
        case
          when ha.starts_at is not null then
            abs(extract(epoch from (st.start_time - (ha.starts_at at time zone 'Asia/Jerusalem')::time)))
          else 0
        end
        + case
            when ha.ends_at is not null then
              abs(extract(epoch from (st.end_time - (ha.ends_at at time zone 'Asia/Jerusalem')::time)))
            else 0
          end,
        st.sort_order,
        st.name
      limit 1
    ) tmpl on true
    where hp.year = requested_year
      and hp.month = requested_month
      and ha.work_date is not null
      and not exists (
        select 1
        from public.dynamic_schedule_publications pub
        where pub.job_type_id = hp.job_type_id
          and pub.year = requested_year
          and pub.month = requested_month
          and pub.status in ('published', 'archived')
      )
  ),
  historical_slots as (
    select
      'history'::text as period_source,
      hr.source_period_id,
      null::uuid as source_slot_id,
      hr.job_type_id,
      hr.job_type_name,
      hr.shift_date,
      hr.shift_code,
      hr.shift_name,
      hr.start_time,
      hr.end_time,
      max(hr.holiday_name) as holiday_name,
      bool_or(hr.contains_200_percent) as contains_200_percent,
      max(hr.premium_200_hours) as premium_200_hours,
      coalesce(
        jsonb_agg(
          jsonb_build_object(
            'userId', hr.assigned_user_id,
            'displayName', coalesce(hr.display_name, 'משתמש לא פעיל'),
            'scheduleName', hr.schedule_name
          ) order by coalesce(hr.schedule_name, hr.display_name, 'משתמש לא פעיל')
        ) filter (where hr.assigned_user_id is not null and not hr.is_intentionally_unassigned),
        '[]'::jsonb
      ) as assignments,
      count(*) filter (
        where hr.assigned_user_id is null or hr.is_intentionally_unassigned
      )::integer as unassigned_count,
      greatest(count(*)::integer, 1) as required_count
    from historical_rows hr
    group by
      hr.source_period_id,
      hr.job_type_id,
      hr.job_type_name,
      hr.shift_date,
      hr.shift_code,
      hr.shift_name,
      hr.start_time,
      hr.end_time
  ),
  all_slots as (
    select * from live_slots
    union all
    select * from historical_slots
  )
  select jsonb_build_object(
    'year', requested_year,
    'month', requested_month,
    'generatedAt', now(),
    'jobTypes', coalesce((
      select jsonb_agg(
        jsonb_build_object('id', ej.id, 'name', ej.name)
        order by ej.name
      )
      from eligible_jobs ej
      where exists (
        select 1 from all_slots s where s.job_type_id = ej.id
      )
    ), '[]'::jsonb),
    'slots', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'periodSource', s.period_source,
          'sourcePeriodId', s.source_period_id,
          'sourceSlotId', s.source_slot_id,
          'jobTypeId', s.job_type_id,
          'jobTypeName', s.job_type_name,
          'shiftDate', s.shift_date,
          'shiftCode', s.shift_code,
          'shiftName', s.shift_name,
          'startTime', s.start_time,
          'endTime', s.end_time,
          'holidayName', s.holiday_name,
          'contains200Percent', s.contains_200_percent,
          'premium200Hours', s.premium_200_hours,
          'assignments', s.assignments,
          'unassignedCount', s.unassigned_count,
          'requiredCount', s.required_count
        )
        order by s.shift_date, s.start_time, s.job_type_name, s.shift_name
      )
      from all_slots s
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$function$;


revoke all on function public.get_dynamic_schedule_calendar_workspace(integer, integer) from public;
grant execute on function public.get_dynamic_schedule_calendar_workspace(integer, integer) to authenticated;

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
        'startTime', to_char(m.assignment_start_at::time, 'HH24:MI:SS'),
        'endTime', to_char(m.assignment_end_at::time, 'HH24:MI:SS')
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
              'startTime', to_char(target_bounds.start_at::time, 'HH24:MI:SS'),
              'endTime', to_char(target_bounds.end_at::time, 'HH24:MI:SS'),
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
