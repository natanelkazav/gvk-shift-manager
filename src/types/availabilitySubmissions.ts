/**
 * קובץ: src/types/availabilitySubmissions.ts
 * מטרה: הגדרת טיפוסים וחוזי נתונים עבור אילוצים וזמינות.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: AvailabilityTrackingStatus, AvailabilitySubmissionTrackingPeriod, AvailabilitySubmissionTrackingSummary, AvailabilitySubmissionTrackingDispatcher, AvailabilityPeriodSubmissionsTracking, AvailabilityPeriodSubmissionsState.
 * - תיאור מבנה הקלט והפלט לבדיקת טיפוסים בזמן פיתוח.
 */
/**
 * טיפוס AvailabilityTrackingStatus: אילוצים וזמינות / סטטוס.
 */
export type AvailabilityTrackingStatus =
  | 'submitted'
  | 'draft'
  | 'not_started';

/**
 * חוזה הנתונים AvailabilitySubmissionTrackingPeriod: אילוצים וזמינות / תקופה.
 */
export interface AvailabilitySubmissionTrackingPeriod {
  // id — מזהה.
  id: string;
  // year — שנה.
  year: number;
  // month — חודש.
  month: number;
  // title — כותרת.
  title: string | null;
  // status — סטטוס.
  status: string;
  // submissionDeadline — מועד אחרון להגשת אילוצים.
  submissionDeadline: string | null;
}

/**
 * חוזה הנתונים AvailabilitySubmissionTrackingSummary: אילוצים וזמינות / סיכום.
 */
export interface AvailabilitySubmissionTrackingSummary {
  // totalDispatchers — סך הכול.
  totalDispatchers: number;
  // submittedDispatchers — הוגש.
  submittedDispatchers: number;
  // draftDispatchers — טיוטה.
  draftDispatchers: number;
  notStartedDispatchers: number;
}

/**
 * חוזה הנתונים AvailabilitySubmissionTrackingDispatcher: אילוצים וזמינות / מוקדנים.
 */
export interface AvailabilitySubmissionTrackingDispatcher {
  // userId — מזהה משתמש.
  userId: string;
  // displayName — שם תצוגה.
  displayName: string;
  // email — כתובת דוא״ל.
  email: string;
  // scheduleName — שיבוץ / שם.
  scheduleName: string | null;

  // status — סטטוס.
  status: AvailabilityTrackingStatus;

  // submittedAt — הוגש.
  submittedAt: string | null;
  lastSavedAt: string | null;

  // availableCount — מספר הסימונים כזמין.
  availableCount: number;
  // unavailableCount — מספר הסימונים כלא זמין.
  unavailableCount: number;
  // answeredCount — כמות.
  answeredCount: number;
  // unansweredCount — כמות.
  unansweredCount: number;
  // totalShiftCount — סך הכול / משמרת / כמות.
  totalShiftCount: number;
  completionPercentage: number;
}

/**
 * חוזה הנתונים AvailabilityPeriodSubmissionsTracking: תקופת אילוצים.
 */
export interface AvailabilityPeriodSubmissionsTracking {
  // period — תקופה.
  period: AvailabilitySubmissionTrackingPeriod;

  // summary — סיכום.
  summary: AvailabilitySubmissionTrackingSummary;

  dispatchers:
    AvailabilitySubmissionTrackingDispatcher[];
}

/**
 * חוזה הנתונים AvailabilityPeriodSubmissionsState: תקופת אילוצים.
 */
export interface AvailabilityPeriodSubmissionsState {
  // data — נתונים.
  data:
    AvailabilityPeriodSubmissionsTracking | null;

  // isLoading — האם טעינה מתבצעת.
  isLoading: boolean;

  // error — שגיאה.
  error: string | null;
}