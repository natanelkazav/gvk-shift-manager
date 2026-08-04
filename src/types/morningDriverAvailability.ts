export type MorningDriverAvailabilityPeriodStatus =
  | 'draft'
  | 'open'
  | 'closed'
  | 'archived';

export type MorningDriverShiftType =
  | 'weekday_morning'
  | 'weekday_evening'
  | 'friday_morning';

export interface MorningDriverAvailabilityPeriodListItem {
  id: string;

  year: number;

  month: number;

  status:
    MorningDriverAvailabilityPeriodStatus;

  title:
    string | null;

  instructions:
    string | null;

  submissionDeadline:
    string;

  openedAt:
    string | null;

  closedAt:
    string | null;

  createdAt:
    string;

  shiftsCount:
    number;

  submissionsCount:
    number;

  submittedCount:
    number;
}

export interface CreateMorningDriverAvailabilityPeriodRequest {
  year: number;

  month: number;

  title:
    string | null;

  instructions:
    string | null;

  submissionDeadline:
    string | null;
}

export interface CreateMorningDriverAvailabilityPeriodResponse {
  periodId: string;

  year: number;

  month: number;

  status: 'draft';

  title:
    string | null;

  instructions:
    string | null;

  submissionDeadline:
    string;

  createdShifts:
    number;
}

export interface OpenMorningDriverAvailabilityPeriodResponse {
  periodId: string;

  year: number;

  month: number;

  status: 'open';

  openedAt: string;

  createdSubmissions:
    number;
}

export interface DeleteMorningDriverAvailabilityPeriodResponse {
  deletedPeriodId: string;

  year: number;

  month: number;

  deletedShifts:
    number;

  deletedSubmissions:
    number;

  deletedEntries:
    number;
}

export type MorningDriverAvailabilitySubmissionStatus =
  | 'draft'
  | 'submitted'
  | 'reopened';

export type MorningDriverAvailabilityStatus =
  | 'available'
  | 'unavailable';

export interface MorningDriverAvailabilityPersonalPeriod {
  id: string;
  year: number;
  month: number;
  status: MorningDriverAvailabilityPeriodStatus;
  title: string | null;
  instructions: string | null;
  submissionDeadline: string;
  openedAt: string | null;
  closedAt: string | null;
  createdAt: string;
}

export interface MorningDriverAvailabilitySubmission {
  id: string;
  periodId: string;
  userId: string;
  status: MorningDriverAvailabilitySubmissionStatus;
  submittedAt: string | null;
  lastSavedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MorningDriverAvailabilityShift {
  id: string;
  periodId: string;
  shiftDate: string;
  weekdayNumber: number;
  weekdayName: string;
  shiftType: MorningDriverShiftType;
  startTime: string;
  endTime: string;
  minimumWorkers: number;
  recommendedWorkers: number;
  sortOrder: number;
  availabilityStatus: MorningDriverAvailabilityStatus | null;
  note: string | null;
}

export interface MorningDriverAvailabilityPersonalData {
  period: MorningDriverAvailabilityPersonalPeriod;
  submission: MorningDriverAvailabilitySubmission;
  shifts: MorningDriverAvailabilityShift[];
}

export interface SaveMorningDriverAvailabilityEntryInput {
  shiftId: string;
  availabilityStatus: MorningDriverAvailabilityStatus;
  note: string | null;
}

export interface SaveMorningDriverAvailabilityRequest {
  periodId: string;
  entries: SaveMorningDriverAvailabilityEntryInput[];
}

export interface SaveMorningDriverAvailabilityResponse {
  periodId: string;
  userId: string;
  availableCount: number;
  unavailableCount: number;
  unmarkedCount: number;
  savedEntries: number;
  savedAt: string;
}

export interface SubmitMorningDriverAvailabilityResponse {
  periodId: string;
  userId: string;
  status: 'submitted';
  availableCount: number;
  unavailableCount: number;
  submittedAt: string;
  alreadySubmitted: boolean;
}

export interface MorningDriverAvailabilityManagerDriver {
  id: string;
  displayName: string;
  scheduleName:
    string | null;
  email: string;
  isActive: boolean;
}

export interface MorningDriverAvailabilityManagementSubmission
  extends MorningDriverAvailabilitySubmission {
  availableCount: number;
  unavailableCount: number;
  unmarkedCount: number;
}

export interface MorningDriverAvailabilityManagementEntry {
  id: string;
  periodId: string;
  shiftId: string;
  userId: string;
  availabilityStatus:
    MorningDriverAvailabilityStatus;
  note:
    string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MorningDriverAvailabilityManagementStatistics {
  totalDrivers: number;
  submittedDrivers: number;
  draftDrivers: number;
  reopenedDrivers: number;
  notStartedDrivers: number;
}

export interface MorningDriverAvailabilityManagementData {
  period:
    MorningDriverAvailabilityPersonalPeriod;
  drivers:
    MorningDriverAvailabilityManagerDriver[];
  submissions:
    MorningDriverAvailabilityManagementSubmission[];
  shifts:
    MorningDriverAvailabilityShift[];
  entries:
    MorningDriverAvailabilityManagementEntry[];
  statistics:
    MorningDriverAvailabilityManagementStatistics;
}

export interface ReopenMorningDriverAvailabilitySubmissionResponse {
  periodId: string;
  userId: string;
  submissionId: string;
  status: 'reopened';
  reopenedAt: string;
}

export interface CloseMorningDriverAvailabilityPeriodResponse {
  periodId: string;
  year: number;
  month: number;
  status: 'closed';
  closedAt:
    string | null;
  totalDrivers: number;
  submittedDrivers: number;
  missingDrivers: number;
  forced: boolean;
  alreadyClosed: boolean;
}
