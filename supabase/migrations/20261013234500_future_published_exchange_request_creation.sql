-- Allow exchanges for any future published month, not just the current/next month.
-- Based on 20260905154500_fix_exchange_effective_month_materialization.sql.
-- IMPORTANT: Compare with pg_get_functiondef on the live database before running.
begin;

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
  exchange_enabled boolean;
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
  exchange_enabled := (
    exists (select 1 from public.job_type_schedule_materializations mat
      where mat.job_type_id=target_publication.job_type_id
        and mat.effective_month=make_date(target_publication.year,target_publication.month,1)
        and mat.schedule_change_mode='shift_exchange')
    or coalesce(target_publication.config_snapshot #>> '{jobType,scheduleChangeMode}', 'none') = 'shift_exchange'
    or coalesce(target_job.scheduling_config #>> '{scheduleChangeMode}', 'none') = 'shift_exchange'
  );
  if target_publication.status<>'published' or not exchange_enabled then raise exception 'חילופי משמרות אינם פעילים בלוח זה.'; end if;
  if make_date(target_publication.year,target_publication.month,1) <
    date_trunc('month',(now() at time zone 'Asia/Jerusalem')::date)::date
  then raise exception 'לא ניתן להגיש בקשת חילוף עבור חודש שכבר הסתיים.'; end if;

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

revoke all on function public.create_dynamic_shift_exchange_request(text,uuid,uuid,uuid) from public, anon;
grant execute on function public.create_dynamic_shift_exchange_request(text,uuid,uuid,uuid) to authenticated;

commit;
