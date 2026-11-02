/**
 * קובץ: src/types/morningDriverAvailability.ts
 * מטרה: הגדרת טיפוסים וחוזי נתונים עבור כונני בוקר.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: MorningDriverAvailabilityPeriodStatus, MorningDriverShiftType, MorningDriverAvailabilityPeriodListItem, CreateMorningDriverAvailabilityPeriodRequest, CreateMorningDriverAvailabilityPeriodResponse, OpenMorningDriverAvailabilityPeriodResponse, ReopenMorningDriverAvailabilityPeriodResponse, DeleteMorningDriverAvailabilityPeriodResponse, MorningDriverAvailabilitySubmissionStatus, MorningDriverAvailabilityStatus ועוד.
 * - תיאור מבנה הקלט והפלט לבדיקת טיפוסים בזמן פיתוח.
 */
/**
 * טיפוס MorningDriverAvailabilityPeriodStatus: תקופת אילוצים.
 */
export type MorningDriverAvailabilityPeriodStatus =
  | 'draft'
  | 'open'
  | 'closed'
  | 'archived';

/**
 * טיפוס MorningDriverShiftType: כונני בוקר.
 */
export type MorningDriverShiftType =
  | 'weekday_morning'
  | 'weekday_evening'
  | 'friday_morning';

/**
 * חוזה הנתונים MorningDriverAvailabilityPeriodListItem: תקופת אילוצים.
 */
export interface MorningDriverAvailabilityPeriodListItem {
  // id — מזהה.
  id: string;

  // year — שנה.
  year: number;

  // month — חודש.
  month: number;

  // status — סטטוס.
  status:
    MorningDriverAvailabilityPeriodStatus;

  // title — כותרת.
  title:
    string | null;

  instructions:
    string | null;

  // submissionDeadline — מועד אחרון להגשת אילוצים.
  submissionDeadline:
    string;

  openedAt:
    string | null;

  closedAt:
    string | null;

  // createdAt — מועד יצירה.
  createdAt:
    string;

  // shiftsCount — משמרות / כמות.
  shiftsCount:
    number;

  // submissionsCount — כמות.
  submissionsCount:
    number;

  // submittedCount — הוגש / כמות.
  submittedCount:
    number;
}

/**
 * חוזה הנתונים CreateMorningDriverAvailabilityPeriodRequest: תקופת אילוצים.
 */
export interface CreateMorningDriverAvailabilityPeriodRequest {
  // year — שנה.
  year: number;

  // month — חודש.
  month: number;

  // title — כותרת.
  title:
    string | null;

  instructions:
    string | null;

  // submissionDeadline — מועד אחרון להגשת אילוצים.
  submissionDeadline:
    string | null;
}

/**
 * חוזה הנתונים CreateMorningDriverAvailabilityPeriodResponse: תקופת אילוצים.
 */
export interface CreateMorningDriverAvailabilityPeriodResponse {
  // periodId — מזהה התקופה.
  periodId: string;

  // year — שנה.
  year: number;

  // month — חודש.
  month: number;

  // status — סטטוס.
  status: 'draft';

  // title — כותרת.
  title:
    string | null;

  instructions:
    string | null;

  // submissionDeadline — מועד אחרון להגשת אילוצים.
  submissionDeadline:
    string;

  // createdShifts — משמרות.
  createdShifts:
    number;
}

/**
 * חוזה הנתונים OpenMorningDriverAvailabilityPeriodResponse: תקופת אילוצים.
 */
export interface OpenMorningDriverAvailabilityPeriodResponse {
  // periodId — מזהה התקופה.
  periodId: string;

  // year — שנה.
  year: number;

  // month — חודש.
  month: number;

  // status — סטטוס.
  status: 'open';

  openedAt: string;

  createdSubmissions:
    number;
}

/**
 * חוזה הנתונים ReopenMorningDriverAvailabilityPeriodResponse: תקופת אילוצים.
 */
export interface ReopenMorningDriverAvailabilityPeriodResponse {
  // periodId — מזהה התקופה.
  periodId: string;
  // year — שנה.
  year: number;
  // month — חודש.
  month: number;
  // status — סטטוס.
  status: 'open';
  openedAt: string;
}

/**
 * חוזה הנתונים DeleteMorningDriverAvailabilityPeriodResponse: תקופת אילוצים.
 */
export interface DeleteMorningDriverAvailabilityPeriodResponse {
  // deletedPeriodId — מזהה התקופה.
  deletedPeriodId: string;

  // year — שנה.
  year: number;

  // month — חודש.
  month: number;

  // deletedShifts — משמרות.
  deletedShifts:
    number;

  deletedSubmissions:
    number;

  // deletedEntries — רשומות.
  deletedEntries:
    number;
}

/**
 * טיפוס MorningDriverAvailabilitySubmissionStatus: מצב ההגשה.
 */
export type MorningDriverAvailabilitySubmissionStatus =
  | 'draft'
  | 'submitted'
  | 'reopened';

/**
 * טיפוס MorningDriverAvailabilityStatus: מצב הזמינות.
 */
export type MorningDriverAvailabilityStatus =
  | 'available'
  | 'unavailable';

/**
 * חוזה הנתונים MorningDriverAvailabilityPersonalPeriod: כונני בוקר.
 */
export interface MorningDriverAvailabilityPersonalPeriod {
  // id — מזהה.
  id: string;
  // year — שנה.
  year: number;
  // month — חודש.
  month: number;
  // status — סטטוס.
  status: MorningDriverAvailabilityPeriodStatus;
  // title — כותרת.
  title: string | null;
  instructions: string | null;
  // submissionDeadline — מועד אחרון להגשת אילוצים.
  submissionDeadline: string;
  openedAt: string | null;
  closedAt: string | null;
  // createdAt — מועד יצירה.
  createdAt: string;
}

/**
 * חוזה הנתונים MorningDriverAvailabilitySubmission: כונני בוקר.
 */
export interface MorningDriverAvailabilitySubmission {
  // id — מזהה.
  id: string;
  // periodId — מזהה התקופה.
  periodId: string;
  // userId — מזהה משתמש.
  userId: string;
  // status — סטטוס.
  status: MorningDriverAvailabilitySubmissionStatus;
  // submittedAt — הוגש.
  submittedAt: string | null;
  lastSavedAt: string | null;
  // createdAt — מועד יצירה.
  createdAt: string;
  // updatedAt — מועד עדכון.
  updatedAt: string;
}

/**
 * חוזה הנתונים MorningDriverAvailabilityShift: כונני בוקר.
 */
export interface MorningDriverAvailabilityShift {
  // id — מזהה.
  id: string;
  // periodId — מזהה התקופה.
  periodId: string;
  // shiftDate — תאריך המשמרת.
  shiftDate: string;
  weekdayNumber: number;
  // weekdayName — שם.
  weekdayName: string;
  // shiftType — משמרת.
  shiftType: MorningDriverShiftType;
  // startTime — שעת התחלה.
  startTime: string;
  // endTime — שעת סיום.
  endTime: string;
  // minimumWorkers — מספר העובדים המזערי.
  minimumWorkers: number;
  // recommendedWorkers — מספר העובדים המומלץ.
  recommendedWorkers: number;
  // sortOrder — סדר המיון.
  sortOrder: number;
  // availabilityStatus — מצב הזמינות.
  availabilityStatus: MorningDriverAvailabilityStatus | null;
  // note — הערה.
  note: string | null;
  // holidayName — חג / שם (אופציונלי).
  holidayName?: string | null;
  // holidayScheduleType — סוג יום השיבוץ (אופציונלי).
  holidayScheduleType?: string | null;
}

/**
 * חוזה הנתונים MorningDriverAvailabilityPersonalData: כונני בוקר.
 */
export interface MorningDriverAvailabilityPersonalData {
  // period — תקופה.
  period: MorningDriverAvailabilityPersonalPeriod;
  submission: MorningDriverAvailabilitySubmission;
  // shifts — משמרות.
  shifts: MorningDriverAvailabilityShift[];
}

/**
 * חוזה הנתונים SaveMorningDriverAvailabilityEntryInput: כונני בוקר.
 */
export interface SaveMorningDriverAvailabilityEntryInput {
  // shiftId — מזהה המשמרת.
  shiftId: string;
  // availabilityStatus — מצב הזמינות.
  availabilityStatus: MorningDriverAvailabilityStatus;
  // note — הערה.
  note: string | null;
}

/**
 * חוזה הנתונים SaveMorningDriverAvailabilityRequest: כונני בוקר.
 */
export interface SaveMorningDriverAvailabilityRequest {
  // periodId — מזהה התקופה.
  periodId: string;
  // entries — רשומות.
  entries: SaveMorningDriverAvailabilityEntryInput[];
}

/**
 * חוזה הנתונים SaveMorningDriverAvailabilityResponse: כונני בוקר.
 */
export interface SaveMorningDriverAvailabilityResponse {
  // periodId — מזהה התקופה.
  periodId: string;
  // userId — מזהה משתמש.
  userId: string;
  // availableCount — מספר הסימונים כזמין.
  availableCount: number;
  // unavailableCount — מספר הסימונים כלא זמין.
  unavailableCount: number;
  // unmarkedCount — מספר הפריטים שטרם סומנו.
  unmarkedCount: number;
  // savedEntries — רשומות.
  savedEntries: number;
  savedAt: string;
}

/**
 * חוזה הנתונים SubmitMorningDriverAvailabilityResponse: כונני בוקר.
 */
export interface SubmitMorningDriverAvailabilityResponse {
  // periodId — מזהה התקופה.
  periodId: string;
  // userId — מזהה משתמש.
  userId: string;
  // status — סטטוס.
  status: 'submitted';
  // availableCount — מספר הסימונים כזמין.
  availableCount: number;
  // unavailableCount — מספר הסימונים כלא זמין.
  unavailableCount: number;
  // submittedAt — הוגש.
  submittedAt: string;
  // alreadySubmitted — הוגש.
  alreadySubmitted: boolean;
}

/**
 * חוזה הנתונים MorningDriverAvailabilityManagerDriver: כונני בוקר.
 */
export interface MorningDriverAvailabilityManagerDriver {
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
 * חוזה הנתונים MorningDriverAvailabilityManagementSubmission: כונני בוקר.
 */
export interface MorningDriverAvailabilityManagementSubmission
  extends MorningDriverAvailabilitySubmission {
  // availableCount — מספר הסימונים כזמין.
  availableCount: number;
  // unavailableCount — מספר הסימונים כלא זמין.
  unavailableCount: number;
  // unmarkedCount — מספר הפריטים שטרם סומנו.
  unmarkedCount: number;
}

/**
 * חוזה הנתונים MorningDriverAvailabilityManagementEntry: כונני בוקר.
 */
export interface MorningDriverAvailabilityManagementEntry {
  // id — מזהה.
  id: string;
  // periodId — מזהה התקופה.
  periodId: string;
  // shiftId — מזהה המשמרת.
  shiftId: string;
  // userId — מזהה משתמש.
  userId: string;
  // availabilityStatus — מצב הזמינות.
  availabilityStatus:
    MorningDriverAvailabilityStatus;
  // note — הערה.
  note:
    string | null;
  // createdAt — מועד יצירה.
  createdAt: string;
  // updatedAt — מועד עדכון.
  updatedAt: string;
}

/**
 * חוזה הנתונים MorningDriverAvailabilityManagementStatistics: כונני בוקר.
 */
export interface MorningDriverAvailabilityManagementStatistics {
  // totalDrivers — סך הכול.
  totalDrivers: number;
  // submittedDrivers — הוגש.
  submittedDrivers: number;
  // draftDrivers — טיוטה.
  draftDrivers: number;
  reopenedDrivers: number;
  notStartedDrivers: number;
}

/**
 * חוזה הנתונים MorningDriverAvailabilityManagementData: כונני בוקר.
 */
export interface MorningDriverAvailabilityManagementData {
  // period — תקופה.
  period:
    MorningDriverAvailabilityPersonalPeriod;
  drivers:
    MorningDriverAvailabilityManagerDriver[];
  submissions:
    MorningDriverAvailabilityManagementSubmission[];
  // shifts — משמרות.
  shifts:
    MorningDriverAvailabilityShift[];
  // entries — רשומות.
  entries:
    MorningDriverAvailabilityManagementEntry[];
  // statistics — סטטיסטיקה.
  statistics:
    MorningDriverAvailabilityManagementStatistics;
}

/**
 * חוזה הנתונים ReopenMorningDriverAvailabilitySubmissionResponse: כונני בוקר.
 */
export interface ReopenMorningDriverAvailabilitySubmissionResponse {
  // periodId — מזהה התקופה.
  periodId: string;
  // userId — מזהה משתמש.
  userId: string;
  // submissionId — מזהה.
  submissionId: string;
  // status — סטטוס.
  status: 'reopened';
  reopenedAt: string;
}

/**
 * חוזה הנתונים CloseMorningDriverAvailabilityPeriodResponse: תקופת אילוצים.
 */
export interface CloseMorningDriverAvailabilityPeriodResponse {
  // periodId — מזהה התקופה.
  periodId: string;
  // year — שנה.
  year: number;
  // month — חודש.
  month: number;
  // status — סטטוס.
  status: 'closed';
  closedAt:
    string | null;
  // totalDrivers — סך הכול.
  totalDrivers: number;
  // submittedDrivers — הוגש.
  submittedDrivers: number;
  missingDrivers: number;
  forced: boolean;
  alreadyClosed: boolean;
}
