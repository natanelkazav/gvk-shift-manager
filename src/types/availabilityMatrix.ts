/**
 * קובץ: src/types/availabilityMatrix.ts
 * מטרה: הגדרת טיפוסים וחוזי נתונים עבור אילוצים וזמינות / מטריצת נתונים.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: AvailabilityMatrixStatus, AvailabilityMatrixPeriod, AvailabilityMatrixDispatcher, AvailabilityMatrixShift, AvailabilityPeriodMatrix, AvailabilityPeriodMatrixState.
 * - תיאור מבנה הקלט והפלט לבדיקת טיפוסים בזמן פיתוח.
 */
/**
 * טיפוס AvailabilityMatrixStatus: אילוצים וזמינות / מטריצת נתונים / סטטוס.
 */
export type AvailabilityMatrixStatus =
  | 'available'
  | 'unavailable'
  | null;

/**
 * חוזה הנתונים AvailabilityMatrixPeriod: אילוצים וזמינות / מטריצת נתונים / תקופה.
 */
export interface AvailabilityMatrixPeriod {
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
}

/**
 * חוזה הנתונים AvailabilityMatrixDispatcher: אילוצים וזמינות / מטריצת נתונים / מוקדנים.
 */
export interface AvailabilityMatrixDispatcher {
  // userId — מזהה משתמש.
  userId: string;
  // displayName — שם תצוגה.
  displayName: string;
  // email — כתובת דוא״ל.
  email: string;
  // scheduleName — שיבוץ / שם.
  scheduleName: string | null;
  // submissionStatus — מצב ההגשה.
  submissionStatus: string;
  // availabilityStatus — מצב הזמינות.
  availabilityStatus:
    AvailabilityMatrixStatus;
  // note — הערה.
  note: string | null;
  // updatedAt — מועד עדכון.
  updatedAt: string | null;
}

/**
 * חוזה הנתונים AvailabilityMatrixShift: אילוצים וזמינות / מטריצת נתונים / משמרת.
 */
export interface AvailabilityMatrixShift {
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

  // totalDispatchers — סך הכול.
  totalDispatchers: number;
  availableDispatchers: number;
  unavailableDispatchers: number;
  unansweredDispatchers: number;

  dispatchers:
    AvailabilityMatrixDispatcher[];
}

/**
 * חוזה הנתונים AvailabilityPeriodMatrix: תקופת אילוצים.
 */
export interface AvailabilityPeriodMatrix {
  // period — תקופה.
  period:
    AvailabilityMatrixPeriod;

  // shifts — משמרות.
  shifts:
    AvailabilityMatrixShift[];
}

/**
 * חוזה הנתונים AvailabilityPeriodMatrixState: תקופת אילוצים.
 */
export interface AvailabilityPeriodMatrixState {
  // data — נתונים.
  data:
    AvailabilityPeriodMatrix | null;

  // isLoading — האם טעינה מתבצעת.
  isLoading: boolean;

  // error — שגיאה.
  error: string | null;
}