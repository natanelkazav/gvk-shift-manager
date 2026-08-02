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

interface EditableSchedulingDraftState {
  originalDraft:
    SchedulingDraft | null;

  assignmentsByShiftId:
    Record<
      string,
      SchedulingAssignment
    >;

  isDirty: boolean;

  error:
    string | null;
}

interface EditableSchedulingDraftResult {
  state:
    EditableSchedulingDraftState;

  assignments:
    SchedulingAssignment[];

  dispatcherSummaries:
    SchedulingDispatcherSummary[];

  validation:
    EditableSchedulingValidationResult;

  loadDraft: (
    draft: SchedulingDraft,
  ) => void;

  assignDispatcher: (
    shiftId: string,
    userId: string,
  ) => void;

  removeAssignment: (
    shiftId: string,
  ) => void;

  resetShiftAssignment: (
    shiftId: string,
  ) => void;

  resetAllChanges:
    () => void;

  clear:
    () => void;
}

const initialState:
  EditableSchedulingDraftState = {
    originalDraft: null,

    assignmentsByShiftId: {},

    isDirty: false,

    error: null,
  };

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

function createDispatcherSummaries(
  data:
    AssignmentCandidatesData,

  assignments:
    SchedulingAssignment[],
): SchedulingDispatcherSummary[] {
  const summariesByUserId =
    new Map<
      string,
      SchedulingDispatcherSummary
    >();

  for (
    const shift
    of data.shifts
  ) {
    shift.availableUserIds.forEach(
      (
        userId,
        index,
      ) => {
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

  for (
    const assignment
    of assignments
  ) {
    const shift =
      data.shifts.find(
        (candidateShift) =>
          candidateShift.id ===
          assignment.shiftId,
      );

    if (!shift) {
      continue;
    }

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

    const startTime =
      shift.startTime.slice(
        0,
        5,
      );

    const endTime =
      shift.endTime.slice(
        0,
        5,
      );

    const isFriday =
      shift.weekdayName ===
        'שישי' ||
      shift.scheduleType ===
        'friday';

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

export function useEditableSchedulingDraft(
  data:
    AssignmentCandidatesData | null,
): EditableSchedulingDraftResult {
  const [
    state,
    setState,
  ] =
    useState<EditableSchedulingDraftState>(
      initialState,
    );

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

  const dispatcherSummaries =
    useMemo(
      () => {
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

  const validation =
    useMemo(
      () =>
        validateEditableSchedulingDraft(
          data,
          assignments,
        ),
      [
        data,
        assignments,
      ],
    );

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

          isDirty: false,

          error: null,
        });
      },
      [],
    );

const assignDispatcher =
  useCallback(
    (
      shiftId: string,
      userId: string,
    ): void => {
      const normalizedShiftId =
        shiftId.trim();

      const normalizedUserId =
        userId.trim();

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

            isDirty:
              createAssignmentFingerprint(
                nextAssignments,
              ) !==
              createAssignmentFingerprint(
                originalAssignments,
              ),

            error:
              null,
          };
        },
      );
    },
    [],
  );

  const removeAssignment =
    useCallback(
      (
        shiftId: string,
      ): void => {
        const normalizedShiftId =
          shiftId.trim();

        if (!normalizedShiftId) {
          return;
        }

        setState(
          (currentState) => {
            const nextAssignments = {
              ...currentState
                .assignmentsByShiftId,
            };

            delete nextAssignments[
              normalizedShiftId
            ];

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

              isDirty:
                createAssignmentFingerprint(
                  nextAssignments,
                ) !==
                createAssignmentFingerprint(
                  originalAssignments,
                ),

              error: null,
            };
          },
        );
      },
      [],
    );

  const resetShiftAssignment =
    useCallback(
      (
        shiftId: string,
      ): void => {
        const normalizedShiftId =
          shiftId.trim();

        if (!normalizedShiftId) {
          return;
        }

        setState(
          (currentState) => {
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

              isDirty:
                createAssignmentFingerprint(
                  nextAssignments,
                ) !==
                createAssignmentFingerprint(
                  originalAssignments,
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

    loadDraft,

    assignDispatcher,

    removeAssignment,

    resetShiftAssignment,

    resetAllChanges,

    clear,
  };
}