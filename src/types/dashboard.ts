/**
 * קובץ: src/types/dashboard.ts
 * מטרה: הגדרת טיפוסים וחוזי נתונים עבור לוח בקרה.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: DashboardPerson, DashboardMonthlyProgress, DashboardDispatcherShift, DispatcherDashboardData, DashboardDutyDispatcherShift, DashboardDriverDuty, DriverDashboardData, DashboardMorningDriverShift, MorningDriverDashboardData, ManagerCurrentDispatcher ועוד.
 * - תיאור מבנה הקלט והפלט לבדיקת טיפוסים בזמן פיתוח.
 */
import type {
  UserRole,
} from './auth';

/**
 * חוזה הנתונים DashboardPerson: לוח בקרה.
 */
export interface DashboardPerson {
  // id — מזהה.
  id: string;
  // displayName — שם תצוגה.
  displayName: string | null;
  // scheduleName — שיבוץ / שם.
  scheduleName: string | null;
}

/**
 * חוזה הנתונים DashboardMonthlyProgress: לוח בקרה.
 */
export interface DashboardMonthlyProgress {
  // year — שנה.
  year: number;
  // month — חודש.
  month: number;
  completed: number;
  // total — סך הכול.
  total: number;
  percentage: number;
}

/**
 * חוזה הנתונים DashboardDispatcherShift: לוח בקרה / מוקדנים / משמרת.
 */
export interface DashboardDispatcherShift {
  // id — מזהה.
  id: string;
  // shiftDate — תאריך המשמרת.
  shiftDate: string;
  // startsAt — מועד התחלה.
  startsAt: string;
  // endsAt — מועד סיום.
  endsAt: string;
  // shiftCode — משמרת.
  shiftCode: string;
  // scheduleType — סוג יום השיבוץ.
  scheduleType: string;
  // isPremium — תעריף מוגדל.
  isPremium: boolean;
  // holidayName — חג / שם.
  holidayName: string | null;
  // driver — כוננים.
  driver: DashboardPerson | null;
}

/**
 * חוזה הנתונים DispatcherDashboardData: מוקדנים / לוח בקרה / נתונים.
 */
export interface DispatcherDashboardData {
  // currentShift — משמרת.
  currentShift: DashboardDispatcherShift | null;
  // nextShift — משמרת.
  nextShift: DashboardDispatcherShift | null;
  monthlyProgress: DashboardMonthlyProgress;
}

/**
 * חוזה הנתונים DashboardDutyDispatcherShift: לוח בקרה / מוקדנים / משמרת.
 */
export interface DashboardDutyDispatcherShift {
  // id — מזהה.
  id: string;
  // startsAt — מועד התחלה.
  startsAt: string;
  // endsAt — מועד סיום.
  endsAt: string;
  // displayName — שם תצוגה.
  displayName: string | null;
  // scheduleName — שיבוץ / שם.
  scheduleName: string | null;
}

/**
 * חוזה הנתונים DashboardDriverDuty: לוח בקרה / כוננים.
 */
export interface DashboardDriverDuty {
  // id — מזהה.
  id: string;
  // dutyDate — תאריך.
  dutyDate: string;
  weekdayNumber: number;
  // weekdayName — שם.
  weekdayName: string;
  // notes — הערות.
  notes: string | null;
  // dispatcherShifts — מוקדנים / משמרות.
  dispatcherShifts: DashboardDutyDispatcherShift[];
}

/**
 * חוזה הנתונים DriverDashboardData: כוננים / לוח בקרה / נתונים.
 */
export interface DriverDashboardData {
  currentDuty: DashboardDriverDuty | null;
  nextDuty: DashboardDriverDuty | null;
  monthlyProgress: DashboardMonthlyProgress;
}


/**
 * חוזה הנתונים DashboardMorningDriverShift: כונני בוקר.
 */
export interface DashboardMorningDriverShift {
  // assignmentId — הקצאה / מזהה.
  assignmentId: string;
  // shiftDate — תאריך המשמרת.
  shiftDate: string;
  // weekdayName — שם.
  weekdayName: string;
  // startTime — שעת התחלה.
  startTime: string;
  // endTime — שעת סיום.
  endTime: string;
  // shiftType — משמרת.
  shiftType: string;
  parallelDrivers: DashboardPerson[];
}

/**
 * חוזה הנתונים MorningDriverDashboardData: כונני בוקר.
 */
export interface MorningDriverDashboardData {
  // currentShift — משמרת.
  currentShift: DashboardMorningDriverShift | null;
  // nextShift — משמרת.
  nextShift: DashboardMorningDriverShift | null;
  monthlyProgress: DashboardMonthlyProgress;
}

/**
 * חוזה הנתונים ManagerCurrentDispatcher: מוקדנים.
 */
export interface ManagerCurrentDispatcher {
  // shiftId — מזהה המשמרת.
  shiftId: string;
  // startsAt — מועד התחלה.
  startsAt: string;
  // endsAt — מועד סיום.
  endsAt: string;
  // userId — מזהה משתמש.
  userId: string | null;
  // displayName — שם תצוגה.
  displayName: string | null;
  // scheduleName — שיבוץ / שם.
  scheduleName: string | null;
}

/**
 * חוזה הנתונים ManagerCurrentDriver: כוננים.
 */
export interface ManagerCurrentDriver {
  // dutyId — מזהה.
  dutyId: string;
  // dutyDate — תאריך.
  dutyDate: string;
  // userId — מזהה משתמש.
  userId: string | null;
  // displayName — שם תצוגה.
  displayName: string | null;
  // scheduleName — שיבוץ / שם.
  scheduleName: string | null;
}

/**
 * חוזה הנתונים ManagerDashboardSummaryItem: לוח בקרה / סיכום / פריט.
 */
export interface ManagerDashboardSummaryItem {
  completed: number;
  // total — סך הכול.
  total: number;
  unassigned: number;
  percentage: number;
}

/**
 * חוזה הנתונים ManagerDashboardData: לוח בקרה / נתונים.
 */
export interface ManagerDashboardData {
  // currentDispatcher — מוקדנים.
  currentDispatcher: ManagerCurrentDispatcher | null;
  // currentDriver — כוננים.
  currentDriver: ManagerCurrentDriver | null;
  // monthlySummary — סיכום.
  monthlySummary: {
    // year — שנה.
    year: number;
    // month — חודש.
    month: number;
    // dispatcherShifts — מוקדנים / משמרות.
    dispatcherShifts: ManagerDashboardSummaryItem;
    // driverDuties — כוננים.
    driverDuties: ManagerDashboardSummaryItem;
  };
}

/**
 * חוזה הנתונים DashboardResponse: לוח בקרה / תוצאת הפעולה.
 */
export interface DashboardResponse {
  // user — משתמש.
  user: {
    // id — מזהה.
    id: string;
    role: UserRole;
  };
  // dispatcher — מוקדנים.
  dispatcher: DispatcherDashboardData | null;
  // driver — כוננים.
  driver: DriverDashboardData | null;
  // morningDriver — כונני בוקר.
  morningDriver: MorningDriverDashboardData | null;
  manager: ManagerDashboardData | null;
  generatedAt: string;
}