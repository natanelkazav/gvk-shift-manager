begin;

-- Phase 10.5.10 · Management scheduling hub cleanup and live-slot de-duplication.
-- Exposes one read-only monthly calendar feed for system admins and Job Type
-- managers. The feed combines live Dynamic publications with imported
-- historical schedules, while keeping Legacy adapters out of the active UI.

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
    select jt.id, jt.name
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
      to_char(sl.start_time, 'HH24:MI:SS') as start_time,
      to_char(sl.end_time, 'HH24:MI:SS') as end_time,
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
    left join lateral (
      select count(a.id)::integer as assigned_count
      from public.dynamic_schedule_published_assignments a
      where a.publication_id = pub.id
        and a.slot_id = sl.id
    ) slot_assignment_count on true
    left join lateral (
      select st.name, st.contains_200_percent, st.premium_200_hours
      from public.job_type_schedule_materializations mat
      join public.job_type_materialized_shift_templates st
        on st.materialization_id = mat.id
       and st.is_active = true
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
      lsr.shift_code,
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
      lsr.shift_code,
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
              'displayName', assignee.display_name
            ) order by assignee.display_name
          ),
          '[]'::jsonb
        ) as assignments
      from (
        select distinct on (a.user_id)
          a.user_id,
          coalesce(p.display_name, 'משתמש לא פעיל') as display_name
        from public.dynamic_schedule_published_assignments a
        left join public.profiles p on p.id = a.user_id
        where a.publication_id = lg.source_period_id
          and a.slot_id = any(lg.source_slot_ids)
        order by a.user_id, coalesce(p.display_name, 'משתמש לא פעיל')
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
            'displayName', coalesce(hr.display_name, 'משתמש לא פעיל')
          ) order by coalesce(hr.display_name, 'משתמש לא פעיל')
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

commit;
