export interface ImportedDispatcherShift {
  date: string;

  startTime: string;

  endTime: string;

  dispatcherName: string;
}

export interface ImportedDriverDuty {
  date: string;

  driverName: string;

  note: string | null;
}

export type ScheduleImportPeriodType =
  | 'historical'
  | 'current'
  | 'future';

export interface ScheduleImportPreview {
  year: number;

  month: number;

  periodType:
    ScheduleImportPeriodType;

  dispatcherShifts:
    ImportedDispatcherShift[];

  driverDuties:
    ImportedDriverDuty[];

  skippedRows: number;

  warnings: string[];
}

export type ScheduleImportUserType =
  | 'dispatcher'
  | 'on_call';

export interface ScheduleImportUser {
  id: string;

  displayName: string;

  scheduleName:
    string | null;

  email: string;

  role:
    ScheduleImportUserType;

  isActive: boolean;
}

export interface ScheduleImportNameAlias {
  id: string;

  sourceName: string;

  normalizedSourceName: string;

  userId: string;

  userType:
    ScheduleImportUserType;
}

export interface ScheduleImportUsersData {
  dispatchers:
    ScheduleImportUser[];

  onCallDrivers:
    ScheduleImportUser[];

  aliases:
    ScheduleImportNameAlias[];
}

export interface SaveScheduleImportNameAliasRequest {
  sourceName: string;

  userId: string;

  userType:
    ScheduleImportUserType;
}

export interface SaveScheduleImportNameAliasResponse {
  id: string;

  sourceName: string;

  normalizedSourceName: string;

  userId: string;

  userType:
    ScheduleImportUserType;

  updatedAt: string;
}

export interface ScheduleImportResolvedName {
  sourceName: string;

  normalizedSourceName: string;

  userType:
    ScheduleImportUserType;

  matchedUserId:
    string | null;

  matchedUser:
    ScheduleImportUser | null;

  matchSource:
    | 'alias'
    | 'schedule_name'
    | 'display_name'
    | 'unmatched';
}
export type ScheduleImportStrategy =
  | 'missing_only'
  | 'replace'
  | 'rebuild'
  | 'historical_archive';

export interface ScheduleImportResolvedDispatcherShift {
  date: string;

  startTime: string;

  endTime: string;

  userId: string;
}

export interface ScheduleImportResolvedDriverDuty {
  date: string;

  userId: string;

  note: string | null;
}

export interface ScheduleImportPreviewPeriodState {
  exists: boolean;

  id: string | null;

  status: string | null;
}

export interface ScheduleImportPreviewCounts {
  detected: number;

  existing: number;

  toCreate: number;

  toUpdate: number;

  toSkip: number;

  toDelete: number;
}

export interface PreviewScheduleExcelImportRequest {
  year: number;

  month: number;

  periodType:
    ScheduleImportPeriodType;

  importStrategy:
    ScheduleImportStrategy;

  dispatcherShifts:
    ScheduleImportResolvedDispatcherShift[];

  driverDuties:
    ScheduleImportResolvedDriverDuty[];
}

export interface PreviewScheduleExcelImportResponse {
  year: number;

  month: number;

  periodType:
    ScheduleImportPeriodType;

  importStrategy:
    ScheduleImportStrategy;

  canImport: boolean;

  blockers: string[];

  warnings: string[];

  schedulePeriod:
    ScheduleImportPreviewPeriodState;

  driverSchedulePeriod:
    ScheduleImportPreviewPeriodState;

  dispatcherShifts:
    ScheduleImportPreviewCounts;

  driverDuties:
    ScheduleImportPreviewCounts;
}
export interface ExecuteScheduleExcelImportRequest
  extends PreviewScheduleExcelImportRequest {
  fileName: string;

  fileSizeBytes: number;

  warnings: string[];
}

export interface ScheduleImportExecutionCounts {
  detected: number;

  created: number;

  updated: number;

  skipped: number;

  deleted: number;
}

export type ScheduleImportExecutionStatus =
  | 'completed'
  | 'completed_with_warnings';

export interface ExecuteScheduleExcelImportResponse {
  importRunId: string;

  year: number;

  month: number;

  periodType:
    ScheduleImportPeriodType;

  importStrategy:
    ScheduleImportStrategy;

  status:
    ScheduleImportExecutionStatus;

  schedulePeriodId: string;

  driverSchedulePeriodId: string;

  dispatcherShifts:
    ScheduleImportExecutionCounts;

  driverDuties:
    ScheduleImportExecutionCounts;

  warningCount: number;

  completedAt: string;
}