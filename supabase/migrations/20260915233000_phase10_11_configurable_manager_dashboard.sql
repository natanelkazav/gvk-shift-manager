begin;

create table if not exists public.user_dashboard_widgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  widget_type text not null default 'staffing'
    check (widget_type in ('staffing')),
  time_scope text not null
    check (time_scope in ('current','today')),
  job_type_id uuid not null references public.job_types(id) on delete cascade,
  sort_order integer not null default 0 check (sort_order >= 0),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, widget_type, time_scope, job_type_id)
);

create index if not exists user_dashboard_widgets_user_sort_idx
  on public.user_dashboard_widgets(user_id, sort_order);

alter table public.user_dashboard_widgets enable row level security;
revoke all on public.user_dashboard_widgets from anon, authenticated;

create or replace function public.can_configure_manager_dashboard(requested_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path=''
as $function$
  select requested_user_id is not null
     and requested_user_id = auth.uid()
     and (
       exists (
         select 1
         from public.user_permissions up
         where up.user_id=requested_user_id
           and up.permission_key='users.manage'
       )
       or exists (
         select 1
         from public.job_type_managers jm
         where jm.user_id=requested_user_id
       )
     );
$function$;

create or replace function public.get_my_dashboard_widget_settings()
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_actor uuid:=auth.uid();
begin
  if not public.can_configure_manager_dashboard(v_actor) then
    raise exception 'not allowed';
  end if;

  return jsonb_build_object(
    'canConfigure', true,
    'jobTypes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',jt.id,
        'name',jt.name,
        'workMode',coalesce(
          mat.work_mode,
          jt.scheduling_config #>> '{shiftPattern,workMode}',
          'shifts'
        )
      ) order by jt.name)
      from public.job_types jt
      left join lateral (
        select m.work_mode
        from public.job_type_schedule_materializations m
        where m.job_type_id=jt.id
        order by m.effective_month desc
        limit 1
      ) mat on true
      where jt.is_active=true
        and coalesce(jt.scheduling_strategy,'availability_optimizer') <> 'none'
    ),'[]'::jsonb),
    'widgets',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',w.id,
        'widgetType',w.widget_type,
        'timeScope',w.time_scope,
        'jobTypeId',w.job_type_id,
        'sortOrder',w.sort_order,
        'enabled',w.enabled
      ) order by w.sort_order,w.created_at)
      from public.user_dashboard_widgets w
      where w.user_id=v_actor
    ),'[]'::jsonb)
  );
end;
$function$;

create or replace function public.save_my_dashboard_widget_settings(
  requested_widgets jsonb
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_actor uuid:=auth.uid();
  v_item jsonb;
  v_job_type_id uuid;
  v_scope text;
  v_order integer:=0;
begin
  if not public.can_configure_manager_dashboard(v_actor) then
    raise exception 'not allowed';
  end if;
  if requested_widgets is null or jsonb_typeof(requested_widgets)<>'array' then
    raise exception 'widgets must be an array';
  end if;
  if jsonb_array_length(requested_widgets)>12 then
    raise exception 'up to 12 dashboard widgets are allowed';
  end if;

  delete from public.user_dashboard_widgets where user_id=v_actor;

  for v_item in select value from jsonb_array_elements(requested_widgets)
  loop
    v_job_type_id:=(v_item->>'jobTypeId')::uuid;
    v_scope:=v_item->>'timeScope';
    if v_scope not in ('current','today') then raise exception 'invalid time scope'; end if;
    if not exists(
      select 1 from public.job_types jt
      where jt.id=v_job_type_id and jt.is_active=true
        and coalesce(jt.scheduling_strategy,'availability_optimizer')<>'none'
    ) then raise exception 'invalid job type'; end if;

    insert into public.user_dashboard_widgets(
      user_id,widget_type,time_scope,job_type_id,sort_order,enabled
    ) values(v_actor,'staffing',v_scope,v_job_type_id,v_order,true)
    on conflict(user_id,widget_type,time_scope,job_type_id)
    do update set sort_order=excluded.sort_order,enabled=true,updated_at=now();
    v_order:=v_order+1;
  end loop;

  return public.get_my_dashboard_widget_settings();
end;
$function$;

create or replace function public.get_my_manager_dashboard_widgets()
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_actor uuid:=auth.uid();
  v_local_now timestamp:=timezone('Asia/Jerusalem',now());
  v_today date:=timezone('Asia/Jerusalem',now())::date;
  v_now_time time:=timezone('Asia/Jerusalem',now())::time;
begin
  if not public.can_configure_manager_dashboard(v_actor) then
    return '[]'::jsonb;
  end if;

  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'id',w.id,
        'timeScope',w.time_scope,
        'jobTypeId',jt.id,
        'jobTypeName',jt.name,
        'workMode',coalesce(mat.work_mode,jt.scheduling_config #>> '{shiftPattern,workMode}','shifts'),
        'assignments',coalesce(assignments.items,'[]'::jsonb)
      )
      order by w.sort_order,w.created_at
    )
    from public.user_dashboard_widgets w
    join public.job_types jt on jt.id=w.job_type_id and jt.is_active=true
    left join lateral (
      select m.work_mode
      from public.job_type_schedule_materializations m
      where m.job_type_id=jt.id
      order by m.effective_month desc
      limit 1
    ) mat on true
    left join lateral (
      select jsonb_agg(jsonb_build_object(
        'assignmentId',a.id,
        'userId',a.user_id,
        'displayName',coalesce(p.schedule_name,p.display_name,p.email,'משתמש'),
        'shiftDate',a.shift_date,
        'shiftName',a.shift_name,
        'startTime',a.start_time,
        'endTime',a.end_time
      ) order by a.shift_date,a.start_time,coalesce(p.schedule_name,p.display_name,p.email)) items
      from public.dynamic_schedule_published_assignments a
      join public.dynamic_schedule_publications pub
        on pub.id=a.publication_id
       and pub.job_type_id=jt.id
       and pub.status='published'
      join public.profiles p on p.id=a.user_id
      where (
        w.time_scope='today'
        and a.shift_date=v_today
      ) or (
        w.time_scope='current'
        and (
          (
            a.end_time>a.start_time
            and a.shift_date=v_today
            and v_now_time>=a.start_time
            and v_now_time<a.end_time
          )
          or (
            a.end_time<=a.start_time
            and (
              (a.shift_date=v_today and v_now_time>=a.start_time)
              or
              (a.shift_date=v_today-1 and v_now_time<a.end_time)
            )
          )
        )
      )
    ) assignments on true
    where w.user_id=v_actor and w.enabled=true
  ),'[]'::jsonb);
end;
$function$;

revoke all on function public.can_configure_manager_dashboard(uuid) from public;
revoke all on function public.get_my_dashboard_widget_settings() from public;
revoke all on function public.save_my_dashboard_widget_settings(jsonb) from public;
revoke all on function public.get_my_manager_dashboard_widgets() from public;

grant execute on function public.can_configure_manager_dashboard(uuid) to authenticated;
grant execute on function public.get_my_dashboard_widget_settings() to authenticated;
grant execute on function public.save_my_dashboard_widget_settings(jsonb) to authenticated;
grant execute on function public.get_my_manager_dashboard_widgets() to authenticated;

commit;
