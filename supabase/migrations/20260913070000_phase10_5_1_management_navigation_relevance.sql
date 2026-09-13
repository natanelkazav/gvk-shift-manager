-- Phase 10.5.1
-- Dynamic-first must also be the operational shell for system administrators
-- and Job Type managers. They should not need an employee membership merely
-- to receive the new management navigation.

drop function if exists public.get_dynamic_cutover_state();
create function public.get_dynamic_cutover_state()
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_enabled boolean := false;
  v_user uuid := auth.uid();
  v_has_membership boolean := false;
  v_is_system_admin boolean := false;
  v_is_job_type_manager boolean := false;
  v_use_dynamic boolean := false;
begin
  select dynamic_first_enabled
    into v_enabled
  from public.dynamic_cutover_settings
  where singleton=true;

  if v_user is not null then
    select exists(
      select 1
      from public.job_type_memberships m
      join public.job_types jt
        on jt.id=m.job_type_id
       and jt.is_active=true
      where m.user_id=v_user
    ) into v_has_membership;

    select exists(
      select 1
      from public.profiles p
      where p.id=v_user
        and p.role='admin'
        and p.is_active=true
    ) into v_is_system_admin;

    select exists(
      select 1
      from public.job_type_managers jm
      join public.job_types jt
        on jt.id=jm.job_type_id
       and jt.is_active=true
      where jm.user_id=v_user
    ) into v_is_job_type_manager;
  end if;

  v_use_dynamic := coalesce(v_enabled,false)
    and (v_has_membership or v_is_system_admin or v_is_job_type_manager);

  return jsonb_build_object(
    'dynamicFirstEnabled', coalesce(v_enabled,false),
    'hasDynamicMembership', v_has_membership,
    'useDynamicRuntime', v_use_dynamic
  );
end
$$;

grant execute on function public.get_dynamic_cutover_state() to authenticated;
