/**
 * קובץ: src/types/availability.ts
 * מטרה: הגדרת טיפוסים וחוזי נתונים עבור אילוצים וזמינות.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: AvailabilityPeriodStatus, AvailabilityPeriod, CreateAvailabilityPeriodInput, CreateAvailabilityPeriodResult, SpecialDayScheduleType, ImportedSpecialDay, ImportSpecialDaysResult, RebuildAvailabilityPeriodResult, OpenAvailabilityPeriodResult, CloseAvailabilityPeriodResult ועוד.
 * - תיאור מבנה הקלט והפלט לבדיקת טיפוסים בזמן פיתוח.
 */
/**
 * טיפוס AvailabilityPeriodStatus: תקופת אילוצים.
 */
export type AvailabilityPeriodStatus =
  | 'draft'
  | 'open'
  | 'closed'
  | 'archived';

/**
 * חוזה הנתונים AvailabilityPeriod: תקופת אילוצים.
 */
export interface AvailabilityPeriod {
  // id — מזהה.
  id: string;
  // year — שנה.
  year: number;
  // month — חודש.
  month: number;
  // status — סטטוס.
  status: AvailabilityPeriodStatus;
  // title — כותרת.
  title: string | null;
  instructions: string | null;
  // submissionDeadline — מועד אחרון להגשת אילוצים.
  submissionDeadline: string | null;
  openedAt: string | null;
  closedAt: string | null;
  createdBy: string | null;
  updatedBy: string | null;
  // createdAt — מועד יצירה.
  createdAt: string;
  // updatedAt — מועד עדכון.
  updatedAt: string;
}

/**
 * חוזה הנתונים CreateAvailabilityPeriodInput: תקופת אילוצים.
 */
export interface CreateAvailabilityPeriodInput {
  // year — שנה.
  year: number;
  // month — חודש.
  month: number;
  // submissionDeadline — מועד אחרון להגשת אילוצים.
  submissionDeadline: string | null;
  // title — כותרת.
  title: string | null;
  instructions: string | null;
}

/**
 * חוזה הנתונים CreateAvailabilityPeriodResult: תקופת אילוצים.
 */
export interface CreateAvailabilityPeriodResult {
  // periodId — מזהה התקופה.
  periodId: string;
  createdSlots: number;
  // periodStatus — תקופה / סטטוס.
  periodStatus: AvailabilityPeriodStatus;
}
/**
 * טיפוס SpecialDayScheduleType: סוג יום השיבוץ.
 */
export type SpecialDayScheduleType =
  | 'holiday_eve'
  | 'holiday_full'
  | 'holiday_end'
  | 'chol_hamoed';

/**
 * חוזה הנתונים ImportedSpecialDay: יום.
 */
export interface ImportedSpecialDay {
  // date — תאריך.
  date: string;
  // name — שם.
  name: string;
  // scheduleType — סוג יום השיבוץ.
  scheduleType:
    SpecialDayScheduleType;
  // holidayGroup — חג / קבוצה.
  holidayGroup: string | null;
}

/**
 * חוזה הנתונים ImportSpecialDaysResult: ייבוא / ימים / תוצאה.
 */
export interface ImportSpecialDaysResult {
  success: boolean;
  // year — שנה.
  year: number;
  fetchedEvents: number;
  importedEvents: number;
  skippedEvents: number;
  // importedDays — ימים.
  importedDays:
    ImportedSpecialDay[];
}
/**
 * חוזה הנתונים RebuildAvailabilityPeriodResult: תקופת אילוצים.
 */
export interface RebuildAvailabilityPeriodResult {
  // periodId — מזהה התקופה.
  periodId: string;
  createdSlots: number;
}
/**
 * חוזה הנתונים OpenAvailabilityPeriodResult: תקופת אילוצים.
 */
export interface OpenAvailabilityPeriodResult {
  // periodId — מזהה התקופה.
  periodId: string;
  // periodStatus — תקופה / סטטוס.
  periodStatus: 'open';
  openedAt: string;
  // shiftSlotsCount — משמרת / כמות.
  shiftSlotsCount: number;
}
/**
 * חוזה הנתונים CloseAvailabilityPeriodResult: תקופת אילוצים.
 */
export interface CloseAvailabilityPeriodResult {
  // periodId — מזהה התקופה.
  periodId: string;
  // periodStatus — תקופה / סטטוס.
  periodStatus: 'closed';
  closedAt: string;
  // totalDispatchers — סך הכול.
  totalDispatchers: number;
  // submittedDispatchers — הוגש.
  submittedDispatchers: number;
}
/**
 * חוזה הנתונים ReopenAvailabilityPeriodResult: תקופת אילוצים.
 */
export interface ReopenAvailabilityPeriodResult {
  // periodId — מזהה התקופה.
  periodId: string;
  // periodStatus — תקופה / סטטוס.
  periodStatus: 'open';
  openedAt: string;
}

/**
 * חוזה הנתונים DeleteAvailabilityPeriodResult: תקופת אילוצים.
 */
export interface DeleteAvailabilityPeriodResult {
  // deletedPeriodId — מזהה התקופה.
  deletedPeriodId: string;
  // deletedPeriodTitle — תקופה / כותרת.
  deletedPeriodTitle: string | null;
  // deletedPeriodYear — תקופה / שנה.
  deletedPeriodYear: number;
  // deletedPeriodMonth — תקופה / חודש.
  deletedPeriodMonth: number;
  // deletedShiftSlots — משמרת.
  deletedShiftSlots: number;
  // deletedAvailabilityRows — אילוצים וזמינות / שורות.
  deletedAvailabilityRows: number;
  deletedSubmissions: number;
}
