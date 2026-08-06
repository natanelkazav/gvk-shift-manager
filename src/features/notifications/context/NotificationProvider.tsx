import {
  useEffect,
  type PropsWithChildren,
} from 'react';

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