import { supabase } from '../lib/supabase';
import type {
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

function mapAuditLogRow(
  row: AuditLogDatabaseRow,
): AuditLogEntry {
  return {
    id: row.id,
    action: row.action,
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