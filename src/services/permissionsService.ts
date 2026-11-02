/**
 * קובץ: src/services/permissionsService.ts
 * מטרה: שליפה ושמירה של הרשאות משתמשים והמרת תוצאות השרת למבנה שבו משתמש הממשק.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: isPermissionKey, getMyPermissions, getUserPermissions, setUserPermissions.
 * - קריאות RPC המופעלות בקובץ: get_my_permissions, get_user_permissions, set_user_permissions.
 * - ריכוז הפנייה למקור הנתונים ועיבוד התשובה בהתאם לפונקציות להלן.
 */
import { supabase } from '../lib/supabase';
import {
  ALL_PERMISSION_KEYS,
} from '../config/defaultRolePermissions';
import type {
  PermissionKey,
} from '../types/auth';

// permissionKeySet — מפתח ההרשאה; אוסף ערכים ייחודיים.
const permissionKeySet =
  new Set<string>(
    ALL_PERMISSION_KEYS,
  );

/**
 * פעולה isPermissionKey: בדיקת תנאי עבור מפתח ההרשאה.
 * @param value — ערך.
 * @returns value is PermissionKey — הפלט בהתאם לחתימה.
 */
function isPermissionKey(
  value: unknown,
): value is PermissionKey {
  return (
    typeof value === 'string' &&
    permissionKeySet.has(value)
  );
}

/**
 * פעולה אסינכרונית getMyPermissions: שליפה או חישוב של הרשאות.
 * הפעולה פונה ל־RPC: get_my_permissions.
 * @returns Promise<PermissionKey[]> — הפלט בהתאם לחתימה.
 */
async function getMyPermissions():
  Promise<PermissionKey[]> {
  // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
  const {
    data,
    error,
  } = await supabase.rpc(
    'get_my_permissions',
  );

  // עצירת הפעולה עם שגיאה כאשר error.
  if (error) {
    console.error(
      'GET MY PERMISSIONS ERROR:',
      error,
    );

    throw new Error(
      'לא ניתן היה לטעון את הרשאות המשתמש.',
    );
  }

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !Array.isArray(data).
  if (!Array.isArray(data)) {
    return [];
  }

  return data.filter(isPermissionKey);
}

/**
 * פעולה אסינכרונית getUserPermissions: שליפה או חישוב של משתמש / הרשאות.
 * הפעולה פונה ל־RPC: get_user_permissions.
 * @param userId — מזהה משתמש.
 * @returns Promise<PermissionKey[]> — הפלט בהתאם לחתימה.
 */
async function getUserPermissions(
  userId: string,
): Promise<PermissionKey[]> {
  // normalizedUserId — מזהה משתמש.
  const normalizedUserId =
    userId.trim();

  // עצירת הפעולה עם שגיאה כאשר !normalizedUserId.
  if (!normalizedUserId) {
    throw new Error(
      'לא התקבל מזהה משתמש לטעינת ההרשאות.',
    );
  }

  // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
  const {
    data,
    error,
  } = await supabase.rpc(
    'get_user_permissions',
    {
      target_user_id:
        normalizedUserId,
    },
  );

  // עצירת הפעולה עם שגיאה כאשר error.
  if (error) {
    console.error(
      'GET USER PERMISSIONS ERROR:',
      error,
    );

    throw new Error(
      'לא ניתן היה לטעון את הרשאות המשתמש.',
    );
  }

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !Array.isArray(data).
  if (!Array.isArray(data)) {
    return [];
  }

  return data.filter(isPermissionKey);
}

/**
 * פעולה אסינכרונית setUserPermissions: קביעת קבוצה ייחודית / משתמש / הרשאות.
 * הפעולה פונה ל־RPC: set_user_permissions.
 * @param userId — מזהה משתמש.
 * @param permissions — הרשאות.
 * @returns Promise<PermissionKey[]> — הפלט בהתאם לחתימה.
 */
async function setUserPermissions(
  userId: string,
  permissions: PermissionKey[],
): Promise<PermissionKey[]> {
  // normalizedUserId — מזהה משתמש.
  const normalizedUserId =
    userId.trim();

  // עצירת הפעולה עם שגיאה כאשר !normalizedUserId.
  if (!normalizedUserId) {
    throw new Error(
      'לא התקבל מזהה משתמש לשמירת ההרשאות.',
    );
  }

  // normalizedPermissions — הרשאות.
  const normalizedPermissions =
    Array.from(
      new Set(
        permissions.filter(
          isPermissionKey,
        ),
      ),
    );

  // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
  const {
    data,
    error,
  } = await supabase.rpc(
    'set_user_permissions',
    {
      target_user_id:
        normalizedUserId,
      requested_permissions:
        normalizedPermissions,
    },
  );

  // עצירת הפעולה עם שגיאה כאשר error.
  if (error) {
    console.error(
      'SET USER PERMISSIONS ERROR:',
      error,
    );

    throw new Error(
      'לא ניתן היה לשמור את הרשאות המשתמש.',
    );
  }

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !Array.isArray(data).
  if (!Array.isArray(data)) {
    return [];
  }

  return data.filter(isPermissionKey);
}

// permissionsService — הרשאות / שירות.
export const permissionsService = {
  getMyPermissions,
  getUserPermissions,
  setUserPermissions,
};