/**
 * קובץ: src/types/dynamicPilotQa.ts
 * מטרה: הגדרת טיפוסים וחוזי נתונים עבור דינמי.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: DynamicPilotQaStatus, DynamicPilotQaCheck, GvkQaReconciliationRow, DynamicPilotQaReport.
 * - תיאור מבנה הקלט והפלט לבדיקת טיפוסים בזמן פיתוח.
 */
/**
 * טיפוס DynamicPilotQaStatus: דינמי / סטטוס.
 */
export type DynamicPilotQaStatus = 'pass' | 'warn' | 'fail';

/**
 * חוזה הנתונים DynamicPilotQaCheck: דינמי.
 */
export interface DynamicPilotQaCheck {
  code: string;
  // status — סטטוס.
  status: DynamicPilotQaStatus;
  area: string;
  // title — כותרת.
  title: string;
  // message — הודעה.
  message: string;
  // count — כמות.
  count: number;
}

/**
 * חוזה הנתונים GvkQaReconciliationRow: שורה.
 */
export interface GvkQaReconciliationRow {
  // source — מקור.
  source: 'dispatcher' | 'on_call' | 'morning_driver';
  // year — שנה.
  year: number;
  // month — חודש.
  month: number;
  // legacyCount — כמות.
  legacyCount: number;
  // dynamicAssignedCount — דינמי / כמות.
  dynamicAssignedCount: number;
  // dynamicUnassignedCount — דינמי / כמות.
  dynamicUnassignedCount: number;
  // coveredCount — כמות.
  coveredCount: number;
  matches: boolean;
}

/**
 * חוזה הנתונים DynamicPilotQaReport: דינמי / דוח.
 */
export interface DynamicPilotQaReport {
  generatedAt: string;
  readyForFullQa: boolean;
  // summary — סיכום.
  summary: {
    passes: number;
    warnings: number;
    failures: number;
    // dynamicFirstEnabled — דינמי / האם האפשרות מופעלת.
    dynamicFirstEnabled: boolean;
    // activeJobTypes — סוגי תפקידים.
    activeJobTypes: number;
    // activeMemberships — פעיל / שיוכים לתפקיד.
    activeMemberships: number;
    // dynamicUsers — דינמי / משתמשים.
    dynamicUsers: number;
    publications: number;
    // assignments — הקצאות.
    assignments: number;
    // pendingExchanges — ממתין.
    pendingExchanges: number;
  };
  checks: DynamicPilotQaCheck[];
  gvkReconciliation: GvkQaReconciliationRow[];
}
