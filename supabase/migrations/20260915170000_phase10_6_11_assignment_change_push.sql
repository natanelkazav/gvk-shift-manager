-- Phase 10.6.11
-- Push notifications for approved Dynamic shift exchanges and current-month
-- Dynamic published-assignment changes.

begin;

create or replace function public.create_dynamic_assignment_change_notification()
returns trigger
language plpgsql
security definer
set search_path=''
as $function$
declare
  actor uuid := auth.uid();
  publication public.dynamic_schedule_publications%rowtype;
  job public.job_types%rowtype;
  old_user uuid;
  new_user uuid;
  shift_date_value date;
  shift_name_value text;
  start_time_value time;
  end_time_value time;
  notification_id uuid;
  recipient_count integer := 0;
  is_swap_change boolean := false;
begin
  -- Publishing a schedule also inserts assignments. Only notify INSERTs that are
  -- explicit post-publication manager/user edits.
  if tg_op = 'INSERT' and not coalesce(new.manager_edited, false) and new.user_edited_by is null then
    return new;
  end if;

  if tg_op = 'UPDATE' and new.user_id is not distinct from old.user_id then
    return new;
  end if;

  select p.* into publication
  from public.dynamic_schedule_publications p
  where p.id = coalesce(new.publication_id, old.publication_id);

  if publication.id is null or publication.status <> 'published' then
    return coalesce(new, old);
  end if;

  -- Per product rule: assignment-change Push is only for the current month.
  if publication.year <> extract(year from (now() at time zone 'Asia/Jerusalem'))::integer
     or publication.month <> extract(month from (now() at time zone 'Asia/Jerusalem'))::integer then
    return coalesce(new, old);
  end if;

  select jt.* into job
  from public.job_types jt
  where jt.id = publication.job_type_id
    and jt.legacy_role is null;

  if job.id is null then
    return coalesce(new, old);
  end if;

  old_user := case when tg_op in ('UPDATE','DELETE') then old.user_id else null end;
  new_user := case when tg_op in ('UPDATE','INSERT') then new.user_id else null end;
  shift_date_value := coalesce(new.shift_date, old.shift_date);
  shift_name_value := coalesce(new.shift_name, old.shift_name, 'משמרת');
  start_time_value := coalesce(new.start_time, old.start_time);
  end_time_value := coalesce(new.end_time, old.end_time);

  -- Manager-approved exchanges update the assignments before the request row is
  -- marked approved. The exchange trigger below sends one dedicated notification
  -- to both parties, so suppress the generic assignment-change notification here.
  if tg_op = 'UPDATE' then
    select exists (
      select 1
      from public.dynamic_shift_exchange_requests r
      where r.status = 'pending_manager'
        and r.publication_id = publication.id
        and (r.requester_assignment_id = old.id or r.counterparty_assignment_id = old.id)
    ) into is_swap_change;

    if is_swap_change then
      return new;
    end if;
  end if;

  actor := coalesce(actor, new.user_edited_by, old.user_edited_by);
  if actor is null then
    return coalesce(new, old);
  end if;

  insert into public.notifications(
    type, priority, source, title, body, url, data, created_by, expires_at
  ) values (
    'system',
    'important',
    'dynamic_schedule_edit',
    'השיבוץ שלך השתנה',
    concat(
      job.name, ' · ',
      to_char(shift_date_value, 'DD/MM/YYYY'),
      case when start_time_value is not null
        then concat(' · ', to_char(start_time_value, 'HH24:MI'), '–', to_char(end_time_value, 'HH24:MI'))
        else ''
      end,
      '. השיבוץ המעודכן זמין במערכת.'
    ),
    concat('/my-shifts?jobTypeId=', job.id, '&year=', publication.year, '&month=', publication.month),
    jsonb_build_object(
      'workflow','dynamic_schedule',
      'event','assignment_changed',
      'actorUserId',actor,
      'publicationId',publication.id,
      'jobTypeId',job.id,
      'jobTypeName',job.name,
      'assignmentId',coalesce(new.id, old.id),
      'shiftDate',shift_date_value,
      'shiftName',shift_name_value,
      'startTime',start_time_value,
      'endTime',end_time_value,
      'oldUserId',old_user,
      'newUserId',new_user,
      'pushPending',true
    ),
    actor,
    now() + interval '90 days'
  ) returning id into notification_id;

  insert into public.notification_recipients(notification_id,user_id)
  select notification_id, candidate.user_id
  from (
    select old_user as user_id
    union
    select new_user as user_id
  ) candidate
  join public.profiles p on p.id = candidate.user_id and p.is_active = true
  where candidate.user_id is not null
    and candidate.user_id <> actor;

  get diagnostics recipient_count = row_count;

  if recipient_count = 0 then
    delete from public.notifications where id = notification_id;
  end if;

  return coalesce(new, old);
end;
$function$;

drop trigger if exists dynamic_assignment_change_notification_trg
on public.dynamic_schedule_published_assignments;

create trigger dynamic_assignment_change_notification_trg
after insert or update of user_id or delete
on public.dynamic_schedule_published_assignments
for each row execute function public.create_dynamic_assignment_change_notification();


create or replace function public.create_dynamic_exchange_approval_notification()
returns trigger
language plpgsql
security definer
set search_path=''
as $function$
declare
  actor uuid;
  job_name text;
  notification_id uuid;
  recipient_count integer := 0;
begin
  if tg_op <> 'UPDATE'
     or new.status <> 'approved'
     or old.status = 'approved' then
    return new;
  end if;

  actor := coalesce(new.manager_user_id, auth.uid());
  if actor is null then return new; end if;

  select jt.name into job_name
  from public.job_types jt
  where jt.id = new.job_type_id
    and jt.legacy_role is null;

  if job_name is null then return new; end if;

  insert into public.notifications(
    type, priority, source, title, body, url, data, created_by, expires_at
  ) values (
    'shift_swap',
    'important',
    'shift_swap',
    'חילוף המשמרות אושר',
    concat('החילוף בתפקיד ', job_name, ' אושר סופית והשיבוץ עודכן.'),
    '/shift-swaps',
    jsonb_build_object(
      'workflow','shift_swap',
      'event','manager_approved',
      'actorUserId',actor,
      'shiftSwapRequestId',new.id,
      'jobTypeId',new.job_type_id,
      'publicationId',new.publication_id,
      'requesterUserId',new.requester_user_id,
      'counterpartyUserId',new.counterparty_user_id,
      'pushPending',true
    ),
    actor,
    now() + interval '90 days'
  ) returning id into notification_id;

  insert into public.notification_recipients(notification_id,user_id)
  select notification_id, candidate.user_id
  from (
    select new.requester_user_id as user_id
    union
    select new.counterparty_user_id as user_id
  ) candidate
  join public.profiles p on p.id = candidate.user_id and p.is_active = true
  where candidate.user_id is not null
    and candidate.user_id <> actor;

  get diagnostics recipient_count = row_count;

  if recipient_count = 0 then
    delete from public.notifications where id = notification_id;
  end if;

  return new;
end;
$function$;

drop trigger if exists dynamic_exchange_approval_notification_trg
on public.dynamic_shift_exchange_requests;

create trigger dynamic_exchange_approval_notification_trg
after update of status
on public.dynamic_shift_exchange_requests
for each row execute function public.create_dynamic_exchange_approval_notification();


create or replace function public.get_my_pending_operational_push_notifications()
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  actor uuid := auth.uid();
begin
  if actor is null then raise exception 'not authenticated'; end if;

  return coalesce((
    select jsonb_agg(n.id order by n.created_at)
    from public.notifications n
    where n.created_by = actor
      and n.source in ('dynamic_schedule_edit','shift_swap')
      and coalesce((n.data->>'pushPending')::boolean,false) = true
      and n.created_at >= now() - interval '15 minutes'
  ), '[]'::jsonb);
end;
$function$;

create or replace function public.mark_my_operational_push_dispatched(requested_notification_id uuid)
returns void
language plpgsql
security definer
set search_path=''
as $function$
declare
  actor uuid := auth.uid();
begin
  if actor is null then raise exception 'not authenticated'; end if;

  update public.notifications n
  set data = jsonb_set(
    jsonb_set(coalesce(n.data,'{}'::jsonb), '{pushPending}', 'false'::jsonb, true),
    '{pushDispatchedAt}',
    to_jsonb(now()),
    true
  )
  where n.id = requested_notification_id
    and n.created_by = actor
    and n.source in ('dynamic_schedule_edit','shift_swap');
end;
$function$;

revoke all on function public.get_my_pending_operational_push_notifications() from public;
revoke all on function public.mark_my_operational_push_dispatched(uuid) from public;
grant execute on function public.get_my_pending_operational_push_notifications() to authenticated;
grant execute on function public.mark_my_operational_push_dispatched(uuid) to authenticated;

commit;
