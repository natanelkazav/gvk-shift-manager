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

interface DriverDashboardProps {
  data:
    DriverDashboardData;
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