begin;

-- Phase 10.5.14 · Member permission for viewing/editing other members' assignments.
-- This separates "self edit" from team visibility. A member may still change their
-- own published assignment while only explicitly-authorized roles can expose the
-- full team schedule to members.

insert into public.dynamic_permission_manifest
  (feature_key, permission_key, audience, label, description, default_enabled, sort_order)
values
  (
    'schedule',
    'schedule.view_others',
    'member',
    'הצגת משמרות/כוננויות של משתמשים אחרים',
    'מאפשר לעובד לראות שיבוצים של עובדים אחרים באותו תפקיד. בתפקיד עם עריכה עצמית ההרשאה מאפשרת גם לבחור ולשנות שיבוצים של עובדים אחרים.',
    false,
    15
  )
on conflict (feature_key, permission_key, audience) do update
set label = excluded.label,
    description = excluded.description,
    default_enabled = excluded.default_enabled,
    sort_order = excluded.sort_order;

-- Materialize the new permission for all current dynamic Job Types.
do $$
declare
  job record;
begin
  for job in
    select id
    from public.job_types
    where legacy_role is null
  loop
    perform public.sync_dynamic_job_type_permission_settings(job.id);
  end loop;
end;
$$;

-- Preserve the behavior of roles that already intentionally use self-edit:
-- they previously exposed the whole role schedule to members. The new toggle is
-- created as ON for those existing roles, and can now be disabled explicitly.
update public.job_type_permission_settings s
set enabled = true,
    source = 'migration',
    updated_at = now()
from public.job_types jt
where s.job_type_id = jt.id
  and s.permission_key = 'schedule.view_others'
  and s.audience = 'member'
  and jt.legacy_role is null
  and coalesce(jt.scheduling_config #>> '{scheduleChangeMode}', 'none') = 'self_edit';

create or replace function public.get_my_dynamic_self_edit_workspace(
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
  current_month date := date_trunc('month', (now() at time zone 'Asia/Jerusalem')::date)::date;
  publication_month date;
  change_mode text;
  editable boolean := false;
  reason text := null;
  can_view_others boolean := false;
  members_json jsonb;
  assignments_json jsonb;
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

  if not public.has_dynamic_job_type_permission('schedule.self_edit', target_job.id, current_user_id) then
    raise exception 'not allowed';
  end if;

  can_view_others := public.has_dynamic_job_type_permission(
    'schedule.view_others',
    target_job.id,
    current_user_id
  );

  publication_month := make_date(target_publication.year, target_publication.month, 1);

  if target_publication.status <> 'published' then
    editable := false;
    reason := 'לוח זה אינו פתוח לעריכה משום שהוא בארכיון.';
  elsif publication_month = current_month then
    editable := true;
  elsif publication_month = (current_month + interval '1 month')::date then
    editable := true;
  elsif publication_month < current_month then
    editable := false;
    reason := 'ניתן לערוך רק את החודש הנוכחי או את החודש הבא לאחר שפורסם.';
  else
    editable := false;
    reason := 'החודש הזה עדיין אינו בחלון העריכה המותר.';
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'userId', m.user_id,
      'displayName', p.display_name
    ) order by p.display_name
  ), '[]'::jsonb)
  into members_json
  from public.job_type_memberships m
  join public.profiles p on p.id = m.user_id
  where m.job_type_id = target_publication.job_type_id
    and p.is_active = true;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', a.id,
      'shiftDate', a.shift_date,
      'shiftCode', a.shift_code,
      'shiftName', a.shift_name,
      'startTime', a.start_time,
      'endTime', a.end_time,
      'userId', a.user_id,
      'displayName', p.display_name,
      'isMine', a.user_id = current_user_id,
      'userEditedBy', a.user_edited_by,
      'userEditedAt', a.user_edited_at
    ) order by a.shift_date, a.start_time, a.shift_name, p.display_name
  ), '[]'::jsonb)
  into assignments_json
  from public.dynamic_schedule_published_assignments a
  join public.profiles p on p.id = a.user_id
  where a.publication_id = target_publication.id
    and (can_view_others or a.user_id = current_user_id);

  return jsonb_build_object(
    'publicationId', target_publication.id,
    'jobTypeId', target_job.id,
    'jobTypeName', target_job.name,
    'year', target_publication.year,
    'month', target_publication.month,
    'editable', editable,
    'editabilityReason', reason,
    'canViewOthers', can_view_others,
    'members', members_json,
    'assignments', assignments_json
  );
end;
$function$;

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
  can_view_others boolean := false;
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

  if not public.has_dynamic_job_type_permission('schedule.self_edit', target_job.id, current_user_id) then
    raise exception 'not allowed';
  end if;

  can_view_others := public.has_dynamic_job_type_permission(
    'schedule.view_others',
    target_job.id,
    current_user_id
  );

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

  -- Without the new permission a member may only change an assignment that is
  -- currently theirs. With the permission enabled they can intentionally manage
  -- another member's assignment, which is required for on-call roles.
  if not can_view_others and target_assignment.user_id <> current_user_id then
    raise exception 'not allowed to edit another user''s assignment';
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
      'can_view_others', can_view_others
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

revoke all on function public.get_my_dynamic_self_edit_workspace(uuid) from public;
revoke all on function public.update_my_dynamic_published_assignment(uuid, uuid, uuid) from public;
grant execute on function public.get_my_dynamic_self_edit_workspace(uuid) to authenticated;
grant execute on function public.update_my_dynamic_published_assignment(uuid, uuid, uuid) to authenticated;

commit;
