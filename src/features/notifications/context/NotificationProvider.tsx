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

const BACKGROUND_REFRESH_INTERVAL_MS =
  30_000;

const MIN_EVENT_REFRESH_GAP_MS =
  2_500;

export function NotificationProvider({
  children,
}: PropsWithChildren) {
  const {
    user,
  } =
    useAuth();

  const location =
    useLocation();

  const notifications =
    useNotifications();

  const {
    loadNotifications,
    refreshActivity,
  } =
    notifications;

  const lastRefreshAtRef =
    useRef(
      0,
    );

  const refreshIfNeeded =
    useCallback(
      (): void => {
        const now =
          Date.now();

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

  useEffect(
    () => {
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

  useEffect(
    () => {
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

  useEffect(
    () => {
      const handleFocus =
        (): void => {
          refreshIfNeeded();
        };

      const handleVisibilityChange =
        (): void => {
          if (
            document.visibilityState ===
              'visible'
          ) {
            refreshIfNeeded();
          }
        };

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

  useEffect(
    () => {
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

  useEffect(
    () => {
      let isCancelled =
        false;

      const refreshPushSubscription =
        async (): Promise<void> => {
          try {
            const subscription =
              await pushNotificationService
                .refreshSubscription();

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
