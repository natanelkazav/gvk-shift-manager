-- Expose the effective 200% hours of each availability slot to the draft editor.
-- The value comes from the materialized pay snapshot for the role/month, so the UI
-- reflects the same configuration used by the scheduling engine.

create or replace function public.get_dynamic_schedule_draft_editor(requested_draft_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_user uuid := auth.uid();
  d public.dynamic_schedule_shadow_drafts%rowtype;
  j public.job_types%rowtype;
  p public.dynamic_availability_periods%rowtype;
  v_metrics jsonb;
begin
  if v_user is null then raise exception 'not authenticated'; end if;

  select * into d from public.dynamic_schedule_shadow_drafts where id=requested_draft_id;
  if not public.has_dynamic_job_type_permission('schedule.view_team', d.job_type_id, v_user) then raise exception 'not allowed'; end if;
  if d.id is null then raise exception 'draft not found'; end if;
  select * into j from public.job_types where id=d.job_type_id;
  select * into p from public.dynamic_availability_periods where id=d.availability_period_id;
  v_metrics := public.dynamic_refresh_draft_metrics(d.id);

  return jsonb_build_object(
    'draftId',d.id,'jobTypeId',d.job_type_id,'jobTypeName',j.name,
    'year',d.year,'month',d.month,'status',(select status from public.dynamic_schedule_shadow_drafts where id=d.id),
    'metrics',v_metrics,
    'slots',coalesce((
      select jsonb_agg(jsonb_build_object(
        'slotId',sl.id,'date',sl.shift_date,'shiftCode',sl.shift_code,'shiftName',sl.shift_name,
        'startTime',sl.start_time,'endTime',sl.end_time,
        'hours200Percent',coalesce((
          select sum(
            case
              when coalesce(nullif(seg->>'multiplier','')::numeric,1) >= 2
                then coalesce(nullif(seg->>'hours','')::numeric,0)
              else 0
            end
          )
          from jsonb_array_elements(coalesce(sl.pay_segments_snapshot,'[]'::jsonb)) seg
        ),0),
        'minWorkers',sl.min_workers,'targetWorkers',sl.target_workers,'maxWorkers',sl.max_workers,
        'intentionallyUnassignedCount',least(coalesce(o.intentionally_unassigned_count,0),greatest(sl.min_workers-coalesce(ac.required_count,0),0)),
        'overrideNote',o.note,
        'assignments',coalesce((
          select jsonb_agg(jsonb_build_object(
            'id',a.id,'userId',a.user_id,'displayName',ap.display_name,
            'engineUserId',a.engine_user_id,'engineDisplayName',ep.display_name,
            'tier',a.assignment_tier,'score',a.score,'reasons',a.reasons,
            'managerEdited',a.manager_edited_at is not null or (a.engine_user_id is not null and a.engine_user_id<>a.user_id),
            'managerOverrideNote',a.manager_override_note
          ) order by case when a.assignment_tier='required' then 0 else 1 end, ap.display_name)
          from public.dynamic_schedule_shadow_assignments a
          join public.profiles ap on ap.id=a.user_id
          left join public.profiles ep on ep.id=a.engine_user_id
          where a.draft_id=d.id and a.slot_id=sl.id
        ),'[]'::jsonb),
        'candidates',coalesce((
          select jsonb_agg(jsonb_build_object(
            'userId',m.user_id,'displayName',mp.display_name,
            'availabilityStatus',e.availability_status,
            'assignedCount',(select count(*) from public.dynamic_schedule_shadow_assignments xa where xa.draft_id=d.id and xa.user_id=m.user_id),
            'maximum',t.requested_max,
            'isAssignedHere',exists(select 1 from public.dynamic_schedule_shadow_assignments xa where xa.draft_id=d.id and xa.slot_id=sl.id and xa.user_id=m.user_id)
          ) order by
            case e.availability_status when 'preferred' then 0 when 'available' then 1 when 'avoid' then 2 when 'unavailable' then 3 else 4 end,
            mp.display_name)
          from public.job_type_memberships m
          join public.profiles mp on mp.id=m.user_id and mp.is_active=true
          left join public.dynamic_availability_submissions sub on sub.period_id=p.id and sub.user_id=m.user_id
          left join public.dynamic_availability_entries e on e.submission_id=sub.id and e.slot_id=sl.id
          left join public.dynamic_schedule_shadow_targets t on t.draft_id=d.id and t.user_id=m.user_id
          where m.job_type_id=d.job_type_id
        ),'[]'::jsonb)
      ) order by sl.shift_date,sl.start_time,sl.shift_name)
      from public.dynamic_availability_slots sl
      left join (
        select slot_id,count(*) filter(where assignment_tier='required')::integer required_count
        from public.dynamic_schedule_shadow_assignments where draft_id=d.id group by slot_id
      ) ac on ac.slot_id=sl.id
      left join public.dynamic_schedule_draft_slot_overrides o on o.draft_id=d.id and o.slot_id=sl.id
      where sl.period_id=p.id
    ),'[]'::jsonb)
  );
end;
$function$;

grant execute on function public.get_dynamic_schedule_draft_editor(uuid) to authenticated;
