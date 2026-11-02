/**
 * קובץ: src/hooks/useSchedule.ts
 * מטרה: ניהול מצב ותופעות לוואי באמצעות React עבור שיבוץ.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: ScheduleState, UseScheduleResult, normalizeScheduleError, useSchedule.
 * - ריכוז ההגדרות והלוגיקה המפורטות בהמשך הקובץ.
 */
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

/**
 * חוזה הנתונים ScheduleState: שיבוץ / מצב.
 */
interface ScheduleState {
  // isSaving — האם שמירה מתבצעת.
  isSaving: boolean;

  // isLoadingCurrentSchedule — האם טעינה מתבצעת.
  isLoadingCurrentSchedule:
    boolean;

  isPublishing: boolean;

  // error — שגיאה.
  error:
    string | null;

  // currentSchedule — שיבוץ.
  currentSchedule:
    CurrentScheduleData | null;

  // lastSavedDraft — טיוטה.
  lastSavedDraft:
    SaveScheduleDraftResponse | null;

  // lastPublishedSchedule — פורסם / שיבוץ.
  lastPublishedSchedule:
    PublishSchedulePeriodResponse | null;
}

/**
 * חוזה הנתונים UseScheduleResult: שיבוץ / תוצאה.
 */
interface UseScheduleResult {
  // state — מצב.
  state:
    ScheduleState;

  // saveDraft — טיוטה.
  saveDraft: (
    request:
      SaveScheduleDraftRequest,
  ) => Promise<SaveScheduleDraftResponse>;

  // loadCurrentSchedule — שיבוץ.
  loadCurrentSchedule:
    () => Promise<CurrentScheduleData>;

  // publishSchedulePeriod — תקופת שיבוץ.
  publishSchedulePeriod: (
    schedulePeriodId: string,
  ) => Promise<PublishSchedulePeriodResponse>;

  // clearError — שגיאה.
  clearError:
    () => void;

  reset:
    () => void;
}

// initialState — מצב.
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

/**
 * פעולה normalizeScheduleError: נרמול שיבוץ / שגיאה.
 * @param error — שגיאה.
 * @returns string — הפלט בהתאם לחתימה.
 */
function normalizeScheduleError(
  error: unknown,
): string {
  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר error instanceof Error.
  if (
    error instanceof Error
  ) {
    // normalizedMessage — הודעה.
    const normalizedMessage =
      error.message
        .trim()
        .toLowerCase();

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר normalizedMessage.includes( 'not authenticated', ).
    if (
      normalizedMessage.includes(
        'not authenticated',
      )
    ) {
      return 'לא נמצאה התחברות פעילה. יש להתחבר מחדש.';
    }

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר normalizedMessage.includes( 'profile not found', ).
    if (
      normalizedMessage.includes(
        'profile not found',
      )
    ) {
      return 'פרופיל המשתמש לא נמצא.';
    }

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר normalizedMessage.includes( 'user not active', ).
    if (
      normalizedMessage.includes(
        'user not active',
      )
    ) {
      return 'המשתמש אינו פעיל.';
    }

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר normalizedMessage.includes( 'manager or admin required', ).
    if (
      normalizedMessage.includes(
        'manager or admin required',
      )
    ) {
      return 'רק מנהל או אדמין יכולים לפרסם את השיבוץ.';
    }

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר normalizedMessage.includes( 'not allowed', ).
    if (
      normalizedMessage.includes(
        'not allowed',
      )
    ) {
      return 'אין לך הרשאה לצפות או לנהל את השיבוץ.';
    }

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר normalizedMessage.includes( 'schedule period id is required', ).
    if (
      normalizedMessage.includes(
        'schedule period id is required',
      )
    ) {
      return 'מזהה תקופת השיבוץ חסר.';
    }

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר normalizedMessage.includes( 'schedule period not found', ).
    if (
      normalizedMessage.includes(
        'schedule period not found',
      )
    ) {
      return 'תקופת השיבוץ לא נמצאה.';
    }

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר normalizedMessage.includes( 'availability period not found', ).
    if (
      normalizedMessage.includes(
        'availability period not found',
      )
    ) {
      return 'תקופת האילוצים לא נמצאה.';
    }

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר normalizedMessage.includes( 'availability period must be closed', ).
    if (
      normalizedMessage.includes(
        'availability period must be closed',
      )
    ) {
      return 'יש לסגור את תקופת האילוצים לפני שמירת השיבוץ.';
    }

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר normalizedMessage.includes( 'every availability shift must have exactly one assignment', ) || normalizedMessage.includes( 'one or more avail.
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

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר normalizedMessage.includes( 'duplicate shift assignments', ).
    if (
      normalizedMessage.includes(
        'duplicate shift assignments',
      )
    ) {
      return 'התקבלו מספר שיבוצים לאותה משמרת.';
    }

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר normalizedMessage.includes( 'schedule has no shifts', ).
    if (
      normalizedMessage.includes(
        'schedule has no shifts',
      )
    ) {
      return 'לא ניתן לפרסם שיבוץ ללא משמרות.';
    }

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר normalizedMessage.includes( 'schedule contains unassigned shifts', ).
    if (
      normalizedMessage.includes(
        'schedule contains unassigned shifts',
      )
    ) {
      return 'לא ניתן לפרסם את השיבוץ משום שקיימות משמרות ללא מוקדן.';
    }

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר normalizedMessage.includes( 'schedule contains invalid shifts', ).
    if (
      normalizedMessage.includes(
        'schedule contains invalid shifts',
      )
    ) {
      return 'לא ניתן לפרסם את השיבוץ משום שקיימות משמרות עם שעות לא תקינות.';
    }

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר normalizedMessage.includes( 'overlapping shifts', ).
    if (
      normalizedMessage.includes(
        'overlapping shifts',
      )
    ) {
      return 'השיבוץ מכיל משמרות חופפות לאותו מוקדן.';
    }

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר normalizedMessage.includes( 'consecutive shifts', ).
    if (
      normalizedMessage.includes(
        'consecutive shifts',
      )
    ) {
      return 'השיבוץ מכיל משמרות רצופות שאסורות לפי כללי המערכת.';
    }

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר normalizedMessage.includes( 'availability warnings require confirmation', ).
    if (
      normalizedMessage.includes(
        'availability warnings require confirmation',
      )
    ) {
      return 'השיבוץ כולל מוקדנים שלא סימנו זמינות. יש לאשר את האזהרות לפני השמירה.';
    }

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר normalizedMessage.includes( 'archived schedule cannot be published', ).
    if (
      normalizedMessage.includes(
        'archived schedule cannot be published',
      )
    ) {
      return 'לא ניתן לפרסם שיבוץ שנמצא בארכיון.';
    }

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר normalizedMessage.includes( 'schedule is not ready for publication', ).
    if (
      normalizedMessage.includes(
        'schedule is not ready for publication',
      )
    ) {
      return 'השיבוץ עדיין אינו במצב שמאפשר פרסום.';
    }

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר normalizedMessage.includes( 'published or archived schedules cannot be overwritten', ).
    if (
      normalizedMessage.includes(
        'published or archived schedules cannot be overwritten',
      )
    ) {
      return 'לא ניתן להחליף שיבוץ שכבר פורסם או הועבר לארכיון.';
    }

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר normalizedMessage.includes( 'current schedule response is empty', ).
    if (
      normalizedMessage.includes(
        'current schedule response is empty',
      )
    ) {
      return 'לא התקבלה תשובה תקינה בעת טעינת השיבוץ.';
    }

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר normalizedMessage.includes( 'publish schedule response is empty', ).
    if (
      normalizedMessage.includes(
        'publish schedule response is empty',
      )
    ) {
      return 'לא התקבלה תשובה תקינה בעת פרסום השיבוץ.';
    }

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר normalizedMessage.includes( 'save schedule response is empty', ).
    if (
      normalizedMessage.includes(
        'save schedule response is empty',
      )
    ) {
      return 'לא התקבלה תשובה תקינה בעת שמירת השיבוץ.';
    }

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר normalizedMessage.includes( 'inactive', ).
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

/**
 * פעולה useSchedule: חיבור מצב או הקשר עבור שיבוץ.
 * @returns UseScheduleResult — הפלט בהתאם לחתימה.
 */
export function useSchedule():
  UseScheduleResult {
  // מצב מקומי: state — מצב; setState מעדכנת אותו ומפעילה רינדור לפי React.
  const [
    state,
    setState,
  ] =
    useState<ScheduleState>(
      initialState,
    );

  // saveDraft — טיוטה.
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

        // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
        try {
          // result — תוצאה.
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
          // normalizedError — שגיאה.
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

  // loadCurrentSchedule — שיבוץ.
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

        // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
        try {
          // result — תוצאה.
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
          // normalizedError — שגיאה.
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

  // publishSchedulePeriod — תקופת שיבוץ.
  const publishSchedulePeriod =
    useCallback(
      async (
        schedulePeriodId: string,
      ): Promise<PublishSchedulePeriodResponse> => {
        // normalizedSchedulePeriodId — תקופת שיבוץ.
        const normalizedSchedulePeriodId =
          schedulePeriodId.trim();

        // עצירת הפעולה עם שגיאה כאשר !normalizedSchedulePeriodId.
        if (
          !normalizedSchedulePeriodId
        ) {
          // missingIdError — מזהה / שגיאה.
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

        // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
        try {
          // result — תוצאה.
          const result =
            await scheduleService
              .publishSchedulePeriod(
                normalizedSchedulePeriodId,
              );

          // refreshedSchedule — שיבוץ.
          let refreshedSchedule:
            CurrentScheduleData | null =
              null;

          // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
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
          // normalizedError — שגיאה.
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

  // clearError — שגיאה.
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