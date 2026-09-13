import type { DynamicJobType, DynamicPeriodWorkflowState } from './dynamicScheduling';

export interface DynamicShiftsWorkspaceRole {
  jobType: DynamicJobType;
  workflow: DynamicPeriodWorkflowState;
  isExplicitManager: boolean;
  accessSource: 'system_admin' | 'job_type_manager' | 'transition_manager';
}

export interface DynamicShiftsManagementWorkspace {
  year: number;
  month: number;
  roles: DynamicShiftsWorkspaceRole[];
  generatedAt: string;
}

export interface DynamicScheduleCalendarJobType {
  id: string;
  name: string;
}

export interface DynamicScheduleCalendarAssignment {
  userId: string;
  displayName: string;
}

export interface DynamicScheduleCalendarSlot {
  periodSource: 'publication' | 'history';
  sourcePeriodId: string;
  sourceSlotId: string | null;
  jobTypeId: string;
  jobTypeName: string;
  shiftDate: string;
  shiftCode: string;
  shiftName: string;
  startTime: string;
  endTime: string;
  holidayName: string | null;
  contains200Percent: boolean;
  premium200Hours: number;
  assignments: DynamicScheduleCalendarAssignment[];
  unassignedCount: number;
  requiredCount: number;
}

export interface DynamicScheduleCalendarWorkspace {
  year: number;
  month: number;
  generatedAt: string;
  jobTypes: DynamicScheduleCalendarJobType[];
  slots: DynamicScheduleCalendarSlot[];
}
