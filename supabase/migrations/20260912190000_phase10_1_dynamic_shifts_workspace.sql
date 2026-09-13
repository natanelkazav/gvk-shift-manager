-- Phase 10.1: Dynamic-first /shifts management workspace.
-- This creates a generic management surface keyed only by job_type_id.
-- Legacy availability/schedule roles remain untouched as a rollback layer.

begin;

create or replace function public.get_dynamic_shifts_management_workspace(
  requested_year integer,
  requested_month integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  actor_role text;
  transition_manager boolean := false;
begin
  if actor is null then raise exception 'not authenticated'; end if;
  if requested_year not between 2020 and 2100 or requested_month not between 1 and 12 then
    raise exception 'invalid year or month';
  end if;

  select p.role::text into actor_role
  from public.profiles p
  where p.id = actor and p.is_active = true;

  if actor_role is null then raise exception 'user not active'; end if;

  transition_manager := exists (
    select 1
    from public.user_permissions up
    where up.user_id = actor
      and up.permission_key in (
        'users.manage',
        'availability.manage',
        'driver_availability.manage',
        'morning_driver_availability.manage'
      )
  );

  if actor_role <> 'admin'
     and not transition_manager
     and not exists (select 1 from public.job_type_managers jm where jm.user_id = actor) then
    raise exception 'not allowed';
  end if;

  return jsonb_build_object(
    'year', requested_year,
    'month', requested_month,
    'generatedAt', now(),
    'roles', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'jobType', public.dynamic_job_type_live_snapshot(jt.id),
          'isExplicitManager', exists (
            select 1 from public.job_type_managers jm
            where jm.user_id = actor and jm.job_type_id = jt.id
          ),
          'accessSource', case
            when actor_role = 'admin' then 'system_admin'
            when exists (
              select 1 from public.job_type_managers jm
              where jm.user_id = actor and jm.job_type_id = jt.id
            ) then 'job_type_manager'
            else 'transition_manager'
          end,
          'workflow', jsonb_build_object(
            'jobTypeId', jt.id,
            'jobTypeName', jt.name,
            'year', requested_year,
            'month', requested_month,
            'memberCount', (
              select count(*)::integer
              from public.job_type_memberships m
              join public.profiles p on p.id = m.user_id and p.is_active = true
              where m.job_type_id = jt.id
            ),
            'availabilityEnabled', coalesce((jt.availability_config->>'enabled')::boolean, false),
            'schedulingStrategy', coalesce(jt.scheduling_strategy, jt.scheduling_config->>'schedulingStrategy', 'availability_optimizer'),
            'period', (
              select jsonb_build_object(
                'id', ap.id,
                'status', ap.status,
                'title', ap.title,
                'submissionDeadline', ap.submission_deadline,
                'slotCount', (select count(*)::integer from public.dynamic_availability_slots s where s.period_id = ap.id),
                'submissionCount', (select count(*)::integer from public.dynamic_availability_submissions sub where sub.period_id = ap.id),
                'submittedCount', (select count(*)::integer from public.dynamic_availability_submissions sub where sub.period_id = ap.id and sub.status = 'submitted')
              )
              from public.dynamic_availability_periods ap
              where ap.job_type_id = jt.id
                and ap.year = requested_year
                and ap.month = requested_month
              limit 1
            ),
            'draft', (
              select jsonb_build_object(
                'id', d.id,
                'status', d.status,
                'metrics', d.metrics,
                'createdAt', d.created_at,
                'updatedAt', d.updated_at
              )
              from public.dynamic_schedule_shadow_drafts d
              where d.job_type_id = jt.id
                and d.year = requested_year
                and d.month = requested_month
              order by d.created_at desc
              limit 1
            ),
            'publication', (
              select jsonb_build_object(
                'id', pub.id,
                'status', pub.status,
                'publishedAt', pub.published_at,
                'assignmentCount', (
                  select count(*)::integer
                  from public.dynamic_schedule_published_assignments a
                  where a.publication_id = pub.id
                )
              )
              from public.dynamic_schedule_publications pub
              where pub.job_type_id = jt.id
                and pub.year = requested_year
                and pub.month = requested_month
              limit 1
            )
          )
        )
        order by jt.name
      )
      from public.job_types jt
      where jt.is_active = true
        and (
          actor_role = 'admin'
          or transition_manager
          or exists (
            select 1 from public.job_type_managers jm
            where jm.user_id = actor and jm.job_type_id = jt.id
          )
        )
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.set_dynamic_period_submission_deadline(
  requested_job_type_id uuid,
  requested_year integer,
  requested_month integer,
  requested_deadline timestamptz
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  target_period public.dynamic_availability_periods%rowtype;
begin
  if actor is null then raise exception 'not authenticated'; end if;

  if not (
    public.has_dynamic_job_type_permission('availability.open_period', requested_job_type_id, actor)
    or exists (
      select 1 from public.user_permissions up
      where up.user_id = actor and up.permission_key = 'users.manage'
    )
  ) then
    raise exception 'not allowed';
  end if;

  select * into target_period
  from public.dynamic_availability_periods ap
  where ap.job_type_id = requested_job_type_id
    and ap.year = requested_year
    and ap.month = requested_month;

  if target_period.id is null then raise exception 'dynamic period not found'; end if;
  if target_period.status in ('archived') then raise exception 'archived period cannot be changed'; end if;

  update public.dynamic_availability_periods
  set submission_deadline = requested_deadline,
      updated_at = now()
  where id = target_period.id;

  insert into public.audit_logs(action, actor_user_id, entity_type, entity_id, summary, metadata)
  values(
    'system_event', actor, 'dynamic_availability_period', target_period.id,
    'מועד אחרון להגשת אילוצים עודכן',
    jsonb_build_object(
      'job_type_id', requested_job_type_id,
      'year', requested_year,
      'month', requested_month,
      'submission_deadline', requested_deadline
    )
  );
end;
$$;

revoke all on function public.get_dynamic_shifts_management_workspace(integer, integer) from public;
revoke all on function public.set_dynamic_period_submission_deadline(uuid, integer, integer, timestamptz) from public;
grant execute on function public.get_dynamic_shifts_management_workspace(integer, integer) to authenticated;
grant execute on function public.set_dynamic_period_submission_deadline(uuid, integer, integer, timestamptz) to authenticated;

commit;
