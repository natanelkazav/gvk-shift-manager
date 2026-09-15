begin;

-- Historical Dynamic publications are archive data. The old monthly Edge Function
-- archived/exported the Legacy schedules but never moved Dynamic publications from
-- published -> archived, so repair already-finished months once during cutover.
update public.dynamic_schedule_publications
set status='archived', updated_at=now()
where status='published'
  and make_date(year,month,1) < date_trunc('month',timezone('Asia/Jerusalem',now()))::date;

create or replace function public.get_dynamic_archive_periods()
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_actor uuid:=auth.uid();
begin
  if v_actor is null then raise exception 'not authenticated'; end if;

  if not (
    exists(select 1 from public.user_permissions up
      where up.user_id=v_actor and up.permission_key in ('users.view','users.manage'))
    or exists(select 1 from public.job_type_managers jm where jm.user_id=v_actor)
  ) then
    raise exception 'not allowed';
  end if;

  return jsonb_build_object(
    'generatedAt',now(),
    'periods',coalesce((
      with months as (
        select distinct p.year,p.month
        from public.dynamic_schedule_publications p
        where make_date(p.year,p.month,1) <
              date_trunc('month',timezone('Asia/Jerusalem',now()))::date
      ),
      role_rows as (
        select
          p.year,p.month,p.id publication_id,p.job_type_id,jt.name job_type_name,
          p.status,p.published_at,p.updated_at,
          count(a.id)::integer assignment_count,
          count(distinct a.user_id)::integer worker_count
        from public.dynamic_schedule_publications p
        join public.job_types jt on jt.id=p.job_type_id
        left join public.dynamic_schedule_published_assignments a on a.publication_id=p.id
        where make_date(p.year,p.month,1) <
              date_trunc('month',timezone('Asia/Jerusalem',now()))::date
        group by p.year,p.month,p.id,p.job_type_id,jt.name,p.status,p.published_at,p.updated_at
      )
      select jsonb_agg(jsonb_build_object(
        'year',m.year,
        'month',m.month,
        'isFullyArchived',not exists(
          select 1 from role_rows x
          where x.year=m.year and x.month=m.month and x.status<>'archived'
        ),
        'archivedAt',(
          select max(x.updated_at) from role_rows x
          where x.year=m.year and x.month=m.month and x.status='archived'
        ),
        'jobTypes',coalesce((
          select jsonb_agg(jsonb_build_object(
            'publicationId',r.publication_id,
            'jobTypeId',r.job_type_id,
            'jobTypeName',r.job_type_name,
            'status',r.status,
            'assignmentCount',r.assignment_count,
            'workerCount',r.worker_count,
            'publishedAt',r.published_at,
            'archivedAt',case when r.status='archived' then r.updated_at else null end
          ) order by r.job_type_name)
          from role_rows r where r.year=m.year and r.month=m.month
        ),'[]'::jsonb)
      ) order by m.year desc,m.month desc)
      from months m
    ),'[]'::jsonb)
  );
end;
$function$;

revoke all on function public.get_dynamic_archive_periods() from public;
grant execute on function public.get_dynamic_archive_periods() to authenticated;

commit;
