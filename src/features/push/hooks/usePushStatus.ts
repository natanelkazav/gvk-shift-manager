/**
 * קובץ: src/features/push/hooks/usePushStatus.ts
 * מטרה: ניהול מצב ותופעות לוואי באמצעות React עבור התראות Push / סטטוס.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: PushStatusState, UsePushStatusResult, getErrorMessage, usePushStatus.
 * - ריכוז ההגדרות והלוגיקה המפורטות בהמשך הקובץ.
 */
import {
  useCallback,
  useState,
} from 'react';

import {
  pushNotificationService,
  type PushPermissionState,
} from '../../../services/pushNotificationService';

/**
 * חוזה הנתונים PushStatusState: התראות Push / סטטוס / מצב.
 */
interface PushStatusState {
  isSupported:
    boolean;

  // permission — הרשאות.
  permission:
    PushPermissionState;

  isSubscribed:
    boolean;

  // isLoading — האם טעינה מתבצעת.
  isLoading:
    boolean;

  isEnabling:
    boolean;

  // error — שגיאה.
  error:
    string | null;
}

/**
 * חוזה הנתונים UsePushStatusResult: התראות Push / סטטוס / תוצאה.
 */
interface UsePushStatusResult {
  // state — מצב.
  state:
    PushStatusState;

  shouldPrompt:
    boolean;

  // shouldShowBlockedMessage — הודעה.
  shouldShowBlockedMessage:
    boolean;

  // loadStatus — סטטוס.
  loadStatus:
    () => Promise<void>;

  // enablePush — התראות Push.
  enablePush:
    () => Promise<boolean>;

  // clearError — שגיאה.
  clearError:
    () => void;
}

// initialState — מצב.
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

  return 'אירעה שגיאה בבדיקת מצב ההתראות.';
}

/**
 * פעולה usePushStatus: חיבור מצב או הקשר עבור התראות Push / סטטוס.
 * @returns UsePushStatusResult — הפלט בהתאם לחתימה.
 */
export function usePushStatus():
  UsePushStatusResult {
  // מצב מקומי: state — מצב; setState מעדכנת אותו ומפעילה רינדור לפי React.
  const [
    state,
    setState,
  ] =
    useState<PushStatusState>(
      initialState,
    );

  // loadStatus — סטטוס.
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

        // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
        try {
          // status — סטטוס.
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

  // enablePush — התראות Push.
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

        // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
        try {
          await pushNotificationService
            .enablePush();

          // status — סטטוס.
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

  const shouldPrompt =
    state.isSupported &&
    state.permission !==
      'denied' &&
    state.permission !==
      'unsupported' &&
    !state.isSubscribed;

  // shouldShowBlockedMessage — הודעה.
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