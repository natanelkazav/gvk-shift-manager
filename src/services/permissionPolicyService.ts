import { supabase } from '../lib/supabase';
import type { PermissionKey } from '../types/auth';
import type {
  PermissionAdminCatalog,
  PermissionProfileDefinition,
  PermissionScopeMode,
  UserPermissionPolicy,
} from '../types/permissionPolicy';
import { ALL_PERMISSION_KEYS } from '../config/defaultRolePermissions';

const validPermissions = new Set<string>(ALL_PERMISSION_KEYS);

function asPermissionKeys(value: unknown): PermissionKey[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is PermissionKey =>
    typeof item === 'string' && validPermissions.has(item),
  );
}

function normalizeProfile(row: any): PermissionProfileDefinition {
  return {
    id: String(row?.id ?? ''),
    code: String(row?.code ?? ''),
    name: String(row?.name ?? ''),
    description: String(row?.description ?? ''),
    permissions: asPermissionKeys(row?.permissions),
    isSystem: Boolean(row?.isSystem ?? row?.is_system),
  };
}

async function getAdminCatalog(): Promise<PermissionAdminCatalog> {
  const { data, error } = await supabase.rpc('get_permission_admin_catalog');
  if (error) throw new Error(error.message || 'לא ניתן לטעון את קטלוג ההרשאות.');

  const payload = (data ?? {}) as any;
  return {
    profiles: Array.isArray(payload.profiles)
      ? payload.profiles.map(normalizeProfile)
      : [],
    jobTypes: Array.isArray(payload.jobTypes)
      ? payload.jobTypes.map((row: any) => ({
          id: String(row?.id ?? ''),
          name: String(row?.name ?? ''),
          code: String(row?.code ?? ''),
        }))
      : [],
  };
}

async function getUserPolicy(userId: string): Promise<UserPermissionPolicy> {
  const { data, error } = await supabase.rpc('get_user_permission_policy', {
    target_user_id: userId,
  });
  if (error) throw new Error(error.message || 'לא ניתן לטעון את מדיניות ההרשאות.');

  const payload = (data ?? {}) as any;
  const scopeMode: PermissionScopeMode = payload.scopeMode === 'selected' ? 'selected' : 'all';

  return {
    profileCode:
      typeof payload.profileCode === 'string' && payload.profileCode
        ? payload.profileCode
        : null,
    scopeMode,
    jobTypeIds: Array.isArray(payload.jobTypeIds)
      ? payload.jobTypeIds.filter((id: unknown): id is string => typeof id === 'string')
      : [],
  };
}

async function saveUserPolicy(
  userId: string,
  policy: UserPermissionPolicy,
): Promise<void> {
  const { error } = await supabase.rpc('save_user_permission_policy', {
    target_user_id: userId,
    requested_profile_code: policy.profileCode,
    requested_scope_mode: policy.scopeMode,
    requested_job_type_ids: policy.scopeMode === 'selected' ? policy.jobTypeIds : [],
  });
  if (error) throw new Error(error.message || 'לא ניתן לשמור את מדיניות ההרשאות.');
}

export const permissionPolicyService = {
  getAdminCatalog,
  getUserPolicy,
  saveUserPolicy,
};
