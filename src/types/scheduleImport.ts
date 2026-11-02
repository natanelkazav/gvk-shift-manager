/**
 * קובץ: src/types/scheduleImport.ts
 * מטרה: הגדרת טיפוסים וחוזי נתונים עבור שיבוץ / ייבוא.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: ImportedDispatcherShift, ImportedDriverDuty, ImportedMorningDriverShiftType, ImportedMorningDriverShift, ScheduleImportPeriodType, ScheduleImportPreview, ScheduleImportUserType, ScheduleImportUser, ScheduleImportNameAlias, ScheduleImportUsersData ועוד.
 * - תיאור מבנה הקלט והפלט לבדיקת טיפוסים בזמן פיתוח.
 */
/**
 * חוזה הנתונים ImportedDispatcherShift: מוקדנים / משמרת.
 */
export interface ImportedDispatcherShift {
  // date — תאריך.
  date: string;

  // startTime — שעת התחלה.
  startTime: string;

  // endTime — שעת סיום.
  endTime: string;

  // dispatcherName — מוקדנים / שם.
  dispatcherName: string;
}

/**
 * חוזה הנתונים ImportedDriverDuty: כוננים.
 */
export interface ImportedDriverDuty {
  // date — תאריך.
  date: string;

  // driverName — כוננים / שם.
  driverName: string;

  // note — הערה.
  note: string | null;
}

/**
 * טיפוס ImportedMorningDriverShiftType: כונני בוקר.
 */
export type ImportedMorningDriverShiftType =
  | 'weekday_morning'
  | 'weekday_evening'
  | 'friday_morning';

/**
 * חוזה הנתונים ImportedMorningDriverShift: כונני בוקר.
 */
export interface ImportedMorningDriverShift {
  // date — תאריך.
  date: string;

  // startTime — שעת התחלה.
  startTime: string;

  // endTime — שעת סיום.
  endTime: string;

  // morningDriverName — כונני בוקר.
  morningDriverName: string;

  // assignmentSlot — הקצאה.
  assignmentSlot: number;

  // shiftType — משמרת.
  shiftType:
    ImportedMorningDriverShiftType;

  // minimumWorkers — מספר העובדים המזערי.
  minimumWorkers: number;

  // recommendedWorkers — מספר העובדים המומלץ.
  recommendedWorkers: number;
}

/**
 * טיפוס ScheduleImportPeriodType: שיבוץ / ייבוא / תקופה.
 */
export type ScheduleImportPeriodType =
  | 'historical'
  | 'current'
  | 'future';

/**
 * חוזה הנתונים ScheduleImportPreview: שיבוץ / ייבוא.
 */
export interface ScheduleImportPreview {
  // year — שנה.
  year: number;

  // month — חודש.
  month: number;

  // periodType — תקופה.
  periodType:
    ScheduleImportPeriodType;

  // dispatcherShifts — מוקדנים / משמרות.
  dispatcherShifts:
    ImportedDispatcherShift[];

  // driverDuties — כוננים.
  driverDuties:
    ImportedDriverDuty[];

  // morningDriverShifts — כונני בוקר.
  morningDriverShifts:
    ImportedMorningDriverShift[];

  // skippedRows — שורות.
  skippedRows: number;

  warnings: string[];
}

/**
 * טיפוס ScheduleImportUserType: שיבוץ / ייבוא / משתמש.
 */
export type ScheduleImportUserType =
  | 'dispatcher'
  | 'on_call'
  | 'morning_driver';

/**
 * חוזה הנתונים ScheduleImportUser: שיבוץ / ייבוא / משתמש.
 */
export interface ScheduleImportUser {
  // id — מזהה.
  id: string;

  // displayName — שם תצוגה.
  displayName: string;

  // scheduleName — שיבוץ / שם.
  scheduleName:
    string | null;

  // email — כתובת דוא״ל.
  email: string;

  role:
    ScheduleImportUserType;

  // isActive — האם הרשומה פעילה.
  isActive: boolean;
}

/**
 * חוזה הנתונים ScheduleImportNameAlias: שיבוץ / ייבוא / שם.
 */
export interface ScheduleImportNameAlias {
  // id — מזהה.
  id: string;

  // sourceName — מקור / שם.
  sourceName: string;

  // normalizedSourceName — מקור / שם.
  normalizedSourceName: string;

  // userId — מזהה משתמש.
  userId: string;

  // userType — משתמש.
  userType:
    ScheduleImportUserType;
}

/**
 * חוזה הנתונים ScheduleImportUsersData: שיבוץ / ייבוא / משתמשים / נתונים.
 */
export interface ScheduleImportUsersData {
  dispatchers:
    ScheduleImportUser[];

  onCallDrivers:
    ScheduleImportUser[];

  // morningDrivers — כונני בוקר.
  morningDrivers:
    ScheduleImportUser[];

  aliases:
    ScheduleImportNameAlias[];
}

/**
 * חוזה הנתונים SaveScheduleImportNameAliasRequest: שיבוץ / ייבוא / שם / נתוני הבקשה.
 */
export interface SaveScheduleImportNameAliasRequest {
  // sourceName — מקור / שם.
  sourceName: string;

  // userId — מזהה משתמש.
  userId: string;

  // userType — משתמש.
  userType:
    ScheduleImportUserType;
}

/**
 * חוזה הנתונים SaveScheduleImportNameAliasResponse: שיבוץ / ייבוא / שם / תוצאת הפעולה.
 */
export interface SaveScheduleImportNameAliasResponse {
  // id — מזהה.
  id: string;

  // sourceName — מקור / שם.
  sourceName: string;

  // normalizedSourceName — מקור / שם.
  normalizedSourceName: string;

  // userId — מזהה משתמש.
  userId: string;

  // userType — משתמש.
  userType:
    ScheduleImportUserType;

  // updatedAt — מועד עדכון.
  updatedAt: string;
}

/**
 * חוזה הנתונים ScheduleImportResolvedName: שיבוץ / ייבוא / שם.
 */
export interface ScheduleImportResolvedName {
  // sourceName — מקור / שם.
  sourceName: string;

  // normalizedSourceName — מקור / שם.
  normalizedSourceName: string;

  // userType — משתמש.
  userType:
    ScheduleImportUserType;

  // matchedUserId — מזהה משתמש.
  matchedUserId:
    string | null;

  // matchedUser — משתמש.
  matchedUser:
    ScheduleImportUser | null;

  // matchSource — מקור.
  matchSource:
    | 'alias'
    | 'schedule_name'
    | 'display_name'
    | 'unmatched';
}
/**
 * טיפוס ScheduleImportStrategy: שיבוץ / ייבוא / שיטת שיבוץ.
 */
export type ScheduleImportStrategy =
  | 'missing_only'
  | 'replace'
  | 'rebuild'
  | 'historical_archive';

/**
 * חוזה הנתונים ScheduleImportResolvedDispatcherShift: שיבוץ / ייבוא / מוקדנים / משמרת.
 */
export interface ScheduleImportResolvedDispatcherShift {
  // date — תאריך.
  date: string;

  // startTime — שעת התחלה.
  startTime: string;

  // endTime — שעת סיום.
  endTime: string;

  // userId — מזהה משתמש.
  userId: string;
}

/**
 * חוזה הנתונים ScheduleImportResolvedDriverDuty: שיבוץ / ייבוא / כוננים.
 */
export interface ScheduleImportResolvedDriverDuty {
  // date — תאריך.
  date: string;

  // userId — מזהה משתמש.
  userId: string;

  // note — הערה.
  note: string | null;
}

/**
 * חוזה הנתונים ScheduleImportResolvedMorningDriverShift: כונני בוקר.
 */
export interface ScheduleImportResolvedMorningDriverShift {
  // date — תאריך.
  date: string;

  // startTime — שעת התחלה.
  startTime: string;

  // endTime — שעת סיום.
  endTime: string;

  // userId — מזהה משתמש.
  userId: string;

  // assignmentSlot — הקצאה.
  assignmentSlot: number;

  // shiftType — משמרת.
  shiftType:
    ImportedMorningDriverShiftType;

  // minimumWorkers — מספר העובדים המזערי.
  minimumWorkers: number;

  // recommendedWorkers — מספר העובדים המומלץ.
  recommendedWorkers: number;
}

/**
 * חוזה הנתונים ScheduleImportPreviewPeriodState: שיבוץ / ייבוא / תקופה / מצב.
 */
export interface ScheduleImportPreviewPeriodState {
  exists: boolean;

  // id — מזהה.
  id: string | null;

  // status — סטטוס.
  status: string | null;
}

/**
 * חוזה הנתונים ScheduleImportPreviewCounts: שיבוץ / ייבוא.
 */
export interface ScheduleImportPreviewCounts {
  detected: number;

  existing: number;

  toCreate: number;

  toUpdate: number;

  toSkip: number;

  toDelete: number;
}

/**
 * חוזה הנתונים PreviewScheduleExcelImportRequest: שיבוץ / Excel / ייבוא / נתוני הבקשה.
 */
export interface PreviewScheduleExcelImportRequest {
  // year — שנה.
  year: number;

  // month — חודש.
  month: number;

  // periodType — תקופה.
  periodType:
    ScheduleImportPeriodType;

  // importStrategy — ייבוא / שיטת שיבוץ.
  importStrategy:
    ScheduleImportStrategy;

  // dispatcherShifts — מוקדנים / משמרות.
  dispatcherShifts:
    ScheduleImportResolvedDispatcherShift[];

  // driverDuties — כוננים.
  driverDuties:
    ScheduleImportResolvedDriverDuty[];

  // morningDriverShifts — כונני בוקר.
  morningDriverShifts:
    ScheduleImportResolvedMorningDriverShift[];
}

/**
 * חוזה הנתונים PreviewScheduleExcelImportResponse: שיבוץ / Excel / ייבוא / תוצאת הפעולה.
 */
export interface PreviewScheduleExcelImportResponse {
  // year — שנה.
  year: number;

  // month — חודש.
  month: number;

  // periodType — תקופה.
  periodType:
    ScheduleImportPeriodType;

  // importStrategy — ייבוא / שיטת שיבוץ.
  importStrategy:
    ScheduleImportStrategy;

  // canImport — ייבוא.
  canImport: boolean;

  blockers: string[];

  warnings: string[];

  // schedulePeriod — תקופת שיבוץ.
  schedulePeriod:
    ScheduleImportPreviewPeriodState;

  // driverSchedulePeriod — תקופת שיבוץ.
  driverSchedulePeriod:
    ScheduleImportPreviewPeriodState;

  // dispatcherShifts — מוקדנים / משמרות.
  dispatcherShifts:
    ScheduleImportPreviewCounts;

  // driverDuties — כוננים.
  driverDuties:
    ScheduleImportPreviewCounts;

  // morningDriverAvailabilityPeriod — תקופת אילוצים.
  morningDriverAvailabilityPeriod:
    ScheduleImportPreviewPeriodState;

  // morningDriverSchedulePeriod — תקופת שיבוץ.
  morningDriverSchedulePeriod:
    ScheduleImportPreviewPeriodState;

  // morningDriverShifts — כונני בוקר.
  morningDriverShifts:
    ScheduleImportPreviewCounts;
}
/**
 * חוזה הנתונים ExecuteScheduleExcelImportRequest: שיבוץ / Excel / ייבוא / נתוני הבקשה.
 */
export interface ExecuteScheduleExcelImportRequest
  extends PreviewScheduleExcelImportRequest {
  // fileName — קובץ / שם.
  fileName: string;

  // fileSizeBytes — קובץ.
  fileSizeBytes: number;

  warnings: string[];
}

/**
 * חוזה הנתונים ScheduleImportExecutionCounts: שיבוץ / ייבוא.
 */
export interface ScheduleImportExecutionCounts {
  detected: number;

  created: number;

  updated: number;

  skipped: number;

  deleted: number;
}

/**
 * טיפוס ScheduleImportExecutionStatus: שיבוץ / ייבוא / סטטוס.
 */
export type ScheduleImportExecutionStatus =
  | 'completed'
  | 'completed_with_warnings';

/**
 * חוזה הנתונים ExecuteScheduleExcelImportResponse: שיבוץ / Excel / ייבוא / תוצאת הפעולה.
 */
export interface ExecuteScheduleExcelImportResponse {
  // importRunId — ייבוא / מזהה.
  importRunId: string;

  // year — שנה.
  year: number;

  // month — חודש.
  month: number;

  // periodType — תקופה.
  periodType:
    ScheduleImportPeriodType;

  // importStrategy — ייבוא / שיטת שיבוץ.
  importStrategy:
    ScheduleImportStrategy;

  // status — סטטוס.
  status:
    ScheduleImportExecutionStatus;

  // schedulePeriodId — תקופת שיבוץ.
  schedulePeriodId: string;

  // driverSchedulePeriodId — תקופת שיבוץ.
  driverSchedulePeriodId: string;

  // morningDriverAvailabilityPeriodId — תקופת אילוצים.
  morningDriverAvailabilityPeriodId:
    string;

  // morningDriverSchedulePeriodId — תקופת שיבוץ.
  morningDriverSchedulePeriodId:
    string;

  // dispatcherShifts — מוקדנים / משמרות.
  dispatcherShifts:
    ScheduleImportExecutionCounts;

  // driverDuties — כוננים.
  driverDuties:
    ScheduleImportExecutionCounts;

  // morningDriverShifts — כונני בוקר.
  morningDriverShifts:
    ScheduleImportExecutionCounts;

  // warningCount — כמות.
  warningCount: number;

  completedAt: string;
}