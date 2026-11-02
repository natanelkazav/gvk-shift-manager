/**
 * קובץ: src/services/dynamicPermissionEngineService.ts
 * מטרה: טעינה ושמירה של הרשאות דינמיות ותצוגות עריכה לפי יכולות סוג התפקיד.
 * מטרות עיקריות:
 * - קריאות RPC המופעלות בקובץ: get_dynamic_job_type_permission_editor, get_dynamic_dashboard_context_policy, save_dynamic_dashboard_context_policy, save_dynamic_job_type_permission_policy, set_dynamic_job_type_manager, get_user_dynamic_permission_summary, get_user_dynamic_job_type_permission_editor, save_user_dynamic_job_type_permissions.
 * - ריכוז הפנייה למקור הנתונים ועיבוד התשובה בהתאם לפונקציות להלן.
 */
import { supabase } from '../lib/supabase';
import type {
  DynamicDashboardContextPolicy,
  DynamicJobTypePermissionEditor,
  DynamicUserJobTypePermissionEditor,
  DynamicUserJobTypePermissionSelection,
  DynamicUserPermissionSummary,
} from '../types/dynamicPermissionEngine';

/**
 * פעולה normalizeEditor: נרמול הנתון normalizeEditor בהקשר הפעולה.
 * @param data — נתונים.
 * @returns DynamicJobTypePermissionEditor — הפלט בהתאם לחתימה.
 */
const normalizeEditor = (data: unknown): DynamicJobTypePermissionEditor => {
  // value — ערך.
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


/**
 * פעולה normalizeDashboardContextPolicy: נרמול לוח בקרה / מדיניות.
 * @param data — נתונים.
 * @returns DynamicDashboardContextPolicy — הפלט בהתאם לחתימה.
 */
const normalizeDashboardContextPolicy = (data: unknown): DynamicDashboardContextPolicy => {
  // value — ערך.
  const value = (data ?? {}) as Partial<DynamicDashboardContextPolicy>;
  return {
    jobTypeId: String(value.jobTypeId ?? ''),
    jobTypeName: String(value.jobTypeName ?? ''),
    targetJobTypeIds: Array.isArray(value.targetJobTypeIds)
      ? value.targetJobTypeIds.filter((item): item is string => typeof item === 'string')
      : [],
  };
};

/**
 * פעולה normalizeUserEditor: נרמול משתמש.
 * @param data — נתונים.
 * @returns DynamicUserJobTypePermissionEditor — הפלט בהתאם לחתימה.
 */
const normalizeUserEditor = (data: unknown): DynamicUserJobTypePermissionEditor => {
  // value — ערך.
  const value = (data ?? {}) as Partial<DynamicUserJobTypePermissionEditor>;
  return {
    role: typeof value.role === 'string' ? value.role : undefined,
    jobTypes: Array.isArray(value.jobTypes) ? value.jobTypes : [],
  };
};

// dynamicPermissionEngineService — דינמי / הרשאות / שירות.
export const dynamicPermissionEngineService = {
  /**
   * פעולה אסינכרונית getJobTypeEditor: שליפה או חישוב של סוג תפקיד.
   * הפעולה פונה ל־RPC: get_dynamic_job_type_permission_editor.
   * @param jobTypeId — מזהה סוג התפקיד.
   * @returns Promise<DynamicJobTypePermissionEditor> — הפלט בהתאם לחתימה.
   */
  async getJobTypeEditor(jobTypeId: string): Promise<DynamicJobTypePermissionEditor> {
    // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
    const { data, error } = await supabase.rpc('get_dynamic_job_type_permission_editor', {
      requested_job_type_id: jobTypeId,
    });
    if (error) throw new Error(error.message || 'לא ניתן לטעון את הרשאות התפקיד.');
    return normalizeEditor(data);
  },

  /**
   * פעולה אסינכרונית getDashboardContextPolicy: שליפה או חישוב של לוח בקרה / מדיניות.
   * הפעולה פונה ל־RPC: get_dynamic_dashboard_context_policy.
   * @param jobTypeId — מזהה סוג התפקיד.
   * @returns Promise<DynamicDashboardContextPolicy> — הפלט בהתאם לחתימה.
   */
  async getDashboardContextPolicy(jobTypeId: string): Promise<DynamicDashboardContextPolicy> {
    // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
    const { data, error } = await supabase.rpc('get_dynamic_dashboard_context_policy', {
      requested_job_type_id: jobTypeId,
    });
    if (error) throw new Error(error.message || 'לא ניתן לטעון את הגדרות המידע הנוסף בלוח הבקרה.');
    return normalizeDashboardContextPolicy(data);
  },

  /**
   * פעולה אסינכרונית saveDashboardContextPolicy: שמירת לוח בקרה / מדיניות.
   * הפעולה פונה ל־RPC: save_dynamic_dashboard_context_policy.
   * @param jobTypeId — מזהה סוג התפקיד.
   * @param targetJobTypeIds — מזהה סוג התפקיד היעד.
   * @returns Promise<void> — הפלט בהתאם לחתימה.
   */
  async saveDashboardContextPolicy(jobTypeId: string, targetJobTypeIds: string[]): Promise<void> {
    // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
    const { error } = await supabase.rpc('save_dynamic_dashboard_context_policy', {
      requested_job_type_id: jobTypeId,
      requested_target_job_type_ids: targetJobTypeIds,
    });
    if (error) throw new Error(error.message || 'לא ניתן לשמור את הגדרות המידע הנוסף בלוח הבקרה.');
  },

  /**
   * פעולה אסינכרונית saveJobTypePolicy: שמירת סוג תפקיד.
   * הפעולה פונה ל־RPC: save_dynamic_job_type_permission_policy.
   * @param jobTypeId — מזהה סוג התפקיד.
   * @param memberPermissionKeys — מפתחות ההרשאות.
   * @param managerPermissionKeys — מפתחות ההרשאות.
   * @returns Promise<void> — הפלט בהתאם לחתימה.
   */
  async saveJobTypePolicy(
    jobTypeId: string,
    memberPermissionKeys: string[],
    managerPermissionKeys: string[],
  ): Promise<void> {
    // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
    const { error } = await supabase.rpc('save_dynamic_job_type_permission_policy', {
      requested_job_type_id: jobTypeId,
      requested_member_permission_keys: memberPermissionKeys,
      requested_manager_permission_keys: managerPermissionKeys,
    });
    if (error) throw new Error(error.message || 'לא ניתן לשמור את הרשאות התפקיד.');
  },

  /**
   * פעולה אסינכרונית setJobTypeManager: קביעת סוג תפקיד.
   * הפעולה פונה ל־RPC: set_dynamic_job_type_manager.
   * @param jobTypeId — מזהה סוג התפקיד.
   * @param userId — מזהה משתמש.
   * @param isManager — הנתון isManager בהקשר הפעולה.
   * @returns Promise<void> — הפלט בהתאם לחתימה.
   */
  async setJobTypeManager(jobTypeId: string, userId: string, isManager: boolean): Promise<void> {
    // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
    const { error } = await supabase.rpc('set_dynamic_job_type_manager', {
      requested_job_type_id: jobTypeId,
      requested_user_id: userId,
      requested_is_manager: isManager,
    });
    if (error) throw new Error(error.message || 'לא ניתן לשמור מנהל לתפקיד.');
  },

  /**
   * פעולה אסינכרונית getUserSummary: שליפה או חישוב של משתמש / סיכום.
   * הפעולה פונה ל־RPC: get_user_dynamic_permission_summary.
   * @param userId — מזהה משתמש.
   * @returns Promise<DynamicUserPermissionSummary> — הפלט בהתאם לחתימה.
   */
  async getUserSummary(userId: string): Promise<DynamicUserPermissionSummary> {
    // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
    const { data, error } = await supabase.rpc('get_user_dynamic_permission_summary', {
      target_user_id: userId,
    });
    if (error) throw new Error(error.message || 'לא ניתן לטעון הרשאות דינמיות של המשתמש.');
    // value — ערך.
    const value = (data ?? {}) as Partial<DynamicUserPermissionSummary>;
    return { roles: Array.isArray(value.roles) ? value.roles : [] };
  },

  /**
   * פעולה אסינכרונית getUserJobTypePermissionEditor: שליפה או חישוב של סוג תפקיד.
   * הפעולה פונה ל־RPC: get_user_dynamic_job_type_permission_editor.
   * @param userId — מזהה משתמש.
   * @returns Promise<DynamicUserJobTypePermissionEditor> — הפלט בהתאם לחתימה.
   */
  async getUserJobTypePermissionEditor(userId: string): Promise<DynamicUserJobTypePermissionEditor> {
    // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
    const { data, error } = await supabase.rpc('get_user_dynamic_job_type_permission_editor', {
      target_user_id: userId,
    });
    if (error) throw new Error(error.message || 'לא ניתן לטעון הרשאות תפקיד דינמיות של המשתמש.');
    return normalizeUserEditor(data);
  },

  /**
   * פעולה אסינכרונית saveUserJobTypePermissions: שמירת סוג תפקיד.
   * הפעולה פונה ל־RPC: save_user_dynamic_job_type_permissions.
   * @param userId — מזהה משתמש.
   * @param permissions — הרשאות.
   * @returns Promise<void> — הפלט בהתאם לחתימה.
   */
  async saveUserJobTypePermissions(
    userId: string,
    permissions: DynamicUserJobTypePermissionSelection[],
  ): Promise<void> {
    // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
    const { error } = await supabase.rpc('save_user_dynamic_job_type_permissions', {
      target_user_id: userId,
      requested_permissions: permissions,
    });
    if (error) throw new Error(error.message || 'לא ניתן לשמור הרשאות תפקיד דינמיות.');
  },
};
