begin;

-- Phase 10.13.3
-- Active Statistics intentionally shows only active Job Types whose statistics feature is enabled.
-- Frozen/inactive roles keep their historical data but are not offered in the live Statistics picker.

create or replace function public.get_dynamic_statistics_job_types()
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'not authenticated';
  end if;

  if not exists (
    select 1
    from public.user_permissions up
    where up.user_id = current_user_id
      and up.permission_key in ('statistics.view','users.manage')
  ) then
    raise exception 'not allowed';
  end if;

  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'jobTypeId', jt.id,
        'name', jt.name,
        'code', jt.code,
        'isActive', jt.is_active,
        'payModel', jt.pay_model,
        'workMode', coalesce(
          nullif(jt.scheduling_config->'shiftPattern'->>'workMode',''),
          nullif(jt.scheduling_config->>'workMode','')
        ),
        'availabilityEnabled', coalesce((jt.availability_config->>'enabled')::boolean, false),
        'memberCount', (
          select count(*)
          from public.job_type_memberships m
          join public.profiles p on p.id=m.user_id
          where m.job_type_id=jt.id and p.is_active=true
        ),
        'payrollEnabled', coalesce(jt.pay_model,'none') <> 'none',
        'dataPeriodCount', (
          select count(*)
          from (
            select p.year,p.month
            from public.dynamic_schedule_publications p
            where p.job_type_id=jt.id
            union
            select hp.year,hp.month
            from public.dynamic_historical_periods hp
            where hp.job_type_id=jt.id
          ) periods
        )
      )
      order by jt.is_active desc, jt.name
    )
    from public.job_types jt
    where jt.is_active = true
      and coalesce((jt.statistics_config->>'enabled')::boolean,false)=true
  ), '[]'::jsonb);
end;
$function$;


revoke all on function public.get_dynamic_statistics_job_types() from public;
grant execute on function public.get_dynamic_statistics_job_types() to authenticated;

commit;
