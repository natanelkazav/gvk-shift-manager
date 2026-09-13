begin;

-- Phase 8.2C: dynamic memberships + safe one-time legacy history bridge.
-- Legacy data is copied, never deleted or rewritten.

-- Allow a user to participate in more than one dynamic role while keeping one optional primary role.
alter table public.job_type_memberships drop constraint if exists job_type_memberships_pkey;
alter table public.job_type_memberships add primary key (user_id, job_type_id);
create unique index if not exists job_type_memberships_one_primary_per_user_idx
  on public.job_type_memberships(user_id) where is_primary = true;

create table if not exists public.dynamic_legacy_import_batches (
  id uuid primary key default gen_random_uuid(),
  job_type_id uuid not null references public.job_types(id) on delete restrict,
  source_kind text not null check (source_kind in ('dispatcher','on_call','morning_driver')),
  status text not null default 'completed' check (status in ('running','completed','failed')),
  imported_periods integer not null default 0,
  imported_assignments integer not null default 0,
  imported_availability integer not null default 0,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.dynamic_historical_periods (
  id uuid primary key default gen_random_uuid(),
  job_type_id uuid not null references public.job_types(id) on delete restrict,
  source_kind text not null check (source_kind in ('dispatcher','on_call','morning_driver')),
  source_period_id uuid not null,
  year integer not null,
  month integer not null,
  source_status text,
  imported_batch_id uuid references public.dynamic_legacy_import_batches(id) on delete set null,
  source_payload jsonb not null default '{}'::jsonb,
  imported_at timestamptz not null default now(),
  unique(job_type_id, source_kind, source_period_id)
);
create index if not exists dynamic_historical_periods_job_month_idx
  on public.dynamic_historical_periods(job_type_id, year desc, month desc);

create table if not exists public.dynamic_historical_assignments (
  id uuid primary key default gen_random_uuid(),
  historical_period_id uuid not null references public.dynamic_historical_periods(id) on delete cascade,
  source_kind text not null check (source_kind in ('dispatcher','on_call','morning_driver')),
  source_record_id uuid not null,
  work_date date,
  starts_at timestamptz,
  ends_at timestamptz,
  shift_code text,
  original_user_id uuid references public.profiles(id) on delete set null,
  assigned_user_id uuid references public.profiles(id) on delete set null,
  is_intentionally_unassigned boolean not null default false,
  source_payload jsonb not null default '{}'::jsonb,
  imported_at timestamptz not null default now(),
  unique(historical_period_id, source_kind, source_record_id)
);
create index if not exists dynamic_historical_assignments_period_idx
  on public.dynamic_historical_assignments(historical_period_id, work_date);
create index if not exists dynamic_historical_assignments_user_idx
  on public.dynamic_historical_assignments(assigned_user_id);

create table if not exists public.dynamic_historical_availability (
  id uuid primary key default gen_random_uuid(),
  historical_period_id uuid not null references public.dynamic_historical_periods(id) on delete cascade,
  source_kind text not null check (source_kind in ('dispatcher','on_call','morning_driver')),
  source_record_id uuid not null,
  user_id uuid references public.profiles(id) on delete set null,
  work_date date,
  status text,
  note text,
  source_payload jsonb not null default '{}'::jsonb,
  imported_at timestamptz not null default now(),
  unique(historical_period_id, source_kind, source_record_id)
);

create or replace function public.get_dynamic_job_type_membership_admin(requested_job_type_id uuid)
returns jsonb
language plpgsql security definer set search_path=''
as $function$
declare current_user_id uuid := auth.uid();
begin
  if current_user_id is null then raise exception 'not authenticated'; end if;
  if not exists(select 1 from public.user_permissions up where up.user_id=current_user_id and up.permission_key in ('users.view','users.manage')) then raise exception 'not allowed'; end if;
  if not exists(select 1 from public.job_types jt where jt.id=requested_job_type_id) then raise exception 'job type not found'; end if;

  return jsonb_build_object(
    'users', coalesce((
      select jsonb_agg(jsonb_build_object(
        'userId',p.id,'displayName',p.display_name,'email',p.email,'legacyRole',p.role::text,'isActive',p.is_active,
        'isMember',(m.user_id is not null),'isPrimary',coalesce(m.is_primary,false),
        'employmentScope',m.metadata->>'employmentScope',
        'partTimeDefinition',coalesce(m.metadata->'partTimeDefinition','{}'::jsonb)
      ) order by p.is_active desc,p.display_name)
      from public.profiles p
      left join public.job_type_memberships m on m.user_id=p.id and m.job_type_id=requested_job_type_id
    ),'[]'::jsonb)
  );
end;$function$;

grant execute on function public.get_dynamic_job_type_membership_admin(uuid) to authenticated;

create or replace function public.save_dynamic_job_type_membership(
  requested_job_type_id uuid,
  requested_user_id uuid,
  requested_is_member boolean,
  requested_employment_scope text default null,
  requested_part_time_definition jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql security definer set search_path=''
as $function$
declare
  current_user_id uuid := auth.uid();
  target_job public.job_types%rowtype;
  normalized_scope text := nullif(trim(coalesce(requested_employment_scope,'')),'');
  should_primary boolean := false;
begin
  if current_user_id is null then raise exception 'not authenticated'; end if;
  if not exists(select 1 from public.user_permissions up where up.user_id=current_user_id and up.permission_key='users.manage') then raise exception 'not allowed'; end if;
  select * into target_job from public.job_types where id=requested_job_type_id;
  if not found then raise exception 'job type not found'; end if;
  if not exists(select 1 from public.profiles p where p.id=requested_user_id) then raise exception 'user not found'; end if;

  if not requested_is_member then
    delete from public.job_type_memberships where job_type_id=requested_job_type_id and user_id=requested_user_id;
    insert into public.audit_logs(user_id,action,entity_type,entity_id,summary,actor_user_id,metadata)
    values(current_user_id,'dynamic_job_type.member.removed','job_type',requested_job_type_id,'עובד הוסר מתפקיד דינמי',current_user_id,jsonb_build_object('userId',requested_user_id));
    return jsonb_build_object('saved',true,'isMember',false);
  end if;

  if target_job.employment_scope='flexible' then
    if normalized_scope is null then normalized_scope := 'full_time'; end if;
    if normalized_scope not in ('full_time','part_time','as_much_as_possible') then raise exception 'invalid member employment scope'; end if;
  else
    normalized_scope := target_job.employment_scope;
  end if;

  should_primary := not exists(select 1 from public.job_type_memberships m where m.user_id=requested_user_id and m.is_primary=true);
  insert into public.job_type_memberships(user_id,job_type_id,is_primary,source,metadata)
  values(requested_user_id,requested_job_type_id,should_primary,'manual',
    jsonb_strip_nulls(jsonb_build_object(
      'employmentScope',normalized_scope,
      'partTimeDefinition',case when normalized_scope='part_time' then coalesce(requested_part_time_definition,'{}'::jsonb) else null end
    )))
  on conflict(user_id,job_type_id) do update set
    source='manual',
    metadata=jsonb_strip_nulls(jsonb_build_object(
      'employmentScope',normalized_scope,
      'partTimeDefinition',case when normalized_scope='part_time' then coalesce(requested_part_time_definition,'{}'::jsonb) else null end
    )),
    updated_at=now();

  insert into public.audit_logs(user_id,action,entity_type,entity_id,summary,actor_user_id,metadata)
  values(current_user_id,'dynamic_job_type.member.saved','job_type',requested_job_type_id,'עובד שויך או עודכן בתפקיד דינמי',current_user_id,jsonb_build_object('userId',requested_user_id,'employmentScope',normalized_scope));
  return jsonb_build_object('saved',true,'isMember',true,'employmentScope',normalized_scope);
end;$function$;

grant execute on function public.save_dynamic_job_type_membership(uuid,uuid,boolean,text,jsonb) to authenticated;

create or replace function public.preview_dynamic_legacy_import(requested_job_type_id uuid, requested_source_kind text)
returns jsonb
language plpgsql security definer set search_path=''
as $function$
declare
  current_user_id uuid := auth.uid();
  periods_count integer := 0; assignments_count integer := 0; availability_count integer := 0;
  imported_periods integer := 0; imported_assignments integer := 0; imported_availability integer := 0;
  expected_role text;
begin
  if current_user_id is null then raise exception 'not authenticated'; end if;
  if not exists(select 1 from public.user_permissions up where up.user_id=current_user_id and up.permission_key='users.manage') then raise exception 'not allowed'; end if;
  if requested_source_kind not in ('dispatcher','on_call','morning_driver') then raise exception 'invalid source kind'; end if;
  if not exists(select 1 from public.job_types where id=requested_job_type_id) then raise exception 'job type not found'; end if;

  if requested_source_kind='dispatcher' then
    select count(*) into periods_count from public.schedule_periods where status::text in ('published','archived');
    select count(*) into assignments_count from public.schedule_shifts s join public.schedule_periods p on p.id=s.period_id where p.status::text in ('published','archived');
    select count(*) into availability_count from public.dispatcher_availability a join public.schedule_shifts s on s.id=a.shift_id join public.schedule_periods p on p.id=s.period_id where p.status::text in ('published','archived');
    expected_role := 'dispatcher';
  elsif requested_source_kind='on_call' then
    select count(*) into periods_count from public.driver_schedule_periods where status::text in ('published','archived');
    select count(*) into assignments_count from public.driver_schedule_days d join public.driver_schedule_periods p on p.id=d.period_id where p.status::text in ('published','archived');
    expected_role := 'on_call';
  else
    select count(*) into periods_count from public.morning_driver_schedule_periods where status::text in ('published','archived');
    select count(*) into assignments_count from public.morning_driver_schedule_assignments a join public.morning_driver_schedule_periods p on p.id=a.schedule_period_id where p.status::text in ('published','archived');
    select count(*) into availability_count from public.morning_driver_availability_entries e join public.morning_driver_schedule_periods sp on sp.availability_period_id=e.period_id where sp.status::text in ('published','archived');
    expected_role := 'morning_driver';
  end if;

  select count(*) into imported_periods from public.dynamic_historical_periods where job_type_id=requested_job_type_id and source_kind=requested_source_kind;
  select count(*) into imported_assignments from public.dynamic_historical_assignments a join public.dynamic_historical_periods p on p.id=a.historical_period_id where p.job_type_id=requested_job_type_id and a.source_kind=requested_source_kind;
  select count(*) into imported_availability from public.dynamic_historical_availability a join public.dynamic_historical_periods p on p.id=a.historical_period_id where p.job_type_id=requested_job_type_id and a.source_kind=requested_source_kind;

  return jsonb_build_object(
    'sourceKind',requested_source_kind,'expectedLegacyRole',expected_role,
    'periods',periods_count,'assignments',assignments_count,'availability',availability_count,
    'alreadyImportedPeriods',imported_periods,'alreadyImportedAssignments',imported_assignments,'alreadyImportedAvailability',imported_availability,
    'newPeriods',greatest(periods_count-imported_periods,0),'newAssignments',greatest(assignments_count-imported_assignments,0),'newAvailability',greatest(availability_count-imported_availability,0),
    'matchingUsers',(select count(*) from public.profiles p where p.role::text=expected_role),
    'warning','הייבוא מעתיק היסטוריה בלבד ואינו מוחק או משנה נתונים במערכת הישנה'
  );
end;$function$;

grant execute on function public.preview_dynamic_legacy_import(uuid,text) to authenticated;

create or replace function public.import_dynamic_legacy_history(requested_job_type_id uuid, requested_source_kind text)
returns jsonb
language plpgsql security definer set search_path=''
as $function$
declare
  current_user_id uuid := auth.uid(); batch_id uuid; periods_added integer := 0; assignments_added integer := 0; availability_added integer := 0;
begin
  if current_user_id is null then raise exception 'not authenticated'; end if;
  if not exists(select 1 from public.user_permissions up where up.user_id=current_user_id and up.permission_key='users.manage') then raise exception 'not allowed'; end if;
  if requested_source_kind not in ('dispatcher','on_call','morning_driver') then raise exception 'invalid source kind'; end if;
  if not exists(select 1 from public.job_types where id=requested_job_type_id) then raise exception 'job type not found'; end if;

  insert into public.dynamic_legacy_import_batches(job_type_id,source_kind,status,created_by)
  values(requested_job_type_id,requested_source_kind,'running',current_user_id) returning id into batch_id;

  if requested_source_kind='dispatcher' then
    insert into public.dynamic_historical_periods(job_type_id,source_kind,source_period_id,year,month,source_status,imported_batch_id,source_payload)
    select requested_job_type_id,'dispatcher',p.id,p.year,p.month,p.status::text,batch_id,to_jsonb(p)
    from public.schedule_periods p where p.status::text in ('published','archived')
    on conflict(job_type_id,source_kind,source_period_id) do nothing;
    get diagnostics periods_added = row_count;

    insert into public.dynamic_historical_assignments(historical_period_id,source_kind,source_record_id,work_date,starts_at,ends_at,shift_code,assigned_user_id,is_intentionally_unassigned,source_payload)
    select hp.id,'dispatcher',s.id,s.shift_date,s.starts_at,s.ends_at,s.shift_code,s.assigned_user_id,coalesce((to_jsonb(s)->>'is_intentionally_unassigned')::boolean,false),to_jsonb(s)
    from public.schedule_shifts s join public.schedule_periods p on p.id=s.period_id
    join public.dynamic_historical_periods hp on hp.job_type_id=requested_job_type_id and hp.source_kind='dispatcher' and hp.source_period_id=p.id
    where p.status::text in ('published','archived')
    on conflict(historical_period_id,source_kind,source_record_id) do nothing;
    get diagnostics assignments_added = row_count;

    insert into public.dynamic_historical_availability(historical_period_id,source_kind,source_record_id,user_id,work_date,status,note,source_payload)
    select hp.id,'dispatcher',a.id,a.user_id,s.shift_date,a.availability_status::text,a.note,to_jsonb(a)
    from public.dispatcher_availability a join public.schedule_shifts s on s.id=a.shift_id join public.schedule_periods p on p.id=s.period_id
    join public.dynamic_historical_periods hp on hp.job_type_id=requested_job_type_id and hp.source_kind='dispatcher' and hp.source_period_id=p.id
    where p.status::text in ('published','archived')
    on conflict(historical_period_id,source_kind,source_record_id) do nothing;
    get diagnostics availability_added = row_count;

  elsif requested_source_kind='on_call' then
    insert into public.dynamic_historical_periods(job_type_id,source_kind,source_period_id,year,month,source_status,imported_batch_id,source_payload)
    select requested_job_type_id,'on_call',p.id,p.year,p.month,p.status::text,batch_id,to_jsonb(p)
    from public.driver_schedule_periods p where p.status::text in ('published','archived')
    on conflict(job_type_id,source_kind,source_period_id) do nothing;
    get diagnostics periods_added = row_count;

    insert into public.dynamic_historical_assignments(historical_period_id,source_kind,source_record_id,work_date,original_user_id,assigned_user_id,is_intentionally_unassigned,source_payload)
    select hp.id,'on_call',d.id,d.duty_date,d.original_user_id,d.assigned_user_id,coalesce((to_jsonb(d)->>'is_intentionally_unassigned')::boolean,false),to_jsonb(d)
    from public.driver_schedule_days d join public.driver_schedule_periods p on p.id=d.period_id
    join public.dynamic_historical_periods hp on hp.job_type_id=requested_job_type_id and hp.source_kind='on_call' and hp.source_period_id=p.id
    where p.status::text in ('published','archived')
    on conflict(historical_period_id,source_kind,source_record_id) do nothing;
    get diagnostics assignments_added = row_count;

  else
    insert into public.dynamic_historical_periods(job_type_id,source_kind,source_period_id,year,month,source_status,imported_batch_id,source_payload)
    select requested_job_type_id,'morning_driver',p.id,p.year,p.month,p.status::text,batch_id,to_jsonb(p)
    from public.morning_driver_schedule_periods p where p.status::text in ('published','archived')
    on conflict(job_type_id,source_kind,source_period_id) do nothing;
    get diagnostics periods_added = row_count;

    insert into public.dynamic_historical_assignments(historical_period_id,source_kind,source_record_id,work_date,starts_at,ends_at,shift_code,assigned_user_id,is_intentionally_unassigned,source_payload)
    select hp.id,'morning_driver',a.id,s.shift_date,
      case when s.shift_date is not null and s.start_time is not null then (s.shift_date + s.start_time)::timestamp at time zone 'Asia/Jerusalem' else null end,
      case when s.shift_date is not null and s.end_time is not null then ((s.shift_date + s.end_time) + case when s.end_time<=s.start_time then interval '1 day' else interval '0 day' end) at time zone 'Asia/Jerusalem' else null end,
      s.id::text,a.assigned_user_id,coalesce(a.is_intentionally_unassigned,false),jsonb_build_object('assignment',to_jsonb(a),'shift',to_jsonb(s))
    from public.morning_driver_schedule_assignments a join public.morning_driver_schedule_periods p on p.id=a.schedule_period_id
    join public.morning_driver_availability_shifts s on s.id=a.availability_shift_id
    join public.dynamic_historical_periods hp on hp.job_type_id=requested_job_type_id and hp.source_kind='morning_driver' and hp.source_period_id=p.id
    where p.status::text in ('published','archived')
    on conflict(historical_period_id,source_kind,source_record_id) do nothing;
    get diagnostics assignments_added = row_count;

    insert into public.dynamic_historical_availability(historical_period_id,source_kind,source_record_id,user_id,work_date,status,note,source_payload)
    select hp.id,'morning_driver',e.id,e.user_id,s.shift_date,e.availability_status::text,e.note,jsonb_build_object('entry',to_jsonb(e),'shift',to_jsonb(s))
    from public.morning_driver_availability_entries e
    join public.morning_driver_availability_shifts s on s.id=e.shift_id
    join public.morning_driver_schedule_periods sp on sp.availability_period_id=e.period_id and sp.status::text in ('published','archived')
    join public.dynamic_historical_periods hp on hp.job_type_id=requested_job_type_id and hp.source_kind='morning_driver' and hp.source_period_id=sp.id
    on conflict(historical_period_id,source_kind,source_record_id) do nothing;
    get diagnostics availability_added = row_count;
  end if;

  update public.dynamic_legacy_import_batches set status='completed',imported_periods=periods_added,imported_assignments=assignments_added,imported_availability=availability_added,completed_at=now() where id=batch_id;
  insert into public.audit_logs(user_id,action,entity_type,entity_id,summary,actor_user_id,metadata)
  values(current_user_id,'dynamic_job_type.legacy_history.imported','job_type',requested_job_type_id,'יובאה היסטוריה מהמערכת הישנה לתפקיד דינמי',current_user_id,jsonb_build_object('sourceKind',requested_source_kind,'batchId',batch_id,'periods',periods_added,'assignments',assignments_added,'availability',availability_added));
  return jsonb_build_object('batchId',batch_id,'periodsImported',periods_added,'assignmentsImported',assignments_added,'availabilityImported',availability_added,'idempotent',true);
exception when others then
  if batch_id is not null then update public.dynamic_legacy_import_batches set status='failed',completed_at=now(),metadata=jsonb_build_object('error',sqlerrm) where id=batch_id; end if;
  raise;
end;$function$;

grant execute on function public.import_dynamic_legacy_history(uuid,text) to authenticated;

commit;
