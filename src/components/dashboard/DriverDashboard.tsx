/**
 * קובץ: src/components/dashboard/DriverDashboard.tsx
 * מטרה: מימוש רכיב תצוגה ואינטראקציה עבור כוננים / לוח בקרה.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: DriverDashboardProps, formatDate, formatTime, getDispatcherName, DutyContent, DriverDashboard.
 * - קישור מאפיינים ומצב מקומי לתצוגה ולטיפול בפעולות המשתמש.
 */
import {
  CalendarClock,
  Radio,
  Users,
} from 'lucide-react';

import type {
  DashboardDriverDuty,
  DriverDashboardData,
} from '../../types/dashboard';

import DashboardCard
  from './DashboardCard';

import ProgressCard
  from './ProgressCard';

/**
 * חוזה הנתונים DriverDashboardProps: כוננים / לוח בקרה / מאפייני הרכיב.
 */
interface DriverDashboardProps {
  // data — נתונים.
  data:
    DriverDashboardData;
}

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
      weekday:
        'long',

      day:
        'numeric',

      month:
        'long',
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

      hour12:
        false,
    },
  ).format(
    date,
  );
}

/**
 * פעולה getDispatcherName: שליפה או חישוב של מוקדנים / שם.
 * @param displayName — שם תצוגה.
 * @param scheduleName — שיבוץ / שם.
 * @returns string — הפלט בהתאם לחתימה.
 */
function getDispatcherName(
  displayName:
    string | null,

  scheduleName:
    string | null,
): string {
  return (
    scheduleName?.trim() ||
    displayName?.trim() ||
    'לא שובץ'
  );
}

/**
 * פעולה DutyContent: הנתון DutyContent בהקשר הפעולה.
 * פרמטר מפורק — שדות הקלט נגישים מקומית בשמות המוגדרים בחתימה.
 */
function DutyContent({
  duty,
}: {
  duty:
    DashboardDriverDuty;
}) {
  return (
    <div className="dashboard-duty-content">
      <strong className="dashboard-assignment-main">
        {formatDate(
          duty.dutyDate,
        )}
      </strong>

      {duty.notes ? (
        <p>
          {duty.notes}
        </p>
      ) : null}

      <div className="dashboard-duty-shifts">
        <div className="dashboard-duty-shifts-heading">
          <Users
            size={17}
            aria-hidden="true"
          />

          <strong>
            מוקדנים לאורך היום
          </strong>
        </div>

        {duty.dispatcherShifts.length >
        0 ? (
          duty.dispatcherShifts.map(
            (
              shift,
            ) => (
              <div
                key={
                  shift.id
                }
                className="dashboard-duty-shift-row"
              >
                <span dir="ltr">
                  {formatTime(
                    shift.startsAt,
                  )}
                  {'–'}
                  {formatTime(
                    shift.endsAt,
                  )}
                </span>

                <strong>
                  {getDispatcherName(
                    shift.displayName,
                    shift.scheduleName,
                  )}
                </strong>
              </div>
            ),
          )
        ) : (
          <span className="dashboard-empty-text">
            לא נמצאו משמרות מוקדנים.
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * פעולה DriverDashboard: כוננים / לוח בקרה.
 * פרמטר מפורק — שדות הקלט נגישים מקומית בשמות המוגדרים בחתימה.
 */
function DriverDashboard({
  data,
}: DriverDashboardProps) {
  return (
    <div className="dashboard-grid">
      {data.currentDuty ? (
        <DashboardCard
          title="הכוננות הנוכחית"
          icon={
            <Radio
              size={20}
              aria-hidden="true"
            />
          }
          badge={
            <span className="dashboard-status-badge dashboard-status-active">
              פעילה היום
            </span>
          }
        >
          <DutyContent
            duty={
              data.currentDuty
            }
          />
        </DashboardCard>
      ) : null}

      <DashboardCard
        title="הכוננות הבאה"
        icon={
          <CalendarClock
            size={20}
            aria-hidden="true"
          />
        }
      >
        {data.nextDuty ? (
          <DutyContent
            duty={
              data.nextDuty
            }
          />
        ) : (
          <p className="dashboard-empty-text">
            לא נמצאה כוננות עתידית.
          </p>
        )}
      </DashboardCard>

      <ProgressCard
        title="התקדמות חודשית"
        completed={
          data.monthlyProgress
            .completed
        }
        total={
          data.monthlyProgress
            .total
        }
        percentage={
          data.monthlyProgress
            .percentage
        }
        unitLabel="כוננויות"
      />
    </div>
  );
}

export default DriverDashboard;