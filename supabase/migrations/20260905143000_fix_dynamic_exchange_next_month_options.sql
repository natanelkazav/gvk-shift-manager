begin;

create or replace function public.get_my_dynamic_shift_exchange_options()
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  current_user_id uuid := auth.uid();
  local_now timestamp := now() at time zone 'Asia/Jerusalem';
  current_month date := date_trunc('month', local_now::date)::date;
  next_month date := (date_trunc('month', local_now::date) + interval '1 month')::date;
  result jsonb;
begin
  if current_user_id is null then raise exception 'not authenticated'; end if;

  with eligible_publications as (
    select p.*, jt.name job_type_name,
      coalesce(p.config_snapshot #>> '{jobType,scheduleChangeMode}', jt.scheduling_config #>> '{scheduleChangeMode}', 'none') change_mode
    from public.dynamic_schedule_publications p
    join public.job_types jt on jt.id=p.job_type_id
    join public.job_type_memberships m on m.job_type_id=p.job_type_id and m.user_id=current_user_id
    where p.status='published'
      and make_date(p.year,p.month,1) in (current_month, next_month)
  ), eligible as (
    select * from eligible_publications where change_mode='shift_exchange'
  )
  select jsonb_build_object(
    'hasDynamicShiftExchange', exists(select 1 from eligible),
    'publications', coalesce((select jsonb_agg(jsonb_build_object(
      'publicationId',e.id,'jobTypeId',e.job_type_id,'jobTypeName',e.job_type_name,
      'year',e.year,'month',e.month
    ) order by e.year,e.month,e.job_type_name) from eligible e),'[]'::jsonb),
    'myShifts', coalesce((select jsonb_agg(jsonb_build_object(
      'id',a.id,'publicationId',a.publication_id,'jobTypeId',e.job_type_id,'jobTypeName',e.job_type_name,
      'shiftDate',a.shift_date,'shiftCode',a.shift_code,'shiftName',a.shift_name,
      'startTime',a.start_time,'endTime',a.end_time,'year',e.year,'month',e.month
    ) order by a.shift_date,a.start_time)
      from eligible e join public.dynamic_schedule_published_assignments a on a.publication_id=e.id
      where a.user_id=current_user_id
        and (a.shift_date > local_now::date or (a.shift_date = local_now::date and a.start_time > local_now::time))), '[]'::jsonb),
    'members', coalesce((select jsonb_agg(distinct jsonb_build_object(
      'userId',m.user_id,'displayName',pr.display_name,'jobTypeId',e.job_type_id
    ))
      from eligible e join public.job_type_memberships m on m.job_type_id=e.job_type_id
      join public.profiles pr on pr.id=m.user_id and pr.is_active=true
      where m.user_id<>current_user_id),'[]'::jsonb),
    'counterpartyShifts', coalesce((select jsonb_agg(jsonb_build_object(
      'id',a.id,'publicationId',a.publication_id,'jobTypeId',e.job_type_id,'jobTypeName',e.job_type_name,
      'assignedUserId',a.user_id,'shiftDate',a.shift_date,'shiftCode',a.shift_code,'shiftName',a.shift_name,
      'startTime',a.start_time,'endTime',a.end_time,'year',e.year,'month',e.month
    ) order by a.shift_date,a.start_time)
      from eligible e join public.dynamic_schedule_published_assignments a on a.publication_id=e.id
      where a.user_id<>current_user_id
        and (a.shift_date > local_now::date or (a.shift_date = local_now::date and a.start_time > local_now::time))), '[]'::jsonb)
  ) into result;

  return coalesce(result, jsonb_build_object(
    'hasDynamicShiftExchange',false,
    'publications','[]'::jsonb,
    'myShifts','[]'::jsonb,
    'members','[]'::jsonb,
    'counterpartyShifts','[]'::jsonb
  ));
end;
$function$;

revoke all on function public.get_my_dynamic_shift_exchange_options() from public;
grant execute on function public.get_my_dynamic_shift_exchange_options() to authenticated;

commit;
