import {
  useCallback,
  useState,
} from 'react';

import {
  driverScheduleService,
} from '../services/driverScheduleService';

import type {
  CreateDriverScheduleDraftResponse,
  DriverScheduleData,
} from '../types/driverSchedule';

interface DriverScheduleDraftState {
  data:
    DriverScheduleData | null;

  isLoading: boolean;

  isCreating: boolean;

  error:
    string | null;

  lastCreatedResult:
    CreateDriverScheduleDraftResponse | null;
}

interface UseDriverScheduleDraftResult {
  state:
    DriverScheduleDraftState;

  loadLatestSchedule:
    () => Promise<DriverScheduleData | null>;

  loadScheduleById: (
    schedulePeriodId: string,
  ) => Promise<DriverScheduleData | null>;

  loadScheduleByMonth: (
    year: number,
    month: number,
  ) => Promise<DriverScheduleData | null>;

  createDraft: (
    availabilityPeriodId: string,
  ) => Promise<CreateDriverScheduleDraftResponse>;

  clearError:
    () => void;

  reset:
    () => void;
}

const initialState:
  DriverScheduleDraftState = {
    data: null,

    isLoading: false,

    isCreating: false,

    error: null,

    lastCreatedResult:
      null,
  };

function normalizeDriverScheduleDraftError(
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
      return 'אין לך הרשאה לצפות או לערוך את לוח הכוננים.';
    }

    if (
      normalizedMessage.includes(
        'driver availability period id is required',
      )
    ) {
      return 'מזהה חודש אילוצי הכוננים חסר.';
    }

    if (
      normalizedMessage.includes(
        'driver schedule period id is required',
      )
    ) {
      return 'מזהה תקופת לוח הכוננים חסר.';
    }

    if (
      normalizedMessage.includes(
        'driver availability period not found',
      )
    ) {
      return 'חודש אילוצי הכוננים לא נמצא.';
    }

    if (
      normalizedMessage.includes(
        'driver availability period must be closed before scheduling',
      )
    ) {
      return 'יש לסגור את חודש האילוצים לפני יצירת השיבוץ.';
    }

    if (
      normalizedMessage.includes(
        'driver schedule period already exists for this availability period',
      ) ||
      normalizedMessage.includes(
        'driver schedule period already exists for this month',
      )
    ) {
      return 'כבר קיימת טיוטת לוח כוננים עבור החודש הזה.';
    }

    if (
      normalizedMessage.includes(
        'no active on-call drivers were found',
      )
    ) {
      return 'לא נמצאו כוננים פעילים במערכת.';
    }

    if (
      normalizedMessage.includes(
        'driver availability period has no days',
      )
    ) {
      return 'לא נמצאו ימים בחודש האילוצים.';
    }

    if (
      normalizedMessage.includes(
        'driver schedule month is invalid',
      )
    ) {
      return 'חודש לוח הכוננים אינו תקין.';
    }

    if (
      normalizedMessage.includes(
        'driver schedule year is invalid',
      )
    ) {
      return 'שנת לוח הכוננים אינה תקינה.';
    }

    if (
      normalizedMessage.includes(
        'לא התקבלה תשובה בעת יצירת טיוטת לוח הכוננים',
      )
    ) {
      return 'לא התקבלה תשובה תקינה בעת יצירת טיוטת לוח הכוננים.';
    }

    return error.message;
  }

  return 'לא ניתן היה לבצע את הפעולה בלוח הכוננים.';
}

export function useDriverScheduleDraft():
  UseDriverScheduleDraftResult {
  const [
    state,
    setState,
  ] =
    useState<DriverScheduleDraftState>(
      initialState,
    );

  const loadLatestSchedule =
    useCallback(
      async (): Promise<DriverScheduleData | null> => {
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
          const data =
            await driverScheduleService
              .getLatestSchedule();

          setState(
            (currentState) => ({
              ...currentState,

              data,

              isLoading:
                false,

              error:
                null,
            }),
          );

          return data;
        } catch (error) {
          const normalizedError =
            normalizeDriverScheduleDraftError(
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

  const loadScheduleById =
    useCallback(
      async (
        schedulePeriodId: string,
      ): Promise<DriverScheduleData | null> => {
        const normalizedSchedulePeriodId =
          schedulePeriodId.trim();

        if (
          !normalizedSchedulePeriodId
        ) {
          const missingPeriodError =
            new Error(
              'Driver schedule period id is required.',
            );

          setState(
            (currentState) => ({
              ...currentState,

              error:
                normalizeDriverScheduleDraftError(
                  missingPeriodError,
                ),
            }),
          );

          throw missingPeriodError;
        }

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
          const data =
            await driverScheduleService
              .getScheduleById(
                normalizedSchedulePeriodId,
              );

          setState(
            (currentState) => ({
              ...currentState,

              data,

              isLoading:
                false,

              error:
                null,
            }),
          );

          return data;
        } catch (error) {
          const normalizedError =
            normalizeDriverScheduleDraftError(
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

  const loadScheduleByMonth =
    useCallback(
      async (
        year: number,
        month: number,
      ): Promise<DriverScheduleData | null> => {
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
          const data =
            await driverScheduleService
              .getScheduleByMonth(
                year,
                month,
              );

          setState(
            (currentState) => ({
              ...currentState,

              data,

              isLoading:
                false,

              error:
                null,
            }),
          );

          return data;
        } catch (error) {
          const normalizedError =
            normalizeDriverScheduleDraftError(
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

  const createDraft =
    useCallback(
      async (
        availabilityPeriodId: string,
      ): Promise<CreateDriverScheduleDraftResponse> => {
        const normalizedAvailabilityPeriodId =
          availabilityPeriodId.trim();

        if (
          !normalizedAvailabilityPeriodId
        ) {
          const missingPeriodError =
            new Error(
              'Driver availability period id is required.',
            );

          setState(
            (currentState) => ({
              ...currentState,

              error:
                normalizeDriverScheduleDraftError(
                  missingPeriodError,
                ),
            }),
          );

          throw missingPeriodError;
        }

        setState(
          (currentState) => ({
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
            await driverScheduleService
              .createDraft(
                normalizedAvailabilityPeriodId,
              );

          const data =
            await driverScheduleService
              .getScheduleById(
                result.schedulePeriodId,
              );

          setState(
            (currentState) => ({
              ...currentState,

              data,

              isCreating:
                false,

              isLoading:
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
            normalizeDriverScheduleDraftError(
              error,
            );

          setState(
            (currentState) => ({
              ...currentState,

              isCreating:
                false,

              error:
                normalizedError,

              lastCreatedResult:
                null,
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

    loadLatestSchedule,

    loadScheduleById,

    loadScheduleByMonth,

    createDraft,

    clearError,

    reset,
  };
}