import {
  useCallback,
  useState,
} from 'react';

import {
  morningDriverAvailabilityService,
} from '../services/morningDriverAvailabilityService';

import type {
  CreateMorningDriverAvailabilityPeriodRequest,
  CreateMorningDriverAvailabilityPeriodResponse,
  DeleteMorningDriverAvailabilityPeriodResponse,
  MorningDriverAvailabilityPeriodListItem,
  OpenMorningDriverAvailabilityPeriodResponse,
  ReopenMorningDriverAvailabilityPeriodResponse,
} from '../types/morningDriverAvailability';

interface MorningDriverAvailabilityPeriodsState {
  periods:
    MorningDriverAvailabilityPeriodListItem[];

  isLoading:
    boolean;

  isCreating:
    boolean;

  openingPeriodId:
    string | null;

  reopeningPeriodId:
    string | null;

  deletingPeriodId:
    string | null;

  error:
    string | null;

  lastCreatedResult:
    CreateMorningDriverAvailabilityPeriodResponse | null;

  lastOpenedResult:
    OpenMorningDriverAvailabilityPeriodResponse | null;

  lastReopenedResult:
    ReopenMorningDriverAvailabilityPeriodResponse | null;

  lastDeletedResult:
    DeleteMorningDriverAvailabilityPeriodResponse | null;
}

interface UseMorningDriverAvailabilityPeriodsResult {
  state:
    MorningDriverAvailabilityPeriodsState;

  loadPeriods:
    () => Promise<
      MorningDriverAvailabilityPeriodListItem[]
    >;

  createPeriod: (
    request:
      CreateMorningDriverAvailabilityPeriodRequest,
  ) => Promise<CreateMorningDriverAvailabilityPeriodResponse>;

  openPeriod: (
    periodId: string,
  ) => Promise<OpenMorningDriverAvailabilityPeriodResponse>;

  reopenPeriod: (
    periodId: string,
  ) => Promise<ReopenMorningDriverAvailabilityPeriodResponse>;

  deletePeriod: (
    periodId: string,
  ) => Promise<DeleteMorningDriverAvailabilityPeriodResponse>;

  clearError:
    () => void;

  reset:
    () => void;
}

const initialState:
  MorningDriverAvailabilityPeriodsState = {
    periods: [],

    isLoading:
      false,

    isCreating:
      false,

    openingPeriodId:
      null,

    reopeningPeriodId:
      null,

    deletingPeriodId:
      null,

    error:
      null,

    lastCreatedResult:
      null,

    lastOpenedResult:
      null,

    lastReopenedResult:
      null,

    lastDeletedResult:
      null,
  };

function normalizeMorningDriverAvailabilityError(
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
      return 'אין לך הרשאה לנהל או לצפות באילוצי כונני הבוקר.';
    }

    if (
      normalizedMessage.includes(
        'invalid year',
      )
    ) {
      return 'השנה שנבחרה אינה תקינה.';
    }

    if (
      normalizedMessage.includes(
        'invalid month',
      )
    ) {
      return 'החודש שנבחר אינו תקין.';
    }

    if (
      normalizedMessage.includes(
        'submission deadline is required',
      )
    ) {
      return 'יש להגדיר מועד אחרון להגשת האילוצים.';
    }

    if (
      normalizedMessage.includes(
        'morning driver availability period already exists',
      )
    ) {
      return 'כבר קיים חודש אילוצים לכונני בוקר עבור החודש הזה.';
    }

    if (
      normalizedMessage.includes(
        'morning driver availability period not found',
      )
    ) {
      return 'חודש אילוצי כונני הבוקר לא נמצא.';
    }

    if (
      normalizedMessage.includes(
        'only draft periods can be opened',
      )
    ) {
      return 'ניתן לפתוח להגשה רק חודש שנמצא במצב טיוטה.';
    }

    if (
      normalizedMessage.includes(
        'only draft periods can be deleted',
      )
    ) {
      return 'ניתן למחוק רק חודש אילוצים שנמצא במצב טיוטה.';
    }

    if (
      normalizedMessage.includes(
        'morning driver availability period id is required',
      ) ||
      normalizedMessage.includes(
        'period id is required',
      )
    ) {
      return 'לא התקבל מזהה חודש אילוצים.';
    }

    if (
      normalizedMessage.includes(
        'התקבלה תשובה לא תקינה בעת טעינת חודשי אילוצי כונני הבוקר',
      )
    ) {
      return 'התקבלה תשובה לא תקינה בעת טעינת חודשי אילוצי כונני הבוקר.';
    }

    if (
      normalizedMessage.includes(
        'לא התקבלה תשובה בעת יצירת חודש אילוצי כונני הבוקר',
      )
    ) {
      return 'לא התקבלה תשובה תקינה בעת יצירת חודש האילוצים.';
    }

    if (
      normalizedMessage.includes(
        'לא התקבלה תשובה בעת פתיחת חודש אילוצי כונני הבוקר',
      )
    ) {
      return 'לא התקבלה תשובה תקינה בעת פתיחת חודש האילוצים.';
    }

    if (
      normalizedMessage.includes(
        'לא התקבלה תשובה בעת מחיקת חודש אילוצי כונני הבוקר',
      )
    ) {
      return 'לא התקבלה תשובה תקינה בעת מחיקת חודש האילוצים.';
    }

    return error.message;
  }

  return 'לא ניתן היה לבצע את הפעולה במערכת אילוצי כונני הבוקר.';
}

export function useMorningDriverAvailabilityPeriods():
  UseMorningDriverAvailabilityPeriodsResult {
  const [
    state,
    setState,
  ] =
    useState<MorningDriverAvailabilityPeriodsState>(
      initialState,
    );

  const loadPeriods =
    useCallback(
      async (): Promise<
        MorningDriverAvailabilityPeriodListItem[]
      > => {
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
          const periods =
            await morningDriverAvailabilityService
              .getPeriods();

          setState(
            (
              currentState,
            ) => ({
              ...currentState,

              periods,

              isLoading:
                false,

              error:
                null,
            }),
          );

          return periods;
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
                normalizeMorningDriverAvailabilityError(
                  error,
                ),
            }),
          );

          throw error;
        }
      },
      [],
    );

  const createPeriod =
    useCallback(
      async (
        request:
          CreateMorningDriverAvailabilityPeriodRequest,
      ): Promise<CreateMorningDriverAvailabilityPeriodResponse> => {
        setState(
          (
            currentState,
          ) => ({
            ...currentState,

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
            await morningDriverAvailabilityService
              .createPeriod(
                request,
              );

          const periods =
            await morningDriverAvailabilityService
              .getPeriods();

          setState(
            (
              currentState,
            ) => ({
              ...currentState,

              periods,

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
              currentState,
            ) => ({
              ...currentState,

              isCreating:
                false,

              error:
                normalizeMorningDriverAvailabilityError(
                  error,
                ),
            }),
          );

          throw error;
        }
      },
      [],
    );

  const openPeriod =
    useCallback(
      async (
        periodId: string,
      ): Promise<OpenMorningDriverAvailabilityPeriodResponse> => {
        const normalizedPeriodId =
          periodId.trim();

        if (
          !normalizedPeriodId
        ) {
          const missingPeriodError =
            new Error(
              'Morning driver availability period id is required.',
            );

          setState(
            (
              currentState,
            ) => ({
              ...currentState,

              error:
                normalizeMorningDriverAvailabilityError(
                  missingPeriodError,
                ),
            }),
          );

          throw missingPeriodError;
        }

        setState(
          (
            currentState,
          ) => ({
            ...currentState,

            openingPeriodId:
              normalizedPeriodId,

            error:
              null,

            lastOpenedResult:
              null,
          }),
        );

        try {
          const result =
            await morningDriverAvailabilityService
              .openPeriod(
                normalizedPeriodId,
              );

          const periods =
            await morningDriverAvailabilityService
              .getPeriods();

          setState(
            (
              currentState,
            ) => ({
              ...currentState,

              periods,

              openingPeriodId:
                null,

              error:
                null,

              lastOpenedResult:
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

              openingPeriodId:
                null,

              error:
                normalizeMorningDriverAvailabilityError(
                  error,
                ),
            }),
          );

          throw error;
        }
      },
      [],
    );

  const reopenPeriod =
    useCallback(
      async (
        periodId: string,
      ): Promise<ReopenMorningDriverAvailabilityPeriodResponse> => {
        setState(
          (
            current,
          ) => ({
            ...current,
            reopeningPeriodId:
              periodId,
            error:
              null,
            lastReopenedResult:
              null,
          }),
        );

        try {
          const result =
            await morningDriverAvailabilityService
              .reopenPeriod(
                periodId,
              );

          const periods =
            await morningDriverAvailabilityService
              .getPeriods();

          setState(
            (
              current,
            ) => ({
              ...current,
              periods,
              reopeningPeriodId:
                null,
              lastReopenedResult:
                result,
          }));

          return result;
        } catch (error) {
          setState(
            (
              current,
            ) => ({
              ...current,
              reopeningPeriodId:
                null,
              error:
                normalizeMorningDriverAvailabilityError(
                  error,
                ),
            }),
          );

          throw error;
        }
      },
      [],
    );

  const deletePeriod =
    useCallback(
      async (
        periodId: string,
      ): Promise<DeleteMorningDriverAvailabilityPeriodResponse> => {
        const normalizedPeriodId =
          periodId.trim();

        if (
          !normalizedPeriodId
        ) {
          const missingPeriodError =
            new Error(
              'Morning driver availability period id is required.',
            );

          setState(
            (
              currentState,
            ) => ({
              ...currentState,

              error:
                normalizeMorningDriverAvailabilityError(
                  missingPeriodError,
                ),
            }),
          );

          throw missingPeriodError;
        }

        setState(
          (
            currentState,
          ) => ({
            ...currentState,

            deletingPeriodId:
              normalizedPeriodId,

            error:
              null,

            lastDeletedResult:
              null,
          }),
        );

        try {
          const result =
            await morningDriverAvailabilityService
              .deletePeriod(
                normalizedPeriodId,
              );

          const periods =
            await morningDriverAvailabilityService
              .getPeriods();

          setState(
            (
              currentState,
            ) => ({
              ...currentState,

              periods,

              deletingPeriodId:
                null,

              error:
                null,

              lastDeletedResult:
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

              deletingPeriodId:
                null,

              error:
                normalizeMorningDriverAvailabilityError(
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

    loadPeriods,

    createPeriod,

    openPeriod,

    reopenPeriod,

    deletePeriod,

    clearError,

    reset,
  };
}