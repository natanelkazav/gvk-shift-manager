begin;

select plan(79);

select has_table('public', 'profiles', 'profiles table exists');
select has_table('public', 'schedule_shifts', 'schedule_shifts table exists');
select has_table('public', 'calendar_special_days', 'calendar_special_days table exists');
select has_table('public', 'holidays', 'holidays compatibility table exists');

select has_column('public', 'profiles', 'is_active', 'profiles.is_active exists');
select has_column('public', 'profiles', 'deactivated_at', 'profiles.deactivated_at exists');
select has_column('public', 'profiles', 'hourly_rate', 'dispatcher hourly rate exists');
select has_column('public', 'profiles', 'daily_duty_rate', 'driver daily duty rate exists');
select has_column('public', 'profiles', 'morning_shift_rate', 'morning-driver per-shift rate exists');
select has_column('public', 'schedule_shifts', 'is_intentionally_unassigned', 'intentional unassignment flag exists');
select has_column('public', 'morning_driver_schedule_assignments', 'is_intentionally_unassigned', 'morning-driver intentional unassignment flag exists');


select has_function('public', 'rebuild_availability_period_slots', 'dispatcher availability rebuild RPC exists');
select has_function('public', 'create_morning_driver_availability_period', 'morning-driver availability creation RPC exists');

select ok(
  position(
    "holiday_schedule_type_value = 'holiday_eve'::public.schedule_type"
    in pg_get_functiondef(
      'public.create_morning_driver_availability_period(integer,integer,text,text,timestamp with time zone)'::regprocedure
    )
  ) > 0,
  'morning-driver holiday eve has an explicit Friday-pattern branch'
);

select ok(
  position(
    "'holiday_end'::public.schedule_type"
    in pg_get_functiondef(
      'public.create_morning_driver_availability_period(integer,integer,text,text,timestamp with time zone)'::regprocedure
    )
  ) > 0,
  'morning-driver holiday-end days are handled explicitly'
);

select has_function('public', 'get_my_dashboard', 'dispatcher/general dashboard RPC exists');
select has_function('public', 'get_my_morning_driver_dashboard', 'morning-driver dashboard RPC exists');
select has_function('public', 'get_calendar_holidays', 'calendar holiday RPC exists');
select has_function('public', 'get_statistics_dashboard', 'statistics dashboard RPC exists');
select has_function('public', 'get_statistics_people', 'statistics people RPC exists');
select has_function('public', 'get_morning_driver_statistics', 'morning-driver statistics RPC exists');
select has_function('public', 'get_shift_time_distribution_statistics', 'shift-time distribution statistics RPC exists');
select has_function('public', 'get_dispatcher_availability_statistics', 'dispatcher availability statistics RPC exists');
select has_function('public', 'get_payroll_statistics', 'payroll RPC exists');
select has_function('public', 'save_schedule_draft', 'dispatcher draft save RPC exists');
select has_function('public', 'publish_schedule_period', 'dispatcher publish RPC exists');
select has_function('public', 'update_schedule_draft_shift', 'dispatcher draft edit RPC exists');
select has_function('public', 'get_schedule_draft_edit_context', 'dispatcher draft edit context RPC exists');
select has_function('public', 'create_driver_schedule_draft', 'driver schedule draft RPC exists');
select has_function('public', 'publish_driver_schedule', 'driver publish RPC exists');
select has_function('public', 'create_morning_driver_schedule_draft', 'morning-driver schedule draft RPC exists');
select has_function('public', 'publish_morning_driver_schedule', 'morning-driver publish RPC exists');
select has_function('public', 'set_morning_driver_assignment_intentionally_unassigned', 'morning-driver intentional unassignment RPC exists');
select has_function('public', 'get_my_driver_availability', 'driver availability RPC exists');
select has_function('public', 'get_my_morning_driver_availability', 'morning-driver availability RPC exists');
select has_function('public', 'get_shift_swap_create_options', 'shift-swap create options RPC exists');
select has_function('public', 'get_shift_swap_requests', 'shift-swap requests RPC exists');
select has_function('public', 'validate_shift_swap_final_state', 'shift-swap final-state validator exists');
select has_function('public', 'create_schedule_publication_notification', 'schedule publication notification RPC exists');

select ok(
  exists (
    select 1
    from pg_enum enum_value
    join pg_type enum_type on enum_type.oid = enum_value.enumtypid
    join pg_namespace enum_schema on enum_schema.oid = enum_type.typnamespace
    where enum_schema.nspname = 'public'
      and enum_type.typname = 'user_role'
      and enum_value.enumlabel = 'morning_driver'
  ),
  'user_role includes morning_driver'
);

select ok(
  not exists (
    select 1
    from pg_type type_row
    join pg_namespace schema_row on schema_row.oid = type_row.typnamespace
    where schema_row.nspname = 'public'
      and type_row.typname = 'morning_driver_schedule_period_status'
  ),
  'obsolete morning_driver_schedule_period_status type is not required'
);


select has_table('public', 'schedule_groups', 'dynamic schedule groups foundation exists');
select has_table('public', 'job_types', 'dynamic job types foundation exists');
select has_table('public', 'schedule_group_shift_templates', 'generic shift templates foundation exists');
select has_table('public', 'schedule_group_day_rules', 'generic day/holiday rules foundation exists');
select has_table('public', 'schedule_shift_pay_segments', 'partial-shift pay segments foundation exists');
select has_table('public', 'job_type_memberships', 'shadow job-type memberships foundation exists');
select has_table('public', 'job_type_ai_suggestions', 'AI suggestion review queue exists');
select has_function('public', 'get_dynamic_scheduling_admin', 'dynamic scheduling admin read RPC exists');
select has_function('public', 'save_dynamic_job_type', 'dynamic job type save RPC exists');

select has_table('public', 'schedule_group_versions', 'schedule-group version history exists');
select has_column('public', 'schedule_group_shift_templates', 'target_workers', 'shift template target workers exists');
select has_column('public', 'schedule_group_shift_templates', 'max_workers', 'shift template maximum workers exists');
select has_function('public', 'save_dynamic_schedule_group', 'dynamic schedule group save RPC exists');
select has_function('public', 'preview_dynamic_schedule_group', 'dynamic schedule group preview RPC exists');
select is(
  (select config->>'phase' from public.scheduling_feature_flags where key = 'dynamic_job_types'),
  '6',
  'dynamic job types configuration reached current shadow phase'
);
select is(
  (select enabled from public.scheduling_feature_flags where key = 'dynamic_job_types'),
  false,
  'dynamic job types remain disabled in Phase 1'
);
select is(
  (select config->>'mode' from public.scheduling_feature_flags where key = 'dynamic_job_types'),
  'shadow',
  'dynamic job types start in shadow mode'
);


select has_table('public', 'dynamic_availability_periods', 'dynamic availability periods foundation exists');
select has_table('public', 'dynamic_availability_slots', 'dynamic availability slots foundation exists');
select has_table('public', 'dynamic_availability_submissions', 'dynamic availability submissions foundation exists');
select has_table('public', 'dynamic_availability_entries', 'dynamic availability entries foundation exists');
select has_function('public', 'create_dynamic_availability_shadow_period', 'dynamic availability shadow materializer exists');
select has_function('public', 'get_dynamic_availability_shadow_summary', 'dynamic availability shadow summary exists');
select is((select config->>'phase' from public.scheduling_feature_flags where key='dynamic_job_types'), '6', 'dynamic scheduling reached current shadow phase');
select is((select config->>'availability_engine' from public.scheduling_feature_flags where key='dynamic_job_types'), 'shadow', 'dynamic availability engine remains shadow-only');
select is((select enabled from public.scheduling_feature_flags where key='dynamic_job_types'), false, 'dynamic scheduling remains disabled during Phase 4');


select has_column('public', 'job_types', 'scheduling_config', 'job type scheduling configuration exists');
select has_table('public', 'scheduling_rule_registry', 'generic scheduling rule registry exists');
select has_table('public', 'dynamic_schedule_shadow_drafts', 'shadow schedule drafts exist');
select has_table('public', 'dynamic_schedule_shadow_targets', 'shadow proportional targets exist');
select has_table('public', 'dynamic_schedule_shadow_assignments', 'shadow schedule assignments exist');
select has_function('public', 'analyze_dynamic_schedule_feasibility', 'dynamic scheduling feasibility analyzer exists');
select has_function('public', 'create_dynamic_schedule_shadow_draft', 'dynamic scheduling optimizer exists');
select has_function('public', 'get_dynamic_schedule_shadow_draft', 'dynamic shadow draft read RPC exists');
select has_function('public', 'submit_dynamic_scheduling_rule_proposal', 'natural-language scheduling rule proposal queue exists');
select is((select config->>'phase' from public.scheduling_feature_flags where key='dynamic_job_types'), '6', 'dynamic scheduling reached current shadow phase');
select is((select config->>'scheduling_engine' from public.scheduling_feature_flags where key='dynamic_job_types'), 'shadow', 'generic scheduling engine remains shadow-only');
select is((select enabled from public.scheduling_feature_flags where key='dynamic_job_types'), false, 'dynamic scheduling remains disabled during Phase 5');

-- Phase 5.5 Safe Development Mode contracts
select has_table('public', 'admin_development_sessions', 'safe development mode session table exists');
select has_function('public', 'get_my_development_mode', 'development mode state RPC exists');
select has_function('public', 'set_my_development_mode', 'development mode toggle RPC exists');
select has_function('public', 'is_my_development_mode', 'development mode guard helper exists');

-- Phase 6 Dynamic Availability UI / comparison contracts
select has_function('public', 'get_dynamic_availability_shadow_workspace', 'dynamic availability admin workspace exists');
select has_function('public', 'save_dynamic_availability_shadow_submission', 'dynamic availability shadow submission writer exists');
select has_function('public', 'compare_dynamic_availability_shadow_to_legacy', 'dynamic availability legacy comparison exists');
select is((select config->>'phase' from public.scheduling_feature_flags where key='dynamic_job_types'), '6', 'dynamic scheduling reached Phase 6');
select is((select enabled from public.scheduling_feature_flags where key='dynamic_job_types'), false, 'dynamic scheduling remains disabled during Phase 6');

select * from finish();
rollback;
