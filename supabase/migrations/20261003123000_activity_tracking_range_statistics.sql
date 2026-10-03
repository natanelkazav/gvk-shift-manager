begin;

create or replace function public.get_activity_tracking_range(
  requested_job_type_id uuid,
  requested_start date,
  requested_end date
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  actor uuid:=auth.uid();
  result jsonb;
  can_team boolean;
  can_own boolean;
  safe_start date:=least(requested_start,requested_end);
  safe_end date:=greatest(requested_start,requested_end);
begin
  if actor is null then raise exception 'not authenticated'; end if;
  if safe_end-safe_start > 370 then raise exception 'range too large'; end if;

  can_team:=public.has_dynamic_job_type_permission('activity_tracking.view_team',requested_job_type_id,actor)
    or exists(select 1 from public.user_permissions up where up.user_id=actor and up.permission_key in('statistics.view','users.manage'));
  can_own:=public.has_dynamic_job_type_permission('activity_tracking.view_own',requested_job_type_id,actor)
    and exists(select 1 from public.job_type_memberships m where m.job_type_id=requested_job_type_id and m.user_id=actor);
  if not (can_team or can_own) then raise exception 'not allowed'; end if;

  select jsonb_build_object(
    'rangeStart',safe_start,
    'rangeEnd',safe_end,
    'rows',coalesce(jsonb_agg(row_to_json(x)),'[]'::jsonb)
  ) into result
  from (
    select d.user_id as "userId",
      coalesce(p.schedule_name,p.display_name) as "displayName",
      d.work_date as "workDate",
      s.activity_key as "activityKey",
      s.activity_label as "activityLabel",
      round((extract(epoch from (coalesce(s.ended_at,now())-s.started_at))/3600.0)::numeric,4) as hours,
      s.id as "segmentId",s.started_at as "startedAt",s.ended_at as "endedAt",d.status
    from public.activity_tracking_days d
    join public.activity_tracking_segments s on s.day_id=d.id
    join public.profiles p on p.id=d.user_id
    where d.job_type_id=requested_job_type_id
      and d.work_date between safe_start and safe_end
      and (can_team or d.user_id=actor)
    order by d.work_date,s.started_at
  ) x;
  return result;
end $$;

revoke all on function public.get_activity_tracking_range(uuid,date,date) from public;
grant execute on function public.get_activity_tracking_range(uuid,date,date) to authenticated;

commit;
