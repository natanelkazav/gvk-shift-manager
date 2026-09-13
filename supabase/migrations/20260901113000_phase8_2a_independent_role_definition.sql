begin;

-- Phase 8.2A: independent dynamic role definition.
-- New roles no longer choose a legacy/system affiliation. A private schedule group is created internally.
-- Employment definitions and weekday/Friday/Saturday/holiday hours are stored in scheduling_config and versioned by effective month.

create or replace function public.save_dynamic_job_type(requested_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path=''
as $function$
declare
  current_user_id uuid:=auth.uid();
  target_id uuid;
  target_group_id uuid;
  target_code text;
  target_name text;
  target_description text;
  target_scope text;
  target_pay_model text;
  target_strategy text;
  target_is_active boolean;
  target_pay_config jsonb;
  target_availability_config jsonb;
  target_scheduling_config jsonb;
  target_statistics_config jsonb;
  target_ai_config jsonb;
  target_legacy_role text;
  target_month date;
  current_month date := date_trunc('month', now() at time zone 'Asia/Jerusalem')::date;
  next_month date := (date_trunc('month', now() at time zone 'Asia/Jerusalem') + interval '1 month')::date;
  snapshot jsonb;
  capability_value jsonb;
  permission_value jsonb;
  is_new boolean := false;
begin
  if current_user_id is null then raise exception 'not authenticated'; end if;
  if not exists(select 1 from public.profiles p where p.id=current_user_id and p.is_active=true) then raise exception 'user not active'; end if;
  if not exists(select 1 from public.user_permissions up where up.user_id=current_user_id and up.permission_key='users.manage') then raise exception 'not allowed'; end if;

  target_id:=nullif(requested_payload->>'id','')::uuid;
  target_group_id:=nullif(requested_payload->>'scheduleGroupId','')::uuid;
  target_code:=lower(trim(coalesce(requested_payload->>'code','')));
  target_name:=trim(coalesce(requested_payload->>'name',''));
  target_description:=nullif(trim(coalesce(requested_payload->>'description','')),'');
  target_scope:=coalesce(requested_payload->>'employmentScope','flexible');
  target_pay_model:=coalesce(requested_payload->>'payModel','none');
  target_strategy:=coalesce(requested_payload->>'schedulingStrategy','availability_optimizer');
  target_is_active:=coalesce((requested_payload->>'isActive')::boolean,true);
  target_pay_config:=coalesce(requested_payload->'payConfig','{}'::jsonb);
  target_availability_config:=coalesce(requested_payload->'availabilityConfig','{}'::jsonb);
  target_scheduling_config:=coalesce(requested_payload->'schedulingConfig','{}'::jsonb);
  target_statistics_config:=coalesce(requested_payload->'statisticsConfig','{}'::jsonb);

  if nullif(requested_payload->>'effectiveYear','') is null
     or nullif(requested_payload->>'effectiveMonth','') is null then
    target_month := current_month;
  else
    target_month := make_date(
      (requested_payload->>'effectiveYear')::integer,
      (requested_payload->>'effectiveMonth')::integer,
      1
    );
  end if;

  if target_month not in (current_month,next_month) then
    raise exception 'job type changes may only target the current or next month';
  end if;

  -- New dynamic roles are independent. Their schedule group is an internal implementation detail, not a legacy affiliation.
  if target_id is null and target_group_id is null then
    insert into public.schedule_groups(code,name,description,legacy_kind,config)
    values('job_' || target_code, target_name || ' · מערך עצמאי', 'מערך פנימי שנוצר אוטומטית עבור סוג התפקיד ' || target_name, null, jsonb_build_object('ownerJobTypeCode',target_code,'independent',true))
    returning id into target_group_id;
  elsif target_group_id is null or not exists(select 1 from public.schedule_groups sg where sg.id=target_group_id) then
    raise exception 'schedule group not found';
  end if;
  if target_code='' or target_code !~ '^[a-z0-9_]+$' then raise exception 'invalid job type code'; end if;
  if target_name='' then raise exception 'job type name is required'; end if;
  if target_scope not in ('full_time','part_time','flexible') then raise exception 'invalid employment scope'; end if;
  if target_pay_model not in ('hourly','per_shift','per_day','mixed','none') then raise exception 'invalid pay model'; end if;
  if target_strategy not in ('availability_optimizer','monthly_rotation_constraints') then raise exception 'invalid scheduling strategy'; end if;

  if target_id is null then
    if target_month <> current_month then raise exception 'new job types must start in the current month'; end if;
    is_new := true;
    insert into public.job_types(
      schedule_group_id,code,name,description,is_active,employment_scope,pay_model,pay_config,
      availability_config,scheduling_strategy,scheduling_config,statistics_config,ai_config
    ) values(
      target_group_id,target_code,target_name,target_description,target_is_active,target_scope,target_pay_model,target_pay_config,
      target_availability_config,target_strategy,target_scheduling_config,target_statistics_config,'{"allow_suggestions":true,"auto_apply":false}'::jsonb
    ) returning id,legacy_role,ai_config into target_id,target_legacy_role,target_ai_config;
  else
    select jt.legacy_role,jt.ai_config into target_legacy_role,target_ai_config
    from public.job_types jt where jt.id=target_id;
    if not found then raise exception 'job type not found'; end if;

    if target_month=current_month then
      update public.job_types set
        schedule_group_id=target_group_id,
        code=case when legacy_role is null then target_code else code end,
        name=target_name,
        description=target_description,
        is_active=target_is_active,
        employment_scope=target_scope,
        pay_model=target_pay_model,
        pay_config=target_pay_config,
        availability_config=target_availability_config,
        scheduling_strategy=target_strategy,
        scheduling_config=target_scheduling_config,
        statistics_config=target_statistics_config
      where id=target_id;
    end if;
  end if;

  if target_month=current_month then
    delete from public.job_type_capabilities where job_type_id=target_id;
    for capability_value in select value from jsonb_array_elements(coalesce(requested_payload->'capabilities','[]'::jsonb)) loop
      insert into public.job_type_capabilities(job_type_id,capability_key,enabled,source)
      values(target_id,trim(both '"' from capability_value::text),true,'manual')
      on conflict(job_type_id,capability_key) do update set enabled=true,source='manual';
    end loop;

    delete from public.job_type_default_permissions where job_type_id=target_id;
    for permission_value in select value from jsonb_array_elements(coalesce(requested_payload->'defaultPermissions','[]'::jsonb)) loop
      insert into public.job_type_default_permissions(job_type_id,permission_key,source)
      values(target_id,trim(both '"' from permission_value::text),'manual')
      on conflict(job_type_id,permission_key) do nothing;
    end loop;

    snapshot := public.dynamic_job_type_live_snapshot(target_id);
  else
    -- Future configuration is a complete snapshot. It does not mutate the live/current row.
    snapshot := jsonb_build_object(
      'id',target_id,
      'scheduleGroupId',target_group_id,
      'code',case when target_legacy_role is null then target_code else (select code from public.job_types where id=target_id) end,
      'name',target_name,
      'description',target_description,
      'isActive',target_is_active,
      'legacyRole',target_legacy_role,
      'employmentScope',target_scope,
      'payModel',target_pay_model,
      'payConfig',target_pay_config,
      'availabilityConfig',target_availability_config,
      'schedulingStrategy',target_strategy,
      'schedulingConfig',target_scheduling_config,
      'statisticsConfig',target_statistics_config,
      'aiConfig',coalesce(target_ai_config,'{}'::jsonb),
      'capabilities',coalesce(requested_payload->'capabilities','[]'::jsonb),
      'defaultPermissions',coalesce(requested_payload->'defaultPermissions','[]'::jsonb)
    );
  end if;

  insert into public.job_type_configuration_versions(
    job_type_id,effective_month,snapshot,change_summary,created_by
  ) values(
    target_id,target_month,snapshot,nullif(trim(coalesce(requested_payload->>'changeSummary','')),''),current_user_id
  )
  on conflict(job_type_id,effective_month) do update set
    snapshot=excluded.snapshot,
    change_summary=excluded.change_summary,
    created_by=excluded.created_by,
    updated_at=now();

  return target_id;
end;
$function$;

revoke all on function public.save_dynamic_job_type(jsonb) from public;
grant execute on function public.save_dynamic_job_type(jsonb) to authenticated;


commit;
