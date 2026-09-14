-- Phase 10.6.5: fix PostgreSQL 42702 ambiguity in the personal development-mode RPC.
--
-- get_my_development_mode() RETURNS TABLE(enabled, enabled_at, expires_at).
-- In PL/pgSQL those output column names are also variables, so the previous
-- unqualified predicates `enabled = true` / `expires_at ...` could be resolved
-- as either an output variable or a column of admin_development_sessions.
-- The error surfaced while the scheduling workspace was active and made UI
-- actions (including the availability deadline flow) appear broken even though
-- the date input itself was not the source of the failure.

begin;

create or replace function public.get_my_development_mode()
returns table(enabled boolean, enabled_at timestamptz, expires_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
      and p.is_active = true
  ) then
    return query
    select false, null::timestamptz, null::timestamptz;
    return;
  end if;

  update public.admin_development_sessions as ads
  set enabled = false,
      updated_at = now()
  where ads.user_id = auth.uid()
    and ads.enabled = true
    and ads.expires_at is not null
    and ads.expires_at <= now();

  return query
  select coalesce(ads.enabled, false), ads.enabled_at, ads.expires_at
  from (select auth.uid() as user_id) as me
  left join public.admin_development_sessions as ads
    on ads.user_id = me.user_id;
end;
$$;

-- Recreate the setter as well with fully-qualified table references in every
-- read path, so future changes do not reintroduce the same output-column clash.
create or replace function public.set_my_development_mode(
  requested_enabled boolean,
  requested_duration_minutes integer default 60
)
returns table(enabled boolean, enabled_at timestamptz, expires_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  resolved_expires_at timestamptz;
begin
  if not exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
      and p.is_active = true
  ) then
    raise exception 'development mode is available to system administrators only'
      using errcode = '42501';
  end if;

  if requested_enabled then
    if requested_duration_minutes is null
       or requested_duration_minutes < 5
       or requested_duration_minutes > 1440 then
      raise exception 'development mode duration must be between 5 and 1440 minutes';
    end if;
    resolved_expires_at := now() + make_interval(mins => requested_duration_minutes);
  end if;

  insert into public.admin_development_sessions(
    user_id,
    enabled,
    enabled_at,
    expires_at,
    updated_at
  )
  values (
    auth.uid(),
    requested_enabled,
    case when requested_enabled then now() else null end,
    case when requested_enabled then resolved_expires_at else null end,
    now()
  )
  on conflict (user_id) do update
    set enabled = excluded.enabled,
        enabled_at = excluded.enabled_at,
        expires_at = excluded.expires_at,
        updated_at = now();

  insert into public.audit_logs(action, actor_user_id, entity_type, summary, metadata)
  values (
    'system_event',
    auth.uid(),
    'development_mode',
    case
      when requested_enabled then 'מצב פיתוח אישי הופעל'
      else 'מצב פיתוח אישי כובה'
    end,
    jsonb_build_object(
      'execution_mode', 'simulation',
      'enabled', requested_enabled,
      'expires_at', resolved_expires_at
    )
  );

  return query
  select ads.enabled, ads.enabled_at, ads.expires_at
  from public.admin_development_sessions as ads
  where ads.user_id = auth.uid();
end;
$$;

revoke all on function public.get_my_development_mode() from public;
revoke all on function public.set_my_development_mode(boolean, integer) from public;
grant execute on function public.get_my_development_mode() to authenticated;
grant execute on function public.set_my_development_mode(boolean, integer) to authenticated;

commit;
