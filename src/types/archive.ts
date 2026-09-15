export interface ArchivePeriod {
  year: number;

  month: number;

  dispatcherPeriodId: string | null;

  driverPeriodId: string | null;

  morningDriverPeriodId:
    string | null;

  dispatcherStatus: string | null;

  driverStatus: string | null;

  morningDriverStatus:
    string | null;

  dispatcherShiftCount: number;

  driverDutyCount: number;

  morningDriverAssignmentCount:
    number;

  dispatcherCount: number;

  driverCount: number;

  morningDriverCount: number;

  dispatcherPublishedAt: string | null;

  driverPublishedAt: string | null;

  dispatcherArchivedAt: string | null;

  driverArchivedAt: string | null;

  morningDriverArchivedAt:
    string | null;

  importRunId: string | null;

  importFileName: string | null;

  importedAt: string | null;

  importedBy: string | null;

  isFullyArchived: boolean;

  hasDispatcherSchedule: boolean;

  hasDriverSchedule: boolean;

  hasMorningDriverSchedule:
    boolean;
}

export interface ArchivePeriodsResponse {
  periods: ArchivePeriod[];

  count: number;

  generatedAt: string;
}

export interface DynamicArchiveJobType {
  publicationId: string;
  jobTypeId: string;
  jobTypeName: string;
  status: 'published' | 'archived';
  assignmentCount: number;
  workerCount: number;
  publishedAt: string | null;
  archivedAt: string | null;
}

export interface DynamicArchiveRun {
  id: string;
  status: 'sent';
  fileName: string | null;
  emailId: string | null;
  sentAt: string | null;
  attemptCount: number;
}

export interface DynamicArchivePeriod {
  year: number;
  month: number;
  isFullyArchived: boolean;
  archivedAt: string | null;
  archiveRun: DynamicArchiveRun | null;
  jobTypes: DynamicArchiveJobType[];
}

export interface DynamicArchivePeriodsResponse {
  periods: DynamicArchivePeriod[];
  generatedAt: string;
}

export interface UnifiedArchivePeriod extends ArchivePeriod {
  dynamicJobTypes: DynamicArchiveJobType[];
  dynamicArchivedAt: string | null;
  hasDynamicArchive: boolean;
  archiveRun: DynamicArchiveRun | null;
}
