-- Apply after the personal rotation assignment migration.
-- Requires job_type_configuration_versions and the versioned rotationExchangeEnabled flag.
-- Existing jobs default to counterparty_then_manager.
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
  approval_mode text;
begin
  if current_user_id is null then raise exception 'not authenticated'; end if;
  select * into r from public.dynamic_shift_exchange_requests where id=requested_request_id for update;
  if r.id is null then raise exception 'הבקשה לא נמצאה.'; end if;
  if r.counterparty_user_id<>current_user_id then raise exception 'רק העובד שהתבקש להחליף יכול להגיב.'; end if;
  if r.status<>'pending_counterparty' then raise exception 'הבקשה אינה ממתינה לתגובה.'; end if;

  -- Load the assignment BEFORE resolving the version effective for its month.
  -- The prior migration read ra.shift_date before assigning ra, resulting in
  -- a NULL effective month and silently falling back to manager approval.
  select * into ra
  from public.dynamic_schedule_published_assignments
  where id = r.requester_assignment_id and publication_id = r.publication_id;
  if ra.id is null then
    raise exception 'השיבוץ המקורי אינו קיים בפרסום של הבקשה.';
  end if;

  select case
    when coalesce((v.snapshot->'schedulingConfig'->>'rotationExchangeEnabled')::boolean, false)
      and v.snapshot->>'schedulingStrategy' = 'monthly_rotation_constraints'
      and v.snapshot->'schedulingConfig'->>'scheduleChangeMode' = 'shift_exchange'
      then 'counterparty_only'
    else 'counterparty_then_manager'
  end into approval_mode
  from public.job_type_configuration_versions v
  where v.job_type_id = r.job_type_id
    and v.effective_month <= date_trunc('month', ra.shift_date)::date
  order by v.effective_month desc
  limit 1;

  -- Fail closed for absent or older configuration versions.
  approval_mode := coalesce(approval_mode, 'counterparty_then_manager');

  if requested_approve then
    select * into ra from public.dynamic_schedule_published_assignments where id=r.requester_assignment_id and publication_id=r.publication_id;
    if ra.id is null or ra.user_id<>r.requester_user_id or public.dynamic_assignment_starts_at(ra)<=now() then raise exception 'השיבוץ המקורי השתנה או כבר התחיל.'; end if;
    if r.swap_type='two_way' then
      select * into ca from public.dynamic_schedule_published_assignments where id=r.counterparty_assignment_id and publication_id=r.publication_id;
      if ca.id is null or ca.user_id<>r.counterparty_user_id or public.dynamic_assignment_starts_at(ca)<=now() then raise exception 'השיבוץ הנגדי השתנה או כבר התחיל.'; end if;
    end if;
    if public.dynamic_user_has_overlap(r.publication_id,r.counterparty_user_id,ra.id,case when r.swap_type='two_way' then ca.id else null end) then raise exception 'ההחלפה תיצור משמרות חופפות.'; end if;
    if r.swap_type='two_way' and public.dynamic_user_has_overlap(r.publication_id,r.requester_user_id,ca.id,ra.id) then raise exception 'ההחלפה תיצור משמרות חופפות.'; end if;
    if approval_mode = 'counterparty_only' then
      -- Lock the assignments before committing the swap. Re-check the owners
      -- after locks to protect against a concurrent schedule edit.
      select * into ra from public.dynamic_schedule_published_assignments where id=r.requester_assignment_id and publication_id=r.publication_id for update;
      if ra.id is null or ra.user_id<>r.requester_user_id or public.dynamic_assignment_starts_at(ra)<=now() then raise exception 'השיבוץ המקורי השתנה או כבר התחיל.'; end if;
      if r.swap_type='two_way' then
        select * into ca from public.dynamic_schedule_published_assignments where id=r.counterparty_assignment_id and publication_id=r.publication_id for update;
        if ca.id is null or ca.user_id<>r.counterparty_user_id or public.dynamic_assignment_starts_at(ca)<=now() then raise exception 'השיבוץ הנגדי השתנה או כבר התחיל.'; end if;
      end if;
      if public.dynamic_user_has_overlap(r.publication_id,r.counterparty_user_id,ra.id,case when r.swap_type='two_way' then ca.id else null end) then raise exception 'ההחלפה תיצור משמרות חופפות.'; end if;
      if r.swap_type='two_way' and public.dynamic_user_has_overlap(r.publication_id,r.requester_user_id,ca.id,ra.id) then raise exception 'ההחלפה תיצור משמרות חופפות.'; end if;
      update public.dynamic_schedule_published_assignments set user_id=r.counterparty_user_id,user_edited_by=current_user_id,user_edited_at=now() where id=ra.id;
      if r.swap_type='two_way' then
        update public.dynamic_schedule_published_assignments set user_id=r.requester_user_id,user_edited_by=current_user_id,user_edited_at=now() where id=ca.id;
      end if;
      update public.dynamic_shift_exchange_requests set status='approved',counterparty_responded_at=now(),rejection_reason=null,updated_at=now() where id=r.id returning * into r;
      insert into public.audit_logs(action,actor_user_id,entity_type,entity_id,summary,metadata)
      values('shift_swap_counterparty_approved',current_user_id,'dynamic_shift_exchange_request',r.id,'המחליף אישר וההחלפה בוצעה לפי מדיניות התפקיד',jsonb_build_object('approval_mode',approval_mode,'job_type_id',r.job_type_id));
    else
      update public.dynamic_shift_exchange_requests set status='pending_manager',counterparty_responded_at=now(),rejection_reason=null,updated_at=now() where id=r.id returning * into r;
      insert into public.audit_logs(action,actor_user_id,entity_type,entity_id,summary,metadata)
      values('shift_swap_counterparty_approved',current_user_id,'dynamic_shift_exchange_request',r.id,'הצד השני אישר בקשת חילופים דינמית','{}'::jsonb);
    end if;
  else
    update public.dynamic_shift_exchange_requests set status='rejected_by_counterparty',counterparty_responded_at=now(),rejection_reason=nullif(trim(coalesce(requested_rejection_reason,'')) ,''),updated_at=now() where id=r.id returning * into r;
    insert into public.audit_logs(action,actor_user_id,entity_type,entity_id,summary,metadata)
    values('shift_swap_counterparty_rejected',current_user_id,'dynamic_shift_exchange_request',r.id,'הצד השני דחה בקשת חילופים דינמית','{}'::jsonb);
  end if;
  return jsonb_build_object('id',r.id,'status',r.status);
end;
$function$;
