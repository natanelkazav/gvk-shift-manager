import type {
  PermissionKey,
  UserRole,
} from '../types/auth';

export const ALL_PERMISSION_KEYS:
  readonly PermissionKey[] = [
    'dashboard.view',

    'schedule.view',
    'schedule.view_team',
    'schedule.edit',

    'availability.view',
    'availability.manage',

    'driver_availability.view',
    'driver_availability.manage',

    'driver_schedule.view',
    'driver_schedule.view_team',
    'driver_schedule.edit',
    'driver_schedule.edit_any',

    'morning_driver_availability.view',
    'morning_driver_availability.manage',

    'morning_driver_schedule.view',
    'morning_driver_schedule.view_team',
    'morning_driver_schedule.edit',
    'morning_driver_schedule.edit_any',

    'notifications.view',
    'notifications.manage',

    'statistics.view',

    'payroll.view',
    'payroll.manage',
    'attendance.view',
    'attendance.manage',

    'shift_swaps.view',
    'shift_swaps.approve',

    'archive.view',

    'users.view',
    'users.manage',


    'schedule_import.manage',
    'schedule_export.manage',

    'audit.view',
  ];

export const DEFAULT_ROLE_PERMISSIONS:
  Readonly<
    Record<
      UserRole,
      readonly PermissionKey[]
    >
  > = {
    admin:
      ALL_PERMISSION_KEYS,

    manager: [
      'dashboard.view',

      'schedule.view_team',
      'schedule.edit',
      'availability.manage',

      'driver_availability.view',
      'driver_availability.manage',

      'driver_schedule.view',
      'driver_schedule.view_team',
      'driver_schedule.edit',

      'morning_driver_availability.manage',

      'morning_driver_schedule.view',
      'morning_driver_schedule.view_team',
      'morning_driver_schedule.edit',

      'notifications.view',
      'notifications.manage',

      'statistics.view',

      'payroll.view',
      'attendance.view',

      'shift_swaps.view',
      'shift_swaps.approve',

      'archive.view',

      'users.view',
    ],

    dispatcher: [
      'dashboard.view',

      'schedule.view',

      'availability.view',

      'notifications.view',

      'shift_swaps.view',

    ],

    on_call: [
      'dashboard.view',

      'driver_availability.view',

      'driver_schedule.view',
      'driver_schedule.edit_any',

      'notifications.view',

    ],

    morning_driver: [
      'dashboard.view',

      'morning_driver_availability.view',

      'morning_driver_schedule.view',
      'morning_driver_schedule.edit_any',

      'notifications.view',

    ],

    viewer: [
      'dashboard.view',
    ],
  };

export const ROLE_LABELS:
  Readonly<
    Record<
      UserRole,
      string
    >
  > = {
    admin:
      'מנהל/ת מערכת',

    manager:
      'מנהל/ת',

    dispatcher:
      'מוקדן/נית',

    on_call:
      'כונן',

    morning_driver:
      'כונן בוקר',

    viewer:
      'צפייה בלבד',
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
    new Set(
      secondPermissions,
    );

  return firstPermissions.every(
    (permission) =>
      secondPermissionSet.has(
        permission,
      ),
  );
}