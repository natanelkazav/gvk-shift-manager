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

interface DispatcherDashboardProps {
  data:
    DispatcherDashboardData;
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

function DispatcherDashboard({
  data,
}: DispatcherDashboardProps) {
  const currentShift =
    data.currentShift;

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