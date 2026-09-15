begin;

create or replace function public.resolve_dynamic_shift_display_name(
  requested_job_type_id uuid,
  requested_shift_date date,
  requested_shift_code text,
  requested_shift_name text,
  requested_start_time time,
  requested_end_time time,
  requested_fallback text default 'משמרת'
)
returns text
language sql
stable
security definer
set search_path=''
as $function$
  select coalesce(
    (
      select nullif(st.name,'')
      from public.job_type_schedule_materializations mat
      join public.job_type_materialized_shift_templates st
        on st.materialization_id=mat.id
       and st.is_active=true
      where mat.job_type_id=requested_job_type_id
        and mat.effective_month<=date_trunc('month',requested_shift_date)::date
        and st.start_time=requested_start_time
        and st.end_time=requested_end_time
      order by mat.effective_month desc,
               case when st.code=requested_shift_code then 0 else 1 end,
               st.sort_order,st.name
      limit 1
    ),
    case
      when nullif(trim(coalesce(requested_shift_name,'')),'') is null then null
      when trim(requested_shift_name) ~ '^[0-9]{8}-[0-9]{4}$' then null
      when trim(requested_shift_name) ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}[-_T ][0-9]{2}:?[0-9]{2}$' then null
      when lower(trim(requested_shift_name)) ~ '^slot[-_:]' then null
      when requested_shift_name=requested_shift_code then null
      else trim(requested_shift_name)
    end,
    nullif(trim(coalesce(requested_fallback,'')),''),
    'משמרת'
  );
$function$;

revoke all on function public.resolve_dynamic_shift_display_name(uuid,date,text,text,time,time,text) from public;
grant execute on function public.resolve_dynamic_shift_display_name(uuid,date,text,text,time,time,text) to authenticated;

-- Rebuild the manager widget RPC so technical slot identifiers never leave the DB API.
create or replace function public.get_my_manager_dashboard_widgets()
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_actor uuid:=auth.uid();
  v_today date:=timezone('Asia/Jerusalem',now())::date;
  v_now_time time:=timezone('Asia/Jerusalem',now())::time;
begin
  if not public.can_configure_manager_dashboard(v_actor) then return '[]'::jsonb; end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id',w.id,'timeScope',w.time_scope,'jobTypeId',jt.id,'jobTypeName',jt.name,
      'workMode',coalesce(mat.work_mode,jt.scheduling_config #>> '{shiftPattern,workMode}','shifts'),
      'assignments',coalesce(assignments.items,'[]'::jsonb)
    ) order by w.sort_order,w.created_at)
    from public.user_dashboard_widgets w
    join public.job_types jt on jt.id=w.job_type_id and jt.is_active=true
    left join lateral (
      select m.work_mode from public.job_type_schedule_materializations m
      where m.job_type_id=jt.id order by m.effective_month desc limit 1
    ) mat on true
    left join lateral (
      select jsonb_agg(jsonb_build_object(
        'assignmentId',a.id,'userId',a.user_id,
        'displayName',coalesce(p.schedule_name,p.display_name,p.email,'משתמש'),
        'shiftDate',a.shift_date,
        'shiftName',public.resolve_dynamic_shift_display_name(
          jt.id,a.shift_date,a.shift_code,a.shift_name,a.start_time,a.end_time,
          case when coalesce(mat.work_mode,jt.scheduling_config #>> '{shiftPattern,workMode}','shifts')='on_call_daily'
            then 'כוננות' else 'משמרת' end
        ),
        'startTime',a.start_time,'endTime',a.end_time
      ) order by a.shift_date,a.start_time,coalesce(p.schedule_name,p.display_name,p.email)) items
      from public.dynamic_schedule_published_assignments a
      join public.dynamic_schedule_publications pub
        on pub.id=a.publication_id and pub.job_type_id=jt.id and pub.status='published'
      join public.profiles p on p.id=a.user_id
      where (
        w.time_scope='today' and a.shift_date=v_today
      ) or (
        w.time_scope='current' and (
          (a.end_time>a.start_time and a.shift_date=v_today and v_now_time>=a.start_time and v_now_time<a.end_time)
          or
          (a.end_time<=a.start_time and (
            (a.shift_date=v_today and v_now_time>=a.start_time)
            or (a.shift_date=v_today-1 and v_now_time<a.end_time)
          ))
        )
      )
    ) assignments on true
    where w.user_id=v_actor and w.enabled=true
  ),'[]'::jsonb);
end;
$function$;

-- Assignment-change notifications also store only the friendly name in notification data.
create or replace function public.create_dynamic_assignment_change_notification()
returns trigger
language plpgsql
security definer
set search_path=''
as $function$
declare
  actor uuid:=auth.uid();
  publication public.dynamic_schedule_publications%rowtype;
  job public.job_types%rowtype;
  old_user uuid; new_user uuid; shift_date_value date; shift_name_value text;
  start_time_value time; end_time_value time; shift_code_value text;
  notification_id uuid; recipient_count integer:=0; is_swap_change boolean:=false;
begin
  if tg_op='INSERT' and not coalesce(new.manager_edited,false) and new.user_edited_by is null then return new; end if;
  if tg_op='UPDATE' and new.user_id is not distinct from old.user_id then return new; end if;

  select p.* into publication from public.dynamic_schedule_publications p
  where p.id=coalesce(new.publication_id,old.publication_id);
  if publication.id is null or publication.status<>'published' then return coalesce(new,old); end if;
  if publication.year<>extract(year from (now() at time zone 'Asia/Jerusalem'))::integer
     or publication.month<>extract(month from (now() at time zone 'Asia/Jerusalem'))::integer
  then return coalesce(new,old); end if;

  select jt.* into job from public.job_types jt where jt.id=publication.job_type_id and jt.legacy_role is null;
  if job.id is null then return coalesce(new,old); end if;

  old_user:=case when tg_op in ('UPDATE','DELETE') then old.user_id else null end;
  new_user:=case when tg_op in ('UPDATE','INSERT') then new.user_id else null end;
  shift_date_value:=coalesce(new.shift_date,old.shift_date);
  shift_code_value:=coalesce(new.shift_code,old.shift_code);
  start_time_value:=coalesce(new.start_time,old.start_time);
  end_time_value:=coalesce(new.end_time,old.end_time);
  shift_name_value:=public.resolve_dynamic_shift_display_name(
    job.id,shift_date_value,shift_code_value,coalesce(new.shift_name,old.shift_name),
    start_time_value,end_time_value,'משמרת'
  );

  if tg_op='UPDATE' then
    select exists(select 1 from public.dynamic_shift_exchange_requests r
      where r.status='pending_manager' and r.publication_id=publication.id
        and (r.requester_assignment_id=old.id or r.counterparty_assignment_id=old.id))
    into is_swap_change;
    if is_swap_change then return new; end if;
  end if;

  actor:=coalesce(actor,new.user_edited_by,old.user_edited_by);
  if actor is null then return coalesce(new,old); end if;

  insert into public.notifications(type,priority,source,title,body,url,data,created_by,expires_at)
  values(
    'system','important','dynamic_schedule_edit','השיבוץ שלך השתנה',
    concat(job.name,' · ',to_char(shift_date_value,'DD/MM/YYYY'),
      case when start_time_value is not null then concat(' · ',to_char(start_time_value,'HH24:MI'),'–',to_char(end_time_value,'HH24:MI')) else '' end,
      '. השיבוץ המעודכן זמין במערכת.'),
    concat('/my-shifts?jobTypeId=',job.id,'&year=',publication.year,'&month=',publication.month),
    jsonb_build_object('workflow','dynamic_schedule','event','assignment_changed','actorUserId',actor,
      'publicationId',publication.id,'jobTypeId',job.id,'jobTypeName',job.name,
      'assignmentId',coalesce(new.id,old.id),'shiftDate',shift_date_value,'shiftName',shift_name_value,
      'startTime',start_time_value,'endTime',end_time_value,'oldUserId',old_user,'newUserId',new_user,'pushPending',true),
    actor,now()+interval '90 days'
  ) returning id into notification_id;

  insert into public.notification_recipients(notification_id,user_id)
  select notification_id,candidate.user_id
  from (select old_user user_id union select new_user user_id) candidate
  join public.profiles p on p.id=candidate.user_id and p.is_active=true
  where candidate.user_id is not null and candidate.user_id<>actor;
  get diagnostics recipient_count=row_count;
  if recipient_count=0 then delete from public.notifications where id=notification_id; end if;
  return coalesce(new,old);
end;
$function$;

commit;
