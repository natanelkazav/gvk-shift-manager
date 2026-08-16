export type AuditAction =
  | 'user_created'
  | 'user_updated'
  | 'user_activated'
  | 'user_deactivated'
  | 'user_permissions_updated'
  | 'user_password_change_required'
  | 'user_password_change_completed'
  | 'user_password_reset'
  | 'user_deleted'
  | 'availability_period_created'
  | 'availability_period_opened'
  | 'availability_period_closed'
  | 'availability_period_deleted'
  | 'driver_availability_period_created'
  | 'driver_availability_period_opened'
  | 'driver_availability_period_closed'
  | 'driver_availability_period_deleted'
  | 'morning_driver_availability_period_created'
  | 'morning_driver_availability_period_opened'
  | 'morning_driver_availability_period_closed'
  | 'morning_driver_availability_period_deleted'
  | 'schedule_draft_saved'
  | 'schedule_published'
  | 'schedule_shift_updated'
  | 'driver_schedule_published'
  | 'driver_schedule_updated'
  | 'morning_driver_schedule_published'
  | 'morning_driver_schedule_updated'
  | 'shift_swap_created'
  | 'shift_swap_counterparty_approved'
  | 'shift_swap_counterparty_rejected'
  | 'shift_swap_manager_approved'
  | 'shift_swap_manager_rejected'
  | 'shift_swap_cancelled'
  | 'notification_sent'
  | 'system_event';

export type AuditTimeRange =
  | 'all'
  | 'today'
  | '7d'
  | '30d'
  | 'custom';

export interface AuditLogEntry {
  id: string;
  action: AuditAction;
  actorUserId: string | null;
  actorEmail: string | null;
  actorDisplayName: string | null;
  targetUserId: string | null;
  targetEmail: string | null;
  targetDisplayName: string | null;
  entityType: string;
  summary: string;
  oldValues: Record<string, unknown> | null;
  newValues: Record<string, unknown> | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface AuditLogFilters {
  searchTerm: string;
  action: AuditAction | 'all';
  timeRange: AuditTimeRange;
  dateFrom: string;
  dateTo: string;
}

export interface AuditLogsState {
  entries: AuditLogEntry[];
  isLoading: boolean;
  error: string | null;
}

export interface GetAuditLogsInput {
  limit?: number;
  offset?: number;
  action?: AuditAction | null;
  actorUserId?: string | null;
  targetUserId?: string | null;
  searchTerm?: string | null;
}
