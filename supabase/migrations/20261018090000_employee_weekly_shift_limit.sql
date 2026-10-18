-- Employee weekly shift limit: additive, default disabled.
begin;
alter table public.dynamic_availability_submissions
  add column if not exists max_weekly_shifts integer;
do $guard$ begin
 if not exists (select 1 from pg_constraint where conname='dynamic_availability_weekly_limit_range') then
  alter table public.dynamic_availability_submissions add constraint dynamic_availability_weekly_limit_range
  check (max_weekly_shifts between 1 and 99 or max_weekly_shifts is null);
 end if;
end $guard$;

create or replace function public.save_my_dynamic_availability_submission(
  requested_job_type_id uuid,
  requested_year integer,
  requested_month integer,
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
  requested_submission_status text;
  valid_entry_count integer:=0;
  total_slot_count integer:=0;
  weekly_limit integer;
  weekly_enabled boolean;
begin
  if current_user_id is null then raise exception 'not authenticated'; end if;
  if not exists(select 1 from public.job_type_memberships m where m.user_id=current_user_id and m.job_type_id=requested_job_type_id) then raise exception 'not a member of this job type'; end if;
  select * into job from public.job_types where id=requested_job_type_id and is_active=true;
  if job.id is null then raise exception 'job type not found'; end if;
  select * into period from public.dynamic_availability_periods where job_type_id=job.id and year=requested_year and month=requested_month;
  if period.id is null then raise exception 'dynamic period not found'; end if;
  if period.status <> 'open' then raise exception 'availability period is not open'; end if;
  if period.submission_deadline is not null and now()>period.submission_deadline then raise exception 'submission deadline has passed'; end if;

  weekly_enabled:=coalesce((job.availability_config->>'showWeeklyShiftLimit')::boolean,false);
  if weekly_enabled and requested_payload ? 'maxWeeklyShifts' and requested_payload->>'maxWeeklyShifts' is not null then
    if (requested_payload->>'maxWeeklyShifts') !~ '^[1-9][0-9]?$' then raise exception 'weekly shift limit must be an integer between 1 and 99'; end if;
    weekly_limit:=(requested_payload->>'maxWeeklyShifts')::integer;
  end if;
  requested_submission_status:=coalesce(requested_payload->>'submissionStatus','draft');
  if requested_submission_status not in ('draft','submitted','reopened') then raise exception 'invalid submission status'; end if;
  allowed_statuses:=coalesce(job.availability_config->'statuses','["available","unavailable"]'::jsonb);

  for entry_item in select value from jsonb_array_elements(coalesce(requested_payload->'entries','[]'::jsonb)) loop
    requested_status:=entry_item->>'status';
    if not (allowed_statuses ? requested_status) then raise exception 'availability status % is not enabled for this job type',requested_status; end if;
    if not exists(select 1 from public.dynamic_availability_slots s where s.id=(entry_item->>'slotId')::uuid and s.period_id=period.id) then raise exception 'slot does not belong to period'; end if;
    valid_entry_count:=valid_entry_count+1;
  end loop;

  select count(*) into total_slot_count from public.dynamic_availability_slots where period_id=period.id;
  if requested_submission_status='submitted' and valid_entry_count<>total_slot_count then
    raise exception 'all shifts must be marked before submission (% of %)',valid_entry_count,total_slot_count;
  end if;

  insert into public.dynamic_availability_submissions(period_id,user_id,status,min_shifts,target_shifts,max_shifts,max_nights,max_weekends,max_holidays,note,submitted_at)
  values(period.id,current_user_id,requested_submission_status,
    nullif(requested_payload->>'minimum','')::integer,nullif(requested_payload->>'target','')::integer,nullif(requested_payload->>'maximum','')::integer,
    nullif(requested_payload->>'maxNights','')::integer,nullif(requested_payload->>'maxWeekends','')::integer,nullif(requested_payload->>'maxHolidays','')::integer,
    nullif(trim(coalesce(requested_payload->>'note','')),''),case when requested_submission_status='submitted' then now() else null end)
  on conflict(period_id,user_id) do update set status=excluded.status,min_shifts=excluded.min_shifts,target_shifts=excluded.target_shifts,max_shifts=excluded.max_shifts,
    max_nights=excluded.max_nights,max_weekends=excluded.max_weekends,max_holidays=excluded.max_holidays,note=excluded.note,
    submitted_at=case when excluded.status='submitted' then now() else public.dynamic_availability_submissions.submitted_at end,updated_at=now()
  returning id into v_submission_id;

  update public.dynamic_availability_submissions
  set max_weekly_shifts=case when weekly_enabled then weekly_limit else max_weekly_shifts end
  where id=v_submission_id;

  for entry_item in select value from jsonb_array_elements(coalesce(requested_payload->'entries','[]'::jsonb)) loop
    insert into public.dynamic_availability_entries(submission_id,slot_id,availability_status,note,auto_filled)
    values(v_submission_id,(entry_item->>'slotId')::uuid,entry_item->>'status',nullif(trim(coalesce(entry_item->>'note','')),''),coalesce((entry_item->>'autoFilled')::boolean,false))
    on conflict(submission_id,slot_id) do update set availability_status=excluded.availability_status,note=excluded.note,auto_filled=excluded.auto_filled,updated_at=now();
  end loop;

  return jsonb_build_object('saved',true,'submissionId',v_submission_id,'status',requested_submission_status,'filledCount',valid_entry_count,'totalSlots',total_slot_count);
end;
$function$;

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
  version_availability_config jsonb;
  show_employee_preferences boolean;
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

  -- Resolve the preference visibility for the requested month from the applicable
  -- configuration version. Older snapshots did not include this new setting.
  select v.snapshot->'availabilityConfig'
    into version_availability_config
  from public.job_type_configuration_versions v
  where v.job_type_id = job.id
    and v.effective_month <= make_date(requested_year, requested_month, 1)
  order by v.effective_month desc, v.created_at desc, v.id desc
  limit 1;

  show_employee_preferences := coalesce(
    (version_availability_config->>'showEmployeePreferences')::boolean,
    (period.config_snapshot->>'showEmployeePreferences')::boolean,
    (job.availability_config->>'showEmployeePreferences')::boolean,
    true -- Legacy job types retain the existing UI until explicitly configured.
  );
  normalized_config:=jsonb_build_object(
    'enabled',coalesce((effective_availability_config->>'enabled')::boolean,true),
    'statuses',case when jsonb_typeof(effective_availability_config->'statuses')='array' and jsonb_array_length(effective_availability_config->'statuses')>0 then effective_availability_config->'statuses' else '["available","unavailable"]'::jsonb end,
    'allowNotes',coalesce((effective_availability_config->>'allowNotes')::boolean,true),
    'showEmployeePreferences',show_employee_preferences,
    'showWeeklyShiftLimit',coalesce((version_availability_config->>'showWeeklyShiftLimit')::boolean,(period.config_snapshot->>'showWeeklyShiftLimit')::boolean,(job.availability_config->>'showWeeklyShiftLimit')::boolean,false),
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
      'submissionId',sub.id,'status',coalesce(sub.status,'draft'),'minimum',sub.min_shifts,'target',sub.target_shifts,'maximum',sub.max_shifts,'maxWeeklyShifts',sub.max_weekly_shifts,
      'maxNights',sub.max_nights,'maxWeekends',sub.max_weekends,'maxHolidays',sub.max_holidays,'note',sub.note,
      'entries',coalesce((select jsonb_object_agg(e.slot_id::text,jsonb_build_object('status',e.availability_status,'note',e.note)) from public.dynamic_availability_entries e where e.submission_id=sub.id),'{}'::jsonb)
    ))
  );
end;
$function$;

create or replace function public.dynamic_shadow_candidate_allowed(
  requested_draft_id uuid,
  requested_user_id uuid,
  requested_slot_id uuid,
  requested_max_shifts_per_day integer,
  requested_no_consecutive boolean,
  requested_min_rest_minutes integer
)
returns boolean
language plpgsql
security definer
set search_path=''
as $function$
declare
  candidate_slot public.dynamic_availability_slots%rowtype;
  candidate_start timestamp;
  candidate_end timestamp;
  existing record;
  weekly_limit integer;
  weekly_count integer;
begin
  select * into candidate_slot from public.dynamic_availability_slots where id=requested_slot_id;
  if candidate_slot.id is null then return false; end if;

  -- Respect the personal weekly cap for all generated assignments.
  -- Sunday-to-Saturday weeks; count shifts by their starting date.
  select sub.max_weekly_shifts into weekly_limit
  from public.dynamic_schedule_shadow_drafts d
  join public.dynamic_availability_submissions sub on sub.period_id=d.availability_period_id and sub.user_id=requested_user_id
  join public.job_types j on j.id=d.job_type_id
  where d.id=requested_draft_id
    and coalesce((j.availability_config->>'showWeeklyShiftLimit')::boolean,false);
  if weekly_limit is not null then
    select count(*) into weekly_count
    from public.dynamic_schedule_shadow_assignments a
    join public.dynamic_availability_slots s on s.id=a.slot_id
    where a.draft_id=requested_draft_id and a.user_id=requested_user_id
      and s.shift_date >= candidate_slot.shift_date - extract(dow from candidate_slot.shift_date)::integer
      and s.shift_date < candidate_slot.shift_date - extract(dow from candidate_slot.shift_date)::integer + 7;
    if weekly_count >= weekly_limit then return false; end if;
  end if;

  candidate_start := candidate_slot.shift_date + candidate_slot.start_time;
  candidate_end := candidate_slot.shift_date + candidate_slot.end_time;
  if candidate_slot.end_time <= candidate_slot.start_time then candidate_end := candidate_end + interval '1 day'; end if;

  if exists(select 1 from public.dynamic_schedule_shadow_assignments a where a.draft_id=requested_draft_id and a.slot_id=requested_slot_id and a.user_id=requested_user_id) then return false; end if;

  if (select count(*) from public.dynamic_schedule_shadow_assignments a join public.dynamic_availability_slots x on x.id=a.slot_id where a.draft_id=requested_draft_id and a.user_id=requested_user_id and x.shift_date=candidate_slot.shift_date) >= requested_max_shifts_per_day then return false; end if;

  for existing in
    select x.* from public.dynamic_schedule_shadow_assignments a
    join public.dynamic_availability_slots x on x.id=a.slot_id
    where a.draft_id=requested_draft_id and a.user_id=requested_user_id
  loop
    declare
      existing_start timestamp := existing.shift_date + existing.start_time;
      existing_end timestamp := existing.shift_date + existing.end_time;
    begin
      if existing.end_time <= existing.start_time then existing_end := existing_end + interval '1 day'; end if;
      if candidate_start < existing_end and existing_start < candidate_end then return false; end if;
      if requested_no_consecutive and (candidate_start=existing_end or candidate_end=existing_start) then return false; end if;
      if requested_min_rest_minutes > 0 then
        if existing_end <= candidate_start and extract(epoch from (candidate_start-existing_end))/60 < requested_min_rest_minutes then return false; end if;
        if candidate_end <= existing_start and extract(epoch from (existing_start-candidate_end))/60 < requested_min_rest_minutes then return false; end if;
      end if;
    end;
  end loop;
  return true;
end;
$function$;

revoke all on function public.save_my_dynamic_availability_submission(uuid,integer,integer,jsonb) from public;
grant execute on function public.save_my_dynamic_availability_submission(uuid,integer,integer,jsonb) to authenticated;
revoke all on function public.get_my_dynamic_availability_workspace(uuid,integer,integer) from public;
grant execute on function public.get_my_dynamic_availability_workspace(uuid,integer,integer) to authenticated;
revoke all on function public.dynamic_shadow_candidate_allowed(uuid,uuid,uuid,integer,boolean,integer) from public;
grant execute on function public.dynamic_shadow_candidate_allowed(uuid,uuid,uuid,integer,boolean,integer) to authenticated;
commit;
