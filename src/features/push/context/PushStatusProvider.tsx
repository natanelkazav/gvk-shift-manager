/**
 * קובץ: src/features/push/context/PushStatusProvider.tsx
 * מטרה: מימוש רכיב תצוגה ואינטראקציה עבור התראות Push / סטטוס.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: PushStatusProvider.
 * - קישור מאפיינים ומצב מקומי לתצוגה ולטיפול בפעולות המשתמש.
 */
import {
  useEffect,
  type PropsWithChildren,
} from 'react';

import {
  PushStatusContext,
} from './PushStatusContext';

import {
  usePushStatus,
} from '../hooks/usePushStatus';

/**
 * פעולה PushStatusProvider: התראות Push / סטטוס.
 * פרמטר מפורק — שדות הקלט נגישים מקומית בשמות המוגדרים בחתימה.
 */
export function PushStatusProvider({
  children,
}: PropsWithChildren) {
  // pushStatus — התראות Push / סטטוס.
  const pushStatus =
    usePushStatus();

  const {
    loadStatus,
  } =
    pushStatus;

  // תופעת לוואי לאחר רינדור בהתאם לתלויות [ loadStatus, ].
  useEffect(
    () => {
      // timeoutId — משך המתנה / מזהה.
      const timeoutId =
        window.setTimeout(
          () => {
            void loadStatus();
          },
          0,
        );

      return () => {
        window.clearTimeout(
          timeoutId,
        );
      };
    },
    [
      loadStatus,
    ],
  );

  // תופעת לוואי לאחר רינדור בהתאם לתלויות [ loadStatus, ].
  useEffect(
    () => {
      /**
       * פעולה handleFocus: טיפול באירוע עבור הנתון handleFocus בהקשר הפעולה.
       * @returns void — הפלט בהתאם לחתימה.
       */
      const handleFocus =
        (): void => {
          void loadStatus();
        };

      /**
       * פעולה handleVisibilityChange: טיפול באירוע עבור הנתון handleVisibilityChange בהקשר הפעולה.
       * @returns void — הפלט בהתאם לחתימה.
       */
      const handleVisibilityChange =
        (): void => {
          if (
            document.visibilityState ===
              'visible'
          ) {
            void loadStatus();
          }
        };

      window.addEventListener(
        'focus',
        handleFocus,
      );

      document.addEventListener(
        'visibilitychange',
        handleVisibilityChange,
      );

      return () => {
        window.removeEventListener(
          'focus',
          handleFocus,
        );

        document.removeEventListener(
          'visibilitychange',
          handleVisibilityChange,
        );
      };
    },
    [
      loadStatus,
    ],
  );

  return (
    <PushStatusContext.Provider
      value={pushStatus}
    >
      {children}
    </PushStatusContext.Provider>
  );
}
