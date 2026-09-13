export type DynamicPermissionAudience = 'member' | 'manager';

export interface DynamicPermissionDefinition {
  permissionKey: string;
  featureKey: string;
  audience: DynamicPermissionAudience;
  label: string;
  description: string;
  enabled: boolean;
  defaultEnabled: boolean;
}

export interface DynamicJobTypePermissionManager {
  userId: string;
  displayName: string;
  email: string;
  isActive: boolean;
  isManager: boolean;
}

export interface DynamicJobTypePermissionEditor {
  jobTypeId: string;
  jobTypeName: string;
  activeFeatures: string[];
  memberPermissions: DynamicPermissionDefinition[];
  managerPermissions: DynamicPermissionDefinition[];
  managers: DynamicJobTypePermissionManager[];
}

export interface DynamicUserPermissionRoleSummary {
  jobTypeId: string;
  jobTypeName: string;
  relationship: 'member' | 'manager';
  permissions: Array<{
    permissionKey: string;
    label: string;
    featureKey: string;
  }>;
}

export interface DynamicUserPermissionSummary {
  roles: DynamicUserPermissionRoleSummary[];
}

export interface DynamicUserJobTypePermission extends DynamicPermissionDefinition {
  inheritedEnabled: boolean;
  hasOverride: boolean;
  defaultSource: 'system_admin' | 'job_type_manager' | 'job_type_member' | 'none';
}

export interface DynamicUserJobTypePermissionGroup {
  jobTypeId: string;
  jobTypeName: string;
  isMember: boolean;
  isManager: boolean;
  activeFeatures: string[];
  permissions: DynamicUserJobTypePermission[];
}

export interface DynamicUserJobTypePermissionEditor {
  role?: string;
  jobTypes: DynamicUserJobTypePermissionGroup[];
}

export interface DynamicUserJobTypePermissionSelection {
  jobTypeId: string;
  permissionKey: string;
  enabled: boolean;
}
