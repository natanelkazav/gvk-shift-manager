begin;

-- Keep an already-open availability period aligned with a role definition that
-- is re-saved for the same effective month. A structural change invalidates the
-- old answers because slot ids/times may have changed, so submitted users are
-- returned to draft and receive an operational Push notification.
create or replace function public.sync_open_dynamic_availability_after_role_version_change()
returns trigger
language plpgsql
security definer
set search_path=''
as $function$
declare
  target_period public.dynamic_availability_periods%rowtype;
  affected_user uuid;
  notification_id uuid;
  rebuilt_slots integer := 0;
  target_year integer := extract(year from new.effective_month)::integer;
  target_month integer := extract(month from new.effective_month)::integer;
begin
  select ap.* into target_period
  from public.dynamic_availability_periods ap
  where ap.job_type_id = new.job_type_id
    and ap.year = target_year
    and ap.month = target_month
    and ap.status = 'open'
  limit 1;

  if target_period.id is null then
    return new;
  end if;

  -- Notify only people who had actually completed/submitted the previous form.
  -- Keep the ids before changing their state.
  for affected_user in
    select s.user_id
    from public.dynamic_availability_submissions s
    where s.period_id = target_period.id
      and s.status = 'submitted'
  loop
    insert into public.notifications(
      type, priority, source, title, body, url, data, created_by, expires_at
    ) values (
      'system',
      'important',
      'dynamic_availability_definition_changed',
      'תקופת האילוצים עודכנה',
      concat(
        coalesce(new.snapshot->>'name','התפקיד'),
        ' · מבנה המשמרות לחודש ',
        lpad(target_month::text,2,'0'),'/',target_year,
        ' השתנה. ההגשה הקודמת הוחזרה לטיוטה ויש למלא ולאשר את האילוצים מחדש.'
      ),
      '/my-availability',
      jsonb_build_object(
        'workflow','dynamic_availability',
        'event','role_definition_changed',
        'jobTypeId',new.job_type_id,
        'periodId',target_period.id,
        'year',target_year,
        'month',target_month,
        'recipientUserId',affected_user,
        'pushPending',true
      ),
      coalesce(auth.uid(), new.created_by),
      now() + interval '90 days'
    ) returning id into notification_id;

    insert into public.notification_recipients(notification_id,user_id)
    values(notification_id,affected_user)
    on conflict do nothing;
  end loop;

  -- Old entries point at the old slot structure. Removing the slots cascades
  -- those entries, then the canonical materializer rebuilds the period from the
  -- just-saved effective role snapshot.
  delete from public.dynamic_availability_slots
  where period_id = target_period.id;

  update public.dynamic_availability_submissions s
  set status='draft', submitted_at=null, updated_at=now()
  where s.period_id=target_period.id
    and s.status in ('submitted','reopened');

  rebuilt_slots := public.materialize_dynamic_availability_period_slots(target_period.id);

  update public.dynamic_availability_periods ap
  set config_snapshot=coalesce(new.snapshot->'availabilityConfig',ap.config_snapshot),
      updated_at=now()
  where ap.id=target_period.id;

  return new;
end;
$function$;

revoke all on function public.sync_open_dynamic_availability_after_role_version_change() from public;

-- PostgreSQL runs same-event triggers alphabetically. The z_ prefix guarantees
-- that the existing materialize_dynamic_job_type_version trigger has finished
-- rebuilding the effective role materialization before we rebuild open slots.
drop trigger if exists z_sync_open_dynamic_availability_after_role_version_change
  on public.job_type_configuration_versions;
create trigger z_sync_open_dynamic_availability_after_role_version_change
after insert or update of snapshot,effective_month
on public.job_type_configuration_versions
for each row execute function public.sync_open_dynamic_availability_after_role_version_change();

commit;
