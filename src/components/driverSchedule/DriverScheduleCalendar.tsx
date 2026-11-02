/**
 * קובץ: src/components/driverSchedule/DriverScheduleCalendar.tsx
 * מטרה: מימוש רכיב תצוגה ואינטראקציה עבור כוננים / שיבוץ / לוח שנה.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: DriverScheduleCalendarProps, DriverCalendarFilter, getDriverDisplayName, getAssignmentSourceLabel, getPreviousMonth, getNextMonth, DriverScheduleCalendar.
 * - קישור מאפיינים ומצב מקומי לתצוגה ולטיפול בפעולות המשתמש.
 */
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
  useCalendarHolidays,
} from '../../hooks/useCalendarHolidays';

import {
  Button,
} from '../ui';

import type {
  DriverScheduleData,
  DriverScheduleDay,
} from '../../types/driverSchedule';

import '../../styles/driverScheduleCalendar.css';

/**
 * חוזה הנתונים DriverScheduleCalendarProps: כוננים / שיבוץ / לוח שנה / מאפייני הרכיב.
 */
interface DriverScheduleCalendarProps {
  // data — נתונים.
  data:
    DriverScheduleData | null;

  // viewedYear — שנה.
  viewedYear:
    number;

  // viewedMonth — חודש.
  viewedMonth:
    number;

  // currentUserId — המשתמש הנוכחי הנוכחי.
  currentUserId:
    string | null;

  // canViewTeamSchedule — האם צפייה מותרת.
  canViewTeamSchedule:
    boolean;

  // canEditSchedule — האם עריכה מותרת.
  canEditSchedule:
    boolean;

  // canEditPublishedSchedule — האם עריכה מותרת.
  canEditPublishedSchedule:
    boolean;

  showManagementDetails:
    boolean;

  // isLoading — האם טעינה מתבצעת.
  isLoading:
    boolean;

  // onLoadMonth — חודש.
  onLoadMonth: (
    year: number,
    month: number,
  ) => Promise<void>;

  canTransferMyDuties:
    boolean;

  // onSelectTransferDay — יום.
  onSelectTransferDay: (
    day:
      DriverScheduleDay,
  ) => void;

  // onSelectEditDay — יום.
  onSelectEditDay: (
    day:
      DriverScheduleDay,
  ) => void;
}

/**
 * טיפוס DriverCalendarFilter: כוננים / לוח שנה / סינון.
 */
type DriverCalendarFilter =
  | 'all'
  | 'mine'
  | 'warnings'
  | 'unassigned';

// hebrewMonths — חודשים.
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

/**
 * פעולה getDriverDisplayName: שליפה או חישוב של שם תצוגה.
 * @param day — יום.
 * @param currentUserId — המשתמש הנוכחי הנוכחי.
 * @returns string — הפלט בהתאם לחתימה.
 */
function getDriverDisplayName(
  day:
    DriverScheduleDay,

  currentUserId:
    string | null,
): string {
  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר currentUserId && day.assignedUserId === currentUserId.
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

/**
 * פעולה getAssignmentSourceLabel: שליפה או חישוב של מקור השיבוץ.
 * @param day — יום.
 * @returns string — הפלט בהתאם לחתימה.
 */
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

/**
 * פעולה getPreviousMonth: שליפה או חישוב של חודש.
 * @param year — שנה.
 * @param month — חודש.
 * @returns { year: number; month: number; } — הפלט בהתאם לחתימה.
 */
function getPreviousMonth(
  year: number,
  month: number,
): {
  // year — שנה.
  year: number;
  // month — חודש.
  month: number;
} {
  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר month === 1.
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

/**
 * פעולה getNextMonth: שליפה או חישוב של חודש.
 * @param year — שנה.
 * @param month — חודש.
 * @returns { year: number; month: number; } — הפלט בהתאם לחתימה.
 */
function getNextMonth(
  year: number,
  month: number,
): {
  // year — שנה.
  year: number;
  // month — חודש.
  month: number;
} {
  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר month === 12.
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

/**
 * פעולה DriverScheduleCalendar: כוננים / שיבוץ / לוח שנה.
 * פרמטר מפורק — שדות הקלט נגישים מקומית בשמות המוגדרים בחתימה.
 */
function DriverScheduleCalendar({
  data,
  viewedYear,
  viewedMonth,
  currentUserId,
  canViewTeamSchedule,
  canEditSchedule,
  canEditPublishedSchedule,
  showManagementDetails,
  isLoading,
  onLoadMonth,
  canTransferMyDuties,
  onSelectTransferDay,
  onSelectEditDay,
}: DriverScheduleCalendarProps) {
  // holidayLabels — חג.
  const holidayLabels =
    useCalendarHolidays(
      viewedYear,
      viewedMonth,
    );

  // canViewAllDrivers — האם צפייה מותרת.
  const canViewAllDrivers =
    canViewTeamSchedule ||
    canEditSchedule ||
    showManagementDetails;

  // מצב מקומי: selectedDriverId — נבחר / כוננים / מזהה; setSelectedDriverId מעדכנת אותו ומפעילה רינדור לפי React.
  const [
    selectedDriverId,
    setSelectedDriverId,
  ] =
    useState<string>(
      canViewAllDrivers
        ? 'all'
        : 'mine',
    );

  // מצב מקומי: calendarFilter — לוח שנה / סינון; setCalendarFilter מעדכנת אותו ומפעילה רינדור לפי React.
  const [
    calendarFilter,
    setCalendarFilter,
  ] =
    useState<DriverCalendarFilter>(
      canViewAllDrivers
        ? 'all'
        : 'mine',
    );

  // period — תקופה.
  const period =
    data?.period ??
    null;

  // displayedYear — שנה.
  const displayedYear =
    period?.year ??
    viewedYear;

  // displayedMonth — חודש.
  const displayedMonth =
    period?.month ??
    viewedMonth;


  // scheduleDrivers — שיבוץ.
  const scheduleDrivers =
    data?.drivers ??
    [];

// ערך מחושב scheduleDaysByDate — שיבוץ / ימים / תאריך; נשמר בין רינדורים עד שינוי התלויות.
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

  /**
   * פעולה אסינכרונית loadMonth: טעינת חודש.
   * @param year — שנה.
   * @param month — חודש.
   * @returns Promise<void> — הפלט בהתאם לחתימה.
   */
  const loadMonth =
    async (
      year: number,
      month: number,
    ): Promise<void> => {
      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר isLoading.
      if (isLoading) {
        return;
      }

      await onLoadMonth(
        year,
        month,
      );
    };

  /**
   * פעולה handlePreviousMonth: טיפול באירוע עבור חודש.
   * @returns void — הפלט בהתאם לחתימה.
   */
  const handlePreviousMonth =
    (): void => {
      // previousMonth — חודש.
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

  /**
   * פעולה handleNextMonth: טיפול באירוע עבור חודש.
   * @returns void — הפלט בהתאם לחתימה.
   */
  const handleNextMonth =
    (): void => {
      // nextMonth — חודש.
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

  /**
   * פעולה handleCurrentMonth: טיפול באירוע עבור חודש.
   * @returns void — הפלט בהתאם לחתימה.
   */
  const handleCurrentMonth =
    (): void => {
      const now =
        new Date();

      void loadMonth(
        now.getFullYear(),
        now.getMonth() + 1,
      );
    };

  /**
   * פעולה shouldShowDay: יום.
   * @param day — יום.
   * @returns boolean — הפלט בהתאם לחתימה.
   */
  const shouldShowDay =
    (
      day:
        DriverScheduleDay,
    ): boolean => {
      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר selectedDriverId !== 'all' && selectedDriverId !== 'mine' && day.assignedUserId !== selectedDriverId.
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

      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר selectedDriverId === 'mine' && day.assignedUserId !== currentUserId.
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


  // isTransferableMonth — חודש.
  const isTransferableMonth =
    (() => {
      const now =
        new Date();

      // currentPeriodValue — תקופה / ערך.
      const currentPeriodValue =
        now.getFullYear() *
          12 +
        now.getMonth();

      // displayedPeriodValue — תקופה / ערך.
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

  /**
   * פעולה canEditDay: בדיקת אפשרות פעולה עבור האם עריכה מותרת.
   * @param day — יום.
   * @returns boolean — הפלט בהתאם לחתימה.
   */
  const canEditDay =
    (
      day:
        DriverScheduleDay,
    ): boolean => {
      return (
        canEditPublishedSchedule &&
        isTransferableMonth &&
        period?.status ===
          'published' &&
        Boolean(day.id)
      );
    };

  /**
   * פעולה canTransferDay: בדיקת אפשרות פעולה עבור יום.
   * @param day — יום.
   * @returns boolean — הפלט בהתאם לחתימה.
   */
  const canTransferDay =
    (
      day:
        DriverScheduleDay,
    ): boolean => {
      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !canTransferMyDuties || !currentUserId || !isTransferableMonth || period?.status !== 'published' || day.assignedUserId !== currentUserId || .
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

      // todayKey — מפתח.
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
        dayLabels={holidayLabels}
        year={
          displayedYear
        }
        month={
          displayedMonth
        }
        getDayClassName={(
          context,
        ) => {
          // day — יום.
          const day =
            scheduleDaysByDate.get(
              context.date,
            );

          // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !day.
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
          canEditPublishedSchedule ||
          canTransferMyDuties
            ? (
                context,
              ) => {
                // day — יום.
                const day =
                  scheduleDaysByDate.get(
                    context.date,
                  );

                // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !day.
                if (!day) {
                  return;
                }

                // טיפול במקרה מיוחד ויציאה מוקדמת כאשר canEditDay( day, ).
                if (
                  canEditDay(
                    day,
                  )
                ) {
                  onSelectEditDay(
                    day,
                  );
                  return;
                }

                if (
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
          // day — יום.
          const day =
            scheduleDaysByDate.get(
              context.date,
            );

          // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !day || !shouldShowDay( day, ).
          if (
            !day ||
            !shouldShowDay(
              day,
            )
          ) {
            return null;
          }

          // isMyDuty — הנתון isMyDuty בהקשר הפעולה.
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

              {canEditDay(
                day,
              ) ? (
                <span className="driver-calendar-assignment-transfer">
                  לחיצה לעריכת כוננות
                </span>
              ) : canTransferDay(
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