/**
 * קובץ: src/hooks/useUnifiedSchedule.ts
 * מטרה: ניהול מצב ותופעות לוואי באמצעות React עבור שיבוץ.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: UnifiedScheduleState, LoadUnifiedScheduleRequest, UseUnifiedScheduleResult, extractTime, getErrorMessage, useUnifiedSchedule.
 * - ריכוז ההגדרות והלוגיקה המפורטות בהמשך הקובץ.
 */
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

/**
 * חוזה הנתונים UnifiedScheduleState: שיבוץ / מצב.
 */
interface UnifiedScheduleState {
  // data — נתונים.
  data:
    UnifiedScheduleData;

  // isLoading — האם טעינה מתבצעת.
  isLoading: boolean;

  // error — שגיאה.
  error:
    string | null;
}

/**
 * חוזה הנתונים LoadUnifiedScheduleRequest: שיבוץ / נתוני הבקשה.
 */
interface LoadUnifiedScheduleRequest {
  // year — שנה.
  year: number;

  // month — חודש.
  month: number;
}

/**
 * חוזה הנתונים UseUnifiedScheduleResult: שיבוץ / תוצאה.
 */
interface UseUnifiedScheduleResult {
  // state — מצב.
  state:
    UnifiedScheduleState;

  // filters — מסננים.
  filters:
    UnifiedScheduleFilters;

  // visibleEntries — רשומות.
  visibleEntries:
    UnifiedScheduleEntry[];

  // loadMonth — חודש.
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

  // clearError — שגיאה.
  clearError:
    () => void;
}

// initialWarnings — הנתון initialWarnings בהקשר הפעולה.
const initialWarnings:
  UnifiedScheduleLoadWarnings = {
    dispatcher:
      null,

    morningDriver:
      null,

    onCall:
      null,
  };

// initialState — מצב.
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

// initialFilters — מסננים.
const initialFilters:
  UnifiedScheduleFilters = {
    dispatcher:
      true,

    morningDriver:
      true,

    onCall:
      true,
  };

/**
 * פעולה extractTime: זמן.
 * @param value — ערך.
 * @returns string | null — הפלט בהתאם לחתימה.
 */
function extractTime(
  value:
    string | null,
): string | null {
  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !value.
  if (!value) {
    return null;
  }

  // directTimeMatch — זמן.
  const directTimeMatch =
    value.match(
      /^(\d{2}:\d{2})/,
    );

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר directTimeMatch.
  if (
    directTimeMatch
  ) {
    return directTimeMatch[1];
  }

  // date — תאריך.
  const date =
    new Date(value);

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר Number.isNaN( date.getTime(), ).
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

  return 'אירעה שגיאה לא צפויה בטעינת לוח המשמרות.';
}

/**
 * פעולה useUnifiedSchedule: חיבור מצב או הקשר עבור שיבוץ.
 * @returns UseUnifiedScheduleResult — הפלט בהתאם לחתימה.
 */
export function useUnifiedSchedule():
  UseUnifiedScheduleResult {
  // מצב מקומי: state — מצב; setState מעדכנת אותו ומפעילה רינדור לפי React.
  const [
    state,
    setState,
  ] =
    useState<UnifiedScheduleState>(
      initialState,
    );

  // מצב מקומי: filters — מסננים; setFilters מעדכנת אותו ומפעילה רינדור לפי React.
  const [
    filters,
    setFilters,
  ] =
    useState<UnifiedScheduleFilters>(
      initialFilters,
    );

  // loadMonth — חודש.
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

        // entries — רשומות.
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

                    scheduleStatus:
                      period.status,
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
          // morningSchedule — שיבוץ.
          const morningSchedule =
            morningDriverResult.value;

          // assignments — הקצאות.
          const assignments =
            morningSchedule
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

                  scheduleStatus:
                    morningSchedule
                      ?.period
                      ?.status ??
                    null,
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
          // onCallSchedule — שיבוץ.
          const onCallSchedule =
            onCallResult.value;

          // days — ימים.
          const days =
            onCallSchedule
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

                  scheduleStatus:
                    onCallSchedule
                      ?.period
                      ?.status ??
                    null,
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
            // dateComparison — תאריך.
            const dateComparison =
              firstEntry.date.localeCompare(
                secondEntry.date,
              );

            // טיפול במקרה מיוחד ויציאה מוקדמת כאשר dateComparison !== 0.
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

        // hasSuccessfulSource — מקור.
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

  // setCategoryVisibility — קבוצה ייחודית.
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

  // ערך מחושב visibleEntries — רשומות; נשמר בין רינדורים עד שינוי התלויות.
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

    filters,

    visibleEntries,

    loadMonth,

    setCategoryVisibility,

    clearError,
  };
}