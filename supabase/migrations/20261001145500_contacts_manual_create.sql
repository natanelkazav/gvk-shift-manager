-- קובץ: supabase/migrations/20261001145500_contacts_manual_create.sql
-- מטרה: הגדרת פעולות מסד נתונים עבור אנשי קשר.
-- מטרות עיקריות:
-- - הגדרת פונקציות: public.create_contact_record.
-- - סדר הפקודות, התנאים וההרשאות בקובץ נשמר כפי שהיה במקור.
-- פונקציית מסד public.create_contact_record: יצירת איש קשר.
create or replace function public.create_contact_record(
  requested_client_id uuid,
  requested_branch_name text,
  requested_role_name text,
  requested_full_name text,
  requested_phone text,
  requested_email text,
  requested_needs_review boolean default false
) returns uuid
language plpgsql security definer set search_path=''
as $$
declare v_id uuid; v_client_name text;
begin
  -- הסתעפות לפי התנאי not public.contact_has_permission('contacts.edit') then raise exception 'not allowed'; end if;.
  if not public.contact_has_permission('contacts.edit') then raise exception 'not allowed'; end if;
  -- הסתעפות לפי התנאי nullif(trim(requested_role_name),'') is null or nullif(trim(requested_full_name),'') is null then raise exception 'name .
  if nullif(trim(requested_role_name),'') is null or nullif(trim(requested_full_name),'') is null then raise exception 'name and role are required'; end if;
  select name into v_client_name from public.contact_clients where id=requested_client_id and is_active;
  -- הסתעפות לפי התנאי v_client_name is null then raise exception 'client not found'; end if;.
  if v_client_name is null then raise exception 'client not found'; end if;
  -- הוספת רשומות ל־public.contact_records בהתאם לקלט ולתנאים להלן.
  insert into public.contact_records(client_id,branch_name,role_name,full_name,phone,email,source_key,change_status,is_active)
  values(requested_client_id,nullif(trim(requested_branch_name),''),trim(requested_role_name),trim(requested_full_name),nullif(trim(requested_phone),''),nullif(trim(requested_email),''),'manual|'||gen_random_uuid()::text,case when requested_needs_review then 'needs_review' else 'new' end,true)
  returning id into v_id;
  -- הוספת רשומות ל־public.contact_changes בהתאם לקלט ולתנאים להלן.
  insert into public.contact_changes(contact_id,client_id,branch_name,role_name,full_name,change_type,after_value,actor_user_id)
  values(v_id,requested_client_id,nullif(trim(requested_branch_name),''),trim(requested_role_name),trim(requested_full_name),case when requested_needs_review then 'needs_review' else 'new' end,jsonb_build_object('fullName',trim(requested_full_name),'phone',nullif(trim(requested_phone),''),'email',nullif(trim(requested_email),'')),auth.uid());
  -- הוספת רשומות ל־public.audit_logs בהתאם לקלט ולתנאים להלן.
  insert into public.audit_logs(action,actor_user_id,entity_type,entity_id,summary,metadata)
  values('contact.created',auth.uid(),'contact',v_id,'נוסף איש קשר ידנית',jsonb_build_object('client',v_client_name,'branch',nullif(trim(requested_branch_name),''),'role',trim(requested_role_name),'fullName',trim(requested_full_name)));
  return v_id;
end $$;
-- הקצאת ההרשאות המפורטות בפקודה לתפקידים המצוינים בה.
grant execute on function public.create_contact_record(uuid,text,text,text,text,text,boolean) to authenticated;
