import {
  CheckCircle2,
  CircleAlert,
  Clock3,
  LoaderCircle,
  Lock,
  RefreshCw,
  RotateCcw,
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
  MorningDriverAvailabilityManagementData,
  MorningDriverAvailabilityStatus,
} from '../../types/morningDriverAvailability';

interface MorningDriverAvailabilityManagementPanelProps {
  data:
    MorningDriverAvailabilityManagementData | null;

  isLoading: boolean;

  reopeningUserId:
    string | null;

  isClosing: boolean;

  error:
    string | null;

  onRefresh:
    () => void;

  onReopenSubmission: (
    userId: string,
  ) => void;

  onClosePeriod: (
    force: boolean,
  ) => void;
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
      day: '2-digit',
      month: '2-digit',
    },
  ).format(
    date,
  );
}

function formatTime(
  value: string,
): string {
  return value.slice(
    0,
    5,
  );
}

function formatDateTime(
  value:
    string | null,
): string {
  if (!value) {
    return 'לא הוגדר';
  }

  const date =
    new Date(
      value,
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
      dateStyle:
        'short',

      timeStyle:
        'short',
    },
  ).format(
    date,
  );
}

function getAvailabilityLabel(
  status:
    MorningDriverAvailabilityStatus | null,
): string {
  if (
    status ===
    'available'
  ) {
    return 'זמין';
  }

  if (
    status ===
    'unavailable'
  ) {
    return 'לא זמין';
  }

  return 'טרם סומן';
}

function MorningDriverAvailabilityManagementPanel({
  data,
  isLoading,
  reopeningUserId,
  isClosing,
  error,
  onRefresh,
  onReopenSubmission,
  onClosePeriod,
}: MorningDriverAvailabilityManagementPanelProps) {
  const submissionsByUserId =
    useMemo(
      () =>
        new Map(
          data?.submissions
            .map(
              (
                submission,
              ) => [
                submission.userId,
                submission,
              ] as const,
            ) ??
            [],
        ),
      [
        data,
      ],
    );

  const entriesByShiftAndUser =
    useMemo(
      () => {
        const entriesMap =
          new Map<
            string,
            MorningDriverAvailabilityStatus
          >();

        for (
          const entry
          of data?.entries ??
          []
        ) {
          entriesMap.set(
            `${entry.shiftId}:${entry.userId}`,
            entry.availabilityStatus,
          );
        }

        return entriesMap;
      },
      [
        data,
      ],
    );

  if (
    isLoading
  ) {
    return (
      <section className="morning-driver-management-panel">
        <div className="morning-driver-management-state">
          <LoaderCircle
            size={32}
            className="morning-driver-spin"
            aria-hidden="true"
          />

          <strong>
            טוען נתוני הגשות
          </strong>
        </div>
      </section>
    );
  }

  if (
    error &&
    !data
  ) {
    return (
      <section className="morning-driver-management-panel">
        <div
          className="morning-driver-management-state morning-driver-management-state-error"
          role="alert"
        >
          <CircleAlert
            size={32}
            aria-hidden="true"
          />

          <strong>
            לא ניתן היה לטעון את נתוני הניהול
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
            ניסיון נוסף
          </Button>
        </div>
      </section>
    );
  }

  if (
    !data
  ) {
    return null;
  }

  const canCloseNormally =
    data.statistics
      .totalDrivers >
      0 &&
    data.statistics
      .submittedDrivers ===
      data.statistics
        .totalDrivers;

  return (
    <section className="morning-driver-management-panel">
      <header className="morning-driver-management-header">
        <div>
          <span>
            מעקב מנהל
          </span>

          <h2>
            {data.period.title ??
              `${data.period.month}/${data.period.year}`}
          </h2>

          <p>
            סטטוס הגשות ומטריצת זמינות לפי משמרת.
          </p>
        </div>

        <div className="morning-driver-management-header-actions">
          <Button
            type="button"
            variant="secondary"
            disabled={
              isLoading
            }
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

          {data.period.status ===
          'open' ? (
            <Button
              type="button"
              disabled={
                isClosing
              }
              onClick={() => {
                if (
                  canCloseNormally
                ) {
                  const confirmed =
                    window.confirm(
                      'לסגור את חודש אילוצי כונני הבוקר?\n\nלאחר הסגירה לא ניתן יהיה לערוך הגשות.',
                    );

                  if (
                    confirmed
                  ) {
                    onClosePeriod(
                      false,
                    );
                  }

                  return;
                }

                const confirmed =
                  window.confirm(
                    `עדיין חסרות ${
                      data.statistics.totalDrivers -
                      data.statistics.submittedDrivers
                    } הגשות.\n\nלסגור את החודש בכוח?`,
                  );

                if (
                  confirmed
                ) {
                  onClosePeriod(
                    true,
                  );
                }
              }}
            >
              <Lock
                size={17}
                aria-hidden="true"
              />

              {isClosing
                ? 'סוגר...'
                : canCloseNormally
                  ? 'סגירת חודש'
                  : 'סגירה כפויה'}
            </Button>
          ) : null}
        </div>
      </header>

      {error ? (
        <div
          className="morning-driver-management-error"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      <div className="morning-driver-management-statistics">
        <article>
          <Users
            size={21}
            aria-hidden="true"
          />

          <strong>
            {data.statistics.totalDrivers}
          </strong>

          <span>
            כונני בוקר
          </span>
        </article>

        <article>
          <CheckCircle2
            size={21}
            aria-hidden="true"
          />

          <strong>
            {data.statistics.submittedDrivers}
          </strong>

          <span>
            הגישו
          </span>
        </article>

        <article>
          <Clock3
            size={21}
            aria-hidden="true"
          />

          <strong>
            {data.statistics.draftDrivers}
          </strong>

          <span>
            בטיוטה
          </span>
        </article>

        <article>
          <RotateCcw
            size={21}
            aria-hidden="true"
          />

          <strong>
            {data.statistics.reopenedDrivers}
          </strong>

          <span>
            נפתחו מחדש
          </span>
        </article>
      </div>

      <section className="morning-driver-management-submissions">
        <header>
          <h3>
            סטטוס הגשות
          </h3>
        </header>

        <div className="morning-driver-management-table-wrapper">
          <table className="morning-driver-management-table">
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
                  טרם סומן
                </th>

                <th>
                  נשמר לאחרונה
                </th>

                <th>
                  פעולה
                </th>
              </tr>
            </thead>

            <tbody>
              {data.drivers.map(
                (
                  driver,
                ) => {
                  const submission =
                    submissionsByUserId.get(
                      driver.id,
                    );

                  return (
                    <tr
                      key={
                        driver.id
                      }
                    >
                      <td>
                        <strong>
                          {driver.scheduleName ??
                            driver.displayName}
                        </strong>

                        <span>
                          {driver.email}
                        </span>
                      </td>

                      <td>
                        {submission?.status ??
                          'טרם התחיל'}
                      </td>

                      <td>
                        {submission?.availableCount ??
                          0}
                      </td>

                      <td>
                        {submission?.unavailableCount ??
                          0}
                      </td>

                      <td>
                        {submission?.unmarkedCount ??
                          data.shifts.length}
                      </td>

                      <td>
                        {formatDateTime(
                          submission?.lastSavedAt ??
                            null,
                        )}
                      </td>

                      <td>
                        {submission?.status ===
                        'submitted' &&
                        data.period.status ===
                          'open' ? (
                          <Button
                            type="button"
                            variant="secondary"
                            disabled={
                              reopeningUserId !==
                              null
                            }
                            onClick={() => {
                              const confirmed =
                                window.confirm(
                                  `לפתוח מחדש את ההגשה של ${
                                    driver.scheduleName ??
                                    driver.displayName
                                  }?`,
                                );

                              if (
                                confirmed
                              ) {
                                onReopenSubmission(
                                  driver.id,
                                );
                              }
                            }}
                          >
                            <RotateCcw
                              size={16}
                              aria-hidden="true"
                            />

                            {reopeningUserId ===
                            driver.id
                              ? 'פותח...'
                              : 'פתיחה מחדש'}
                          </Button>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  );
                },
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="morning-driver-management-matrix">
        <header>
          <h3>
            מטריצת זמינות
          </h3>

          <span>
            ירוק – זמין, אדום – לא זמין, אפור – טרם סומן
          </span>
        </header>

        <div className="morning-driver-management-table-wrapper">
          <table className="morning-driver-management-table morning-driver-management-matrix-table">
            <thead>
              <tr>
                <th>
                  משמרת
                </th>

                {data.drivers.map(
                  (
                    driver,
                  ) => (
                    <th
                      key={
                        driver.id
                      }
                    >
                      {driver.scheduleName ??
                        driver.displayName}
                    </th>
                  ),
                )}
              </tr>
            </thead>

            <tbody>
              {data.shifts.map(
                (
                  shift,
                ) => (
                  <tr
                    key={
                      shift.id
                    }
                  >
                    <th>
                      <strong>
                        {shift.weekdayName}{' '}
                        {formatDate(
                          shift.shiftDate,
                        )}
                      </strong>

                      <span>
                        <bdi dir="ltr">
                          {formatTime(
                            shift.startTime,
                          )}
                          {' – '}
                          {formatTime(
                            shift.endTime,
                          )}
                        </bdi>
                        {' · '}
                        {shift.recommendedWorkers >
                        shift.minimumWorkers
                          ? `מומלץ ${shift.recommendedWorkers}, מינימום ${shift.minimumWorkers}`
                          : `נדרש ${shift.minimumWorkers}`}
                      </span>
                    </th>

                    {data.drivers.map(
                      (
                        driver,
                      ) => {
                        const status =
                          entriesByShiftAndUser.get(
                            `${shift.id}:${driver.id}`,
                          ) ??
                          null;

                        return (
                          <td
                            key={
                              driver.id
                            }
                          >
                            <span
                              className={[
                                'morning-driver-management-matrix-cell',

                                status
                                  ? `morning-driver-management-matrix-cell-${status}`
                                  : 'morning-driver-management-matrix-cell-unmarked',
                              ].join(
                                ' ',
                              )}
                            >
                              {status ===
                              'available' ? (
                                <CheckCircle2
                                  size={17}
                                  aria-hidden="true"
                                />
                              ) : status ===
                                'unavailable' ? (
                                <XCircle
                                  size={17}
                                  aria-hidden="true"
                                />
                              ) : (
                                <CircleAlert
                                  size={17}
                                  aria-hidden="true"
                                />
                              )}

                              {getAvailabilityLabel(
                                status,
                              )}
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

export default MorningDriverAvailabilityManagementPanel;
