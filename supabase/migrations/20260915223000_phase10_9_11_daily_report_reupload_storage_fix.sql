-- קובץ: supabase/migrations/20260915223000_phase10_9_11_daily_report_reupload_storage_fix.sql
-- מטרה: הגדרת פעולות מסד נתונים עבור דוחות פעילות יומיים.
-- מטרות עיקריות:
-- - הגדרת פונקציות: public.prepare_my_daily_report_upload, public.can_upload_daily_report_attachment.
-- - סדר הפקודות, התנאים וההרשאות בקובץ נשמר כפי שהיה במקור.
begin;

-- פונקציית מסד public.prepare_my_daily_report_upload: דוחות פעילות יומיים.
create or replace function public.prepare_my_daily_report_upload(requested_job_type_id uuid)
returns jsonb
language plpgsql
-- הפונקציה רצה בהרשאות הבעלים; בדיקות הרשאה פנימיות והרשאות EXECUTE נבחנות בנפרד.
security definer
set search_path=''
as $$
declare
  actor uuid:=auth.uid();
  today_il date:=(now() at time zone 'Asia/Jerusalem')::date;
  -- target_report_id — יעד / דוח / מזהה.
  target_report_id uuid;
begin
  -- הסתעפות לפי התנאי actor is null then raise exception 'not authenticated'; end if;.
  if actor is null then raise exception 'not authenticated'; end if;

  -- הסתעפות לפי התנאי not public.has_dynamic_job_type_permission('daily_reports.submit',requested_job_type_id,actor).
  if not public.has_dynamic_job_type_permission('daily_reports.submit',requested_job_type_id,actor)
     or not public.has_dynamic_job_type_permission('daily_reports.upload_attachment',requested_job_type_id,actor)
  then raise exception 'not allowed'; end if;

  -- הסתעפות לפי התנאי not exists(.
  if not exists(
    select 1 from public.job_types jt
    where jt.id=requested_job_type_id
      and jt.is_active=true
      and jt.legacy_role is null
      and coalesce((jt.scheduling_config#>>'{dailyReports,allowAttachments}')::boolean,true)
  ) then raise exception 'attachments are disabled'; end if;

  -- הוספת רשומות ל־public.daily_reports בהתאם לקלט ולתנאים להלן.
  insert into public.daily_reports(
    job_type_id,user_id,report_date,status,submitted_at,updated_at
  )
  values(
    requested_job_type_id,actor,today_il,'draft',null,now()
  )
  on conflict(job_type_id,user_id,report_date)
  do update set
    status='draft',
    submitted_at=null,
    updated_at=now()
  returning daily_reports.id into target_report_id;

  -- הרכבת תוצאת הפעולה והחזרתה לקורא.
  return jsonb_build_object('reportId',target_report_id);
end;
$$;

-- הסרת ההרשאות המפורטות בפקודה מהתפקידים המצוינים בה.
revoke all on function public.prepare_my_daily_report_upload(uuid) from public;
-- הקצאת ההרשאות המפורטות בפקודה לתפקידים המצוינים בה.
grant execute on function public.prepare_my_daily_report_upload(uuid) to authenticated;

-- Harden Storage authorization: path is <report UUID>/<ASCII object key>.
-- פונקציית מסד public.can_upload_daily_report_attachment: בדיקת אפשרות פעולה עבור דוחות פעילות יומיים.
create or replace function public.can_upload_daily_report_attachment(requested_storage_path text)
returns boolean
language plpgsql
stable
-- הפונקציה רצה בהרשאות הבעלים; בדיקות הרשאה פנימיות והרשאות EXECUTE נבחנות בנפרד.
security definer
set search_path=''
as $$
declare
  actor uuid:=auth.uid();
  -- target_report_id — יעד / דוח / מזהה.
  target_report_id uuid;
  -- target_job_type_id — מזהה סוג התפקיד היעד.
  target_job_type_id uuid;
begin
  -- הסתעפות לפי התנאי actor is null then return false; end if;.
  if actor is null then return false; end if;

  begin
    target_report_id:=split_part(requested_storage_path,'/',1)::uuid;
  exception when others then
    return false;
  end;

  select r.job_type_id
  into target_job_type_id
  from public.daily_reports r
  join public.job_types jt on jt.id=r.job_type_id
  where r.id=target_report_id
    and r.user_id=actor
    and r.status='draft'
    and coalesce((jt.scheduling_config#>>'{dailyReports,allowAttachments}')::boolean,true);

  -- הסתעפות לפי התנאי target_job_type_id is null then return false; end if;.
  if target_job_type_id is null then return false; end if;

  return public.has_dynamic_job_type_permission(
    'daily_reports.upload_attachment',
    target_job_type_id,
    actor
  );
end;
$$;

-- הסרת ההרשאות המפורטות בפקודה מהתפקידים המצוינים בה.
revoke all on function public.can_upload_daily_report_attachment(text) from public;
-- הקצאת ההרשאות המפורטות בפקודה לתפקידים המצוינים בה.
grant execute on function public.can_upload_daily_report_attachment(text) to authenticated;

commit;
