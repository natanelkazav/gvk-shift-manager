import type {
  PermissionKey,
  UserRole,
} from '../types/auth';

export const ALL_PERMISSION_KEYS:
  readonly PermissionKey[] = [
    'dashboard.view',
    'schedule.view',
    'schedule.edit',
    'driver_schedule.view',
    'driver_schedule.edit',
    'notifications.view',
    'notifications.manage',
    'statistics.view',
    'shift_swaps.view',
    'shift_swaps.approve',
    'archive.view',
    'users.view',
    'users.manage',
    'settings.view',
    'settings.manage',
  ];

export const DEFAULT_ROLE_PERMISSIONS:
  Readonly<
    Record<
      UserRole,
      readonly PermissionKey[]
    >
  > = {
    admin: ALL_PERMISSION_KEYS,

    manager: [
      'dashboard.view',
      'driver_schedule.view',
      'driver_schedule.edit',
      'notifications.view',
      'notifications.manage',
      'statistics.view',
      'shift_swaps.view',
      'shift_swaps.approve',
      'archive.view',
      'users.view',
    ],

    dispatcher: [
      'dashboard.view',
      'schedule.view',
      'schedule.edit',
      'notifications.view',
      'notifications.manage',
      'statistics.view',
      'shift_swaps.view',
      'archive.view',
    ],

    on_call: [
      'dashboard.view',
      'driver_schedule.view',
      'notifications.view',
      'shift_swaps.view',
    ],

    viewer: [
      'dashboard.view',
    ],
  };

export const ROLE_LABELS:
  Readonly<Record<UserRole, string>> = {
    admin: 'מנהל מערכת',
    manager: 'מנהלת',
    dispatcher: 'מוקדן',
    on_call: 'כונן',
    viewer: 'צפייה בלבד',
  };

export function getDefaultPermissionsForRole(
  role: UserRole,
): PermissionKey[] {
  return [
    ...DEFAULT_ROLE_PERMISSIONS[
      role
    ],
  ];
}

export function arePermissionListsEqual(
  firstPermissions:
    readonly PermissionKey[],
  secondPermissions:
    readonly PermissionKey[],
): boolean {
  if (
    firstPermissions.length !==
    secondPermissions.length
  ) {
    return false;
  }

  const secondPermissionSet =
    new Set(secondPermissions);

  return firstPermissions.every(
    (permission) =>
      secondPermissionSet.has(
        permission,
      ),
  );
}