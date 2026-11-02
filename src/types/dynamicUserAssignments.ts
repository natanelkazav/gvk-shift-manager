/**
 * קובץ: src/types/dynamicUserAssignments.ts
 * מטרה: הגדרת טיפוסים וחוזי נתונים עבור דינמי / משתמש / הקצאות.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: DynamicUserAssignmentItem, DynamicUserAssignmentEditor, DynamicUserAssignmentSelection.
 * - תיאור מבנה הקלט והפלט לבדיקת טיפוסים בזמן פיתוח.
 */
import type { DynamicMemberEmploymentScope } from './dynamicScheduling';

/**
 * חוזה הנתונים DynamicUserAssignmentItem: דינמי / משתמש / הקצאה / פריט.
 */
export interface DynamicUserAssignmentItem {
  // jobTypeId — מזהה סוג התפקיד.
  jobTypeId: string;
  // jobTypeName — סוג תפקיד.
  jobTypeName: string;
  // jobTypeDescription — סוג תפקיד.
  jobTypeDescription: string | null;
  // jobTypeEmploymentScope — סוג תפקיד.
  jobTypeEmploymentScope: 'full_time' | 'part_time' | 'flexible';
  isMember: boolean;
  isManager: boolean;
  employmentScope: DynamicMemberEmploymentScope | null;
  // partTimeDefinition — זמן.
  partTimeDefinition: Record<string, unknown>;
}

/**
 * חוזה הנתונים DynamicUserAssignmentEditor: דינמי / משתמש / הקצאה.
 */
export interface DynamicUserAssignmentEditor {
  // userId — מזהה משתמש.
  userId: string;
  // assignments — הקצאות.
  assignments: DynamicUserAssignmentItem[];
}

/**
 * חוזה הנתונים DynamicUserAssignmentSelection: דינמי / משתמש / הקצאה / בחירה.
 */
export interface DynamicUserAssignmentSelection {
  // jobTypeId — מזהה סוג התפקיד.
  jobTypeId: string;
  isMember: boolean;
  isManager: boolean;
  employmentScope: DynamicMemberEmploymentScope | null;
  // partTimeDefinition — זמן (אופציונלי).
  partTimeDefinition?: Record<string, unknown>;
}
