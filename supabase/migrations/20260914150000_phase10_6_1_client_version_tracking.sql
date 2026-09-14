-- Phase 10.6.1 - client version presence + admin update targeting.

create table if not exists public.client_app_sessions (
  user_id uuid not null references public.profiles(id) on delete cascade,
  client_id text not null,
  app_version text not null,
  build_id text not null,
  is_pwa boolean not null default false,
  platform text,
  user_agent text,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  primary key (user_id, client_id),
  constraint client_app_sessions_client_id_not_blank check (length(trim(client_id)) > 0),
  constraint client_app_sessions_app_version_not_blank check (length(trim(app_version)) > 0),
  constraint client_app_sessions_build_id_not_blank check (length(trim(build_id)) > 0)
);

create index if not exists client_app_sessions_last_seen_idx
  on public.client_app_sessions(last_seen_at desc);

alter table public.client_app_sessions enable row level security;
revoke all on public.client_app_sessions from anon, authenticated;

create or replace function public.report_my_client_version(
  requested_client_id text,
  requested_app_version text,
  requested_build_id text,
  requested_is_pwa boolean default false,
  requested_platform text default null,
  requested_user_agent text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'not authenticated';
  end if;

  if not exists (
    select 1 from public.profiles p
    where p.id = current_user_id and p.is_active = true
  ) then
    raise exception 'user not active';
  end if;

  if nullif(trim(requested_client_id), '') is null
     or nullif(trim(requested_app_version), '') is null
     or nullif(trim(requested_build_id), '') is null then
    raise exception 'invalid client version payload';
  end if;

  insert into public.client_app_sessions (
    user_id,
    client_id,
    app_version,
    build_id,
    is_pwa,
    platform,
    user_agent,
    last_seen_at
  ) values (
    current_user_id,
    left(trim(requested_client_id), 160),
    left(trim(requested_app_version), 80),
    left(trim(requested_build_id), 120),
    coalesce(requested_is_pwa, false),
    nullif(left(trim(coalesce(requested_platform, '')), 160), ''),
    nullif(left(trim(coalesce(requested_user_agent, '')), 600), ''),
    now()
  )
  on conflict (user_id, client_id) do update set
    app_version = excluded.app_version,
    build_id = excluded.build_id,
    is_pwa = excluded.is_pwa,
    platform = excluded.platform,
    user_agent = excluded.user_agent,
    last_seen_at = now();
end;
$function$;

revoke all on function public.report_my_client_version(text,text,text,boolean,text,text) from public;
grant execute on function public.report_my_client_version(text,text,text,boolean,text,text) to authenticated;

create or replace function public.get_client_version_admin_overview(
  requested_current_version text,
  requested_current_build_id text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  current_user_id uuid := auth.uid();
  current_permissions text[];
  users_json jsonb;
  summary_json jsonb;
begin
  if current_user_id is null then
    raise exception 'not authenticated';
  end if;

  current_permissions := coalesce(public.get_my_permissions(), array[]::text[]);

  if not exists (
      select 1 from public.profiles p
      where p.id = current_user_id
        and p.is_active = true
        and p.role::text = 'admin'
    )
    and not ('users.manage' = any(current_permissions))
    and not ('notifications.manage' = any(current_permissions)) then
    raise exception 'not allowed';
  end if;

  with user_rows as (
    select
      p.id as user_id,
      p.display_name,
      p.email,
      p.is_active,
      p.last_login_at,
      latest.app_version as latest_version,
      latest.build_id as latest_build_id,
      latest.last_seen_at as latest_seen_at,
      latest.is_pwa as latest_is_pwa,
      coalesce(devices.device_count, 0)::int as device_count,
      coalesce(devices.current_device_count, 0)::int as current_device_count,
      coalesce(devices.outdated_device_count, 0)::int as outdated_device_count,
      case
        when coalesce(devices.device_count, 0) = 0 then 'unknown'
        when coalesce(devices.outdated_device_count, 0) = 0 then 'current'
        when coalesce(devices.current_device_count, 0) > 0 then 'mixed'
        else 'outdated'
      end as version_status,
      coalesce(job_types.items, '[]'::jsonb) as job_types
    from public.profiles p
    left join lateral (
      select s.app_version, s.build_id, s.last_seen_at, s.is_pwa
      from public.client_app_sessions s
      where s.user_id = p.id
      order by s.last_seen_at desc
      limit 1
    ) latest on true
    left join lateral (
      select
        count(*)::int as device_count,
        count(*) filter (where s.build_id = requested_current_build_id)::int as current_device_count,
        count(*) filter (where s.build_id <> requested_current_build_id)::int as outdated_device_count
      from public.client_app_sessions s
      where s.user_id = p.id
    ) devices on true
    left join lateral (
      select coalesce(
        jsonb_agg(
          distinct jsonb_build_object('id', jt.id, 'name', jt.name)
        ),
        '[]'::jsonb
      ) as items
      from public.job_type_memberships m
      join public.job_types jt on jt.id = m.job_type_id
      where m.user_id = p.id
        and jt.is_active = true
        and jt.legacy_role is null
    ) job_types on true
    where p.is_active = true
  )
  select
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'userId', u.user_id,
          'displayName', u.display_name,
          'email', u.email,
          'isActive', u.is_active,
          'lastLoginAt', u.last_login_at,
          'latestVersion', u.latest_version,
          'latestBuildId', u.latest_build_id,
          'latestSeenAt', u.latest_seen_at,
          'latestIsPwa', u.latest_is_pwa,
          'deviceCount', u.device_count,
          'currentDeviceCount', u.current_device_count,
          'outdatedDeviceCount', u.outdated_device_count,
          'status', u.version_status,
          'jobTypes', u.job_types
        )
        order by u.display_name
      ),
      '[]'::jsonb
    ),
    jsonb_build_object(
      'total', count(*),
      'current', count(*) filter (where u.version_status = 'current'),
      'mixed', count(*) filter (where u.version_status = 'mixed'),
      'outdated', count(*) filter (where u.version_status = 'outdated'),
      'unknown', count(*) filter (where u.version_status = 'unknown')
    )
  into users_json, summary_json
  from user_rows u;

  return jsonb_build_object(
    'currentVersion', requested_current_version,
    'currentBuildId', requested_current_build_id,
    'users', users_json,
    'summary', summary_json
  );
end;
$function$;

revoke all on function public.get_client_version_admin_overview(text,text) from public;
grant execute on function public.get_client_version_admin_overview(text,text) to authenticated;
