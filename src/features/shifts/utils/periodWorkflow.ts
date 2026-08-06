export type WorkflowAvailabilityStatus =
  | 'missing'
  | 'draft'
  | 'open'
  | 'closed'
  | 'archived';

export type WorkflowScheduleStatus =
  | 'missing'
  | 'draft'
  | 'published'
  | 'archived';

export type WorkflowPublicationStatus =
  | 'notPublished'
  | 'published'
  | 'archived';

export type WorkflowStep =
  | 'createAvailability'
  | 'openAvailability'
  | 'closeAvailability'
  | 'createSchedule'
  | 'reviewSchedule'
  | 'publishSchedule'
  | 'completed'
  | 'archived';

export interface PeriodWorkflowInput {
  availabilityStatus:
    WorkflowAvailabilityStatus;

  scheduleStatus:
    WorkflowScheduleStatus;

  hasScheduleWarnings?:
    boolean;

  hasUnassignedScheduleItems?:
    boolean;
}

export interface PeriodWorkflowState {
  availabilityStatus:
    WorkflowAvailabilityStatus;

  scheduleStatus:
    WorkflowScheduleStatus;

  publicationStatus:
    WorkflowPublicationStatus;

  nextAction:
    WorkflowStep;

  canCreateAvailability:
    boolean;

  canOpenAvailability:
    boolean;

  canCloseAvailability:
    boolean;

  canCreateSchedule:
    boolean;

  canReviewSchedule:
    boolean;

  canPublishSchedule:
    boolean;

  isCompleted:
    boolean;

  blockingReason:
    string | null;

  recommendation:
    string;
}

function getPublicationStatus(
  scheduleStatus:
    WorkflowScheduleStatus,
): WorkflowPublicationStatus {
  if (
    scheduleStatus ===
    'published'
  ) {
    return 'published';
  }

  if (
    scheduleStatus ===
    'archived'
  ) {
    return 'archived';
  }

  return 'notPublished';
}

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

  if (
    availabilityStatus ===
      'archived' ||
    scheduleStatus ===
      'archived'
  ) {
    return 'archived';
  }

  if (
    scheduleStatus ===
    'published'
  ) {
    return 'completed';
  }

  if (
    availabilityStatus ===
    'missing'
  ) {
    return 'createAvailability';
  }

  if (
    availabilityStatus ===
    'draft'
  ) {
    return 'openAvailability';
  }

  if (
    availabilityStatus ===
    'open'
  ) {
    return 'closeAvailability';
  }

  if (
    availabilityStatus ===
      'closed' &&
    scheduleStatus ===
      'missing'
  ) {
    return 'createSchedule';
  }

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

  if (
    scheduleStatus ===
    'draft'
  ) {
    return 'publishSchedule';
  }

  return 'createAvailability';
}

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

  if (
    nextAction ===
    'archived'
  ) {
    return 'התקופה נמצאת בארכיון ולא ניתן לבצע בה פעולות נוספות.';
  }

  if (
    nextAction ===
      'closeAvailability'
  ) {
    return 'יש לסגור את תקופת האילוצים לפני יצירת השיבוץ.';
  }

  if (
    availabilityStatus !==
      'closed' &&
    scheduleStatus ===
      'missing'
  ) {
    return 'ניתן ליצור שיבוץ רק לאחר סגירת תקופת האילוצים.';
  }

  if (
    scheduleStatus ===
      'draft' &&
    hasUnassignedScheduleItems
  ) {
    return 'לא ניתן לפרסם לפני השלמת כל השיבוצים החסרים.';
  }

  if (
    scheduleStatus ===
      'draft' &&
    hasScheduleWarnings
  ) {
    return 'יש לבדוק את אזהרות השיבוץ לפני הפרסום.';
  }

  return null;
}

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

export function calculateWorkflowState(
  input:
    PeriodWorkflowInput,
): PeriodWorkflowState {
  const nextAction =
    getNextAction(
      input,
    );

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