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

interface AvailabilityMatrixStatistics {
  totalShifts: number;
  noAvailableShifts: number;
  singleAvailableShifts: number;
  multipleAvailableShifts: number;
  incompleteShifts: number;
}

interface UseAvailabilityPeriodMatrixResult {
  state:
    AvailabilityPeriodMatrixState;

  selectedPeriodId:
    string | null;

  statistics:
    AvailabilityMatrixStatistics;

  loadMatrix: (
    periodId: string,
  ) => Promise<void>;

  reset:
    () => void;

  clearError:
    () => void;
}

const initialState:
  AvailabilityPeriodMatrixState = {
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

  return 'אירעה שגיאה בלתי צפויה בטעינת מטריצת הזמינות.';
}

function calculateMatrixStatistics(
  shifts:
    AvailabilityMatrixShift[],
): AvailabilityMatrixStatistics {
  const totalShifts =
    shifts.length;

  const noAvailableShifts =
    shifts.filter(
      (shift) =>
        shift.availableDispatchers ===
          0 &&
        shift.unansweredDispatchers ===
          0,
    ).length;

  const singleAvailableShifts =
    shifts.filter(
      (shift) =>
        shift.availableDispatchers ===
          1 &&
        shift.unansweredDispatchers ===
          0,
    ).length;

  const multipleAvailableShifts =
    shifts.filter(
      (shift) =>
        shift.availableDispatchers >=
          2 &&
        shift.unansweredDispatchers ===
          0,
    ).length;

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

export function useAvailabilityPeriodMatrix():
  UseAvailabilityPeriodMatrixResult {
  const [
    state,
    setState,
  ] =
    useState<AvailabilityPeriodMatrixState>(
      initialState,
    );

  const [
    selectedPeriodId,
    setSelectedPeriodId,
  ] =
    useState<string | null>(
      null,
    );

  const loadMatrix =
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