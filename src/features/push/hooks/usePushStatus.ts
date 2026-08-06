import {
  useCallback,
  useState,
} from 'react';

import {
  pushNotificationService,
  type PushPermissionState,
} from '../../../services/pushNotificationService';

interface PushStatusState {
  isSupported:
    boolean;

  permission:
    PushPermissionState;

  isSubscribed:
    boolean;

  isLoading:
    boolean;

  isEnabling:
    boolean;

  error:
    string | null;
}

interface UsePushStatusResult {
  state:
    PushStatusState;

  shouldPrompt:
    boolean;

  shouldShowBlockedMessage:
    boolean;

  loadStatus:
    () => Promise<void>;

  enablePush:
    () => Promise<boolean>;

  clearError:
    () => void;
}

const initialState:
  PushStatusState = {
    isSupported:
      false,

    permission:
      'unsupported',

    isSubscribed:
      false,

    isLoading:
      false,

    isEnabling:
      false,

    error:
      null,
  };

function getErrorMessage(
  error: unknown,
): string {
  if (
    error instanceof Error
  ) {
    return error.message;
  }

  return 'אירעה שגיאה בבדיקת מצב ההתראות.';
}

export function usePushStatus():
  UsePushStatusResult {
  const [
    state,
    setState,
  ] =
    useState<PushStatusState>(
      initialState,
    );

  const loadStatus =
    useCallback(
      async (): Promise<void> => {
        setState(
          (
            currentState,
          ) => ({
            ...currentState,

            isLoading:
              true,

            error:
              null,
          }),
        );

        try {
          const status =
            await pushNotificationService
              .getStatus();

          setState({
            isSupported:
              status.isSupported,

            permission:
              status.permission,

            isSubscribed:
              status.isSubscribed,

            isLoading:
              false,

            isEnabling:
              false,

            error:
              null,
          });
        } catch (
          error
        ) {
          setState(
            (
              currentState,
            ) => ({
              ...currentState,

              isLoading:
                false,

              error:
                getErrorMessage(
                  error,
                ),
            }),
          );
        }
      },
      [],
    );

  const enablePush =
    useCallback(
      async (): Promise<boolean> => {
        setState(
          (
            currentState,
          ) => ({
            ...currentState,

            isEnabling:
              true,

            error:
              null,
          }),
        );

        try {
          await pushNotificationService
            .enablePush();

          const status =
            await pushNotificationService
              .getStatus();

          setState({
            isSupported:
              status.isSupported,

            permission:
              status.permission,

            isSubscribed:
              status.isSubscribed,

            isLoading:
              false,

            isEnabling:
              false,

            error:
              null,
          });

          return status.isSubscribed;
        } catch (
          error
        ) {
          setState(
            (
              currentState,
            ) => ({
              ...currentState,

              isEnabling:
                false,

              error:
                getErrorMessage(
                  error,
                ),
            }),
          );

          return false;
        }
      },
      [],
    );

  const clearError =
    useCallback(
      (): void => {
        setState(
          (
            currentState,
          ) => ({
            ...currentState,

            error:
              null,
          }),
        );
      },
      [],
    );

  const shouldPrompt =
    state.isSupported &&
    state.permission ===
      'default' &&
    !state.isSubscribed;

  const shouldShowBlockedMessage =
    state.isSupported &&
    state.permission ===
      'denied' &&
    !state.isSubscribed;

  return {
    state,

    shouldPrompt,

    shouldShowBlockedMessage,

    loadStatus,

    enablePush,

    clearError,
  };
}