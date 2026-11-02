/**
 * קובץ: src/features/push/context/PushStatusContext.ts
 * מטרה: מימוש התראות Push / סטטוס.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: PushStatusContextValue.
 * - ריכוז ההגדרות והלוגיקה המפורטות בהמשך הקובץ.
 */
import {
  createContext,
} from 'react';

import type {
  usePushStatus,
} from '../hooks/usePushStatus';

/**
 * טיפוס PushStatusContextValue: התראות Push / סטטוס / ערך.
 */
export type PushStatusContextValue =
  ReturnType<
    typeof usePushStatus
  >;

// PushStatusContext — התראות Push / סטטוס.
export const PushStatusContext =
  createContext<
    PushStatusContextValue | null
  >(null);