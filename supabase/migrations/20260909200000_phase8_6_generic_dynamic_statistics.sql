begin;

-- Phase 8.6: generic statistics for dynamic job types.
-- Runtime analytics are keyed only by job_type_id. Legacy role names are not used.

create or replace function public.get_dynamic_statistics_job_types()
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'not authenticated';
  end if;

  if not exists (
    select 1
    from public.user_permissions up
    where up.user_id = current_user_id
      and up.permission_key in ('statistics.view','users.manage')
  ) then
    raise exception 'not allowed';
  end if;

  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'jobTypeId', jt.id,
        'name', jt.name,
        'code', jt.code,
        'isActive', jt.is_active,
        'payModel', jt.pay_model,
        'workMode', coalesce(
          nullif(jt.scheduling_config->'shiftPattern'->>'workMode',''),
          nullif(jt.scheduling_config->>'workMode','')
        ),
        'availabilityEnabled', coalesce((jt.availability_config->>'enabled')::boolean, false),
        'memberCount', (
          select count(*)
          from public.job_type_memberships m
          join public.profiles p on p.id=m.user_id
          where m.job_type_id=jt.id and p.is_active=true
        ),
        'dataPeriodCount', (
          select count(*)
          from (
            select p.year,p.month
            from public.dynamic_schedule_publications p
            where p.job_type_id=jt.id
            union
            select hp.year,hp.month
            from public.dynamic_historical_periods hp
            where hp.job_type_id=jt.id
          ) periods
        )
      )
      order by jt.is_active desc, jt.name
    )
    from public.job_types jt
    where jt.is_active = true
       or exists(select 1 from public.job_type_memberships m where m.job_type_id=jt.id)
       or exists(select 1 from public.dynamic_schedule_publications p where p.job_type_id=jt.id)
       or exists(select 1 from public.dynamic_historical_periods hp where hp.job_type_id=jt.id)
  ), '[]'::jsonb);
end;
$function$;

revoke all on function public.get_dynamic_statistics_job_types() from public;
grant execute on function public.get_dynamic_statistics_job_types() to authenticated;

create or replace function public.get_dynamic_job_type_statistics(
  requested_job_type_id uuid,
  requested_years integer[] default null,
  requested_months integer[] default null,
  requested_user_ids uuid[] default null
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  current_user_id uuid := auth.uid();
  target_job public.job_types%rowtype;
  result jsonb;
begin
  if current_user_id is null then
    raise exception 'not authenticated';
  end if;

  if not exists (
    select 1
    from public.user_permissions up
    where up.user_id=current_user_id
      and up.permission_key in ('statistics.view','users.manage')
  ) then
    raise exception 'not allowed';
  end if;

  select * into target_job
  from public.job_types jt
  where jt.id=requested_job_type_id;

  if target_job.id is null then
    raise exception 'job type not found';
  end if;

  if requested_years is not null and exists (
    select 1 from unnest(requested_years) y where y not between 2020 and 2100
  ) then
    raise exception 'statistics year is invalid';
  end if;

  if requested_months is not null and exists (
    select 1 from unnest(requested_months) m where m not between 1 and 12
  ) then
    raise exception 'statistics month is invalid';
  end if;

  with
  selected_publications as (
    select p.*
    from public.dynamic_schedule_publications p
    where p.job_type_id=requested_job_type_id
      and (requested_years is null or cardinality(requested_years)=0 or p.year=any(requested_years))
      and (requested_months is null or cardinality(requested_months)=0 or p.month=any(requested_months))
  ),
  selected_history_periods as (
    select hp.*
    from public.dynamic_historical_periods hp
    where hp.job_type_id=requested_job_type_id
      and (requested_years is null or cardinality(requested_years)=0 or hp.year=any(requested_years))
      and (requested_months is null or cardinality(requested_months)=0 or hp.month=any(requested_months))
      and not exists (
        select 1
        from public.dynamic_schedule_publications p
        where p.job_type_id=hp.job_type_id
          and p.year=hp.year
          and p.month=hp.month
      )
  ),
  raw_assignments as (
    select
      p.year,
      p.month,
      a.shift_date as work_date,
      a.shift_code,
      a.shift_name,
      a.user_id,
      case
        when a.start_time is null or a.end_time is null then null::numeric
        else round((extract(epoch from (
          (a.shift_date + a.end_time + case when a.end_time <= a.start_time then interval '1 day' else interval '0 day' end)
          - (a.shift_date + a.start_time)
        )) / 3600.0)::numeric, 2)
      end as timed_hours,
      coalesce(a.manager_edited,false) as manager_edited,
      case when a.original_user_id is not null and a.original_user_id<>a.user_id then true else false end as substituted
    from selected_publications p
    join public.dynamic_schedule_published_assignments a on a.publication_id=p.id

    union all

    select
      hp.year,
      hp.month,
      ha.work_date,
      coalesce(nullif(ha.shift_code,''),'history') as shift_code,
      coalesce(
        nullif(ha.source_payload->>'shift_name',''),
        nullif(ha.source_payload->>'shiftName',''),
        nullif(ha.shift_code,''),
        'רשומה היסטורית'
      ) as shift_name,
      ha.assigned_user_id as user_id,
      case
        when ha.starts_at is null or ha.ends_at is null or ha.ends_at<=ha.starts_at then null::numeric
        else round((extract(epoch from (ha.ends_at-ha.starts_at))/3600.0)::numeric,2)
      end as timed_hours,
      false as manager_edited,
      case when ha.original_user_id is not null and ha.assigned_user_id is not null and ha.original_user_id<>ha.assigned_user_id then true else false end as substituted
    from selected_history_periods hp
    join public.dynamic_historical_assignments ha on ha.historical_period_id=hp.id
    where ha.assigned_user_id is not null
      and coalesce(ha.is_intentionally_unassigned,false)=false
  ),
  all_assignments as (
    select *
    from raw_assignments a
    where requested_user_ids is null
       or cardinality(requested_user_ids)=0
       or a.user_id=any(requested_user_ids)
  ),
  unassigned as (
    select p.year,p.month,coalesce(sum(u.intentionally_unassigned_count),0)::integer as count
    from selected_publications p
    join public.dynamic_schedule_published_unassigned u on u.publication_id=p.id
    group by p.year,p.month
  ),
  selected_live_periods as (
    select ap.*
    from public.dynamic_availability_periods ap
    where ap.job_type_id=requested_job_type_id
      and (requested_years is null or cardinality(requested_years)=0 or ap.year=any(requested_years))
      and (requested_months is null or cardinality(requested_months)=0 or ap.month=any(requested_months))
  ),
  raw_availability_rows as (
    select
      ap.id as period_id,
      s.user_id,
      e.availability_status as status,
      case when s.status='submitted' then true else false end as submitted
    from selected_live_periods ap
    join public.dynamic_availability_submissions s on s.period_id=ap.id
    join public.dynamic_availability_entries e on e.submission_id=s.id

    union all

    select
      hp.id as period_id,
      ha.user_id,
      ha.status,
      true as submitted
    from selected_history_periods hp
    join public.dynamic_historical_availability ha on ha.historical_period_id=hp.id
    where ha.user_id is not null
  ),
  availability_rows as (
    select *
    from raw_availability_rows ar
    where requested_user_ids is null
       or cardinality(requested_user_ids)=0
       or ar.user_id=any(requested_user_ids)
  ),
  candidate_users as (
    select m.user_id from public.job_type_memberships m where m.job_type_id=requested_job_type_id
    union
    select a.user_id from raw_assignments a where a.user_id is not null
    union
    select ar.user_id from raw_availability_rows ar where ar.user_id is not null
  ),
  available_periods as (
    select p.year,p.month from public.dynamic_schedule_publications p where p.job_type_id=requested_job_type_id
    union
    select hp.year,hp.month from public.dynamic_historical_periods hp where hp.job_type_id=requested_job_type_id
    union
    select ap.year,ap.month from public.dynamic_availability_periods ap where ap.job_type_id=requested_job_type_id
  )
  select jsonb_build_object(
    'jobType', jsonb_build_object(
      'jobTypeId',target_job.id,
      'name',target_job.name,
      'code',target_job.code,
      'payModel',target_job.pay_model,
      'workMode',coalesce(
        nullif(target_job.scheduling_config->'shiftPattern'->>'workMode',''),
        nullif(target_job.scheduling_config->>'workMode','')
      ),
      'availabilityEnabled',coalesce((target_job.availability_config->>'enabled')::boolean,false)
    ),
    'filters',jsonb_build_object(
      'years',coalesce(to_jsonb(requested_years),'[]'::jsonb),
      'months',coalesce(to_jsonb(requested_months),'[]'::jsonb)
    ),
    'availablePeriods',coalesce((
      select jsonb_agg(jsonb_build_object('year',p.year,'month',p.month) order by p.year desc,p.month desc)
      from available_periods p
    ),'[]'::jsonb),
    'summary',jsonb_build_object(
      'assignmentCount',(select count(*) from all_assignments),
      'timedAssignmentCount',(select count(*) from all_assignments where timed_hours is not null),
      'untimedAssignmentCount',(select count(*) from all_assignments where timed_hours is null),
      'timedHours',coalesce((select round(sum(timed_hours),2) from all_assignments where timed_hours is not null),0),
      'uniqueWorkerCount',(select count(distinct user_id) from all_assignments),
      'monthCount',(select count(*) from (select distinct year,month from all_assignments) x),
      'intentionallyUnassignedCount',coalesce((select sum(count) from unassigned),0),
      'managerEditedCount',(select count(*) from all_assignments where manager_edited),
      'substitutionCount',(select count(*) from all_assignments where substituted)
    ),
    'people',coalesce((
      select jsonb_agg(jsonb_build_object(
        'userId',p.id,
        'displayName',p.display_name,
        'scheduleName',p.schedule_name,
        'isActive',p.is_active,
        'isMember',exists(select 1 from public.job_type_memberships m where m.job_type_id=requested_job_type_id and m.user_id=p.id),
        'assignmentCount',coalesce(stats.assignment_count,0),
        'timedHours',coalesce(stats.timed_hours,0),
        'monthsWorked',coalesce(stats.months_worked,0),
        'managerEditedCount',coalesce(stats.manager_edited_count,0),
        'substitutionCount',coalesce(stats.substitution_count,0)
      ) order by coalesce(stats.assignment_count,0) desc,p.display_name)
      from candidate_users cu
      join public.profiles p on p.id=cu.user_id
      left join lateral (
        select
          count(*)::integer assignment_count,
          coalesce(round(sum(a.timed_hours) filter(where a.timed_hours is not null),2),0) timed_hours,
          count(distinct (a.year,a.month))::integer months_worked,
          count(*) filter(where a.manager_edited)::integer manager_edited_count,
          count(*) filter(where a.substituted)::integer substitution_count
        from all_assignments a
        where a.user_id=p.id
      ) stats on true
    ),'[]'::jsonb),
    'monthly',coalesce((
      select jsonb_agg(jsonb_build_object(
        'year',m.year,
        'month',m.month,
        'assignmentCount',m.assignment_count,
        'timedHours',m.timed_hours,
        'uniqueWorkerCount',m.unique_worker_count,
        'intentionallyUnassignedCount',coalesce(u.count,0)
      ) order by m.year,m.month)
      from (
        select
          year,
          month,
          count(*)::integer assignment_count,
          coalesce(round(sum(timed_hours) filter(where timed_hours is not null),2),0) timed_hours,
          count(distinct user_id)::integer unique_worker_count
        from all_assignments
        group by year,month
      ) m
      left join unassigned u on u.year=m.year and u.month=m.month
    ),'[]'::jsonb),
    'shifts',coalesce((
      select jsonb_agg(jsonb_build_object(
        'shiftCode',s.shift_code,
        'shiftName',s.shift_name,
        'assignmentCount',s.assignment_count,
        'timedHours',s.timed_hours
      ) order by s.assignment_count desc,s.shift_name)
      from (
        select
          shift_code,
          max(shift_name) shift_name,
          count(*)::integer assignment_count,
          coalesce(round(sum(timed_hours) filter(where timed_hours is not null),2),0) timed_hours
        from all_assignments
        group by shift_code
      ) s
    ),'[]'::jsonb),
    'availabilitySummary',jsonb_build_object(
      'periodCount',(select count(distinct period_id) from availability_rows),
      'submissionCount',(select count(distinct (period_id,user_id)) from availability_rows where submitted),
      'availableCount',(select count(*) from availability_rows where status='available'),
      'unavailableCount',(select count(*) from availability_rows where status='unavailable'),
      'preferredCount',(select count(*) from availability_rows where status='preferred'),
      'avoidCount',(select count(*) from availability_rows where status='avoid')
    ),
    'availabilityPeople',coalesce((
      select jsonb_agg(jsonb_build_object(
        'userId',p.id,
        'displayName',p.display_name,
        'scheduleName',p.schedule_name,
        'isActive',p.is_active,
        'submittedPeriods',coalesce(stats.submitted_periods,0),
        'availableCount',coalesce(stats.available_count,0),
        'unavailableCount',coalesce(stats.unavailable_count,0),
        'preferredCount',coalesce(stats.preferred_count,0),
        'avoidCount',coalesce(stats.avoid_count,0),
        'totalEntries',coalesce(stats.total_entries,0)
      ) order by coalesce(stats.total_entries,0) desc,p.display_name)
      from candidate_users cu
      join public.profiles p on p.id=cu.user_id
      left join lateral (
        select
          count(distinct ar.period_id) filter(where ar.submitted)::integer submitted_periods,
          count(*) filter(where ar.status='available')::integer available_count,
          count(*) filter(where ar.status='unavailable')::integer unavailable_count,
          count(*) filter(where ar.status='preferred')::integer preferred_count,
          count(*) filter(where ar.status='avoid')::integer avoid_count,
          count(*)::integer total_entries
        from availability_rows ar
        where ar.user_id=p.id
      ) stats on true
    ),'[]'::jsonb),
    'generatedAt',now()
  ) into result;

  return result;
end;
$function$;

revoke all on function public.get_dynamic_job_type_statistics(uuid,integer[],integer[],uuid[]) from public;
grant execute on function public.get_dynamic_job_type_statistics(uuid,integer[],integer[],uuid[]) to authenticated;

commit;
