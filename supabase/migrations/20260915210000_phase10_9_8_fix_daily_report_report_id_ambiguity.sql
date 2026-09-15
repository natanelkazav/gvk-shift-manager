begin;

-- Fix PostgreSQL 42702: PL/pgSQL local variable report_id collided with
-- daily_report_items.report_id. Rename the local variable and qualify all
-- column references.

create or replace function public.submit_my_daily_report(
 requested_job_type_id uuid, requested_items jsonb, requested_report_id uuid default null
) returns jsonb language plpgsql security definer set search_path=''
as $$
declare actor uuid:=auth.uid(); today_il date:=(now() at time zone 'Asia/Jerusalem')::date;
 target_report_id uuid; item jsonb; subject_id_value uuid; subject_name_value text; customer_id_value uuid;
 customer_name_value text; details_value text; sort_value integer:=0; recipient uuid; notification_id uuid;
 notification_ids jsonb:='[]'::jsonb; job_name text; recipient_ids jsonb;
begin
 if actor is null then raise exception 'not authenticated'; end if;
 if not public.has_dynamic_job_type_permission('daily_reports.submit',requested_job_type_id,actor) then raise exception 'not allowed'; end if;
 if jsonb_typeof(requested_items)<>'array' or jsonb_array_length(requested_items)=0 then raise exception 'at least one report item is required'; end if;
 select jt.name,coalesce(jt.scheduling_config#>'{dailyReports,recipientUserIds}','[]'::jsonb)
 into job_name,recipient_ids from public.job_types jt
 where jt.id=requested_job_type_id and jt.is_active=true and jt.legacy_role is null;
 if job_name is null then raise exception 'job type not found'; end if;

 if requested_report_id is not null then
   select r.id into target_report_id from public.daily_reports r
   where r.id=requested_report_id and r.job_type_id=requested_job_type_id and r.user_id=actor and r.report_date=today_il;
   if report_id is null then raise exception 'prepared report not found'; end if;
   update public.daily_reports set status='submitted',submitted_at=now(),updated_at=now() where id=target_report_id;
 else
   insert into public.daily_reports(job_type_id,user_id,report_date,status,submitted_at,updated_at)
   values(requested_job_type_id,actor,today_il,'submitted',now(),now())
   on conflict(job_type_id,user_id,report_date) do update set status='submitted',submitted_at=now(),updated_at=now()
   returning id into target_report_id;
 end if;

 delete from public.daily_report_items i where i.report_id=target_report_id;
 for item in select value from jsonb_array_elements(requested_items) loop
   sort_value:=sort_value+1; subject_id_value:=nullif(item->>'subjectId','')::uuid;
   subject_name_value:=trim(coalesce(item->>'subjectName','')); customer_id_value:=nullif(item->>'customerId','')::uuid;
   customer_name_value:=nullif(trim(coalesce(item->>'customerName','')),''); details_value:=trim(coalesce(item->>'details',''));
   if subject_name_value='' or details_value='' then raise exception 'subject and details are required'; end if;
   insert into public.daily_report_items(report_id,subject_id,subject_name,customer_id,customer_name,details,sort_order)
   values(target_report_id,subject_id_value,subject_name_value,customer_id_value,customer_name_value,details_value,sort_value);
 end loop;

 for recipient in select distinct value::text::uuid from jsonb_array_elements_text(recipient_ids) loop
  if exists(select 1 from public.profiles p where p.id=recipient and p.is_active=true) then
   insert into public.notifications(type,priority,source,title,body,url,data,created_by,expires_at)
   values('manager_message','important','daily_report',concat('דיווח יומי חדש · ',job_name),
    concat(coalesce((select p.display_name from public.profiles p where p.id=actor),'עובד'),' שלח/ה דיווח יומי ל-',to_char(today_il,'DD/MM/YYYY'),' · ',jsonb_array_length(requested_items),' פעילויות.'),
    '/notifications',jsonb_build_object('workflow','daily_report','event','submitted','reportId',target_report_id,'jobTypeId',requested_job_type_id,'actorUserId',actor,'recipientUserId',recipient,'pushPending',true),
    actor,now()+interval '90 days') returning id into notification_id;
   insert into public.notification_recipients(notification_id,user_id) values(notification_id,recipient) on conflict do nothing;
   notification_ids:=notification_ids||jsonb_build_array(notification_id);
  end if;
 end loop;
 return jsonb_build_object('reportId',target_report_id,'notificationIds',notification_ids);
end $$;


commit;
