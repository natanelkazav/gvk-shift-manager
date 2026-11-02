/**
 * קובץ: src/features/push/context/usePushStatusContext.ts
 * מטרה: מימוש התראות Push / סטטוס.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: usePushStatusContext.
 * - ריכוז ההגדרות והלוגיקה המפורטות בהמשך הקובץ.
 */
import {
  useContext,
} from 'react';

import {
  PushStatusContext,
} from './PushStatusContext';

/**
 * פעולה usePushStatusContext: חיבור מצב או הקשר עבור התראות Push / סטטוס.
 */
export function usePushStatusContext() {
  const context =
    useContext(
      PushStatusContext,
    );

  // עצירת הפעולה עם שגיאה כאשר !context.
  if (!context) {
    throw new Error(
      'usePushStatusContext must be used inside PushStatusProvider.',
    );
  }

  return context;
}