begin;

-- Phase 8.2B: lifecycle controls for independent dynamic job types.
-- Freeze is reversible and preserves all historical data.
-- Permanent deletion is intentionally restricted to unused, non-legacy roles.

create or replace function public.set_dynamic_job_type_active(
  requested_job_type_id uuid,
  requested_is_active boolean
)
returns void
language plpgsql
security definer
set search_path=''
as $function$
declare
  current_user_id uuid := auth.uid();
  current_month date := date_trunc('month', now() at time zone 'Asia/Jerusalem')::date;
  role_name text;
begin
  if current_user_id is null then raise exception 'not authenticated'; end if;
  if not exists(select 1 from public.profiles p where p.id=current_user_id and p.is_active=true) then
    raise exception 'user not active';
  end if;
  if not exists(
    select 1 from public.user_permissions up
    where up.user_id=current_user_id and up.permission_key='users.manage'
  ) then
    raise exception 'not allowed';
  end if;

  select jt.name into role_name
  from public.job_types jt
  where jt.id=requested_job_type_id;
  if role_name is null then raise exception 'job type not found'; end if;

  update public.job_types
  set is_active=requested_is_active, updated_at=now()
  where id=requested_job_type_id;

  -- A freeze/reactivation is a lifecycle state, not a one-month configuration tweak.
  -- Keep current/future snapshots aligned so a previously prepared next-month version
  -- cannot silently reactivate a frozen role.
  update public.job_type_configuration_versions v
  set snapshot=jsonb_set(v.snapshot,'{isActive}',to_jsonb(requested_is_active),true),
      updated_at=now()
  where v.job_type_id=requested_job_type_id
    and v.effective_month>=current_month;

  insert into public.audit_logs(action,actor_user_id,entity_type,entity_id,summary,metadata)
  values(
    'system_event',current_user_id,'dynamic_job_type',requested_job_type_id,
    case when requested_is_active then 'סוג תפקיד דינמי הופעל מחדש' else 'סוג תפקיד דינמי הוקפא' end,
    jsonb_build_object('job_type_id',requested_job_type_id,'job_type_name',role_name,'is_active',requested_is_active)
  );
end;
$function$;

revoke all on function public.set_dynamic_job_type_active(uuid,boolean) from public;
grant execute on function public.set_dynamic_job_type_active(uuid,boolean) to authenticated;

create or replace function public.delete_dynamic_job_type(requested_job_type_id uuid)
returns void
language plpgsql
security definer
set search_path=''
as $function$
declare
  current_user_id uuid := auth.uid();
  target public.job_types%rowtype;
  member_count integer;
  period_count integer;
  target_group_id uuid;
  group_is_private boolean := false;
begin
  if current_user_id is null then raise exception 'not authenticated'; end if;
  if not exists(select 1 from public.profiles p where p.id=current_user_id and p.is_active=true) then
    raise exception 'user not active';
  end if;
  if not exists(
    select 1 from public.user_permissions up
    where up.user_id=current_user_id and up.permission_key='users.manage'
  ) then
    raise exception 'not allowed';
  end if;

  select * into target from public.job_types jt where jt.id=requested_job_type_id;
  if target.id is null then raise exception 'job type not found'; end if;
  if target.legacy_role is not null then
    raise exception 'לא ניתן למחוק סוג תפקיד שהגיע מהמערכת הקיימת. ניתן להקפיא אותו בלבד';
  end if;

  select count(*) into member_count
  from public.job_type_memberships m
  where m.job_type_id=target.id;
  if member_count>0 then
    raise exception 'לא ניתן למחוק את התפקיד: משויכים אליו % עובדים. הקפא את התפקיד במקום למחוק אותו',member_count;
  end if;

  select count(*) into period_count
  from public.dynamic_availability_periods p
  where p.job_type_id=target.id;
  if period_count>0 then
    raise exception 'לא ניתן למחוק את התפקיד: קיימות עבורו תקופות אילוצים/שיבוץ. הקפא את התפקיד כדי לשמור את ההיסטוריה';
  end if;

  target_group_id := target.schedule_group_id;
  select coalesce((sg.config->>'independent')::boolean,false)
    into group_is_private
  from public.schedule_groups sg
  where sg.id=target_group_id;

  insert into public.audit_logs(action,actor_user_id,entity_type,entity_id,summary,metadata)
  values(
    'system_event',current_user_id,'dynamic_job_type',target.id,
    'סוג תפקיד דינמי נמחק',
    jsonb_build_object('job_type_id',target.id,'job_type_name',target.name,'job_type_code',target.code)
  );

  delete from public.job_types where id=target.id;

  -- Independent roles receive a private implementation group. Remove that group
  -- only when no other role points at it; group-owned templates then cascade safely.
  if group_is_private and not exists(
    select 1 from public.job_types jt where jt.schedule_group_id=target_group_id
  ) then
    delete from public.schedule_groups sg where sg.id=target_group_id;
  end if;
end;
$function$;

revoke all on function public.delete_dynamic_job_type(uuid) from public;
grant execute on function public.delete_dynamic_job_type(uuid) to authenticated;

commit;
