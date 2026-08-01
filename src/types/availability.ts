export type AvailabilityPeriodStatus =
  | 'draft'
  | 'open'
  | 'closed'
  | 'archived';

export interface AvailabilityPeriod {
  id: string;
  year: number;
  month: number;
  status: AvailabilityPeriodStatus;
  title: string | null;
  instructions: string | null;
  submissionDeadline: string | null;
  openedAt: string | null;
  closedAt: string | null;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAvailabilityPeriodInput {
  year: number;
  month: number;
  submissionDeadline: string | null;
  title: string | null;
  instructions: string | null;
}

export interface CreateAvailabilityPeriodResult {
  periodId: string;
  createdSlots: number;
  periodStatus: AvailabilityPeriodStatus;
}
export type SpecialDayScheduleType =
  | 'holiday_eve'
  | 'holiday_full'
  | 'holiday_end'
  | 'chol_hamoed';

export interface ImportedSpecialDay {
  date: string;
  name: string;
  scheduleType:
    SpecialDayScheduleType;
  holidayGroup: string | null;
}

export interface ImportSpecialDaysResult {
  success: boolean;
  year: number;
  fetchedEvents: number;
  importedEvents: number;
  skippedEvents: number;
  importedDays:
    ImportedSpecialDay[];
}
export interface RebuildAvailabilityPeriodResult {
  periodId: string;
  createdSlots: number;
}
export interface OpenAvailabilityPeriodResult {
  periodId: string;
  periodStatus: 'open';
  openedAt: string;
  shiftSlotsCount: number;
}
export interface CloseAvailabilityPeriodResult {
  periodId: string;
  periodStatus: 'closed';
  closedAt: string;
  totalDispatchers: number;
  submittedDispatchers: number;
}