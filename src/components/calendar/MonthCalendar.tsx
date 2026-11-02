/**
 * קובץ: src/components/calendar/MonthCalendar.tsx
 * מטרה: מימוש רכיב תצוגה ואינטראקציה עבור חודש / לוח שנה.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: MonthCalendarDayContext, MonthCalendarProps, createLocalDate, formatDateKey, isSameCalendarDay, MonthCalendar.
 * - קישור מאפיינים ומצב מקומי לתצוגה ולטיפול בפעולות המשתמש.
 */
import {
  CalendarDays,
} from 'lucide-react';

import {
  useRef,
} from 'react';

import type {
  ReactNode,
  UIEvent,
} from 'react';
import '../../styles/monthCalendar.css';
/**
 * חוזה הנתונים MonthCalendarDayContext: חודש / לוח שנה / יום.
 */
interface MonthCalendarDayContext {
  // date — תאריך.
  date: string;

  // dayNumber — יום.
  dayNumber: number;

  weekdayNumber: number;

  isToday: boolean;

  isWeekend: boolean;
}

/**
 * חוזה הנתונים MonthCalendarProps: חודש / לוח שנה / מאפייני הרכיב.
 */
interface MonthCalendarProps {
  // year — שנה.
  year: number;

  // month — חודש.
  month: number;

  // renderDayContent — יום (אופציונלי).
  renderDayContent?: (
    context:
      MonthCalendarDayContext,
  ) => ReactNode;

  // getDayClassName — יום / שם (אופציונלי).
  getDayClassName?: (
    context:
      MonthCalendarDayContext,
  ) => string | null;

  // onDayClick — יום (אופציונלי).
  onDayClick?: (
    context:
      MonthCalendarDayContext,
  ) => void;

  // emptyMessage — הודעה (אופציונלי).
  emptyMessage?: string;

  // dayLabels — יום (אופציונלי).
  dayLabels?: ReadonlyMap<string, string[]>;
}

// weekdayLabels — הנתון weekdayLabels בהקשר הפעולה.
const weekdayLabels = [
  'א׳',
  'ב׳',
  'ג׳',
  'ד׳',
  'ה׳',
  'ו׳',
  'ש׳',
];

/**
 * פעולה createLocalDate: יצירת תאריך.
 * @param year — שנה.
 * @param month — חודש.
 * @param day — יום.
 * @returns Date — הפלט בהתאם לחתימה.
 */
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

/**
 * פעולה formatDateKey: עיצוב ערך לתצוגה עבור תאריך / מפתח.
 * @param year — שנה.
 * @param month — חודש.
 * @param day — יום.
 * @returns string — הפלט בהתאם לחתימה.
 */
function formatDateKey(
  year: number,
  month: number,
  day: number,
): string {
  // normalizedMonth — חודש.
  const normalizedMonth =
    String(month)
      .padStart(
        2,
        '0',
      );

  // normalizedDay — יום.
  const normalizedDay =
    String(day)
      .padStart(
        2,
        '0',
      );

  return `${year}-${normalizedMonth}-${normalizedDay}`;
}

/**
 * פעולה isSameCalendarDay: בדיקת תנאי עבור לוח שנה / יום.
 * @param firstDate — תאריך.
 * @param secondDate — תאריך.
 * @returns boolean — הפלט בהתאם לחתימה.
 */
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

/**
 * פעולה MonthCalendar: חודש / לוח שנה.
 * פרמטר מפורק — שדות הקלט נגישים מקומית בשמות המוגדרים בחתימה.
 */
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
  // הפניה יציבה weekdaysScrollRef בין רינדורים; שינוי current אינו מפעיל רינדור בפני עצמו.
  const weekdaysScrollRef =
    useRef<HTMLDivElement>(null);

  // הפניה יציבה gridScrollRef בין רינדורים; שינוי current אינו מפעיל רינדור בפני עצמו.
  const gridScrollRef =
    useRef<HTMLDivElement>(null);

  /**
   * פעולה syncHorizontalScroll: סנכרון הנתון syncHorizontalScroll בהקשר הפעולה.
   * @param event — אירוע.
   * @param target — יעד.
   * @returns void — הפלט בהתאם לחתימה.
   */
  const syncHorizontalScroll = (
    event: UIEvent<HTMLDivElement>,
    target: HTMLDivElement | null,
  ): void => {
    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !target.
    if (!target) {
      return;
    }

    // nextScrollLeft — הנתון nextScrollLeft בהקשר הפעולה.
    const nextScrollLeft =
      event.currentTarget.scrollLeft;

    if (
      Math.abs(
        target.scrollLeft -
          nextScrollLeft,
      ) > 1
    ) {
      target.scrollLeft =
        nextScrollLeft;
    }
  };

  // isValidMonth — חודש.
  const isValidMonth =
    Number.isInteger(
      month,
    ) &&
    month >= 1 &&
    month <= 12;

  // isValidYear — שנה.
  const isValidYear =
    Number.isInteger(
      year,
    ) &&
    year >= 1900 &&
    year <= 2200;

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !isValidMonth || !isValidYear.
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

  // firstDayOfMonth — יום / חודש.
  const firstDayOfMonth =
    createLocalDate(
      year,
      month,
      1,
    );

  const firstWeekdayNumber =
    firstDayOfMonth.getDay();

  // daysInMonth — ימים / חודש.
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

  // totalRequiredCells — סך הכול.
  const totalRequiredCells =
    firstWeekdayNumber +
    daysInMonth;

  // totalCalendarCells — סך הכול / לוח שנה.
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
      <div
        ref={weekdaysScrollRef}
        className="month-calendar-weekdays-scroll"
        onScroll={(event) =>
          syncHorizontalScroll(
            event,
            gridScrollRef.current,
          )
        }
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
      </div>

      <div
        ref={gridScrollRef}
        className="month-calendar-grid-scroll"
        onScroll={(event) =>
          syncHorizontalScroll(
            event,
            weekdaysScrollRef.current,
          )
        }
      >
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
            // dayNumber — יום.
            const dayNumber =
              cellIndex -
              firstWeekdayNumber +
              1;

            // טיפול במקרה מיוחד ויציאה מוקדמת כאשר dayNumber < 1 || dayNumber > daysInMonth.
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

            // date — תאריך.
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

            // customClassName — שם.
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

            // className — שם.
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

            // טיפול במקרה מיוחד ויציאה מוקדמת כאשר onDayClick.
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
                    <span className="month-calendar-day-number" dir="ltr">{dayNumber}/{month}</span>
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
                  <span className="month-calendar-day-number" dir="ltr">{dayNumber}/{month}</span>
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