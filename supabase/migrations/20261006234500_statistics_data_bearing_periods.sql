begin;

create or replace function public.get_dynamic_statistics_data_periods(requested_job_type_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=public
as $$
declare
  actor uuid:=auth.uid();
  can_global boolean;
  can_own_activity boolean;
  result jsonb;
begin
  if actor is null then
    raise exception 'not authenticated';
  end if;

  can_global:=exists(
    select 1
    from public.user_permissions up
    where up.user_id=actor
      and up.permission_key in ('statistics.view','users.manage')
  );

  can_own_activity:=
    public.has_dynamic_job_type_permission('activity_tracking.view_own',requested_job_type_id,actor)
    and exists(
      select 1 from public.job_type_memberships m
      where m.job_type_id=requested_job_type_id and m.user_id=actor
    );

  if not (can_global or can_own_activity) then
    raise exception 'not allowed';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object('year',periods.year,'month',periods.month)
      order by periods.year desc,periods.month desc
    ),
    '[]'::jsonb
  )
  into result
  from (
    -- Published scheduling data: a real assignment or an explicitly unassigned slot.
    select distinct p.year,p.month
    from public.dynamic_schedule_publications p
    where p.job_type_id=requested_job_type_id
      and (
        exists(select 1 from public.dynamic_schedule_published_assignments a where a.publication_id=p.id)
        or exists(select 1 from public.dynamic_schedule_published_unassigned u where u.publication_id=p.id and coalesce(u.intentionally_unassigned_count,0)>0)
      )

    union

    -- Imported/archived historical scheduling data.
    select distinct hp.year,hp.month
    from public.dynamic_historical_periods hp
    where hp.job_type_id=requested_job_type_id
      and exists(
        select 1 from public.dynamic_historical_assignments ha
        where ha.historical_period_id=hp.id
      )

    union

    -- Live availability counts only after actual employee answers exist.
    select distinct ap.year,ap.month
    from public.dynamic_availability_periods ap
    where ap.job_type_id=requested_job_type_id
      and exists(
        select 1
        from public.dynamic_availability_submissions s
        join public.dynamic_availability_entries e on e.submission_id=s.id
        where s.period_id=ap.id
      )

    union

    -- Frozen historical availability snapshots.
    select distinct hp.year,hp.month
    from public.dynamic_historical_periods hp
    where hp.job_type_id=requested_job_type_id
      and exists(
        select 1 from public.dynamic_historical_availability ha
        where ha.historical_period_id=hp.id
      )

    union

    -- Legacy dispatcher availability retained through the dynamic cutover.
    select distinct lap.year,lap.month
    from public.availability_periods lap
    where exists(select 1 from public.dispatcher_availability da where da.period_id=lap.id)
      and (
        exists(
          select 1 from public.job_types jt
          where jt.id=requested_job_type_id and jt.legacy_role='dispatcher'
        )
        or exists(
          select 1
          from public.job_type_memberships m
          join public.profiles p on p.id=m.user_id
          where m.job_type_id=requested_job_type_id
            and p.role::text='dispatcher'
        )
      )

    union

    -- Activity tracking periods only when there is an actual tracked segment.
    select distinct
      extract(year from d.work_date)::integer as year,
      extract(month from d.work_date)::integer as month
    from public.activity_tracking_days d
    where d.job_type_id=requested_job_type_id
      and (can_global or d.user_id=actor)
      and exists(
        select 1 from public.activity_tracking_segments s
        where s.day_id=d.id
      )
  ) periods;

  return result;
end;
$$;

revoke all on function public.get_dynamic_statistics_data_periods(uuid) from public;
grant execute on function public.get_dynamic_statistics_data_periods(uuid) to authenticated;

commit;
