/**
 * קובץ: src/types/dispatcherAvailability.ts
 * מטרה: הגדרת טיפוסים וחוזי נתונים עבור מוקדנים / אילוצים וזמינות.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: DispatcherAvailabilityStatus, AvailabilitySubmissionStatus, DispatcherAvailabilityPeriod, DispatcherAvailabilitySubmission, DispatcherAvailabilityShift, MyOpenAvailability, DispatcherAvailabilityState, SaveShiftAvailabilityInput, SaveShiftAvailabilityResult, SubmitAvailabilityResult.
 * - תיאור מבנה הקלט והפלט לבדיקת טיפוסים בזמן פיתוח.
 */
/**
 * טיפוס DispatcherAvailabilityStatus: מצב הזמינות.
 */
export type DispatcherAvailabilityStatus =
  | 'available'
  | 'unavailable';

/**
 * טיפוס AvailabilitySubmissionStatus: מצב ההגשה.
 */
export type AvailabilitySubmissionStatus =
  | 'draft'
  | 'submitted'
  | 'reopened';

/**
 * חוזה הנתונים DispatcherAvailabilityPeriod: תקופת אילוצים.
 */
export interface DispatcherAvailabilityPeriod {
  // id — מזהה.
  id: string;
  // year — שנה.
  year: number;
  // month — חודש.
  month: number;
  // title — כותרת.
  title: string | null;
  instructions: string | null;
  // submissionDeadline — מועד אחרון להגשת אילוצים.
  submissionDeadline: string | null;
  // status — סטטוס.
  status: 'open';
}

/**
 * חוזה הנתונים DispatcherAvailabilitySubmission: מוקדנים / אילוצים וזמינות.
 */
export interface DispatcherAvailabilitySubmission {
  // status — סטטוס.
  status: AvailabilitySubmissionStatus;
  // submittedAt — הוגש.
  submittedAt: string | null;
  lastSavedAt: string | null;
  // availableCount — מספר הסימונים כזמין.
  availableCount: number;
  // unavailableCount — מספר הסימונים כלא זמין.
  unavailableCount: number;
}

/**
 * חוזה הנתונים DispatcherAvailabilityShift: מוקדנים / אילוצים וזמינות / משמרת.
 */
export interface DispatcherAvailabilityShift {
  // id — מזהה.
  id: string;
  // date — תאריך.
  date: string;
  weekdayNumber: number;
  // weekdayName — שם.
  weekdayName: string;
  // startTime — שעת התחלה.
  startTime: string;
  // endTime — שעת סיום.
  endTime: string;
  // endsNextDay — יום.
  endsNextDay: boolean;
  // scheduleType — סוג יום השיבוץ.
  scheduleType: string;
  // holidayName — חג / שם.
  holidayName: string | null;
  // isPremium — תעריף מוגדל.
  isPremium: boolean;
  // sortOrder — סדר המיון.
  sortOrder: number;

  // availabilityStatus — מצב הזמינות.
  availabilityStatus:
    DispatcherAvailabilityStatus | null;

  // note — הערה.
  note: string | null;

  // availabilityUpdatedAt — מועד עדכון.
  availabilityUpdatedAt:
    string | null;
}

/**
 * חוזה הנתונים MyOpenAvailability: אילוצים וזמינות.
 */
export interface MyOpenAvailability {
  // period — תקופה.
  period:
    DispatcherAvailabilityPeriod;

  submission:
    DispatcherAvailabilitySubmission;

  // shifts — משמרות.
  shifts:
    DispatcherAvailabilityShift[];
}

/**
 * חוזה הנתונים DispatcherAvailabilityState: מוקדנים / אילוצים וזמינות / מצב.
 */
export interface DispatcherAvailabilityState {
  // data — נתונים.
  data: MyOpenAvailability | null;
  // isLoading — האם טעינה מתבצעת.
  isLoading: boolean;
  // error — שגיאה.
  error: string | null;
}
/**
 * חוזה הנתונים SaveShiftAvailabilityInput: משמרת / אילוצים וזמינות / קלט.
 */
export interface SaveShiftAvailabilityInput {
  // shiftSlotId — משמרת / מזהה.
  shiftSlotId: string;
  // status — סטטוס.
  status: DispatcherAvailabilityStatus;
  // note — הערה.
  note: string | null;
}

/**
 * חוזה הנתונים SaveShiftAvailabilityResult: משמרת / אילוצים וזמינות / תוצאה.
 */
export interface SaveShiftAvailabilityResult {
  // shiftSlotId — משמרת / מזהה.
  shiftSlotId: string;
  // availabilityStatus — מצב הזמינות.
  availabilityStatus:
    DispatcherAvailabilityStatus;
  // availabilityNote — אילוצים וזמינות / הערה.
  availabilityNote: string | null;
  // availabilityUpdatedAt — מועד עדכון.
  availabilityUpdatedAt: string;
  // availableCount — מספר הסימונים כזמין.
  availableCount: number;
  // unavailableCount — מספר הסימונים כלא זמין.
  unavailableCount: number;
  // answeredCount — כמות.
  answeredCount: number;
  // totalShiftCount — סך הכול / משמרת / כמות.
  totalShiftCount: number;
}
/**
 * חוזה הנתונים SubmitAvailabilityResult: אילוצים וזמינות / תוצאה.
 */
export interface SubmitAvailabilityResult {
  // periodId — מזהה התקופה.
  periodId: string;
  // submissionStatus — מצב ההגשה.
  submissionStatus: 'submitted';
  // submittedAt — הוגש.
  submittedAt: string;
  // availableCount — מספר הסימונים כזמין.
  availableCount: number;
  // unavailableCount — מספר הסימונים כלא זמין.
  unavailableCount: number;
  // answeredCount — כמות.
  answeredCount: number;
  // totalShiftCount — סך הכול / משמרת / כמות.
  totalShiftCount: number;
}