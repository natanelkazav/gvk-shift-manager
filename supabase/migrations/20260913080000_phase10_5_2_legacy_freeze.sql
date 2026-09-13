-- Phase 10.5.2 · Legacy Freeze
-- Keep the old GVK runtime as a recovery layer, but stop treating legacy roles
-- as the operational source of truth. This migration is intentionally additive:
-- no legacy table, enum value or historical row is deleted.

alter table public.dynamic_cutover_settings
  add column if not exists legacy_frozen boolean not null default false;

-- Safety bridge: any active/inactive user whose account still carries one of
-- the three historical GVK work roles and has no dynamic membership receives
-- the matching seeded Job Type membership. Existing dynamic assignments are
-- never overwritten.
insert into public.job_type_memberships (
  user_id,
  job_type_id,
  is_primary,
  source,
  metadata
)
select
  p.id,
  mapped_job.id,
  not exists (
    select 1
    from public.job_type_memberships existing_primary
    where existing_primary.user_id = p.id
      and existing_primary.is_primary = true
  ),
  'legacy_freeze_bridge',
  jsonb_build_object(
    'source', 'legacy_freeze_bridge',
    'legacyRole', p.role::text,
    'migratedAt', now()
  )
from public.profiles p
join lateral (
  select jt.id
  from public.job_types jt
  where jt.is_active = true
    and jt.legacy_role = p.role::text
  order by
    case when jt.code = p.role::text then 0 else 1 end,
    jt.created_at asc
  limit 1
) mapped_job on true
where p.role::text in ('dispatcher', 'on_call', 'morning_driver')
  and not exists (
    select 1
    from public.job_type_memberships current_membership
    where current_membership.user_id = p.id
  )
on conflict (user_id, job_type_id) do nothing;

create or replace function public.get_legacy_freeze_readiness()
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_user uuid := auth.uid();
  v_dynamic_first boolean := false;
  v_missing_count integer := 0;
  v_missing_users jsonb := '[]'::jsonb;
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;

  if not exists (
    select 1
    from public.user_permissions up
    where up.user_id = v_user
      and up.permission_key = 'users.manage'
  ) then
    raise exception 'not allowed';
  end if;

  select coalesce(dynamic_first_enabled, false)
    into v_dynamic_first
  from public.dynamic_cutover_settings
  where singleton = true;

  select count(*)::integer
    into v_missing_count
  from public.profiles p
  where p.is_active = true
    and p.role::text in ('dispatcher', 'on_call', 'morning_driver')
    and not exists (
      select 1
      from public.job_type_memberships m
      join public.job_types jt
        on jt.id = m.job_type_id
       and jt.is_active = true
      where m.user_id = p.id
    );

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'userId', q.id,
        'displayName', q.display_name,
        'legacyRole', q.role_text
      )
      order by q.display_name
    ),
    '[]'::jsonb
  )
  into v_missing_users
  from (
    select
      p.id,
      p.display_name,
      p.role::text as role_text
    from public.profiles p
    where p.is_active = true
      and p.role::text in ('dispatcher', 'on_call', 'morning_driver')
      and not exists (
        select 1
        from public.job_type_memberships m
        join public.job_types jt
          on jt.id = m.job_type_id
         and jt.is_active = true
        where m.user_id = p.id
      )
    order by p.display_name
    limit 25
  ) q;

  return jsonb_build_object(
    'ready', v_dynamic_first and v_missing_count = 0,
    'dynamicFirstEnabled', v_dynamic_first,
    'missingLegacyMemberships', v_missing_count,
    'missingUsers', v_missing_users
  );
end;
$$;

revoke all on function public.get_legacy_freeze_readiness() from public;
grant execute on function public.get_legacy_freeze_readiness() to authenticated;

-- Return freeze state as part of the single cutover payload used throughout
-- the PWA. Admins and Job Type managers remain Dynamic-first even without an
-- employee membership.
drop function if exists public.get_dynamic_cutover_state();
create function public.get_dynamic_cutover_state()
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_enabled boolean := false;
  v_legacy_frozen boolean := false;
  v_user uuid := auth.uid();
  v_has_membership boolean := false;
  v_is_system_admin boolean := false;
  v_is_job_type_manager boolean := false;
  v_use_dynamic boolean := false;
begin
  select
    coalesce(dynamic_first_enabled, false),
    coalesce(legacy_frozen, false)
  into v_enabled, v_legacy_frozen
  from public.dynamic_cutover_settings
  where singleton = true;

  if v_user is not null then
    select exists(
      select 1
      from public.job_type_memberships m
      join public.job_types jt
        on jt.id = m.job_type_id
       and jt.is_active = true
      where m.user_id = v_user
    ) into v_has_membership;

    select exists(
      select 1
      from public.profiles p
      where p.id = v_user
        and p.role = 'admin'
        and p.is_active = true
    ) into v_is_system_admin;

    select exists(
      select 1
      from public.job_type_managers jm
      join public.job_types jt
        on jt.id = jm.job_type_id
       and jt.is_active = true
      where jm.user_id = v_user
    ) into v_is_job_type_manager;
  end if;

  v_use_dynamic := coalesce(v_enabled, false)
    and (v_has_membership or v_is_system_admin or v_is_job_type_manager);

  return jsonb_build_object(
    'dynamicFirstEnabled', coalesce(v_enabled, false),
    'hasDynamicMembership', v_has_membership,
    'useDynamicRuntime', v_use_dynamic,
    'legacyFrozen', coalesce(v_legacy_frozen, false)
  );
end;
$$;

grant execute on function public.get_dynamic_cutover_state() to authenticated;

create or replace function public.set_legacy_freeze_state(p_frozen boolean)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_user uuid := auth.uid();
  v_readiness jsonb;
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;

  if not exists (
    select 1
    from public.user_permissions up
    where up.user_id = v_user
      and up.permission_key = 'users.manage'
  ) then
    raise exception 'not allowed';
  end if;

  if p_frozen then
    v_readiness := public.get_legacy_freeze_readiness();
    if not coalesce((v_readiness->>'ready')::boolean, false) then
      raise exception 'Legacy cannot be frozen yet: enable Dynamic-first and assign every active legacy worker to at least one active Job Type';
    end if;
  end if;

  insert into public.dynamic_cutover_settings (
    singleton,
    dynamic_first_enabled,
    legacy_frozen,
    updated_at,
    updated_by
  )
  values (
    true,
    true,
    p_frozen,
    now(),
    v_user
  )
  on conflict (singleton) do update
    set legacy_frozen = excluded.legacy_frozen,
        updated_at = now(),
        updated_by = v_user;

  return public.get_dynamic_cutover_state();
end;
$$;

revoke all on function public.set_legacy_freeze_state(boolean) from public;
grant execute on function public.set_legacy_freeze_state(boolean) to authenticated;

-- A frozen Legacy layer must be explicitly unfrozen before a system-wide
-- rollback can be enabled. This prevents an accidental click from restoring
-- legacy screens as the production runtime.
drop function if exists public.set_dynamic_cutover_state(boolean);
create function public.set_dynamic_cutover_state(p_enabled boolean)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_user uuid := auth.uid();
  v_legacy_frozen boolean := false;
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;

  if not exists (
    select 1
    from public.user_permissions up
    where up.user_id = v_user
      and up.permission_key = 'users.manage'
  ) then
    raise exception 'not allowed';
  end if;

  select coalesce(legacy_frozen, false)
    into v_legacy_frozen
  from public.dynamic_cutover_settings
  where singleton = true;

  if p_enabled = false and v_legacy_frozen then
    raise exception 'unfreeze Legacy before switching back to Legacy-first';
  end if;

  insert into public.dynamic_cutover_settings (
    singleton,
    dynamic_first_enabled,
    updated_at,
    updated_by
  )
  values (
    true,
    p_enabled,
    now(),
    v_user
  )
  on conflict (singleton) do update
    set dynamic_first_enabled = excluded.dynamic_first_enabled,
        updated_at = now(),
        updated_by = v_user;

  return public.get_dynamic_cutover_state();
end;
$$;

grant execute on function public.set_dynamic_cutover_state(boolean) to authenticated;

-- If the installation is already Dynamic-first and the bridge above resolved
-- every active legacy worker, complete the freeze automatically. Otherwise the
-- admin UI will show the exact blockers and allow freezing later.
update public.dynamic_cutover_settings s
set legacy_frozen = true,
    updated_at = now()
where s.singleton = true
  and s.dynamic_first_enabled = true
  and not exists (
    select 1
    from public.profiles p
    where p.is_active = true
      and p.role::text in ('dispatcher', 'on_call', 'morning_driver')
      and not exists (
        select 1
        from public.job_type_memberships m
        join public.job_types jt
          on jt.id = m.job_type_id
         and jt.is_active = true
        where m.user_id = p.id
      )
  );
