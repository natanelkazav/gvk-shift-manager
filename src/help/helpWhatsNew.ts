import type {
  PermissionKey,
} from '../types/auth';

export interface HelpWhatsNewItem {
  id: string;
  title: string;
  description: string;
  requiredAnyPermissions?: readonly PermissionKey[];
}

export const helpWhatsNewItems:
  readonly HelpWhatsNewItem[] = [
    {
      id: 'morning-driver-dynamic-times',
      title: 'שעות דינמיות לכונני בוקר',
      description:
        'בטיוטת כונני הבוקר ניתן לשנות שעת התחלה וסיום. הייצוא לאקסל משתמש בשעות שנקבעו ומציג רק כוננים ששובצו בפועל.',
      requiredAnyPermissions: [
        'morning_driver_schedule.edit',
        'schedule_export.manage',
      ],
    },
    {
      id: 'help-center',
      title: 'מרכז העזרה החדש',
      description:
        'האייקון ? ליד הפעמון פותח מדריכים שמותאמים למסך הנוכחי ולהרשאות שלך.',
    },
    {
      id: 'driver-rotation',
      title: 'רוטציית כוננים חכמה',
      description:
        'שיבוץ הכוננים יכול להמשיך את רוטציית חמשת הכוננים מהחודש הקודם גם ללא הגשת אילוצים.',
      requiredAnyPermissions: [
        'driver_schedule.view',
        'driver_schedule.view_team',
        'driver_schedule.edit',
      ],
    },
    {
      id: 'historical-import-modes',
      title: 'ייבוא חכם גם לחודשים היסטוריים',
      description:
        'בייבוא Excel ניתן לבחור עדכון חסרים, החלפה או מחיקה וייבוא מחדש גם כאשר החודש כבר קיים בארכיון.',
      requiredAnyPermissions: [
        'schedule_import.manage',
      ],
    },
    {
      id: 'extended-edit',
      title: 'עריכה מורחבת בחודש הנוכחי',
      description:
        'נוספו הרשאות מיוחדות לתיקון שיבוצי כוננים וכונני בוקר של משתמשים אחרים וגם בתאריכים שכבר עברו.',
      requiredAnyPermissions: [
        'driver_schedule.edit_any',
        'morning_driver_schedule.edit_any',
      ],
    },
  ];
