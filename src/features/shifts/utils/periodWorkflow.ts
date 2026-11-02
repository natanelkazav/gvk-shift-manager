/**
 * קובץ: src/features/shifts/utils/periodWorkflow.ts
 * מטרה: פונקציות עזר לעיבוד וחישוב עבור תקופה / תהליך עבודה.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: WorkflowAvailabilityStatus, WorkflowScheduleStatus, WorkflowPublicationStatus, WorkflowStep, PeriodWorkflowInput, PeriodWorkflowState, getPublicationStatus, getNextAction, getBlockingReason, getRecommendation ועוד.
 * - ריכוז ההגדרות והלוגיקה המפורטות בהמשך הקובץ.
 */
/**
 * טיפוס WorkflowAvailabilityStatus: מצב הזמינות.
 */
export type WorkflowAvailabilityStatus =
  | 'missing'
  | 'draft'
  | 'open'
  | 'closed'
  | 'archived';

/**
 * טיפוס WorkflowScheduleStatus: תהליך עבודה / שיבוץ / סטטוס.
 */
export type WorkflowScheduleStatus =
  | 'missing'
  | 'draft'
  | 'published'
  | 'archived';

/**
 * טיפוס WorkflowPublicationStatus: תהליך עבודה / סטטוס.
 */
export type WorkflowPublicationStatus =
  | 'notPublished'
  | 'published'
  | 'archived';

/**
 * טיפוס WorkflowStep: תהליך עבודה.
 */
export type WorkflowStep =
  | 'createAvailability'
  | 'openAvailability'
  | 'closeAvailability'
  | 'createSchedule'
  | 'reviewSchedule'
  | 'publishSchedule'
  | 'completed'
  | 'archived';

/**
 * חוזה הנתונים PeriodWorkflowInput: תקופה / תהליך עבודה / קלט.
 */
export interface PeriodWorkflowInput {
  // availabilityStatus — מצב הזמינות.
  availabilityStatus:
    WorkflowAvailabilityStatus;

  // scheduleStatus — שיבוץ / סטטוס.
  scheduleStatus:
    WorkflowScheduleStatus;

  // hasScheduleWarnings — שיבוץ (אופציונלי).
  hasScheduleWarnings?:
    boolean;

  // hasUnassignedScheduleItems — שיבוץ / פריטים (אופציונלי).
  hasUnassignedScheduleItems?:
    boolean;
}

/**
 * חוזה הנתונים PeriodWorkflowState: תקופה / תהליך עבודה / מצב.
 */
export interface PeriodWorkflowState {
  // availabilityStatus — מצב הזמינות.
  availabilityStatus:
    WorkflowAvailabilityStatus;

  // scheduleStatus — שיבוץ / סטטוס.
  scheduleStatus:
    WorkflowScheduleStatus;

  // publicationStatus — סטטוס.
  publicationStatus:
    WorkflowPublicationStatus;

  nextAction:
    WorkflowStep;

  // canCreateAvailability — אילוצים וזמינות.
  canCreateAvailability:
    boolean;

  // canOpenAvailability — אילוצים וזמינות.
  canOpenAvailability:
    boolean;

  // canCloseAvailability — אילוצים וזמינות.
  canCloseAvailability:
    boolean;

  // canCreateSchedule — שיבוץ.
  canCreateSchedule:
    boolean;

  // canReviewSchedule — שיבוץ.
  canReviewSchedule:
    boolean;

  // canPublishSchedule — שיבוץ.
  canPublishSchedule:
    boolean;

  isCompleted:
    boolean;

  blockingReason:
    string | null;

  recommendation:
    string;
}

/**
 * פעולה getPublicationStatus: שליפה או חישוב של סטטוס.
 * @param scheduleStatus — שיבוץ / סטטוס.
 * @returns WorkflowPublicationStatus — הפלט בהתאם לחתימה.
 */
function getPublicationStatus(
  scheduleStatus:
    WorkflowScheduleStatus,
): WorkflowPublicationStatus {
  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר scheduleStatus === 'published'.
  if (
    scheduleStatus ===
    'published'
  ) {
    return 'published';
  }

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר scheduleStatus === 'archived'.
  if (
    scheduleStatus ===
    'archived'
  ) {
    return 'archived';
  }

  return 'notPublished';
}

/**
 * פעולה getNextAction: שליפה או חישוב של הנתון getNextAction בהקשר הפעולה.
 * @param input — קלט.
 * @returns WorkflowStep — הפלט בהתאם לחתימה.
 */
function getNextAction(
  input:
    PeriodWorkflowInput,
): WorkflowStep {
  const {
    availabilityStatus,
    scheduleStatus,
    hasScheduleWarnings =
      false,
    hasUnassignedScheduleItems =
      false,
  } = input;

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר availabilityStatus === 'archived' || scheduleStatus === 'archived'.
  if (
    availabilityStatus ===
      'archived' ||
    scheduleStatus ===
      'archived'
  ) {
    return 'archived';
  }

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר scheduleStatus === 'published'.
  if (
    scheduleStatus ===
    'published'
  ) {
    return 'completed';
  }

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר availabilityStatus === 'missing'.
  if (
    availabilityStatus ===
    'missing'
  ) {
    return 'createAvailability';
  }

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר availabilityStatus === 'draft'.
  if (
    availabilityStatus ===
    'draft'
  ) {
    return 'openAvailability';
  }

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר availabilityStatus === 'open'.
  if (
    availabilityStatus ===
    'open'
  ) {
    return 'closeAvailability';
  }

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר availabilityStatus === 'closed' && scheduleStatus === 'missing'.
  if (
    availabilityStatus ===
      'closed' &&
    scheduleStatus ===
      'missing'
  ) {
    return 'createSchedule';
  }

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר scheduleStatus === 'draft' && ( hasScheduleWarnings || hasUnassignedScheduleItems ).
  if (
    scheduleStatus ===
      'draft' &&
    (
      hasScheduleWarnings ||
      hasUnassignedScheduleItems
    )
  ) {
    return 'reviewSchedule';
  }

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר scheduleStatus === 'draft'.
  if (
    scheduleStatus ===
    'draft'
  ) {
    return 'publishSchedule';
  }

  return 'createAvailability';
}

/**
 * פעולה getBlockingReason: שליפה או חישוב של הנתון getBlockingReason בהקשר הפעולה.
 * @param input — קלט.
 * @param nextAction — הנתון nextAction בהקשר הפעולה.
 * @returns string | null — הפלט בהתאם לחתימה.
 */
function getBlockingReason(
  input:
    PeriodWorkflowInput,

  nextAction:
    WorkflowStep,
): string | null {
  const {
    availabilityStatus,
    scheduleStatus,
    hasScheduleWarnings =
      false,
    hasUnassignedScheduleItems =
      false,
  } = input;

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר nextAction === 'archived'.
  if (
    nextAction ===
    'archived'
  ) {
    return 'התקופה נמצאת בארכיון ולא ניתן לבצע בה פעולות נוספות.';
  }

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר nextAction === 'closeAvailability'.
  if (
    nextAction ===
      'closeAvailability'
  ) {
    return 'יש לסגור את תקופת האילוצים לפני יצירת השיבוץ.';
  }

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר availabilityStatus !== 'closed' && scheduleStatus === 'missing'.
  if (
    availabilityStatus !==
      'closed' &&
    scheduleStatus ===
      'missing'
  ) {
    return 'ניתן ליצור שיבוץ רק לאחר סגירת תקופת האילוצים.';
  }

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר scheduleStatus === 'draft' && hasUnassignedScheduleItems.
  if (
    scheduleStatus ===
      'draft' &&
    hasUnassignedScheduleItems
  ) {
    return 'לא ניתן לפרסם לפני השלמת כל השיבוצים החסרים.';
  }

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר scheduleStatus === 'draft' && hasScheduleWarnings.
  if (
    scheduleStatus ===
      'draft' &&
    hasScheduleWarnings
  ) {
    return 'יש לבדוק את אזהרות השיבוץ לפני הפרסום.';
  }

  return null;
}

/**
 * פעולה getRecommendation: שליפה או חישוב של הנתון getRecommendation בהקשר הפעולה.
 * @param nextAction — הנתון nextAction בהקשר הפעולה.
 * @returns string — הפלט בהתאם לחתימה.
 */
function getRecommendation(
  nextAction:
    WorkflowStep,
): string {
  switch (
    nextAction
  ) {
    case 'createAvailability':
      return 'הפעולה הבאה: יצירת תקופת אילוצים.';

    case 'openAvailability':
      return 'הפעולה הבאה: פתיחת תקופת האילוצים להגשה.';

    case 'closeAvailability':
      return 'הפעולה הבאה: בדיקת ההגשות וסגירת תקופת האילוצים.';

    case 'createSchedule':
      return 'הפעולה הבאה: יצירת טיוטת שיבוץ.';

    case 'reviewSchedule':
      return 'הפעולה הבאה: בדיקת הטיוטה ותיקון חוסרים או אזהרות.';

    case 'publishSchedule':
      return 'הפעולה הבאה: פרסום השיבוץ.';

    case 'completed':
      return 'התהליך הושלם והשיבוץ פורסם.';

    case 'archived':
      return 'התקופה נמצאת בארכיון.';

    default:
      return 'לא נמצאה פעולה מומלצת.';
  }
}

/**
 * פעולה calculateWorkflowState: חישוב תהליך עבודה / מצב.
 * @param input — קלט.
 * @returns PeriodWorkflowState — הפלט בהתאם לחתימה.
 */
export function calculateWorkflowState(
  input:
    PeriodWorkflowInput,
): PeriodWorkflowState {
  // nextAction — הנתון nextAction בהקשר הפעולה.
  const nextAction =
    getNextAction(
      input,
    );

  // publicationStatus — סטטוס.
  const publicationStatus =
    getPublicationStatus(
      input.scheduleStatus,
    );

  return {
    availabilityStatus:
      input.availabilityStatus,

    scheduleStatus:
      input.scheduleStatus,

    publicationStatus,

    nextAction,

    canCreateAvailability:
      nextAction ===
      'createAvailability',

    canOpenAvailability:
      nextAction ===
      'openAvailability',

    canCloseAvailability:
      nextAction ===
      'closeAvailability',

    canCreateSchedule:
      nextAction ===
      'createSchedule',

    canReviewSchedule:
      nextAction ===
      'reviewSchedule',

    canPublishSchedule:
      nextAction ===
      'publishSchedule',

    isCompleted:
      nextAction ===
      'completed',

    blockingReason:
      getBlockingReason(
        input,
        nextAction,
      ),

    recommendation:
      getRecommendation(
        nextAction,
      ),
  };
}