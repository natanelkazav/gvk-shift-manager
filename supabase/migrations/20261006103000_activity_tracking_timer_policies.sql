begin;

insert into public.dynamic_permission_manifest(feature_key,permission_key,audience,label,description,default_enabled,sort_order)
values('activity_tracking','activity_tracking.manage_own_settings','member','התאמה אישית של הגדרות מעקב פעילות','מאפשר לעובד לשנות לעצמו את שעת הסיום האוטומטי ואת ספי ההתראות.',false,30)
on conflict(feature_key,permission_key,audience) do update set label=excluded.label,description=excluded.description,default_enabled=excluded.default_enabled,sort_order=excluded.sort_order;

create table if not exists public.activity_tracking_user_settings(
 job_type_id uuid not null references public.job_types(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade,
 auto_end_enabled boolean,
 auto_end_time time,
 end_reminder_enabled boolean,
 end_reminder_minutes_before integer check(end_reminder_minutes_before between 5 and 240),
 continuous_reminder_enabled boolean,
 continuous_reminder_minutes integer check(continuous_reminder_minutes between 30 and 720),
 updated_at timestamptz not null default now(),
 primary key(job_type_id,user_id)
);
alter table public.activity_tracking_user_settings enable row level security;

create or replace function public.activity_tracking_effective_settings(requested_job_type_id uuid, requested_user_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare cfg jsonb; own public.activity_tracking_user_settings%rowtype; allow_own boolean;
begin
 select public.activity_tracking_config(jt) into cfg from public.job_types jt where jt.id=requested_job_type_id;
 allow_own:=public.has_dynamic_job_type_permission('activity_tracking.manage_own_settings',requested_job_type_id,requested_user_id);
 if allow_own then select * into own from public.activity_tracking_user_settings where job_type_id=requested_job_type_id and user_id=requested_user_id; end if;
 return jsonb_build_object(
  'autoEndEnabled',coalesce(own.auto_end_enabled,coalesce((cfg->>'autoEndEnabled')::boolean,false)),
  'autoEndTime',coalesce(to_char(own.auto_end_time,'HH24:MI'),nullif(cfg->>'autoEndTime',''),'20:00'),
  'endReminderEnabled',coalesce(own.end_reminder_enabled,coalesce((cfg->>'endReminderEnabled')::boolean,true)),
  'endReminderMinutesBefore',coalesce(own.end_reminder_minutes_before,coalesce((cfg->>'endReminderMinutesBefore')::int,30)),
  'continuousReminderEnabled',coalesce(own.continuous_reminder_enabled,coalesce((cfg->>'continuousReminderEnabled')::boolean,true)),
  'continuousReminderMinutes',coalesce(own.continuous_reminder_minutes,coalesce((cfg->>'continuousReminderMinutes')::int,240))
 );
end $$;
revoke all on function public.activity_tracking_effective_settings(uuid,uuid) from public,anon,authenticated;

create or replace function public.get_my_activity_tracking_settings() returns jsonb language plpgsql security definer set search_path=public as $$
declare actor uuid:=auth.uid(); result jsonb;
begin
 if actor is null then raise exception 'not authenticated'; end if;
 select coalesce(jsonb_agg(jsonb_build_object(
  'jobTypeId',jt.id,'jobTypeName',jt.name,
  'defaults',jsonb_build_object(
   'autoEndEnabled',coalesce((public.activity_tracking_config(jt)->>'autoEndEnabled')::boolean,false),
   'autoEndTime',coalesce(nullif(public.activity_tracking_config(jt)->>'autoEndTime',''),'20:00'),
   'endReminderEnabled',coalesce((public.activity_tracking_config(jt)->>'endReminderEnabled')::boolean,true),
   'endReminderMinutesBefore',coalesce((public.activity_tracking_config(jt)->>'endReminderMinutesBefore')::int,30),
   'continuousReminderEnabled',coalesce((public.activity_tracking_config(jt)->>'continuousReminderEnabled')::boolean,true),
   'continuousReminderMinutes',coalesce((public.activity_tracking_config(jt)->>'continuousReminderMinutes')::int,240)),
  'personal',jsonb_build_object('autoEndEnabled',us.auto_end_enabled,'autoEndTime',case when us.auto_end_time is null then null else to_char(us.auto_end_time,'HH24:MI') end,'endReminderEnabled',us.end_reminder_enabled,'endReminderMinutesBefore',us.end_reminder_minutes_before,'continuousReminderEnabled',us.continuous_reminder_enabled,'continuousReminderMinutes',us.continuous_reminder_minutes)
 ) order by jt.name),'[]'::jsonb) into result
 from public.job_types jt join public.job_type_memberships m on m.job_type_id=jt.id and m.user_id=actor
 left join public.activity_tracking_user_settings us on us.job_type_id=jt.id and us.user_id=actor
 where jt.is_active and coalesce((public.activity_tracking_config(jt)->>'enabled')::boolean,false)
 and public.has_dynamic_job_type_permission('activity_tracking.manage_own_settings',jt.id,actor);
 return result;
end $$;

create or replace function public.save_my_activity_tracking_settings(requested_job_type_id uuid,requested_settings jsonb) returns void language plpgsql security definer set search_path=public as $$
declare actor uuid:=auth.uid();
begin
 if actor is null or not public.has_dynamic_job_type_permission('activity_tracking.manage_own_settings',requested_job_type_id,actor) then raise exception 'not allowed'; end if;
 if not exists(select 1 from public.job_type_memberships where job_type_id=requested_job_type_id and user_id=actor) then raise exception 'not a member'; end if;
 insert into public.activity_tracking_user_settings(job_type_id,user_id,auto_end_enabled,auto_end_time,end_reminder_enabled,end_reminder_minutes_before,continuous_reminder_enabled,continuous_reminder_minutes,updated_at)
 values(requested_job_type_id,actor,(requested_settings->>'autoEndEnabled')::boolean,(requested_settings->>'autoEndTime')::time,(requested_settings->>'endReminderEnabled')::boolean,(requested_settings->>'endReminderMinutesBefore')::int,(requested_settings->>'continuousReminderEnabled')::boolean,(requested_settings->>'continuousReminderMinutes')::int,now())
 on conflict(job_type_id,user_id) do update set auto_end_enabled=excluded.auto_end_enabled,auto_end_time=excluded.auto_end_time,end_reminder_enabled=excluded.end_reminder_enabled,end_reminder_minutes_before=excluded.end_reminder_minutes_before,continuous_reminder_enabled=excluded.continuous_reminder_enabled,continuous_reminder_minutes=excluded.continuous_reminder_minutes,updated_at=now();
end $$;

create or replace function public.reset_my_activity_tracking_settings(requested_job_type_id uuid) returns void language plpgsql security definer set search_path=public as $$
declare actor uuid:=auth.uid(); begin if actor is null or not public.has_dynamic_job_type_permission('activity_tracking.manage_own_settings',requested_job_type_id,actor) then raise exception 'not allowed'; end if; delete from public.activity_tracking_user_settings where job_type_id=requested_job_type_id and user_id=actor; end $$;

grant execute on function public.get_my_activity_tracking_settings() to authenticated;
grant execute on function public.save_my_activity_tracking_settings(uuid,jsonb) to authenticated;
grant execute on function public.reset_my_activity_tracking_settings(uuid) to authenticated;

create or replace function public.get_my_activity_tracking_context() returns jsonb language plpgsql security definer set search_path=public as $$
declare actor uuid:=auth.uid(); result jsonb;
begin
 if actor is null then raise exception 'not authenticated'; end if;
 select coalesce(jsonb_agg(jsonb_build_object(
  'jobTypeId',jt.id,'jobTypeName',jt.name,'activities',coalesce(public.activity_tracking_config(jt)->'activities','[]'::jsonb),
  'reminderEnabled',coalesce((public.activity_tracking_config(jt)->>'reminderEnabled')::boolean,false),
  'reminderTime',coalesce(public.activity_tracking_config(jt)->>'reminderTime','20:00'),
  'effectiveSettings',public.activity_tracking_effective_settings(jt.id,actor),
  'day',case when d.id is null then null else jsonb_build_object('id',d.id,'status',d.status,'workDate',d.work_date,'startedAt',d.started_at,'endedAt',d.ended_at,
    'segments',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'activityKey',s.activity_key,'activityLabel',s.activity_label,'startedAt',s.started_at,'endedAt',s.ended_at) order by s.started_at) from public.activity_tracking_segments s where s.day_id=d.id),'[]'::jsonb)) end
 ) order by jt.name),'[]'::jsonb) into result
 from public.job_types jt join public.job_type_memberships m on m.job_type_id=jt.id and m.user_id=actor
 left join public.activity_tracking_days d on d.job_type_id=jt.id and d.user_id=actor and d.work_date=(now() at time zone 'Asia/Jerusalem')::date
 where jt.is_active and coalesce((public.activity_tracking_config(jt)->>'enabled')::boolean,false)
 and public.has_dynamic_job_type_permission('activity_tracking.use',jt.id,actor);
 return result;
end $$;

create or replace function public.process_activity_tracking_reminders() returns integer language plpgsql security definer set search_path=public as $$
declare r record; seg record; eff jsonb; nid uuid; processed integer:=0; stop_at timestamptz; remind_at timestamptz; threshold integer;
begin
 -- Auto-end and pre-end reminder use the effective role/user policy.
 for r in select d.*,jt.name from public.activity_tracking_days d join public.job_types jt on jt.id=d.job_type_id where d.status='active' loop
  eff:=public.activity_tracking_effective_settings(r.job_type_id,r.user_id);
  stop_at:=((r.work_date + (coalesce(eff->>'autoEndTime','20:00'))::time) at time zone 'Asia/Jerusalem');
  if coalesce((eff->>'autoEndEnabled')::boolean,false) then
   if now()>=stop_at then
    update public.activity_tracking_segments set ended_at=stop_at,updated_at=now() where day_id=r.id and ended_at is null and started_at<stop_at;
    update public.activity_tracking_days set status='ended',ended_at=stop_at,updated_at=now() where id=r.id;
    processed:=processed+1; continue;
   end if;
   if coalesce((eff->>'endReminderEnabled')::boolean,true) then
    remind_at:=stop_at-make_interval(mins=>coalesce((eff->>'endReminderMinutesBefore')::int,30));
    if now()>=remind_at and now()<stop_at and not exists(select 1 from public.notifications n join public.notification_recipients nr on nr.notification_id=n.id where nr.user_id=r.user_id and n.source='activity_auto_end_warning' and n.data->>'dayId'=r.id::text) then
     insert into public.notifications(type,priority,source,title,body,url,data,created_by,expires_at) values('manager_message','normal','activity_auto_end_warning','תזכורת לפני סיום יום – '||r.name,'יום העבודה יסתיים אוטומטית בשעה '||(eff->>'autoEndTime')||'. אם ממשיכים לעבוד, ניתן לעדכן את ההגדרה האישית בהתאם להרשאה.','/',jsonb_build_object('kind','activity_auto_end_warning','dayId',r.id,'jobTypeId',r.job_type_id,'pushPending',true),null,stop_at+interval '1 hour') returning id into nid;
     insert into public.notification_recipients(notification_id,user_id) values(nid,r.user_id) on conflict do nothing; processed:=processed+1;
    end if;
   end if;
  end if;
 end loop;

 -- Long-running activity reminder: one reminder per uninterrupted segment.
 for seg in select s.*,d.user_id,d.job_type_id,jt.name from public.activity_tracking_segments s join public.activity_tracking_days d on d.id=s.day_id join public.job_types jt on jt.id=d.job_type_id where s.ended_at is null and d.status='active' loop
  eff:=public.activity_tracking_effective_settings(seg.job_type_id,seg.user_id); threshold:=coalesce((eff->>'continuousReminderMinutes')::int,240);
  if coalesce((eff->>'continuousReminderEnabled')::boolean,true) and now()>=seg.started_at+make_interval(mins=>threshold)
   and not exists(select 1 from public.notifications n join public.notification_recipients nr on nr.notification_id=n.id where nr.user_id=seg.user_id and n.source='activity_continuous_warning' and n.data->>'segmentId'=seg.id::text) then
   insert into public.notifications(type,priority,source,title,body,url,data,created_by,expires_at) values('manager_message','normal','activity_continuous_warning','הפעילות „'||seg.activity_label||'” עדיין רצה','הטיימר רץ ברצף כבר '||threshold||' דקות. האם שכחת להחליף או להשהות את הפעילות?','/',jsonb_build_object('kind','activity_continuous_warning','segmentId',seg.id,'jobTypeId',seg.job_type_id,'pushPending',true),null,now()+interval '1 day') returning id into nid;
   insert into public.notification_recipients(notification_id,user_id) values(nid,seg.user_id) on conflict do nothing; processed:=processed+1;
  end if;
 end loop;

 -- Existing 12-hour safety net remains as a final guardrail.
 update public.activity_tracking_segments s set ended_at=s.started_at+interval '12 hours',updated_at=now() where s.ended_at is null and s.started_at<now()-interval '12 hours';
 update public.activity_tracking_days d set status='needs_review',ended_at=coalesce(ended_at,now()),updated_at=now() where d.status='active' and exists(select 1 from public.activity_tracking_segments s where s.day_id=d.id and s.ended_at is not null and s.updated_at>now()-interval '6 minutes');
 return processed;
end $$;

revoke all on function public.process_activity_tracking_reminders() from public,anon,authenticated;
do $$ begin if exists(select 1 from pg_extension where extname='pg_cron') then perform cron.unschedule(jobid) from cron.job where jobname='process-activity-tracking-reminders'; perform cron.schedule('process-activity-tracking-reminders','*/5 * * * *','select public.process_activity_tracking_reminders();'); end if; exception when others then raise notice 'activity reminder cron skipped: %',sqlerrm; end $$;

commit;
