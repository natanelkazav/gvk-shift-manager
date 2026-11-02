/**
 * קובץ: src/types/unifiedSchedule.ts
 * מטרה: הגדרת טיפוסים וחוזי נתונים עבור שיבוץ.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: UnifiedScheduleCategory, UnifiedScheduleEntry, UnifiedScheduleFilters, UnifiedScheduleMonth, UnifiedScheduleLoadWarnings, UnifiedScheduleData, DispatcherScheduleMonthPeriod, DispatcherScheduleMonthShift, DispatcherScheduleMonthData.
 * - תיאור מבנה הקלט והפלט לבדיקת טיפוסים בזמן פיתוח.
 */
/**
 * טיפוס UnifiedScheduleCategory: שיבוץ.
 */
export type UnifiedScheduleCategory =
  | 'dispatcher'
  | 'morning_driver'
  | 'on_call';

/**
 * חוזה הנתונים UnifiedScheduleEntry: שיבוץ / רשומה.
 */
export interface UnifiedScheduleEntry {
  // id — מזהה.
  id: string;

  // sourceId — מקור / מזהה.
  sourceId: string;

  // date — תאריך.
  date: string;

  category:
    UnifiedScheduleCategory;

  // assignedUserId — מזהה העובד המשובץ.
  assignedUserId:
    string | null;

  // assignedUserName — משתמש / שם.
  assignedUserName:
    string | null;

  // startTime — שעת התחלה.
  startTime:
    string | null;

  // endTime — שעת סיום.
  endTime:
    string | null;

  // isLocked — האם הרשומה נעולה.
  isLocked: boolean;

  // notes — הערות.
  notes:
    string | null;

  // scheduleStatus — שיבוץ / סטטוס.
  scheduleStatus:
    string | null;
}

/**
 * חוזה הנתונים UnifiedScheduleFilters: שיבוץ / מסננים.
 */
export interface UnifiedScheduleFilters {
  // dispatcher — מוקדנים.
  dispatcher: boolean;

  // morningDriver — כונני בוקר.
  morningDriver: boolean;

  onCall: boolean;
}

/**
 * חוזה הנתונים UnifiedScheduleMonth: שיבוץ / חודש.
 */
export interface UnifiedScheduleMonth {
  // year — שנה.
  year: number;

  // month — חודש.
  month: number;
}

/**
 * חוזה הנתונים UnifiedScheduleLoadWarnings: שיבוץ.
 */
export interface UnifiedScheduleLoadWarnings {
  // dispatcher — מוקדנים.
  dispatcher:
    string | null;

  // morningDriver — כונני בוקר.
  morningDriver:
    string | null;

  onCall:
    string | null;
}

/**
 * חוזה הנתונים UnifiedScheduleData: שיבוץ / נתונים.
 */
export interface UnifiedScheduleData {
  // entries — רשומות.
  entries:
    UnifiedScheduleEntry[];

  warnings:
    UnifiedScheduleLoadWarnings;
}
/**
 * חוזה הנתונים DispatcherScheduleMonthPeriod: מוקדנים / שיבוץ / חודש / תקופה.
 */
export interface DispatcherScheduleMonthPeriod {
  // id — מזהה.
  id: string;

  // year — שנה.
  year: number;

  // month — חודש.
  month: number;

  // status — סטטוס.
  status: string;

  // publishedAt — פורסם.
  publishedAt:
    string | null;

  // createdAt — מועד יצירה.
  createdAt: string;

  // updatedAt — מועד עדכון.
  updatedAt: string;
}

/**
 * חוזה הנתונים DispatcherScheduleMonthShift: מוקדנים / שיבוץ / חודש / משמרת.
 */
export interface DispatcherScheduleMonthShift {
  // id — מזהה.
  id: string;

  // periodId — מזהה התקופה.
  periodId: string;

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
  holidayName:
    string | null;

  // assignedUserId — מזהה העובד המשובץ.
  assignedUserId:
    string | null;

  // assignedUserName — משתמש / שם.
  assignedUserName:
    string | null;

  isIntentionallyUnassigned: boolean;

  // isLocked — האם הרשומה נעולה.
  isLocked: boolean;

  // notes — הערות.
  notes:
    string | null;
}

/**
 * חוזה הנתונים DispatcherScheduleMonthData: מוקדנים / שיבוץ / חודש / נתונים.
 */
export interface DispatcherScheduleMonthData {
  // period — תקופה.
  period:
    DispatcherScheduleMonthPeriod | null;

  // shifts — משמרות.
  shifts:
    DispatcherScheduleMonthShift[];
}