/**
 * קובץ: src/components/morningDriverSchedule/MorningDriverScheduleBoard.tsx
 * מטרה: מימוש רכיב תצוגה ואינטראקציה עבור כונני בוקר.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: MorningDriverScheduleBoardProps, ScheduleShiftGroup, ScheduleDisplayMode, formatDate, formatTime, getShiftTypeLabel, MorningDriverScheduleBoard.
 * - קישור מאפיינים ומצב מקומי לתצוגה ולטיפול בפעולות המשתמש.
 */
import {
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  LayoutList,
  LoaderCircle,
  Lock,
  RefreshCw,
  Send,
  Unlock,
  Users,
  X,
} from 'lucide-react';

import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import MonthCalendar
  from '../calendar/MonthCalendar';

import {
  useCalendarHolidays,
} from '../../hooks/useCalendarHolidays';

import type {
  MorningDriverScheduleAssignment,
  MorningDriverScheduleData,
  UpdateMorningDriverScheduleAssignmentRequest,
  UpdateMorningDriverShiftTimeRequest,
} from '../../types/morningDriverSchedule';

/**
 * חוזה הנתונים MorningDriverScheduleBoardProps: כונני בוקר.
 */
interface MorningDriverScheduleBoardProps {
  // data — נתונים.
  data:
    MorningDriverScheduleData | null;

  // isLoading — האם טעינה מתבצעת.
  isLoading: boolean;

  // updatingAssignmentId — הקצאה / מזהה.
  updatingAssignmentId:
    string | null;

  isPublishing: boolean;

  // viewedYear — שנה.
  viewedYear: number;

  // viewedMonth — חודש.
  viewedMonth: number;

  // onPreviousMonth — חודש.
  onPreviousMonth:
    () => void;

  // onNextMonth — חודש.
  onNextMonth:
    () => void;

  // onCurrentMonth — חודש.
  onCurrentMonth:
    () => void;

  // canEdit — האם עריכה מותרת.
  canEdit: boolean;

  // canEditPublishedAssignments — האם עריכה מותרת.
  canEditPublishedAssignments: boolean;

  onRefresh:
    () => void;

  // onUpdateAssignment — הקצאה.
  onUpdateAssignment: (
    request:
      UpdateMorningDriverScheduleAssignmentRequest,
  ) => void;

  // onUpdateShiftTime — משמרת / זמן.
  onUpdateShiftTime: (
    request: UpdateMorningDriverShiftTimeRequest,
  ) => void;

  // onSetIntentionallyUnassigned — קבוצה ייחודית.
  onSetIntentionallyUnassigned: (
    assignmentId: string,
    isIntentionallyUnassigned: boolean,
  ) => void;

  // currentUserId — המשתמש הנוכחי הנוכחי.
  currentUserId:
    string | null;

  // canTransferMyAssignments — הקצאות.
  canTransferMyAssignments:
    boolean;

  // onSelectTransferAssignment — הקצאה.
  onSelectTransferAssignment: (
    assignment:
      MorningDriverScheduleAssignment,
  ) => void;

  onPublish:
    () => void;
}

/**
 * חוזה הנתונים ScheduleShiftGroup: שיבוץ / משמרת / קבוצה.
 */
interface ScheduleShiftGroup {
  // key — מפתח.
  key: string;
  // shiftDate — תאריך המשמרת.
  shiftDate: string;
  // weekdayName — שם.
  weekdayName: string;
  // startTime — שעת התחלה.
  startTime: string;
  // endTime — שעת סיום.
  endTime: string;
  // minimumWorkers — מספר העובדים המזערי.
  minimumWorkers: number;
  // recommendedWorkers — מספר העובדים המומלץ.
  recommendedWorkers: number;
  // assignments — הקצאות.
  assignments:
    MorningDriverScheduleAssignment[];
}

/**
 * טיפוס ScheduleDisplayMode: שיבוץ / מצב פעולה.
 */
type ScheduleDisplayMode =
  | 'calendar'
  | 'list';

/**
 * פעולה formatDate: עיצוב ערך לתצוגה עבור תאריך.
 * @param value — ערך.
 * @returns string — הפלט בהתאם לחתימה.
 */
function formatDate(
  value: string,
): string {
  // date — תאריך.
  const date =
    new Date(
      `${value}T12:00:00`,
    );

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
      weekday: 'long',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      timeZone:
        'Asia/Jerusalem',
    },
  ).format(
    date,
  );
}

/**
 * פעולה formatTime: עיצוב ערך לתצוגה עבור זמן.
 * @param value — ערך.
 * @returns string — הפלט בהתאם לחתימה.
 */
function formatTime(
  value: string,
): string {
  return value.slice(
    0,
    5,
  );
}

/**
 * פעולה getShiftTypeLabel: שליפה או חישוב של משמרת / תווית.
 * @param startTime — שעת התחלה.
 * @param endTime — שעת סיום.
 * @returns string — הפלט בהתאם לחתימה.
 */
function getShiftTypeLabel(
  startTime: string,
  endTime: string,
): string {
  // normalizedStartTime — שעת התחלה.
  const normalizedStartTime =
    formatTime(
      startTime,
    );

  // normalizedEndTime — שעת סיום.
  const normalizedEndTime =
    formatTime(
      endTime,
    );

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר normalizedStartTime === '06:00' && normalizedEndTime === '16:00'.
  if (
    normalizedStartTime ===
      '06:00' &&
    normalizedEndTime ===
      '16:00'
  ) {
    return 'משמרת בוקר';
  }

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר normalizedStartTime === '15:00' && normalizedEndTime === '23:00'.
  if (
    normalizedStartTime ===
      '15:00' &&
    normalizedEndTime ===
      '23:00'
  ) {
    return 'משמרת ערב';
  }

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר normalizedStartTime === '06:00' && normalizedEndTime === '14:00'.
  if (
    normalizedStartTime ===
      '06:00' &&
    normalizedEndTime ===
      '14:00'
  ) {
    return 'שישי בוקר';
  }

  return 'משמרת כונן בוקר';
}

/**
 * פעולה MorningDriverScheduleBoard: כונני בוקר.
 * פרמטר מפורק — שדות הקלט נגישים מקומית בשמות המוגדרים בחתימה.
 */
function MorningDriverScheduleBoard({
  data,
  isLoading,
  updatingAssignmentId,
  isPublishing,
  viewedYear,
  viewedMonth,
  onPreviousMonth,
  onNextMonth,
  onCurrentMonth,
  canEdit,
  canEditPublishedAssignments,
  onRefresh,
  onUpdateAssignment,
  onUpdateShiftTime,
  onSetIntentionallyUnassigned,
  currentUserId,
  canTransferMyAssignments,
  onSelectTransferAssignment,
  onPublish,
}: MorningDriverScheduleBoardProps) {
  // holidayLabels — חג.
  const holidayLabels =
    useCalendarHolidays(
      viewedYear,
      viewedMonth,
    );

  // מצב מקומי: displayMode — מצב פעולה; setDisplayMode מעדכנת אותו ומפעילה רינדור לפי React.
  const [
    displayMode,
    setDisplayMode,
  ] =
    useState<ScheduleDisplayMode>(
      'calendar',
    );

  // מצב מקומי: selectedCalendarDate — נבחר / לוח שנה / תאריך; setSelectedCalendarDate מעדכנת אותו ומפעילה רינדור לפי React.
  const [
    selectedCalendarDate,
    setSelectedCalendarDate,
  ] =
    useState<string | null>(
      null,
    );

  // ערך מחושב shiftGroups — משמרת / קבוצות; נשמר בין רינדורים עד שינוי התלויות.
  const shiftGroups =
    useMemo<
      ScheduleShiftGroup[]
    >(
      () => {
        // groups — קבוצות; מיפוי לחיפוש לפי מפתח.
        const groups =
          new Map<
            string,
            ScheduleShiftGroup
          >();

        // עיבוד כל פריט מתוך data?.assignments ?? [] בנפרד.
        for (
          const assignment
          of data?.assignments ??
          []
        ) {
          // key — מפתח.
          const key =
            assignment
              .availabilityShiftId;

          const existing =
            groups.get(
              key,
            );

          if (
            existing
          ) {
            existing.assignments.push(
              assignment,
            );

            continue;
          }

          groups.set(
            key,
            {
              key,
              shiftDate:
                assignment.shiftDate,
              weekdayName:
                assignment.weekdayName,
              startTime:
                assignment.startTime,
              endTime:
                assignment.endTime,
              minimumWorkers:
                assignment.minimumWorkers,
              recommendedWorkers:
                assignment.recommendedWorkers,
              assignments: [
                assignment,
              ],
            },
          );
        }

        return Array
          .from(
            groups.values(),
          )
          .map(
            (
              group,
            ) => ({
              ...group,

              assignments:
                [...group.assignments]
                  .sort(
                    (
                      firstAssignment,
                      secondAssignment,
                    ) =>
                      firstAssignment.assignmentSlot -
                      secondAssignment.assignmentSlot,
                  ),
            }),
          )
          .sort(
            (
              firstGroup,
              secondGroup,
            ) =>
              firstGroup.shiftDate
                .localeCompare(
                  secondGroup.shiftDate,
                ) ||
              firstGroup.startTime
                .localeCompare(
                  secondGroup.startTime,
                ),
          );
      },
      [
        data,
      ],
    );

  // ערך מחושב shiftGroupsByDate — משמרת / קבוצות / תאריך; נשמר בין רינדורים עד שינוי התלויות.
  const shiftGroupsByDate =
    useMemo(
      () => {
        // groupsByDate — קבוצות / תאריך; מיפוי לחיפוש לפי מפתח.
        const groupsByDate =
          new Map<
            string,
            ScheduleShiftGroup[]
          >();

        // עיבוד כל פריט מתוך shiftGroups בנפרד.
        for (
          const group
          of shiftGroups
        ) {
          // currentGroups — קבוצות.
          const currentGroups =
            groupsByDate.get(
              group.shiftDate,
            ) ?? [];

          currentGroups.push(
            group,
          );

          groupsByDate.set(
            group.shiftDate,
            currentGroups,
          );
        }

        return groupsByDate;
      },
      [
        shiftGroups,
      ],
    );

  // ערך מחושב selectedDateGroups — נבחר / תאריך / קבוצות; נשמר בין רינדורים עד שינוי התלויות.
  const selectedDateGroups =
    useMemo(
      () => {
        // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !selectedCalendarDate.
        if (
          !selectedCalendarDate
        ) {
          return [];
        }

        return (
          shiftGroupsByDate.get(
            selectedCalendarDate,
          ) ??
          []
        );
      },
      [
        selectedCalendarDate,
        shiftGroupsByDate,
      ],
    );

  // תופעת לוואי לאחר רינדור בהתאם לתלויות [ selectedCalendarDate, ].
  useEffect(
    () => {
      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !selectedCalendarDate.
      if (
        !selectedCalendarDate
      ) {
        return;
      }

      /**
       * פעולה handleKeyDown: טיפול באירוע עבור מפתח.
       * @param event — אירוע.
       * @returns void — הפלט בהתאם לחתימה.
       */
      const handleKeyDown =
        (
          event:
            KeyboardEvent,
        ): void => {
          if (
            event.key ===
            'Escape'
          ) {
            setSelectedCalendarDate(
              null,
            );
          }
        };

      window.addEventListener(
        'keydown',
        handleKeyDown,
      );

      return () => {
        window.removeEventListener(
          'keydown',
          handleKeyDown,
        );
      };
    },
    [
      selectedCalendarDate,
    ],
  );

  // displayedMonthLabel — חודש / תווית.
  const displayedMonthLabel =
    new Intl.DateTimeFormat(
      'he-IL',
      {
        month: 'long',
        year: 'numeric',
        timeZone:
          'Asia/Jerusalem',
      },
    ).format(
      new Date(
        viewedYear,
        viewedMonth - 1,
        1,
      ),
    );

  /**
   * פעולה renderMonthNavigation: בניית תצוגה עבור חודש / ניווט.
   */
  const renderMonthNavigation =
    () => (
      <div className="morning-driver-schedule-inline-month-navigation">
        <button
          type="button"
          className="morning-driver-schedule-month-button"
          disabled={
            isLoading
          }
          onClick={
            onPreviousMonth
          }
        >
          <ChevronRight
            size={18}
            aria-hidden="true"
          />
          חודש קודם
        </button>

        <div className="morning-driver-schedule-inline-month-title">
          <strong>
            {displayedMonthLabel}
          </strong>

          <button
            type="button"
            onClick={
              onCurrentMonth
            }
            disabled={
              isLoading
            }
          >
            החודש הנוכחי
          </button>
        </div>

        <button
          type="button"
          className="morning-driver-schedule-month-button"
          disabled={
            isLoading
          }
          onClick={
            onNextMonth
          }
        >
          חודש הבא
          <ChevronLeft
            size={18}
            aria-hidden="true"
          />
        </button>
      </div>
    );

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר isLoading && !data.
  if (
    isLoading &&
    !data
  ) {
    return (
      <section className="morning-driver-schedule-board">
        {renderMonthNavigation()}
        <div className="morning-driver-schedule-board-state">
        <LoaderCircle
          size={34}
          className="morning-driver-schedule-spin"
          aria-hidden="true"
        />

        <strong>
          טוען את לוח כונני הבוקר
        </strong>
        </div>
      </section>
    );
  }

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !data.
  if (
    !data
  ) {
    return (
      <section className="morning-driver-schedule-board">
        {renderMonthNavigation()}
        <div className="morning-driver-schedule-board-state">
        <CalendarDays
          size={36}
          aria-hidden="true"
        />

        <strong>
          עדיין לא נוצר לוח כונני בוקר
        </strong>

        <span>
          מנהל יכול לבחור חודש אילוצים סגור וליצור טיוטה אוטומטית.
        </span>
        </div>
      </section>
    );
  }

  // isDraft — טיוטה.
  const isDraft =
    data.period.status ===
    'draft';

  // isPublished — פורסם.
  const isPublished =
    data.period.status ===
    'published';

  /**
   * פעולה renderAssignmentSlot: בניית תצוגה עבור הקצאה.
   * @param assignment — הקצאה.
   */
  const renderAssignmentSlot =
    (
      assignment:
        MorningDriverScheduleAssignment,
    ) => {
      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר assignment.assignmentSlot > assignment.minimumWorkers && !assignment.assignedUserId.
      if (
        assignment.assignmentSlot > assignment.minimumWorkers &&
        !assignment.assignedUserId
      ) {
        return null;
      }

      // isUpdating — הנתון isUpdating בהקשר הפעולה.
      const isUpdating =
        updatingAssignmentId ===
        assignment.id;

      // isEditable — הנתון isEditable בהקשר הפעולה.
      const isEditable =
        (
          (
            canEdit &&
            isDraft
          ) ||
          (
            canEditPublishedAssignments &&
            isPublished
          )
        ) &&
        !isUpdating;

      return (
        <section
          key={
            assignment.id
          }
          className={[
            'morning-driver-schedule-slot',

            assignment.assignmentSlot ===
            1
              ? 'morning-driver-schedule-slot-minimum'
              : 'morning-driver-schedule-slot-recommended',

            assignment.assignedUserId
              ? 'morning-driver-schedule-slot-filled'
              : assignment.isIntentionallyUnassigned
                ? 'morning-driver-schedule-slot-intentionally-empty'
                : 'morning-driver-schedule-slot-empty',
          ].join(
            ' ',
          )}
        >
          <div className="morning-driver-schedule-slot-heading">
            <strong>
              {assignment.assignmentSlot ===
              1
                ? 'כונן מינימום'
                : 'כונן מומלץ נוסף'}
            </strong>

            {assignment.isLocked ? (
              <Lock
                size={16}
                aria-label="השיבוץ נעול"
              />
            ) : null}
          </div>

          <label>
            <span>
              כונן משובץ
            </span>

            <select
              value={
                assignment.assignedUserId ??
                ''
              }
              disabled={
                !isEditable
              }
              onChange={(
                event,
              ) => {
                onUpdateAssignment({
                  assignmentId:
                    assignment.id,

                  assignedUserId:
                    event.target.value ||
                    null,

                  isLocked:
                    assignment.isLocked,

                  note:
                    assignment.notes,
                });
              }}
            >
              <option value="">
                ללא שיבוץ
              </option>

              {data.drivers.map(
                (driver) => (
                  <option
                    key={driver.id}
                    value={driver.id}
                    disabled={
                      !driver.isActive &&
                      driver.id !== assignment.assignedUserId
                    }
                  >
                    {`${driver.scheduleName ?? driver.displayName}${driver.isActive ? '' : ' (מושבת)'}`}
                  </option>
                ),
              )}
            </select>
          </label>

          {assignment.assignmentSlot === 1 &&
          isDraft ? (
            <label className="morning-driver-schedule-intentionally-unassigned-field">
              <input
                type="checkbox"
                checked={
                  assignment.isIntentionallyUnassigned
                }
                disabled={
                  !canEdit ||
                  isUpdating ||
                  assignment.assignedUserId !== null
                }
                onChange={(event) => {
                  onSetIntentionallyUnassigned(
                    assignment.id,
                    event.target.checked,
                  );
                }}
              />

              <span>
                השאר משמרת לא משובצת
              </span>
            </label>
          ) : null}

          <label className="morning-driver-schedule-lock-field">
            <input
              type="checkbox"
              checked={
                assignment.isLocked
              }
              disabled={
                !canEdit ||
                !isDraft ||
                isUpdating
              }
              onChange={(
                event,
              ) => {
                onUpdateAssignment({
                  assignmentId:
                    assignment.id,

                  assignedUserId:
                    assignment.assignedUserId,

                  isLocked:
                    event.target.checked,

                  note:
                    assignment.notes,
                });
              }}
            />

            <span>
              נעילת שיבוץ
            </span>
          </label>

          {canTransferMyAssignments &&
          currentUserId &&
          data.period.status ===
            'published' &&
          assignment.assignedUserId ===
            currentUserId &&
          !assignment.isLocked &&
          assignment.shiftDate >=
            new Intl.DateTimeFormat(
              'en-CA',
              {
                timeZone:
                  'Asia/Jerusalem',
                year:
                  'numeric',
                month:
                  '2-digit',
                day:
                  '2-digit',
              },
            ).format(
              new Date(),
            ) ? (
            <button
              type="button"
              className="morning-driver-schedule-transfer-button"
              onClick={() => {
                onSelectTransferAssignment(
                  assignment,
                );
              }}
            >
              שינוי כונן
            </button>
          ) : null}

          {assignment.notes ? (
            <div className="morning-driver-schedule-slot-note">
              {
                assignment.notes
              }
            </div>
          ) : null}

          {isUpdating ? (
            <div className="morning-driver-schedule-slot-updating">
              <LoaderCircle
                size={16}
                className="morning-driver-schedule-spin"
                aria-hidden="true"
              />

              שומר...
            </div>
          ) : null}
        </section>
      );
    };

  /**
   * פעולה renderShiftGroup: בניית תצוגה עבור משמרת / קבוצה.
   * @param group — קבוצה.
   */
  const renderShiftGroup =
    (
      group:
        ScheduleShiftGroup,
    ) => (
      <article
        key={
          group.key
        }
        className="morning-driver-schedule-shift-card"
      >
        <header>
          <div>
            <span>
              {
                group.weekdayName
              }
            </span>

            <strong>
              {
                formatDate(
                  group.shiftDate,
                )
              }
            </strong>
          </div>

          <div>
            <strong dir="ltr">
              {
                formatTime(
                  group.startTime,
                )
              }
              {' – '}
              {
                formatTime(
                  group.endTime,
                )
              }
            </strong>

            <span>
              מינימום {group.minimumWorkers}
              {group.recommendedWorkers > group.minimumWorkers
                ? ` · כונן נוסף אופציונלי`
                : ''}
            </span>

            {isDraft && canEdit ? (
              <div className="morning-driver-schedule-time-editor">
                <label>
                  <span>התחלה</span>
                  <input
                    type="time"
                    defaultValue={formatTime(group.startTime)}
                    onBlur={(event) => {
                      // value — ערך.
                      const value = event.target.value;
                      if (value && value !== formatTime(group.startTime)) {
                        onUpdateShiftTime({
                          assignmentId: group.assignments[0].id,
                          startTime: value,
                          endTime: formatTime(group.endTime),
                        });
                      }
                    }}
                  />
                </label>
                <label>
                  <span>סיום</span>
                  <input
                    type="time"
                    defaultValue={formatTime(group.endTime)}
                    onBlur={(event) => {
                      // value — ערך.
                      const value = event.target.value;
                      if (value && value !== formatTime(group.endTime)) {
                        onUpdateShiftTime({
                          assignmentId: group.assignments[0].id,
                          startTime: formatTime(group.startTime),
                          endTime: value,
                        });
                      }
                    }}
                  />
                </label>
              </div>
            ) : null}
          </div>
        </header>

        <div className="morning-driver-schedule-slots">
          {group.assignments.map(
            renderAssignmentSlot,
          )}
        </div>
      </article>
    );

  return (
    <section className="morning-driver-schedule-board">
      <header className="morning-driver-schedule-board-header">
        <div className="morning-driver-schedule-board-context">
          <span>
            {data.period.status === 'published'
              ? 'לוח פורסם'
              : data.period.status === 'archived'
                ? 'לוח בארכיון'
                : 'טיוטת לוח'}
          </span>

          <strong>
            {displayedMonthLabel}
          </strong>

          <small>
            מינימום כונן אחד בכל משמרת; בבוקר מומלץ לשבץ שניים.
          </small>
        </div>

        <div className="morning-driver-schedule-board-actions">
          <button
            type="button"
            className="morning-driver-schedule-secondary-button"
            disabled={
              isLoading
            }
            onClick={
              onRefresh
            }
          >
            <RefreshCw
              size={17}
              aria-hidden="true"
            />

            רענון
          </button>

          {canEdit &&
          isDraft ? (
            <button
              type="button"
              className="morning-driver-schedule-publish-button"
              disabled={
                isPublishing ||
                data.statistics
                  .minimumUnfilled >
                  0
              }
              onClick={
                onPublish
              }
            >
              <Send
                size={17}
                aria-hidden="true"
              />

              {isPublishing
                ? 'מפרסם...'
                : 'פרסום לוח'}
            </button>
          ) : null}
        </div>
      </header>

      <div className="morning-driver-schedule-statistics">
        <article>
          <Users
            size={21}
            aria-hidden="true"
          />

          <strong>
            {
              data.statistics
                .assignedAssignments
            }
          </strong>

          <span>
            הקצאות מאוישות
          </span>
        </article>

        <article>
          <CircleAlert
            size={21}
            aria-hidden="true"
          />

          <strong>
            {
              data.statistics
                .minimumUnfilled
            }
          </strong>

          <span>
            חסרים למינימום
          </span>
        </article>

        <article>
          <CheckCircle2
            size={21}
            aria-hidden="true"
          />

          <strong>
            {
              data.statistics
                .recommendationUnfilled
            }
          </strong>

          <span>
            חסרים להמלצה
          </span>
        </article>

        <article>
          {data.period.status ===
          'published' ? (
            <Lock
              size={21}
              aria-hidden="true"
            />
          ) : (
            <Unlock
              size={21}
              aria-hidden="true"
            />
          )}

          <strong>
            {data.period.status ===
            'published'
              ? 'פורסם'
              : data.period.status ===
                  'archived'
                ? 'בארכיון'
                : 'טיוטה'}
          </strong>

          <span>
            סטטוס הלוח
          </span>
        </article>
      </div>

      {data.statistics
        .minimumUnfilled >
      0 ? (
        <div className="morning-driver-schedule-minimum-warning">
          לא ניתן לפרסם עד שכל משמרת תקבל כונן בוקר או תסומן במפורש כמשמרת לא משובצת.
        </div>
      ) : data.statistics
          .recommendationUnfilled >
        0 ? (
        <div className="morning-driver-schedule-recommendation-warning">
          המינימום הושלם, אך קיימות משמרות בוקר שבהן שובץ כונן אחד בלבד.
        </div>
      ) : null}

      <div
        className="morning-driver-schedule-display-mode"
        role="group"
        aria-label="בחירת תצוגת לוח כונני בוקר"
      >
        <button
          type="button"
          className={[
            'morning-driver-schedule-display-button',

            displayMode ===
              'calendar'
              ? 'morning-driver-schedule-display-button-active'
              : '',
          ]
            .filter(Boolean)
            .join(' ')}
          onClick={() => {
            setDisplayMode(
              'calendar',
            );
          }}
        >
          <CalendarDays
            size={17}
            aria-hidden="true"
          />

          לוח שנה
        </button>

        <button
          type="button"
          className={[
            'morning-driver-schedule-display-button',

            displayMode ===
              'list'
              ? 'morning-driver-schedule-display-button-active'
              : '',
          ]
            .filter(Boolean)
            .join(' ')}
          onClick={() => {
            setDisplayMode(
              'list',
            );
          }}
        >
          <LayoutList
            size={17}
            aria-hidden="true"
          />

          רשימה
        </button>
      </div>

      {displayMode ===
      'calendar' ? (
        <section className="morning-driver-schedule-calendar-section">
          <header>
            <div>
              <h3>
                לוח כונני הבוקר
              </h3>

              <span>
                לחיצה על יום פותחת את כל המשמרות והשיבוצים שלו.
              </span>
            </div>

            {renderMonthNavigation()}
          </header>

          <MonthCalendar
            dayLabels={holidayLabels}
            year={
              data.period.year
            }
            month={
              data.period.month
            }
            getDayClassName={(
              context,
            ) => {
              // dayGroups — יום / קבוצות.
              const dayGroups =
                shiftGroupsByDate.get(
                  context.date,
                ) ?? [];

              // טיפול במקרה מיוחד ויציאה מוקדמת כאשר dayGroups.length === 0.
              if (
                dayGroups.length ===
                0
              ) {
                return null;
              }

              const classNames = [
                'morning-driver-schedule-calendar-day-with-shifts',
              ];

              if (
                dayGroups.some(
                  (group) => {
                    // assignedCount — כמות.
                    const assignedCount =
                      group.assignments.filter(
                        (assignment) =>
                          Boolean(
                            assignment.assignedUserId,
                          ),
                      ).length;

                    // minimumAssignment — הקצאה.
                    const minimumAssignment =
                      group.assignments.find(
                        (assignment) =>
                          assignment.assignmentSlot ===
                          1,
                      );

                    return (
                      assignedCount <
                        group.minimumWorkers &&
                      !minimumAssignment
                        ?.isIntentionallyUnassigned
                    );
                  },
                )
              ) {
                classNames.push(
                  'morning-driver-schedule-calendar-day-unassigned',
                );
              }

              return classNames.join(
                ' ',
              );
            }}
            renderDayContent={(
              context,
            ) => {
              // dayGroups — יום / קבוצות.
              const dayGroups =
                shiftGroupsByDate.get(
                  context.date,
                ) ?? [];

              // טיפול במקרה מיוחד ויציאה מוקדמת כאשר dayGroups.length === 0.
              if (
                dayGroups.length ===
                0
              ) {
                return null;
              }

              return (
                <div className="morning-driver-schedule-calendar-assignments">
                  {dayGroups.map(
                    (
                      group,
                    ) => {
                      const assignedNames =
                        group.assignments
                          .map(
                            (
                              assignment,
                            ) =>
                              assignment.assignedUserName,
                          )
                          .filter(
                            (
                              name,
                            ): name is string =>
                              Boolean(
                                name,
                              ),
                          );

                      return (
                        <div
                          key={
                            group.key
                          }
                          className={[
                            'morning-driver-schedule-calendar-assignment',

                            assignedNames.length <
                              group.minimumWorkers &&
                            !group.assignments.find(
                              (assignment) =>
                                assignment.assignmentSlot ===
                                1,
                            )
                              ?.isIntentionallyUnassigned
                              ? 'morning-driver-schedule-calendar-assignment-unfilled'
                              : '',
                          ]
                            .filter(Boolean)
                            .join(' ')}
                        >
                          <strong dir="ltr">
                            {
                              formatTime(
                                group.startTime,
                              )
                            }
                            {'–'}
                            {
                              formatTime(
                                group.endTime,
                              )
                            }
                          </strong>

                          <span>
                            {
                              getShiftTypeLabel(
                                group.startTime,
                                group.endTime,
                              )
                            }
                          </span>

                          <small>
                            {assignedNames.length >
                            0
                              ? assignedNames.join(
                                  ' / ',
                                )
                              : 'ללא שיבוץ'}
                          </small>
                        </div>
                      );
                    },
                  )}
                </div>
              );
            }}
            onDayClick={(
              context,
            ) => {
              // dayGroups — יום / קבוצות.
              const dayGroups =
                shiftGroupsByDate.get(
                  context.date,
                ) ?? [];

              // טיפול במקרה מיוחד ויציאה מוקדמת כאשר dayGroups.length === 0.
              if (
                dayGroups.length ===
                0
              ) {
                return;
              }

              setSelectedCalendarDate(
                context.date,
              );
            }}
          />
        </section>
      ) : (
        <div className="morning-driver-schedule-shifts">
          {shiftGroups.map(
            renderShiftGroup,
          )}
        </div>
      )}

      {selectedCalendarDate ? (
        <>
          <button
            type="button"
            className="morning-driver-schedule-day-drawer-backdrop"
            aria-label="סגירת פרטי היום"
            onClick={() => {
              setSelectedCalendarDate(
                null,
              );
            }}
          />

          <aside
            className="morning-driver-schedule-day-drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="morning-driver-schedule-day-drawer-title"
          >
            <header className="morning-driver-schedule-day-drawer-header">
              <div>
                <span>
                  פרטי כונני בוקר
                </span>

                <h2 id="morning-driver-schedule-day-drawer-title">
                  {
                    formatDate(
                      selectedCalendarDate,
                    )
                  }
                </h2>
              </div>

              <button
                type="button"
                className="morning-driver-schedule-day-drawer-close"
                aria-label="סגירת פרטי היום"
                onClick={() => {
                  setSelectedCalendarDate(
                    null,
                  );
                }}
              >
                <X
                  size={22}
                  aria-hidden="true"
                />
              </button>
            </header>

            <div className="morning-driver-schedule-day-drawer-content">
              {selectedDateGroups.map(
                renderShiftGroup,
              )}
            </div>
          </aside>
        </>
      ) : null}
    </section>
  );
}

export default MorningDriverScheduleBoard;