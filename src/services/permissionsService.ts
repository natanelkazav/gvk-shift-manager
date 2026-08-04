import { supabase } from '../lib/supabase';
import {
  ALL_PERMISSION_KEYS,
} from '../config/defaultRolePermissions';
import type {
  PermissionKey,
} from '../types/auth';

const permissionKeySet =
  new Set<string>(
    ALL_PERMISSION_KEYS,
  );

function isPermissionKey(
  value: unknown,
): value is PermissionKey {
  return (
    typeof value === 'string' &&
    permissionKeySet.has(value)
  );
}

async function getMyPermissions():
  Promise<PermissionKey[]> {
  const {
    data,
    error,
  } = await supabase.rpc(
    'get_my_permissions',
  );

  if (error) {
    console.error(
      'GET MY PERMISSIONS ERROR:',
      error,
    );

    throw new Error(
      'לא ניתן היה לטעון את הרשאות המשתמש.',
    );
  }

  if (!Array.isArray(data)) {
    return [];
  }

  return data.filter(isPermissionKey);
}

async function getUserPermissions(
  userId: string,
): Promise<PermissionKey[]> {
  const normalizedUserId =
    userId.trim();

  if (!normalizedUserId) {
    throw new Error(
      'לא התקבל מזהה משתמש לטעינת ההרשאות.',
    );
  }

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

  if (error) {
    console.error(
      'GET USER PERMISSIONS ERROR:',
      error,
    );

    throw new Error(
      'לא ניתן היה לטעון את הרשאות המשתמש.',
    );
  }

  if (!Array.isArray(data)) {
    return [];
  }

  return data.filter(isPermissionKey);
}

async function setUserPermissions(
  userId: string,
  permissions: PermissionKey[],
): Promise<PermissionKey[]> {
  const normalizedUserId =
    userId.trim();

  if (!normalizedUserId) {
    throw new Error(
      'לא התקבל מזהה משתמש לשמירת ההרשאות.',
    );
  }

  const normalizedPermissions =
    Array.from(
      new Set(
        permissions.filter(
          isPermissionKey,
        ),
      ),
    );

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

  if (error) {
    console.error(
      'SET USER PERMISSIONS ERROR:',
      error,
    );

    throw new Error(
      'לא ניתן היה לשמור את הרשאות המשתמש.',
    );
  }

  if (!Array.isArray(data)) {
    return [];
  }

  return data.filter(isPermissionKey);
}

export const permissionsService = {
  getMyPermissions,
  getUserPermissions,
  setUserPermissions,
};