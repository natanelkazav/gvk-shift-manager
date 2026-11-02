/**
 * קובץ: src/types/autoScheduling.ts
 * מטרה: הגדרת מבני משמרות, מועמדים, מונים, תוצאות ניקוד וטיוטות שיבוץ.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: SchedulingShiftCategory, SchedulingShift, SchedulingDispatcherCounters, SchedulingDispatcher, SchedulingAssignmentSource, SchedulingAssignment, SchedulingIssueType, SchedulingIssue, SchedulingDispatcherSummary, SchedulingDraft ועוד.
 * - תיאור מבנה הקלט והפלט לבדיקת טיפוסים בזמן פיתוח.
 */
import type {
  AssignmentCandidateShift,
} from './assignmentCandidates';

/**
 * טיפוס SchedulingShiftCategory: משמרת.
 */
export type SchedulingShiftCategory =
  | 'weekday'
  | 'friday'
  | 'saturday'
  | 'holiday_eve'
  | 'holiday_full'
  | 'holiday_end'
  | 'chol_hamoed'
  | 'other';

/**
 * חוזה הנתונים SchedulingShift: משמרת.
 */
export interface SchedulingShift {
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

  // startsAt — מועד התחלה.
  startsAt: Date;
  // endsAt — מועד סיום.
  endsAt: Date;

  // endsNextDay — יום.
  endsNextDay: boolean;

  // scheduleType — סוג יום השיבוץ.
  scheduleType:
    SchedulingShiftCategory;

  // holidayName — חג / שם.
  holidayName:
    string | null;

  // isPremium — תעריף מוגדל.
  isPremium: boolean;
  // isNightShift — משמרת.
  isNightShift: boolean;

  // sortOrder — סדר המיון.
  sortOrder: number;

  // assignmentState — הקצאה / מצב.
  assignmentState:
    AssignmentCandidateShift['assignmentState'];

  // availableUserIds — מזהה משתמש.
  availableUserIds:
    string[];

  // soleAvailableUserId — מזהה משתמש.
  soleAvailableUserId:
    string | null;
}

/**
 * חוזה הנתונים SchedulingDispatcherCounters: מוקדנים.
 */
export interface SchedulingDispatcherCounters {
  // totalShifts — סך הכול / משמרות.
  totalShifts: number;

  // weekdayEveningShifts — משמרות.
  weekdayEveningShifts: number;
  // weekdayNightShifts — משמרות.
  weekdayNightShifts: number;

  // fridayMorningShifts — משמרות.
  fridayMorningShifts: number;
  // fridayAfternoonShifts — משמרות.
  fridayAfternoonShifts: number;
  // fridayNightShifts — משמרות.
  fridayNightShifts: number;

  // saturdayMorningShifts — משמרות.
  saturdayMorningShifts: number;
  // saturdayAfternoonShifts — משמרות.
  saturdayAfternoonShifts: number;
  // saturdayNightShifts — משמרות.
  saturdayNightShifts: number;

  // premiumShifts — תעריף מוגדל / משמרות.
  premiumShifts: number;
  // holidayShifts — חג / משמרות.
  holidayShifts: number;
}

/**
 * חוזה הנתונים SchedulingDispatcher: מוקדנים.
 */
export interface SchedulingDispatcher {
  // userId — מזהה משתמש.
  userId: string;
  // displayName — שם תצוגה.
  displayName: string;
  // scheduleName — שיבוץ / שם.
  scheduleName:
    string | null;

  counters:
    SchedulingDispatcherCounters;

  // assignedShiftIds — מזהה המשמרת.
  assignedShiftIds:
    string[];
}

/**
 * טיפוס SchedulingAssignmentSource: מקור השיבוץ.
 */
export type SchedulingAssignmentSource =
  | 'automatic_single_candidate'
  | 'automatic_scoring'
  | 'manual';

/**
 * חוזה הנתונים SchedulingAssignment: הקצאה.
 */
export interface SchedulingAssignment {
  // shiftId — מזהה המשמרת.
  shiftId: string;
  // userId — מזהה משתמש.
  userId: string;

  // source — מקור.
  source:
    SchedulingAssignmentSource;

  // score — ניקוד.
  score:
    number | null;

  reasons:
    string[];
}

/**
 * טיפוס SchedulingIssueType: הנתון SchedulingIssueType בהקשר הפעולה.
 */
export type SchedulingIssueType =
  | 'no_available_dispatcher'
  | 'single_candidate_conflict'
  | 'no_legal_candidate'
  | 'invalid_shift_time'
  | 'duplicate_shift';

/**
 * חוזה הנתונים SchedulingIssue: הנתון SchedulingIssue בהקשר הפעולה.
 */
export interface SchedulingIssue {
  // shiftId — מזהה המשמרת.
  shiftId: string;

  type:
    SchedulingIssueType;

  // message — הודעה.
  message: string;

  // candidateUserIds — מזהה משתמש.
  candidateUserIds:
    string[];
}

/**
 * חוזה הנתונים SchedulingDispatcherSummary: מוקדנים / סיכום.
 */
export interface SchedulingDispatcherSummary {
  // userId — מזהה משתמש.
  userId: string;
  // displayName — שם תצוגה.
  displayName: string;
  // scheduleName — שיבוץ / שם.
  scheduleName:
    string | null;

  // totalShifts — סך הכול / משמרות.
  totalShifts: number;

  // weekdayEveningShifts — משמרות.
  weekdayEveningShifts: number;
  // weekdayNightShifts — משמרות.
  weekdayNightShifts: number;

  // fridayMorningShifts — משמרות.
  fridayMorningShifts: number;
  // fridayAfternoonShifts — משמרות.
  fridayAfternoonShifts: number;
  // fridayNightShifts — משמרות.
  fridayNightShifts: number;

  // saturdayMorningShifts — משמרות.
  saturdayMorningShifts: number;
  // saturdayAfternoonShifts — משמרות.
  saturdayAfternoonShifts: number;
  // saturdayNightShifts — משמרות.
  saturdayNightShifts: number;

  // premiumShifts — תעריף מוגדל / משמרות.
  premiumShifts: number;
  // holidayShifts — חג / משמרות.
  holidayShifts: number;
}

/**
 * חוזה הנתונים SchedulingDraft: טיוטה.
 */
export interface SchedulingDraft {
  // assignments — הקצאות.
  assignments:
    SchedulingAssignment[];

  // unassignedShiftIds — מזהה המשמרת.
  unassignedShiftIds:
    string[];

  issues:
    SchedulingIssue[];

  // dispatcherSummaries — מוקדנים.
  dispatcherSummaries:
    SchedulingDispatcherSummary[];
}

/**
 * חוזה הנתונים CandidateEligibilityResult: כשירות לשיבוץ / תוצאה.
 */
export interface CandidateEligibilityResult {
  isEligible: boolean;

  reasons:
    string[];
}

/**
 * חוזה הנתונים CandidateScoreResult: ניקוד / תוצאה.
 */
export interface CandidateScoreResult {
  // userId — מזהה משתמש.
  userId: string;

  // score — ניקוד.
  score: number;

  reasons:
    string[];
}