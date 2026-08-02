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
  UpdateDriverScheduleDayRequest,
  UpdateDriverScheduleDayResponse,
  PublishDriverScheduleResponse,
} from '../types/driverSchedule';

interface DriverScheduleDraftState {
  data:
    DriverScheduleData | null;

  isLoading: boolean;

  isCreating: boolean;

  updatingDayId:
    string | null;

  error:
    string | null;

  lastCreatedResult:
    CreateDriverScheduleDraftResponse | null;

  lastUpdatedDayResult:
    UpdateDriverScheduleDayResponse | null;
    isPublishing: boolean;

  lastPublishedResult:
  PublishDriverScheduleResponse | null;
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

  updateScheduleDay: (
    request:
      UpdateDriverScheduleDayRequest,
  ) => Promise<UpdateDriverScheduleDayResponse>;

  clearError:
    () => void;

  clearLastUpdatedDayResult:
    () => void;

  reset:
    () => void;
  publishSchedule:
  () => Promise<PublishDriverScheduleResponse>;
}

const initialState:
  DriverScheduleDraftState = {
    data: null,

    isLoading: false,

    isCreating: false,

    updatingDayId:
      null,

    error: null,

    lastCreatedResult:
      null,

    lastUpdatedDayResult:
      null,
    isPublishing: false,

lastPublishedResult: null,
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
        'driver schedule day id is required',
      )
    ) {
      return 'מזהה יום השיבוץ חסר.';
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
        'driver schedule day not found',
      )
    ) {
      return 'יום השיבוץ לא נמצא.';
    }

    if (
      normalizedMessage.includes(
        'driver schedule period not found',
      )
    ) {
      return 'תקופת לוח הכוננים לא נמצאה.';
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
        'only draft driver schedules can be edited',
      )
    ) {
      return 'ניתן לערוך רק לוח כוננים שנמצא במצב טיוטה.';
    }

    if (
      normalizedMessage.includes(
        'selected on-call driver was not found or is inactive',
      )
    ) {
      return 'הכונן שנבחר לא נמצא או שאינו פעיל.';
    }

    if (
      normalizedMessage.includes(
        'driver cannot be assigned on consecutive days',
      )
    ) {
      return 'לא ניתן לשבץ את אותו כונן ביומיים רצופים.';
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

    if (
      normalizedMessage.includes(
        'לא התקבלה תשובה בעת עדכון יום בלוח הכוננים',
      )
    ) {
      return 'לא התקבלה תשובה תקינה בעת עדכון יום בלוח הכוננים.';
    }
    if (
      normalizedMessage.includes(
        'only draft driver schedules can be published',
      )
    ) {
      return 'ניתן לפרסם רק לוח כוננים שנמצא במצב טיוטה.';
    }

    if (
      normalizedMessage.includes(
        'driver schedule has no days',
      )
    ) {
      return 'לא קיימים ימים בלוח הכוננים.';
    }

    if (
      normalizedMessage.includes(
        'all driver schedule days must be assigned before publishing',
      )
    ) {
      return 'יש לשבץ כונן בכל ימי החודש לפני הפרסום.';
    }

    if (
      normalizedMessage.includes(
        'driver schedule contains consecutive-day assignments',
      )
    ) {
      return 'לא ניתן לפרסם לוח שמכיל אותו כונן ביומיים רצופים.';
    }

    if (
      normalizedMessage.includes(
        'לא התקבלה תשובה בעת פרסום לוח הכוננים',
      )
    ) {
      return 'לא התקבלה תשובה תקינה בעת פרסום לוח הכוננים.';
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
const publishSchedule =
  useCallback(
    async (): Promise<PublishDriverScheduleResponse> => {
      const schedulePeriodId =
        state.data
          ?.period
          ?.id ??
        null;

      if (!schedulePeriodId) {
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

    if (
      (
        state.data
          ?.statistics
          ?.unassignedDays ??
        0
      ) > 0
    )
 {
        const unassignedDaysError =
          new Error(
            'All driver schedule days must be assigned before publishing.',
          );

        setState(
          (currentState) => ({
            ...currentState,

            error:
              'יש לשבץ כונן בכל ימי החודש לפני הפרסום.',
          }),
        );

        throw unassignedDaysError;
      }

      setState(
        (currentState) => ({
          ...currentState,

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
          await driverScheduleService
            .publishSchedule(
              schedulePeriodId,
            );

        const refreshedData =
          await driverScheduleService
            .getScheduleById(
              schedulePeriodId,
            );

        setState(
          (currentState) => ({
            ...currentState,

            data:
              refreshedData,

            isPublishing:
              false,

            error:
              null,

            lastPublishedResult:
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

            isPublishing:
              false,

            error:
              normalizedError,

            lastPublishedResult:
              null,
          }),
        );

        throw error;
      }
    },
    [
      state.data,
    ],
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

            lastUpdatedDayResult:
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

              lastUpdatedDayResult:
                null,
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

  const updateScheduleDay =
    useCallback(
      async (
        request:
          UpdateDriverScheduleDayRequest,
      ): Promise<UpdateDriverScheduleDayResponse> => {
        const normalizedScheduleDayId =
          request.scheduleDayId.trim();

        if (
          !normalizedScheduleDayId
        ) {
          const missingDayError =
            new Error(
              'Driver schedule day id is required.',
            );

          setState(
            (currentState) => ({
              ...currentState,

              error:
                normalizeDriverScheduleDraftError(
                  missingDayError,
                ),
            }),
          );

          throw missingDayError;
        }

        const schedulePeriodId =
          state.data?.period?.id ??
          null;

        if (!schedulePeriodId) {
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

            updatingDayId:
              normalizedScheduleDayId,

            error:
              null,

            lastUpdatedDayResult:
              null,
          }),
        );

        try {
          const result =
            await driverScheduleService
              .updateScheduleDay({
                ...request,

                scheduleDayId:
                  normalizedScheduleDayId,
              });

          const refreshedData =
            await driverScheduleService
              .getScheduleById(
                schedulePeriodId,
              );

          setState(
            (currentState) => ({
              ...currentState,

              data:
                refreshedData,

              updatingDayId:
                null,

              error:
                null,

              lastUpdatedDayResult:
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

              updatingDayId:
                null,

              error:
                normalizedError,

              lastUpdatedDayResult:
                null,
            }),
          );

          throw error;
        }
      },
      [
        state.data?.period?.id,
      ],
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

  const clearLastUpdatedDayResult =
    useCallback(
      (): void => {
        setState(
          (currentState) => ({
            ...currentState,

            lastUpdatedDayResult:
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

    updateScheduleDay,

    clearError,

    clearLastUpdatedDayResult,
    publishSchedule,
    reset,
  };
}