-- קובץ: supabase/migrations/20260918113000_announcements_and_team_gvk_branding.sql
-- מטרה: הגדרת פעולות מסד נתונים עבור הודעות מנהל.
-- מטרות עיקריות:
-- - הגדרת פונקציות: public.get_announcement_recipient_catalog, public.create_operational_announcement.
-- - סדר הפקודות, התנאים וההרשאות בקובץ נשמר כפי שהיה במקור.
begin;

-- System-level permission for composing operational announcements.
-- הוספת רשומות ל־public.permissions בהתאם לקלט ולתנאים להלן.
insert into public.permissions(permission_key, display_name, description)
values('announcements.send','שליחת הודעות ועדכונים','שליחת הודעות יזומות לכל המשתמשים, לתפקידים או לעובדים נבחרים, עם תוקף ו־Push.')
on conflict (permission_key) do update set display_name=excluded.display_name, description=excluded.description;

-- הוספת רשומות ל־public.role_default_permissions בהתאם לקלט ולתנאים להלן.
insert into public.role_default_permissions(role_name, permission_key)
values('admin','announcements.send') on conflict do nothing;

-- הוספת רשומות ל־public.user_permissions בהתאם לקלט ולתנאים להלן.
insert into public.user_permissions(user_id, permission_key)
select p.id,'announcements.send' from public.profiles p
where p.is_active=true and p.role='admin'::public.user_role
on conflict do nothing;

-- הוספת רשומות ל־public.permission_profile_permissions בהתאם לקלט ולתנאים להלן.
insert into public.permission_profile_permissions (profile_id, permission_key)
select pp.id, 'announcements.send'
from public.permission_profiles pp
where pp.code = 'system_admin'
on conflict do nothing;

-- פונקציית מסד public.get_announcement_recipient_catalog: שליפה או חישוב של הודעות מנהל.
create or replace function public.get_announcement_recipient_catalog()
returns jsonb
language plpgsql
-- הפונקציה רצה בהרשאות הבעלים; בדיקות הרשאה פנימיות והרשאות EXECUTE נבחנות בנפרד.
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
begin
  -- הסתעפות לפי התנאי v_actor is null then raise exception 'not authenticated'; end if;.
  if v_actor is null then raise exception 'not authenticated'; end if;
  -- הסתעפות לפי התנאי not exists (.
  if not exists (
    select 1 from public.user_permissions up
    where up.user_id=v_actor and up.permission_key in ('announcements.send','users.manage')
  ) then raise exception 'not allowed'; end if;

  -- הרכבת תוצאת הפעולה והחזרתה לקורא.
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

-- פונקציית מסד public.create_operational_announcement: יצירת הודעות מנהל.
create or replace function public.create_operational_announcement(
  requested_user_ids uuid[],
  requested_title text,
  requested_body text,
  requested_priority text default 'normal',
  requested_expires_at timestamptz default null
)
returns jsonb
language plpgsql
-- הפונקציה רצה בהרשאות הבעלים; בדיקות הרשאה פנימיות והרשאות EXECUTE נבחנות בנפרד.
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  -- v_notification_id — התראות / מזהה.
  v_notification_id uuid;
  -- v_recipient_count — כמות.
  v_recipient_count integer;
  v_expires timestamptz := coalesce(requested_expires_at, now() + interval '7 days');
begin
  -- הסתעפות לפי התנאי v_actor is null then raise exception 'not authenticated'; end if;.
  if v_actor is null then raise exception 'not authenticated'; end if;
  -- הסתעפות לפי התנאי not exists (select 1 from public.user_permissions up where up.user_id=v_actor and up.permission_key='announcements.send'.
  if not exists (select 1 from public.user_permissions up where up.user_id=v_actor and up.permission_key='announcements.send') then
    -- עצירת הפעולה עם שגיאה כאשר התנאי בבלוק מתקיים.
    raise exception 'not allowed';
  end if;
  -- הסתעפות לפי התנאי nullif(trim(requested_title),'') is null then raise exception 'title required'; end if;.
  if nullif(trim(requested_title),'') is null then raise exception 'title required'; end if;
  -- הסתעפות לפי התנאי length(trim(requested_title)) > 120 then raise exception 'title too long'; end if;.
  if length(trim(requested_title)) > 120 then raise exception 'title too long'; end if;
  -- הסתעפות לפי התנאי nullif(trim(requested_body),'') is null then raise exception 'body required'; end if;.
  if nullif(trim(requested_body),'') is null then raise exception 'body required'; end if;
  -- הסתעפות לפי התנאי length(trim(requested_body)) > 500 then raise exception 'body too long'; end if;.
  if length(trim(requested_body)) > 500 then raise exception 'body too long'; end if;
  -- הסתעפות לפי התנאי requested_priority not in ('low','normal','important','urgent') then raise exception 'invalid priority'; end if;.
  if requested_priority not in ('low','normal','important','urgent') then raise exception 'invalid priority'; end if;
  -- הסתעפות לפי התנאי v_expires <= now() then raise exception 'expiration must be in the future'; end if;.
  if v_expires <= now() then raise exception 'expiration must be in the future'; end if;

  select count(distinct p.id) into v_recipient_count
  from public.profiles p
  where p.is_active=true and p.id=any(coalesce(requested_user_ids,array[]::uuid[]));
  -- הסתעפות לפי התנאי v_recipient_count=0 then raise exception 'no recipients'; end if;.
  if v_recipient_count=0 then raise exception 'no recipients'; end if;

  -- הוספת רשומות ל־public.notifications בהתאם לקלט ולתנאים להלן.
  insert into public.notifications(type,priority,source,title,body,url,data,created_by,expires_at)
  values('manager_message',requested_priority,'announcement',trim(requested_title),trim(requested_body),'/notifications',
    jsonb_build_object('kind','operational_announcement','sentBy',v_actor),v_actor,v_expires)
  returning id into v_notification_id;

  -- הוספת רשומות ל־public.notification_recipients בהתאם לקלט ולתנאים להלן.
  insert into public.notification_recipients(notification_id,user_id)
  select v_notification_id,p.id from public.profiles p
  where p.is_active=true and p.id=any(requested_user_ids)
  on conflict do nothing;

  -- הוספת רשומות ל־public.audit_logs בהתאם לקלט ולתנאים להלן.
  insert into public.audit_logs(action,actor_user_id,entity_type,entity_id,summary,metadata)
  values('system_event',v_actor,'notification',v_notification_id,'נשלח עדכון יזום לעובדי המערכת',
    jsonb_build_object('recipient_count',v_recipient_count,'expires_at',v_expires,'priority',requested_priority));

  -- הרכבת תוצאת הפעולה והחזרתה לקורא.
  return jsonb_build_object('notificationId',v_notification_id,'recipientCount',v_recipient_count,'expiresAt',v_expires);
end;
$$;

-- הקצאת ההרשאות המפורטות בפקודה לתפקידים המצוינים בה.
grant execute on function public.get_announcement_recipient_catalog() to authenticated;
-- הקצאת ההרשאות המפורטות בפקודה לתפקידים המצוינים בה.
grant execute on function public.create_operational_announcement(uuid[],text,text,text,timestamptz) to authenticated;

commit;
