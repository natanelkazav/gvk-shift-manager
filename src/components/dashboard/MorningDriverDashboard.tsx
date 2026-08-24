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

interface MorningDriverDashboardProps {
  data:
    MorningDriverDashboardData;
}

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
      day: 'numeric',
      month: 'long',
    },
  ).format(
    date,
  );
}

function formatTime(
  value: string,
): string {
  return value.slice(0, 5);
}

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

function ShiftContent({
  shift,
}: {
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
