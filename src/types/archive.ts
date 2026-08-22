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