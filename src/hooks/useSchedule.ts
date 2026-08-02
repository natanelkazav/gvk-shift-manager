import {
  useCallback,
  useState,
} from 'react';

import {
  scheduleService,
  type SaveScheduleDraftRequest,
  type SaveScheduleDraftResponse,
} from '../services/scheduleService';

interface ScheduleState {
  isSaving: boolean;

  error:
    string | null;

  lastSavedDraft:
    SaveScheduleDraftResponse | null;
}

interface UseScheduleResult {
  state:
    ScheduleState;

  saveDraft: (
    request:
      SaveScheduleDraftRequest,
  ) => Promise<SaveScheduleDraftResponse>;

  clearError:
    () => void;

  reset:
    () => void;
}

const initialState:
  ScheduleState = {
    isSaving: false,

    error: null,

    lastSavedDraft: null,
  };

function normalizeScheduleError(
  error: unknown,
): string {
  if (
    error instanceof Error
  ) {
    const normalizedMessage =
      error.message.toLowerCase();

    if (
      normalizedMessage.includes(
        'not authenticated',
      )
    ) {
      return 'לא נמצאה התחברות פעילה. יש להתחבר מחדש.';
    }

    if (
      normalizedMessage.includes(
        'user not active',
      )
    ) {
      return 'המשתמש אינו פעיל.';
    }

    if (
      normalizedMessage.includes(
        'not allowed',
      )
    ) {
      return 'אין לך הרשאה לשמור שיבוץ.';
    }

    if (
      normalizedMessage.includes(
        'availability period not found',
      )
    ) {
      return 'תקופת האילוצים לא נמצאה.';
    }

    if (
      normalizedMessage.includes(
        'availability period must be closed',
      )
    ) {
      return 'יש לסגור את תקופת האילוצים לפני שמירת השיבוץ.';
    }

    if (
      normalizedMessage.includes(
        'every availability shift must have exactly one assignment',
      ) ||
      normalizedMessage.includes(
        'one or more availability shifts are missing from the draft',
      )
    ) {
      return 'לא ניתן לשמור שיבוץ חלקי. יש לשבץ את כל המשמרות.';
    }

    if (
      normalizedMessage.includes(
        'duplicate shift assignments',
      )
    ) {
      return 'התקבלו מספר שיבוצים לאותה משמרת.';
    }

    if (
      normalizedMessage.includes(
        'overlapping shifts',
      )
    ) {
      return 'השיבוץ מכיל משמרות חופפות לאותו מוקדן.';
    }

    if (
      normalizedMessage.includes(
        'consecutive shifts',
      )
    ) {
      return 'השיבוץ מכיל משמרות רצופות שאסורות לפי כללי המערכת.';
    }

    if (
      normalizedMessage.includes(
        'availability warnings require confirmation',
      )
    ) {
      return 'השיבוץ כולל מוקדנים שלא סימנו זמינות. יש לאשר את האזהרות לפני השמירה.';
    }

    if (
      normalizedMessage.includes(
        'published or archived schedules cannot be overwritten',
      )
    ) {
      return 'לא ניתן להחליף שיבוץ שכבר פורסם או הועבר לארכיון.';
    }

    if (
      normalizedMessage.includes(
        'inactive',
      )
    ) {
      return 'אחד או יותר מהמוקדנים ששובצו אינם פעילים.';
    }

    return error.message;
  }

  return 'לא ניתן היה לשמור את השיבוץ.';
}

export function useSchedule():
  UseScheduleResult {
  const [
    state,
    setState,
  ] =
    useState<ScheduleState>(
      initialState,
    );

  const saveDraft =
    useCallback(
      async (
        request:
          SaveScheduleDraftRequest,
      ): Promise<SaveScheduleDraftResponse> => {
        setState(
          (currentState) => ({
            ...currentState,

            isSaving: true,

            error: null,
          }),
        );

        try {
          const result =
            await scheduleService
              .saveScheduleDraft(
                request,
              );

          setState({
            isSaving: false,

            error: null,

            lastSavedDraft:
              result,
          });

          return result;
        } catch (error) {
          const normalizedError =
            normalizeScheduleError(
              error,
            );

          setState(
            (currentState) => ({
              ...currentState,

              isSaving: false,

              error:
                normalizedError,
            }),
          );

          throw error;
        }
      },
      [],
    );

  const clearError =
    useCallback((): void => {
      setState(
        (currentState) => ({
          ...currentState,

          error: null,
        }),
      );
    }, []);

  const reset =
    useCallback((): void => {
      setState(initialState);
    }, []);

  return {
    state,

    saveDraft,

    clearError,

    reset,
  };
}