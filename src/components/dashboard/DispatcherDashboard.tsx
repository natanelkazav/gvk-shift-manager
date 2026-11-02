/**
 * קובץ: src/components/dashboard/DispatcherDashboard.tsx
 * מטרה: מימוש רכיב תצוגה ואינטראקציה עבור מוקדנים / לוח בקרה.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: DispatcherDashboardProps, formatDate, formatTime, getDisplayName, DispatcherDashboard.
 * - קישור מאפיינים ומצב מקומי לתצוגה ולטיפול בפעולות המשתמש.
 */
import {
  CalendarClock,
  Radio,
  UserRoundCog,
} from 'lucide-react';

import type {
  DispatcherDashboardData,
} from '../../types/dashboard';

import DashboardCard
  from './DashboardCard';

import ProgressCard
  from './ProgressCard';

/**
 * חוזה הנתונים DispatcherDashboardProps: מוקדנים / לוח בקרה / מאפייני הרכיב.
 */
interface DispatcherDashboardProps {
  // data — נתונים.
  data:
    DispatcherDashboardData;
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
 * פעולה getDisplayName: שליפה או חישוב של שם תצוגה.
 * @param displayName — שם תצוגה.
 * @param scheduleName — שיבוץ / שם.
 * @returns string — הפלט בהתאם לחתימה.
 */
function getDisplayName(
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
 * פעולה DispatcherDashboard: מוקדנים / לוח בקרה.
 * פרמטר מפורק — שדות הקלט נגישים מקומית בשמות המוגדרים בחתימה.
 */
function DispatcherDashboard({
  data,
}: DispatcherDashboardProps) {
  // currentShift — משמרת.
  const currentShift =
    data.currentShift;

  // nextShift — משמרת.
  const nextShift =
    data.nextShift;

  return (
    <div className="dashboard-grid">
      {currentShift ? (
        <DashboardCard
          title="המשמרת הנוכחית"
          icon={
            <Radio
              size={20}
              aria-hidden="true"
            />
          }
          badge={
            <span className="dashboard-status-badge dashboard-status-active">
              פעילה עכשיו
            </span>
          }
        >
          <div className="dashboard-assignment-details">
            <strong
              className="dashboard-assignment-main"
              dir="ltr"
            >
              {formatTime(
                currentShift.startsAt,
              )}
              {'–'}
              {formatTime(
                currentShift.endsAt,
              )}
            </strong>

            <span>
              {formatDate(
                currentShift.shiftDate,
              )}
            </span>

            <div className="dashboard-person-row">
              <UserRoundCog
                size={18}
                aria-hidden="true"
              />

              <div>
                <small>
                  כונן טכני
                </small>

                <strong>
                  {currentShift.driver
                    ? getDisplayName(
                        currentShift
                          .driver
                          .displayName,
                        currentShift
                          .driver
                          .scheduleName,
                      )
                    : 'לא שובץ'}
                </strong>
              </div>
            </div>
          </div>
        </DashboardCard>
      ) : null}

      <DashboardCard
        title="המשמרת הבאה"
        icon={
          <CalendarClock
            size={20}
            aria-hidden="true"
          />
        }
      >
        {nextShift ? (
          <div className="dashboard-assignment-details">
            <strong className="dashboard-assignment-main">
              {formatDate(
                nextShift.shiftDate,
              )}
            </strong>

            <span dir="ltr">
              {formatTime(
                nextShift.startsAt,
              )}
              {'–'}
              {formatTime(
                nextShift.endsAt,
              )}
            </span>

            <div className="dashboard-person-row">
              <UserRoundCog
                size={18}
                aria-hidden="true"
              />

              <div>
                <small>
                  כונן טכני
                </small>

                <strong>
                  {nextShift.driver
                    ? getDisplayName(
                        nextShift
                          .driver
                          .displayName,
                        nextShift
                          .driver
                          .scheduleName,
                      )
                    : 'לא שובץ'}
                </strong>
              </div>
            </div>
          </div>
        ) : (
          <p className="dashboard-empty-text">
            לא נמצאה משמרת עתידית.
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
        unitLabel="משמרות"
      />
    </div>
  );
}

export default DispatcherDashboard;