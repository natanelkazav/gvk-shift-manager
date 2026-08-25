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
} from '../../types/morningDriverSchedule';

interface MorningDriverScheduleBoardProps {
  data:
    MorningDriverScheduleData | null;

  isLoading: boolean;

  updatingAssignmentId:
    string | null;

  isPublishing: boolean;

  viewedYear: number;

  viewedMonth: number;

  onPreviousMonth:
    () => void;

  onNextMonth:
    () => void;

  onCurrentMonth:
    () => void;

  canEdit: boolean;

  canEditPublishedAssignments: boolean;

  onRefresh:
    () => void;

  onUpdateAssignment: (
    request:
      UpdateMorningDriverScheduleAssignmentRequest,
  ) => void;

  currentUserId:
    string | null;

  canTransferMyAssignments:
    boolean;

  onSelectTransferAssignment: (
    assignment:
      MorningDriverScheduleAssignment,
  ) => void;

  onPublish:
    () => void;
}

interface ScheduleShiftGroup {
  key: string;
  shiftDate: string;
  weekdayName: string;
  startTime: string;
  endTime: string;
  minimumWorkers: number;
  recommendedWorkers: number;
  assignments:
    MorningDriverScheduleAssignment[];
}

type ScheduleDisplayMode =
  | 'calendar'
  | 'list';

function formatDate(
  value: string,
): string {
  const date =
    new Date(
      `${value}T12:00:00`,
    );

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

function formatTime(
  value: string,
): string {
  return value.slice(
    0,
    5,
  );
}

function getShiftTypeLabel(
  startTime: string,
  endTime: string,
): string {
  const normalizedStartTime =
    formatTime(
      startTime,
    );

  const normalizedEndTime =
    formatTime(
      endTime,
    );

  if (
    normalizedStartTime ===
      '06:00' &&
    normalizedEndTime ===
      '16:00'
  ) {
    return 'משמרת בוקר';
  }

  if (
    normalizedStartTime ===
      '15:00' &&
    normalizedEndTime ===
      '23:00'
  ) {
    return 'משמרת ערב';
  }

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
  currentUserId,
  canTransferMyAssignments,
  onSelectTransferAssignment,
  onPublish,
}: MorningDriverScheduleBoardProps) {
  const holidayLabels =
    useCalendarHolidays(
      viewedYear,
      viewedMonth,
    );

  const [
    displayMode,
    setDisplayMode,
  ] =
    useState<ScheduleDisplayMode>(
      'calendar',
    );

  const [
    selectedCalendarDate,
    setSelectedCalendarDate,
  ] =
    useState<string | null>(
      null,
    );

  const shiftGroups =
    useMemo<
      ScheduleShiftGroup[]
    >(
      () => {
        const groups =
          new Map<
            string,
            ScheduleShiftGroup
          >();

        for (
          const assignment
          of data?.assignments ??
          []
        ) {
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

  const shiftGroupsByDate =
    useMemo(
      () => {
        const groupsByDate =
          new Map<
            string,
            ScheduleShiftGroup[]
          >();

        for (
          const group
          of shiftGroups
        ) {
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

  const selectedDateGroups =
    useMemo(
      () => {
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

  useEffect(
    () => {
      if (
        !selectedCalendarDate
      ) {
        return;
      }

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

  const isDraft =
    data.period.status ===
    'draft';

  const isPublished =
    data.period.status ===
    'published';

  const renderAssignmentSlot =
    (
      assignment:
        MorningDriverScheduleAssignment,
    ) => {
      const isUpdating =
        updatingAssignmentId ===
        assignment.id;

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
              מינימום {
                group.minimumWorkers
              } · מומלץ {
                group.recommendedWorkers
              }
            </span>
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
          לא ניתן לפרסם את הלוח עד שיוקצה לפחות כונן אחד לכל משמרת.
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
              const dayGroups =
                shiftGroupsByDate.get(
                  context.date,
                ) ?? [];

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
                  (
                    group,
                  ) =>
                    group.assignments.some(
                      (
                        assignment,
                      ) =>
                        !assignment.assignedUserId,
                    ),
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
              const dayGroups =
                shiftGroupsByDate.get(
                  context.date,
                ) ?? [];

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
                            group.minimumWorkers
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
              const dayGroups =
                shiftGroupsByDate.get(
                  context.date,
                ) ?? [];

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