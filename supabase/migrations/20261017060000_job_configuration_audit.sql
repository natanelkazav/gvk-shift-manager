-- Audits only actual changes; preserves active RPC business logic.
CREATE OR REPLACE FUNCTION public.audit_changed_jsonb(p_before jsonb, p_after jsonb, p_side text)
RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path TO '' AS $helper$
  SELECT coalesce(jsonb_object_agg(e.key, e.value), '{}'::jsonb)
  FROM jsonb_each(CASE WHEN p_side='before' THEN coalesce(p_before,'{}'::jsonb) ELSE coalesce(p_after,'{}'::jsonb) END) AS e
  WHERE (coalesce(p_before,'{}'::jsonb)->e.key) IS DISTINCT FROM (coalesce(p_after,'{}'::jsonb)->e.key)
$helper$;

CREATE OR REPLACE FUNCTION public.save_dynamic_job_type(requested_payload jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  audit_before jsonb;
  audit_after jsonb;
  audit_old_fields jsonb;
  audit_new_fields jsonb;
  audit_existing_name text;
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
  if target_strategy not in ('none','availability_optimizer','monthly_rotation_constraints') then raise exception 'invalid scheduling strategy'; end if;

  if target_id is not null then
    select jt.name into audit_existing_name from public.job_types jt where jt.id=target_id;
    if target_month=current_month then
      audit_before := public.dynamic_job_type_live_snapshot(target_id);
    else
      select v.snapshot into audit_before from public.job_type_configuration_versions v
      where v.job_type_id=target_id and v.effective_month=target_month;
      if audit_before is null then
        audit_before := public.dynamic_job_type_live_snapshot(target_id);
      end if;
    end if;
  else
    audit_before := '{}'::jsonb;
  end if;

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

  audit_after := snapshot;
  audit_old_fields := public.audit_changed_jsonb(audit_before, audit_after, 'before');
  audit_new_fields := public.audit_changed_jsonb(audit_before, audit_after, 'after');
  if audit_old_fields <> '{}'::jsonb or audit_new_fields <> '{}'::jsonb then
    insert into public.audit_logs(user_id,action,entity_type,entity_id,summary,actor_user_id,old_values,new_values,metadata)
    values(current_user_id,
      case when is_new then 'dynamic_job_type.created'
           when target_month>current_month then 'dynamic_job_type.future.updated'
           else 'dynamic_job_type.updated' end,
      'job_type',target_id,
      case when is_new then 'נוצר תפקיד חדש: '||target_name
           when target_month>current_month then 'עודכנו הגדרות עתידיות לתפקיד: '||target_name
           else 'עודכנו הגדרות התפקיד: '||target_name end,
      current_user_id,audit_old_fields,audit_new_fields,
      jsonb_build_object('job_type_id',target_id,'job_type_name',target_name,
        'previous_job_type_name',audit_existing_name,'effective_month',target_month,
        'is_future',target_month>current_month));
  end if;
  return target_id;
end;
$function$;


CREATE OR REPLACE FUNCTION public.save_dynamic_schedule_group(requested_payload jsonb)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  current_user_id uuid := auth.uid();
  target_group_id uuid := nullif(requested_payload->>'id','')::uuid;
  template_value jsonb;
  rule_value jsonb;
  segment_value jsonb;
  target_template_id uuid;
  template_codes text[] := array[]::text[];
  target_code text;
  target_name text;
  target_day_kind text;
  target_start time;
  target_end time;
  min_workers integer;
  target_workers_value integer;
  max_workers_value integer;
  shift_duration integer;
  segment_start_offset integer;
  segment_end_offset integer;
  new_version integer;
  audit_before jsonb;
  audit_after jsonb;
  audit_old_fields jsonb;
  audit_new_fields jsonb;
  audit_group_name text;
begin
  if current_user_id is null then raise exception 'not authenticated'; end if;
  if not exists (select 1 from public.profiles p where p.id=current_user_id and p.is_active=true) then raise exception 'user not active'; end if;
  if not exists (select 1 from public.user_permissions up where up.user_id=current_user_id and up.permission_key='users.manage') then raise exception 'not allowed'; end if;
  if target_group_id is null or not exists (select 1 from public.schedule_groups sg where sg.id=target_group_id) then raise exception 'schedule group not found'; end if;

  select sg.name into audit_group_name from public.schedule_groups sg where sg.id=target_group_id;
  audit_before := public.get_dynamic_schedule_group_snapshot(target_group_id);

  target_name := trim(coalesce(requested_payload->>'name',''));
  if target_name = '' then raise exception 'schedule group name is required'; end if;

  update public.schedule_groups
  set name=target_name,
      description=nullif(trim(coalesce(requested_payload->>'description','')), ''),
      is_active=coalesce((requested_payload->>'isActive')::boolean, true)
  where id=target_group_id;

  for template_value in select value from jsonb_array_elements(coalesce(requested_payload->'shiftTemplates','[]'::jsonb)) loop
    target_code := lower(trim(coalesce(template_value->>'code','')));
    target_name := trim(coalesce(template_value->>'name',''));
    target_day_kind := coalesce(template_value->>'dayKind','weekday');
    target_start := (template_value->>'startTime')::time;
    target_end := (template_value->>'endTime')::time;
    min_workers := coalesce((template_value->>'minWorkers')::integer, 1);
    target_workers_value := coalesce((template_value->>'targetWorkers')::integer, min_workers);
    max_workers_value := coalesce((template_value->>'maxWorkers')::integer, target_workers_value);

    if target_code = '' or target_code !~ '^[a-z0-9_]+$' then raise exception 'invalid shift code: %', target_code; end if;
    if target_name = '' then raise exception 'shift name is required'; end if;
    if target_day_kind not in ('weekday','friday','saturday','holiday_eve','holiday_full','holiday_end','chol_hamoed','custom') then raise exception 'invalid day kind'; end if;
    if target_start = target_end then raise exception 'shift start and end cannot be equal'; end if;
    if min_workers < 0 or target_workers_value < min_workers or max_workers_value < target_workers_value or max_workers_value > 50 then
      raise exception 'invalid worker requirements for shift %', target_code;
    end if;

    template_codes := array_append(template_codes, target_code);

    insert into public.schedule_group_shift_templates (
      schedule_group_id, code, name, day_kind, start_time, end_time,
      sort_order, required_workers, target_workers, max_workers, is_active, metadata
    ) values (
      target_group_id, target_code, target_name, target_day_kind, target_start, target_end,
      coalesce((template_value->>'sortOrder')::integer, 0), min_workers, target_workers_value, max_workers_value,
      coalesce((template_value->>'isActive')::boolean, true), coalesce(template_value->'metadata','{}'::jsonb)
    )
    on conflict (schedule_group_id, code) do update set
      name=excluded.name, day_kind=excluded.day_kind, start_time=excluded.start_time, end_time=excluded.end_time,
      sort_order=excluded.sort_order, required_workers=excluded.required_workers,
      target_workers=excluded.target_workers, max_workers=excluded.max_workers,
      is_active=excluded.is_active, metadata=excluded.metadata, updated_at=now()
    returning id into target_template_id;

    delete from public.schedule_shift_pay_segments where shift_template_id=target_template_id;
    shift_duration := public.dynamic_minutes_after(target_start, target_end);

    for segment_value in select value from jsonb_array_elements(coalesce(template_value->'paySegments','[]'::jsonb)) loop
      segment_start_offset := public.dynamic_minutes_after(target_start, (segment_value->>'startTime')::time);
      segment_end_offset := public.dynamic_minutes_after(target_start, (segment_value->>'endTime')::time);

      if segment_end_offset <= segment_start_offset
         or segment_start_offset < 0
         or segment_end_offset > shift_duration then
        raise exception 'pay segment is outside shift %', target_code;
      end if;

      insert into public.schedule_shift_pay_segments (
        shift_template_id, start_time, end_time, multiplier, label, sort_order, metadata
      ) values (
        target_template_id,
        (segment_value->>'startTime')::time,
        (segment_value->>'endTime')::time,
        coalesce((segment_value->>'multiplier')::numeric,1),
        nullif(trim(coalesce(segment_value->>'label','')), ''),
        coalesce((segment_value->>'sortOrder')::integer,0),
        '{"source":"phase3_editor"}'::jsonb
      );
    end loop;

    if exists (
      select 1
      from public.schedule_shift_pay_segments a
      join public.schedule_shift_pay_segments b
        on a.shift_template_id=b.shift_template_id and a.id < b.id
      where a.shift_template_id=target_template_id
        and public.dynamic_minutes_after(target_start,a.start_time) < public.dynamic_minutes_after(target_start,b.end_time)
        and public.dynamic_minutes_after(target_start,b.start_time) < public.dynamic_minutes_after(target_start,a.end_time)
    ) then
      raise exception 'overlapping pay segments for shift %', target_code;
    end if;
  end loop;

  if cardinality(template_codes) = 0 then
    delete from public.schedule_group_shift_templates where schedule_group_id=target_group_id;
  else
    delete from public.schedule_group_shift_templates
    where schedule_group_id=target_group_id and not (code = any(template_codes));
  end if;

  delete from public.schedule_group_day_rules where schedule_group_id=target_group_id;
  for rule_value in select value from jsonb_array_elements(coalesce(requested_payload->'dayRules','[]'::jsonb)) loop
    if coalesce(rule_value->>'dayKind','') not in ('weekday','friday','saturday','holiday_eve','holiday_full','holiday_end','chol_hamoed','custom') then
      raise exception 'invalid rule day kind';
    end if;
    if coalesce(rule_value->>'behavior','') not in ('own_templates','inherit','no_work') then raise exception 'invalid day behavior'; end if;
    if rule_value->>'behavior'='inherit' and nullif(rule_value->>'inheritDayKind','') is null then raise exception 'inherit day kind is required'; end if;

    insert into public.schedule_group_day_rules (schedule_group_id,day_kind,behavior,inherit_day_kind,metadata)
    values (
      target_group_id,
      rule_value->>'dayKind',
      rule_value->>'behavior',
      case when rule_value->>'behavior'='inherit' then rule_value->>'inheritDayKind' else null end,
      coalesce(rule_value->'metadata','{}'::jsonb)
    );
  end loop;

  select coalesce(max(v.version_number),0)+1 into new_version
  from public.schedule_group_versions v where v.schedule_group_id=target_group_id;

  insert into public.schedule_group_versions (schedule_group_id,version_number,snapshot,change_summary,created_by)
  values (
    target_group_id,
    new_version,
    public.get_dynamic_schedule_group_snapshot(target_group_id),
    nullif(trim(coalesce(requested_payload->>'changeSummary','')), ''),
    current_user_id
  );

  update public.scheduling_feature_flags
  set config = jsonb_set(jsonb_set(config,'{phase}','3'::jsonb,true),'{mode}','"shadow"'::jsonb,true),
      updated_at=now()
  where key='dynamic_job_types';

  audit_after := public.get_dynamic_schedule_group_snapshot(target_group_id);
  audit_old_fields := public.audit_changed_jsonb(audit_before,audit_after,'before');
  audit_new_fields := public.audit_changed_jsonb(audit_before,audit_after,'after');
  if audit_old_fields <> '{}'::jsonb or audit_new_fields <> '{}'::jsonb then
    insert into public.audit_logs(user_id,action,entity_type,entity_id,summary,actor_user_id,old_values,new_values,metadata)
    values(current_user_id,'schedule_group.configuration.updated','schedule_group',target_group_id,
      'עודכן מבנה המשמרות: '||coalesce(nullif(trim(coalesce(requested_payload->>'name','')),''),audit_group_name),
      current_user_id,audit_old_fields,audit_new_fields,
      jsonb_build_object('schedule_group_id',target_group_id,'schedule_group_name',coalesce(requested_payload->>'name',audit_group_name)));
  end if;
  return new_version;
end;
$function$;

