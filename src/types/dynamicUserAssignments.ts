import type { DynamicMemberEmploymentScope } from './dynamicScheduling';

export interface DynamicUserAssignmentItem {
  jobTypeId: string;
  jobTypeName: string;
  jobTypeDescription: string | null;
  jobTypeEmploymentScope: 'full_time' | 'part_time' | 'flexible';
  isMember: boolean;
  isManager: boolean;
  employmentScope: DynamicMemberEmploymentScope | null;
  partTimeDefinition: Record<string, unknown>;
}

export interface DynamicUserAssignmentEditor {
  userId: string;
  assignments: DynamicUserAssignmentItem[];
}

export interface DynamicUserAssignmentSelection {
  jobTypeId: string;
  isMember: boolean;
  isManager: boolean;
  employmentScope: DynamicMemberEmploymentScope | null;
  partTimeDefinition?: Record<string, unknown>;
}
