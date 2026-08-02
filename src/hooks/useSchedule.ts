import {
  useCallback,
  useState,
} from 'react';

import {
  scheduleService,
  type PublishSchedulePeriodResponse,
  type SaveScheduleDraftRequest,
  type SaveScheduleDraftResponse,
} from '../services/scheduleService';

import type {
  CurrentScheduleData,
} from '../types/schedule';

interface ScheduleState {
  isSaving: boolean;

  isLoadingCurrentSchedule:
    boolean;

  isPublishing: boolean;

  error:
    string | null;

  currentSchedule:
    CurrentScheduleData | null;

  lastSavedDraft:
    SaveScheduleDraftResponse | null;

  lastPublishedSchedule:
    PublishSchedulePeriodResponse | null;
}

interface UseScheduleResult {
  state:
    ScheduleState;

  saveDraft: (
    request:
      SaveScheduleDraftRequest,
  ) => Promise<SaveScheduleDraftResponse>;

  loadCurrentSchedule:
    () => Promise<CurrentScheduleData>;

  publishSchedulePeriod: (
    schedulePeriodId: string,
  ) => Promise<PublishSchedulePeriodResponse>;

  clearError:
    () => void;

  reset:
    () => void;
}

const initialState:
  ScheduleState = {
    isSaving: false,

    isLoadingCurrentSchedule:
      false,

    isPublishing: false,

    error: null,

    currentSchedule: null,

    lastSavedDraft: null,

    lastPublishedSchedule:
      null,
  };

function normalizeScheduleError(
  error: unknown,
): string {
  if (
    error instanceof Error
  ) {
    const normalizedMessage =
      error.message
        .trim()
        .toLowerCase();

    if (
      normalizedMessage.includes(
        'not authenticated',
      )
    ) {
      return 'לא נמצאה התחברות פעילה. יש להתחבר מחדש.';
    }

    if (
      normalizedMessage.includes(
        'profile not found',
      )
    ) {
      return 'פרופיל המשתמש לא נמצא.';
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
        'manager or admin required',
      )
    ) {
      return 'רק מנהל או אדמין יכולים לפרסם את השיבוץ.';
    }

    if (
      normalizedMessage.includes(
        'not allowed',
      )
    ) {
      return 'אין לך הרשאה לצפות או לנהל את השיבוץ.';
    }

    if (
      normalizedMessage.includes(
        'schedule period id is required',
      )
    ) {
      return 'מזהה תקופת השיבוץ חסר.';
    }

    if (
      normalizedMessage.includes(
        'schedule period not found',
      )
    ) {
      return 'תקופת השיבוץ לא נמצאה.';
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
        'schedule has no shifts',
      )
    ) {
      return 'לא ניתן לפרסם שיבוץ ללא משמרות.';
    }

    if (
      normalizedMessage.includes(
        'schedule contains unassigned shifts',
      )
    ) {
      return 'לא ניתן לפרסם את השיבוץ משום שקיימות משמרות ללא מוקדן.';
    }

    if (
      normalizedMessage.includes(
        'schedule contains invalid shifts',
      )
    ) {
      return 'לא ניתן לפרסם את השיבוץ משום שקיימות משמרות עם שעות לא תקינות.';
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
        'archived schedule cannot be published',
      )
    ) {
      return 'לא ניתן לפרסם שיבוץ שנמצא בארכיון.';
    }

    if (
      normalizedMessage.includes(
        'schedule is not ready for publication',
      )
    ) {
      return 'השיבוץ עדיין אינו במצב שמאפשר פרסום.';
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
        'current schedule response is empty',
      )
    ) {
      return 'לא התקבלה תשובה תקינה בעת טעינת השיבוץ.';
    }

    if (
      normalizedMessage.includes(
        'publish schedule response is empty',
      )
    ) {
      return 'לא התקבלה תשובה תקינה בעת פרסום השיבוץ.';
    }

    if (
      normalizedMessage.includes(
        'save schedule response is empty',
      )
    ) {
      return 'לא התקבלה תשובה תקינה בעת שמירת השיבוץ.';
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

  return 'לא ניתן היה לבצע את פעולת השיבוץ.';
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

            lastPublishedSchedule:
              null,
          }),
        );

        try {
          const result =
            await scheduleService
              .saveScheduleDraft(
                request,
              );

          setState(
            (currentState) => ({
              ...currentState,

              isSaving: false,

              error: null,

              lastSavedDraft:
                result,
            }),
          );

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

  const loadCurrentSchedule =
    useCallback(
      async (): Promise<CurrentScheduleData> => {
        setState(
          (currentState) => ({
            ...currentState,

            isLoadingCurrentSchedule:
              true,

            error: null,
          }),
        );

        try {
          const result =
            await scheduleService
              .getCurrentSchedule();

          setState(
            (currentState) => ({
              ...currentState,

              isLoadingCurrentSchedule:
                false,

              error: null,

              currentSchedule:
                result,
            }),
          );

          return result;
        } catch (error) {
          const normalizedError =
            normalizeScheduleError(
              error,
            );

          setState(
            (currentState) => ({
              ...currentState,

              isLoadingCurrentSchedule:
                false,

              error:
                normalizedError,

              currentSchedule:
                null,
            }),
          );

          throw error;
        }
      },
      [],
    );

  const publishSchedulePeriod =
    useCallback(
      async (
        schedulePeriodId: string,
      ): Promise<PublishSchedulePeriodResponse> => {
        const normalizedSchedulePeriodId =
          schedulePeriodId.trim();

        if (
          !normalizedSchedulePeriodId
        ) {
          const missingIdError =
            new Error(
              'Schedule period id is required.',
            );

          setState(
            (currentState) => ({
              ...currentState,

              error:
                normalizeScheduleError(
                  missingIdError,
                ),
            }),
          );

          throw missingIdError;
        }

        setState(
          (currentState) => ({
            ...currentState,

            isPublishing: true,

            error: null,

            lastPublishedSchedule:
              null,
          }),
        );

        try {
          const result =
            await scheduleService
              .publishSchedulePeriod(
                normalizedSchedulePeriodId,
              );

          let refreshedSchedule:
            CurrentScheduleData | null =
              null;

          try {
            refreshedSchedule =
              await scheduleService
                .getCurrentSchedule();
          } catch {
            /*
             * הפרסום עצמו כבר הצליח.
             * אם הרענון נכשל, נשאיר
             * את הנתונים הקיימים ונאפשר
             * רענון ידני מהמסך.
             */
          }

          setState(
            (currentState) => ({
              ...currentState,

              isPublishing: false,

              error: null,

              lastPublishedSchedule:
                result,

              currentSchedule:
                refreshedSchedule ??
                currentState
                  .currentSchedule,
            }),
          );

          return result;
        } catch (error) {
          const normalizedError =
            normalizeScheduleError(
              error,
            );

          setState(
            (currentState) => ({
              ...currentState,

              isPublishing: false,

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
      setState(
        initialState,
      );
    }, []);

  return {
    state,

    saveDraft,

    loadCurrentSchedule,

    publishSchedulePeriod,

    clearError,

    reset,
  };
}