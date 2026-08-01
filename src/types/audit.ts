export type AuditAction =
  | 'user_created'
  | 'user_updated'
  | 'user_activated'
  | 'user_deactivated'
  | 'user_permissions_updated'
  | 'user_password_change_required'
  | 'user_password_change_completed'
  | 'user_deleted'
  | 'availability_period_closed'
  | 'availability_period_deleted'
  | 'availability_period_opened';

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