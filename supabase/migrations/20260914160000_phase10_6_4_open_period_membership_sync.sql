begin;

-- Phase 10.6.4
-- Keep availability eligibility live while a period is open.
-- A newly added active member immediately becomes eligible to submit.
-- A removed/inactive member is excluded from current progress counters, while
-- historical submission rows remain untouched for audit/history.

create or replace function public.get_dynamic_period_workflow(
  requested_job_type_id uuid,
  requested_year integer,
  requested_month integer
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  current_user_id uuid := auth.uid();
  target_job public.job_types%rowtype;
  target_period public.dynamic_availability_periods%rowtype;
  latest_draft public.dynamic_schedule_shadow_drafts%rowtype;
  publication public.dynamic_schedule_publications%rowtype;
  member_count integer := 0;
  slot_count integer := 0;
  submission_count integer := 0;
  submitted_count integer := 0;
  assignment_count integer := 0;
begin
  if current_user_id is null then raise exception 'not authenticated'; end if;
  if not (
    public.has_dynamic_job_type_permission('availability.view_team', requested_job_type_id, current_user_id)
    or public.has_dynamic_job_type_permission('schedule.view_team', requested_job_type_id, current_user_id)
  ) then raise exception 'not allowed'; end if;
  if requested_month not between 1 and 12 then raise exception 'invalid month'; end if;

  select * into target_job from public.job_types where id=requested_job_type_id and legacy_role is null;
  if target_job.id is null then raise exception 'job type not found'; end if;

  select count(*) into member_count
  from public.job_type_memberships m
  join public.profiles p on p.id=m.user_id
  where m.job_type_id=target_job.id and p.is_active=true;

  select * into target_period
  from public.dynamic_availability_periods
  where job_type_id=target_job.id and year=requested_year and month=requested_month;

  if target_period.id is not null then
    select count(*) into slot_count
    from public.dynamic_availability_slots
    where period_id=target_period.id;

    select
      count(*) filter (where sub.id is not null),
      count(*) filter (where sub.status='submitted')
    into submission_count, submitted_count
    from public.job_type_memberships m
    join public.profiles p on p.id=m.user_id and p.is_active=true
    left join public.dynamic_availability_submissions sub
      on sub.period_id=target_period.id and sub.user_id=m.user_id
    where m.job_type_id=target_job.id;

    select * into latest_draft
    from public.dynamic_schedule_shadow_drafts
    where job_type_id=target_job.id and year=requested_year and month=requested_month
    order by created_at desc limit 1;
  end if;

  select * into publication
  from public.dynamic_schedule_publications
  where job_type_id=target_job.id and year=requested_year and month=requested_month;

  if publication.id is not null then
    select count(*) into assignment_count
    from public.dynamic_schedule_published_assignments
    where publication_id=publication.id;
  end if;

  return jsonb_build_object(
    'jobTypeId', target_job.id,
    'jobTypeName', target_job.name,
    'year', requested_year,
    'month', requested_month,
    'memberCount', member_count,
    'availabilityEnabled', coalesce((target_job.availability_config->>'enabled')::boolean,false),
    'schedulingStrategy', coalesce(target_job.scheduling_strategy, target_job.scheduling_config->>'schedulingStrategy','availability_optimizer'),
    'permissions', jsonb_build_object(
      'availability.view_team', public.has_dynamic_job_type_permission('availability.view_team', target_job.id, current_user_id),
      'availability.open_period', public.has_dynamic_job_type_permission('availability.open_period', target_job.id, current_user_id),
      'availability.close_period', public.has_dynamic_job_type_permission('availability.close_period', target_job.id, current_user_id),
      'availability.manage_submissions', public.has_dynamic_job_type_permission('availability.manage_submissions', target_job.id, current_user_id),
      'schedule.view_team', public.has_dynamic_job_type_permission('schedule.view_team', target_job.id, current_user_id),
      'schedule.create_draft', public.has_dynamic_job_type_permission('schedule.create_draft', target_job.id, current_user_id),
      'schedule.edit_draft', public.has_dynamic_job_type_permission('schedule.edit_draft', target_job.id, current_user_id),
      'schedule.publish', public.has_dynamic_job_type_permission('schedule.publish', target_job.id, current_user_id),
      'schedule.edit_published', public.has_dynamic_job_type_permission('schedule.edit_published', target_job.id, current_user_id),
      'rotation.generate', public.has_dynamic_job_type_permission('rotation.generate', target_job.id, current_user_id)
    ),
    'period', case when target_period.id is null then null else jsonb_build_object(
      'id',target_period.id,
      'status',target_period.status,
      'title',target_period.title,
      'submissionDeadline',target_period.submission_deadline,
      'slotCount',slot_count,
      'submissionCount',submission_count,
      'submittedCount',submitted_count,
      'pendingCount',greatest(member_count-submitted_count,0)
    ) end,
    'draft', case when latest_draft.id is null then null else jsonb_build_object(
      'id',latest_draft.id,'status',latest_draft.status,'metrics',latest_draft.metrics,
      'createdAt',latest_draft.created_at,'updatedAt',latest_draft.updated_at
    ) end,
    'publication', case when publication.id is null then null else jsonb_build_object(
      'id',publication.id,'status',publication.status,'publishedAt',publication.published_at,
      'assignmentCount',assignment_count
    ) end
  );
end;
$function$;

grant execute on function public.get_dynamic_period_workflow(uuid,integer,integer) to authenticated;

-- Preserve the existing assignment editor behavior, while notifying a user who
-- is newly attached to a Job Type that already has an open availability period.
create or replace function public.save_dynamic_user_assignments(
  target_user_id uuid,
  requested_assignments jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  item jsonb;
  requested_job_type_id uuid;
  requested_is_member boolean;
  requested_is_manager boolean;
  requested_employment_scope text;
  requested_part_time_definition jsonb;
  configured_scope text;
  was_member boolean;
  open_period record;
  created_notification_id uuid;
begin
  if actor is null then raise exception 'not authenticated'; end if;
  if not exists (
    select 1 from public.user_permissions up
    where up.user_id = actor and up.permission_key = 'users.manage'
  ) then raise exception 'not allowed'; end if;
  if not exists (select 1 from public.profiles p where p.id = target_user_id) then
    raise exception 'user not found';
  end if;
  if jsonb_typeof(coalesce(requested_assignments, '[]'::jsonb)) <> 'array' then
    raise exception 'requested_assignments must be an array';
  end if;

  for item in select value from jsonb_array_elements(coalesce(requested_assignments, '[]'::jsonb)) loop
    requested_job_type_id := nullif(item->>'jobTypeId','')::uuid;
    requested_is_member := coalesce((item->>'isMember')::boolean, false);
    requested_is_manager := coalesce((item->>'isManager')::boolean, false);
    requested_employment_scope := nullif(trim(coalesce(item->>'employmentScope','')), '');
    requested_part_time_definition := coalesce(item->'partTimeDefinition', '{}'::jsonb);

    select exists(
      select 1 from public.job_type_memberships m
      where m.user_id=target_user_id and m.job_type_id=requested_job_type_id
    ) into was_member;

    select jt.employment_scope into configured_scope
    from public.job_types jt
    where jt.id = requested_job_type_id
      and jt.legacy_role is null;

    if configured_scope is null then raise exception 'dynamic job type not found'; end if;

    if requested_is_member then
      if configured_scope <> 'flexible' then
        requested_employment_scope := configured_scope;
      elsif requested_employment_scope not in ('full_time','part_time','as_much_as_possible') then
        requested_employment_scope := 'full_time';
      end if;

      insert into public.job_type_memberships(user_id, job_type_id, is_primary, source, metadata)
      values (
        target_user_id,
        requested_job_type_id,
        false,
        'dynamic_users',
        jsonb_build_object(
          'employmentScope', requested_employment_scope,
          'partTimeDefinition', requested_part_time_definition
        )
      )
      on conflict (user_id, job_type_id) do update
      set source = 'dynamic_users',
          metadata = jsonb_set(
            jsonb_set(coalesce(public.job_type_memberships.metadata, '{}'::jsonb), '{employmentScope}', to_jsonb(requested_employment_scope), true),
            '{partTimeDefinition}', requested_part_time_definition, true
          ),
          updated_at = now();

      -- No snapshot is created: eligibility is intentionally based on the live
      -- membership table. The notification simply tells the newly-added user
      -- that an already-open period is now available to them.
      if not was_member then
        for open_period in
          select ap.id, ap.year, ap.month, ap.submission_deadline, jt.name as job_type_name
          from public.dynamic_availability_periods ap
          join public.job_types jt on jt.id=ap.job_type_id
          where ap.job_type_id=requested_job_type_id
            and ap.status='open'
            and (ap.submission_deadline is null or ap.submission_deadline >= now())
        loop
          insert into public.notifications(
            type, priority, source, title, body, url, data, created_by, expires_at
          ) values (
            'availability_open',
            'important',
            'dynamic_membership',
            concat('תקופת אילוצים פתוחה · ', open_period.job_type_name),
            concat(
              'צורפת לתפקיד בזמן שתקופת האילוצים לחודש ',
              lpad(open_period.month::text,2,'0'),'/',open_period.year,
              ' פתוחה. ניתן להגיש אילוצים במערכת.'
            ),
            '/my-availability',
            jsonb_build_object(
              'workflow','dynamic_availability',
              'event','member_added_to_open_period',
              'jobTypeId',requested_job_type_id,
              'periodId',open_period.id,
              'year',open_period.year,
              'month',open_period.month,
              'submissionDeadline',open_period.submission_deadline
            ),
            actor,
            now() + interval '90 days'
          ) returning id into created_notification_id;

          insert into public.notification_recipients(notification_id,user_id)
          values(created_notification_id,target_user_id)
          on conflict do nothing;
        end loop;

        insert into public.audit_logs(action,actor_user_id,entity_type,entity_id,summary,metadata)
        values(
          'system_event',actor,'job_type_membership',target_user_id,
          'עובד צורף לתפקיד דינמי',
          jsonb_build_object(
            'job_type_id',requested_job_type_id,
            'user_id',target_user_id,
            'open_period_eligibility','live'
          )
        );
      end if;
    else
      delete from public.job_type_memberships
      where user_id = target_user_id and job_type_id = requested_job_type_id;
    end if;

    if requested_is_manager then
      insert into public.job_type_managers(user_id, job_type_id, created_by)
      values (target_user_id, requested_job_type_id, actor)
      on conflict (user_id, job_type_id) do nothing;
    else
      delete from public.job_type_managers
      where user_id = target_user_id and job_type_id = requested_job_type_id;
    end if;
  end loop;
end;
$$;

grant execute on function public.save_dynamic_user_assignments(uuid,jsonb) to authenticated;

commit;
