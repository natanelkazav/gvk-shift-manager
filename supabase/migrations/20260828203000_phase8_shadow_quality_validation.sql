begin;

-- Phase 8: validation/parallel-run layer for Dynamic Scheduling.
-- SHADOW ONLY. Reads the generated Shadow draft and, where a compatible
-- legacy dispatcher schedule exists, compares it shift-by-shift.

create or replace function public.get_dynamic_schedule_shadow_validation(
  requested_draft_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  current_user_id uuid := auth.uid();
  draft_row public.dynamic_schedule_shadow_drafts%rowtype;
  job_row public.job_types%rowtype;
  legacy_supported boolean := false;
  legacy_period_id uuid := null;
  slot_rows jsonb := '[]'::jsonb;
  worker_rows jsonb := '[]'::jsonb;
  metrics_row jsonb := '{}'::jsonb;
begin
  if current_user_id is null then
    raise exception 'not authenticated';
  end if;

  if not exists (
    select 1
    from public.user_permissions permission_row
    where permission_row.user_id=current_user_id
      and permission_row.permission_key in ('users.view','users.manage')
  ) then
    raise exception 'not allowed';
  end if;

  select draft_item.*
  into draft_row
  from public.dynamic_schedule_shadow_drafts draft_item
  where draft_item.id=requested_draft_id;

  if draft_row.id is null then
    raise exception 'draft not found';
  end if;

  select job_item.*
  into job_row
  from public.job_types job_item
  where job_item.id=draft_row.job_type_id;

  legacy_supported := job_row.legacy_role='dispatcher';

  if legacy_supported then
    select period_item.id
    into legacy_period_id
    from public.schedule_periods period_item
    where period_item.year=draft_row.year
      and period_item.month=draft_row.month
    limit 1;
  end if;

  with slot_base as (
    select
      slot_item.id as slot_id,
      slot_item.shift_date,
      slot_item.shift_code,
      slot_item.shift_name,
      slot_item.start_time,
      slot_item.end_time,
      slot_item.min_workers,
      slot_item.target_workers,
      coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'userId', assignment_item.user_id,
            'displayName', profile_item.display_name,
            'tier', assignment_item.assignment_tier,
            'score', assignment_item.score,
            'reasons', assignment_item.reasons,
            'availabilityStatus', availability_entry.availability_status
          )
          order by assignment_item.assignment_tier, profile_item.display_name
        )
        from public.dynamic_schedule_shadow_assignments assignment_item
        join public.profiles profile_item on profile_item.id=assignment_item.user_id
        left join public.dynamic_availability_submissions availability_submission
          on availability_submission.period_id=draft_row.availability_period_id
         and availability_submission.user_id=assignment_item.user_id
        left join public.dynamic_availability_entries availability_entry
          on availability_entry.submission_id=availability_submission.id
         and availability_entry.slot_id=assignment_item.slot_id
        where assignment_item.draft_id=draft_row.id
          and assignment_item.slot_id=slot_item.id
      ), '[]'::jsonb) as dynamic_assignments,
      case when legacy_supported and legacy_period_id is not null then (
        select jsonb_build_object(
          'shiftId', legacy_shift.id,
          'userId', legacy_shift.assigned_user_id,
          'displayName', legacy_profile.display_name,
          'isIntentionallyUnassigned', coalesce(legacy_shift.is_intentionally_unassigned,false)
        )
        from public.schedule_shifts legacy_shift
        left join public.profiles legacy_profile on legacy_profile.id=legacy_shift.assigned_user_id
        where legacy_shift.period_id=legacy_period_id
          and legacy_shift.shift_date=slot_item.shift_date
          and legacy_shift.shift_code=slot_item.shift_code
        limit 1
      ) else null end as legacy_assignment
    from public.dynamic_availability_slots slot_item
    where slot_item.period_id=draft_row.availability_period_id
  ), classified as (
    select
      slot_base.*,
      jsonb_array_length(slot_base.dynamic_assignments) as dynamic_count,
      case
        when not legacy_supported then 'unsupported'
        when slot_base.legacy_assignment is null then 'legacy_missing_shift'
        when nullif(slot_base.legacy_assignment->>'userId','') is null
          and jsonb_array_length(slot_base.dynamic_assignments)=0 then 'match'
        when nullif(slot_base.legacy_assignment->>'userId','') is not null
          and exists (
            select 1
            from jsonb_array_elements(slot_base.dynamic_assignments) assignment_json
            where assignment_json->>'userId'=slot_base.legacy_assignment->>'userId'
          ) then 'match'
        else 'different'
      end as comparison_status
    from slot_base
  )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'slotId', classified.slot_id,
      'date', classified.shift_date,
      'shiftCode', classified.shift_code,
      'shiftName', classified.shift_name,
      'startTime', classified.start_time,
      'endTime', classified.end_time,
      'requiredWorkers', classified.min_workers,
      'targetWorkers', classified.target_workers,
      'dynamicAssignments', classified.dynamic_assignments,
      'legacyAssignment', classified.legacy_assignment,
      'comparisonStatus', classified.comparison_status
    )
    order by classified.shift_date, classified.start_time, classified.shift_code
  ), '[]'::jsonb)
  into slot_rows
  from classified;

  with worker_base as (
    select
      target_item.user_id,
      profile_item.display_name,
      target_item.requested_min,
      target_item.requested_target,
      target_item.requested_max,
      target_item.proportional_target,
      target_item.assigned_count,
      coalesce(target_item.metadata->>'employmentScope','') as employment_scope,
      coalesce((
        select count(*)::integer
        from public.dynamic_schedule_shadow_assignments assignment_item
        join public.dynamic_availability_submissions submission_item
          on submission_item.period_id=draft_row.availability_period_id
         and submission_item.user_id=assignment_item.user_id
        join public.dynamic_availability_entries entry_item
          on entry_item.submission_id=submission_item.id
         and entry_item.slot_id=assignment_item.slot_id
        where assignment_item.draft_id=draft_row.id
          and assignment_item.user_id=target_item.user_id
          and entry_item.availability_status='preferred'
      ),0) as preferred_assignments,
      coalesce((
        select count(*)::integer
        from public.dynamic_schedule_shadow_assignments assignment_item
        join public.dynamic_availability_submissions submission_item
          on submission_item.period_id=draft_row.availability_period_id
         and submission_item.user_id=assignment_item.user_id
        join public.dynamic_availability_entries entry_item
          on entry_item.submission_id=submission_item.id
         and entry_item.slot_id=assignment_item.slot_id
        where assignment_item.draft_id=draft_row.id
          and assignment_item.user_id=target_item.user_id
          and entry_item.availability_status='avoid'
      ),0) as avoid_assignments
    from public.dynamic_schedule_shadow_targets target_item
    join public.profiles profile_item on profile_item.id=target_item.user_id
    where target_item.draft_id=draft_row.id
  )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'userId', worker_base.user_id,
      'displayName', worker_base.display_name,
      'minimum', worker_base.requested_min,
      'target', worker_base.requested_target,
      'maximum', worker_base.requested_max,
      'proportionalTarget', worker_base.proportional_target,
      'assigned', worker_base.assigned_count,
      'preferredAssignments', worker_base.preferred_assignments,
      'avoidAssignments', worker_base.avoid_assignments,
      'underMinimum', worker_base.requested_min is not null and worker_base.assigned_count < worker_base.requested_min,
      'aboveTarget', worker_base.requested_target is not null and worker_base.assigned_count > worker_base.requested_target,
      'atOrAboveMaximum', worker_base.requested_max is not null and worker_base.assigned_count >= worker_base.requested_max,
      'employmentScope', nullif(worker_base.employment_scope,'')
    )
    order by worker_base.display_name
  ), '[]'::jsonb)
  into worker_rows
  from worker_base;

  with slot_metric as (
    select
      slot_item.id as slot_id,
      slot_item.min_workers,
      (select count(*)::integer from public.dynamic_schedule_shadow_assignments assignment_item
       where assignment_item.draft_id=draft_row.id and assignment_item.slot_id=slot_item.id) as dynamic_count,
      case when legacy_supported and legacy_period_id is not null then (
        select legacy_shift.assigned_user_id
        from public.schedule_shifts legacy_shift
        where legacy_shift.period_id=legacy_period_id
          and legacy_shift.shift_date=slot_item.shift_date
          and legacy_shift.shift_code=slot_item.shift_code
        limit 1
      ) else null end as legacy_user_id,
      case when legacy_supported and legacy_period_id is not null then exists (
        select 1 from public.schedule_shifts legacy_shift
        where legacy_shift.period_id=legacy_period_id
          and legacy_shift.shift_date=slot_item.shift_date
          and legacy_shift.shift_code=slot_item.shift_code
      ) else false end as legacy_shift_exists
    from public.dynamic_availability_slots slot_item
    where slot_item.period_id=draft_row.availability_period_id
  ), metric_calc as (
    select
      count(*)::integer as total_slots,
      count(*) filter (where dynamic_count >= min_workers)::integer as covered_required_slots,
      count(*) filter (where dynamic_count < min_workers)::integer as unfilled_slots,
      count(*) filter (where legacy_shift_exists)::integer as comparable_slots,
      count(*) filter (
        where legacy_shift_exists and (
          (legacy_user_id is null and dynamic_count=0)
          or (legacy_user_id is not null and exists (
            select 1 from public.dynamic_schedule_shadow_assignments assignment_item
            where assignment_item.draft_id=draft_row.id
              and assignment_item.slot_id=slot_metric.slot_id
              and assignment_item.user_id=slot_metric.legacy_user_id
          ))
        )
      )::integer as matching_slots
    from slot_metric
  )
  select jsonb_build_object(
    'totalSlots', metric_calc.total_slots,
    'coveredRequiredSlots', metric_calc.covered_required_slots,
    'unfilledSlots', metric_calc.unfilled_slots,
    'comparableSlots', metric_calc.comparable_slots,
    'matchingSlots', metric_calc.matching_slots,
    'differentSlots', greatest(metric_calc.comparable_slots-metric_calc.matching_slots,0),
    'matchPercent', case when metric_calc.comparable_slots>0 then round(metric_calc.matching_slots::numeric*100/metric_calc.comparable_slots,1) else null end,
    'preferredAssignments', (select count(*)::integer
      from public.dynamic_schedule_shadow_assignments assignment_item
      join public.dynamic_availability_submissions submission_item
        on submission_item.period_id=draft_row.availability_period_id and submission_item.user_id=assignment_item.user_id
      join public.dynamic_availability_entries entry_item
        on entry_item.submission_id=submission_item.id and entry_item.slot_id=assignment_item.slot_id
      where assignment_item.draft_id=draft_row.id and entry_item.availability_status='preferred'),
    'avoidAssignments', (select count(*)::integer
      from public.dynamic_schedule_shadow_assignments assignment_item
      join public.dynamic_availability_submissions submission_item
        on submission_item.period_id=draft_row.availability_period_id and submission_item.user_id=assignment_item.user_id
      join public.dynamic_availability_entries entry_item
        on entry_item.submission_id=submission_item.id and entry_item.slot_id=assignment_item.slot_id
      where assignment_item.draft_id=draft_row.id and entry_item.availability_status='avoid'),
    'underMinimumWorkers', (select count(*)::integer from public.dynamic_schedule_shadow_targets target_item
      where target_item.draft_id=draft_row.id and target_item.requested_min is not null and target_item.assigned_count<target_item.requested_min),
    'aboveTargetWorkers', (select count(*)::integer from public.dynamic_schedule_shadow_targets target_item
      where target_item.draft_id=draft_row.id and target_item.requested_target is not null and target_item.assigned_count>target_item.requested_target)
  )
  into metrics_row
  from metric_calc;

  return jsonb_build_object(
    'draftId', draft_row.id,
    'mode', 'shadow',
    'jobTypeId', draft_row.job_type_id,
    'jobTypeName', job_row.name,
    'year', draft_row.year,
    'month', draft_row.month,
    'algorithm', draft_row.metrics->>'algorithm',
    'legacySupported', legacy_supported,
    'legacyAvailable', legacy_period_id is not null,
    'legacyNote', case
      when not legacy_supported then 'לסוג התפקיד הזה עדיין אין מערכת Legacy מקבילה להשוואה אוטומטית.'
      when legacy_period_id is null then 'לא נמצא לוח קיים לחודש שנבחר, ולכן מוצגים מדדי איכות Dynamic בלבד.'
      else null
    end,
    'metrics', metrics_row,
    'workers', worker_rows,
    'slots', slot_rows
  );
end;
$function$;

revoke all on function public.get_dynamic_schedule_shadow_validation(uuid) from public;
grant execute on function public.get_dynamic_schedule_shadow_validation(uuid) to authenticated;

update public.scheduling_feature_flags
set config = config || jsonb_build_object(
  'phase','8',
  'mode','shadow',
  'validation','shift_level_parallel_run',
  'explainability',true
), updated_at=now()
where key='dynamic_job_types';

commit;
