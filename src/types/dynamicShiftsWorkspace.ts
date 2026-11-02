/**
 * קובץ: src/types/dynamicShiftsWorkspace.ts
 * מטרה: הגדרת טיפוסים וחוזי נתונים עבור דינמי / משמרות.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: DynamicShiftsWorkspaceRole, DynamicShiftsManagementWorkspace, DynamicScheduleCalendarJobType, DynamicScheduleCalendarAssignment, DynamicScheduleCalendarSlot, DynamicScheduleCalendarWorkspace.
 * - תיאור מבנה הקלט והפלט לבדיקת טיפוסים בזמן פיתוח.
 */
import type { DynamicJobType, DynamicPeriodWorkflowState } from './dynamicScheduling';

/**
 * חוזה הנתונים DynamicShiftsWorkspaceRole: דינמי / משמרות.
 */
export interface DynamicShiftsWorkspaceRole {
  // jobType — סוג תפקיד.
  jobType: DynamicJobType;
  // workflow — תהליך עבודה.
  workflow: DynamicPeriodWorkflowState;
  isExplicitManager: boolean;
  // accessSource — מקור.
  accessSource: 'system_admin' | 'job_type_manager' | 'transition_manager';
}

/**
 * חוזה הנתונים DynamicShiftsManagementWorkspace: דינמי / משמרות.
 */
export interface DynamicShiftsManagementWorkspace {
  // year — שנה.
  year: number;
  // month — חודש.
  month: number;
  roles: DynamicShiftsWorkspaceRole[];
  generatedAt: string;
}

/**
 * חוזה הנתונים DynamicScheduleCalendarJobType: סוג תפקיד.
 */
export interface DynamicScheduleCalendarJobType {
  // id — מזהה.
  id: string;
  // name — שם.
  name: string;
}

/**
 * חוזה הנתונים DynamicScheduleCalendarAssignment: דינמי / שיבוץ / לוח שנה / הקצאה.
 */
export interface DynamicScheduleCalendarAssignment {
  // userId — מזהה משתמש.
  userId: string;
  // displayName — שם תצוגה.
  displayName: string;
  // scheduleName — שיבוץ / שם (אופציונלי).
  scheduleName?: string | null;
}

/**
 * חוזה הנתונים DynamicScheduleCalendarSlot: דינמי / שיבוץ / לוח שנה.
 */
export interface DynamicScheduleCalendarSlot {
  // periodSource — תקופה / מקור.
  periodSource: 'publication' | 'history';
  // sourcePeriodId — מזהה התקופה.
  sourcePeriodId: string;
  // sourceSlotId — מקור / מזהה.
  sourceSlotId: string | null;
  // jobTypeId — מזהה סוג התפקיד.
  jobTypeId: string;
  // jobTypeName — סוג תפקיד.
  jobTypeName: string;
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
  // holidayName — חג / שם.
  holidayName: string | null;
  contains200Percent: boolean;
  // premium200Hours — שעות.
  premium200Hours: number;
  // assignments — הקצאות.
  assignments: DynamicScheduleCalendarAssignment[];
  // unassignedCount — כמות.
  unassignedCount: number;
  // requiredCount — כמות.
  requiredCount: number;
}

/**
 * חוזה הנתונים DynamicScheduleCalendarWorkspace: דינמי / שיבוץ / לוח שנה.
 */
export interface DynamicScheduleCalendarWorkspace {
  // year — שנה.
  year: number;
  // month — חודש.
  month: number;
  generatedAt: string;
  // jobTypes — סוגי תפקידים.
  jobTypes: DynamicScheduleCalendarJobType[];
  slots: DynamicScheduleCalendarSlot[];
}
