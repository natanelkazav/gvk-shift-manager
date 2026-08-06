import {
  createContext,
} from 'react';

import type {
  usePushStatus,
} from '../hooks/usePushStatus';

export type PushStatusContextValue =
  ReturnType<
    typeof usePushStatus
  >;

export const PushStatusContext =
  createContext<
    PushStatusContextValue | null
  >(null);