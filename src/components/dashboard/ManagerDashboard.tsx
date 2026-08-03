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

interface ManagerDashboardProps {
  data:
    ManagerDashboardData;
}

function formatTime(
  value: string,
): string {
  const date =
    new Date(value);

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

function ManagerDashboard({
  data,
}: ManagerDashboardProps) {
  const dispatcherSummary =
    data.monthlySummary
      .dispatcherShifts;

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