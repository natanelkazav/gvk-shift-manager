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

export function PushStatusProvider({
  children,
}: PropsWithChildren) {
  const pushStatus =
    usePushStatus();

  const {
    loadStatus,
  } =
    pushStatus;

  useEffect(
    () => {
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

  useEffect(
    () => {
      const handleFocus =
        (): void => {
          void loadStatus();
        };

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
