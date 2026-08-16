import type {
  PermissionKey,
} from '../types/auth';

export type PermissionGroupTone =
  | 'blue'
  | 'green'
  | 'amber'
  | 'orange'
  | 'purple'
  | 'rose'
  | 'slate';

export interface PermissionDefinition {
  key: PermissionKey;
  label: string;
  description: string;
}

export interface PermissionGroup {
  id: string;
  title: string;
  description: string;
  tone: PermissionGroupTone;
  permissions: PermissionDefinition[];
}

export const permissionGroups:
  PermissionGroup[] = [
    {
      id: 'general',
      title: 'לוח בקרה',
      description:
        'גישה למסך הראשי ולמידע המסכם של המערכת.',
      tone: 'blue',
      permissions: [
        {
          key: 'dashboard.view',
          label: 'צפייה בלוח הבקרה',
          description:
            'מאפשרת לפתוח את מסך הבית ולצפות בנתונים, בקיצורי הדרך ובמידע הכללי המוצג בו.',
        },
      ],
    },
    {
      id: 'dispatcher-availability',
      title: 'מוקדנים — אילוצים',
      description:
        'הגשת זמינות אישית וניהול חודשי האילוצים של המוקדנים.',
      tone: 'green',
      permissions: [
        {
          key: 'availability.view',
          label: 'צפייה והגשת אילוצים אישיים',
          description:
            'מאפשרת למוקדן לצפות במשמרות של חודש פתוח, לסמן זמין או לא זמין ולהגיש את האילוצים שלו.',
        },
        {
          key: 'availability.manage',
          label: 'ניהול חודשי אילוצי מוקדנים',
          description:
            'מאפשרת ליצור חודש אילוצים, לפתוח או לסגור אותו להגשה ולעקוב אחר מצב ההגשות של המוקדנים.',
        },
      ],
    },
    {
      id: 'dispatcher-schedule',
      title: 'מוקדנים — לוח שיבוץ',
      description:
        'צפייה בלוח האישי, צפייה בלוח הצוות וניהול שיבוץ המוקדנים.',
      tone: 'green',
      permissions: [
        {
          key: 'schedule.view',
          label: 'צפייה בלוח השיבוץ האישי',
          description:
            'מאפשרת למשתמש לפתוח את מסך השיבוץ ולצפות במשמרות ששויכו אליו.',
        },
        {
          key: 'schedule.view_team',
          label: 'צפייה בלוח כל המוקדנים',
          description:
            'מאפשרת לצפות בלוח המלא ובשיבוצים של כלל המוקדנים, ולא רק בשיבוץ האישי.',
        },
        {
          key: 'schedule.edit',
          label: 'ניהול ועריכת לוח המוקדנים',
          description:
            'מאפשרת ליצור שיבוץ, לערוך הקצאות גם בחודש הנוכחי לאחר פרסום, לבצע תיקונים ולפרסם את הלוח.',
        },
      ],
    },
    {
      id: 'driver-availability',
      title: 'כוננים — אילוצים',
      description:
        'הגשת זמינות יומית וניהול חודשי האילוצים של הכוננים.',
      tone: 'amber',
      permissions: [
        {
          key: 'driver_availability.view',
          label: 'צפייה והגשת אילוצי כונן',
          description:
            'מאפשרת לכונן לצפות בחודש פתוח, לסמן את זמינותו לכל יום ולשלוח את ההגשה שלו.',
        },
        {
          key: 'driver_availability.manage',
          label: 'ניהול חודשי אילוצי כוננים',
          description:
            'מאפשרת ליצור, לפתוח, לסגור, לפתוח מחדש ולמחוק חודשי אילוצים של כוננים ולעקוב אחר ההגשות.',
        },
      ],
    },
    {
      id: 'driver-schedule',
      title: 'כוננים — לוח כוננות',
      description:
        'צפייה בלוח הכוננים וניהול הקצאות הכוננות החודשיות.',
      tone: 'amber',
      permissions: [
        {
          key: 'driver_schedule.view',
          label: 'צפייה בלוח הכוננות האישי',
          description:
            'מאפשרת לכונן להיכנס ללוח הכוננים ולצפות בימים שבהם הוא משובץ.',
        },
        {
          key: 'driver_schedule.view_team',
          label: 'צפייה בלוח הכוננים המלא',
          description:
            'מאפשרת לצפות בהקצאות של כלל הכוננים ובתמונת הכוננות החודשית המלאה.',
        },
        {
          key: 'driver_schedule.edit',
          label: 'יצירה ועריכה של לוח הכוננים',
          description:
            'מאפשרת ליצור טיוטה, לשנות כונן משובץ, לפרסם לוח ולבצע שינויים המותרים לאחר הפרסום.',
        },
      ],
    },
    {
      id: 'morning-driver-availability',
      title: 'כונני בוקר — אילוצים',
      description:
        'הגשת זמינות לפי משמרת וניהול חודשי האילוצים של כונני הבוקר.',
      tone: 'orange',
      permissions: [
        {
          key: 'morning_driver_availability.view',
          label: 'צפייה והגשת אילוצי כונן בוקר',
          description:
            'מאפשרת לכונן בוקר לצפות במשמרות החודש, לסמן זמינות לכל משמרת ולהגיש את האילוצים שלו.',
        },
        {
          key: 'morning_driver_availability.manage',
          label: 'ניהול חודשי אילוצי כונני בוקר',
          description:
            'מאפשרת ליצור חודש אילוצים, לפתוח אותו להגשה, למחוק טיוטה ולנהל את תקופת ההגשה של כונני הבוקר.',
        },
      ],
    },
    {
      id: 'morning-driver-schedule',
      title: 'כונני בוקר — לוח שיבוץ',
      description:
        'צפייה וניהול של לוח משמרות כונני הבוקר.',
      tone: 'orange',
      permissions: [
        {
          key: 'morning_driver_schedule.view',
          label: 'צפייה בלוח האישי של כונן הבוקר',
          description:
            'מאפשרת לכונן בוקר לצפות רק במשמרות שאליהן הוא שובץ.',
        },
        {
          key: 'morning_driver_schedule.view_team',
          label: 'צפייה בלוח כונני הבוקר המלא',
          description:
            'מאפשרת לצפות בכל המשמרות ובהקצאות של כלל כונני הבוקר.',
        },
        {
          key: 'morning_driver_schedule.edit',
          label: 'יצירה ועריכה של לוח כונני הבוקר',
          description:
            'מאפשרת ליצור טיוטה, לשבץ עובדים במשמרות, לערוך הקצאות ולפרסם את הלוח.',
        },
      ],
    },
    {
      id: 'notifications',
      title: 'התראות',
      description:
        'צפייה בהתראות וניהול התוכן שנשלח למשתמשי המערכת.',
      tone: 'purple',
      permissions: [
        {
          key: 'notifications.view',
          label: 'צפייה בהתראות',
          description:
            'מאפשרת לפתוח את מסך ההתראות ולצפות בהתראות שהמערכת מציגה למשתמש.',
        },
        {
          key: 'notifications.manage',
          label: 'ניהול התראות',
          description:
            'מאפשרת ליצור ולנהל התראות מערכת, לרבות התראות מתוזמנות או מיועדות לקבוצות משתמשים.',
        },
      ],
    },
    {
      id: 'statistics',
      title: 'סטטיסטיקות',
      description:
        'גישה לדוחות, לטבלאות ולתרשימים הסטטיסטיים של המערכת.',
      tone: 'purple',
      permissions: [
        {
          key: 'statistics.view',
          label: 'צפייה בסטטיסטיקות',
          description:
            'מאפשרת לצפות בנתוני משמרות, דוחות, גרפים והשוואות של מוקדנים וכוננים.',
        },
      ],
    },
    {
      id: 'shift-swaps',
      title: 'החלפות משמרת',
      description:
        'הגשה, צפייה וטיפול בבקשות להחלפת משמרות.',
      tone: 'purple',
      permissions: [
        {
          key: 'shift_swaps.view',
          label: 'צפייה והגשת בקשות החלפה',
          description:
            'מאפשרת לפתוח את מסך ההחלפות, לצפות בבקשות הרלוונטיות ולהגיש בקשת שינוי או החלפה.',
        },
        {
          key: 'shift_swaps.approve',
          label: 'אישור או דחייה של בקשות החלפה',
          description:
            'מאפשרת למשתמש מורשה לבדוק בקשות ממתינות, לאשר או לדחות אותן ולעדכן את הלוח בהתאם.',
        },
      ],
    },
    {
      id: 'users',
      title: 'ניהול משתמשים',
      description:
        'צפייה במשתמשי המערכת וניהול חשבונות, תפקידים והרשאות.',
      tone: 'rose',
      permissions: [
        {
          key: 'users.view',
          label: 'צפייה ברשימת המשתמשים',
          description:
            'מאפשרת לפתוח את מסך ניהול המשתמשים ולצפות בפרטי המשתמשים ובמצב החשבונות.',
        },
        {
          key: 'users.manage',
          label: 'ניהול משתמשים והרשאות',
          description:
            'מאפשרת ליצור, לערוך, להפעיל, להשבית ולמחוק משתמשים וכן לשנות תפקידים והרשאות.',
        },
      ],
    },
    {
      id: 'archive',
      title: 'ארכיון',
      description:
        'גישה לחודשים, ללוחות ולנתונים שנשמרו לצפייה היסטורית.',
      tone: 'slate',
      permissions: [
        {
          key: 'archive.view',
          label: 'צפייה בארכיון',
          description:
            'מאפשרת לצפות בחודשי שיבוץ, בלוחות ובנתונים קודמים שנשמרו בארכיון המערכת.',
        },
      ],
    },
    {
      id: 'audit',
      title: 'יומן מערכת',
      description:
        'מעקב אחר פעולות ניהול ושינויים שבוצעו במערכת.',
      tone: 'slate',
      permissions: [
        {
          key: 'audit.view',
          label: 'צפייה ביומן המערכת',
          description:
            'מאפשרת לצפות מי ביצע פעולות ניהול, באיזה מועד ועל איזה משתמש או רכיב במערכת.',
        },
      ],
    },
    {
      id: 'settings',
      title: 'הגדרות מערכת',
      description:
        'צפייה בהגדרות המערכת ושינוי הגדרות ניהוליות.',
      tone: 'slate',
      permissions: [
        {
          key: 'settings.view',
          label: 'צפייה בהגדרות המערכת',
          description:
            'מאפשרת לפתוח את מסך ההגדרות ולצפות בערכים ובהגדרות הקיימות.',
        },
        {
          key: 'settings.manage',
          label: 'עריכת הגדרות המערכת',
          description:
            'מאפשרת לשנות ולשמור הגדרות מערכת המשפיעות על התנהגות האפליקציה.',
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