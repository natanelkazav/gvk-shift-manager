/**
 * קובץ: src/hooks/useEditableSchedulingDraft.ts
 * מטרה: ניהול מצב ותופעות לוואי באמצעות React עבור טיוטה.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: EditableSchedulingDraftState, EditableSchedulingDraftResult, createAssignmentMap, createAssignmentFingerprint, isHolidayShiftType, createDispatcherSummaries, useEditableSchedulingDraft.
 * - ריכוז ההגדרות והלוגיקה המפורטות בהמשך הקובץ.
 */
import {
  useCallback,
  useMemo,
  useState,
} from 'react';

import {
  validateEditableSchedulingDraft,
  type EditableSchedulingValidationResult,
} from '../services/editableSchedulingValidator';

import type {
  AssignmentCandidatesData,
} from '../types/assignmentCandidates';

import type {
  SchedulingAssignment,
  SchedulingDispatcherSummary,
  SchedulingDraft,
} from '../types/autoScheduling';

/**
 * חוזה הנתונים EditableSchedulingDraftState: טיוטה / מצב.
 */
interface EditableSchedulingDraftState {
  // originalDraft — טיוטה.
  originalDraft:
    SchedulingDraft | null;

  // assignmentsByShiftId — מזהה המשמרת.
  assignmentsByShiftId:
    Record<
      string,
      SchedulingAssignment
    >;

  // intentionallyUnassignedShiftIds — מזהה המשמרת.
  intentionallyUnassignedShiftIds:
    string[];

  isDirty: boolean;

  // error — שגיאה.
  error:
    string | null;
}

/**
 * חוזה הנתונים EditableSchedulingDraftResult: טיוטה / תוצאה.
 */
interface EditableSchedulingDraftResult {
  // state — מצב.
  state:
    EditableSchedulingDraftState;

  // assignments — הקצאות.
  assignments:
    SchedulingAssignment[];

  // dispatcherSummaries — מוקדנים.
  dispatcherSummaries:
    SchedulingDispatcherSummary[];

  // validation — אימות נתונים.
  validation:
    EditableSchedulingValidationResult;

  // intentionallyUnassignedShiftIds — מזהה המשמרת.
  intentionallyUnassignedShiftIds:
    string[];

  // loadDraft — טיוטה.
  loadDraft: (
    draft: SchedulingDraft,
  ) => void;

  // assignDispatcher — מוקדנים.
  assignDispatcher: (
    shiftId: string,
    userId: string,
  ) => void;

  // removeAssignment — הקצאה.
  removeAssignment: (
    shiftId: string,
  ) => void;

  // markShiftIntentionallyUnassigned — משמרת.
  markShiftIntentionallyUnassigned: (
    shiftId: string,
  ) => void;

  // resetShiftAssignment — משמרת / הקצאה.
  resetShiftAssignment: (
    shiftId: string,
  ) => void;

  resetAllChanges:
    () => void;

  clear:
    () => void;
}

// initialState — מצב.
const initialState:
  EditableSchedulingDraftState = {
    originalDraft: null,

    assignmentsByShiftId: {},

    intentionallyUnassignedShiftIds: [],

    isDirty: false,

    error: null,
  };

/**
 * פעולה createAssignmentMap: יצירת הקצאה / מפת התאמה.
 * @param assignments — הקצאות.
 * @returns Record< string, SchedulingAssignment > — הפלט בהתאם לחתימה.
 */
function createAssignmentMap(
  assignments:
    SchedulingAssignment[],
): Record<
  string,
  SchedulingAssignment
> {
  return Object.fromEntries(
    assignments.map(
      (assignment) => [
        assignment.shiftId,
        {
          ...assignment,

          reasons: [
            ...assignment.reasons,
          ],
        },
      ],
    ),
  );
}

/**
 * פעולה createAssignmentFingerprint: יצירת הקצאה.
 * @param assignmentsByShiftId — מזהה המשמרת.
 * @returns string — הפלט בהתאם לחתימה.
 */
function createAssignmentFingerprint(
  assignmentsByShiftId:
    Record<
      string,
      SchedulingAssignment
    >,
): string {
  return JSON.stringify(
    Object.values(
      assignmentsByShiftId,
    )
      .map(
        (assignment) => ({
          shiftId:
            assignment.shiftId,

          userId:
            assignment.userId,

          source:
            assignment.source,

          score:
            assignment.score,

          reasons: [
            ...assignment.reasons,
          ],
        }),
      )
      .sort(
        (
          firstAssignment,
          secondAssignment,
        ) =>
          firstAssignment
            .shiftId
            .localeCompare(
              secondAssignment
                .shiftId,
            ),
      ),
  );
}

/**
 * פעולה isHolidayShiftType: בדיקת תנאי עבור חג / משמרת.
 * @param scheduleType — סוג יום השיבוץ.
 * @returns boolean — הפלט בהתאם לחתימה.
 */
function isHolidayShiftType(
  scheduleType: string,
): boolean {
  return (
    scheduleType ===
      'holiday_eve' ||
    scheduleType ===
      'holiday_full' ||
    scheduleType ===
      'holiday_end'
  );
}

/**
 * פעולה createDispatcherSummaries: המרת מצב המוקדנים והמונים לסיכומי טיוטת השיבוץ.
 * @param data — נתונים.
 * @param assignments — הקצאות.
 * @returns SchedulingDispatcherSummary[] — הפלט בהתאם לחתימה.
 */
function createDispatcherSummaries(
  data:
    AssignmentCandidatesData,

  assignments:
    SchedulingAssignment[],
): SchedulingDispatcherSummary[] {
  // summariesByUserId — מזהה משתמש; מיפוי לחיפוש לפי מפתח.
  const summariesByUserId =
    new Map<
      string,
      SchedulingDispatcherSummary
    >();

  // עיבוד כל פריט מתוך data.shifts בנפרד.
  for (
    const shift
    of data.shifts
  ) {
    shift.availableUserIds.forEach(
      (
        userId,
        index,
      ) => {
        // טיפול במקרה מיוחד ויציאה מוקדמת כאשר summariesByUserId.has( userId, ).
        if (
          summariesByUserId.has(
            userId,
          )
        ) {
          return;
        }

        summariesByUserId.set(
          userId,
          {
            userId,

            displayName:
              shift
                .availableDisplayNames[
                  index
                ] ??
              userId,

            scheduleName:
              shift
                .availableScheduleNames[
                  index
                ] ??
              null,

            totalShifts: 0,

            weekdayEveningShifts:
              0,

            weekdayNightShifts:
              0,

            fridayMorningShifts:
              0,

            fridayAfternoonShifts:
              0,

            fridayNightShifts:
              0,

            saturdayMorningShifts:
              0,

            saturdayAfternoonShifts:
              0,

            saturdayNightShifts:
              0,

            premiumShifts: 0,

            holidayShifts: 0,
          },
        );
      },
    );
  }

  // עיבוד כל פריט מתוך assignments בנפרד.
  for (
    const assignment
    of assignments
  ) {
    // shift — משמרת.
    const shift =
      data.shifts.find(
        (candidateShift) =>
          candidateShift.id ===
          assignment.shiftId,
      );

    if (!shift) {
      continue;
    }

    // summary — סיכום.
    let summary =
      summariesByUserId.get(
        assignment.userId,
      );

    if (!summary) {
      summary = {
        userId:
          assignment.userId,

        displayName:
          assignment.userId,

        scheduleName:
          null,

        totalShifts: 0,

        weekdayEveningShifts:
          0,

        weekdayNightShifts:
          0,

        fridayMorningShifts:
          0,

        fridayAfternoonShifts:
          0,

        fridayNightShifts:
          0,

        saturdayMorningShifts:
          0,

        saturdayAfternoonShifts:
          0,

        saturdayNightShifts:
          0,

        premiumShifts: 0,

        holidayShifts: 0,
      };

      summariesByUserId.set(
        assignment.userId,
        summary,
      );
    }

    summary.totalShifts +=
      1;

    // startTime — שעת התחלה.
    const startTime =
      shift.startTime.slice(
        0,
        5,
      );

    // endTime — שעת סיום.
    const endTime =
      shift.endTime.slice(
        0,
        5,
      );

    // isFriday — הנתון isFriday בהקשר הפעולה.
    const isFriday =
      shift.weekdayName ===
        'שישי' ||
      shift.scheduleType ===
        'friday';

    // isSaturday — הנתון isSaturday בהקשר הפעולה.
    const isSaturday =
      shift.weekdayName ===
        'שבת' ||
      shift.scheduleType ===
        'saturday';

    if (isFriday) {
      if (
        startTime ===
          '06:00' &&
        endTime ===
          '14:00'
      ) {
        summary
          .fridayMorningShifts +=
          1;
      } else if (
        startTime ===
          '14:00' &&
        endTime ===
          '22:00'
      ) {
        summary
          .fridayAfternoonShifts +=
          1;
      } else if (
        startTime ===
          '22:00' &&
        endTime ===
          '06:00'
      ) {
        summary
          .fridayNightShifts +=
          1;
      }
    } else if (isSaturday) {
      if (
        startTime ===
          '06:00' &&
        endTime ===
          '14:00'
      ) {
        summary
          .saturdayMorningShifts +=
          1;
      } else if (
        startTime ===
          '14:00' &&
        endTime ===
          '22:00'
      ) {
        summary
          .saturdayAfternoonShifts +=
          1;
      } else if (
        startTime ===
          '22:00' &&
        endTime ===
          '06:00'
      ) {
        summary
          .saturdayNightShifts +=
          1;
      }
    } else if (
      startTime ===
        '16:00' &&
      endTime ===
        '23:00'
    ) {
      summary
        .weekdayEveningShifts +=
        1;
    } else if (
      startTime ===
        '23:00' &&
      endTime ===
        '06:00'
    ) {
      summary
        .weekdayNightShifts +=
        1;
    }

    if (shift.isPremium) {
      summary.premiumShifts +=
        1;
    }

    if (
      isHolidayShiftType(
        shift.scheduleType,
      )
    ) {
      summary.holidayShifts +=
        1;
    }
  }

  return Array.from(
    summariesByUserId.values(),
  ).sort(
    (
      firstDispatcher,
      secondDispatcher,
    ) =>
      firstDispatcher
        .displayName
        .localeCompare(
          secondDispatcher
            .displayName,
          'he',
        ),
  );
}

/**
 * פעולה useEditableSchedulingDraft: חיבור מצב או הקשר עבור טיוטה.
 * @param data — נתונים.
 * @returns EditableSchedulingDraftResult — הפלט בהתאם לחתימה.
 */
export function useEditableSchedulingDraft(
  data:
    AssignmentCandidatesData | null,
): EditableSchedulingDraftResult {
  // מצב מקומי: state — מצב; setState מעדכנת אותו ומפעילה רינדור לפי React.
  const [
    state,
    setState,
  ] =
    useState<EditableSchedulingDraftState>(
      initialState,
    );

  // ערך מחושב assignments — הקצאות; נשמר בין רינדורים עד שינוי התלויות.
  const assignments =
    useMemo(
      () =>
        Object.values(
          state.assignmentsByShiftId,
        ).sort(
          (
            firstAssignment,
            secondAssignment,
          ) =>
            firstAssignment
              .shiftId
              .localeCompare(
                secondAssignment
                  .shiftId,
              ),
        ),
      [
        state
          .assignmentsByShiftId,
      ],
    );

  // ערך מחושב dispatcherSummaries — מוקדנים; נשמר בין רינדורים עד שינוי התלויות.
  const dispatcherSummaries =
    useMemo(
      () => {
        // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !data.
        if (!data) {
          return [];
        }

        return createDispatcherSummaries(
          data,
          assignments,
        );
      },
      [
        data,
        assignments,
      ],
    );

  // ערך מחושב validation — אימות נתונים; נשמר בין רינדורים עד שינוי התלויות.
  const validation =
    useMemo(
      () =>
        validateEditableSchedulingDraft(
          data,
          assignments,
          state.intentionallyUnassignedShiftIds,
        ),
      [
        data,
        assignments,
        state.intentionallyUnassignedShiftIds,
      ],
    );

  // loadDraft — טיוטה.
  const loadDraft =
    useCallback(
      (
        draft:
          SchedulingDraft,
      ): void => {
        setState({
          originalDraft:
            draft,

          assignmentsByShiftId:
            createAssignmentMap(
              draft.assignments,
            ),

          intentionallyUnassignedShiftIds: [],

          isDirty: false,

          error: null,
        });
      },
      [],
    );

// assignDispatcher — מוקדנים.
const assignDispatcher =
  useCallback(
    (
      shiftId: string,
      userId: string,
    ): void => {
      // normalizedShiftId — מזהה המשמרת.
      const normalizedShiftId =
        shiftId.trim();

      // normalizedUserId — מזהה משתמש.
      const normalizedUserId =
        userId.trim();

      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !normalizedShiftId || !normalizedUserId.
      if (
        !normalizedShiftId ||
        !normalizedUserId
      ) {
        return;
      }

      setState(
        (
          currentState,
        ): EditableSchedulingDraftState => {
          // manualAssignment — הקצאה.
          const manualAssignment:
            SchedulingAssignment = {
              shiftId:
                normalizedShiftId,

              userId:
                normalizedUserId,

              source:
                'manual',

              score:
                null,

              reasons: [
                'השיבוץ שונה ידנית על ידי מנהל.',
              ],
            };

          // nextAssignments — הקצאות.
          const nextAssignments:
            Record<
              string,
              SchedulingAssignment
            > = {
              ...currentState
                .assignmentsByShiftId,

              [normalizedShiftId]:
                manualAssignment,
            };

          // originalAssignments — הקצאות.
          const originalAssignments =
            createAssignmentMap(
              currentState
                .originalDraft
                ?.assignments ??
                [],
            );

          return {
            ...currentState,

            assignmentsByShiftId:
              nextAssignments,

            intentionallyUnassignedShiftIds:
              currentState
                .intentionallyUnassignedShiftIds
                .filter(
                  (id) =>
                    id !== normalizedShiftId,
                ),

            isDirty:
              createAssignmentFingerprint(
                nextAssignments,
              ) !==
                createAssignmentFingerprint(
                  originalAssignments,
                ) ||
              currentState
                .intentionallyUnassignedShiftIds
                .some(
                  (id) =>
                    id !== normalizedShiftId,
                ),

            error:
              null,
          };
        },
      );
    },
    [],
  );

  // removeAssignment — הקצאה.
  const removeAssignment =
    useCallback(
      (
        shiftId: string,
      ): void => {
        // normalizedShiftId — מזהה המשמרת.
        const normalizedShiftId =
          shiftId.trim();

        // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !normalizedShiftId.
        if (!normalizedShiftId) {
          return;
        }

        setState(
          (currentState) => {
            // nextAssignments — הקצאות.
            const nextAssignments = {
              ...currentState
                .assignmentsByShiftId,
            };

            delete nextAssignments[
              normalizedShiftId
            ];

            // originalAssignments — הקצאות.
            const originalAssignments =
              createAssignmentMap(
                currentState
                  .originalDraft
                  ?.assignments ??
                  [],
              );

            return {
              ...currentState,

              assignmentsByShiftId:
                nextAssignments,

              intentionallyUnassignedShiftIds:
                currentState
                  .intentionallyUnassignedShiftIds
                  .filter(
                    (id) =>
                      id !== normalizedShiftId,
                  ),

              isDirty:
                createAssignmentFingerprint(
                  nextAssignments,
                ) !==
                  createAssignmentFingerprint(
                    originalAssignments,
                  ) ||
                currentState
                  .intentionallyUnassignedShiftIds
                  .some(
                    (id) =>
                      id !== normalizedShiftId,
                  ),

              error: null,
            };
          },
        );
      },
      [],
    );

  // markShiftIntentionallyUnassigned — משמרת.
  const markShiftIntentionallyUnassigned =
    useCallback(
      (
        shiftId: string,
      ): void => {
        // normalizedShiftId — מזהה המשמרת.
        const normalizedShiftId =
          shiftId.trim();

        // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !normalizedShiftId.
        if (!normalizedShiftId) {
          return;
        }

        setState(
          (currentState) => {
            // nextAssignments — הקצאות.
            const nextAssignments = {
              ...currentState
                .assignmentsByShiftId,
            };

            delete nextAssignments[
              normalizedShiftId
            ];

            // nextIntentionalIds — הנתון nextIntentionalIds בהקשר הפעולה.
            const nextIntentionalIds =
              Array.from(
                new Set([
                  ...currentState
                    .intentionallyUnassignedShiftIds,
                  normalizedShiftId,
                ]),
              );

            return {
              ...currentState,

              assignmentsByShiftId:
                nextAssignments,

              intentionallyUnassignedShiftIds:
                nextIntentionalIds,

              isDirty: true,

              error: null,
            };
          },
        );
      },
      [],
    );

  // resetShiftAssignment — משמרת / הקצאה.
  const resetShiftAssignment =
    useCallback(
      (
        shiftId: string,
      ): void => {
        // normalizedShiftId — מזהה המשמרת.
        const normalizedShiftId =
          shiftId.trim();

        // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !normalizedShiftId.
        if (!normalizedShiftId) {
          return;
        }

        setState(
          (currentState) => {
            // originalAssignment — הקצאה.
            const originalAssignment =
              currentState
                .originalDraft
                ?.assignments
                .find(
                  (assignment) =>
                    assignment
                      .shiftId ===
                    normalizedShiftId,
                );

            // nextAssignments — הקצאות.
            const nextAssignments = {
              ...currentState
                .assignmentsByShiftId,
            };

            if (
              originalAssignment
            ) {
              nextAssignments[
                normalizedShiftId
              ] = {
                ...originalAssignment,

                reasons: [
                  ...originalAssignment
                    .reasons,
                ],
              };
            } else {
              delete nextAssignments[
                normalizedShiftId
              ];
            }

            // originalAssignments — הקצאות.
            const originalAssignments =
              createAssignmentMap(
                currentState
                  .originalDraft
                  ?.assignments ??
                  [],
              );

            return {
              ...currentState,

              assignmentsByShiftId:
                nextAssignments,

              intentionallyUnassignedShiftIds:
                currentState
                  .intentionallyUnassignedShiftIds
                  .filter(
                    (id) =>
                      id !== normalizedShiftId,
                  ),

              isDirty:
                createAssignmentFingerprint(
                  nextAssignments,
                ) !==
                  createAssignmentFingerprint(
                    originalAssignments,
                  ) ||
                currentState
                  .intentionallyUnassignedShiftIds
                  .some(
                    (id) =>
                      id !== normalizedShiftId,
                  ),

              error: null,
            };
          },
        );
      },
      [],
    );

  const resetAllChanges =
    useCallback((): void => {
      setState(
        (currentState) => ({
          ...currentState,

          assignmentsByShiftId:
            createAssignmentMap(
              currentState
                .originalDraft
                ?.assignments ??
                [],
            ),

          intentionallyUnassignedShiftIds: [],

          isDirty: false,

          error: null,
        }),
      );
    }, []);

  const clear =
    useCallback((): void => {
      setState(initialState);
    }, []);

  return {
    state,

    assignments,

    dispatcherSummaries,

    validation,

    intentionallyUnassignedShiftIds:
      state.intentionallyUnassignedShiftIds,

    loadDraft,

    assignDispatcher,

    removeAssignment,

    markShiftIntentionallyUnassigned,

    resetShiftAssignment,

    resetAllChanges,

    clear,
  };
}