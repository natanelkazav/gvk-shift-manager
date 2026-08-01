import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { dispatcherAvailabilityService } from '../services/dispatcherAvailabilityService';
import type {
  DispatcherAvailabilityShift,
  DispatcherAvailabilityState,
  DispatcherAvailabilityStatus,
} from '../types/dispatcherAvailability';

interface DispatcherAvailabilityStatistics {
  total: number;
  answered: number;
  unanswered: number;
  available: number;
  unavailable: number;
  completionPercentage: number;
}

interface UseDispatcherAvailabilityResult {
  state:
    DispatcherAvailabilityState;

  statistics:
    DispatcherAvailabilityStatistics;

  savingShiftId:
    string | null;

  loadAvailability:
    () => Promise<void>;

  saveShiftAvailability: (
    shiftSlotId: string,
    status:
      DispatcherAvailabilityStatus,
    note?: string | null,
  ) => Promise<void>;

  clearError:
    () => void;
}

const initialState:
  DispatcherAvailabilityState = {
    data: null,
    isLoading: true,
    error: null,
  };

function getErrorMessage(
  error: unknown,
): string {
  if (error instanceof Error) {
    return error.message;
  }

  return 'אירעה שגיאה בלתי צפויה בטעינת האילוצים.';
}

function calculateStatistics(
  shifts:
    DispatcherAvailabilityShift[],
): DispatcherAvailabilityStatistics {
  const total =
    shifts.length;

  const available =
    shifts.filter(
      (shift) =>
        shift.availabilityStatus ===
        'available',
    ).length;

  const unavailable =
    shifts.filter(
      (shift) =>
        shift.availabilityStatus ===
        'unavailable',
    ).length;

  const answered =
    available + unavailable;

  const unanswered =
    total - answered;

  const completionPercentage =
    total === 0
      ? 0
      : Math.round(
          (
            answered /
            total
          ) * 100,
        );

  return {
    total,
    answered,
    unanswered,
    available,
    unavailable,
    completionPercentage,
  };
}

export function useDispatcherAvailability():
  UseDispatcherAvailabilityResult {
  const [
    state,
    setState,
  ] =
    useState<DispatcherAvailabilityState>(
      initialState,
    );

  const [
    savingShiftId,
    setSavingShiftId,
  ] =
    useState<string | null>(null);

  const loadAvailability =
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
          const data =
            await dispatcherAvailabilityService
              .getMyOpenAvailability();

          setState({
            data,
            isLoading: false,
            error: null,
          });
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
    void loadAvailability();
  }, [loadAvailability]);

  const saveShiftAvailability =
    useCallback(
      async (
        shiftSlotId: string,
        status:
          DispatcherAvailabilityStatus,
        note: string | null = null,
      ): Promise<void> => {
        setSavingShiftId(
          shiftSlotId,
        );

        setState(
          (currentState) => ({
            ...currentState,
            error: null,
          }),
        );

        try {
          const result =
            await dispatcherAvailabilityService
              .saveShiftAvailability({
                shiftSlotId,
                status,
                note,
              });

          setState(
            (currentState) => {
              if (
                !currentState.data
              ) {
                return currentState;
              }

              const updatedShifts =
                currentState.data.shifts.map(
                  (shift) =>
                    shift.id ===
                    result.shiftSlotId
                      ? {
                          ...shift,

                          availabilityStatus:
                            result
                              .availabilityStatus,

                          note:
                            result
                              .availabilityNote,

                          availabilityUpdatedAt:
                            result
                              .availabilityUpdatedAt,
                        }
                      : shift,
                );

              return {
                ...currentState,

                data: {
                  ...currentState.data,

                  submission: {
                    ...currentState
                      .data
                      .submission,

                    lastSavedAt:
                      result
                        .availabilityUpdatedAt,

                    availableCount:
                      result
                        .availableCount,

                    unavailableCount:
                      result
                        .unavailableCount,
                  },

                  shifts:
                    updatedShifts,
                },

                error: null,
              };
            },
          );
        } catch (error) {
          const errorMessage =
            getErrorMessage(error);

          setState(
            (currentState) => ({
              ...currentState,
              error:
                errorMessage,
            }),
          );

          throw error;
        } finally {
          setSavingShiftId(null);
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
    statistics,
    savingShiftId,
    loadAvailability,
    saveShiftAvailability,
    clearError,
  };
}