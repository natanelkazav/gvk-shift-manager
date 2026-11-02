/**
 * קובץ: src/components/driverAvailability/DriverAvailabilityManagementPanel.tsx
 * מטרה: מימוש רכיב תצוגה ואינטראקציה עבור כוננים / אילוצים וזמינות.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: DriverAvailabilityManagementPanelProps, DriverSubmissionView, formatDate, formatDateTime, getSubmissionLabel, getAvailabilityLabel, DriverAvailabilityManagementPanel.
 * - קישור מאפיינים ומצב מקומי לתצוגה ולטיפול בפעולות המשתמש.
 */
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

import AvailabilityManagementHeader
  from '../availability/AvailabilityManagementHeader';

import AvailabilityManagementStats
  from '../availability/AvailabilityManagementStats';

import AvailabilityManagementActionBar
  from '../availability/AvailabilityManagementActionBar';

import type {
  DriverAvailabilityEntry,
  DriverAvailabilityManagementData,
  DriverAvailabilityManagerDriver,
  DriverAvailabilityStatus,
  DriverAvailabilitySubmission,
} from '../../types/driverAvailability';

/**
 * חוזה הנתונים DriverAvailabilityManagementPanelProps: כוננים / אילוצים וזמינות / מאפייני הרכיב.
 */
interface DriverAvailabilityManagementPanelProps {
  // data — נתונים.
  data:
    DriverAvailabilityManagementData | null;

  // isLoading — האם טעינה מתבצעת.
  isLoading: boolean;

  // error — שגיאה.
  error:
    string | null;

  onRefresh:
    () => void;

  // onOpenPeriod — תקופה.
  onOpenPeriod:
    () => void;

  // onClosePeriod — פונקציית סגירת התצוגה.
  onClosePeriod:
    () => void;

  // onReopenPeriod — תקופה.
  onReopenPeriod:
    () => void;

  // onDeletePeriod — תקופה.
  onDeletePeriod:
    () => void;

  // onPrepareSchedule — שיבוץ.
  onPrepareSchedule:
    () => void;

  // onGoToSchedule — שיבוץ.
  onGoToSchedule:
    () => void;
}

/**
 * חוזה הנתונים DriverSubmissionView: כוננים.
 */
interface DriverSubmissionView {
  // driver — כוננים.
  driver:
    DriverAvailabilityManagerDriver;

  submission:
    DriverAvailabilitySubmission | null;
}

// hebrewMonths — חודשים.
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
      day: '2-digit',
      month: '2-digit',
    },
  ).format(date);
}

/**
 * פעולה formatDateTime: עיצוב ערך לתצוגה עבור תאריך / זמן.
 * @param value — ערך.
 * @returns string — הפלט בהתאם לחתימה.
 */
function formatDateTime(
  value:
    string | null,
): string {
  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !value.
  if (!value) {
    return 'לא הוגדר';
  }

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
      dateStyle: 'short',
      timeStyle: 'short',
    },
  ).format(date);
}

/**
 * פעולה getSubmissionLabel: שליפה או חישוב של תווית.
 * @param submission — הנתון submission בהקשר הפעולה.
 * @returns string — הפלט בהתאם לחתימה.
 */
function getSubmissionLabel(
  submission:
    DriverAvailabilitySubmission | null,
): string {
  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !submission.
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

/**
 * פעולה getAvailabilityLabel: שליפה או חישוב של אילוצים וזמינות / תווית.
 * @param status — סטטוס.
 * @returns string — הפלט בהתאם לחתימה.
 */
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

/**
 * פעולה DriverAvailabilityManagementPanel: כוננים / אילוצים וזמינות.
 * פרמטר מפורק — שדות הקלט נגישים מקומית בשמות המוגדרים בחתימה.
 */
function DriverAvailabilityManagementPanel({
  data,
  isLoading,
  error,
  onRefresh,
  onOpenPeriod,
  onClosePeriod,
  onReopenPeriod,
  onDeletePeriod,
  onPrepareSchedule,
  onGoToSchedule,
}: DriverAvailabilityManagementPanelProps) {
  // ערך מחושב submissionsByUserId — מזהה משתמש; נשמר בין רינדורים עד שינוי התלויות.
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

  // ערך מחושב entriesByDayAndUser — רשומות / יום / משתמש; נשמר בין רינדורים עד שינוי התלויות.
  const entriesByDayAndUser =
    useMemo(
      () => {
        // entriesMap — רשומות / מפת התאמה; מיפוי לחיפוש לפי מפתח.
        const entriesMap =
          new Map<
            string,
            DriverAvailabilityEntry
          >();

        // עיבוד כל פריט מתוך data?.entries ?? [] בנפרד.
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

  // ערך מחושב submissionViews — הנתון submissionViews בהקשר הפעולה; נשמר בין רינדורים עד שינוי התלויות.
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

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר isLoading.
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

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר error.
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

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !data.
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

  // periodTitle — תקופה / כותרת.
  const periodTitle =
    data.period.title ??
    `${
      hebrewMonths[
        data.period.month - 1
      ]
    } ${data.period.year}`;

  return (
    <section className="driver-availability-management-panel">
      <AvailabilityManagementHeader
        category="driver"
        categoryLabel="כוננים"
        title={
          periodTitle
        }
        description="מעקב אחר סטטוס ההגשות, זמינות יומית ומוכנות ליצירת לוח הכוננויות."
        periodId={
          data.period.id
        }
        periodStatus={
          data.period.status
        }
        submissionDeadline={
          data.period.submissionDeadline
        }
        isBusy={
          isLoading
        }
        error={error}
        onRefresh={
          onRefresh
        }
      />

      <AvailabilityManagementActionBar
        status={data.period.status}
        isBusy={isLoading}
        onOpen={
          data.period.status === 'draft'
            ? onOpenPeriod
            : null
        }
        onClose={
          data.period.status === 'open'
            ? onClosePeriod
            : null
        }
        onReopen={
          data.period.status === 'closed'
            ? onReopenPeriod
            : null
        }
        onDelete={onDeletePeriod}
        onPrepareSchedule={
          data.period.status === 'closed'
            ? onPrepareSchedule
            : null
        }
        onGoToSchedule={onGoToSchedule}
      />

      <AvailabilityManagementStats
        items={[
          {
            label:
              'כוננים פעילים',
            value:
              data.statistics.totalDrivers,
            icon:
              Users,
          },
          {
            label:
              'הגישו',
            value:
              data.statistics.submittedDrivers,
            icon:
              CheckCircle2,
          },
          {
            label:
              'בטיוטה',
            value:
              data.statistics.draftDrivers,
            icon:
              ClipboardCheck,
          },
          {
            label:
              'לא התחילו',
            value:
              data.statistics.notStartedDrivers,
            icon:
              CircleAlert,
          },
        ]}
      />

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
                        // entry — רשומה.
                        const entry =
                          entriesByDayAndUser.get(
                            `${day.id}:${driver.id}`,
                          );

                        // status — סטטוס.
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