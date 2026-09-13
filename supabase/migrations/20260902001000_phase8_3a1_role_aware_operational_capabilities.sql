begin;

-- Phase 8.3A.1: role-aware operational capabilities.
-- The schedule-change workflow belongs to the dynamic job type configuration and is versioned by effective month.

alter table public.job_type_schedule_materializations
  add column if not exists schedule_change_mode text not null default 'none';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname='job_type_schedule_materializations_schedule_change_mode_check'
  ) then
    alter table public.job_type_schedule_materializations
      add constraint job_type_schedule_materializations_schedule_change_mode_check
      check (schedule_change_mode in ('none','shift_exchange','self_edit'));
  end if;
end $$;

update public.job_type_schedule_materializations
set schedule_change_mode = coalesce(source_snapshot#>>'{schedulingConfig,scheduleChangeMode}','none'),
    schema_version = greatest(schema_version,2)
where schedule_change_mode is distinct from coalesce(source_snapshot#>>'{schedulingConfig,scheduleChangeMode}','none')
   or schema_version < 2;

create or replace function public.materialize_dynamic_job_type_snapshot(
  requested_job_type_id uuid,
  requested_effective_month date,
  requested_snapshot jsonb
)
returns uuid
language plpgsql
security definer
set search_path=''
as $function$
declare
  target_materialization_id uuid;
  scheduling_config jsonb := coalesce(requested_snapshot->'schedulingConfig','{}'::jsonb);
  shift_pattern jsonb := coalesce(requested_snapshot#>'{schedulingConfig,shiftPattern}','{}'::jsonb);
  work_mode text := coalesce(requested_snapshot#>>'{schedulingConfig,shiftPattern,workMode}','shifts');
  strategy text := coalesce(requested_snapshot->>'schedulingStrategy','availability_optimizer');
  employment text := coalesce(requested_snapshot->>'employmentScope','flexible');
  schedule_change_mode_value text := coalesce(requested_snapshot#>>'{schedulingConfig,scheduleChangeMode}','none');
  day_source jsonb;
  shift_value jsonb;
  target_shift_id uuid;
  day_name text;
  day_kind_value text;
  works_value boolean;
  shift_index integer;
  shift_start time;
  shift_end time;
  premium_hours numeric(6,2);
  shift_hours numeric;
  apply_holiday_eve boolean := coalesce((shift_pattern#>>'{friday,applyToHolidayEve}')::boolean,false);
  apply_holiday_end boolean := coalesce((shift_pattern#>>'{saturday,applyToHolidayEnd}')::boolean,false);
begin
  if requested_job_type_id is null then raise exception 'job type is required'; end if;
  if requested_effective_month is null then raise exception 'effective month is required'; end if;
  if jsonb_typeof(requested_snapshot)<>'object' then raise exception 'snapshot must be an object'; end if;
  if work_mode not in ('shifts','on_call_hourly','on_call_daily') then raise exception 'invalid work mode: %',work_mode; end if;
  if schedule_change_mode_value not in ('none','shift_exchange','self_edit') then raise exception 'invalid schedule change mode: %',schedule_change_mode_value; end if;

  insert into public.job_type_schedule_materializations(
    job_type_id,effective_month,work_mode,scheduling_strategy,employment_scope,schedule_change_mode,source_snapshot,schema_version,generated_at
  ) values(
    requested_job_type_id,date_trunc('month',requested_effective_month)::date,work_mode,strategy,employment,schedule_change_mode_value,requested_snapshot,2,now()
  )
  on conflict(job_type_id,effective_month) do update set
    work_mode=excluded.work_mode,
    scheduling_strategy=excluded.scheduling_strategy,
    employment_scope=excluded.employment_scope,
    schedule_change_mode=excluded.schedule_change_mode,
    source_snapshot=excluded.source_snapshot,
    schema_version=excluded.schema_version,
    generated_at=now(),
    updated_at=now()
  returning id into target_materialization_id;

  -- A re-save of the same effective month is a deterministic rebuild.
  delete from public.job_type_materialized_day_rules where materialization_id=target_materialization_id;
  delete from public.job_type_materialized_shift_templates where materialization_id=target_materialization_id;

  foreach day_name in array array['weekday','friday','saturday','holiday'] loop
    day_source := coalesce(shift_pattern->day_name,'{}'::jsonb);
    works_value := coalesce((day_source->>'works')::boolean,true);
    day_kind_value := case day_name when 'holiday' then 'holiday_full' else day_name end;

    insert into public.job_type_materialized_day_rules(materialization_id,day_kind,works,behavior,inherit_day_kind,metadata)
    values(
      target_materialization_id,
      day_kind_value,
      works_value,
      case when works_value then 'own_templates' else 'no_work' end,
      null,
      jsonb_build_object('sourceDay',day_name)
    );

    if works_value then
      if work_mode='on_call_daily' then
        insert into public.job_type_materialized_shift_templates(
          materialization_id,source_shift_id,code,name,day_kind,start_time,end_time,required_workers,sort_order,is_active,metadata
        ) values(
          target_materialization_id,day_name||'-daily',day_name||'_daily_on_call','כוננות יומית',day_kind_value,
          time '00:00',time '23:59',1,10,true,jsonb_build_object('allDay',true,'workMode',work_mode)
        );
      else
        shift_index := 0;
        for shift_value in select value from jsonb_array_elements(coalesce(day_source->'shifts','[]'::jsonb)) loop
          shift_index := shift_index + 1;
          shift_start := coalesce(nullif(shift_value->>'startTime','')::time,time '00:00');
          shift_end := coalesce(nullif(shift_value->>'endTime','')::time,time '00:00');
          premium_hours := greatest(0,coalesce(nullif(shift_value->>'premium200Hours','')::numeric,0));
          shift_hours := mod(
            (extract(hour from shift_end)::integer*60 + extract(minute from shift_end)::integer)
            - (extract(hour from shift_start)::integer*60 + extract(minute from shift_start)::integer)
            + 1440,
            1440
          ) / 60.0;
          if shift_hours=0 then shift_hours:=24; end if;
          premium_hours := least(premium_hours,shift_hours);

          insert into public.job_type_materialized_shift_templates(
            materialization_id,source_shift_id,code,name,day_kind,start_time,end_time,required_workers,sort_order,is_active,
            contains_200_percent,premium_200_hours,metadata
          ) values(
            target_materialization_id,
            nullif(shift_value->>'id',''),
            day_name||'_'||shift_index::text,
            coalesce(nullif(shift_value->>'name',''),case when work_mode='on_call_hourly' then 'חלון כוננות '||shift_index else 'משמרת '||shift_index end),
            day_kind_value,
            shift_start,
            shift_end,
            greatest(1,coalesce(nullif(shift_value->>'requiredWorkers','')::integer,1)),
            shift_index*10,
            true,
            coalesce((shift_value->>'contains200Percent')::boolean,false),
            case when coalesce((shift_value->>'contains200Percent')::boolean,false) then premium_hours else 0 end,
            jsonb_build_object('workMode',work_mode,'sourceDefinition',shift_value)
          ) returning id into target_shift_id;

          if coalesce((shift_value->>'contains200Percent')::boolean,false) and premium_hours>0 then
            insert into public.job_type_materialized_pay_components(
              shift_template_id,component_type,multiplier,hours,label,metadata
            ) values(
              target_shift_id,'premium_hours',2.0,premium_hours,'רכיב 200%',
              jsonb_build_object('boundaryKnown',false,'source','role_definition')
            );
          end if;
        end loop;
      end if;
    end if;
  end loop;

  -- Calendar-special-day inheritance is explicit and versioned with the role.
  insert into public.job_type_materialized_day_rules(materialization_id,day_kind,works,behavior,inherit_day_kind,metadata)
  values(
    target_materialization_id,'holiday_eve',true,'inherit',case when apply_holiday_eve then 'friday' else 'weekday' end,
    jsonb_build_object('usesFridayTemplate',apply_holiday_eve)
  )
  on conflict(materialization_id,day_kind) do update set
    works=excluded.works,behavior=excluded.behavior,inherit_day_kind=excluded.inherit_day_kind,metadata=excluded.metadata;

  insert into public.job_type_materialized_day_rules(materialization_id,day_kind,works,behavior,inherit_day_kind,metadata)
  values(
    target_materialization_id,'holiday_end',true,'inherit',case when apply_holiday_end then 'saturday' else 'weekday' end,
    jsonb_build_object('usesSaturdayTemplate',apply_holiday_end)
  )
  on conflict(materialization_id,day_kind) do update set
    works=excluded.works,behavior=excluded.behavior,inherit_day_kind=excluded.inherit_day_kind,metadata=excluded.metadata;

  insert into public.job_type_materialized_day_rules(materialization_id,day_kind,works,behavior,inherit_day_kind,metadata)
  values(target_materialization_id,'chol_hamoed',true,'inherit','weekday','{"source":"default"}'::jsonb)
  on conflict(materialization_id,day_kind) do update set
    works=excluded.works,behavior=excluded.behavior,inherit_day_kind=excluded.inherit_day_kind,metadata=excluded.metadata;

  return target_materialization_id;
end;
$function$;


revoke all on function public.materialize_dynamic_job_type_snapshot(uuid,date,jsonb) from public;

-- Re-materialize existing monthly snapshots so the operational mode is queryable without parsing JSON.
do $$
declare r record;
begin
  for r in
    select job_type_id,effective_month,snapshot
    from public.job_type_configuration_versions
  loop
    perform public.materialize_dynamic_job_type_snapshot(r.job_type_id,r.effective_month,r.snapshot);
  end loop;
end $$;

commit;
