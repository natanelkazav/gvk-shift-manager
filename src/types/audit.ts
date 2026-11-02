/**
 * קובץ: src/types/audit.ts
 * מטרה: הגדרת טיפוסים וחוזי נתונים עבור יומן שינויים.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: AuditAction, AuditTimeRange, AuditLogEntry, AuditLogFilters, AuditLogsState, GetAuditLogsInput.
 * - תיאור מבנה הקלט והפלט לבדיקת טיפוסים בזמן פיתוח.
 */
/**
 * טיפוס AuditAction: יומן שינויים.
 */
export type AuditAction = string;

/**
 * טיפוס AuditTimeRange: יומן שינויים / זמן.
 */
export type AuditTimeRange =
  | 'all'
  | 'today'
  | '7d'
  | '30d'
  | 'custom';

/**
 * חוזה הנתונים AuditLogEntry: יומן שינויים / רשומה.
 */
export interface AuditLogEntry {
  // id — מזהה.
  id: string;
  action: AuditAction;
  // actorUserId — מזהה משתמש.
  actorUserId: string | null;
  // actorEmail — כתובת דוא״ל.
  actorEmail: string | null;
  // actorDisplayName — שם תצוגה.
  actorDisplayName: string | null;
  // targetUserId — מזהה משתמש היעד.
  targetUserId: string | null;
  // targetEmail — יעד / כתובת דוא״ל.
  targetEmail: string | null;
  // targetDisplayName — שם תצוגה היעד.
  targetDisplayName: string | null;
  entityType: string;
  // summary — סיכום.
  summary: string;
  // oldValues — ערכים.
  oldValues: Record<string, unknown> | null;
  // newValues — ערכים.
  newValues: Record<string, unknown> | null;
  metadata: Record<string, unknown>;
  // createdAt — מועד יצירה.
  createdAt: string;
}

/**
 * חוזה הנתונים AuditLogFilters: יומן שינויים / מסננים.
 */
export interface AuditLogFilters {
  searchTerm: string;
  action: AuditAction | 'all';
  category: string | 'all';
  // timeRange — זמן.
  timeRange: AuditTimeRange;
  // dateFrom — תאריך.
  dateFrom: string;
  // dateTo — תאריך.
  dateTo: string;
}

/**
 * חוזה הנתונים AuditLogsState: יומן שינויים / מצב.
 */
export interface AuditLogsState {
  // entries — רשומות.
  entries: AuditLogEntry[];
  // isLoading — האם טעינה מתבצעת.
  isLoading: boolean;
  // error — שגיאה.
  error: string | null;
}

/**
 * חוזה הנתונים GetAuditLogsInput: יומן שינויים / קלט.
 */
export interface GetAuditLogsInput {
  // limit — מגבלת תוצאות (אופציונלי).
  limit?: number;
  // offset — מיקום תחילת התוצאות (אופציונלי).
  offset?: number;
  action?: AuditAction | null;
  // actorUserId — מזהה משתמש (אופציונלי).
  actorUserId?: string | null;
  // targetUserId — מזהה משתמש היעד (אופציונלי).
  targetUserId?: string | null;
  searchTerm?: string | null;
}
