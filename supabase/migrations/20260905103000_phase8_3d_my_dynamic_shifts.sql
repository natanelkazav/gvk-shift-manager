begin;

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

  select coalesce(jsonb_agg(item order by (item->>'year')::integer desc, (item->>'month')::integer desc, item->>'jobTypeName'), '[]'::jsonb)
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
        p.config_snapshot #>> '{jobType,shiftPattern,workMode}',
        jt.scheduling_config #>> '{shiftPattern,workMode}',
        'shifts'
      ),
      'scheduleChangeMode', coalesce(
        p.config_snapshot #>> '{jobType,scheduleChangeMode}',
        jt.scheduling_config #>> '{scheduleChangeMode}',
        'none'
      )
    ) as item
    from public.dynamic_schedule_publications p
    join public.job_types jt on jt.id = p.job_type_id
    join public.job_type_memberships m
      on m.job_type_id = p.job_type_id
     and m.user_id = current_user_id
    where p.status in ('published', 'archived')
  ) rows;

  return result;
end;
$function$;

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

  if not exists (
    select 1
    from public.job_type_memberships m
    where m.job_type_id = target_publication.job_type_id
      and m.user_id = current_user_id
  ) then
    raise exception 'not allowed';
  end if;

  select * into target_job
  from public.job_types
  where id = target_publication.job_type_id;

  work_mode := coalesce(
    target_publication.config_snapshot #>> '{jobType,shiftPattern,workMode}',
    target_job.scheduling_config #>> '{shiftPattern,workMode}',
    'shifts'
  );

  change_mode := coalesce(
    target_publication.config_snapshot #>> '{jobType,scheduleChangeMode}',
    target_job.scheduling_config #>> '{scheduleChangeMode}',
    'none'
  );

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', a.id,
      'shiftDate', a.shift_date,
      'shiftCode', a.shift_code,
      'shiftName', a.shift_name,
      'startTime', a.start_time,
      'endTime', a.end_time,
      'assignmentTier', a.assignment_tier,
      'managerEdited', a.manager_edited,
      'managerOverrideNote', a.manager_override_note
    ) order by a.shift_date, a.start_time, a.shift_name
  ), '[]'::jsonb)
  into assignments_json
  from public.dynamic_schedule_published_assignments a
  where a.publication_id = target_publication.id
    and a.user_id = current_user_id;

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

revoke all on function public.get_my_dynamic_schedule_periods() from public;
revoke all on function public.get_my_dynamic_schedule_workspace(uuid) from public;
grant execute on function public.get_my_dynamic_schedule_periods() to authenticated;
grant execute on function public.get_my_dynamic_schedule_workspace(uuid) to authenticated;

commit;
