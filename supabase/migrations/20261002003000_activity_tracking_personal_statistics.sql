begin;

insert into public.dynamic_permission_manifest(feature_key,permission_key,audience,label,description,default_enabled,sort_order)
values('activity_tracking','activity_tracking.view_own','member','צפייה בסטטיסטיקות האישיות שלי','הצגת טאב הסטטיסטיקות עם נתוני הפעילות האישיים בלבד.',true,20)
on conflict (feature_key,permission_key,audience) do update set label=excluded.label,description=excluded.description,default_enabled=excluded.default_enabled,sort_order=excluded.sort_order;

create or replace function public.can_view_own_activity_statistics()
returns boolean language sql stable security definer set search_path=public as $$
 select auth.uid() is not null and exists(
   select 1 from public.job_types jt
   join public.job_type_memberships m on m.job_type_id=jt.id and m.user_id=auth.uid()
   where jt.is_active=true
     and coalesce((public.activity_tracking_config(jt)->>'enabled')::boolean,false)
     and public.has_dynamic_job_type_permission('activity_tracking.view_own',jt.id,auth.uid())
 );
$$;
grant execute on function public.can_view_own_activity_statistics() to authenticated;

create or replace function public.get_dynamic_statistics_job_types()
returns jsonb language plpgsql security definer set search_path='' as $$
declare current_user_id uuid:=auth.uid(); has_global boolean;
begin
 if current_user_id is null then raise exception 'not authenticated'; end if;
 has_global:=exists(select 1 from public.user_permissions up where up.user_id=current_user_id and up.permission_key in ('statistics.view','users.manage'));
 if not has_global and not public.can_view_own_activity_statistics() then raise exception 'not allowed'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object(
  'jobTypeId',jt.id,'name',jt.name,'code',jt.code,'isActive',jt.is_active,'payModel',jt.pay_model,
  'workMode',coalesce(nullif(jt.scheduling_config->'shiftPattern'->>'workMode',''),nullif(jt.scheduling_config->>'workMode','')),
  'availabilityEnabled',coalesce((jt.availability_config->>'enabled')::boolean,false),
  'activityTrackingEnabled',coalesce((jt.scheduling_config#>>'{activityTracking,enabled}')::boolean,false),
  'personalOnly',not has_global,
  'memberCount',(select count(*) from public.job_type_memberships m join public.profiles p on p.id=m.user_id where m.job_type_id=jt.id and p.is_active=true),
  'payrollEnabled',coalesce(jt.pay_model,'none')<>'none',
  'attendanceEnabled',coalesce((jt.scheduling_config#>>'{attendance,enabled}')::boolean,false),
  'dataPeriodCount',(select count(*) from (select p.year,p.month from public.dynamic_schedule_publications p where p.job_type_id=jt.id union select hp.year,hp.month from public.dynamic_historical_periods hp where hp.job_type_id=jt.id union select extract(year from ad.work_date)::int,extract(month from ad.work_date)::int from public.activity_tracking_days ad where ad.job_type_id=jt.id) periods)
 ) order by jt.is_active desc,jt.name)
 from public.job_types jt
 where coalesce((jt.statistics_config->>'enabled')::boolean,false)=true
   and (has_global or (coalesce((public.activity_tracking_config(jt)->>'enabled')::boolean,false) and exists(select 1 from public.job_type_memberships m where m.job_type_id=jt.id and m.user_id=current_user_id) and public.has_dynamic_job_type_permission('activity_tracking.view_own',jt.id,current_user_id)))
   and (jt.is_active=true or exists(select 1 from public.job_type_memberships m where m.job_type_id=jt.id) or exists(select 1 from public.activity_tracking_days ad where ad.job_type_id=jt.id))),'[]'::jsonb);
end $$;
revoke all on function public.get_dynamic_statistics_job_types() from public;
grant execute on function public.get_dynamic_statistics_job_types() to authenticated;

create or replace function public.get_activity_tracking_periods(requested_job_type_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare actor uuid:=auth.uid(); result jsonb; can_team boolean; can_own boolean;
begin
 if actor is null then raise exception 'not authenticated'; end if;
 can_team:=public.has_dynamic_job_type_permission('activity_tracking.view_team',requested_job_type_id,actor) or exists(select 1 from public.user_permissions up where up.user_id=actor and up.permission_key in('statistics.view','users.manage'));
 can_own:=public.has_dynamic_job_type_permission('activity_tracking.view_own',requested_job_type_id,actor) and exists(select 1 from public.job_type_memberships m where m.job_type_id=requested_job_type_id and m.user_id=actor);
 if not (can_team or can_own) then raise exception 'not allowed'; end if;
 if can_team then
   select coalesce(jsonb_agg(jsonb_build_object('year',x.year,'month',x.month) order by x.year desc,x.month desc),'[]'::jsonb)
   into result
   from (
     select distinct extract(year from d.work_date)::int as year, extract(month from d.work_date)::int as month
     from public.activity_tracking_days d
     where d.job_type_id=requested_job_type_id
   ) x;
 else
   select coalesce(jsonb_agg(jsonb_build_object('year',x.year,'month',x.month) order by x.year desc,x.month desc),'[]'::jsonb)
   into result
   from (
     select distinct extract(year from d.work_date)::int as year, extract(month from d.work_date)::int as month
     from public.activity_tracking_days d
     where d.job_type_id=requested_job_type_id and d.user_id=actor
   ) x;
 end if;
 return result;
end $$;
grant execute on function public.get_activity_tracking_periods(uuid) to authenticated;

create or replace function public.get_activity_tracking_week(requested_job_type_id uuid,requested_week_start date default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare actor uuid:=auth.uid(); ws date:=coalesce(requested_week_start,date_trunc('week',(now() at time zone 'Asia/Jerusalem'))::date); result jsonb; can_team boolean; can_own boolean;
begin
 if actor is null then raise exception 'not authenticated'; end if;
 can_team:=public.has_dynamic_job_type_permission('activity_tracking.view_team',requested_job_type_id,actor) or exists(select 1 from public.user_permissions up where up.user_id=actor and up.permission_key in('statistics.view','users.manage'));
 can_own:=public.has_dynamic_job_type_permission('activity_tracking.view_own',requested_job_type_id,actor) and exists(select 1 from public.job_type_memberships m where m.job_type_id=requested_job_type_id and m.user_id=actor);
 if not (can_team or can_own) then raise exception 'not allowed'; end if;
 select jsonb_build_object('weekStart',ws,'weekEnd',ws+6,'rows',coalesce(jsonb_agg(row_to_json(x)),'[]'::jsonb)) into result from (
  select d.user_id as "userId",coalesce(p.schedule_name,p.display_name) as "displayName",d.work_date as "workDate",s.activity_key as "activityKey",s.activity_label as "activityLabel",
   round((extract(epoch from (coalesce(s.ended_at,now())-s.started_at))/3600.0)::numeric,2) as hours,s.id as "segmentId",s.started_at as "startedAt",s.ended_at as "endedAt",d.status
  from public.activity_tracking_days d join public.activity_tracking_segments s on s.day_id=d.id join public.profiles p on p.id=d.user_id
  where d.job_type_id=requested_job_type_id and d.work_date between ws and ws+6 and (can_team or d.user_id=actor)
  order by d.work_date,s.started_at
 ) x;
 return result;
end $$;
grant execute on function public.get_activity_tracking_week(uuid,date) to authenticated;

commit;
