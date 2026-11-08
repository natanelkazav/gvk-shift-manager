-- Contacts deletion: separate permission, permanent deletion and minimal audit trail.
insert into public.permissions(permission_key,display_name,description,sort_order)
values ('contacts.delete','מחיקת אנשי קשר','מחיקה לצמיתות של איש קשר מספר הלקוחות.',715)
on conflict(permission_key) do update set display_name=excluded.display_name,description=excluded.description,sort_order=excluded.sort_order;

-- Grant by default only to system administrators; others may be delegated in permissions UI.
insert into public.role_default_permissions(role_name,permission_key)
values ('admin','contacts.delete') on conflict do nothing;

-- Existing administrators need a concrete user grant because contact_has_permission
-- checks user_permissions, not role_default_permissions.
insert into public.user_permissions(user_id,permission_key)
select id,'contacts.delete' from public.profiles where role='admin' and is_active
on conflict do nothing;

create or replace function public.delete_contact_record(requested_contact_id uuid)
returns void language plpgsql security definer set search_path=''
as $$
declare old_record public.contact_records%rowtype;
begin
  if (select auth.uid()) is null or not public.contact_has_permission('contacts.delete') then
    raise exception 'permission denied for contact deletion' using errcode='42501';
  end if;
  select * into old_record from public.contact_records where id=requested_contact_id and is_active for update;
  if not found then raise exception 'contact not found' using errcode='P0002'; end if;
  -- Remove historical contact snapshots as well so personal details are not retained.
  delete from public.contact_changes where contact_id=old_record.id;
  delete from public.contact_records where id=old_record.id;
  -- Minimal audit event: retain only the deleted record identifier, not personal data.
  insert into public.audit_logs(action,actor_user_id,entity_type,entity_id,summary,metadata)
  values('contact.deleted',(select auth.uid()),'contact',old_record.id,'איש קשר נמחק לצמיתות',
    jsonb_build_object('deletionType','permanent'));
end;
$$;
revoke all on function public.delete_contact_record(uuid) from public,anon;
grant execute on function public.delete_contact_record(uuid) to authenticated;
