-- Phase 10.8.1.5
-- Excel export must use concrete published slots, not the UI calendar's logical
-- de-duplication. This keeps parallel/morning duties and unassigned slots intact.

create or replace function public.get_dynamic_schedule_export_workspace(
  requested_year integer,
  requested_month integer,
  requested_job_type_ids uuid[] default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  month_start date;
  month_end date;
  result jsonb;
begin
  if actor is null then raise exception 'not authenticated'; end if;
  if requested_year < 2020 or requested_year > 2100 or requested_month < 1 or requested_month > 12 then
    raise exception 'invalid month';
  end if;

  if not exists (select 1 from public.profiles p where p.id = actor and p.is_active = true) then
    raise exception 'inactive user';
  end if;

  -- Export is an administrative operation. Keep the same broad gate used by the
  -- settings/export surface while the per-job-type data remains Dynamic-only.
  if not (
    exists (select 1 from public.profiles p where p.id = actor and p.role = 'admin')
    or public.current_user_has_permission('users.manage')
    or public.current_user_has_permission('schedule.export')
  ) then
    raise exception 'permission denied';
  end if;

  month_start := make_date(requested_year, requested_month, 1);
  month_end := (month_start + interval '1 month')::date;

  with eligible_jobs as (
    select jt.id, jt.name
    from public.job_types jt
    where jt.is_active = true
      and jt.legacy_role is null
      and (requested_job_type_ids is null or cardinality(requested_job_type_ids) = 0 or jt.id = any(requested_job_type_ids))
  ),
  raw_slots as (
    select
      pub.id as publication_id,
      sl.id as slot_id,
      ej.id as job_type_id,
      ej.name as job_type_name,
      sl.shift_date,
      sl.shift_code,
      coalesce(nullif(sl.shift_name, ''), sl.shift_code) as shift_name,
      to_char(sl.start_time, 'HH24:MI:SS') as start_time,
      to_char(sl.end_time, 'HH24:MI:SS') as end_time,
      sl.holiday_name,
      coalesce(
        case when sl.metadata ? 'contains200Percent'
          and lower(coalesce(sl.metadata->>'contains200Percent','')) in ('true','false')
          then (sl.metadata->>'contains200Percent')::boolean end,
        false
      ) as contains_200_percent,
      coalesce(
        case when sl.metadata ? 'premium200Hours' then nullif(sl.metadata->>'premium200Hours','')::numeric end,
        0
      ) as premium_200_hours,
      greatest(coalesce(sl.target_workers, 1), 1)::integer as required_count
    from public.dynamic_schedule_publications pub
    join eligible_jobs ej on ej.id = pub.job_type_id
    join public.dynamic_availability_periods ap on ap.id = pub.availability_period_id
    join public.dynamic_availability_slots sl on sl.period_id = ap.id
    where pub.status = 'published'
      and sl.shift_date >= month_start
      and sl.shift_date < month_end
  ),
  enriched as (
    select
      rs.*,
      coalesce(a.assignments, '[]'::jsonb) as assignments,
      coalesce(a.assigned_count, 0)::integer as assigned_count
    from raw_slots rs
    left join lateral (
      select
        count(*)::integer as assigned_count,
        jsonb_agg(
          jsonb_build_object(
            'userId', x.user_id,
            'displayName', x.display_name,
            'scheduleName', x.schedule_name
          ) order by coalesce(x.schedule_name, x.display_name)
        ) as assignments
      from (
        select distinct on (pa.user_id)
          pa.user_id,
          coalesce(p.display_name, 'משתמש לא פעיל') as display_name,
          nullif(trim(p.schedule_name), '') as schedule_name
        from public.dynamic_schedule_published_assignments pa
        left join public.profiles p on p.id = pa.user_id
        where pa.publication_id = rs.publication_id
          and pa.slot_id = rs.slot_id
        order by pa.user_id
      ) x
    ) a on true
  )
  select jsonb_build_object(
    'year', requested_year,
    'month', requested_month,
    'generatedAt', now(),
    'jobTypes', coalesce((
      select jsonb_agg(jsonb_build_object('id', ej.id, 'name', ej.name) order by ej.name)
      from eligible_jobs ej
    ), '[]'::jsonb),
    'slots', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'periodSource', 'publication',
          'sourcePeriodId', e.publication_id,
          'sourceSlotId', e.slot_id,
          'jobTypeId', e.job_type_id,
          'jobTypeName', e.job_type_name,
          'shiftDate', e.shift_date,
          'shiftCode', e.shift_code,
          'shiftName', e.shift_name,
          'startTime', e.start_time,
          'endTime', e.end_time,
          'holidayName', e.holiday_name,
          'contains200Percent', e.contains_200_percent,
          'premium200Hours', e.premium_200_hours,
          'assignments', e.assignments,
          'unassignedCount', greatest(e.required_count - e.assigned_count, 0),
          'requiredCount', greatest(e.required_count, e.assigned_count, 1)
        ) order by e.shift_date, e.job_type_name, e.start_time, e.shift_code
      ) from enriched e
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

revoke all on function public.get_dynamic_schedule_export_workspace(integer, integer, uuid[]) from public;
grant execute on function public.get_dynamic_schedule_export_workspace(integer, integer, uuid[]) to authenticated;
