begin;

create table if not exists public.dynamic_availability_reminder_deliveries (
  id uuid primary key default gen_random_uuid(),
  period_id uuid not null references public.dynamic_availability_periods(id) on delete cascade,
  days_before integer not null check (days_before between 0 and 60),
  notification_id uuid references public.notifications(id) on delete set null,
  recipient_count integer not null default 0,
  sent_at timestamptz not null default now(),
  unique(period_id, days_before)
);

create or replace function public.get_dynamic_availability_reminder_settings(
  requested_job_type_id uuid, requested_year integer, requested_month integer
) returns jsonb
language plpgsql security definer set search_path=public as $$
declare
  actor uuid:=auth.uid(); jt public.job_types%rowtype; p public.dynamic_availability_periods%rowtype;
  reminder_days jsonb;
begin
  if actor is null then raise exception 'not authenticated'; end if;
  if not public.has_dynamic_job_type_permission('availability.view_team',requested_job_type_id,actor) then raise exception 'not allowed'; end if;
  select * into jt from public.job_types where id=requested_job_type_id;
  if jt.id is null then raise exception 'job type not found'; end if;
  select * into p from public.dynamic_availability_periods where job_type_id=jt.id and year=requested_year and month=requested_month;
  reminder_days:=coalesce(jt.availability_config->'automaticReminderDays','[7,3,1]'::jsonb);
  return jsonb_build_object(
    'days',reminder_days,
    'deliveries',coalesce((select jsonb_agg(jsonb_build_object('daysBefore',d.days_before,'sentAt',d.sent_at,'recipientCount',d.recipient_count)) from public.dynamic_availability_reminder_deliveries d where d.period_id=p.id),'[]'::jsonb)
  );
end; $$;

create or replace function public.set_dynamic_availability_reminder_settings(
  requested_job_type_id uuid, requested_days integer[]
) returns void
language plpgsql security definer set search_path=public as $$
declare actor uuid:=auth.uid(); normalized integer[];
begin
  if actor is null then raise exception 'not authenticated'; end if;
  if not public.has_dynamic_job_type_permission('availability.open_period',requested_job_type_id,actor) then raise exception 'not allowed'; end if;
  select coalesce(array_agg(distinct d order by d desc),array[]::integer[]) into normalized
  from unnest(coalesce(requested_days,array[]::integer[])) d where d between 0 and 60;
  if cardinality(normalized)>6 then raise exception 'up to 6 automatic reminders are allowed'; end if;
  update public.job_types
  set availability_config=jsonb_set(coalesce(availability_config,'{}'::jsonb),'{automaticReminderDays}',to_jsonb(normalized),true),updated_at=now()
  where id=requested_job_type_id;
  insert into public.audit_logs(action,actor_user_id,entity_type,entity_id,summary,metadata)
  values('system_event',actor,'job_type',requested_job_type_id,'הגדרות תזכורות אוטומטיות לאילוצים עודכנו',jsonb_build_object('days_before',normalized));
end; $$;

create or replace function public.process_dynamic_availability_reminders() returns integer
language plpgsql security definer set search_path=public as $$
declare r record; day_value integer; trigger_at timestamptz; nid uuid; recipients integer; processed integer:=0;
begin
  for r in
    select p.*,jt.name as job_name,coalesce(jt.availability_config->'automaticReminderDays','[7,3,1]'::jsonb) as reminder_days
    from public.dynamic_availability_periods p join public.job_types jt on jt.id=p.job_type_id
    where p.status='open' and p.submission_deadline is not null and p.submission_deadline>now()
  loop
    for day_value in select value::integer from jsonb_array_elements_text(r.reminder_days)
    loop
      trigger_at:=r.submission_deadline-make_interval(days=>day_value);
      if now()>=trigger_at and now()<trigger_at+interval '1 hour'
         and not exists(select 1 from public.dynamic_availability_reminder_deliveries d where d.period_id=r.id and d.days_before=day_value) then
        select count(*) into recipients
        from public.job_type_memberships m join public.profiles pr on pr.id=m.user_id and pr.is_active=true
        left join public.dynamic_availability_submissions s on s.period_id=r.id and s.user_id=m.user_id and s.status='submitted'
        where m.job_type_id=r.job_type_id and s.id is null;
        if recipients>0 then
          insert into public.notifications(type,priority,source,title,body,url,data,created_by,expires_at)
          values('manager_message','normal','availability_reminder','תזכורת להגשת אילוצים – '||r.job_name,
            case when day_value=0 then 'מועד הגשת האילוצים הוא היום. בבקשה לא לשכוח להשלים ולהגיש את האילוצים.'
                 when day_value=1 then 'נותר יום אחד להגשת האילוצים. בבקשה לא לשכוח להשלים ולהגיש את האילוצים.'
                 else 'נותרו '||day_value||' ימים להגשת האילוצים. בבקשה לא לשכוח להשלים ולהגיש את האילוצים.' end,
            '/my-availability',jsonb_build_object('kind','automatic_availability_reminder','jobTypeId',r.job_type_id,'periodId',r.id,'daysBefore',day_value,'pushPending',true),null,r.submission_deadline+interval '1 day')
          returning id into nid;
          insert into public.notification_recipients(notification_id,user_id)
          select nid,m.user_id from public.job_type_memberships m join public.profiles pr on pr.id=m.user_id and pr.is_active=true
          left join public.dynamic_availability_submissions s on s.period_id=r.id and s.user_id=m.user_id and s.status='submitted'
          where m.job_type_id=r.job_type_id and s.id is null on conflict do nothing;
        else nid:=null; end if;
        insert into public.dynamic_availability_reminder_deliveries(period_id,days_before,notification_id,recipient_count)
        values(r.id,day_value,nid,recipients) on conflict(period_id,days_before) do nothing;
        processed:=processed+1;
      end if;
    end loop;
  end loop;
  return processed;
end; $$;

grant execute on function public.get_dynamic_availability_reminder_settings(uuid,integer,integer) to authenticated;
grant execute on function public.set_dynamic_availability_reminder_settings(uuid,integer[]) to authenticated;
revoke all on function public.process_dynamic_availability_reminders() from public,anon,authenticated;

do $$ begin
  if exists(select 1 from pg_extension where extname='pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname='process-dynamic-availability-reminders';
    perform cron.schedule('process-dynamic-availability-reminders','17 * * * *','select public.process_dynamic_availability_reminders();');
  end if;
exception when others then raise notice 'pg_cron schedule skipped: %',sqlerrm; end $$;

commit;
