begin;

-- Phase 10.5.5 · Unified historical personal schedule.
-- Personal schedule navigation now exposes both live Dynamic publications and
-- imported historical periods. Historical rows remain read-only and are not
-- converted into live publications.

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

  with period_rows as (
    select
      p.id as period_id,
      'publication'::text as period_source,
      jt.id as job_type_id,
      jt.name as job_type_name,
      p.year,
      p.month,
      p.status::text as status,
      p.published_at as effective_at,
      (
        select count(*)::integer
        from public.dynamic_schedule_published_assignments a
        where a.publication_id = p.id
          and a.user_id = current_user_id
      ) as assignment_count,
      coalesce(
        mat.work_mode,
        p.config_snapshot #>> '{jobType,shiftPattern,workMode}',
        jt.scheduling_config #>> '{shiftPattern,workMode}',
        'shifts'
      ) as work_mode,
      coalesce(
        mat.schedule_change_mode,
        p.config_snapshot #>> '{jobType,scheduleChangeMode}',
        jt.scheduling_config #>> '{scheduleChangeMode}',
        'none'
      ) as schedule_change_mode
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

    union all

    select
      hp.id as period_id,
      'history'::text as period_source,
      jt.id as job_type_id,
      jt.name as job_type_name,
      hp.year,
      hp.month,
      'archived'::text as status,
      hp.imported_at as effective_at,
      (
        select count(*)::integer
        from public.dynamic_historical_assignments ha
        where ha.historical_period_id = hp.id
          and ha.assigned_user_id = current_user_id
      ) as assignment_count,
      coalesce(
        mat.work_mode,
        jt.scheduling_config #>> '{shiftPattern,workMode}',
        case hp.source_kind
          when 'on_call' then 'on_call_daily'
          when 'morning_driver' then 'shifts'
          else 'shifts'
        end
      ) as work_mode,
      'none'::text as schedule_change_mode
    from public.dynamic_historical_periods hp
    join public.job_types jt
      on jt.id = hp.job_type_id
     and jt.legacy_role is null
    join public.job_type_memberships membership
      on membership.job_type_id = hp.job_type_id
     and membership.user_id = current_user_id
    left join lateral (
      select m.work_mode
      from public.job_type_schedule_materializations m
      where m.job_type_id = hp.job_type_id
        and m.effective_month <= make_date(hp.year, hp.month, 1)
      order by m.effective_month desc
      limit 1
    ) mat on true
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'publicationId', row.period_id,
        'periodSource', row.period_source,
        'jobTypeId', row.job_type_id,
        'jobTypeName', row.job_type_name,
        'year', row.year,
        'month', row.month,
        'status', row.status,
        'publishedAt', row.effective_at,
        'assignmentCount', row.assignment_count,
        'workMode', row.work_mode,
        'scheduleChangeMode', row.schedule_change_mode
      )
      order by row.year desc, row.month desc, row.job_type_name
    ),
    '[]'::jsonb
  )
  into result
  from period_rows row;

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
  target_history public.dynamic_historical_periods%rowtype;
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

  if target_publication.id is not null then
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
      'periodSource', 'publication',
      'readOnly', false,
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
  end if;

  select * into target_history
  from public.dynamic_historical_periods
  where id = requested_publication_id;

  if target_history.id is null then
    raise exception 'schedule period not found';
  end if;

  select * into target_job
  from public.job_types
  where id = target_history.job_type_id
    and legacy_role is null;

  if target_job.id is null then
    raise exception 'dynamic job type not found';
  end if;

  if not exists (
    select 1
    from public.job_type_memberships m
    where m.job_type_id = target_history.job_type_id
      and m.user_id = current_user_id
  ) then
    raise exception 'not allowed';
  end if;

  select coalesce(
    (
      select mat.work_mode
      from public.job_type_schedule_materializations mat
      where mat.job_type_id = target_job.id
        and mat.effective_month <= make_date(target_history.year, target_history.month, 1)
      order by mat.effective_month desc
      limit 1
    ),
    target_job.scheduling_config #>> '{shiftPattern,workMode}',
    case target_history.source_kind
      when 'on_call' then 'on_call_daily'
      else 'shifts'
    end
  ) into work_mode;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', q.id,
      'shiftDate', q.shift_date,
      'shiftCode', q.shift_code,
      'shiftName', q.display_shift_name,
      'startTime', q.start_time,
      'endTime', q.end_time,
      'assignmentTier', 'historical',
      'managerEdited', false,
      'managerOverrideNote', null,
      'holidayName', q.holiday_name,
      'sourceDayKind', q.source_day_kind,
      'contains200Percent', q.contains_200_percent,
      'premium200Hours', q.premium_200_hours
    ) order by q.shift_date, q.start_time, q.display_shift_name
  ), '[]'::jsonb)
  into assignments_json
  from (
    select
      ha.id,
      ha.work_date as shift_date,
      coalesce(ha.shift_code, ha.source_kind || '-' || ha.id::text) as shift_code,
      coalesce(
        nullif(tmpl.name, ''),
        nullif(ha.source_payload->>'shift_name', ''),
        nullif(ha.source_payload #>> '{shift,name}', ''),
        case target_history.source_kind
          when 'on_call' then 'כוננות יומית'
          when 'morning_driver' then 'כוננות בוקר'
          else null
        end,
        nullif(ha.shift_code, ''),
        'שיבוץ'
      ) as display_shift_name,
      coalesce(
        to_char(ha.starts_at at time zone 'Asia/Jerusalem', 'HH24:MI:SS'),
        nullif(ha.source_payload #>> '{shift,start_time}', ''),
        case when target_history.source_kind = 'on_call' then '00:00:00' else '00:00:00' end
      ) as start_time,
      coalesce(
        to_char(ha.ends_at at time zone 'Asia/Jerusalem', 'HH24:MI:SS'),
        nullif(ha.source_payload #>> '{shift,end_time}', ''),
        case when target_history.source_kind = 'on_call' then '23:59:00' else '00:00:00' end
      ) as end_time,
      coalesce(
        nullif(ha.source_payload->>'holiday_name', ''),
        nullif(ha.source_payload #>> '{shift,holiday_name}', ''),
        holiday.event_name
      ) as holiday_name,
      coalesce(
        nullif(ha.source_payload->>'schedule_type', ''),
        nullif(ha.source_payload #>> '{shift,schedule_type}', ''),
        holiday.schedule_type
      ) as source_day_kind,
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
      coalesce(tmpl.premium_200_hours, 0) as premium_200_hours
    from public.dynamic_historical_assignments ha
    left join lateral (
      select csd.event_name, csd.schedule_type
      from public.calendar_special_days csd
      where csd.event_date = ha.work_date
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
        and mat.effective_month <= make_date(target_history.year, target_history.month, 1)
        and (
          (ha.starts_at is not null and ha.ends_at is not null
            and st.start_time = (ha.starts_at at time zone 'Asia/Jerusalem')::time
            and st.end_time = (ha.ends_at at time zone 'Asia/Jerusalem')::time)
          or st.code = ha.shift_code
        )
      order by
        mat.effective_month desc,
        case when st.code = ha.shift_code then 0 else 1 end,
        st.sort_order,
        st.name
      limit 1
    ) tmpl on true
    where ha.historical_period_id = target_history.id
      and ha.assigned_user_id = current_user_id
  ) q;

  return jsonb_build_object(
    'publicationId', target_history.id,
    'periodSource', 'history',
    'readOnly', true,
    'jobTypeId', target_job.id,
    'jobTypeName', target_job.name,
    'year', target_history.year,
    'month', target_history.month,
    'status', 'archived',
    'publishedAt', target_history.imported_at,
    'workMode', work_mode,
    'scheduleChangeMode', 'none',
    'assignments', assignments_json
  );
end;
$function$;

revoke all on function public.get_my_dynamic_schedule_workspace(uuid) from public;
grant execute on function public.get_my_dynamic_schedule_workspace(uuid) to authenticated;

commit;
