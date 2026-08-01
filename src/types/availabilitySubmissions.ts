export type AvailabilityTrackingStatus =
  | 'submitted'
  | 'draft'
  | 'not_started';

export interface AvailabilitySubmissionTrackingPeriod {
  id: string;
  year: number;
  month: number;
  title: string | null;
  status: string;
  submissionDeadline: string | null;
}

export interface AvailabilitySubmissionTrackingSummary {
  totalDispatchers: number;
  submittedDispatchers: number;
  draftDispatchers: number;
  notStartedDispatchers: number;
}

export interface AvailabilitySubmissionTrackingDispatcher {
  userId: string;
  displayName: string;
  email: string;
  scheduleName: string | null;

  status: AvailabilityTrackingStatus;

  submittedAt: string | null;
  lastSavedAt: string | null;

  availableCount: number;
  unavailableCount: number;
  answeredCount: number;
  unansweredCount: number;
  totalShiftCount: number;
  completionPercentage: number;
}

export interface AvailabilityPeriodSubmissionsTracking {
  period: AvailabilitySubmissionTrackingPeriod;

  summary: AvailabilitySubmissionTrackingSummary;

  dispatchers:
    AvailabilitySubmissionTrackingDispatcher[];
}

export interface AvailabilityPeriodSubmissionsState {
  data:
    AvailabilityPeriodSubmissionsTracking | null;

  isLoading: boolean;

  error: string | null;
}