-- Phase 10.9 — Dynamic Daily Reports
-- Generic Job Type capability: employees submit structured daily activity reports
-- to configured recipients. Subjects are scoped to Job Type; customers are shared.

begin;

create table if not exists public.daily_report_subjects (
  id uuid primary key default gen_random_uuid(),
  job_type_id uuid not null references public.job_types(id) on delete cascade,
  name text not null,
  is_active boolean not null default true,
  created_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(job_type_id, name)
);

create table if not exists public.daily_report_customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  normalized_name text generated always as (lower(trim(name))) stored,
  is_active boolean not null default true,
  created_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(normalized_name)
);

create table if not exists public.daily_reports (
  id uuid primary key default gen_random_uuid(),
  job_type_id uuid not null references public.job_types(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  report_date date not null,
  status text not null default 'submitted' check(status in ('draft','submitted')),
  submitted_at timestamptz null,
  updated_at timestamptz not null default now(),
  unique(job_type_id, user_id, report_date)
);

create table if not exists public.daily_report_items (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.daily_reports(id) on delete cascade,
  subject_id uuid null references public.daily_report_subjects(id) on delete set null,
  subject_name text not null,
  customer_id uuid null references public.daily_report_customers(id) on delete set null,
  customer_name text null,
  details text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists daily_reports_user_date_idx
  on public.daily_reports(user_id, report_date desc);
create index if not exists daily_reports_job_type_date_idx
  on public.daily_reports(job_type_id, report_date desc);

alter table public.daily_report_subjects enable row level security;
alter table public.daily_report_customers enable row level security;
alter table public.daily_reports enable row level security;
alter table public.daily_report_items enable row level security;

revoke all on public.daily_report_subjects from anon, authenticated;
revoke all on public.daily_report_customers from anon, authenticated;
revoke all on public.daily_reports from anon, authenticated;
revoke all on public.daily_report_items from anon, authenticated;

insert into public.dynamic_permission_manifest
  (feature_key, permission_key, audience, label, description, default_enabled, sort_order)
values
  ('daily_reports','daily_reports.submit','member','שליחת דיווח יומי','יצירה ושליחה של דיווח העבודה היומי.',true,10),
  ('daily_reports','daily_reports.add_subject','member','הוספת נושא לדיווח','הוספת נושא חדש לרשימת הנושאים של התפקיד.',true,20),
  ('daily_reports','daily_reports.add_customer','member','הוספת לקוח','הוספת לקוח חדש לרשימת הלקוחות המשותפת.',true,30),
  ('daily_reports','daily_reports.view_received','manager','צפייה בדיווחים שהתקבלו','צפייה בדיווחים היומיים שנשלחו עבור התפקיד.',true,10),
  ('daily_reports','daily_reports.manage_subjects','manager','ניהול נושאי דיווח','ניהול רשימת הנושאים הזמינה לעובדי התפקיד.',true,20),
  ('daily_reports','daily_reports.manage_customers','manager','ניהול לקוחות','ניהול רשימת הלקוחות המשותפת לדיווחים.',true,30)
on conflict(feature_key, permission_key, audience) do update
set label=excluded.label,
    description=excluded.description,
    default_enabled=excluded.default_enabled,
    sort_order=excluded.sort_order;

-- Extend active-feature derivation with the new generic capability.
create or replace function public.get_dynamic_job_type_active_features(requested_job_type_id uuid)
returns text[]
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  jt public.job_types%rowtype;
  features text[] := array['schedule']::text[];
  change_mode text;
begin
  select * into jt from public.job_types where id=requested_job_type_id;
  if not found then return array[]::text[]; end if;

  if coalesce((jt.availability_config->>'enabled')::boolean,false) then
    features:=array_append(features,'availability');
  end if;

  change_mode:=coalesce(jt.scheduling_config->>'scheduleChangeMode','none');
  if change_mode='shift_exchange' then
    features:=array_append(features,'shift_exchange');
  elsif change_mode='self_edit' then
    features:=array_append(features,'self_edit');
  end if;

  if jt.scheduling_strategy='monthly_rotation_constraints' then
    features:=array_append(features,'monthly_rotation');
  end if;
  if coalesce((jt.statistics_config->>'enabled')::boolean,false) then
    features:=array_append(features,'statistics');
  end if;
  if coalesce(jt.pay_model,'none')<>'none' then
    features:=array_append(features,'payroll');
  end if;
  if exists(
    select 1 from public.job_type_capabilities c
    where c.job_type_id=jt.id and c.capability_key='daily_reports' and c.enabled=true
  ) or coalesce((jt.scheduling_config#>>'{dailyReports,enabled}')::boolean,false) then
    features:=array_append(features,'daily_reports');
  end if;

  return (select array_agg(distinct x order by x) from unnest(features) x);
end;
$$;

create or replace function public.get_daily_report_admin_options()
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare actor uuid:=auth.uid();
begin
  if actor is null then raise exception 'not authenticated'; end if;
  if not exists(
    select 1 from public.profiles p
    where p.id=actor and p.is_active=true
      and (p.role='admin' or exists(
        select 1 from public.user_permissions up
        where up.user_id=actor and up.permission_key='users.manage'
      ))
  ) then raise exception 'not allowed'; end if;

  return jsonb_build_object(
    'users', coalesce((
      select jsonb_agg(jsonb_build_object(
        'userId',p.id,'displayName',p.display_name,'email',p.email
      ) order by p.display_name)
      from public.profiles p where p.is_active=true
    ),'[]'::jsonb)
  );
end;
$$;

create or replace function public.get_my_daily_report_workspace()
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  actor uuid:=auth.uid();
  today_il date:=(now() at time zone 'Asia/Jerusalem')::date;
begin
  if actor is null then raise exception 'not authenticated'; end if;

  return jsonb_build_object(
    'today',today_il,
    'customers',coalesce((
      select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name) order by c.name)
      from public.daily_report_customers c where c.is_active=true
    ),'[]'::jsonb),
    'roles',coalesce((
      select jsonb_agg(jsonb_build_object(
        'jobTypeId',jt.id,
        'jobTypeName',jt.name,
        'allowAddSubjects',coalesce((jt.scheduling_config#>>'{dailyReports,allowAddSubjects}')::boolean,true),
        'allowAddCustomers',coalesce((jt.scheduling_config#>>'{dailyReports,allowAddCustomers}')::boolean,true),
        'subjects',coalesce((
          select jsonb_agg(jsonb_build_object('id',s.id,'name',s.name) order by s.name)
          from public.daily_report_subjects s
          where s.job_type_id=jt.id and s.is_active=true
        ),'[]'::jsonb),
        'todayReport',(
          select jsonb_build_object(
            'id',r.id,'status',r.status,'submittedAt',r.submitted_at,
            'itemCount',(select count(*) from public.daily_report_items i where i.report_id=r.id)
          )
          from public.daily_reports r
          where r.job_type_id=jt.id and r.user_id=actor and r.report_date=today_il
        ),
        'recentReports',coalesce((
          select jsonb_agg(x.obj order by x.report_date desc)
          from (
            select r.report_date,jsonb_build_object(
              'id',r.id,'reportDate',r.report_date,'status',r.status,
              'submittedAt',r.submitted_at,
              'itemCount',(select count(*) from public.daily_report_items i where i.report_id=r.id)
            ) obj
            from public.daily_reports r
            where r.job_type_id=jt.id and r.user_id=actor
            order by r.report_date desc limit 7
          ) x
        ),'[]'::jsonb)
      ) order by m.is_primary desc,jt.name)
      from public.job_type_memberships m
      join public.job_types jt on jt.id=m.job_type_id
      where m.user_id=actor and jt.is_active=true and jt.legacy_role is null
        and (
          exists(select 1 from public.job_type_capabilities c where c.job_type_id=jt.id and c.capability_key='daily_reports' and c.enabled=true)
          or coalesce((jt.scheduling_config#>>'{dailyReports,enabled}')::boolean,false)
        )
        and public.has_dynamic_job_type_permission('daily_reports.submit',jt.id,actor)
    ),'[]'::jsonb)
  );
end;
$$;

create or replace function public.add_daily_report_subject(
  requested_job_type_id uuid,
  requested_name text
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare actor uuid:=auth.uid(); target_id uuid; target_name text:=trim(coalesce(requested_name,''));
begin
  if actor is null then raise exception 'not authenticated'; end if;
  if target_name='' then raise exception 'subject name is required'; end if;
  if not public.has_dynamic_job_type_permission('daily_reports.add_subject',requested_job_type_id,actor)
     and not public.has_dynamic_job_type_permission('daily_reports.manage_subjects',requested_job_type_id,actor)
  then raise exception 'not allowed'; end if;

  insert into public.daily_report_subjects(job_type_id,name,created_by)
  values(requested_job_type_id,target_name,actor)
  on conflict(job_type_id,name) do update set is_active=true
  returning id into target_id;

  return jsonb_build_object('id',target_id,'name',target_name);
end;
$$;

create or replace function public.add_daily_report_customer(requested_name text)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare actor uuid:=auth.uid(); target_id uuid; target_name text:=trim(coalesce(requested_name,''));
begin
  if actor is null then raise exception 'not authenticated'; end if;
  if target_name='' then raise exception 'customer name is required'; end if;

  if not exists(
    select 1
    from public.job_type_memberships m
    join public.job_types jt on jt.id=m.job_type_id
    where m.user_id=actor and jt.is_active=true and jt.legacy_role is null
      and public.has_dynamic_job_type_permission('daily_reports.add_customer',jt.id,actor)
  ) and not exists(
    select 1 from public.profiles p where p.id=actor and p.role='admin' and p.is_active=true
  ) then raise exception 'not allowed'; end if;

  insert into public.daily_report_customers(name,created_by)
  values(target_name,actor)
  on conflict(normalized_name) do update set is_active=true
  returning id,name into target_id,target_name;

  return jsonb_build_object('id',target_id,'name',target_name);
end;
$$;

create or replace function public.submit_my_daily_report(
  requested_job_type_id uuid,
  requested_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  actor uuid:=auth.uid();
  today_il date:=(now() at time zone 'Asia/Jerusalem')::date;
  report_id uuid;
  item jsonb;
  subject_id_value uuid;
  subject_name_value text;
  customer_id_value uuid;
  customer_name_value text;
  details_value text;
  sort_value integer:=0;
  recipient uuid;
  notification_id uuid;
  notification_ids jsonb:='[]'::jsonb;
  job_name text;
  recipient_ids jsonb;
begin
  if actor is null then raise exception 'not authenticated'; end if;
  if not public.has_dynamic_job_type_permission('daily_reports.submit',requested_job_type_id,actor)
  then raise exception 'not allowed'; end if;
  if jsonb_typeof(requested_items)<>'array' or jsonb_array_length(requested_items)=0
  then raise exception 'at least one report item is required'; end if;

  select jt.name,
         coalesce(jt.scheduling_config#>'{dailyReports,recipientUserIds}','[]'::jsonb)
    into job_name,recipient_ids
  from public.job_types jt
  where jt.id=requested_job_type_id and jt.is_active=true and jt.legacy_role is null;
  if job_name is null then raise exception 'job type not found'; end if;

  insert into public.daily_reports(job_type_id,user_id,report_date,status,submitted_at,updated_at)
  values(requested_job_type_id,actor,today_il,'submitted',now(),now())
  on conflict(job_type_id,user_id,report_date) do update
  set status='submitted',submitted_at=now(),updated_at=now()
  returning id into report_id;

  delete from public.daily_report_items i where i.report_id=report_id;

  for item in select value from jsonb_array_elements(requested_items) loop
    sort_value:=sort_value+1;
    subject_id_value:=nullif(item->>'subjectId','')::uuid;
    subject_name_value:=trim(coalesce(item->>'subjectName',''));
    customer_id_value:=nullif(item->>'customerId','')::uuid;
    customer_name_value:=nullif(trim(coalesce(item->>'customerName','')),'');
    details_value:=trim(coalesce(item->>'details',''));

    if subject_name_value='' or details_value='' then
      raise exception 'subject and details are required';
    end if;

    insert into public.daily_report_items(
      report_id,subject_id,subject_name,customer_id,customer_name,details,sort_order
    ) values(
      report_id,subject_id_value,subject_name_value,customer_id_value,customer_name_value,details_value,sort_value
    );
  end loop;

  for recipient in
    select distinct value::text::uuid
    from jsonb_array_elements_text(recipient_ids)
  loop
    if exists(select 1 from public.profiles p where p.id=recipient and p.is_active=true) then
      insert into public.notifications(
        type,priority,source,title,body,url,data,created_by,expires_at
      ) values(
        'manager_message','important','daily_report',
        concat('דיווח יומי חדש · ',job_name),
        concat(
          coalesce((select p.display_name from public.profiles p where p.id=actor),'עובד'),
          ' שלח/ה דיווח יומי ל-',to_char(today_il,'DD/MM/YYYY'),
          ' · ',jsonb_array_length(requested_items),' פעילויות.'
        ),
        '/notifications',
        jsonb_build_object(
          'workflow','daily_report','event','submitted',
          'reportId',report_id,'jobTypeId',requested_job_type_id,
          'actorUserId',actor,'recipientUserId',recipient,'pushPending',true
        ),
        actor,now()+interval '90 days'
      ) returning id into notification_id;

      insert into public.notification_recipients(notification_id,user_id)
      values(notification_id,recipient)
      on conflict do nothing;

      notification_ids:=notification_ids||jsonb_build_array(notification_id);
    end if;
  end loop;

  return jsonb_build_object('reportId',report_id,'notificationIds',notification_ids);
end;
$$;

create or replace function public.get_daily_report_notification_detail(requested_report_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare actor uuid:=auth.uid();
begin
  if actor is null then raise exception 'not authenticated'; end if;

  if not exists(
    select 1
    from public.daily_reports r
    join public.job_types jt on jt.id=r.job_type_id
    where r.id=requested_report_id
      and (
        r.user_id=actor
        or (jt.scheduling_config#>'{dailyReports,recipientUserIds}') ? actor::text
        or public.has_dynamic_job_type_permission('daily_reports.view_received',r.job_type_id,actor)
      )
  ) then raise exception 'not allowed'; end if;

  return (
    select jsonb_build_object(
      'id',r.id,'reportDate',r.report_date,'submittedAt',r.submitted_at,
      'jobTypeId',jt.id,'jobTypeName',jt.name,
      'userId',p.id,'displayName',p.display_name,
      'items',coalesce((
        select jsonb_agg(jsonb_build_object(
          'id',i.id,'subjectName',i.subject_name,'customerName',i.customer_name,
          'details',i.details,'sortOrder',i.sort_order
        ) order by i.sort_order)
        from public.daily_report_items i where i.report_id=r.id
      ),'[]'::jsonb)
    )
    from public.daily_reports r
    join public.job_types jt on jt.id=r.job_type_id
    join public.profiles p on p.id=r.user_id
    where r.id=requested_report_id
  );
end;
$$;

revoke all on function public.get_daily_report_admin_options() from public;
revoke all on function public.get_my_daily_report_workspace() from public;
revoke all on function public.add_daily_report_subject(uuid,text) from public;
revoke all on function public.add_daily_report_customer(text) from public;
revoke all on function public.submit_my_daily_report(uuid,jsonb) from public;
revoke all on function public.get_daily_report_notification_detail(uuid) from public;

grant execute on function public.get_daily_report_admin_options() to authenticated;
grant execute on function public.get_my_daily_report_workspace() to authenticated;
grant execute on function public.add_daily_report_subject(uuid,text) to authenticated;
grant execute on function public.add_daily_report_customer(text) to authenticated;
grant execute on function public.submit_my_daily_report(uuid,jsonb) to authenticated;
grant execute on function public.get_daily_report_notification_detail(uuid) to authenticated;

commit;
