import { supabase } from '../lib/supabase';
import type {
  PermissionKey,
} from '../types/auth';

function isPermissionKey(
  value: unknown,
): value is PermissionKey {
  return (
    typeof value === 'string' &&
    [
      'dashboard.view',

      'schedule.view',
      'schedule.view_team',
      'schedule.edit',

      'availability.view',
      'availability.manage',

      'driver_schedule.view',
      'driver_schedule.edit',

      'notifications.view',
      'notifications.manage',

      'statistics.view',

      'shift_swaps.view',
      'shift_swaps.approve',

      'archive.view',

      'audit.view',

      'users.view',
      'users.manage',

      'settings.view',
      'settings.manage',
    ].includes(value)
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
  const {
    data,
    error,
  } = await supabase.rpc(
    'get_user_permissions',
    {
      target_user_id: userId,
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
  const {
    data,
    error,
  } = await supabase.rpc(
    'set_user_permissions',
    {
      target_user_id: userId,
      requested_permissions:
        permissions,
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