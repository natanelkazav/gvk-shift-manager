
begin;

insert into public.dynamic_permission_manifest
(feature_key,permission_key,audience,label,description,default_enabled,sort_order)
values
('daily_reports','daily_reports.upload_attachment','member','צירוף טפסים וקבצים','העלאת קבצים מצורפים לדיווח היומי.',true,40),
('daily_reports','daily_reports.view_attachment','manager','צפייה בקבצים מצורפים','פתיחת טפסים וקבצים שצורפו לדיווחים.',true,40)
on conflict(feature_key,permission_key,audience) do update
set label=excluded.label,description=excluded.description,default_enabled=excluded.default_enabled,sort_order=excluded.sort_order;

create table if not exists public.daily_report_attachments(
 id uuid primary key default gen_random_uuid(),
 report_id uuid not null references public.daily_reports(id) on delete cascade,
 storage_path text not null unique,
 file_name text not null,
 mime_type text null,
 file_size bigint not null check(file_size > 0 and file_size <= 10485760),
 uploaded_by uuid not null references public.profiles(id) on delete restrict,
 created_at timestamptz not null default now()
);
alter table public.daily_report_attachments enable row level security;
revoke all on public.daily_report_attachments from anon,authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values(
 'daily-report-attachments','daily-report-attachments',false,10485760,
 array['application/pdf','image/png','image/jpeg','image/webp',
 'application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
 'application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
)
on conflict(id) do update set public=false,file_size_limit=10485760,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "daily report owner upload" on storage.objects;
create policy "daily report owner upload" on storage.objects
for insert to authenticated
with check(
 bucket_id='daily-report-attachments'
 and exists(
   select 1 from public.daily_reports r
   join public.job_types jt on jt.id=r.job_type_id
   where r.id=(storage.foldername(name))[1]::uuid
     and r.user_id=auth.uid()
     and r.status='draft'
     and coalesce((jt.scheduling_config#>>'{dailyReports,allowAttachments}')::boolean,true)
     and public.has_dynamic_job_type_permission('daily_reports.upload_attachment',r.job_type_id,auth.uid())
 )
);

drop policy if exists "daily report attachment read" on storage.objects;
create policy "daily report attachment read" on storage.objects
for select to authenticated
using(
 bucket_id='daily-report-attachments'
 and exists(
   select 1
   from public.daily_report_attachments a
   join public.daily_reports r on r.id=a.report_id
   join public.job_types jt on jt.id=r.job_type_id
   where a.storage_path=name and (
     r.user_id=auth.uid()
     or (jt.scheduling_config#>'{dailyReports,recipientUserIds}') ? auth.uid()::text
     or public.has_dynamic_job_type_permission('daily_reports.view_attachment',r.job_type_id,auth.uid())
   )
 )
);

drop policy if exists "daily report owner delete draft attachment" on storage.objects;
create policy "daily report owner delete draft attachment" on storage.objects
for delete to authenticated
using(
 bucket_id='daily-report-attachments'
 and exists(
   select 1 from public.daily_reports r
   where r.id=(storage.foldername(name))[1]::uuid
     and r.user_id=auth.uid() and r.status='draft'
 )
);

create or replace function public.prepare_my_daily_report_upload(requested_job_type_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare actor uuid:=auth.uid(); today_il date:=(now() at time zone 'Asia/Jerusalem')::date; rid uuid;
begin
 if actor is null then raise exception 'not authenticated'; end if;
 if not public.has_dynamic_job_type_permission('daily_reports.submit',requested_job_type_id,actor)
 or not public.has_dynamic_job_type_permission('daily_reports.upload_attachment',requested_job_type_id,actor)
 then raise exception 'not allowed'; end if;
 if not exists(select 1 from public.job_types jt where jt.id=requested_job_type_id and jt.is_active=true and jt.legacy_role is null
   and coalesce((jt.scheduling_config#>>'{dailyReports,allowAttachments}')::boolean,true))
 then raise exception 'attachments are disabled'; end if;

 insert into public.daily_reports(job_type_id,user_id,report_date,status,submitted_at,updated_at)
 values(requested_job_type_id,actor,today_il,'draft',null,now())
 on conflict(job_type_id,user_id,report_date) do update set updated_at=now()
 returning id into rid;
 return jsonb_build_object('reportId',rid);
end $$;

create or replace function public.register_my_daily_report_attachment(
 requested_report_id uuid, requested_storage_path text, requested_file_name text,
 requested_mime_type text, requested_file_size bigint
) returns jsonb language plpgsql security definer set search_path=''
as $$
declare actor uuid:=auth.uid(); aid uuid; jid uuid;
begin
 if actor is null then raise exception 'not authenticated'; end if;
 select r.job_type_id into jid from public.daily_reports r
 where r.id=requested_report_id and r.user_id=actor and r.status='draft';
 if jid is null or not public.has_dynamic_job_type_permission('daily_reports.upload_attachment',jid,actor)
 then raise exception 'not allowed'; end if;
 if requested_storage_path not like requested_report_id::text||'/%' then raise exception 'invalid storage path'; end if;
 if requested_file_size<=0 or requested_file_size>10485760 then raise exception 'invalid file size'; end if;
 insert into public.daily_report_attachments(report_id,storage_path,file_name,mime_type,file_size,uploaded_by)
 values(requested_report_id,requested_storage_path,left(requested_file_name,255),requested_mime_type,requested_file_size,actor)
 returning id into aid;
 return jsonb_build_object('id',aid);
end $$;

-- Replace submit signature to accept an optional prepared draft.
drop function if exists public.submit_my_daily_report(uuid,jsonb);
create or replace function public.submit_my_daily_report(
 requested_job_type_id uuid, requested_items jsonb, requested_report_id uuid default null
) returns jsonb language plpgsql security definer set search_path=''
as $$
declare actor uuid:=auth.uid(); today_il date:=(now() at time zone 'Asia/Jerusalem')::date;
 report_id uuid; item jsonb; subject_id_value uuid; subject_name_value text; customer_id_value uuid;
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
   select r.id into report_id from public.daily_reports r
   where r.id=requested_report_id and r.job_type_id=requested_job_type_id and r.user_id=actor and r.report_date=today_il;
   if report_id is null then raise exception 'prepared report not found'; end if;
   update public.daily_reports set status='submitted',submitted_at=now(),updated_at=now() where id=report_id;
 else
   insert into public.daily_reports(job_type_id,user_id,report_date,status,submitted_at,updated_at)
   values(requested_job_type_id,actor,today_il,'submitted',now(),now())
   on conflict(job_type_id,user_id,report_date) do update set status='submitted',submitted_at=now(),updated_at=now()
   returning id into report_id;
 end if;

 delete from public.daily_report_items i where i.report_id=report_id;
 for item in select value from jsonb_array_elements(requested_items) loop
   sort_value:=sort_value+1; subject_id_value:=nullif(item->>'subjectId','')::uuid;
   subject_name_value:=trim(coalesce(item->>'subjectName','')); customer_id_value:=nullif(item->>'customerId','')::uuid;
   customer_name_value:=nullif(trim(coalesce(item->>'customerName','')),''); details_value:=trim(coalesce(item->>'details',''));
   if subject_name_value='' or details_value='' then raise exception 'subject and details are required'; end if;
   insert into public.daily_report_items(report_id,subject_id,subject_name,customer_id,customer_name,details,sort_order)
   values(report_id,subject_id_value,subject_name_value,customer_id_value,customer_name_value,details_value,sort_value);
 end loop;

 for recipient in select distinct value::text::uuid from jsonb_array_elements_text(recipient_ids) loop
  if exists(select 1 from public.profiles p where p.id=recipient and p.is_active=true) then
   insert into public.notifications(type,priority,source,title,body,url,data,created_by,expires_at)
   values('manager_message','important','daily_report',concat('דיווח יומי חדש · ',job_name),
    concat(coalesce((select p.display_name from public.profiles p where p.id=actor),'עובד'),' שלח/ה דיווח יומי ל-',to_char(today_il,'DD/MM/YYYY'),' · ',jsonb_array_length(requested_items),' פעילויות.'),
    '/notifications',jsonb_build_object('workflow','daily_report','event','submitted','reportId',report_id,'jobTypeId',requested_job_type_id,'actorUserId',actor,'recipientUserId',recipient,'pushPending',true),
    actor,now()+interval '90 days') returning id into notification_id;
   insert into public.notification_recipients(notification_id,user_id) values(notification_id,recipient) on conflict do nothing;
   notification_ids:=notification_ids||jsonb_build_array(notification_id);
  end if;
 end loop;
 return jsonb_build_object('reportId',report_id,'notificationIds',notification_ids);
end $$;

create or replace function public.get_daily_report_attachment_download(requested_attachment_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare actor uuid:=auth.uid(); result jsonb;
begin
 if actor is null then raise exception 'not authenticated'; end if;
 select jsonb_build_object('storagePath',a.storage_path,'fileName',a.file_name)
 into result
 from public.daily_report_attachments a
 join public.daily_reports r on r.id=a.report_id
 join public.job_types jt on jt.id=r.job_type_id
 where a.id=requested_attachment_id and (
   r.user_id=actor
   or (jt.scheduling_config#>'{dailyReports,recipientUserIds}') ? actor::text
   or public.has_dynamic_job_type_permission('daily_reports.view_attachment',r.job_type_id,actor)
 );
 if result is null then raise exception 'not allowed'; end if;
 return result;
end $$;

revoke all on function public.prepare_my_daily_report_upload(uuid) from public;
revoke all on function public.register_my_daily_report_attachment(uuid,text,text,text,bigint) from public;
revoke all on function public.submit_my_daily_report(uuid,jsonb,uuid) from public;
revoke all on function public.get_daily_report_attachment_download(uuid) from public;
grant execute on function public.prepare_my_daily_report_upload(uuid) to authenticated;
grant execute on function public.register_my_daily_report_attachment(uuid,text,text,text,bigint) to authenticated;
grant execute on function public.submit_my_daily_report(uuid,jsonb,uuid) to authenticated;
grant execute on function public.get_daily_report_attachment_download(uuid) to authenticated;

-- expose attachment capability in employee workspace
create or replace function public.get_my_daily_report_workspace()
returns jsonb language plpgsql security definer set search_path=''
as $$
declare actor uuid:=auth.uid(); today_il date:=(now() at time zone 'Asia/Jerusalem')::date;
begin
 if actor is null then raise exception 'not authenticated'; end if;
 return jsonb_build_object('today',today_il,
 'customers',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name) order by c.name) from public.daily_report_customers c where c.is_active=true),'[]'::jsonb),
 'roles',coalesce((select jsonb_agg(jsonb_build_object(
  'jobTypeId',jt.id,'jobTypeName',jt.name,
  'allowAddSubjects',coalesce((jt.scheduling_config#>>'{dailyReports,allowAddSubjects}')::boolean,true),
  'allowAddCustomers',coalesce((jt.scheduling_config#>>'{dailyReports,allowAddCustomers}')::boolean,true),
  'allowAttachments',coalesce((jt.scheduling_config#>>'{dailyReports,allowAttachments}')::boolean,true)
    and public.has_dynamic_job_type_permission('daily_reports.upload_attachment',jt.id,actor),
  'subjects',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'name',s.name) order by s.name) from public.daily_report_subjects s where s.job_type_id=jt.id and s.is_active=true),'[]'::jsonb),
  'todayReport',(select jsonb_build_object('id',r.id,'status',r.status,'submittedAt',r.submitted_at,'itemCount',(select count(*) from public.daily_report_items i where i.report_id=r.id)) from public.daily_reports r where r.job_type_id=jt.id and r.user_id=actor and r.report_date=today_il),
  'recentReports',coalesce((select jsonb_agg(x.obj order by x.report_date desc) from (
    select r.report_date,jsonb_build_object('id',r.id,'reportDate',r.report_date,'status',r.status,'submittedAt',r.submitted_at,'itemCount',(select count(*) from public.daily_report_items i where i.report_id=r.id)) obj
    from public.daily_reports r where r.job_type_id=jt.id and r.user_id=actor order by r.report_date desc limit 7
  ) x),'[]'::jsonb)
 ) order by m.is_primary desc,jt.name)
 from public.job_type_memberships m join public.job_types jt on jt.id=m.job_type_id
 where m.user_id=actor and jt.is_active=true and jt.legacy_role is null
 and (exists(select 1 from public.job_type_capabilities c where c.job_type_id=jt.id and c.capability_key='daily_reports' and c.enabled=true)
   or coalesce((jt.scheduling_config#>>'{dailyReports,enabled}')::boolean,false))
 and public.has_dynamic_job_type_permission('daily_reports.submit',jt.id,actor)),'[]'::jsonb));
end $$;

commit;
