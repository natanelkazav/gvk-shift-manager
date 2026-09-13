begin;

-- Phase 8.2C hotfix
-- The current dispatcher availability model uses:
--   dispatcher_availability.period_id -> availability_periods.id
--   dispatcher_availability.shift_slot_id -> availability_shift_slots.id
-- It no longer exposes dispatcher_availability.shift_id.
-- Keep the legacy migration bridge aligned with that schema.

create or replace function public.preview_dynamic_legacy_import(
  requested_job_type_id uuid,
  requested_source_kind text
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  current_user_id uuid := auth.uid();
  periods_count integer := 0;
  assignments_count integer := 0;
  availability_count integer := 0;
  imported_periods integer := 0;
  imported_assignments integer := 0;
  imported_availability integer := 0;
  expected_role text;
begin
  if current_user_id is null then
    raise exception 'not authenticated';
  end if;

  if not exists (
    select 1
    from public.user_permissions up
    where up.user_id = current_user_id
      and up.permission_key = 'users.manage'
  ) then
    raise exception 'not allowed';
  end if;

  if requested_source_kind not in ('dispatcher','on_call','morning_driver') then
    raise exception 'invalid source kind';
  end if;

  if not exists (
    select 1 from public.job_types where id = requested_job_type_id
  ) then
    raise exception 'job type not found';
  end if;

  if requested_source_kind = 'dispatcher' then
    select count(*)::integer
    into periods_count
    from public.schedule_periods p
    where p.status::text in ('published','archived');

    select count(*)::integer
    into assignments_count
    from public.schedule_shifts s
    join public.schedule_periods p on p.id = s.period_id
    where p.status::text in ('published','archived');

    -- Dispatcher availability now belongs to availability_periods and slots.
    -- Count entries only for months that have a published/archived dispatcher schedule.
    select count(*)::integer
    into availability_count
    from public.dispatcher_availability a
    join public.availability_periods ap on ap.id = a.period_id
    join public.availability_shift_slots slot on slot.id = a.shift_slot_id
    where exists (
      select 1
      from public.schedule_periods p
      where p.year = ap.year
        and p.month = ap.month
        and p.status::text in ('published','archived')
    );

    expected_role := 'dispatcher';

  elsif requested_source_kind = 'on_call' then
    select count(*)::integer
    into periods_count
    from public.driver_schedule_periods
    where status::text in ('published','archived');

    select count(*)::integer
    into assignments_count
    from public.driver_schedule_days d
    join public.driver_schedule_periods p on p.id = d.period_id
    where p.status::text in ('published','archived');

    expected_role := 'on_call';

  else
    select count(*)::integer
    into periods_count
    from public.morning_driver_schedule_periods
    where status::text in ('published','archived');

    select count(*)::integer
    into assignments_count
    from public.morning_driver_schedule_assignments a
    join public.morning_driver_schedule_periods p
      on p.id = a.schedule_period_id
    where p.status::text in ('published','archived');

    select count(*)::integer
    into availability_count
    from public.morning_driver_availability_entries e
    join public.morning_driver_schedule_periods sp
      on sp.availability_period_id = e.period_id
    where sp.status::text in ('published','archived');

    expected_role := 'morning_driver';
  end if;

  select count(*)::integer
  into imported_periods
  from public.dynamic_historical_periods
  where job_type_id = requested_job_type_id
    and source_kind = requested_source_kind;

  select count(*)::integer
  into imported_assignments
  from public.dynamic_historical_assignments a
  join public.dynamic_historical_periods p
    on p.id = a.historical_period_id
  where p.job_type_id = requested_job_type_id
    and a.source_kind = requested_source_kind;

  select count(*)::integer
  into imported_availability
  from public.dynamic_historical_availability a
  join public.dynamic_historical_periods p
    on p.id = a.historical_period_id
  where p.job_type_id = requested_job_type_id
    and a.source_kind = requested_source_kind;

  return jsonb_build_object(
    'sourceKind', requested_source_kind,
    'expectedLegacyRole', expected_role,
    'periods', periods_count,
    'assignments', assignments_count,
    'availability', availability_count,
    'alreadyImportedPeriods', imported_periods,
    'alreadyImportedAssignments', imported_assignments,
    'alreadyImportedAvailability', imported_availability,
    'newPeriods', greatest(periods_count - imported_periods, 0),
    'newAssignments', greatest(assignments_count - imported_assignments, 0),
    'newAvailability', greatest(availability_count - imported_availability, 0),
    'matchingUsers', (
      select count(*)
      from public.profiles p
      where p.role::text = expected_role
    ),
    'warning', 'הייבוא מעתיק היסטוריה בלבד ואינו מוחק או משנה נתונים במערכת הישנה'
  );
end;
$function$;

revoke all on function public.preview_dynamic_legacy_import(uuid,text) from public;
grant execute on function public.preview_dynamic_legacy_import(uuid,text) to authenticated;

create or replace function public.import_dynamic_legacy_history(
  requested_job_type_id uuid,
  requested_source_kind text
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  current_user_id uuid := auth.uid();
  batch_id uuid;
  periods_added integer := 0;
  assignments_added integer := 0;
  availability_added integer := 0;
begin
  if current_user_id is null then
    raise exception 'not authenticated';
  end if;

  if not exists (
    select 1
    from public.user_permissions up
    where up.user_id = current_user_id
      and up.permission_key = 'users.manage'
  ) then
    raise exception 'not allowed';
  end if;

  if requested_source_kind not in ('dispatcher','on_call','morning_driver') then
    raise exception 'invalid source kind';
  end if;

  if not exists (
    select 1 from public.job_types where id = requested_job_type_id
  ) then
    raise exception 'job type not found';
  end if;

  insert into public.dynamic_legacy_import_batches(
    job_type_id,
    source_kind,
    status,
    created_by
  )
  values (
    requested_job_type_id,
    requested_source_kind,
    'running',
    current_user_id
  )
  returning id into batch_id;

  if requested_source_kind = 'dispatcher' then
    insert into public.dynamic_historical_periods(
      job_type_id,
      source_kind,
      source_period_id,
      year,
      month,
      source_status,
      imported_batch_id,
      source_payload
    )
    select
      requested_job_type_id,
      'dispatcher',
      p.id,
      p.year,
      p.month,
      p.status::text,
      batch_id,
      to_jsonb(p)
    from public.schedule_periods p
    where p.status::text in ('published','archived')
    on conflict(job_type_id,source_kind,source_period_id) do nothing;

    get diagnostics periods_added = row_count;

    insert into public.dynamic_historical_assignments(
      historical_period_id,
      source_kind,
      source_record_id,
      work_date,
      starts_at,
      ends_at,
      shift_code,
      assigned_user_id,
      is_intentionally_unassigned,
      source_payload
    )
    select
      hp.id,
      'dispatcher',
      s.id,
      s.shift_date,
      s.starts_at,
      s.ends_at,
      s.shift_code,
      s.assigned_user_id,
      coalesce((to_jsonb(s)->>'is_intentionally_unassigned')::boolean,false),
      to_jsonb(s)
    from public.schedule_shifts s
    join public.schedule_periods p on p.id = s.period_id
    join public.dynamic_historical_periods hp
      on hp.job_type_id = requested_job_type_id
     and hp.source_kind = 'dispatcher'
     and hp.source_period_id = p.id
    where p.status::text in ('published','archived')
    on conflict(historical_period_id,source_kind,source_record_id) do nothing;

    get diagnostics assignments_added = row_count;

    -- Map the current availability model to the imported schedule period by month.
    -- The source payload keeps both the availability entry and its slot for auditability.
    insert into public.dynamic_historical_availability(
      historical_period_id,
      source_kind,
      source_record_id,
      user_id,
      work_date,
      status,
      note,
      source_payload
    )
    select
      hp_match.id,
      'dispatcher',
      a.id,
      a.user_id,
      slot.shift_date,
      a.availability_status::text,
      a.note,
      jsonb_build_object(
        'entry', to_jsonb(a),
        'slot', to_jsonb(slot),
        'availabilityPeriod', to_jsonb(ap)
      )
    from public.dispatcher_availability a
    join public.availability_periods ap on ap.id = a.period_id
    join public.availability_shift_slots slot on slot.id = a.shift_slot_id
    join lateral (
      select hp.id
      from public.dynamic_historical_periods hp
      where hp.job_type_id = requested_job_type_id
        and hp.source_kind = 'dispatcher'
        and hp.year = ap.year
        and hp.month = ap.month
        and hp.source_status in ('published','archived')
      order by hp.created_at desc, hp.id
      limit 1
    ) hp_match on true
    on conflict(historical_period_id,source_kind,source_record_id) do nothing;

    get diagnostics availability_added = row_count;

  elsif requested_source_kind = 'on_call' then
    insert into public.dynamic_historical_periods(
      job_type_id,source_kind,source_period_id,year,month,source_status,imported_batch_id,source_payload
    )
    select requested_job_type_id,'on_call',p.id,p.year,p.month,p.status::text,batch_id,to_jsonb(p)
    from public.driver_schedule_periods p
    where p.status::text in ('published','archived')
    on conflict(job_type_id,source_kind,source_period_id) do nothing;
    get diagnostics periods_added = row_count;

    insert into public.dynamic_historical_assignments(
      historical_period_id,source_kind,source_record_id,work_date,original_user_id,assigned_user_id,is_intentionally_unassigned,source_payload
    )
    select hp.id,'on_call',d.id,d.duty_date,d.original_user_id,d.assigned_user_id,
      coalesce((to_jsonb(d)->>'is_intentionally_unassigned')::boolean,false),to_jsonb(d)
    from public.driver_schedule_days d
    join public.driver_schedule_periods p on p.id=d.period_id
    join public.dynamic_historical_periods hp
      on hp.job_type_id=requested_job_type_id
     and hp.source_kind='on_call'
     and hp.source_period_id=p.id
    where p.status::text in ('published','archived')
    on conflict(historical_period_id,source_kind,source_record_id) do nothing;
    get diagnostics assignments_added = row_count;

  else
    insert into public.dynamic_historical_periods(
      job_type_id,source_kind,source_period_id,year,month,source_status,imported_batch_id,source_payload
    )
    select requested_job_type_id,'morning_driver',p.id,p.year,p.month,p.status::text,batch_id,to_jsonb(p)
    from public.morning_driver_schedule_periods p
    where p.status::text in ('published','archived')
    on conflict(job_type_id,source_kind,source_period_id) do nothing;
    get diagnostics periods_added = row_count;

    insert into public.dynamic_historical_assignments(
      historical_period_id,source_kind,source_record_id,work_date,starts_at,ends_at,shift_code,assigned_user_id,is_intentionally_unassigned,source_payload
    )
    select hp.id,'morning_driver',a.id,s.shift_date,
      case when s.shift_date is not null and s.start_time is not null
        then (s.shift_date + s.start_time)::timestamp at time zone 'Asia/Jerusalem'
        else null end,
      case when s.shift_date is not null and s.end_time is not null
        then ((s.shift_date + s.end_time) + case when s.end_time<=s.start_time then interval '1 day' else interval '0 day' end) at time zone 'Asia/Jerusalem'
        else null end,
      s.id::text,a.assigned_user_id,coalesce(a.is_intentionally_unassigned,false),
      jsonb_build_object('assignment',to_jsonb(a),'shift',to_jsonb(s))
    from public.morning_driver_schedule_assignments a
    join public.morning_driver_schedule_periods p on p.id=a.schedule_period_id
    join public.morning_driver_availability_shifts s on s.id=a.availability_shift_id
    join public.dynamic_historical_periods hp
      on hp.job_type_id=requested_job_type_id
     and hp.source_kind='morning_driver'
     and hp.source_period_id=p.id
    where p.status::text in ('published','archived')
    on conflict(historical_period_id,source_kind,source_record_id) do nothing;
    get diagnostics assignments_added = row_count;

    insert into public.dynamic_historical_availability(
      historical_period_id,source_kind,source_record_id,user_id,work_date,status,note,source_payload
    )
    select hp.id,'morning_driver',e.id,e.user_id,s.shift_date,e.availability_status::text,e.note,
      jsonb_build_object('entry',to_jsonb(e),'shift',to_jsonb(s))
    from public.morning_driver_availability_entries e
    join public.morning_driver_availability_shifts s on s.id=e.shift_id
    join public.morning_driver_schedule_periods sp
      on sp.availability_period_id=e.period_id
     and sp.status::text in ('published','archived')
    join public.dynamic_historical_periods hp
      on hp.job_type_id=requested_job_type_id
     and hp.source_kind='morning_driver'
     and hp.source_period_id=sp.id
    on conflict(historical_period_id,source_kind,source_record_id) do nothing;
    get diagnostics availability_added = row_count;
  end if;

  update public.dynamic_legacy_import_batches
  set status='completed',
      imported_periods=periods_added,
      imported_assignments=assignments_added,
      imported_availability=availability_added,
      completed_at=now()
  where id=batch_id;

  insert into public.audit_logs(
    user_id,action,entity_type,entity_id,summary,actor_user_id,metadata
  )
  values(
    current_user_id,
    'dynamic_job_type.legacy_history.imported',
    'job_type',
    requested_job_type_id,
    'יובאה היסטוריה מהמערכת הישנה לתפקיד דינמי',
    current_user_id,
    jsonb_build_object(
      'sourceKind',requested_source_kind,
      'batchId',batch_id,
      'periods',periods_added,
      'assignments',assignments_added,
      'availability',availability_added
    )
  );

  return jsonb_build_object(
    'batchId',batch_id,
    'periodsImported',periods_added,
    'assignmentsImported',assignments_added,
    'availabilityImported',availability_added,
    'idempotent',true
  );
exception when others then
  if batch_id is not null then
    update public.dynamic_legacy_import_batches
    set status='failed',
        completed_at=now(),
        metadata=jsonb_build_object('error',sqlerrm)
    where id=batch_id;
  end if;
  raise;
end;
$function$;

revoke all on function public.import_dynamic_legacy_history(uuid,text) from public;
grant execute on function public.import_dynamic_legacy_history(uuid,text) to authenticated;

commit;
