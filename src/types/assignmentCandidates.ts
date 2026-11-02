/**
 * קובץ: src/types/assignmentCandidates.ts
 * מטרה: הגדרת טיפוסים וחוזי נתונים עבור הקצאה.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: AssignmentCandidateState, AssignmentCandidatesPeriod, AssignmentCandidateShift, AssignmentCandidatesData, AssignmentCandidatesState.
 * - תיאור מבנה הקלט והפלט לבדיקת טיפוסים בזמן פיתוח.
 */
/**
 * טיפוס AssignmentCandidateState: הקצאה / מצב.
 */
export type AssignmentCandidateState =
  | 'no_available'
  | 'single_available'
  | 'multiple_available';

/**
 * חוזה הנתונים AssignmentCandidatesPeriod: הקצאה / תקופה.
 */
export interface AssignmentCandidatesPeriod {
  // id — מזהה.
  id: string;
  // year — שנה.
  year: number;
  // month — חודש.
  month: number;
  // title — כותרת.
  title: string | null;
  // status — סטטוס.
  status: 'closed';
}

/**
 * חוזה הנתונים AssignmentCandidateShift: הקצאה / משמרת.
 */
export interface AssignmentCandidateShift {
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

  // assignmentState — הקצאה / מצב.
  assignmentState:
    AssignmentCandidateState;

  // soleAvailableUserId — מזהה משתמש.
  soleAvailableUserId: string | null;
  // soleAvailableDisplayName — שם תצוגה.
  soleAvailableDisplayName:
    string | null;
  // soleAvailableScheduleName — שיבוץ / שם.
  soleAvailableScheduleName:
    string | null;

  // availableUserIds — מזהה משתמש.
  availableUserIds: string[];
  // availableDisplayNames — שם תצוגה.
  availableDisplayNames: string[];
  // availableScheduleNames — שיבוץ.
  availableScheduleNames:
    (string | null)[];
}

/**
 * חוזה הנתונים AssignmentCandidatesData: הקצאה / נתונים.
 */
export interface AssignmentCandidatesData {
  // period — תקופה.
  period:
    AssignmentCandidatesPeriod;

  // shifts — משמרות.
  shifts:
    AssignmentCandidateShift[];
}

/**
 * חוזה הנתונים AssignmentCandidatesState: הקצאה / מצב.
 */
export interface AssignmentCandidatesState {
  // data — נתונים.
  data:
    AssignmentCandidatesData | null;

  // isLoading — האם טעינה מתבצעת.
  isLoading: boolean;

  // error — שגיאה.
  error: string | null;
}