import {
  useCallback,
  useMemo,
  useState,
} from 'react';

import {
  notificationService,
  type MyNotification,
} from '../services/notificationService';

interface NotificationsState {
  notifications:
    MyNotification[];

  isLoading:
    boolean;

  isUpdating:
    boolean;

  error:
    string | null;
}

interface UseNotificationsResult {
  state:
    NotificationsState;

  unreadCount:
    number;

  loadNotifications:
    () => Promise<void>;

  markAsRead:
    (
      recipientId:
        string,
    ) => Promise<void>;

  markAllAsRead:
    () => Promise<void>;

  clearError:
    () => void;
}

const initialState:
  NotificationsState = {
    notifications:
      [],

    isLoading:
      false,

    isUpdating:
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

  return 'אירעה שגיאה בניהול ההתראות.';
}

export function useNotifications():
  UseNotificationsResult {
  const [
    state,
    setState,
  ] =
    useState<NotificationsState>(
      initialState,
    );

  const loadNotifications =
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
          const notifications =
            await notificationService
              .getMyNotifications();

          setState(
            (
              currentState,
            ) => ({
              ...currentState,

              notifications,

              isLoading:
                false,

              error:
                null,
            }),
          );
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

  const markAsRead =
    useCallback(
      async (
        recipientId:
          string,
      ): Promise<void> => {
        setState(
          (
            currentState,
          ) => ({
            ...currentState,

            isUpdating:
              true,

            error:
              null,
          }),
        );

        try {
          await notificationService
            .markAsRead(
              recipientId,
            );

          const readAt =
            new Date()
              .toISOString();

          setState(
            (
              currentState,
            ) => ({
              ...currentState,

              notifications:
                currentState
                  .notifications
                  .map(
                    (
                      notification,
                    ) =>
                      notification
                        .recipientId ===
                      recipientId
                        ? {
                            ...notification,

                            isRead:
                              true,

                            readAt,
                          }
                        : notification,
                  ),

              isUpdating:
                false,

              error:
                null,
            }),
          );
        } catch (
          error
        ) {
          setState(
            (
              currentState,
            ) => ({
              ...currentState,

              isUpdating:
                false,

              error:
                getErrorMessage(
                  error,
                ),
            }),
          );

          throw error;
        }
      },
      [],
    );

  const markAllAsRead =
    useCallback(
      async (): Promise<void> => {
        setState(
          (
            currentState,
          ) => ({
            ...currentState,

            isUpdating:
              true,

            error:
              null,
          }),
        );

        try {
          await notificationService
            .markAllAsRead();

          const readAt =
            new Date()
              .toISOString();

          setState(
            (
              currentState,
            ) => ({
              ...currentState,

              notifications:
                currentState
                  .notifications
                  .map(
                    (
                      notification,
                    ) => ({
                      ...notification,

                      isRead:
                        true,

                      readAt:
                        notification
                          .readAt ??
                        readAt,
                    }),
                  ),

              isUpdating:
                false,

              error:
                null,
            }),
          );
        } catch (
          error
        ) {
          setState(
            (
              currentState,
            ) => ({
              ...currentState,

              isUpdating:
                false,

              error:
                getErrorMessage(
                  error,
                ),
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

  const unreadCount =
    useMemo(
      () =>
        state.notifications
          .filter(
            (
              notification,
            ) =>
              !notification
                .isRead,
          )
          .length,
      [
        state.notifications,
      ],
    );

  return {
    state,

    unreadCount,

    loadNotifications,

    markAsRead,

    markAllAsRead,

    clearError,
  };
}