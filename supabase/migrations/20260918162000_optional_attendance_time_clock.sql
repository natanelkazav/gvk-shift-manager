-- קובץ: supabase/migrations/20260918162000_optional_attendance_time_clock.sql
-- מטרה: הגדרת פעולות מסד נתונים עבור נוכחות / זמן.
-- מטרות עיקריות:
-- - הגדרת פונקציות: public.get_dynamic_job_type_active_features, public.attendance_distance_m, public.get_my_attendance_workspace, public.clock_my_attendance, public.get_dynamic_attendance_statistics, public.get_dynamic_statistics_job_types.
-- - מבני טבלאות: public.attendance_sessions.
-- - סדר הפקודות, התנאים וההרשאות בקובץ נשמר כפי שהיה במקור.
begin;

-- הגדרת מבנה הטבלה public.attendance_sessions והאילוצים המופיעים בהמשך.
create table if not exists public.attendance_sessions (
  id uuid primary key default gen_random_uuid(),
  job_type_id uuid not null references public.job_types(id) on delete restrict,
  user_id uuid not null references public.profiles(id) on delete restrict,
  assignment_id uuid references public.dynamic_schedule_published_assignments(id) on delete set null,
  work_date date not null,
  clock_in_at timestamptz not null,
  clock_in_lat double precision,
  clock_in_lng double precision,
  clock_in_accuracy_m numeric,
  clock_in_distance_m numeric,
  clock_in_within_radius boolean,
  clock_out_at timestamptz,
  clock_out_lat double precision,
  clock_out_lng double precision,
  clock_out_accuracy_m numeric,
  clock_out_distance_m numeric,
  clock_out_within_radius boolean,
  hourly_rate_snapshot numeric,
  source text not null default 'pwa' check (source in ('pwa','manager')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (clock_out_at is null or clock_out_at >= clock_in_at)
);
-- הגדרת האינדקס attendance_one_open_session_per_user_job עבור העמודות והתנאים המפורטים בפקודה.
create unique index if not exists attendance_one_open_session_per_user_job
  on public.attendance_sessions(user_id,job_type_id) where clock_out_at is null;
-- הגדרת האינדקס attendance_sessions_job_date_idx עבור העמודות והתנאים המפורטים בפקודה.
create index if not exists attendance_sessions_job_date_idx on public.attendance_sessions(job_type_id,work_date,user_id);
-- עדכון מבנה או הגדרות הטבלה public.attendance_sessions.
alter table public.attendance_sessions enable row level security;
-- הסרת ההרשאות המפורטות בפקודה מהתפקידים המצוינים בה.
revoke all on public.attendance_sessions from anon, authenticated;

-- הוספת רשומות ל־public.dynamic_permission_manifest בהתאם לקלט ולתנאים להלן.
insert into public.dynamic_permission_manifest(feature_key,permission_key,audience,label,description,default_enabled,sort_order)
values
 ('attendance','attendance.clock','member','דיווח כניסה ויציאה','מאפשר לעובד לדווח כניסה ויציאה עם מיקום בעת הלחיצה.',true,10),
 ('attendance','attendance.view_team','manager','צפייה בנוכחות התפקיד','מאפשר צפייה בדוחות נוכחות ומיקומי כניסה/יציאה של עובדי התפקיד.',true,20),
 ('attendance','attendance.edit','manager','תיקון דיווחי נוכחות','מאפשר תיקון ידני של דיווחי נוכחות תוך שמירת Audit Log.',false,30)
on conflict(feature_key,permission_key,audience) do update set
 label=excluded.label,description=excluded.description,sort_order=excluded.sort_order;

-- פונקציית מסד public.get_dynamic_job_type_active_features: שליפה או חישוב של סוג תפקיד.
create or replace function public.get_dynamic_job_type_active_features(requested_job_type_id uuid)
returns text[] language plpgsql stable security definer set search_path=public as $$
declare jt public.job_types%rowtype; features text[]:=array[]::text[]; change_mode text;
begin
 select * into jt from public.job_types where id=requested_job_type_id;
 -- הסתעפות לפי התנאי not found then return array[]::text[]; end if;.
 if not found then return array[]::text[]; end if;
 -- הסתעפות לפי התנאי coalesce(jt.scheduling_strategy,'availability_optimizer')<>'none'.
 if coalesce(jt.scheduling_strategy,'availability_optimizer')<>'none' then
   features:=array_append(features,'schedule');
   -- הסתעפות לפי התנאי coalesce((jt.availability_config->>'enabled')::boolean,false) then features:=array_append(features,'availability'); end .
   if coalesce((jt.availability_config->>'enabled')::boolean,false) then features:=array_append(features,'availability'); end if;
   change_mode:=coalesce(jt.scheduling_config->>'scheduleChangeMode','none');
   -- הסתעפות לפי התנאי change_mode='shift_exchange' then features:=array_append(features,'shift_exchange'); elsif change_mode='self_edit' then .
   if change_mode='shift_exchange' then features:=array_append(features,'shift_exchange'); elsif change_mode='self_edit' then features:=array_append(features,'self_edit'); end if;
   -- הסתעפות לפי התנאי jt.scheduling_strategy='monthly_rotation_constraints' then features:=array_append(features,'monthly_rotation'); end if;.
   if jt.scheduling_strategy='monthly_rotation_constraints' then features:=array_append(features,'monthly_rotation'); end if;
 end if;
 -- הסתעפות לפי התנאי coalesce((jt.statistics_config->>'enabled')::boolean,false) then features:=array_append(features,'statistics'); end if;.
 if coalesce((jt.statistics_config->>'enabled')::boolean,false) then features:=array_append(features,'statistics'); end if;
 -- הסתעפות לפי התנאי coalesce(jt.pay_model,'none')<>'none' then features:=array_append(features,'payroll'); end if;.
 if coalesce(jt.pay_model,'none')<>'none' then features:=array_append(features,'payroll'); end if;
 -- הסתעפות לפי התנאי coalesce((jt.scheduling_config#>>'{attendance,enabled}')::boolean,false) then features:=array_append(features,'attendanc.
 if coalesce((jt.scheduling_config#>>'{attendance,enabled}')::boolean,false) then features:=array_append(features,'attendance'); end if;
 -- הסתעפות לפי התנאי exists(select 1 from public.job_type_capabilities c where c.job_type_id=jt.id and c.capability_key='daily_reports' and c.
 if exists(select 1 from public.job_type_capabilities c where c.job_type_id=jt.id and c.capability_key='daily_reports' and c.enabled=true)
    or coalesce((jt.scheduling_config#>>'{dailyReports,enabled}')::boolean,false) then features:=array_append(features,'daily_reports'); end if;
 return coalesce((select array_agg(distinct x order by x) from unnest(features)x),array[]::text[]);
end; $$;

-- פונקציית מסד public.attendance_distance_m: נוכחות.
create or replace function public.attendance_distance_m(lat1 double precision,lng1 double precision,lat2 double precision,lng2 double precision)
returns numeric language sql immutable set search_path='' as $$
 select case when lat1 is null or lng1 is null or lat2 is null or lng2 is null then null else
 round((6371000 * 2 * asin(sqrt(power(sin(radians(lat2-lat1)/2),2)+cos(radians(lat1))*cos(radians(lat2))*power(sin(radians(lng2-lng1)/2),2))))::numeric,1) end;
$$;

-- פונקציית מסד public.get_my_attendance_workspace: שליפה או חישוב של נוכחות.
create or replace function public.get_my_attendance_workspace()
returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); now_local timestamp:=now() at time zone 'Asia/Jerusalem';
begin
 -- הסתעפות לפי התנאי uid is null then raise exception 'not authenticated'; end if;.
 if uid is null then raise exception 'not authenticated'; end if;
 -- הרכבת תוצאת הפעולה והחזרתה לקורא.
 return jsonb_build_object('roles',coalesce((
   select jsonb_agg(jsonb_build_object(
     'jobTypeId',jt.id,'jobTypeName',jt.name,'config',jt.scheduling_config->'attendance',
     'openSession',case when os.id is null then null else jsonb_build_object('id',os.id,'clockInAt',os.clock_in_at,'clockInDistanceM',os.clock_in_distance_m,'clockInWithinRadius',os.clock_in_within_radius) end,
     'currentAssignment',case when ca.id is null then null else jsonb_build_object('id',ca.id,'shiftDate',ca.shift_date,'shiftName',ca.shift_name,'startTime',ca.start_time,'endTime',ca.end_time) end
   ) order by jt.name)
   from public.job_types jt
   join public.job_type_memberships m on m.job_type_id=jt.id and m.user_id=uid
   left join lateral(select s.* from public.attendance_sessions s where s.job_type_id=jt.id and s.user_id=uid and s.clock_out_at is null order by s.clock_in_at desc limit 1) os on true
   left join lateral(
     select a.* from public.dynamic_schedule_publications p join public.dynamic_schedule_published_assignments a on a.publication_id=p.id
     cross join lateral public.dynamic_resolve_assignment_local_interval(a.shift_date,a.start_time,a.end_time,coalesce(jt.scheduling_config#>>'{shiftPattern,workMode}','shifts'),jt.scheduling_config) iv
     where p.job_type_id=jt.id and p.status='published' and a.user_id=uid and now_local between iv.start_at-interval '4 hours' and iv.end_at+interval '4 hours'
     order by abs(extract(epoch from(now_local-iv.start_at))) limit 1
   ) ca on true
   where jt.is_active=true and coalesce((jt.scheduling_config#>>'{attendance,enabled}')::boolean,false)
     and public.has_dynamic_job_type_permission('attendance.clock',jt.id,uid)
 ),'[]'::jsonb));
end; $$;

-- פונקציית מסד public.clock_my_attendance: נוכחות.
create or replace function public.clock_my_attendance(requested_job_type_id uuid,requested_action text,requested_lat double precision,requested_lng double precision,requested_accuracy_m numeric default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); jt public.job_types%rowtype; cfg jsonb; radius numeric; site_lat double precision; site_lng double precision; dist numeric; within_radius boolean; sess public.attendance_sessions%rowtype; assignment_id uuid; local_date date:=(now() at time zone 'Asia/Jerusalem')::date; allow_unscheduled boolean; outside_policy text; rate numeric;
begin
 -- הסתעפות לפי התנאי uid is null then raise exception 'not authenticated'; end if;.
 if uid is null then raise exception 'not authenticated'; end if;
 select * into jt from public.job_types where id=requested_job_type_id;
 -- הסתעפות לפי התנאי jt.id is null or not coalesce((jt.scheduling_config#>>'{attendance,enabled}')::boolean,false) then raise exception 'atte.
 if jt.id is null or not coalesce((jt.scheduling_config#>>'{attendance,enabled}')::boolean,false) then raise exception 'attendance disabled'; end if;
 -- הסתעפות לפי התנאי not public.has_dynamic_job_type_permission('attendance.clock',jt.id,uid) then raise exception 'not allowed'; end if;.
 if not public.has_dynamic_job_type_permission('attendance.clock',jt.id,uid) then raise exception 'not allowed'; end if;
 cfg:=jt.scheduling_config->'attendance'; site_lat:=nullif(cfg->>'latitude','')::double precision; site_lng:=nullif(cfg->>'longitude','')::double precision; radius:=coalesce(nullif(cfg->>'radiusMeters','')::numeric,150); allow_unscheduled:=coalesce((cfg->>'allowUnscheduled')::boolean,false); outside_policy:=coalesce(cfg->>'outsidePolicy','flag');
 -- הסתעפות לפי התנאי coalesce((cfg->>'requireLocation')::boolean,true) and (requested_lat is null or requested_lng is null) then raise except.
 if coalesce((cfg->>'requireLocation')::boolean,true) and (requested_lat is null or requested_lng is null) then raise exception 'location required'; end if;
 dist:=public.attendance_distance_m(requested_lat,requested_lng,site_lat,site_lng); within_radius:=case when dist is null then null else dist<=radius end;
 -- הסתעפות לפי התנאי outside_policy='block' and within_radius=false then raise exception 'outside allowed workplace radius'; end if;.
 if outside_policy='block' and within_radius=false then raise exception 'outside allowed workplace radius'; end if;
 -- הסתעפות לפי התנאי requested_action='in'.
 if requested_action='in' then
   -- הסתעפות לפי התנאי exists(select 1 from public.attendance_sessions s where s.user_id=uid and s.job_type_id=jt.id and s.clock_out_at is null.
   if exists(select 1 from public.attendance_sessions s where s.user_id=uid and s.job_type_id=jt.id and s.clock_out_at is null) then raise exception 'already clocked in'; end if;
   select a.id into assignment_id from public.dynamic_schedule_publications p join public.dynamic_schedule_published_assignments a on a.publication_id=p.id
   cross join lateral public.dynamic_resolve_assignment_local_interval(a.shift_date,a.start_time,a.end_time,coalesce(jt.scheduling_config#>>'{shiftPattern,workMode}','shifts'),jt.scheduling_config) iv
   where p.job_type_id=jt.id and p.status='published' and a.user_id=uid and (now() at time zone 'Asia/Jerusalem') between iv.start_at-interval '4 hours' and iv.end_at+interval '4 hours' order by abs(extract(epoch from((now() at time zone 'Asia/Jerusalem')-iv.start_at))) limit 1;
   -- הסתעפות לפי התנאי assignment_id is null and not allow_unscheduled then raise exception 'no scheduled shift near current time'; end if;.
   if assignment_id is null and not allow_unscheduled then raise exception 'no scheduled shift near current time'; end if;
   select p.hourly_rate into rate from public.profiles p where p.id=uid;
   -- הוספת רשומות ל־public.attendance_sessions בהתאם לקלט ולתנאים להלן.
   insert into public.attendance_sessions(job_type_id,user_id,assignment_id,work_date,clock_in_at,clock_in_lat,clock_in_lng,clock_in_accuracy_m,clock_in_distance_m,clock_in_within_radius,hourly_rate_snapshot)
   values(jt.id,uid,assignment_id,local_date,now(),requested_lat,requested_lng,requested_accuracy_m,dist,within_radius,rate) returning * into sess;
 elsif requested_action='out' then
   select * into sess from public.attendance_sessions s where s.user_id=uid and s.job_type_id=jt.id and s.clock_out_at is null order by s.clock_in_at desc limit 1 for update;
   -- הסתעפות לפי התנאי sess.id is null then raise exception 'no open attendance session'; end if;.
   if sess.id is null then raise exception 'no open attendance session'; end if;
   -- עדכון רשומות ב־public.attendance_sessions בהתאם לקלט ולתנאים להלן.
   update public.attendance_sessions set clock_out_at=now(),clock_out_lat=requested_lat,clock_out_lng=requested_lng,clock_out_accuracy_m=requested_accuracy_m,clock_out_distance_m=dist,clock_out_within_radius=within_radius,updated_at=now() where id=sess.id returning * into sess;
 else raise exception 'invalid attendance action'; end if;
 -- הוספת רשומות ל־public.audit_logs בהתאם לקלט ולתנאים להלן.
 insert into public.audit_logs(action,actor_user_id,entity_type,entity_id,summary,metadata) values('system_event',uid,'attendance_session',sess.id,case when requested_action='in' then 'דיווח כניסה' else 'דיווח יציאה' end,jsonb_build_object('job_type_id',jt.id,'distance_m',dist,'within_radius',within_radius));
 -- הרכבת תוצאת הפעולה והחזרתה לקורא.
 return jsonb_build_object('id',sess.id,'action',requested_action,'distanceM',dist,'withinRadius',within_radius,'clockInAt',sess.clock_in_at,'clockOutAt',sess.clock_out_at);
end; $$;

-- פונקציית מסד public.get_dynamic_attendance_statistics: שליפה או חישוב של דינמי / נוכחות / סטטיסטיקה.
create or replace function public.get_dynamic_attendance_statistics(requested_job_type_id uuid,requested_years integer[] default null,requested_months integer[] default null,requested_user_ids uuid[] default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid();
begin
 -- הסתעפות לפי התנאי uid is null then raise exception 'not authenticated'; end if;.
 if uid is null then raise exception 'not authenticated'; end if;
 -- הסתעפות לפי התנאי not (public.has_dynamic_job_type_permission('attendance.view_team',requested_job_type_id,uid) or public.has_dynamic_job_.
 if not (public.has_dynamic_job_type_permission('attendance.view_team',requested_job_type_id,uid) or public.has_dynamic_job_type_permission('statistics.view_job_type',requested_job_type_id,uid) or exists(select 1 from public.user_permissions up where up.user_id=uid and up.permission_key in('statistics.view','users.manage'))) then raise exception 'not allowed'; end if;
 -- הרכבת תוצאת הפעולה והחזרתה לקורא.
 return jsonb_build_object('rows',coalesce((select jsonb_agg(jsonb_build_object(
   'id',s.id,'userId',s.user_id,'displayName',p.display_name,'scheduleName',p.schedule_name,'workDate',s.work_date,
   'clockInAt',s.clock_in_at,'clockInLat',s.clock_in_lat,'clockInLng',s.clock_in_lng,'clockInDistanceM',s.clock_in_distance_m,'clockInWithinRadius',s.clock_in_within_radius,
   'clockOutAt',s.clock_out_at,'clockOutLat',s.clock_out_lat,'clockOutLng',s.clock_out_lng,'clockOutDistanceM',s.clock_out_distance_m,'clockOutWithinRadius',s.clock_out_within_radius,
   'workedHours',case when s.clock_out_at is null then null else round((extract(epoch from(s.clock_out_at-s.clock_in_at))/3600)::numeric,2) end,
   'hourlyRate',s.hourly_rate_snapshot,'wage',case when s.clock_out_at is null or s.hourly_rate_snapshot is null then null else round((extract(epoch from(s.clock_out_at-s.clock_in_at))/3600*s.hourly_rate_snapshot)::numeric,2) end
 ) order by s.work_date desc,s.clock_in_at desc) from public.attendance_sessions s join public.profiles p on p.id=s.user_id where s.job_type_id=requested_job_type_id
 and(requested_years is null or cardinality(requested_years)=0 or extract(year from s.work_date)::int=any(requested_years))
 and(requested_months is null or cardinality(requested_months)=0 or extract(month from s.work_date)::int=any(requested_months))
 and(requested_user_ids is null or cardinality(requested_user_ids)=0 or s.user_id=any(requested_user_ids))),'[]'::jsonb));
end; $$;

-- הקצאת ההרשאות המפורטות בפקודה לתפקידים המצוינים בה.
grant execute on function public.get_my_attendance_workspace() to authenticated;
-- הקצאת ההרשאות המפורטות בפקודה לתפקידים המצוינים בה.
grant execute on function public.clock_my_attendance(uuid,text,double precision,double precision,numeric) to authenticated;
-- הקצאת ההרשאות המפורטות בפקודה לתפקידים המצוינים בה.
grant execute on function public.get_dynamic_attendance_statistics(uuid,integer[],integer[],uuid[]) to authenticated;
commit;

begin;
-- פונקציית מסד public.get_dynamic_statistics_job_types: שליפה או חישוב של סוגי תפקידים.
create or replace function public.get_dynamic_statistics_job_types()
returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid();
begin
 -- הסתעפות לפי התנאי uid is null then raise exception 'not authenticated'; end if;.
 if uid is null then raise exception 'not authenticated'; end if;
 -- הסתעפות לפי התנאי not exists(select 1 from public.user_permissions up where up.user_id=uid and up.permission_key in('statistics.view','use.
 if not exists(select 1 from public.user_permissions up where up.user_id=uid and up.permission_key in('statistics.view','users.manage')) then raise exception 'not allowed'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('jobTypeId',jt.id,'name',jt.name,'code',jt.code,'isActive',jt.is_active,'payModel',jt.pay_model,'workMode',coalesce(nullif(jt.scheduling_config#>>'{shiftPattern,workMode}',''),nullif(jt.scheduling_config->>'workMode','')),'availabilityEnabled',coalesce((jt.availability_config->>'enabled')::boolean,false),'attendanceEnabled',coalesce((jt.scheduling_config#>>'{attendance,enabled}')::boolean,false),'memberCount',(select count(*) from public.job_type_memberships m join public.profiles p on p.id=m.user_id where m.job_type_id=jt.id and p.is_active=true),'payrollEnabled',coalesce(jt.pay_model,'none')<>'none','dataPeriodCount',(select count(*) from(select p.year,p.month from public.dynamic_schedule_publications p where p.job_type_id=jt.id union select hp.year,hp.month from public.dynamic_historical_periods hp where hp.job_type_id=jt.id)q)) order by jt.name) from public.job_types jt where jt.is_active=true and coalesce((jt.statistics_config->>'enabled')::boolean,false)=true),'[]'::jsonb);
end; $$;
-- הקצאת ההרשאות המפורטות בפקודה לתפקידים המצוינים בה.
grant execute on function public.get_dynamic_statistics_job_types() to authenticated;
commit;
