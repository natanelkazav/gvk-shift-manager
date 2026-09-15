-- Phase 10.13.6 - Manager dashboard must use the same operational interval
-- resolver as the dynamic calendar/runtime. This fixes daily duties and all
-- cross-midnight shifts (for example 14:00 -> 06:00 and 23:00 -> 06:00).

begin;

-- Accept both a live scheduling_config object and a full materialization
-- source_snapshot. This keeps one interval rule for every caller.
create or replace function public.dynamic_resolve_assignment_local_interval(
  requested_shift_date date,
  requested_start_time time,
  requested_end_time time,
  requested_work_mode text,
  requested_scheduling_config jsonb
)
returns table(start_at timestamp without time zone, end_at timestamp without time zone)
language sql
stable
set search_path = ''
as $function$
  with normalized as (
    select coalesce(
      requested_scheduling_config #> '{schedulingConfig,shiftPattern}',
      requested_scheduling_config -> 'shiftPattern',
      '{}'::jsonb
    ) as shift_pattern
  ), resolved as (
    select
      case
        when requested_work_mode = 'on_call_daily'
          then coalesce(
            nullif(normalized.shift_pattern #>> '{dailyOnCallWindow,startTime}', '')::time,
            '00:00'::time
          )
        else coalesce(requested_start_time, '00:00'::time)
      end as resolved_start,
      case
        when requested_work_mode = 'on_call_daily'
          then coalesce(
            nullif(normalized.shift_pattern #>> '{dailyOnCallWindow,endTime}', '')::time,
            '00:00'::time
          )
        else coalesce(requested_end_time, '00:00'::time)
      end as resolved_end
    from normalized
  )
  select
    requested_shift_date + resolved_start,
    requested_shift_date + resolved_end
      + case when resolved_end <= resolved_start then interval '1 day' else interval '0 day' end
  from resolved;
$function$;

revoke all on function public.dynamic_resolve_assignment_local_interval(date,time,time,text,jsonb) from public;
grant execute on function public.dynamic_resolve_assignment_local_interval(date,time,time,text,jsonb) to authenticated;

create or replace function public.get_my_manager_dashboard_widgets()
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_actor uuid := auth.uid();
  v_local_now timestamp := timezone('Asia/Jerusalem', now());
  v_today date := timezone('Asia/Jerusalem', now())::date;
begin
  if not public.can_configure_manager_dashboard(v_actor) then
    return '[]'::jsonb;
  end if;

  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'id', w.id,
        'timeScope', w.time_scope,
        'jobTypeId', jt.id,
        'jobTypeName', jt.name,
        'workMode', coalesce(current_mat.work_mode, jt.scheduling_config #>> '{shiftPattern,workMode}', 'shifts'),
        'assignments', coalesce(assignments.items, '[]'::jsonb)
      )
      order by w.sort_order, w.created_at
    )
    from public.user_dashboard_widgets w
    join public.job_types jt
      on jt.id = w.job_type_id
     and jt.is_active = true
    left join lateral (
      -- Widget metadata follows the configuration effective for the current month,
      -- never a future materialization.
      select m.work_mode, m.source_snapshot
      from public.job_type_schedule_materializations m
      where m.job_type_id = jt.id
        and m.effective_month <= date_trunc('month', v_today)::date
      order by m.effective_month desc
      limit 1
    ) current_mat on true
    left join lateral (
      select jsonb_agg(
        jsonb_build_object(
          'assignmentId', candidate.assignment_id,
          'userId', candidate.user_id,
          'displayName', candidate.display_name,
          'shiftDate', candidate.shift_date,
          'shiftName', candidate.shift_name,
          'startTime', candidate.display_start_time,
          'endTime', candidate.display_end_time
        )
        order by candidate.assignment_start_at, candidate.display_name
      ) as items
      from (
        select
          a.id as assignment_id,
          a.user_id,
          coalesce(p.schedule_name, p.display_name, p.email, 'משתמש') as display_name,
          a.shift_date,
          public.resolve_dynamic_shift_display_name(
            jt.id,
            a.shift_date,
            a.shift_code,
            a.shift_name,
            a.start_time,
            a.end_time,
            case when assignment_cfg.work_mode = 'on_call_daily' then 'כוננות' else 'משמרת' end
          ) as shift_name,
          assignment_bounds.start_at as assignment_start_at,
          assignment_bounds.end_at as assignment_end_at,
          assignment_bounds.start_at::time as display_start_time,
          assignment_bounds.end_at::time as display_end_time
        from public.dynamic_schedule_published_assignments a
        join public.dynamic_schedule_publications pub
          on pub.id = a.publication_id
         and pub.job_type_id = jt.id
         and pub.status = 'published'
        join public.profiles p on p.id = a.user_id
        left join lateral (
          -- Resolve the role configuration that was effective for THIS assignment,
          -- so next-month edits cannot rewrite today's operational meaning.
          select
            m.work_mode,
            m.source_snapshot
          from public.job_type_schedule_materializations m
          where m.job_type_id = jt.id
            and m.effective_month <= date_trunc('month', a.shift_date)::date
          order by m.effective_month desc
          limit 1
        ) assignment_mat on true
        cross join lateral (
          select
            coalesce(assignment_mat.work_mode, jt.scheduling_config #>> '{shiftPattern,workMode}', 'shifts') as work_mode,
            coalesce(assignment_mat.source_snapshot, jsonb_build_object('schedulingConfig', jt.scheduling_config)) as scheduling_snapshot
        ) assignment_cfg
        cross join lateral public.dynamic_resolve_assignment_local_interval(
          a.shift_date,
          a.start_time,
          a.end_time,
          assignment_cfg.work_mode,
          assignment_cfg.scheduling_snapshot
        ) assignment_bounds
        where
          -- Keep the scan narrow while still including a duty that began yesterday
          -- and remains active after midnight.
          a.shift_date between v_today - 1 and v_today
          and (
            (w.time_scope = 'today' and a.shift_date = v_today)
            or
            (w.time_scope = 'current'
              and v_local_now >= assignment_bounds.start_at
              and v_local_now < assignment_bounds.end_at)
          )
      ) candidate
    ) assignments on true
    where w.user_id = v_actor
      and w.enabled = true
  ), '[]'::jsonb);
end;
$function$;

revoke all on function public.get_my_manager_dashboard_widgets() from public;
grant execute on function public.get_my_manager_dashboard_widgets() to authenticated;

commit;
