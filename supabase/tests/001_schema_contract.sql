begin;

select plan(41);

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

select * from finish();
rollback;
