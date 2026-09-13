begin;

-- Phase 8.3E.2.6
-- Employee navigation and "My shifts" must resolve post-publication behavior from
-- the same effective-month materialization used by the exchange engine.
-- Without this, an October-only shift_exchange configuration could be active in
-- job_type_schedule_materializations while get_my_dynamic_schedule_periods()
-- still returned scheduleChangeMode='none', leaving the user on the Legacy route.

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

commit;
