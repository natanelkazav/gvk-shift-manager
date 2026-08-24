export type DriverAvailabilityPeriodStatus =
  | 'draft'
  | 'open'
  | 'closed'
  | 'archived';

export type DriverAvailabilitySubmissionStatus =
  | 'draft'
  | 'submitted'
  | 'reopened';

export type DriverAvailabilityStatus =
  | 'available'
  | 'unavailable';

export interface DriverAvailabilityPeriod {
  id: string;

  year: number;
  month: number;

  status:
    DriverAvailabilityPeriodStatus;

  title:
    string | null;

  instructions:
    string | null;

  submissionDeadline:
    string | null;

  openedAt:
    string | null;

  closedAt:
    string | null;

  createdBy:
    string | null;

  updatedBy:
    string | null;

  createdAt: string;
  updatedAt: string;
}

export interface DriverAvailabilityDay {
  id: string;

  periodId: string;

  availabilityDate: string;

  weekdayNumber: number;

  weekdayName: string;

  sortOrder: number;

  createdAt: string;

  holidayName?: string | null;
  holidayScheduleType?: string | null;
}

export interface DriverAvailabilityEntry {
  id: string;

  periodId: string;

  dayId: string;

  userId: string;

  availabilityStatus:
    DriverAvailabilityStatus;

  note:
    string | null;

  createdAt: string;

  updatedAt: string;
}

export interface DriverAvailabilitySubmission {
  id: string;

  periodId: string;

  userId: string;

  status:
    DriverAvailabilitySubmissionStatus;

  submittedAt:
    string | null;

  reopenedAt:
    string | null;

  lastSavedAt:
    string | null;

  availableCount: number;

  unavailableCount: number;

  createdAt: string;

  updatedAt: string;
}

export interface CreateDriverAvailabilityPeriodRequest {
  year: number;

  month: number;

  title:
    string | null;

  instructions:
    string | null;

  submissionDeadline:
    string | null;
}

export interface CreateDriverAvailabilityPeriodResponse {
  periodId: string;

  year: number;

  month: number;

  status:
    DriverAvailabilityPeriodStatus;

  title:
    string | null;

  submissionDeadline:
    string | null;

  createdDays: number;

  createdAt: string;
}

export interface DriverAvailabilityPeriodListItem
  extends DriverAvailabilityPeriod {
  daysCount: number;

  submissionsCount: number;

  submittedCount: number;
}

export interface DriverAvailabilityPersonalData {
  period:
    DriverAvailabilityPeriod | null;

  days:
    DriverAvailabilityDay[];

  entries:
    DriverAvailabilityEntry[];

  submission:
    DriverAvailabilitySubmission | null;
}

export interface SaveDriverAvailabilityEntryInput {
  dayId: string;

  availabilityStatus:
    DriverAvailabilityStatus;

  note:
    string | null;
}

export interface SaveDriverAvailabilityRequest {
  periodId: string;

  entries:
    SaveDriverAvailabilityEntryInput[];
}

export interface SaveDriverAvailabilityResponse {
  periodId: string;

  userId: string;

  availableCount: number;

  unavailableCount: number;

  unmarkedCount: number;

  savedEntries: number;

  savedAt: string;
}

export interface SubmitDriverAvailabilityResponse {
  periodId: string;

  userId: string;

  status: 'submitted';

  availableCount: number;

  unavailableCount: number;

  submittedAt: string;

  alreadySubmitted: boolean;
}

export interface OpenDriverAvailabilityPeriodResponse {
  periodId: string;

  year: number;

  month: number;

  status: 'open';

  openedAt: string;

  daysCount: number;

  alreadyOpen: boolean;
}
export interface DriverAvailabilityManagerDriver {
  id: string;

  displayName: string;

  scheduleName:
    string | null;

  email: string;

  role: string;

  isActive: boolean;
}

export interface DriverAvailabilityManagementStatistics {
  totalDrivers: number;

  submittedDrivers: number;

  draftDrivers: number;

  notStartedDrivers: number;
}

export interface DriverAvailabilityManagementData {
  period:
    DriverAvailabilityPeriod;

  days:
    DriverAvailabilityDay[];

  drivers:
    DriverAvailabilityManagerDriver[];

  submissions:
    DriverAvailabilitySubmission[];

  entries:
    DriverAvailabilityEntry[];

  statistics:
    DriverAvailabilityManagementStatistics;
}
export interface CloseDriverAvailabilityPeriodResponse {
  periodId: string;

  year: number;

  month: number;

  status: 'closed';

  closedAt: string;

  totalDrivers: number;

  submittedDrivers: number;

  missingDrivers: number;

  forced: boolean;

  alreadyClosed: boolean;
}
