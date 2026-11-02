/**
 * קובץ: src/types/gvkLegacyMigration.ts
 * מטרה: הגדרת חוזי הקלט והפלט של תהליכי מעבר מנתונים ותיקים.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: GvkLegacySourceKind, GvkLegacyMigrationMappings, GvkLegacyMigrationTarget, GvkLegacyMigrationAreaSummary, GvkLegacyMigrationIssue, GvkLegacyMigrationPreview, GvkLegacyMigrationResult.
 * - תיאור מבנה הקלט והפלט לבדיקת טיפוסים בזמן פיתוח.
 */
/**
 * טיפוס GvkLegacySourceKind: מקור.
 */
export type GvkLegacySourceKind = 'dispatcher' | 'on_call' | 'morning_driver';

/**
 * חוזה הנתונים GvkLegacyMigrationMappings: הנתון GvkLegacyMigrationMappings בהקשר הפעולה.
 */
export interface GvkLegacyMigrationMappings {
  // dispatcher — מוקדנים.
  dispatcher: string;
  on_call: string;
  // morning_driver — כונני בוקר.
  morning_driver: string;
}

/**
 * חוזה הנתונים GvkLegacyMigrationTarget: יעד.
 */
export interface GvkLegacyMigrationTarget {
  // id — מזהה.
  id: string;
  // name — שם.
  name: string;
  code: string;
  // strategy — שיטת שיבוץ.
  strategy: string;
}

/**
 * חוזה הנתונים GvkLegacyMigrationAreaSummary: סיכום.
 */
export interface GvkLegacyMigrationAreaSummary {
  // members — חברי התפקיד.
  members: number;
  // historicalPeriods — נתונים היסטוריים / תקופות.
  historicalPeriods: number;
  // livePeriods — תקופות.
  livePeriods: number;
  // liveAssignments — הקצאות.
  liveAssignments: number;
}

/**
 * חוזה הנתונים GvkLegacyMigrationIssue: הנתון GvkLegacyMigrationIssue בהקשר הפעולה.
 */
export interface GvkLegacyMigrationIssue {
  code: string;
  // message — הודעה.
  message: string;
}

/**
 * חוזה הנתונים GvkLegacyMigrationPreview: הנתון GvkLegacyMigrationPreview בהקשר הפעולה.
 */
export interface GvkLegacyMigrationPreview {
  adapter: 'gvk_legacy_v1';
  ready: boolean;
  blockers: GvkLegacyMigrationIssue[];
  warnings: GvkLegacyMigrationIssue[];
  targets: {
    // dispatcher — מוקדנים.
    dispatcher: GvkLegacyMigrationTarget | null;
    onCall: GvkLegacyMigrationTarget | null;
    // morningDriver — כונני בוקר.
    morningDriver: GvkLegacyMigrationTarget | null;
  };
  legacy: {
    // dispatcher — מוקדנים.
    dispatcher: GvkLegacyMigrationAreaSummary;
    onCall: GvkLegacyMigrationAreaSummary;
    // morningDriver — כונני בוקר.
    morningDriver: GvkLegacyMigrationAreaSummary;
  };
}

/**
 * חוזה הנתונים GvkLegacyMigrationResult: תוצאה.
 */
export interface GvkLegacyMigrationResult {
  // runId — מזהה.
  runId: string;
  // membersAdded — חברי התפקיד.
  membersAdded: number;
  // history — היסטוריה.
  history: Record<string, unknown>;
  // livePeriodsAdded — תקופות.
  livePeriodsAdded: number;
  // liveAssignmentsAdded — הקצאות.
  liveAssignmentsAdded: number;
  // legacyDataDeleted — נתונים.
  legacyDataDeleted: false;
  // cutoverEnabled — מעבר למנגנון הדינמי / האם האפשרות מופעלת.
  cutoverEnabled: false;
  // message — הודעה.
  message: string;
}
