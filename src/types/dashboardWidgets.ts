/**
 * קובץ: src/types/dashboardWidgets.ts
 * מטרה: הגדרת טיפוסים וחוזי נתונים עבור לוח בקרה.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: DashboardStaffingTimeScope, DashboardWidgetJobType, DashboardWidgetPreference, DashboardWidgetSettings, DashboardStaffingAssignment, ManagerDashboardStaffingWidget.
 * - תיאור מבנה הקלט והפלט לבדיקת טיפוסים בזמן פיתוח.
 */
/**
 * טיפוס DashboardStaffingTimeScope: לוח בקרה / זמן.
 */
export type DashboardStaffingTimeScope = 'current' | 'today';

/**
 * חוזה הנתונים DashboardWidgetJobType: סוג תפקיד.
 */
export interface DashboardWidgetJobType {
  // id — מזהה.
  id: string;
  // name — שם.
  name: string;
  // workMode — מצב פעולה.
  workMode: 'shifts' | 'on_call_hourly' | 'on_call_daily';
}

/**
 * חוזה הנתונים DashboardWidgetPreference: לוח בקרה.
 */
export interface DashboardWidgetPreference {
  // id — מזהה (אופציונלי).
  id?: string;
  widgetType: 'staffing';
  // timeScope — זמן.
  timeScope: DashboardStaffingTimeScope;
  // jobTypeId — מזהה סוג התפקיד.
  jobTypeId: string;
  // sortOrder — סדר המיון (אופציונלי).
  sortOrder?: number;
  // enabled — האם האפשרות מופעלת (אופציונלי).
  enabled?: boolean;
}

/**
 * חוזה הנתונים DashboardWidgetSettings: לוח בקרה / הגדרות.
 */
export interface DashboardWidgetSettings {
  canConfigure: boolean;
  // jobTypes — סוגי תפקידים.
  jobTypes: DashboardWidgetJobType[];
  widgets: DashboardWidgetPreference[];
}

/**
 * חוזה הנתונים DashboardStaffingAssignment: לוח בקרה / הקצאה.
 */
export interface DashboardStaffingAssignment {
  // assignmentId — הקצאה / מזהה.
  assignmentId: string;
  // userId — מזהה משתמש.
  userId: string;
  // displayName — שם תצוגה.
  displayName: string;
  // shiftDate — תאריך המשמרת.
  shiftDate: string;
  // shiftName — משמרת / שם.
  shiftName: string;
  // startTime — שעת התחלה.
  startTime: string;
  // endTime — שעת סיום.
  endTime: string;
}

/**
 * חוזה הנתונים ManagerDashboardStaffingWidget: לוח בקרה.
 */
export interface ManagerDashboardStaffingWidget {
  // id — מזהה.
  id: string;
  // timeScope — זמן.
  timeScope: DashboardStaffingTimeScope;
  // jobTypeId — מזהה סוג התפקיד.
  jobTypeId: string;
  // jobTypeName — סוג תפקיד.
  jobTypeName: string;
  // workMode — מצב פעולה.
  workMode: DashboardWidgetJobType['workMode'];
  // assignments — הקצאות.
  assignments: DashboardStaffingAssignment[];
}
