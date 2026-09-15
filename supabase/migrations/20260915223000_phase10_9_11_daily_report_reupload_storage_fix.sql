begin;

create or replace function public.prepare_my_daily_report_upload(requested_job_type_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  actor uuid:=auth.uid();
  today_il date:=(now() at time zone 'Asia/Jerusalem')::date;
  target_report_id uuid;
begin
  if actor is null then raise exception 'not authenticated'; end if;

  if not public.has_dynamic_job_type_permission('daily_reports.submit',requested_job_type_id,actor)
     or not public.has_dynamic_job_type_permission('daily_reports.upload_attachment',requested_job_type_id,actor)
  then raise exception 'not allowed'; end if;

  if not exists(
    select 1 from public.job_types jt
    where jt.id=requested_job_type_id
      and jt.is_active=true
      and jt.legacy_role is null
      and coalesce((jt.scheduling_config#>>'{dailyReports,allowAttachments}')::boolean,true)
  ) then raise exception 'attachments are disabled'; end if;

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

  return jsonb_build_object('reportId',target_report_id);
end;
$$;

revoke all on function public.prepare_my_daily_report_upload(uuid) from public;
grant execute on function public.prepare_my_daily_report_upload(uuid) to authenticated;

-- Harden Storage authorization: path is <report UUID>/<ASCII object key>.
create or replace function public.can_upload_daily_report_attachment(requested_storage_path text)
returns boolean
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  actor uuid:=auth.uid();
  target_report_id uuid;
  target_job_type_id uuid;
begin
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

  if target_job_type_id is null then return false; end if;

  return public.has_dynamic_job_type_permission(
    'daily_reports.upload_attachment',
    target_job_type_id,
    actor
  );
end;
$$;

revoke all on function public.can_upload_daily_report_attachment(text) from public;
grant execute on function public.can_upload_daily_report_attachment(text) to authenticated;

commit;
