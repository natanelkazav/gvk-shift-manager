begin;

-- Phase 8.9: GVK-only Legacy Migration Adapter.
-- IMPORTANT: dispatcher/on_call/morning_driver are source-system identifiers only.
-- They are not runtime job types and never determine dynamic product behavior.
-- The administrator explicitly maps each GVK legacy source to any active dynamic job type.
-- This migration is additive and does not enable cutover or delete legacy data.

create table if not exists public.gvk_legacy_migration_runs (
  id uuid primary key default gen_random_uuid(),
  dispatcher_job_type_id uuid not null references public.job_types(id) on delete restrict,
  on_call_job_type_id uuid not null references public.job_types(id) on delete restrict,
  morning_driver_job_type_id uuid not null references public.job_types(id) on delete restrict,
  status text not null default 'running' check (status in ('running','completed','failed')),
  result jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table public.gvk_legacy_migration_runs enable row level security;
revoke all on public.gvk_legacy_migration_runs from anon, authenticated;

create or replace function public.preview_gvk_legacy_migration(requested_mappings jsonb)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_actor uuid := auth.uid();
  requested_dispatcher_job_type_id uuid := nullif(requested_mappings->>'dispatcher','')::uuid;
  requested_on_call_job_type_id uuid := nullif(requested_mappings->>'on_call','')::uuid;
  requested_morning_driver_job_type_id uuid := nullif(requested_mappings->>'morning_driver','')::uuid;
  v_current_ym integer := extract(year from (now() at time zone 'Asia/Jerusalem'))::integer * 100
    + extract(month from (now() at time zone 'Asia/Jerusalem'))::integer;
  v_blockers jsonb := '[]'::jsonb;
  v_warnings jsonb := '[]'::jsonb;
  v_result jsonb;
begin
  if v_actor is null and current_user not in ('postgres','supabase_admin','service_role') then
    raise exception 'not authenticated';
  end if;
  if v_actor is not null and not exists(
    select 1 from public.user_permissions up
    where up.user_id=v_actor and up.permission_key='users.manage'
  ) then
    raise exception 'not allowed';
  end if;

  if requested_dispatcher_job_type_id is null
     or requested_on_call_job_type_id is null
     or requested_morning_driver_job_type_id is null then
    raise exception 'GVK adapter requires mappings for dispatcher, on_call and morning_driver';
  end if;

  if requested_dispatcher_job_type_id = requested_on_call_job_type_id
     or requested_dispatcher_job_type_id = requested_morning_driver_job_type_id
     or requested_on_call_job_type_id = requested_morning_driver_job_type_id then
    v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
      'code','duplicate_target_job_type',
      'message','כל מערכת Legacy חייבת להיות ממופה לתפקיד דינמי נפרד'
    ));
  end if;

  if exists (
    select 1 from (values
      (requested_dispatcher_job_type_id),
      (requested_on_call_job_type_id),
      (requested_morning_driver_job_type_id)
    ) x(id)
    left join public.job_types jt on jt.id=x.id
    where jt.id is null or jt.is_active=false
  ) then
    v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
      'code','missing_or_inactive_target',
      'message','אחד מתפקידי היעד לא קיים או מוקפא'
    ));
  end if;

  -- We do not auto-convert an unfinished live workflow. A published/archived
  -- schedule is stable and can be copied safely; an open/draft workflow must
  -- be finished or restarted in the dynamic system.
  if exists (
    select 1 from public.schedule_periods p
    where (p.year*100+p.month) >= v_current_ym
      and p.status::text not in ('published','archived')
  ) then
    v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
      'code','dispatcher_unfinished_period',
      'message','קיימת תקופת מוקדנים פעילה/לא מפורסמת במערכת הישנה. יש לסיים או לבטל אותה לפני המיגרציה המלאה.'
    ));
  end if;

  if exists (
    select 1 from public.driver_schedule_periods p
    where (p.year*100+p.month) >= v_current_ym
      and p.status::text not in ('published','archived')
  ) then
    v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
      'code','on_call_unfinished_period',
      'message','קיימת תקופת כוננים פעילה/לא מפורסמת במערכת הישנה. יש לסיים או לבטל אותה לפני המיגרציה המלאה.'
    ));
  end if;

  if exists (
    select 1 from public.morning_driver_schedule_periods p
    where (p.year*100+p.month) >= v_current_ym
      and p.status::text not in ('published','archived')
  ) then
    v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
      'code','morning_driver_unfinished_period',
      'message','קיימת תקופת כונני בוקר פעילה/לא מפורסמת במערכת הישנה. יש לסיים או לבטל אותה לפני המיגרציה המלאה.'
    ));
  end if;

  -- Existing dynamic publications are intentionally not overwritten.
  if exists (
    select 1
    from public.dynamic_schedule_publications dp
    join (values
      (requested_dispatcher_job_type_id),
      (requested_on_call_job_type_id),
      (requested_morning_driver_job_type_id)
    ) x(id) on x.id=dp.job_type_id
    where (dp.year*100+dp.month) >= v_current_ym
  ) then
    v_warnings := v_warnings || jsonb_build_array(jsonb_build_object(
      'code','existing_dynamic_publications',
      'message','קיימים כבר לוחות דינמיים בחודש הנוכחי או בחודשים עתידיים. המיגרציה לא תדרוס אותם ותדלג על אותם חודשים.'
    ));
  end if;

  select jsonb_build_object(
    'adapter','gvk_legacy_v1',
    'ready', jsonb_array_length(v_blockers)=0,
    'blockers', v_blockers,
    'warnings', v_warnings,
    'targets', jsonb_build_object(
      'dispatcher', (select jsonb_build_object('id',jt.id,'name',jt.name,'code',jt.code,'strategy',jt.scheduling_strategy) from public.job_types jt where jt.id=requested_dispatcher_job_type_id),
      'onCall', (select jsonb_build_object('id',jt.id,'name',jt.name,'code',jt.code,'strategy',jt.scheduling_strategy) from public.job_types jt where jt.id=requested_on_call_job_type_id),
      'morningDriver', (select jsonb_build_object('id',jt.id,'name',jt.name,'code',jt.code,'strategy',jt.scheduling_strategy) from public.job_types jt where jt.id=requested_morning_driver_job_type_id)
    ),
    'legacy', jsonb_build_object(
      'dispatcher', jsonb_build_object(
        'members', (select count(*) from public.profiles p where p.role::text='dispatcher'),
        'historicalPeriods', (select count(*) from public.schedule_periods p where p.status::text in ('published','archived') and (p.year*100+p.month)<v_current_ym),
        'livePeriods', (select count(*) from public.schedule_periods p where p.status::text in ('published','archived') and (p.year*100+p.month)>=v_current_ym),
        'liveAssignments', (select count(*) from public.schedule_shifts s join public.schedule_periods p on p.id=s.period_id where p.status::text in ('published','archived') and (p.year*100+p.month)>=v_current_ym)
      ),
      'onCall', jsonb_build_object(
        'members', (select count(*) from public.profiles p where p.role::text='on_call'),
        'historicalPeriods', (select count(*) from public.driver_schedule_periods p where p.status::text in ('published','archived') and (p.year*100+p.month)<v_current_ym),
        'livePeriods', (select count(*) from public.driver_schedule_periods p where p.status::text in ('published','archived') and (p.year*100+p.month)>=v_current_ym),
        'liveAssignments', (select count(*) from public.driver_schedule_days d join public.driver_schedule_periods p on p.id=d.period_id where p.status::text in ('published','archived') and (p.year*100+p.month)>=v_current_ym)
      ),
      'morningDriver', jsonb_build_object(
        'members', (select count(*) from public.profiles p where p.role::text='morning_driver'),
        'historicalPeriods', (select count(*) from public.morning_driver_schedule_periods p where p.status::text in ('published','archived') and (p.year*100+p.month)<v_current_ym),
        'livePeriods', (select count(*) from public.morning_driver_schedule_periods p where p.status::text in ('published','archived') and (p.year*100+p.month)>=v_current_ym),
        'liveAssignments', (select count(*) from public.morning_driver_schedule_assignments a join public.morning_driver_schedule_periods p on p.id=a.schedule_period_id where p.status::text in ('published','archived') and (p.year*100+p.month)>=v_current_ym)
      )
    )
  ) into v_result;

  return v_result;
end;
$function$;

revoke all on function public.preview_gvk_legacy_migration(jsonb) from public;
grant execute on function public.preview_gvk_legacy_migration(jsonb) to authenticated;

create or replace function public.run_gvk_legacy_migration(requested_mappings jsonb)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_actor uuid := auth.uid();
  requested_dispatcher_job_type_id uuid := nullif(requested_mappings->>'dispatcher','')::uuid;
  requested_on_call_job_type_id uuid := nullif(requested_mappings->>'on_call','')::uuid;
  requested_morning_driver_job_type_id uuid := nullif(requested_mappings->>'morning_driver','')::uuid;
  v_preview jsonb;
  v_run_id uuid;
  v_current_ym integer := extract(year from (now() at time zone 'Asia/Jerusalem'))::integer * 100
    + extract(month from (now() at time zone 'Asia/Jerusalem'))::integer;
  v_source text;
  v_job_type_id uuid;
  v_job public.job_types%rowtype;
  v_period record;
  v_dynamic_period_id uuid;
  v_draft_id uuid;
  v_publication_id uuid;
  v_hist jsonb;
  v_members_added integer := 0;
  v_live_periods_added integer := 0;
  v_live_assignments_added integer := 0;
  v_unassigned_added integer := 0;
  v_history jsonb := '{}'::jsonb;
  v_result jsonb;
begin
  -- SQL editor execution has no JWT. In that trusted context, select one active
  -- users.manage actor for audit records and seed the JWT claim so existing
  -- idempotent history-import RPCs can be reused unchanged.
  if v_actor is null and current_user in ('postgres','supabase_admin','service_role') then
    select up.user_id into v_actor
    from public.user_permissions up
    join public.profiles p on p.id=up.user_id and p.is_active=true
    where up.permission_key='users.manage'
    order by p.created_at
    limit 1;
    if v_actor is null then raise exception 'no active users.manage actor found'; end if;
    perform set_config('request.jwt.claim.sub',v_actor::text,true);
  end if;

  if v_actor is null then raise exception 'not authenticated'; end if;
  if not exists(select 1 from public.user_permissions up where up.user_id=v_actor and up.permission_key='users.manage') then
    raise exception 'not allowed';
  end if;

  v_preview := public.preview_gvk_legacy_migration(requested_mappings);
  if coalesce((v_preview->>'ready')::boolean,false)=false then
    raise exception 'migration preview contains blockers: %', v_preview->'blockers';
  end if;

  insert into public.gvk_legacy_migration_runs(
    dispatcher_job_type_id,on_call_job_type_id,morning_driver_job_type_id,status,created_by
  ) values(
    requested_dispatcher_job_type_id,requested_on_call_job_type_id,requested_morning_driver_job_type_id,'running',v_actor
  ) returning id into v_run_id;

  -- Copy role memberships first. Existing dynamic membership metadata wins.
  insert into public.job_type_memberships(user_id,job_type_id,is_primary,source,metadata)
  select p.id,requested_dispatcher_job_type_id,false,'legacy_cutover',
         jsonb_build_object('employmentScope',case when jt.employment_scope='flexible' then 'full_time' else jt.employment_scope end,'legacyRole','dispatcher')
  from public.profiles p cross join public.job_types jt
  where jt.id=requested_dispatcher_job_type_id and (
    p.role::text='dispatcher' or exists(
      select 1 from public.schedule_shifts s join public.schedule_periods sp on sp.id=s.period_id
      where s.assigned_user_id=p.id and sp.status::text in ('published','archived') and (sp.year*100+sp.month)>=v_current_ym
    )
  )
  on conflict(user_id,job_type_id) do nothing;
  get diagnostics v_members_added = row_count;

  insert into public.job_type_memberships(user_id,job_type_id,is_primary,source,metadata)
  select p.id,requested_on_call_job_type_id,false,'legacy_cutover',
         jsonb_build_object('employmentScope',case when jt.employment_scope='flexible' then 'full_time' else jt.employment_scope end,'legacyRole','on_call')
  from public.profiles p cross join public.job_types jt
  where jt.id=requested_on_call_job_type_id and (
    p.role::text='on_call' or exists(
      select 1 from public.driver_schedule_days d join public.driver_schedule_periods sp on sp.id=d.period_id
      where (d.assigned_user_id=p.id or d.original_user_id=p.id) and sp.status::text in ('published','archived') and (sp.year*100+sp.month)>=v_current_ym
    )
  )
  on conflict(user_id,job_type_id) do nothing;
  get diagnostics v_live_periods_added = row_count;
  v_members_added := v_members_added + v_live_periods_added;

  insert into public.job_type_memberships(user_id,job_type_id,is_primary,source,metadata)
  select p.id,requested_morning_driver_job_type_id,false,'legacy_cutover',
         jsonb_build_object('employmentScope',case when jt.employment_scope='flexible' then 'full_time' else jt.employment_scope end,'legacyRole','morning_driver')
  from public.profiles p cross join public.job_types jt
  where jt.id=requested_morning_driver_job_type_id and (
    p.role::text='morning_driver' or exists(
      select 1 from public.morning_driver_schedule_assignments a join public.morning_driver_schedule_periods sp on sp.id=a.schedule_period_id
      where a.assigned_user_id=p.id and sp.status::text in ('published','archived') and (sp.year*100+sp.month)>=v_current_ym
    )
  )
  on conflict(user_id,job_type_id) do nothing;
  get diagnostics v_live_periods_added = row_count;
  v_members_added := v_members_added + v_live_periods_added;
  v_live_periods_added := 0;

  -- Reuse the already-tested, idempotent history importer for every legacy area.
  v_hist := public.import_dynamic_legacy_history(requested_dispatcher_job_type_id,'dispatcher');
  v_history := v_history || jsonb_build_object('dispatcher',v_hist);
  v_hist := public.import_dynamic_legacy_history(requested_on_call_job_type_id,'on_call');
  v_history := v_history || jsonb_build_object('onCall',v_hist);
  v_hist := public.import_dynamic_legacy_history(requested_morning_driver_job_type_id,'morning_driver');
  v_history := v_history || jsonb_build_object('morningDriver',v_hist);

  -- Stable current/future schedules are copied into the real dynamic publication
  -- tables. Existing dynamic publications are never overwritten.
  for v_source,v_job_type_id in
    select * from (values
      ('dispatcher'::text,requested_dispatcher_job_type_id),
      ('on_call'::text,requested_on_call_job_type_id),
      ('morning_driver'::text,requested_morning_driver_job_type_id)
    ) m(source_kind,job_type_id)
  loop
    select * into v_job from public.job_types where id=v_job_type_id;

    if v_source='dispatcher' then
      for v_period in
        select p.id source_period_id,p.year,p.month,p.status::text source_status
        from public.schedule_periods p
        where p.status::text in ('published','archived') and (p.year*100+p.month)>=v_current_ym
        order by p.year,p.month
      loop
        if exists(select 1 from public.dynamic_schedule_publications dp where dp.job_type_id=v_job.id and dp.year=v_period.year and dp.month=v_period.month) then
          continue;
        end if;

        insert into public.dynamic_availability_periods(
          schedule_group_id,job_type_id,year,month,title,status,config_snapshot,source,created_by
        ) values(
          v_job.schedule_group_id,v_job.id,v_period.year,v_period.month,
          'מיגרציה ממערכת מוקדנים · '||lpad(v_period.month::text,2,'0')||'/'||v_period.year::text,
          'closed',jsonb_build_object('legacyCutover',true,'sourceKind','dispatcher','sourcePeriodId',v_period.source_period_id),
          'legacy_cutover',v_actor
        )
        on conflict(job_type_id,year,month) do update set updated_at=now()
        returning id into v_dynamic_period_id;

        insert into public.dynamic_availability_slots(
          period_id,shift_date,shift_code,shift_name,start_time,end_time,source_day_kind,effective_day_kind,min_workers,target_workers,max_workers,metadata
        )
        select v_dynamic_period_id,s.shift_date,s.shift_code,s.shift_code,
               (s.starts_at at time zone 'Asia/Jerusalem')::time,
               (s.ends_at at time zone 'Asia/Jerusalem')::time,
               s.schedule_type::text,s.schedule_type::text,1,1,1,
               jsonb_build_object('legacyCutover',true,'sourceRecordId',s.id)
        from public.schedule_shifts s where s.period_id=v_period.source_period_id
        on conflict(period_id,shift_date,shift_code) do update set
          start_time=excluded.start_time,end_time=excluded.end_time,metadata=excluded.metadata;

        insert into public.dynamic_schedule_shadow_drafts(
          job_type_id,availability_period_id,year,month,status,feasibility_snapshot,rules_snapshot,metrics,created_by
        ) values(
          v_job.id,v_dynamic_period_id,v_period.year,v_period.month,'generated','{}'::jsonb,
          jsonb_build_object('source','legacy_cutover'),jsonb_build_object('legacyCutover',true,'sourcePeriodId',v_period.source_period_id),v_actor
        ) returning id into v_draft_id;

        insert into public.dynamic_schedule_shadow_assignments(
          draft_id,slot_id,user_id,original_user_id,engine_user_id,assignment_tier,score,reasons
        )
        select v_draft_id,sl.id,s.assigned_user_id,s.assigned_user_id,s.assigned_user_id,'required',0,jsonb_build_array('legacy_cutover')
        from public.schedule_shifts s
        join public.dynamic_availability_slots sl on sl.period_id=v_dynamic_period_id and sl.shift_date=s.shift_date and sl.shift_code=s.shift_code
        where s.period_id=v_period.source_period_id and s.assigned_user_id is not null
        on conflict(draft_id,slot_id,user_id) do nothing;

        insert into public.dynamic_schedule_draft_slot_overrides(draft_id,slot_id,intentionally_unassigned_count,note,updated_by)
        select v_draft_id,sl.id,1,'יובא כמשמרת לא מאוישת מהמערכת הישנה',v_actor
        from public.schedule_shifts s
        join public.dynamic_availability_slots sl on sl.period_id=v_dynamic_period_id and sl.shift_date=s.shift_date and sl.shift_code=s.shift_code
        where s.period_id=v_period.source_period_id and s.assigned_user_id is null
        on conflict(draft_id,slot_id) do nothing;

      end loop;

    elsif v_source='on_call' then
      for v_period in
        select p.id source_period_id,p.year,p.month,p.status::text source_status
        from public.driver_schedule_periods p
        where p.status::text in ('published','archived') and (p.year*100+p.month)>=v_current_ym
        order by p.year,p.month
      loop
        if exists(select 1 from public.dynamic_schedule_publications dp where dp.job_type_id=v_job.id and dp.year=v_period.year and dp.month=v_period.month) then
          continue;
        end if;

        insert into public.dynamic_availability_periods(
          schedule_group_id,job_type_id,year,month,title,status,config_snapshot,source,created_by
        ) values(
          v_job.schedule_group_id,v_job.id,v_period.year,v_period.month,
          'מיגרציה ממערכת כוננים · '||lpad(v_period.month::text,2,'0')||'/'||v_period.year::text,
          'closed',jsonb_build_object('legacyCutover',true,'sourceKind','on_call','sourcePeriodId',v_period.source_period_id),
          'legacy_cutover',v_actor
        )
        on conflict(job_type_id,year,month) do update set updated_at=now()
        returning id into v_dynamic_period_id;

        insert into public.dynamic_availability_slots(
          period_id,shift_date,shift_code,shift_name,start_time,end_time,source_day_kind,effective_day_kind,min_workers,target_workers,max_workers,metadata
        )
        select v_dynamic_period_id,d.duty_date,'daily_on_call','כוננות יומית','00:00'::time,'23:59'::time,
               'weekday','weekday',1,1,1,jsonb_build_object('legacyCutover',true,'sourceRecordId',d.id)
        from public.driver_schedule_days d where d.period_id=v_period.source_period_id
        on conflict(period_id,shift_date,shift_code) do update set metadata=excluded.metadata;

        insert into public.dynamic_schedule_shadow_drafts(
          job_type_id,availability_period_id,year,month,status,feasibility_snapshot,rules_snapshot,metrics,created_by
        ) values(
          v_job.id,v_dynamic_period_id,v_period.year,v_period.month,'generated','{}'::jsonb,
          jsonb_build_object('source','legacy_cutover'),jsonb_build_object('legacyCutover',true,'sourcePeriodId',v_period.source_period_id),v_actor
        ) returning id into v_draft_id;

        insert into public.dynamic_schedule_shadow_assignments(
          draft_id,slot_id,user_id,original_user_id,engine_user_id,assignment_tier,score,reasons
        )
        select v_draft_id,sl.id,d.assigned_user_id,coalesce(d.original_user_id,d.assigned_user_id),d.assigned_user_id,'required',0,jsonb_build_array('legacy_cutover')
        from public.driver_schedule_days d
        join public.dynamic_availability_slots sl on sl.period_id=v_dynamic_period_id and sl.shift_date=d.duty_date and sl.shift_code='daily_on_call'
        where d.period_id=v_period.source_period_id and d.assigned_user_id is not null
        on conflict(draft_id,slot_id,user_id) do nothing;

        insert into public.dynamic_schedule_draft_slot_overrides(draft_id,slot_id,intentionally_unassigned_count,note,updated_by)
        select v_draft_id,sl.id,1,'יובא ככוננות לא מאוישת מהמערכת הישנה',v_actor
        from public.driver_schedule_days d
        join public.dynamic_availability_slots sl on sl.period_id=v_dynamic_period_id and sl.shift_date=d.duty_date and sl.shift_code='daily_on_call'
        where d.period_id=v_period.source_period_id and d.assigned_user_id is null
        on conflict(draft_id,slot_id) do nothing;
      end loop;

    else
      for v_period in
        select p.id source_period_id,p.year,p.month,p.status::text source_status
        from public.morning_driver_schedule_periods p
        where p.status::text in ('published','archived') and (p.year*100+p.month)>=v_current_ym
        order by p.year,p.month
      loop
        if exists(select 1 from public.dynamic_schedule_publications dp where dp.job_type_id=v_job.id and dp.year=v_period.year and dp.month=v_period.month) then
          continue;
        end if;

        insert into public.dynamic_availability_periods(
          schedule_group_id,job_type_id,year,month,title,status,config_snapshot,source,created_by
        ) values(
          v_job.schedule_group_id,v_job.id,v_period.year,v_period.month,
          'מיגרציה ממערכת כונני בוקר · '||lpad(v_period.month::text,2,'0')||'/'||v_period.year::text,
          'closed',jsonb_build_object('legacyCutover',true,'sourceKind','morning_driver','sourcePeriodId',v_period.source_period_id),
          'legacy_cutover',v_actor
        )
        on conflict(job_type_id,year,month) do update set updated_at=now()
        returning id into v_dynamic_period_id;

        insert into public.dynamic_availability_slots(
          period_id,shift_date,shift_code,shift_name,start_time,end_time,source_day_kind,effective_day_kind,min_workers,target_workers,max_workers,metadata
        )
        select v_dynamic_period_id,s.shift_date,'legacy_morning_'||s.id::text,'כונן בוקר',s.start_time,s.end_time,
               'weekday','weekday',1,1,1,jsonb_build_object('legacyCutover',true,'sourceRecordId',s.id)
        from public.morning_driver_availability_shifts s
        where exists(
          select 1 from public.morning_driver_schedule_assignments a
          where a.schedule_period_id=v_period.source_period_id and a.availability_shift_id=s.id
        )
        on conflict(period_id,shift_date,shift_code) do update set
          start_time=excluded.start_time,end_time=excluded.end_time,metadata=excluded.metadata;

        insert into public.dynamic_schedule_shadow_drafts(
          job_type_id,availability_period_id,year,month,status,feasibility_snapshot,rules_snapshot,metrics,created_by
        ) values(
          v_job.id,v_dynamic_period_id,v_period.year,v_period.month,'generated','{}'::jsonb,
          jsonb_build_object('source','legacy_cutover'),jsonb_build_object('legacyCutover',true,'sourcePeriodId',v_period.source_period_id),v_actor
        ) returning id into v_draft_id;

        insert into public.dynamic_schedule_shadow_assignments(
          draft_id,slot_id,user_id,original_user_id,engine_user_id,assignment_tier,score,reasons
        )
        select v_draft_id,sl.id,a.assigned_user_id,a.assigned_user_id,a.assigned_user_id,'required',0,jsonb_build_array('legacy_cutover')
        from public.morning_driver_schedule_assignments a
        join public.morning_driver_availability_shifts s on s.id=a.availability_shift_id
        join public.dynamic_availability_slots sl on sl.period_id=v_dynamic_period_id and sl.shift_date=s.shift_date and sl.shift_code='legacy_morning_'||s.id::text
        where a.schedule_period_id=v_period.source_period_id and a.assigned_user_id is not null
        on conflict(draft_id,slot_id,user_id) do nothing;

        insert into public.dynamic_schedule_draft_slot_overrides(draft_id,slot_id,intentionally_unassigned_count,note,updated_by)
        select v_draft_id,sl.id,1,'יובא ככוננות בוקר לא מאוישת מהמערכת הישנה',v_actor
        from public.morning_driver_schedule_assignments a
        join public.morning_driver_availability_shifts s on s.id=a.availability_shift_id
        join public.dynamic_availability_slots sl on sl.period_id=v_dynamic_period_id and sl.shift_date=s.shift_date and sl.shift_code='legacy_morning_'||s.id::text
        where a.schedule_period_id=v_period.source_period_id and a.assigned_user_id is null
        on conflict(draft_id,slot_id) do nothing;
      end loop;
    end if;

    -- Publish every legacy-cutover draft that does not yet have a publication.
    for v_period in
      select d.id draft_id,d.availability_period_id,d.year,d.month,
             dap.config_snapshot,
             coalesce(dap.config_snapshot->>'sourceKind',v_source) source_kind,
             dap.config_snapshot->>'sourcePeriodId' source_period_id,
             case
               when v_source='dispatcher' then coalesce((select p.status::text from public.schedule_periods p where p.id=(dap.config_snapshot->>'sourcePeriodId')::uuid),'published')
               when v_source='on_call' then coalesce((select p.status::text from public.driver_schedule_periods p where p.id=(dap.config_snapshot->>'sourcePeriodId')::uuid),'published')
               else coalesce((select p.status::text from public.morning_driver_schedule_periods p where p.id=(dap.config_snapshot->>'sourcePeriodId')::uuid),'published')
             end source_status
      from public.dynamic_schedule_shadow_drafts d
      join public.dynamic_availability_periods dap on dap.id=d.availability_period_id
      where d.job_type_id=v_job.id
        and dap.source='legacy_cutover'
        and (d.year*100+d.month)>=v_current_ym
        and not exists(select 1 from public.dynamic_schedule_publications dp where dp.job_type_id=v_job.id and dp.year=d.year and dp.month=d.month)
      order by d.year,d.month
    loop
      insert into public.dynamic_schedule_publications(
        job_type_id,availability_period_id,draft_id,year,month,status,config_snapshot,published_by,published_at
      ) values(
        v_job.id,v_period.availability_period_id,v_period.draft_id,v_period.year,v_period.month,
        case when v_period.source_status='archived' then 'archived' else 'published' end,
        coalesce(v_period.config_snapshot,'{}'::jsonb) || jsonb_build_object('migrationRunId',v_run_id),v_actor,now()
      ) returning id into v_publication_id;
      v_live_periods_added := v_live_periods_added + 1;

      insert into public.dynamic_schedule_published_assignments(
        publication_id,source_assignment_id,slot_id,shift_date,shift_code,shift_name,start_time,end_time,
        user_id,original_user_id,engine_user_id,assignment_tier,score,reasons,manager_edited
      )
      select v_publication_id,a.id,a.slot_id,sl.shift_date,sl.shift_code,sl.shift_name,sl.start_time,sl.end_time,
             a.user_id,a.original_user_id,a.engine_user_id,a.assignment_tier,a.score,a.reasons,false
      from public.dynamic_schedule_shadow_assignments a
      join public.dynamic_availability_slots sl on sl.id=a.slot_id
      where a.draft_id=v_period.draft_id
      on conflict(publication_id,shift_date,shift_code,user_id) do nothing;
      get diagnostics v_unassigned_added = row_count;
      v_live_assignments_added := v_live_assignments_added + v_unassigned_added;

      insert into public.dynamic_schedule_published_unassigned(
        publication_id,slot_id,shift_date,shift_code,shift_name,intentionally_unassigned_count,note
      )
      select v_publication_id,o.slot_id,sl.shift_date,sl.shift_code,sl.shift_name,o.intentionally_unassigned_count,o.note
      from public.dynamic_schedule_draft_slot_overrides o
      join public.dynamic_availability_slots sl on sl.id=o.slot_id
      where o.draft_id=v_period.draft_id and o.intentionally_unassigned_count>0
      on conflict(publication_id,shift_date,shift_code) do nothing;
      get diagnostics v_unassigned_added = row_count;
      v_unassigned_added := coalesce(v_unassigned_added,0);
    end loop;
  end loop;

  v_result := jsonb_build_object(
    'runId',v_run_id,
    'membersAdded',v_members_added,
    'history',v_history,
    'livePeriodsAdded',v_live_periods_added,
    'liveAssignmentsAdded',v_live_assignments_added,
    'legacyDataDeleted',false,
    'cutoverEnabled',false,
    'message','נתוני GVK הועתקו לתפקידי היעד שנבחרו. המערכת הישנה נשארה ללא שינוי, ו-Cutover לא הופעל.'
  );

  update public.gvk_legacy_migration_runs
  set status='completed',result=v_result,completed_at=now()
  where id=v_run_id;

  insert into public.audit_logs(user_id,action,entity_type,entity_id,summary,actor_user_id,metadata)
  values(v_actor,'gvk.legacy_migration.completed','system',v_run_id,'הושלמה העברת נתוני GVK Legacy לתפקידי Job Type דינמיים שנבחרו',v_actor,v_result);

  return v_result;
exception when others then
  if v_run_id is not null then
    update public.gvk_legacy_migration_runs
    set status='failed',result=jsonb_build_object('error',sqlerrm),completed_at=now()
    where id=v_run_id;
  end if;
  raise;
end;
$function$;

revoke all on function public.run_gvk_legacy_migration(jsonb) from public;
grant execute on function public.run_gvk_legacy_migration(jsonb) to authenticated;

commit;
