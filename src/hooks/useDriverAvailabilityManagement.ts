/**
 * קובץ: src/hooks/useDriverAvailabilityManagement.ts
 * מטרה: ניהול מצב ותופעות לוואי באמצעות React עבור כוננים / אילוצים וזמינות.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: DriverAvailabilityManagementState, UseDriverAvailabilityManagementResult, normalizeDriverAvailabilityManagementError, useDriverAvailabilityManagement.
 * - ריכוז ההגדרות והלוגיקה המפורטות בהמשך הקובץ.
 */
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

/**
 * חוזה הנתונים DriverAvailabilityManagementState: כוננים / אילוצים וזמינות / מצב.
 */
interface DriverAvailabilityManagementState {
  // data — נתונים.
  data:
    DriverAvailabilityManagementData | null;

  // selectedPeriodId — מזהה התקופה.
  selectedPeriodId:
    string | null;

  // isLoading — האם טעינה מתבצעת.
  isLoading: boolean;

  // error — שגיאה.
  error:
    string | null;
}

/**
 * חוזה הנתונים UseDriverAvailabilityManagementResult: כוננים / אילוצים וזמינות / תוצאה.
 */
interface UseDriverAvailabilityManagementResult {
  // state — מצב.
  state:
    DriverAvailabilityManagementState;

  // loadManagementData — נתונים.
  loadManagementData: (
    periodId: string,
  ) => Promise<DriverAvailabilityManagementData>;

  // clearError — שגיאה.
  clearError:
    () => void;

  reset:
    () => void;
}

// initialState — מצב.
const initialState:
  DriverAvailabilityManagementState = {
    data: null,

    selectedPeriodId:
      null,

    isLoading: false,

    error: null,
  };

/**
 * פעולה normalizeDriverAvailabilityManagementError: נרמול כוננים / אילוצים וזמינות / שגיאה.
 * @param error — שגיאה.
 * @returns string — הפלט בהתאם לחתימה.
 */
function normalizeDriverAvailabilityManagementError(
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
      return 'אין לך הרשאה לצפות בנתוני ניהול אילוצי הכוננים.';
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

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר normalizedMessage.includes( 'לא התקבלה תשובה בעת טעינת נתוני ניהול אילוצי הכוננים', ).
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

/**
 * פעולה useDriverAvailabilityManagement: חיבור מצב או הקשר עבור כוננים / אילוצים וזמינות.
 * @returns UseDriverAvailabilityManagementResult — הפלט בהתאם לחתימה.
 */
export function useDriverAvailabilityManagement():
  UseDriverAvailabilityManagementResult {
  // מצב מקומי: state — מצב; setState מעדכנת אותו ומפעילה רינדור לפי React.
  const [
    state,
    setState,
  ] =
    useState<DriverAvailabilityManagementState>(
      initialState,
    );

  // loadManagementData — נתונים.
  const loadManagementData =
    useCallback(
      async (
        periodId: string,
      ): Promise<DriverAvailabilityManagementData> => {
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

        // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
        try {
          // data — נתונים.
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
          // normalizedError — שגיאה.
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

    loadManagementData,

    clearError,

    reset,
  };
}