/**
 * קובץ: src/features/notifications/types/notificationTypes.ts
 * מטרה: הגדרת טיפוסים וחוזי נתונים עבור התראות.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: NotificationType, NotificationPriority.
 * - תיאור מבנה הקלט והפלט לבדיקת טיפוסים בזמן פיתוח.
 */
// NotificationType — התראות.
export const NotificationType = {
  TEST:
    'test',

  SHIFT_REMINDER:
    'shift_reminder',

  SCHEDULE_PUBLISHED:
    'schedule_published',

  SHIFT_SWAP:
    'shift_swap',

  MANAGER_MESSAGE:
    'manager_message',

  SYSTEM:
    'system',

  CHAT:
    'chat',
} as const;

/**
 * טיפוס NotificationType: התראות.
 */
export type NotificationType =
  (
    typeof NotificationType
  )[
    keyof typeof NotificationType
  ];

// NotificationPriority — התראות.
export const NotificationPriority = {
  LOW:
    'low',

  NORMAL:
    'normal',

  IMPORTANT:
    'important',

  URGENT:
    'urgent',
} as const;

/**
 * טיפוס NotificationPriority: התראות.
 */
export type NotificationPriority =
  (
    typeof NotificationPriority
  )[
    keyof typeof NotificationPriority
  ];