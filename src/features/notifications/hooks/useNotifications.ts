/**
 * קובץ: src/features/notifications/hooks/useNotifications.ts
 * מטרה: ניהול מצב ותופעות לוואי באמצעות React עבור התראות.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: NotificationsState, UseNotificationsResult, getErrorMessage, useNotifications.
 * - ריכוז ההגדרות והלוגיקה המפורטות בהמשך הקובץ.
 */
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

/**
 * חוזה הנתונים NotificationsState: התראות / מצב.
 */
interface NotificationsState {
  // notifications — התראות.
  notifications:
    MyNotification[];

  // pendingRequestCount — ממתין / נתוני הבקשה / כמות.
  pendingRequestCount:
    number;

  // isLoading — האם טעינה מתבצעת.
  isLoading:
    boolean;

  isUpdating:
    boolean;

  // error — שגיאה.
  error:
    string | null;
}

/**
 * חוזה הנתונים UseNotificationsResult: התראות / תוצאה.
 */
interface UseNotificationsResult {
  // state — מצב.
  state:
    NotificationsState;

  // unreadCount — כמות.
  unreadCount:
    number;

  // pendingRequestCount — ממתין / נתוני הבקשה / כמות.
  pendingRequestCount:
    number;

  // activityCount — כמות.
  activityCount:
    number;

  // loadNotifications — התראות.
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

  // clearError — שגיאה.
  clearError:
    () => void;
}

// initialState — מצב.
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

/**
 * פעולה getErrorMessage: שליפה או חישוב של הודעת שגיאה.
 * @param error — שגיאה.
 * @returns string — הפלט בהתאם לחתימה.
 */
function getErrorMessage(
  error: unknown,
): string {
  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר error instanceof Error.
  if (
    error instanceof Error
  ) {
    return error.message;
  }

  return 'אירעה שגיאה בניהול ההתראות.';
}

/**
 * פעולה useNotifications: חיבור מצב או הקשר עבור התראות.
 * @returns UseNotificationsResult — הפלט בהתאם לחתימה.
 */
export function useNotifications():
  UseNotificationsResult {
  const {
    hasPermission,
  } =
    useAuth();

  // canApproveShiftSwaps — החלפת משמרות.
  const canApproveShiftSwaps =
    hasPermission(
      'shift_swaps.approve',
    );

  // מצב מקומי: state — מצב; setState מעדכנת אותו ומפעילה רינדור לפי React.
  const [
    state,
    setState,
  ] =
    useState<NotificationsState>(
      initialState,
    );

  // fetchPendingRequestCount — ממתין / נתוני הבקשה / כמות.
  const fetchPendingRequestCount =
    useCallback(
      async (): Promise<number> => {
        // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !canApproveShiftSwaps.
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

  // loadNotifications — התראות.
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

        // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
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
        // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
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

        // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
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

        // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
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

  // clearError — שגיאה.
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

  // ערך מחושב unreadCount — כמות; נשמר בין רינדורים עד שינוי התלויות.
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

  // activityCount — כמות.
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
