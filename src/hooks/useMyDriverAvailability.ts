/**
 * קובץ: src/hooks/useMyDriverAvailability.ts
 * מטרה: ניהול מצב ותופעות לוואי באמצעות React עבור כוננים / אילוצים וזמינות.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: EditableDriverAvailabilityEntry, MyDriverAvailabilityState, UseMyDriverAvailabilityResult, normalizeMyDriverAvailabilityError, createDraftEntries, useMyDriverAvailability.
 * - ריכוז ההגדרות והלוגיקה המפורטות בהמשך הקובץ.
 */
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

/**
 * חוזה הנתונים EditableDriverAvailabilityEntry: כוננים / אילוצים וזמינות / רשומה.
 */
interface EditableDriverAvailabilityEntry {
  // dayId — מזהה היום.
  dayId: string;

  // availabilityStatus — מצב הזמינות.
  availabilityStatus:
    DriverAvailabilityStatus | null;

  // note — הערה.
  note:
    string;
}

/**
 * חוזה הנתונים MyDriverAvailabilityState: כוננים / אילוצים וזמינות / מצב.
 */
interface MyDriverAvailabilityState {
  // data — נתונים.
  data:
    DriverAvailabilityPersonalData | null;
  // isSubmitting — האם הגשה מתבצעת.
  isSubmitting: boolean;

  // lastSubmitResult — תוצאה.
  lastSubmitResult:
    SubmitDriverAvailabilityResponse | null;
  // selectedPeriodId — מזהה התקופה.
  selectedPeriodId:
    string | null;

  // draftEntries — טיוטה / רשומות.
  draftEntries:
    Record<
      string,
      EditableDriverAvailabilityEntry
    >;

  // isLoading — האם טעינה מתבצעת.
  isLoading: boolean;

  // isSaving — האם שמירה מתבצעת.
  isSaving: boolean;

  isDirty: boolean;

  // error — שגיאה.
  error:
    string | null;

  // lastSaveResult — תוצאה.
  lastSaveResult:
    SaveDriverAvailabilityResponse | null;
}

/**
 * חוזה הנתונים UseMyDriverAvailabilityResult: כוננים / אילוצים וזמינות / תוצאה.
 */
interface UseMyDriverAvailabilityResult {
  // state — מצב.
  state:
    MyDriverAvailabilityState;

  // draftEntries — טיוטה / רשומות.
  draftEntries:
    EditableDriverAvailabilityEntry[];

  // loadMyAvailability — אילוצים וזמינות.
  loadMyAvailability: (
    periodId?:
      string | null,
  ) => Promise<DriverAvailabilityPersonalData | null>;
  // submitMyAvailability — אילוצים וזמינות.
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

  // saveMyAvailability — אילוצים וזמינות.
  saveMyAvailability:
    () => Promise<SaveDriverAvailabilityResponse>;

  // clearError — שגיאה.
  clearError:
    () => void;

  reset:
    () => void;
}

// initialState — מצב.
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

/**
 * פעולה normalizeMyDriverAvailabilityError: נרמול כוננים / אילוצים וזמינות / שגיאה.
 * @param error — שגיאה.
 * @returns string — הפלט בהתאם לחתימה.
 */
function normalizeMyDriverAvailabilityError(
  error: unknown,
): string {
  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר error instanceof Error.
  if (
    error instanceof Error
  ) {
    // normalizedMessage — הודעה.
    const normalizedMessage =
      error.message
        .trim()
        .toLowerCase();
        

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר normalizedMessage.includes( 'not authenticated', ).
    if (
      normalizedMessage.includes(
        'not authenticated',
      )
    ) {
      return 'לא נמצאה התחברות פעילה. יש להתחבר מחדש.';
    }

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר normalizedMessage.includes( 'user not active', ).
    if (
      normalizedMessage.includes(
        'user not active',
      )
    ) {
      return 'המשתמש אינו פעיל.';
    }

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר normalizedMessage.includes( 'not allowed', ).
    if (
      normalizedMessage.includes(
        'not allowed',
      )
    ) {
      return 'אין לך הרשאה לצפות או להגיש אילוצי כוננים.';
    }

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר normalizedMessage.includes( 'driver availability period not found', ).
    if (
      normalizedMessage.includes(
        'driver availability period not found',
      )
    ) {
      return 'תקופת אילוצי הכוננים לא נמצאה.';
    }

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר normalizedMessage.includes( 'driver availability period id is required', ).
    if (
      normalizedMessage.includes(
        'driver availability period id is required',
      )
    ) {
      return 'מזהה תקופת אילוצי הכוננים חסר.';
    }

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר normalizedMessage.includes( 'driver availability period is not open', ).
    if (
      normalizedMessage.includes(
        'driver availability period is not open',
      )
    ) {
      return 'לא ניתן לשמור אילוצים משום שהחודש אינו פתוח להגשה.';
    }

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר normalizedMessage.includes( 'driver availability submission deadline has passed', ).
    if (
      normalizedMessage.includes(
        'driver availability submission deadline has passed',
      )
    ) {
      return 'המועד האחרון להגשת אילוצי הכוננים כבר עבר.';
    }

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר normalizedMessage.includes( 'driver availability was already submitted', ).
    if (
      normalizedMessage.includes(
        'driver availability was already submitted',
      )
    ) {
      return 'האילוצים כבר הוגשו ולא ניתן לערוך אותם כרגע.';
    }

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר normalizedMessage.includes( 'one or more driver availability entries are invalid', ).
    if (
      normalizedMessage.includes(
        'one or more driver availability entries are invalid',
      )
    ) {
      return 'אחד או יותר מסימוני הזמינות אינם תקינים.';
    }

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר normalizedMessage.includes( 'duplicate driver availability entries', ).
    if (
      normalizedMessage.includes(
        'duplicate driver availability entries',
      )
    ) {
      return 'קיימים מספר סימונים לאותו יום.';
    }

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר normalizedMessage.includes( 'one or more driver availability day ids are missing', ).
    if (
      normalizedMessage.includes(
        'one or more driver availability day ids are missing',
      )
    ) {
      return 'חסר מזהה יום באחד מסימוני הזמינות.';
    }

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר normalizedMessage.includes( 'לא התקבלה תשובה בעת שמירת אילוצי הכוננים', ).
    if (
      normalizedMessage.includes(
        'לא התקבלה תשובה בעת שמירת אילוצי הכוננים',
      )
    ) {
      return 'לא התקבלה תשובה תקינה בעת שמירת אילוצי הכוננים.';
    }
    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר normalizedMessage.includes( 'all driver availability days must be marked before submission', ).
    if (
  normalizedMessage.includes(
    'all driver availability days must be marked before submission',
  )
) {
  return 'יש לסמן את כל ימי החודש לפני הגשת האילוצים.';
}

// טיפול במקרה מיוחד ויציאה מוקדמת כאשר normalizedMessage.includes( 'driver availability draft was not found', ).
if (
  normalizedMessage.includes(
    'driver availability draft was not found',
  )
) {
  return 'לא נמצאה טיוטת אילוצים שמורה. יש לשמור לפני ההגשה.';
}

// טיפול במקרה מיוחד ויציאה מוקדמת כאשר normalizedMessage.includes( 'לא התקבלה תשובה בעת הגשת אילוצי הכוננים', ).
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

/**
 * פעולה createDraftEntries: יצירת טיוטה / רשומות.
 * @param data — נתונים.
 * @returns Record< string, EditableDriverAvailabilityEntry > — הפלט בהתאם לחתימה.
 */
function createDraftEntries(
  data:
    DriverAvailabilityPersonalData,
): Record<
  string,
  EditableDriverAvailabilityEntry
> {
  // existingEntriesByDayId — מזהה היום; מיפוי לחיפוש לפי מפתח.
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
        // existingEntry — רשומה.
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

/**
 * פעולה useMyDriverAvailability: חיבור מצב או הקשר עבור כוננים / אילוצים וזמינות.
 * @returns UseMyDriverAvailabilityResult — הפלט בהתאם לחתימה.
 */
export function useMyDriverAvailability():
  UseMyDriverAvailabilityResult {
  // מצב מקומי: state — מצב; setState מעדכנת אותו ומפעילה רינדור לפי React.
  const [
    state,
    setState,
  ] =
    useState<MyDriverAvailabilityState>(
      initialState,
    );

  // ערך מחושב draftEntries — טיוטה / רשומות; נשמר בין רינדורים עד שינוי התלויות.
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

  // loadMyAvailability — אילוצים וזמינות.
  const loadMyAvailability =
    useCallback(
      async (
        periodId:
          string | null = null,
      ): Promise<DriverAvailabilityPersonalData | null> => {
        // normalizedPeriodId — מזהה התקופה.
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

        // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
        try {
          // data — נתונים.
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
          // normalizedError — שגיאה.
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

  // setDayStatus — קבוצה ייחודית / יום / סטטוס.
  const setDayStatus =
    useCallback(
      (
        dayId: string,
        status:
          DriverAvailabilityStatus,
      ): void => {
        setState(
          (currentState) => {
            // currentEntry — רשומה.
            const currentEntry =
              currentState
                .draftEntries[
                dayId
              ];

            // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !currentEntry.
            if (!currentEntry) {
              return currentState;
            }

            // טיפול במקרה מיוחד ויציאה מוקדמת כאשר currentEntry .availabilityStatus === status.
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
            // updatedEntries — רשומות.
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

// submitMyAvailability — אילוצים וזמינות.
const submitMyAvailability =
  useCallback(
    async (): Promise<SubmitDriverAvailabilityResponse> => {
      // periodId — מזהה התקופה.
      const periodId =
        state.data
          ?.period
          ?.id ??
        state.selectedPeriodId;

      // עצירת הפעולה עם שגיאה כאשר !periodId.
      if (!periodId) {
        // missingPeriodError — תקופה / שגיאה.
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

      // עצירת הפעולה עם שגיאה כאשר state.isDirty.
      if (state.isDirty) {
        // unsavedChangesError — שגיאה.
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

      // unmarkedDays — ימים.
      const unmarkedDays =
        Object.values(
          state.draftEntries,
        ).filter(
          (entry) =>
            entry.availabilityStatus ===
            null,
        ).length;

      // עצירת הפעולה עם שגיאה כאשר unmarkedDays > 0.
      if (unmarkedDays > 0) {
        // unmarkedDaysError — ימים / שגיאה.
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

      // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
      try {
        // result — תוצאה.
        const result =
          await driverAvailabilityService
            .submitMyAvailability(
              periodId,
            );

        // refreshedData — נתונים.
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
        // normalizedError — שגיאה.
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
  // setDayNote — קבוצה ייחודית / יום / הערה.
  const setDayNote =
    useCallback(
      (
        dayId: string,
        note: string,
      ): void => {
        setState(
          (currentState) => {
            // currentEntry — רשומה.
            const currentEntry =
              currentState
                .draftEntries[
                dayId
              ];

            // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !currentEntry.
            if (!currentEntry) {
              return currentState;
            }

            // טיפול במקרה מיוחד ויציאה מוקדמת כאשר currentEntry.note === note.
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

  // saveMyAvailability — אילוצים וזמינות.
  const saveMyAvailability =
    useCallback(
      async (): Promise<SaveDriverAvailabilityResponse> => {
        // periodId — מזהה התקופה.
        const periodId =
          state.data
            ?.period
            ?.id ??
          state.selectedPeriodId;

        // עצירת הפעולה עם שגיאה כאשר !periodId.
        if (!periodId) {
          // missingPeriodError — תקופה / שגיאה.
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

        // entries — רשומות.
        const entries:
          SaveDriverAvailabilityEntryInput[] =
            Object.values(
              state.draftEntries,
            )
              .filter(
                (
                  entry,
                ): entry is EditableDriverAvailabilityEntry & {
                  // availabilityStatus — מצב הזמינות.
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

        // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
        try {
          // result — תוצאה.
          const result =
            await driverAvailabilityService
              .saveMyAvailability({
                periodId,

                entries,
              });

          // refreshedData — נתונים.
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
          // normalizedError — שגיאה.
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

  // clearError — שגיאה.
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