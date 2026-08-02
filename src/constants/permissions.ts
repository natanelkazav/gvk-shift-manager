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
        'גישה לצפייה, יצירה ועריכה של שיבוץ המוקדנים.',
      permissions: [
        {
          key: 'schedule.view',
          label: 'צפייה בשיבוץ מוקדנים',
          description:
            'מאפשר להיכנס למסך השיבוץ ולצפות בשיבוץ האישי.',
        },
        {
          key: 'schedule.view_team',
          label: 'צפייה בשיבוץ הצוות',
          description:
            'מאפשר לצפות בשיבוץ המלא ובנתונים של כל המוקדנים.',
        },
        {
          key: 'schedule.edit',
          label: 'עריכת שיבוץ מוקדנים',
          description:
            'מאפשר ליצור טיוטה, לערוך ולפרסם את השיבוץ.',
        },
      ],
    },
    {
      id: 'availability',
      title: 'אילוצי מוקדנים',
      description:
        'הגשת זמינות וניהול תקופות אילוצים חודשיות.',
      permissions: [
        {
          key: 'availability.view',
          label: 'צפייה והגשת אילוצים',
          description:
            'מאפשר לצפות במשמרות החודש ולהגיש זמינות אישית.',
        },
        {
          key: 'availability.manage',
          label: 'ניהול תקופות אילוצים',
          description:
            'מאפשר לפתוח, לסגור ולנהל תקופות הגשת אילוצים.',
        },
      ],
    },
    {
      id: 'driver-schedule',

      title: 'כוננים',

      description:
        'הגשת אילוצים, צפייה וניהול של לוח הכוננים.',

      permissions: [
        {
          key: 'driver_availability.view',

          label: 'הגשת אילוצי כוננים',

          description:
            'מאפשר לכונן לצפות בחודש פתוח ולסמן זמינות יומית.',
        },

        {
          key: 'driver_availability.manage',

          label: 'ניהול אילוצי כוננים',

          description:
            'מאפשר ליצור, לפתוח, לסגור ולנהל תקופות אילוצים של כוננים.',
        },

        {
          key: 'driver_schedule.view',

          label: 'צפייה בלוח כוננים',

          description:
            'מאפשר להיכנס למסך לוח הכוננים ולצפות בשיבוץ האישי.',
        },

        {
          key: 'driver_schedule.view_team',

          label: 'צפייה בלוח הכוננים המלא',

          description:
            'מאפשר לצפות בשיבוץ של כל הכוננים ובנתוני הצוות.',
        },

        {
          key: 'driver_schedule.edit',

          label: 'עריכת לוח כוננים',

          description:
            'מאפשר ליצור, לערוך ולפרסם את לוח הכוננים.',
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