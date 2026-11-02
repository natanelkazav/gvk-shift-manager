-- קובץ: supabase/migrations/20260915210000_phase10_9_8_fix_daily_report_report_id_ambiguity.sql
-- מטרה: הגדרת פעולות מסד נתונים עבור דוחות פעילות יומיים.
-- מטרות עיקריות:
-- - הגדרת פונקציות: public.submit_my_daily_report.
-- - סדר הפקודות, התנאים וההרשאות בקובץ נשמר כפי שהיה במקור.
begin;

-- Fix PostgreSQL 42702: PL/pgSQL local variable report_id collided with
-- daily_report_items.report_id. Rename the local variable and qualify all
-- column references.

-- פונקציית מסד public.submit_my_daily_report: הגשת דוחות פעילות יומיים.
create or replace function public.submit_my_daily_report(
 requested_job_type_id uuid, requested_items jsonb, requested_report_id uuid default null
) returns jsonb language plpgsql security definer set search_path=''
as $$
declare actor uuid:=auth.uid(); today_il date:=(now() at time zone 'Asia/Jerusalem')::date;
 -- target_report_id — יעד / דוח / מזהה.
 target_report_id uuid; item jsonb; subject_id_value uuid; subject_name_value text; customer_id_value uuid;
 -- customer_name_value — שם / ערך.
 customer_name_value text; details_value text; sort_value integer:=0; recipient uuid; notification_id uuid;
 notification_ids jsonb:='[]'::jsonb; job_name text; recipient_ids jsonb;
begin
 -- הסתעפות לפי התנאי actor is null then raise exception 'not authenticated'; end if;.
 if actor is null then raise exception 'not authenticated'; end if;
 -- הסתעפות לפי התנאי not public.has_dynamic_job_type_permission('daily_reports.submit',requested_job_type_id,actor) then raise exception 'not.
 if not public.has_dynamic_job_type_permission('daily_reports.submit',requested_job_type_id,actor) then raise exception 'not allowed'; end if;
 -- הסתעפות לפי התנאי jsonb_typeof(requested_items)<>'array' or jsonb_array_length(requested_items)=0 then raise exception 'at least one repor.
 if jsonb_typeof(requested_items)<>'array' or jsonb_array_length(requested_items)=0 then raise exception 'at least one report item is required'; end if;
 select jt.name,coalesce(jt.scheduling_config#>'{dailyReports,recipientUserIds}','[]'::jsonb)
 into job_name,recipient_ids from public.job_types jt
 where jt.id=requested_job_type_id and jt.is_active=true and jt.legacy_role is null;
 -- הסתעפות לפי התנאי job_name is null then raise exception 'job type not found'; end if;.
 if job_name is null then raise exception 'job type not found'; end if;

 -- הסתעפות לפי התנאי requested_report_id is not null.
 if requested_report_id is not null then
   select r.id into target_report_id from public.daily_reports r
   where r.id=requested_report_id and r.job_type_id=requested_job_type_id and r.user_id=actor and r.report_date=today_il;
   -- הסתעפות לפי התנאי report_id is null then raise exception 'prepared report not found'; end if;.
   if report_id is null then raise exception 'prepared report not found'; end if;
   -- עדכון רשומות ב־public.daily_reports בהתאם לקלט ולתנאים להלן.
   update public.daily_reports set status='submitted',submitted_at=now(),updated_at=now() where id=target_report_id;
 else
   -- הוספת רשומות ל־public.daily_reports בהתאם לקלט ולתנאים להלן.
   insert into public.daily_reports(job_type_id,user_id,report_date,status,submitted_at,updated_at)
   values(requested_job_type_id,actor,today_il,'submitted',now(),now())
   on conflict(job_type_id,user_id,report_date) do update set status='submitted',submitted_at=now(),updated_at=now()
   returning id into target_report_id;
 end if;

 -- מחיקת הרשומות שנבחרו מתוך public.daily_report_items בהתאם לקלט ולתנאים להלן.
 delete from public.daily_report_items i where i.report_id=target_report_id;
 -- מעבר על תוצאות השאילתה או האוסף ועיבוד כל רשומה בנפרד.
 for item in select value from jsonb_array_elements(requested_items) loop
   sort_value:=sort_value+1; subject_id_value:=nullif(item->>'subjectId','')::uuid;
   subject_name_value:=trim(coalesce(item->>'subjectName','')); customer_id_value:=nullif(item->>'customerId','')::uuid;
   customer_name_value:=nullif(trim(coalesce(item->>'customerName','')),''); details_value:=trim(coalesce(item->>'details',''));
   -- הסתעפות לפי התנאי subject_name_value='' or details_value='' then raise exception 'subject and details are required'; end if;.
   if subject_name_value='' or details_value='' then raise exception 'subject and details are required'; end if;
   -- הוספת רשומות ל־public.daily_report_items בהתאם לקלט ולתנאים להלן.
   insert into public.daily_report_items(report_id,subject_id,subject_name,customer_id,customer_name,details,sort_order)
   values(target_report_id,subject_id_value,subject_name_value,customer_id_value,customer_name_value,details_value,sort_value);
 end loop;

 -- מעבר על תוצאות השאילתה או האוסף ועיבוד כל רשומה בנפרד.
 for recipient in select distinct value::text::uuid from jsonb_array_elements_text(recipient_ids) loop
  -- הסתעפות לפי התנאי exists(select 1 from public.profiles p where p.id=recipient and p.is_active=true).
  if exists(select 1 from public.profiles p where p.id=recipient and p.is_active=true) then
   -- הוספת רשומות ל־public.notifications בהתאם לקלט ולתנאים להלן.
   insert into public.notifications(type,priority,source,title,body,url,data,created_by,expires_at)
   values('manager_message','important','daily_report',concat('דיווח יומי חדש · ',job_name),
    concat(coalesce((select p.display_name from public.profiles p where p.id=actor),'עובד'),' שלח/ה דיווח יומי ל-',to_char(today_il,'DD/MM/YYYY'),' · ',jsonb_array_length(requested_items),' פעילויות.'),
    '/notifications',jsonb_build_object('workflow','daily_report','event','submitted','reportId',target_report_id,'jobTypeId',requested_job_type_id,'actorUserId',actor,'recipientUserId',recipient,'pushPending',true),
    actor,now()+interval '90 days') returning id into notification_id;
   -- הוספת רשומות ל־public.notification_recipients בהתאם לקלט ולתנאים להלן.
   insert into public.notification_recipients(notification_id,user_id) values(notification_id,recipient) on conflict do nothing;
   notification_ids:=notification_ids||jsonb_build_array(notification_id);
  end if;
 end loop;
 -- הרכבת תוצאת הפעולה והחזרתה לקורא.
 return jsonb_build_object('reportId',target_report_id,'notificationIds',notification_ids);
end $$;


commit;
