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

export type NotificationType =
  (
    typeof NotificationType
  )[
    keyof typeof NotificationType
  ];

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

export type NotificationPriority =
  (
    typeof NotificationPriority
  )[
    keyof typeof NotificationPriority
  ];