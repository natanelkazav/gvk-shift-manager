begin;

-- attendance.clock is a member permission and must be enabled by default when
-- attendance is enabled. Preserve explicit/manual choices, but repair settings
-- that still originate from the manifest defaults.
update public.dynamic_permission_manifest
set default_enabled = true
where feature_key = 'attendance'
  and permission_key = 'attendance.clock'
  and audience = 'member';

update public.job_type_permission_settings s
set enabled = true,
    updated_at = now()
where s.permission_key = 'attendance.clock'
  and s.audience = 'member'
  and coalesce(s.source, 'manifest') = 'manifest'
  and exists (
    select 1
    from public.job_types jt
    where jt.id = s.job_type_id
      and jt.is_active = true
      and coalesce((jt.scheduling_config #>> '{attendance,enabled}')::boolean, false) = true
  );

-- Do not hide an enabled attendance module just because its permission is off.
-- Returning canClock makes permission problems visible in the UI while the
-- clock action itself remains protected by clock_my_attendance().
create or replace function public.get_my_attendance_workspace()
returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); now_local timestamp:=now() at time zone 'Asia/Jerusalem';
begin
 if uid is null then raise exception 'not authenticated'; end if;
 return jsonb_build_object('roles',coalesce((
   select jsonb_agg(jsonb_build_object(
     'jobTypeId',jt.id,'jobTypeName',jt.name,
     'canClock',public.has_dynamic_job_type_permission('attendance.clock',jt.id,uid),
     'config',jt.scheduling_config->'attendance',
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
   where jt.is_active=true
     and coalesce((jt.scheduling_config#>>'{attendance,enabled}')::boolean,false)
 ),'[]'::jsonb));
end; $$;

grant execute on function public.get_my_attendance_workspace() to authenticated;

commit;
