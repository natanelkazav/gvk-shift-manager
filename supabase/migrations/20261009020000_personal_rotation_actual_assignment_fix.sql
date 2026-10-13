-- Correct the personal rotation preview without changing scheduling or exchange behavior.
-- Standalone latest version of the personal rotation preview RPC.
create or replace function public.get_my_dynamic_rotation_dates(
  requested_job_type_id uuid, requested_year integer, requested_month integer
) returns jsonb
language plpgsql stable security definer set search_path = '' as $fn$
declare
  v_actor uuid := auth.uid();
  v_state public.dynamic_job_type_rotation_state%rowtype;
  v_first date;
  v_last date;
  v_publication_id uuid;
  v_result jsonb;
begin
  if v_actor is null then raise exception 'Not authenticated'; end if;
  if requested_job_type_id is null or requested_year not between 2020 and 2100
     or requested_month not between 1 and 12 then
    raise exception 'Invalid job type or month';
  end if;
  if not exists (
    select 1 from public.job_type_memberships m
    where m.job_type_id = requested_job_type_id and m.user_id = v_actor
  ) then raise exception 'Not a member of job type'; end if;
  if not exists (
    select 1 from public.job_types j
    where j.id = requested_job_type_id
      and j.scheduling_strategy = 'monthly_rotation_constraints'
  ) then return '[]'::jsonb; end if;

  select * into v_state from public.dynamic_job_type_rotation_state
  where job_type_id = requested_job_type_id;
  if v_state.job_type_id is null or coalesce(cardinality(v_state.rotation_user_ids), 0) = 0
     then return '[]'::jsonb; end if;

  v_first := make_date(requested_year, requested_month, 1);
  v_last := (v_first + interval '1 month' - interval '1 day')::date;
  select p.id into v_publication_id
  from public.dynamic_schedule_publications p
  where p.job_type_id = requested_job_type_id
    and p.year = requested_year and p.month = requested_month
    and p.status = 'published';

  with planned as (
    select d::date as work_date,
      v_state.rotation_user_ids[
        (((d::date - v_state.anchor_date) % cardinality(v_state.rotation_user_ids)
        + cardinality(v_state.rotation_user_ids)) % cardinality(v_state.rotation_user_ids)) + 1
      ] as original_user_id
    from generate_series(v_first::timestamp, v_last::timestamp, interval '1 day') d
  ), actual as (
    select a.shift_date as work_date,
      bool_or(a.user_id = v_actor) as assigned_to_me
    from public.dynamic_schedule_published_assignments a
    where a.publication_id = v_publication_id
      and a.shift_date between v_first and v_last
    group by a.shift_date
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'date', p.work_date,
    'planned', p.original_user_id = v_actor,
    'published', coalesce(a.assigned_to_me, false),
    'hasPublishedSchedule', v_publication_id is not null,
    -- Backward compatible field; means this employee has a published assignment that day.
    'hasPublishedAssignment', coalesce(a.assigned_to_me, false),
    -- Only the actual published assignment needs coverage after publication.
    'requiresCoverageIfUnavailable', case
      when v_publication_id is null then p.original_user_id = v_actor
      else coalesce(a.assigned_to_me, false)
    end
  ) order by p.work_date), '[]'::jsonb) into v_result
  from planned p left join actual a on a.work_date = p.work_date
  where p.original_user_id = v_actor or coalesce(a.assigned_to_me, false);
  return v_result;
end;
$fn$;
revoke all on function public.get_my_dynamic_rotation_dates(uuid, integer, integer) from public, anon;
grant execute on function public.get_my_dynamic_rotation_dates(uuid, integer, integer) to authenticated;
