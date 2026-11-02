/**
 * קובץ: src/hooks/useMorningDriverAvailabilityManagement.ts
 * מטרה: ניהול מצב ותופעות לוואי באמצעות React עבור כונני בוקר.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: MorningDriverAvailabilityManagementState, getErrorMessage, useMorningDriverAvailabilityManagement.
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
  CloseMorningDriverAvailabilityPeriodResponse,
  MorningDriverAvailabilityManagementData,
  ReopenMorningDriverAvailabilitySubmissionResponse,
} from '../types/morningDriverAvailability';

/**
 * חוזה הנתונים MorningDriverAvailabilityManagementState: כונני בוקר.
 */
interface MorningDriverAvailabilityManagementState {
  // data — נתונים.
  data:
    MorningDriverAvailabilityManagementData | null;

  // selectedPeriodId — מזהה התקופה.
  selectedPeriodId:
    string | null;

  // isLoading — האם טעינה מתבצעת.
  isLoading: boolean;

  // reopeningUserId — מזהה משתמש.
  reopeningUserId:
    string | null;

  isClosing: boolean;

  // error — שגיאה.
  error:
    string | null;

  // lastReopenResult — תוצאה.
  lastReopenResult:
    ReopenMorningDriverAvailabilitySubmissionResponse | null;

  // lastCloseResult — תוצאה.
  lastCloseResult:
    CloseMorningDriverAvailabilityPeriodResponse | null;
}

// initialState — מצב.
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

/**
 * פעולה getErrorMessage: שליפה או חישוב של הודעת שגיאה.
 * @param error — שגיאה.
 * @returns string — הפלט בהתאם לחתימה.
 */
function getErrorMessage(
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

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר normalizedMessage.includes( 'not allowed', ).
    if (
      normalizedMessage.includes(
        'not allowed',
      )
    ) {
      return 'אין לך הרשאה לנהל אילוצי כונני בוקר.';
    }

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר normalizedMessage.includes( 'only submitted availability can be reopened', ).
    if (
      normalizedMessage.includes(
        'only submitted availability can be reopened',
      )
    ) {
      return 'ניתן לפתוח מחדש רק הגשה שכבר הוגשה.';
    }

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר normalizedMessage.includes( 'only open periods support reopening submissions', ).
    if (
      normalizedMessage.includes(
        'only open periods support reopening submissions',
      )
    ) {
      return 'ניתן לפתוח הגשה מחדש רק כאשר חודש האילוצים פתוח.';
    }

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר normalizedMessage.includes( 'not all morning drivers submitted availability', ).
    if (
      normalizedMessage.includes(
        'not all morning drivers submitted availability',
      )
    ) {
      return 'לא כל כונני הבוקר הגישו אילוצים.';
    }

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר normalizedMessage.includes( 'only open periods can be closed', ).
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

/**
 * פעולה useMorningDriverAvailabilityManagement: חיבור מצב או הקשר עבור כונני בוקר.
 */
export function useMorningDriverAvailabilityManagement() {
  // מצב מקומי: state — מצב; setState מעדכנת אותו ומפעילה רינדור לפי React.
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
        // normalizedPeriodId — מזהה התקופה.
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

        // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
        try {
          // data — נתונים.
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
        // עצירת הפעולה עם שגיאה כאשר !state.selectedPeriodId.
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

        // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
        try {
          // result — תוצאה.
          const result =
            await morningDriverAvailabilityService
              .reopenSubmission(
                state.selectedPeriodId,
                userId,
              );

          // data — נתונים.
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

  // closePeriod — תקופה.
  const closePeriod =
    useCallback(
      async (
        force = false,
      ): Promise<CloseMorningDriverAvailabilityPeriodResponse> => {
        // עצירת הפעולה עם שגיאה כאשר !state.selectedPeriodId.
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

        // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
        try {
          // result — תוצאה.
          const result =
            await morningDriverAvailabilityService
              .closePeriod(
                state.selectedPeriodId,
                force,
              );

          // data — נתונים.
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
