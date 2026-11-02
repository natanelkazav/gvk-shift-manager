/**
 * קובץ: src/types/schedule.ts
 * מטרה: הגדרת טיפוסים וחוזי נתונים עבור שיבוץ.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: SchedulePeriodStatus, ScheduleShiftType, ScheduleAssignmentSource, ScheduleViewerRole, ScheduleViewMode, ScheduleShiftProgressState, SchedulePeriodSummary, ScheduleAssignedUser, ScheduleShift, DispatcherMonthlyStatistics ועוד.
 * - תיאור מבנה הקלט והפלט לבדיקת טיפוסים בזמן פיתוח.
 */
/**
 * טיפוס SchedulePeriodStatus: תקופת שיבוץ.
 */
export type SchedulePeriodStatus =
  | 'draft'
  | 'collecting_availability'
  | 'scheduling'
  | 'published'
  | 'archived';

/**
 * טיפוס ScheduleShiftType: שיבוץ / משמרת.
 */
export type ScheduleShiftType =
  | 'weekday'
  | 'friday'
  | 'saturday'
  | 'holiday_eve'
  | 'holiday_full'
  | 'holiday_end'
  | 'chol_hamoed';

/**
 * טיפוס ScheduleAssignmentSource: מקור השיבוץ.
 */
export type ScheduleAssignmentSource =
  | 'manual'
  | 'automatic'
  | 'shift_swap'
  | 'import';

/**
 * טיפוס ScheduleViewerRole: שיבוץ.
 */
export type ScheduleViewerRole =
  | 'admin'
  | 'manager'
  | 'dispatcher'
  | 'on_call'
  | 'viewer';

/**
 * טיפוס ScheduleViewMode: שיבוץ / מצב פעולה.
 */
export type ScheduleViewMode =
  | 'personal'
  | 'team';

/**
 * טיפוס ScheduleShiftProgressState: שיבוץ / משמרת / מצב.
 */
export type ScheduleShiftProgressState =
  | 'completed'
  | 'current'
  | 'upcoming';

/**
 * חוזה הנתונים SchedulePeriodSummary: תקופת שיבוץ.
 */
export interface SchedulePeriodSummary {
  // id — מזהה.
  id: string;

  // availabilityPeriodId — תקופת אילוצים.
  availabilityPeriodId:
    string | null;

  // year — שנה.
  year: number;
  // month — חודש.
  month: number;

  // title — כותרת.
  title:
    string | null;

  // status — סטטוס.
  status:
    SchedulePeriodStatus;

  // publishedAt — פורסם.
  publishedAt:
    string | null;

  approvedAt:
    string | null;

  // createdAt — מועד יצירה.
  createdAt: string;
  // updatedAt — מועד עדכון.
  updatedAt: string;
}

/**
 * חוזה הנתונים ScheduleAssignedUser: שיבוץ / משתמש.
 */
export interface ScheduleAssignedUser {
  // id — מזהה.
  id: string;

  // displayName — שם תצוגה.
  displayName: string;

  // scheduleName — שיבוץ / שם.
  scheduleName:
    string | null;

  role:
    ScheduleViewerRole;
}

/**
 * חוזה הנתונים ScheduleShift: שיבוץ / משמרת.
 */
export interface ScheduleShift {
  // id — מזהה.
  id: string;

  // periodId — מזהה התקופה.
  periodId: string;

  // availabilityShiftSlotId — אילוצים וזמינות / משמרת / מזהה.
  availabilityShiftSlotId:
    string | null;

  // shiftDate — תאריך המשמרת.
  shiftDate: string;

  // startsAt — מועד התחלה.
  startsAt: string;
  // endsAt — מועד סיום.
  endsAt: string;

  // shiftCode — משמרת.
  shiftCode: string;

  // scheduleType — סוג יום השיבוץ.
  scheduleType:
    ScheduleShiftType;

  // isPremium — תעריף מוגדל.
  isPremium: boolean;

  // holidayName — חג / שם.
  holidayName:
    string | null;

  // assignedUser — משתמש.
  assignedUser:
    ScheduleAssignedUser | null;

  // assignmentSource — מקור השיבוץ.
  assignmentSource:
    ScheduleAssignmentSource | null;

  // assignmentScore — הקצאה / ניקוד.
  assignmentScore:
    number | null;

  // assignmentReasons — הקצאה.
  assignmentReasons:
    string[];

  isIntentionallyUnassigned?: boolean;

  // isLocked — האם הרשומה נעולה.
  isLocked: boolean;

  // notes — הערות.
  notes:
    string | null;

  // progressState — מצב.
  progressState:
    ScheduleShiftProgressState;
}

/**
 * חוזה הנתונים DispatcherMonthlyStatistics: מוקדנים / סטטיסטיקה.
 */
export interface DispatcherMonthlyStatistics {
  // userId — מזהה משתמש.
  userId: string;

  // displayName — שם תצוגה.
  displayName: string;

  // scheduleName — שיבוץ / שם.
  scheduleName:
    string | null;

  // totalShifts — סך הכול / משמרות.
  totalShifts: number;

  // completedShifts — משמרות.
  completedShifts: number;

  // remainingShifts — משמרות.
  remainingShifts: number;

  completionPercentage: number;

  // totalScheduledHours — סך הכול / שעות.
  totalScheduledHours: number;

  // completedHours — שעות.
  completedHours: number;

  // remainingHours — שעות.
  remainingHours: number;

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

  // manualAssignments — הקצאות.
  manualAssignments: number;

  // automaticAssignments — הקצאות.
  automaticAssignments: number;
}

/**
 * חוזה הנתונים ScheduleTeamStatistics: שיבוץ / סטטיסטיקה.
 */
export interface ScheduleTeamStatistics {
  // totalShifts — סך הכול / משמרות.
  totalShifts: number;

  // completedShifts — משמרות.
  completedShifts: number;

  // remainingShifts — משמרות.
  remainingShifts: number;

  completionPercentage: number;

  assignedDispatchers: number;

  // premiumShifts — תעריף מוגדל / משמרות.
  premiumShifts: number;

  // holidayShifts — חג / משמרות.
  holidayShifts: number;

  // manualAssignments — הקצאות.
  manualAssignments: number;

  // automaticAssignments — הקצאות.
  automaticAssignments: number;
}

/**
 * חוזה הנתונים CurrentScheduleAccess: שיבוץ.
 */
export interface CurrentScheduleAccess {
  // userId — מזהה משתמש.
  userId: string;

  role:
    ScheduleViewerRole;

  // canViewSchedule — האם צפייה מותרת.
  canViewSchedule: boolean;

  // canEditSchedule — האם עריכה מותרת.
  canEditSchedule: boolean;

  // canViewTeamSchedule — האם צפייה מותרת.
  canViewTeamSchedule: boolean;

  // defaultViewMode — מצב פעולה.
  defaultViewMode:
    ScheduleViewMode;
}

/**
 * חוזה הנתונים CurrentScheduleData: שיבוץ / נתונים.
 */
export interface CurrentScheduleData {
  access:
    CurrentScheduleAccess;

  // period — תקופה.
  period:
    SchedulePeriodSummary | null;

  // shifts — משמרות.
  shifts:
    ScheduleShift[];

  // visibleShifts — משמרות.
  visibleShifts:
    ScheduleShift[];

  // personalStatistics — סטטיסטיקה.
  personalStatistics:
    DispatcherMonthlyStatistics | null;

  // dispatcherStatistics — מוקדנים / סטטיסטיקה.
  dispatcherStatistics:
    DispatcherMonthlyStatistics[];

  // teamStatistics — סטטיסטיקה.
  teamStatistics:
    ScheduleTeamStatistics;

  generatedAt: string;
}

/**
 * חוזה הנתונים CurrentScheduleFilters: שיבוץ / מסננים.
 */
export interface CurrentScheduleFilters {
  // viewMode — מצב פעולה.
  viewMode:
    ScheduleViewMode;

  // selectedUserId — מזהה משתמש.
  selectedUserId:
    string | null;

  includeCompleted:
    boolean;

  includeUpcoming:
    boolean;

  // includePremiumOnly — תעריף מוגדל.
  includePremiumOnly:
    boolean;
}
/**
 * חוזה הנתונים ScheduleEditDispatcher: שיבוץ / מוקדנים.
 */
export interface ScheduleEditDispatcher {
  // id — מזהה.
  id: string;

  // displayName — שם תצוגה.
  displayName: string;

  // scheduleName — שיבוץ / שם.
  scheduleName:
    string | null;

  // availabilityStatus — מצב הזמינות (אופציונלי).
  availabilityStatus?:
    'available'
    | 'unavailable'
    | null;

  isAutoCompleted?:
    boolean;
}

/**
 * חוזה הנתונים CurrentScheduleEditOptions: שיבוץ / אפשרויות בחירה.
 */
export interface CurrentScheduleEditOptions {
  dispatchers:
    ScheduleEditDispatcher[];
}

/**
 * חוזה הנתונים UpdateCurrentScheduleShiftRequest: שיבוץ / משמרת / נתוני הבקשה.
 */
export interface UpdateCurrentScheduleShiftRequest {
  // shiftId — מזהה המשמרת.
  shiftId: string;

  // newUserId — מזהה העובד לאחר השינוי.
  newUserId: string;

  reason:
    string | null;
}

/**
 * חוזה הנתונים UpdateCurrentScheduleShiftResponse: שיבוץ / משמרת / תוצאת הפעולה.
 */
export interface UpdateCurrentScheduleShiftResponse {
  // shiftId — מזהה המשמרת.
  shiftId: string;

  // previousUserId — מזהה העובד לפני השינוי.
  previousUserId:
    string | null;

  // previousUserName — משתמש / שם.
  previousUserName:
    string | null;

  // newUserId — מזהה העובד לאחר השינוי.
  newUserId: string;

  // newUserName — משתמש / שם.
  newUserName: string;

  // shiftDate — תאריך המשמרת.
  shiftDate: string;

  // startsAt — מועד התחלה.
  startsAt: string;

  // endsAt — מועד סיום.
  endsAt: string;

  // notificationIds — התראות.
  notificationIds:
    string[];
}


/**
 * חוזה הנתונים ScheduleDraftEditCandidate: שיבוץ / טיוטה.
 */
export interface ScheduleDraftEditCandidate {
  // userId — מזהה משתמש.
  userId: string;
  // displayName — שם תצוגה.
  displayName: string;
  // scheduleName — שיבוץ / שם.
  scheduleName: string | null;
  isAvailable: boolean;
  // availabilityStatus — מצב הזמינות.
  availabilityStatus:
    'available'
    | 'unavailable'
    | null;
  isAutoCompleted: boolean;
}

/**
 * חוזה הנתונים ScheduleDraftEditShiftContext: שיבוץ / טיוטה / משמרת.
 */
export interface ScheduleDraftEditShiftContext {
  // scheduleShiftId — מזהה המשמרת.
  scheduleShiftId: string;
  // availabilityShiftSlotId — אילוצים וזמינות / משמרת / מזהה.
  availabilityShiftSlotId: string | null;
  // availableCount — מספר הסימונים כזמין.
  availableCount: number;
  // totalDispatchers — סך הכול.
  totalDispatchers: number;
  candidates: ScheduleDraftEditCandidate[];
}

/**
 * חוזה הנתונים ScheduleDraftEditContext: שיבוץ / טיוטה.
 */
export interface ScheduleDraftEditContext {
  // periodId — מזהה התקופה.
  periodId: string;
  // shifts — משמרות.
  shifts: ScheduleDraftEditShiftContext[];
  dispatchers: ScheduleEditDispatcher[];
}

/**
 * חוזה הנתונים UpdateScheduleDraftShiftRequest: שיבוץ / טיוטה / משמרת / נתוני הבקשה.
 */
export interface UpdateScheduleDraftShiftRequest {
  // shiftId — מזהה המשמרת.
  shiftId: string;
  // newUserId — מזהה העובד לאחר השינוי.
  newUserId: string | null;
  intentionallyUnassigned: boolean;
}
