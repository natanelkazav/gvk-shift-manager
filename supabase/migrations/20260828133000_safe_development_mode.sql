-- Safe Development Mode (Phase 5.5)
-- Personal to a system administrator. Production table writes made under the
-- administrator's authenticated session are blocked at database level.

create table if not exists public.admin_development_sessions (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  enabled boolean not null default false,
  enabled_at timestamptz,
  expires_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.admin_development_sessions enable row level security;
revoke all on public.admin_development_sessions from anon, authenticated;

create or replace function public.is_my_development_mode()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_development_sessions s
    join public.profiles p on p.id = s.user_id
    where s.user_id = auth.uid()
      and p.role = 'admin'
      and p.is_active = true
      and s.enabled = true
      and (s.expires_at is null or s.expires_at > now())
  );
$$;

revoke all on function public.is_my_development_mode() from public;
grant execute on function public.is_my_development_mode() to authenticated;

create or replace function public.get_my_development_mode()
returns table(enabled boolean, enabled_at timestamptz, expires_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'admin' and is_active = true) then
    return query select false, null::timestamptz, null::timestamptz;
    return;
  end if;

  update public.admin_development_sessions
  set enabled = false, updated_at = now()
  where user_id = auth.uid() and enabled = true and expires_at is not null and expires_at <= now();

  return query
  select coalesce(s.enabled, false), s.enabled_at, s.expires_at
  from (select auth.uid() as user_id) me
  left join public.admin_development_sessions s on s.user_id = me.user_id;
end;
$$;

grant execute on function public.get_my_development_mode() to authenticated;

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
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'admin' and is_active = true) then
    raise exception 'development mode is available to system administrators only' using errcode = '42501';
  end if;

  if requested_enabled then
    if requested_duration_minutes is null or requested_duration_minutes < 5 or requested_duration_minutes > 1440 then
      raise exception 'development mode duration must be between 5 and 1440 minutes';
    end if;
    resolved_expires_at := now() + make_interval(mins => requested_duration_minutes);
  end if;

  insert into public.admin_development_sessions(user_id, enabled, enabled_at, expires_at, updated_at)
  values (auth.uid(), requested_enabled, case when requested_enabled then now() else null end,
          case when requested_enabled then resolved_expires_at else null end, now())
  on conflict (user_id) do update
    set enabled = excluded.enabled,
        enabled_at = excluded.enabled_at,
        expires_at = excluded.expires_at,
        updated_at = now();

  insert into public.audit_logs(action, actor_user_id, entity_type, summary, metadata)
  values ('system_event', auth.uid(), 'development_mode',
          case when requested_enabled then 'מצב פיתוח אישי הופעל' else 'מצב פיתוח אישי כובה' end,
          jsonb_build_object('execution_mode', 'simulation', 'enabled', requested_enabled,
                             'expires_at', resolved_expires_at));

  return query
  select s.enabled, s.enabled_at, s.expires_at
  from public.admin_development_sessions s where s.user_id = auth.uid();
end;
$$;

grant execute on function public.set_my_development_mode(boolean, integer) to authenticated;

create or replace function public.guard_development_mode_production_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_my_development_mode() then
    raise exception 'SIMULATION_MODE: הפעולה נחסמה. מצב פיתוח פעיל ולא בוצע שינוי בנתוני המערכת.'
      using errcode = 'P0001',
            hint = 'כבה מצב פיתוח בהגדרות כדי לבצע את הפעולה ב-Production.';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

-- Install a database-level safety net on existing public production tables.
-- Shadow/configuration tables for the new dynamic engine are intentionally
-- excluded so they can continue to be used as a simulator.
do $$
declare
  table_row record;
  trigger_name text;
begin
  for table_row in
    select tablename
    from pg_tables
    where schemaname = 'public'
      and tablename not in (
        'admin_development_sessions',
        'audit_logs',
        'dynamic_availability_periods', 'dynamic_availability_slots',
        'dynamic_availability_submissions', 'dynamic_availability_entries',
        'dynamic_schedule_shadow_drafts', 'dynamic_schedule_shadow_targets',
        'dynamic_schedule_shadow_assignments',
        'job_type_ai_suggestions'
      )
      and tablename not like 'schedule_group%'
      and tablename not like 'job_type%'
      and tablename not in ('scheduling_feature_flags', 'scheduling_rule_registry')
  loop
    trigger_name := 'development_mode_guard_' || left(md5(table_row.tablename), 16);
    execute format('drop trigger if exists %I on public.%I', trigger_name, table_row.tablename);
    execute format(
      'create trigger %I before insert or update or delete on public.%I for each row execute function public.guard_development_mode_production_write()',
      trigger_name, table_row.tablename
    );
  end loop;
end $$;

comment on table public.admin_development_sessions is
'Per-admin Safe Development Mode session. When active, database triggers block authenticated writes to existing production tables while shadow engine tables remain writable.';
