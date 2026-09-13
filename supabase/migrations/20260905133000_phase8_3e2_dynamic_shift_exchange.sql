begin;

create table if not exists public.dynamic_shift_exchange_requests (
  id uuid primary key default gen_random_uuid(),
  publication_id uuid not null references public.dynamic_schedule_publications(id) on delete cascade,
  job_type_id uuid not null references public.job_types(id) on delete restrict,
  swap_type text not null check (swap_type in ('one_way','two_way')),
  status text not null default 'pending_counterparty' check (status in (
    'pending_counterparty','pending_manager','approved',
    'rejected_by_counterparty','rejected_by_manager','cancelled','expired'
  )),
  requester_user_id uuid not null references public.profiles(id) on delete restrict,
  counterparty_user_id uuid not null references public.profiles(id) on delete restrict,
  requester_assignment_id uuid not null references public.dynamic_schedule_published_assignments(id) on delete restrict,
  counterparty_assignment_id uuid references public.dynamic_schedule_published_assignments(id) on delete restrict,
  rejection_reason text,
  counterparty_responded_at timestamptz,
  manager_user_id uuid references public.profiles(id) on delete set null,
  manager_reviewed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists dynamic_shift_exchange_requests_participants_idx
  on public.dynamic_shift_exchange_requests(requester_user_id, counterparty_user_id, status);
create index if not exists dynamic_shift_exchange_requests_publication_idx
  on public.dynamic_shift_exchange_requests(publication_id, status, created_at desc);

alter table public.dynamic_shift_exchange_requests enable row level security;
revoke all on public.dynamic_shift_exchange_requests from anon, authenticated;

create or replace function public.dynamic_assignment_starts_at(a public.dynamic_schedule_published_assignments)
returns timestamptz
language sql
stable
set search_path=''
as $function$
  select ((a.shift_date::text || ' ' || a.start_time::text)::timestamp at time zone 'Asia/Jerusalem');
$function$;

create or replace function public.dynamic_assignment_ends_at(a public.dynamic_schedule_published_assignments)
returns timestamptz
language sql
stable
set search_path=''
as $function$
  select (
    (a.shift_date + case when a.end_time <= a.start_time then 1 else 0 end)::text || ' ' || a.end_time::text
  )::timestamp at time zone 'Asia/Jerusalem';
$function$;

create or replace function public.dynamic_user_has_overlap(
  requested_publication_id uuid,
  requested_user_id uuid,
  requested_assignment_id uuid,
  ignored_assignment_id uuid default null
)
returns boolean
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  target_assignment public.dynamic_schedule_published_assignments%rowtype;
  target_start timestamptz;
  target_end timestamptz;
begin
  select * into target_assignment
  from public.dynamic_schedule_published_assignments
  where id=requested_assignment_id and publication_id=requested_publication_id;
  if target_assignment.id is null then return true; end if;

  target_start := public.dynamic_assignment_starts_at(target_assignment);
  target_end := public.dynamic_assignment_ends_at(target_assignment);

  return exists (
    select 1
    from public.dynamic_schedule_published_assignments other_assignment
    where other_assignment.publication_id=requested_publication_id
      and other_assignment.user_id=requested_user_id
      and other_assignment.id <> requested_assignment_id
      and (ignored_assignment_id is null or other_assignment.id <> ignored_assignment_id)
      and public.dynamic_assignment_starts_at(other_assignment) < target_end
      and public.dynamic_assignment_ends_at(other_assignment) > target_start
  );
end;
$function$;

create or replace function public.get_my_dynamic_shift_exchange_options()
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  current_user_id uuid := auth.uid();
  current_month date := date_trunc('month', (now() at time zone 'Asia/Jerusalem')::date)::date;
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
      and make_date(p.year,p.month,1) in (current_month, (current_month + interval '1 month')::date)
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
      where a.user_id=current_user_id and public.dynamic_assignment_starts_at(a)>now()),'[]'::jsonb),
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
      where a.user_id<>current_user_id and public.dynamic_assignment_starts_at(a)>now()),'[]'::jsonb)
  ) into result;
  return coalesce(result, jsonb_build_object('hasDynamicShiftExchange',false,'publications','[]'::jsonb,'myShifts','[]'::jsonb,'members','[]'::jsonb,'counterpartyShifts','[]'::jsonb));
end;
$function$;

create or replace function public.get_dynamic_shift_exchange_requests()
returns jsonb
language sql
stable
security definer
set search_path=''
as $function$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',r.id,'publicationId',r.publication_id,'jobTypeId',r.job_type_id,'jobTypeName',jt.name,
    'swapType',r.swap_type,'status',r.status,
    'requesterUserId',r.requester_user_id,'requesterName',requester.display_name,
    'counterpartyUserId',r.counterparty_user_id,'counterpartyName',counterparty.display_name,
    'requesterAssignmentId',r.requester_assignment_id,'requesterShiftDate',ra.shift_date,
    'requesterShiftName',ra.shift_name,'requesterStartTime',ra.start_time,'requesterEndTime',ra.end_time,
    'counterpartyAssignmentId',r.counterparty_assignment_id,'counterpartyShiftDate',ca.shift_date,
    'counterpartyShiftName',ca.shift_name,'counterpartyStartTime',ca.start_time,'counterpartyEndTime',ca.end_time,
    'rejectionReason',r.rejection_reason,'counterpartyRespondedAt',r.counterparty_responded_at,
    'managerReviewedAt',r.manager_reviewed_at,'managerUserId',r.manager_user_id,
    'createdAt',r.created_at,'updatedAt',r.updated_at
  ) order by r.created_at desc),'[]'::jsonb)
  from public.dynamic_shift_exchange_requests r
  join public.job_types jt on jt.id=r.job_type_id
  join public.profiles requester on requester.id=r.requester_user_id
  join public.profiles counterparty on counterparty.id=r.counterparty_user_id
  join public.dynamic_schedule_published_assignments ra on ra.id=r.requester_assignment_id
  left join public.dynamic_schedule_published_assignments ca on ca.id=r.counterparty_assignment_id
  where auth.uid() is not null and (
    r.requester_user_id=auth.uid() or r.counterparty_user_id=auth.uid()
    or public.current_user_has_permission('shift_swaps.approve')
  );
$function$;

create or replace function public.create_dynamic_shift_exchange_request(
  requested_swap_type text,
  requested_requester_assignment_id uuid,
  requested_counterparty_user_id uuid,
  requested_counterparty_assignment_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  current_user_id uuid := auth.uid();
  requester_assignment public.dynamic_schedule_published_assignments%rowtype;
  counter_assignment public.dynamic_schedule_published_assignments%rowtype;
  target_publication public.dynamic_schedule_publications%rowtype;
  target_job public.job_types%rowtype;
  created_request public.dynamic_shift_exchange_requests%rowtype;
  change_mode text;
begin
  if current_user_id is null then raise exception 'not authenticated'; end if;
  if requested_swap_type not in ('one_way','two_way') then raise exception 'סוג ההחלפה אינו תקין.'; end if;
  if requested_counterparty_user_id=current_user_id then raise exception 'לא ניתן להגיש בקשה מול עצמך.'; end if;

  select * into requester_assignment from public.dynamic_schedule_published_assignments
  where id=requested_requester_assignment_id for update;
  if requester_assignment.id is null or requester_assignment.user_id<>current_user_id then raise exception 'המשמרת שנבחרה אינה משובצת אליך.'; end if;
  if public.dynamic_assignment_starts_at(requester_assignment)<=now() then raise exception 'לא ניתן להחליף משמרת שכבר התחילה.'; end if;

  select * into target_publication from public.dynamic_schedule_publications where id=requester_assignment.publication_id;
  select * into target_job from public.job_types where id=target_publication.job_type_id;
  change_mode := coalesce(target_publication.config_snapshot #>> '{jobType,scheduleChangeMode}', target_job.scheduling_config #>> '{scheduleChangeMode}', 'none');
  if target_publication.status<>'published' or change_mode<>'shift_exchange' then raise exception 'חילופי משמרות אינם פעילים בלוח זה.'; end if;
  if make_date(target_publication.year,target_publication.month,1) not in (
    date_trunc('month',(now() at time zone 'Asia/Jerusalem')::date)::date,
    (date_trunc('month',(now() at time zone 'Asia/Jerusalem')::date)+interval '1 month')::date
  ) then raise exception 'ניתן להגיש בקשות רק לחודש הנוכחי או לחודש הבא שפורסם.'; end if;

  if not exists(select 1 from public.job_type_memberships m join public.profiles p on p.id=m.user_id and p.is_active=true
    where m.job_type_id=target_publication.job_type_id and m.user_id=requested_counterparty_user_id) then
    raise exception 'העובד שנבחר אינו חבר פעיל בתפקיד.';
  end if;

  if requested_swap_type='two_way' then
    if requested_counterparty_assignment_id is null then raise exception 'יש לבחור משמרת נגדית.'; end if;
    select * into counter_assignment from public.dynamic_schedule_published_assignments
    where id=requested_counterparty_assignment_id and publication_id=target_publication.id for update;
    if counter_assignment.id is null or counter_assignment.user_id<>requested_counterparty_user_id then raise exception 'המשמרת הנגדית אינה משובצת לעובד שנבחר.'; end if;
    if public.dynamic_assignment_starts_at(counter_assignment)<=now() then raise exception 'המשמרת הנגדית כבר התחילה.'; end if;
  elsif requested_counterparty_assignment_id is not null then
    raise exception 'בהחלפה חד-כיוונית אין לבחור משמרת נגדית.';
  end if;

  if exists(select 1 from public.dynamic_shift_exchange_requests r
    where r.status in ('pending_counterparty','pending_manager') and (
      r.requester_assignment_id=requested_requester_assignment_id or r.counterparty_assignment_id=requested_requester_assignment_id
      or (requested_counterparty_assignment_id is not null and (r.requester_assignment_id=requested_counterparty_assignment_id or r.counterparty_assignment_id=requested_counterparty_assignment_id))
    )) then raise exception 'כבר קיימת בקשת החלפה פעילה עבור אחת המשמרות.'; end if;

  if public.dynamic_user_has_overlap(target_publication.id, requested_counterparty_user_id, requester_assignment.id,
      case when requested_swap_type='two_way' then counter_assignment.id else null end) then
    raise exception 'ההחלפה תיצור לעובד השני משמרות חופפות.';
  end if;
  if requested_swap_type='two_way' and public.dynamic_user_has_overlap(target_publication.id,current_user_id,counter_assignment.id,requester_assignment.id) then
    raise exception 'ההחלפה תיצור עבורך משמרות חופפות.';
  end if;

  insert into public.dynamic_shift_exchange_requests(publication_id,job_type_id,swap_type,requester_user_id,counterparty_user_id,requester_assignment_id,counterparty_assignment_id)
  values(target_publication.id,target_publication.job_type_id,requested_swap_type,current_user_id,requested_counterparty_user_id,requester_assignment.id,requested_counterparty_assignment_id)
  returning * into created_request;

  insert into public.audit_logs(action,actor_user_id,entity_type,entity_id,summary,metadata)
  values('shift_swap_created',current_user_id,'dynamic_shift_exchange_request',created_request.id,'נוצרה בקשת חילופי משמרות דינמית',jsonb_build_object('job_type_id',target_publication.job_type_id,'publication_id',target_publication.id,'swap_type',requested_swap_type));

  return jsonb_build_object('id',created_request.id,'status',created_request.status,'swapType',created_request.swap_type);
end;
$function$;

create or replace function public.respond_to_dynamic_shift_exchange_request(
  requested_request_id uuid, requested_approve boolean, requested_rejection_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  current_user_id uuid := auth.uid();
  r public.dynamic_shift_exchange_requests%rowtype;
  ra public.dynamic_schedule_published_assignments%rowtype;
  ca public.dynamic_schedule_published_assignments%rowtype;
begin
  if current_user_id is null then raise exception 'not authenticated'; end if;
  select * into r from public.dynamic_shift_exchange_requests where id=requested_request_id for update;
  if r.id is null then raise exception 'הבקשה לא נמצאה.'; end if;
  if r.counterparty_user_id<>current_user_id then raise exception 'רק העובד שהתבקש להחליף יכול להגיב.'; end if;
  if r.status<>'pending_counterparty' then raise exception 'הבקשה אינה ממתינה לתגובה.'; end if;

  if requested_approve then
    select * into ra from public.dynamic_schedule_published_assignments where id=r.requester_assignment_id;
    if ra.id is null or ra.user_id<>r.requester_user_id or public.dynamic_assignment_starts_at(ra)<=now() then raise exception 'השיבוץ המקורי השתנה או כבר התחיל.'; end if;
    if r.swap_type='two_way' then
      select * into ca from public.dynamic_schedule_published_assignments where id=r.counterparty_assignment_id;
      if ca.id is null or ca.user_id<>r.counterparty_user_id or public.dynamic_assignment_starts_at(ca)<=now() then raise exception 'השיבוץ הנגדי השתנה או כבר התחיל.'; end if;
    end if;
    if public.dynamic_user_has_overlap(r.publication_id,r.counterparty_user_id,ra.id,case when r.swap_type='two_way' then ca.id else null end) then raise exception 'ההחלפה תיצור משמרות חופפות.'; end if;
    if r.swap_type='two_way' and public.dynamic_user_has_overlap(r.publication_id,r.requester_user_id,ca.id,ra.id) then raise exception 'ההחלפה תיצור משמרות חופפות.'; end if;
    update public.dynamic_shift_exchange_requests set status='pending_manager',counterparty_responded_at=now(),rejection_reason=null,updated_at=now() where id=r.id returning * into r;
    insert into public.audit_logs(action,actor_user_id,entity_type,entity_id,summary,metadata)
    values('shift_swap_counterparty_approved',current_user_id,'dynamic_shift_exchange_request',r.id,'הצד השני אישר בקשת חילופים דינמית','{}'::jsonb);
  else
    update public.dynamic_shift_exchange_requests set status='rejected_by_counterparty',counterparty_responded_at=now(),rejection_reason=nullif(trim(coalesce(requested_rejection_reason,'')) ,''),updated_at=now() where id=r.id returning * into r;
    insert into public.audit_logs(action,actor_user_id,entity_type,entity_id,summary,metadata)
    values('shift_swap_counterparty_rejected',current_user_id,'dynamic_shift_exchange_request',r.id,'הצד השני דחה בקשת חילופים דינמית','{}'::jsonb);
  end if;
  return jsonb_build_object('id',r.id,'status',r.status);
end;
$function$;

create or replace function public.review_dynamic_shift_exchange_request(
  requested_request_id uuid, requested_approve boolean, requested_rejection_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  current_user_id uuid := auth.uid();
  r public.dynamic_shift_exchange_requests%rowtype;
  ra public.dynamic_schedule_published_assignments%rowtype;
  ca public.dynamic_schedule_published_assignments%rowtype;
begin
  if current_user_id is null then raise exception 'not authenticated'; end if;
  if not public.current_user_has_permission('shift_swaps.approve') then raise exception 'אין לך הרשאה לאשר חילופי משמרות.'; end if;
  select * into r from public.dynamic_shift_exchange_requests where id=requested_request_id for update;
  if r.id is null or r.status<>'pending_manager' then raise exception 'הבקשה אינה ממתינה לאישור מנהל.'; end if;

  if not requested_approve then
    update public.dynamic_shift_exchange_requests set status='rejected_by_manager',manager_user_id=current_user_id,manager_reviewed_at=now(),rejection_reason=nullif(trim(coalesce(requested_rejection_reason,'')),''),updated_at=now() where id=r.id returning * into r;
    insert into public.audit_logs(action,actor_user_id,entity_type,entity_id,summary,metadata)
    values('shift_swap_manager_rejected',current_user_id,'dynamic_shift_exchange_request',r.id,'מנהל דחה בקשת חילופים דינמית','{}'::jsonb);
    return jsonb_build_object('id',r.id,'status',r.status);
  end if;

  select * into ra from public.dynamic_schedule_published_assignments where id=r.requester_assignment_id for update;
  if ra.id is null or ra.user_id<>r.requester_user_id or public.dynamic_assignment_starts_at(ra)<=now() then raise exception 'השיבוץ המקורי השתנה או כבר התחיל.'; end if;
  if r.swap_type='two_way' then
    select * into ca from public.dynamic_schedule_published_assignments where id=r.counterparty_assignment_id for update;
    if ca.id is null or ca.user_id<>r.counterparty_user_id or public.dynamic_assignment_starts_at(ca)<=now() then raise exception 'השיבוץ הנגדי השתנה או כבר התחיל.'; end if;
  end if;

  if public.dynamic_user_has_overlap(r.publication_id,r.counterparty_user_id,ra.id,case when r.swap_type='two_way' then ca.id else null end) then raise exception 'ההחלפה תיצור משמרות חופפות.'; end if;
  if r.swap_type='two_way' and public.dynamic_user_has_overlap(r.publication_id,r.requester_user_id,ca.id,ra.id) then raise exception 'ההחלפה תיצור משמרות חופפות.'; end if;

  update public.dynamic_schedule_published_assignments set user_id=r.counterparty_user_id,user_edited_by=current_user_id,user_edited_at=now() where id=ra.id;
  if r.swap_type='two_way' then
    update public.dynamic_schedule_published_assignments set user_id=r.requester_user_id,user_edited_by=current_user_id,user_edited_at=now() where id=ca.id;
  end if;

  update public.dynamic_shift_exchange_requests set status='approved',manager_user_id=current_user_id,manager_reviewed_at=now(),rejection_reason=null,updated_at=now() where id=r.id returning * into r;
  insert into public.audit_logs(action,actor_user_id,entity_type,entity_id,summary,metadata)
  values('shift_swap_manager_approved',current_user_id,'dynamic_shift_exchange_request',r.id,'מנהל אישר חילופי משמרות דינמיים',jsonb_build_object('publication_id',r.publication_id,'job_type_id',r.job_type_id,'swap_type',r.swap_type));
  return jsonb_build_object('id',r.id,'status',r.status);
end;
$function$;

create or replace function public.cancel_dynamic_shift_exchange_request(requested_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  current_user_id uuid := auth.uid();
  r public.dynamic_shift_exchange_requests%rowtype;
begin
  if current_user_id is null then raise exception 'not authenticated'; end if;
  select * into r from public.dynamic_shift_exchange_requests where id=requested_request_id for update;
  if r.id is null then raise exception 'הבקשה לא נמצאה.'; end if;
  if r.requester_user_id<>current_user_id then raise exception 'רק מגיש הבקשה יכול לבטל אותה.'; end if;
  if r.status not in ('pending_counterparty','pending_manager') then raise exception 'לא ניתן לבטל בקשה במצב הנוכחי.'; end if;
  update public.dynamic_shift_exchange_requests set status='cancelled',cancelled_at=now(),updated_at=now() where id=r.id returning * into r;
  insert into public.audit_logs(action,actor_user_id,entity_type,entity_id,summary,metadata)
  values('shift_swap_cancelled',current_user_id,'dynamic_shift_exchange_request',r.id,'בקשת חילופים דינמית בוטלה','{}'::jsonb);
  return jsonb_build_object('id',r.id,'status',r.status);
end;
$function$;

revoke all on function public.get_my_dynamic_shift_exchange_options() from public;
revoke all on function public.get_dynamic_shift_exchange_requests() from public;
revoke all on function public.create_dynamic_shift_exchange_request(text,uuid,uuid,uuid) from public;
revoke all on function public.respond_to_dynamic_shift_exchange_request(uuid,boolean,text) from public;
revoke all on function public.review_dynamic_shift_exchange_request(uuid,boolean,text) from public;
revoke all on function public.cancel_dynamic_shift_exchange_request(uuid) from public;
grant execute on function public.get_my_dynamic_shift_exchange_options() to authenticated;
grant execute on function public.get_dynamic_shift_exchange_requests() to authenticated;
grant execute on function public.create_dynamic_shift_exchange_request(text,uuid,uuid,uuid) to authenticated;
grant execute on function public.respond_to_dynamic_shift_exchange_request(uuid,boolean,text) to authenticated;
grant execute on function public.review_dynamic_shift_exchange_request(uuid,boolean,text) to authenticated;
grant execute on function public.cancel_dynamic_shift_exchange_request(uuid) to authenticated;

commit;
