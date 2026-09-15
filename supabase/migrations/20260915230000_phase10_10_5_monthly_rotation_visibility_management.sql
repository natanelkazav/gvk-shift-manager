begin;

create or replace function public.get_dynamic_job_type_rotation_workspace(
  requested_job_type_id uuid,
  requested_start_date date default current_date,
  requested_days integer default 35
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_actor uuid:=auth.uid();
  v_job public.job_types%rowtype;
  v_state public.dynamic_job_type_rotation_state%rowtype;
  v_days integer:=least(greatest(coalesce(requested_days,35),1),93);
  v_members jsonb:='[]'::jsonb;
  v_preview jsonb:='[]'::jsonb;
begin
  if v_actor is null then raise exception 'not authenticated'; end if;
  if not exists(
    select 1 from public.user_permissions up
    where up.user_id=v_actor and up.permission_key='users.manage'
  ) then raise exception 'not allowed'; end if;

  select * into v_job from public.job_types where id=requested_job_type_id;
  if v_job.id is null then raise exception 'job type not found'; end if;
  if coalesce(v_job.scheduling_strategy,'availability_optimizer') <> 'monthly_rotation_constraints' then
    raise exception 'job type is not configured for monthly rotation';
  end if;

  select * into v_state
  from public.dynamic_job_type_rotation_state
  where job_type_id=v_job.id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'userId',m.user_id,
    'displayName',coalesce(p.schedule_name,p.display_name,p.email,m.user_id::text),
    'isActive',p.is_active,
    'rotationIndex',case
      when v_state.rotation_user_ids is null then null
      else array_position(v_state.rotation_user_ids,m.user_id)
    end
  ) order by coalesce(array_position(v_state.rotation_user_ids,m.user_id),2147483647),
             coalesce(p.schedule_name,p.display_name,p.email,m.user_id::text)), '[]'::jsonb)
  into v_members
  from public.job_type_memberships m
  join public.profiles p on p.id=m.user_id
  where m.job_type_id=v_job.id;

  if v_state.job_type_id is not null then
    with days as (
      select d::date work_date,
             v_state.rotation_user_ids[
               ((d::date-v_state.anchor_date)%cardinality(v_state.rotation_user_ids)
                 +cardinality(v_state.rotation_user_ids))%cardinality(v_state.rotation_user_ids)+1
             ] original_user_id
      from generate_series(
        coalesce(requested_start_date,current_date)::timestamp,
        (coalesce(requested_start_date,current_date)+v_days-1)::timestamp,
        interval '1 day'
      ) d
    ), actual as (
      select s.shift_date work_date,
             pa.user_id,
             pa.original_user_id,
             row_number() over(partition by s.shift_date order by pa.created_at desc,pa.id desc) rn
      from public.dynamic_schedule_published_assignments pa
      join public.dynamic_schedule_publications pub on pub.id=pa.publication_id
      join public.dynamic_availability_slots s on s.id=pa.slot_id
      where pub.job_type_id=v_job.id
        and s.shift_date between coalesce(requested_start_date,current_date)
                             and coalesce(requested_start_date,current_date)+v_days-1
    )
    select coalesce(jsonb_agg(jsonb_build_object(
      'date',d.work_date,
      'originalUserId',d.original_user_id,
      'originalDisplayName',coalesce(op.schedule_name,op.display_name,op.email,d.original_user_id::text),
      'actualUserId',a.user_id,
      'actualDisplayName',case when a.user_id is null then null else coalesce(ap.schedule_name,ap.display_name,ap.email,a.user_id::text) end,
      'isSubstitution',case when a.user_id is null then false else a.user_id is distinct from d.original_user_id end
    ) order by d.work_date),'[]'::jsonb)
    into v_preview
    from days d
    left join public.profiles op on op.id=d.original_user_id
    left join actual a on a.work_date=d.work_date and a.rn=1
    left join public.profiles ap on ap.id=a.user_id;
  end if;

  return jsonb_build_object(
    'jobTypeId',v_job.id,
    'jobTypeName',v_job.name,
    'initialized',v_state.job_type_id is not null,
    'rotationUserIds',coalesce(to_jsonb(v_state.rotation_user_ids),'[]'::jsonb),
    'anchorDate',v_state.anchor_date,
    'source',v_state.source,
    'sourceMetadata',coalesce(v_state.source_metadata,'{}'::jsonb),
    'members',v_members,
    'preview',v_preview
  );
end;
$function$;

create or replace function public.initialize_dynamic_job_type_rotation_state(
  requested_job_type_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_actor uuid:=auth.uid();
  v_job public.job_types%rowtype;
  v_member_count integer;
  v_rotation uuid[];
  v_anchor date;
  v_source text;
  v_history_rows integer:=0;
begin
  if v_actor is null then raise exception 'not authenticated'; end if;
  if not exists(select 1 from public.user_permissions up where up.user_id=v_actor and up.permission_key='users.manage')
    then raise exception 'not allowed'; end if;

  select * into v_job from public.job_types where id=requested_job_type_id;
  if v_job.id is null then raise exception 'job type not found'; end if;
  if coalesce(v_job.scheduling_strategy,'availability_optimizer') <> 'monthly_rotation_constraints'
    then raise exception 'job type is not configured for monthly rotation'; end if;

  if exists(select 1 from public.dynamic_job_type_rotation_state where job_type_id=v_job.id) then
    return public.get_dynamic_job_type_rotation_workspace(v_job.id,current_date,35);
  end if;

  select count(*)::integer into v_member_count
  from public.job_type_memberships m join public.profiles p on p.id=m.user_id and p.is_active=true
  where m.job_type_id=v_job.id;
  if v_member_count < 2 then raise exception 'monthly rotation requires at least two active role members'; end if;

  with hist as (
    select ha.work_date,coalesce(ha.original_user_id,ha.assigned_user_id) user_id,
           row_number() over(order by ha.work_date,ha.id) rn
    from public.dynamic_historical_assignments ha
    join public.dynamic_historical_periods hp on hp.id=ha.historical_period_id
    join public.job_type_memberships jm on jm.job_type_id=hp.job_type_id
      and jm.user_id=coalesce(ha.original_user_id,ha.assigned_user_id)
    where hp.job_type_id=v_job.id and ha.work_date is not null
      and coalesce(ha.original_user_id,ha.assigned_user_id) is not null
  ), candidates as (
    select h0.work_date anchor_date,array_agg(h.user_id order by h.rn) rotation
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
    select array_agg(x.user_id order by x.display_name,x.user_id),current_date,'membership_fallback'
    into v_rotation,v_anchor,v_source
    from (
      select m.user_id,coalesce(p.schedule_name,p.display_name,p.email,m.user_id::text) display_name
      from public.job_type_memberships m join public.profiles p on p.id=m.user_id and p.is_active=true
      where m.job_type_id=v_job.id
    ) x;
  end if;

  insert into public.dynamic_job_type_rotation_state(
    job_type_id,rotation_user_ids,anchor_date,source,source_metadata,created_by
  ) values(
    v_job.id,v_rotation,v_anchor,v_source,
    jsonb_build_object('historicalRowsCompared',v_history_rows,'memberCount',v_member_count),
    v_actor
  );

  insert into public.audit_logs(action,actor_user_id,entity_type,entity_id,summary,metadata)
  values('system_event',v_actor,'job_type',v_job.id,'סבב חודשי אותחל',
    jsonb_build_object('rotationUserIds',to_jsonb(v_rotation),'anchorDate',v_anchor,'source',v_source));

  return public.get_dynamic_job_type_rotation_workspace(v_job.id,current_date,35);
end;
$function$;

create or replace function public.update_dynamic_job_type_rotation_state(
  requested_job_type_id uuid,
  requested_rotation_user_ids uuid[],
  requested_anchor_date date,
  requested_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_actor uuid:=auth.uid();
  v_active_count integer;
begin
  if v_actor is null then raise exception 'not authenticated'; end if;
  if not exists(select 1 from public.user_permissions up where up.user_id=v_actor and up.permission_key='users.manage')
    then raise exception 'not allowed'; end if;
  if requested_anchor_date is null then raise exception 'anchor date is required'; end if;
  if requested_rotation_user_ids is null or cardinality(requested_rotation_user_ids)<2
    then raise exception 'rotation requires at least two members'; end if;
  if cardinality(requested_rotation_user_ids) <>
     (select count(distinct x) from unnest(requested_rotation_user_ids) x)
    then raise exception 'rotation contains duplicate members'; end if;

  select count(*)::integer into v_active_count
  from public.job_type_memberships m
  join public.profiles p on p.id=m.user_id and p.is_active=true
  where m.job_type_id=requested_job_type_id
    and m.user_id=any(requested_rotation_user_ids);

  if v_active_count<>cardinality(requested_rotation_user_ids) then
    raise exception 'rotation contains users who are not active members of this job type';
  end if;

  if v_active_count <> (
    select count(*) from public.job_type_memberships m
    join public.profiles p on p.id=m.user_id and p.is_active=true
    where m.job_type_id=requested_job_type_id
  ) then raise exception 'rotation must contain every active role member exactly once'; end if;

  insert into public.dynamic_job_type_rotation_state(
    job_type_id,rotation_user_ids,anchor_date,source,source_metadata,created_by
  ) values(
    requested_job_type_id,requested_rotation_user_ids,requested_anchor_date,'manual',
    jsonb_build_object('reason',nullif(trim(coalesce(requested_reason,'')),''),'updatedBy',v_actor,'updatedAt',now()),
    v_actor
  )
  on conflict(job_type_id) do update set
    rotation_user_ids=excluded.rotation_user_ids,
    anchor_date=excluded.anchor_date,
    source='manual',
    source_metadata=excluded.source_metadata,
    updated_at=now();

  insert into public.audit_logs(action,actor_user_id,entity_type,entity_id,summary,metadata)
  values('system_event',v_actor,'job_type',requested_job_type_id,'סבב חודשי עודכן ידנית',
    jsonb_build_object('rotationUserIds',to_jsonb(requested_rotation_user_ids),
      'anchorDate',requested_anchor_date,'reason',requested_reason));

  return public.get_dynamic_job_type_rotation_workspace(requested_job_type_id,requested_anchor_date,35);
end;
$function$;

revoke all on function public.get_dynamic_job_type_rotation_workspace(uuid,date,integer) from public;
revoke all on function public.initialize_dynamic_job_type_rotation_state(uuid) from public;
revoke all on function public.update_dynamic_job_type_rotation_state(uuid,uuid[],date,text) from public;
grant execute on function public.get_dynamic_job_type_rotation_workspace(uuid,date,integer) to authenticated;
grant execute on function public.initialize_dynamic_job_type_rotation_state(uuid) to authenticated;
grant execute on function public.update_dynamic_job_type_rotation_state(uuid,uuid[],date,text) to authenticated;

commit;
