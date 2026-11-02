/**
 * קובץ: src/features/notifications/context/NotificationContext.ts
 * מטרה: מימוש התראות.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: NotificationContextValue.
 * - ריכוז ההגדרות והלוגיקה המפורטות בהמשך הקובץ.
 */
import {
  createContext,
} from 'react';

import type {
  useNotifications,
} from '../hooks/useNotifications';

/**
 * טיפוס NotificationContextValue: התראות / ערך.
 */
export type NotificationContextValue =
  ReturnType<
    typeof useNotifications
  >;

// NotificationContext — התראות.
export const NotificationContext =
  createContext<
    NotificationContextValue | null
  >(
    null,
  );