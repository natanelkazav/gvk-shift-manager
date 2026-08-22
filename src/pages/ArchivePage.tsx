import {
  AlertTriangle,
  Archive,
  CalendarDays,
  CheckCircle2,
  FileSpreadsheet,
  RefreshCw,
  Sunrise,
  Users,
  Wrench,
} from 'lucide-react';

import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  PageHeader,
} from '../components/ui';

import {
  archiveService,
} from '../services/archiveService';

import type {
  ArchivePeriod,
} from '../types/archive';

import '../styles/archive.css';

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

function getPeriodTitle(
  period: ArchivePeriod,
): string {
  const monthName =
    hebrewMonths[
      period.month - 1
    ] ??
    String(period.month);

  return `${monthName} ${period.year}`;
}

function formatDateTime(
  value: string | null,
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
      dateStyle:
        'short',

      timeStyle:
        'short',
    },
  ).format(
    date,
  );
}

function ArchivePage() {
  const [
    periods,
    setPeriods,
  ] =
    useState<ArchivePeriod[]>(
      [],
    );

  const [
    isLoading,
    setIsLoading,
  ] =
    useState(true);

  const [
    error,
    setError,
  ] =
    useState<string | null>(
      null,
    );

  useEffect(
    () => {
      let isCancelled =
        false;

      async function loadInitialArchive():
        Promise<void> {
        try {
          const response =
            await archiveService
              .getPeriods();

          if (isCancelled) {
            return;
          }

          setPeriods(
            response.periods,
          );

          setError(
            null,
          );
        } catch (
          loadError
        ) {
          if (isCancelled) {
            return;
          }

          setError(
            loadError instanceof
              Error
              ? loadError.message
              : 'לא ניתן היה לטעון את הארכיון.',
          );
        } finally {
          if (
            !isCancelled
          ) {
            setIsLoading(
              false,
            );
          }
        }
      }

      void loadInitialArchive();

      return () => {
        isCancelled =
          true;
      };
    },
    [],
  );

  const handleRefresh =
    async (): Promise<void> => {
      if (isLoading) {
        return;
      }

      setIsLoading(
        true,
      );

      setError(
        null,
      );

      try {
        const response =
          await archiveService
            .getPeriods();

        setPeriods(
          response.periods,
        );
      } catch (
        loadError
      ) {
        setError(
          loadError instanceof
            Error
            ? loadError.message
            : 'לא ניתן היה לטעון את הארכיון.',
        );
      } finally {
        setIsLoading(
          false,
        );
      }
    };

  const years =
    useMemo(
      () =>
        Array.from(
          new Set(
            periods.map(
              (period) =>
                period.year,
            ),
          ),
        ).sort(
          (
            first,
            second,
          ) =>
            second - first,
        ),
      [
        periods,
      ],
    );

  return (
    <div className="archive-page">
      <PageHeader
        title="ארכיון"
        description="צפייה בלוחות ובנתונים מחודשים קודמים."
      />

      <section className="archive-toolbar">
        <div>
          <Archive
            size={22}
            aria-hidden="true"
          />

          <div>
            <strong>
              חודשי ארכיון
            </strong>

            <span>
              {periods.length}{' '}
              חודשים זמינים
            </span>
          </div>
        </div>

        <button
          type="button"
          className="archive-refresh-button"
          disabled={
            isLoading
          }
          onClick={() => {
            void handleRefresh();
          }}
        >
          <RefreshCw
            size={18}
            className={
              isLoading
                ? 'archive-spin'
                : undefined
            }
            aria-hidden="true"
          />

          רענון
        </button>
      </section>

      {error ? (
        <div
          className="archive-error"
          role="alert"
        >
          <AlertTriangle
            size={22}
            aria-hidden="true"
          />

          <div>
            <strong>
              טעינת הארכיון נכשלה
            </strong>

            <span>
              {error}
            </span>
          </div>
        </div>
      ) : null}

      {isLoading ? (
        <div className="archive-loading">
          <RefreshCw
            size={28}
            className="archive-spin"
            aria-hidden="true"
          />

          <span>
            טוען חודשי ארכיון...
          </span>
        </div>
      ) : null}

      {!isLoading &&
      !error &&
      periods.length ===
        0 ? (
        <section className="archive-empty">
          <Archive
            size={40}
            aria-hidden="true"
          />

          <h2>
            הארכיון עדיין ריק
          </h2>

          <p>
            חודשים היסטוריים שיובאו
            או תקופות שיארכבו יופיעו
            כאן.
          </p>
        </section>
      ) : null}

      {!isLoading &&
      !error &&
      periods.length >
        0 ? (
        <div className="archive-years">
          {years.map(
            (year) => (
              <section
                key={
                  year
                }
                className="archive-year-group"
              >
                <header>
                  <CalendarDays
                    size={20}
                    aria-hidden="true"
                  />

                  <h2>
                    {year}
                  </h2>
                </header>

                <div className="archive-grid">
                  {periods
                    .filter(
                      (period) =>
                        period.year ===
                        year,
                    )
                    .map(
                      (period) => (
                        <article
                          key={`${period.year}-${period.month}`}
                          className="archive-card"
                        >
                          <header>
                            <div>
                              <h3>
                                {getPeriodTitle(
                                  period,
                                )}
                              </h3>

                              <span>
                                {period.isFullyArchived
                                  ? 'כל הלוחות בארכיון'
                                  : 'ארכוב חלקי'}
                              </span>
                            </div>

                            <span
                              className={
                                period.isFullyArchived
                                  ? 'archive-status archive-status-complete'
                                  : 'archive-status archive-status-partial'
                              }
                            >
                              {period.isFullyArchived ? (
                                <CheckCircle2
                                  size={15}
                                  aria-hidden="true"
                                />
                              ) : (
                                <AlertTriangle
                                  size={15}
                                  aria-hidden="true"
                                />
                              )}

                              {period.isFullyArchived
                                ? 'ארכיון מלא'
                                : 'חלקי'}
                            </span>
                          </header>

                          <div className="archive-card-statistics">
                            <div>
                              <Users
                                size={19}
                                aria-hidden="true"
                              />

                              <strong>
                                {
                                  period.dispatcherShiftCount
                                }
                              </strong>

                              <span>
                                משמרות מוקדנים
                              </span>
                            </div>

                            <div>
                              <Users
                                size={19}
                                aria-hidden="true"
                              />

                              <strong>
                                {
                                  period.dispatcherCount
                                }
                              </strong>

                              <span>
                                מוקדנים
                              </span>
                            </div>

                            <div>
                              <Wrench
                                size={19}
                                aria-hidden="true"
                              />

                              <strong>
                                {
                                  period.driverDutyCount
                                }
                              </strong>

                              <span>
                                כוננויות
                              </span>
                            </div>

                            <div>
                              <Wrench
                                size={19}
                                aria-hidden="true"
                              />

                              <strong>
                                {
                                  period.driverCount
                                }
                              </strong>

                              <span>
                                כוננים
                              </span>
                            </div>

                            <div>
                              <Sunrise
                                size={19}
                                aria-hidden="true"
                              />

                              <strong>
                                {
                                  period.morningDriverAssignmentCount
                                }
                              </strong>

                              <span>
                                שיבוצי כונני בוקר
                              </span>
                            </div>

                            <div>
                              <Sunrise
                                size={19}
                                aria-hidden="true"
                              />

                              <strong>
                                {
                                  period.morningDriverCount
                                }
                              </strong>

                              <span>
                                כונני בוקר
                              </span>
                            </div>
                          </div>

                          <dl className="archive-card-details">
                            <div>
                              <dt>
                                לוח מוקדנים
                              </dt>

                              <dd>
                                {period.hasDispatcherSchedule
                                  ? period.dispatcherStatus ??
                                    'קיים'
                                  : 'לא קיים'}
                              </dd>
                            </div>

                            <div>
                              <dt>
                                לוח כוננים
                              </dt>

                              <dd>
                                {period.hasDriverSchedule
                                  ? period.driverStatus ??
                                    'קיים'
                                  : 'לא קיים'}
                              </dd>
                            </div>

                            <div>
                              <dt>
                                לוח כונני בוקר
                              </dt>

                              <dd>
                                {period.hasMorningDriverSchedule
                                  ? period.morningDriverStatus ??
                                    'קיים'
                                  : 'לא קיים'}
                              </dd>
                            </div>

                            <div>
                              <dt>
                                תאריך ארכוב
                              </dt>

                              <dd>
                                {formatDateTime(
                                  period.dispatcherArchivedAt ??
                                    period.driverArchivedAt ??
                                    period.morningDriverArchivedAt,
                                )}
                              </dd>
                            </div>
                          </dl>

                          {period.importRunId ? (
                            <div className="archive-import-source">
                              <FileSpreadsheet
                                size={17}
                                aria-hidden="true"
                              />

                              <div>
                                <strong>
                                  יובא מאקסל
                                </strong>

                                <span>
                                  {period.importFileName ??
                                    'שם הקובץ אינו זמין'}
                                </span>

                                <small>
                                  {period.importedBy
                                    ? `על ידי ${period.importedBy}`
                                    : 'המשתמש המייבא אינו זמין'}
                                  {' · '}
                                  {formatDateTime(
                                    period.importedAt,
                                  )}
                                </small>
                              </div>
                            </div>
                          ) : null}
                        </article>
                      ),
                    )}
                </div>
              </section>
            ),
          )}
        </div>
      ) : null}
    </div>
  );
}

export default ArchivePage;