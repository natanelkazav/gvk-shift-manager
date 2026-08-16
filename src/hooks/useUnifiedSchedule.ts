import {
  useCallback,
  useMemo,
  useState,
} from 'react';

import {
  driverScheduleService,
} from '../services/driverScheduleService';

import {
  morningDriverScheduleService,
} from '../services/morningDriverScheduleService';

import {
  scheduleService,
} from '../services/scheduleService';

import type {
  UnifiedScheduleData,
  UnifiedScheduleEntry,
  UnifiedScheduleFilters,
  UnifiedScheduleLoadWarnings,
} from '../types/unifiedSchedule';

interface UnifiedScheduleState {
  data:
    UnifiedScheduleData;

  isLoading: boolean;

  error:
    string | null;
}

interface LoadUnifiedScheduleRequest {
  year: number;

  month: number;
}

interface UseUnifiedScheduleResult {
  state:
    UnifiedScheduleState;

  filters:
    UnifiedScheduleFilters;

  visibleEntries:
    UnifiedScheduleEntry[];

  loadMonth: (
    request:
      LoadUnifiedScheduleRequest,
  ) => Promise<void>;

  setCategoryVisibility: (
    category:
      keyof UnifiedScheduleFilters,

    isVisible:
      boolean,
  ) => void;

  clearError:
    () => void;
}

const initialWarnings:
  UnifiedScheduleLoadWarnings = {
    dispatcher:
      null,

    morningDriver:
      null,

    onCall:
      null,
  };

const initialState:
  UnifiedScheduleState = {
    data: {
      entries: [],

      warnings:
        initialWarnings,
    },

    isLoading:
      false,

    error:
      null,
  };

const initialFilters:
  UnifiedScheduleFilters = {
    dispatcher:
      true,

    morningDriver:
      true,

    onCall:
      true,
  };

function extractTime(
  value:
    string | null,
): string | null {
  if (!value) {
    return null;
  }

  const directTimeMatch =
    value.match(
      /^(\d{2}:\d{2})/,
    );

  if (
    directTimeMatch
  ) {
    return directTimeMatch[1];
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return value;
  }

  return new Intl.DateTimeFormat(
    'he-IL',
    {
      hour:
        '2-digit',

      minute:
        '2-digit',

      hourCycle:
        'h23',

      timeZone:
        'Asia/Jerusalem',
    },
  ).format(date);
}

function getErrorMessage(
  error: unknown,
): string {
  if (
    error instanceof Error
  ) {
    return error.message;
  }

  return 'אירעה שגיאה לא צפויה בטעינת לוח המשמרות.';
}

export function useUnifiedSchedule():
  UseUnifiedScheduleResult {
  const [
    state,
    setState,
  ] =
    useState<UnifiedScheduleState>(
      initialState,
    );

  const [
    filters,
    setFilters,
  ] =
    useState<UnifiedScheduleFilters>(
      initialFilters,
    );

  const loadMonth =
    useCallback(
      async ({
        year,
        month,
      }: LoadUnifiedScheduleRequest): Promise<void> => {
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

        const [
          dispatcherResult,
          morningDriverResult,
          onCallResult,
        ] =
          await Promise.allSettled(
            [
            scheduleService
              .getScheduleByMonth(
                year,
                month,
              ),

              morningDriverScheduleService
                .getSchedule(
                  null,
                  year,
                  month,
                ),

              driverScheduleService
                .getScheduleByMonth(
                  year,
                  month,
                ),
            ],
          );

        const entries:
          UnifiedScheduleEntry[] = [];

        const warnings:
          UnifiedScheduleLoadWarnings = {
            ...initialWarnings,
          };

        if (
          dispatcherResult.status ===
          'fulfilled'
        ) {
          const {
            period,
            shifts,
          } =
            dispatcherResult.value;

          if (!period) {
            warnings.dispatcher =
              'לא נמצא לוח מוקדנים לחודש שנבחר.';
          } else {
            shifts.forEach(
              (
                shift,
              ) => {
                entries.push(
                  {
                    id:
                      `dispatcher-${shift.id}`,

                    sourceId:
                      shift.id,

                    date:
                      shift.shiftDate,

                    category:
                      'dispatcher',

                    assignedUserId:
                      shift.assignedUserId,

                    assignedUserName:
                      shift.assignedUserName,

                    startTime:
                      extractTime(
                        shift.startsAt,
                      ),

                    endTime:
                      extractTime(
                        shift.endsAt,
                      ),

                    isLocked:
                      shift.isLocked,

                    notes:
                      shift.notes,
                  },
                );
              },
            );
          }
        } else {
  warnings.dispatcher =
    getErrorMessage(
      dispatcherResult.reason,
    );
}

        if (
          morningDriverResult.status ===
          'fulfilled'
        ) {
          const assignments =
            morningDriverResult.value
              ?.assignments ??
            [];

          assignments.forEach(
            (
              assignment,
            ) => {
              entries.push(
                {
                  id:
                    `morning-driver-${assignment.id}`,

                  sourceId:
                    assignment.id,

                  date:
                    assignment.shiftDate,

                  category:
                    'morning_driver',

                  assignedUserId:
                    assignment.assignedUserId,

                  assignedUserName:
                    assignment.assignedUserName,

                  startTime:
                    extractTime(
                      assignment.startTime,
                    ),

                  endTime:
                    extractTime(
                      assignment.endTime,
                    ),

                  isLocked:
                    assignment.isLocked,

                  notes:
                    assignment.notes,
                },
              );
            },
          );
        } else {
          warnings.morningDriver =
            getErrorMessage(
              morningDriverResult.reason,
            );
        }

        if (
          onCallResult.status ===
          'fulfilled'
        ) {
          const days =
            onCallResult.value
              ?.days ??
            [];

          days.forEach(
            (
              day,
            ) => {
              entries.push(
                {
                  id:
                    `on-call-${day.id}`,

                  sourceId:
                    day.id,

                  date:
                    day.dutyDate,

                  category:
                    'on_call',

                  assignedUserId:
                    day.assignedUserId,

                  assignedUserName:
                    day.assignedUserName,

                  startTime:
                    null,

                  endTime:
                    null,

                  isLocked:
                    day.isLocked,

                  notes:
                    day.notes,
                },
              );
            },
          );
        } else {
          warnings.onCall =
            getErrorMessage(
              onCallResult.reason,
            );
        }

        entries.sort(
          (
            firstEntry,
            secondEntry,
          ) => {
            const dateComparison =
              firstEntry.date.localeCompare(
                secondEntry.date,
              );

            if (
              dateComparison !==
              0
            ) {
              return dateComparison;
            }

            return (
              firstEntry.startTime ??
              ''
            ).localeCompare(
              secondEntry.startTime ??
              '',
            );
          },
        );

        const hasSuccessfulSource =
          dispatcherResult.status ===
            'fulfilled' ||
          morningDriverResult.status ===
            'fulfilled' ||
          onCallResult.status ===
            'fulfilled';

        setState({
          data: {
            entries,

            warnings,
          },

          isLoading:
            false,

          error:
            hasSuccessfulSource
              ? null
              : 'לא ניתן היה לטעון אף אחד מלוחות המשמרות.',
        });
      },
      [],
    );

  const setCategoryVisibility =
    useCallback(
      (
        category:
          keyof UnifiedScheduleFilters,

        isVisible:
          boolean,
      ): void => {
        setFilters(
          (
            currentFilters,
          ) => ({
            ...currentFilters,

            [category]:
              isVisible,
          }),
        );
      },
      [],
    );

  const visibleEntries =
    useMemo(
      () =>
        state.data.entries.filter(
          (
            entry,
          ) => {
            switch (
              entry.category
            ) {
              case 'dispatcher':
                return filters.dispatcher;

              case 'morning_driver':
                return filters.morningDriver;

              case 'on_call':
                return filters.onCall;

              default:
                return false;
            }
          },
        ),
      [
        filters,
        state.data.entries,
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

    filters,

    visibleEntries,

    loadMonth,

    setCategoryVisibility,

    clearError,
  };
}