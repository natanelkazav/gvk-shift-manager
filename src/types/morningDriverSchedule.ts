/**
 * קובץ: src/types/morningDriverSchedule.ts
 * מטרה: הגדרת טיפוסים וחוזי נתונים עבור כונני בוקר.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: MorningDriverSchedulePeriodStatus, MorningDriverScheduleAssignmentSource, MorningDriverSchedulePeriod, MorningDriverScheduleDriver, MorningDriverScheduleAssignment, MorningDriverScheduleStatistics, MorningDriverScheduleData, CreateMorningDriverScheduleDraftResponse, UpdateMorningDriverScheduleAssignmentRequest, UpdateMorningDriverShiftTimeRequest ועוד.
 * - תיאור מבנה הקלט והפלט לבדיקת טיפוסים בזמן פיתוח.
 */
/**
 * טיפוס MorningDriverSchedulePeriodStatus: תקופת שיבוץ.
 */
export type MorningDriverSchedulePeriodStatus =
  | 'draft'
  | 'published'
  | 'archived';

/**
 * טיפוס MorningDriverScheduleAssignmentSource: מקור השיבוץ.
 */
export type MorningDriverScheduleAssignmentSource =
  | 'automatic'
  | 'manual'
  | 'swap'
  | 'import';

/**
 * חוזה הנתונים MorningDriverSchedulePeriod: תקופת שיבוץ.
 */
export interface MorningDriverSchedulePeriod {
  // id — מזהה.
  id: string;
  // year — שנה.
  year: number;
  // month — חודש.
  month: number;
  // status — סטטוס.
  status: MorningDriverSchedulePeriodStatus;
  // availabilityPeriodId — תקופת אילוצים.
  availabilityPeriodId: string;
  // title — כותרת.
  title: string | null;
  // publishedAt — פורסם.
  publishedAt: string | null;
  // createdAt — מועד יצירה.
  createdAt: string;
  // updatedAt — מועד עדכון.
  updatedAt: string;
}

/**
 * חוזה הנתונים MorningDriverScheduleDriver: כונני בוקר.
 */
export interface MorningDriverScheduleDriver {
  // id — מזהה.
  id: string;
  // displayName — שם תצוגה.
  displayName: string;
  // scheduleName — שיבוץ / שם.
  scheduleName: string | null;
  // email — כתובת דוא״ל.
  email: string;
  // isActive — האם הרשומה פעילה.
  isActive: boolean;
}

/**
 * חוזה הנתונים MorningDriverScheduleAssignment: כונני בוקר.
 */
export interface MorningDriverScheduleAssignment {
  // id — מזהה.
  id: string;
  // schedulePeriodId — תקופת שיבוץ.
  schedulePeriodId: string;
  // availabilityShiftId — מזהה המשמרת.
  availabilityShiftId: string;
  // shiftDate — תאריך המשמרת.
  shiftDate: string;
  weekdayNumber: number;
  // weekdayName — שם.
  weekdayName: string;
  // shiftType — משמרת.
  shiftType:
    | 'weekday_morning'
    | 'weekday_evening'
    | 'friday_morning';
  // startTime — שעת התחלה.
  startTime: string;
  // endTime — שעת סיום.
  endTime: string;
  // minimumWorkers — מספר העובדים המזערי.
  minimumWorkers: number;
  // recommendedWorkers — מספר העובדים המומלץ.
  recommendedWorkers: number;
  // assignmentSlot — הקצאה.
  assignmentSlot: number;
  // assignedUserId — מזהה העובד המשובץ.
  assignedUserId: string | null;
  // assignedUserName — משתמש / שם.
  assignedUserName: string | null;
  // assignmentSource — מקור השיבוץ.
  assignmentSource:
    MorningDriverScheduleAssignmentSource | null;
  // isLocked — האם הרשומה נעולה.
  isLocked: boolean;
  isIntentionallyUnassigned: boolean;
  // notes — הערות.
  notes: string | null;
  // updatedAt — מועד עדכון.
  updatedAt: string;
}

/**
 * חוזה הנתונים MorningDriverScheduleStatistics: כונני בוקר.
 */
export interface MorningDriverScheduleStatistics {
  // totalAssignments — סך הכול / הקצאות.
  totalAssignments: number;
  // assignedAssignments — הקצאות.
  assignedAssignments: number;
  // unassignedAssignments — הקצאות.
  unassignedAssignments: number;
  minimumUnfilled: number;
  recommendationUnfilled: number;
  intentionallyUnassignedMinimum: number;
}

/**
 * חוזה הנתונים MorningDriverScheduleData: כונני בוקר.
 */
export interface MorningDriverScheduleData {
  // period — תקופה.
  period: MorningDriverSchedulePeriod;
  drivers: MorningDriverScheduleDriver[];
  // assignments — הקצאות.
  assignments: MorningDriverScheduleAssignment[];
  // statistics — סטטיסטיקה.
  statistics: MorningDriverScheduleStatistics;
}

/**
 * חוזה הנתונים CreateMorningDriverScheduleDraftResponse: כונני בוקר.
 */
export interface CreateMorningDriverScheduleDraftResponse {
  // schedulePeriodId — תקופת שיבוץ.
  schedulePeriodId: string;
  // year — שנה.
  year: number;
  // month — חודש.
  month: number;
  // status — סטטוס.
  status: 'draft';
  // createdAssignments — הקצאות.
  createdAssignments: number;
  // assignedAssignments — הקצאות.
  assignedAssignments: number;
  // warningCount — כמות.
  warningCount: number;
}

/**
 * חוזה הנתונים UpdateMorningDriverScheduleAssignmentRequest: כונני בוקר.
 */
export interface UpdateMorningDriverScheduleAssignmentRequest {
  // assignmentId — הקצאה / מזהה.
  assignmentId: string;
  // assignedUserId — מזהה העובד המשובץ.
  assignedUserId: string | null;
  // isLocked — האם הרשומה נעולה.
  isLocked: boolean;
  // note — הערה.
  note: string | null;
}

/**
 * חוזה הנתונים UpdateMorningDriverShiftTimeRequest: כונני בוקר.
 */
export interface UpdateMorningDriverShiftTimeRequest {
  // assignmentId — הקצאה / מזהה.
  assignmentId: string;
  // startTime — שעת התחלה.
  startTime: string;
  // endTime — שעת סיום.
  endTime: string;
}

/**
 * חוזה הנתונים SetMorningDriverIntentionallyUnassignedRequest: כונני בוקר.
 */
export interface SetMorningDriverIntentionallyUnassignedRequest {
  // assignmentId — הקצאה / מזהה.
  assignmentId: string;
  isIntentionallyUnassigned: boolean;
}

/**
 * חוזה הנתונים UpdateMorningDriverScheduleAssignmentResponse: כונני בוקר.
 */
export interface UpdateMorningDriverScheduleAssignmentResponse {
  // assignmentId — הקצאה / מזהה.
  assignmentId: string;
  // schedulePeriodId — תקופת שיבוץ.
  schedulePeriodId: string;
  // assignedUserId — מזהה העובד המשובץ.
  assignedUserId: string | null;
  // assignedUserName — משתמש / שם.
  assignedUserName: string | null;
  // assignmentSource — מקור השיבוץ.
  assignmentSource:
    MorningDriverScheduleAssignmentSource | null;
  // isLocked — האם הרשומה נעולה.
  isLocked: boolean;
  isIntentionallyUnassigned: boolean;
  // notes — הערות.
  notes: string | null;
  hasWarnings: boolean;
  warnings: string[];
}

/**
 * חוזה הנתונים PublishMorningDriverScheduleResponse: כונני בוקר.
 */
export interface PublishMorningDriverScheduleResponse {
  // schedulePeriodId — תקופת שיבוץ.
  schedulePeriodId: string;
  // status — סטטוס.
  status: 'published';
  // publishedAt — פורסם.
  publishedAt: string | null;
  recommendationWarnings: number;
  // alreadyPublished — פורסם.
  alreadyPublished: boolean;
}

/**
 * חוזה הנתונים TransferMyMorningDriverAssignmentRequest: כונני בוקר.
 */
export interface TransferMyMorningDriverAssignmentRequest {
  // assignmentId — הקצאה / מזהה.
  assignmentId: string;

  // newDriverId — כוננים / מזהה.
  newDriverId: string;
}

/**
 * חוזה הנתונים TransferMyMorningDriverAssignmentResponse: כונני בוקר.
 */
export interface TransferMyMorningDriverAssignmentResponse {
  // assignmentId — הקצאה / מזהה.
  assignmentId: string;

  // schedulePeriodId — תקופת שיבוץ.
  schedulePeriodId: string;

  // shiftDate — תאריך המשמרת.
  shiftDate: string;

  // startTime — שעת התחלה.
  startTime: string;

  // endTime — שעת סיום.
  endTime: string;

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