import {
  CalendarDays,
  CheckCircle2,
  CircleAlert,
  ClipboardCheck,
  RefreshCw,
  Users,
  XCircle,
} from 'lucide-react';

import {
  useMemo,
} from 'react';

import {
  Button,
} from '../ui';

import type {
  DriverAvailabilityEntry,
  DriverAvailabilityManagementData,
  DriverAvailabilityManagerDriver,
  DriverAvailabilityStatus,
  DriverAvailabilitySubmission,
} from '../../types/driverAvailability';

interface DriverAvailabilityManagementPanelProps {
  data:
    DriverAvailabilityManagementData | null;

  isLoading: boolean;

  error:
    string | null;

  onRefresh:
    () => void;
}

interface DriverSubmissionView {
  driver:
    DriverAvailabilityManagerDriver;

  submission:
    DriverAvailabilitySubmission | null;
}

const hebrewMonths = [
  'ינואר',
  'פברואר',
  'מרץ',
  'אפריל',
  'מאי',
  'יוני',
  'יולי',
  'אוגוסט',
  'ספטמבר',
  'אוקטובר',
  'נובמבר',
  'דצמבר',
];

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
      day: '2-digit',
      month: '2-digit',
    },
  ).format(date);
}

function formatDateTime(
  value:
    string | null,
): string {
  if (!value) {
    return 'לא הוגדר';
  }

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
      dateStyle: 'short',
      timeStyle: 'short',
    },
  ).format(date);
}

function getSubmissionLabel(
  submission:
    DriverAvailabilitySubmission | null,
): string {
  if (!submission) {
    return 'טרם התחיל';
  }

  switch (submission.status) {
    case 'submitted':
      return 'הוגש';

    case 'reopened':
      return 'נפתח מחדש';

    default:
      return 'טיוטה';
  }
}

function getAvailabilityLabel(
  status:
    DriverAvailabilityStatus | null,
): string {
  switch (status) {
    case 'available':
      return 'זמין';

    case 'unavailable':
      return 'לא זמין';

    default:
      return 'טרם סומן';
  }
}

function DriverAvailabilityManagementPanel({
  data,
  isLoading,
  error,
  onRefresh,
}: DriverAvailabilityManagementPanelProps) {
  const submissionsByUserId =
    useMemo(
      () =>
        new Map<
          string,
          DriverAvailabilitySubmission
        >(
          data?.submissions.map(
            (submission) => [
              submission.userId,
              submission,
            ],
          ) ?? [],
        ),
      [
        data,
      ],
    );

  const entriesByDayAndUser =
    useMemo(
      () => {
        const entriesMap =
          new Map<
            string,
            DriverAvailabilityEntry
          >();

        for (
          const entry
          of data?.entries ?? []
        ) {
          entriesMap.set(
            `${entry.dayId}:${entry.userId}`,
            entry,
          );
        }

        return entriesMap;
      },
      [
        data,
      ],
    );

  const submissionViews =
    useMemo<
      DriverSubmissionView[]
    >(
      () =>
        (
          data?.drivers ??
          []
        ).map(
          (driver) => ({
            driver,

            submission:
              submissionsByUserId.get(
                driver.id,
              ) ??
              null,
          }),
        ),
      [
        data,
        submissionsByUserId,
      ],
    );

  if (isLoading) {
    return (
      <section className="driver-availability-management-panel">
        <div className="driver-availability-management-loading">
          <RefreshCw
            size={30}
            className="driver-availability-management-loading-icon"
            aria-hidden="true"
          />

          <strong>
            טוען נתוני אילוצי כוננים
          </strong>

          <span>
            נא להמתין בזמן טעינת
            ההגשות ומטריצת הזמינות.
          </span>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="driver-availability-management-panel">
        <div
          className="driver-availability-management-error"
          role="alert"
        >
          <CircleAlert
            size={30}
            aria-hidden="true"
          />

          <strong>
            לא ניתן היה לטעון
            את נתוני הניהול
          </strong>

          <span>
            {error}
          </span>

          <Button
            type="button"
            onClick={
              onRefresh
            }
          >
            <RefreshCw
              size={17}
              aria-hidden="true"
            />

            ניסיון נוסף
          </Button>
        </div>
      </section>
    );
  }

  if (!data) {
    return (
      <section className="driver-availability-management-panel">
        <div className="driver-availability-management-empty">
          <CalendarDays
            size={34}
            aria-hidden="true"
          />

          <strong>
            לא נבחר חודש לניהול
          </strong>

          <span>
            בחר חודש אילוצים מתוך
            רשימת התקופות כדי להציג
            את ההגשות והמטריצה.
          </span>
        </div>
      </section>
    );
  }

  const periodTitle =
    data.period.title ??
    `${
      hebrewMonths[
        data.period.month - 1
      ]
    } ${data.period.year}`;

  return (
    <section className="driver-availability-management-panel">
      <header className="driver-availability-management-header">
        <div className="driver-availability-management-heading">
          <span className="driver-availability-management-heading-icon">
            <ClipboardCheck
              size={23}
              aria-hidden="true"
            />
          </span>

          <div>
            <span>
              מעקב אילוצי כוננים
            </span>

            <h2>
              {periodTitle}
            </h2>

            <p>
              סטטוס הגשות ומטריצת
              זמינות יומית.
            </p>
          </div>
        </div>

        <Button
          type="button"
          variant="secondary"
          onClick={
            onRefresh
          }
        >
          <RefreshCw
            size={17}
            aria-hidden="true"
          />

          רענון
        </Button>
      </header>

      <div className="driver-availability-management-period-info">
        <span>
          סטטוס חודש:
        </span>

        <strong>
          {data.period.status}
        </strong>

        <span>
          מועד אחרון:
        </span>

        <strong>
          {formatDateTime(
            data.period
              .submissionDeadline,
          )}
        </strong>
      </div>

      <div className="driver-availability-management-statistics">
        <article>
          <Users
            size={22}
            aria-hidden="true"
          />

          <div>
            <strong>
              {
                data.statistics
                  .totalDrivers
              }
            </strong>

            <span>
              כוננים פעילים
            </span>
          </div>
        </article>

        <article>
          <CheckCircle2
            size={22}
            aria-hidden="true"
          />

          <div>
            <strong>
              {
                data.statistics
                  .submittedDrivers
              }
            </strong>

            <span>
              הגישו
            </span>
          </div>
        </article>

        <article>
          <ClipboardCheck
            size={22}
            aria-hidden="true"
          />

          <div>
            <strong>
              {
                data.statistics
                  .draftDrivers
              }
            </strong>

            <span>
              בטיוטה
            </span>
          </div>
        </article>

        <article>
          <CircleAlert
            size={22}
            aria-hidden="true"
          />

          <div>
            <strong>
              {
                data.statistics
                  .notStartedDrivers
              }
            </strong>

            <span>
              טרם התחילו
            </span>
          </div>
        </article>
      </div>

      <section className="driver-availability-submissions-section">
        <header>
          <h3>
            סטטוס הגשות
          </h3>

          <span>
            מצב ההגשה של כל כונן
          </span>
        </header>

        <div className="driver-availability-submissions-table-wrapper">
          <table className="driver-availability-submissions-table">
            <thead>
              <tr>
                <th>
                  כונן
                </th>

                <th>
                  סטטוס
                </th>

                <th>
                  זמין
                </th>

                <th>
                  לא זמין
                </th>

                <th>
                  נשמר לאחרונה
                </th>

                <th>
                  הוגש בתאריך
                </th>
              </tr>
            </thead>

            <tbody>
              {submissionViews.map(
                ({
                  driver,
                  submission,
                }) => (
                  <tr
                    key={
                      driver.id
                    }
                  >
                    <td>
                      <strong>
                        {
                          driver
                            .scheduleName ??
                          driver
                            .displayName
                        }
                      </strong>

                      <span>
                        {driver.email}
                      </span>
                    </td>

                    <td>
                      <span
                        className={[
                          'driver-availability-submission-badge',

                          submission
                            ? `driver-availability-submission-badge-${submission.status}`
                            : 'driver-availability-submission-badge-not-started',
                        ].join(' ')}
                      >
                        {getSubmissionLabel(
                          submission,
                        )}
                      </span>
                    </td>

                    <td>
                      {
                        submission
                          ?.availableCount ??
                        0
                      }
                    </td>

                    <td>
                      {
                        submission
                          ?.unavailableCount ??
                        0
                      }
                    </td>

                    <td>
                      {formatDateTime(
                        submission
                          ?.lastSavedAt ??
                          null,
                      )}
                    </td>

                    <td>
                      {formatDateTime(
                        submission
                          ?.submittedAt ??
                          null,
                      )}
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="driver-availability-matrix-section">
        <header>
          <h3>
            מטריצת זמינות
          </h3>

          <span>
            ירוק – זמין, אדום – לא
            זמין, אפור – טרם סומן
          </span>
        </header>

        <div className="driver-availability-matrix-wrapper">
          <table className="driver-availability-matrix">
            <thead>
              <tr>
                <th className="driver-availability-matrix-date-column">
                  תאריך
                </th>

                {data.drivers.map(
                  (driver) => (
                    <th
                      key={
                        driver.id
                      }
                    >
                      {
                        driver
                          .scheduleName ??
                        driver
                          .displayName
                      }
                    </th>
                  ),
                )}
              </tr>
            </thead>

            <tbody>
              {data.days.map(
                (day) => (
                  <tr
                    key={
                      day.id
                    }
                  >
                    <th className="driver-availability-matrix-date-column">
                      <strong>
                        {
                          day
                            .weekdayName
                        }
                      </strong>

                      <span>
                        {formatDate(
                          day
                            .availabilityDate,
                        )}
                      </span>
                    </th>

                    {data.drivers.map(
                      (driver) => {
                        const entry =
                          entriesByDayAndUser.get(
                            `${day.id}:${driver.id}`,
                          );

                        const status =
                          entry
                            ?.availabilityStatus ??
                          null;

                        return (
                          <td
                            key={
                              driver.id
                            }
                          >
                            <span
                              className={[
                                'driver-availability-matrix-cell',

                                status
                                  ? `driver-availability-matrix-cell-${status}`
                                  : 'driver-availability-matrix-cell-unmarked',
                              ].join(' ')}
                              title={
                                entry?.note ??
                                getAvailabilityLabel(
                                  status,
                                )
                              }
                            >
                              {status ===
                              'available' ? (
                                <CheckCircle2
                                  size={18}
                                  aria-hidden="true"
                                />
                              ) : status ===
                                'unavailable' ? (
                                <XCircle
                                  size={18}
                                  aria-hidden="true"
                                />
                              ) : (
                                <CircleAlert
                                  size={18}
                                  aria-hidden="true"
                                />
                              )}

                              <span>
                                {getAvailabilityLabel(
                                  status,
                                )}
                              </span>
                            </span>
                          </td>
                        );
                      },
                    )}
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}

export default DriverAvailabilityManagementPanel;