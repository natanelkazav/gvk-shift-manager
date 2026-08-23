[
  {
    "schemaname": "public",
    "tablename": "audit_logs",
    "policyname": "Managers can view audit logs",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "SELECT",
    "qual": "( SELECT is_manager_or_admin() AS is_manager_or_admin)",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "audit_logs",
    "policyname": "Users with audit view can read audit logs",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "SELECT",
    "qual": "(EXISTS ( SELECT 1\n   FROM user_permissions up\n  WHERE ((up.user_id = auth.uid()) AND (up.permission_key = 'audit.view'::text))))",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "availability_periods",
    "policyname": "Availability managers manage periods",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "ALL",
    "qual": "(EXISTS ( SELECT 1\n   FROM user_permissions up\n  WHERE ((up.user_id = auth.uid()) AND (up.permission_key = 'availability.manage'::text))))",
    "with_check": "(EXISTS ( SELECT 1\n   FROM user_permissions up\n  WHERE ((up.user_id = auth.uid()) AND (up.permission_key = 'availability.manage'::text))))"
  },
  {
    "schemaname": "public",
    "tablename": "availability_periods",
    "policyname": "Availability periods are visible",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "SELECT",
    "qual": "((EXISTS ( SELECT 1\n   FROM user_permissions up\n  WHERE ((up.user_id = auth.uid()) AND (up.permission_key = 'availability.view'::text)))) OR (EXISTS ( SELECT 1\n   FROM user_permissions up\n  WHERE ((up.user_id = auth.uid()) AND (up.permission_key = 'availability.manage'::text)))))",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "availability_shift_slots",
    "policyname": "Availability managers manage slots",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "ALL",
    "qual": "(EXISTS ( SELECT 1\n   FROM user_permissions up\n  WHERE ((up.user_id = auth.uid()) AND (up.permission_key = 'availability.manage'::text))))",
    "with_check": "(EXISTS ( SELECT 1\n   FROM user_permissions up\n  WHERE ((up.user_id = auth.uid()) AND (up.permission_key = 'availability.manage'::text))))"
  },
  {
    "schemaname": "public",
    "tablename": "availability_shift_slots",
    "policyname": "Availability slots are visible",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "SELECT",
    "qual": "(EXISTS ( SELECT 1\n   FROM user_permissions up\n  WHERE ((up.user_id = auth.uid()) AND (up.permission_key = ANY (ARRAY['availability.view'::text, 'availability.manage'::text])))))",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "availability_submissions",
    "policyname": "Managers read all submissions",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "SELECT",
    "qual": "(EXISTS ( SELECT 1\n   FROM user_permissions up\n  WHERE ((up.user_id = auth.uid()) AND (up.permission_key = 'availability.manage'::text))))",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "availability_submissions",
    "policyname": "Users create own submission",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "INSERT",
    "qual": null,
    "with_check": "((user_id = auth.uid()) AND (EXISTS ( SELECT 1\n   FROM availability_periods period\n  WHERE ((period.id = availability_submissions.period_id) AND (period.status = 'open'::text)))))"
  },
  {
    "schemaname": "public",
    "tablename": "availability_submissions",
    "policyname": "Users read own submission",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "SELECT",
    "qual": "(user_id = auth.uid())",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "availability_submissions",
    "policyname": "Users update own submission",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "UPDATE",
    "qual": "(user_id = auth.uid())",
    "with_check": "((user_id = auth.uid()) AND (EXISTS ( SELECT 1\n   FROM availability_periods period\n  WHERE ((period.id = availability_submissions.period_id) AND (period.status = 'open'::text)))))"
  },
  {
    "schemaname": "public",
    "tablename": "calendar_special_days",
    "policyname": "Availability managers manage calendar days",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "ALL",
    "qual": "(EXISTS ( SELECT 1\n   FROM user_permissions permission\n  WHERE ((permission.user_id = auth.uid()) AND (permission.permission_key = 'availability.manage'::text))))",
    "with_check": "(EXISTS ( SELECT 1\n   FROM user_permissions permission\n  WHERE ((permission.user_id = auth.uid()) AND (permission.permission_key = 'availability.manage'::text))))"
  },
  {
    "schemaname": "public",
    "tablename": "calendar_special_days",
    "policyname": "Availability users read calendar days",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "SELECT",
    "qual": "(EXISTS ( SELECT 1\n   FROM user_permissions permission\n  WHERE ((permission.user_id = auth.uid()) AND (permission.permission_key = ANY (ARRAY['availability.view'::text, 'availability.manage'::text])))))",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "dispatcher_availability",
    "policyname": "Managers read all availability",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "SELECT",
    "qual": "(EXISTS ( SELECT 1\n   FROM user_permissions up\n  WHERE ((up.user_id = auth.uid()) AND (up.permission_key = 'availability.manage'::text))))",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "dispatcher_availability",
    "policyname": "Users create own availability",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "INSERT",
    "qual": null,
    "with_check": "((user_id = auth.uid()) AND (EXISTS ( SELECT 1\n   FROM availability_periods period\n  WHERE ((period.id = dispatcher_availability.period_id) AND (period.status = 'open'::text) AND ((period.submission_deadline IS NULL) OR (period.submission_deadline > now()))))))"
  },
  {
    "schemaname": "public",
    "tablename": "dispatcher_availability",
    "policyname": "Users delete own availability",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "DELETE",
    "qual": "((user_id = auth.uid()) AND (EXISTS ( SELECT 1\n   FROM availability_periods period\n  WHERE ((period.id = dispatcher_availability.period_id) AND (period.status = 'open'::text) AND ((period.submission_deadline IS NULL) OR (period.submission_deadline > now()))))))",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "dispatcher_availability",
    "policyname": "Users read own availability",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "SELECT",
    "qual": "(user_id = auth.uid())",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "dispatcher_availability",
    "policyname": "Users update own availability",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "UPDATE",
    "qual": "(user_id = auth.uid())",
    "with_check": "((user_id = auth.uid()) AND (EXISTS ( SELECT 1\n   FROM availability_periods period\n  WHERE ((period.id = dispatcher_availability.period_id) AND (period.status = 'open'::text) AND ((period.submission_deadline IS NULL) OR (period.submission_deadline > now()))))))"
  },
  {
    "schemaname": "public",
    "tablename": "driver_availability_days",
    "policyname": "Authorized users can view driver availability days",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "SELECT",
    "qual": "(('driver_availability.view'::text = ANY (COALESCE(get_my_permissions(), ARRAY[]::text[]))) OR ('driver_availability.manage'::text = ANY (COALESCE(get_my_permissions(), ARRAY[]::text[]))))",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "driver_availability_days",
    "policyname": "Managers can manage driver availability days",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "ALL",
    "qual": "('driver_availability.manage'::text = ANY (COALESCE(get_my_permissions(), ARRAY[]::text[])))",
    "with_check": "('driver_availability.manage'::text = ANY (COALESCE(get_my_permissions(), ARRAY[]::text[])))"
  },
  {
    "schemaname": "public",
    "tablename": "driver_availability_entries",
    "policyname": "Users can delete own driver availability entries",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "DELETE",
    "qual": "((user_id = auth.uid()) OR ('driver_availability.manage'::text = ANY (COALESCE(get_my_permissions(), ARRAY[]::text[]))))",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "driver_availability_entries",
    "policyname": "Users can insert own driver availability entries",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "INSERT",
    "qual": null,
    "with_check": "((user_id = auth.uid()) AND ('driver_availability.view'::text = ANY (COALESCE(get_my_permissions(), ARRAY[]::text[]))))"
  },
  {
    "schemaname": "public",
    "tablename": "driver_availability_entries",
    "policyname": "Users can update own driver availability entries",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "UPDATE",
    "qual": "((user_id = auth.uid()) OR ('driver_availability.manage'::text = ANY (COALESCE(get_my_permissions(), ARRAY[]::text[]))))",
    "with_check": "((user_id = auth.uid()) OR ('driver_availability.manage'::text = ANY (COALESCE(get_my_permissions(), ARRAY[]::text[]))))"
  },
  {
    "schemaname": "public",
    "tablename": "driver_availability_entries",
    "policyname": "Users can view own driver availability entries",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "SELECT",
    "qual": "((user_id = auth.uid()) OR ('driver_availability.manage'::text = ANY (COALESCE(get_my_permissions(), ARRAY[]::text[]))))",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "driver_availability_periods",
    "policyname": "Authorized users can view driver availability periods",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "SELECT",
    "qual": "(('driver_availability.view'::text = ANY (COALESCE(get_my_permissions(), ARRAY[]::text[]))) OR ('driver_availability.manage'::text = ANY (COALESCE(get_my_permissions(), ARRAY[]::text[]))))",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "driver_availability_periods",
    "policyname": "Managers can create driver availability periods",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "INSERT",
    "qual": null,
    "with_check": "(('driver_availability.manage'::text = ANY (COALESCE(get_my_permissions(), ARRAY[]::text[]))) AND (created_by = auth.uid()))"
  },
  {
    "schemaname": "public",
    "tablename": "driver_availability_periods",
    "policyname": "Managers can delete driver availability periods",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "DELETE",
    "qual": "('driver_availability.manage'::text = ANY (COALESCE(get_my_permissions(), ARRAY[]::text[])))",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "driver_availability_periods",
    "policyname": "Managers can update driver availability periods",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "UPDATE",
    "qual": "('driver_availability.manage'::text = ANY (COALESCE(get_my_permissions(), ARRAY[]::text[])))",
    "with_check": "('driver_availability.manage'::text = ANY (COALESCE(get_my_permissions(), ARRAY[]::text[])))"
  },
  {
    "schemaname": "public",
    "tablename": "driver_availability_submissions",
    "policyname": "Users can create own driver availability submissions",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "INSERT",
    "qual": null,
    "with_check": "((user_id = auth.uid()) AND ('driver_availability.view'::text = ANY (COALESCE(get_my_permissions(), ARRAY[]::text[]))))"
  },
  {
    "schemaname": "public",
    "tablename": "driver_availability_submissions",
    "policyname": "Users can update own driver availability submissions",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "UPDATE",
    "qual": "((user_id = auth.uid()) OR ('driver_availability.manage'::text = ANY (COALESCE(get_my_permissions(), ARRAY[]::text[]))))",
    "with_check": "((user_id = auth.uid()) OR ('driver_availability.manage'::text = ANY (COALESCE(get_my_permissions(), ARRAY[]::text[]))))"
  },
  {
    "schemaname": "public",
    "tablename": "driver_availability_submissions",
    "policyname": "Users can view own driver availability submissions",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "SELECT",
    "qual": "((user_id = auth.uid()) OR ('driver_availability.manage'::text = ANY (COALESCE(get_my_permissions(), ARRAY[]::text[]))))",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "driver_schedule_assignment_history",
    "policyname": "Authorized users can view driver assignment history",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "SELECT",
    "qual": "(('driver_schedule.view_team'::text = ANY (COALESCE(get_my_permissions(), ARRAY[]::text[]))) OR ('driver_schedule.edit'::text = ANY (COALESCE(get_my_permissions(), ARRAY[]::text[]))))",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "driver_schedule_days",
    "policyname": "Editors can manage driver schedule days",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "ALL",
    "qual": "('driver_schedule.edit'::text = ANY (COALESCE(get_my_permissions(), ARRAY[]::text[])))",
    "with_check": "('driver_schedule.edit'::text = ANY (COALESCE(get_my_permissions(), ARRAY[]::text[])))"
  },
  {
    "schemaname": "public",
    "tablename": "driver_schedule_days",
    "policyname": "Users can view permitted driver schedule days",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "SELECT",
    "qual": "((assigned_user_id = auth.uid()) OR ('driver_schedule.view_team'::text = ANY (COALESCE(get_my_permissions(), ARRAY[]::text[]))) OR ('driver_schedule.edit'::text = ANY (COALESCE(get_my_permissions(), ARRAY[]::text[]))))",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "driver_schedule_periods",
    "policyname": "Authorized users can view driver schedule periods",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "SELECT",
    "qual": "(('driver_schedule.view'::text = ANY (COALESCE(get_my_permissions(), ARRAY[]::text[]))) OR ('driver_schedule.view_team'::text = ANY (COALESCE(get_my_permissions(), ARRAY[]::text[]))) OR ('driver_schedule.edit'::text = ANY (COALESCE(get_my_permissions(), ARRAY[]::text[]))))",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "driver_schedule_periods",
    "policyname": "Editors can manage driver schedule periods",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "ALL",
    "qual": "('driver_schedule.edit'::text = ANY (COALESCE(get_my_permissions(), ARRAY[]::text[])))",
    "with_check": "('driver_schedule.edit'::text = ANY (COALESCE(get_my_permissions(), ARRAY[]::text[])))"
  },
  {
    "schemaname": "public",
    "tablename": "driver_schedule_swaps",
    "policyname": "Users can view related driver swaps",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "SELECT",
    "qual": "((first_user_id = auth.uid()) OR (second_user_id = auth.uid()) OR ('driver_schedule.view_team'::text = ANY (COALESCE(get_my_permissions(), ARRAY[]::text[]))) OR ('driver_schedule.edit'::text = ANY (COALESCE(get_my_permissions(), ARRAY[]::text[]))))",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "holidays",
    "policyname": "Admins can delete holidays",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "DELETE",
    "qual": "( SELECT is_admin() AS is_admin)",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "holidays",
    "policyname": "Authenticated users can view holidays",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "SELECT",
    "qual": "true",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "holidays",
    "policyname": "Managers can create holidays",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "INSERT",
    "qual": null,
    "with_check": "( SELECT is_manager_or_admin() AS is_manager_or_admin)"
  },
  {
    "schemaname": "public",
    "tablename": "holidays",
    "policyname": "Managers can update holidays",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "UPDATE",
    "qual": "( SELECT is_manager_or_admin() AS is_manager_or_admin)",
    "with_check": "( SELECT is_manager_or_admin() AS is_manager_or_admin)"
  },
  {
    "schemaname": "public",
    "tablename": "notification_preferences",
    "policyname": "Users can insert own notification preferences",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "INSERT",
    "qual": null,
    "with_check": "(user_id = auth.uid())"
  },
  {
    "schemaname": "public",
    "tablename": "notification_preferences",
    "policyname": "Users can update own notification preferences",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "UPDATE",
    "qual": "(user_id = auth.uid())",
    "with_check": "(user_id = auth.uid())"
  },
  {
    "schemaname": "public",
    "tablename": "notification_preferences",
    "policyname": "Users can view own notification preferences",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "SELECT",
    "qual": "(user_id = auth.uid())",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "notification_recipients",
    "policyname": "Notification managers can create recipients",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "INSERT",
    "qual": null,
    "with_check": "(current_user_has_permission('notifications.manage'::text) AND current_user_created_notification(notification_id))"
  },
  {
    "schemaname": "public",
    "tablename": "notification_recipients",
    "policyname": "Users can update own notification recipients",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "UPDATE",
    "qual": "(user_id = auth.uid())",
    "with_check": "(user_id = auth.uid())"
  },
  {
    "schemaname": "public",
    "tablename": "notification_recipients",
    "policyname": "Users can view own notification recipients",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "SELECT",
    "qual": "(user_id = auth.uid())",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "notifications",
    "policyname": "Notification creators can view own notifications",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "SELECT",
    "qual": "(created_by = auth.uid())",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "notifications",
    "policyname": "Notification managers can create notifications",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "INSERT",
    "qual": null,
    "with_check": "((created_by = auth.uid()) AND current_user_has_permission('notifications.manage'::text))"
  },
  {
    "schemaname": "public",
    "tablename": "notifications",
    "policyname": "Notification managers can delete own notifications",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "DELETE",
    "qual": "((created_by = auth.uid()) AND (EXISTS ( SELECT 1\n   FROM user_permissions up\n  WHERE ((up.user_id = auth.uid()) AND (up.permission_key = 'notifications.manage'::text)))))",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "notifications",
    "policyname": "Users can view their notifications",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "SELECT",
    "qual": "((expires_at > now()) AND (EXISTS ( SELECT 1\n   FROM notification_recipients nr\n  WHERE ((nr.notification_id = notifications.id) AND (nr.user_id = auth.uid())))))",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "permissions",
    "policyname": "Authenticated users can read permissions",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "SELECT",
    "qual": "true",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "profiles",
    "policyname": "Admins can delete profiles",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "DELETE",
    "qual": "( SELECT is_admin() AS is_admin)",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "profiles",
    "policyname": "Admins can insert profiles",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "INSERT",
    "qual": null,
    "with_check": "( SELECT is_admin() AS is_admin)"
  },
  {
    "schemaname": "public",
    "tablename": "profiles",
    "policyname": "Admins can update profiles",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "UPDATE",
    "qual": "( SELECT is_admin() AS is_admin)",
    "with_check": "( SELECT is_admin() AS is_admin)"
  },
  {
    "schemaname": "public",
    "tablename": "profiles",
    "policyname": "Authenticated users can view active profiles",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "SELECT",
    "qual": "((is_active = true) OR (id = ( SELECT auth.uid() AS uid)) OR ( SELECT is_manager_or_admin() AS is_manager_or_admin))",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "profiles",
    "policyname": "profiles_select_own_or_admin",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "SELECT",
    "qual": "((id = ( SELECT auth.uid() AS uid)) OR private.current_user_is_admin())",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "profiles",
    "policyname": "profiles_update_admin",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "UPDATE",
    "qual": "private.current_user_is_admin()",
    "with_check": "private.current_user_is_admin()"
  },
  {
    "schemaname": "public",
    "tablename": "push_subscriptions",
    "policyname": "Users can delete own push subscriptions",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "DELETE",
    "qual": "(user_id = auth.uid())",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "push_subscriptions",
    "policyname": "Users can insert own push subscriptions",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "INSERT",
    "qual": null,
    "with_check": "(user_id = auth.uid())"
  },
  {
    "schemaname": "public",
    "tablename": "push_subscriptions",
    "policyname": "Users can update own push subscriptions",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "UPDATE",
    "qual": "(user_id = auth.uid())",
    "with_check": "(user_id = auth.uid())"
  },
  {
    "schemaname": "public",
    "tablename": "push_subscriptions",
    "policyname": "Users can view own push subscriptions",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "SELECT",
    "qual": "(user_id = auth.uid())",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "role_default_permissions",
    "policyname": "Admins can read role defaults",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "SELECT",
    "qual": "is_current_user_admin()",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "schedule_assignment_history",
    "policyname": "Authenticated users can view assignment history",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "SELECT",
    "qual": "true",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "schedule_assignment_history",
    "policyname": "Managers can create assignment history",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "INSERT",
    "qual": null,
    "with_check": "( SELECT is_manager_or_admin() AS is_manager_or_admin)"
  },
  {
    "schemaname": "public",
    "tablename": "schedule_import_name_aliases",
    "policyname": "schedule_import_aliases_admin_delete",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "DELETE",
    "qual": "(EXISTS ( SELECT 1\n   FROM profiles\n  WHERE ((profiles.id = auth.uid()) AND (profiles.is_active = true) AND (profiles.role = ANY (ARRAY['admin'::user_role, 'manager'::user_role])))))",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "schedule_import_name_aliases",
    "policyname": "schedule_import_aliases_admin_insert",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "INSERT",
    "qual": null,
    "with_check": "(EXISTS ( SELECT 1\n   FROM profiles\n  WHERE ((profiles.id = auth.uid()) AND (profiles.is_active = true) AND (profiles.role = ANY (ARRAY['admin'::user_role, 'manager'::user_role])))))"
  },
  {
    "schemaname": "public",
    "tablename": "schedule_import_name_aliases",
    "policyname": "schedule_import_aliases_admin_select",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "SELECT",
    "qual": "(EXISTS ( SELECT 1\n   FROM profiles\n  WHERE ((profiles.id = auth.uid()) AND (profiles.is_active = true) AND (profiles.role = ANY (ARRAY['admin'::user_role, 'manager'::user_role])))))",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "schedule_import_name_aliases",
    "policyname": "schedule_import_aliases_admin_update",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "UPDATE",
    "qual": "(EXISTS ( SELECT 1\n   FROM profiles\n  WHERE ((profiles.id = auth.uid()) AND (profiles.is_active = true) AND (profiles.role = ANY (ARRAY['admin'::user_role, 'manager'::user_role])))))",
    "with_check": "(EXISTS ( SELECT 1\n   FROM profiles\n  WHERE ((profiles.id = auth.uid()) AND (profiles.is_active = true) AND (profiles.role = ANY (ARRAY['admin'::user_role, 'manager'::user_role])))))"
  },
  {
    "schemaname": "public",
    "tablename": "schedule_import_runs",
    "policyname": "schedule_import_runs_manager_insert",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "INSERT",
    "qual": null,
    "with_check": "((imported_by = auth.uid()) AND (EXISTS ( SELECT 1\n   FROM profiles\n  WHERE ((profiles.id = auth.uid()) AND (profiles.is_active = true) AND (('driver_availability.manage'::text = ANY (COALESCE(get_my_permissions(), ARRAY[]::text[]))) OR ('users.manage'::text = ANY (COALESCE(get_my_permissions(), ARRAY[]::text[]))))))))"
  },
  {
    "schemaname": "public",
    "tablename": "schedule_import_runs",
    "policyname": "schedule_import_runs_manager_select",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "SELECT",
    "qual": "(EXISTS ( SELECT 1\n   FROM profiles\n  WHERE ((profiles.id = auth.uid()) AND (profiles.is_active = true) AND (('driver_availability.manage'::text = ANY (COALESCE(get_my_permissions(), ARRAY[]::text[]))) OR ('users.manage'::text = ANY (COALESCE(get_my_permissions(), ARRAY[]::text[])))))))",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "schedule_import_runs",
    "policyname": "schedule_import_runs_manager_update",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "UPDATE",
    "qual": "(EXISTS ( SELECT 1\n   FROM profiles\n  WHERE ((profiles.id = auth.uid()) AND (profiles.is_active = true) AND (('driver_availability.manage'::text = ANY (COALESCE(get_my_permissions(), ARRAY[]::text[]))) OR ('users.manage'::text = ANY (COALESCE(get_my_permissions(), ARRAY[]::text[])))))))",
    "with_check": "(EXISTS ( SELECT 1\n   FROM profiles\n  WHERE ((profiles.id = auth.uid()) AND (profiles.is_active = true) AND (('driver_availability.manage'::text = ANY (COALESCE(get_my_permissions(), ARRAY[]::text[]))) OR ('users.manage'::text = ANY (COALESCE(get_my_permissions(), ARRAY[]::text[])))))))"
  },
  {
    "schemaname": "public",
    "tablename": "schedule_periods",
    "policyname": "Admins can delete schedule periods",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "DELETE",
    "qual": "( SELECT is_admin() AS is_admin)",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "schedule_periods",
    "policyname": "Authenticated users can view schedule periods",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "SELECT",
    "qual": "true",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "schedule_periods",
    "policyname": "Managers can create schedule periods",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "INSERT",
    "qual": null,
    "with_check": "(( SELECT is_manager_or_admin() AS is_manager_or_admin) AND (created_by = ( SELECT auth.uid() AS uid)))"
  },
  {
    "schemaname": "public",
    "tablename": "schedule_periods",
    "policyname": "Managers can update schedule periods",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "UPDATE",
    "qual": "( SELECT is_manager_or_admin() AS is_manager_or_admin)",
    "with_check": "( SELECT is_manager_or_admin() AS is_manager_or_admin)"
  },
  {
    "schemaname": "public",
    "tablename": "schedule_shifts",
    "policyname": "Admins can delete schedule shifts",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "DELETE",
    "qual": "( SELECT is_admin() AS is_admin)",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "schedule_shifts",
    "policyname": "Authenticated users can view schedule shifts",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "SELECT",
    "qual": "true",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "schedule_shifts",
    "policyname": "Managers can create schedule shifts",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "INSERT",
    "qual": null,
    "with_check": "( SELECT is_manager_or_admin() AS is_manager_or_admin)"
  },
  {
    "schemaname": "public",
    "tablename": "schedule_shifts",
    "policyname": "Managers can update schedule shifts",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "UPDATE",
    "qual": "( SELECT is_manager_or_admin() AS is_manager_or_admin)",
    "with_check": "( SELECT is_manager_or_admin() AS is_manager_or_admin)"
  },
  {
    "schemaname": "public",
    "tablename": "shift_swap_requests",
    "policyname": "shift_swap_requests_select_relevant",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "SELECT",
    "qual": "((requester_user_id = auth.uid()) OR (counterparty_user_id = auth.uid()) OR current_user_has_permission('shift_swaps.approve'::text))",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "user_permissions",
    "policyname": "Users can read own permissions",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "SELECT",
    "qual": "((user_id = auth.uid()) OR is_current_user_admin())",
    "with_check": null
  }
]