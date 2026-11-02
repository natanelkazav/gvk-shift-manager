/**
 * קובץ: src/types/driverAvailability.ts
 * מטרה: הגדרת טיפוסים וחוזי נתונים עבור כוננים / אילוצים וזמינות.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: DriverAvailabilityPeriodStatus, DriverAvailabilitySubmissionStatus, DriverAvailabilityStatus, DriverAvailabilityPeriod, DriverAvailabilityDay, DriverAvailabilityEntry, DriverAvailabilitySubmission, CreateDriverAvailabilityPeriodRequest, CreateDriverAvailabilityPeriodResponse, DriverAvailabilityPeriodListItem ועוד.
 * - תיאור מבנה הקלט והפלט לבדיקת טיפוסים בזמן פיתוח.
 */
/**
 * טיפוס DriverAvailabilityPeriodStatus: תקופת אילוצים.
 */
export type DriverAvailabilityPeriodStatus =
  | 'draft'
  | 'open'
  | 'closed'
  | 'archived';

/**
 * טיפוס DriverAvailabilitySubmissionStatus: מצב ההגשה.
 */
export type DriverAvailabilitySubmissionStatus =
  | 'draft'
  | 'submitted'
  | 'reopened';

/**
 * טיפוס DriverAvailabilityStatus: מצב הזמינות.
 */
export type DriverAvailabilityStatus =
  | 'available'
  | 'unavailable';

/**
 * חוזה הנתונים DriverAvailabilityPeriod: תקופת אילוצים.
 */
export interface DriverAvailabilityPeriod {
  // id — מזהה.
  id: string;

  // year — שנה.
  year: number;
  // month — חודש.
  month: number;

  // status — סטטוס.
  status:
    DriverAvailabilityPeriodStatus;

  // title — כותרת.
  title:
    string | null;

  instructions:
    string | null;

  // submissionDeadline — מועד אחרון להגשת אילוצים.
  submissionDeadline:
    string | null;

  openedAt:
    string | null;

  closedAt:
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
 * חוזה הנתונים DriverAvailabilityDay: כוננים / אילוצים וזמינות / יום.
 */
export interface DriverAvailabilityDay {
  // id — מזהה.
  id: string;

  // periodId — מזהה התקופה.
  periodId: string;

  // availabilityDate — אילוצים וזמינות / תאריך.
  availabilityDate: string;

  weekdayNumber: number;

  // weekdayName — שם.
  weekdayName: string;

  // sortOrder — סדר המיון.
  sortOrder: number;

  // createdAt — מועד יצירה.
  createdAt: string;

  // holidayName — חג / שם (אופציונלי).
  holidayName?: string | null;
  // holidayScheduleType — סוג יום השיבוץ (אופציונלי).
  holidayScheduleType?: string | null;
}

/**
 * חוזה הנתונים DriverAvailabilityEntry: כוננים / אילוצים וזמינות / רשומה.
 */
export interface DriverAvailabilityEntry {
  // id — מזהה.
  id: string;

  // periodId — מזהה התקופה.
  periodId: string;

  // dayId — מזהה היום.
  dayId: string;

  // userId — מזהה משתמש.
  userId: string;

  // availabilityStatus — מצב הזמינות.
  availabilityStatus:
    DriverAvailabilityStatus;

  // note — הערה.
  note:
    string | null;

  // createdAt — מועד יצירה.
  createdAt: string;

  // updatedAt — מועד עדכון.
  updatedAt: string;
}

/**
 * חוזה הנתונים DriverAvailabilitySubmission: כוננים / אילוצים וזמינות.
 */
export interface DriverAvailabilitySubmission {
  // id — מזהה.
  id: string;

  // periodId — מזהה התקופה.
  periodId: string;

  // userId — מזהה משתמש.
  userId: string;

  // status — סטטוס.
  status:
    DriverAvailabilitySubmissionStatus;

  // submittedAt — הוגש.
  submittedAt:
    string | null;

  reopenedAt:
    string | null;

  lastSavedAt:
    string | null;

  // availableCount — מספר הסימונים כזמין.
  availableCount: number;

  // unavailableCount — מספר הסימונים כלא זמין.
  unavailableCount: number;

  // createdAt — מועד יצירה.
  createdAt: string;

  // updatedAt — מועד עדכון.
  updatedAt: string;
}

/**
 * חוזה הנתונים CreateDriverAvailabilityPeriodRequest: תקופת אילוצים.
 */
export interface CreateDriverAvailabilityPeriodRequest {
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
 * חוזה הנתונים CreateDriverAvailabilityPeriodResponse: תקופת אילוצים.
 */
export interface CreateDriverAvailabilityPeriodResponse {
  // periodId — מזהה התקופה.
  periodId: string;

  // year — שנה.
  year: number;

  // month — חודש.
  month: number;

  // status — סטטוס.
  status:
    DriverAvailabilityPeriodStatus;

  // title — כותרת.
  title:
    string | null;

  // submissionDeadline — מועד אחרון להגשת אילוצים.
  submissionDeadline:
    string | null;

  // createdDays — ימים.
  createdDays: number;

  // createdAt — מועד יצירה.
  createdAt: string;
}

/**
 * חוזה הנתונים DriverAvailabilityPeriodListItem: תקופת אילוצים.
 */
export interface DriverAvailabilityPeriodListItem
  extends DriverAvailabilityPeriod {
  // daysCount — ימים / כמות.
  daysCount: number;

  // submissionsCount — כמות.
  submissionsCount: number;

  // submittedCount — הוגש / כמות.
  submittedCount: number;
}

/**
 * חוזה הנתונים DriverAvailabilityPersonalData: כוננים / אילוצים וזמינות / נתונים.
 */
export interface DriverAvailabilityPersonalData {
  // period — תקופה.
  period:
    DriverAvailabilityPeriod | null;

  // days — ימים.
  days:
    DriverAvailabilityDay[];

  // entries — רשומות.
  entries:
    DriverAvailabilityEntry[];

  submission:
    DriverAvailabilitySubmission | null;
}

/**
 * חוזה הנתונים SaveDriverAvailabilityEntryInput: כוננים / אילוצים וזמינות / רשומה / קלט.
 */
export interface SaveDriverAvailabilityEntryInput {
  // dayId — מזהה היום.
  dayId: string;

  // availabilityStatus — מצב הזמינות.
  availabilityStatus:
    DriverAvailabilityStatus;

  // note — הערה.
  note:
    string | null;
}

/**
 * חוזה הנתונים SaveDriverAvailabilityRequest: כוננים / אילוצים וזמינות / נתוני הבקשה.
 */
export interface SaveDriverAvailabilityRequest {
  // periodId — מזהה התקופה.
  periodId: string;

  // entries — רשומות.
  entries:
    SaveDriverAvailabilityEntryInput[];
}

/**
 * חוזה הנתונים SaveDriverAvailabilityResponse: כוננים / אילוצים וזמינות / תוצאת הפעולה.
 */
export interface SaveDriverAvailabilityResponse {
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
 * חוזה הנתונים SubmitDriverAvailabilityResponse: כוננים / אילוצים וזמינות / תוצאת הפעולה.
 */
export interface SubmitDriverAvailabilityResponse {
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
 * חוזה הנתונים OpenDriverAvailabilityPeriodResponse: תקופת אילוצים.
 */
export interface OpenDriverAvailabilityPeriodResponse {
  // periodId — מזהה התקופה.
  periodId: string;

  // year — שנה.
  year: number;

  // month — חודש.
  month: number;

  // status — סטטוס.
  status: 'open';

  openedAt: string;

  // daysCount — ימים / כמות.
  daysCount: number;

  alreadyOpen: boolean;
}
/**
 * חוזה הנתונים DriverAvailabilityManagerDriver: כוננים / אילוצים וזמינות.
 */
export interface DriverAvailabilityManagerDriver {
  // id — מזהה.
  id: string;

  // displayName — שם תצוגה.
  displayName: string;

  // scheduleName — שיבוץ / שם.
  scheduleName:
    string | null;

  // email — כתובת דוא״ל.
  email: string;

  role: string;

  // isActive — האם הרשומה פעילה.
  isActive: boolean;
}

/**
 * חוזה הנתונים DriverAvailabilityManagementStatistics: כוננים / אילוצים וזמינות / סטטיסטיקה.
 */
export interface DriverAvailabilityManagementStatistics {
  // totalDrivers — סך הכול.
  totalDrivers: number;

  // submittedDrivers — הוגש.
  submittedDrivers: number;

  // draftDrivers — טיוטה.
  draftDrivers: number;

  notStartedDrivers: number;
}

/**
 * חוזה הנתונים DriverAvailabilityManagementData: כוננים / אילוצים וזמינות / נתונים.
 */
export interface DriverAvailabilityManagementData {
  // period — תקופה.
  period:
    DriverAvailabilityPeriod;

  // days — ימים.
  days:
    DriverAvailabilityDay[];

  drivers:
    DriverAvailabilityManagerDriver[];

  submissions:
    DriverAvailabilitySubmission[];

  // entries — רשומות.
  entries:
    DriverAvailabilityEntry[];

  // statistics — סטטיסטיקה.
  statistics:
    DriverAvailabilityManagementStatistics;
}
/**
 * חוזה הנתונים CloseDriverAvailabilityPeriodResponse: תקופת אילוצים.
 */
export interface CloseDriverAvailabilityPeriodResponse {
  // periodId — מזהה התקופה.
  periodId: string;

  // year — שנה.
  year: number;

  // month — חודש.
  month: number;

  // status — סטטוס.
  status: 'closed';

  closedAt: string;

  // totalDrivers — סך הכול.
  totalDrivers: number;

  // submittedDrivers — הוגש.
  submittedDrivers: number;

  missingDrivers: number;

  forced: boolean;

  alreadyClosed: boolean;
}
