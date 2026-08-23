[
  {
    "permission_key": "archive.view",
    "assigned_users": 3
  },
  {
    "permission_key": "attendance.manage",
    "assigned_users": 1
  },
  {
    "permission_key": "attendance.view",
    "assigned_users": 1
  },
  {
    "permission_key": "audit.view",
    "assigned_users": 3
  },
  {
    "permission_key": "availability.manage",
    "assigned_users": 3
  },
  {
    "permission_key": "availability.view",
    "assigned_users": 3
  },
  {
    "permission_key": "dashboard.view",
    "assigned_users": 14
  },
  {
    "permission_key": "driver_availability.manage",
    "assigned_users": 3
  },
  {
    "permission_key": "driver_availability.view",
    "assigned_users": 5
  },
  {
    "permission_key": "driver_schedule.edit",
    "assigned_users": 8
  },
  {
    "permission_key": "driver_schedule.view",
    "assigned_users": 8
  },
  {
    "permission_key": "driver_schedule.view_team",
    "assigned_users": 8
  },
  {
    "permission_key": "morning_driver_availability.manage",
    "assigned_users": 3
  },
  {
    "permission_key": "morning_driver_availability.view",
    "assigned_users": 4
  },
  {
    "permission_key": "morning_driver_schedule.edit",
    "assigned_users": 3
  },
  {
    "permission_key": "morning_driver_schedule.view",
    "assigned_users": 6
  },
  {
    "permission_key": "morning_driver_schedule.view_team",
    "assigned_users": 6
  },
  {
    "permission_key": "notifications.manage",
    "assigned_users": 8
  },
  {
    "permission_key": "notifications.view",
    "assigned_users": 14
  },
  {
    "permission_key": "payroll.manage",
    "assigned_users": 3
  },
  {
    "permission_key": "payroll.view",
    "assigned_users": 3
  },
  {
    "permission_key": "schedule_export.manage",
    "assigned_users": 2
  },
  {
    "permission_key": "schedule_import.manage",
    "assigned_users": 2
  },
  {
    "permission_key": "schedule.edit",
    "assigned_users": 3
  },
  {
    "permission_key": "schedule.view",
    "assigned_users": 6
  },
  {
    "permission_key": "schedule.view_team",
    "assigned_users": 3
  },
  {
    "permission_key": "settings.manage",
    "assigned_users": 1
  },
  {
    "permission_key": "settings.view",
    "assigned_users": 1
  },
  {
    "permission_key": "shift_swaps.approve",
    "assigned_users": 3
  },
  {
    "permission_key": "shift_swaps.view",
    "assigned_users": 7
  },
  {
    "permission_key": "statistics.view",
    "assigned_users": 3
  },
  {
    "permission_key": "users.manage",
    "assigned_users": 3
  },
  {
    "permission_key": "users.view",
    "assigned_users": 3
  }
]

## הרשאות עריכה מיוחדות של לוחות שפורסמו

| Permission | Purpose |
|---|---|
| `driver_schedule.edit_any` | עריכת כל כוננות בלוח הכוננים שפורסם של החודש הנוכחי, כולל כוננות של משתמש אחר ותאריך שכבר עבר. |
| `morning_driver_schedule.edit_any` | עריכת כל משמרת בלוח כונני הבוקר שפורסם של החודש הנוכחי, כולל משמרת של משתמש אחר ותאריך שכבר עבר. |

הרשאות אלו נפרדות מ־`driver_schedule.edit` ומ־`morning_driver_schedule.edit`.
ההרשאות הרגילות נשארות עבור יצירה, ניהול טיוטה ופרסום; `edit_any` מיועדת לתיקונים חריגים בלוח שכבר פורסם.
לוחות מחודשים אחרים/ארכיון אינם ניתנים לעריכה באמצעות הרשאות אלו.
