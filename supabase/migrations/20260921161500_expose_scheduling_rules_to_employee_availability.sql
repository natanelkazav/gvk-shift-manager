-- Expose the job scheduling rules in the employee availability workspace so the
-- client can calculate the theoretical monthly maximum without changing or
-- rebuilding any existing availability submission/entry.
create or replace function public.get_my_dynamic_availability_workspace(
  requested_job_type_id uuid,
  requested_year integer,
  requested_month integer
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  current_user_id uuid:=auth.uid();
  job public.job_types%rowtype;
  period public.dynamic_availability_periods%rowtype;
  sub public.dynamic_availability_submissions%rowtype;
  normalized_config jsonb;
  effective_availability_config jsonb;
begin
  if current_user_id is null then raise exception 'not authenticated'; end if;
  if not exists(select 1 from public.job_type_memberships m where m.user_id=current_user_id and m.job_type_id=requested_job_type_id) then raise exception 'not a member of this job type'; end if;
  select * into job from public.job_types where id=requested_job_type_id and is_active=true;
  if job.id is null then raise exception 'job type not found'; end if;
  select * into period from public.dynamic_availability_periods where job_type_id=job.id and year=requested_year and month=requested_month;
  if period.id is null then raise exception 'dynamic period not found'; end if;
  if period.status not in ('open','closed','archived') then raise exception 'period is not available to employees'; end if;
  if not exists(select 1 from public.dynamic_availability_slots s where s.period_id=period.id) then perform public.materialize_dynamic_availability_period_slots(period.id); end if;
  select * into sub from public.dynamic_availability_submissions where period_id=period.id and user_id=current_user_id;
  effective_availability_config:=coalesce(period.config_snapshot,job.availability_config,'{}'::jsonb);
  normalized_config:=jsonb_build_object(
    'enabled',coalesce((effective_availability_config->>'enabled')::boolean,true),
    'statuses',case when jsonb_typeof(effective_availability_config->'statuses')='array' and jsonb_array_length(effective_availability_config->'statuses')>0 then effective_availability_config->'statuses' else '["available","unavailable"]'::jsonb end,
    'allowNotes',coalesce((effective_availability_config->>'allowNotes')::boolean,true),
    'monthlyCapacity',coalesce(effective_availability_config->'monthlyCapacity','{"enabled":false,"minEnabled":false,"targetEnabled":false,"maxEnabled":false,"defaultMin":null,"defaultTarget":null,"defaultMax":null}'::jsonb),
    'limits',coalesce(effective_availability_config->'limits','{"maxNightsEnabled":false,"defaultMaxNights":null,"maxWeekendsEnabled":false,"defaultMaxWeekends":null,"maxHolidaysEnabled":false,"defaultMaxHolidays":null}'::jsonb)
  );
  return jsonb_build_object(
    'materialized',true,'mode','dynamic_role','periodId',period.id,'jobTypeId',job.id,'jobTypeName',job.name,
    'availabilityConfig',normalized_config,
    'schedulingConfig',coalesce(job.scheduling_config,'{}'::jsonb),
    'slots',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'date',s.shift_date,'shiftCode',s.shift_code,'shiftName',s.shift_name,'startTime',s.start_time,'endTime',s.end_time,'holidayName',s.holiday_name,'sourceDayKind',s.source_day_kind,'effectiveDayKind',s.effective_day_kind,'minWorkers',s.min_workers,'targetWorkers',s.target_workers,'maxWorkers',s.max_workers) order by s.shift_date,s.start_time,s.shift_code) from public.dynamic_availability_slots s where s.period_id=period.id),'[]'::jsonb),
    'members',jsonb_build_array(jsonb_build_object(
      'userId',current_user_id,'displayName',(select display_name from public.profiles where id=current_user_id),'isActive',coalesce((select is_active from public.profiles where id=current_user_id),true),
      'submissionId',sub.id,'status',coalesce(sub.status,'draft'),'minimum',sub.min_shifts,'target',sub.target_shifts,'maximum',sub.max_shifts,
      'maxNights',sub.max_nights,'maxWeekends',sub.max_weekends,'maxHolidays',sub.max_holidays,'note',sub.note,
      'entries',coalesce((select jsonb_object_agg(e.slot_id::text,jsonb_build_object('status',e.availability_status,'note',e.note)) from public.dynamic_availability_entries e where e.submission_id=sub.id),'{}'::jsonb)
    ))
  );
end;
$function$;
revoke all on function public.get_my_dynamic_availability_workspace(uuid,integer,integer) from public;
grant execute on function public.get_my_dynamic_availability_workspace(uuid,integer,integer) to authenticated;
