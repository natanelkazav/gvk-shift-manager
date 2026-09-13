import { supabase } from '../lib/supabase';
import type {
  DynamicJobTypePermissionEditor,
  DynamicUserJobTypePermissionEditor,
  DynamicUserJobTypePermissionSelection,
  DynamicUserPermissionSummary,
} from '../types/dynamicPermissionEngine';

const normalizeEditor = (data: unknown): DynamicJobTypePermissionEditor => {
  const value = (data ?? {}) as Partial<DynamicJobTypePermissionEditor>;
  return {
    jobTypeId: String(value.jobTypeId ?? ''),
    jobTypeName: String(value.jobTypeName ?? ''),
    activeFeatures: Array.isArray(value.activeFeatures) ? value.activeFeatures : [],
    memberPermissions: Array.isArray(value.memberPermissions) ? value.memberPermissions : [],
    managerPermissions: Array.isArray(value.managerPermissions) ? value.managerPermissions : [],
    managers: Array.isArray(value.managers) ? value.managers : [],
  };
};

const normalizeUserEditor = (data: unknown): DynamicUserJobTypePermissionEditor => {
  const value = (data ?? {}) as Partial<DynamicUserJobTypePermissionEditor>;
  return {
    role: typeof value.role === 'string' ? value.role : undefined,
    jobTypes: Array.isArray(value.jobTypes) ? value.jobTypes : [],
  };
};

export const dynamicPermissionEngineService = {
  async getJobTypeEditor(jobTypeId: string): Promise<DynamicJobTypePermissionEditor> {
    const { data, error } = await supabase.rpc('get_dynamic_job_type_permission_editor', {
      requested_job_type_id: jobTypeId,
    });
    if (error) throw new Error(error.message || 'לא ניתן לטעון את הרשאות התפקיד.');
    return normalizeEditor(data);
  },

  async saveJobTypePolicy(
    jobTypeId: string,
    memberPermissionKeys: string[],
    managerPermissionKeys: string[],
  ): Promise<void> {
    const { error } = await supabase.rpc('save_dynamic_job_type_permission_policy', {
      requested_job_type_id: jobTypeId,
      requested_member_permission_keys: memberPermissionKeys,
      requested_manager_permission_keys: managerPermissionKeys,
    });
    if (error) throw new Error(error.message || 'לא ניתן לשמור את הרשאות התפקיד.');
  },

  async setJobTypeManager(jobTypeId: string, userId: string, isManager: boolean): Promise<void> {
    const { error } = await supabase.rpc('set_dynamic_job_type_manager', {
      requested_job_type_id: jobTypeId,
      requested_user_id: userId,
      requested_is_manager: isManager,
    });
    if (error) throw new Error(error.message || 'לא ניתן לשמור מנהל לתפקיד.');
  },

  async getUserSummary(userId: string): Promise<DynamicUserPermissionSummary> {
    const { data, error } = await supabase.rpc('get_user_dynamic_permission_summary', {
      target_user_id: userId,
    });
    if (error) throw new Error(error.message || 'לא ניתן לטעון הרשאות דינמיות של המשתמש.');
    const value = (data ?? {}) as Partial<DynamicUserPermissionSummary>;
    return { roles: Array.isArray(value.roles) ? value.roles : [] };
  },

  async getUserJobTypePermissionEditor(userId: string): Promise<DynamicUserJobTypePermissionEditor> {
    const { data, error } = await supabase.rpc('get_user_dynamic_job_type_permission_editor', {
      target_user_id: userId,
    });
    if (error) throw new Error(error.message || 'לא ניתן לטעון הרשאות תפקיד דינמיות של המשתמש.');
    return normalizeUserEditor(data);
  },

  async saveUserJobTypePermissions(
    userId: string,
    permissions: DynamicUserJobTypePermissionSelection[],
  ): Promise<void> {
    const { error } = await supabase.rpc('save_user_dynamic_job_type_permissions', {
      target_user_id: userId,
      requested_permissions: permissions,
    });
    if (error) throw new Error(error.message || 'לא ניתן לשמור הרשאות תפקיד דינמיות.');
  },
};
