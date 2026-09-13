-- Phase 9.2.2: per-user, per-Job-Type dynamic permission toggles.
-- The available options are derived from each Job Type's active capabilities.
-- Member/manager relationships provide defaults only; explicit user overrides win.

create table if not exists public.user_job_type_permissions (
  user_id uuid not null references public.profiles(id) on delete cascade,
  job_type_id uuid not null references public.job_types(id) on delete cascade,
  permission_key text not null,
  enabled boolean not null,
  source text not null default 'user_override',
  updated_by uuid null references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (user_id, job_type_id, permission_key)
);

create index if not exists user_job_type_permissions_job_type_idx
  on public.user_job_type_permissions(job_type_id, user_id);

-- Explicit user overrides take precedence. Without an override, the Job Type's
-- member/manager defaults are used according to the user's relationship.
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
declare
  explicit_value boolean;
  features text[];
begin
  if requested_user_id is null then
    return false;
  end if;

  features := public.get_dynamic_job_type_active_features(requested_job_type_id);
  if coalesce(array_length(features, 1), 0) = 0 then
    return false;
  end if;

  -- The permission must actually belong to an active capability of this Job Type.
  if not exists (
    select 1
    from public.dynamic_permission_manifest dm
    where dm.permission_key = requested_permission_key
      and dm.feature_key = any(features)
  ) then
    return false;
  end if;

  select ujtp.enabled
  into explicit_value
  from public.user_job_type_permissions ujtp
  where ujtp.user_id = requested_user_id
    and ujtp.job_type_id = requested_job_type_id
    and ujtp.permission_key = requested_permission_key;

  if found then
    return explicit_value;
  end if;

  return exists (
    select 1
    from public.dynamic_permission_manifest dm
    join public.job_type_permission_settings s
      on s.job_type_id = requested_job_type_id
     and s.permission_key = dm.permission_key
     and s.audience = dm.audience
     and s.enabled = true
    where dm.permission_key = requested_permission_key
      and dm.feature_key = any(features)
      and (
        (
          dm.audience = 'member'
          and exists (
            select 1
            from public.job_type_memberships m
            where m.user_id = requested_user_id
              and m.job_type_id = requested_job_type_id
          )
        )
        or
        (
          dm.audience = 'manager'
          and exists (
            select 1
            from public.job_type_managers jm
            where jm.user_id = requested_user_id
              and jm.job_type_id = requested_job_type_id
          )
        )
      )
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
begin
  if actor is null then
    raise exception 'not authenticated';
  end if;

  if actor <> target_user_id and not exists (
    select 1
    from public.user_permissions up
    where up.user_id = actor
      and up.permission_key in ('users.view', 'users.manage')
  ) then
    raise exception 'not allowed';
  end if;

  if not exists (select 1 from public.profiles p where p.id = target_user_id) then
    raise exception 'user not found';
  end if;

  return jsonb_build_object(
    'jobTypes',
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'jobTypeId', jt.id,
          'jobTypeName', jt.name,
          'isMember', exists (
            select 1
            from public.job_type_memberships m
            where m.job_type_id = jt.id
              and m.user_id = target_user_id
          ),
          'isManager', exists (
            select 1
            from public.job_type_managers jm
            where jm.job_type_id = jt.id
              and jm.user_id = target_user_id
          ),
          'activeFeatures', to_jsonb(public.get_dynamic_job_type_active_features(jt.id)),
          'permissions', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'permissionKey', dm.permission_key,
                'featureKey', dm.feature_key,
                'audience', dm.audience,
                'label', dm.label,
                'description', dm.description,
                'defaultEnabled', dm.default_enabled,
                'inheritedEnabled', (
                  s.enabled = true and (
                    (dm.audience = 'member' and exists (
                      select 1
                      from public.job_type_memberships m
                      where m.job_type_id = jt.id
                        and m.user_id = target_user_id
                    ))
                    or
                    (dm.audience = 'manager' and exists (
                      select 1
                      from public.job_type_managers jm
                      where jm.job_type_id = jt.id
                        and jm.user_id = target_user_id
                    ))
                  )
                ),
                'enabled', coalesce(
                  (
                    select ujtp.enabled
                    from public.user_job_type_permissions ujtp
                    where ujtp.user_id = target_user_id
                      and ujtp.job_type_id = jt.id
                      and ujtp.permission_key = dm.permission_key
                  ),
                  (
                    s.enabled = true and (
                      (dm.audience = 'member' and exists (
                        select 1
                        from public.job_type_memberships m
                        where m.job_type_id = jt.id
                          and m.user_id = target_user_id
                      ))
                      or
                      (dm.audience = 'manager' and exists (
                        select 1
                        from public.job_type_managers jm
                        where jm.job_type_id = jt.id
                          and jm.user_id = target_user_id
                      ))
                    )
                  )
                )
              )
              order by
                case dm.audience when 'member' then 0 else 1 end,
                dm.feature_key,
                dm.sort_order,
                dm.label
            )
            from public.dynamic_permission_manifest dm
            join public.job_type_permission_settings s
              on s.job_type_id = jt.id
             and s.permission_key = dm.permission_key
             and s.audience = dm.audience
            where dm.feature_key = any(public.get_dynamic_job_type_active_features(jt.id))
          ), '[]'::jsonb)
        )
        order by jt.name
      )
      from public.job_types jt
      where jt.is_active = true
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
  actor uuid := auth.uid();
  item jsonb;
  requested_job_type_id uuid;
  requested_permission_key text;
  requested_enabled boolean;
  inherited_enabled boolean;
  features text[];
begin
  if actor is null then
    raise exception 'not authenticated';
  end if;

  if not exists (
    select 1
    from public.user_permissions up
    where up.user_id = actor
      and up.permission_key = 'users.manage'
  ) then
    raise exception 'not allowed';
  end if;

  if not exists (select 1 from public.profiles p where p.id = target_user_id) then
    raise exception 'user not found';
  end if;

  delete from public.user_job_type_permissions
  where user_id = target_user_id;

  for item in
    select value from jsonb_array_elements(coalesce(requested_permissions, '[]'::jsonb))
  loop
    requested_job_type_id := nullif(item->>'jobTypeId', '')::uuid;
    requested_permission_key := nullif(item->>'permissionKey', '');
    requested_enabled := coalesce((item->>'enabled')::boolean, false);

    if requested_job_type_id is null or requested_permission_key is null then
      continue;
    end if;

    features := public.get_dynamic_job_type_active_features(requested_job_type_id);

    if not exists (
      select 1
      from public.dynamic_permission_manifest dm
      join public.job_type_permission_settings s
        on s.job_type_id = requested_job_type_id
       and s.permission_key = dm.permission_key
       and s.audience = dm.audience
      where dm.permission_key = requested_permission_key
        and dm.feature_key = any(features)
    ) then
      continue;
    end if;

    select coalesce(bool_or(
      s.enabled = true and (
        (dm.audience = 'member' and exists (
          select 1
          from public.job_type_memberships m
          where m.job_type_id = requested_job_type_id
            and m.user_id = target_user_id
        ))
        or
        (dm.audience = 'manager' and exists (
          select 1
          from public.job_type_managers jm
          where jm.job_type_id = requested_job_type_id
            and jm.user_id = target_user_id
        ))
      )
    ), false)
    into inherited_enabled
    from public.dynamic_permission_manifest dm
    join public.job_type_permission_settings s
      on s.job_type_id = requested_job_type_id
     and s.permission_key = dm.permission_key
     and s.audience = dm.audience
    where dm.permission_key = requested_permission_key
      and dm.feature_key = any(features);

    -- Keep only actual overrides. If the toggle equals the inherited default,
    -- no row is needed and future capability changes remain dynamic.
    if requested_enabled is distinct from inherited_enabled then
      insert into public.user_job_type_permissions(
        user_id,
        job_type_id,
        permission_key,
        enabled,
        source,
        updated_by,
        updated_at
      ) values (
        target_user_id,
        requested_job_type_id,
        requested_permission_key,
        requested_enabled,
        'user_override',
        actor,
        now()
      )
      on conflict (user_id, job_type_id, permission_key)
      do update set
        enabled = excluded.enabled,
        source = excluded.source,
        updated_by = excluded.updated_by,
        updated_at = excluded.updated_at;
    end if;
  end loop;
end;
$$;

grant select on public.user_job_type_permissions to authenticated;
grant execute on function public.get_user_dynamic_job_type_permission_editor(uuid) to authenticated;
grant execute on function public.save_user_dynamic_job_type_permissions(uuid,jsonb) to authenticated;
