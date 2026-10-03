begin;

insert into public.dynamic_permission_manifest(feature_key,permission_key,audience,label,description,default_enabled,sort_order)
values
('activity_tracking','activity_tracking.use','member','שימוש במעקב פעילות','מעבר בין פעילויות וסיום יום עבודה.',true,10),
('activity_tracking','activity_tracking.view_own','member','צפייה בנתוני הפעילות שלי','צפייה בסיכומי זמן אישיים.',true,20),
('activity_tracking','activity_tracking.view_team','manager','צפייה במעקב פעילות התפקיד','צפייה ביומן ובסטטיסטיקות הפעילות של עובדי התפקיד.',true,10),
('activity_tracking','activity_tracking.edit_team','manager','עריכת מקטעי פעילות','תיקון, הוספה ומחיקה של מקטעי פעילות עם תיעוד.',true,20)
on conflict(feature_key,permission_key,audience) do update set label=excluded.label,description=excluded.description,default_enabled=excluded.default_enabled,sort_order=excluded.sort_order;


create or replace function public.get_dynamic_job_type_active_features(requested_job_type_id uuid)
returns text[] language plpgsql stable security definer set search_path=public as $$
declare jt public.job_types%rowtype; features text[]:=array[]::text[]; change_mode text;
begin
 select * into jt from public.job_types where id=requested_job_type_id; if not found then return array[]::text[]; end if;
 if coalesce(jt.scheduling_strategy,'availability_optimizer')<>'none' then features:=array_append(features,'schedule'); if coalesce((jt.availability_config->>'enabled')::boolean,false) then features:=array_append(features,'availability'); end if; change_mode:=coalesce(jt.scheduling_config->>'scheduleChangeMode','none'); if change_mode='shift_exchange' then features:=array_append(features,'shift_exchange'); elsif change_mode='self_edit' then features:=array_append(features,'self_edit'); end if; if jt.scheduling_strategy='monthly_rotation_constraints' then features:=array_append(features,'monthly_rotation'); end if; end if;
 if coalesce((jt.statistics_config->>'enabled')::boolean,false) then features:=array_append(features,'statistics'); end if;
 if coalesce(jt.pay_model,'none')<>'none' then features:=array_append(features,'payroll'); end if;
 if coalesce((jt.scheduling_config#>>'{attendance,enabled}')::boolean,false) then features:=array_append(features,'attendance'); end if;
 if exists(select 1 from public.job_type_capabilities c where c.job_type_id=jt.id and c.capability_key='daily_reports' and c.enabled=true) or coalesce((jt.scheduling_config#>>'{dailyReports,enabled}')::boolean,false) then features:=array_append(features,'daily_reports'); end if;
 if coalesce((jt.scheduling_config#>>'{activityTracking,enabled}')::boolean,false) then features:=array_append(features,'activity_tracking'); end if;
 return coalesce((select array_agg(distinct x order by x) from unnest(features)x),array[]::text[]);
end $$;
select public.sync_dynamic_job_type_permission_settings(id) from public.job_types where coalesce((scheduling_config#>>'{activityTracking,enabled}')::boolean,false);

create table if not exists public.activity_tracking_days(
 id uuid primary key default gen_random_uuid(), job_type_id uuid not null references public.job_types(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade, work_date date not null default (now() at time zone 'Asia/Jerusalem')::date,
 started_at timestamptz not null default now(), ended_at timestamptz, status text not null default 'active' check(status in('active','ended','needs_review')),
 updated_at timestamptz not null default now(), unique(job_type_id,user_id,work_date)
);
create table if not exists public.activity_tracking_segments(
 id uuid primary key default gen_random_uuid(), day_id uuid not null references public.activity_tracking_days(id) on delete cascade,
 activity_key text not null, activity_label text not null, started_at timestamptz not null, ended_at timestamptz,
 edited_by uuid references public.profiles(id) on delete set null, edit_reason text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(ended_at is null or ended_at>=started_at)
);
create index if not exists activity_tracking_days_lookup on public.activity_tracking_days(job_type_id,user_id,work_date desc);
create index if not exists activity_tracking_segments_day on public.activity_tracking_segments(day_id,started_at);
alter table public.activity_tracking_days enable row level security;
alter table public.activity_tracking_segments enable row level security;

create or replace function public.activity_tracking_config(j public.job_types) returns jsonb language sql stable set search_path='' as $$
 select coalesce(j.scheduling_config->'activityTracking','{}'::jsonb)
$$;

create or replace function public.get_my_activity_tracking_context() returns jsonb language plpgsql security definer set search_path=public as $$
declare actor uuid:=auth.uid(); result jsonb;
begin
 if actor is null then raise exception 'not authenticated'; end if;
 select coalesce(jsonb_agg(jsonb_build_object(
  'jobTypeId',jt.id,'jobTypeName',jt.name,'activities',coalesce(public.activity_tracking_config(jt)->'activities','[]'::jsonb),
  'reminderEnabled',coalesce((public.activity_tracking_config(jt)->>'reminderEnabled')::boolean,false),
  'reminderTime',coalesce(public.activity_tracking_config(jt)->>'reminderTime','20:00'),
  'day',case when d.id is null then null else jsonb_build_object('id',d.id,'status',d.status,'workDate',d.work_date,'startedAt',d.started_at,'endedAt',d.ended_at,
    'segments',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'activityKey',s.activity_key,'activityLabel',s.activity_label,'startedAt',s.started_at,'endedAt',s.ended_at) order by s.started_at) from public.activity_tracking_segments s where s.day_id=d.id),'[]'::jsonb)) end
 ) order by jt.name),'[]'::jsonb) into result
 from public.job_types jt join public.job_type_memberships m on m.job_type_id=jt.id and m.user_id=actor
 left join public.activity_tracking_days d on d.job_type_id=jt.id and d.user_id=actor and d.work_date=(now() at time zone 'Asia/Jerusalem')::date
 where jt.is_active and coalesce((public.activity_tracking_config(jt)->>'enabled')::boolean,false)
   and public.has_dynamic_job_type_permission('activity_tracking.use',jt.id,actor);
 return result;
end $$;

create or replace function public.switch_my_activity(requested_job_type_id uuid,requested_activity_key text) returns jsonb language plpgsql security definer set search_path=public as $$
declare actor uuid:=auth.uid(); jt public.job_types%rowtype; cfg jsonb; activity jsonb; d public.activity_tracking_days%rowtype; nowv timestamptz:=now();
begin
 if actor is null then raise exception 'not authenticated'; end if;
 if not public.has_dynamic_job_type_permission('activity_tracking.use',requested_job_type_id,actor) then raise exception 'not allowed'; end if;
 select * into jt from public.job_types where id=requested_job_type_id and is_active;
 cfg:=public.activity_tracking_config(jt); if not coalesce((cfg->>'enabled')::boolean,false) then raise exception 'activity tracking disabled'; end if;
 select value into activity from jsonb_array_elements(coalesce(cfg->'activities','[]'::jsonb)) where value->>'key'=requested_activity_key limit 1;
 if activity is null then raise exception 'unknown activity'; end if;
 insert into public.activity_tracking_days(job_type_id,user_id,work_date) values(requested_job_type_id,actor,(nowv at time zone 'Asia/Jerusalem')::date)
 on conflict(job_type_id,user_id,work_date) do update set status='active',ended_at=null,updated_at=now() returning * into d;
 update public.activity_tracking_segments set ended_at=nowv,updated_at=nowv where day_id=d.id and ended_at is null;
 insert into public.activity_tracking_segments(day_id,activity_key,activity_label,started_at) values(d.id,requested_activity_key,activity->>'label',nowv);
 return public.get_my_activity_tracking_context();
end $$;

create or replace function public.end_my_activity_day(requested_job_type_id uuid) returns jsonb language plpgsql security definer set search_path=public as $$
declare actor uuid:=auth.uid(); d public.activity_tracking_days%rowtype; nowv timestamptz:=now();
begin
 if actor is null then raise exception 'not authenticated'; end if;
 if not public.has_dynamic_job_type_permission('activity_tracking.use',requested_job_type_id,actor) then raise exception 'not allowed'; end if;
 select * into d from public.activity_tracking_days where job_type_id=requested_job_type_id and user_id=actor and work_date=(nowv at time zone 'Asia/Jerusalem')::date;
 if d.id is null then return public.get_my_activity_tracking_context(); end if;
 update public.activity_tracking_segments set ended_at=nowv,updated_at=nowv where day_id=d.id and ended_at is null;
 update public.activity_tracking_days set ended_at=nowv,status='ended',updated_at=nowv where id=d.id;
 return public.get_my_activity_tracking_context();
end $$;

create or replace function public.get_activity_tracking_week(requested_job_type_id uuid,requested_week_start date default null) returns jsonb language plpgsql security definer set search_path=public as $$
declare actor uuid:=auth.uid(); ws date:=coalesce(requested_week_start,date_trunc('week',(now() at time zone 'Asia/Jerusalem'))::date); result jsonb;
begin
 if actor is null then raise exception 'not authenticated'; end if;
 if not (public.has_dynamic_job_type_permission('activity_tracking.view_team',requested_job_type_id,actor) or exists(select 1 from public.job_type_memberships where job_type_id=requested_job_type_id and user_id=actor)) then raise exception 'not allowed'; end if;
 select jsonb_build_object('weekStart',ws,'weekEnd',ws+6,'rows',coalesce(jsonb_agg(row_to_json(x)),'[]'::jsonb)) into result from (
  select d.user_id as "userId",coalesce(p.schedule_name,p.display_name) as "displayName",d.work_date as "workDate",s.activity_key as "activityKey",s.activity_label as "activityLabel",
   round((extract(epoch from (coalesce(s.ended_at,now())-s.started_at))/3600.0)::numeric,2) as hours,s.id as "segmentId",s.started_at as "startedAt",s.ended_at as "endedAt",d.status
  from public.activity_tracking_days d join public.activity_tracking_segments s on s.day_id=d.id join public.profiles p on p.id=d.user_id
  where d.job_type_id=requested_job_type_id and d.work_date between ws and ws+6 order by d.work_date,s.started_at
 ) x;
 return result;
end $$;

create or replace function public.update_activity_tracking_segment(requested_segment_id uuid,requested_activity_key text,requested_started_at timestamptz,requested_ended_at timestamptz,requested_reason text) returns void language plpgsql security definer set search_path=public as $$
declare actor uuid:=auth.uid(); seg public.activity_tracking_segments%rowtype; jid uuid; cfg jsonb; activity jsonb;
begin
 select d.job_type_id into jid from public.activity_tracking_segments s join public.activity_tracking_days d on d.id=s.day_id where s.id=requested_segment_id;
 if actor is null or not public.has_dynamic_job_type_permission('activity_tracking.edit_team',jid,actor) then raise exception 'not allowed'; end if;
 select public.activity_tracking_config(jt) into cfg from public.job_types jt where jt.id=jid;
 select value into activity from jsonb_array_elements(coalesce(cfg->'activities','[]'::jsonb)) where value->>'key'=requested_activity_key limit 1;
 if activity is null or requested_ended_at is null or requested_ended_at<requested_started_at then raise exception 'invalid segment'; end if;
 update public.activity_tracking_segments set activity_key=requested_activity_key,activity_label=activity->>'label',started_at=requested_started_at,ended_at=requested_ended_at,edited_by=actor,edit_reason=nullif(trim(requested_reason),''),updated_at=now() where id=requested_segment_id;
 insert into public.audit_logs(action,actor_user_id,entity_type,entity_id,summary,metadata) values('system_event',actor,'activity_tracking_segment',requested_segment_id,'מקטע מעקב פעילות נערך',jsonb_build_object('reason',requested_reason));
end $$;

create or replace function public.process_activity_tracking_reminders() returns integer language plpgsql security definer set search_path=public as $$
declare r record; nid uuid; processed integer:=0;
begin
 for r in select d.*,jt.name,public.activity_tracking_config(jt) cfg from public.activity_tracking_days d join public.job_types jt on jt.id=d.job_type_id
  where d.status='active' and d.work_date=(now() at time zone 'Asia/Jerusalem')::date and coalesce((public.activity_tracking_config(jt)->>'reminderEnabled')::boolean,false)
    and (now() at time zone 'Asia/Jerusalem')::time >= coalesce((public.activity_tracking_config(jt)->>'reminderTime')::time,'20:00'::time)
    and not exists(select 1 from public.notifications n join public.notification_recipients nr on nr.notification_id=n.id where nr.user_id=d.user_id and n.source='activity_end_day_reminder' and n.data->>'dayId'=d.id::text)
 loop
  insert into public.notifications(type,priority,source,title,body,url,data,created_by,expires_at) values('manager_message','normal','activity_end_day_reminder','תזכורת לסיום יום – '||r.name,'יום העבודה עדיין פעיל. אם סיימת לעבוד, יש ללחוץ על „סיום יום”.','/',jsonb_build_object('kind','activity_end_day_reminder','dayId',r.id,'jobTypeId',r.job_type_id,'pushPending',true),null,now()+interval '1 day') returning id into nid;
  insert into public.notification_recipients(notification_id,user_id) values(nid,r.user_id) on conflict do nothing; processed:=processed+1;
 end loop;
 update public.activity_tracking_segments s set ended_at=s.started_at+interval '12 hours',updated_at=now() where s.ended_at is null and s.started_at<now()-interval '12 hours';
 update public.activity_tracking_days d set status='needs_review',ended_at=coalesce(ended_at,now()),updated_at=now() where d.status='active' and exists(select 1 from public.activity_tracking_segments s where s.day_id=d.id and s.ended_at is not null and s.updated_at>now()-interval '2 minutes');
 return processed;
end $$;

grant execute on function public.get_my_activity_tracking_context() to authenticated;
grant execute on function public.switch_my_activity(uuid,text) to authenticated;
grant execute on function public.end_my_activity_day(uuid) to authenticated;
grant execute on function public.get_activity_tracking_week(uuid,date) to authenticated;
grant execute on function public.update_activity_tracking_segment(uuid,text,timestamptz,timestamptz,text) to authenticated;
revoke all on function public.process_activity_tracking_reminders() from public,anon,authenticated;
do $$ begin if exists(select 1 from pg_extension where extname='pg_cron') then perform cron.unschedule(jobid) from cron.job where jobname='process-activity-tracking-reminders'; perform cron.schedule('process-activity-tracking-reminders','23 * * * *','select public.process_activity_tracking_reminders();'); end if; exception when others then raise notice 'activity reminder cron skipped: %',sqlerrm; end $$;
commit;
