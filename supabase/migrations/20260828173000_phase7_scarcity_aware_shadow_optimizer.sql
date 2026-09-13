begin;

-- Phase 7: scarcity-aware whole-period Shadow optimizer.
-- Shadow only: this does not write to any production schedule table.
-- Core semantics:
--   * employee target is a soft balancing goal, never an eligibility cutoff;
--   * hard maximum is the only monthly-capacity cutoff;
--   * preferred > available > avoid ("prefer not") > unavailable;
--   * required positions are processed by current candidate scarcity across the
--     whole month, rather than by calendar order, to avoid consuming flexible
--     capacity before hard-to-cover shifts are handled.

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
  if not exists(
    select 1 from public.user_permissions up
    where up.user_id=current_user_id
      and up.permission_key in ('users.view','users.manage')
  ) then raise exception 'not allowed'; end if;

  select * into job from public.job_types where id=requested_job_type_id;
  if job.id is null then raise exception 'job type not found'; end if;

  select * into period
  from public.dynamic_availability_periods
  where job_type_id=job.id and year=requested_year and month=requested_month;

  if period.id is null then
    return jsonb_build_object(
      'materialized',false,'mode','shadow',
      'message','יש ליצור קודם תקופת אילוצים ב־Shadow Mode.'
    );
  end if;

  select coalesce(sum(min_workers),0), coalesce(sum(target_workers),0)
  into required_total,target_total
  from public.dynamic_availability_slots
  where period_id=period.id;

  min_mode := coalesce(job.scheduling_config->>'minimumMode','soft');
  max_mode := coalesce(job.scheduling_config->>'maximumMode','hard');

  with members as (
    select
      m.user_id,
      p.display_name,
      coalesce(
        s.min_shifts,
        (job.availability_config#>>'{monthlyCapacity,defaultMin}')::integer,
        0
      ) req_min,
      coalesce(
        s.target_shifts,
        (job.availability_config#>>'{monthlyCapacity,defaultTarget}')::integer,
        s.min_shifts,
        (job.availability_config#>>'{monthlyCapacity,defaultMin}')::integer,
        1
      ) req_target,
      coalesce(
        s.max_shifts,
        (job.availability_config#>>'{monthlyCapacity,defaultMax}')::integer,
        2147483647
      ) req_max,
      (
        select count(*)
        from public.dynamic_availability_entries e
        join public.dynamic_availability_submissions ss on ss.id=e.submission_id
        where ss.period_id=period.id
          and ss.user_id=m.user_id
          and e.availability_status in ('available','preferred','avoid')
      ) available_slots
    from public.job_type_memberships m
    join public.profiles p on p.id=m.user_id
    left join public.dynamic_availability_submissions s
      on s.period_id=period.id and s.user_id=m.user_id
    where m.job_type_id=job.id and p.is_active=true
  ), weighted as (
    select *, greatest(req_target,req_min,1)::numeric weight
    from members
  ), totals as (
    select greatest(sum(weight),1) total_weight from weighted
  ), calculated as (
    select
      w.*,
      round(required_total * w.weight/t.total_weight,2) raw_share,
      least(w.req_max,w.available_slots)::integer capacity_cap
    from weighted w cross join totals t
  )
  select
    coalesce(sum(req_min),0),
    coalesce(sum(req_target),0),
    coalesce(sum(case when req_max=2147483647 then required_total else req_max end),0),
    coalesce(jsonb_agg(jsonb_build_object(
      'userId',user_id,
      'displayName',display_name,
      'minimum',req_min,
      'target',req_target,
      'maximum',case when req_max=2147483647 then null else req_max end,
      'availableSlots',available_slots,
      'weight',weight,
      'rawProportionalTarget',raw_share,
      'capacityCap',capacity_cap,
      'proportionalTarget',least(raw_share,capacity_cap::numeric)
    ) order by display_name),'[]'::jsonb)
  into aggregate_min,aggregate_target,aggregate_max,member_json
  from calculated;

  -- A true shortage means that even "prefer not" candidates cannot cover the
  -- shift. "Prefer not" is therefore a soft preference, not unavailability.
  select count(*) into shortage_slots
  from public.dynamic_availability_slots sl
  where sl.period_id=period.id
    and (
      select count(distinct ss.user_id)
      from public.dynamic_availability_entries e
      join public.dynamic_availability_submissions ss on ss.id=e.submission_id
      join public.job_type_memberships m
        on m.user_id=ss.user_id and m.job_type_id=job.id
      where e.slot_id=sl.id
        and e.availability_status in ('available','preferred','avoid')
    ) < sl.min_workers;

  -- These shifts are coverable, but only by using at least one "prefer not".
  select count(*) into avoid_fallback_slots
  from public.dynamic_availability_slots sl
  where sl.period_id=period.id
    and (
      select count(distinct ss.user_id)
      from public.dynamic_availability_entries e
      join public.dynamic_availability_submissions ss on ss.id=e.submission_id
      join public.job_type_memberships m
        on m.user_id=ss.user_id and m.job_type_id=job.id
      where e.slot_id=sl.id
        and e.availability_status in ('available','preferred')
    ) < sl.min_workers
    and (
      select count(distinct ss.user_id)
      from public.dynamic_availability_entries e
      join public.dynamic_availability_submissions ss on ss.id=e.submission_id
      join public.job_type_memberships m
        on m.user_id=ss.user_id and m.job_type_id=job.id
      where e.slot_id=sl.id
        and e.availability_status in ('available','preferred','avoid')
    ) >= sl.min_workers;

  return jsonb_build_object(
    'materialized',true,
    'periodId',period.id,
    'jobTypeId',job.id,
    'year',requested_year,
    'month',requested_month,
    'mode','shadow',
    'requiredAssignments',required_total,
    'targetAssignments',target_total,
    'aggregateMinimum',aggregate_min,
    'aggregateTarget',aggregate_target,
    'aggregateMaximum',aggregate_max,
    'minimumMode',min_mode,
    'maximumMode',max_mode,
    'minimumDemandExcess',greatest(aggregate_min-required_total,0),
    'maximumCapacityShortage',greatest(required_total-aggregate_max,0),
    'slotsWithoutEnoughCandidates',shortage_slots,
    'slotsRequiringAvoidCandidates',avoid_fallback_slots,
    'canMeetAllMinimums',aggregate_min<=required_total,
    'canCoverRequiredByMaximums',aggregate_max>=required_total,
    'hasCandidateShortages',shortage_slots>0,
    'members',member_json,
    'warnings',jsonb_strip_nulls(jsonb_build_object(
      'minimums',case when aggregate_min>required_total then 'סכום המינימום של העובדים גבוה מכמות ההקצאות הקיימת; המנוע יעבור לחלוקה פרופורציונלית.' end,
      'maximums',case when aggregate_max<required_total then 'גם אם כל עובד יקבל את המקסימום שלו, אין מספיק קיבולת לכיסוי כל המשמרות.' end,
      'candidates',case when shortage_slots>0 then shortage_slots || ' משמרות ללא מספיק מועמדים גם לאחר שימוש ב״מעדיף שלא״.' end,
      'avoidFallback',case when avoid_fallback_slots>0 then avoid_fallback_slots || ' משמרות ניתנות לכיסוי רק באמצעות לפחות עובד אחד שסימן ״מעדיף שלא״.' end
    ))
  );
end;
$function$;

create or replace function public.create_dynamic_schedule_shadow_draft(
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
  v_draft_id uuid;
  feasibility jsonb;
  sl record;
  chosen_user uuid;
  chosen_score numeric;
  chosen_status text;
  chosen_assigned integer;
  chosen_min integer;
  chosen_target integer;
  chosen_max integer;
  assigned_required integer := 0;
  assigned_optional integer := 0;
  unfilled integer := 0;
  avoid_assignments integer := 0;
  above_target_assignments integer := 0;
  no_consecutive boolean;
  max_per_day integer;
  min_rest integer;
  max_hard boolean;
  coverage_weight numeric;
  fairness_weight numeric;
  preference_weight numeric;
  optional_weight numeric;
  blocked_slots uuid[] := array[]::uuid[];
  remaining_positions integer;
begin
  if current_user_id is null then raise exception 'not authenticated'; end if;
  if not exists(
    select 1 from public.user_permissions up
    where up.user_id=current_user_id and up.permission_key='users.manage'
  ) then raise exception 'not allowed'; end if;

  select * into job from public.job_types where id=requested_job_type_id;
  if job.id is null then raise exception 'job type not found'; end if;

  select * into period
  from public.dynamic_availability_periods
  where job_type_id=job.id and year=requested_year and month=requested_month;
  if period.id is null then raise exception 'shadow availability period not found'; end if;

  feasibility := public.analyze_dynamic_schedule_feasibility(
    job.id,requested_year,requested_month
  );

  no_consecutive := coalesce(
    (job.scheduling_config#>>'{rules,noConsecutive,enabled}')::boolean,true
  );
  max_per_day := case
    when coalesce((job.scheduling_config#>>'{rules,maxShiftsPerDay,enabled}')::boolean,true)
      then coalesce((job.scheduling_config#>>'{rules,maxShiftsPerDay,value}')::integer,1)
    else 999
  end;
  min_rest := case
    when coalesce((job.scheduling_config#>>'{rules,minimumRestMinutes,enabled}')::boolean,false)
      then coalesce((job.scheduling_config#>>'{rules,minimumRestMinutes,value}')::integer,0)
    else 0
  end;
  max_hard := coalesce(job.scheduling_config->>'maximumMode','hard')='hard';
  coverage_weight := coalesce((job.scheduling_config#>>'{weights,coverage}')::numeric,1000);
  fairness_weight := coalesce((job.scheduling_config#>>'{weights,proportionalFairness}')::numeric,100);
  preference_weight := coalesce((job.scheduling_config#>>'{weights,preference}')::numeric,30);
  optional_weight := coalesce((job.scheduling_config#>>'{weights,targetOptional}')::numeric,15);

  insert into public.dynamic_schedule_shadow_drafts(
    job_type_id,availability_period_id,year,month,status,
    feasibility_snapshot,rules_snapshot,created_by
  ) values(
    job.id,period.id,requested_year,requested_month,'shadow',
    feasibility,job.scheduling_config,current_user_id
  ) returning id into v_draft_id;

  insert into public.dynamic_schedule_shadow_targets(
    draft_id,user_id,requested_min,requested_target,requested_max,
    available_slots,proportional_weight,proportional_target
  )
  select
    v_draft_id,
    (m->>'userId')::uuid,
    (m->>'minimum')::integer,
    (m->>'target')::integer,
    nullif(m->>'maximum','')::integer,
    (m->>'availableSlots')::integer,
    coalesce((m->>'weight')::numeric,1),
    coalesce((m->>'proportionalTarget')::numeric,0)
  from jsonb_array_elements(coalesce(feasibility->'members','[]'::jsonb)) m;

  -- Required coverage pass. Re-evaluate the scarcest still-unfilled shift after
  -- every assignment. This makes the optimizer period-aware instead of simply
  -- consuming capacity from the beginning of the month forward.
  loop
    select candidate_slot.* into sl
    from public.dynamic_availability_slots candidate_slot
    where candidate_slot.period_id=period.id
      and not (candidate_slot.id = any(blocked_slots))
      and (
        select count(*)
        from public.dynamic_schedule_shadow_assignments existing_assignment
        where existing_assignment.draft_id=v_draft_id
          and existing_assignment.slot_id=candidate_slot.id
          and existing_assignment.assignment_tier='required'
      ) < candidate_slot.min_workers
    order by
      (
        select count(*)
        from public.dynamic_schedule_shadow_targets target_row
        join public.dynamic_availability_submissions submission_row
          on submission_row.period_id=period.id
         and submission_row.user_id=target_row.user_id
        join public.dynamic_availability_entries entry_row
          on entry_row.submission_id=submission_row.id
         and entry_row.slot_id=candidate_slot.id
         and entry_row.availability_status in ('preferred','available','avoid')
        where target_row.draft_id=v_draft_id
          and (
            not max_hard
            or target_row.requested_max is null
            or target_row.assigned_count < target_row.requested_max
          )
          and public.dynamic_shadow_candidate_allowed(
            v_draft_id,target_row.user_id,candidate_slot.id,
            max_per_day,no_consecutive,min_rest
          )
      ) asc,
      candidate_slot.shift_date,
      candidate_slot.start_time,
      candidate_slot.id
    limit 1;

    exit when not found;

    chosen_user := null;
    chosen_score := null;
    chosen_status := null;
    chosen_assigned := null;
    chosen_min := null;
    chosen_target := null;
    chosen_max := null;

    select
      candidate.user_id,
      candidate.score,
      candidate.availability_status,
      candidate.assigned_count,
      candidate.requested_min,
      candidate.requested_target,
      candidate.requested_max
    into
      chosen_user,chosen_score,chosen_status,chosen_assigned,
      chosen_min,chosen_target,chosen_max
    from (
      select
        target_row.user_id,
        target_row.assigned_count,
        target_row.requested_min,
        target_row.requested_target,
        target_row.requested_max,
        entry_row.availability_status,
        coverage_weight
          -- Minimum gets the strongest balancing push.
          + greatest(target_row.requested_min-target_row.assigned_count,0)
              * fairness_weight * 2
          -- Target is deliberately only a soft bonus. At/above target remains
          -- eligible and receives zero target bonus rather than being removed.
          + greatest(target_row.requested_target-target_row.assigned_count,0)
              * fairness_weight
          + greatest(target_row.proportional_target-target_row.assigned_count,0)
              * fairness_weight * 0.25
          + case entry_row.availability_status
              when 'preferred' then preference_weight
              when 'available' then 0
              when 'avoid' then -preference_weight * 4
              else -1000000
            end
          -- If maximum is configured as soft, going beyond it remains possible
          -- but becomes increasingly unattractive.
          + case
              when not max_hard
               and target_row.requested_max is not null
               and target_row.assigned_count >= target_row.requested_max
              then -fairness_weight * 4
                   * (target_row.assigned_count-target_row.requested_max+1)
              else 0
            end
          as score
      from public.dynamic_schedule_shadow_targets target_row
      join public.dynamic_availability_submissions submission_row
        on submission_row.period_id=period.id
       and submission_row.user_id=target_row.user_id
      join public.dynamic_availability_entries entry_row
        on entry_row.submission_id=submission_row.id
       and entry_row.slot_id=sl.id
       and entry_row.availability_status in ('preferred','available','avoid')
      where target_row.draft_id=v_draft_id
        and (
          not max_hard
          or target_row.requested_max is null
          or target_row.assigned_count < target_row.requested_max
        )
        and public.dynamic_shadow_candidate_allowed(
          v_draft_id,target_row.user_id,sl.id,
          max_per_day,no_consecutive,min_rest
        )
      order by score desc,target_row.assigned_count asc,target_row.user_id
      limit 1
    ) candidate;

    if chosen_user is null then
      select greatest(
        sl.min_workers-count(*),0
      ) into remaining_positions
      from public.dynamic_schedule_shadow_assignments existing_assignment
      where existing_assignment.draft_id=v_draft_id
        and existing_assignment.slot_id=sl.id
        and existing_assignment.assignment_tier='required';

      unfilled := unfilled + remaining_positions;
      blocked_slots := array_append(blocked_slots,sl.id);
      continue;
    end if;

    insert into public.dynamic_schedule_shadow_assignments(
      draft_id,slot_id,user_id,assignment_tier,score,reasons
    ) values(
      v_draft_id,
      sl.id,
      chosen_user,
      'required',
      chosen_score,
      jsonb_build_array(
        'כיסוי משמרת',
        'קדימות למשמרות עם מעט מועמדים',
        case
          when chosen_assigned < coalesce(chosen_min,0) then 'השלמת מינימום חודשי'
          when chosen_assigned < coalesce(chosen_target,0) then 'איזון לכיוון היעד החודשי'
          else 'העובד נשאר מועמד גם לאחר הגעה ליעד'
        end,
        case chosen_status
          when 'preferred' then 'מעדיף'
          when 'available' then 'זמין'
          when 'avoid' then 'מעדיף שלא — נבחר רק לאחר שקלול עדיפות נמוכה'
          else chosen_status
        end
      )
    );

    update public.dynamic_schedule_shadow_targets target_row
    set assigned_count=target_row.assigned_count+1
    where target_row.draft_id=v_draft_id
      and target_row.user_id=chosen_user;

    if chosen_status='avoid' then
      avoid_assignments := avoid_assignments+1;
    end if;
    if chosen_assigned >= coalesce(chosen_target,0) then
      above_target_assignments := above_target_assignments+1;
    end if;
    assigned_required := assigned_required+1;
  end loop;

  -- Optional staffing pass. This happens only after every possible required
  -- position has been handled. "Prefer not" is intentionally not used merely
  -- to add optional staffing above the shift minimum.
  for sl in
    select *
    from public.dynamic_availability_slots candidate_slot
    where candidate_slot.period_id=period.id
      and candidate_slot.target_workers>candidate_slot.min_workers
    order by candidate_slot.shift_date,candidate_slot.start_time,candidate_slot.id
  loop
    loop
      exit when (
        select count(*)
        from public.dynamic_schedule_shadow_assignments existing_assignment
        where existing_assignment.draft_id=v_draft_id
          and existing_assignment.slot_id=sl.id
      ) >= sl.target_workers;

      chosen_user := null;
      chosen_score := null;
      chosen_status := null;
      chosen_assigned := null;
      chosen_target := null;

      select
        candidate.user_id,candidate.score,candidate.availability_status,
        candidate.assigned_count,candidate.requested_target
      into
        chosen_user,chosen_score,chosen_status,chosen_assigned,chosen_target
      from (
        select
          target_row.user_id,
          target_row.assigned_count,
          target_row.requested_target,
          entry_row.availability_status,
          optional_weight
            + greatest(target_row.requested_target-target_row.assigned_count,0)
                * fairness_weight
            + greatest(target_row.proportional_target-target_row.assigned_count,0)
                * fairness_weight * 0.25
            + case when entry_row.availability_status='preferred'
                then preference_weight else 0 end
            + case
                when not max_hard
                 and target_row.requested_max is not null
                 and target_row.assigned_count >= target_row.requested_max
                then -fairness_weight * 4
                     * (target_row.assigned_count-target_row.requested_max+1)
                else 0
              end
            as score
        from public.dynamic_schedule_shadow_targets target_row
        join public.dynamic_availability_submissions submission_row
          on submission_row.period_id=period.id
         and submission_row.user_id=target_row.user_id
        join public.dynamic_availability_entries entry_row
          on entry_row.submission_id=submission_row.id
         and entry_row.slot_id=sl.id
         and entry_row.availability_status in ('preferred','available')
        where target_row.draft_id=v_draft_id
          and (
            not max_hard
            or target_row.requested_max is null
            or target_row.assigned_count < target_row.requested_max
          )
          and public.dynamic_shadow_candidate_allowed(
            v_draft_id,target_row.user_id,sl.id,
            max_per_day,no_consecutive,min_rest
          )
        order by score desc,target_row.assigned_count asc,target_row.user_id
        limit 1
      ) candidate;

      exit when chosen_user is null;

      insert into public.dynamic_schedule_shadow_assignments(
        draft_id,slot_id,user_id,assignment_tier,score,reasons
      ) values(
        v_draft_id,sl.id,chosen_user,'target_optional',chosen_score,
        jsonb_build_array(
          'עובד נוסף עד יעד האיוש למשמרת',
          case when chosen_assigned < coalesce(chosen_target,0)
            then 'איזון לכיוון היעד החודשי'
            else 'היעד החודשי הוא העדפה ולא חסם'
          end,
          case when chosen_status='preferred' then 'מעדיף' else 'זמין' end
        )
      );

      update public.dynamic_schedule_shadow_targets target_row
      set assigned_count=target_row.assigned_count+1
      where target_row.draft_id=v_draft_id
        and target_row.user_id=chosen_user;

      if chosen_assigned >= coalesce(chosen_target,0) then
        above_target_assignments := above_target_assignments+1;
      end if;
      assigned_optional := assigned_optional+1;
    end loop;
  end loop;

  update public.dynamic_schedule_shadow_drafts draft_row
  set
    status=case when unfilled=0 then 'generated' else 'incomplete' end,
    metrics=jsonb_build_object(
      'requiredAssignmentsCreated',assigned_required,
      'optionalAssignmentsCreated',assigned_optional,
      'unfilledRequiredPositions',unfilled,
      'avoidAssignments',avoid_assignments,
      'aboveTargetAssignments',above_target_assignments,
      'algorithm','scarcity_first_soft_target_v2',
      'wholePeriodScarcity',true,
      'targetIsEligibilityCutoff',false
    ),
    updated_at=now()
  where draft_row.id=v_draft_id;

  return jsonb_build_object(
    'draftId',v_draft_id,
    'mode','shadow',
    'requiredAssignmentsCreated',assigned_required,
    'optionalAssignmentsCreated',assigned_optional,
    'unfilledRequiredPositions',unfilled,
    'avoidAssignments',avoid_assignments,
    'aboveTargetAssignments',above_target_assignments,
    'algorithm','scarcity_first_soft_target_v2',
    'wholePeriodScarcity',true,
    'targetIsEligibilityCutoff',false,
    'feasibility',feasibility
  );
end;
$function$;

grant execute on function public.analyze_dynamic_schedule_feasibility(uuid,integer,integer) to authenticated;
grant execute on function public.create_dynamic_schedule_shadow_draft(uuid,integer,integer) to authenticated;

commit;
