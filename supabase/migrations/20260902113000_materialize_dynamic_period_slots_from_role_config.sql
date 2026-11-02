-- קובץ: supabase/migrations/20260902113000_materialize_dynamic_period_slots_from_role_config.sql
-- מטרה: הגדרת פעולות מסד נתונים עבור דינמי / תקופה / תצורה.
-- מטרות עיקריות:
-- - הגדרת פונקציות: public.materialize_dynamic_availability_period_slots, public.create_dynamic_availability_shadow_period, public.set_dynamic_period_status, public.get_my_dynamic_availability_workspace.
-- - סדר הפקודות, התנאים וההרשאות בקובץ נשמר כפי שהיה במקור.
begin;

-- Phase 8.3B.5
-- Fix the generic employee availability flow so monthly availability slots are
-- generated from the effective dynamic role configuration/materialization,
-- rather than relying on the legacy/internal schedule_group templates.

-- פונקציית מסד public.materialize_dynamic_availability_period_slots: תקופת אילוצים.
create or replace function public.materialize_dynamic_availability_period_slots(
  requested_period_id uuid
)
returns integer
language plpgsql
-- הפונקציה רצה בהרשאות הבעלים; בדיקות הרשאה פנימיות והרשאות EXECUTE נבחנות בנפרד.
security definer
set search_path=''
as $function$
declare
  -- period_row — תקופה / שורה.
  period_row public.dynamic_availability_periods%rowtype;
  -- target_month — יעד / חודש.
  target_month date;
  -- materialization_row — מימוש תצורת השיבוץ לחודש / שורה.
  materialization_row public.job_type_schedule_materializations%rowtype;
  -- day_date — יום / תאריך.
  day_date date;
  -- dow_value — ערך.
  dow_value integer;
  -- source_day_kind_value — מקור / יום / ערך.
  source_day_kind_value text;
  -- effective_day_kind_value — יום / ערך.
  effective_day_kind_value text;
  -- holiday_name_value — חג / שם / ערך.
  holiday_name_value text;
  -- day_behavior — יום.
  day_behavior text;
  -- inherit_day_kind_value — יום / ערך.
  inherit_day_kind_value text;
  -- day_works — יום.
  day_works boolean;
  -- shift_row — משמרת / שורה.
  shift_row public.job_type_materialized_shift_templates%rowtype;
  created_slots integer := 0;
  existing_slots integer := 0;
  pay_snapshot jsonb;
begin
  select * into period_row
  from public.dynamic_availability_periods
  where id=requested_period_id;

  -- הסתעפות לפי התנאי period_row.id is null.
  if period_row.id is null then
    -- עצירת הפעולה עם שגיאה כאשר התנאי בבלוק מתקיים.
    raise exception 'dynamic availability period not found';
  end if;

  select count(*) into existing_slots
  from public.dynamic_availability_slots
  where period_id=period_row.id;

  -- Never rebuild an already materialized period implicitly. This protects
  -- existing employee entries from being detached from their original slots.
  -- הסתעפות לפי התנאי existing_slots > 0.
  if existing_slots > 0 then
    return existing_slots;
  end if;

  target_month := make_date(period_row.year,period_row.month,1);

  select * into materialization_row
  from public.job_type_schedule_materializations m
  where m.job_type_id=period_row.job_type_id
    and m.effective_month<=target_month
  order by m.effective_month desc
  limit 1;

  -- הסתעפות לפי התנאי materialization_row.id is null.
  if materialization_row.id is null then
    -- עצירת הפעולה עם שגיאה כאשר התנאי בבלוק מתקיים.
    raise exception 'no effective role materialization exists for job type % in %/%',
      period_row.job_type_id,period_row.month,period_row.year;
  end if;

  -- מעבר על תוצאות השאילתה או האוסף ועיבוד כל רשומה בנפרד.
  for day_date in
    select d::date
    from generate_series(
      target_month,
      (target_month + interval '1 month - 1 day')::date,
      interval '1 day'
    ) d
  loop
    dow_value := extract(dow from day_date)::integer;
    holiday_name_value := null;
    source_day_kind_value := null;

    select csd.schedule_type,csd.event_name
      into source_day_kind_value,holiday_name_value
    from public.calendar_special_days csd
    where csd.event_date=day_date
    order by
      case when csd.source_name='manual' then 0 else 1 end,
      case csd.schedule_type
        when 'holiday_full' then 1
        when 'holiday_end' then 2
        when 'holiday_eve' then 3
        when 'chol_hamoed' then 4
        else 5
      end
    limit 1;

    -- הסתעפות לפי התנאי source_day_kind_value is null.
    if source_day_kind_value is null then
      source_day_kind_value := case
        when dow_value=5 then 'friday'
        when dow_value=6 then 'saturday'
        else 'weekday'
      end;
    end if;

    day_behavior := 'own_templates';
    inherit_day_kind_value := null;
    day_works := true;

    select d.behavior,d.inherit_day_kind,d.works
      into day_behavior,inherit_day_kind_value,day_works
    from public.job_type_materialized_day_rules d
    where d.materialization_id=materialization_row.id
      and d.day_kind=source_day_kind_value
    limit 1;

    -- If no explicit rule exists, use the source day itself.
    day_behavior := coalesce(day_behavior,'own_templates');
    day_works := coalesce(day_works,true);

    -- הסתעפות לפי התנאי day_works is false or day_behavior='no_work'.
    if day_works is false or day_behavior='no_work' then
      continue;
    end if;

    effective_day_kind_value := case
      when day_behavior='inherit' then coalesce(inherit_day_kind_value,source_day_kind_value)
      else source_day_kind_value
    end;

    -- מעבר על תוצאות השאילתה או האוסף ועיבוד כל רשומה בנפרד.
    for shift_row in
      select s.*
      from public.job_type_materialized_shift_templates s
      where s.materialization_id=materialization_row.id
        and s.day_kind=effective_day_kind_value
        and s.is_active=true
      order by s.sort_order,s.start_time,s.code
    loop
      select coalesce(jsonb_agg(jsonb_build_object(
        'type',pc.component_type,
        'multiplier',pc.multiplier,
        'hours',pc.hours,
        'label',pc.label,
        'metadata',pc.metadata
      ) order by pc.created_at),'[]'::jsonb)
      into pay_snapshot
      from public.job_type_materialized_pay_components pc
      where pc.shift_template_id=shift_row.id;

      -- הוספת רשומות ל־public.dynamic_availability_slots בהתאם לקלט ולתנאים להלן.
      insert into public.dynamic_availability_slots(
        period_id,
        shift_date,
        template_id,
        shift_code,
        shift_name,
        start_time,
        end_time,
        source_day_kind,
        effective_day_kind,
        holiday_name,
        min_workers,
        target_workers,
        max_workers,
        pay_segments_snapshot,
        metadata
      ) values (
        period_row.id,
        day_date,
        null,
        shift_row.code,
        shift_row.name,
        shift_row.start_time,
        shift_row.end_time,
        source_day_kind_value,
        effective_day_kind_value,
        holiday_name_value,
        shift_row.required_workers,
        shift_row.required_workers,
        shift_row.required_workers,
        pay_snapshot,
        jsonb_build_object(
          'source','dynamic_role_materialization',
          'materializationId',materialization_row.id,
          'materializedTemplateId',shift_row.id,
          'workMode',materialization_row.work_mode,
          'effectiveMonth',materialization_row.effective_month,
          'contains200Percent',shift_row.contains_200_percent,
          'premium200Hours',shift_row.premium_200_hours
        )
      )
      on conflict(period_id,shift_date,shift_code) do nothing;

      -- הסתעפות לפי התנאי found.
      if found then
        created_slots := created_slots + 1;
      end if;
    end loop;
  end loop;

  -- עדכון רשומות ב־public.dynamic_availability_periods בהתאם לקלט ולתנאים להלן.
  update public.dynamic_availability_periods
  set config_snapshot = coalesce(materialization_row.source_snapshot->'availabilityConfig',config_snapshot),
      updated_at=now()
  where id=period_row.id;

  return created_slots;
end;
$function$;

-- הסרת ההרשאות המפורטות בפקודה מהתפקידים המצוינים בה.
revoke all on function public.materialize_dynamic_availability_period_slots(uuid) from public;

-- פונקציית מסד public.create_dynamic_availability_shadow_period: יצירת דינמי / אילוצים וזמינות / טיוטות שיבוץ במנגנון הדינמי / תקופה.
create or replace function public.create_dynamic_availability_shadow_period(
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
  current_user_id uuid:=auth.uid();
  -- target_job — יעד.
  target_job public.job_types%rowtype;
  -- target_period_id — מזהה התקופה היעד.
  target_period_id uuid;
  -- effective_config — תצורה.
  effective_config jsonb;
  created_slots integer:=0;
begin
  -- הסתעפות לפי התנאי current_user_id is null then raise exception 'not authenticated'; end if;.
  if current_user_id is null then raise exception 'not authenticated'; end if;
  -- הסתעפות לפי התנאי not exists(.
  if not exists(
    select 1 from public.user_permissions up
    where up.user_id=current_user_id and up.permission_key='users.manage'
  ) then raise exception 'not allowed'; end if;
  -- הסתעפות לפי התנאי requested_year not between 2020 and 2100 or requested_month not between 1 and 12.
  if requested_year not between 2020 and 2100 or requested_month not between 1 and 12 then
    -- עצירת הפעולה עם שגיאה כאשר התנאי בבלוק מתקיים.
    raise exception 'invalid year or month';
  end if;

  select * into target_job from public.job_types where id=requested_job_type_id;
  -- הסתעפות לפי התנאי target_job.id is null then raise exception 'job type not found'; end if;.
  if target_job.id is null then raise exception 'job type not found'; end if;

  select m.source_snapshot into effective_config
  from public.job_type_schedule_materializations m
  where m.job_type_id=target_job.id
    and m.effective_month<=make_date(requested_year,requested_month,1)
  order by m.effective_month desc
  limit 1;

  -- הסתעפות לפי התנאי effective_config is null.
  if effective_config is null then
    -- עצירת הפעולה עם שגיאה כאשר התנאי בבלוק מתקיים.
    raise exception 'no effective role configuration exists for this month';
  end if;

  -- הסתעפות לפי התנאי coalesce((effective_config#>>'{availabilityConfig,enabled}')::boolean,.
  if coalesce((effective_config#>>'{availabilityConfig,enabled}')::boolean,
              (target_job.availability_config->>'enabled')::boolean,
              false) is not true then
    -- עצירת הפעולה עם שגיאה כאשר התנאי בבלוק מתקיים.
    raise exception 'availability is disabled for job type';
  end if;

  -- הוספת רשומות ל־public.dynamic_availability_periods בהתאם לקלט ולתנאים להלן.
  insert into public.dynamic_availability_periods(
    schedule_group_id,job_type_id,year,month,title,status,config_snapshot,source,created_by
  ) values(
    target_job.schedule_group_id,
    target_job.id,
    requested_year,
    requested_month,
    target_job.name || ' · ' || requested_month || '/' || requested_year,
    'shadow',
    coalesce(effective_config->'availabilityConfig',target_job.availability_config,'{}'::jsonb),
    'dynamic_role',
    current_user_id
  )
  on conflict(job_type_id,year,month) do update set
    schedule_group_id=excluded.schedule_group_id,
    config_snapshot=excluded.config_snapshot,
    updated_at=now()
  returning id into target_period_id;

  created_slots := public.materialize_dynamic_availability_period_slots(target_period_id);

  -- הרכבת תוצאת הפעולה והחזרתה לקורא.
  return jsonb_build_object(
    'periodId',target_period_id,
    'createdSlots',created_slots,
    'slotCount',(select count(*) from public.dynamic_availability_slots s where s.period_id=target_period_id),
    'mode','dynamic_role'
  );
end;
$function$;

-- הסרת ההרשאות המפורטות בפקודה מהתפקידים המצוינים בה.
revoke all on function public.create_dynamic_availability_shadow_period(uuid,integer,integer) from public;
-- הקצאת ההרשאות המפורטות בפקודה לתפקידים המצוינים בה.
grant execute on function public.create_dynamic_availability_shadow_period(uuid,integer,integer) to authenticated;

-- פונקציית מסד public.set_dynamic_period_status: קביעת קבוצה ייחודית / דינמי / תקופה / סטטוס.
create or replace function public.set_dynamic_period_status(
  requested_job_type_id uuid,
  requested_year integer,
  requested_month integer,
  requested_action text
)
returns jsonb
language plpgsql
-- הפונקציה רצה בהרשאות הבעלים; בדיקות הרשאה פנימיות והרשאות EXECUTE נבחנות בנפרד.
security definer
set search_path=''
as $function$
declare
  current_user_id uuid:=auth.uid();
  -- target_period — יעד / תקופה.
  target_period public.dynamic_availability_periods%rowtype;
  -- next_status — סטטוס.
  next_status text;
  slot_count integer:=0;
begin
  -- הסתעפות לפי התנאי current_user_id is null then raise exception 'not authenticated'; end if;.
  if current_user_id is null then raise exception 'not authenticated'; end if;
  -- הסתעפות לפי התנאי not exists(.
  if not exists(
    select 1 from public.user_permissions up
    where up.user_id=current_user_id and up.permission_key='users.manage'
  ) then raise exception 'not allowed'; end if;

  select * into target_period
  from public.dynamic_availability_periods
  where job_type_id=requested_job_type_id and year=requested_year and month=requested_month;

  -- הסתעפות לפי התנאי target_period.id is null then raise exception 'dynamic period not found'; end if;.
  if target_period.id is null then raise exception 'dynamic period not found'; end if;

  -- הסתעפות לפי התנאי requested_action='open' and target_period.status in ('shadow','draft','closed','open').
  if requested_action='open' and target_period.status in ('shadow','draft','closed','open') then
    -- Ensure the employee-facing month is populated before it becomes usable.
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
    -- עצירת הפעולה עם שגיאה כאשר התנאי בבלוק מתקיים.
    raise exception 'invalid period transition from % using %',target_period.status,requested_action;
  end if;

  -- עדכון רשומות ב־public.dynamic_availability_periods בהתאם לקלט ולתנאים להלן.
  update public.dynamic_availability_periods
  set status=next_status,updated_at=now()
  where id=target_period.id;

  select count(*) into slot_count
  from public.dynamic_availability_slots
  where period_id=target_period.id;

  -- הרכבת תוצאת הפעולה והחזרתה לקורא.
  return jsonb_build_object(
    'periodId',target_period.id,
    'status',next_status,
    'action',requested_action,
    'slotCount',slot_count
  );
end;
$function$;

-- פונקציית מסד public.get_my_dynamic_availability_workspace: שליפה או חישוב של דינמי / אילוצים וזמינות.
create or replace function public.get_my_dynamic_availability_workspace(
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
  current_user_id uuid:=auth.uid();
  job public.job_types%rowtype;
  -- period — תקופה.
  period public.dynamic_availability_periods%rowtype;
  sub public.dynamic_availability_submissions%rowtype;
  -- normalized_config — תצורה.
  normalized_config jsonb;
  -- effective_availability_config — אילוצים וזמינות / תצורה.
  effective_availability_config jsonb;
begin
  -- הסתעפות לפי התנאי current_user_id is null then raise exception 'not authenticated'; end if;.
  if current_user_id is null then raise exception 'not authenticated'; end if;
  -- הסתעפות לפי התנאי not exists(.
  if not exists(
    select 1 from public.job_type_memberships m
    where m.user_id=current_user_id and m.job_type_id=requested_job_type_id
  ) then raise exception 'not a member of this job type'; end if;

  select * into job
  from public.job_types
  where id=requested_job_type_id and is_active=true;
  -- הסתעפות לפי התנאי job.id is null then raise exception 'job type not found'; end if;.
  if job.id is null then raise exception 'job type not found'; end if;

  select * into period
  from public.dynamic_availability_periods
  where job_type_id=job.id and year=requested_year and month=requested_month;
  -- הסתעפות לפי התנאי period.id is null then raise exception 'dynamic period not found'; end if;.
  if period.id is null then raise exception 'dynamic period not found'; end if;
  -- הסתעפות לפי התנאי period.status not in ('open','closed','archived').
  if period.status not in ('open','closed','archived') then
    -- עצירת הפעולה עם שגיאה כאשר התנאי בבלוק מתקיים.
    raise exception 'period is not available to employees';
  end if;

  -- Auto-heal periods that were created before this fix and therefore have
  -- no monthly slots yet. The helper never rebuilds a populated period.
  -- הסתעפות לפי התנאי not exists(.
  if not exists(
    select 1 from public.dynamic_availability_slots s where s.period_id=period.id
  ) then
    perform public.materialize_dynamic_availability_period_slots(period.id);
  end if;

  select * into sub
  from public.dynamic_availability_submissions
  where period_id=period.id and user_id=current_user_id;

  effective_availability_config:=coalesce(period.config_snapshot,job.availability_config,'{}'::jsonb);

  normalized_config:=jsonb_build_object(
    'enabled',coalesce((effective_availability_config->>'enabled')::boolean,true),
    'statuses',case
      when jsonb_typeof(effective_availability_config->'statuses')='array'
        and jsonb_array_length(effective_availability_config->'statuses')>0
      then effective_availability_config->'statuses'
      else '["available","unavailable"]'::jsonb
    end,
    'allowNotes',coalesce((effective_availability_config->>'allowNotes')::boolean,true),
    'monthlyCapacity',coalesce(
      effective_availability_config->'monthlyCapacity',
      '{"enabled":false,"minEnabled":false,"targetEnabled":false,"maxEnabled":false,"defaultMin":null,"defaultTarget":null,"defaultMax":null}'::jsonb
    ),
    'limits',coalesce(
      effective_availability_config->'limits',
      '{"maxNightsEnabled":false,"defaultMaxNights":null,"maxWeekendsEnabled":false,"defaultMaxWeekends":null,"maxHolidaysEnabled":false,"defaultMaxHolidays":null}'::jsonb
    )
  );

  -- הרכבת תוצאת הפעולה והחזרתה לקורא.
  return jsonb_build_object(
    'materialized',true,
    'mode','dynamic_role',
    'periodId',period.id,
    'jobTypeId',job.id,
    'jobTypeName',job.name,
    'availabilityConfig',normalized_config,
    'slots',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',s.id,
        'date',s.shift_date,
        'shiftCode',s.shift_code,
        'shiftName',s.shift_name,
        'startTime',s.start_time,
        'endTime',s.end_time,
        'holidayName',s.holiday_name,
        'sourceDayKind',s.source_day_kind,
        'effectiveDayKind',s.effective_day_kind,
        'minWorkers',s.min_workers,
        'targetWorkers',s.target_workers,
        'maxWorkers',s.max_workers
      ) order by s.shift_date,s.start_time,s.shift_code)
      from public.dynamic_availability_slots s
      where s.period_id=period.id
    ),'[]'::jsonb),
    'members',jsonb_build_array(jsonb_build_object(
      'userId',current_user_id,
      'displayName',(select display_name from public.profiles where id=current_user_id),
      'isActive',coalesce((select is_active from public.profiles where id=current_user_id),true),
      'submissionId',sub.id,
      'status',coalesce(sub.status,'draft'),
      'minimum',sub.min_shifts,
      'target',sub.target_shifts,
      'maximum',sub.max_shifts,
      'maxNights',sub.max_nights,
      'maxWeekends',sub.max_weekends,
      'maxHolidays',sub.max_holidays,
      'note',sub.note,
      'entries',coalesce((
        select jsonb_object_agg(
          e.slot_id::text,
          jsonb_build_object('status',e.availability_status,'note',e.note)
        )
        from public.dynamic_availability_entries e
        where e.submission_id=sub.id
      ),'{}'::jsonb)
    ))
  );
end;
$function$;

-- הסרת ההרשאות המפורטות בפקודה מהתפקידים המצוינים בה.
revoke all on function public.get_my_dynamic_availability_workspace(uuid,integer,integer) from public;
-- הקצאת ההרשאות המפורטות בפקודה לתפקידים המצוינים בה.
grant execute on function public.get_my_dynamic_availability_workspace(uuid,integer,integer) to authenticated;

-- Repair already-created empty periods (including currently-open test periods).
-- Do not let one old/incomplete test role block the migration of all others.
do $block$
declare
  p record;
  generated integer;
begin
  -- מעבר על תוצאות השאילתה או האוסף ועיבוד כל רשומה בנפרד.
  for p in
    select dap.id,dap.job_type_id,dap.year,dap.month
    from public.dynamic_availability_periods dap
    where not exists(
      select 1 from public.dynamic_availability_slots das where das.period_id=dap.id
    )
    order by dap.year,dap.month,dap.created_at
  loop
    begin
      generated:=public.materialize_dynamic_availability_period_slots(p.id);
      raise notice 'materialized dynamic availability period % (%/%): % slots',p.id,p.month,p.year,generated;
    exception when others then
      raise notice 'skipped dynamic availability period % (%/%): %',p.id,p.month,p.year,sqlerrm;
    end;
  end loop;
end;
$block$;

commit;
