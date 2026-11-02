/**
 * קובץ: src/types/driverSchedule.ts
 * מטרה: הגדרת טיפוסים וחוזי נתונים עבור כוננים / שיבוץ.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: DriverSchedulePeriodStatus, DriverAssignmentSource, DriverScheduleDraftAssignment, CreateDriverScheduleDraftResponse, DriverSchedulePeriod, DriverScheduleDay, DriverScheduleDriver, DriverScheduleStatistics, DriverScheduleData, GetDriverScheduleRequest ועוד.
 * - תיאור מבנה הקלט והפלט לבדיקת טיפוסים בזמן פיתוח.
 */
/**
 * טיפוס DriverSchedulePeriodStatus: תקופת שיבוץ.
 */
export type DriverSchedulePeriodStatus =
  | 'draft'
  | 'published'
  | 'archived';

/**
 * טיפוס DriverAssignmentSource: מקור השיבוץ.
 */
export type DriverAssignmentSource =
  | 'automatic'
  | 'manual'
  | 'swap'
  | 'import';

/**
 * חוזה הנתונים DriverScheduleDraftAssignment: כוננים / שיבוץ / טיוטה / הקצאה.
 */
export interface DriverScheduleDraftAssignment {
  // scheduleDayId — מזהה היום.
  scheduleDayId: string;

  // dutyDate — תאריך.
  dutyDate: string;

  weekdayNumber: number;

  // weekdayName — שם.
  weekdayName: string;

  // originalUserId — מזהה משתמש.
  originalUserId:
    string | null;

  // assignedUserId — מזהה העובד המשובץ.
  assignedUserId:
    string | null;

  // assignmentSource — מקור השיבוץ.
  assignmentSource:
    DriverAssignmentSource | null;

  isAssigned: boolean;

  // notes — הערות.
  notes:
    string | null;

  spacingWarning: boolean;
}

/**
 * חוזה הנתונים CreateDriverScheduleDraftResponse: כוננים / שיבוץ / טיוטה / תוצאת הפעולה.
 */
export interface CreateDriverScheduleDraftResponse {
  // schedulePeriodId — תקופת שיבוץ.
  schedulePeriodId: string;

  // availabilityPeriodId — תקופת אילוצים.
  availabilityPeriodId: string;

  // year — שנה.
  year: number;

  // month — חודש.
  month: number;

  // status — סטטוס.
  status:
    DriverSchedulePeriodStatus;

  // activeDrivers — פעיל.
  activeDrivers: number;

  // createdDays — ימים.
  createdDays: number;

  // assignedDays — ימים.
  assignedDays: number;

  // unassignedDays — ימים.
  unassignedDays: number;

  // warningCount — כמות.
  warningCount: number;

  hasWarnings: boolean;

  // createdAt — מועד יצירה.
  createdAt: string;

  // assignments — הקצאות.
  assignments:
    DriverScheduleDraftAssignment[];
}

/**
 * חוזה הנתונים DriverSchedulePeriod: תקופת שיבוץ.
 */
export interface DriverSchedulePeriod {
  // id — מזהה.
  id: string;

  // year — שנה.
  year: number;

  // month — חודש.
  month: number;

  // status — סטטוס.
  status:
    DriverSchedulePeriodStatus;

  // availabilityPeriodId — תקופת אילוצים.
  availabilityPeriodId:
    string | null;

  // title — כותרת.
  title:
    string | null;

  // publishedAt — פורסם.
  publishedAt:
    string | null;

  archivedAt:
    string | null;

  createdBy:
    string | null;

  updatedBy:
    string | null;

  // createdAt — מועד יצירה.
  createdAt: string;

  // updatedAt — מועד עדכון.
  updatedAt: string;
}

/**
 * חוזה הנתונים DriverScheduleDay: כוננים / שיבוץ / יום.
 */
export interface DriverScheduleDay {
  // id — מזהה.
  id: string;

  // periodId — מזהה התקופה.
  periodId: string;

  // dutyDate — תאריך.
  dutyDate: string;

  weekdayNumber: number;

  // weekdayName — שם.
  weekdayName: string;

  // originalUserId — מזהה משתמש.
  originalUserId:
    string | null;

  // originalUserName — משתמש / שם.
  originalUserName:
    string | null;

  // assignedUserId — מזהה העובד המשובץ.
  assignedUserId:
    string | null;

  // assignedUserName — משתמש / שם.
  assignedUserName:
    string | null;

  // assignmentSource — מקור השיבוץ.
  assignmentSource:
    DriverAssignmentSource | null;

  // isLocked — האם הרשומה נעולה.
  isLocked: boolean;

  // notes — הערות.
  notes:
    string | null;

  spacingWarning: boolean;

  // createdAt — מועד יצירה.
  createdAt: string;

  // updatedAt — מועד עדכון.
  updatedAt: string;
}

/**
 * חוזה הנתונים DriverScheduleDriver: כוננים / שיבוץ.
 */
export interface DriverScheduleDriver {
  // id — מזהה.
  id: string;

  // displayName — שם תצוגה.
  displayName: string;

  // scheduleName — שיבוץ / שם.
  scheduleName:
    string | null;

  // email — כתובת דוא״ל.
  email: string;

  // isActive — האם הרשומה פעילה.
  isActive: boolean;
}

/**
 * חוזה הנתונים DriverScheduleStatistics: כוננים / שיבוץ / סטטיסטיקה.
 */
export interface DriverScheduleStatistics {
  // totalDays — סך הכול / ימים.
  totalDays: number;

  // assignedDays — ימים.
  assignedDays: number;

  // unassignedDays — ימים.
  unassignedDays: number;

  // warningCount — כמות.
  warningCount: number;
}

/**
 * חוזה הנתונים DriverScheduleData: כוננים / שיבוץ / נתונים.
 */
export interface DriverScheduleData {
  // period — תקופה.
  period:
    DriverSchedulePeriod | null;

  // days — ימים.
  days:
    DriverScheduleDay[];

  drivers:
    DriverScheduleDriver[];

  // statistics — סטטיסטיקה.
  statistics:
    DriverScheduleStatistics;
}

/**
 * חוזה הנתונים GetDriverScheduleRequest: כוננים / שיבוץ / נתוני הבקשה.
 */
export interface GetDriverScheduleRequest {
  // schedulePeriodId — תקופת שיבוץ (אופציונלי).
  schedulePeriodId?:
    string | null;

  // year — שנה (אופציונלי).
  year?:
    number | null;

  // month — חודש (אופציונלי).
  month?:
    number | null;
}
/**
 * חוזה הנתונים UpdateDriverScheduleDayRequest: כוננים / שיבוץ / יום / נתוני הבקשה.
 */
export interface UpdateDriverScheduleDayRequest {
  // scheduleDayId — מזהה היום.
  scheduleDayId: string;

  // assignedUserId — מזהה העובד המשובץ.
  assignedUserId:
    string | null;

  // isLocked — האם הרשומה נעולה.
  isLocked: boolean;

  // note — הערה.
  note:
    string | null;
}

/**
 * חוזה הנתונים UpdateDriverScheduleDayResponse: כוננים / שיבוץ / יום / תוצאת הפעולה.
 */
export interface UpdateDriverScheduleDayResponse {
  // scheduleDayId — מזהה היום.
  scheduleDayId: string;

  // periodId — מזהה התקופה.
  periodId: string;

  // dutyDate — תאריך.
  dutyDate: string;

  // assignedUserId — מזהה העובד המשובץ.
  assignedUserId:
    string | null;

  // assignedUserName — משתמש / שם.
  assignedUserName:
    string | null;

  // assignmentSource — מקור השיבוץ.
  assignmentSource:
    DriverAssignmentSource | null;

  // isLocked — האם הרשומה נעולה.
  isLocked: boolean;

  // notes — הערות.
  notes:
    string | null;

  hasWarnings: boolean;

  warnings:
    string[];
}
/**
 * חוזה הנתונים PublishDriverScheduleResponse: כוננים / שיבוץ / תוצאת הפעולה.
 */
export interface PublishDriverScheduleResponse {
  // schedulePeriodId — תקופת שיבוץ.
  schedulePeriodId: string;

  // year — שנה.
  year: number;

  // month — חודש.
  month: number;

  // status — סטטוס.
  status: 'published';

  // totalDays — סך הכול / ימים.
  totalDays: number;

  // assignedDays — ימים.
  assignedDays: number;

  // unassignedDays — ימים.
  unassignedDays: number;

  // publishedAt — פורסם.
  publishedAt: string;

  // alreadyPublished — פורסם.
  alreadyPublished: boolean;
}

/**
 * חוזה הנתונים TransferMyDriverDutyRequest: כוננים / נתוני הבקשה.
 */
export interface TransferMyDriverDutyRequest {
  // scheduleDayId — מזהה היום.
  scheduleDayId: string;

  // newDriverId — כוננים / מזהה.
  newDriverId: string;
}

/**
 * חוזה הנתונים TransferMyDriverDutyResponse: כוננים / תוצאת הפעולה.
 */
export interface TransferMyDriverDutyResponse {
  // scheduleDayId — מזהה היום.
  scheduleDayId: string;

  // periodId — מזהה התקופה.
  periodId: string;

  // dutyDate — תאריך.
  dutyDate: string;

  // previousDriverId — כוננים / מזהה.
  previousDriverId: string;

  // previousDriverName — כוננים / שם.
  previousDriverName: string;

  // assignedUserId — מזהה העובד המשובץ.
  assignedUserId: string;

  // assignedUserName — משתמש / שם.
  assignedUserName: string;

  // assignmentSource — מקור השיבוץ.
  assignmentSource: 'swap';

  hasWarnings: boolean;

  warnings: string[];
}