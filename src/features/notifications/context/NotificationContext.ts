import {
  createContext,
} from 'react';

import type {
  useNotifications,
} from '../hooks/useNotifications';

export type NotificationContextValue =
  ReturnType<
    typeof useNotifications
  >;

export const NotificationContext =
  createContext<
    NotificationContextValue | null
  >(
    null,
  );