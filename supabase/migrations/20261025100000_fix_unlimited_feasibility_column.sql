-- Hotfix: expose target_unlimited in members CTE and keep unlimited target NULL.
-- Replaces only feasibility function; existing draft generation functions remain unchanged.
begin;

create or replace function public.analyze_dynamic_schedule_feasibility(
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
  required_total integer := 0;
  target_total integer := 0;
  aggregate_min integer := 0;
  aggregate_target integer := 0;
  aggregate_max integer := 0;
  shortage_slots integer := 0;
  avoid_fallback_slots integer := 0;
  member_json jsonb;
  min_mode text;
  max_mode text;
begin
  if current_user_id is null then raise exception 'not authenticated'; end if;
  if not exists(select 1 from public.user_permissions up where up.user_id=current_user_id and up.permission_key in ('users.view','users.manage')) then raise exception 'not allowed'; end if;

  select * into job from public.job_types where id=requested_job_type_id;
  if job.id is null then raise exception 'job type not found'; end if;

  select * into period from public.dynamic_availability_periods
  where job_type_id=job.id and year=requested_year and month=requested_month;
  if period.id is null then
    return jsonb_build_object('materialized',false,'mode','shadow','message','יש ליצור קודם תקופת אילוצים ב־Shadow Mode.');
  end if;

  select coalesce(sum(min_workers),0),coalesce(sum(target_workers),0)
  into required_total,target_total
  from public.dynamic_availability_slots where period_id=period.id;

  min_mode:=coalesce(job.scheduling_config->>'minimumMode','soft');
  max_mode:=coalesce(job.scheduling_config->>'maximumMode','hard');

  with members as (
    select
      m.user_id,
      p.display_name,
      coalesce(s.target_unlimited,false) as target_unlimited,
      coalesce(s.min_shifts,(job.availability_config#>>'{monthlyCapacity,defaultMin}')::integer,0) req_min,
      coalesce(s.target_shifts,(job.availability_config#>>'{monthlyCapacity,defaultTarget}')::integer,
               s.min_shifts,(job.availability_config#>>'{monthlyCapacity,defaultMin}')::integer,1) req_target,
      coalesce(s.max_shifts,(job.availability_config#>>'{monthlyCapacity,defaultMax}')::integer,2147483647) req_max,
      case when job.employment_scope='flexible' then nullif(m.metadata->>'employmentScope','') else job.employment_scope end member_scope,
      case
        when job.employment_scope='flexible' and m.metadata->>'employmentScope'='part_time' then 0.5::numeric
        else 1::numeric
      end employment_factor,
      (select count(*) from public.dynamic_availability_entries e
       join public.dynamic_availability_submissions ss on ss.id=e.submission_id
       where ss.period_id=period.id and ss.user_id=m.user_id
         and e.availability_status in ('available','preferred','avoid')) available_slots
    from public.job_type_memberships m
    join public.profiles p on p.id=m.user_id
    left join public.dynamic_availability_submissions s on s.period_id=period.id and s.user_id=m.user_id
    where m.job_type_id=job.id and p.is_active=true
  ), weighted as (
    select *,greatest(case when target_unlimited then available_slots else req_target end,req_min,1)::numeric * employment_factor weight
    from members
  ), totals as (
    select greatest(sum(weight),1) total_weight from weighted
  ), calculated as (
    select w.*,round(required_total*w.weight/t.total_weight,2) raw_share,
      least(w.req_max,w.available_slots)::integer capacity_cap
    from weighted w cross join totals t
  )
  select
    coalesce(sum(req_min),0),
    coalesce(sum(req_target),0),
    coalesce(sum(case when req_max=2147483647 then required_total else req_max end),0),
    coalesce(jsonb_agg(jsonb_build_object(
      'userId',user_id,'displayName',display_name,'minimum',req_min,'target',req_target,'targetUnlimited',target_unlimited,
      'maximum',case when req_max=2147483647 then null else req_max end,
      'availableSlots',available_slots,'weight',weight,
      'employmentScope',member_scope,'employmentFactor',employment_factor,
      'rawProportionalTarget',raw_share,'capacityCap',capacity_cap,
      'proportionalTarget',least(raw_share,capacity_cap::numeric)
    ) order by display_name),'[]'::jsonb)
  into aggregate_min,aggregate_target,aggregate_max,member_json
  from calculated;

  select count(*) into shortage_slots
  from public.dynamic_availability_slots sl
  where sl.period_id=period.id and (
    select count(distinct ss.user_id)
    from public.dynamic_availability_entries e
    join public.dynamic_availability_submissions ss on ss.id=e.submission_id
    join public.job_type_memberships m on m.user_id=ss.user_id and m.job_type_id=job.id
    where e.slot_id=sl.id and e.availability_status in ('available','preferred','avoid')
  ) < sl.min_workers;

  select count(*) into avoid_fallback_slots
  from public.dynamic_availability_slots sl
  where sl.period_id=period.id
    and (select count(distinct ss.user_id) from public.dynamic_availability_entries e
         join public.dynamic_availability_submissions ss on ss.id=e.submission_id
         join public.job_type_memberships m on m.user_id=ss.user_id and m.job_type_id=job.id
         where e.slot_id=sl.id and e.availability_status in ('available','preferred')) < sl.min_workers
    and (select count(distinct ss.user_id) from public.dynamic_availability_entries e
         join public.dynamic_availability_submissions ss on ss.id=e.submission_id
         join public.job_type_memberships m on m.user_id=ss.user_id and m.job_type_id=job.id
         where e.slot_id=sl.id and e.availability_status in ('available','preferred','avoid')) >= sl.min_workers;

  return jsonb_build_object(
    'materialized',true,'periodId',period.id,'jobTypeId',job.id,'year',requested_year,'month',requested_month,'mode','shadow',
    'requiredAssignments',required_total,'targetAssignments',target_total,
    'aggregateMinimum',aggregate_min,'aggregateTarget',aggregate_target,'aggregateMaximum',aggregate_max,
    'minimumMode',min_mode,'maximumMode',max_mode,
    'minimumDemandExcess',greatest(aggregate_min-required_total,0),
    'maximumCapacityShortage',greatest(required_total-aggregate_max,0),
    'slotsWithoutEnoughCandidates',shortage_slots,'slotsRequiringAvoidCandidates',avoid_fallback_slots,
    'canMeetAllMinimums',aggregate_min<=required_total,'canCoverRequiredByMaximums',aggregate_max>=required_total,
    'hasCandidateShortages',shortage_slots>0,'members',member_json,
    'employmentRecommendationEnabled',job.employment_scope='flexible',
    'warnings',jsonb_strip_nulls(jsonb_build_object(
      'minimums',case when aggregate_min>required_total then 'סכום המינימום של העובדים גבוה מכמות ההקצאות הקיימת; המנוע יעבור לחלוקה פרופורציונלית.' end,
      'maximums',case when aggregate_max<required_total then 'גם אם כל עובד יקבל את המקסימום שלו, אין מספיק קיבולת לכיסוי כל המשמרות.' end,
      'candidates',case when shortage_slots>0 then shortage_slots || ' משמרות ללא מספיק מועמדים גם לאחר שימוש ב״מעדיף שלא״.' end,
      'avoidFallback',case when avoid_fallback_slots>0 then avoid_fallback_slots || ' משמרות ניתנות לכיסוי רק באמצעות לפחות עובד אחד שסימן ״מעדיף שלא״.' end
    ))
  );
end;
$function$;

commit;
