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