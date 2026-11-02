-- קובץ: supabase/migrations/20260922123000_attendance_manager_edits_and_overdue_alerts.sql
-- מטרה: הגדרת פעולות מסד נתונים עבור נוכחות.
-- מטרות עיקריות:
-- - הגדרת פונקציות: public.update_attendance_session_by_manager, public.process_overdue_attendance_exits, public.get_dynamic_attendance_statistics, public.get_dynamic_archive_periods.
-- - מבני טבלאות: public.attendance_sessions, public.attendance_session_edits.
-- - סדר הפקודות, התנאים וההרשאות בקובץ נשמר כפי שהיה במקור.
begin;

-- עדכון מבנה או הגדרות הטבלה public.attendance_sessions.
alter table public.attendance_sessions
  add column if not exists clock_in_edited_by uuid references public.profiles(id) on delete set null,
  add column if not exists clock_in_edited_at timestamptz,
  add column if not exists clock_out_edited_by uuid references public.profiles(id) on delete set null,
  add column if not exists clock_out_edited_at timestamptz,
  add column if not exists overdue_exit_notified_at timestamptz;

-- הגדרת מבנה הטבלה public.attendance_session_edits והאילוצים המופיעים בהמשך.
create table if not exists public.attendance_session_edits (
  id uuid primary key default gen_random_uuid(),
  attendance_session_id uuid not null references public.attendance_sessions(id) on delete cascade,
  edited_by uuid not null references public.profiles(id) on delete restrict,
  field_name text not null check (field_name in ('clock_in_at','clock_out_at')),
  old_value timestamptz,
  new_value timestamptz,
  reason text,
  created_at timestamptz not null default now()
);
-- הגדרת האינדקס attendance_session_edits_session_idx עבור העמודות והתנאים המפורטים בפקודה.
create index if not exists attendance_session_edits_session_idx on public.attendance_session_edits(attendance_session_id,created_at desc);
-- עדכון מבנה או הגדרות הטבלה public.attendance_session_edits.
alter table public.attendance_session_edits enable row level security;
-- הסרת ההרשאות המפורטות בפקודה מהתפקידים המצוינים בה.
revoke all on public.attendance_session_edits from anon, authenticated;

-- הוספת רשומות ל־public.dynamic_permission_manifest בהתאם לקלט ולתנאים להלן.
insert into public.dynamic_permission_manifest(feature_key,permission_key,audience,label,description,default_enabled,sort_order)
values
 ('attendance','attendance.edit_team','manager','עריכת נוכחות התפקיד','מאפשר לתקן זמני כניסה ויציאה של עובדי התפקיד. כל תיקון נשמר ביומן שינויים.',false,30),
 ('attendance','attendance.edit_archived','manager','עריכת נוכחות בארכיון','מאפשר תיקון חריג של דיווחי נוכחות מחודשים קודמים. כל תיקון נשמר ביומן שינויים.',false,40)
on conflict(feature_key,permission_key,audience) do update set label=excluded.label,description=excluded.description,sort_order=excluded.sort_order;

-- פונקציית מסד public.update_attendance_session_by_manager: עדכון נוכחות / סשן.
create or replace function public.update_attendance_session_by_manager(
  requested_session_id uuid,
  requested_clock_in_at timestamptz,
  requested_clock_out_at timestamptz,
  requested_reason text default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  uid uuid:=auth.uid(); s public.attendance_sessions%rowtype; is_archived boolean;
begin
  -- הסתעפות לפי התנאי uid is null then raise exception 'not authenticated'; end if;.
  if uid is null then raise exception 'not authenticated'; end if;
  select * into s from public.attendance_sessions where id=requested_session_id for update;
  -- הסתעפות לפי התנאי s.id is null then raise exception 'attendance session not found'; end if;.
  if s.id is null then raise exception 'attendance session not found'; end if;
  -- הסתעפות לפי התנאי not public.has_dynamic_job_type_permission('attendance.edit_team',s.job_type_id,uid) then raise exception 'not allowed';.
  if not public.has_dynamic_job_type_permission('attendance.edit_team',s.job_type_id,uid) then raise exception 'not allowed'; end if;
  is_archived := s.work_date < date_trunc('month', now() at time zone 'Asia/Jerusalem')::date;
  -- הסתעפות לפי התנאי is_archived and not public.has_dynamic_job_type_permission('attendance.edit_archived',s.job_type_id,uid) then raise exce.
  if is_archived and not public.has_dynamic_job_type_permission('attendance.edit_archived',s.job_type_id,uid) then raise exception 'archived attendance is locked'; end if;
  -- הסתעפות לפי התנאי requested_clock_in_at is null then raise exception 'clock in is required'; end if;.
  if requested_clock_in_at is null then raise exception 'clock in is required'; end if;
  -- הסתעפות לפי התנאי requested_clock_out_at is not null and requested_clock_out_at < requested_clock_in_at then raise exception 'clock out ca.
  if requested_clock_out_at is not null and requested_clock_out_at < requested_clock_in_at then raise exception 'clock out cannot be before clock in'; end if;

  -- הסתעפות לפי התנאי requested_clock_in_at is distinct from s.clock_in_at.
  if requested_clock_in_at is distinct from s.clock_in_at then
    -- הוספת רשומות ל־public.attendance_session_edits בהתאם לקלט ולתנאים להלן.
    insert into public.attendance_session_edits(attendance_session_id,edited_by,field_name,old_value,new_value,reason)
    values(s.id,uid,'clock_in_at',s.clock_in_at,requested_clock_in_at,nullif(trim(requested_reason),''));
    -- עדכון רשומות ב־public.attendance_sessions בהתאם לקלט ולתנאים להלן.
    update public.attendance_sessions set clock_in_at=requested_clock_in_at,clock_in_edited_by=uid,clock_in_edited_at=now(),updated_at=now() where id=s.id;
  end if;
  -- הסתעפות לפי התנאי requested_clock_out_at is distinct from s.clock_out_at.
  if requested_clock_out_at is distinct from s.clock_out_at then
    -- הוספת רשומות ל־public.attendance_session_edits בהתאם לקלט ולתנאים להלן.
    insert into public.attendance_session_edits(attendance_session_id,edited_by,field_name,old_value,new_value,reason)
    values(s.id,uid,'clock_out_at',s.clock_out_at,requested_clock_out_at,nullif(trim(requested_reason),''));
    -- עדכון רשומות ב־public.attendance_sessions בהתאם לקלט ולתנאים להלן.
    update public.attendance_sessions set clock_out_at=requested_clock_out_at,clock_out_edited_by=uid,clock_out_edited_at=now(),updated_at=now() where id=s.id;
  end if;

  -- הוספת רשומות ל־public.audit_logs בהתאם לקלט ולתנאים להלן.
  insert into public.audit_logs(action,actor_user_id,entity_type,entity_id,summary,metadata)
  values('system_event',uid,'attendance_session',s.id,'תיקון דיווח נוכחות על ידי מנהל',jsonb_build_object('job_type_id',s.job_type_id,'reason',requested_reason));
  -- הרכבת תוצאת הפעולה והחזרתה לקורא.
  return jsonb_build_object('ok',true,'id',s.id);
end; $$;
-- הסרת ההרשאות המפורטות בפקודה מהתפקידים המצוינים בה.
revoke all on function public.update_attendance_session_by_manager(uuid,timestamptz,timestamptz,text) from public;
-- הקצאת ההרשאות המפורטות בפקודה לתפקידים המצוינים בה.
grant execute on function public.update_attendance_session_by_manager(uuid,timestamptz,timestamptz,text) to authenticated;

-- פונקציית מסד public.process_overdue_attendance_exits: נוכחות.
create or replace function public.process_overdue_attendance_exits()
returns jsonb language plpgsql security definer set search_path='' as $$
declare r record; notification_id uuid; recipient_count integer; processed integer:=0;
begin
  -- מעבר על תוצאות השאילתה או האוסף ועיבוד כל רשומה בנפרד.
  for r in
    select s.id,s.job_type_id,s.user_id,s.clock_in_at,jt.name as job_type_name,coalesce(nullif(p.schedule_name,''),nullif(p.display_name,''),p.email,'עובד') as employee_name
    from public.attendance_sessions s
    join public.job_types jt on jt.id=s.job_type_id
    join public.profiles p on p.id=s.user_id
    where s.clock_out_at is null and s.clock_in_at <= now()-interval '12 hours' and s.overdue_exit_notified_at is null
    for update of s skip locked
  loop
    -- הוספת רשומות ל־public.notifications בהתאם לקלט ולתנאים להלן.
    insert into public.notifications(type,priority,source,title,body,url,data,created_by,expires_at)
    values('attendance_missing_exit','important','attendance','לא בוצעה יציאה מהמשמרת',concat(r.employee_name,' לא ביצע/ה יציאה במשך יותר מ-12 שעות בתפקיד ',r.job_type_name,'.'),'/statistics',jsonb_build_object('jobTypeId',r.job_type_id,'attendanceSessionId',r.id,'userId',r.user_id),null,now()+interval '90 days')
    returning id into notification_id;

    -- הוספת רשומות ל־public.notification_recipients בהתאם לקלט ולתנאים להלן.
    insert into public.notification_recipients(notification_id,user_id)
    select distinct notification_id,m.user_id
    from public.job_type_memberships m join public.profiles p on p.id=m.user_id and p.is_active=true
    where m.job_type_id=r.job_type_id and (
      public.has_dynamic_job_type_permission('attendance.view_team',r.job_type_id,m.user_id)
      or public.has_dynamic_job_type_permission('attendance.edit_team',r.job_type_id,m.user_id)
    );
    get diagnostics recipient_count=row_count;
    -- הסתעפות לפי התנאי recipient_count=0 then delete from public.notifications where id=notification_id; end if;.
    if recipient_count=0 then delete from public.notifications where id=notification_id; end if;
    -- עדכון רשומות ב־public.attendance_sessions בהתאם לקלט ולתנאים להלן.
    update public.attendance_sessions set overdue_exit_notified_at=now(),updated_at=now() where id=r.id;
    processed:=processed+1;
  end loop;
  -- הרכבת תוצאת הפעולה והחזרתה לקורא.
  return jsonb_build_object('processed',processed);
end; $$;
-- הסרת ההרשאות המפורטות בפקודה מהתפקידים המצוינים בה.
revoke all on function public.process_overdue_attendance_exits() from public;
-- הקצאת ההרשאות המפורטות בפקודה לתפקידים המצוינים בה.
grant execute on function public.process_overdue_attendance_exits() to authenticated;

-- If pg_cron is available in the project, run the overdue check every hour. Safe to re-run.
do $$
begin
  -- הסתעפות לפי התנאי exists(select 1 from pg_extension where extname='pg_cron').
  if exists(select 1 from pg_extension where extname='pg_cron') then
    begin execute $cron$select cron.unschedule('process-overdue-attendance-exits')$cron$; exception when others then null; end;
    execute $cron$select cron.schedule('process-overdue-attendance-exits','5 * * * *','select public.process_overdue_attendance_exits();')$cron$;
  end if;
end $$;

-- פונקציית מסד public.get_dynamic_attendance_statistics: שליפה או חישוב של דינמי / נוכחות / סטטיסטיקה.
create or replace function public.get_dynamic_attendance_statistics(requested_job_type_id uuid,requested_years integer[] default null,requested_months integer[] default null,requested_user_ids uuid[] default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); can_edit boolean; can_edit_archived boolean;
begin
 -- הסתעפות לפי התנאי uid is null then raise exception 'not authenticated'; end if;.
 if uid is null then raise exception 'not authenticated'; end if;
 -- הסתעפות לפי התנאי not (public.has_dynamic_job_type_permission('attendance.view_team',requested_job_type_id,uid) or public.has_dynamic_job_.
 if not (public.has_dynamic_job_type_permission('attendance.view_team',requested_job_type_id,uid) or public.has_dynamic_job_type_permission('statistics.view_job_type',requested_job_type_id,uid) or exists(select 1 from public.user_permissions up where up.user_id=uid and up.permission_key in('statistics.view','users.manage'))) then raise exception 'not allowed'; end if;
 can_edit:=public.has_dynamic_job_type_permission('attendance.edit_team',requested_job_type_id,uid);
 can_edit_archived:=public.has_dynamic_job_type_permission('attendance.edit_archived',requested_job_type_id,uid);
 -- הרכבת תוצאת הפעולה והחזרתה לקורא.
 return jsonb_build_object('rows',coalesce((select jsonb_agg(jsonb_build_object(
   'id',s.id,'userId',s.user_id,'displayName',p.display_name,'scheduleName',p.schedule_name,'workDate',s.work_date,
   'clockInAt',s.clock_in_at,'clockInLat',case when s.clock_in_edited_at is null then s.clock_in_lat else null end,'clockInLng',case when s.clock_in_edited_at is null then s.clock_in_lng else null end,'clockInDistanceM',case when s.clock_in_edited_at is null then s.clock_in_distance_m else null end,'clockInWithinRadius',case when s.clock_in_edited_at is null then s.clock_in_within_radius else null end,
   'clockOutAt',s.clock_out_at,'clockOutLat',case when s.clock_out_edited_at is null then s.clock_out_lat else null end,'clockOutLng',case when s.clock_out_edited_at is null then s.clock_out_lng else null end,'clockOutDistanceM',case when s.clock_out_edited_at is null then s.clock_out_distance_m else null end,'clockOutWithinRadius',case when s.clock_out_edited_at is null then s.clock_out_within_radius else null end,
   'clockInEdited',s.clock_in_edited_at is not null,'clockOutEdited',s.clock_out_edited_at is not null,
   'missingExit',s.clock_out_at is null and s.clock_in_at <= now()-interval '12 hours',
   'archived',s.work_date < date_trunc('month',now() at time zone 'Asia/Jerusalem')::date,
   'canEdit',can_edit and (s.work_date >= date_trunc('month',now() at time zone 'Asia/Jerusalem')::date or can_edit_archived),
   'workedHours',case when s.clock_out_at is null then null else round((extract(epoch from(s.clock_out_at-s.clock_in_at))/3600)::numeric,2) end,
   'hourlyRate',s.hourly_rate_snapshot,'wage',case when s.clock_out_at is null or s.hourly_rate_snapshot is null then null else round((extract(epoch from(s.clock_out_at-s.clock_in_at))/3600*s.hourly_rate_snapshot)::numeric,2) end
 ) order by s.work_date desc,s.clock_in_at desc) from public.attendance_sessions s join public.profiles p on p.id=s.user_id where s.job_type_id=requested_job_type_id
 and(requested_years is null or cardinality(requested_years)=0 or extract(year from s.work_date)::int=any(requested_years))
 and(requested_months is null or cardinality(requested_months)=0 or extract(month from s.work_date)::int=any(requested_months))
 and(requested_user_ids is null or cardinality(requested_user_ids)=0 or s.user_id=any(requested_user_ids))),'[]'::jsonb));
end; $$;
-- הקצאת ההרשאות המפורטות בפקודה לתפקידים המצוינים בה.
grant execute on function public.get_dynamic_attendance_statistics(uuid,integer[],integer[],uuid[]) to authenticated;


-- פונקציית מסד public.get_dynamic_archive_periods: שליפה או חישוב של דינמי / ארכיון / תקופות.
create or replace function public.get_dynamic_archive_periods()
returns jsonb language plpgsql security definer set search_path='' as $function$
declare v_actor uuid:=auth.uid();
begin
 -- הסתעפות לפי התנאי v_actor is null then raise exception 'not authenticated'; end if;.
 if v_actor is null then raise exception 'not authenticated'; end if;
 -- הסתעפות לפי התנאי not (exists(select 1 from public.user_permissions up where up.user_id=v_actor and up.permission_key in ('users.view','us.
 if not (exists(select 1 from public.user_permissions up where up.user_id=v_actor and up.permission_key in ('users.view','users.manage')) or exists(select 1 from public.job_type_managers jm where jm.user_id=v_actor)) then raise exception 'not allowed'; end if;
 -- הרכבת תוצאת הפעולה והחזרתה לקורא.
 return jsonb_build_object('generatedAt',now(),'periods',coalesce((
  with months as (
   select p.year,p.month from public.dynamic_schedule_publications p where make_date(p.year,p.month,1)<date_trunc('month',timezone('Asia/Jerusalem',now()))::date
   union select extract(year from s.work_date)::int,extract(month from s.work_date)::int from public.attendance_sessions s where s.work_date<date_trunc('month',timezone('Asia/Jerusalem',now()))::date
   union select r.year,r.month from public.monthly_schedule_archive_runs r where r.status='sent' and make_date(r.year,r.month,1)<date_trunc('month',timezone('Asia/Jerusalem',now()))::date
  ), role_rows as (
   select p.year,p.month,p.id publication_id,p.job_type_id,jt.name job_type_name,p.status,p.published_at,p.updated_at,count(a.id)::integer assignment_count,count(distinct a.user_id)::integer worker_count
   from public.dynamic_schedule_publications p join public.job_types jt on jt.id=p.job_type_id left join public.dynamic_schedule_published_assignments a on a.publication_id=p.id
   where make_date(p.year,p.month,1)<date_trunc('month',timezone('Asia/Jerusalem',now()))::date group by p.year,p.month,p.id,p.job_type_id,jt.name,p.status,p.published_at,p.updated_at
  )
  select jsonb_agg(jsonb_build_object('year',m.year,'month',m.month,
   'isFullyArchived',not exists(select 1 from role_rows x where x.year=m.year and x.month=m.month and x.status<>'archived') and (exists(select 1 from role_rows x where x.year=m.year and x.month=m.month) or exists(select 1 from public.monthly_schedule_archive_runs ar where ar.year=m.year and ar.month=m.month and ar.status='sent')),
   'archivedAt',coalesce((select max(x.updated_at) from role_rows x where x.year=m.year and x.month=m.month and x.status='archived'),(select max(ar.sent_at) from public.monthly_schedule_archive_runs ar where ar.year=m.year and ar.month=m.month and ar.status='sent')),
   'archiveRun',(select jsonb_build_object('id',ar.id,'status',ar.status,'fileName',ar.file_name,'emailId',ar.email_id,'sentAt',ar.sent_at,'attemptCount',ar.attempt_count) from public.monthly_schedule_archive_runs ar where ar.year=m.year and ar.month=m.month and ar.status='sent' order by ar.sent_at desc nulls last,ar.updated_at desc limit 1),
   'jobTypes',coalesce((select jsonb_agg(jsonb_build_object('publicationId',r.publication_id,'jobTypeId',r.job_type_id,'jobTypeName',r.job_type_name,'status',r.status,'assignmentCount',r.assignment_count,'workerCount',r.worker_count,'attendanceSessionCount',(select count(*) from public.attendance_sessions ats where ats.job_type_id=r.job_type_id and extract(year from ats.work_date)::int=m.year and extract(month from ats.work_date)::int=m.month),'attendanceMissingExitCount',(select count(*) from public.attendance_sessions ats where ats.job_type_id=r.job_type_id and ats.clock_out_at is null and extract(year from ats.work_date)::int=m.year and extract(month from ats.work_date)::int=m.month),'publishedAt',r.published_at,'archivedAt',case when r.status='archived' then r.updated_at else null end) order by r.job_type_name) from role_rows r where r.year=m.year and r.month=m.month),'[]'::jsonb)
  ) order by m.year desc,m.month desc) from months m),'[]'::jsonb));
end;$function$;
-- הסרת ההרשאות המפורטות בפקודה מהתפקידים המצוינים בה.
revoke all on function public.get_dynamic_archive_periods() from public;
-- הקצאת ההרשאות המפורטות בפקודה לתפקידים המצוינים בה.
grant execute on function public.get_dynamic_archive_periods() to authenticated;

commit;
