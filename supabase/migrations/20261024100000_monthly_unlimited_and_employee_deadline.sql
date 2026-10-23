-- Preserve explicit monthly "as many as possible" without manufacturing a numeric target.
-- No backfill: old numeric values are ambiguous and must remain untouched.
begin;
alter table public.dynamic_availability_submissions add column if not exists target_unlimited boolean not null default false;

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

  if requested_payload ? 'targetUnlimited' then
    update public.dynamic_availability_submissions
    set target_unlimited=coalesce((requested_payload->>'targetUnlimited')::boolean,false),
        target_shifts=case when coalesce((requested_payload->>'targetUnlimited')::boolean,false) then null else target_shifts end
    where id=v_submission_id;
  end if;

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
      'submissionId',sub.id,'status',coalesce(sub.status,'draft'),'minimum',sub.min_shifts,'target',sub.target_shifts,'targetUnlimited',sub.target_unlimited,'maximum',sub.max_shifts,'maxWeeklyShifts',sub.max_weekly_shifts,
      'maxNights',sub.max_nights,'maxWeekends',sub.max_weekends,'maxHolidays',sub.max_holidays,'note',sub.note,
      'entries',coalesce((select jsonb_object_agg(e.slot_id::text,jsonb_build_object('status',e.availability_status,'note',e.note)) from public.dynamic_availability_entries e where e.submission_id=sub.id),'{}'::jsonb)
    ))
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

  if requested_payload ? 'targetUnlimited' then
    update public.dynamic_availability_submissions
    set target_unlimited=coalesce((requested_payload->>'targetUnlimited')::boolean,false),
        target_shifts=case when coalesce((requested_payload->>'targetUnlimited')::boolean,false) then null else target_shifts end
    where id=v_submission_id;
  end if;

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
    'members',coalesce((select jsonb_agg(jsonb_build_object('userId',m.user_id,'displayName',p.display_name,'isActive',p.is_active,'submissionId',sub.id,'status',coalesce(sub.status,'draft'),'minimum',sub.min_shifts,'target',sub.target_shifts,'targetUnlimited',sub.target_unlimited,'maximum',sub.max_shifts,'maxWeeklyShifts',sub.max_weekly_shifts,'maxNights',sub.max_nights,'maxWeekends',sub.max_weekends,'maxHolidays',sub.max_holidays,'note',sub.note,'entries',coalesce((select jsonb_object_agg(e.slot_id::text,jsonb_build_object('status',e.availability_status,'note',e.note)) from public.dynamic_availability_entries e where e.submission_id=sub.id),'{}'::jsonb)) order by p.is_active desc,p.display_name) from public.job_type_memberships m join public.profiles p on p.id=m.user_id left join public.dynamic_availability_submissions sub on sub.period_id=period.id and sub.user_id=m.user_id where m.job_type_id=job.id and p.is_active=true),'[]'::jsonb)
  );
end;
$function$;

create or replace function public.get_dynamic_draft_member_preferences(requested_draft_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user uuid := auth.uid();
  v_draft public.dynamic_schedule_shadow_drafts%rowtype;
  v_job public.job_types%rowtype;
begin
  if v_user is null then raise exception 'not authenticated'; end if;
  select * into v_draft from public.dynamic_schedule_shadow_drafts where id=requested_draft_id;
  if v_draft.id is null then raise exception 'draft not found'; end if;
  if not public.has_dynamic_job_type_permission('schedule.view_team',v_draft.job_type_id,v_user) then
    raise exception 'not allowed';
  end if;
  select * into v_job from public.job_types where id=v_draft.job_type_id;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'userId', m.user_id,
      'monthlyUnlimited', sub.target_unlimited,
      'monthlyTarget', case when coalesce((v_job.availability_config->>'showEmployeePreferences')::boolean,true) then sub.target_shifts else null end,
      'weeklyMaximum', case when coalesce((v_job.availability_config->>'showWeeklyShiftLimit')::boolean,false) then sub.max_weekly_shifts else null end,
      'monthlyEnabled', coalesce((v_job.availability_config->>'showEmployeePreferences')::boolean,true),
      'weeklyEnabled', coalesce((v_job.availability_config->>'showWeeklyShiftLimit')::boolean,false),
      'hasSubmission', sub.id is not null
    ) order by m.user_id)
    from public.job_type_memberships m
    join public.profiles profile on profile.id=m.user_id and profile.is_active=true
    left join public.dynamic_availability_submissions sub
      on sub.period_id=v_draft.availability_period_id and sub.user_id=m.user_id
    where m.job_type_id=v_draft.job_type_id
  ),'[]'::jsonb);
end;
$function$;
commit;
