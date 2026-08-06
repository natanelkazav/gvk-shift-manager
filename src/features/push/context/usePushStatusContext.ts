import {
  useContext,
} from 'react';

import {
  PushStatusContext,
} from './PushStatusContext';

export function usePushStatusContext() {
  const context =
    useContext(
      PushStatusContext,
    );

  if (!context) {
    throw new Error(
      'usePushStatusContext must be used inside PushStatusProvider.',
    );
  }

  return context;
}