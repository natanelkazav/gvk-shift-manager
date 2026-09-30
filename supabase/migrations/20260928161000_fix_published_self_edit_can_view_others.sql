begin;

-- Fix: update_my_dynamic_published_assignment referenced the removed local
-- variable can_view_others while writing the audit log. PostgreSQL therefore
-- raised 42703 after a valid published assignment update reached that block.
-- Keep the permission model unchanged and audit the permissions that this
-- function actually evaluates.

create or replace function public.update_my_dynamic_published_assignment(
  requested_publication_id uuid,
  requested_assignment_id uuid,
  requested_user_id uuid
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
  target_assignment public.dynamic_schedule_published_assignments%rowtype;
  current_month date := date_trunc('month', (now() at time zone 'Asia/Jerusalem')::date)::date;
  publication_month date;
  change_mode text;
  can_self_edit boolean := false;
  can_edit_all boolean := false;
  old_user_id uuid;
begin
  if current_user_id is null then
    raise exception 'not authenticated';
  end if;

  select * into target_publication
  from public.dynamic_schedule_publications
  where id = requested_publication_id
  for update;

  if target_publication.id is null then
    raise exception 'publication not found';
  end if;

  if target_publication.status <> 'published' then
    raise exception 'published schedule is not editable';
  end if;

  if not exists (
    select 1
    from public.job_type_memberships m
    join public.profiles p on p.id = m.user_id
    where m.job_type_id = target_publication.job_type_id
      and m.user_id = current_user_id
      and p.is_active = true
  ) then
    raise exception 'not allowed';
  end if;

  select * into target_job
  from public.job_types
  where id = target_publication.job_type_id
    and legacy_role is null;

  if target_job.id is null then
    raise exception 'dynamic job type not found';
  end if;

  change_mode := coalesce(
    target_publication.config_snapshot #>> '{jobType,scheduleChangeMode}',
    target_job.scheduling_config #>> '{scheduleChangeMode}',
    'none'
  );

  if change_mode <> 'self_edit' then
    raise exception 'self edit is not enabled for this role';
  end if;

  can_self_edit := public.has_dynamic_job_type_permission('schedule.self_edit', target_job.id, current_user_id);
  can_edit_all := public.has_dynamic_job_type_permission('schedule.edit_all', target_job.id, current_user_id);

  if not can_self_edit and not can_edit_all then
    raise exception 'not allowed';
  end if;

  publication_month := make_date(target_publication.year, target_publication.month, 1);
  if publication_month not in (current_month, (current_month + interval '1 month')::date) then
    raise exception 'only current month or next published month can be edited';
  end if;

  if not exists (
    select 1
    from public.job_type_memberships m
    join public.profiles p on p.id = m.user_id
    where m.job_type_id = target_publication.job_type_id
      and m.user_id = requested_user_id
      and p.is_active = true
  ) then
    raise exception 'requested user is not an active member of this role';
  end if;

  select * into target_assignment
  from public.dynamic_schedule_published_assignments
  where id = requested_assignment_id
    and publication_id = target_publication.id
  for update;

  if target_assignment.id is null then
    raise exception 'assignment not found';
  end if;

  -- Personal self-edit permits changing only the actor's current assignment.
  -- Editing another employee's assignment requires the explicit edit-all permission.
  if target_assignment.user_id <> current_user_id and not can_edit_all then
    raise exception 'editing another user''s assignment requires schedule.edit_all';
  end if;

  if target_assignment.user_id = requested_user_id then
    return jsonb_build_object('saved', true, 'changed', false, 'assignmentId', target_assignment.id);
  end if;

  if exists (
    select 1
    from public.dynamic_schedule_published_assignments a
    where a.publication_id = target_publication.id
      and a.shift_date = target_assignment.shift_date
      and a.shift_code = target_assignment.shift_code
      and a.user_id = requested_user_id
      and a.id <> target_assignment.id
  ) then
    raise exception 'requested user is already assigned to this shift';
  end if;

  old_user_id := target_assignment.user_id;

  update public.dynamic_schedule_published_assignments
  set user_id = requested_user_id,
      user_edited_by = current_user_id,
      user_edited_at = now()
  where id = target_assignment.id;

  insert into public.audit_logs(action, actor_user_id, entity_type, entity_id, summary, metadata)
  values(
    'system_event',
    current_user_id,
    'dynamic_schedule_publication',
    target_publication.id,
    case
      when old_user_id = current_user_id then 'שיבוץ אישי בלוח דינמי שונה על ידי העובד'
      else 'שיבוץ של עובד אחר בלוח דינמי שונה על ידי עובד מורשה'
    end,
    jsonb_build_object(
      'publication_id', target_publication.id,
      'job_type_id', target_publication.job_type_id,
      'assignment_id', target_assignment.id,
      'shift_date', target_assignment.shift_date,
      'shift_code', target_assignment.shift_code,
      'old_user_id', old_user_id,
      'new_user_id', requested_user_id,
      'can_self_edit', can_self_edit,
      'can_edit_all', can_edit_all
    )
  );

  return jsonb_build_object(
    'saved', true,
    'changed', true,
    'assignmentId', target_assignment.id,
    'oldUserId', old_user_id,
    'newUserId', requested_user_id
  );
end;
$function$;


revoke all on function public.update_my_dynamic_published_assignment(uuid, uuid, uuid) from public;
grant execute on function public.update_my_dynamic_published_assignment(uuid, uuid, uuid) to authenticated;

commit;
