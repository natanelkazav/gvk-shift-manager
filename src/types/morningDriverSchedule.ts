export type MorningDriverSchedulePeriodStatus =
  | 'draft'
  | 'published'
  | 'archived';

export type MorningDriverScheduleAssignmentSource =
  | 'automatic'
  | 'manual'
  | 'swap'
  | 'import';

export interface MorningDriverSchedulePeriod {
  id: string;
  year: number;
  month: number;
  status: MorningDriverSchedulePeriodStatus;
  availabilityPeriodId: string;
  title: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MorningDriverScheduleDriver {
  id: string;
  displayName: string;
  scheduleName: string | null;
  email: string;
  isActive: boolean;
}

export interface MorningDriverScheduleAssignment {
  id: string;
  schedulePeriodId: string;
  availabilityShiftId: string;
  shiftDate: string;
  weekdayNumber: number;
  weekdayName: string;
  shiftType:
    | 'weekday_morning'
    | 'weekday_evening'
    | 'friday_morning';
  startTime: string;
  endTime: string;
  minimumWorkers: number;
  recommendedWorkers: number;
  assignmentSlot: number;
  assignedUserId: string | null;
  assignedUserName: string | null;
  assignmentSource:
    MorningDriverScheduleAssignmentSource | null;
  isLocked: boolean;
  isIntentionallyUnassigned: boolean;
  notes: string | null;
  updatedAt: string;
}

export interface MorningDriverScheduleStatistics {
  totalAssignments: number;
  assignedAssignments: number;
  unassignedAssignments: number;
  minimumUnfilled: number;
  recommendationUnfilled: number;
  intentionallyUnassignedMinimum: number;
}

export interface MorningDriverScheduleData {
  period: MorningDriverSchedulePeriod;
  drivers: MorningDriverScheduleDriver[];
  assignments: MorningDriverScheduleAssignment[];
  statistics: MorningDriverScheduleStatistics;
}

export interface CreateMorningDriverScheduleDraftResponse {
  schedulePeriodId: string;
  year: number;
  month: number;
  status: 'draft';
  createdAssignments: number;
  assignedAssignments: number;
  warningCount: number;
}

export interface UpdateMorningDriverScheduleAssignmentRequest {
  assignmentId: string;
  assignedUserId: string | null;
  isLocked: boolean;
  note: string | null;
}

export interface UpdateMorningDriverShiftTimeRequest {
  assignmentId: string;
  startTime: string;
  endTime: string;
}

export interface SetMorningDriverIntentionallyUnassignedRequest {
  assignmentId: string;
  isIntentionallyUnassigned: boolean;
}

export interface UpdateMorningDriverScheduleAssignmentResponse {
  assignmentId: string;
  schedulePeriodId: string;
  assignedUserId: string | null;
  assignedUserName: string | null;
  assignmentSource:
    MorningDriverScheduleAssignmentSource | null;
  isLocked: boolean;
  isIntentionallyUnassigned: boolean;
  notes: string | null;
  hasWarnings: boolean;
  warnings: string[];
}

export interface PublishMorningDriverScheduleResponse {
  schedulePeriodId: string;
  status: 'published';
  publishedAt: string | null;
  recommendationWarnings: number;
  alreadyPublished: boolean;
}

export interface TransferMyMorningDriverAssignmentRequest {
  assignmentId: string;

  newDriverId: string;
}

export interface TransferMyMorningDriverAssignmentResponse {
  assignmentId: string;

  schedulePeriodId: string;

  shiftDate: string;

  startTime: string;

  endTime: string;

  previousDriverId: string;

  previousDriverName: string;

  assignedUserId: string;

  assignedUserName: string;

  assignmentSource: 'swap';

  hasWarnings: boolean;

  warnings: string[];
}