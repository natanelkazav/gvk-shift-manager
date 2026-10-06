begin;

-- Durable monthly availability history for every dynamic job type.
-- Closed periods remain the operational source for statistics, while this table
-- keeps an independent immutable copy that can be audited/recovered later.
create table if not exists public.dynamic_availability_period_snapshots (
  id uuid primary key default gen_random_uuid(),
  period_id uuid not null references public.dynamic_availability_periods(id) on delete restrict,
  job_type_id uuid not null references public.job_types(id) on delete restrict,
  year integer not null,
  month integer not null,
  period_status text not null,
  captured_at timestamptz not null default now(),
  snapshot jsonb not null,
  unique(period_id),
  unique(job_type_id, year, month),
  constraint dynamic_availability_snapshot_object check (jsonb_typeof(snapshot)='object')
);

alter table public.dynamic_availability_period_snapshots enable row level security;
revoke all on public.dynamic_availability_period_snapshots from anon, authenticated;

create or replace function public.capture_dynamic_availability_period_snapshot(requested_period_id uuid)
returns void
language plpgsql
security definer
set search_path=''
as $function$
declare
  p public.dynamic_availability_periods%rowtype;
  payload jsonb;
begin
  select * into p from public.dynamic_availability_periods where id=requested_period_id;
  if p.id is null then raise exception 'dynamic availability period not found'; end if;
  if p.status not in ('closed','archived') then raise exception 'snapshot requires a closed or archived period'; end if;

  select jsonb_build_object(
    'period', jsonb_build_object(
      'id',p.id,'jobTypeId',p.job_type_id,'year',p.year,'month',p.month,'title',p.title,
      'status',p.status,'submissionDeadline',p.submission_deadline,'configSnapshot',p.config_snapshot,
      'source',p.source,'createdAt',p.created_at,'updatedAt',p.updated_at
    ),
    'slots', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',s.id,'shiftDate',s.shift_date,'templateId',s.template_id,'shiftCode',s.shift_code,
        'shiftName',s.shift_name,'startTime',s.start_time,'endTime',s.end_time,
        'sourceDayKind',s.source_day_kind,'effectiveDayKind',s.effective_day_kind,
        'holidayName',s.holiday_name,'minWorkers',s.min_workers,'targetWorkers',s.target_workers,
        'maxWorkers',s.max_workers,'paySegmentsSnapshot',s.pay_segments_snapshot,'metadata',s.metadata
      ) order by s.shift_date,s.start_time,s.shift_code)
      from public.dynamic_availability_slots s where s.period_id=p.id
    ),'[]'::jsonb),
    'submissions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',sub.id,'userId',sub.user_id,'status',sub.status,'minShifts',sub.min_shifts,
        'targetShifts',sub.target_shifts,'maxShifts',sub.max_shifts,'maxNights',sub.max_nights,
        'maxWeekends',sub.max_weekends,'maxHolidays',sub.max_holidays,'note',sub.note,
        'submittedAt',sub.submitted_at,'createdAt',sub.created_at,'updatedAt',sub.updated_at,
        'entries',coalesce((
          select jsonb_agg(jsonb_build_object(
            'slotId',e.slot_id,'status',e.availability_status,'note',e.note,
            'createdAt',e.created_at,'updatedAt',e.updated_at
          ) order by sl.shift_date,sl.start_time,sl.shift_code)
          from public.dynamic_availability_entries e
          join public.dynamic_availability_slots sl on sl.id=e.slot_id
          where e.submission_id=sub.id
        ),'[]'::jsonb)
      ) order by sub.user_id)
      from public.dynamic_availability_submissions sub where sub.period_id=p.id
    ),'[]'::jsonb)
  ) into payload;

  insert into public.dynamic_availability_period_snapshots(period_id,job_type_id,year,month,period_status,captured_at,snapshot)
  values(p.id,p.job_type_id,p.year,p.month,p.status,now(),payload)
  on conflict(period_id) do update set
    job_type_id=excluded.job_type_id,year=excluded.year,month=excluded.month,
    period_status=excluded.period_status,captured_at=excluded.captured_at,snapshot=excluded.snapshot;
end;
$function$;

-- Prevent accidental mutation of historical availability after a period is closed.
-- Reopening the period intentionally makes it editable again; closing it recaptures the snapshot.
create or replace function public.guard_closed_dynamic_availability_history()
returns trigger
language plpgsql
set search_path=''
as $function$
declare
  target_period_id uuid;
  target_status text;
begin
  if tg_table_name='dynamic_availability_submissions' then
    target_period_id:=coalesce(new.period_id,old.period_id);
  elsif tg_table_name='dynamic_availability_entries' then
    select s.period_id into target_period_id
    from public.dynamic_availability_submissions s
    where s.id=coalesce(new.submission_id,old.submission_id);
  elsif tg_table_name='dynamic_availability_slots' then
    target_period_id:=coalesce(new.period_id,old.period_id);
  end if;

  select p.status into target_status from public.dynamic_availability_periods p where p.id=target_period_id;
  if target_status in ('closed','archived') then
    raise exception 'closed dynamic availability history is immutable; reopen the period before editing';
  end if;
  return coalesce(new,old);
end;
$function$;

drop trigger if exists guard_closed_dynamic_availability_submissions on public.dynamic_availability_submissions;
create trigger guard_closed_dynamic_availability_submissions
before update on public.dynamic_availability_submissions
for each row execute function public.guard_closed_dynamic_availability_history();

drop trigger if exists guard_closed_dynamic_availability_entries on public.dynamic_availability_entries;
create trigger guard_closed_dynamic_availability_entries
before update on public.dynamic_availability_entries
for each row execute function public.guard_closed_dynamic_availability_history();

drop trigger if exists guard_closed_dynamic_availability_slots on public.dynamic_availability_slots;
create trigger guard_closed_dynamic_availability_slots
before update on public.dynamic_availability_slots
for each row execute function public.guard_closed_dynamic_availability_history();

-- Extend the existing workflow: every close now captures a full monthly snapshot.
create or replace function public.set_dynamic_period_status(
  requested_job_type_id uuid,
  requested_year integer,
  requested_month integer,
  requested_action text
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  current_user_id uuid:=auth.uid();
  target_period public.dynamic_availability_periods%rowtype;
  next_status text;
  slot_count integer:=0;
begin
  if current_user_id is null then raise exception 'not authenticated'; end if;
  if requested_action = 'open' then
    if not public.has_dynamic_job_type_permission('availability.open_period', requested_job_type_id, current_user_id) then raise exception 'not allowed'; end if;
  elsif requested_action in ('close','archive') then
    if not public.has_dynamic_job_type_permission('availability.close_period', requested_job_type_id, current_user_id) then raise exception 'not allowed'; end if;
  else
    raise exception 'invalid period action';
  end if;

  select * into target_period
  from public.dynamic_availability_periods
  where job_type_id=requested_job_type_id and year=requested_year and month=requested_month;

  if target_period.id is null then raise exception 'dynamic period not found'; end if;

  if requested_action='open' and target_period.status in ('shadow','draft','closed','open') then
    perform public.materialize_dynamic_availability_period_slots(target_period.id);
    next_status:='open';
  elsif requested_action='close' and target_period.status='open' then
    next_status:='closed';
  elsif requested_action='archive' and target_period.status='closed' and exists(
    select 1 from public.dynamic_schedule_publications p
    where p.job_type_id=requested_job_type_id and p.year=requested_year and p.month=requested_month
  ) then
    next_status:='archived';
  else
    raise exception 'invalid period transition from % using %',target_period.status,requested_action;
  end if;

  update public.dynamic_availability_periods
  set status=next_status,updated_at=now()
  where id=target_period.id;

  if next_status in ('closed','archived') then
    perform public.capture_dynamic_availability_period_snapshot(target_period.id);
  end if;

  select count(*) into slot_count
  from public.dynamic_availability_slots
  where period_id=target_period.id;

  return jsonb_build_object(
    'periodId',target_period.id,
    'status',next_status,
    'action',requested_action,
    'slotCount',slot_count,
    'snapshotCaptured',next_status in ('closed','archived')
  );
end;
$function$;

-- Backfill snapshots for every already-closed/archived dynamic period.
do $backfill$
declare r record;
begin
  for r in select id from public.dynamic_availability_periods where status in ('closed','archived') loop
    perform public.capture_dynamic_availability_period_snapshot(r.id);
  end loop;
end;
$backfill$;

grant execute on function public.set_dynamic_period_status(uuid,integer,integer,text) to authenticated;

commit;
