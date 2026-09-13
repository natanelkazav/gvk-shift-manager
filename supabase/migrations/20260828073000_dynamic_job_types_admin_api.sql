begin;


-- Seed Phase-2 default permissions so the three legacy job types are represented
-- the same way they are currently created in the frontend. These rows are still
-- configuration only while the feature flag is disabled.
insert into public.job_type_default_permissions (job_type_id, permission_key, source)
select jt.id, seed.permission_key, 'seed'
from public.job_types jt
join (values
  ('dispatcher','dashboard.view'),
  ('dispatcher','schedule.view'),
  ('dispatcher','availability.view'),
  ('dispatcher','notifications.view'),
  ('dispatcher','shift_swaps.view'),
  ('on_call','dashboard.view'),
  ('on_call','driver_availability.view'),
  ('on_call','driver_schedule.view'),
  ('on_call','driver_schedule.edit_any'),
  ('on_call','notifications.view'),
  ('morning_driver','dashboard.view'),
  ('morning_driver','morning_driver_availability.view'),
  ('morning_driver','morning_driver_schedule.view'),
  ('morning_driver','morning_driver_schedule.edit_any'),
  ('morning_driver','notifications.view')
) as seed(job_code, permission_key)
  on seed.job_code = jt.code
on conflict (job_type_id, permission_key) do nothing;

insert into public.job_type_capabilities (job_type_id, capability_key, enabled, source)
select jt.id, seed.capability_key, true, 'seed'
from public.job_types jt
join (values
  ('dispatcher','shift_swaps'),
  ('dispatcher','monthly_shift_capacity'),
  ('dispatcher','payroll'),
  ('on_call','payroll'),
  ('morning_driver','payroll')
) as seed(job_code, capability_key)
  on seed.job_code = jt.code
on conflict (job_type_id, capability_key)
do update set enabled = true;

create or replace function public.get_dynamic_scheduling_admin()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  current_user_id uuid := auth.uid();
  can_view boolean := false;
begin
  if current_user_id is null then
    raise exception 'not authenticated';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = current_user_id
      and p.is_active = true
  ) then
    raise exception 'user not active';
  end if;

  select exists (
    select 1
    from public.user_permissions up
    where up.user_id = current_user_id
      and up.permission_key in ('users.view', 'users.manage')
  ) into can_view;

  if not can_view then
    raise exception 'not allowed';
  end if;

  return jsonb_build_object(
    'featureEnabled', coalesce((
      select f.enabled
      from public.scheduling_feature_flags f
      where f.key = 'dynamic_job_types'
    ), false),
    'featureMode', coalesce((
      select f.config ->> 'mode'
      from public.scheduling_feature_flags f
      where f.key = 'dynamic_job_types'
    ), 'shadow'),
    'scheduleGroups', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', sg.id,
          'code', sg.code,
          'name', sg.name,
          'description', sg.description,
          'isActive', sg.is_active,
          'legacyKind', sg.legacy_kind,
          'shiftTemplates', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'id', st.id,
                'code', st.code,
                'name', st.name,
                'dayKind', st.day_kind,
                'startTime', st.start_time,
                'endTime', st.end_time,
                'requiredWorkers', st.required_workers,
                'sortOrder', st.sort_order
              )
              order by st.day_kind, st.sort_order, st.start_time
            )
            from public.schedule_group_shift_templates st
            where st.schedule_group_id = sg.id
          ), '[]'::jsonb),
          'dayRules', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'dayKind', dr.day_kind,
                'behavior', dr.behavior,
                'inheritDayKind', dr.inherit_day_kind
              )
              order by dr.day_kind
            )
            from public.schedule_group_day_rules dr
            where dr.schedule_group_id = sg.id
          ), '[]'::jsonb)
        )
        order by sg.name
      )
      from public.schedule_groups sg
    ), '[]'::jsonb),
    'jobTypes', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', jt.id,
          'scheduleGroupId', jt.schedule_group_id,
          'code', jt.code,
          'name', jt.name,
          'description', jt.description,
          'isActive', jt.is_active,
          'legacyRole', jt.legacy_role,
          'employmentScope', jt.employment_scope,
          'payModel', jt.pay_model,
          'payConfig', jt.pay_config,
          'availabilityConfig', jt.availability_config,
          'statisticsConfig', jt.statistics_config,
          'aiConfig', jt.ai_config,
          'capabilities', coalesce((
            select jsonb_agg(c.capability_key order by c.capability_key)
            from public.job_type_capabilities c
            where c.job_type_id = jt.id
              and c.enabled = true
          ), '[]'::jsonb),
          'defaultPermissions', coalesce((
            select jsonb_agg(dp.permission_key order by dp.permission_key)
            from public.job_type_default_permissions dp
            where dp.job_type_id = jt.id
          ), '[]'::jsonb),
          'memberCount', (
            select count(*)
            from public.job_type_memberships m
            where m.job_type_id = jt.id
          )
        )
        order by jt.is_active desc, jt.name
      )
      from public.job_types jt
    ), '[]'::jsonb)
  );
end;
$function$;

revoke all on function public.get_dynamic_scheduling_admin() from public;
grant execute on function public.get_dynamic_scheduling_admin() to authenticated;

create or replace function public.save_dynamic_job_type(
  requested_payload jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  current_user_id uuid := auth.uid();
  target_id uuid;
  target_group_id uuid;
  target_code text;
  target_name text;
  target_description text;
  target_scope text;
  target_pay_model text;
  target_is_active boolean;
  target_pay_config jsonb;
  target_availability_config jsonb;
  target_statistics_config jsonb;
  capability_value jsonb;
  permission_value jsonb;
begin
  if current_user_id is null then
    raise exception 'not authenticated';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = current_user_id
      and p.is_active = true
  ) then
    raise exception 'user not active';
  end if;

  if not exists (
    select 1
    from public.user_permissions up
    where up.user_id = current_user_id
      and up.permission_key = 'users.manage'
  ) then
    raise exception 'not allowed';
  end if;

  target_id := nullif(requested_payload ->> 'id', '')::uuid;
  target_group_id := nullif(requested_payload ->> 'scheduleGroupId', '')::uuid;
  target_code := lower(trim(coalesce(requested_payload ->> 'code', '')));
  target_name := trim(coalesce(requested_payload ->> 'name', ''));
  target_description := nullif(trim(coalesce(requested_payload ->> 'description', '')), '');
  target_scope := coalesce(requested_payload ->> 'employmentScope', 'flexible');
  target_pay_model := coalesce(requested_payload ->> 'payModel', 'none');
  target_is_active := coalesce((requested_payload ->> 'isActive')::boolean, true);
  target_pay_config := coalesce(requested_payload -> 'payConfig', '{}'::jsonb);
  target_availability_config := coalesce(requested_payload -> 'availabilityConfig', '{}'::jsonb);
  target_statistics_config := coalesce(requested_payload -> 'statisticsConfig', '{}'::jsonb);

  if target_group_id is null or not exists (
    select 1 from public.schedule_groups sg where sg.id = target_group_id
  ) then
    raise exception 'schedule group not found';
  end if;

  if target_code = '' or target_code !~ '^[a-z0-9_]+$' then
    raise exception 'invalid job type code';
  end if;

  if target_name = '' then
    raise exception 'job type name is required';
  end if;

  if target_scope not in ('full_time','part_time','flexible','other') then
    raise exception 'invalid employment scope';
  end if;

  if target_pay_model not in ('hourly','per_shift','per_day','mixed','none') then
    raise exception 'invalid pay model';
  end if;

  if target_id is null then
    insert into public.job_types (
      schedule_group_id,
      code,
      name,
      description,
      is_active,
      employment_scope,
      pay_model,
      pay_config,
      availability_config,
      statistics_config,
      ai_config
    ) values (
      target_group_id,
      target_code,
      target_name,
      target_description,
      target_is_active,
      target_scope,
      target_pay_model,
      target_pay_config,
      target_availability_config,
      target_statistics_config,
      '{"allow_suggestions":true,"auto_apply":false}'::jsonb
    )
    returning id into target_id;
  else
    if not exists (select 1 from public.job_types jt where jt.id = target_id) then
      raise exception 'job type not found';
    end if;

    update public.job_types
    set schedule_group_id = target_group_id,
        code = case when legacy_role is null then target_code else code end,
        name = target_name,
        description = target_description,
        is_active = target_is_active,
        employment_scope = target_scope,
        pay_model = target_pay_model,
        pay_config = target_pay_config,
        availability_config = target_availability_config,
        statistics_config = target_statistics_config
    where id = target_id;
  end if;

  delete from public.job_type_capabilities
  where job_type_id = target_id;

  for capability_value in
    select value
    from jsonb_array_elements(coalesce(requested_payload -> 'capabilities', '[]'::jsonb))
  loop
    insert into public.job_type_capabilities (
      job_type_id,
      capability_key,
      enabled,
      source
    ) values (
      target_id,
      trim(both '"' from capability_value::text),
      true,
      'manual'
    )
    on conflict (job_type_id, capability_key)
    do update set enabled = true, source = 'manual';
  end loop;

  delete from public.job_type_default_permissions
  where job_type_id = target_id;

  for permission_value in
    select value
    from jsonb_array_elements(coalesce(requested_payload -> 'defaultPermissions', '[]'::jsonb))
  loop
    insert into public.job_type_default_permissions (
      job_type_id,
      permission_key,
      source
    ) values (
      target_id,
      trim(both '"' from permission_value::text),
      'manual'
    )
    on conflict (job_type_id, permission_key) do nothing;
  end loop;

  return target_id;
end;
$function$;

revoke all on function public.save_dynamic_job_type(jsonb) from public;
grant execute on function public.save_dynamic_job_type(jsonb) to authenticated;

commit;
