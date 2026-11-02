/**
 * קובץ: src/hooks/useDriverAvailabilityPeriods.ts
 * מטרה: ניהול מצב ותופעות לוואי באמצעות React עבור תקופות אילוצים.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: DriverAvailabilityPeriodsState, UseDriverAvailabilityPeriodsResult, normalizeDriverAvailabilityError, useDriverAvailabilityPeriods.
 * - ריכוז ההגדרות והלוגיקה המפורטות בהמשך הקובץ.
 */
import {
  useCallback,
  useState,
} from 'react';

import {
  driverAvailabilityService,
  type DeleteDriverAvailabilityPeriodResponse,
  type ReopenDriverAvailabilityPeriodResponse,
} from '../services/driverAvailabilityService';

import type {
  CreateDriverAvailabilityPeriodRequest,
  CreateDriverAvailabilityPeriodResponse,
  DriverAvailabilityPeriodListItem,
  OpenDriverAvailabilityPeriodResponse,
  CloseDriverAvailabilityPeriodResponse,
} from '../types/driverAvailability';

/**
 * חוזה הנתונים DriverAvailabilityPeriodsState: תקופות אילוצים.
 */
interface DriverAvailabilityPeriodsState {
  // periods — תקופות.
  periods:
    DriverAvailabilityPeriodListItem[];

  // isLoading — האם טעינה מתבצעת.
  isLoading: boolean;

  isCreating: boolean;

  // openingPeriodId — מזהה התקופה.
  openingPeriodId:
    string | null;
  // closingPeriodId — מזהה התקופה.
  closingPeriodId:
    string | null;

  // reopeningPeriodId — מזהה התקופה.
  reopeningPeriodId:
    string | null;

  // deletingPeriodId — מזהה התקופה.
  deletingPeriodId:
    string | null;

  // lastReopenedResult — תוצאה.
  lastReopenedResult:
    ReopenDriverAvailabilityPeriodResponse | null;

  // lastDeletedResult — תוצאה.
  lastDeletedResult:
    DeleteDriverAvailabilityPeriodResponse | null;

// lastClosedResult — תוצאה.
lastClosedResult:
  CloseDriverAvailabilityPeriodResponse | null;

  // error — שגיאה.
  error:
    string | null;

  // lastCreatedResult — תוצאה.
  lastCreatedResult:
    CreateDriverAvailabilityPeriodResponse | null;

  // lastOpenedResult — תוצאה.
  lastOpenedResult:
    OpenDriverAvailabilityPeriodResponse | null;
}

/**
 * חוזה הנתונים UseDriverAvailabilityPeriodsResult: תקופות אילוצים.
 */
interface UseDriverAvailabilityPeriodsResult {
  // state — מצב.
  state:
    DriverAvailabilityPeriodsState;

  // loadPeriods — תקופות.
  loadPeriods:
    () => Promise<DriverAvailabilityPeriodListItem[]>;

  // createPeriod — תקופה.
  createPeriod: (
    request:
      CreateDriverAvailabilityPeriodRequest,
  ) => Promise<CreateDriverAvailabilityPeriodResponse>;

  // openPeriod — תקופה.
  openPeriod: (
    periodId: string,
  ) => Promise<OpenDriverAvailabilityPeriodResponse>;

  // clearError — שגיאה.
  clearError:
    () => void;

  // reopenPeriod — תקופה.
  reopenPeriod: (
    periodId: string,
  ) => Promise<ReopenDriverAvailabilityPeriodResponse>;

  // deletePeriod — תקופה.
  deletePeriod: (
    periodId: string,
  ) => Promise<DeleteDriverAvailabilityPeriodResponse>;

  // closePeriod — תקופה.
  closePeriod: (
  periodId: string,
  force?: boolean,
) => Promise<CloseDriverAvailabilityPeriodResponse>;

  reset:
    () => void;
}

// initialState — מצב.
const initialState:
  DriverAvailabilityPeriodsState = {
    periods: [],

    isLoading: false,

    isCreating: false,

    openingPeriodId:
      null,

    closingPeriodId:
      null,

    reopeningPeriodId:
      null,

    deletingPeriodId:
      null,

    lastReopenedResult:
      null,

    lastDeletedResult:
      null,

    error: null,

    lastCreatedResult:
      null,

    lastOpenedResult:
      null,

    lastClosedResult:
      null,
  };

/**
 * פעולה normalizeDriverAvailabilityError: שמירת שגיאת Error קיימת או איחוד message, details, hint ו־code לשגיאה שניתן להציג.
 * @param error — שגיאה.
 * @returns string — הפלט בהתאם לחתימה.
 */
function normalizeDriverAvailabilityError(
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

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר normalizedMessage.includes( 'user not active', ).
    if (
      normalizedMessage.includes(
        'user not active',
      )
    ) {
      return 'המשתמש אינו פעיל.';
    }

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר normalizedMessage.includes( 'not allowed', ).
    if (
      normalizedMessage.includes(
        'not allowed',
      )
    ) {
      return 'אין לך הרשאה לנהל או לצפות באילוצי הכוננים.';
    }

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר normalizedMessage.includes( 'invalid year', ).
    if (
      normalizedMessage.includes(
        'invalid year',
      )
    ) {
      return 'השנה שנבחרה אינה תקינה.';
    }

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר normalizedMessage.includes( 'invalid month', ).
    if (
      normalizedMessage.includes(
        'invalid month',
      )
    ) {
      return 'החודש שנבחר אינו תקין.';
    }

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר normalizedMessage.includes( 'driver availability period already exists', ).
    if (
      normalizedMessage.includes(
        'driver availability period already exists',
      )
    ) {
      return 'כבר קיימת תקופת אילוצי כוננים עבור החודש הזה.';
    }

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר normalizedMessage.includes( 'driver availability period id is required', ).
    if (
      normalizedMessage.includes(
        'driver availability period id is required',
      )
    ) {
      return 'מזהה תקופת אילוצי הכוננים חסר.';
    }

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר normalizedMessage.includes( 'driver availability period not found', ).
    if (
      normalizedMessage.includes(
        'driver availability period not found',
      )
    ) {
      return 'תקופת אילוצי הכוננים לא נמצאה.';
    }

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר normalizedMessage.includes( 'only draft driver availability periods can be opened', ).
    if (
      normalizedMessage.includes(
        'only draft driver availability periods can be opened',
      )
    ) {
      return 'ניתן לפתוח להגשה רק חודש שנמצא במצב טיוטה.';
    }

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר normalizedMessage.includes( 'driver availability period has no days', ).
    if (
      normalizedMessage.includes(
        'driver availability period has no days',
      )
    ) {
      return 'לא ניתן לפתוח את החודש משום שלא נוצרו בו ימי כוננות.';
    }

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר normalizedMessage.includes( 'לא התקבלה תשובה בעת יצירת חודש אילוצי הכוננים', ).
    if (
      normalizedMessage.includes(
        'לא התקבלה תשובה בעת יצירת חודש אילוצי הכוננים',
      )
    ) {
      return 'לא התקבלה תשובה תקינה בעת יצירת חודש אילוצי הכוננים.';
    }

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר normalizedMessage.includes( 'לא התקבלה תשובה בעת פתיחת חודש אילוצי הכוננים', ).
    if (
      normalizedMessage.includes(
        'לא התקבלה תשובה בעת פתיחת חודש אילוצי הכוננים',
      )
    ) {
      return 'לא התקבלה תשובה תקינה בעת פתיחת חודש אילוצי הכוננים.';
    }

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר normalizedMessage.includes( 'התקבלה תשובה לא תקינה בעת טעינת חודשי אילוצי הכוננים', ).
    if (
      normalizedMessage.includes(
        'התקבלה תשובה לא תקינה בעת טעינת חודשי אילוצי הכוננים',
      )
    ) {
      return 'התקבלה תשובה לא תקינה בעת טעינת חודשי אילוצי הכוננים.';
    }
    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר normalizedMessage.includes( 'not all active drivers submitted availability', ).
    if (
  normalizedMessage.includes(
    'not all active drivers submitted availability',
  )
      ) {
        return 'לא כל הכוננים הפעילים הגישו אילוצים.';
      }

      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר normalizedMessage.includes( 'only open driver availability periods can be closed', ).
      if (
        normalizedMessage.includes(
          'only open driver availability periods can be closed',
        )
      ) {
        return 'ניתן לסגור רק חודש שנמצא במצב פתוח להגשה.';
      }

      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר normalizedMessage.includes( 'לא התקבלה תשובה בעת סגירת חודש אילוצי הכוננים', ).
      if (
        normalizedMessage.includes(
          'לא התקבלה תשובה בעת סגירת חודש אילוצי הכוננים',
        )
      ) {
        return 'לא התקבלה תשובה תקינה בעת סגירת חודש אילוצי הכוננים.';
      }

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר normalizedMessage.includes( 'only closed driver availability periods can be reopened', ).
    if (
      normalizedMessage.includes(
        'only closed driver availability periods can be reopened',
      )
    ) {
      return 'ניתן לפתוח מחדש רק חודש אילוצים סגור.';
    }

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר normalizedMessage.includes( 'driver availability period already has a schedule', ).
    if (
      normalizedMessage.includes(
        'driver availability period already has a schedule',
      )
    ) {
      return 'לא ניתן לבצע את הפעולה משום שכבר נוצר לוח כוננים מהחודש הזה.';
    }

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר normalizedMessage.includes( 'לא התקבלה תשובה בעת פתיחה מחדש של חודש אילוצי הכוננים', ).
    if (
      normalizedMessage.includes(
        'לא התקבלה תשובה בעת פתיחה מחדש של חודש אילוצי הכוננים',
      )
    ) {
      return 'לא התקבלה תשובה תקינה בעת פתיחה מחדש של חודש האילוצים.';
    }

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר normalizedMessage.includes( 'לא התקבלה תשובה בעת מחיקת חודש אילוצי הכוננים', ).
    if (
      normalizedMessage.includes(
        'לא התקבלה תשובה בעת מחיקת חודש אילוצי הכוננים',
      )
    ) {
      return 'לא התקבלה תשובה תקינה בעת מחיקת חודש האילוצים.';
    }

    return error.message;
  }

  return 'לא ניתן היה לבצע את הפעולה במערכת אילוצי הכוננים.';
}

/**
 * פעולה useDriverAvailabilityPeriods: חיבור מצב או הקשר עבור תקופות אילוצים.
 * @returns UseDriverAvailabilityPeriodsResult — הפלט בהתאם לחתימה.
 */
export function useDriverAvailabilityPeriods():
  UseDriverAvailabilityPeriodsResult {
  // מצב מקומי: state — מצב; setState מעדכנת אותו ומפעילה רינדור לפי React.
  const [
    state,
    setState,
  ] =
    useState<DriverAvailabilityPeriodsState>(
      initialState,
    );

  // loadPeriods — תקופות.
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

        // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
        try {
          // periods — תקופות.
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
          // normalizedError — שגיאה.
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
// closePeriod — תקופה.
const closePeriod =
  useCallback(
    async (
      periodId: string,
      force = false,
    ): Promise<CloseDriverAvailabilityPeriodResponse> => {
      // normalizedPeriodId — מזהה התקופה.
      const normalizedPeriodId =
        periodId.trim();

      // עצירת הפעולה עם שגיאה כאשר !normalizedPeriodId.
      if (!normalizedPeriodId) {
        // missingPeriodError — תקופה / שגיאה.
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

      // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
      try {
        // result — תוצאה.
        const result =
          await driverAvailabilityService
            .closePeriod(
              normalizedPeriodId,
              force,
            );

        // periods — תקופות.
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
        // normalizedError — שגיאה.
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
  // createPeriod — תקופה.
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

        // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
        try {
          // result — תוצאה.
          const result =
            await driverAvailabilityService
              .createPeriod(
                request,
              );

          // periods — תקופות.
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
          // normalizedError — שגיאה.
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

  // openPeriod — תקופה.
  const openPeriod =
    useCallback(
      async (
        periodId: string,
      ): Promise<OpenDriverAvailabilityPeriodResponse> => {
        // normalizedPeriodId — מזהה התקופה.
        const normalizedPeriodId =
          periodId.trim();

        // עצירת הפעולה עם שגיאה כאשר !normalizedPeriodId.
        if (
          !normalizedPeriodId
        ) {
          // missingPeriodError — תקופה / שגיאה.
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

        // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
        try {
          // result — תוצאה.
          const result =
            await driverAvailabilityService
              .openPeriod(
                normalizedPeriodId,
              );

          // periods — תקופות.
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
          // normalizedError — שגיאה.
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

  // reopenPeriod — תקופה.
  const reopenPeriod =
    useCallback(
      async (
        periodId: string,
      ): Promise<ReopenDriverAvailabilityPeriodResponse> => {
        // normalizedPeriodId — מזהה התקופה.
        const normalizedPeriodId =
          periodId.trim();

        // עצירת הפעולה עם שגיאה כאשר !normalizedPeriodId.
        if (!normalizedPeriodId) {
          throw new Error(
            'Driver availability period id is required.',
          );
        }

        setState(
          (currentState) => ({
            ...currentState,

            reopeningPeriodId:
              normalizedPeriodId,

            error:
              null,

            lastReopenedResult:
              null,
          }),
        );

        // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
        try {
          // result — תוצאה.
          const result =
            await driverAvailabilityService
              .reopenPeriod(
                normalizedPeriodId,
              );

          // periods — תקופות.
          const periods =
            await driverAvailabilityService
              .getPeriods();

          setState(
            (currentState) => ({
              ...currentState,

              periods,

              reopeningPeriodId:
                null,

              error:
                null,

              lastReopenedResult:
                result,
            }),
          );

          return result;
        } catch (error) {
          // normalizedError — שגיאה.
          const normalizedError =
            normalizeDriverAvailabilityError(
              error,
            );

          setState(
            (currentState) => ({
              ...currentState,

              reopeningPeriodId:
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

  // deletePeriod — תקופה.
  const deletePeriod =
    useCallback(
      async (
        periodId: string,
      ): Promise<DeleteDriverAvailabilityPeriodResponse> => {
        // normalizedPeriodId — מזהה התקופה.
        const normalizedPeriodId =
          periodId.trim();

        // עצירת הפעולה עם שגיאה כאשר !normalizedPeriodId.
        if (!normalizedPeriodId) {
          throw new Error(
            'Driver availability period id is required.',
          );
        }

        setState(
          (currentState) => ({
            ...currentState,

            deletingPeriodId:
              normalizedPeriodId,

            error:
              null,

            lastDeletedResult:
              null,
          }),
        );

        // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
        try {
          // result — תוצאה.
          const result =
            await driverAvailabilityService
              .deletePeriod(
                normalizedPeriodId,
              );

          // periods — תקופות.
          const periods =
            await driverAvailabilityService
              .getPeriods();

          setState(
            (currentState) => ({
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
        } catch (error) {
          // normalizedError — שגיאה.
          const normalizedError =
            normalizeDriverAvailabilityError(
              error,
            );

          setState(
            (currentState) => ({
              ...currentState,

              deletingPeriodId:
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

  // clearError — שגיאה.
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
    reopenPeriod,
    deletePeriod,

    clearError,

    reset,
  };
}