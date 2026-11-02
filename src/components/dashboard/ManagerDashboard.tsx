/**
 * קובץ: src/components/dashboard/ManagerDashboard.tsx
 * מטרה: מימוש רכיב תצוגה ואינטראקציה עבור לוח בקרה.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: ManagerDashboardProps, formatTime, getDisplayName, ManagerDashboard.
 * - קישור מאפיינים ומצב מקומי לתצוגה ולטיפול בפעולות המשתמש.
 */
import {
  CalendarCheck2,
  Headphones,
  ShieldCheck,
  Wrench,
} from 'lucide-react';

import type {
  ManagerDashboardData,
} from '../../types/dashboard';

import DashboardCard
  from './DashboardCard';

import ProgressCard
  from './ProgressCard';

/**
 * חוזה הנתונים ManagerDashboardProps: לוח בקרה / מאפייני הרכיב.
 */
interface ManagerDashboardProps {
  // data — נתונים.
  data:
    ManagerDashboardData;
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
 * פעולה ManagerDashboard: לוח בקרה.
 * פרמטר מפורק — שדות הקלט נגישים מקומית בשמות המוגדרים בחתימה.
 */
function ManagerDashboard({
  data,
}: ManagerDashboardProps) {
  // dispatcherSummary — מוקדנים / סיכום.
  const dispatcherSummary =
    data.monthlySummary
      .dispatcherShifts;

  // driverSummary — כוננים / סיכום.
  const driverSummary =
    data.monthlySummary
      .driverDuties;

  return (
    <div className="dashboard-grid">
      <DashboardCard
        title="מוקדן פעיל כרגע"
        icon={
          <Headphones
            size={20}
            aria-hidden="true"
          />
        }
        badge={
          data.currentDispatcher ? (
            <span className="dashboard-status-badge dashboard-status-active">
              פעיל
            </span>
          ) : (
            <span className="dashboard-status-badge dashboard-status-idle">
              אין משמרת פעילה
            </span>
          )
        }
      >
        {data.currentDispatcher ? (
          <div className="dashboard-assignment-details">
            <strong className="dashboard-assignment-main">
              {getDisplayName(
                data.currentDispatcher
                  .displayName,
                data.currentDispatcher
                  .scheduleName,
              )}
            </strong>

            <span dir="ltr">
              {formatTime(
                data.currentDispatcher
                  .startsAt,
              )}
              {'–'}
              {formatTime(
                data.currentDispatcher
                  .endsAt,
              )}
            </span>
          </div>
        ) : (
          <p className="dashboard-empty-text">
            לא נמצאה משמרת מוקדן
            פעילה כרגע.
          </p>
        )}
      </DashboardCard>

      <DashboardCard
        title="כונן פעיל כרגע"
        icon={
          <Wrench
            size={20}
            aria-hidden="true"
          />
        }
        badge={
          data.currentDriver ? (
            <span className="dashboard-status-badge dashboard-status-active">
              בכוננות
            </span>
          ) : (
            <span className="dashboard-status-badge dashboard-status-idle">
              לא נמצא
            </span>
          )
        }
      >
        {data.currentDriver ? (
          <div className="dashboard-assignment-details">
            <strong className="dashboard-assignment-main">
              {getDisplayName(
                data.currentDriver
                  .displayName,
                data.currentDriver
                  .scheduleName,
              )}
            </strong>

            <span>
              כונן טכני להיום
            </span>
          </div>
        ) : (
          <p className="dashboard-empty-text">
            לא נמצא כונן פעיל להיום.
          </p>
        )}
      </DashboardCard>

      <ProgressCard
        title="התקדמות משמרות מוקדנים"
        completed={
          dispatcherSummary.completed
        }
        total={
          dispatcherSummary.total
        }
        percentage={
          dispatcherSummary.percentage
        }
        unitLabel="משמרות"
      />

      <ProgressCard
        title="התקדמות כוננויות"
        completed={
          driverSummary.completed
        }
        total={
          driverSummary.total
        }
        percentage={
          driverSummary.percentage
        }
        unitLabel="כוננויות"
      />

      <DashboardCard
        title="חריגים בשיבוץ"
        icon={
          <ShieldCheck
            size={20}
            aria-hidden="true"
          />
        }
      >
        <div className="dashboard-manager-summary">
          <div>
            <span>
              משמרות לא מאוישות
            </span>

            <strong>
              {
                dispatcherSummary
                  .unassigned
              }
            </strong>
          </div>

          <div>
            <span>
              כוננויות לא מאוישות
            </span>

            <strong>
              {
                driverSummary
                  .unassigned
              }
            </strong>
          </div>
        </div>
      </DashboardCard>

      <DashboardCard
        title="מצב החודש"
        icon={
          <CalendarCheck2
            size={20}
            aria-hidden="true"
          />
        }
      >
        <div className="dashboard-manager-summary">
          <div>
            <span>
              סך משמרות
            </span>

            <strong>
              {
                dispatcherSummary
                  .total
              }
            </strong>
          </div>

          <div>
            <span>
              סך כוננויות
            </span>

            <strong>
              {
                driverSummary
                  .total
              }
            </strong>
          </div>
        </div>
      </DashboardCard>
    </div>
  );
}

export default ManagerDashboard;