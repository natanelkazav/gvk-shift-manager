import type { AuditLogEntry } from '../types/audit';

export const auditCategories = {
  scheduling: 'ניהול שיבוצים', availability: 'ניהול אילוצים',
  roles: 'תפקידים והרשאות', users: 'משתמשים',
  exchanges: 'חילופי משמרות', attendance: 'נוכחות ופעילות',
  communications: 'עדכונים והתראות', system: 'מערכת ותחזוקה',
  other: 'אחר',
} as const;
export type AuditCategory = keyof typeof auditCategories;

const labels: Record<string, string> = {
  user_created:'יצירת משתמש',user_updated:'עדכון משתמש',user_activated:'הפעלת משתמש',
  user_deactivated:'השבתת משתמש',user_deleted:'מחיקת משתמש',
  user_permissions_updated:'עדכון הרשאות',user_password_change_required:'דרישה לשינוי סיסמה',
  user_password_change_completed:'השלמת שינוי סיסמה',user_password_reset:'איפוס סיסמה',
  availability_period_created:'יצירת תקופת אילוצים',availability_period_opened:'פתיחת תקופת אילוצים',
  availability_period_closed:'סגירת תקופת אילוצים',availability_period_deleted:'מחיקת תקופת אילוצים',
  availability_submitted:'הגשת אילוצים', 'availability.deadline.updated':'עדכון מועד הגשת אילוצים',
  'availability.period.synced':'סנכרון תקופת אילוצים',
  'availability.period.weekend_priority_fixed':'תיקון קדימות שישי ושבת',
  schedule_draft_saved:'שמירת טיוטה',schedule_published:'פרסום לוח',schedule_shift_updated:'עריכת שיבוץ',
  'schedule.draft.created':'יצירת טיוטה','schedule.draft.updated':'עריכת טיוטה',
  'schedule.published':'פרסום לוח','schedule.assignment.updated':'עדכון שיבוץ',
  'schedule.assignment.unassigned':'סימון משמרת לא מאוישת',
  'schedule.assignment.filled':'איוש משמרת',
  'schedule.assignment.self_updated':'עריכת שיבוץ אישית',
  'schedule.assignment.delegated_updated':'עריכת שיבוץ של עובד אחר',
  'schedule.historical_assignment.corrected':'תיקון שיבוץ היסטורי',
  shift_swap_created:'יצירת בקשת חילוף',shift_swap_counterparty_approved:'אישור חילוף על ידי הצד השני',
  shift_swap_counterparty_rejected:'דחיית חילוף על ידי הצד השני',
  shift_swap_manager_approved:'אישור חילוף על ידי מנהל',shift_swap_manager_rejected:'דחיית חילוף על ידי מנהל',
  shift_swap_cancelled:'ביטול בקשת חילוף',
  'dynamic_job_type.created':'יצירת תפקיד',
  'dynamic_job_type.updated':'עדכון הגדרות תפקיד',
  'schedule_group.configuration.updated':'עדכון מבנה משמרות',
  'dynamic_job_type.deleted':'מחיקת תפקיד','dynamic_job_type.frozen':'הקפאת תפקיד',
  'dynamic_job_type.reactivated':'הפעלה מחדש של תפקיד',
  'dynamic_job_type.member.added':'שיוך עובד לתפקיד',
  'dynamic_job_type.member.saved':'שמירת שיוך עובד',
  'dynamic_job_type.member.removed':'הסרת עובד מתפקיד',
  'job_type.rotation.initialized':'אתחול סבב חודשי',
  'job_type.rotation.updated':'עדכון סבב חודשי',
  'job_type.reminders.updated':'עדכון תזכורות אילוצים',
  'attendance.checked_in':'דיווח כניסה','attendance.checked_out':'דיווח יציאה',
  'attendance.corrected':'תיקון דיווח נוכחות',
  'activity.segment.updated':'עריכת מקטע פעילות',
  notification_sent:'שליחת התראה','notification.announcement.sent':'שליחת עדכון יזום',
  'notification.schedule_published.sent':'שליחת התראת פרסום',
  'development_mode.enabled':'הפעלת מצב פיתוח','development_mode.disabled':'כיבוי מצב פיתוח',
  system_event:'אירוע מערכת',
};

export function auditActionLabel(action: string): string {
  return labels[action] ?? action.replace(/[._-]+/g, ' ');
}

export function auditActionCategory(action: string, entityType = ''): AuditCategory {
  if (action === 'system_event') return 'system';
  if (/swap|exchange/.test(action)) return 'exchanges';
  if (/attendance|activity/.test(action)) return 'attendance';
  if (/notification|announcement|archive.auto_sent/.test(action)) return 'communications';
  if (/availability|deadline/.test(action)) return 'availability';
  if (action === 'schedule_group.configuration.updated') return 'roles';
  if (/schedule|assignment|rotation|draft|publication/.test(action)) return 'scheduling';
  if (/permission|job_type|membership/.test(action)) return 'roles';
  if (/^user[._]/.test(action)) return 'users';
  if (/development_mode|migration|system/.test(action)) return 'system';
  if (/schedule|assignment/.test(entityType)) return 'scheduling';
  return 'other';
}

// Display legacy records accurately before historical SQL is executed.
// Classification is intentionally exact by entity + summary, not fuzzy text matching.
const legacy: Record<string,string> = {
  "activity_tracking_segment|מקטע מעקב פעילות נערך": "activity.segment.updated",
  "attendance_session|דיווח יציאה": "attendance.checked_out",
  "attendance_session|דיווח כניסה": "attendance.checked_in",
  "attendance_session|תיקון דיווח נוכחות על ידי מנהל": "attendance.corrected",
  "development_mode|מצב פיתוח אישי כובה": "development_mode.disabled",
  "development_mode|מצב פיתוח אישי הופעל": "development_mode.enabled",
  "dynamic_availability_period|מועד אחרון להגשת אילוצים עודכן": "availability.deadline.updated",
  "dynamic_availability_period|תוקנה קדימות יום שישי/שבת בתקופת אילוצים": "availability.period.weekend_priority_fixed",
  "dynamic_availability_period|תקופת אילוצים עודכנה בעקבות שינוי מבנה תפקיד": "availability.period.synced",
  "dynamic_historical_assignment|שיבוץ היסטורי תוקן על ידי מנהל מורשה": "schedule.historical_assignment.corrected",
  "dynamic_job_type|סוג תפקיד דינמי הוקפא": "dynamic_job_type.frozen",
  "dynamic_job_type|סוג תפקיד דינמי נמחק": "dynamic_job_type.deleted",
  "dynamic_job_type|סוג תפקיד דינמי הופעל מחדש": "dynamic_job_type.reactivated",
  "dynamic_schedule_draft|שיבוץ בטיוטה הדינמית נערך ידנית": "schedule.draft.updated",
  "dynamic_schedule_draft|טיוטת סבב חודשי דינמי נוצרה": "schedule.draft.created",
  "dynamic_schedule_publication|שיבוץ בלוח דינמי שונה על ידי מנהל": "schedule.assignment.updated",
  "dynamic_schedule_publication|משמרת בלוח דינמי סומנה כלא מאוישת": "schedule.assignment.unassigned",
  "dynamic_schedule_publication|לוח דינמי פורסם": "schedule.published",
  "dynamic_schedule_publication|נשלחה התראת פרסום לוח דינמי": "notification.schedule_published.sent",
  "dynamic_schedule_publication|עמדה לא מאוישת בלוח דינמי אוישה על ידי מנהל": "schedule.assignment.filled",
  "dynamic_schedule_publication|שיבוץ בלוח דינמי שונה על ידי עובד במסגרת עריכה עצמית": "schedule.assignment.self_updated",
  "dynamic_schedule_publication|שיבוץ של עובד אחר בלוח דינמי שונה על ידי עובד מורשה": "schedule.assignment.delegated_updated",
  "dynamic_schedule_publication|שיבוץ אישי בלוח דינמי שונה על ידי העובד": "schedule.assignment.self_updated",
  "job_type|הגדרות תזכורות אוטומטיות לאילוצים עודכנו": "job_type.reminders.updated",
  "job_type|סבב חודשי אותחל": "job_type.rotation.initialized",
  "job_type|סבב חודשי עודכן ידנית": "job_type.rotation.updated",
  "job_type_membership|עובד צורף לתפקיד דינמי": "dynamic_job_type.member.added",
  "notification|נשלח עדכון יזום לעובדי המערכת": "notification.announcement.sent",
};
export function effectiveAuditAction(entry: Pick<AuditLogEntry,'action'|'entityType'|'summary'>): string {
  return entry.action === 'system_event'
    ? (legacy[`${entry.entityType}|${entry.summary}`] ?? entry.action)
    : entry.action;
}
