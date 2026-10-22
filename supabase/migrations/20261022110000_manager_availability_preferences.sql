-- Align manager workspace and saving with employee monthly/weekly preferences.
-- Requires 20261018090000_employee_weekly_shift_limit.sql to have been applied.

create or replace function public.get_dynamic_availability_shadow_workspace(
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
  current_user_id uuid := auth.uid();
  job public.job_types%rowtype;
  period public.dynamic_availability_periods%rowtype;
  normalized_config jsonb;
begin
  if current_user_id is null then raise exception 'not authenticated'; end if;
  if not public.has_dynamic_job_type_permission('availability.view_team', requested_job_type_id, current_user_id) then raise exception 'not allowed'; end if;
  select * into job from public.job_types where id=requested_job_type_id;
  if job.id is null then raise exception 'job type not found'; end if;
  select * into period from public.dynamic_availability_periods where job_type_id=job.id and year=requested_year and month=requested_month;

  normalized_config := jsonb_build_object(
    'enabled', coalesce((job.availability_config->>'enabled')::boolean,true),
    'statuses', case when jsonb_typeof(job.availability_config->'statuses')='array' and jsonb_array_length(job.availability_config->'statuses')>0 then job.availability_config->'statuses' else '["available","unavailable"]'::jsonb end,
    'allowNotes', coalesce((job.availability_config->>'allowNotes')::boolean,true),
    'showEmployeePreferences', coalesce((job.availability_config->>'showEmployeePreferences')::boolean,true),
    'showWeeklyShiftLimit', coalesce((job.availability_config->>'showWeeklyShiftLimit')::boolean,false),
    'monthlyCapacity', coalesce(job.availability_config->'monthlyCapacity','{"enabled":false,"minEnabled":false,"targetEnabled":false,"maxEnabled":false,"defaultMin":null,"defaultTarget":null,"defaultMax":null}'::jsonb),
    'limits', coalesce(job.availability_config->'limits','{"maxNightsEnabled":false,"defaultMaxNights":null,"maxWeekendsEnabled":false,"defaultMaxWeekends":null,"maxHolidaysEnabled":false,"defaultMaxHolidays":null}'::jsonb)
  );

  return jsonb_build_object(
    'materialized', period.id is not null,'mode','shadow','periodId',period.id,'jobTypeId',job.id,'jobTypeName',job.name,
    'availabilityConfig',normalized_config,
    'slots',case when period.id is null then '[]'::jsonb else coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'date',s.shift_date,'shiftCode',s.shift_code,'shiftName',s.shift_name,'startTime',s.start_time,'endTime',s.end_time,'holidayName',s.holiday_name,'sourceDayKind',s.source_day_kind,'effectiveDayKind',s.effective_day_kind,'minWorkers',s.min_workers,'targetWorkers',s.target_workers,'maxWorkers',s.max_workers) order by s.shift_date,s.start_time,s.shift_code) from public.dynamic_availability_slots s where s.period_id=period.id),'[]'::jsonb) end,
    'members',coalesce((select jsonb_agg(jsonb_build_object('userId',m.user_id,'displayName',p.display_name,'isActive',p.is_active,'submissionId',sub.id,'status',coalesce(sub.status,'draft'),'minimum',sub.min_shifts,'target',sub.target_shifts,'maximum',sub.max_shifts,'maxWeeklyShifts',sub.max_weekly_shifts,'maxNights',sub.max_nights,'maxWeekends',sub.max_weekends,'maxHolidays',sub.max_holidays,'note',sub.note,'entries',coalesce((select jsonb_object_agg(e.slot_id::text,jsonb_build_object('status',e.availability_status,'note',e.note)) from public.dynamic_availability_entries e where e.submission_id=sub.id),'{}'::jsonb)) order by p.is_active desc,p.display_name) from public.job_type_memberships m join public.profiles p on p.id=m.user_id left join public.dynamic_availability_submissions sub on sub.period_id=period.id and sub.user_id=m.user_id where m.job_type_id=job.id and p.is_active=true),'[]'::jsonb)
  );
end;
$function$;

create or replace function public.save_dynamic_availability_shadow_submission(
  requested_job_type_id uuid,
  requested_year integer,
  requested_month integer,
  requested_user_id uuid,
  requested_payload jsonb
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
  v_submission_id uuid;
  entry_item jsonb;
  allowed_statuses jsonb;
  requested_status text;
  weekly_enabled boolean;
  weekly_limit integer;
begin
  if current_user_id is null then raise exception 'not authenticated'; end if;
  if not public.has_dynamic_job_type_permission('availability.manage_submissions', requested_job_type_id, current_user_id) then raise exception 'not allowed'; end if;
  select * into job from public.job_types where id=requested_job_type_id;
  if job.id is null then raise exception 'job type not found'; end if;
  if not exists(select 1 from public.job_type_memberships m where m.job_type_id=job.id and m.user_id=requested_user_id) then raise exception 'user is not a member of this job type'; end if;
  select * into period from public.dynamic_availability_periods where job_type_id=job.id and year=requested_year and month=requested_month;
  if period.id is null then raise exception 'shadow period not materialized'; end if;
  weekly_enabled := coalesce((job.availability_config->>'showWeeklyShiftLimit')::boolean,false);
  if weekly_enabled and requested_payload ? 'maxWeeklyShifts' and requested_payload->>'maxWeeklyShifts' is not null then
    if (requested_payload->>'maxWeeklyShifts') !~ '^[1-9][0-9]?$' then raise exception 'weekly shift limit must be an integer between 1 and 99'; end if;
    weekly_limit := (requested_payload->>'maxWeeklyShifts')::integer;
  end if;

  insert into public.dynamic_availability_submissions(period_id,user_id,status,min_shifts,target_shifts,max_shifts,max_nights,max_weekends,max_holidays,note,submitted_at)
  values(period.id,requested_user_id,coalesce(requested_payload->>'submissionStatus','draft'),
    nullif(requested_payload->>'minimum','')::integer,nullif(requested_payload->>'target','')::integer,nullif(requested_payload->>'maximum','')::integer,
    nullif(requested_payload->>'maxNights','')::integer,nullif(requested_payload->>'maxWeekends','')::integer,nullif(requested_payload->>'maxHolidays','')::integer,
    nullif(trim(coalesce(requested_payload->>'note','')),''),case when coalesce(requested_payload->>'submissionStatus','draft')='submitted' then now() else null end)
  on conflict(period_id,user_id) do update set
    status=excluded.status,min_shifts=excluded.min_shifts,target_shifts=excluded.target_shifts,max_shifts=excluded.max_shifts,
    max_nights=excluded.max_nights,max_weekends=excluded.max_weekends,max_holidays=excluded.max_holidays,note=excluded.note,
    submitted_at=excluded.submitted_at,updated_at=now()
  returning id into v_submission_id;

  if weekly_enabled and requested_payload ? 'maxWeeklyShifts' then
    update public.dynamic_availability_submissions set max_weekly_shifts=weekly_limit where id=v_submission_id;
  end if;

  allowed_statuses:=coalesce(job.availability_config->'statuses','["available","unavailable"]'::jsonb);
  for entry_item in select value from jsonb_array_elements(coalesce(requested_payload->'entries','[]'::jsonb)) loop
    requested_status:=entry_item->>'status';
    if not (allowed_statuses ? requested_status) then raise exception 'availability status % is not enabled for this job type',requested_status; end if;
    if not exists(select 1 from public.dynamic_availability_slots s where s.id=(entry_item->>'slotId')::uuid and s.period_id=period.id) then raise exception 'slot does not belong to period'; end if;
    insert into public.dynamic_availability_entries(submission_id,slot_id,availability_status,note)
    values(v_submission_id,(entry_item->>'slotId')::uuid,requested_status,nullif(trim(coalesce(entry_item->>'note','')),''))
    on conflict on constraint dynamic_availability_entries_pkey do update
      set availability_status=excluded.availability_status,note=excluded.note,updated_at=now();
  end loop;

  return jsonb_build_object('saved',true,'mode','shadow','submissionId',v_submission_id);
end;
$function$;
