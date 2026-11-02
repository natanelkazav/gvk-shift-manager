/**
 * קובץ: src/features/notifications/context/NotificationProvider.tsx
 * מטרה: מימוש רכיב תצוגה ואינטראקציה עבור התראות.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: NotificationProvider.
 * - קישור מאפיינים ומצב מקומי לתצוגה ולטיפול בפעולות המשתמש.
 */
import {
  useCallback,
  useEffect,
  useRef,
  type PropsWithChildren,
} from 'react';

import {
  useLocation,
} from 'react-router-dom';

import {
  useAuth,
} from '../../../auth/AuthContext';

import {
  supabase,
} from '../../../lib/supabase';

import {
  pushNotificationService,
} from '../../../services/pushNotificationService';

import {
  useNotifications,
} from '../hooks/useNotifications';

import {
  NotificationContext,
} from './NotificationContext';

// BACKGROUND_REFRESH_INTERVAL_MS — מרווח זמן.
const BACKGROUND_REFRESH_INTERVAL_MS =
  30_000;

// MIN_EVENT_REFRESH_GAP_MS — אירוע.
const MIN_EVENT_REFRESH_GAP_MS =
  2_500;

/**
 * פעולה NotificationProvider: התראות.
 * פרמטר מפורק — שדות הקלט נגישים מקומית בשמות המוגדרים בחתימה.
 */
export function NotificationProvider({
  children,
}: PropsWithChildren) {
  const {
    user,
  } =
    useAuth();

  const location =
    useLocation();

  // notifications — התראות.
  const notifications =
    useNotifications();

  const {
    loadNotifications,
    refreshActivity,
  } =
    notifications;

  // הפניה יציבה lastRefreshAtRef בין רינדורים; שינוי current אינו מפעיל רינדור בפני עצמו.
  const lastRefreshAtRef =
    useRef(
      0,
    );

  const refreshIfNeeded =
    useCallback(
      (): void => {
        const now =
          Date.now();

        // טיפול במקרה מיוחד ויציאה מוקדמת כאשר now - lastRefreshAtRef.current < MIN_EVENT_REFRESH_GAP_MS.
        if (
          now -
            lastRefreshAtRef.current <
          MIN_EVENT_REFRESH_GAP_MS
        ) {
          return;
        }

        lastRefreshAtRef.current =
          now;

        void refreshActivity();
      },
      [
        refreshActivity,
      ],
    );

  // תופעת לוואי לאחר רינדור בהתאם לתלויות [ loadNotifications, ].
  useEffect(
    () => {
      // timeoutId — משך המתנה / מזהה.
      const timeoutId =
        window.setTimeout(
          () => {
            lastRefreshAtRef.current =
              Date.now();

            void loadNotifications();
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
      loadNotifications,
    ],
  );

  // תופעת לוואי לאחר רינדור בהתאם לתלויות [ location.pathname, location.search, refreshIfNeeded, ].
  useEffect(
    () => {
      // timeoutId — משך המתנה / מזהה.
      const timeoutId =
        window.setTimeout(
          () => {
            refreshIfNeeded();
          },
          100,
        );

      return () => {
        window.clearTimeout(
          timeoutId,
        );
      };
    },
    [
      location.pathname,
      location.search,
      refreshIfNeeded,
    ],
  );

  // תופעת לוואי לאחר רינדור בהתאם לתלויות [ refreshIfNeeded, ].
  useEffect(
    () => {
      /**
       * פעולה handleFocus: טיפול באירוע עבור הנתון handleFocus בהקשר הפעולה.
       * @returns void — הפלט בהתאם לחתימה.
       */
      const handleFocus =
        (): void => {
          refreshIfNeeded();
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
            refreshIfNeeded();
          }
        };

      /**
       * פעולה handleActivityChanged: טיפול באירוע עבור הנתון handleActivityChanged בהקשר הפעולה.
       * @returns void — הפלט בהתאם לחתימה.
       */
      const handleActivityChanged =
        (): void => {
          lastRefreshAtRef.current =
            0;

          refreshIfNeeded();
        };

      window.addEventListener(
        'focus',
        handleFocus,
      );

      document.addEventListener(
        'visibilitychange',
        handleVisibilityChange,
      );

      window.addEventListener(
        'gvk:activity-changed',
        handleActivityChanged,
      );

      // intervalId — מרווח זמן / מזהה.
      const intervalId =
        window.setInterval(
          () => {
            if (
              document.visibilityState ===
                'visible'
            ) {
              refreshIfNeeded();
            }
          },
          BACKGROUND_REFRESH_INTERVAL_MS,
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

        window.removeEventListener(
          'gvk:activity-changed',
          handleActivityChanged,
        );

        window.clearInterval(
          intervalId,
        );
      };
    },
    [
      refreshIfNeeded,
    ],
  );

  // תופעת לוואי לאחר רינדור בהתאם לתלויות [ refreshIfNeeded, user, ].
  useEffect(
    () => {
      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !user.
      if (
        !user
      ) {
        return;
      }

      const channel =
        supabase
          .channel(
            `notification-activity-${user.id}`,
          )
          .on(
            'postgres_changes',
            {
              event:
                '*',

              schema:
                'public',

              table:
                'notification_recipients',

              filter:
                `user_id=eq.${user.id}`,
            },
            () => {
              lastRefreshAtRef.current =
                0;

              refreshIfNeeded();
            },
          )
          .subscribe();

      return () => {
        void supabase
          .removeChannel(
            channel,
          );
      };
    },
    [
      refreshIfNeeded,
      user,
    ],
  );

  // תופעת לוואי לאחר רינדור בהתאם לתלויות [].
  useEffect(
    () => {
      // isCancelled — הנתון isCancelled בהקשר הפעולה.
      let isCancelled =
        false;

      /**
       * פעולה אסינכרונית refreshPushSubscription: רענון התראות Push.
       * @returns Promise<void> — הפלט בהתאם לחתימה.
       */
      const refreshPushSubscription =
        async (): Promise<void> => {
          // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
          try {
            const subscription =
              await pushNotificationService
                .refreshSubscription();

            // טיפול במקרה מיוחד ויציאה מוקדמת כאשר isCancelled || !subscription.
            if (
              isCancelled ||
              !subscription
            ) {
              return;
            }

            console.info(
              'Push subscription refreshed successfully.',
            );
          } catch (
            error
          ) {
            // טיפול במקרה מיוחד ויציאה מוקדמת כאשר isCancelled.
            if (
              isCancelled
            ) {
              return;
            }

            console.error(
              'Failed to refresh Push subscription:',
              error,
            );
          }
        };

      void refreshPushSubscription();

      return () => {
        isCancelled =
          true;
      };
    },
    [],
  );

  return (
    <NotificationContext.Provider
      value={
        notifications
      }
    >
      {
        children
      }
    </NotificationContext.Provider>
  );
}
