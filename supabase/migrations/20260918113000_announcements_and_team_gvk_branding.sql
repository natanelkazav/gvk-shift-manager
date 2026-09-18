begin;

-- System-level permission for composing operational announcements.
insert into public.permissions(permission_key, display_name, description)
values('announcements.send','שליחת הודעות ועדכונים','שליחת הודעות יזומות לכל המשתמשים, לתפקידים או לעובדים נבחרים, עם תוקף ו־Push.')
on conflict (permission_key) do update set display_name=excluded.display_name, description=excluded.description;

insert into public.role_default_permissions(role_name, permission_key)
values('admin','announcements.send') on conflict do nothing;

insert into public.user_permissions(user_id, permission_key)
select p.id,'announcements.send' from public.profiles p
where p.is_active=true and p.role='admin'::public.user_role
on conflict do nothing;

insert into public.permission_profile_permissions (profile_id, permission_key)
select pp.id, 'announcements.send'
from public.permission_profiles pp
where pp.code = 'system_admin'
on conflict do nothing;

create or replace function public.get_announcement_recipient_catalog()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
begin
  if v_actor is null then raise exception 'not authenticated'; end if;
  if not exists (
    select 1 from public.user_permissions up
    where up.user_id=v_actor and up.permission_key in ('announcements.send','users.manage')
  ) then raise exception 'not allowed'; end if;

  return jsonb_build_object(
    'users', coalesce((
      select jsonb_agg(jsonb_build_object('id',p.id,'name',p.display_name,'scheduleName',p.schedule_name) order by p.display_name)
      from public.profiles p where p.is_active=true
    ), '[]'::jsonb),
    'jobTypes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',jt.id,'name',jt.name,
        'userIds',coalesce((select jsonb_agg(jtm.user_id order by jtm.user_id) from public.job_type_memberships jtm join public.profiles p on p.id=jtm.user_id and p.is_active=true where jtm.job_type_id=jt.id),'[]'::jsonb)
      ) order by jt.name)
      from public.job_types jt where jt.is_active=true
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.create_operational_announcement(
  requested_user_ids uuid[],
  requested_title text,
  requested_body text,
  requested_priority text default 'normal',
  requested_expires_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_notification_id uuid;
  v_recipient_count integer;
  v_expires timestamptz := coalesce(requested_expires_at, now() + interval '7 days');
begin
  if v_actor is null then raise exception 'not authenticated'; end if;
  if not exists (select 1 from public.user_permissions up where up.user_id=v_actor and up.permission_key='announcements.send') then
    raise exception 'not allowed';
  end if;
  if nullif(trim(requested_title),'') is null then raise exception 'title required'; end if;
  if length(trim(requested_title)) > 120 then raise exception 'title too long'; end if;
  if nullif(trim(requested_body),'') is null then raise exception 'body required'; end if;
  if length(trim(requested_body)) > 500 then raise exception 'body too long'; end if;
  if requested_priority not in ('low','normal','important','urgent') then raise exception 'invalid priority'; end if;
  if v_expires <= now() then raise exception 'expiration must be in the future'; end if;

  select count(distinct p.id) into v_recipient_count
  from public.profiles p
  where p.is_active=true and p.id=any(coalesce(requested_user_ids,array[]::uuid[]));
  if v_recipient_count=0 then raise exception 'no recipients'; end if;

  insert into public.notifications(type,priority,source,title,body,url,data,created_by,expires_at)
  values('manager_message',requested_priority,'announcement',trim(requested_title),trim(requested_body),'/notifications',
    jsonb_build_object('kind','operational_announcement','sentBy',v_actor),v_actor,v_expires)
  returning id into v_notification_id;

  insert into public.notification_recipients(notification_id,user_id)
  select v_notification_id,p.id from public.profiles p
  where p.is_active=true and p.id=any(requested_user_ids)
  on conflict do nothing;

  insert into public.audit_logs(action,actor_user_id,entity_type,entity_id,summary,metadata)
  values('system_event',v_actor,'notification',v_notification_id,'נשלח עדכון יזום לעובדי המערכת',
    jsonb_build_object('recipient_count',v_recipient_count,'expires_at',v_expires,'priority',requested_priority));

  return jsonb_build_object('notificationId',v_notification_id,'recipientCount',v_recipient_count,'expiresAt',v_expires);
end;
$$;

grant execute on function public.get_announcement_recipient_catalog() to authenticated;
grant execute on function public.create_operational_announcement(uuid[],text,text,text,timestamptz) to authenticated;

commit;
