import {
  calculateWorkflowState,
  type PeriodWorkflowState,
  type WorkflowAvailabilityStatus,
  type WorkflowScheduleStatus,
} from './periodWorkflow';

interface AvailabilityPeriodLike {
  status:
    string;
}

interface DispatcherSchedulePeriodLike {
  status:
    string;
}

interface DispatcherScheduleShiftLike {
  assignedUserId:
    string | null;
    isIntentionallyUnassigned?: boolean;
}

interface DriverSchedulePeriodLike {
  status:
    string;
}

interface DriverScheduleStatisticsLike {
  unassignedDays:
    number;

  warningCount:
    number;
}

interface MorningDriverSchedulePeriodLike {
  status:
    string;
}

interface MorningDriverScheduleStatisticsLike {
  unassignedAssignments:
    number;

  minimumUnfilled:
    number;

  recommendationUnfilled:
    number;
}

interface CreateDispatcherWorkflowStateRequest {
  availabilityPeriod:
    AvailabilityPeriodLike | null;

  schedulePeriod:
    DispatcherSchedulePeriodLike | null;

  shifts:
    DispatcherScheduleShiftLike[];
}

interface CreateDriverWorkflowStateRequest {
  availabilityPeriod:
    AvailabilityPeriodLike | null;

  schedulePeriod:
    DriverSchedulePeriodLike | null;

  statistics:
    DriverScheduleStatisticsLike | null;
}

interface CreateMorningDriverWorkflowStateRequest {
  availabilityPeriod:
    AvailabilityPeriodLike | null;

  schedulePeriod:
    MorningDriverSchedulePeriodLike | null;

  statistics:
    MorningDriverScheduleStatisticsLike | null;
}

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

export function createDispatcherWorkflowState({
  availabilityPeriod,
  schedulePeriod,
  shifts,
}: CreateDispatcherWorkflowStateRequest): PeriodWorkflowState {
  const scheduleStatus =
    normalizeScheduleStatus(
      schedulePeriod?.status,
    );

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

export function createDriverWorkflowState({
  availabilityPeriod,
  schedulePeriod,
  statistics,
}: CreateDriverWorkflowStateRequest): PeriodWorkflowState {
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

export function createMorningDriverWorkflowState({
  availabilityPeriod,
  schedulePeriod,
  statistics,
}: CreateMorningDriverWorkflowStateRequest): PeriodWorkflowState {
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