import type {
  DynamicScheduleChangeMode,
  DynamicSchedulingStrategy,
  DynamicWorkStructureMode,
} from './dynamicScheduling';

export interface DynamicRuntimeUpcomingAssignment {
  publicationId: string;
  assignmentId: string;
  year: number;
  month: number;
  shiftDate: string;
  shiftCode: string;
  shiftName: string;
  startTime: string;
  endTime: string;
}

export interface DynamicRuntimeAvailabilityState {
  periodId: string;
  year: number;
  month: number;
  status: string;
  submissionDeadline: string | null;
  slotCount: number;
  filledCount: number;
  submissionStatus: string | null;
}

export interface DynamicRuntimeRole {
  jobTypeId: string;
  jobTypeName: string;
  description: string | null;
  isPrimary: boolean;
  workMode: DynamicWorkStructureMode;
  schedulingStrategy: DynamicSchedulingStrategy;
  scheduleChangeMode: DynamicScheduleChangeMode;
  availabilityEnabled: boolean;
  publishedAssignmentCount: number;
  nextAssignment: DynamicRuntimeUpcomingAssignment | null;
  availability: DynamicRuntimeAvailabilityState | null;
}

export interface DynamicRuntimeManagedRole {
  jobTypeId: string;
  jobTypeName: string;
  memberCount: number;
  currentPeriodStatus: string | null;
  publishedAssignmentCount: number;
}

export interface DynamicRuntimeContext {
  hasDynamicMemberships: boolean;
  primaryJobTypeName: string | null;
  roles: DynamicRuntimeRole[];
  canManageDynamicScheduling: boolean;
  managedRoles: DynamicRuntimeManagedRole[];
  generatedAt: string;
}
