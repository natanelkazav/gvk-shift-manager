export type DispatcherAvailabilityStatus =
  | 'available'
  | 'unavailable';

export type AvailabilitySubmissionStatus =
  | 'draft'
  | 'submitted'
  | 'reopened';

export interface DispatcherAvailabilityPeriod {
  id: string;
  year: number;
  month: number;
  title: string | null;
  instructions: string | null;
  submissionDeadline: string | null;
  status: 'open';
}

export interface DispatcherAvailabilitySubmission {
  status: AvailabilitySubmissionStatus;
  submittedAt: string | null;
  lastSavedAt: string | null;
  availableCount: number;
  unavailableCount: number;
}

export interface DispatcherAvailabilityShift {
  id: string;
  date: string;
  weekdayNumber: number;
  weekdayName: string;
  startTime: string;
  endTime: string;
  endsNextDay: boolean;
  scheduleType: string;
  holidayName: string | null;
  isPremium: boolean;
  sortOrder: number;

  availabilityStatus:
    DispatcherAvailabilityStatus | null;

  note: string | null;

  availabilityUpdatedAt:
    string | null;
}

export interface MyOpenAvailability {
  period:
    DispatcherAvailabilityPeriod;

  submission:
    DispatcherAvailabilitySubmission;

  shifts:
    DispatcherAvailabilityShift[];
}

export interface DispatcherAvailabilityState {
  data: MyOpenAvailability | null;
  isLoading: boolean;
  error: string | null;
}
export interface SaveShiftAvailabilityInput {
  shiftSlotId: string;
  status: DispatcherAvailabilityStatus;
  note: string | null;
}

export interface SaveShiftAvailabilityResult {
  shiftSlotId: string;
  availabilityStatus:
    DispatcherAvailabilityStatus;
  availabilityNote: string | null;
  availabilityUpdatedAt: string;
  availableCount: number;
  unavailableCount: number;
  answeredCount: number;
  totalShiftCount: number;
}
export interface SubmitAvailabilityResult {
  periodId: string;
  submissionStatus: 'submitted';
  submittedAt: string;
  availableCount: number;
  unavailableCount: number;
  answeredCount: number;
  totalShiftCount: number;
}