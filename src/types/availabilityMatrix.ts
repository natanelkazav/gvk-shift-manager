export type AvailabilityMatrixStatus =
  | 'available'
  | 'unavailable'
  | null;

export interface AvailabilityMatrixPeriod {
  id: string;
  year: number;
  month: number;
  title: string | null;
  status: string;
}

export interface AvailabilityMatrixDispatcher {
  userId: string;
  displayName: string;
  email: string;
  scheduleName: string | null;
  submissionStatus: string;
  availabilityStatus:
    AvailabilityMatrixStatus;
  note: string | null;
  updatedAt: string | null;
}

export interface AvailabilityMatrixShift {
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

  totalDispatchers: number;
  availableDispatchers: number;
  unavailableDispatchers: number;
  unansweredDispatchers: number;

  dispatchers:
    AvailabilityMatrixDispatcher[];
}

export interface AvailabilityPeriodMatrix {
  period:
    AvailabilityMatrixPeriod;

  shifts:
    AvailabilityMatrixShift[];
}

export interface AvailabilityPeriodMatrixState {
  data:
    AvailabilityPeriodMatrix | null;

  isLoading: boolean;

  error: string | null;
}