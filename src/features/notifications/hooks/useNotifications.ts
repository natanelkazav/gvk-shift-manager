import {
  useCallback,
  useMemo,
  useState,
} from 'react';

import {
  useAuth,
} from '../../../auth/AuthContext';

import {
  shiftSwapService,
} from '../../../services/shiftSwapService';

import {
  notificationService,
  type MyNotification,
} from '../services/notificationService';

interface NotificationsState {
  notifications:
    MyNotification[];

  pendingRequestCount:
    number;

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

  pendingRequestCount:
    number;

  activityCount:
    number;

  loadNotifications:
    () => Promise<void>;

  refreshActivity:
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

    pendingRequestCount:
      0,

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
  const {
    hasPermission,
  } =
    useAuth();

  const canApproveShiftSwaps =
    hasPermission(
      'shift_swaps.approve',
    );

  const [
    state,
    setState,
  ] =
    useState<NotificationsState>(
      initialState,
    );

  const fetchPendingRequestCount =
    useCallback(
      async (): Promise<number> => {
        if (
          !canApproveShiftSwaps
        ) {
          return 0;
        }

        const requests =
          await shiftSwapService
            .getRequests();

        return requests.filter(
          (
            request,
          ) =>
            request.status ===
              'pending_manager',
        ).length;
      },
      [
        canApproveShiftSwaps,
      ],
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
          const [
            notifications,
            pendingRequestCount,
          ] =
            await Promise.all([
              notificationService
                .getMyNotifications(),

              fetchPendingRequestCount(),
            ]);

          setState(
            (
              currentState,
            ) => ({
              ...currentState,

              notifications,

              pendingRequestCount,

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
      [
        fetchPendingRequestCount,
      ],
    );

  const refreshActivity =
    useCallback(
      async (): Promise<void> => {
        try {
          const [
            notifications,
            pendingRequestCount,
          ] =
            await Promise.all([
              notificationService
                .getMyNotifications(),

              fetchPendingRequestCount(),
            ]);

          setState(
            (
              currentState,
            ) => ({
              ...currentState,

              notifications,

              pendingRequestCount,

              error:
                null,
            }),
          );
        } catch (
          error
        ) {
          console.error(
            'Background notification refresh failed:',
            error,
          );
        }
      },
      [
        fetchPendingRequestCount,
      ],
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

  const activityCount =
    unreadCount +
    state.pendingRequestCount;

  return {
    state,

    unreadCount,

    pendingRequestCount:
      state.pendingRequestCount,

    activityCount,

    loadNotifications,

    refreshActivity,

    markAsRead,

    markAllAsRead,

    clearError,
  };
}
