/**
 * קובץ: src/hooks/useMorningDriverSchedule.ts
 * מטרה: ניהול מצב ותופעות לוואי באמצעות React עבור כונני בוקר.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: MorningDriverScheduleState, normalizeError, useMorningDriverSchedule.
 * - ריכוז ההגדרות והלוגיקה המפורטות בהמשך הקובץ.
 */
import {
  useCallback,
  useState,
} from 'react';

import {
  morningDriverScheduleService,
} from '../services/morningDriverScheduleService';

import type {
  CreateMorningDriverScheduleDraftResponse,
  MorningDriverScheduleData,
  PublishMorningDriverScheduleResponse,
  SetMorningDriverIntentionallyUnassignedRequest,
  UpdateMorningDriverScheduleAssignmentRequest,
  UpdateMorningDriverScheduleAssignmentResponse,
  UpdateMorningDriverShiftTimeRequest,
  TransferMyMorningDriverAssignmentRequest,
  TransferMyMorningDriverAssignmentResponse,
} from '../types/morningDriverSchedule';

/**
 * חוזה הנתונים MorningDriverScheduleState: כונני בוקר.
 */
interface MorningDriverScheduleState {
  // data — נתונים.
  data:
    MorningDriverScheduleData | null;

  // isLoading — האם טעינה מתבצעת.
  isLoading: boolean;

  isCreating: boolean;

  // updatingAssignmentId — הקצאה / מזהה.
  updatingAssignmentId:
    string | null;

  // transferringAssignmentId — הקצאה / מזהה.
  transferringAssignmentId:
    string | null;

  isPublishing: boolean;

  // error — שגיאה.
  error:
    string | null;

  // lastCreatedResult — תוצאה.
  lastCreatedResult:
    CreateMorningDriverScheduleDraftResponse | null;

  // lastUpdatedResult — תוצאה.
  lastUpdatedResult:
    UpdateMorningDriverScheduleAssignmentResponse | null;

  // lastTransferredResult — תוצאה.
  lastTransferredResult:
    TransferMyMorningDriverAssignmentResponse | null;

  // lastPublishedResult — פורסם / תוצאה.
  lastPublishedResult:
    PublishMorningDriverScheduleResponse | null;
}

// initialState — מצב.
const initialState:
  MorningDriverScheduleState = {
    data:
      null,

    isLoading:
      false,

    isCreating:
      false,

    updatingAssignmentId:
      null,

    transferringAssignmentId:
      null,

    isPublishing:
      false,

    error:
      null,

    lastCreatedResult:
      null,

    lastUpdatedResult:
      null,

    lastTransferredResult:
      null,

    lastPublishedResult:
      null,
  };

/**
 * פעולה normalizeError: נרמול שגיאה.
 * @param error — שגיאה.
 * @returns string — הפלט בהתאם לחתימה.
 */
function normalizeError(
  error: unknown,
): string {
  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר error instanceof Error.
  if (
    error instanceof Error
  ) {
    // normalized — הנתון normalized בהקשר הפעולה.
    const normalized =
      error.message
        .trim()
        .toLowerCase();

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר normalized.includes( 'availability period must be closed', ).
    if (
      normalized.includes(
        'availability period must be closed',
      )
    ) {
      return 'יש לסגור את חודש האילוצים לפני יצירת השיבוץ.';
    }

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר normalized.includes( 'minimum morning driver staffing is incomplete', ).
    if (
      normalized.includes(
        'minimum morning driver staffing is incomplete',
      )
    ) {
      return 'לא ניתן לפרסם: חסר לפחות כונן אחד במשמרת אחת או יותר.';
    }

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר normalized.includes( 'not allowed', ).
    if (
      normalized.includes(
        'not allowed',
      )
    ) {
      return 'אין לך הרשאה לנהל את לוח כונני הבוקר.';
    }


    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר normalized.includes( 'only published morning driver schedules can be changed by drivers', ).
    if (
      normalized.includes(
        'only published morning driver schedules can be changed by drivers',
      )
    ) {
      return 'ניתן לשנות כוננות אישית רק לאחר פרסום הלוח.';
    }

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר normalized.includes( 'morning drivers can change assignments only in the current month', ).
    if (
      normalized.includes(
        'morning drivers can change assignments only in the current month',
      )
    ) {
      return 'ניתן לשנות כוננויות אישיות רק בחודש הנוכחי.';
    }

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר normalized.includes( 'past morning driver assignments cannot be changed', ).
    if (
      normalized.includes(
        'past morning driver assignments cannot be changed',
      )
    ) {
      return 'לא ניתן לשנות כוננות שכבר עברה.';
    }

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר normalized.includes( 'morning driver can transfer only their own assignment', ).
    if (
      normalized.includes(
        'morning driver can transfer only their own assignment',
      )
    ) {
      return 'ניתן להעביר רק כוננות שמשובצת על שמך.';
    }

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר normalized.includes( 'locked morning driver assignment cannot be changed', ).
    if (
      normalized.includes(
        'locked morning driver assignment cannot be changed',
      )
    ) {
      return 'הכוננות נעולה ולא ניתן לשנות אותה.';
    }

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר normalized.includes( 'selected morning driver is already assigned to this shift', ).
    if (
      normalized.includes(
        'selected morning driver is already assigned to this shift',
      )
    ) {
      return 'כונן הבוקר שנבחר כבר משובץ למשמרת הזו.';
    }

    return error.message;
  }

  return 'לא ניתן היה לבצע את הפעולה בלוח כונני הבוקר.';
}

/**
 * פעולה useMorningDriverSchedule: חיבור מצב או הקשר עבור כונני בוקר.
 */
export function useMorningDriverSchedule() {
  // מצב מקומי: state — מצב; setState מעדכנת אותו ומפעילה רינדור לפי React.
  const [
    state,
    setState,
  ] =
    useState<MorningDriverScheduleState>(
      initialState,
    );

  // loadSchedule — שיבוץ.
  const loadSchedule =
    useCallback(
      async (
        year:
          number | null = null,

        month:
          number | null = null,
      ): Promise<MorningDriverScheduleData | null> => {
        setState(
          (
            current,
          ) => ({
            ...current,

            isLoading:
              true,

            error:
              null,
          }),
        );

        // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
        try {
          // data — נתונים.
          const data =
            await morningDriverScheduleService
              .getSchedule(
                null,
                year,
                month,
              );

          setState(
            (
              current,
            ) => ({
              ...current,

              data,

              isLoading:
                false,

              error:
                null,
            }),
          );

          return data;
        } catch (
          error
        ) {
          setState(
            (
              current,
            ) => ({
              ...current,

              data:
                null,

              isLoading:
                false,

              error:
                normalizeError(
                  error,
                ),
            }),
          );

          throw error;
        }
      },
      [],
    );

  // createDraft — טיוטה.
  const createDraft =
    useCallback(
      async (
        availabilityPeriodId: string,
      ): Promise<CreateMorningDriverScheduleDraftResponse> => {
        setState(
          (
            current,
          ) => ({
            ...current,

            isCreating:
              true,

            error:
              null,

            lastCreatedResult:
              null,
          }),
        );

        // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
        try {
          // result — תוצאה.
          const result =
            await morningDriverScheduleService
              .createDraft(
                availabilityPeriodId,
              );

          // data — נתונים.
          const data =
            await morningDriverScheduleService
              .getSchedule(
                result.schedulePeriodId,
              );

          setState(
            (
              current,
            ) => ({
              ...current,

              data,

              isCreating:
                false,

              error:
                null,

              lastCreatedResult:
                result,
            }),
          );

          return result;
        } catch (
          error
        ) {
          setState(
            (
              current,
            ) => ({
              ...current,

              isCreating:
                false,

              error:
                normalizeError(
                  error,
                ),
            }),
          );

          throw error;
        }
      },
      [],
    );

  // updateAssignment — הקצאה.
  const updateAssignment =
    useCallback(
      async (
        request:
          UpdateMorningDriverScheduleAssignmentRequest,
      ): Promise<UpdateMorningDriverScheduleAssignmentResponse> => {
        setState(
          (
            current,
          ) => ({
            ...current,

            updatingAssignmentId:
              request.assignmentId,

            error:
              null,

            lastUpdatedResult:
              null,
          }),
        );

        // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
        try {
          // result — תוצאה.
          const result =
            await morningDriverScheduleService
              .updateAssignment(
                request,
              );

          // data — נתונים.
          const data =
            state.data
              ? await morningDriverScheduleService
                  .getSchedule(
                    state.data.period.id,
                  )
              : null;

          setState(
            (
              current,
            ) => ({
              ...current,

              data,

              updatingAssignmentId:
                null,

              error:
                null,

              lastUpdatedResult:
                result,
            }),
          );

          return result;
        } catch (
          error
        ) {
          setState(
            (
              current,
            ) => ({
              ...current,

              updatingAssignmentId:
                null,

              error:
                normalizeError(
                  error,
                ),
            }),
          );

          throw error;
        }
      },
      [
        state.data,
      ],
    );

  // updateShiftTime — משמרת / זמן.
  const updateShiftTime =
    useCallback(
      async (request: UpdateMorningDriverShiftTimeRequest): Promise<void> => {
        setState((current) => ({ ...current, error: null }));
        // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
        try {
          await morningDriverScheduleService.updateShiftTime(request);
          // data — נתונים.
          const data = state.data
            ? await morningDriverScheduleService.getSchedule(state.data.period.id)
            : null;
          setState((current) => ({ ...current, data, error: null }));
        } catch (error) {
          setState((current) => ({ ...current, error: normalizeError(error) }));
          throw error;
        }
      },
      [state.data],
    );

  // setIntentionallyUnassigned — קבוצה ייחודית.
  const setIntentionallyUnassigned =
    useCallback(
      async (
        request:
          SetMorningDriverIntentionallyUnassignedRequest,
      ): Promise<void> => {
        setState(
          (current) => ({
            ...current,
            updatingAssignmentId:
              request.assignmentId,
            error: null,
          }),
        );

        // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
        try {
          await morningDriverScheduleService
            .setIntentionallyUnassigned(
              request,
            );

          // data — נתונים.
          const data =
            state.data
              ? await morningDriverScheduleService
                  .getSchedule(
                    state.data.period.id,
                  )
              : null;

          setState(
            (current) => ({
              ...current,
              data,
              updatingAssignmentId: null,
              error: null,
            }),
          );
        } catch (error) {
          setState(
            (current) => ({
              ...current,
              updatingAssignmentId: null,
              error: normalizeError(error),
            }),
          );
          throw error;
        }
      },
      [state.data],
    );

  // publishSchedule — שיבוץ.
  const publishSchedule =
    useCallback(
      async (): Promise<PublishMorningDriverScheduleResponse> => {
        // עצירת הפעולה עם שגיאה כאשר !state.data.
        if (
          !state.data
        ) {
          throw new Error(
            'לא נטען לוח כונני בוקר.',
          );
        }

        setState(
          (
            current,
          ) => ({
            ...current,

            isPublishing:
              true,

            error:
              null,

            lastPublishedResult:
              null,
          }),
        );

        // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
        try {
          // result — תוצאה.
          const result =
            await morningDriverScheduleService
              .publishSchedule(
                state.data.period.id,
              );

          // data — נתונים.
          const data =
            await morningDriverScheduleService
              .getSchedule(
                state.data.period.id,
              );

          setState(
            (
              current,
            ) => ({
              ...current,

              data,

              isPublishing:
                false,

              error:
                null,

              lastPublishedResult:
                result,
            }),
          );

          return result;
        } catch (
          error
        ) {
          setState(
            (
              current,
            ) => ({
              ...current,

              isPublishing:
                false,

              error:
                normalizeError(
                  error,
                ),
            }),
          );

          throw error;
        }
      },
      [
        state.data,
      ],
    );


  // transferMyAssignment — הקצאה.
  const transferMyAssignment =
    useCallback(
      async (
        request:
          TransferMyMorningDriverAssignmentRequest,
      ): Promise<TransferMyMorningDriverAssignmentResponse> => {
        // normalizedAssignmentId — הקצאה / מזהה.
        const normalizedAssignmentId =
          request.assignmentId.trim();

        // schedulePeriodId — תקופת שיבוץ.
        const schedulePeriodId =
          state.data?.period.id ??
          null;

        // עצירת הפעולה עם שגיאה כאשר !normalizedAssignmentId.
        if (
          !normalizedAssignmentId
        ) {
          throw new Error(
            'Morning driver assignment id is required.',
          );
        }

        // עצירת הפעולה עם שגיאה כאשר !schedulePeriodId.
        if (
          !schedulePeriodId
        ) {
          throw new Error(
            'Morning driver schedule period id is required.',
          );
        }

        setState(
          (
            current,
          ) => ({
            ...current,

            transferringAssignmentId:
              normalizedAssignmentId,

            error:
              null,

            lastTransferredResult:
              null,
          }),
        );

        // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
        try {
          // result — תוצאה.
          const result =
            await morningDriverScheduleService
              .transferMyAssignment({
                assignmentId:
                  normalizedAssignmentId,

                newDriverId:
                  request.newDriverId.trim(),
              });

          // data — נתונים.
          const data =
            await morningDriverScheduleService
              .getSchedule(
                schedulePeriodId,
              );

          setState(
            (
              current,
            ) => ({
              ...current,

              data,

              transferringAssignmentId:
                null,

              error:
                null,

              lastTransferredResult:
                result,
            }),
          );

          return result;
        } catch (
          error
        ) {
          setState(
            (
              current,
            ) => ({
              ...current,

              transferringAssignmentId:
                null,

              error:
                normalizeError(
                  error,
                ),

              lastTransferredResult:
                null,
            }),
          );

          throw error;
        }
      },
      [
        state.data?.period.id,
      ],
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
    loadSchedule,
    createDraft,
    updateAssignment,
    updateShiftTime,
    setIntentionallyUnassigned,
    transferMyAssignment,
    publishSchedule,
    reset,
  };
}