/**
 * קובץ: src/types/dynamicCutover.ts
 * מטרה: הגדרת טיפוסים וחוזי נתונים עבור דינמי / מעבר למנגנון הדינמי.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: DynamicCutoverState, LegacyFreezeReadiness.
 * - תיאור מבנה הקלט והפלט לבדיקת טיפוסים בזמן פיתוח.
 */
/**
 * חוזה הנתונים DynamicCutoverState: דינמי / מעבר למנגנון הדינמי / מצב.
 */
export interface DynamicCutoverState {
  // dynamicFirstEnabled — דינמי / האם האפשרות מופעלת.
  dynamicFirstEnabled: boolean;
  // hasDynamicMembership — דינמי / שיוך לתפקיד.
  hasDynamicMembership: boolean;
  // useDynamicRuntime — דינמי.
  useDynamicRuntime: boolean;
  legacyFrozen: boolean;
}

/**
 * חוזה הנתונים LegacyFreezeReadiness: הנתון LegacyFreezeReadiness בהקשר הפעולה.
 */
export interface LegacyFreezeReadiness {
  ready: boolean;
  // dynamicFirstEnabled — דינמי / האם האפשרות מופעלת.
  dynamicFirstEnabled: boolean;
  // missingLegacyMemberships — שיוכים לתפקיד.
  missingLegacyMemberships: number;
  // missingUsers — משתמשים.
  missingUsers: Array<{
    // userId — מזהה משתמש.
    userId: string;
    // displayName — שם תצוגה.
    displayName: string;
    legacyRole: string;
  }>;
}
