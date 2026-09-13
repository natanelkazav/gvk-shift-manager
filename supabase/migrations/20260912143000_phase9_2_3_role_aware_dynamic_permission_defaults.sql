-- Phase 9.2.3: role-aware defaults + explicit override metadata.
-- admin: receives all enabled manager capabilities for every active Job Type.
-- manager: receives manager capabilities only for Job Types they explicitly manage.
-- members: receive the Job Type member defaults. Explicit user overrides always win.

create or replace function public.get_inherited_dynamic_job_type_permission(
  requested_permission_key text,
  requested_job_type_id uuid,
  requested_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(bool_or(
    s.enabled = true and (
      (dm.audience = 'member' and exists (
        select 1 from public.job_type_memberships m
        where m.user_id = requested_user_id and m.job_type_id = requested_job_type_id
      ))
      or
      (dm.audience = 'manager' and (
        exists (
          select 1 from public.profiles p
          where p.id = requested_user_id and p.role = 'admin'
        )
        or exists (
          select 1 from public.job_type_managers jm
          where jm.user_id = requested_user_id and jm.job_type_id = requested_job_type_id
        )
      ))
    )
  ), false)
  from public.dynamic_permission_manifest dm
  join public.job_type_permission_settings s
    on s.job_type_id = requested_job_type_id
   and s.permission_key = dm.permission_key
   and s.audience = dm.audience
  where dm.permission_key = requested_permission_key
    and dm.feature_key = any(public.get_dynamic_job_type_active_features(requested_job_type_id));
$$;

create or replace function public.has_dynamic_job_type_permission(
  requested_permission_key text,
  requested_job_type_id uuid,
  requested_user_id uuid default auth.uid()
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare explicit_value boolean;
begin
  if requested_user_id is null then return false; end if;

  if not exists (
    select 1 from public.dynamic_permission_manifest dm
    where dm.permission_key = requested_permission_key
      and dm.feature_key = any(public.get_dynamic_job_type_active_features(requested_job_type_id))
  ) then return false; end if;

  select ujtp.enabled into explicit_value
  from public.user_job_type_permissions ujtp
  where ujtp.user_id = requested_user_id
    and ujtp.job_type_id = requested_job_type_id
    and ujtp.permission_key = requested_permission_key;
  if found then return explicit_value; end if;

  return public.get_inherited_dynamic_job_type_permission(
    requested_permission_key, requested_job_type_id, requested_user_id
  );
end;
$$;

create or replace function public.get_user_dynamic_job_type_permission_editor(target_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  target_role text;
begin
  if actor is null then raise exception 'not authenticated'; end if;
  if actor <> target_user_id and not exists (
    select 1 from public.user_permissions up
    where up.user_id = actor and up.permission_key in ('users.view', 'users.manage')
  ) then raise exception 'not allowed'; end if;

  select p.role::text into target_role from public.profiles p where p.id = target_user_id;
  if target_role is null then raise exception 'user not found'; end if;

  return jsonb_build_object(
    'role', target_role,
    'jobTypes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'jobTypeId', jt.id,
        'jobTypeName', jt.name,
        'isMember', exists (select 1 from public.job_type_memberships m where m.job_type_id=jt.id and m.user_id=target_user_id),
        'isManager', exists (select 1 from public.job_type_managers jm where jm.job_type_id=jt.id and jm.user_id=target_user_id),
        'activeFeatures', to_jsonb(public.get_dynamic_job_type_active_features(jt.id)),
        'permissions', coalesce((
          select jsonb_agg(jsonb_build_object(
            'permissionKey', dm.permission_key,
            'featureKey', dm.feature_key,
            'audience', dm.audience,
            'label', dm.label,
            'description', dm.description,
            'defaultEnabled', dm.default_enabled,
            'inheritedEnabled', public.get_inherited_dynamic_job_type_permission(dm.permission_key, jt.id, target_user_id),
            'hasOverride', exists (
              select 1 from public.user_job_type_permissions ujtp
              where ujtp.user_id=target_user_id and ujtp.job_type_id=jt.id and ujtp.permission_key=dm.permission_key
            ),
            'defaultSource', case
              when dm.audience='manager' and target_role='admin' then 'system_admin'
              when dm.audience='manager' and exists (select 1 from public.job_type_managers jm where jm.job_type_id=jt.id and jm.user_id=target_user_id) then 'job_type_manager'
              when dm.audience='member' and exists (select 1 from public.job_type_memberships m where m.job_type_id=jt.id and m.user_id=target_user_id) then 'job_type_member'
              else 'none'
            end,
            'enabled', coalesce((
              select ujtp.enabled from public.user_job_type_permissions ujtp
              where ujtp.user_id=target_user_id and ujtp.job_type_id=jt.id and ujtp.permission_key=dm.permission_key
            ), public.get_inherited_dynamic_job_type_permission(dm.permission_key, jt.id, target_user_id))
          ) order by case dm.audience when 'member' then 0 else 1 end, dm.feature_key, dm.sort_order, dm.label)
          from public.dynamic_permission_manifest dm
          join public.job_type_permission_settings s
            on s.job_type_id=jt.id and s.permission_key=dm.permission_key and s.audience=dm.audience
          where dm.feature_key = any(public.get_dynamic_job_type_active_features(jt.id))
        ), '[]'::jsonb)
      ) order by jt.name)
      from public.job_types jt where jt.is_active=true
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.save_user_dynamic_job_type_permissions(
  target_user_id uuid,
  requested_permissions jsonb default '[]'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid(); item jsonb; requested_job_type_id uuid;
  requested_permission_key text; requested_enabled boolean; inherited_enabled boolean;
begin
  if actor is null then raise exception 'not authenticated'; end if;
  if not exists (select 1 from public.user_permissions up where up.user_id=actor and up.permission_key='users.manage')
    then raise exception 'not allowed'; end if;
  if not exists (select 1 from public.profiles p where p.id=target_user_id) then raise exception 'user not found'; end if;

  delete from public.user_job_type_permissions where user_id=target_user_id;

  for item in select value from jsonb_array_elements(coalesce(requested_permissions,'[]'::jsonb)) loop
    requested_job_type_id := nullif(item->>'jobTypeId','')::uuid;
    requested_permission_key := nullif(item->>'permissionKey','');
    requested_enabled := coalesce((item->>'enabled')::boolean,false);
    if requested_job_type_id is null or requested_permission_key is null then continue; end if;

    if not exists (
      select 1 from public.dynamic_permission_manifest dm
      join public.job_type_permission_settings s on s.job_type_id=requested_job_type_id and s.permission_key=dm.permission_key and s.audience=dm.audience
      where dm.permission_key=requested_permission_key
        and dm.feature_key=any(public.get_dynamic_job_type_active_features(requested_job_type_id))
    ) then continue; end if;

    inherited_enabled := public.get_inherited_dynamic_job_type_permission(requested_permission_key, requested_job_type_id, target_user_id);
    if requested_enabled is distinct from inherited_enabled then
      insert into public.user_job_type_permissions(user_id,job_type_id,permission_key,enabled,source,updated_by,updated_at)
      values(target_user_id,requested_job_type_id,requested_permission_key,requested_enabled,'user_override',actor,now())
      on conflict(user_id,job_type_id,permission_key) do update set
        enabled=excluded.enabled, source=excluded.source, updated_by=excluded.updated_by, updated_at=excluded.updated_at;
    end if;
  end loop;
end;
$$;

grant execute on function public.get_inherited_dynamic_job_type_permission(text,uuid,uuid) to authenticated;
grant execute on function public.get_user_dynamic_job_type_permission_editor(uuid) to authenticated;
grant execute on function public.save_user_dynamic_job_type_permissions(uuid,jsonb) to authenticated;
