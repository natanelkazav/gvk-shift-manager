import {
  CalendarDays,
} from 'lucide-react';

import type {
  ReactNode,
} from 'react';
import '../../styles/monthCalendar.css';
interface MonthCalendarDayContext {
  date: string;

  dayNumber: number;

  weekdayNumber: number;

  isToday: boolean;

  isWeekend: boolean;
}

interface MonthCalendarProps {
  year: number;

  month: number;

  renderDayContent?: (
    context:
      MonthCalendarDayContext,
  ) => ReactNode;

  getDayClassName?: (
    context:
      MonthCalendarDayContext,
  ) => string | null;

  onDayClick?: (
    context:
      MonthCalendarDayContext,
  ) => void;

  emptyMessage?: string;

  dayLabels?: ReadonlyMap<string, string[]>;
}

const weekdayLabels = [
  'א׳',
  'ב׳',
  'ג׳',
  'ד׳',
  'ה׳',
  'ו׳',
  'ש׳',
];

function createLocalDate(
  year: number,
  month: number,
  day: number,
): Date {
  return new Date(
    year,
    month - 1,
    day,
    12,
    0,
    0,
    0,
  );
}

function formatDateKey(
  year: number,
  month: number,
  day: number,
): string {
  const normalizedMonth =
    String(month)
      .padStart(
        2,
        '0',
      );

  const normalizedDay =
    String(day)
      .padStart(
        2,
        '0',
      );

  return `${year}-${normalizedMonth}-${normalizedDay}`;
}

function isSameCalendarDay(
  firstDate: Date,
  secondDate: Date,
): boolean {
  return (
    firstDate.getFullYear() ===
      secondDate.getFullYear() &&
    firstDate.getMonth() ===
      secondDate.getMonth() &&
    firstDate.getDate() ===
      secondDate.getDate()
  );
}

function MonthCalendar({
  year,
  month,
  renderDayContent,
  getDayClassName,
  onDayClick,
  emptyMessage =
    'אין נתונים להצגה בחודש הזה.',
  dayLabels,
}: MonthCalendarProps) {
  const isValidMonth =
    Number.isInteger(
      month,
    ) &&
    month >= 1 &&
    month <= 12;

  const isValidYear =
    Number.isInteger(
      year,
    ) &&
    year >= 1900 &&
    year <= 2200;

  if (
    !isValidMonth ||
    !isValidYear
  ) {
    return (
      <section className="month-calendar-empty">
        <CalendarDays
          size={30}
          aria-hidden="true"
        />

        <strong>
          לא ניתן להציג את לוח החודש
        </strong>

        <span>
          החודש או השנה שהתקבלו אינם
          תקינים.
        </span>
      </section>
    );
  }

  const firstDayOfMonth =
    createLocalDate(
      year,
      month,
      1,
    );

  const firstWeekdayNumber =
    firstDayOfMonth.getDay();

  const daysInMonth =
    new Date(
      year,
      month,
      0,
      12,
      0,
      0,
      0,
    ).getDate();

  const totalRequiredCells =
    firstWeekdayNumber +
    daysInMonth;

  const totalCalendarCells =
    Math.ceil(
      totalRequiredCells /
        7,
    ) * 7;

  const today =
    new Date();

  return (
    <section
      className="month-calendar"
      aria-label={`לוח חודש ${month}/${year}`}
    >
      <div className="month-calendar-weekdays">
        {weekdayLabels.map(
          (
            weekdayLabel,
            index,
          ) => (
            <div
              key={
                weekdayLabel
              }
              className={[
                'month-calendar-weekday',

                index === 5
                  ? 'month-calendar-weekday-friday'
                  : '',

                index === 6
                  ? 'month-calendar-weekday-saturday'
                  : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              {weekdayLabel}
            </div>
          ),
        )}
      </div>

      <div className="month-calendar-grid">
        {Array.from(
          {
            length:
              totalCalendarCells,
          },
          (
            _,
            cellIndex,
          ) => {
            const dayNumber =
              cellIndex -
              firstWeekdayNumber +
              1;

            if (
              dayNumber < 1 ||
              dayNumber >
                daysInMonth
            ) {
              return (
                <div
                  key={`empty-${cellIndex}`}
                  className="month-calendar-day month-calendar-day-empty"
                  aria-hidden="true"
                />
              );
            }

            const date =
              createLocalDate(
                year,
                month,
                dayNumber,
              );

            const weekdayNumber =
              date.getDay();

            const context:
              MonthCalendarDayContext = {
                date:
                  formatDateKey(
                    year,
                    month,
                    dayNumber,
                  ),

                dayNumber,

                weekdayNumber,

                isToday:
                  isSameCalendarDay(
                    date,
                    today,
                  ),

                isWeekend:
                  weekdayNumber ===
                    5 ||
                  weekdayNumber ===
                    6,
              };

            const customClassName =
              getDayClassName?.(
                context,
              ) ??
              '';

            const renderedContent =
              renderDayContent?.(
                context,
              ) ??
              null;

            const className = [
              'month-calendar-day',

              context.isToday
                ? 'month-calendar-day-today'
                : '',

              weekdayNumber ===
              5
                ? 'month-calendar-day-friday'
                : '',

              weekdayNumber ===
              6
                ? 'month-calendar-day-saturday'
                : '',

              onDayClick
                ? 'month-calendar-day-clickable'
                : '',

              customClassName,
            ]
              .filter(Boolean)
              .join(' ');

            if (onDayClick) {
              return (
                <button
                  key={
                    context.date
                  }
                  type="button"
                  className={
                    className
                  }
                  onClick={() => {
                    onDayClick(
                      context,
                    );
                  }}
                >
                  <div className="month-calendar-day-heading">
                    <span className="month-calendar-day-number">{dayNumber}</span>
                    {(dayLabels?.get(context.date) ?? []).map((label) => (
                      <span key={label} className="month-calendar-day-holiday">{label}</span>
                    ))}
                  </div>

                  <div className="month-calendar-day-content">
                    {
                      renderedContent
                    }
                  </div>
                </button>
              );
            }

            return (
              <div
                key={
                  context.date
                }
                className={
                  className
                }
              >
                <div className="month-calendar-day-heading">
                  <span className="month-calendar-day-number">{dayNumber}</span>
                  {(dayLabels?.get(context.date) ?? []).map((label) => (
                    <span key={label} className="month-calendar-day-holiday">{label}</span>
                  ))}
                </div>

                <div className="month-calendar-day-content">
                  {
                    renderedContent
                  }
                </div>
              </div>
            );
          },
        )}
      </div>

      {!renderDayContent ? (
        <div className="month-calendar-empty-message">
          {emptyMessage}
        </div>
      ) : null}
    </section>
  );
}

export type {
  MonthCalendarDayContext,
  MonthCalendarProps,
};

export default MonthCalendar;