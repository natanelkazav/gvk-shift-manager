begin;

create or replace function public.get_daily_report_notification_detail(requested_report_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare actor uuid:=auth.uid();
begin
 if actor is null then raise exception 'not authenticated'; end if;
 if not exists(
   select 1 from public.daily_reports r join public.job_types jt on jt.id=r.job_type_id
   where r.id=requested_report_id and (
     r.user_id=actor
     or (jt.scheduling_config#>'{dailyReports,recipientUserIds}') ? actor::text
     or public.has_dynamic_job_type_permission('daily_reports.view_received',r.job_type_id,actor)
   )
 ) then raise exception 'not allowed'; end if;

 return (
  select jsonb_build_object(
   'id',r.id,'reportDate',r.report_date,'submittedAt',r.submitted_at,
   'jobTypeId',jt.id,'jobTypeName',jt.name,'userId',p.id,'displayName',p.display_name,
   'items',coalesce((select jsonb_agg(jsonb_build_object(
      'id',i.id,'subjectName',i.subject_name,'customerName',i.customer_name,
      'details',i.details,'sortOrder',i.sort_order) order by i.sort_order)
      from public.daily_report_items i where i.report_id=r.id),'[]'::jsonb),
   'attachments',coalesce((select jsonb_agg(jsonb_build_object(
      'id',a.id,'fileName',a.file_name,'mimeType',a.mime_type,
      'fileSize',a.file_size,'storagePath',a.storage_path) order by a.created_at)
      from public.daily_report_attachments a where a.report_id=r.id),'[]'::jsonb)
  )
  from public.daily_reports r join public.job_types jt on jt.id=r.job_type_id
  join public.profiles p on p.id=r.user_id where r.id=requested_report_id
 );
end $$;

-- Existing daily-report notifications gain attachment count immediately.
update public.notifications n
set data = coalesce(n.data,'{}'::jsonb) || jsonb_build_object(
 'attachmentCount',
 (select count(*) from public.daily_report_attachments a
  where a.report_id=(n.data->>'reportId')::uuid)
)
where n.source='daily_report'
  and n.data ? 'reportId'
  and (n.data->>'reportId') ~* '^[0-9a-f-]{36}$';

commit;
