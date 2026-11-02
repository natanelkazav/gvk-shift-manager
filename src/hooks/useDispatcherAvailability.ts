/**
 * קובץ: src/hooks/useDispatcherAvailability.ts
 * מטרה: ניהול מצב ותופעות לוואי באמצעות React עבור מוקדנים / אילוצים וזמינות.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: DispatcherAvailabilityStatistics, UseDispatcherAvailabilityResult, getErrorMessage, calculateStatistics, runInBatches, useDispatcherAvailability.
 * - ריכוז ההגדרות והלוגיקה המפורטות בהמשך הקובץ.
 */
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

/**
 * חוזה הנתונים DispatcherAvailabilityStatistics: מוקדנים / אילוצים וזמינות / סטטיסטיקה.
 */
interface DispatcherAvailabilityStatistics {
  // total — סך הכול.
  total: number;
  answered: number;
  unanswered: number;
  available: number;
  unavailable: number;
  completionPercentage: number;
}

/**
 * חוזה הנתונים UseDispatcherAvailabilityResult: מוקדנים / אילוצים וזמינות / תוצאה.
 */
interface UseDispatcherAvailabilityResult {
  // state — מצב.
  state:
    DispatcherAvailabilityState;

  // statistics — סטטיסטיקה.
  statistics:
    DispatcherAvailabilityStatistics;

  isDirty: boolean;

  // isSavingDraft — האם שמירה מתבצעת.
  isSavingDraft: boolean;

  // isSubmitting — האם הגשה מתבצעת.
  isSubmitting: boolean;

  // lastSubmitResult — תוצאה.
  lastSubmitResult:
    SubmitAvailabilityResult | null;

  // loadAvailability — אילוצים וזמינות.
  loadAvailability:
    () => Promise<void>;

  setShiftAvailability: (
    shiftSlotId: string,
    status:
      DispatcherAvailabilityStatus,
  ) => void;

  markAllAvailable:
    () => void;

  // saveAvailabilityDraft — אילוצים וזמינות / טיוטה.
  saveAvailabilityDraft:
    () => Promise<void>;

  // submitAvailability — אילוצים וזמינות.
  submitAvailability:
    () => Promise<SubmitAvailabilityResult>;

  // clearError — שגיאה.
  clearError:
    () => void;
}

// initialState — מצב.
const initialState:
  DispatcherAvailabilityState = {
    data: null,
    isLoading: true,
    error: null,
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
  if (
    error instanceof Error
  ) {
    return error.message;
  }

  return 'אירעה שגיאה בלתי צפויה בניהול האילוצים.';
}

/**
 * פעולה calculateStatistics: חישוב סטטיסטיקה.
 * @param shifts — משמרות.
 * @returns DispatcherAvailabilityStatistics — הפלט בהתאם לחתימה.
 */
function calculateStatistics(
  shifts:
    DispatcherAvailabilityShift[],
): DispatcherAvailabilityStatistics {
  // total — סך הכול.
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

/**
 * פעולה אסינכרונית runInBatches: הנתון runInBatches בהקשר הפעולה.
 * @param items — פריטים.
 * @param batchSize — הנתון batchSize בהקשר הפעולה.
 * @param action — הנתון action בהקשר הפעולה.
 * @returns Promise<void> — הפלט בהתאם לחתימה.
 */
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

/**
 * פעולה useDispatcherAvailability: חיבור מצב או הקשר עבור מוקדנים / אילוצים וזמינות.
 * @returns UseDispatcherAvailabilityResult — הפלט בהתאם לחתימה.
 */
export function useDispatcherAvailability():
  UseDispatcherAvailabilityResult {
  // מצב מקומי: state — מצב; setState מעדכנת אותו ומפעילה רינדור לפי React.
  const [
    state,
    setState,
  ] =
    useState<DispatcherAvailabilityState>(
      initialState,
    );

  // מצב מקומי: dirtyShiftIds — מזהה המשמרת; setDirtyShiftIds מעדכנת אותו ומפעילה רינדור לפי React.
  const [
    dirtyShiftIds,
    setDirtyShiftIds,
  ] =
    useState<Set<string>>(
      () =>
        new Set(),
    );

  // מצב מקומי: isSavingDraft — האם שמירה מתבצעת; setIsSavingDraft מעדכנת אותו ומפעילה רינדור לפי React.
  const [
    isSavingDraft,
    setIsSavingDraft,
  ] =
    useState(false);

  // מצב מקומי: isSubmitting — האם הגשה מתבצעת; setIsSubmitting מעדכנת אותו ומפעילה רינדור לפי React.
  const [
    isSubmitting,
    setIsSubmitting,
  ] =
    useState(false);

  // מצב מקומי: lastSubmitResult — תוצאה; setLastSubmitResult מעדכנת אותו ומפעילה רינדור לפי React.
  const [
    lastSubmitResult,
    setLastSubmitResult,
  ] =
    useState<SubmitAvailabilityResult | null>(
      null,
    );

  // loadAvailability — אילוצים וזמינות.
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

        // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
        try {
          // data — נתונים.
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

  // תופעת לוואי לאחר רינדור בהתאם לתלויות [ loadAvailability, ].
  useEffect(
    () => {
      void loadAvailability();
    },
    [
      loadAvailability,
    ],
  );

  // setShiftAvailability — קבוצה ייחודית / משמרת / אילוצים וזמינות.
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

            // updatedShifts — משמרות.
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
            // nextIds — הנתון nextIds בהקשר הפעולה; אוסף ערכים ייחודיים.
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

  // saveAvailabilityDraft — אילוצים וזמינות / טיוטה.
  const saveAvailabilityDraft =
    useCallback(
      async (): Promise<void> => {
        // עצירת הפעולה עם שגיאה כאשר !state.data.
        if (
          !state.data
        ) {
          throw new Error(
            'לא נמצאה תקופת אילוצים פתוחה.',
          );
        }

        // עצירת הפעולה עם שגיאה כאשר state.data .submission .status === 'submitted'.
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

        // shiftsToSave — משמרות.
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

        // טיפול במקרה מיוחד ויציאה מוקדמת כאשר shiftsToSave.length === 0.
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

        // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
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

          // refreshedData — נתונים.
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

  // submitAvailability — אילוצים וזמינות.
  const submitAvailability =
    useCallback(
      async (): Promise<SubmitAvailabilityResult> => {
        // עצירת הפעולה עם שגיאה כאשר !state.data.
        if (
          !state.data
        ) {
          throw new Error(
            'לא נמצאה תקופת אילוצים פתוחה.',
          );
        }

        // עצירת הפעולה עם שגיאה כאשר dirtyShiftIds.size > 0.
        if (
          dirtyShiftIds.size >
          0
        ) {
          // errorMessage — הודעת שגיאה.
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

        // עצירת הפעולה עם שגיאה כאשר state.data .submission .status === 'submitted'.
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

        // currentStatistics — סטטיסטיקה.
        const currentStatistics =
          calculateStatistics(
            state.data
              .shifts,
          );

        // עצירת הפעולה עם שגיאה כאשר currentStatistics .unanswered > 0.
        if (
          currentStatistics
            .unanswered >
          0
        ) {
          // errorMessage — הודעת שגיאה.
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

        // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
        try {
          // result — תוצאה.
          const result =
            await dispatcherAvailabilityService
              .submitMyAvailability();

          setState(
            (
              currentState,
            ) => {
              // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !currentState.data.
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

  // ערך מחושב statistics — סטטיסטיקה; נשמר בין רינדורים עד שינוי התלויות.
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

  // clearError — שגיאה.
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