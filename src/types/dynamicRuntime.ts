/**
 * קובץ: src/types/dynamicRuntime.ts
 * מטרה: הגדרת טיפוסים וחוזי נתונים עבור דינמי.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: DynamicRuntimeUpcomingAssignment, DynamicRuntimeParallelAssignment, DynamicRuntimeAvailabilityState, DynamicRuntimeRole, DynamicRuntimeManagedRole, DynamicRuntimeContext.
 * - תיאור מבנה הקלט והפלט לבדיקת טיפוסים בזמן פיתוח.
 */
import type {
  DynamicScheduleChangeMode,
  DynamicSchedulingStrategy,
  DynamicWorkStructureMode,
} from './dynamicScheduling';

/**
 * חוזה הנתונים DynamicRuntimeUpcomingAssignment: דינמי / הקצאה.
 */
export interface DynamicRuntimeUpcomingAssignment {
  // publicationId — מזהה.
  publicationId: string;
  // assignmentId — הקצאה / מזהה.
  assignmentId: string;
  // year — שנה.
  year: number;
  // month — חודש.
  month: number;
  // shiftDate — תאריך המשמרת.
  shiftDate: string;
  // shiftCode — משמרת.
  shiftCode: string;
  // shiftName — משמרת / שם.
  shiftName: string;
  // startTime — שעת התחלה.
  startTime: string;
  // endTime — שעת סיום.
  endTime: string;
}


/**
 * חוזה הנתונים DynamicRuntimeParallelAssignment: דינמי / הקצאה.
 */
export interface DynamicRuntimeParallelAssignment {
  // jobTypeId — מזהה סוג התפקיד.
  jobTypeId: string;
  // jobTypeName — סוג תפקיד.
  jobTypeName: string;
  // workMode — מצב פעולה.
  workMode: DynamicWorkStructureMode;
  // assignmentId — הקצאה / מזהה.
  assignmentId: string;
  // shiftDate — תאריך המשמרת.
  shiftDate: string;
  // shiftCode — משמרת.
  shiftCode: string;
  // shiftName — משמרת / שם.
  shiftName: string;
  // startTime — שעת התחלה.
  startTime: string;
  // endTime — שעת סיום.
  endTime: string;
  // userId — מזהה משתמש.
  userId: string | null;
  // displayName — שם תצוגה.
  displayName: string | null;
}

/**
 * חוזה הנתונים DynamicRuntimeAvailabilityState: דינמי / אילוצים וזמינות / מצב.
 */
export interface DynamicRuntimeAvailabilityState {
  // periodId — מזהה התקופה.
  periodId: string;
  // year — שנה.
  year: number;
  // month — חודש.
  month: number;
  // status — סטטוס.
  status: string;
  // submissionDeadline — מועד אחרון להגשת אילוצים.
  submissionDeadline: string | null;
  // slotCount — כמות.
  slotCount: number;
  // filledCount — כמות.
  filledCount: number;
  // submissionStatus — מצב ההגשה.
  submissionStatus: string | null;
}

/**
 * חוזה הנתונים DynamicRuntimeRole: דינמי.
 */
export interface DynamicRuntimeRole {
  // jobTypeId — מזהה סוג התפקיד.
  jobTypeId: string;
  // jobTypeName — סוג תפקיד.
  jobTypeName: string;
  description: string | null;
  isPrimary: boolean;
  // workMode — מצב פעולה.
  workMode: DynamicWorkStructureMode;
  // schedulingStrategy — שיטת שיבוץ.
  schedulingStrategy: DynamicSchedulingStrategy;
  // scheduleChangeMode — שיבוץ / מצב פעולה.
  scheduleChangeMode: DynamicScheduleChangeMode;
  // availabilityEnabled — אילוצים וזמינות / האם האפשרות מופעלת.
  availabilityEnabled: boolean;
  // publishedAssignmentCount — פורסם / הקצאה / כמות.
  publishedAssignmentCount: number;
  // nextAssignment — הקצאה.
  nextAssignment: DynamicRuntimeUpcomingAssignment | null;
  // parallelAssignments — הקצאות.
  parallelAssignments: DynamicRuntimeParallelAssignment[];
  // availability — אילוצים וזמינות.
  availability: DynamicRuntimeAvailabilityState | null;
}

/**
 * חוזה הנתונים DynamicRuntimeManagedRole: דינמי.
 */
export interface DynamicRuntimeManagedRole {
  // jobTypeId — מזהה סוג התפקיד.
  jobTypeId: string;
  // jobTypeName — סוג תפקיד.
  jobTypeName: string;
  // memberCount — כמות.
  memberCount: number;
  // currentPeriodStatus — תקופה / סטטוס.
  currentPeriodStatus: string | null;
  // publishedAssignmentCount — פורסם / הקצאה / כמות.
  publishedAssignmentCount: number;
}

/**
 * חוזה הנתונים DynamicRuntimeContext: דינמי.
 */
export interface DynamicRuntimeContext {
  // hasDynamicMemberships — דינמי / שיוכים לתפקיד.
  hasDynamicMemberships: boolean;
  // primaryJobTypeName — סוג תפקיד.
  primaryJobTypeName: string | null;
  roles: DynamicRuntimeRole[];
  // canManageDynamicScheduling — האם פעולת ניהול מותרת.
  canManageDynamicScheduling: boolean;
  managedRoles: DynamicRuntimeManagedRole[];
  generatedAt: string;
}
