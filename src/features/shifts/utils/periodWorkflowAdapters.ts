/**
 * קובץ: src/features/shifts/utils/periodWorkflowAdapters.ts
 * מטרה: פונקציות עזר לעיבוד וחישוב עבור תקופה / תהליך עבודה.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: AvailabilityPeriodLike, DispatcherSchedulePeriodLike, DispatcherScheduleShiftLike, DriverSchedulePeriodLike, DriverScheduleStatisticsLike, MorningDriverSchedulePeriodLike, MorningDriverScheduleStatisticsLike, CreateDispatcherWorkflowStateRequest, CreateDriverWorkflowStateRequest, CreateMorningDriverWorkflowStateRequest ועוד.
 * - ריכוז ההגדרות והלוגיקה המפורטות בהמשך הקובץ.
 */
import {
  calculateWorkflowState,
  type PeriodWorkflowState,
  type WorkflowAvailabilityStatus,
  type WorkflowScheduleStatus,
} from './periodWorkflow';

/**
 * חוזה הנתונים AvailabilityPeriodLike: תקופת אילוצים.
 */
interface AvailabilityPeriodLike {
  // status — סטטוס.
  status:
    string;
}

/**
 * חוזה הנתונים DispatcherSchedulePeriodLike: תקופת שיבוץ.
 */
interface DispatcherSchedulePeriodLike {
  // status — סטטוס.
  status:
    string;
}

/**
 * חוזה הנתונים DispatcherScheduleShiftLike: מוקדנים / שיבוץ / משמרת.
 */
interface DispatcherScheduleShiftLike {
  // assignedUserId — מזהה העובד המשובץ.
  assignedUserId:
    string | null;
    isIntentionallyUnassigned?: boolean;
}

/**
 * חוזה הנתונים DriverSchedulePeriodLike: תקופת שיבוץ.
 */
interface DriverSchedulePeriodLike {
  // status — סטטוס.
  status:
    string;
}

/**
 * חוזה הנתונים DriverScheduleStatisticsLike: כוננים / שיבוץ / סטטיסטיקה.
 */
interface DriverScheduleStatisticsLike {
  // unassignedDays — ימים.
  unassignedDays:
    number;

  // warningCount — כמות.
  warningCount:
    number;
}

/**
 * חוזה הנתונים MorningDriverSchedulePeriodLike: תקופת שיבוץ.
 */
interface MorningDriverSchedulePeriodLike {
  // status — סטטוס.
  status:
    string;
}

/**
 * חוזה הנתונים MorningDriverScheduleStatisticsLike: כונני בוקר.
 */
interface MorningDriverScheduleStatisticsLike {
  // unassignedAssignments — הקצאות.
  unassignedAssignments:
    number;

  minimumUnfilled:
    number;

  recommendationUnfilled:
    number;
}

/**
 * חוזה הנתונים CreateDispatcherWorkflowStateRequest: מוקדנים / תהליך עבודה / מצב / נתוני הבקשה.
 */
interface CreateDispatcherWorkflowStateRequest {
  // availabilityPeriod — תקופת אילוצים.
  availabilityPeriod:
    AvailabilityPeriodLike | null;

  // schedulePeriod — תקופת שיבוץ.
  schedulePeriod:
    DispatcherSchedulePeriodLike | null;

  // shifts — משמרות.
  shifts:
    DispatcherScheduleShiftLike[];
}

/**
 * חוזה הנתונים CreateDriverWorkflowStateRequest: כוננים / תהליך עבודה / מצב / נתוני הבקשה.
 */
interface CreateDriverWorkflowStateRequest {
  // availabilityPeriod — תקופת אילוצים.
  availabilityPeriod:
    AvailabilityPeriodLike | null;

  // schedulePeriod — תקופת שיבוץ.
  schedulePeriod:
    DriverSchedulePeriodLike | null;

  // statistics — סטטיסטיקה.
  statistics:
    DriverScheduleStatisticsLike | null;
}

/**
 * חוזה הנתונים CreateMorningDriverWorkflowStateRequest: כונני בוקר.
 */
interface CreateMorningDriverWorkflowStateRequest {
  // availabilityPeriod — תקופת אילוצים.
  availabilityPeriod:
    AvailabilityPeriodLike | null;

  // schedulePeriod — תקופת שיבוץ.
  schedulePeriod:
    MorningDriverSchedulePeriodLike | null;

  // statistics — סטטיסטיקה.
  statistics:
    MorningDriverScheduleStatisticsLike | null;
}

/**
 * פעולה normalizeAvailabilityStatus: נרמול מצב הזמינות.
 * @param status — סטטוס.
 * @returns WorkflowAvailabilityStatus — הפלט בהתאם לחתימה.
 */
function normalizeAvailabilityStatus(
  status:
    string | null | undefined,
): WorkflowAvailabilityStatus {
  switch (
    status
  ) {
    case 'draft':
      return 'draft';

    case 'open':
      return 'open';

    case 'closed':
      return 'closed';

    case 'archived':
      return 'archived';

    default:
      return 'missing';
  }
}

/**
 * פעולה normalizeScheduleStatus: נרמול שיבוץ / סטטוס.
 * @param status — סטטוס.
 * @returns WorkflowScheduleStatus — הפלט בהתאם לחתימה.
 */
function normalizeScheduleStatus(
  status:
    string | null | undefined,
): WorkflowScheduleStatus {
  switch (
    status
  ) {
    case 'draft':
    case 'scheduling':
      return 'draft';

    case 'published':
      return 'published';

    case 'archived':
      return 'archived';

    default:
      return 'missing';
  }
}

/**
 * פעולה createDispatcherWorkflowState: יצירת מוקדנים / תהליך עבודה / מצב.
 * פרמטר מפורק — שדות הקלט נגישים מקומית בשמות המוגדרים בחתימה.
 * @returns PeriodWorkflowState — הפלט בהתאם לחתימה.
 */
export function createDispatcherWorkflowState({
  availabilityPeriod,
  schedulePeriod,
  shifts,
}: CreateDispatcherWorkflowStateRequest): PeriodWorkflowState {
  // scheduleStatus — שיבוץ / סטטוס.
  const scheduleStatus =
    normalizeScheduleStatus(
      schedulePeriod?.status,
    );

  // hasUnassignedScheduleItems — שיבוץ / פריטים.
  const hasUnassignedScheduleItems =
    scheduleStatus ===
      'draft' &&
    shifts.some(
      (
        shift,
      ) =>
        !shift.assignedUserId &&
        !shift.isIntentionallyUnassigned,
    );

  return calculateWorkflowState({
    availabilityStatus:
      normalizeAvailabilityStatus(
        availabilityPeriod?.status,
      ),

    scheduleStatus,

    hasUnassignedScheduleItems,

    hasScheduleWarnings:
      false,
  });
}

/**
 * פעולה createDriverWorkflowState: יצירת כוננים / תהליך עבודה / מצב.
 * פרמטר מפורק — שדות הקלט נגישים מקומית בשמות המוגדרים בחתימה.
 * @returns PeriodWorkflowState — הפלט בהתאם לחתימה.
 */
export function createDriverWorkflowState({
  availabilityPeriod,
  schedulePeriod,
  statistics,
}: CreateDriverWorkflowStateRequest): PeriodWorkflowState {
  // scheduleStatus — שיבוץ / סטטוס.
  const scheduleStatus =
    normalizeScheduleStatus(
      schedulePeriod?.status,
    );

  return calculateWorkflowState({
    availabilityStatus:
      normalizeAvailabilityStatus(
        availabilityPeriod?.status,
      ),

    scheduleStatus,

    hasUnassignedScheduleItems:
      (
        statistics
          ?.unassignedDays ??
        0
      ) > 0,

    hasScheduleWarnings:
      (
        statistics
          ?.warningCount ??
        0
      ) > 0,
  });
}

/**
 * פעולה createMorningDriverWorkflowState: יצירת כונני בוקר.
 * פרמטר מפורק — שדות הקלט נגישים מקומית בשמות המוגדרים בחתימה.
 * @returns PeriodWorkflowState — הפלט בהתאם לחתימה.
 */
export function createMorningDriverWorkflowState({
  availabilityPeriod,
  schedulePeriod,
  statistics,
}: CreateMorningDriverWorkflowStateRequest): PeriodWorkflowState {
  // scheduleStatus — שיבוץ / סטטוס.
  const scheduleStatus =
    normalizeScheduleStatus(
      schedulePeriod?.status,
    );

  return calculateWorkflowState({
    availabilityStatus:
      normalizeAvailabilityStatus(
        availabilityPeriod?.status,
      ),

    scheduleStatus,

    /*
     * Recommended second morning drivers are a warning, not a publication
     * blocker. A minimum slot explicitly marked as intentionally unassigned
     * is already excluded from minimumUnfilled by the database.
     */
    hasUnassignedScheduleItems:
      (
        statistics
          ?.minimumUnfilled ??
        0
      ) > 0,

    hasScheduleWarnings:
      (
        statistics
          ?.recommendationUnfilled ??
        0
      ) > 0,
  });
}