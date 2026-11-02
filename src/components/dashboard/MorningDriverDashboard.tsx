/**
 * קובץ: src/components/dashboard/MorningDriverDashboard.tsx
 * מטרה: מימוש רכיב תצוגה ואינטראקציה עבור כונני בוקר.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: MorningDriverDashboardProps, formatDate, formatTime, getPersonName, ShiftContent, MorningDriverDashboard.
 * - קישור מאפיינים ומצב מקומי לתצוגה ולטיפול בפעולות המשתמש.
 */
import {
  CalendarClock,
  Radio,
  Users,
} from 'lucide-react';

import type {
  DashboardMorningDriverShift,
  MorningDriverDashboardData,
} from '../../types/dashboard';

import DashboardCard
  from './DashboardCard';

import ProgressCard
  from './ProgressCard';

/**
 * חוזה הנתונים MorningDriverDashboardProps: כונני בוקר.
 */
interface MorningDriverDashboardProps {
  // data — נתונים.
  data:
    MorningDriverDashboardData;
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
      weekday: 'long',
      day: 'numeric',
      month: 'long',
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
  return value.slice(0, 5);
}

/**
 * פעולה getPersonName: שליפה או חישוב של שם.
 * @param displayName — שם תצוגה.
 * @param scheduleName — שיבוץ / שם.
 * @returns string — הפלט בהתאם לחתימה.
 */
function getPersonName(
  displayName:
    string | null,
  scheduleName:
    string | null,
): string {
  return (
    scheduleName?.trim() ||
    displayName?.trim() ||
    'ללא שם'
  );
}

/**
 * פעולה ShiftContent: משמרת.
 * פרמטר מפורק — שדות הקלט נגישים מקומית בשמות המוגדרים בחתימה.
 */
function ShiftContent({
  shift,
}: {
  // shift — משמרת.
  shift:
    DashboardMorningDriverShift;
}) {
  return (
    <div className="dashboard-duty-content">
      <strong className="dashboard-assignment-main">
        {formatDate(
          shift.shiftDate,
        )}
      </strong>

      <span dir="ltr">
        {formatTime(
          shift.startTime,
        )}
        {'–'}
        {formatTime(
          shift.endTime,
        )}
      </span>

      <div className="dashboard-morning-driver-partners">
        <div className="dashboard-duty-shifts-heading">
          <Users
            size={17}
            aria-hidden="true"
          />

          <strong>
            כוננים איתי במשמרת
          </strong>
        </div>

        {shift.parallelDrivers.length > 0 ? (
          <div className="dashboard-morning-driver-partner-list">
            {shift.parallelDrivers.map(
              (
                driver,
              ) => (
                <span
                  key={
                    driver.id
                  }
                  className="dashboard-morning-driver-partner"
                >
                  {getPersonName(
                    driver.displayName,
                    driver.scheduleName,
                  )}
                </span>
              ),
            )}
          </div>
        ) : (
          <span className="dashboard-empty-text">
            אין כונן נוסף משובץ במקביל.
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * פעולה MorningDriverDashboard: כונני בוקר.
 * פרמטר מפורק — שדות הקלט נגישים מקומית בשמות המוגדרים בחתימה.
 */
function MorningDriverDashboard({
  data,
}: MorningDriverDashboardProps) {
  return (
    <div className="dashboard-grid">
      {data.currentShift ? (
        <DashboardCard
          title="כוננות הבוקר הנוכחית"
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
          <ShiftContent
            shift={
              data.currentShift
            }
          />
        </DashboardCard>
      ) : null}

      <DashboardCard
        title="כוננות הבוקר הבאה שלי"
        icon={
          <CalendarClock
            size={20}
            aria-hidden="true"
          />
        }
      >
        {data.nextShift ? (
          <ShiftContent
            shift={
              data.nextShift
            }
          />
        ) : (
          <p className="dashboard-empty-text">
            לא נמצאה כוננות בוקר עתידית בלוח שפורסם.
          </p>
        )}
      </DashboardCard>

      <ProgressCard
        title="התקדמות כוננויות הבוקר החודש"
        completed={
          data.monthlyProgress.completed
        }
        total={
          data.monthlyProgress.total
        }
        percentage={
          data.monthlyProgress.percentage
        }
        unitLabel="כוננויות"
      />

      <DashboardCard
        title="סיכום החודש"
        icon={
          <Users
            size={20}
            aria-hidden="true"
          />
        }
      >
        <div className="dashboard-morning-driver-summary">
          <div>
            <strong>
              {data.monthlyProgress.total}
            </strong>
            <span>
              כוננויות משובצות
            </span>
          </div>

          <div>
            <strong>
              {Math.max(
                data.monthlyProgress.total -
                  data.monthlyProgress.completed,
                0,
              )}
            </strong>
            <span>
              נותרו החודש
            </span>
          </div>
        </div>
      </DashboardCard>
    </div>
  );
}

export default MorningDriverDashboard;
