/**
 * קובץ: src/hooks/usePermissions.ts
 * מטרה: ניהול מצב ותופעות לוואי באמצעות React עבור הרשאות.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: UsePermissionsResult, usePermissions.
 * - ריכוז ההגדרות והלוגיקה המפורטות בהמשך הקובץ.
 */
import { useAuth } from '../auth/AuthContext';
import type {
  PermissionKey,
} from '../types/auth';

/**
 * חוזה הנתונים UsePermissionsResult: הרשאות / תוצאה.
 */
interface UsePermissionsResult {
  // permissions — הרשאות.
  permissions: PermissionKey[];

  // hasPermission — הרשאות.
  hasPermission: (
    permission: PermissionKey,
  ) => boolean;

  // hasAnyPermission — הרשאות.
  hasAnyPermission: (
    permissions: PermissionKey[],
  ) => boolean;

  // hasAllPermissions — הרשאות.
  hasAllPermissions: (
    permissions: PermissionKey[],
  ) => boolean;

  // refreshPermissions — הרשאות.
  refreshPermissions:
    () => Promise<void>;
}

/**
 * פעולה usePermissions: חיבור מצב או הקשר עבור הרשאות.
 * @returns UsePermissionsResult — הפלט בהתאם לחתימה.
 */
export function usePermissions():
  UsePermissionsResult {
  const {
    permissions,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    refreshPermissions,
  } = useAuth();

  return {
    permissions,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    refreshPermissions,
  };
}