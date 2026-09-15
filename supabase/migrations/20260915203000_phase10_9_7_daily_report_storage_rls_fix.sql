begin;

-- Storage RLS runs as the authenticated user. Phase 10.9.2 intentionally
-- revoked direct access to daily_reports, so policies that queried that table
-- directly failed with "permission denied for table daily_reports".
-- Keep the report tables private and move authorization behind SECURITY DEFINER
-- helper functions.

create or replace function public.can_upload_daily_report_attachment(requested_storage_path text)
returns boolean
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  actor uuid:=auth.uid();
  report_id_value uuid;
  job_type_id_value uuid;
begin
  if actor is null then return false; end if;

  begin
    report_id_value:=split_part(requested_storage_path,'/',1)::uuid;
  exception when others then
    return false;
  end;

  select r.job_type_id into job_type_id_value
  from public.daily_reports r
  join public.job_types jt on jt.id=r.job_type_id
  where r.id=report_id_value
    and r.user_id=actor
    and r.status='draft'
    and coalesce((jt.scheduling_config#>>'{dailyReports,allowAttachments}')::boolean,true);

  if job_type_id_value is null then return false; end if;

  return public.has_dynamic_job_type_permission(
    'daily_reports.upload_attachment',
    job_type_id_value,
    actor
  );
end;
$$;

create or replace function public.can_read_daily_report_attachment(requested_storage_path text)
returns boolean
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  actor uuid:=auth.uid();
begin
  if actor is null then return false; end if;

  return exists(
    select 1
    from public.daily_report_attachments a
    join public.daily_reports r on r.id=a.report_id
    join public.job_types jt on jt.id=r.job_type_id
    where a.storage_path=requested_storage_path
      and (
        r.user_id=actor
        or (jt.scheduling_config#>'{dailyReports,recipientUserIds}') ? actor::text
        or public.has_dynamic_job_type_permission(
          'daily_reports.view_attachment',
          r.job_type_id,
          actor
        )
      )
  );
end;
$$;

create or replace function public.can_delete_daily_report_attachment(requested_storage_path text)
returns boolean
language plpgsql
stable
security definer
set search_path=''
as $$
declare actor uuid:=auth.uid(); report_id_value uuid;
begin
  if actor is null then return false; end if;
  begin
    report_id_value:=split_part(requested_storage_path,'/',1)::uuid;
  exception when others then
    return false;
  end;

  return exists(
    select 1 from public.daily_reports r
    where r.id=report_id_value
      and r.user_id=actor
      and r.status='draft'
  );
end;
$$;

revoke all on function public.can_upload_daily_report_attachment(text) from public;
revoke all on function public.can_read_daily_report_attachment(text) from public;
revoke all on function public.can_delete_daily_report_attachment(text) from public;
grant execute on function public.can_upload_daily_report_attachment(text) to authenticated;
grant execute on function public.can_read_daily_report_attachment(text) to authenticated;
grant execute on function public.can_delete_daily_report_attachment(text) to authenticated;

drop policy if exists "daily report owner upload" on storage.objects;
create policy "daily report owner upload" on storage.objects
for insert to authenticated
with check(
  bucket_id='daily-report-attachments'
  and public.can_upload_daily_report_attachment(name)
);

drop policy if exists "daily report attachment read" on storage.objects;
create policy "daily report attachment read" on storage.objects
for select to authenticated
using(
  bucket_id='daily-report-attachments'
  and public.can_read_daily_report_attachment(name)
);

drop policy if exists "daily report owner delete draft attachment" on storage.objects;
create policy "daily report owner delete draft attachment" on storage.objects
for delete to authenticated
using(
  bucket_id='daily-report-attachments'
  and public.can_delete_daily_report_attachment(name)
);

commit;
