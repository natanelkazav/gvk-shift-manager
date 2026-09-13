begin;

-- Phase 6: end-to-end Dynamic Availability workspace + legacy structural comparison.
-- SHADOW ONLY. Existing production availability/schedule flows are untouched.

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
begin
  if current_user_id is null then raise exception 'not authenticated'; end if;
  if not exists(select 1 from public.user_permissions up where up.user_id=current_user_id and up.permission_key in ('users.view','users.manage')) then raise exception 'not allowed'; end if;
  select * into job from public.job_types where id=requested_job_type_id;
  if job.id is null then raise exception 'job type not found'; end if;
  select * into period from public.dynamic_availability_periods where job_type_id=job.id and year=requested_year and month=requested_month;

  return jsonb_build_object(
    'materialized', period.id is not null,
    'mode','shadow',
    'periodId',period.id,
    'jobTypeId',job.id,
    'jobTypeName',job.name,
    'availabilityConfig',job.availability_config,
    'slots',case when period.id is null then '[]'::jsonb else coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',s.id,'date',s.shift_date,'shiftCode',s.shift_code,'shiftName',s.shift_name,
        'startTime',s.start_time,'endTime',s.end_time,'holidayName',s.holiday_name,
        'sourceDayKind',s.source_day_kind,'effectiveDayKind',s.effective_day_kind,
        'minWorkers',s.min_workers,'targetWorkers',s.target_workers,'maxWorkers',s.max_workers
      ) order by s.shift_date,s.start_time,s.shift_code)
      from public.dynamic_availability_slots s where s.period_id=period.id
    ),'[]'::jsonb) end,
    'members',coalesce((
      select jsonb_agg(jsonb_build_object(
        'userId',m.user_id,'displayName',p.display_name,'isActive',p.is_active,
        'submissionId',sub.id,'status',coalesce(sub.status,'draft'),
        'minimum',sub.min_shifts,'target',sub.target_shifts,'maximum',sub.max_shifts,
        'maxNights',sub.max_nights,'maxWeekends',sub.max_weekends,'maxHolidays',sub.max_holidays,
        'note',sub.note,
        'entries',coalesce((select jsonb_object_agg(e.slot_id::text,jsonb_build_object('status',e.availability_status,'note',e.note)) from public.dynamic_availability_entries e where e.submission_id=sub.id),'{}'::jsonb)
      ) order by p.is_active desc,p.display_name)
      from public.job_type_memberships m join public.profiles p on p.id=m.user_id
      left join public.dynamic_availability_submissions sub on sub.period_id=period.id and sub.user_id=m.user_id
      where m.job_type_id=job.id
    ),'[]'::jsonb)
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
  submission_id uuid;
  entry_item jsonb;
  allowed_statuses jsonb;
  requested_status text;
begin
  if current_user_id is null then raise exception 'not authenticated'; end if;
  if not exists(select 1 from public.user_permissions up where up.user_id=current_user_id and up.permission_key='users.manage') then raise exception 'not allowed'; end if;
  select * into job from public.job_types where id=requested_job_type_id;
  if job.id is null then raise exception 'job type not found'; end if;
  if not exists(select 1 from public.job_type_memberships m where m.job_type_id=job.id and m.user_id=requested_user_id) then raise exception 'user is not a member of this job type'; end if;
  select * into period from public.dynamic_availability_periods where job_type_id=job.id and year=requested_year and month=requested_month;
  if period.id is null then raise exception 'shadow period not materialized'; end if;

  insert into public.dynamic_availability_submissions(period_id,user_id,status,min_shifts,target_shifts,max_shifts,max_nights,max_weekends,max_holidays,note,submitted_at)
  values(period.id,requested_user_id,coalesce(requested_payload->>'submissionStatus','draft'),
    nullif(requested_payload->>'minimum','')::integer,nullif(requested_payload->>'target','')::integer,nullif(requested_payload->>'maximum','')::integer,
    nullif(requested_payload->>'maxNights','')::integer,nullif(requested_payload->>'maxWeekends','')::integer,nullif(requested_payload->>'maxHolidays','')::integer,
    nullif(trim(coalesce(requested_payload->>'note','')),''),case when coalesce(requested_payload->>'submissionStatus','draft')='submitted' then now() else null end)
  on conflict(period_id,user_id) do update set
    status=excluded.status,min_shifts=excluded.min_shifts,target_shifts=excluded.target_shifts,max_shifts=excluded.max_shifts,
    max_nights=excluded.max_nights,max_weekends=excluded.max_weekends,max_holidays=excluded.max_holidays,note=excluded.note,
    submitted_at=excluded.submitted_at,updated_at=now()
  returning id into submission_id;

  allowed_statuses:=coalesce(job.availability_config->'statuses','["available","unavailable"]'::jsonb);
  for entry_item in select value from jsonb_array_elements(coalesce(requested_payload->'entries','[]'::jsonb)) loop
    requested_status:=entry_item->>'status';
    if not (allowed_statuses ? requested_status) then raise exception 'availability status % is not enabled for this job type',requested_status; end if;
    if not exists(select 1 from public.dynamic_availability_slots s where s.id=(entry_item->>'slotId')::uuid and s.period_id=period.id) then raise exception 'slot does not belong to period'; end if;
    insert into public.dynamic_availability_entries(submission_id,slot_id,availability_status,note)
    values(submission_id,(entry_item->>'slotId')::uuid,requested_status,nullif(trim(coalesce(entry_item->>'note','')),''))
    on conflict(submission_id,slot_id) do update set availability_status=excluded.availability_status,note=excluded.note,updated_at=now();
  end loop;

  return jsonb_build_object('saved',true,'mode','shadow','submissionId',submission_id);
end;
$function$;

create or replace function public.compare_dynamic_availability_shadow_to_legacy(
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
  current_user_id uuid:=auth.uid(); job public.job_types%rowtype; period public.dynamic_availability_periods%rowtype;
  dynamic_slots integer:=0; dynamic_members integer:=0; dynamic_entries integer:=0; legacy_slots integer:=0; legacy_entries integer:=0; legacy_members integer:=0;
  supported boolean:=true; note text:=null;
begin
  if current_user_id is null then raise exception 'not authenticated'; end if;
  if not exists(select 1 from public.user_permissions up where up.user_id=current_user_id and up.permission_key in ('users.view','users.manage')) then raise exception 'not allowed'; end if;
  select * into job from public.job_types where id=requested_job_type_id;
  select * into period from public.dynamic_availability_periods where job_type_id=job.id and year=requested_year and month=requested_month;
  if period.id is not null then
    select count(*) into dynamic_slots from public.dynamic_availability_slots where period_id=period.id;
    select count(*) into dynamic_members from public.job_type_memberships where job_type_id=job.id;
    select count(*) into dynamic_entries from public.dynamic_availability_entries e join public.dynamic_availability_submissions s on s.id=e.submission_id where s.period_id=period.id;
  end if;

  if job.legacy_role='dispatcher' then
    select count(*) into legacy_slots from public.schedule_shifts ss join public.schedule_periods sp on sp.id=ss.period_id where sp.year=requested_year and sp.month=requested_month;
    select count(distinct da.user_id),count(*) into legacy_members,legacy_entries from public.dispatcher_availability da join public.schedule_shifts ss on ss.id=da.shift_id join public.schedule_periods sp on sp.id=ss.period_id where sp.year=requested_year and sp.month=requested_month;
  else
    supported:=false;
    note:='השוואה אוטומטית מלאה ל־Legacy עבור סוג תפקיד זה תתווסף בזמן הסבת ה־flow הישן. נתוני ה־Dynamic עדיין מוצגים במלואם.';
  end if;

  return jsonb_build_object('mode','shadow','supported',supported,'legacyRole',job.legacy_role,'note',note,
    'dynamic',jsonb_build_object('slots',dynamic_slots,'members',dynamic_members,'entries',dynamic_entries),
    'legacy',jsonb_build_object('slots',legacy_slots,'members',legacy_members,'entries',legacy_entries),
    'slotDelta',dynamic_slots-legacy_slots,'memberDelta',dynamic_members-legacy_members,'entryDelta',dynamic_entries-legacy_entries);
end;
$function$;

revoke all on function public.get_dynamic_availability_shadow_workspace(uuid,integer,integer) from public;
revoke all on function public.save_dynamic_availability_shadow_submission(uuid,integer,integer,uuid,jsonb) from public;
revoke all on function public.compare_dynamic_availability_shadow_to_legacy(uuid,integer,integer) from public;
grant execute on function public.get_dynamic_availability_shadow_workspace(uuid,integer,integer) to authenticated;
grant execute on function public.save_dynamic_availability_shadow_submission(uuid,integer,integer,uuid,jsonb) to authenticated;
grant execute on function public.compare_dynamic_availability_shadow_to_legacy(uuid,integer,integer) to authenticated;

update public.scheduling_feature_flags
set config=config || jsonb_build_object('phase','6','mode','shadow','availability_ui','shadow_admin_workspace','legacy_comparison','dispatcher_structural'),updated_at=now()
where key='dynamic_job_types';

commit;
