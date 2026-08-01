import {
  useCallback,
  useState,
} from 'react';
import { availabilitySubmissionsService } from '../services/availabilitySubmissionsService';
import type {
  AvailabilityPeriodSubmissionsState,
} from '../types/availabilitySubmissions';

interface UseAvailabilityPeriodSubmissionsResult {
  state:
    AvailabilityPeriodSubmissionsState;

  selectedPeriodId:
    string | null;

  loadPeriodSubmissions: (
    periodId: string,
  ) => Promise<void>;

  reset:
    () => void;

  clearError:
    () => void;
}

const initialState:
  AvailabilityPeriodSubmissionsState = {
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

  return 'אירעה שגיאה בלתי צפויה בטעינת מעקב ההגשות.';
}

export function useAvailabilityPeriodSubmissions():
  UseAvailabilityPeriodSubmissionsResult {
  const [
    state,
    setState,
  ] =
    useState<AvailabilityPeriodSubmissionsState>(
      initialState,
    );

  const [
    selectedPeriodId,
    setSelectedPeriodId,
  ] =
    useState<string | null>(
      null,
    );

  const loadPeriodSubmissions =
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