export type AuditAction = string;

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
  category: string | 'all';
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
