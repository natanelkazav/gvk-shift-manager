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

interface AssignmentCandidatesStatistics {
  totalShifts: number;
  noAvailableShifts: number;
  singleAvailableShifts: number;
  multipleAvailableShifts: number;
}

interface UseAssignmentCandidatesResult {
  state:
    AssignmentCandidatesState;

  selectedPeriodId:
    string | null;

  statistics:
    AssignmentCandidatesStatistics;

  loadCandidates: (
    periodId: string,
  ) => Promise<void>;

  reset:
    () => void;

  clearError:
    () => void;
}

const initialState:
  AssignmentCandidatesState = {
    data: null,
    isLoading: false,
    error: null,
  };

function getErrorMessage(
  error: unknown,
): string {
  if (error instanceof Error) {
    return error.message;
  }

  return 'אירעה שגיאה בלתי צפויה בטעינת נתוני ההכנה לשיבוץ.';
}

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

export function useAssignmentCandidates():
  UseAssignmentCandidatesResult {
  const [
    state,
    setState,
  ] =
    useState<AssignmentCandidatesState>(
      initialState,
    );

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
        const normalizedPeriodId =
          periodId.trim();

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

        try {
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