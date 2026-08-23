[
  {
    "table_name": "driver_availability_entries",
    "trigger_name": "set_driver_availability_entries_updated_at",
    "action_timing": "BEFORE",
    "event_manipulation": "UPDATE",
    "action_statement": "EXECUTE FUNCTION set_updated_at()"
  },
  {
    "table_name": "driver_availability_periods",
    "trigger_name": "set_driver_availability_periods_updated_at",
    "action_timing": "BEFORE",
    "event_manipulation": "UPDATE",
    "action_statement": "EXECUTE FUNCTION set_updated_at()"
  },
  {
    "table_name": "driver_availability_submissions",
    "trigger_name": "set_driver_availability_submissions_updated_at",
    "action_timing": "BEFORE",
    "event_manipulation": "UPDATE",
    "action_statement": "EXECUTE FUNCTION set_updated_at()"
  },
  {
    "table_name": "driver_schedule_days",
    "trigger_name": "record_driver_schedule_assignment_change",
    "action_timing": "AFTER",
    "event_manipulation": "UPDATE",
    "action_statement": "EXECUTE FUNCTION record_driver_schedule_assignment_change()"
  },
  {
    "table_name": "driver_schedule_days",
    "trigger_name": "set_driver_schedule_days_updated_at",
    "action_timing": "BEFORE",
    "event_manipulation": "UPDATE",
    "action_statement": "EXECUTE FUNCTION set_updated_at()"
  },
  {
    "table_name": "driver_schedule_periods",
    "trigger_name": "set_driver_schedule_periods_updated_at",
    "action_timing": "BEFORE",
    "event_manipulation": "UPDATE",
    "action_statement": "EXECUTE FUNCTION set_updated_at()"
  },
  {
    "table_name": "holidays",
    "trigger_name": "set_holidays_updated_at",
    "action_timing": "BEFORE",
    "event_manipulation": "UPDATE",
    "action_statement": "EXECUTE FUNCTION set_updated_at()"
  },
  {
    "table_name": "notification_preferences",
    "trigger_name": "set_notification_preferences_updated_at",
    "action_timing": "BEFORE",
    "event_manipulation": "UPDATE",
    "action_statement": "EXECUTE FUNCTION set_push_updated_at()"
  },
  {
    "table_name": "profiles",
    "trigger_name": "on_profile_created_apply_permissions",
    "action_timing": "AFTER",
    "event_manipulation": "INSERT",
    "action_statement": "EXECUTE FUNCTION handle_profile_permissions_created()"
  },
  {
    "table_name": "profiles",
    "trigger_name": "on_profile_updated_write_audit",
    "action_timing": "AFTER",
    "event_manipulation": "UPDATE",
    "action_statement": "EXECUTE FUNCTION handle_profile_audit_update()"
  },
  {
    "table_name": "profiles",
    "trigger_name": "set_profiles_updated_at",
    "action_timing": "BEFORE",
    "event_manipulation": "UPDATE",
    "action_statement": "EXECUTE FUNCTION set_updated_at()"
  },
  {
    "table_name": "push_subscriptions",
    "trigger_name": "set_push_subscriptions_updated_at",
    "action_timing": "BEFORE",
    "event_manipulation": "UPDATE",
    "action_statement": "EXECUTE FUNCTION set_push_updated_at()"
  },
  {
    "table_name": "schedule_periods",
    "trigger_name": "set_schedule_periods_updated_at",
    "action_timing": "BEFORE",
    "event_manipulation": "UPDATE",
    "action_statement": "EXECUTE FUNCTION set_updated_at()"
  },
  {
    "table_name": "schedule_shifts",
    "trigger_name": "record_schedule_assignment_change",
    "action_timing": "AFTER",
    "event_manipulation": "UPDATE",
    "action_statement": "EXECUTE FUNCTION record_schedule_assignment_change()"
  },
  {
    "table_name": "schedule_shifts",
    "trigger_name": "set_schedule_shifts_updated_at",
    "action_timing": "BEFORE",
    "event_manipulation": "UPDATE",
    "action_statement": "EXECUTE FUNCTION set_updated_at()"
  },
  {
    "table_name": "shift_swap_requests",
    "trigger_name": "set_shift_swap_requests_updated_at",
    "action_timing": "BEFORE",
    "event_manipulation": "UPDATE",
    "action_statement": "EXECUTE FUNCTION set_updated_at()"
  }
]