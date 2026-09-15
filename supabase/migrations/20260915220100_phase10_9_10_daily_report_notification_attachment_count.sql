begin;
create or replace function public.decorate_daily_report_notification()
returns trigger language plpgsql security definer set search_path=''
as $$
declare rid uuid; attachment_count_value bigint;
begin
 if new.source<>'daily_report' or not (new.data ? 'reportId') then return new; end if;
 begin rid:=(new.data->>'reportId')::uuid; exception when others then return new; end;
 select count(*) into attachment_count_value from public.daily_report_attachments a where a.report_id=rid;
 new.data:=coalesce(new.data,'{}'::jsonb)||jsonb_build_object('attachmentCount',attachment_count_value);
 return new;
end $$;
drop trigger if exists decorate_daily_report_notification_trigger on public.notifications;
create trigger decorate_daily_report_notification_trigger
before insert or update of data on public.notifications
for each row execute function public.decorate_daily_report_notification();
commit;
