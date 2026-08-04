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
  UpdateMorningDriverScheduleAssignmentRequest,
  UpdateMorningDriverScheduleAssignmentResponse,
  TransferMyMorningDriverAssignmentRequest,
  TransferMyMorningDriverAssignmentResponse,
} from '../types/morningDriverSchedule';

interface MorningDriverScheduleState {
  data:
    MorningDriverScheduleData | null;

  isLoading: boolean;

  isCreating: boolean;

  updatingAssignmentId:
    string | null;

  transferringAssignmentId:
    string | null;

  isPublishing: boolean;

  error:
    string | null;

  lastCreatedResult:
    CreateMorningDriverScheduleDraftResponse | null;

  lastUpdatedResult:
    UpdateMorningDriverScheduleAssignmentResponse | null;

  lastTransferredResult:
    TransferMyMorningDriverAssignmentResponse | null;

  lastPublishedResult:
    PublishMorningDriverScheduleResponse | null;
}

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

function normalizeError(
  error: unknown,
): string {
  if (
    error instanceof Error
  ) {
    const normalized =
      error.message
        .trim()
        .toLowerCase();

    if (
      normalized.includes(
        'availability period must be closed',
      )
    ) {
      return 'יש לסגור את חודש האילוצים לפני יצירת השיבוץ.';
    }

    if (
      normalized.includes(
        'minimum morning driver staffing is incomplete',
      )
    ) {
      return 'לא ניתן לפרסם: חסר לפחות כונן אחד במשמרת אחת או יותר.';
    }

    if (
      normalized.includes(
        'not allowed',
      )
    ) {
      return 'אין לך הרשאה לנהל את לוח כונני הבוקר.';
    }


    if (
      normalized.includes(
        'only published morning driver schedules can be changed by drivers',
      )
    ) {
      return 'ניתן לשנות כוננות אישית רק לאחר פרסום הלוח.';
    }

    if (
      normalized.includes(
        'morning drivers can change assignments only in the current month',
      )
    ) {
      return 'ניתן לשנות כוננויות אישיות רק בחודש הנוכחי.';
    }

    if (
      normalized.includes(
        'past morning driver assignments cannot be changed',
      )
    ) {
      return 'לא ניתן לשנות כוננות שכבר עברה.';
    }

    if (
      normalized.includes(
        'morning driver can transfer only their own assignment',
      )
    ) {
      return 'ניתן להעביר רק כוננות שמשובצת על שמך.';
    }

    if (
      normalized.includes(
        'locked morning driver assignment cannot be changed',
      )
    ) {
      return 'הכוננות נעולה ולא ניתן לשנות אותה.';
    }

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

export function useMorningDriverSchedule() {
  const [
    state,
    setState,
  ] =
    useState<MorningDriverScheduleState>(
      initialState,
    );

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

        try {
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

        try {
          const result =
            await morningDriverScheduleService
              .createDraft(
                availabilityPeriodId,
              );

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

        try {
          const result =
            await morningDriverScheduleService
              .updateAssignment(
                request,
              );

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

  const publishSchedule =
    useCallback(
      async (): Promise<PublishMorningDriverScheduleResponse> => {
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

        try {
          const result =
            await morningDriverScheduleService
              .publishSchedule(
                state.data.period.id,
              );

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


  const transferMyAssignment =
    useCallback(
      async (
        request:
          TransferMyMorningDriverAssignmentRequest,
      ): Promise<TransferMyMorningDriverAssignmentResponse> => {
        const normalizedAssignmentId =
          request.assignmentId.trim();

        const schedulePeriodId =
          state.data?.period.id ??
          null;

        if (
          !normalizedAssignmentId
        ) {
          throw new Error(
            'Morning driver assignment id is required.',
          );
        }

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

        try {
          const result =
            await morningDriverScheduleService
              .transferMyAssignment({
                assignmentId:
                  normalizedAssignmentId,

                newDriverId:
                  request.newDriverId.trim(),
              });

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
    transferMyAssignment,
    publishSchedule,
    reset,
  };
}