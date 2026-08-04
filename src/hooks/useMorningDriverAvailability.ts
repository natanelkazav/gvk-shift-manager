import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  morningDriverAvailabilityService,
} from '../services/morningDriverAvailabilityService';

import type {
  MorningDriverAvailabilityPersonalData,
  MorningDriverAvailabilityStatus,
  SaveMorningDriverAvailabilityResponse,
  SubmitMorningDriverAvailabilityResponse,
} from '../types/morningDriverAvailability';

interface MorningDriverAvailabilityState {
  data: MorningDriverAvailabilityPersonalData | null;
  isLoading: boolean;
  isSaving: boolean;
  isSubmitting: boolean;
  error: string | null;
  lastSaveResult: SaveMorningDriverAvailabilityResponse | null;
  lastSubmitResult: SubmitMorningDriverAvailabilityResponse | null;
}

const initialState: MorningDriverAvailabilityState = {
  data: null,
  isLoading: true,
  isSaving: false,
  isSubmitting: false,
  error: null,
  lastSaveResult: null,
  lastSubmitResult: null,
};

function getErrorMessage(
  error: unknown,
): string {
  if (error instanceof Error) {
    const normalized =
      error.message.toLowerCase();

    if (normalized.includes('not allowed')) {
      return 'אין לך הרשאה להגיש אילוצי כונני בוקר.';
    }

    if (normalized.includes('already submitted')) {
      return 'האילוצים כבר הוגשו ולא ניתן לשנות אותם.';
    }

    if (normalized.includes('period is not open')) {
      return 'חודש האילוצים אינו פתוח לעריכה.';
    }

    if (
      normalized.includes(
        'all morning driver shifts must be answered',
      )
    ) {
      return 'יש לסמן זמינות בכל המשמרות לפני ההגשה.';
    }

    return error.message;
  }

  return 'לא ניתן היה לבצע את הפעולה באילוצי כונני הבוקר.';
}

export function useMorningDriverAvailability() {
  const [
    state,
    setState,
  ] =
    useState<MorningDriverAvailabilityState>(
      initialState,
    );

  const [
    dirtyShiftIds,
    setDirtyShiftIds,
  ] =
    useState<Set<string>>(
      () => new Set(),
    );

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
            await morningDriverAvailabilityService
              .getMyAvailability();

          setState({
            data,
            isLoading: false,
            isSaving: false,
            isSubmitting: false,
            error: null,
            lastSaveResult: null,
            lastSubmitResult: null,
          });

          setDirtyShiftIds(
            new Set(),
          );
        } catch (error) {
          setState(
            (currentState) => ({
              ...currentState,
              isLoading: false,
              error:
                getErrorMessage(error),
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
    [loadAvailability],
  );

  const updateShift =
    useCallback(
      (
        shiftId: string,
        patch: {
          availabilityStatus?:
            MorningDriverAvailabilityStatus;
          note?: string;
        },
      ): void => {
        setState(
          (currentState) => {
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
                      (shift) =>
                        shift.id === shiftId
                          ? {
                              ...shift,
                              ...patch,
                            }
                          : shift,
                    ),
              },
              error: null,
              lastSaveResult: null,
              lastSubmitResult: null,
            };
          },
        );

        setDirtyShiftIds(
          (currentIds) => {
            const nextIds =
              new Set(
                currentIds,
              );

            nextIds.add(
              shiftId,
            );

            return nextIds;
          },
        );
      },
      [],
    );

  const markAllAvailable =
    useCallback(
      (): void => {
        setState(
          (currentState) => {
            if (
              !currentState.data ||
              currentState.data
                .submission
                .status ===
                'submitted'
            ) {
              return currentState;
            }

            const shiftIds =
              currentState.data
                .shifts
                .map(
                  (shift) =>
                    shift.id,
                );

            setDirtyShiftIds(
              new Set(
                shiftIds,
              ),
            );

            return {
              ...currentState,
              data: {
                ...currentState.data,
                shifts:
                  currentState.data
                    .shifts
                    .map(
                      (shift) => ({
                        ...shift,
                        availabilityStatus:
                          'available',
                      }),
                    ),
              },
              error: null,
              lastSaveResult: null,
              lastSubmitResult: null,
            };
          },
        );
      },
      [],
    );

  const saveAvailability =
    useCallback(
      async (): Promise<SaveMorningDriverAvailabilityResponse | null> => {
        if (!state.data) {
          throw new Error(
            'לא נמצא חודש אילוצים פתוח.',
          );
        }

        const entries =
          state.data
            .shifts
            .filter(
              (shift) =>
                dirtyShiftIds.has(
                  shift.id,
                ) &&
                shift.availabilityStatus !==
                  null,
            )
            .map(
              (shift) => ({
                shiftId:
                  shift.id,

                availabilityStatus:
                  shift.availabilityStatus as MorningDriverAvailabilityStatus,

                note:
                  shift.note,
              }),
            );

        if (
          entries.length === 0
        ) {
          return null;
        }

        setState(
          (currentState) => ({
            ...currentState,
            isSaving: true,
            error: null,
            lastSaveResult: null,
          }),
        );

        try {
          const result =
            await morningDriverAvailabilityService
              .saveMyAvailability({
                periodId:
                  state.data.period.id,
                entries,
              });

          const refreshedData =
            await morningDriverAvailabilityService
              .getMyAvailability(
                state.data.period.id,
              );

          setState(
            (currentState) => ({
              ...currentState,
              data:
                refreshedData,
              isSaving: false,
              error: null,
              lastSaveResult:
                result,
            }),
          );

          setDirtyShiftIds(
            new Set(),
          );

          return result;
        } catch (error) {
          setState(
            (currentState) => ({
              ...currentState,
              isSaving: false,
              error:
                getErrorMessage(error),
            }),
          );

          throw error;
        }
      },
      [
        dirtyShiftIds,
        state.data,
      ],
    );

  const submitAvailability =
    useCallback(
      async (): Promise<SubmitMorningDriverAvailabilityResponse> => {
        if (!state.data) {
          throw new Error(
            'לא נמצא חודש אילוצים פתוח.',
          );
        }

        if (
          dirtyShiftIds.size > 0
        ) {
          const error =
            new Error(
              'יש לשמור את השינויים לפני הגשת האילוצים.',
            );

          setState(
            (currentState) => ({
              ...currentState,
              error:
                error.message,
            }),
          );

          throw error;
        }

        const unmarkedCount =
          state.data
            .shifts
            .filter(
              (shift) =>
                shift.availabilityStatus ===
                null,
            )
            .length;

        if (
          unmarkedCount > 0
        ) {
          const error =
            new Error(
              `נותרו ${unmarkedCount} משמרות שטרם סומנו.`,
            );

          setState(
            (currentState) => ({
              ...currentState,
              error:
                error.message,
            }),
          );

          throw error;
        }

        setState(
          (currentState) => ({
            ...currentState,
            isSubmitting: true,
            error: null,
            lastSubmitResult: null,
          }),
        );

        try {
          const result =
            await morningDriverAvailabilityService
              .submitMyAvailability(
                state.data.period.id,
              );

          setState(
            (currentState) => {
              if (
                !currentState.data
              ) {
                return {
                  ...currentState,
                  isSubmitting: false,
                };
              }

              return {
                ...currentState,
                isSubmitting: false,
                error: null,
                lastSubmitResult:
                  result,
                data: {
                  ...currentState.data,
                  submission: {
                    ...currentState
                      .data
                      .submission,
                    status:
                      'submitted',
                    submittedAt:
                      result.submittedAt,
                  },
                },
              };
            },
          );

          return result;
        } catch (error) {
          setState(
            (currentState) => ({
              ...currentState,
              isSubmitting: false,
              error:
                getErrorMessage(error),
            }),
          );

          throw error;
        }
      },
      [
        dirtyShiftIds.size,
        state.data,
      ],
    );

  const statistics =
    useMemo(
      () => {
        const shifts =
          state.data?.shifts ??
          [];

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

        const total =
          shifts.length;

        const unmarked =
          total -
          available -
          unavailable;

        return {
          total,
          available,
          unavailable,
          unmarked,
          completionPercentage:
            total === 0
              ? 0
              : Math.round(
                  (
                    (
                      available +
                      unavailable
                    ) /
                    total
                  ) *
                    100,
                ),
        };
      },
      [state.data],
    );

  return {
    state,
    statistics,
    isDirty:
      dirtyShiftIds.size >
      0,
    loadAvailability,
    setShiftStatus: (
      shiftId: string,
      status:
        MorningDriverAvailabilityStatus,
    ) =>
      updateShift(
        shiftId,
        {
          availabilityStatus:
            status,
        },
      ),
    setShiftNote: (
      shiftId: string,
      note: string,
    ) =>
      updateShift(
        shiftId,
        {
          note,
        },
      ),
    markAllAvailable,
    saveAvailability,
    submitAvailability,
  };
}