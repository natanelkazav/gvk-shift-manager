/**
 * קובץ: src/hooks/useAvailabilityPeriodMatrix.ts
 * מטרה: ניהול מצב ותופעות לוואי באמצעות React עבור תקופת אילוצים.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: AvailabilityMatrixStatistics, UseAvailabilityPeriodMatrixResult, getErrorMessage, calculateMatrixStatistics, useAvailabilityPeriodMatrix.
 * - ריכוז ההגדרות והלוגיקה המפורטות בהמשך הקובץ.
 */
import {
  useCallback,
  useMemo,
  useState,
} from 'react';
import { availabilityMatrixService } from '../services/availabilityMatrixService';
import type {
  AvailabilityMatrixShift,
  AvailabilityPeriodMatrixState,
} from '../types/availabilityMatrix';

/**
 * חוזה הנתונים AvailabilityMatrixStatistics: אילוצים וזמינות / מטריצת נתונים / סטטיסטיקה.
 */
interface AvailabilityMatrixStatistics {
  // totalShifts — סך הכול / משמרות.
  totalShifts: number;
  // noAvailableShifts — משמרות.
  noAvailableShifts: number;
  // singleAvailableShifts — משמרות.
  singleAvailableShifts: number;
  // multipleAvailableShifts — משמרות.
  multipleAvailableShifts: number;
  // incompleteShifts — משמרות.
  incompleteShifts: number;
}

/**
 * חוזה הנתונים UseAvailabilityPeriodMatrixResult: תקופת אילוצים.
 */
interface UseAvailabilityPeriodMatrixResult {
  // state — מצב.
  state:
    AvailabilityPeriodMatrixState;

  // selectedPeriodId — מזהה התקופה.
  selectedPeriodId:
    string | null;

  // statistics — סטטיסטיקה.
  statistics:
    AvailabilityMatrixStatistics;

  // loadMatrix — מטריצת נתונים.
  loadMatrix: (
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
  AvailabilityPeriodMatrixState = {
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

  return 'אירעה שגיאה בלתי צפויה בטעינת מטריצת הזמינות.';
}

/**
 * פעולה calculateMatrixStatistics: חישוב מטריצת נתונים / סטטיסטיקה.
 * @param shifts — משמרות.
 * @returns AvailabilityMatrixStatistics — הפלט בהתאם לחתימה.
 */
function calculateMatrixStatistics(
  shifts:
    AvailabilityMatrixShift[],
): AvailabilityMatrixStatistics {
  // totalShifts — סך הכול / משמרות.
  const totalShifts =
    shifts.length;

  // noAvailableShifts — משמרות.
  const noAvailableShifts =
    shifts.filter(
      (shift) =>
        shift.availableDispatchers ===
          0 &&
        shift.unansweredDispatchers ===
          0,
    ).length;

  // singleAvailableShifts — משמרות.
  const singleAvailableShifts =
    shifts.filter(
      (shift) =>
        shift.availableDispatchers ===
          1 &&
        shift.unansweredDispatchers ===
          0,
    ).length;

  // multipleAvailableShifts — משמרות.
  const multipleAvailableShifts =
    shifts.filter(
      (shift) =>
        shift.availableDispatchers >=
          2 &&
        shift.unansweredDispatchers ===
          0,
    ).length;

  // incompleteShifts — משמרות.
  const incompleteShifts =
    shifts.filter(
      (shift) =>
        shift.unansweredDispatchers >
        0,
    ).length;

  return {
    totalShifts,
    noAvailableShifts,
    singleAvailableShifts,
    multipleAvailableShifts,
    incompleteShifts,
  };
}

/**
 * פעולה useAvailabilityPeriodMatrix: חיבור מצב או הקשר עבור תקופת אילוצים.
 * @returns UseAvailabilityPeriodMatrixResult — הפלט בהתאם לחתימה.
 */
export function useAvailabilityPeriodMatrix():
  UseAvailabilityPeriodMatrixResult {
  // מצב מקומי: state — מצב; setState מעדכנת אותו ומפעילה רינדור לפי React.
  const [
    state,
    setState,
  ] =
    useState<AvailabilityPeriodMatrixState>(
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

  // loadMatrix — מטריצת נתונים.
  const loadMatrix =
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
            await availabilityMatrixService
              .getAvailabilityPeriodMatrix(
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

  // ערך מחושב statistics — סטטיסטיקה; נשמר בין רינדורים עד שינוי התלויות.
  const statistics =
    useMemo(
      () =>
        calculateMatrixStatistics(
          state.data?.shifts ??
            [],
        ),
      [state.data],
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
    statistics,
    loadMatrix,
    reset,
    clearError,
  };
}