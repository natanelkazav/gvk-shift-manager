-- קובץ: supabase/migrations/20261017060000_job_configuration_audit.sql
-- מטרה: הגדרת פעולות מסד נתונים עבור תצורה / יומן שינויים.
-- מטרות עיקריות:
-- - הגדרת פונקציות: public.audit_changed_jsonb, public.save_dynamic_job_type, public.save_dynamic_schedule_group.
-- - סדר הפקודות, התנאים וההרשאות בקובץ נשמר כפי שהיה במקור.
-- Audits only actual changes; preserves active RPC business logic.
-- פונקציית מסד public.audit_changed_jsonb: יומן שינויים.
CREATE OR REPLACE FUNCTION public.audit_changed_jsonb(p_before jsonb, p_after jsonb, p_side text)
RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path TO '' AS $helper$
  SELECT coalesce(jsonb_object_agg(e.key, e.value), '{}'::jsonb)
  FROM jsonb_each(CASE WHEN p_side='before' THEN coalesce(p_before,'{}'::jsonb) ELSE coalesce(p_after,'{}'::jsonb) END) AS e
  WHERE (coalesce(p_before,'{}'::jsonb)->e.key) IS DISTINCT FROM (coalesce(p_after,'{}'::jsonb)->e.key)
$helper$;

-- פונקציית מסד public.save_dynamic_job_type: שמירת סוג תפקיד.
CREATE OR REPLACE FUNCTION public.save_dynamic_job_type(requested_payload jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 -- הפונקציה רצה בהרשאות הבעלים; בדיקות הרשאה פנימיות והרשאות EXECUTE נבחנות בנפרד.
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  current_user_id uuid:=auth.uid();
  -- target_id — יעד / מזהה.
  target_id uuid;
  -- target_group_id — יעד / קבוצה / מזהה.
  target_group_id uuid;
  -- target_code — יעד.
  target_code text;
  -- target_name — יעד / שם.
  target_name text;
  -- target_description — יעד.
  target_description text;
  -- target_scope — יעד.
  target_scope text;
  -- target_pay_model — יעד.
  target_pay_model text;
  -- target_strategy — יעד / שיטת שיבוץ.
  target_strategy text;
  -- target_is_active — האם הרשומה פעילה היעד.
  target_is_active boolean;
  -- target_pay_config — יעד / תצורה.
  target_pay_config jsonb;
  -- target_availability_config — יעד / אילוצים וזמינות / תצורה.
  target_availability_config jsonb;
  -- target_scheduling_config — יעד / תצורה.
  target_scheduling_config jsonb;
  -- target_statistics_config — יעד / סטטיסטיקה / תצורה.
  target_statistics_config jsonb;
  -- target_ai_config — יעד / תצורה.
  target_ai_config jsonb;
  -- target_legacy_role — יעד.
  target_legacy_role text;
  -- target_month — יעד / חודש.
  target_month date;
  -- current_month — חודש.
  current_month date := date_trunc('month', now() at time zone 'Asia/Jerusalem')::date;
  -- next_month — חודש.
  next_month date := (date_trunc('month', now() at time zone 'Asia/Jerusalem') + interval '1 month')::date;
  snapshot jsonb;
  -- capability_value — ערך.
  capability_value jsonb;
  -- permission_value — הרשאות / ערך.
  permission_value jsonb;
  is_new boolean := false;
  -- audit_before — יומן שינויים.
  audit_before jsonb;
  -- audit_after — יומן שינויים.
  audit_after jsonb;
  -- audit_old_fields — יומן שינויים.
  audit_old_fields jsonb;
  -- audit_new_fields — יומן שינויים.
  audit_new_fields jsonb;
  -- audit_existing_name — יומן שינויים / שם.
  audit_existing_name text;
begin
  -- הסתעפות לפי התנאי current_user_id is null then raise exception 'not authenticated'; end if;.
  if current_user_id is null then raise exception 'not authenticated'; end if;
  -- הסתעפות לפי התנאי not exists(select 1 from public.profiles p where p.id=current_user_id and p.is_active=true) then raise exception 'user n.
  if not exists(select 1 from public.profiles p where p.id=current_user_id and p.is_active=true) then raise exception 'user not active'; end if;
  -- הסתעפות לפי התנאי not exists(select 1 from public.user_permissions up where up.user_id=current_user_id and up.permission_key='users.manage.
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

  -- הסתעפות לפי התנאי nullif(requested_payload->>'effectiveYear','') is null.
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

  -- הסתעפות לפי התנאי target_month not in (current_month,next_month).
  if target_month not in (current_month,next_month) then
    -- עצירת הפעולה עם שגיאה כאשר התנאי בבלוק מתקיים.
    raise exception 'job type changes may only target the current or next month';
  end if;

  -- New dynamic roles are independent. Their schedule group is an internal implementation detail, not a legacy affiliation.
  -- הסתעפות לפי התנאי target_id is null and target_group_id is null.
  if target_id is null and target_group_id is null then
    -- הוספת רשומות ל־public.schedule_groups בהתאם לקלט ולתנאים להלן.
    insert into public.schedule_groups(code,name,description,legacy_kind,config)
    values('job_' || target_code, target_name || ' · מערך עצמאי', 'מערך פנימי שנוצר אוטומטית עבור סוג התפקיד ' || target_name, null, jsonb_build_object('ownerJobTypeCode',target_code,'independent',true))
    returning id into target_group_id;
  elsif target_group_id is null or not exists(select 1 from public.schedule_groups sg where sg.id=target_group_id) then
    -- עצירת הפעולה עם שגיאה כאשר התנאי בבלוק מתקיים.
    raise exception 'schedule group not found';
  end if;
  -- הסתעפות לפי התנאי target_code='' or target_code !~ '^[a-z0-9_]+$' then raise exception 'invalid job type code'; end if;.
  if target_code='' or target_code !~ '^[a-z0-9_]+$' then raise exception 'invalid job type code'; end if;
  -- הסתעפות לפי התנאי target_name='' then raise exception 'job type name is required'; end if;.
  if target_name='' then raise exception 'job type name is required'; end if;
  -- הסתעפות לפי התנאי target_scope not in ('full_time','part_time','flexible') then raise exception 'invalid employment scope'; end if;.
  if target_scope not in ('full_time','part_time','flexible') then raise exception 'invalid employment scope'; end if;
  -- הסתעפות לפי התנאי target_pay_model not in ('hourly','per_shift','per_day','mixed','none') then raise exception 'invalid pay model'; end if.
  if target_pay_model not in ('hourly','per_shift','per_day','mixed','none') then raise exception 'invalid pay model'; end if;
  -- הסתעפות לפי התנאי target_strategy not in ('none','availability_optimizer','monthly_rotation_constraints') then raise exception 'invalid sc.
  if target_strategy not in ('none','availability_optimizer','monthly_rotation_constraints') then raise exception 'invalid scheduling strategy'; end if;

  -- הסתעפות לפי התנאי target_id is not null.
  if target_id is not null then
    select jt.name into audit_existing_name from public.job_types jt where jt.id=target_id;
    -- הסתעפות לפי התנאי target_month=current_month.
    if target_month=current_month then
      audit_before := public.dynamic_job_type_live_snapshot(target_id);
    else
      select v.snapshot into audit_before from public.job_type_configuration_versions v
      where v.job_type_id=target_id and v.effective_month=target_month;
      -- הסתעפות לפי התנאי audit_before is null.
      if audit_before is null then
        audit_before := public.dynamic_job_type_live_snapshot(target_id);
      end if;
    end if;
  else
    audit_before := '{}'::jsonb;
  end if;

  -- הסתעפות לפי התנאי target_id is null.
  if target_id is null then
    -- הסתעפות לפי התנאי target_month <> current_month then raise exception 'new job types must start in the current month'; end if;.
    if target_month <> current_month then raise exception 'new job types must start in the current month'; end if;
    is_new := true;
    -- הוספת רשומות ל־public.job_types בהתאם לקלט ולתנאים להלן.
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
    -- הסתעפות לפי התנאי not found then raise exception 'job type not found'; end if;.
    if not found then raise exception 'job type not found'; end if;

    -- הסתעפות לפי התנאי target_month=current_month.
    if target_month=current_month then
      -- עדכון רשומות ב־public.job_types בהתאם לקלט ולתנאים להלן.
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

  -- הסתעפות לפי התנאי target_month=current_month.
  if target_month=current_month then
    -- מחיקת הרשומות שנבחרו מתוך public.job_type_capabilities בהתאם לקלט ולתנאים להלן.
    delete from public.job_type_capabilities where job_type_id=target_id;
    -- מעבר על תוצאות השאילתה או האוסף ועיבוד כל רשומה בנפרד.
    for capability_value in select value from jsonb_array_elements(coalesce(requested_payload->'capabilities','[]'::jsonb)) loop
      -- הוספת רשומות ל־public.job_type_capabilities בהתאם לקלט ולתנאים להלן.
      insert into public.job_type_capabilities(job_type_id,capability_key,enabled,source)
      values(target_id,trim(both '"' from capability_value::text),true,'manual')
      on conflict(job_type_id,capability_key) do update set enabled=true,source='manual';
    end loop;

    -- מחיקת הרשומות שנבחרו מתוך public.job_type_default_permissions בהתאם לקלט ולתנאים להלן.
    delete from public.job_type_default_permissions where job_type_id=target_id;
    -- מעבר על תוצאות השאילתה או האוסף ועיבוד כל רשומה בנפרד.
    for permission_value in select value from jsonb_array_elements(coalesce(requested_payload->'defaultPermissions','[]'::jsonb)) loop
      -- הוספת רשומות ל־public.job_type_default_permissions בהתאם לקלט ולתנאים להלן.
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

  -- הוספת רשומות ל־public.job_type_configuration_versions בהתאם לקלט ולתנאים להלן.
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
  -- הסתעפות לפי התנאי audit_old_fields <> '{}'::jsonb or audit_new_fields <> '{}'::jsonb.
  if audit_old_fields <> '{}'::jsonb or audit_new_fields <> '{}'::jsonb then
    -- הוספת רשומות ל־public.audit_logs בהתאם לקלט ולתנאים להלן.
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


-- פונקציית מסד public.save_dynamic_schedule_group: שמירת דינמי / שיבוץ / קבוצה.
CREATE OR REPLACE FUNCTION public.save_dynamic_schedule_group(requested_payload jsonb)
 RETURNS integer
 LANGUAGE plpgsql
 -- הפונקציה רצה בהרשאות הבעלים; בדיקות הרשאה פנימיות והרשאות EXECUTE נבחנות בנפרד.
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  -- current_user_id — המשתמש הנוכחי הנוכחי.
  current_user_id uuid := auth.uid();
  -- target_group_id — יעד / קבוצה / מזהה.
  target_group_id uuid := nullif(requested_payload->>'id','')::uuid;
  -- template_value — תבנית / ערך.
  template_value jsonb;
  -- rule_value — כלל / ערך.
  rule_value jsonb;
  -- segment_value — ערך.
  segment_value jsonb;
  -- target_template_id — יעד / תבנית / מזהה.
  target_template_id uuid;
  -- template_codes — תבנית.
  template_codes text[] := array[]::text[];
  -- target_code — יעד.
  target_code text;
  -- target_name — יעד / שם.
  target_name text;
  -- target_day_kind — יעד / יום.
  target_day_kind text;
  target_start time;
  target_end time;
  min_workers integer;
  -- target_workers_value — יעד / ערך.
  target_workers_value integer;
  -- max_workers_value — ערך.
  max_workers_value integer;
  -- shift_duration — משמרת / משך.
  shift_duration integer;
  -- segment_start_offset — מיקום תחילת התוצאות.
  segment_start_offset integer;
  -- segment_end_offset — מיקום תחילת התוצאות.
  segment_end_offset integer;
  -- new_version — גרסה.
  new_version integer;
  -- audit_before — יומן שינויים.
  audit_before jsonb;
  -- audit_after — יומן שינויים.
  audit_after jsonb;
  -- audit_old_fields — יומן שינויים.
  audit_old_fields jsonb;
  -- audit_new_fields — יומן שינויים.
  audit_new_fields jsonb;
  -- audit_group_name — יומן שינויים / קבוצה / שם.
  audit_group_name text;
begin
  -- הסתעפות לפי התנאי current_user_id is null then raise exception 'not authenticated'; end if;.
  if current_user_id is null then raise exception 'not authenticated'; end if;
  -- הסתעפות לפי התנאי not exists (select 1 from public.profiles p where p.id=current_user_id and p.is_active=true) then raise exception 'user .
  if not exists (select 1 from public.profiles p where p.id=current_user_id and p.is_active=true) then raise exception 'user not active'; end if;
  -- הסתעפות לפי התנאי not exists (select 1 from public.user_permissions up where up.user_id=current_user_id and up.permission_key='users.manag.
  if not exists (select 1 from public.user_permissions up where up.user_id=current_user_id and up.permission_key='users.manage') then raise exception 'not allowed'; end if;
  -- הסתעפות לפי התנאי target_group_id is null or not exists (select 1 from public.schedule_groups sg where sg.id=target_group_id) then raise e.
  if target_group_id is null or not exists (select 1 from public.schedule_groups sg where sg.id=target_group_id) then raise exception 'schedule group not found'; end if;

  select sg.name into audit_group_name from public.schedule_groups sg where sg.id=target_group_id;
  audit_before := public.get_dynamic_schedule_group_snapshot(target_group_id);

  target_name := trim(coalesce(requested_payload->>'name',''));
  -- הסתעפות לפי התנאי target_name = '' then raise exception 'schedule group name is required'; end if;.
  if target_name = '' then raise exception 'schedule group name is required'; end if;

  -- עדכון רשומות ב־public.schedule_groups בהתאם לקלט ולתנאים להלן.
  update public.schedule_groups
  set name=target_name,
      description=nullif(trim(coalesce(requested_payload->>'description','')), ''),
      is_active=coalesce((requested_payload->>'isActive')::boolean, true)
  where id=target_group_id;

  -- מעבר על תוצאות השאילתה או האוסף ועיבוד כל רשומה בנפרד.
  for template_value in select value from jsonb_array_elements(coalesce(requested_payload->'shiftTemplates','[]'::jsonb)) loop
    target_code := lower(trim(coalesce(template_value->>'code','')));
    target_name := trim(coalesce(template_value->>'name',''));
    target_day_kind := coalesce(template_value->>'dayKind','weekday');
    target_start := (template_value->>'startTime')::time;
    target_end := (template_value->>'endTime')::time;
    min_workers := coalesce((template_value->>'minWorkers')::integer, 1);
    target_workers_value := coalesce((template_value->>'targetWorkers')::integer, min_workers);
    max_workers_value := coalesce((template_value->>'maxWorkers')::integer, target_workers_value);

    -- הסתעפות לפי התנאי target_code = '' or target_code !~ '^[a-z0-9_]+$' then raise exception 'invalid shift code: %', target_code; end if;.
    if target_code = '' or target_code !~ '^[a-z0-9_]+$' then raise exception 'invalid shift code: %', target_code; end if;
    -- הסתעפות לפי התנאי target_name = '' then raise exception 'shift name is required'; end if;.
    if target_name = '' then raise exception 'shift name is required'; end if;
    -- הסתעפות לפי התנאי target_day_kind not in ('weekday','friday','saturday','holiday_eve','holiday_full','holiday_end','chol_hamoed','custom').
    if target_day_kind not in ('weekday','friday','saturday','holiday_eve','holiday_full','holiday_end','chol_hamoed','custom') then raise exception 'invalid day kind'; end if;
    -- הסתעפות לפי התנאי target_start = target_end then raise exception 'shift start and end cannot be equal'; end if;.
    if target_start = target_end then raise exception 'shift start and end cannot be equal'; end if;
    -- הסתעפות לפי התנאי min_workers < 0 or target_workers_value < min_workers or max_workers_value < target_workers_value or max_workers_value >.
    if min_workers < 0 or target_workers_value < min_workers or max_workers_value < target_workers_value or max_workers_value > 50 then
      -- עצירת הפעולה עם שגיאה כאשר התנאי בבלוק מתקיים.
      raise exception 'invalid worker requirements for shift %', target_code;
    end if;

    template_codes := array_append(template_codes, target_code);

    -- הוספת רשומות ל־public.schedule_group_shift_templates בהתאם לקלט ולתנאים להלן.
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

    -- מחיקת הרשומות שנבחרו מתוך public.schedule_shift_pay_segments בהתאם לקלט ולתנאים להלן.
    delete from public.schedule_shift_pay_segments where shift_template_id=target_template_id;
    shift_duration := public.dynamic_minutes_after(target_start, target_end);

    -- מעבר על תוצאות השאילתה או האוסף ועיבוד כל רשומה בנפרד.
    for segment_value in select value from jsonb_array_elements(coalesce(template_value->'paySegments','[]'::jsonb)) loop
      segment_start_offset := public.dynamic_minutes_after(target_start, (segment_value->>'startTime')::time);
      segment_end_offset := public.dynamic_minutes_after(target_start, (segment_value->>'endTime')::time);

      -- הסתעפות לפי התנאי segment_end_offset <= segment_start_offset.
      if segment_end_offset <= segment_start_offset
         or segment_start_offset < 0
         or segment_end_offset > shift_duration then
        -- עצירת הפעולה עם שגיאה כאשר התנאי בבלוק מתקיים.
        raise exception 'pay segment is outside shift %', target_code;
      end if;

      -- הוספת רשומות ל־public.schedule_shift_pay_segments בהתאם לקלט ולתנאים להלן.
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

    -- הסתעפות לפי התנאי exists (.
    if exists (
      select 1
      from public.schedule_shift_pay_segments a
      join public.schedule_shift_pay_segments b
        on a.shift_template_id=b.shift_template_id and a.id < b.id
      where a.shift_template_id=target_template_id
        and public.dynamic_minutes_after(target_start,a.start_time) < public.dynamic_minutes_after(target_start,b.end_time)
        and public.dynamic_minutes_after(target_start,b.start_time) < public.dynamic_minutes_after(target_start,a.end_time)
    ) then
      -- עצירת הפעולה עם שגיאה כאשר התנאי בבלוק מתקיים.
      raise exception 'overlapping pay segments for shift %', target_code;
    end if;
  end loop;

  -- הסתעפות לפי התנאי cardinality(template_codes) = 0.
  if cardinality(template_codes) = 0 then
    -- מחיקת הרשומות שנבחרו מתוך public.schedule_group_shift_templates בהתאם לקלט ולתנאים להלן.
    delete from public.schedule_group_shift_templates where schedule_group_id=target_group_id;
  else
    -- מחיקת הרשומות שנבחרו מתוך public.schedule_group_shift_templates בהתאם לקלט ולתנאים להלן.
    delete from public.schedule_group_shift_templates
    where schedule_group_id=target_group_id and not (code = any(template_codes));
  end if;

  -- מחיקת הרשומות שנבחרו מתוך public.schedule_group_day_rules בהתאם לקלט ולתנאים להלן.
  delete from public.schedule_group_day_rules where schedule_group_id=target_group_id;
  -- מעבר על תוצאות השאילתה או האוסף ועיבוד כל רשומה בנפרד.
  for rule_value in select value from jsonb_array_elements(coalesce(requested_payload->'dayRules','[]'::jsonb)) loop
    -- הסתעפות לפי התנאי coalesce(rule_value->>'dayKind','') not in ('weekday','friday','saturday','holiday_eve','holiday_full','holiday_end','ch.
    if coalesce(rule_value->>'dayKind','') not in ('weekday','friday','saturday','holiday_eve','holiday_full','holiday_end','chol_hamoed','custom') then
      -- עצירת הפעולה עם שגיאה כאשר התנאי בבלוק מתקיים.
      raise exception 'invalid rule day kind';
    end if;
    -- הסתעפות לפי התנאי coalesce(rule_value->>'behavior','') not in ('own_templates','inherit','no_work') then raise exception 'invalid day beha.
    if coalesce(rule_value->>'behavior','') not in ('own_templates','inherit','no_work') then raise exception 'invalid day behavior'; end if;
    -- הסתעפות לפי התנאי rule_value->>'behavior'='inherit' and nullif(rule_value->>'inheritDayKind','') is null then raise exception 'inherit day.
    if rule_value->>'behavior'='inherit' and nullif(rule_value->>'inheritDayKind','') is null then raise exception 'inherit day kind is required'; end if;

    -- הוספת רשומות ל־public.schedule_group_day_rules בהתאם לקלט ולתנאים להלן.
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

  -- הוספת רשומות ל־public.schedule_group_versions בהתאם לקלט ולתנאים להלן.
  insert into public.schedule_group_versions (schedule_group_id,version_number,snapshot,change_summary,created_by)
  values (
    target_group_id,
    new_version,
    public.get_dynamic_schedule_group_snapshot(target_group_id),
    nullif(trim(coalesce(requested_payload->>'changeSummary','')), ''),
    current_user_id
  );

  -- עדכון רשומות ב־public.scheduling_feature_flags בהתאם לקלט ולתנאים להלן.
  update public.scheduling_feature_flags
  set config = jsonb_set(jsonb_set(config,'{phase}','3'::jsonb,true),'{mode}','"shadow"'::jsonb,true),
      updated_at=now()
  where key='dynamic_job_types';

  audit_after := public.get_dynamic_schedule_group_snapshot(target_group_id);
  audit_old_fields := public.audit_changed_jsonb(audit_before,audit_after,'before');
  audit_new_fields := public.audit_changed_jsonb(audit_before,audit_after,'after');
  -- הסתעפות לפי התנאי audit_old_fields <> '{}'::jsonb or audit_new_fields <> '{}'::jsonb.
  if audit_old_fields <> '{}'::jsonb or audit_new_fields <> '{}'::jsonb then
    -- הוספת רשומות ל־public.audit_logs בהתאם לקלט ולתנאים להלן.
    insert into public.audit_logs(user_id,action,entity_type,entity_id,summary,actor_user_id,old_values,new_values,metadata)
    values(current_user_id,'schedule_group.configuration.updated','schedule_group',target_group_id,
      'עודכן מבנה המשמרות: '||coalesce(nullif(trim(coalesce(requested_payload->>'name','')),''),audit_group_name),
      current_user_id,audit_old_fields,audit_new_fields,
      jsonb_build_object('schedule_group_id',target_group_id,'schedule_group_name',coalesce(requested_payload->>'name',audit_group_name)));
  end if;
  return new_version;
end;
$function$;

