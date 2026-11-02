-- קובץ: supabase/migrations/20260901093000_phase8_1_strategy_and_effective_month.sql
-- מטרה: הגדרת פעולות מסד נתונים עבור שיטת שיבוץ / חודש.
-- מטרות עיקריות:
-- - הגדרת פונקציות: public.dynamic_job_type_live_snapshot, public.get_dynamic_job_type_effective_config, public.save_dynamic_job_type, public.get_dynamic_scheduling_admin.
-- - מבני טבלאות: public.job_types, public.job_type_configuration_versions.
-- - סדר הפקודות, התנאים וההרשאות בקובץ נשמר כפי שהיה במקור.
begin;

-- Phase 8.1: a job type explicitly declares how its schedule is produced and
-- configuration changes can become effective in the current or next month.
-- The feature remains Shadow-only; no production schedule is changed here.

-- עדכון מבנה או הגדרות הטבלה public.job_types.
alter table public.job_types
  add column if not exists scheduling_strategy text not null default 'availability_optimizer';

-- עדכון מבנה או הגדרות הטבלה public.job_types.
alter table public.job_types
  drop constraint if exists job_types_scheduling_strategy_valid;

-- עדכון מבנה או הגדרות הטבלה public.job_types.
alter table public.job_types
  add constraint job_types_scheduling_strategy_valid
  check (scheduling_strategy in ('availability_optimizer','monthly_rotation_constraints'));

-- עדכון רשומות ב־public.job_types בהתאם לקלט ולתנאים להלן.
update public.job_types
set scheduling_strategy = case
  when code = 'on_call' then 'monthly_rotation_constraints'
  else 'availability_optimizer'
end
where scheduling_strategy is null
   or scheduling_strategy not in ('availability_optimizer','monthly_rotation_constraints')
   or code in ('dispatcher','on_call','morning_driver');

-- הגדרת מבנה הטבלה public.job_type_configuration_versions והאילוצים המופיעים בהמשך.
create table if not exists public.job_type_configuration_versions (
  id uuid primary key default gen_random_uuid(),
  job_type_id uuid not null references public.job_types(id) on delete cascade,
  effective_month date not null,
  snapshot jsonb not null,
  change_summary text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (job_type_id, effective_month),
  constraint job_type_configuration_versions_first_day
    check (effective_month = date_trunc('month', effective_month)::date),
  constraint job_type_configuration_versions_snapshot_object
    check (jsonb_typeof(snapshot) = 'object')
);

-- עדכון מבנה או הגדרות הטבלה public.job_type_configuration_versions.
alter table public.job_type_configuration_versions enable row level security;

drop trigger if exists set_job_type_configuration_versions_updated_at
  on public.job_type_configuration_versions;
create trigger set_job_type_configuration_versions_updated_at
before update on public.job_type_configuration_versions
for each row execute function public.set_updated_at();

-- פונקציית מסד public.dynamic_job_type_live_snapshot: סוג תפקיד.
create or replace function public.dynamic_job_type_live_snapshot(requested_job_type_id uuid)
returns jsonb
language sql
-- הפונקציה רצה בהרשאות הבעלים; בדיקות הרשאה פנימיות והרשאות EXECUTE נבחנות בנפרד.
security definer
set search_path=''
as $function$
  select jsonb_build_object(
    'id', jt.id,
    'scheduleGroupId', jt.schedule_group_id,
    'code', jt.code,
    'name', jt.name,
    'description', jt.description,
    'isActive', jt.is_active,
    'legacyRole', jt.legacy_role,
    'employmentScope', jt.employment_scope,
    'payModel', jt.pay_model,
    'payConfig', jt.pay_config,
    'availabilityConfig', jt.availability_config,
    'schedulingStrategy', jt.scheduling_strategy,
    'schedulingConfig', jt.scheduling_config,
    'statisticsConfig', jt.statistics_config,
    'aiConfig', jt.ai_config,
    'capabilities', coalesce((
      select jsonb_agg(c.capability_key order by c.capability_key)
      from public.job_type_capabilities c
      where c.job_type_id=jt.id and c.enabled
    ), '[]'::jsonb),
    'defaultPermissions', coalesce((
      select jsonb_agg(dp.permission_key order by dp.permission_key)
      from public.job_type_default_permissions dp
      where dp.job_type_id=jt.id
    ), '[]'::jsonb),
    'memberCount', (
      select count(*) from public.job_type_memberships m where m.job_type_id=jt.id
    ),
    'members', coalesce((
      select jsonb_agg(jsonb_build_object(
        'userId',m.user_id,
        'displayName',p.display_name,
        'isActive',p.is_active,
        'employmentScope',nullif(m.metadata->>'employmentScope',''),
        'recommendationFactor',case m.metadata->>'employmentScope' when 'part_time' then 0.5 else 1 end
      ) order by p.is_active desc,p.display_name)
      from public.job_type_memberships m
      join public.profiles p on p.id=m.user_id
      where m.job_type_id=jt.id
    ), '[]'::jsonb),
    'configurationVersions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'effectiveYear',extract(year from v.effective_month)::integer,
        'effectiveMonth',extract(month from v.effective_month)::integer,
        'effectiveMonthDate',v.effective_month,
        'schedulingStrategy',coalesce(v.snapshot->>'schedulingStrategy','availability_optimizer'),
        'changeSummary',v.change_summary,
        'createdAt',v.created_at
      ) order by v.effective_month)
      from public.job_type_configuration_versions v
      where v.job_type_id=jt.id
    ), '[]'::jsonb)
  )
  from public.job_types jt
  where jt.id=requested_job_type_id;
$function$;

-- הסרת ההרשאות המפורטות בפקודה מהתפקידים המצוינים בה.
revoke all on function public.dynamic_job_type_live_snapshot(uuid) from public;

-- פונקציית מסד public.get_dynamic_job_type_effective_config: שליפה או חישוב של סוג תפקיד.
create or replace function public.get_dynamic_job_type_effective_config(
  requested_job_type_id uuid,
  requested_year integer,
  requested_month integer
)
returns jsonb
language plpgsql
-- הפונקציה רצה בהרשאות הבעלים; בדיקות הרשאה פנימיות והרשאות EXECUTE נבחנות בנפרד.
security definer
set search_path=''
as $function$
declare
  -- current_user_id — המשתמש הנוכחי הנוכחי.
  current_user_id uuid := auth.uid();
  -- target_month — יעד / חודש.
  target_month date;
  -- result — תוצאה.
  result jsonb;
begin
  -- הסתעפות לפי התנאי current_user_id is null then raise exception 'not authenticated'; end if;.
  if current_user_id is null then raise exception 'not authenticated'; end if;
  -- הסתעפות לפי התנאי not exists (.
  if not exists (
    select 1 from public.user_permissions up
    where up.user_id=current_user_id and up.permission_key in ('users.view','users.manage')
  ) then raise exception 'not allowed'; end if;

  -- הסתעפות לפי התנאי requested_month not between 1 and 12 then raise exception 'invalid month'; end if;.
  if requested_month not between 1 and 12 then raise exception 'invalid month'; end if;
  target_month := make_date(requested_year, requested_month, 1);

  select v.snapshot into result
  from public.job_type_configuration_versions v
  where v.job_type_id=requested_job_type_id
    and v.effective_month <= target_month
  order by v.effective_month desc
  limit 1;

  -- הסתעפות לפי התנאי result is null.
  if result is null then
    result := public.dynamic_job_type_live_snapshot(requested_job_type_id);
  end if;

  -- הסתעפות לפי התנאי result is null then raise exception 'job type not found'; end if;.
  if result is null then raise exception 'job type not found'; end if;

  -- Membership is operational state rather than a versioned job-type setting.
  result := result || jsonb_build_object(
    'memberCount',(select count(*) from public.job_type_memberships m where m.job_type_id=requested_job_type_id),
    'members',coalesce((
      select jsonb_agg(jsonb_build_object(
        'userId',m.user_id,
        'displayName',p.display_name,
        'isActive',p.is_active,
        'employmentScope',nullif(m.metadata->>'employmentScope',''),
        'recommendationFactor',case m.metadata->>'employmentScope' when 'part_time' then 0.5 else 1 end
      ) order by p.is_active desc,p.display_name)
      from public.job_type_memberships m
      join public.profiles p on p.id=m.user_id
      where m.job_type_id=requested_job_type_id
    ),'[]'::jsonb),
    'configurationVersions',coalesce((
      select jsonb_agg(jsonb_build_object(
        'effectiveYear',extract(year from v.effective_month)::integer,
        'effectiveMonth',extract(month from v.effective_month)::integer,
        'effectiveMonthDate',v.effective_month,
        'schedulingStrategy',coalesce(v.snapshot->>'schedulingStrategy','availability_optimizer'),
        'changeSummary',v.change_summary,
        'createdAt',v.created_at
      ) order by v.effective_month)
      from public.job_type_configuration_versions v
      where v.job_type_id=requested_job_type_id
    ),'[]'::jsonb)
  );

  return result;
end;
$function$;

-- הסרת ההרשאות המפורטות בפקודה מהתפקידים המצוינים בה.
revoke all on function public.get_dynamic_job_type_effective_config(uuid,integer,integer) from public;
-- הקצאת ההרשאות המפורטות בפקודה לתפקידים המצוינים בה.
grant execute on function public.get_dynamic_job_type_effective_config(uuid,integer,integer) to authenticated;

-- פונקציית מסד public.save_dynamic_job_type: שמירת סוג תפקיד.
create or replace function public.save_dynamic_job_type(requested_payload jsonb)
returns uuid
language plpgsql
-- הפונקציה רצה בהרשאות הבעלים; בדיקות הרשאה פנימיות והרשאות EXECUTE נבחנות בנפרד.
security definer
set search_path=''
as $function$
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

  -- הסתעפות לפי התנאי target_group_id is null or not exists(select 1 from public.schedule_groups sg where sg.id=target_group_id) then raise ex.
  if target_group_id is null or not exists(select 1 from public.schedule_groups sg where sg.id=target_group_id) then raise exception 'schedule group not found'; end if;
  -- הסתעפות לפי התנאי target_code='' or target_code !~ '^[a-z0-9_]+$' then raise exception 'invalid job type code'; end if;.
  if target_code='' or target_code !~ '^[a-z0-9_]+$' then raise exception 'invalid job type code'; end if;
  -- הסתעפות לפי התנאי target_name='' then raise exception 'job type name is required'; end if;.
  if target_name='' then raise exception 'job type name is required'; end if;
  -- הסתעפות לפי התנאי target_scope not in ('full_time','part_time','flexible','other') then raise exception 'invalid employment scope'; end if.
  if target_scope not in ('full_time','part_time','flexible','other') then raise exception 'invalid employment scope'; end if;
  -- הסתעפות לפי התנאי target_pay_model not in ('hourly','per_shift','per_day','mixed','none') then raise exception 'invalid pay model'; end if.
  if target_pay_model not in ('hourly','per_shift','per_day','mixed','none') then raise exception 'invalid pay model'; end if;
  -- הסתעפות לפי התנאי target_strategy not in ('availability_optimizer','monthly_rotation_constraints') then raise exception 'invalid schedulin.
  if target_strategy not in ('availability_optimizer','monthly_rotation_constraints') then raise exception 'invalid scheduling strategy'; end if;

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

  return target_id;
end;
$function$;

-- הסרת ההרשאות המפורטות בפקודה מהתפקידים המצוינים בה.
revoke all on function public.save_dynamic_job_type(jsonb) from public;
-- הקצאת ההרשאות המפורטות בפקודה לתפקידים המצוינים בה.
grant execute on function public.save_dynamic_job_type(jsonb) to authenticated;

-- פונקציית מסד public.get_dynamic_scheduling_admin: שליפה או חישוב של דינמי.
create or replace function public.get_dynamic_scheduling_admin()
returns jsonb
language plpgsql
-- הפונקציה רצה בהרשאות הבעלים; בדיקות הרשאה פנימיות והרשאות EXECUTE נבחנות בנפרד.
security definer
set search_path=''
as $function$
declare
  -- current_user_id — המשתמש הנוכחי הנוכחי.
  current_user_id uuid := auth.uid();
begin
  -- הסתעפות לפי התנאי current_user_id is null then raise exception 'not authenticated'; end if;.
  if current_user_id is null then raise exception 'not authenticated'; end if;
  -- הסתעפות לפי התנאי not exists(select 1 from public.profiles p where p.id=current_user_id and p.is_active=true) then raise exception 'user n.
  if not exists(select 1 from public.profiles p where p.id=current_user_id and p.is_active=true) then raise exception 'user not active'; end if;
  -- הסתעפות לפי התנאי not exists(select 1 from public.user_permissions up where up.user_id=current_user_id and up.permission_key in ('users.vi.
  if not exists(select 1 from public.user_permissions up where up.user_id=current_user_id and up.permission_key in ('users.view','users.manage')) then raise exception 'not allowed'; end if;

  -- הרכבת תוצאת הפעולה והחזרתה לקורא.
  return jsonb_build_object(
    'featureEnabled',coalesce((select enabled from public.scheduling_feature_flags where key='dynamic_job_types'),false),
    'featureMode',coalesce((select config->>'mode' from public.scheduling_feature_flags where key='dynamic_job_types'),'shadow'),
    'ruleRegistry',coalesce((select jsonb_agg(jsonb_build_object('key',r.rule_key,'name',r.name,'description',r.description,'category',r.category,'supportedSeverities',r.supported_severities,'parameterSchema',r.parameter_schema) order by r.category,r.name) from public.scheduling_rule_registry r where r.is_active),'[]'::jsonb),
    'scheduleGroups',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',sg.id,'code',sg.code,'name',sg.name,'description',sg.description,'isActive',sg.is_active,'legacyKind',sg.legacy_kind,'config',sg.config,
        'versionCount',(select count(*) from public.schedule_group_versions v where v.schedule_group_id=sg.id),
        'currentVersion',coalesce((select max(v.version_number) from public.schedule_group_versions v where v.schedule_group_id=sg.id),0),
        'shiftTemplates',coalesce((select jsonb_agg(jsonb_build_object(
          'id',st.id,'code',st.code,'name',st.name,'dayKind',st.day_kind,'startTime',st.start_time,'endTime',st.end_time,
          'minWorkers',st.required_workers,'targetWorkers',st.target_workers,'maxWorkers',st.max_workers,'sortOrder',st.sort_order,'isActive',st.is_active,'metadata',st.metadata,
          'paySegments',coalesce((select jsonb_agg(jsonb_build_object('id',ps.id,'startTime',ps.start_time,'endTime',ps.end_time,'multiplier',ps.multiplier,'label',ps.label,'sortOrder',ps.sort_order) order by ps.sort_order) from public.schedule_shift_pay_segments ps where ps.shift_template_id=st.id),'[]'::jsonb)
        ) order by st.day_kind,st.sort_order,st.start_time) from public.schedule_group_shift_templates st where st.schedule_group_id=sg.id),'[]'::jsonb),
        'dayRules',coalesce((select jsonb_agg(jsonb_build_object('dayKind',dr.day_kind,'behavior',dr.behavior,'inheritDayKind',dr.inherit_day_kind,'metadata',dr.metadata) order by dr.day_kind) from public.schedule_group_day_rules dr where dr.schedule_group_id=sg.id),'[]'::jsonb)
      ) order by sg.name) from public.schedule_groups sg
    ),'[]'::jsonb),
    'jobTypes',coalesce((
      select jsonb_agg(public.dynamic_job_type_live_snapshot(jt.id) order by jt.is_active desc,jt.name)
      from public.job_types jt
    ),'[]'::jsonb)
  );
end;
$function$;

-- הסרת ההרשאות המפורטות בפקודה מהתפקידים המצוינים בה.
revoke all on function public.get_dynamic_scheduling_admin() from public;
-- הקצאת ההרשאות המפורטות בפקודה לתפקידים המצוינים בה.
grant execute on function public.get_dynamic_scheduling_admin() to authenticated;

-- עדכון רשומות ב־public.scheduling_feature_flags בהתאם לקלט ולתנאים להלן.
update public.scheduling_feature_flags
set config = coalesce(config,'{}'::jsonb) || jsonb_build_object(
  'phase','8.1',
  'mode','shadow',
  'schedulingStrategies',jsonb_build_array('availability_optimizer','monthly_rotation_constraints'),
  'jobTypeEffectiveMonthVersioning',true,
  'monthlyRotationEngineReady',false
)
where key='dynamic_job_types';

commit;
