import {
  useCallback,
  useState,
} from 'react';

import {
  driverAvailabilityService,
} from '../services/driverAvailabilityService';

import type {
  DriverAvailabilityManagementData,
} from '../types/driverAvailability';

interface DriverAvailabilityManagementState {
  data:
    DriverAvailabilityManagementData | null;

  selectedPeriodId:
    string | null;

  isLoading: boolean;

  error:
    string | null;
}

interface UseDriverAvailabilityManagementResult {
  state:
    DriverAvailabilityManagementState;

  loadManagementData: (
    periodId: string,
  ) => Promise<DriverAvailabilityManagementData>;

  clearError:
    () => void;

  reset:
    () => void;
}

const initialState:
  DriverAvailabilityManagementState = {
    data: null,

    selectedPeriodId:
      null,

    isLoading: false,

    error: null,
  };

function normalizeDriverAvailabilityManagementError(
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
      return 'אין לך הרשאה לצפות בנתוני ניהול אילוצי הכוננים.';
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
        'לא התקבלה תשובה בעת טעינת נתוני ניהול אילוצי הכוננים',
      )
    ) {
      return 'לא התקבלה תשובה תקינה בעת טעינת נתוני ניהול אילוצי הכוננים.';
    }

    return error.message;
  }

  return 'לא ניתן היה לטעון את נתוני ניהול אילוצי הכוננים.';
}

export function useDriverAvailabilityManagement():
  UseDriverAvailabilityManagementResult {
  const [
    state,
    setState,
  ] =
    useState<DriverAvailabilityManagementState>(
      initialState,
    );

  const loadManagementData =
    useCallback(
      async (
        periodId: string,
      ): Promise<DriverAvailabilityManagementData> => {
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

              selectedPeriodId:
                null,

              data:
                null,

              isLoading:
                false,

              error:
                normalizeDriverAvailabilityManagementError(
                  missingPeriodError,
                ),
            }),
          );

          throw missingPeriodError;
        }

        setState(
          (currentState) => ({
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
            await driverAvailabilityService
              .getManagementData(
                normalizedPeriodId,
              );

          setState(
            (currentState) => ({
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
        } catch (error) {
          const normalizedError =
            normalizeDriverAvailabilityManagementError(
              error,
            );

          setState(
            (currentState) => ({
              ...currentState,

              data:
                null,

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

    loadManagementData,

    clearError,

    reset,
  };
}