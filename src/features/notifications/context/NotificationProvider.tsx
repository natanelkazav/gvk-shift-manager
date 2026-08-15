import {
  useEffect,
  type PropsWithChildren,
} from 'react';

import {
  pushNotificationService,
} from '../../../services/pushNotificationService';

import {
  useNotifications,
} from '../hooks/useNotifications';

import {
  NotificationContext,
} from './NotificationContext';

export function NotificationProvider({
  children,
}: PropsWithChildren) {
  const notifications =
    useNotifications();

  const {
    loadNotifications,
  } =
    notifications;

  useEffect(
    () => {
      const timeoutId =
        window.setTimeout(
          () => {
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
