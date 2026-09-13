begin;

-- Preserve the rotation/original assignee when a published position is intentionally
-- left empty after publication. This keeps the immutable rotation truth available
-- while user_id represents only the worker who actually performs the shift.
alter table public.dynamic_schedule_published_unassigned
  add column if not exists original_user_id uuid references public.profiles(id) on delete set null;

create or replace function public.get_dynamic_published_schedule_editor(
  requested_publication_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_actor uuid := auth.uid();
  v_publication public.dynamic_schedule_publications%rowtype;
  v_job public.job_types%rowtype;
  v_current_month date := date_trunc('month', (now() at time zone 'Asia/Jerusalem')::date)::date;
  v_publication_month date;
  v_editable boolean := false;
  v_reason text := null;
  v_members jsonb := '[]'::jsonb;
  v_slots jsonb := '[]'::jsonb;
begin
  if v_actor is null then raise exception 'not authenticated'; end if;
  if not exists (
    select 1 from public.user_permissions up
    where up.user_id=v_actor and up.permission_key='users.manage'
  ) then raise exception 'not allowed'; end if;

  select * into v_publication
  from public.dynamic_schedule_publications
  where id=requested_publication_id;
  if v_publication.id is null then raise exception 'publication not found'; end if;

  select * into v_job from public.job_types where id=v_publication.job_type_id;
  if v_job.id is null then raise exception 'job type not found'; end if;

  v_publication_month := make_date(v_publication.year,v_publication.month,1);
  if v_publication.status <> 'published' then
    v_reason := 'לוח זה אינו פתוח לעריכה משום שהוא בארכיון.';
  elsif v_publication_month = v_current_month
     or v_publication_month = (v_current_month + interval '1 month')::date then
    v_editable := true;
  elsif v_publication_month < v_current_month then
    v_reason := 'לוח היסטורי נשמר לקריאה בלבד.';
  else
    v_reason := 'ניתן לערוך לוח מפורסם רק בחודש הנוכחי או בחודש הבא.';
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object('userId',m.user_id,'displayName',p.display_name)
    order by p.display_name
  ),'[]'::jsonb)
  into v_members
  from public.job_type_memberships m
  join public.profiles p on p.id=m.user_id
  where m.job_type_id=v_publication.job_type_id
    and p.is_active=true;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'slotId',sl.id,
      'shiftDate',sl.shift_date,
      'shiftCode',sl.shift_code,
      'shiftName',sl.shift_name,
      'startTime',sl.start_time,
      'endTime',sl.end_time,
      'intentionallyUnassignedCount',coalesce(pu.intentionally_unassigned_count,0),
      'assignments',coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'id',a.id,
            'userId',a.user_id,
            'displayName',p.display_name,
            'userIsActive',coalesce(p.is_active,false),
            'originalUserId',a.original_user_id,
            'originalDisplayName',op.display_name,
            'managerEdited',a.manager_edited,
            'managerOverrideNote',a.manager_override_note
          ) order by p.display_name
        )
        from public.dynamic_schedule_published_assignments a
        left join public.profiles p on p.id=a.user_id
        left join public.profiles op on op.id=a.original_user_id
        where a.publication_id=v_publication.id and a.slot_id=sl.id
      ),'[]'::jsonb)
    ) order by sl.shift_date,sl.start_time,sl.shift_name
  ),'[]'::jsonb)
  into v_slots
  from public.dynamic_availability_slots sl
  left join public.dynamic_schedule_published_unassigned pu
    on pu.publication_id=v_publication.id and pu.slot_id=sl.id
  where sl.period_id=v_publication.availability_period_id;

  return jsonb_build_object(
    'publicationId',v_publication.id,
    'jobTypeId',v_job.id,
    'jobTypeName',v_job.name,
    'year',v_publication.year,
    'month',v_publication.month,
    'editable',v_editable,
    'editabilityReason',v_reason,
    'members',v_members,
    'slots',v_slots
  );
end;
$function$;

create or replace function public.set_dynamic_published_schedule_assignment(
  requested_publication_id uuid,
  requested_slot_id uuid,
  requested_assignment_id uuid default null,
  requested_user_id uuid default null,
  requested_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_actor uuid := auth.uid();
  v_publication public.dynamic_schedule_publications%rowtype;
  v_slot public.dynamic_availability_slots%rowtype;
  v_assignment public.dynamic_schedule_published_assignments%rowtype;
  v_unassigned public.dynamic_schedule_published_unassigned%rowtype;
  v_current_month date := date_trunc('month', (now() at time zone 'Asia/Jerusalem')::date)::date;
  v_publication_month date;
  v_required_assigned integer := 0;
  v_missing integer := 0;
  v_original_user_id uuid;
  v_new_assignment_id uuid;
begin
  if v_actor is null then raise exception 'not authenticated'; end if;
  if not exists (
    select 1 from public.user_permissions up
    where up.user_id=v_actor and up.permission_key='users.manage'
  ) then raise exception 'not allowed'; end if;

  select * into v_publication
  from public.dynamic_schedule_publications
  where id=requested_publication_id
  for update;
  if v_publication.id is null then raise exception 'publication not found'; end if;
  if v_publication.status <> 'published' then raise exception 'published schedule is not editable'; end if;

  v_publication_month := make_date(v_publication.year,v_publication.month,1);
  if v_publication_month not in (v_current_month,(v_current_month+interval '1 month')::date) then
    raise exception 'only current month or next published month can be edited';
  end if;

  select * into v_slot
  from public.dynamic_availability_slots
  where id=requested_slot_id and period_id=v_publication.availability_period_id;
  if v_slot.id is null then raise exception 'slot not found in this publication'; end if;

  if requested_user_id is not null and not exists (
    select 1
    from public.job_type_memberships m
    join public.profiles p on p.id=m.user_id
    where m.job_type_id=v_publication.job_type_id
      and m.user_id=requested_user_id
      and p.is_active=true
  ) then
    raise exception 'requested user is not an active member of this role';
  end if;

  if requested_assignment_id is not null then
    select * into v_assignment
    from public.dynamic_schedule_published_assignments
    where id=requested_assignment_id
      and publication_id=v_publication.id
      and slot_id=v_slot.id
    for update;
    if v_assignment.id is null then raise exception 'assignment not found'; end if;

    if requested_user_id is null then
      v_original_user_id := coalesce(v_assignment.original_user_id,v_assignment.engine_user_id,v_assignment.user_id);

      delete from public.dynamic_schedule_published_assignments
      where id=v_assignment.id;

      if v_assignment.assignment_tier='required' then
        select count(*)::integer into v_required_assigned
        from public.dynamic_schedule_published_assignments a
        where a.publication_id=v_publication.id
          and a.slot_id=v_slot.id
          and a.assignment_tier='required';

        v_missing := greatest(v_slot.min_workers-v_required_assigned,0);
        if v_missing>0 then
          insert into public.dynamic_schedule_published_unassigned(
            publication_id,slot_id,shift_date,shift_code,shift_name,
            intentionally_unassigned_count,note,original_user_id
          ) values(
            v_publication.id,v_slot.id,v_slot.shift_date,v_slot.shift_code,v_slot.shift_name,
            v_missing,nullif(trim(coalesce(requested_reason,'')),''),v_original_user_id
          )
          on conflict(publication_id,shift_date,shift_code) do update set
            slot_id=excluded.slot_id,
            intentionally_unassigned_count=excluded.intentionally_unassigned_count,
            note=excluded.note,
            original_user_id=coalesce(public.dynamic_schedule_published_unassigned.original_user_id,excluded.original_user_id);
        else
          delete from public.dynamic_schedule_published_unassigned
          where publication_id=v_publication.id and slot_id=v_slot.id;
        end if;
      end if;

      insert into public.audit_logs(action,actor_user_id,entity_type,entity_id,summary,old_values,new_values,metadata)
      values(
        'system_event',v_actor,'dynamic_schedule_publication',v_publication.id,
        'משמרת בלוח דינמי סומנה כלא מאוישת',
        jsonb_build_object('assignment_id',v_assignment.id,'user_id',v_assignment.user_id),
        jsonb_build_object('intentionally_unassigned',true),
        jsonb_build_object('job_type_id',v_publication.job_type_id,'slot_id',v_slot.id,'shift_date',v_slot.shift_date,'shift_code',v_slot.shift_code,'reason',nullif(trim(coalesce(requested_reason,'')),''))
      );

      update public.dynamic_schedule_publications set updated_at=now() where id=v_publication.id;
      return jsonb_build_object('saved',true,'action','unassigned','publicationId',v_publication.id,'slotId',v_slot.id);
    end if;

    if v_assignment.user_id=requested_user_id then
      return jsonb_build_object('saved',true,'changed',false,'assignmentId',v_assignment.id);
    end if;

    if exists (
      select 1 from public.dynamic_schedule_published_assignments a
      where a.publication_id=v_publication.id and a.slot_id=v_slot.id
        and a.user_id=requested_user_id and a.id<>v_assignment.id
    ) then raise exception 'requested user is already assigned to this shift'; end if;

    update public.dynamic_schedule_published_assignments
    set user_id=requested_user_id,
        manager_edited=true,
        manager_override_note=nullif(trim(coalesce(requested_reason,'')),''),
        user_edited_by=null,
        user_edited_at=null
    where id=v_assignment.id;

    insert into public.audit_logs(action,actor_user_id,entity_type,entity_id,summary,old_values,new_values,metadata)
    values(
      'system_event',v_actor,'dynamic_schedule_publication',v_publication.id,
      'שיבוץ בלוח דינמי שונה על ידי מנהל',
      jsonb_build_object('assignment_id',v_assignment.id,'user_id',v_assignment.user_id),
      jsonb_build_object('assignment_id',v_assignment.id,'user_id',requested_user_id),
      jsonb_build_object('job_type_id',v_publication.job_type_id,'slot_id',v_slot.id,'shift_date',v_slot.shift_date,'shift_code',v_slot.shift_code,'reason',nullif(trim(coalesce(requested_reason,'')),''))
    );

    update public.dynamic_schedule_publications set updated_at=now() where id=v_publication.id;
    return jsonb_build_object('saved',true,'action','reassigned','assignmentId',v_assignment.id,'oldUserId',v_assignment.user_id,'newUserId',requested_user_id);
  end if;

  if requested_user_id is null then raise exception 'requested user is required when filling an unassigned position'; end if;

  select * into v_unassigned
  from public.dynamic_schedule_published_unassigned
  where publication_id=v_publication.id and slot_id=v_slot.id
  for update;
  if v_unassigned.publication_id is null or v_unassigned.intentionally_unassigned_count<1 then
    raise exception 'there is no intentionally unassigned position in this slot';
  end if;

  if exists (
    select 1 from public.dynamic_schedule_published_assignments a
    where a.publication_id=v_publication.id and a.slot_id=v_slot.id and a.user_id=requested_user_id
  ) then raise exception 'requested user is already assigned to this shift'; end if;

  insert into public.dynamic_schedule_published_assignments(
    publication_id,source_assignment_id,slot_id,shift_date,shift_code,shift_name,start_time,end_time,
    user_id,assignment_tier,score,reasons,engine_user_id,manager_edited,manager_override_note,original_user_id
  ) values(
    v_publication.id,null,v_slot.id,v_slot.shift_date,v_slot.shift_code,v_slot.shift_name,v_slot.start_time,v_slot.end_time,
    requested_user_id,'required',0,jsonb_build_array(jsonb_build_object('source','manager_published_edit')),
    v_unassigned.original_user_id,true,nullif(trim(coalesce(requested_reason,'')),''),v_unassigned.original_user_id
  ) returning id into v_new_assignment_id;

  if v_unassigned.intentionally_unassigned_count<=1 then
    delete from public.dynamic_schedule_published_unassigned
    where publication_id=v_publication.id and slot_id=v_slot.id;
  else
    update public.dynamic_schedule_published_unassigned
    set intentionally_unassigned_count=intentionally_unassigned_count-1,
        note=nullif(trim(coalesce(requested_reason,'')),'')
    where publication_id=v_publication.id and slot_id=v_slot.id;
  end if;

  insert into public.audit_logs(action,actor_user_id,entity_type,entity_id,summary,new_values,metadata)
  values(
    'system_event',v_actor,'dynamic_schedule_publication',v_publication.id,
    'עמדה לא מאוישת בלוח דינמי אוישה על ידי מנהל',
    jsonb_build_object('assignment_id',v_new_assignment_id,'user_id',requested_user_id),
    jsonb_build_object('job_type_id',v_publication.job_type_id,'slot_id',v_slot.id,'shift_date',v_slot.shift_date,'shift_code',v_slot.shift_code,'reason',nullif(trim(coalesce(requested_reason,'')),''))
  );

  update public.dynamic_schedule_publications set updated_at=now() where id=v_publication.id;
  return jsonb_build_object('saved',true,'action','filled','assignmentId',v_new_assignment_id,'newUserId',requested_user_id);
end;
$function$;

revoke all on function public.get_dynamic_published_schedule_editor(uuid) from public;
revoke all on function public.set_dynamic_published_schedule_assignment(uuid,uuid,uuid,uuid,text) from public;
grant execute on function public.get_dynamic_published_schedule_editor(uuid) to authenticated;
grant execute on function public.set_dynamic_published_schedule_assignment(uuid,uuid,uuid,uuid,text) to authenticated;

commit;
