begin;

-- Phase 6.1 compatibility fix.
-- Early Phase-1 seed rows used a smaller availability_config shape such as
-- {"enabled":true,"monthly_capacity":true}. Normalize every existing job type
-- without overwriting values already configured by an administrator.
update public.job_types jt
set availability_config = jsonb_build_object(
  'enabled', coalesce((jt.availability_config->>'enabled')::boolean, true),
  'statuses', case
    when jsonb_typeof(jt.availability_config->'statuses') = 'array'
      and jsonb_array_length(jt.availability_config->'statuses') > 0
      then jt.availability_config->'statuses'
    else '["available","unavailable"]'::jsonb
  end,
  'allowNotes', coalesce((jt.availability_config->>'allowNotes')::boolean, true),
  'monthlyCapacity', jsonb_build_object(
    'enabled', coalesce((jt.availability_config#>>'{monthlyCapacity,enabled}')::boolean,
                        (jt.availability_config->>'monthly_capacity')::boolean,
                        jt.code = 'dispatcher'),
    'minEnabled', coalesce((jt.availability_config#>>'{monthlyCapacity,minEnabled}')::boolean, false),
    'targetEnabled', coalesce((jt.availability_config#>>'{monthlyCapacity,targetEnabled}')::boolean, jt.code = 'dispatcher'),
    'maxEnabled', coalesce((jt.availability_config#>>'{monthlyCapacity,maxEnabled}')::boolean, jt.code = 'dispatcher'),
    'defaultMin', case when jt.availability_config#>>'{monthlyCapacity,defaultMin}' ~ '^\\d+$' then (jt.availability_config#>>'{monthlyCapacity,defaultMin}')::integer else null end,
    'defaultTarget', case when jt.availability_config#>>'{monthlyCapacity,defaultTarget}' ~ '^\\d+$' then (jt.availability_config#>>'{monthlyCapacity,defaultTarget}')::integer else null end,
    'defaultMax', case when jt.availability_config#>>'{monthlyCapacity,defaultMax}' ~ '^\\d+$' then (jt.availability_config#>>'{monthlyCapacity,defaultMax}')::integer else null end
  ),
  'limits', jsonb_build_object(
    'maxNightsEnabled', coalesce((jt.availability_config#>>'{limits,maxNightsEnabled}')::boolean, false),
    'defaultMaxNights', case when jt.availability_config#>>'{limits,defaultMaxNights}' ~ '^\\d+$' then (jt.availability_config#>>'{limits,defaultMaxNights}')::integer else null end,
    'maxWeekendsEnabled', coalesce((jt.availability_config#>>'{limits,maxWeekendsEnabled}')::boolean, false),
    'defaultMaxWeekends', case when jt.availability_config#>>'{limits,defaultMaxWeekends}' ~ '^\\d+$' then (jt.availability_config#>>'{limits,defaultMaxWeekends}')::integer else null end,
    'maxHolidaysEnabled', coalesce((jt.availability_config#>>'{limits,maxHolidaysEnabled}')::boolean, false),
    'defaultMaxHolidays', case when jt.availability_config#>>'{limits,defaultMaxHolidays}' ~ '^\\d+$' then (jt.availability_config#>>'{limits,defaultMaxHolidays}')::integer else null end
  )
) || (jt.availability_config - 'monthly_capacity' - 'monthlyCapacity' - 'limits' - 'statuses' - 'enabled' - 'allowNotes'),
updated_at = now();

-- Return a complete config even if a future/hand-written row is partially shaped.
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
  if not exists(select 1 from public.user_permissions up where up.user_id=current_user_id and up.permission_key in ('users.view','users.manage')) then raise exception 'not allowed'; end if;
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
    'members',coalesce((select jsonb_agg(jsonb_build_object('userId',m.user_id,'displayName',p.display_name,'isActive',p.is_active,'submissionId',sub.id,'status',coalesce(sub.status,'draft'),'minimum',sub.min_shifts,'target',sub.target_shifts,'maximum',sub.max_shifts,'maxNights',sub.max_nights,'maxWeekends',sub.max_weekends,'maxHolidays',sub.max_holidays,'note',sub.note,'entries',coalesce((select jsonb_object_agg(e.slot_id::text,jsonb_build_object('status',e.availability_status,'note',e.note)) from public.dynamic_availability_entries e where e.submission_id=sub.id),'{}'::jsonb)) order by p.is_active desc,p.display_name) from public.job_type_memberships m join public.profiles p on p.id=m.user_id left join public.dynamic_availability_submissions sub on sub.period_id=period.id and sub.user_id=m.user_id where m.job_type_id=job.id),'[]'::jsonb)
  );
end;
$function$;

grant execute on function public.get_dynamic_availability_shadow_workspace(uuid,integer,integer) to authenticated;

commit;
