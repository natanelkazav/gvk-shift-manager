/**
 * קובץ: src/hooks/useNotificationPreferences.ts
 * מטרה: ניהול מצב ותופעות לוואי באמצעות React עבור התראות.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: NotificationPreferencesState, UseNotificationPreferencesResult, getErrorMessage, useNotificationPreferences.
 * - ריכוז ההגדרות והלוגיקה המפורטות בהמשך הקובץ.
 */
import {
  useCallback,
  useState,
} from 'react';

import {
  notificationPreferencesService,
  type NotificationPreferences,
  type UpdateNotificationPreferencesRequest,
} from '../services/notificationPreferencesService';

/**
 * חוזה הנתונים NotificationPreferencesState: התראות / מצב.
 */
interface NotificationPreferencesState {
  // data — נתונים.
  data:
    NotificationPreferences | null;

  // isLoading — האם טעינה מתבצעת.
  isLoading:
    boolean;

  // isSaving — האם שמירה מתבצעת.
  isSaving:
    boolean;

  // error — שגיאה.
  error:
    string | null;

  isSaved:
    boolean;
}

/**
 * חוזה הנתונים UseNotificationPreferencesResult: התראות / תוצאה.
 */
interface UseNotificationPreferencesResult {
  // state — מצב.
  state:
    NotificationPreferencesState;

  loadPreferences:
    () => Promise<NotificationPreferences>;

  updatePreferences: (
    request:
      UpdateNotificationPreferencesRequest,
  ) => Promise<NotificationPreferences>;

  // clearError — שגיאה.
  clearError:
    () => void;

  // clearSavedState — מצב.
  clearSavedState:
    () => void;

  reset:
    () => void;
}

// initialState — מצב.
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

  return 'אירעה שגיאה בניהול הגדרות ההתראות.';
}

/**
 * פעולה useNotificationPreferences: חיבור מצב או הקשר עבור התראות.
 * @returns UseNotificationPreferencesResult — הפלט בהתאם לחתימה.
 */
export function useNotificationPreferences():
  UseNotificationPreferencesResult {
  // מצב מקומי: state — מצב; setState מעדכנת אותו ומפעילה רינדור לפי React.
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

        // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
        try {
          // data — נתונים.
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
          // normalizedError — שגיאה.
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

        // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
        try {
          // data — נתונים.
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
          // normalizedError — שגיאה.
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

  // clearSavedState — מצב.
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