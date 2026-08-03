export interface ArchivePeriod {
  year: number;

  month: number;

  dispatcherPeriodId: string | null;

  driverPeriodId: string | null;

  dispatcherStatus: string | null;

  driverStatus: string | null;

  dispatcherShiftCount: number;

  driverDutyCount: number;

  dispatcherCount: number;

  driverCount: number;

  dispatcherPublishedAt: string | null;

  driverPublishedAt: string | null;

  dispatcherArchivedAt: string | null;

  driverArchivedAt: string | null;

  importRunId: string | null;

  importFileName: string | null;

  importedAt: string | null;

  importedBy: string | null;

  isFullyArchived: boolean;

  hasDispatcherSchedule: boolean;

  hasDriverSchedule: boolean;
}

export interface ArchivePeriodsResponse {
  periods: ArchivePeriod[];

  count: number;

  generatedAt: string;
}