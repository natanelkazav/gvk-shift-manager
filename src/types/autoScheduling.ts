import type {
  AssignmentCandidateShift,
} from './assignmentCandidates';

export type SchedulingShiftCategory =
  | 'weekday'
  | 'friday'
  | 'saturday'
  | 'holiday_eve'
  | 'holiday_full'
  | 'holiday_end'
  | 'chol_hamoed'
  | 'other';

export interface SchedulingShift {
  id: string;

  date: string;
  weekdayNumber: number;
  weekdayName: string;

  startTime: string;
  endTime: string;

  startsAt: Date;
  endsAt: Date;

  endsNextDay: boolean;

  scheduleType:
    SchedulingShiftCategory;

  holidayName:
    string | null;

  isPremium: boolean;
  isNightShift: boolean;

  sortOrder: number;

  assignmentState:
    AssignmentCandidateShift['assignmentState'];

  availableUserIds:
    string[];

  soleAvailableUserId:
    string | null;
}

export interface SchedulingDispatcherCounters {
  totalShifts: number;

  weekdayEveningShifts: number;
  weekdayNightShifts: number;

  fridayMorningShifts: number;
  fridayAfternoonShifts: number;
  fridayNightShifts: number;

  saturdayMorningShifts: number;
  saturdayAfternoonShifts: number;
  saturdayNightShifts: number;

  premiumShifts: number;
  holidayShifts: number;
}

export interface SchedulingDispatcher {
  userId: string;
  displayName: string;
  scheduleName:
    string | null;

  counters:
    SchedulingDispatcherCounters;

  assignedShiftIds:
    string[];
}

export type SchedulingAssignmentSource =
  | 'automatic_single_candidate'
  | 'automatic_scoring'
  | 'manual';

export interface SchedulingAssignment {
  shiftId: string;
  userId: string;

  source:
    SchedulingAssignmentSource;

  score:
    number | null;

  reasons:
    string[];
}

export type SchedulingIssueType =
  | 'no_available_dispatcher'
  | 'single_candidate_conflict'
  | 'no_legal_candidate'
  | 'invalid_shift_time'
  | 'duplicate_shift';

export interface SchedulingIssue {
  shiftId: string;

  type:
    SchedulingIssueType;

  message: string;

  candidateUserIds:
    string[];
}

export interface SchedulingDispatcherSummary {
  userId: string;
  displayName: string;
  scheduleName:
    string | null;

  totalShifts: number;

  weekdayEveningShifts: number;
  weekdayNightShifts: number;

  fridayMorningShifts: number;
  fridayAfternoonShifts: number;
  fridayNightShifts: number;

  saturdayMorningShifts: number;
  saturdayAfternoonShifts: number;
  saturdayNightShifts: number;

  premiumShifts: number;
  holidayShifts: number;
}

export interface SchedulingDraft {
  assignments:
    SchedulingAssignment[];

  unassignedShiftIds:
    string[];

  issues:
    SchedulingIssue[];

  dispatcherSummaries:
    SchedulingDispatcherSummary[];
}

export interface CandidateEligibilityResult {
  isEligible: boolean;

  reasons:
    string[];
}

export interface CandidateScoreResult {
  userId: string;

  score: number;

  reasons:
    string[];
}