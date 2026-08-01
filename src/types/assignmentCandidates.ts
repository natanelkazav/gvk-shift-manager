export type AssignmentCandidateState =
  | 'no_available'
  | 'single_available'
  | 'multiple_available';

export interface AssignmentCandidatesPeriod {
  id: string;
  year: number;
  month: number;
  title: string | null;
  status: 'closed';
}

export interface AssignmentCandidateShift {
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

  assignmentState:
    AssignmentCandidateState;

  soleAvailableUserId: string | null;
  soleAvailableDisplayName:
    string | null;
  soleAvailableScheduleName:
    string | null;

  availableUserIds: string[];
  availableDisplayNames: string[];
  availableScheduleNames:
    (string | null)[];
}

export interface AssignmentCandidatesData {
  period:
    AssignmentCandidatesPeriod;

  shifts:
    AssignmentCandidateShift[];
}

export interface AssignmentCandidatesState {
  data:
    AssignmentCandidatesData | null;

  isLoading: boolean;

  error: string | null;
}