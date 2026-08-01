import {
  useCallback,
  useEffect,
  useState,
} from 'react';
import { availabilityService } from '../services/availabilityService';
import type {
  AvailabilityPeriod,
  CreateAvailabilityPeriodInput,
  CreateAvailabilityPeriodResult,
} from '../types/availability';

interface AvailabilityPeriodsState {
  periods: AvailabilityPeriod[];
  isLoading: boolean;
  isCreating: boolean;
  error: string | null;
  lastCreatedResult:
    CreateAvailabilityPeriodResult | null;
}

interface UseAvailabilityPeriodsResult {
  state: AvailabilityPeriodsState;

  loadPeriods: () => Promise<void>;

  createPeriod: (
    input: CreateAvailabilityPeriodInput,
  ) => Promise<CreateAvailabilityPeriodResult>;

  clearError: () => void;

  clearCreatedResult: () => void;
}

const initialState:
  AvailabilityPeriodsState = {
    periods: [],
    isLoading: true,
    isCreating: false,
    error: null,
    lastCreatedResult: null,
  };

function getErrorMessage(
  error: unknown,
): string {
  if (error instanceof Error) {
    return error.message;
  }

  return 'אירעה שגיאה בלתי צפויה בניהול תקופות האילוצים.';
}

export function useAvailabilityPeriods():
  UseAvailabilityPeriodsResult {
  const [
    state,
    setState,
  ] =
    useState<AvailabilityPeriodsState>(
      initialState,
    );

  const loadPeriods =
    useCallback(
      async (): Promise<void> => {
        setState(
          (currentState) => ({
            ...currentState,
            isLoading: true,
            error: null,
          }),
        );

        try {
          const periods =
            await availabilityService
              .getAvailabilityPeriods();

          setState(
            (currentState) => ({
              ...currentState,
              periods,
              isLoading: false,
              error: null,
            }),
          );
        } catch (error) {
          setState(
            (currentState) => ({
              ...currentState,
              isLoading: false,
              error:
                getErrorMessage(
                  error,
                ),
            }),
          );
        }
      },
      [],
    );

  useEffect(() => {
    void loadPeriods();
  }, [loadPeriods]);

  const createPeriod =
    useCallback(
      async (
        input:
          CreateAvailabilityPeriodInput,
      ): Promise<CreateAvailabilityPeriodResult> => {
        setState(
          (currentState) => ({
            ...currentState,
            isCreating: true,
            error: null,
            lastCreatedResult: null,
          }),
        );

        try {
          const result =
            await availabilityService
              .createAvailabilityPeriod(
                input,
              );

          const periods =
            await availabilityService
              .getAvailabilityPeriods();

          setState({
            periods,
            isLoading: false,
            isCreating: false,
            error: null,
            lastCreatedResult:
              result,
          });

          return result;
        } catch (error) {
          const errorMessage =
            getErrorMessage(error);

          setState(
            (currentState) => ({
              ...currentState,
              isCreating: false,
              error:
                errorMessage,
            }),
          );

          throw error;
        }
      },
      [],
    );

  const clearError =
    useCallback((): void => {
      setState(
        (currentState) => ({
          ...currentState,
          error: null,
        }),
      );
    }, []);

  const clearCreatedResult =
    useCallback((): void => {
      setState(
        (currentState) => ({
          ...currentState,
          lastCreatedResult:
            null,
        }),
      );
    }, []);

  return {
    state,
    loadPeriods,
    createPeriod,
    clearError,
    clearCreatedResult,
  };
}