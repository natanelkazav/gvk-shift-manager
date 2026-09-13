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
