/**
 * קובץ: src/hooks/useAssignmentCandidates.ts
 * מטרה: ניהול מצב ותופעות לוואי באמצעות React עבור הקצאה.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: AssignmentCandidatesStatistics, UseAssignmentCandidatesResult, getErrorMessage, calculateStatistics, useAssignmentCandidates.
 * - ריכוז ההגדרות והלוגיקה המפורטות בהמשך הקובץ.
 */
import {
  useCallback,
  useMemo,
  useState,
} from 'react';
import { assignmentCandidatesService } from '../services/assignmentCandidatesService';
import type {
  AssignmentCandidateShift,
  AssignmentCandidatesState,
} from '../types/assignmentCandidates';

/**
 * חוזה הנתונים AssignmentCandidatesStatistics: הקצאה / סטטיסטיקה.
 */
interface AssignmentCandidatesStatistics {
  // totalShifts — סך הכול / משמרות.
  totalShifts: number;
  // noAvailableShifts — משמרות.
  noAvailableShifts: number;
  // singleAvailableShifts — משמרות.
  singleAvailableShifts: number;
  // multipleAvailableShifts — משמרות.
  multipleAvailableShifts: number;
}

/**
 * חוזה הנתונים UseAssignmentCandidatesResult: הקצאה / תוצאה.
 */
interface UseAssignmentCandidatesResult {
  // state — מצב.
  state:
    AssignmentCandidatesState;

  // selectedPeriodId — מזהה התקופה.
  selectedPeriodId:
    string | null;

  // statistics — סטטיסטיקה.
  statistics:
    AssignmentCandidatesStatistics;

  loadCandidates: (
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
  AssignmentCandidatesState = {
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

  return 'אירעה שגיאה בלתי צפויה בטעינת נתוני ההכנה לשיבוץ.';
}

/**
 * פעולה calculateStatistics: חישוב סטטיסטיקה.
 * @param shifts — משמרות.
 * @returns AssignmentCandidatesStatistics — הפלט בהתאם לחתימה.
 */
function calculateStatistics(
  shifts:
    AssignmentCandidateShift[],
): AssignmentCandidatesStatistics {
  return {
    totalShifts:
      shifts.length,

    noAvailableShifts:
      shifts.filter(
        (shift) =>
          shift.assignmentState ===
          'no_available',
      ).length,

    singleAvailableShifts:
      shifts.filter(
        (shift) =>
          shift.assignmentState ===
          'single_available',
      ).length,

    multipleAvailableShifts:
      shifts.filter(
        (shift) =>
          shift.assignmentState ===
          'multiple_available',
      ).length,
  };
}

/**
 * פעולה useAssignmentCandidates: חיבור מצב או הקשר עבור הקצאה.
 * @returns UseAssignmentCandidatesResult — הפלט בהתאם לחתימה.
 */
export function useAssignmentCandidates():
  UseAssignmentCandidatesResult {
  // מצב מקומי: state — מצב; setState מעדכנת אותו ומפעילה רינדור לפי React.
  const [
    state,
    setState,
  ] =
    useState<AssignmentCandidatesState>(
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

  const loadCandidates =
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
            await assignmentCandidatesService
              .getAssignmentCandidates(
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
        calculateStatistics(
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
    loadCandidates,
    reset,
    clearError,
  };
}