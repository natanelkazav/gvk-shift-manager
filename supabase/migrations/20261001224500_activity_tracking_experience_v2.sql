begin;

create or replace function public.pause_my_activity(requested_job_type_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare actor uuid:=auth.uid(); d public.activity_tracking_days%rowtype; nowv timestamptz:=now();
begin
 if actor is null then raise exception 'not authenticated'; end if;
 if not public.has_dynamic_job_type_permission('activity_tracking.use',requested_job_type_id,actor) then raise exception 'not allowed'; end if;
 select * into d from public.activity_tracking_days where job_type_id=requested_job_type_id and user_id=actor and work_date=(nowv at time zone 'Asia/Jerusalem')::date;
 if d.id is not null then
   update public.activity_tracking_segments set ended_at=nowv,updated_at=nowv where day_id=d.id and ended_at is null;
   update public.activity_tracking_days set status='active',updated_at=nowv where id=d.id;
 end if;
 return public.get_my_activity_tracking_context();
end $$;
grant execute on function public.pause_my_activity(uuid) to authenticated;

create or replace function public.get_activity_tracking_periods(requested_job_type_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare actor uuid:=auth.uid(); result jsonb;
begin
 if actor is null then raise exception 'not authenticated'; end if;
 if not (public.has_dynamic_job_type_permission('activity_tracking.view_team',requested_job_type_id,actor) or exists(select 1 from public.job_type_memberships where job_type_id=requested_job_type_id and user_id=actor)) then raise exception 'not allowed'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('year',x.year,'month',x.month) order by x.year desc,x.month desc),'[]'::jsonb) into result
 from (select distinct extract(year from work_date)::int year,extract(month from work_date)::int month from public.activity_tracking_days where job_type_id=requested_job_type_id) x;
 return result;
end $$;
grant execute on function public.get_activity_tracking_periods(uuid) to authenticated;

create or replace function public.get_dynamic_statistics_job_types()
returns jsonb language plpgsql security definer set search_path='' as $$
declare current_user_id uuid:=auth.uid();
begin
 if current_user_id is null then raise exception 'not authenticated'; end if;
 if not exists(select 1 from public.user_permissions up where up.user_id=current_user_id and up.permission_key in ('statistics.view','users.manage')) then raise exception 'not allowed'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object(
  'jobTypeId',jt.id,'name',jt.name,'code',jt.code,'isActive',jt.is_active,'payModel',jt.pay_model,
  'workMode',coalesce(nullif(jt.scheduling_config->'shiftPattern'->>'workMode',''),nullif(jt.scheduling_config->>'workMode','')),
  'availabilityEnabled',coalesce((jt.availability_config->>'enabled')::boolean,false),
  'activityTrackingEnabled',coalesce((jt.scheduling_config#>>'{activityTracking,enabled}')::boolean,false),
  'memberCount',(select count(*) from public.job_type_memberships m join public.profiles p on p.id=m.user_id where m.job_type_id=jt.id and p.is_active=true),
  'payrollEnabled',coalesce(jt.pay_model,'none')<>'none',
  'attendanceEnabled',coalesce((jt.scheduling_config#>>'{attendance,enabled}')::boolean,false),
  'dataPeriodCount',(select count(*) from (select p.year,p.month from public.dynamic_schedule_publications p where p.job_type_id=jt.id union select hp.year,hp.month from public.dynamic_historical_periods hp where hp.job_type_id=jt.id union select extract(year from ad.work_date)::int,extract(month from ad.work_date)::int from public.activity_tracking_days ad where ad.job_type_id=jt.id) periods)
 ) order by jt.is_active desc,jt.name) from public.job_types jt where coalesce((jt.statistics_config->>'enabled')::boolean,false)=true and (jt.is_active=true or exists(select 1 from public.job_type_memberships m where m.job_type_id=jt.id) or exists(select 1 from public.dynamic_schedule_publications p where p.job_type_id=jt.id) or exists(select 1 from public.dynamic_historical_periods hp where hp.job_type_id=jt.id) or exists(select 1 from public.activity_tracking_days ad where ad.job_type_id=jt.id))),'[]'::jsonb);
end $$;
revoke all on function public.get_dynamic_statistics_job_types() from public;
grant execute on function public.get_dynamic_statistics_job_types() to authenticated;

commit;
