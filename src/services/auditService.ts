import { supabase } from '../lib/supabase';
import type {
  AuditAction,
  AuditLogEntry,
  GetAuditLogsInput,
} from '../types/audit';

interface AuditLogDatabaseRow {
  id: string;
  action: string;
  actor_user_id: string | null;
  actor_email: string | null;
  actor_display_name: string | null;
  target_user_id: string | null;
  target_email: string | null;
  target_display_name: string | null;
  entity_type: string;
  summary: string;
  old_values:
    | Record<string, unknown>
    | null;
  new_values:
    | Record<string, unknown>
    | null;
  metadata:
    | Record<string, unknown>
    | null;
  created_at: string;
}

const supportedActions = new Set<AuditAction>([
  'user_created',
  'user_updated',
  'user_activated',
  'user_deactivated',
  'user_permissions_updated',
  'user_password_change_required',
  'user_password_change_completed',
  'user_password_reset',
  'user_deleted',
  'availability_period_created',
  'availability_period_opened',
  'availability_period_closed',
  'availability_period_deleted',
  'driver_availability_period_created',
  'driver_availability_period_opened',
  'driver_availability_period_closed',
  'driver_availability_period_deleted',
  'morning_driver_availability_period_created',
  'morning_driver_availability_period_opened',
  'morning_driver_availability_period_closed',
  'morning_driver_availability_period_deleted',
  'schedule_draft_saved',
  'schedule_published',
  'schedule_shift_updated',
  'driver_schedule_published',
  'driver_schedule_updated',
  'morning_driver_schedule_published',
  'morning_driver_schedule_updated',
  'shift_swap_created',
  'shift_swap_counterparty_approved',
  'shift_swap_counterparty_rejected',
  'shift_swap_manager_approved',
  'shift_swap_manager_rejected',
  'shift_swap_cancelled',
  'notification_sent',
  'system_event',
]);

function normalizeAction(
  action: string,
): AuditAction {
  if (
    supportedActions.has(
      action as AuditAction,
    )
  ) {
    return action as AuditAction;
  }

  return 'system_event';
}

function mapAuditLogRow(
  row: AuditLogDatabaseRow,
): AuditLogEntry {
  return {
    id: row.id,
    action: normalizeAction(row.action),
    actorUserId: row.actor_user_id,
    actorEmail: row.actor_email,
    actorDisplayName:
      row.actor_display_name,
    targetUserId: row.target_user_id,
    targetEmail: row.target_email,
    targetDisplayName:
      row.target_display_name,
    entityType: row.entity_type,
    summary: row.summary,
    oldValues: row.old_values,
    newValues: row.new_values,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
  };
}

async function getAuditLogs(
  input: GetAuditLogsInput = {},
): Promise<AuditLogEntry[]> {
  const {
    data,
    error,
  } = await supabase.rpc(
    'get_audit_logs',
    {
      requested_limit:
        input.limit ?? 100,

      requested_offset:
        input.offset ?? 0,

      requested_action:
        input.action ?? null,

      requested_actor_user_id:
        input.actorUserId ?? null,

      requested_target_user_id:
        input.targetUserId ?? null,

      requested_search_term:
        input.searchTerm?.trim() ||
        null,
    },
  );

  if (error) {
    console.error(
      'GET AUDIT LOGS ERROR:',
      error,
    );

    throw new Error(
      'לא ניתן היה לטעון את יומן המערכת.',
    );
  }

  return (
    (
      data as
        | AuditLogDatabaseRow[]
        | null
    ) ?? []
  ).map(mapAuditLogRow);
}

export const auditService = {
  getAuditLogs,
};