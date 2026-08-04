import {
  useCallback,
  useState,
} from 'react';

import {
  morningDriverAvailabilityService,
} from '../services/morningDriverAvailabilityService';

import type {
  CloseMorningDriverAvailabilityPeriodResponse,
  MorningDriverAvailabilityManagementData,
  ReopenMorningDriverAvailabilitySubmissionResponse,
} from '../types/morningDriverAvailability';

interface MorningDriverAvailabilityManagementState {
  data:
    MorningDriverAvailabilityManagementData | null;

  selectedPeriodId:
    string | null;

  isLoading: boolean;

  reopeningUserId:
    string | null;

  isClosing: boolean;

  error:
    string | null;

  lastReopenResult:
    ReopenMorningDriverAvailabilitySubmissionResponse | null;

  lastCloseResult:
    CloseMorningDriverAvailabilityPeriodResponse | null;
}

const initialState:
  MorningDriverAvailabilityManagementState = {
    data:
      null,

    selectedPeriodId:
      null,

    isLoading:
      false,

    reopeningUserId:
      null,

    isClosing:
      false,

    error:
      null,

    lastReopenResult:
      null,

    lastCloseResult:
      null,
  };

function getErrorMessage(
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
        'not allowed',
      )
    ) {
      return 'אין לך הרשאה לנהל אילוצי כונני בוקר.';
    }

    if (
      normalizedMessage.includes(
        'only submitted availability can be reopened',
      )
    ) {
      return 'ניתן לפתוח מחדש רק הגשה שכבר הוגשה.';
    }

    if (
      normalizedMessage.includes(
        'only open periods support reopening submissions',
      )
    ) {
      return 'ניתן לפתוח הגשה מחדש רק כאשר חודש האילוצים פתוח.';
    }

    if (
      normalizedMessage.includes(
        'not all morning drivers submitted availability',
      )
    ) {
      return 'לא כל כונני הבוקר הגישו אילוצים.';
    }

    if (
      normalizedMessage.includes(
        'only open periods can be closed',
      )
    ) {
      return 'ניתן לסגור רק חודש אילוצים פתוח.';
    }

    return error.message;
  }

  return 'לא ניתן היה לבצע את פעולת הניהול.';
}

export function useMorningDriverAvailabilityManagement() {
  const [
    state,
    setState,
  ] =
    useState<MorningDriverAvailabilityManagementState>(
      initialState,
    );

  const loadManagement =
    useCallback(
      async (
        periodId: string,
      ): Promise<MorningDriverAvailabilityManagementData> => {
        const normalizedPeriodId =
          periodId.trim();

        setState(
          (
            currentState,
          ) => ({
            ...currentState,

            selectedPeriodId:
              normalizedPeriodId,

            isLoading:
              true,

            error:
              null,
          }),
        );

        try {
          const data =
            await morningDriverAvailabilityService
              .getManagementData(
                normalizedPeriodId,
              );

          setState(
            (
              currentState,
            ) => ({
              ...currentState,

              data,

              selectedPeriodId:
                normalizedPeriodId,

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

          throw error;
        }
      },
      [],
    );

  const reopenSubmission =
    useCallback(
      async (
        userId: string,
      ): Promise<ReopenMorningDriverAvailabilitySubmissionResponse> => {
        if (
          !state.selectedPeriodId
        ) {
          throw new Error(
            'לא נבחר חודש אילוצים.',
          );
        }

        setState(
          (
            currentState,
          ) => ({
            ...currentState,

            reopeningUserId:
              userId,

            error:
              null,

            lastReopenResult:
              null,
          }),
        );

        try {
          const result =
            await morningDriverAvailabilityService
              .reopenSubmission(
                state.selectedPeriodId,
                userId,
              );

          const data =
            await morningDriverAvailabilityService
              .getManagementData(
                state.selectedPeriodId,
              );

          setState(
            (
              currentState,
            ) => ({
              ...currentState,

              data,

              reopeningUserId:
                null,

              error:
                null,

              lastReopenResult:
                result,
            }),
          );

          return result;
        } catch (
          error
        ) {
          setState(
            (
              currentState,
            ) => ({
              ...currentState,

              reopeningUserId:
                null,

              error:
                getErrorMessage(
                  error,
                ),
            }),
          );

          throw error;
        }
      },
      [
        state.selectedPeriodId,
      ],
    );

  const closePeriod =
    useCallback(
      async (
        force = false,
      ): Promise<CloseMorningDriverAvailabilityPeriodResponse> => {
        if (
          !state.selectedPeriodId
        ) {
          throw new Error(
            'לא נבחר חודש אילוצים.',
          );
        }

        setState(
          (
            currentState,
          ) => ({
            ...currentState,

            isClosing:
              true,

            error:
              null,

            lastCloseResult:
              null,
          }),
        );

        try {
          const result =
            await morningDriverAvailabilityService
              .closePeriod(
                state.selectedPeriodId,
                force,
              );

          const data =
            await morningDriverAvailabilityService
              .getManagementData(
                state.selectedPeriodId,
              );

          setState(
            (
              currentState,
            ) => ({
              ...currentState,

              data,

              isClosing:
                false,

              error:
                null,

              lastCloseResult:
                result,
            }),
          );

          return result;
        } catch (
          error
        ) {
          setState(
            (
              currentState,
            ) => ({
              ...currentState,

              isClosing:
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
      [
        state.selectedPeriodId,
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

    loadManagement,

    reopenSubmission,

    closePeriod,

    reset,
  };
}
