import type { PermissionKey } from './auth';

export type PermissionScopeMode = 'all' | 'selected';

export interface PermissionProfileDefinition {
  id: string;
  code: string;
  name: string;
  description: string;
  permissions: PermissionKey[];
  isSystem: boolean;
}

export interface PermissionJobTypeOption {
  id: string;
  name: string;
  code: string;
}

export interface PermissionAdminCatalog {
  profiles: PermissionProfileDefinition[];
  jobTypes: PermissionJobTypeOption[];
}

export interface UserPermissionPolicy {
  profileCode: string | null;
  scopeMode: PermissionScopeMode;
  jobTypeIds: string[];
}
