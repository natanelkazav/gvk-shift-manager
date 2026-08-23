[
  {
    "table_name": "audit_logs",
    "column_name": "id",
    "data_type": "uuid",
    "udt_name": "uuid",
    "is_nullable": "NO",
    "column_default": "gen_random_uuid()",
    "ordinal_position": 1
  },
  {
    "table_name": "audit_logs",
    "column_name": "user_id",
    "data_type": "uuid",
    "udt_name": "uuid",
    "is_nullable": "YES",
    "column_default": null,
    "ordinal_position": 2
  },
  {
    "table_name": "audit_logs",
    "column_name": "action",
    "data_type": "text",
    "udt_name": "text",
    "is_nullable": "NO",
    "column_default": null,
    "ordinal_position": 3
  },
  {
    "table_name": "audit_logs",
    "column_name": "entity_type",
    "data_type": "text",
    "udt_name": "text",
    "is_nullable": "NO",
    "column_default": "'user'::text",
    "ordinal_position": 4
  },
  {
    "table_name": "audit_logs",
    "column_name": "entity_id",
    "data_type": "uuid",
    "udt_name": "uuid",
    "is_nullable": "YES",
    "column_default": null,
    "ordinal_position": 5
  },
  {
    "table_name": "audit_logs",
    "column_name": "old_values",
    "data_type": "jsonb",
    "udt_name": "jsonb",
    "is_nullable": "YES",
    "column_default": null,
    "ordinal_position": 6
  },
  {
    "table_name": "audit_logs",
    "column_name": "new_values",
    "data_type": "jsonb",
    "udt_name": "jsonb",
    "is_nullable": "YES",
    "column_default": null,
    "ordinal_position": 7
  },
  {
    "table_name": "audit_logs",
    "column_name": "metadata",
    "data_type": "jsonb",
    "udt_name": "jsonb",
    "is_nullable": "NO",
    "column_default": "'{}'::jsonb",
    "ordinal_position": 8
  },
  {
    "table_name": "audit_logs",
    "column_name": "created_at",
    "data_type": "timestamp with time zone",
    "udt_name": "timestamptz",
    "is_nullable": "NO",
    "column_default": "now()",
    "ordinal_position": 9
  },
  {
    "table_name": "audit_logs",
    "column_name": "actor_user_id",
    "data_type": "uuid",
    "udt_name": "uuid",
    "is_nullable": "YES",
    "column_default": null,
    "ordinal_position": 10
  },
  {
    "table_name": "audit_logs",
    "column_name": "actor_email",
    "data_type": "text",
    "udt_name": "text",
    "is_nullable": "YES",
    "column_default": null,
    "ordinal_position": 11
  },
  {
    "table_name": "audit_logs",
    "column_name": "actor_display_name",
    "data_type": "text",
    "udt_name": "text",
    "is_nullable": "YES",
    "column_default": null,
    "ordinal_position": 12
  },
  {
    "table_name": "audit_logs",
    "column_name": "target_user_id",
    "data_type": "uuid",
    "udt_name": "uuid",
    "is_nullable": "YES",
    "column_default": null,
    "ordinal_position": 13
  },
  {
    "table_name": "audit_logs",
    "column_name": "target_email",
    "data_type": "text",
    "udt_name": "text",
    "is_nullable": "YES",
    "column_default": null,
    "ordinal_position": 14
  },
  {
    "table_name": "audit_logs",
    "column_name": "target_display_name",
    "data_type": "text",
    "udt_name": "text",
    "is_nullable": "YES",
    "column_default": null,
    "ordinal_position": 15
  },
  {
    "table_name": "audit_logs",
    "column_name": "summary",
    "data_type": "text",
    "udt_name": "text",
    "is_nullable": "NO",
    "column_default": null,
    "ordinal_position": 16
  },
  {
    "table_name": "availability_periods",
    "column_name": "id",
    "data_type": "uuid",
    "udt_name": "uuid",
    "is_nullable": "NO",
    "column_default": "gen_random_uuid()",
    "ordinal_position": 1
  },
  {
    "table_name": "availability_periods",
    "column_name": "year",
    "data_type": "integer",
    "udt_name": "int4",
    "is_nullable": "NO",
    "column_default": null,
    "ordinal_position": 2
  },
  {
    "table_name": "availability_periods",
    "column_name": "month",
    "data_type": "integer",
    "udt_name": "int4",
    "is_nullable": "NO",
    "column_default": null,
    "ordinal_position": 3
  },
  {
    "table_name": "availability_periods",
    "column_name": "status",
    "data_type": "text",
    "udt_name": "text",
    "is_nullable": "NO",
    "column_default": "'draft'::text",
    "ordinal_position": 4
  },
  {
    "table_name": "availability_periods",
    "column_name": "title",
    "data_type": "text",
    "udt_name": "text",
    "is_nullable": "YES",
    "column_default": null,
    "ordinal_position": 5
  },
  {
    "table_name": "availability_periods",
    "column_name": "instructions",
    "data_type": "text",
    "udt_name": "text",
    "is_nullable": "YES",
    "column_default": null,
    "ordinal_position": 6
  },
  {
    "table_name": "availability_periods",
    "column_name": "submission_deadline",
    "data_type": "timestamp with time zone",
    "udt_name": "timestamptz",
    "is_nullable": "YES",
    "column_default": null,
    "ordinal_position": 7
  },
  {
    "table_name": "availability_periods",
    "column_name": "opened_at",
    "data_type": "timestamp with time zone",
    "udt_name": "timestamptz",
    "is_nullable": "YES",
    "column_default": null,
    "ordinal_position": 8
  },
  {
    "table_name": "availability_periods",
    "column_name": "closed_at",
    "data_type": "timestamp with time zone",
    "udt_name": "timestamptz",
    "is_nullable": "YES",
    "column_default": null,
    "ordinal_position": 9
  },
  {
    "table_name": "availability_periods",
    "column_name": "created_by",
    "data_type": "uuid",
    "udt_name": "uuid",
    "is_nullable": "YES",
    "column_default": null,
    "ordinal_position": 10
  },
  {
    "table_name": "availability_periods",
    "column_name": "updated_by",
    "data_type": "uuid",
    "udt_name": "uuid",
    "is_nullable": "YES",
    "column_default": null,
    "ordinal_position": 11
  },
  {
    "table_name": "availability_periods",
    "column_name": "created_at",
    "data_type": "timestamp with time zone",
    "udt_name": "timestamptz",
    "is_nullable": "NO",
    "column_default": "now()",
    "ordinal_position": 12
  },
  {
    "table_name": "availability_periods",
    "column_name": "updated_at",
    "data_type": "timestamp with time zone",
    "udt_name": "timestamptz",
    "is_nullable": "NO",
    "column_default": "now()",
    "ordinal_position": 13
  },
  {
    "table_name": "availability_shift_slots",
    "column_name": "id",
    "data_type": "uuid",
    "udt_name": "uuid",
    "is_nullable": "NO",
    "column_default": "gen_random_uuid()",
    "ordinal_position": 1
  },
  {
    "table_name": "availability_shift_slots",
    "column_name": "period_id",
    "data_type": "uuid",
    "udt_name": "uuid",
    "is_nullable": "NO",
    "column_default": null,
    "ordinal_position": 2
  },
  {
    "table_name": "availability_shift_slots",
    "column_name": "shift_date",
    "data_type": "date",
    "udt_name": "date",
    "is_nullable": "NO",
    "column_default": null,
    "ordinal_position": 3
  },
  {
    "table_name": "availability_shift_slots",
    "column_name": "weekday_number",
    "data_type": "integer",
    "udt_name": "int4",
    "is_nullable": "NO",
    "column_default": null,
    "ordinal_position": 4
  },
  {
    "table_name": "availability_shift_slots",
    "column_name": "weekday_name",
    "data_type": "text",
    "udt_name": "text",
    "is_nullable": "NO",
    "column_default": null,
    "ordinal_position": 5
  },
  {
    "table_name": "availability_shift_slots",
    "column_name": "start_time",
    "data_type": "time without time zone",
    "udt_name": "time",
    "is_nullable": "NO",
    "column_default": null,
    "ordinal_position": 6
  },
  {
    "table_name": "availability_shift_slots",
    "column_name": "end_time",
    "data_type": "time without time zone",
    "udt_name": "time",
    "is_nullable": "NO",
    "column_default": null,
    "ordinal_position": 7
  },
  {
    "table_name": "availability_shift_slots",
    "column_name": "ends_next_day",
    "data_type": "boolean",
    "udt_name": "bool",
    "is_nullable": "NO",
    "column_default": "false",
    "ordinal_position": 8
  },
  {
    "table_name": "availability_shift_slots",
    "column_name": "schedule_type",
    "data_type": "text",
    "udt_name": "text",
    "is_nullable": "NO",
    "column_default": null,
    "ordinal_position": 9
  },
  {
    "table_name": "availability_shift_slots",
    "column_name": "holiday_name",
    "data_type": "text",
    "udt_name": "text",
    "is_nullable": "YES",
    "column_default": null,
    "ordinal_position": 10
  },
  {
    "table_name": "availability_shift_slots",
    "column_name": "is_premium",
    "data_type": "boolean",
    "udt_name": "bool",
    "is_nullable": "NO",
    "column_default": "false",
    "ordinal_position": 11
  },
  {
    "table_name": "availability_shift_slots",
    "column_name": "sort_order",
    "data_type": "integer",
    "udt_name": "int4",
    "is_nullable": "NO",
    "column_default": "0",
    "ordinal_position": 12
  },
  {
    "table_name": "availability_shift_slots",
    "column_name": "created_at",
    "data_type": "timestamp with time zone",
    "udt_name": "timestamptz",
    "is_nullable": "NO",
    "column_default": "now()",
    "ordinal_position": 13
  },
  {
    "table_name": "availability_submissions",
    "column_name": "id",
    "data_type": "uuid",
    "udt_name": "uuid",
    "is_nullable": "NO",
    "column_default": "gen_random_uuid()",
    "ordinal_position": 1
  },
  {
    "table_name": "availability_submissions",
    "column_name": "period_id",
    "data_type": "uuid",
    "udt_name": "uuid",
    "is_nullable": "NO",
    "column_default": null,
    "ordinal_position": 2
  },
  {
    "table_name": "availability_submissions",
    "column_name": "user_id",
    "data_type": "uuid",
    "udt_name": "uuid",
    "is_nullable": "NO",
    "column_default": null,
    "ordinal_position": 3
  },
  {
    "table_name": "availability_submissions",
    "column_name": "status",
    "data_type": "text",
    "udt_name": "text",
    "is_nullable": "NO",
    "column_default": "'draft'::text",
    "ordinal_position": 4
  },
  {
    "table_name": "availability_submissions",
    "column_name": "submitted_at",
    "data_type": "timestamp with time zone",
    "udt_name": "timestamptz",
    "is_nullable": "YES",
    "column_default": null,
    "ordinal_position": 5
  },
  {
    "table_name": "availability_submissions",
    "column_name": "reopened_at",
    "data_type": "timestamp with time zone",
    "udt_name": "timestamptz",
    "is_nullable": "YES",
    "column_default": null,
    "ordinal_position": 6
  },
  {
    "table_name": "availability_submissions",
    "column_name": "last_saved_at",
    "data_type": "timestamp with time zone",
    "udt_name": "timestamptz",
    "is_nullable": "YES",
    "column_default": null,
    "ordinal_position": 7
  },
  {
    "table_name": "availability_submissions",
    "column_name": "available_count",
    "data_type": "integer",
    "udt_name": "int4",
    "is_nullable": "NO",
    "column_default": "0",
    "ordinal_position": 8
  },
  {
    "table_name": "availability_submissions",
    "column_name": "unavailable_count",
    "data_type": "integer",
    "udt_name": "int4",
    "is_nullable": "NO",
    "column_default": "0",
    "ordinal_position": 9
  },
  {
    "table_name": "availability_submissions",
    "column_name": "created_at",
    "data_type": "timestamp with time zone",
    "udt_name": "timestamptz",
    "is_nullable": "NO",
    "column_default": "now()",
    "ordinal_position": 10
  },
  {
    "table_name": "availability_submissions",
    "column_name": "updated_at",
    "data_type": "timestamp with time zone",
    "udt_name": "timestamptz",
    "is_nullable": "NO",
    "column_default": "now()",
    "ordinal_position": 11
  },
  {
    "table_name": "calendar_special_days",
    "column_name": "id",
    "data_type": "uuid",
    "udt_name": "uuid",
    "is_nullable": "NO",
    "column_default": "gen_random_uuid()",
    "ordinal_position": 1
  },
  {
    "table_name": "calendar_special_days",
    "column_name": "event_date",
    "data_type": "date",
    "udt_name": "date",
    "is_nullable": "NO",
    "column_default": null,
    "ordinal_position": 2
  },
  {
    "table_name": "calendar_special_days",
    "column_name": "event_name",
    "data_type": "text",
    "udt_name": "text",
    "is_nullable": "NO",
    "column_default": null,
    "ordinal_position": 3
  },
  {
    "table_name": "calendar_special_days",
    "column_name": "schedule_type",
    "data_type": "text",
    "udt_name": "text",
    "is_nullable": "NO",
    "column_default": null,
    "ordinal_position": 4
  },
  {
    "table_name": "calendar_special_days",
    "column_name": "holiday_group",
    "data_type": "text",
    "udt_name": "text",
    "is_nullable": "YES",
    "column_default": null,
    "ordinal_position": 5
  },
  {
    "table_name": "calendar_special_days",
    "column_name": "source_name",
    "data_type": "text",
    "udt_name": "text",
    "is_nullable": "NO",
    "column_default": "'manual'::text",
    "ordinal_position": 6
  },
  {
    "table_name": "calendar_special_days",
    "column_name": "source_event_key",
    "data_type": "text",
    "udt_name": "text",
    "is_nullable": "YES",
    "column_default": null,
    "ordinal_position": 7
  },
  {
    "table_name": "calendar_special_days",
    "column_name": "metadata",
    "data_type": "jsonb",
    "udt_name": "jsonb",
    "is_nullable": "NO",
    "column_default": "'{}'::jsonb",
    "ordinal_position": 8
  },
  {
    "table_name": "calendar_special_days",
    "column_name": "created_at",
    "data_type": "timestamp with time zone",
    "udt_name": "timestamptz",
    "is_nullable": "NO",
    "column_default": "now()",
    "ordinal_position": 9
  },
  {
    "table_name": "calendar_special_days",
    "column_name": "updated_at",
    "data_type": "timestamp with time zone",
    "udt_name": "timestamptz",
    "is_nullable": "NO",
    "column_default": "now()",
    "ordinal_position": 10
  },
  {
    "table_name": "dispatcher_availability",
    "column_name": "id",
    "data_type": "uuid",
    "udt_name": "uuid",
    "is_nullable": "NO",
    "column_default": "gen_random_uuid()",
    "ordinal_position": 1
  },
  {
    "table_name": "dispatcher_availability",
    "column_name": "period_id",
    "data_type": "uuid",
    "udt_name": "uuid",
    "is_nullable": "NO",
    "column_default": null,
    "ordinal_position": 2
  },
  {
    "table_name": "dispatcher_availability",
    "column_name": "shift_slot_id",
    "data_type": "uuid",
    "udt_name": "uuid",
    "is_nullable": "NO",
    "column_default": null,
    "ordinal_position": 3
  },
  {
    "table_name": "dispatcher_availability",
    "column_name": "user_id",
    "data_type": "uuid",
    "udt_name": "uuid",
    "is_nullable": "NO",
    "column_default": null,
    "ordinal_position": 4
  },
  {
    "table_name": "dispatcher_availability",
    "column_name": "availability_status",
    "data_type": "text",
    "udt_name": "text",
    "is_nullable": "NO",
    "column_default": null,
    "ordinal_position": 5
  },
  {
    "table_name": "dispatcher_availability",
    "column_name": "note",
    "data_type": "text",
    "udt_name": "text",
    "is_nullable": "YES",
    "column_default": null,
    "ordinal_position": 6
  },
  {
    "table_name": "dispatcher_availability",
    "column_name": "created_at",
    "data_type": "timestamp with time zone",
    "udt_name": "timestamptz",
    "is_nullable": "NO",
    "column_default": "now()",
    "ordinal_position": 7
  },
  {
    "table_name": "dispatcher_availability",
    "column_name": "updated_at",
    "data_type": "timestamp with time zone",
    "udt_name": "timestamptz",
    "is_nullable": "NO",
    "column_default": "now()",
    "ordinal_position": 8
  },
  {
    "table_name": "driver_availability_days",
    "column_name": "id",
    "data_type": "uuid",
    "udt_name": "uuid",
    "is_nullable": "NO",
    "column_default": "gen_random_uuid()",
    "ordinal_position": 1
  },
  {
    "table_name": "driver_availability_days",
    "column_name": "period_id",
    "data_type": "uuid",
    "udt_name": "uuid",
    "is_nullable": "NO",
    "column_default": null,
    "ordinal_position": 2
  },
  {
    "table_name": "driver_availability_days",
    "column_name": "availability_date",
    "data_type": "date",
    "udt_name": "date",
    "is_nullable": "NO",
    "column_default": null,
    "ordinal_position": 3
  },
  {
    "table_name": "driver_availability_days",
    "column_name": "weekday_number",
    "data_type": "integer",
    "udt_name": "int4",
    "is_nullable": "NO",
    "column_default": null,
    "ordinal_position": 4
  },
  {
    "table_name": "driver_availability_days",
    "column_name": "weekday_name",
    "data_type": "text",
    "udt_name": "text",
    "is_nullable": "NO",
    "column_default": null,
    "ordinal_position": 5
  },
  {
    "table_name": "driver_availability_days",
    "column_name": "sort_order",
    "data_type": "integer",
    "udt_name": "int4",
    "is_nullable": "NO",
    "column_default": "0",
    "ordinal_position": 6
  },
  {
    "table_name": "driver_availability_days",
    "column_name": "created_at",
    "data_type": "timestamp with time zone",
    "udt_name": "timestamptz",
    "is_nullable": "NO",
    "column_default": "now()",
    "ordinal_position": 7
  },
  {
    "table_name": "driver_availability_entries",
    "column_name": "id",
    "data_type": "uuid",
    "udt_name": "uuid",
    "is_nullable": "NO",
    "column_default": "gen_random_uuid()",
    "ordinal_position": 1
  },
  {
    "table_name": "driver_availability_entries",
    "column_name": "period_id",
    "data_type": "uuid",
    "udt_name": "uuid",
    "is_nullable": "NO",
    "column_default": null,
    "ordinal_position": 2
  },
  {
    "table_name": "driver_availability_entries",
    "column_name": "day_id",
    "data_type": "uuid",
    "udt_name": "uuid",
    "is_nullable": "NO",
    "column_default": null,
    "ordinal_position": 3
  },
  {
    "table_name": "driver_availability_entries",
    "column_name": "user_id",
    "data_type": "uuid",
    "udt_name": "uuid",
    "is_nullable": "NO",
    "column_default": null,
    "ordinal_position": 4
  },
  {
    "table_name": "driver_availability_entries",
    "column_name": "availability_status",
    "data_type": "text",
    "udt_name": "text",
    "is_nullable": "NO",
    "column_default": null,
    "ordinal_position": 5
  },
  {
    "table_name": "driver_availability_entries",
    "column_name": "note",
    "data_type": "text",
    "udt_name": "text",
    "is_nullable": "YES",
    "column_default": null,
    "ordinal_position": 6
  },
  {
    "table_name": "driver_availability_entries",
    "column_name": "created_at",
    "data_type": "timestamp with time zone",
    "udt_name": "timestamptz",
    "is_nullable": "NO",
    "column_default": "now()",
    "ordinal_position": 7
  },
  {
    "table_name": "driver_availability_entries",
    "column_name": "updated_at",
    "data_type": "timestamp with time zone",
    "udt_name": "timestamptz",
    "is_nullable": "NO",
    "column_default": "now()",
    "ordinal_position": 8
  },
  {
    "table_name": "driver_availability_periods",
    "column_name": "id",
    "data_type": "uuid",
    "udt_name": "uuid",
    "is_nullable": "NO",
    "column_default": "gen_random_uuid()",
    "ordinal_position": 1
  },
  {
    "table_name": "driver_availability_periods",
    "column_name": "year",
    "data_type": "integer",
    "udt_name": "int4",
    "is_nullable": "NO",
    "column_default": null,
    "ordinal_position": 2
  },
  {
    "table_name": "driver_availability_periods",
    "column_name": "month",
    "data_type": "integer",
    "udt_name": "int4",
    "is_nullable": "NO",
    "column_default": null,
    "ordinal_position": 3
  },
  {
    "table_name": "driver_availability_periods",
    "column_name": "status",
    "data_type": "text",
    "udt_name": "text",
    "is_nullable": "NO",
    "column_default": "'draft'::text",
    "ordinal_position": 4
  },
  {
    "table_name": "driver_availability_periods",
    "column_name": "title",
    "data_type": "text",
    "udt_name": "text",
    "is_nullable": "YES",
    "column_default": null,
    "ordinal_position": 5
  },
  {
    "table_name": "driver_availability_periods",
    "column_name": "instructions",
    "data_type": "text",
    "udt_name": "text",
    "is_nullable": "YES",
    "column_default": null,
    "ordinal_position": 6
  },
  {
    "table_name": "driver_availability_periods",
    "column_name": "submission_deadline",
    "data_type": "timestamp with time zone",
    "udt_name": "timestamptz",
    "is_nullable": "YES",
    "column_default": null,
    "ordinal_position": 7
  },
  {
    "table_name": "driver_availability_periods",
    "column_name": "opened_at",
    "data_type": "timestamp with time zone",
    "udt_name": "timestamptz",
    "is_nullable": "YES",
    "column_default": null,
    "ordinal_position": 8
  },
  {
    "table_name": "driver_availability_periods",
    "column_name": "closed_at",
    "data_type": "timestamp with time zone",
    "udt_name": "timestamptz",
    "is_nullable": "YES",
    "column_default": null,
    "ordinal_position": 9
  },
  {
    "table_name": "driver_availability_periods",
    "column_name": "created_by",
    "data_type": "uuid",
    "udt_name": "uuid",
    "is_nullable": "YES",
    "column_default": null,
    "ordinal_position": 10
  },
  {
    "table_name": "driver_availability_periods",
    "column_name": "updated_by",
    "data_type": "uuid",
    "udt_name": "uuid",
    "is_nullable": "YES",
    "column_default": null,
    "ordinal_position": 11
  },
  {
    "table_name": "driver_availability_periods",
    "column_name": "created_at",
    "data_type": "timestamp with time zone",
    "udt_name": "timestamptz",
    "is_nullable": "NO",
    "column_default": "now()",
    "ordinal_position": 12
  },
  {
    "table_name": "driver_availability_periods",
    "column_name": "updated_at",
    "data_type": "timestamp with time zone",
    "udt_name": "timestamptz",
    "is_nullable": "NO",
    "column_default": "now()",
    "ordinal_position": 13
  },
  {
    "table_name": "driver_availability_submissions",
    "column_name": "id",
    "data_type": "uuid",
    "udt_name": "uuid",
    "is_nullable": "NO",
    "column_default": "gen_random_uuid()",
    "ordinal_position": 1
  }
]