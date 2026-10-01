-- Generic contacts directory. Osher Ad is the first import adapter; the data model is client-agnostic.
create table if not exists public.contact_clients(id uuid primary key default gen_random_uuid(), name text not null unique, is_active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists public.contact_records(id uuid primary key default gen_random_uuid(), client_id uuid not null references public.contact_clients(id), branch_name text, role_name text not null, full_name text not null, phone text, email text, source_key text not null, change_status text not null default 'new' check(change_status in('current','new','updated','needs_review')), is_active boolean not null default true, last_import_id uuid, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(client_id,source_key));
create table if not exists public.contact_imports(id uuid primary key default gen_random_uuid(), client_id uuid not null references public.contact_clients(id), file_name text not null, actor_user_id uuid references public.profiles(id), imported_count int not null default 0, added_count int not null default 0, updated_count int not null default 0, unchanged_count int not null default 0, needs_review_count int not null default 0, created_at timestamptz not null default now());
alter table public.contact_records drop constraint if exists contact_records_last_import_id_fkey;
alter table public.contact_records add constraint contact_records_last_import_id_fkey foreign key(last_import_id) references public.contact_imports(id) on delete set null;
create table if not exists public.contact_changes(id uuid primary key default gen_random_uuid(), contact_id uuid references public.contact_records(id) on delete set null, client_id uuid not null references public.contact_clients(id), import_id uuid references public.contact_imports(id) on delete set null, branch_name text, role_name text not null, full_name text not null, change_type text not null, before_value jsonb, after_value jsonb, actor_user_id uuid references public.profiles(id), created_at timestamptz not null default now());
create table if not exists public.employee_contact_details(user_id uuid primary key references public.profiles(id) on delete cascade, phone text, updated_at timestamptz not null default now());
insert into public.contact_clients(name) values('אושר עד') on conflict(name) do nothing;

create or replace function public.contact_has_permission(k text) returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.user_permissions u where u.user_id=auth.uid() and u.permission_key=k) $$;

create or replace function public.get_contact_clients() returns jsonb language sql security definer set search_path='' as $$ select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name) order by name),'[]'::jsonb) from public.contact_clients where is_active and public.contact_has_permission('contacts.view') $$;
create or replace function public.get_contacts_directory(requested_client_id uuid default null) returns jsonb language sql security definer set search_path='' as $$ select case when not public.contact_has_permission('contacts.view') then '[]'::jsonb else coalesce(jsonb_agg(jsonb_build_object('id',r.id,'client_id',r.client_id,'client_name',c.name,'branch_name',r.branch_name,'role_name',r.role_name,'full_name',r.full_name,'phone',r.phone,'email',r.email,'change_status',r.change_status,'is_active',r.is_active,'updated_at',r.updated_at) order by c.name,r.branch_name,r.role_name),'[]'::jsonb) end from public.contact_records r join public.contact_clients c on c.id=r.client_id where r.is_active and (requested_client_id is null or r.client_id=requested_client_id) $$;
create or replace function public.get_employee_contact_directory() returns jsonb language sql security definer set search_path='' as $$
  with employee_rows as (
    select
      p.id,
      p.display_name,
      p.schedule_name,
      coalesce(roles.role_label, p.role::text) as role_label,
      ecd.phone
    from public.profiles p
    left join public.employee_contact_details ecd on ecd.user_id = p.id
    left join lateral (
      select string_agg(distinct jt.name, ', ' order by jt.name) as role_label
      from public.job_type_memberships m
      join public.job_types jt on jt.id = m.job_type_id
      where m.user_id = p.id
    ) roles on true
    where p.is_active
  )
  select case
    when not public.contact_has_permission('contacts.view') then '[]'::jsonb
    else coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', id,
          'display_name', display_name,
          'schedule_name', schedule_name,
          'role_label', role_label,
          'phone', phone
        ) order by display_name
      ),
      '[]'::jsonb
    )
  end
  from employee_rows
$$;

create or replace function public.import_contact_rows(requested_client_name text, requested_file_name text, requested_rows jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_client uuid; v_import uuid; x jsonb; v_key text; old public.contact_records%rowtype; v_added int:=0;v_updated int:=0;v_same int:=0;v_review int:=0; branches text[]:=array[]::text[]; v_status text;
begin
 if not public.contact_has_permission('contacts.import') then raise exception 'not allowed'; end if;
 insert into public.contact_clients(name) values(trim(requested_client_name)) on conflict(name) do update set is_active=true returning id into v_client;
 insert into public.contact_imports(client_id,file_name,actor_user_id) values(v_client,requested_file_name,auth.uid()) returning id into v_import;
 for x in select value from jsonb_array_elements(coalesce(requested_rows,'[]'::jsonb)) loop
  v_key:=coalesce(nullif(trim(x->>'branchName'),''),'__general__')||'|'||trim(x->>'roleName');
  select * into old from public.contact_records where client_id=v_client and source_key=v_key;
  if coalesce((x->>'needsReview')::boolean,false) then v_status:='needs_review';v_review:=v_review+1;
  elsif old.id is null then v_status:='new';v_added:=v_added+1;
  elsif old.full_name is distinct from trim(x->>'fullName') or old.phone is distinct from nullif(trim(x->>'phone'),'') or old.email is distinct from nullif(trim(x->>'email'),'') then v_status:='updated';v_updated:=v_updated+1;
  else v_status:='current';v_same:=v_same+1; end if;
  insert into public.contact_records(client_id,branch_name,role_name,full_name,phone,email,source_key,change_status,last_import_id)
  values(v_client,nullif(trim(x->>'branchName'),''),trim(x->>'roleName'),trim(x->>'fullName'),nullif(trim(x->>'phone'),''),nullif(trim(x->>'email'),''),v_key,v_status,v_import)
  on conflict(client_id,source_key) do update set branch_name=excluded.branch_name,role_name=excluded.role_name,full_name=excluded.full_name,phone=excluded.phone,email=excluded.email,change_status=excluded.change_status,last_import_id=v_import,is_active=true,updated_at=now();
  if v_status in('new','updated','needs_review') then insert into public.contact_changes(contact_id,client_id,import_id,branch_name,role_name,full_name,change_type,before_value,after_value,actor_user_id) select r.id,v_client,v_import,r.branch_name,r.role_name,r.full_name,v_status,case when old.id is null then null else jsonb_build_object('fullName',old.full_name,'phone',old.phone,'email',old.email) end,jsonb_build_object('fullName',r.full_name,'phone',r.phone,'email',r.email),auth.uid() from public.contact_records r where r.client_id=v_client and r.source_key=v_key; end if;
  if nullif(trim(x->>'branchName'),'') is not null and not (trim(x->>'branchName')=any(branches)) then branches:=array_append(branches,trim(x->>'branchName'));end if;
 end loop;
 update public.contact_imports set imported_count=jsonb_array_length(requested_rows),added_count=v_added,updated_count=v_updated,unchanged_count=v_same,needs_review_count=v_review where id=v_import;
 insert into public.audit_logs(action,actor_user_id,entity_type,entity_id,summary,metadata) values('contacts.imported',auth.uid(),'contact_import',v_import,'יובא קובץ אנשי קשר',jsonb_build_object('client',requested_client_name,'file',requested_file_name,'added',v_added,'updated',v_updated,'needsReview',v_review));
 return jsonb_build_object('imported',jsonb_array_length(requested_rows),'added',v_added,'updated',v_updated,'unchanged',v_same,'needsReview',v_review,'affectedBranches',to_jsonb(branches));
end $$;
create or replace function public.update_contact_record(requested_contact_id uuid,requested_full_name text,requested_phone text,requested_email text) returns void language plpgsql security definer set search_path='' as $$ declare o public.contact_records%rowtype; begin if not public.contact_has_permission('contacts.edit') then raise exception 'not allowed';end if; select * into o from public.contact_records where id=requested_contact_id; update public.contact_records set full_name=trim(requested_full_name),phone=nullif(trim(requested_phone),''),email=nullif(trim(requested_email),''),change_status='updated',updated_at=now() where id=requested_contact_id; insert into public.contact_changes(contact_id,client_id,branch_name,role_name,full_name,change_type,before_value,after_value,actor_user_id) values(o.id,o.client_id,o.branch_name,o.role_name,trim(requested_full_name),'updated',jsonb_build_object('fullName',o.full_name,'phone',o.phone,'email',o.email),jsonb_build_object('fullName',trim(requested_full_name),'phone',requested_phone,'email',requested_email),auth.uid()); end $$;
create or replace function public.get_recent_contact_changes() returns jsonb language sql security definer set search_path='' as $$ select case when not public.contact_has_permission('contacts.changes_view') then '[]'::jsonb else coalesce(jsonb_agg(jsonb_build_object('id',x.id,'client_name',c.name,'branch_name',x.branch_name,'role_name',x.role_name,'full_name',x.full_name,'change_type',x.change_type,'created_at',x.created_at) order by x.created_at desc),'[]'::jsonb) end from (select * from public.contact_changes where created_at>=now()-interval '30 days' order by created_at desc limit 30)x join public.contact_clients c on c.id=x.client_id $$;
grant execute on function public.get_contact_clients(),public.get_contacts_directory(uuid),public.get_employee_contact_directory(),public.import_contact_rows(text,text,jsonb),public.update_contact_record(uuid,text,text,text),public.get_recent_contact_changes() to authenticated;
-- Register the contacts permissions in the system permission catalog before assigning them.
insert into public.permissions(permission_key, display_name, description, sort_order)
values
  ('contacts.view','צפייה באנשי קשר','צפייה בטאב אנשי קשר ושימוש בחיוג, WhatsApp ומייל.',700),
  ('contacts.edit','עריכת אנשי קשר','עריכה ידנית של פרטי איש קשר.',710),
  ('contacts.import','ייבוא אנשי קשר','העלאת קובץ Excel ועדכון ספר אנשי הקשר.',720),
  ('contacts.changes_view','צפייה בשינויי אנשי קשר','צפייה באנשי קשר חדשים או מעודכנים ובסיכום השינויים.',730)
on conflict (permission_key) do update set
  display_name=excluded.display_name,
  description=excluded.description,
  sort_order=excluded.sort_order;

-- System administrators receive the new permissions by default.
insert into public.role_default_permissions(role_name, permission_key)
select 'admin', p.permission_key
from (values('contacts.view'),('contacts.edit'),('contacts.import'),('contacts.changes_view')) p(permission_key)
on conflict do nothing;

insert into public.permission_profile_permissions(profile_id, permission_key)
select pp.id, p.permission_key
from public.permission_profiles pp
cross join (values('contacts.view'),('contacts.edit'),('contacts.import'),('contacts.changes_view')) p(permission_key)
where pp.code='system_admin'
on conflict do nothing;

-- Bootstrap contact management for existing user administrators. They can then delegate each permission independently.
insert into public.user_permissions(user_id,permission_key)
select distinct up.user_id,p.permission_key
from public.user_permissions up
cross join (values('contacts.view'),('contacts.edit'),('contacts.import'),('contacts.changes_view')) p(permission_key)
where up.permission_key='users.manage'
on conflict do nothing;
create or replace function public.update_employee_contact_phone(requested_user_id uuid,requested_phone text) returns void language plpgsql security definer set search_path='' as $$ begin if not public.contact_has_permission('contacts.edit') then raise exception 'not allowed';end if; insert into public.employee_contact_details(user_id,phone,updated_at) values(requested_user_id,nullif(trim(requested_phone),''),now()) on conflict(user_id) do update set phone=excluded.phone,updated_at=now(); insert into public.audit_logs(action,actor_user_id,user_id,entity_type,entity_id,summary,metadata) values('contact.updated',auth.uid(),requested_user_id,'employee_contact',requested_user_id,'עודכן מספר טלפון של עובד',jsonb_build_object('phone',requested_phone)); end $$;
grant execute on function public.update_employee_contact_phone(uuid,text) to authenticated;
