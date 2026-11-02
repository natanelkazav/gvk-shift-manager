/**
 * קובץ: src/services/auditService.ts
 * מטרה: שליפת יומן השינויים והתאמת מסנני החיפוש והעימוד לבקשת השרת.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: AuditLogDatabaseRow, mapAuditLogRow, getAuditLogs.
 * - קריאות RPC המופעלות בקובץ: get_audit_logs.
 * - ריכוז הפנייה למקור הנתונים ועיבוד התשובה בהתאם לפונקציות להלן.
 */
import { supabase } from '../lib/supabase';
import type {
  AuditLogEntry,
  GetAuditLogsInput,
} from '../types/audit';

/**
 * חוזה הנתונים AuditLogDatabaseRow: יומן שינויים / שורה.
 */
interface AuditLogDatabaseRow {
  // id — מזהה.
  id: string;
  action: string;
  // actor_user_id — מזהה משתמש.
  actor_user_id: string | null;
  // actor_email — כתובת דוא״ל.
  actor_email: string | null;
  // actor_display_name — שם תצוגה.
  actor_display_name: string | null;
  // target_user_id — מזהה משתמש היעד.
  target_user_id: string | null;
  // target_email — יעד / כתובת דוא״ל.
  target_email: string | null;
  // target_display_name — שם תצוגה היעד.
  target_display_name: string | null;
  entity_type: string;
  // summary — סיכום.
  summary: string;
  // old_values — ערכים.
  old_values:
    | Record<string, unknown>
    | null;
  // new_values — ערכים.
  new_values:
    | Record<string, unknown>
    | null;
  metadata:
    | Record<string, unknown>
    | null;
  // created_at — מועד יצירה.
  created_at: string;
}

/**
 * פעולה mapAuditLogRow: מיפוי מפת התאמה / יומן שינויים / שורה.
 * @param row — שורה.
 * @returns AuditLogEntry — הפלט בהתאם לחתימה.
 */
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

/**
 * פעולה אסינכרונית getAuditLogs: שליפה או חישוב של יומן שינויים.
 * הפעולה פונה ל־RPC: get_audit_logs.
 * @param input — קלט.
 * @returns Promise<AuditLogEntry[]> — הפלט בהתאם לחתימה.
 */
async function getAuditLogs(
  input: GetAuditLogsInput = {},
): Promise<AuditLogEntry[]> {
  // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
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

  // עצירת הפעולה עם שגיאה כאשר error.
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

// auditService — יומן שינויים / שירות.
export const auditService = {
  getAuditLogs,
};