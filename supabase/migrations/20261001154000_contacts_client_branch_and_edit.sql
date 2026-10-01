create or replace function public.create_contact_client(requested_name text)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare v_id uuid;
begin
  if not public.contact_has_permission('contacts.edit') then raise exception 'not allowed'; end if;
  if nullif(trim(requested_name),'') is null then raise exception 'client name is required'; end if;
  insert into public.contact_clients(name,is_active,updated_at)
  values(trim(requested_name),true,now())
  on conflict(name) do update set is_active=true,updated_at=now()
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.update_contact_record_v2(
  requested_contact_id uuid,
  requested_client_id uuid,
  requested_branch_name text,
  requested_role_name text,
  requested_full_name text,
  requested_phone text,
  requested_email text,
  requested_needs_review boolean default false
) returns void
language plpgsql
security definer
set search_path=''
as $$
declare o public.contact_records%rowtype;
begin
  if not public.contact_has_permission('contacts.edit') then raise exception 'not allowed'; end if;
  if nullif(trim(requested_role_name),'') is null or nullif(trim(requested_full_name),'') is null then raise exception 'name and role are required'; end if;
  if not exists(select 1 from public.contact_clients where id=requested_client_id and is_active) then raise exception 'client not found'; end if;
  select * into o from public.contact_records where id=requested_contact_id and is_active;
  if o.id is null then raise exception 'contact not found'; end if;

  update public.contact_records set
    client_id=requested_client_id,
    branch_name=nullif(trim(requested_branch_name),''),
    role_name=trim(requested_role_name),
    full_name=trim(requested_full_name),
    phone=nullif(trim(requested_phone),''),
    email=nullif(trim(requested_email),''),
    change_status=case when requested_needs_review then 'needs_review' else 'updated' end,
    updated_at=now()
  where id=requested_contact_id;

  insert into public.contact_changes(contact_id,client_id,branch_name,role_name,full_name,change_type,before_value,after_value,actor_user_id)
  values(o.id,requested_client_id,nullif(trim(requested_branch_name),''),trim(requested_role_name),trim(requested_full_name),'updated',
    jsonb_build_object('clientId',o.client_id,'branchName',o.branch_name,'roleName',o.role_name,'fullName',o.full_name,'phone',o.phone,'email',o.email),
    jsonb_build_object('clientId',requested_client_id,'branchName',nullif(trim(requested_branch_name),''),'roleName',trim(requested_role_name),'fullName',trim(requested_full_name),'phone',nullif(trim(requested_phone),''),'email',nullif(trim(requested_email),'')),auth.uid());
end $$;

grant execute on function public.create_contact_client(text), public.update_contact_record_v2(uuid,uuid,text,text,text,text,text,boolean) to authenticated;
