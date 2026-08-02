import {
  useCallback,
  useState,
} from 'react';

import {
  driverAvailabilityService,
} from '../services/driverAvailabilityService';

import type {
  CreateDriverAvailabilityPeriodRequest,
  CreateDriverAvailabilityPeriodResponse,
  DriverAvailabilityPeriodListItem,
  OpenDriverAvailabilityPeriodResponse,
  CloseDriverAvailabilityPeriodResponse,
} from '../types/driverAvailability';

interface DriverAvailabilityPeriodsState {
  periods:
    DriverAvailabilityPeriodListItem[];

  isLoading: boolean;

  isCreating: boolean;

  openingPeriodId:
    string | null;
  closingPeriodId:
  string | null;

lastClosedResult:
  CloseDriverAvailabilityPeriodResponse | null;

  error:
    string | null;

  lastCreatedResult:
    CreateDriverAvailabilityPeriodResponse | null;

  lastOpenedResult:
    OpenDriverAvailabilityPeriodResponse | null;
}

interface UseDriverAvailabilityPeriodsResult {
  state:
    DriverAvailabilityPeriodsState;

  loadPeriods:
    () => Promise<DriverAvailabilityPeriodListItem[]>;

  createPeriod: (
    request:
      CreateDriverAvailabilityPeriodRequest,
  ) => Promise<CreateDriverAvailabilityPeriodResponse>;

  openPeriod: (
    periodId: string,
  ) => Promise<OpenDriverAvailabilityPeriodResponse>;

  clearError:
    () => void;
  closePeriod: (
  periodId: string,
  force?: boolean,
) => Promise<CloseDriverAvailabilityPeriodResponse>;

  reset:
    () => void;
}

const initialState:
  DriverAvailabilityPeriodsState = {
    periods: [],

    isLoading: false,

    isCreating: false,

    openingPeriodId:
      null,

    closingPeriodId:
      null,

    error: null,

    lastCreatedResult:
      null,

    lastOpenedResult:
      null,

    lastClosedResult:
      null,
  };

function normalizeDriverAvailabilityError(
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
      return 'אין לך הרשאה לנהל או לצפות באילוצי הכוננים.';
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
        'driver availability period already exists',
      )
    ) {
      return 'כבר קיימת תקופת אילוצי כוננים עבור החודש הזה.';
    }

    if (
      normalizedMessage.includes(
        'driver availability period id is required',
      )
    ) {
      return 'מזהה תקופת אילוצי הכוננים חסר.';
    }

    if (
      normalizedMessage.includes(
        'driver availability period not found',
      )
    ) {
      return 'תקופת אילוצי הכוננים לא נמצאה.';
    }

    if (
      normalizedMessage.includes(
        'only draft driver availability periods can be opened',
      )
    ) {
      return 'ניתן לפתוח להגשה רק חודש שנמצא במצב טיוטה.';
    }

    if (
      normalizedMessage.includes(
        'driver availability period has no days',
      )
    ) {
      return 'לא ניתן לפתוח את החודש משום שלא נוצרו בו ימי כוננות.';
    }

    if (
      normalizedMessage.includes(
        'לא התקבלה תשובה בעת יצירת חודש אילוצי הכוננים',
      )
    ) {
      return 'לא התקבלה תשובה תקינה בעת יצירת חודש אילוצי הכוננים.';
    }

    if (
      normalizedMessage.includes(
        'לא התקבלה תשובה בעת פתיחת חודש אילוצי הכוננים',
      )
    ) {
      return 'לא התקבלה תשובה תקינה בעת פתיחת חודש אילוצי הכוננים.';
    }

    if (
      normalizedMessage.includes(
        'התקבלה תשובה לא תקינה בעת טעינת חודשי אילוצי הכוננים',
      )
    ) {
      return 'התקבלה תשובה לא תקינה בעת טעינת חודשי אילוצי הכוננים.';
    }
    if (
  normalizedMessage.includes(
    'not all active drivers submitted availability',
  )
      ) {
        return 'לא כל הכוננים הפעילים הגישו אילוצים.';
      }

      if (
        normalizedMessage.includes(
          'only open driver availability periods can be closed',
        )
      ) {
        return 'ניתן לסגור רק חודש שנמצא במצב פתוח להגשה.';
      }

      if (
        normalizedMessage.includes(
          'לא התקבלה תשובה בעת סגירת חודש אילוצי הכוננים',
        )
      ) {
        return 'לא התקבלה תשובה תקינה בעת סגירת חודש אילוצי הכוננים.';
      }

    return error.message;
  }

  return 'לא ניתן היה לבצע את הפעולה במערכת אילוצי הכוננים.';
}

export function useDriverAvailabilityPeriods():
  UseDriverAvailabilityPeriodsResult {
  const [
    state,
    setState,
  ] =
    useState<DriverAvailabilityPeriodsState>(
      initialState,
    );

  const loadPeriods =
    useCallback(
      async (): Promise<DriverAvailabilityPeriodListItem[]> => {
        setState(
          (currentState) => ({
            ...currentState,

            isLoading:
              true,

            error:
              null,
          }),
        );

        try {
          const periods =
            await driverAvailabilityService
              .getPeriods();

          setState(
            (currentState) => ({
              ...currentState,

              periods,

              isLoading:
                false,

              error:
                null,
            }),
          );

          return periods;
        } catch (error) {
          const normalizedError =
            normalizeDriverAvailabilityError(
              error,
            );

          setState(
            (currentState) => ({
              ...currentState,

              isLoading:
                false,

              error:
                normalizedError,
            }),
          );

          throw error;
        }
      },
      [],
    );
const closePeriod =
  useCallback(
    async (
      periodId: string,
      force = false,
    ): Promise<CloseDriverAvailabilityPeriodResponse> => {
      const normalizedPeriodId =
        periodId.trim();

      if (!normalizedPeriodId) {
        const missingPeriodError =
          new Error(
            'Driver availability period id is required.',
          );

        setState(
          (currentState) => ({
            ...currentState,

            error:
              normalizeDriverAvailabilityError(
                missingPeriodError,
              ),
          }),
        );

        throw missingPeriodError;
      }

      setState(
        (currentState) => ({
          ...currentState,

          closingPeriodId:
            normalizedPeriodId,

          error:
            null,

          lastClosedResult:
            null,
        }),
      );

      try {
        const result =
          await driverAvailabilityService
            .closePeriod(
              normalizedPeriodId,
              force,
            );

        const periods =
          await driverAvailabilityService
            .getPeriods();

        setState(
          (currentState) => ({
            ...currentState,

            periods,

            closingPeriodId:
              null,

            error:
              null,

            lastClosedResult:
              result,
          }),
        );

        return result;
      } catch (error) {
        const normalizedError =
          normalizeDriverAvailabilityError(
            error,
          );

        setState(
          (currentState) => ({
            ...currentState,

            closingPeriodId:
              null,

            error:
              normalizedError,
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
          CreateDriverAvailabilityPeriodRequest,
      ): Promise<CreateDriverAvailabilityPeriodResponse> => {
        setState(
          (currentState) => ({
            ...currentState,

            isCreating:
              true,

            error:
              null,

            lastCreatedResult:
              null,

            lastOpenedResult:
              null,
          }),
        );

        try {
          const result =
            await driverAvailabilityService
              .createPeriod(
                request,
              );

          const periods =
            await driverAvailabilityService
              .getPeriods();

          setState(
            (currentState) => ({
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
        } catch (error) {
          const normalizedError =
            normalizeDriverAvailabilityError(
              error,
            );

          setState(
            (currentState) => ({
              ...currentState,

              isCreating:
                false,

              error:
                normalizedError,
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
      ): Promise<OpenDriverAvailabilityPeriodResponse> => {
        const normalizedPeriodId =
          periodId.trim();

        if (
          !normalizedPeriodId
        ) {
          const missingPeriodError =
            new Error(
              'Driver availability period id is required.',
            );

          setState(
            (currentState) => ({
              ...currentState,

              error:
                normalizeDriverAvailabilityError(
                  missingPeriodError,
                ),
            }),
          );

          throw missingPeriodError;
        }

        setState(
          (currentState) => ({
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
            await driverAvailabilityService
              .openPeriod(
                normalizedPeriodId,
              );

          const periods =
            await driverAvailabilityService
              .getPeriods();

          setState(
            (currentState) => ({
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
        } catch (error) {
          const normalizedError =
            normalizeDriverAvailabilityError(
              error,
            );

          setState(
            (currentState) => ({
              ...currentState,

              openingPeriodId:
                null,

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
    useCallback(
      (): void => {
        setState(
          (currentState) => ({
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
    closePeriod,

    clearError,

    reset,
  };
}