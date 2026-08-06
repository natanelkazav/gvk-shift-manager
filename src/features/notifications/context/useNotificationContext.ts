import {
  useContext,
} from 'react';

import {
  NotificationContext,
} from './NotificationContext';

export function useNotificationContext() {
  const context =
    useContext(
      NotificationContext,
    );

  if (
    !context
  ) {
    throw new Error(
      'useNotificationContext must be used inside NotificationProvider.',
    );
  }

  return context;
}