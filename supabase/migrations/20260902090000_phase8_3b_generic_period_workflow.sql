begin;

create table if not exists public.dynamic_schedule_publications (
  id uuid primary key default gen_random_uuid(),
  job_type_id uuid not null references public.job_types(id) on delete restrict,
  availability_period_id uuid not null references public.dynamic_availability_periods(id) on delete restrict,
  draft_id uuid not null references public.dynamic_schedule_shadow_drafts(id) on delete restrict,
  year integer not null check (year between 2020 and 2100),
  month integer not null check (month between 1 and 12),
  status text not null default 'published' check (status in ('published','archived')),
  config_snapshot jsonb not null default '{}'::jsonb,
  published_by uuid references public.profiles(id) on delete set null,
  published_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(job_type_id, year, month)
);

create table if not exists public.dynamic_schedule_published_assignments (
  id uuid primary key default gen_random_uuid(),
  publication_id uuid not null references public.dynamic_schedule_publications(id) on delete cascade,
  source_assignment_id uuid references public.dynamic_schedule_shadow_assignments(id) on delete set null,
  slot_id uuid references public.dynamic_availability_slots(id) on delete set null,
  shift_date date not null,
  shift_code text not null,
  shift_name text not null,
  start_time time not null,
  end_time time not null,
  user_id uuid not null references public.profiles(id) on delete restrict,
  assignment_tier text not null,
  score numeric not null default 0,
  reasons jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique(publication_id, shift_date, shift_code, user_id)
);

create index if not exists dynamic_schedule_publications_job_month_idx
  on public.dynamic_schedule_publications(job_type_id, year, month);
create index if not exists dynamic_schedule_published_assignments_publication_date_idx
  on public.dynamic_schedule_published_assignments(publication_id, shift_date);

alter table public.dynamic_schedule_publications enable row level security;
alter table public.dynamic_schedule_published_assignments enable row level security;
revoke all on public.dynamic_schedule_publications from anon, authenticated;
revoke all on public.dynamic_schedule_published_assignments from anon, authenticated;

create or replace function public.get_dynamic_period_workflow(
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
  target_job public.job_types%rowtype;
  target_period public.dynamic_availability_periods%rowtype;
  latest_draft public.dynamic_schedule_shadow_drafts%rowtype;
  publication public.dynamic_schedule_publications%rowtype;
  member_count integer := 0;
  slot_count integer := 0;
  submission_count integer := 0;
  submitted_count integer := 0;
  assignment_count integer := 0;
begin
  if current_user_id is null then raise exception 'not authenticated'; end if;
  if not exists (
    select 1 from public.user_permissions up
    where up.user_id=current_user_id and up.permission_key in ('users.view','users.manage')
  ) then raise exception 'not allowed'; end if;
  if requested_month not between 1 and 12 then raise exception 'invalid month'; end if;

  select * into target_job from public.job_types where id=requested_job_type_id;
  if target_job.id is null then raise exception 'job type not found'; end if;

  select count(*) into member_count
  from public.job_type_memberships m
  join public.profiles p on p.id=m.user_id
  where m.job_type_id=target_job.id and p.is_active=true;

  select * into target_period
  from public.dynamic_availability_periods
  where job_type_id=target_job.id and year=requested_year and month=requested_month;

  if target_period.id is not null then
    select count(*) into slot_count from public.dynamic_availability_slots where period_id=target_period.id;
    select count(*), count(*) filter (where status='submitted')
      into submission_count, submitted_count
    from public.dynamic_availability_submissions where period_id=target_period.id;

    select * into latest_draft
    from public.dynamic_schedule_shadow_drafts
    where job_type_id=target_job.id and year=requested_year and month=requested_month
    order by created_at desc limit 1;
  end if;

  select * into publication
  from public.dynamic_schedule_publications
  where job_type_id=target_job.id and year=requested_year and month=requested_month;

  if publication.id is not null then
    select count(*) into assignment_count
    from public.dynamic_schedule_published_assignments where publication_id=publication.id;
  end if;

  return jsonb_build_object(
    'jobTypeId', target_job.id,
    'jobTypeName', target_job.name,
    'year', requested_year,
    'month', requested_month,
    'memberCount', member_count,
    'availabilityEnabled', coalesce((target_job.availability_config->>'enabled')::boolean,false),
    'schedulingStrategy', coalesce(target_job.scheduling_strategy, target_job.scheduling_config->>'schedulingStrategy','availability_optimizer'),
    'period', case when target_period.id is null then null else jsonb_build_object(
      'id',target_period.id,'status',target_period.status,'title',target_period.title,
      'submissionDeadline',target_period.submission_deadline,'slotCount',slot_count,
      'submissionCount',submission_count,'submittedCount',submitted_count
    ) end,
    'draft', case when latest_draft.id is null then null else jsonb_build_object(
      'id',latest_draft.id,'status',latest_draft.status,'metrics',latest_draft.metrics,
      'createdAt',latest_draft.created_at,'updatedAt',latest_draft.updated_at
    ) end,
    'publication', case when publication.id is null then null else jsonb_build_object(
      'id',publication.id,'status',publication.status,'publishedAt',publication.published_at,
      'assignmentCount',assignment_count
    ) end
  );
end;
$function$;

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
begin
  if current_user_id is null then raise exception 'not authenticated'; end if;
  if not exists(select 1 from public.user_permissions up where up.user_id=current_user_id and up.permission_key='users.manage') then
    raise exception 'not allowed';
  end if;

  select * into target_period from public.dynamic_availability_periods
  where job_type_id=requested_job_type_id and year=requested_year and month=requested_month;
  if target_period.id is null then raise exception 'dynamic period not found'; end if;

  if requested_action='open' and target_period.status in ('shadow','draft','closed') then
    next_status:='open';
  elsif requested_action='close' and target_period.status='open' then
    next_status:='closed';
  elsif requested_action='archive' and target_period.status='closed' and exists(
    select 1 from public.dynamic_schedule_publications p
    where p.job_type_id=requested_job_type_id and p.year=requested_year and p.month=requested_month
  ) then
    next_status:='archived';
  else
    raise exception 'invalid period transition from % using %', target_period.status, requested_action;
  end if;

  update public.dynamic_availability_periods
  set status=next_status, updated_at=now()
  where id=target_period.id;

  return jsonb_build_object('periodId',target_period.id,'status',next_status,'action',requested_action);
end;
$function$;

create or replace function public.publish_dynamic_schedule_draft(
  requested_draft_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  current_user_id uuid:=auth.uid();
  target_draft public.dynamic_schedule_shadow_drafts%rowtype;
  target_job public.job_types%rowtype;
  target_period public.dynamic_availability_periods%rowtype;
  v_publication_id uuid;
  inserted_assignments integer:=0;
  unfilled integer:=0;
begin
  if current_user_id is null then raise exception 'not authenticated'; end if;
  if not exists(select 1 from public.user_permissions up where up.user_id=current_user_id and up.permission_key='users.manage') then
    raise exception 'not allowed';
  end if;

  select * into target_draft from public.dynamic_schedule_shadow_drafts where id=requested_draft_id;
  if target_draft.id is null then raise exception 'draft not found'; end if;
  select * into target_job from public.job_types where id=target_draft.job_type_id;
  select * into target_period from public.dynamic_availability_periods where id=target_draft.availability_period_id;

  if target_period.status <> 'closed' then raise exception 'availability period must be closed before publishing'; end if;
  if target_draft.status not in ('generated','incomplete') then raise exception 'draft is not ready for publishing'; end if;
  unfilled:=coalesce((target_draft.metrics->>'unfilledRequiredPositions')::integer,0);
  if unfilled>0 then raise exception 'draft has % unfilled required positions',unfilled; end if;

  insert into public.dynamic_schedule_publications(
    job_type_id,availability_period_id,draft_id,year,month,status,config_snapshot,published_by,published_at,updated_at
  ) values(
    target_draft.job_type_id,target_draft.availability_period_id,target_draft.id,target_draft.year,target_draft.month,'published',
    jsonb_build_object('jobType',target_job.scheduling_config,'draftMetrics',target_draft.metrics),current_user_id,now(),now()
  )
  on conflict(job_type_id,year,month) do update set
    availability_period_id=excluded.availability_period_id,draft_id=excluded.draft_id,status='published',
    config_snapshot=excluded.config_snapshot,published_by=excluded.published_by,published_at=now(),updated_at=now()
  returning id into v_publication_id;

  delete from public.dynamic_schedule_published_assignments where publication_id=v_publication_id;

  insert into public.dynamic_schedule_published_assignments(
    publication_id,source_assignment_id,slot_id,shift_date,shift_code,shift_name,start_time,end_time,user_id,
    assignment_tier,score,reasons
  )
  select v_publication_id,a.id,s.id,s.shift_date,s.shift_code,s.shift_name,s.start_time,s.end_time,a.user_id,
         a.assignment_tier,a.score,a.reasons
  from public.dynamic_schedule_shadow_assignments a
  join public.dynamic_availability_slots s on s.id=a.slot_id
  where a.draft_id=target_draft.id;
  get diagnostics inserted_assignments = row_count;

  return jsonb_build_object('publicationId',v_publication_id,'published',true,'assignmentCount',inserted_assignments);
end;
$function$;

-- Closed periods are immutable in the generic workflow. Shadow/draft remain writable for old QA tools.
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
  if period.status in ('closed','archived') then raise exception 'availability period is closed'; end if;

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

revoke all on function public.get_dynamic_period_workflow(uuid,integer,integer) from public;
revoke all on function public.set_dynamic_period_status(uuid,integer,integer,text) from public;
revoke all on function public.publish_dynamic_schedule_draft(uuid) from public;
grant execute on function public.get_dynamic_period_workflow(uuid,integer,integer) to authenticated;
grant execute on function public.set_dynamic_period_status(uuid,integer,integer,text) to authenticated;
grant execute on function public.publish_dynamic_schedule_draft(uuid) to authenticated;

commit;
