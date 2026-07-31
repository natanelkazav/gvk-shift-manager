import type {
  PermissionKey,
} from '../types/auth';

export interface PermissionDefinition {
  key: PermissionKey;
  label: string;
  description: string;
}

export interface PermissionGroup {
  id: string;
  title: string;
  description: string;
  permissions: PermissionDefinition[];
}

export const permissionGroups:
  PermissionGroup[] = [
    {
      id: 'general',
      title: 'כללי',
      description:
        'גישה לאזורים הכלליים של המערכת.',
      permissions: [
        {
          key: 'dashboard.view',
          label: 'צפייה בלוח הבקרה',
          description:
            'מאפשר להיכנס למסך הראשי ולצפות במידע הכללי.',
        },
      ],
    },
    {
      id: 'schedule',
      title: 'שיבוץ מוקדנים',
      description:
        'גישה למסך שיבוץ המוקדנים.',
      permissions: [
        {
          key: 'schedule.view',
          label: 'צפייה בשיבוץ מוקדנים',
          description:
            'מאפשר להיכנס למסך השיבוץ ולצפות בלוח המוקדנים.',
        },
      ],
    },
    {
      id: 'driver-schedule',
      title: 'לוח כוננים',
      description:
        'גישה ללוח הכוננים ולשיבוץ הכוננים.',
      permissions: [
        {
          key: 'driver_schedule.view',
          label: 'צפייה בלוח כוננים',
          description:
            'מאפשר להיכנס למסך לוח הכוננים.',
        },
      ],
    },
    {
      id: 'users',
      title: 'ניהול משתמשים',
      description:
        'צפייה וניהול של משתמשי המערכת.',
      permissions: [
        {
          key: 'users.view',
          label: 'צפייה במשתמשים',
          description:
            'מאפשר להיכנס למסך ניהול המשתמשים.',
        },
        {
          key: 'users.manage',
          label: 'ניהול משתמשים',
          description:
            'מאפשר ליצור, לערוך, להפעיל ולהשבית משתמשים ולשנות הרשאות.',
        },
      ],
    },
    {
      id: 'notifications',
      title: 'התראות',
      description:
        'גישה למערכת ההתראות.',
      permissions: [
        {
          key: 'notifications.view',
          label: 'צפייה בהתראות',
          description:
            'מאפשר להיכנס למסך ההתראות ולצפות בהן.',
        },
      ],
    },
    {
      id: 'statistics',
      title: 'סטטיסטיקות',
      description:
        'גישה לנתונים ולדוחות סטטיסטיים.',
      permissions: [
        {
          key: 'statistics.view',
          label: 'צפייה בסטטיסטיקות',
          description:
            'מאפשר להיכנס למסך הסטטיסטיקות.',
        },
      ],
    },
    {
  id: 'audit',

  title: 'יומן מערכת',

  description:
    'צפייה ביומן הפעולות שבוצעו במערכת.',

  permissions: [
    {
      key: 'audit.view',

      label: 'צפייה ביומן מערכת',

      description:
        'מאפשר לצפות בכל פעולות הניהול שבוצעו במערכת.',
    },
  ],
},
    {
      id: 'shift-swaps',
      title: 'החלפות משמרת',
      description:
        'גישה לבקשות החלפת משמרת.',
      permissions: [
        {
          key: 'shift_swaps.view',
          label: 'צפייה בהחלפות משמרת',
          description:
            'מאפשר להיכנס למסך החלפות המשמרת.',
        },
      ],
    },
    {
      id: 'archive',
      title: 'ארכיון',
      description:
        'גישה לנתונים ולשיבוצים שנשמרו בארכיון.',
      permissions: [
        {
          key: 'archive.view',
          label: 'צפייה בארכיון',
          description:
            'מאפשר להיכנס למסך הארכיון.',
        },
      ],
    },
    {
      id: 'settings',
      title: 'הגדרות',
      description:
        'גישה להגדרות המערכת.',
      permissions: [
        {
          key: 'settings.view',
          label: 'צפייה בהגדרות',
          description:
            'מאפשר להיכנס למסך הגדרות המערכת.',
        },
      ],
    },
  ];

export const allPermissionKeys:
  PermissionKey[] =
  permissionGroups.flatMap(
    (group) =>
      group.permissions.map(
        (permission) =>
          permission.key,
      ),
  );