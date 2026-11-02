-- קובץ: supabase/migrations/20260901170000_phase8_2b_job_type_lifecycle.sql
-- מטרה: הגדרת פעולות מסד נתונים עבור סוג תפקיד.
-- מטרות עיקריות:
-- - הגדרת פונקציות: public.set_dynamic_job_type_active, public.delete_dynamic_job_type.
-- - סדר הפקודות, התנאים וההרשאות בקובץ נשמר כפי שהיה במקור.
begin;

-- Phase 8.2B: lifecycle controls for independent dynamic job types.
-- Freeze is reversible and preserves all historical data.
-- Permanent deletion is intentionally restricted to unused, non-legacy roles.

-- פונקציית מסד public.set_dynamic_job_type_active: קביעת סוג תפקיד.
create or replace function public.set_dynamic_job_type_active(
  requested_job_type_id uuid,
  requested_is_active boolean
)
returns void
language plpgsql
-- הפונקציה רצה בהרשאות הבעלים; בדיקות הרשאה פנימיות והרשאות EXECUTE נבחנות בנפרד.
security definer
set search_path=''
as $function$
declare
  -- current_user_id — המשתמש הנוכחי הנוכחי.
  current_user_id uuid := auth.uid();
  -- current_month — חודש.
  current_month date := date_trunc('month', now() at time zone 'Asia/Jerusalem')::date;
  -- role_name — שם.
  role_name text;
begin
  -- הסתעפות לפי התנאי current_user_id is null then raise exception 'not authenticated'; end if;.
  if current_user_id is null then raise exception 'not authenticated'; end if;
  -- הסתעפות לפי התנאי not exists(select 1 from public.profiles p where p.id=current_user_id and p.is_active=true).
  if not exists(select 1 from public.profiles p where p.id=current_user_id and p.is_active=true) then
    -- עצירת הפעולה עם שגיאה כאשר התנאי בבלוק מתקיים.
    raise exception 'user not active';
  end if;
  -- הסתעפות לפי התנאי not exists(.
  if not exists(
    select 1 from public.user_permissions up
    where up.user_id=current_user_id and up.permission_key='users.manage'
  ) then
    -- עצירת הפעולה עם שגיאה כאשר התנאי בבלוק מתקיים.
    raise exception 'not allowed';
  end if;

  select jt.name into role_name
  from public.job_types jt
  where jt.id=requested_job_type_id;
  -- הסתעפות לפי התנאי role_name is null then raise exception 'job type not found'; end if;.
  if role_name is null then raise exception 'job type not found'; end if;

  -- עדכון רשומות ב־public.job_types בהתאם לקלט ולתנאים להלן.
  update public.job_types
  set is_active=requested_is_active, updated_at=now()
  where id=requested_job_type_id;

  -- A freeze/reactivation is a lifecycle state, not a one-month configuration tweak.
  -- Keep current/future snapshots aligned so a previously prepared next-month version
  -- cannot silently reactivate a frozen role.
  -- עדכון רשומות ב־public.job_type_configuration_versions בהתאם לקלט ולתנאים להלן.
  update public.job_type_configuration_versions v
  set snapshot=jsonb_set(v.snapshot,'{isActive}',to_jsonb(requested_is_active),true),
      updated_at=now()
  where v.job_type_id=requested_job_type_id
    and v.effective_month>=current_month;

  -- הוספת רשומות ל־public.audit_logs בהתאם לקלט ולתנאים להלן.
  insert into public.audit_logs(action,actor_user_id,entity_type,entity_id,summary,metadata)
  values(
    'system_event',current_user_id,'dynamic_job_type',requested_job_type_id,
    case when requested_is_active then 'סוג תפקיד דינמי הופעל מחדש' else 'סוג תפקיד דינמי הוקפא' end,
    jsonb_build_object('job_type_id',requested_job_type_id,'job_type_name',role_name,'is_active',requested_is_active)
  );
end;
$function$;

-- הסרת ההרשאות המפורטות בפקודה מהתפקידים המצוינים בה.
revoke all on function public.set_dynamic_job_type_active(uuid,boolean) from public;
-- הקצאת ההרשאות המפורטות בפקודה לתפקידים המצוינים בה.
grant execute on function public.set_dynamic_job_type_active(uuid,boolean) to authenticated;

-- פונקציית מסד public.delete_dynamic_job_type: מחיקת סוג תפקיד.
create or replace function public.delete_dynamic_job_type(requested_job_type_id uuid)
returns void
language plpgsql
-- הפונקציה רצה בהרשאות הבעלים; בדיקות הרשאה פנימיות והרשאות EXECUTE נבחנות בנפרד.
security definer
set search_path=''
as $function$
declare
  -- current_user_id — המשתמש הנוכחי הנוכחי.
  current_user_id uuid := auth.uid();
  -- target — יעד.
  target public.job_types%rowtype;
  -- member_count — כמות.
  member_count integer;
  -- period_count — תקופה / כמות.
  period_count integer;
  -- target_group_id — יעד / קבוצה / מזהה.
  target_group_id uuid;
  -- group_is_private — קבוצה.
  group_is_private boolean := false;
begin
  -- הסתעפות לפי התנאי current_user_id is null then raise exception 'not authenticated'; end if;.
  if current_user_id is null then raise exception 'not authenticated'; end if;
  -- הסתעפות לפי התנאי not exists(select 1 from public.profiles p where p.id=current_user_id and p.is_active=true).
  if not exists(select 1 from public.profiles p where p.id=current_user_id and p.is_active=true) then
    -- עצירת הפעולה עם שגיאה כאשר התנאי בבלוק מתקיים.
    raise exception 'user not active';
  end if;
  -- הסתעפות לפי התנאי not exists(.
  if not exists(
    select 1 from public.user_permissions up
    where up.user_id=current_user_id and up.permission_key='users.manage'
  ) then
    -- עצירת הפעולה עם שגיאה כאשר התנאי בבלוק מתקיים.
    raise exception 'not allowed';
  end if;

  select * into target from public.job_types jt where jt.id=requested_job_type_id;
  -- הסתעפות לפי התנאי target.id is null then raise exception 'job type not found'; end if;.
  if target.id is null then raise exception 'job type not found'; end if;
  -- הסתעפות לפי התנאי target.legacy_role is not null.
  if target.legacy_role is not null then
    -- עצירת הפעולה עם שגיאה כאשר התנאי בבלוק מתקיים.
    raise exception 'לא ניתן למחוק סוג תפקיד שהגיע מהמערכת הקיימת. ניתן להקפיא אותו בלבד';
  end if;

  select count(*) into member_count
  from public.job_type_memberships m
  where m.job_type_id=target.id;
  -- הסתעפות לפי התנאי member_count>0.
  if member_count>0 then
    -- עצירת הפעולה עם שגיאה כאשר התנאי בבלוק מתקיים.
    raise exception 'לא ניתן למחוק את התפקיד: משויכים אליו % עובדים. הקפא את התפקיד במקום למחוק אותו',member_count;
  end if;

  select count(*) into period_count
  from public.dynamic_availability_periods p
  where p.job_type_id=target.id;
  -- הסתעפות לפי התנאי period_count>0.
  if period_count>0 then
    -- עצירת הפעולה עם שגיאה כאשר התנאי בבלוק מתקיים.
    raise exception 'לא ניתן למחוק את התפקיד: קיימות עבורו תקופות אילוצים/שיבוץ. הקפא את התפקיד כדי לשמור את ההיסטוריה';
  end if;

  target_group_id := target.schedule_group_id;
  select coalesce((sg.config->>'independent')::boolean,false)
    into group_is_private
  from public.schedule_groups sg
  where sg.id=target_group_id;

  -- הוספת רשומות ל־public.audit_logs בהתאם לקלט ולתנאים להלן.
  insert into public.audit_logs(action,actor_user_id,entity_type,entity_id,summary,metadata)
  values(
    'system_event',current_user_id,'dynamic_job_type',target.id,
    'סוג תפקיד דינמי נמחק',
    jsonb_build_object('job_type_id',target.id,'job_type_name',target.name,'job_type_code',target.code)
  );

  -- מחיקת הרשומות שנבחרו מתוך public.job_types בהתאם לקלט ולתנאים להלן.
  delete from public.job_types where id=target.id;

  -- Independent roles receive a private implementation group. Remove that group
  -- only when no other role points at it; group-owned templates then cascade safely.
  -- הסתעפות לפי התנאי group_is_private and not exists(.
  if group_is_private and not exists(
    select 1 from public.job_types jt where jt.schedule_group_id=target_group_id
  ) then
    -- מחיקת הרשומות שנבחרו מתוך public.schedule_groups בהתאם לקלט ולתנאים להלן.
    delete from public.schedule_groups sg where sg.id=target_group_id;
  end if;
end;
$function$;

-- הסרת ההרשאות המפורטות בפקודה מהתפקידים המצוינים בה.
revoke all on function public.delete_dynamic_job_type(uuid) from public;
-- הקצאת ההרשאות המפורטות בפקודה לתפקידים המצוינים בה.
grant execute on function public.delete_dynamic_job_type(uuid) to authenticated;

commit;
