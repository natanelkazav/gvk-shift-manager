-- Cross-month continuity for availability-based shadow drafts.
-- Only the current draft is mutable. Prior published assignments are read-only context.
-- Published assignment user_id represents the currently assigned person.
-- Run in a test database before production; depends on publication status = 'published'.
begin;
create or replace function public.dynamic_shadow_candidate_allowed(
  requested_draft_id uuid,
  requested_user_id uuid,
  requested_slot_id uuid,
  requested_max_shifts_per_day integer,
  requested_no_consecutive boolean,
  requested_min_rest_minutes integer
)
returns boolean
language plpgsql
security definer
set search_path=''
as $function$
declare
  candidate_slot public.dynamic_availability_slots%rowtype;
  candidate_start timestamp;
  candidate_end timestamp;
  existing record;
  weekly_limit integer;
  weekly_count integer;
  job_id uuid;
  cross_week_start date;
  historical record;
  historical_count integer;
  historical_days integer;
  draft_days integer;
begin
  select * into candidate_slot from public.dynamic_availability_slots where id=requested_slot_id;
  if candidate_slot.id is null then return false; end if;
  select d.job_type_id into job_id from public.dynamic_schedule_shadow_drafts d where d.id=requested_draft_id;
  if job_id is null then return false; end if;
  cross_week_start := candidate_slot.shift_date - extract(dow from candidate_slot.shift_date)::integer;

  -- Respect the personal weekly cap for all generated assignments.
  -- Sunday-to-Saturday weeks; count shifts by their starting date.
  select sub.max_weekly_shifts into weekly_limit
  from public.dynamic_schedule_shadow_drafts d
  join public.dynamic_availability_submissions sub on sub.period_id=d.availability_period_id and sub.user_id=requested_user_id
  join public.job_types j on j.id=d.job_type_id
  where d.id=requested_draft_id
    and coalesce((j.availability_config->>'showWeeklyShiftLimit')::boolean,false);
  if weekly_limit is not null then
    select count(*) into weekly_count
    from public.dynamic_schedule_shadow_assignments a
    join public.dynamic_availability_slots s on s.id=a.slot_id
    where a.draft_id=requested_draft_id and a.user_id=requested_user_id
      and s.shift_date >= candidate_slot.shift_date - extract(dow from candidate_slot.shift_date)::integer
      and s.shift_date < candidate_slot.shift_date - extract(dow from candidate_slot.shift_date)::integer + 7;
    select count(*) into historical_count
    from public.dynamic_schedule_published_assignments a
    join public.dynamic_schedule_publications pub on pub.id=a.publication_id
    where pub.job_type_id=job_id and pub.status='published'
      and a.user_id=requested_user_id
      and a.shift_date >= cross_week_start and a.shift_date < cross_week_start+7
      and a.shift_date < make_date(extract(year from candidate_slot.shift_date)::integer,extract(month from candidate_slot.shift_date)::integer,1);
    if weekly_count + historical_count >= weekly_limit then return false; end if;
  end if;

  -- A seventh distinct working day is forbidden, including published days from the preceding month.
  select count(distinct day_worked) into historical_days from (
    select a.shift_date as day_worked
    from public.dynamic_schedule_published_assignments a
    join public.dynamic_schedule_publications pub on pub.id=a.publication_id
    where pub.job_type_id=job_id and pub.status='published'
      and a.user_id=requested_user_id
      and a.shift_date >= cross_week_start and a.shift_date < cross_week_start+7
      and a.shift_date < make_date(extract(year from candidate_slot.shift_date)::integer,extract(month from candidate_slot.shift_date)::integer,1)
    union
    select s.shift_date
    from public.dynamic_schedule_shadow_assignments a
    join public.dynamic_availability_slots s on s.id=a.slot_id
    where a.draft_id=requested_draft_id and a.user_id=requested_user_id
      and s.shift_date >= cross_week_start and s.shift_date < cross_week_start+7
  ) days;
  if historical_days >= 6 and not exists (
    select 1 from public.dynamic_schedule_shadow_assignments a
    join public.dynamic_availability_slots s on s.id=a.slot_id
    where a.draft_id=requested_draft_id and a.user_id=requested_user_id and s.shift_date=candidate_slot.shift_date
  ) and not exists (
    select 1 from public.dynamic_schedule_published_assignments a
    join public.dynamic_schedule_publications pub on pub.id=a.publication_id
    where pub.job_type_id=job_id and pub.status='published' and a.user_id=requested_user_id
      and a.shift_date=candidate_slot.shift_date
  ) then return false; end if;

  candidate_start := candidate_slot.shift_date + candidate_slot.start_time;
  candidate_end := candidate_slot.shift_date + candidate_slot.end_time;
  if candidate_slot.end_time <= candidate_slot.start_time then candidate_end := candidate_end + interval '1 day'; end if;

  if exists(select 1 from public.dynamic_schedule_shadow_assignments a where a.draft_id=requested_draft_id and a.slot_id=requested_slot_id and a.user_id=requested_user_id) then return false; end if;

  if (select count(*) from public.dynamic_schedule_shadow_assignments a join public.dynamic_availability_slots x on x.id=a.slot_id where a.draft_id=requested_draft_id and a.user_id=requested_user_id and x.shift_date=candidate_slot.shift_date) >= requested_max_shifts_per_day then return false; end if;

  for existing in
    select x.* from public.dynamic_schedule_shadow_assignments a
    join public.dynamic_availability_slots x on x.id=a.slot_id
    where a.draft_id=requested_draft_id and a.user_id=requested_user_id
  loop
    declare
      existing_start timestamp := existing.shift_date + existing.start_time;
      existing_end timestamp := existing.shift_date + existing.end_time;
    begin
      if existing.end_time <= existing.start_time then existing_end := existing_end + interval '1 day'; end if;
      if candidate_start < existing_end and existing_start < candidate_end then return false; end if;
      if requested_no_consecutive and (candidate_start=existing_end or candidate_end=existing_start) then return false; end if;
      if requested_min_rest_minutes > 0 then
        if existing_end <= candidate_start and extract(epoch from (candidate_start-existing_end))/60 < requested_min_rest_minutes then return false; end if;
        if candidate_end <= existing_start and extract(epoch from (existing_start-candidate_end))/60 < requested_min_rest_minutes then return false; end if;
      end if;
    end;
  end loop;
  -- Check already published assignments in the preceding month, using the current user_id
  -- (not engine_user_id/original_user_id) so approved replacements are respected.
  for historical in
    select a.shift_date,a.start_time,a.end_time
    from public.dynamic_schedule_published_assignments a
    join public.dynamic_schedule_publications pub on pub.id=a.publication_id
    where pub.job_type_id=job_id and pub.status='published'
      and a.user_id=requested_user_id
      and a.shift_date >= (candidate_slot.shift_date - interval '2 days')::date
      and a.shift_date < make_date(extract(year from candidate_slot.shift_date)::integer,extract(month from candidate_slot.shift_date)::integer,1)
  loop
    declare
      old_start timestamp := historical.shift_date+historical.start_time;
      old_end timestamp := historical.shift_date+historical.end_time;
    begin
      if historical.end_time<=historical.start_time then old_end:=old_end+interval '1 day'; end if;
      if candidate_start<old_end and old_start<candidate_end then return false; end if;
      if requested_no_consecutive and (
        candidate_start=old_end or candidate_end=old_start
        or (historical.end_time<=historical.start_time and old_end::date=candidate_start::date and candidate_start>old_end)
      ) then return false; end if;
      if requested_min_rest_minutes>0 and old_end<=candidate_start
        and extract(epoch from(candidate_start-old_end))/60<requested_min_rest_minutes then return false; end if;
    end;
  end loop;
  return true;
end;
$function$;

create or replace function public.get_dynamic_schedule_weekly_rest_validation(requested_draft_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  actor uuid := auth.uid();
  d public.dynamic_schedule_shadow_drafts%rowtype;
  month_start date;
  month_end date;
  violations jsonb := '[]'::jsonb;
  pending jsonb := '[]'::jsonb;
  violation_count integer := 0;
begin
  if actor is null then raise exception 'not authenticated'; end if;
  select * into d from public.dynamic_schedule_shadow_drafts where id=requested_draft_id;
  if d.id is null then raise exception 'draft not found'; end if;
  if not public.has_dynamic_job_type_permission('schedule.create_draft',d.job_type_id,actor)
    and not public.has_dynamic_job_type_permission('schedule.edit_draft',d.job_type_id,actor) then
    raise exception 'not allowed';
  end if;
  month_start:=make_date(d.year,d.month,1);
  month_end:=(month_start+interval '1 month - 1 day')::date;

  with weeks as (
    select gs::date week_start,(gs::date+6) week_end
    from generate_series((month_start-extract(dow from month_start)::integer)::timestamp,
      month_end::timestamp,interval '7 days') gs
  ), worker_weeks as (
    select t.user_id,p.display_name,w.week_start,w.week_end,
      greatest(w.week_start,month_start) period_week_start,
      least(w.week_end,month_end) period_week_end,
      count(distinct worked.day_worked)::integer worked_days
    from public.dynamic_schedule_shadow_targets t
    join public.profiles p on p.id=t.user_id
    cross join weeks w
    left join lateral (
      select s.shift_date day_worked
      from public.dynamic_schedule_shadow_assignments a
      join public.dynamic_availability_slots s on s.id=a.slot_id
      where a.draft_id=d.id and a.user_id=t.user_id
        and s.shift_date between w.week_start and w.week_end
      union
      select a.shift_date
      from public.dynamic_schedule_published_assignments a
      join public.dynamic_schedule_publications pub on pub.id=a.publication_id
      where pub.job_type_id=d.job_type_id and pub.status='published'
        and a.user_id=t.user_id and a.shift_date between w.week_start and w.week_end
        and a.shift_date<month_start
    ) worked on true
    where t.draft_id=d.id
    group by t.user_id,p.display_name,w.week_start,w.week_end
  ), full_weeks as (
    select * from worker_weeks where worked_days=7 and week_end<=month_end
  ), pending_weeks as (
    select * from worker_weeks where worked_days=(period_week_end-week_start+1)
      and week_end>month_end
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'userId',user_id,'displayName',display_name,
    'weekStart',week_start,'weekEnd',week_end,
    'calendarWeekStart',week_start,'workedDays',worked_days,'daysInPeriod',7)
    order by week_start,display_name),'[]'::jsonb),count(*)::integer
  into violations,violation_count from full_weeks;

  with weeks as (
    select gs::date week_start,(gs::date+6) week_end
    from generate_series((month_start-extract(dow from month_start)::integer)::timestamp,
      month_end::timestamp,interval '7 days') gs
    where (gs::date+6)>month_end
  ), pending_rows as (
    select t.user_id,p.display_name,w.week_start,w.week_end,
      count(distinct s.shift_date)::integer worked_days
    from public.dynamic_schedule_shadow_targets t
    join public.profiles p on p.id=t.user_id
    cross join weeks w
    left join public.dynamic_schedule_shadow_assignments a
      on a.draft_id=d.id and a.user_id=t.user_id
    left join public.dynamic_availability_slots s
      on s.id=a.slot_id and s.shift_date between w.week_start and month_end
    where t.draft_id=d.id
    group by t.user_id,p.display_name,w.week_start,w.week_end
    having count(distinct s.shift_date)=(month_end-w.week_start+1)
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'userId',user_id,'displayName',display_name,'weekStart',week_start,
    'weekEnd',week_end,'workedDays',worked_days,'status','pending_next_month')
    order by week_start,display_name),'[]'::jsonb)
  into pending from pending_rows;

  update public.dynamic_schedule_shadow_drafts
  set metrics=coalesce(metrics,'{}'::jsonb)||jsonb_build_object(
    'weeklyRestRuleEnabled',true,'weeklyRestValid',violation_count=0,
    'weeklyRestViolationCount',violation_count,'weeklyRestViolations',violations,
    'weeklyRestPendingWeeks',pending),updated_at=now()
  where id=d.id;
  return jsonb_build_object('valid',violation_count=0,'violationCount',violation_count,
    'violations',violations,'pendingWeeks',pending);
end;
$function$;
revoke all on function public.dynamic_shadow_candidate_allowed(uuid,uuid,uuid,integer,boolean,integer) from public;
grant execute on function public.dynamic_shadow_candidate_allowed(uuid,uuid,uuid,integer,boolean,integer) to authenticated;
revoke all on function public.get_dynamic_schedule_weekly_rest_validation(uuid) from public;
grant execute on function public.get_dynamic_schedule_weekly_rest_validation(uuid) to authenticated;
commit;
