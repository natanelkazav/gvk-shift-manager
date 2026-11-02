/**
 * קובץ: src/hooks/useAvailabilityPeriodSubmissions.ts
 * מטרה: ניהול מצב ותופעות לוואי באמצעות React עבור תקופת אילוצים.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: UseAvailabilityPeriodSubmissionsResult, getErrorMessage, useAvailabilityPeriodSubmissions.
 * - ריכוז ההגדרות והלוגיקה המפורטות בהמשך הקובץ.
 */
import {
  useCallback,
  useState,
} from 'react';
import { availabilitySubmissionsService } from '../services/availabilitySubmissionsService';
import type {
  AvailabilityPeriodSubmissionsState,
} from '../types/availabilitySubmissions';

/**
 * חוזה הנתונים UseAvailabilityPeriodSubmissionsResult: תקופת אילוצים.
 */
interface UseAvailabilityPeriodSubmissionsResult {
  // state — מצב.
  state:
    AvailabilityPeriodSubmissionsState;

  // selectedPeriodId — מזהה התקופה.
  selectedPeriodId:
    string | null;

  // loadPeriodSubmissions — תקופה.
  loadPeriodSubmissions: (
    periodId: string,
  ) => Promise<void>;

  reset:
    () => void;

  // clearError — שגיאה.
  clearError:
    () => void;
}

// initialState — מצב.
const initialState:
  AvailabilityPeriodSubmissionsState = {
    data: null,
    isLoading: false,
    error: null,
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
  if (error instanceof Error) {
    return error.message;
  }

  return 'אירעה שגיאה בלתי צפויה בטעינת מעקב ההגשות.';
}

/**
 * פעולה useAvailabilityPeriodSubmissions: חיבור מצב או הקשר עבור תקופת אילוצים.
 * @returns UseAvailabilityPeriodSubmissionsResult — הפלט בהתאם לחתימה.
 */
export function useAvailabilityPeriodSubmissions():
  UseAvailabilityPeriodSubmissionsResult {
  // מצב מקומי: state — מצב; setState מעדכנת אותו ומפעילה רינדור לפי React.
  const [
    state,
    setState,
  ] =
    useState<AvailabilityPeriodSubmissionsState>(
      initialState,
    );

  // מצב מקומי: selectedPeriodId — מזהה התקופה; setSelectedPeriodId מעדכנת אותו ומפעילה רינדור לפי React.
  const [
    selectedPeriodId,
    setSelectedPeriodId,
  ] =
    useState<string | null>(
      null,
    );

  // loadPeriodSubmissions — תקופה.
  const loadPeriodSubmissions =
    useCallback(
      async (
        periodId: string,
      ): Promise<void> => {
        // normalizedPeriodId — מזהה התקופה.
        const normalizedPeriodId =
          periodId.trim();

        // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !normalizedPeriodId.
        if (!normalizedPeriodId) {
          setState({
            data: null,
            isLoading: false,
            error:
              'לא התקבל מזהה תקופת אילוצים תקין.',
          });

          return;
        }

        setSelectedPeriodId(
          normalizedPeriodId,
        );

        setState(
          (currentState) => ({
            ...currentState,
            isLoading: true,
            error: null,
          }),
        );

        // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
        try {
          // data — נתונים.
          const data =
            await availabilitySubmissionsService
              .getPeriodSubmissions(
                normalizedPeriodId,
              );

          setState({
            data,
            isLoading: false,
            error: null,
          });
        } catch (error) {
          setState({
            data: null,
            isLoading: false,
            error:
              getErrorMessage(error),
          });
        }
      },
      [],
    );

  const reset =
    useCallback((): void => {
      setSelectedPeriodId(null);

      setState(initialState);
    }, []);

  // clearError — שגיאה.
  const clearError =
    useCallback((): void => {
      setState(
        (currentState) => ({
          ...currentState,
          error: null,
        }),
      );
    }, []);

  return {
    state,
    selectedPeriodId,
    loadPeriodSubmissions,
    reset,
    clearError,
  };
}