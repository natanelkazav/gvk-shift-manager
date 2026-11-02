/**
 * קובץ: src/hooks/useMorningDriverAvailability.ts
 * מטרה: ניהול מצב ותופעות לוואי באמצעות React עבור כונני בוקר.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: MorningDriverAvailabilityState, getErrorMessage, useMorningDriverAvailability.
 * - ריכוז ההגדרות והלוגיקה המפורטות בהמשך הקובץ.
 */
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

/**
 * חוזה הנתונים MorningDriverAvailabilityState: כונני בוקר.
 */
interface MorningDriverAvailabilityState {
  // data — נתונים.
  data: MorningDriverAvailabilityPersonalData | null;
  // isLoading — האם טעינה מתבצעת.
  isLoading: boolean;
  // isSaving — האם שמירה מתבצעת.
  isSaving: boolean;
  // isSubmitting — האם הגשה מתבצעת.
  isSubmitting: boolean;
  // error — שגיאה.
  error: string | null;
  // lastSaveResult — תוצאה.
  lastSaveResult: SaveMorningDriverAvailabilityResponse | null;
  // lastSubmitResult — תוצאה.
  lastSubmitResult: SubmitMorningDriverAvailabilityResponse | null;
}

// initialState — מצב.
const initialState: MorningDriverAvailabilityState = {
  data: null,
  isLoading: true,
  isSaving: false,
  isSubmitting: false,
  error: null,
  lastSaveResult: null,
  lastSubmitResult: null,
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
    // normalized — הנתון normalized בהקשר הפעולה.
    const normalized =
      error.message.toLowerCase();

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר normalized.includes('not allowed').
    if (normalized.includes('not allowed')) {
      return 'אין לך הרשאה להגיש אילוצי כונני בוקר.';
    }

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר normalized.includes('already submitted').
    if (normalized.includes('already submitted')) {
      return 'האילוצים כבר הוגשו ולא ניתן לשנות אותם.';
    }

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר normalized.includes('period is not open').
    if (normalized.includes('period is not open')) {
      return 'חודש האילוצים אינו פתוח לעריכה.';
    }

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר normalized.includes( 'all morning driver shifts must be answered', ).
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

/**
 * פעולה useMorningDriverAvailability: חיבור מצב או הקשר עבור כונני בוקר.
 */
export function useMorningDriverAvailability() {
  // מצב מקומי: state — מצב; setState מעדכנת אותו ומפעילה רינדור לפי React.
  const [
    state,
    setState,
  ] =
    useState<MorningDriverAvailabilityState>(
      initialState,
    );

  // מצב מקומי: dirtyShiftIds — מזהה המשמרת; setDirtyShiftIds מעדכנת אותו ומפעילה רינדור לפי React.
  const [
    dirtyShiftIds,
    setDirtyShiftIds,
  ] =
    useState<Set<string>>(
      () => new Set(),
    );

  // loadAvailability — אילוצים וזמינות.
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

        // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
        try {
          // data — נתונים.
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

  // תופעת לוואי לאחר רינדור בהתאם לתלויות [loadAvailability].
  useEffect(
    () => {
      void loadAvailability();
    },
    [loadAvailability],
  );

  // updateShift — משמרת.
  const updateShift =
    useCallback(
      (
        shiftId: string,
        patch: {
          // availabilityStatus — מצב הזמינות (אופציונלי).
          availabilityStatus?:
            MorningDriverAvailabilityStatus;
          // note — הערה (אופציונלי).
          note?: string;
        },
      ): void => {
        setState(
          (currentState) => {
            // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !currentState.data || currentState.data .submission .status === 'submitted'.
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
            // nextIds — הנתון nextIds בהקשר הפעולה; אוסף ערכים ייחודיים.
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
            // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !currentState.data || currentState.data .submission .status === 'submitted'.
            if (
              !currentState.data ||
              currentState.data
                .submission
                .status ===
                'submitted'
            ) {
              return currentState;
            }

            // shiftIds — מזהה המשמרת.
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

  // saveAvailability — אילוצים וזמינות.
  const saveAvailability =
    useCallback(
      async (): Promise<SaveMorningDriverAvailabilityResponse | null> => {
        // עצירת הפעולה עם שגיאה כאשר !state.data.
        if (!state.data) {
          throw new Error(
            'לא נמצא חודש אילוצים פתוח.',
          );
        }

        // entries — רשומות.
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

        // טיפול במקרה מיוחד ויציאה מוקדמת כאשר entries.length === 0.
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

        // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
        try {
          // result — תוצאה.
          const result =
            await morningDriverAvailabilityService
              .saveMyAvailability({
                periodId:
                  state.data.period.id,
                entries,
              });

          // refreshedData — נתונים.
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

  // submitAvailability — אילוצים וזמינות.
  const submitAvailability =
    useCallback(
      async (): Promise<SubmitMorningDriverAvailabilityResponse> => {
        // עצירת הפעולה עם שגיאה כאשר !state.data.
        if (!state.data) {
          throw new Error(
            'לא נמצא חודש אילוצים פתוח.',
          );
        }

        // עצירת הפעולה עם שגיאה כאשר dirtyShiftIds.size > 0.
        if (
          dirtyShiftIds.size > 0
        ) {
          // error — שגיאה.
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

        // unmarkedCount — מספר הפריטים שטרם סומנו.
        const unmarkedCount =
          state.data
            .shifts
            .filter(
              (shift) =>
                shift.availabilityStatus ===
                null,
            )
            .length;

        // עצירת הפעולה עם שגיאה כאשר unmarkedCount > 0.
        if (
          unmarkedCount > 0
        ) {
          // error — שגיאה.
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

        // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
        try {
          // result — תוצאה.
          const result =
            await morningDriverAvailabilityService
              .submitMyAvailability(
                state.data.period.id,
              );

          setState(
            (currentState) => {
              // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !currentState.data.
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

  // ערך מחושב statistics — סטטיסטיקה; נשמר בין רינדורים עד שינוי התלויות.
  const statistics =
    useMemo(
      () => {
        // shifts — משמרות.
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

        // total — סך הכול.
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