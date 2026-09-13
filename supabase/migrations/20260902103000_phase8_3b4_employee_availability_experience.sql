begin;

create or replace function public.get_my_dynamic_availability_periods()
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then raise exception 'not authenticated'; end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'jobTypeId',jt.id,
      'jobTypeName',jt.name,
      'year',p.year,
      'month',p.month,
      'periodId',p.id,
      'periodStatus',p.status,
      'submissionDeadline',p.submission_deadline,
      'slotCount',(select count(*) from public.dynamic_availability_slots s where s.period_id=p.id),
      'submissionStatus',sub.status,
      'submittedAt',sub.submitted_at,
      'filledCount',(select count(*) from public.dynamic_availability_entries e where e.submission_id=sub.id)
    ) order by p.year desc,p.month desc,jt.name)
    from public.job_type_memberships m
    join public.job_types jt on jt.id=m.job_type_id and jt.is_active=true
    join public.dynamic_availability_periods p on p.job_type_id=jt.id
    left join public.dynamic_availability_submissions sub on sub.period_id=p.id and sub.user_id=current_user_id
    where m.user_id=current_user_id
      and coalesce((jt.availability_config->>'enabled')::boolean,true)=true
      and p.status in ('open','closed','archived')
      and make_date(p.year,p.month,1) >= (date_trunc('month',now() at time zone 'Asia/Jerusalem')::date - interval '2 months')::date
  ),'[]'::jsonb);
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
begin
  if current_user_id is null then raise exception 'not authenticated'; end if;
  if not exists(select 1 from public.job_type_memberships m where m.user_id=current_user_id and m.job_type_id=requested_job_type_id) then
    raise exception 'not a member of this job type';
  end if;

  select * into job from public.job_types where id=requested_job_type_id and is_active=true;
  if job.id is null then raise exception 'job type not found'; end if;
  select * into period from public.dynamic_availability_periods where job_type_id=job.id and year=requested_year and month=requested_month;
  if period.id is null then raise exception 'dynamic period not found'; end if;
  if period.status not in ('open','closed','archived') then raise exception 'period is not available to employees'; end if;
  select * into sub from public.dynamic_availability_submissions where period_id=period.id and user_id=current_user_id;

  normalized_config:=jsonb_build_object(
    'enabled',coalesce((job.availability_config->>'enabled')::boolean,true),
    'statuses',case when jsonb_typeof(job.availability_config->'statuses')='array' and jsonb_array_length(job.availability_config->'statuses')>0 then job.availability_config->'statuses' else '["available","unavailable"]'::jsonb end,
    'allowNotes',coalesce((job.availability_config->>'allowNotes')::boolean,true),
    'monthlyCapacity',coalesce(job.availability_config->'monthlyCapacity','{"enabled":false,"minEnabled":false,"targetEnabled":false,"maxEnabled":false,"defaultMin":null,"defaultTarget":null,"defaultMax":null}'::jsonb),
    'limits',coalesce(job.availability_config->'limits','{"maxNightsEnabled":false,"defaultMaxNights":null,"maxWeekendsEnabled":false,"defaultMaxWeekends":null,"maxHolidaysEnabled":false,"defaultMaxHolidays":null}'::jsonb)
  );

  return jsonb_build_object(
    'materialized',true,'mode','shadow','periodId',period.id,'jobTypeId',job.id,'jobTypeName',job.name,'availabilityConfig',normalized_config,
    'slots',coalesce((select jsonb_agg(jsonb_build_object(
      'id',s.id,'date',s.shift_date,'shiftCode',s.shift_code,'shiftName',s.shift_name,'startTime',s.start_time,'endTime',s.end_time,
      'holidayName',s.holiday_name,'sourceDayKind',s.source_day_kind,'effectiveDayKind',s.effective_day_kind,
      'minWorkers',s.min_workers,'targetWorkers',s.target_workers,'maxWorkers',s.max_workers
    ) order by s.shift_date,s.start_time,s.shift_code) from public.dynamic_availability_slots s where s.period_id=period.id),'[]'::jsonb),
    'members',jsonb_build_array(jsonb_build_object(
      'userId',current_user_id,
      'displayName',(select display_name from public.profiles where id=current_user_id),
      'isActive',coalesce((select is_active from public.profiles where id=current_user_id),true),
      'submissionId',sub.id,'status',coalesce(sub.status,'draft'),'minimum',sub.min_shifts,'target',sub.target_shifts,'maximum',sub.max_shifts,
      'maxNights',sub.max_nights,'maxWeekends',sub.max_weekends,'maxHolidays',sub.max_holidays,'note',sub.note,
      'entries',coalesce((select jsonb_object_agg(e.slot_id::text,jsonb_build_object('status',e.availability_status,'note',e.note)) from public.dynamic_availability_entries e where e.submission_id=sub.id),'{}'::jsonb)
    ))
  );
end;
$function$;

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
  submission_id uuid;
  entry_item jsonb;
  allowed_statuses jsonb;
  requested_status text;
  requested_submission_status text;
  valid_entry_count integer:=0;
  total_slot_count integer:=0;
begin
  if current_user_id is null then raise exception 'not authenticated'; end if;
  if not exists(select 1 from public.job_type_memberships m where m.user_id=current_user_id and m.job_type_id=requested_job_type_id) then raise exception 'not a member of this job type'; end if;
  select * into job from public.job_types where id=requested_job_type_id and is_active=true;
  if job.id is null then raise exception 'job type not found'; end if;
  select * into period from public.dynamic_availability_periods where job_type_id=job.id and year=requested_year and month=requested_month;
  if period.id is null then raise exception 'dynamic period not found'; end if;
  if period.status <> 'open' then raise exception 'availability period is not open'; end if;
  if period.submission_deadline is not null and now()>period.submission_deadline then raise exception 'submission deadline has passed'; end if;

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
  returning id into submission_id;

  for entry_item in select value from jsonb_array_elements(coalesce(requested_payload->'entries','[]'::jsonb)) loop
    insert into public.dynamic_availability_entries(submission_id,slot_id,availability_status,note)
    values(submission_id,(entry_item->>'slotId')::uuid,entry_item->>'status',nullif(trim(coalesce(entry_item->>'note','')),''))
    on conflict(submission_id,slot_id) do update set availability_status=excluded.availability_status,note=excluded.note,updated_at=now();
  end loop;

  return jsonb_build_object('saved',true,'submissionId',submission_id,'status',requested_submission_status,'filledCount',valid_entry_count,'totalSlots',total_slot_count);
end;
$function$;

revoke all on function public.get_my_dynamic_availability_periods() from public;
revoke all on function public.get_my_dynamic_availability_workspace(uuid,integer,integer) from public;
revoke all on function public.save_my_dynamic_availability_submission(uuid,integer,integer,jsonb) from public;
grant execute on function public.get_my_dynamic_availability_periods() to authenticated;
grant execute on function public.get_my_dynamic_availability_workspace(uuid,integer,integer) to authenticated;
grant execute on function public.save_my_dynamic_availability_submission(uuid,integer,integer,jsonb) to authenticated;

commit;
