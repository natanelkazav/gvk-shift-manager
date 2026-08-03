import {
  useCallback,
  useMemo,
  useState,
} from 'react';

import {
  driverAvailabilityService,
} from '../services/driverAvailabilityService';

import type {
  DriverAvailabilityPersonalData,
  DriverAvailabilityStatus,
  SaveDriverAvailabilityEntryInput,
  SubmitDriverAvailabilityResponse,
  SaveDriverAvailabilityResponse,
} from '../types/driverAvailability';

interface EditableDriverAvailabilityEntry {
  dayId: string;

  availabilityStatus:
    DriverAvailabilityStatus | null;

  note:
    string;
}

interface MyDriverAvailabilityState {
  data:
    DriverAvailabilityPersonalData | null;
  isSubmitting: boolean;

  lastSubmitResult:
    SubmitDriverAvailabilityResponse | null;
  selectedPeriodId:
    string | null;

  draftEntries:
    Record<
      string,
      EditableDriverAvailabilityEntry
    >;

  isLoading: boolean;

  isSaving: boolean;

  isDirty: boolean;

  error:
    string | null;

  lastSaveResult:
    SaveDriverAvailabilityResponse | null;
}

interface UseMyDriverAvailabilityResult {
  state:
    MyDriverAvailabilityState;

  draftEntries:
    EditableDriverAvailabilityEntry[];

  loadMyAvailability: (
    periodId?:
      string | null,
  ) => Promise<DriverAvailabilityPersonalData | null>;
  submitMyAvailability:
  () => Promise<SubmitDriverAvailabilityResponse>;
  setDayStatus: (
    dayId: string,
    status:
      DriverAvailabilityStatus,
  ) => void;

  markAllAvailable:
    () => void;

  setDayNote: (
    dayId: string,
    note: string,
  ) => void;

  saveMyAvailability:
    () => Promise<SaveDriverAvailabilityResponse>;

  clearError:
    () => void;

  reset:
    () => void;
}

const initialState:
  MyDriverAvailabilityState = {
    data: null,

    selectedPeriodId:
      null,

    draftEntries: {},

    isLoading: false,

    isSaving: false,

    isDirty: false,
    isSubmitting: false,

    lastSubmitResult: null,
    error: null,

    lastSaveResult:
      null,
  };

function normalizeMyDriverAvailabilityError(
  error: unknown,
): string {
  if (
    error instanceof Error
  ) {
    const normalizedMessage =
      error.message
        .trim()
        .toLowerCase();
        

    if (
      normalizedMessage.includes(
        'not authenticated',
      )
    ) {
      return 'לא נמצאה התחברות פעילה. יש להתחבר מחדש.';
    }

    if (
      normalizedMessage.includes(
        'user not active',
      )
    ) {
      return 'המשתמש אינו פעיל.';
    }

    if (
      normalizedMessage.includes(
        'not allowed',
      )
    ) {
      return 'אין לך הרשאה לצפות או להגיש אילוצי כוננים.';
    }

    if (
      normalizedMessage.includes(
        'driver availability period not found',
      )
    ) {
      return 'תקופת אילוצי הכוננים לא נמצאה.';
    }

    if (
      normalizedMessage.includes(
        'driver availability period id is required',
      )
    ) {
      return 'מזהה תקופת אילוצי הכוננים חסר.';
    }

    if (
      normalizedMessage.includes(
        'driver availability period is not open',
      )
    ) {
      return 'לא ניתן לשמור אילוצים משום שהחודש אינו פתוח להגשה.';
    }

    if (
      normalizedMessage.includes(
        'driver availability submission deadline has passed',
      )
    ) {
      return 'המועד האחרון להגשת אילוצי הכוננים כבר עבר.';
    }

    if (
      normalizedMessage.includes(
        'driver availability was already submitted',
      )
    ) {
      return 'האילוצים כבר הוגשו ולא ניתן לערוך אותם כרגע.';
    }

    if (
      normalizedMessage.includes(
        'one or more driver availability entries are invalid',
      )
    ) {
      return 'אחד או יותר מסימוני הזמינות אינם תקינים.';
    }

    if (
      normalizedMessage.includes(
        'duplicate driver availability entries',
      )
    ) {
      return 'קיימים מספר סימונים לאותו יום.';
    }

    if (
      normalizedMessage.includes(
        'one or more driver availability day ids are missing',
      )
    ) {
      return 'חסר מזהה יום באחד מסימוני הזמינות.';
    }

    if (
      normalizedMessage.includes(
        'לא התקבלה תשובה בעת שמירת אילוצי הכוננים',
      )
    ) {
      return 'לא התקבלה תשובה תקינה בעת שמירת אילוצי הכוננים.';
    }
    if (
  normalizedMessage.includes(
    'all driver availability days must be marked before submission',
  )
) {
  return 'יש לסמן את כל ימי החודש לפני הגשת האילוצים.';
}

if (
  normalizedMessage.includes(
    'driver availability draft was not found',
  )
) {
  return 'לא נמצאה טיוטת אילוצים שמורה. יש לשמור לפני ההגשה.';
}

if (
  normalizedMessage.includes(
    'לא התקבלה תשובה בעת הגשת אילוצי הכוננים',
  )
) {
  return 'לא התקבלה תשובה תקינה בעת הגשת אילוצי הכוננים.';
}

    return error.message;
  }

  return 'לא ניתן היה לבצע את הפעולה באילוצי הכוננים.';
}

function createDraftEntries(
  data:
    DriverAvailabilityPersonalData,
): Record<
  string,
  EditableDriverAvailabilityEntry
> {
  const existingEntriesByDayId =
    new Map(
      data.entries.map(
        (entry) => [
          entry.dayId,
          entry,
        ],
      ),
    );

  return Object.fromEntries(
    data.days.map(
      (day) => {
        const existingEntry =
          existingEntriesByDayId.get(
            day.id,
          );

        return [
          day.id,
          {
            dayId:
              day.id,

            availabilityStatus:
              existingEntry
                ?.availabilityStatus ??
              null,

            note:
              existingEntry
                ?.note ??
              '',
          },
        ];
      },
    ),
  );
}

export function useMyDriverAvailability():
  UseMyDriverAvailabilityResult {
  const [
    state,
    setState,
  ] =
    useState<MyDriverAvailabilityState>(
      initialState,
    );

  const draftEntries =
    useMemo(
      () =>
        Object.values(
          state.draftEntries,
        ),
      [
        state.draftEntries,
      ],
    );

  const loadMyAvailability =
    useCallback(
      async (
        periodId:
          string | null = null,
      ): Promise<DriverAvailabilityPersonalData | null> => {
        const normalizedPeriodId =
          periodId?.trim() ||
          null;

        setState(
          (currentState) => ({
            ...currentState,

            selectedPeriodId:
              normalizedPeriodId,

            isLoading:
              true,

            error:
              null,

            lastSaveResult:
              null,
          }),
        );

        try {
          const data =
            await driverAvailabilityService
              .getMyAvailability(
                normalizedPeriodId,
              );

          setState(
            (currentState) => ({
              ...currentState,

              data,

              selectedPeriodId:
                data?.period?.id ??
                normalizedPeriodId,

              draftEntries:
                data
                  ? createDraftEntries(
                      data,
                    )
                  : {},

              isLoading:
                false,

              isSaving:
                false,

              isDirty:
                false,

              error:
                null,

              lastSaveResult:
                null,
            }),
          );

          return data;
        } catch (error) {
          const normalizedError =
            normalizeMyDriverAvailabilityError(
              error,
            );

          setState(
            (currentState) => ({
              ...currentState,

              data:
                null,

              draftEntries:
                {},

              isLoading:
                false,

              isSaving:
                false,

              isDirty:
                false,

              error:
                normalizedError,

              lastSaveResult:
                null,
            }),
          );

          throw error;
        }
      },
      [],
    );

  const setDayStatus =
    useCallback(
      (
        dayId: string,
        status:
          DriverAvailabilityStatus,
      ): void => {
        setState(
          (currentState) => {
            const currentEntry =
              currentState
                .draftEntries[
                dayId
              ];

            if (!currentEntry) {
              return currentState;
            }

            if (
              currentEntry
                .availabilityStatus ===
              status
            ) {
              return currentState;
            }

            return {
              ...currentState,

              draftEntries: {
                ...currentState
                  .draftEntries,

                [dayId]: {
                  ...currentEntry,

                  availabilityStatus:
                    status,
                },
              },

              isDirty:
                true,

              error:
                null,

              lastSaveResult:
                null,
            };
          },
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
            const updatedEntries =
              Object.fromEntries(
                Object.entries(
                  currentState
                    .draftEntries,
                ).map(
                  (
                    [
                      dayId,
                      entry,
                    ],
                  ) => [
                    dayId,
                    {
                      ...entry,
                      availabilityStatus:
                        'available' as const,
                    },
                  ],
                ),
              );

            return {
              ...currentState,

              draftEntries:
                updatedEntries,

              isDirty:
                true,

              error:
                null,

              lastSaveResult:
                null,

              lastSubmitResult:
                null,
            };
          },
        );
      },
      [],
    );

const submitMyAvailability =
  useCallback(
    async (): Promise<SubmitDriverAvailabilityResponse> => {
      const periodId =
        state.data
          ?.period
          ?.id ??
        state.selectedPeriodId;

      if (!periodId) {
        const missingPeriodError =
          new Error(
            'Driver availability period id is required.',
          );

        setState(
          (currentState) => ({
            ...currentState,

            error:
              normalizeMyDriverAvailabilityError(
                missingPeriodError,
              ),
          }),
        );

        throw missingPeriodError;
      }

      if (state.isDirty) {
        const unsavedChangesError =
          new Error(
            'Driver availability contains unsaved changes.',
          );

        setState(
          (currentState) => ({
            ...currentState,

            error:
              'יש לשמור את השינויים לפני הגשת האילוצים.',
          }),
        );

        throw unsavedChangesError;
      }

      const unmarkedDays =
        Object.values(
          state.draftEntries,
        ).filter(
          (entry) =>
            entry.availabilityStatus ===
            null,
        ).length;

      if (unmarkedDays > 0) {
        const unmarkedDaysError =
          new Error(
            'All driver availability days must be marked before submission.',
          );

        setState(
          (currentState) => ({
            ...currentState,

            error:
              `יש לסמן את כל ימי החודש לפני ההגשה. נותרו ${unmarkedDays} ימים ללא סימון.`,
          }),
        );

        throw unmarkedDaysError;
      }

      setState(
        (currentState) => ({
          ...currentState,

          isSubmitting:
            true,

          error:
            null,

          lastSubmitResult:
            null,
        }),
      );

      try {
        const result =
          await driverAvailabilityService
            .submitMyAvailability(
              periodId,
            );

        const refreshedData =
          await driverAvailabilityService
            .getMyAvailability(
              periodId,
            );

        setState(
          (currentState) => ({
            ...currentState,

            data:
              refreshedData,

            draftEntries:
              refreshedData
                ? createDraftEntries(
                    refreshedData,
                  )
                : currentState
                    .draftEntries,

            isSubmitting:
              false,

            isDirty:
              false,

            error:
              null,

            lastSubmitResult:
              result,
          }),
        );

        return result;
      } catch (error) {
        const normalizedError =
          normalizeMyDriverAvailabilityError(
            error,
          );

        setState(
          (currentState) => ({
            ...currentState,

            isSubmitting:
              false,

            error:
              normalizedError,

            lastSubmitResult:
              null,
          }),
        );

        throw error;
      }
    },
    [
      state.data,
      state.draftEntries,
      state.isDirty,
      state.selectedPeriodId,
    ],
  );
  const setDayNote =
    useCallback(
      (
        dayId: string,
        note: string,
      ): void => {
        setState(
          (currentState) => {
            const currentEntry =
              currentState
                .draftEntries[
                dayId
              ];

            if (!currentEntry) {
              return currentState;
            }

            if (
              currentEntry.note ===
              note
            ) {
              return currentState;
            }

            return {
              ...currentState,

              draftEntries: {
                ...currentState
                  .draftEntries,

                [dayId]: {
                  ...currentEntry,

                  note,
                },
              },

              isDirty:
                true,

              error:
                null,

              lastSaveResult:
                null,
            };
          },
        );
      },
      [],
    );

  const saveMyAvailability =
    useCallback(
      async (): Promise<SaveDriverAvailabilityResponse> => {
        const periodId =
          state.data
            ?.period
            ?.id ??
          state.selectedPeriodId;

        if (!periodId) {
          const missingPeriodError =
            new Error(
              'Driver availability period id is required.',
            );

          setState(
            (currentState) => ({
              ...currentState,

              error:
                normalizeMyDriverAvailabilityError(
                  missingPeriodError,
                ),
            }),
          );

          throw missingPeriodError;
        }

        const entries:
          SaveDriverAvailabilityEntryInput[] =
            Object.values(
              state.draftEntries,
            )
              .filter(
                (
                  entry,
                ): entry is EditableDriverAvailabilityEntry & {
                  availabilityStatus:
                    DriverAvailabilityStatus;
                } =>
                  entry
                    .availabilityStatus !==
                  null,
              )
              .map(
                (entry) => ({
                  dayId:
                    entry.dayId,

                  availabilityStatus:
                    entry
                      .availabilityStatus,

                  note:
                    entry.note.trim() ||
                    null,
                }),
              );

        setState(
          (currentState) => ({
            ...currentState,

            isSaving:
              true,

            error:
              null,

            lastSaveResult:
              null,
          }),
        );

        try {
          const result =
            await driverAvailabilityService
              .saveMyAvailability({
                periodId,

                entries,
              });

          const refreshedData =
            await driverAvailabilityService
              .getMyAvailability(
                periodId,
              );

          setState(
            (currentState) => ({
              ...currentState,

              data:
                refreshedData,

              draftEntries:
                refreshedData
                  ? createDraftEntries(
                      refreshedData,
                    )
                  : currentState
                      .draftEntries,

              isSaving:
                false,

              isDirty:
                false,

              error:
                null,

              lastSaveResult:
                result,
            }),
          );

          return result;
        } catch (error) {
          const normalizedError =
            normalizeMyDriverAvailabilityError(
              error,
            );

          setState(
            (currentState) => ({
              ...currentState,

              isSaving:
                false,

              error:
                normalizedError,

              lastSaveResult:
                null,
            }),
          );

          throw error;
        }
      },
      [
        state.data,
        state.draftEntries,
        state.selectedPeriodId,
      ],
    );

  const clearError =
    useCallback(
      (): void => {
        setState(
          (currentState) => ({
            ...currentState,

            error:
              null,
          }),
        );
      },
      [],
    );

  const reset =
    useCallback(
      (): void => {
        setState(
          initialState,
        );
      },
      [],
    );

  return {
    state,

    draftEntries,

    loadMyAvailability,

    setDayStatus,

    markAllAvailable,

    setDayNote,

    saveMyAvailability,

    clearError,
    submitMyAvailability,
    reset,
  };
}