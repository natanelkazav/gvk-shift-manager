-- Phase 9.0: central Dynamic-first pilot cutover switch.
create table if not exists public.dynamic_cutover_settings (
  singleton boolean primary key default true check (singleton),
  dynamic_first_enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid null references public.profiles(id)
);

insert into public.dynamic_cutover_settings(singleton, dynamic_first_enabled)
values (true, false)
on conflict (singleton) do nothing;

alter table public.dynamic_cutover_settings enable row level security;
revoke all on public.dynamic_cutover_settings from anon, authenticated;

drop function if exists public.get_dynamic_cutover_state();
create function public.get_dynamic_cutover_state()
returns jsonb
language plpgsql security definer set search_path=public
as $$
declare v_enabled boolean := false; v_user uuid := auth.uid(); v_has_membership boolean := false;
begin
  select dynamic_first_enabled into v_enabled from public.dynamic_cutover_settings where singleton=true;
  if v_user is not null then
    select exists(
      select 1 from public.job_type_memberships m
      join public.job_types jt on jt.id=m.job_type_id and jt.is_active=true
      where m.user_id=v_user
    ) into v_has_membership;
  end if;
  return jsonb_build_object(
    'dynamicFirstEnabled', coalesce(v_enabled,false),
    'hasDynamicMembership', v_has_membership,
    'useDynamicRuntime', coalesce(v_enabled,false) and v_has_membership
  );
end $$;
grant execute on function public.get_dynamic_cutover_state() to authenticated;

drop function if exists public.set_dynamic_cutover_state(boolean);
create function public.set_dynamic_cutover_state(p_enabled boolean)
returns jsonb
language plpgsql security definer set search_path=public
as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'not authenticated'; end if;
  if not exists(select 1 from public.user_permissions up where up.user_id=v_user and up.permission_key='users.manage') then
    raise exception 'not allowed';
  end if;
  insert into public.dynamic_cutover_settings(singleton,dynamic_first_enabled,updated_at,updated_by)
  values(true,p_enabled,now(),v_user)
  on conflict(singleton) do update set dynamic_first_enabled=excluded.dynamic_first_enabled,updated_at=now(),updated_by=v_user;
  return public.get_dynamic_cutover_state();
end $$;
grant execute on function public.set_dynamic_cutover_state(boolean) to authenticated;
