import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Filter,
  UserRound,
} from 'lucide-react';

import {
  useMemo,
  useState,
} from 'react';

import MonthCalendar
  from '../calendar/MonthCalendar';

import {
  Button,
} from '../ui';

import type {
  DriverScheduleData,
  DriverScheduleDay,
} from '../../types/driverSchedule';

import '../../styles/driverScheduleCalendar.css';

interface DriverScheduleCalendarProps {
  data:
    DriverScheduleData | null;

  viewedYear:
    number;

  viewedMonth:
    number;

  currentUserId:
    string | null;

  canViewTeamSchedule:
    boolean;

  canEditSchedule:
    boolean;

  showManagementDetails:
    boolean;

  isLoading:
    boolean;

  onLoadMonth: (
    year: number,
    month: number,
  ) => Promise<void>;

  canTransferMyDuties:
    boolean;

  onSelectTransferDay: (
    day:
      DriverScheduleDay,
  ) => void;
}

type DriverCalendarFilter =
  | 'all'
  | 'mine'
  | 'warnings'
  | 'unassigned';

const hebrewMonths = [
  'ינואר',
  'פברואר',
  'מרץ',
  'אפריל',
  'מאי',
  'יוני',
  'יולי',
  'אוגוסט',
  'ספטמבר',
  'אוקטובר',
  'נובמבר',
  'דצמבר',
];

function getDriverDisplayName(
  day:
    DriverScheduleDay,

  currentUserId:
    string | null,
): string {
  if (
    currentUserId &&
    day.assignedUserId ===
      currentUserId
  ) {
    return 'הכוננות שלי';
  }

  return (
    day.assignedUserName ??
    'ללא כונן'
  );
}

function getAssignmentSourceLabel(
  day:
    DriverScheduleDay,
): string {
  switch (
    day.assignmentSource
  ) {
    case 'automatic':
      return 'שיבוץ אוטומטי';

    case 'manual':
      return 'שיבוץ ידני';

    case 'swap':
      return 'החלפה';

    case 'import':
      return 'ייבוא';

    default:
      return 'ללא מקור שיבוץ';
  }
}

function getPreviousMonth(
  year: number,
  month: number,
): {
  year: number;
  month: number;
} {
  if (month === 1) {
    return {
      year:
        year - 1,

      month:
        12,
    };
  }

  return {
    year,

    month:
      month - 1,
  };
}

function getNextMonth(
  year: number,
  month: number,
): {
  year: number;
  month: number;
} {
  if (month === 12) {
    return {
      year:
        year + 1,

      month:
        1,
    };
  }

  return {
    year,

    month:
      month + 1,
  };
}

function DriverScheduleCalendar({
  data,
  viewedYear,
  viewedMonth,
  currentUserId,
  canViewTeamSchedule,
  canEditSchedule,
  showManagementDetails,
  isLoading,
  onLoadMonth,
  canTransferMyDuties,
  onSelectTransferDay,
}: DriverScheduleCalendarProps) {
  const canViewAllDrivers =
    canViewTeamSchedule ||
    canEditSchedule ||
    showManagementDetails;

  const [
    selectedDriverId,
    setSelectedDriverId,
  ] =
    useState<string>(
      canViewAllDrivers
        ? 'all'
        : 'mine',
    );

  const [
    calendarFilter,
    setCalendarFilter,
  ] =
    useState<DriverCalendarFilter>(
      canViewAllDrivers
        ? 'all'
        : 'mine',
    );

  const period =
    data?.period ??
    null;

  const displayedYear =
    period?.year ??
    viewedYear;

  const displayedMonth =
    period?.month ??
    viewedMonth;


  const scheduleDrivers =
    data?.drivers ??
    [];

const scheduleDaysByDate =
  useMemo(() => {
    return new Map(
      (data?.days ?? []).map(
        (day) => [
          day.dutyDate,
          day,
        ],
      ),
    );
  }, [data?.days]);

  const loadMonth =
    async (
      year: number,
      month: number,
    ): Promise<void> => {
      if (isLoading) {
        return;
      }

      await onLoadMonth(
        year,
        month,
      );
    };

  const handlePreviousMonth =
    (): void => {
      const previousMonth =
        getPreviousMonth(
          displayedYear,
          displayedMonth,
        );

      void loadMonth(
        previousMonth.year,
        previousMonth.month,
      );
    };

  const handleNextMonth =
    (): void => {
      const nextMonth =
        getNextMonth(
          displayedYear,
          displayedMonth,
        );

      void loadMonth(
        nextMonth.year,
        nextMonth.month,
      );
    };

  const handleCurrentMonth =
    (): void => {
      const now =
        new Date();

      void loadMonth(
        now.getFullYear(),
        now.getMonth() + 1,
      );
    };

  const shouldShowDay =
    (
      day:
        DriverScheduleDay,
    ): boolean => {
      if (
        selectedDriverId !==
          'all' &&
        selectedDriverId !==
          'mine' &&
        day.assignedUserId !==
          selectedDriverId
      ) {
        return false;
      }

      if (
        selectedDriverId ===
          'mine' &&
        day.assignedUserId !==
          currentUserId
      ) {
        return false;
      }

      switch (
        calendarFilter
      ) {
        case 'mine':
          return (
            day.assignedUserId ===
            currentUserId
          );

        case 'warnings':
          return (
            showManagementDetails &&
            (
              day.spacingWarning ||
              Boolean(
                day.notes,
              )
            )
          );

        case 'unassigned':
          return (
            showManagementDetails &&
            day.assignedUserId ===
              null
          );

        case 'all':
        default:
          return true;
      }
    };


  const isTransferableMonth =
    (() => {
      const now =
        new Date();

      const currentPeriodValue =
        now.getFullYear() *
          12 +
        now.getMonth();

      const displayedPeriodValue =
        displayedYear *
          12 +
        displayedMonth -
          1;

      return (
        displayedPeriodValue ===
          currentPeriodValue ||
        displayedPeriodValue ===
          currentPeriodValue +
            1
      );
    })();

  const canTransferDay =
    (
      day:
        DriverScheduleDay,
    ): boolean => {
      if (
        !canTransferMyDuties ||
        !currentUserId ||
        !isTransferableMonth ||
        period?.status !==
          'published' ||
        day.assignedUserId !==
          currentUserId ||
        day.isLocked
      ) {
        return false;
      }

      const todayKey =
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
        );

      return (
        day.dutyDate >=
        todayKey
      );
    };

  return (
    <section className="driver-calendar">
      <header className="driver-calendar-toolbar">
        <div className="driver-calendar-navigation">
          <Button
            type="button"
            variant="secondary"
            disabled={
              isLoading
            }
            aria-label="החודש הקודם"
            onClick={
              handlePreviousMonth
            }
          >
            <ChevronRight
              size={18}
              aria-hidden="true"
            />
          </Button>

          <div className="driver-calendar-period-title">
            <strong>
              {
                hebrewMonths[
                  displayedMonth - 1
                ]
              }{' '}
              {displayedYear}
            </strong>

            <span
              className={[
                'driver-calendar-period-status',

                period
                  ? `driver-calendar-period-status-${period.status}`
                  : 'driver-calendar-period-status-empty',
              ].join(' ')}
            >
              {!period
                ? 'אין לוח'
                : period.status ===
                    'published'
                  ? 'פורסם'
                  : period.status ===
                      'draft'
                    ? 'טיוטה'
                    : 'ארכיון'}
            </span>
          </div>

          <Button
            type="button"
            variant="secondary"
            disabled={
              isLoading
            }
            aria-label="החודש הבא"
            onClick={
              handleNextMonth
            }
          >
            <ChevronLeft
              size={18}
              aria-hidden="true"
            />
          </Button>

          <Button
            type="button"
            variant="secondary"
            disabled={
              isLoading
            }
            onClick={
              handleCurrentMonth
            }
          >
            היום
          </Button>
        </div>

        <div className="driver-calendar-filters">
          <div className="driver-calendar-filter-heading">
            <Filter
              size={17}
              aria-hidden="true"
            />

            <span>
              סינון תצוגה
            </span>
          </div>

          {canViewAllDrivers ? (
            <label className="driver-calendar-filter-field">
              <span>
                כונן
              </span>

              <select
                value={
                  selectedDriverId
                }
                onChange={(
                  event,
                ) => {
                  setSelectedDriverId(
                    event.target.value,
                  );
                }}
              >
                <option value="all">
                  כל הכוננים
                </option>

                {currentUserId ? (
                  <option value="mine">
                    הכוננויות שלי
                  </option>
                ) : null}

                {scheduleDrivers.map(
                  (driver) => (
                    <option
                      key={
                        driver.id
                      }
                      value={
                        driver.id
                      }
                    >
                      {
                        driver.scheduleName ??
                        driver.displayName
                      }
                    </option>
                  ),
                )}
              </select>
            </label>
          ) : null}

          <label className="driver-calendar-filter-field">
            <span>
              הצג
            </span>

            <select
              value={
                calendarFilter
              }
              onChange={(
                event,
              ) => {
                setCalendarFilter(
                  event.target
                    .value as
                    DriverCalendarFilter,
                );
              }}
            >
              {canViewAllDrivers ? (
                <option value="all">
                  כל הימים
                </option>
              ) : null}

              <option value="mine">
                הכוננויות שלי
              </option>

              {showManagementDetails ? (
                <>
                  <option value="warnings">
                    ימים עם אזהרות
                  </option>

                  <option value="unassigned">
                    ימים ללא כונן
                  </option>
                </>
              ) : null}
            </select>
          </label>
        </div>
      </header>

      <MonthCalendar
        year={
          displayedYear
        }
        month={
          displayedMonth
        }
        getDayClassName={(
          context,
        ) => {
          const day =
            scheduleDaysByDate.get(
              context.date,
            );

          if (!day) {
            return null;
          }

          const classNames:
            string[] = [];

          if (
            day.assignedUserId ===
            currentUserId
          ) {
            classNames.push(
              'driver-calendar-day-mine',
            );
          }

          if (
            canTransferDay(
              day,
            )
          ) {
            classNames.push(
              'driver-calendar-day-transferable',
            );
          }

          if (
            showManagementDetails &&
            (
              day.spacingWarning ||
              day.notes
            )
          ) {
            classNames.push(
              'driver-calendar-day-warning',
            );
          }

          if (
            showManagementDetails &&
            !day.assignedUserId
          ) {
            classNames.push(
              'driver-calendar-day-unassigned',
            );
          }

          return (
            classNames.join(' ') ||
            null
          );
        }}
        onDayClick={
          canTransferMyDuties
            ? (
                context,
              ) => {
                const day =
                  scheduleDaysByDate.get(
                    context.date,
                  );

                if (
                  day &&
                  canTransferDay(
                    day,
                  )
                ) {
                  onSelectTransferDay(
                    day,
                  );
                }
              }
            : undefined
        }
        renderDayContent={(
          context,
        ) => {
          const day =
            scheduleDaysByDate.get(
              context.date,
            );

          if (
            !day ||
            !shouldShowDay(
              day,
            )
          ) {
            return null;
          }

          const isMyDuty =
            Boolean(
              currentUserId &&
              day.assignedUserId ===
                currentUserId,
            );

          return (
            <div
              className={[
                'driver-calendar-assignment',

                isMyDuty
                  ? 'driver-calendar-assignment-mine'
                  : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <div className="driver-calendar-assignment-header">
                <UserRound
                  size={15}
                  aria-hidden="true"
                />

                <strong>
                  {getDriverDisplayName(
                    day,
                    currentUserId,
                  )}
                </strong>
              </div>
              {showManagementDetails ? (
                <span className="driver-calendar-assignment-source">
                  {getAssignmentSourceLabel(
                    day,
                  )}
                </span>
              ) : null}

              {canTransferDay(
                day,
              ) ? (
                <span className="driver-calendar-assignment-transfer">
                  לחיצה לשינוי כונן
                </span>
              ) : null}

              {showManagementDetails &&
              (
                day.spacingWarning ||
                day.notes
              ) ? (
                <span className="driver-calendar-assignment-warning">
                  <AlertTriangle
                    size={14}
                    aria-hidden="true"
                  />

                  אזהרה
                </span>
              ) : null}
            </div>
          );
        }}
      />
    </section>
  );
}

export default DriverScheduleCalendar;