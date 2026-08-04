export type DriverSchedulePeriodStatus =
  | 'draft'
  | 'published'
  | 'archived';

export type DriverAssignmentSource =
  | 'automatic'
  | 'manual'
  | 'swap'
  | 'import';

export interface DriverScheduleDraftAssignment {
  scheduleDayId: string;

  dutyDate: string;

  weekdayNumber: number;

  weekdayName: string;

  originalUserId:
    string | null;

  assignedUserId:
    string | null;

  assignmentSource:
    DriverAssignmentSource | null;

  isAssigned: boolean;

  notes:
    string | null;

  spacingWarning: boolean;
}

export interface CreateDriverScheduleDraftResponse {
  schedulePeriodId: string;

  availabilityPeriodId: string;

  year: number;

  month: number;

  status:
    DriverSchedulePeriodStatus;

  activeDrivers: number;

  createdDays: number;

  assignedDays: number;

  unassignedDays: number;

  warningCount: number;

  hasWarnings: boolean;

  createdAt: string;

  assignments:
    DriverScheduleDraftAssignment[];
}

export interface DriverSchedulePeriod {
  id: string;

  year: number;

  month: number;

  status:
    DriverSchedulePeriodStatus;

  availabilityPeriodId:
    string | null;

  title:
    string | null;

  publishedAt:
    string | null;

  archivedAt:
    string | null;

  createdBy:
    string | null;

  updatedBy:
    string | null;

  createdAt: string;

  updatedAt: string;
}

export interface DriverScheduleDay {
  id: string;

  periodId: string;

  dutyDate: string;

  weekdayNumber: number;

  weekdayName: string;

  originalUserId:
    string | null;

  originalUserName:
    string | null;

  assignedUserId:
    string | null;

  assignedUserName:
    string | null;

  assignmentSource:
    DriverAssignmentSource | null;

  isLocked: boolean;

  notes:
    string | null;

  spacingWarning: boolean;

  createdAt: string;

  updatedAt: string;
}

export interface DriverScheduleDriver {
  id: string;

  displayName: string;

  scheduleName:
    string | null;

  email: string;

  isActive: boolean;
}

export interface DriverScheduleStatistics {
  totalDays: number;

  assignedDays: number;

  unassignedDays: number;

  warningCount: number;
}

export interface DriverScheduleData {
  period:
    DriverSchedulePeriod | null;

  days:
    DriverScheduleDay[];

  drivers:
    DriverScheduleDriver[];

  statistics:
    DriverScheduleStatistics;
}

export interface GetDriverScheduleRequest {
  schedulePeriodId?:
    string | null;

  year?:
    number | null;

  month?:
    number | null;
}
export interface UpdateDriverScheduleDayRequest {
  scheduleDayId: string;

  assignedUserId:
    string | null;

  isLocked: boolean;

  note:
    string | null;
}

export interface UpdateDriverScheduleDayResponse {
  scheduleDayId: string;

  periodId: string;

  dutyDate: string;

  assignedUserId:
    string | null;

  assignedUserName:
    string | null;

  assignmentSource:
    DriverAssignmentSource | null;

  isLocked: boolean;

  notes:
    string | null;

  hasWarnings: boolean;

  warnings:
    string[];
}
export interface PublishDriverScheduleResponse {
  schedulePeriodId: string;

  year: number;

  month: number;

  status: 'published';

  totalDays: number;

  assignedDays: number;

  unassignedDays: number;

  publishedAt: string;

  alreadyPublished: boolean;
}

export interface TransferMyDriverDutyRequest {
  scheduleDayId: string;

  newDriverId: string;
}

export interface TransferMyDriverDutyResponse {
  scheduleDayId: string;

  periodId: string;

  dutyDate: string;

  previousDriverId: string;

  previousDriverName: string;

  assignedUserId: string;

  assignedUserName: string;

  assignmentSource: 'swap';

  hasWarnings: boolean;

  warnings: string[];
}