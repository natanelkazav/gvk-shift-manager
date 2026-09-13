begin;

-- Phase 8.4: persistent generic daily rotation. The rotation is learned/created once
-- per job type and is never re-learned after substitutions. original_user_id is the
-- immutable rotation truth; user_id remains the actual assignee.
create table if not exists public.dynamic_job_type_rotation_state (
  job_type_id uuid primary key references public.job_types(id) on delete cascade,
  rotation_user_ids uuid[] not null,
  anchor_date date not null,
  source text not null check (source in ('historical_best_window','membership_fallback','manual')),
  source_metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (cardinality(rotation_user_ids) >= 2)
);

alter table public.dynamic_job_type_rotation_state enable row level security;
revoke all on public.dynamic_job_type_rotation_state from anon, authenticated;

alter table public.dynamic_schedule_shadow_assignments
  add column if not exists original_user_id uuid references public.profiles(id) on delete set null;
alter table public.dynamic_schedule_published_assignments
  add column if not exists original_user_id uuid references public.profiles(id) on delete set null;

create index if not exists dynamic_shadow_assignments_original_user_idx
  on public.dynamic_schedule_shadow_assignments(original_user_id);
create index if not exists dynamic_published_assignments_original_user_idx
  on public.dynamic_schedule_published_assignments(original_user_id);

-- Preserve the rotation truth when a draft is published without rewriting the large
-- publication RPC. source_assignment_id is already the stable bridge between both tables.
create or replace function public.dynamic_copy_rotation_original_to_publication()
returns trigger language plpgsql security definer set search_path='' as $function$
begin
  if new.source_assignment_id is not null then
    select a.original_user_id into new.original_user_id
    from public.dynamic_schedule_shadow_assignments a
    where a.id=new.source_assignment_id;
  end if;
  return new;
end;$function$;

drop trigger if exists dynamic_copy_rotation_original_to_publication_trg on public.dynamic_schedule_published_assignments;
create trigger dynamic_copy_rotation_original_to_publication_trg
before insert or update of source_assignment_id on public.dynamic_schedule_published_assignments
for each row execute function public.dynamic_copy_rotation_original_to_publication();

create or replace function public.create_dynamic_monthly_rotation_draft(
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
  v_actor uuid:=auth.uid();
  v_job public.job_types%rowtype;
  v_period public.dynamic_availability_periods%rowtype;
  v_material public.job_type_schedule_materializations%rowtype;
  v_draft_id uuid;
  v_rotation uuid[];
  v_anchor date;
  v_source text;
  v_member_count integer:=0;
  v_rotation_count integer:=0;
  v_slot record;
  v_original uuid;
  v_assigned uuid;
  v_status text;
  v_index integer;
  v_unfilled integer:=0;
  v_substitutions integer:=0;
  v_created integer:=0;
  v_candidate record;
  v_history_rows integer:=0;
begin
  if v_actor is null then raise exception 'not authenticated'; end if;
  if not exists(select 1 from public.user_permissions up where up.user_id=v_actor and up.permission_key='users.manage') then
    raise exception 'not allowed';
  end if;
  if requested_month not between 1 and 12 then raise exception 'invalid month'; end if;

  select * into v_job from public.job_types where id=requested_job_type_id;
  if v_job.id is null then raise exception 'job type not found'; end if;

  select * into v_material
  from public.job_type_schedule_materializations m
  where m.job_type_id=v_job.id and m.effective_month=make_date(requested_year,requested_month,1);

  if coalesce(v_material.scheduling_strategy,v_job.scheduling_strategy,'availability_optimizer') <> 'monthly_rotation_constraints' then
    raise exception 'job type is not configured for monthly rotation';
  end if;
  if coalesce(v_material.work_mode, v_job.scheduling_config#>>'{shiftPattern,workMode}') <> 'on_call_daily' then
    raise exception 'monthly rotation currently requires daily on-call work mode';
  end if;

  select * into v_period from public.dynamic_availability_periods
  where job_type_id=v_job.id and year=requested_year and month=requested_month;
  if v_period.id is null then raise exception 'dynamic availability period not found'; end if;
  if v_period.status <> 'closed' then raise exception 'availability period must be closed before scheduling'; end if;

  select count(*)::integer into v_member_count
  from public.job_type_memberships m join public.profiles p on p.id=m.user_id and p.is_active=true
  where m.job_type_id=v_job.id;
  if v_member_count < 2 then raise exception 'monthly rotation requires at least two active role members'; end if;

  select rotation_user_ids,anchor_date,source into v_rotation,v_anchor,v_source
  from public.dynamic_job_type_rotation_state where job_type_id=v_job.id for update;

  if v_rotation is null then
    -- Build candidate cycles from every historical contiguous N-row window whose
    -- original users are all distinct, then score each candidate against all imported
    -- original assignments. This is done once and persisted.
    with hist as (
      select ha.work_date,coalesce(ha.original_user_id,ha.assigned_user_id) user_id,
             row_number() over(order by ha.work_date,ha.id) rn
      from public.dynamic_historical_assignments ha
      join public.dynamic_historical_periods hp on hp.id=ha.historical_period_id
      join public.job_type_memberships jm on jm.job_type_id=hp.job_type_id and jm.user_id=coalesce(ha.original_user_id,ha.assigned_user_id)
      where hp.job_type_id=v_job.id and ha.work_date is not null and coalesce(ha.original_user_id,ha.assigned_user_id) is not null
    ), candidates as (
      select h0.work_date anchor_date,
             array_agg(h.user_id order by h.rn) rotation
      from hist h0 join hist h on h.rn between h0.rn and h0.rn+v_member_count-1
      group by h0.rn,h0.work_date
      having count(*)=v_member_count and count(distinct h.user_id)=v_member_count
    ), scored as (
      select c.anchor_date,c.rotation,
             count(*) filter(where h.user_id=c.rotation[((h.work_date-c.anchor_date)%v_member_count+v_member_count)%v_member_count+1])::integer matches,
             count(*)::integer compared
      from candidates c cross join hist h
      group by c.anchor_date,c.rotation
      order by matches desc,compared desc,c.anchor_date desc
      limit 1
    )
    select rotation,anchor_date,'historical_best_window',compared
      into v_rotation,v_anchor,v_source,v_history_rows from scored;

    if v_rotation is null or cardinality(v_rotation)<>v_member_count then
      select array_agg(x.user_id order by x.display_name,x.user_id),make_date(requested_year,requested_month,1),'membership_fallback'
      into v_rotation,v_anchor,v_source
      from (
        select m.user_id,coalesce(p.schedule_name,p.display_name,p.email,m.user_id::text) display_name
        from public.job_type_memberships m join public.profiles p on p.id=m.user_id and p.is_active=true
        where m.job_type_id=v_job.id
      ) x;
    end if;

    insert into public.dynamic_job_type_rotation_state(job_type_id,rotation_user_ids,anchor_date,source,source_metadata,created_by)
    values(v_job.id,v_rotation,v_anchor,v_source,jsonb_build_object('historicalRowsCompared',v_history_rows,'memberCount',v_member_count),v_actor);
  end if;

  v_rotation_count:=cardinality(v_rotation);
  if v_rotation_count<>v_member_count then
    raise exception 'saved rotation has % members but role currently has % active members; rotation membership changes require an explicit rotation update',v_rotation_count,v_member_count;
  end if;

  insert into public.dynamic_schedule_shadow_drafts(job_type_id,availability_period_id,year,month,status,feasibility_snapshot,rules_snapshot,metrics,created_by)
  values(v_job.id,v_period.id,requested_year,requested_month,'shadow','{}'::jsonb,
    jsonb_build_object('strategy','monthly_rotation_constraints','rotationUserIds',to_jsonb(v_rotation),'anchorDate',v_anchor,'rotationSource',v_source),
    '{}'::jsonb,v_actor) returning id into v_draft_id;

  for v_slot in
    select s.* from public.dynamic_availability_slots s where s.period_id=v_period.id order by s.shift_date,s.start_time,s.id
  loop
    v_index:=((v_slot.shift_date-v_anchor)%v_rotation_count+v_rotation_count)%v_rotation_count+1;
    v_original:=v_rotation[v_index];
    v_assigned:=null;

    select e.availability_status into v_status
    from public.dynamic_availability_submissions sub
    join public.dynamic_availability_entries e on e.submission_id=sub.id and e.slot_id=v_slot.id
    where sub.period_id=v_period.id and sub.user_id=v_original
    order by case when sub.status='submitted' then 0 else 1 end,sub.updated_at desc limit 1;

    if coalesce(v_status,'available') <> 'unavailable' then
      v_assigned:=v_original;
    else
      select c.* into v_candidate from (
        select m.user_id,e.availability_status,
          (select count(*) from public.dynamic_schedule_shadow_assignments a where a.draft_id=v_draft_id and a.user_id=m.user_id)::integer month_count,
          exists(
            select 1 from public.dynamic_schedule_shadow_assignments pa
            join public.dynamic_availability_slots ps on ps.id=pa.slot_id
            where pa.draft_id=v_draft_id and pa.user_id=m.user_id and ps.shift_date=v_slot.shift_date-1
          ) worked_previous_day
        from public.job_type_memberships m
        join public.profiles p on p.id=m.user_id and p.is_active=true
        left join public.dynamic_availability_submissions sub on sub.period_id=v_period.id and sub.user_id=m.user_id
        left join public.dynamic_availability_entries e on e.submission_id=sub.id and e.slot_id=v_slot.id
        where m.job_type_id=v_job.id and m.user_id<>v_original and coalesce(e.availability_status,'available')<>'unavailable'
      ) c
      order by c.worked_previous_day asc,
        case c.availability_status when 'preferred' then 0 when 'available' then 1 when null then 2 when 'avoid' then 3 else 2 end,
        c.month_count asc,c.user_id
      limit 1;
      v_assigned:=v_candidate.user_id;
      if v_assigned is not null then v_substitutions:=v_substitutions+1; end if;
    end if;

    if v_assigned is null then
      v_unfilled:=v_unfilled+greatest(v_slot.min_workers,1);
    else
      insert into public.dynamic_schedule_shadow_assignments(
        draft_id,slot_id,user_id,original_user_id,engine_user_id,assignment_tier,score,reasons
      ) values(
        v_draft_id,v_slot.id,v_assigned,v_original,v_assigned,'required',0,
        jsonb_build_array(
          'סבב חודשי קבוע',
          case when v_assigned=v_original then 'העובד המקורי ברוטציה' else 'מחליף עקב אילוץ של העובד המקורי' end
        )
      );
      v_created:=v_created+1;
    end if;
  end loop;

  update public.dynamic_schedule_shadow_drafts
  set status=case when v_unfilled=0 then 'generated' else 'incomplete' end,
      metrics=jsonb_build_object(
        'requiredAssignmentsCreated',v_created,'optionalAssignmentsCreated',0,
        'unfilledRequiredPositions',v_unfilled,'effectiveUnfilledRequiredPositions',v_unfilled,
        'rotationSubstitutions',v_substitutions,'algorithm','persistent_daily_rotation_v1',
        'rotationUserIds',to_jsonb(v_rotation),'rotationAnchorDate',v_anchor,'rotationSource',v_source,
        'originalRotationPreserved',true
      ),updated_at=now()
  where id=v_draft_id;

  insert into public.audit_logs(action,actor_user_id,entity_type,entity_id,summary,metadata)
  values('system_event',v_actor,'dynamic_schedule_draft',v_draft_id,'טיוטת סבב חודשי דינמי נוצרה',
    jsonb_build_object('job_type_id',v_job.id,'year',requested_year,'month',requested_month,'rotation_source',v_source,'substitutions',v_substitutions,'unfilled',v_unfilled));

  return jsonb_build_object(
    'draftId',v_draft_id,'mode','monthly_rotation','requiredAssignmentsCreated',v_created,
    'optionalAssignmentsCreated',0,'unfilledRequiredPositions',v_unfilled,
    'algorithm','persistent_daily_rotation_v1','rotationUserIds',to_jsonb(v_rotation),
    'rotationAnchorDate',v_anchor,'rotationSource',v_source,'rotationSubstitutions',v_substitutions,
    'originalRotationPreserved',true
  );
end;$function$;

revoke all on function public.create_dynamic_monthly_rotation_draft(uuid,integer,integer) from public;
grant execute on function public.create_dynamic_monthly_rotation_draft(uuid,integer,integer) to authenticated;

commit;
