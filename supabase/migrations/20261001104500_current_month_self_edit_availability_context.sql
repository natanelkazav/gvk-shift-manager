-- Preserve submitted availability context when editing a published schedule in the current month.
-- Returns each active role member with the availability originally submitted for that exact slot.

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
  can_self_edit boolean := false;
  can_edit_all boolean := false;
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

  can_self_edit := public.has_dynamic_job_type_permission('schedule.self_edit', target_job.id, current_user_id);
  can_edit_all := public.has_dynamic_job_type_permission('schedule.edit_all', target_job.id, current_user_id);

  if not can_self_edit and not can_edit_all then
    raise exception 'not allowed';
  end if;

  can_view_others := can_edit_all or public.has_dynamic_job_type_permission(
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
      'userEditedAt', a.user_edited_at,
      'candidates', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'userId', candidate_membership.user_id,
            'displayName', candidate_profile.display_name,
            'availabilityStatus', availability_entry.availability_status
          )
          order by
            case availability_entry.availability_status
              when 'preferred' then 0
              when 'available' then 1
              when 'avoid' then 2
              when 'unavailable' then 3
              else 4
            end,
            candidate_profile.display_name
        )
        from public.job_type_memberships candidate_membership
        join public.profiles candidate_profile
          on candidate_profile.id = candidate_membership.user_id
         and candidate_profile.is_active = true
        left join public.dynamic_availability_submissions availability_submission
          on availability_submission.period_id = target_publication.availability_period_id
         and availability_submission.user_id = candidate_membership.user_id
        left join public.dynamic_availability_entries availability_entry
          on availability_entry.submission_id = availability_submission.id
         and availability_entry.slot_id = a.slot_id
        where candidate_membership.job_type_id = target_publication.job_type_id
      ), '[]'::jsonb)
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
    'canEditAll', can_edit_all,
    'members', members_json,
    'assignments', assignments_json
  );
end;
$function$;

revoke all on function public.get_my_dynamic_self_edit_workspace(uuid) from public;
grant execute on function public.get_my_dynamic_self_edit_workspace(uuid) to authenticated;

