/**
 * קובץ: src/services/permissionPolicyService.ts
 * מטרה: ניהול פרופילי הרשאות והגבלת היקף ההרשאות לסוגי תפקידים.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: asPermissionKeys, normalizeProfile, getAdminCatalog, getUserPolicy, saveUserPolicy.
 * - קריאות RPC המופעלות בקובץ: get_permission_admin_catalog, get_user_permission_policy, save_user_permission_policy.
 * - ריכוז הפנייה למקור הנתונים ועיבוד התשובה בהתאם לפונקציות להלן.
 */
import { supabase } from '../lib/supabase';
import type { PermissionKey } from '../types/auth';
import type {
  PermissionAdminCatalog,
  PermissionProfileDefinition,
  PermissionScopeMode,
  UserPermissionPolicy,
} from '../types/permissionPolicy';
import { ALL_PERMISSION_KEYS } from '../config/defaultRolePermissions';

// validPermissions — הרשאות; אוסף ערכים ייחודיים.
const validPermissions = new Set<string>(ALL_PERMISSION_KEYS);

/**
 * פעולה asPermissionKeys: מפתחות ההרשאות.
 * @param value — ערך.
 * @returns PermissionKey[] — הפלט בהתאם לחתימה.
 */
function asPermissionKeys(value: unknown): PermissionKey[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is PermissionKey =>
    typeof item === 'string' && validPermissions.has(item),
  );
}

/**
 * פעולה normalizeProfile: נרמול פרופיל.
 * @param row — שורה.
 * @returns PermissionProfileDefinition — הפלט בהתאם לחתימה.
 */
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

/**
 * פעולה אסינכרונית getAdminCatalog: שליפה או חישוב של הנתון getAdminCatalog בהקשר הפעולה.
 * הפעולה פונה ל־RPC: get_permission_admin_catalog.
 * @returns Promise<PermissionAdminCatalog> — הפלט בהתאם לחתימה.
 */
async function getAdminCatalog(): Promise<PermissionAdminCatalog> {
  // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
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

/**
 * פעולה אסינכרונית getUserPolicy: שליפה או חישוב של משתמש / מדיניות.
 * הפעולה פונה ל־RPC: get_user_permission_policy.
 * @param userId — מזהה משתמש.
 * @returns Promise<UserPermissionPolicy> — הפלט בהתאם לחתימה.
 */
async function getUserPolicy(userId: string): Promise<UserPermissionPolicy> {
  // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
  const { data, error } = await supabase.rpc('get_user_permission_policy', {
    target_user_id: userId,
  });
  if (error) throw new Error(error.message || 'לא ניתן לטעון את מדיניות ההרשאות.');

  const payload = (data ?? {}) as any;
  // scopeMode — מצב פעולה.
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

/**
 * פעולה אסינכרונית saveUserPolicy: שמירת משתמש / מדיניות.
 * הפעולה פונה ל־RPC: save_user_permission_policy.
 * @param userId — מזהה משתמש.
 * @param policy — מדיניות.
 * @returns Promise<void> — הפלט בהתאם לחתימה.
 */
async function saveUserPolicy(
  userId: string,
  policy: UserPermissionPolicy,
): Promise<void> {
  // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
  const { error } = await supabase.rpc('save_user_permission_policy', {
    target_user_id: userId,
    requested_profile_code: policy.profileCode,
    requested_scope_mode: policy.scopeMode,
    requested_job_type_ids: policy.scopeMode === 'selected' ? policy.jobTypeIds : [],
  });
  if (error) throw new Error(error.message || 'לא ניתן לשמור את מדיניות ההרשאות.');
}

// permissionPolicyService — הרשאות / מדיניות / שירות.
export const permissionPolicyService = {
  getAdminCatalog,
  getUserPolicy,
  saveUserPolicy,
};
