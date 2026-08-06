import {
  useCallback,
  useState,
} from 'react';

import {
  notificationPreferencesService,
  type NotificationPreferences,
  type UpdateNotificationPreferencesRequest,
} from '../services/notificationPreferencesService';

interface NotificationPreferencesState {
  data:
    NotificationPreferences | null;

  isLoading:
    boolean;

  isSaving:
    boolean;

  error:
    string | null;

  isSaved:
    boolean;
}

interface UseNotificationPreferencesResult {
  state:
    NotificationPreferencesState;

  loadPreferences:
    () => Promise<NotificationPreferences>;

  updatePreferences: (
    request:
      UpdateNotificationPreferencesRequest,
  ) => Promise<NotificationPreferences>;

  clearError:
    () => void;

  clearSavedState:
    () => void;

  reset:
    () => void;
}

const initialState:
  NotificationPreferencesState = {
    data:
      null,

    isLoading:
      false,

    isSaving:
      false,

    error:
      null,

    isSaved:
      false,
  };

function getErrorMessage(
  error: unknown,
): string {
  if (
    error instanceof Error
  ) {
    return error.message;
  }

  return 'אירעה שגיאה בניהול הגדרות ההתראות.';
}

export function useNotificationPreferences():
  UseNotificationPreferencesResult {
  const [
    state,
    setState,
  ] =
    useState<NotificationPreferencesState>(
      initialState,
    );

  const loadPreferences =
    useCallback(
      async (): Promise<NotificationPreferences> => {
        setState(
          (
            currentState,
          ) => ({
            ...currentState,

            isLoading:
              true,

            error:
              null,

            isSaved:
              false,
          }),
        );

        try {
          const data =
            await notificationPreferencesService
              .getMyPreferences();

          setState({
            data,

            isLoading:
              false,

            isSaving:
              false,

            error:
              null,

            isSaved:
              false,
          });

          return data;
        } catch (
          error
        ) {
          const normalizedError =
            getErrorMessage(
              error,
            );

          setState(
            (
              currentState,
            ) => ({
              ...currentState,

              isLoading:
                false,

              error:
                normalizedError,

              isSaved:
                false,
            }),
          );

          throw error;
        }
      },
      [],
    );

  const updatePreferences =
    useCallback(
      async (
        request:
          UpdateNotificationPreferencesRequest,
      ): Promise<NotificationPreferences> => {
        setState(
          (
            currentState,
          ) => ({
            ...currentState,

            isSaving:
              true,

            error:
              null,

            isSaved:
              false,
          }),
        );

        try {
          const data =
            await notificationPreferencesService
              .updateMyPreferences(
                request,
              );

          setState({
            data,

            isLoading:
              false,

            isSaving:
              false,

            error:
              null,

            isSaved:
              true,
          });

          return data;
        } catch (
          error
        ) {
          const normalizedError =
            getErrorMessage(
              error,
            );

          setState(
            (
              currentState,
            ) => ({
              ...currentState,

              isSaving:
                false,

              error:
                normalizedError,

              isSaved:
                false,
            }),
          );

          throw error;
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

  const clearSavedState =
    useCallback(
      (): void => {
        setState(
          (
            currentState,
          ) => ({
            ...currentState,

            isSaved:
              false,
          }),
        );
      },
      [],
    );

  const reset =
    useCallback(
      (): void => {
        setState(
          initialState,
        );
      },
      [],
    );

  return {
    state,

    loadPreferences,

    updatePreferences,

    clearError,

    clearSavedState,

    reset,
  };
}