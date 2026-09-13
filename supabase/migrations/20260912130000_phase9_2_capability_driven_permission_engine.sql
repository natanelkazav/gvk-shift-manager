-- Phase 9.2 redesigned: capability-driven permission engine
-- Job types activate features; features expose member/manager permissions.
-- Legacy user_permissions remain only as system-level/transition permissions.

create table if not exists public.dynamic_permission_manifest (
  feature_key text not null,
  permission_key text not null,
  audience text not null check (audience in ('member','manager')),
  label text not null,
  description text not null default '',
  default_enabled boolean not null default true,
  sort_order integer not null default 100,
  primary key (feature_key, permission_key, audience)
);

create table if not exists public.job_type_permission_settings (
  job_type_id uuid not null references public.job_types(id) on delete cascade,
  permission_key text not null,
  audience text not null check (audience in ('member','manager')),
  enabled boolean not null default true,
  source text not null default 'manifest',
  updated_at timestamptz not null default now(),
  primary key (job_type_id, permission_key, audience)
);

create table if not exists public.job_type_managers (
  job_type_id uuid not null references public.job_types(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (job_type_id, user_id)
);

create index if not exists job_type_managers_user_idx
  on public.job_type_managers(user_id);

create index if not exists job_type_permission_settings_key_idx
  on public.job_type_permission_settings(permission_key);

insert into public.dynamic_permission_manifest
  (feature_key, permission_key, audience, label, description, default_enabled, sort_order)
values
  ('schedule','schedule.view_own','member','צפייה במשמרות שלי','צפייה בלוח האישי של התפקיד.',true,10),
  ('schedule','schedule.view_team','manager','צפייה בלוח התפקיד','צפייה בכל השיבוצים של התפקיד.',true,10),
  ('schedule','schedule.create_draft','manager','יצירת טיוטת שיבוץ','יצירת טיוטת שיבוץ חדשה לתקופה.',true,20),
  ('schedule','schedule.edit_draft','manager','עריכת טיוטת שיבוץ','עריכת הקצאות לפני פרסום.',true,30),
  ('schedule','schedule.publish','manager','פרסום שיבוץ','פרסום לוח לעובדי התפקיד.',true,40),
  ('schedule','schedule.edit_published','manager','עריכת לוח שפורסם','תיקון שיבוץ לאחר פרסום ושמירת היסטוריה.',true,50),

  ('availability','availability.view_own','member','צפייה באילוצים שלי','צפייה באילוצים האישיים לתפקיד.',true,10),
  ('availability','availability.submit_own','member','הגשת אילוצים','הגשת אילוצים לתקופה פתוחה.',true,20),
  ('availability','availability.edit_own','member','עריכת אילוצים בזמן פתוח','שינוי אילוצים כל עוד התקופה פתוחה.',true,30),
  ('availability','availability.view_team','manager','צפייה באילוצי התפקיד','צפייה בהגשות של עובדי התפקיד.',true,10),
  ('availability','availability.open_period','manager','פתיחת תקופת אילוצים','פתיחת תקופת איסוף אילוצים.',true,20),
  ('availability','availability.close_period','manager','סגירת תקופת אילוצים','סגירת התקופה לפני יצירת שיבוץ.',true,30),
  ('availability','availability.manage_submissions','manager','ניהול הגשות אילוצים','טיפול בהגשות וחוסרים של העובדים.',true,40),

  ('shift_exchange','shift_exchange.request','member','בקשת חילוף משמרת','פתיחת בקשת חילוף עבור משמרת אישית.',true,10),
  ('shift_exchange','shift_exchange.respond','member','תגובה לבקשת חילוף','אישור או דחייה כאשר העובד הוא הצד השני.',true,20),
  ('shift_exchange','shift_exchange.review','manager','צפייה בבקשות חילוף','צפייה בבקשות שממתינות לאישור ניהולי.',true,10),
  ('shift_exchange','shift_exchange.approve','manager','אישור חילופי משמרות','אישור או דחייה סופיים של בקשת חילוף.',true,20),

  ('self_edit','schedule.self_edit','member','עריכת השיבוץ שלי','שינוי שיבוץ אישי בהתאם למדיניות התפקיד.',true,10),

  ('monthly_rotation','rotation.generate','manager','יצירת סבב חודשי','יצירת טיוטה לפי מנגנון הסבב החודשי.',true,10),

  ('statistics','statistics.view_job_type','manager','צפייה בסטטיסטיקות התפקיד','צפייה בדוחות ובסטטיסטיקות של התפקיד.',true,10),

  ('payroll','payroll.view_job_type','manager','צפייה בנתוני שכר התפקיד','צפייה בנתוני השכר הרלוונטיים לתפקיד.',true,10)
on conflict (feature_key, permission_key, audience) do update
set label = excluded.label,
    description = excluded.description,
    default_enabled = excluded.default_enabled,
    sort_order = excluded.sort_order;

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
  select * into jt from public.job_types where id = requested_job_type_id;
  if not found then return array[]::text[]; end if;

  if coalesce((jt.availability_config->>'enabled')::boolean, false) then
    features := array_append(features, 'availability');
  end if;

  change_mode := coalesce(jt.scheduling_config->>'scheduleChangeMode', 'none');
  if change_mode = 'shift_exchange' then
    features := array_append(features, 'shift_exchange');
  elsif change_mode = 'self_edit' then
    features := array_append(features, 'self_edit');
  end if;

  if jt.scheduling_strategy = 'monthly_rotation_constraints' then
    features := array_append(features, 'monthly_rotation');
  end if;

  if coalesce((jt.statistics_config->>'enabled')::boolean, false) then
    features := array_append(features, 'statistics');
  end if;

  if coalesce(jt.pay_model, 'none') <> 'none' then
    features := array_append(features, 'payroll');
  end if;

  return (select array_agg(distinct x order by x) from unnest(features) x);
end;
$$;

create or replace function public.sync_dynamic_job_type_permission_settings(requested_job_type_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  features text[];
begin
  features := public.get_dynamic_job_type_active_features(requested_job_type_id);

  delete from public.job_type_permission_settings s
  where s.job_type_id = requested_job_type_id
    and not exists (
      select 1
      from public.dynamic_permission_manifest m
      where m.permission_key = s.permission_key
        and m.audience = s.audience
        and m.feature_key = any(features)
    );

  insert into public.job_type_permission_settings
    (job_type_id, permission_key, audience, enabled, source, updated_at)
  select requested_job_type_id, m.permission_key, m.audience, m.default_enabled, 'manifest', now()
  from public.dynamic_permission_manifest m
  where m.feature_key = any(features)
  on conflict (job_type_id, permission_key, audience) do nothing;
end;
$$;

create or replace function public.trg_sync_dynamic_job_type_permissions()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.sync_dynamic_job_type_permission_settings(new.id);
  return new;
end;
$$;

drop trigger if exists trg_job_type_permission_sync on public.job_types;
create trigger trg_job_type_permission_sync
after insert or update of availability_config, scheduling_strategy, scheduling_config, statistics_config, pay_model
on public.job_types
for each row execute function public.trg_sync_dynamic_job_type_permissions();

-- Backfill every existing dynamic job type.
do $$
declare r record;
begin
  for r in select id from public.job_types loop
    perform public.sync_dynamic_job_type_permission_settings(r.id);
  end loop;
end $$;

create or replace function public.get_dynamic_job_type_permission_editor(requested_job_type_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  features text[];
begin
  if actor is null then raise exception 'not authenticated'; end if;
  if not exists (
    select 1 from public.user_permissions up
    where up.user_id = actor and up.permission_key in ('users.view','users.manage')
  ) then raise exception 'not allowed'; end if;
  if not exists (select 1 from public.job_types where id=requested_job_type_id) then
    raise exception 'job type not found';
  end if;

  perform public.sync_dynamic_job_type_permission_settings(requested_job_type_id);
  features := public.get_dynamic_job_type_active_features(requested_job_type_id);

  return jsonb_build_object(
    'jobTypeId', requested_job_type_id,
    'jobTypeName', (select name from public.job_types where id=requested_job_type_id),
    'activeFeatures', to_jsonb(features),
    'memberPermissions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'permissionKey',m.permission_key,
        'featureKey',m.feature_key,
        'audience',m.audience,
        'label',m.label,
        'description',m.description,
        'defaultEnabled',m.default_enabled,
        'enabled',coalesce(s.enabled,m.default_enabled)
      ) order by m.feature_key,m.sort_order,m.label)
      from public.dynamic_permission_manifest m
      left join public.job_type_permission_settings s
        on s.job_type_id=requested_job_type_id
       and s.permission_key=m.permission_key
       and s.audience=m.audience
      where m.audience='member' and m.feature_key=any(features)
    ),'[]'::jsonb),
    'managerPermissions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'permissionKey',m.permission_key,
        'featureKey',m.feature_key,
        'audience',m.audience,
        'label',m.label,
        'description',m.description,
        'defaultEnabled',m.default_enabled,
        'enabled',coalesce(s.enabled,m.default_enabled)
      ) order by m.feature_key,m.sort_order,m.label)
      from public.dynamic_permission_manifest m
      left join public.job_type_permission_settings s
        on s.job_type_id=requested_job_type_id
       and s.permission_key=m.permission_key
       and s.audience=m.audience
      where m.audience='manager' and m.feature_key=any(features)
    ),'[]'::jsonb),
    'managers', coalesce((
      select jsonb_agg(jsonb_build_object(
        'userId',p.id,'displayName',p.display_name,'email',p.email,
        'isActive',p.is_active,'isManager',(jm.user_id is not null)
      ) order by p.is_active desc,p.display_name)
      from public.profiles p
      left join public.job_type_managers jm
        on jm.user_id=p.id and jm.job_type_id=requested_job_type_id
    ),'[]'::jsonb)
  );
end;
$$;

create or replace function public.save_dynamic_job_type_permission_policy(
  requested_job_type_id uuid,
  requested_member_permission_keys text[] default array[]::text[],
  requested_manager_permission_keys text[] default array[]::text[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  features text[];
begin
  if actor is null then raise exception 'not authenticated'; end if;
  if not exists (
    select 1 from public.user_permissions up
    where up.user_id=actor and up.permission_key='users.manage'
  ) then raise exception 'not allowed'; end if;

  features := public.get_dynamic_job_type_active_features(requested_job_type_id);
  if coalesce(array_length(features,1),0)=0 then raise exception 'job type not found'; end if;
  perform public.sync_dynamic_job_type_permission_settings(requested_job_type_id);

  update public.job_type_permission_settings s
  set enabled = case
      when s.audience='member' then s.permission_key=any(coalesce(requested_member_permission_keys,array[]::text[]))
      else s.permission_key=any(coalesce(requested_manager_permission_keys,array[]::text[]))
    end,
    source='role_builder',
    updated_at=now()
  where s.job_type_id=requested_job_type_id
    and exists (
      select 1 from public.dynamic_permission_manifest m
      where m.permission_key=s.permission_key
        and m.audience=s.audience
        and m.feature_key=any(features)
    );
end;
$$;

create or replace function public.set_dynamic_job_type_manager(
  requested_job_type_id uuid,
  requested_user_id uuid,
  requested_is_manager boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare actor uuid := auth.uid();
begin
  if actor is null then raise exception 'not authenticated'; end if;
  if not exists (
    select 1 from public.user_permissions up
    where up.user_id=actor and up.permission_key='users.manage'
  ) then raise exception 'not allowed'; end if;
  if not exists (select 1 from public.job_types where id=requested_job_type_id) then raise exception 'job type not found'; end if;
  if not exists (select 1 from public.profiles where id=requested_user_id) then raise exception 'user not found'; end if;

  if requested_is_manager then
    insert into public.job_type_managers(job_type_id,user_id,created_by)
    values(requested_job_type_id,requested_user_id,actor)
    on conflict do nothing;
  else
    delete from public.job_type_managers
    where job_type_id=requested_job_type_id and user_id=requested_user_id;
  end if;
end;
$$;

create or replace function public.has_dynamic_job_type_permission(
  requested_permission_key text,
  requested_job_type_id uuid,
  requested_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select requested_user_id is not null and (
    exists (
      select 1
      from public.job_type_memberships m
      join public.job_type_permission_settings s
        on s.job_type_id=m.job_type_id
       and s.audience='member'
       and s.enabled=true
      where m.user_id=requested_user_id
        and m.job_type_id=requested_job_type_id
        and s.permission_key=requested_permission_key
    )
    or exists (
      select 1
      from public.job_type_managers jm
      join public.job_type_permission_settings s
        on s.job_type_id=jm.job_type_id
       and s.audience='manager'
       and s.enabled=true
      where jm.user_id=requested_user_id
        and jm.job_type_id=requested_job_type_id
        and s.permission_key=requested_permission_key
    )
  );
$$;

create or replace function public.get_user_dynamic_permission_summary(target_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare actor uuid := auth.uid();
begin
  if actor is null then raise exception 'not authenticated'; end if;
  if actor <> target_user_id and not exists (
    select 1 from public.user_permissions up
    where up.user_id=actor and up.permission_key='users.manage'
  ) then raise exception 'not allowed'; end if;

  return jsonb_build_object('roles',coalesce((
    select jsonb_agg(role_item order by role_item->>'jobTypeName',role_item->>'relationship')
    from (
      select jsonb_build_object(
        'jobTypeId',jt.id,'jobTypeName',jt.name,'relationship','member',
        'permissions',coalesce((
          select jsonb_agg(jsonb_build_object('permissionKey',s.permission_key,'label',dm.label,'featureKey',dm.feature_key) order by dm.feature_key,dm.sort_order)
          from public.job_type_permission_settings s
          join public.dynamic_permission_manifest dm on dm.permission_key=s.permission_key and dm.audience=s.audience
          where s.job_type_id=jt.id and s.audience='member' and s.enabled=true
        ),'[]'::jsonb)
      ) role_item
      from public.job_type_memberships m
      join public.job_types jt on jt.id=m.job_type_id and jt.is_active=true
      where m.user_id=target_user_id

      union all

      select jsonb_build_object(
        'jobTypeId',jt.id,'jobTypeName',jt.name,'relationship','manager',
        'permissions',coalesce((
          select jsonb_agg(jsonb_build_object('permissionKey',s.permission_key,'label',dm.label,'featureKey',dm.feature_key) order by dm.feature_key,dm.sort_order)
          from public.job_type_permission_settings s
          join public.dynamic_permission_manifest dm on dm.permission_key=s.permission_key and dm.audience=s.audience
          where s.job_type_id=jt.id and s.audience='manager' and s.enabled=true
        ),'[]'::jsonb)
      ) role_item
      from public.job_type_managers jm
      join public.job_types jt on jt.id=jm.job_type_id and jt.is_active=true
      where jm.user_id=target_user_id
    ) q
  ),'[]'::jsonb));
end;
$$;

-- Extend membership admin payload with manager assignment without changing membership semantics.
create or replace function public.get_dynamic_job_type_membership_admin(requested_job_type_id uuid)
returns jsonb
language plpgsql security definer set search_path=''
as $function$
declare current_user_id uuid := auth.uid();
begin
  if current_user_id is null then raise exception 'not authenticated'; end if;
  if not exists(select 1 from public.user_permissions up where up.user_id=current_user_id and up.permission_key in ('users.view','users.manage')) then raise exception 'not allowed'; end if;
  if not exists(select 1 from public.job_types jt where jt.id=requested_job_type_id) then raise exception 'job type not found'; end if;

  return jsonb_build_object(
    'users', coalesce((
      select jsonb_agg(jsonb_build_object(
        'userId',p.id,'displayName',p.display_name,'email',p.email,'legacyRole',p.role::text,'isActive',p.is_active,
        'isMember',(m.user_id is not null),'isPrimary',coalesce(m.is_primary,false),
        'isJobTypeManager',(jm.user_id is not null),
        'employmentScope',m.metadata->>'employmentScope',
        'partTimeDefinition',coalesce(m.metadata->'partTimeDefinition','{}'::jsonb)
      ) order by p.is_active desc,p.display_name)
      from public.profiles p
      left join public.job_type_memberships m on m.user_id=p.id and m.job_type_id=requested_job_type_id
      left join public.job_type_managers jm on jm.user_id=p.id and jm.job_type_id=requested_job_type_id
    ),'[]'::jsonb)
  );
end;$function$;

grant execute on function public.get_dynamic_job_type_active_features(uuid) to authenticated;
grant execute on function public.get_dynamic_job_type_permission_editor(uuid) to authenticated;
grant execute on function public.save_dynamic_job_type_permission_policy(uuid,text[],text[]) to authenticated;
grant execute on function public.set_dynamic_job_type_manager(uuid,uuid,boolean) to authenticated;
grant execute on function public.has_dynamic_job_type_permission(text,uuid,uuid) to authenticated;
grant execute on function public.get_user_dynamic_permission_summary(uuid) to authenticated;
