/**
 * קובץ: src/features/notifications/context/useNotificationContext.ts
 * מטרה: מימוש התראות.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: useNotificationContext.
 * - ריכוז ההגדרות והלוגיקה המפורטות בהמשך הקובץ.
 */
import {
  useContext,
} from 'react';

import {
  NotificationContext,
} from './NotificationContext';

/**
 * פעולה useNotificationContext: חיבור מצב או הקשר עבור התראות.
 */
export function useNotificationContext() {
  const context =
    useContext(
      NotificationContext,
    );

  // עצירת הפעולה עם שגיאה כאשר !context.
  if (
    !context
  ) {
    throw new Error(
      'useNotificationContext must be used inside NotificationProvider.',
    );
  }

  return context;
}