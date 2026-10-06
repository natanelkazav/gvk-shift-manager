-- Keep manager availability focused on active employees and make daily on-call
-- availability slots use the operational window configured in the Role Builder.

begin;

create or replace function public.materialize_dynamic_availability_period_slots(
  requested_period_id uuid
)
returns integer
language plpgsql
security definer
set search_path=''
as $function$
declare
  period_row public.dynamic_availability_periods%rowtype;
  target_month date;
  materialization_row public.job_type_schedule_materializations%rowtype;
  day_date date;
  dow_value integer;
  source_day_kind_value text;
  base_day_kind_value text;
  effective_day_kind_value text;
  holiday_name_value text;
  day_behavior text;
  inherit_day_kind_value text;
  day_works boolean;
  shift_row public.job_type_materialized_shift_templates%rowtype;
  created_slots integer := 0;
  existing_slots integer := 0;
  pay_snapshot jsonb;
  daily_start_time time;
  daily_end_time time;
begin
  select * into period_row
  from public.dynamic_availability_periods
  where id=requested_period_id;

  if period_row.id is null then
    raise exception 'dynamic availability period not found';
  end if;

  target_month := make_date(period_row.year,period_row.month,1);

  select * into materialization_row
  from public.job_type_schedule_materializations m
  where m.job_type_id=period_row.job_type_id
    and m.effective_month<=target_month
  order by m.effective_month desc
  limit 1;

  if materialization_row.id is null then
    raise exception 'no effective role materialization exists for job type % in %/%',
      period_row.job_type_id,period_row.month,period_row.year;
  end if;

  -- Daily on-call is a single operational window per day. The role builder
  -- stores that window in shiftPattern.dailyOnCallWindow; do not use the
  -- synthetic 00:00-23:59 materialized template as the employee-facing time.
  if materialization_row.work_mode = 'on_call_daily' then
    daily_start_time := coalesce(
      nullif(materialization_row.source_snapshot #>> '{schedulingConfig,shiftPattern,dailyOnCallWindow,startTime}', '')::time,
      '00:00'::time
    );
    daily_end_time := coalesce(
      nullif(materialization_row.source_snapshot #>> '{schedulingConfig,shiftPattern,dailyOnCallWindow,endTime}', '')::time,
      '23:59'::time
    );
  end if;

  select count(*) into existing_slots
  from public.dynamic_availability_slots
  where period_id=period_row.id;

  -- Keep slot IDs stable because availability entries reference them. For an
  -- already-created daily on-call period, correct the displayed window in place.
  if existing_slots > 0 then
    if materialization_row.work_mode = 'on_call_daily' then
      update public.dynamic_availability_slots
      set start_time = daily_start_time,
          end_time = daily_end_time
      where period_id = period_row.id;
    end if;
    return existing_slots;
  end if;

  for day_date in
    select d::date
    from generate_series(
      target_month,
      (target_month + interval '1 month - 1 day')::date,
      interval '1 day'
    ) d
  loop
    dow_value := extract(dow from day_date)::integer;
    base_day_kind_value := case
      when dow_value=5 then 'friday'
      when dow_value=6 then 'saturday'
      else 'weekday'
    end;
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

    if source_day_kind_value is null then
      source_day_kind_value := base_day_kind_value;
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

    if day_works is false or day_behavior='no_work' then
      continue;
    end if;

    -- Preserve Friday/Saturday precedence when a special calendar day inherits.
    effective_day_kind_value := case
      when day_behavior='inherit'
        and source_day_kind_value <> base_day_kind_value
        and base_day_kind_value in ('friday','saturday')
        then base_day_kind_value
      when day_behavior='inherit' then coalesce(inherit_day_kind_value,source_day_kind_value)
      else source_day_kind_value
    end;

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
        case when materialization_row.work_mode = 'on_call_daily' then daily_start_time else shift_row.start_time end,
        case when materialization_row.work_mode = 'on_call_daily' then daily_end_time else shift_row.end_time end,
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

      if found then
        created_slots := created_slots + 1;
      end if;
    end loop;
  end loop;

  update public.dynamic_availability_periods
  set config_snapshot = coalesce(materialization_row.source_snapshot->'availabilityConfig',config_snapshot),
      updated_at=now()
  where id=period_row.id;

  return created_slots;
end;
$function$;


revoke all on function public.materialize_dynamic_availability_period_slots(uuid) from public;
grant execute on function public.materialize_dynamic_availability_period_slots(uuid) to authenticated;

create or replace function public.get_dynamic_availability_shadow_workspace(
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
  job public.job_types%rowtype;
  period public.dynamic_availability_periods%rowtype;
  normalized_config jsonb;
begin
  if current_user_id is null then raise exception 'not authenticated'; end if;
  if not public.has_dynamic_job_type_permission('availability.view_team', requested_job_type_id, current_user_id) then raise exception 'not allowed'; end if;
  select * into job from public.job_types where id=requested_job_type_id;
  if job.id is null then raise exception 'job type not found'; end if;
  select * into period from public.dynamic_availability_periods where job_type_id=job.id and year=requested_year and month=requested_month;

  normalized_config := jsonb_build_object(
    'enabled', coalesce((job.availability_config->>'enabled')::boolean,true),
    'statuses', case when jsonb_typeof(job.availability_config->'statuses')='array' and jsonb_array_length(job.availability_config->'statuses')>0 then job.availability_config->'statuses' else '["available","unavailable"]'::jsonb end,
    'allowNotes', coalesce((job.availability_config->>'allowNotes')::boolean,true),
    'monthlyCapacity', coalesce(job.availability_config->'monthlyCapacity','{"enabled":false,"minEnabled":false,"targetEnabled":false,"maxEnabled":false,"defaultMin":null,"defaultTarget":null,"defaultMax":null}'::jsonb),
    'limits', coalesce(job.availability_config->'limits','{"maxNightsEnabled":false,"defaultMaxNights":null,"maxWeekendsEnabled":false,"defaultMaxWeekends":null,"maxHolidaysEnabled":false,"defaultMaxHolidays":null}'::jsonb)
  );

  return jsonb_build_object(
    'materialized', period.id is not null,'mode','shadow','periodId',period.id,'jobTypeId',job.id,'jobTypeName',job.name,
    'availabilityConfig',normalized_config,
    'slots',case when period.id is null then '[]'::jsonb else coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'date',s.shift_date,'shiftCode',s.shift_code,'shiftName',s.shift_name,'startTime',s.start_time,'endTime',s.end_time,'holidayName',s.holiday_name,'sourceDayKind',s.source_day_kind,'effectiveDayKind',s.effective_day_kind,'minWorkers',s.min_workers,'targetWorkers',s.target_workers,'maxWorkers',s.max_workers) order by s.shift_date,s.start_time,s.shift_code) from public.dynamic_availability_slots s where s.period_id=period.id),'[]'::jsonb) end,
    'members',coalesce((select jsonb_agg(jsonb_build_object('userId',m.user_id,'displayName',p.display_name,'isActive',p.is_active,'submissionId',sub.id,'status',coalesce(sub.status,'draft'),'minimum',sub.min_shifts,'target',sub.target_shifts,'maximum',sub.max_shifts,'maxNights',sub.max_nights,'maxWeekends',sub.max_weekends,'maxHolidays',sub.max_holidays,'note',sub.note,'entries',coalesce((select jsonb_object_agg(e.slot_id::text,jsonb_build_object('status',e.availability_status,'note',e.note)) from public.dynamic_availability_entries e where e.submission_id=sub.id),'{}'::jsonb)) order by p.is_active desc,p.display_name) from public.job_type_memberships m join public.profiles p on p.id=m.user_id left join public.dynamic_availability_submissions sub on sub.period_id=period.id and sub.user_id=m.user_id where m.job_type_id=job.id and p.is_active=true),'[]'::jsonb)
  );
end;
$function$;


revoke all on function public.get_dynamic_availability_shadow_workspace(uuid,integer,integer) from public;
grant execute on function public.get_dynamic_availability_shadow_workspace(uuid,integer,integer) to authenticated;

-- Correct existing editable daily-on-call periods in place without calling
-- the materializer again. This preserves slot IDs and existing employee entries,
-- while closed history remains untouched.
with latest_materializations as (
  select distinct on (ap.id)
    ap.id as period_id,
    m.source_snapshot
  from public.dynamic_availability_periods ap
  join public.job_type_schedule_materializations m
    on m.job_type_id = ap.job_type_id
   and m.effective_month <= make_date(ap.year, ap.month, 1)
  where ap.status in ('shadow','open')
    and m.work_mode = 'on_call_daily'
  order by ap.id, m.effective_month desc
)
update public.dynamic_availability_slots s
set start_time = coalesce(
      nullif(lm.source_snapshot #>> '{schedulingConfig,shiftPattern,dailyOnCallWindow,startTime}', '')::time,
      s.start_time
    ),
    end_time = coalesce(
      nullif(lm.source_snapshot #>> '{schedulingConfig,shiftPattern,dailyOnCallWindow,endTime}', '')::time,
      s.end_time
    )
from latest_materializations lm
where s.period_id = lm.period_id;

commit;
