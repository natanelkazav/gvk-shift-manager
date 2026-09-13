begin;

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
  returning id into v_submission_id;

  for entry_item in select value from jsonb_array_elements(coalesce(requested_payload->'entries','[]'::jsonb)) loop
    insert into public.dynamic_availability_entries(submission_id,slot_id,availability_status,note)
    values(v_submission_id,(entry_item->>'slotId')::uuid,entry_item->>'status',nullif(trim(coalesce(entry_item->>'note','')),''))
    on conflict(submission_id,slot_id) do update set availability_status=excluded.availability_status,note=excluded.note,updated_at=now();
  end loop;

  return jsonb_build_object('saved',true,'submissionId',v_submission_id,'status',requested_submission_status,'filledCount',valid_entry_count,'totalSlots',total_slot_count);
end;
$function$;

revoke all on function public.save_my_dynamic_availability_submission(uuid,integer,integer,jsonb) from public;
grant execute on function public.save_my_dynamic_availability_submission(uuid,integer,integer,jsonb) to authenticated;

commit;
