import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  dispatcherAvailabilityService,
} from '../services/dispatcherAvailabilityService';

import type {
  DispatcherAvailabilityShift,
  DispatcherAvailabilityState,
  DispatcherAvailabilityStatus,
  SubmitAvailabilityResult,
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

  isDirty: boolean;

  isSavingDraft: boolean;

  isSubmitting: boolean;

  lastSubmitResult:
    SubmitAvailabilityResult | null;

  loadAvailability:
    () => Promise<void>;

  setShiftAvailability: (
    shiftSlotId: string,
    status:
      DispatcherAvailabilityStatus,
  ) => void;

  markAllAvailable:
    () => void;

  saveAvailabilityDraft:
    () => Promise<void>;

  submitAvailability:
    () => Promise<SubmitAvailabilityResult>;

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
  if (
    error instanceof Error
  ) {
    return error.message;
  }

  return 'אירעה שגיאה בלתי צפויה בניהול האילוצים.';
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
    available +
    unavailable;

  const unanswered =
    total -
    answered;

  const completionPercentage =
    total === 0
      ? 0
      : Math.round(
          (
            answered /
            total
          ) *
            100,
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

async function runInBatches<T>(
  items: T[],
  batchSize: number,
  action: (
    item: T,
  ) => Promise<void>,
): Promise<void> {
  for (
    let index = 0;
    index < items.length;
    index += batchSize
  ) {
    const batch =
      items.slice(
        index,
        index +
          batchSize,
      );

    await Promise.all(
      batch.map(
        action,
      ),
    );
  }
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
    dirtyShiftIds,
    setDirtyShiftIds,
  ] =
    useState<Set<string>>(
      () =>
        new Set(),
    );

  const [
    isSavingDraft,
    setIsSavingDraft,
  ] =
    useState(false);

  const [
    isSubmitting,
    setIsSubmitting,
  ] =
    useState(false);

  const [
    lastSubmitResult,
    setLastSubmitResult,
  ] =
    useState<SubmitAvailabilityResult | null>(
      null,
    );

  const loadAvailability =
    useCallback(
      async (): Promise<void> => {
        setState(
          (
            currentState,
          ) => ({
            ...currentState,
            isLoading:
              true,
            error:
              null,
          }),
        );

        try {
          const data =
            await dispatcherAvailabilityService
              .getMyOpenAvailability();

          setState({
            data,
            isLoading:
              false,
            error:
              null,
          });

          setDirtyShiftIds(
            new Set(),
          );

          setLastSubmitResult(
            null,
          );
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
        }
      },
      [],
    );

  useEffect(
    () => {
      void loadAvailability();
    },
    [
      loadAvailability,
    ],
  );

  const setShiftAvailability =
    useCallback(
      (
        shiftSlotId:
          string,
        status:
          DispatcherAvailabilityStatus,
      ): void => {
        setState(
          (
            currentState,
          ) => {
            if (
              !currentState.data ||
              currentState.data
                .submission
                .status ===
                'submitted'
            ) {
              return currentState;
            }

            const updatedShifts =
              currentState.data
                .shifts
                .map(
                  (
                    shift,
                  ) =>
                    shift.id ===
                      shiftSlotId
                      ? {
                          ...shift,
                          availabilityStatus:
                            status,
                        }
                      : shift,
                );

            return {
              ...currentState,
              data: {
                ...currentState.data,
                shifts:
                  updatedShifts,
              },
              error:
                null,
            };
          },
        );

        setDirtyShiftIds(
          (
            currentIds,
          ) => {
            const nextIds =
              new Set(
                currentIds,
              );

            nextIds.add(
              shiftSlotId,
            );

            return nextIds;
          },
        );

        setLastSubmitResult(
          null,
        );
      },
      [],
    );

  const markAllAvailable =
    useCallback(
      (): void => {
        setState(
          (
            currentState,
          ) => {
            if (
              !currentState.data ||
              currentState.data
                .submission
                .status ===
                'submitted'
            ) {
              return currentState;
            }

            return {
              ...currentState,
              data: {
                ...currentState.data,
                shifts:
                  currentState.data
                    .shifts
                    .map(
                      (
                        shift,
                      ) => ({
                        ...shift,
                        availabilityStatus:
                          'available',
                      }),
                    ),
              },
              error:
                null,
            };
          },
        );

        setDirtyShiftIds(
          () =>
            new Set(
              state.data
                ?.shifts
                .map(
                  (
                    shift,
                  ) =>
                    shift.id,
                ) ??
                [],
            ),
        );

        setLastSubmitResult(
          null,
        );
      },
      [
        state.data,
      ],
    );

  const saveAvailabilityDraft =
    useCallback(
      async (): Promise<void> => {
        if (
          !state.data
        ) {
          throw new Error(
            'לא נמצאה תקופת אילוצים פתוחה.',
          );
        }

        if (
          state.data
            .submission
            .status ===
            'submitted'
        ) {
          throw new Error(
            'האילוצים כבר הוגשו ולא ניתן לשנותם.',
          );
        }

        const shiftsToSave =
          state.data
            .shifts
            .filter(
              (
                shift,
              ) =>
                dirtyShiftIds.has(
                  shift.id,
                ) &&
                shift.availabilityStatus !==
                  null,
            );

        if (
          shiftsToSave.length ===
          0
        ) {
          return;
        }

        setIsSavingDraft(
          true,
        );

        setState(
          (
            currentState,
          ) => ({
            ...currentState,
            error:
              null,
          }),
        );

        try {
          await runInBatches(
            shiftsToSave,
            8,
            async (
              shift,
            ) => {
              await dispatcherAvailabilityService
                .saveShiftAvailability({
                  shiftSlotId:
                    shift.id,
                  status:
                    shift.availabilityStatus as DispatcherAvailabilityStatus,
                  note:
                    shift.note ??
                    null,
                });
            },
          );

          const refreshedData =
            await dispatcherAvailabilityService
              .getMyOpenAvailability();

          setState({
            data:
              refreshedData,
            isLoading:
              false,
            error:
              null,
          });

          setDirtyShiftIds(
            new Set(),
          );
        } catch (
          error
        ) {
          setState(
            (
              currentState,
            ) => ({
              ...currentState,
              error:
                getErrorMessage(
                  error,
                ),
            }),
          );

          throw error;
        } finally {
          setIsSavingDraft(
            false,
          );
        }
      },
      [
        dirtyShiftIds,
        state.data,
      ],
    );

  const submitAvailability =
    useCallback(
      async (): Promise<SubmitAvailabilityResult> => {
        if (
          !state.data
        ) {
          throw new Error(
            'לא נמצאה תקופת אילוצים פתוחה.',
          );
        }

        if (
          dirtyShiftIds.size >
          0
        ) {
          const errorMessage =
            'יש לשמור את השינויים לפני הגשת האילוצים.';

          setState(
            (
              currentState,
            ) => ({
              ...currentState,
              error:
                errorMessage,
            }),
          );

          throw new Error(
            errorMessage,
          );
        }

        if (
          state.data
            .submission
            .status ===
            'submitted'
        ) {
          throw new Error(
            'האילוצים כבר הוגשו.',
          );
        }

        const currentStatistics =
          calculateStatistics(
            state.data
              .shifts,
          );

        if (
          currentStatistics
            .unanswered >
          0
        ) {
          const errorMessage =
            `נותרו ${currentStatistics.unanswered} משמרות שטרם סומנו.`;

          setState(
            (
              currentState,
            ) => ({
              ...currentState,
              error:
                errorMessage,
            }),
          );

          throw new Error(
            errorMessage,
          );
        }

        setIsSubmitting(
          true,
        );

        setLastSubmitResult(
          null,
        );

        setState(
          (
            currentState,
          ) => ({
            ...currentState,
            error:
              null,
          }),
        );

        try {
          const result =
            await dispatcherAvailabilityService
              .submitMyAvailability();

          setState(
            (
              currentState,
            ) => {
              if (
                !currentState.data
              ) {
                return currentState;
              }

              return {
                ...currentState,
                data: {
                  ...currentState.data,
                  submission: {
                    ...currentState
                      .data
                      .submission,
                    status:
                      result
                        .submissionStatus,
                    submittedAt:
                      result
                        .submittedAt,
                    availableCount:
                      result
                        .availableCount,
                    unavailableCount:
                      result
                        .unavailableCount,
                  },
                },
                error:
                  null,
              };
            },
          );

          setLastSubmitResult(
            result,
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
              error:
                getErrorMessage(
                  error,
                ),
            }),
          );

          throw error;
        } finally {
          setIsSubmitting(
            false,
          );
        }
      },
      [
        dirtyShiftIds.size,
        state.data,
      ],
    );

  const statistics =
    useMemo(
      () =>
        calculateStatistics(
          state.data
            ?.shifts ??
            [],
        ),
      [
        state.data,
      ],
    );

  const clearError =
    useCallback(
      (): void => {
        setState(
          (
            currentState,
          ) => ({
            ...currentState,
            error:
              null,
          }),
        );
      },
      [],
    );

  return {
    state,
    statistics,
    isDirty:
      dirtyShiftIds.size >
      0,
    isSavingDraft,
    isSubmitting,
    lastSubmitResult,
    loadAvailability,
    setShiftAvailability,
    markAllAvailable,
    saveAvailabilityDraft,
    submitAvailability,
    clearError,
  };
}