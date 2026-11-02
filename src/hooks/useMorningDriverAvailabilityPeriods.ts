/**
 * קובץ: src/hooks/useMorningDriverAvailabilityPeriods.ts
 * מטרה: ניהול מצב ותופעות לוואי באמצעות React עבור תקופות אילוצים.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: MorningDriverAvailabilityPeriodsState, UseMorningDriverAvailabilityPeriodsResult, normalizeMorningDriverAvailabilityError, useMorningDriverAvailabilityPeriods.
 * - ריכוז ההגדרות והלוגיקה המפורטות בהמשך הקובץ.
 */
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

/**
 * חוזה הנתונים MorningDriverAvailabilityPeriodsState: תקופות אילוצים.
 */
interface MorningDriverAvailabilityPeriodsState {
  // periods — תקופות.
  periods:
    MorningDriverAvailabilityPeriodListItem[];

  // isLoading — האם טעינה מתבצעת.
  isLoading:
    boolean;

  isCreating:
    boolean;

  // openingPeriodId — מזהה התקופה.
  openingPeriodId:
    string | null;

  // reopeningPeriodId — מזהה התקופה.
  reopeningPeriodId:
    string | null;

  // deletingPeriodId — מזהה התקופה.
  deletingPeriodId:
    string | null;

  // error — שגיאה.
  error:
    string | null;

  // lastCreatedResult — תוצאה.
  lastCreatedResult:
    CreateMorningDriverAvailabilityPeriodResponse | null;

  // lastOpenedResult — תוצאה.
  lastOpenedResult:
    OpenMorningDriverAvailabilityPeriodResponse | null;

  // lastReopenedResult — תוצאה.
  lastReopenedResult:
    ReopenMorningDriverAvailabilityPeriodResponse | null;

  // lastDeletedResult — תוצאה.
  lastDeletedResult:
    DeleteMorningDriverAvailabilityPeriodResponse | null;
}

/**
 * חוזה הנתונים UseMorningDriverAvailabilityPeriodsResult: תקופות אילוצים.
 */
interface UseMorningDriverAvailabilityPeriodsResult {
  // state — מצב.
  state:
    MorningDriverAvailabilityPeriodsState;

  // loadPeriods — תקופות.
  loadPeriods:
    () => Promise<
      MorningDriverAvailabilityPeriodListItem[]
    >;

  // createPeriod — תקופה.
  createPeriod: (
    request:
      CreateMorningDriverAvailabilityPeriodRequest,
  ) => Promise<CreateMorningDriverAvailabilityPeriodResponse>;

  // openPeriod — תקופה.
  openPeriod: (
    periodId: string,
  ) => Promise<OpenMorningDriverAvailabilityPeriodResponse>;

  // reopenPeriod — תקופה.
  reopenPeriod: (
    periodId: string,
  ) => Promise<ReopenMorningDriverAvailabilityPeriodResponse>;

  // deletePeriod — תקופה.
  deletePeriod: (
    periodId: string,
  ) => Promise<DeleteMorningDriverAvailabilityPeriodResponse>;

  // clearError — שגיאה.
  clearError:
    () => void;

  reset:
    () => void;
}

// initialState — מצב.
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

/**
 * פעולה normalizeMorningDriverAvailabilityError: נרמול כונני בוקר.
 * @param error — שגיאה.
 * @returns string — הפלט בהתאם לחתימה.
 */
function normalizeMorningDriverAvailabilityError(
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
      return 'אין לך הרשאה לנהל או לצפות באילוצי כונני הבוקר.';
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

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר normalizedMessage.includes( 'submission deadline is required', ).
    if (
      normalizedMessage.includes(
        'submission deadline is required',
      )
    ) {
      return 'יש להגדיר מועד אחרון להגשת האילוצים.';
    }

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר normalizedMessage.includes( 'morning driver availability period already exists', ).
    if (
      normalizedMessage.includes(
        'morning driver availability period already exists',
      )
    ) {
      return 'כבר קיים חודש אילוצים לכונני בוקר עבור החודש הזה.';
    }

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר normalizedMessage.includes( 'morning driver availability period not found', ).
    if (
      normalizedMessage.includes(
        'morning driver availability period not found',
      )
    ) {
      return 'חודש אילוצי כונני הבוקר לא נמצא.';
    }

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר normalizedMessage.includes( 'only draft periods can be opened', ).
    if (
      normalizedMessage.includes(
        'only draft periods can be opened',
      )
    ) {
      return 'ניתן לפתוח להגשה רק חודש שנמצא במצב טיוטה.';
    }

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר normalizedMessage.includes( 'only draft periods can be deleted', ).
    if (
      normalizedMessage.includes(
        'only draft periods can be deleted',
      )
    ) {
      return 'ניתן למחוק רק חודש אילוצים שנמצא במצב טיוטה.';
    }

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר normalizedMessage.includes( 'morning driver availability period id is required', ) || normalizedMessage.includes( 'period id is required', ).
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

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר normalizedMessage.includes( 'התקבלה תשובה לא תקינה בעת טעינת חודשי אילוצי כונני הבוקר', ).
    if (
      normalizedMessage.includes(
        'התקבלה תשובה לא תקינה בעת טעינת חודשי אילוצי כונני הבוקר',
      )
    ) {
      return 'התקבלה תשובה לא תקינה בעת טעינת חודשי אילוצי כונני הבוקר.';
    }

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר normalizedMessage.includes( 'לא התקבלה תשובה בעת יצירת חודש אילוצי כונני הבוקר', ).
    if (
      normalizedMessage.includes(
        'לא התקבלה תשובה בעת יצירת חודש אילוצי כונני הבוקר',
      )
    ) {
      return 'לא התקבלה תשובה תקינה בעת יצירת חודש האילוצים.';
    }

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר normalizedMessage.includes( 'לא התקבלה תשובה בעת פתיחת חודש אילוצי כונני הבוקר', ).
    if (
      normalizedMessage.includes(
        'לא התקבלה תשובה בעת פתיחת חודש אילוצי כונני הבוקר',
      )
    ) {
      return 'לא התקבלה תשובה תקינה בעת פתיחת חודש האילוצים.';
    }

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר normalizedMessage.includes( 'לא התקבלה תשובה בעת מחיקת חודש אילוצי כונני הבוקר', ).
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

/**
 * פעולה useMorningDriverAvailabilityPeriods: חיבור מצב או הקשר עבור תקופות אילוצים.
 * @returns UseMorningDriverAvailabilityPeriodsResult — הפלט בהתאם לחתימה.
 */
export function useMorningDriverAvailabilityPeriods():
  UseMorningDriverAvailabilityPeriodsResult {
  // מצב מקומי: state — מצב; setState מעדכנת אותו ומפעילה רינדור לפי React.
  const [
    state,
    setState,
  ] =
    useState<MorningDriverAvailabilityPeriodsState>(
      initialState,
    );

  // loadPeriods — תקופות.
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

        // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
        try {
          // periods — תקופות.
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

  // createPeriod — תקופה.
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

        // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
        try {
          // result — תוצאה.
          const result =
            await morningDriverAvailabilityService
              .createPeriod(
                request,
              );

          // periods — תקופות.
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

  // openPeriod — תקופה.
  const openPeriod =
    useCallback(
      async (
        periodId: string,
      ): Promise<OpenMorningDriverAvailabilityPeriodResponse> => {
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

        // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
        try {
          // result — תוצאה.
          const result =
            await morningDriverAvailabilityService
              .openPeriod(
                normalizedPeriodId,
              );

          // periods — תקופות.
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

  // reopenPeriod — תקופה.
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

        // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
        try {
          // result — תוצאה.
          const result =
            await morningDriverAvailabilityService
              .reopenPeriod(
                periodId,
              );

          // periods — תקופות.
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

  // deletePeriod — תקופה.
  const deletePeriod =
    useCallback(
      async (
        periodId: string,
      ): Promise<DeleteMorningDriverAvailabilityPeriodResponse> => {
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

        // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
        try {
          // result — תוצאה.
          const result =
            await morningDriverAvailabilityService
              .deletePeriod(
                normalizedPeriodId,
              );

          // periods — תקופות.
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

  // clearError — שגיאה.
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