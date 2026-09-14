begin;

-- Phase 10.5.15
-- 1) schedule.view_others becomes a genuinely explicit role permission.
--    The compatibility backfill from 10.5.14 is rolled back only where it is
--    still marked as a migration-generated value; administrator/user changes
--    made through the role builder are preserved.
-- 2) Add schedule.edit_history for managers, while system admins can always
--    correct imported historical assignments.
-- 3) Historical corrections change only the imported working copy
--    (assigned_user_id / intentionally-unassigned flag). original_user_id and
--    source_payload remain untouched, and every change is written to audit_logs.

update public.job_type_permission_settings
set enabled = false,
    source = 'manifest',
    updated_at = now()
where permission_key = 'schedule.view_others'
  and audience = 'member'
  and source = 'migration';

insert into public.dynamic_permission_manifest
  (feature_key, permission_key, audience, label, description, default_enabled, sort_order)
values
  (
    'schedule',
    'schedule.edit_history',
    'manager',
    'עריכת שיבוצי עבר',
    'מאפשר למנהל לתקן שיבוצים בחודשים היסטוריים שיובאו. נתון המקור נשמר וכל שינוי מתועד ביומן המערכת.',
    false,
    60
  )
on conflict (feature_key, permission_key, audience) do update
set label = excluded.label,
    description = excluded.description,
    default_enabled = excluded.default_enabled,
    sort_order = excluded.sort_order;

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

create or replace function public.get_dynamic_historical_slot_editor(
  requested_historical_period_id uuid,
  requested_work_date date,
  requested_shift_code text,
  requested_start_time text,
  requested_end_time text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  actor uuid := auth.uid();
  target_period public.dynamic_historical_periods%rowtype;
  target_job public.job_types%rowtype;
  actor_is_admin boolean := false;
  can_view boolean := false;
  can_edit boolean := false;
  members_json jsonb := '[]'::jsonb;
  assignments_json jsonb := '[]'::jsonb;
begin
  if actor is null then
    raise exception 'not authenticated';
  end if;

  select * into target_period
  from public.dynamic_historical_periods
  where id = requested_historical_period_id;

  if target_period.id is null then
    raise exception 'historical period not found';
  end if;

  select * into target_job
  from public.job_types
  where id = target_period.job_type_id
    and legacy_role is null;

  if target_job.id is null then
    raise exception 'dynamic job type not found';
  end if;

  select exists (
    select 1
    from public.profiles p
    where p.id = actor
      and p.role::text = 'admin'
  ) into actor_is_admin;

  can_edit := actor_is_admin
    or public.has_dynamic_job_type_permission('schedule.edit_history', target_job.id, actor);

  can_view := can_edit
    or public.has_dynamic_job_type_permission('schedule.view_team', target_job.id, actor)
    or public.has_dynamic_job_type_permission('schedule.edit_published', target_job.id, actor);

  if not can_view then
    raise exception 'not allowed';
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
  where m.job_type_id = target_job.id
    and p.is_active = true;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', q.id,
      'userId', q.assigned_user_id,
      'displayName', q.display_name,
      'originalUserId', q.original_user_id,
      'originalDisplayName', q.original_display_name,
      'isIntentionallyUnassigned', q.is_intentionally_unassigned
    ) order by q.display_name nulls last, q.id
  ), '[]'::jsonb)
  into assignments_json
  from (
    select
      ha.id,
      ha.assigned_user_id,
      current_profile.display_name,
      ha.original_user_id,
      original_profile.display_name as original_display_name,
      ha.is_intentionally_unassigned
    from public.dynamic_historical_assignments ha
    left join public.profiles current_profile on current_profile.id = ha.assigned_user_id
    left join public.profiles original_profile on original_profile.id = ha.original_user_id
    where ha.historical_period_id = target_period.id
      and ha.work_date = requested_work_date
      and coalesce(ha.shift_code, target_period.source_kind || '-' || ha.work_date::text) = requested_shift_code
      and coalesce(
        to_char(ha.starts_at at time zone 'Asia/Jerusalem', 'HH24:MI:SS'),
        nullif(ha.source_payload #>> '{shift,start_time}', ''),
        '00:00:00'
      ) = requested_start_time
      and coalesce(
        to_char(ha.ends_at at time zone 'Asia/Jerusalem', 'HH24:MI:SS'),
        nullif(ha.source_payload #>> '{shift,end_time}', ''),
        case when target_period.source_kind = 'on_call' then '23:59:00' else '00:00:00' end
      ) = requested_end_time
  ) q;

  if jsonb_array_length(assignments_json) = 0 then
    raise exception 'historical slot not found';
  end if;

  return jsonb_build_object(
    'historicalPeriodId', target_period.id,
    'jobTypeId', target_job.id,
    'jobTypeName', target_job.name,
    'year', target_period.year,
    'month', target_period.month,
    'editable', can_edit,
    'editabilityReason', case
      when can_edit then null
      else 'נדרשת הרשאת „עריכת שיבוצי עבר”.'
    end,
    'members', members_json,
    'assignments', assignments_json
  );
end;
$function$;

create or replace function public.set_dynamic_historical_assignment(
  requested_historical_period_id uuid,
  requested_assignment_id uuid,
  requested_user_id uuid default null,
  requested_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  actor uuid := auth.uid();
  target_period public.dynamic_historical_periods%rowtype;
  target_job public.job_types%rowtype;
  target_assignment public.dynamic_historical_assignments%rowtype;
  actor_is_admin boolean := false;
  old_user_id uuid;
  old_intentionally_unassigned boolean;
begin
  if actor is null then
    raise exception 'not authenticated';
  end if;

  select * into target_period
  from public.dynamic_historical_periods
  where id = requested_historical_period_id;

  if target_period.id is null then
    raise exception 'historical period not found';
  end if;

  select * into target_job
  from public.job_types
  where id = target_period.job_type_id
    and legacy_role is null;

  if target_job.id is null then
    raise exception 'dynamic job type not found';
  end if;

  select exists (
    select 1
    from public.profiles p
    where p.id = actor
      and p.role::text = 'admin'
  ) into actor_is_admin;

  if not actor_is_admin
     and not public.has_dynamic_job_type_permission('schedule.edit_history', target_job.id, actor) then
    raise exception 'not allowed';
  end if;

  select * into target_assignment
  from public.dynamic_historical_assignments
  where id = requested_assignment_id
    and historical_period_id = target_period.id
  for update;

  if target_assignment.id is null then
    raise exception 'historical assignment not found';
  end if;

  if requested_user_id is not null and not exists (
    select 1
    from public.job_type_memberships m
    join public.profiles p on p.id = m.user_id
    where m.job_type_id = target_job.id
      and m.user_id = requested_user_id
      and p.is_active = true
  ) then
    raise exception 'requested user is not an active member of this role';
  end if;

  if target_assignment.assigned_user_id is not distinct from requested_user_id
     and target_assignment.is_intentionally_unassigned = (requested_user_id is null) then
    return jsonb_build_object(
      'saved', true,
      'changed', false,
      'assignmentId', target_assignment.id
    );
  end if;

  old_user_id := target_assignment.assigned_user_id;
  old_intentionally_unassigned := target_assignment.is_intentionally_unassigned;

  update public.dynamic_historical_assignments
  set assigned_user_id = requested_user_id,
      is_intentionally_unassigned = (requested_user_id is null)
  where id = target_assignment.id;

  insert into public.audit_logs(
    action,
    actor_user_id,
    entity_type,
    entity_id,
    summary,
    metadata
  )
  values(
    'system_event',
    actor,
    'dynamic_historical_assignment',
    target_assignment.id,
    'שיבוץ היסטורי תוקן על ידי מנהל מורשה',
    jsonb_build_object(
      'historical_period_id', target_period.id,
      'job_type_id', target_job.id,
      'assignment_id', target_assignment.id,
      'work_date', target_assignment.work_date,
      'shift_code', target_assignment.shift_code,
      'original_user_id', target_assignment.original_user_id,
      'old_user_id', old_user_id,
      'new_user_id', requested_user_id,
      'old_intentionally_unassigned', old_intentionally_unassigned,
      'new_intentionally_unassigned', (requested_user_id is null),
      'reason', nullif(btrim(coalesce(requested_reason, '')), ''),
      'source_kind', target_assignment.source_kind
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

revoke all on function public.get_dynamic_historical_slot_editor(uuid,date,text,text,text) from public;
revoke all on function public.set_dynamic_historical_assignment(uuid,uuid,uuid,text) from public;
grant execute on function public.get_dynamic_historical_slot_editor(uuid,date,text,text,text) to authenticated;
grant execute on function public.set_dynamic_historical_assignment(uuid,uuid,uuid,text) to authenticated;

commit;
