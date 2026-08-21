import {
  Clock3,
  WalletCards,
} from 'lucide-react';
import {
  useEffect,
  useState,
} from 'react';

import {
  useAuth,
} from '../../../auth/AuthContext';
import {
  statisticsService,
} from '../../../services/statisticsService';
import type {
  PayrollStatisticsResponse,
} from '../../../types/statistics';

interface PayrollStatisticsViewProps {
  years: number[];
  months: number[];
  dispatcherIds: string[];
  driverIds: string[];
}

function formatCurrency(
  value: number | null,
): string {
  if (value === null) {
    return 'לא הוגדר';
  }

  return new Intl.NumberFormat(
    'he-IL',
    {
      style: 'currency',
      currency: 'ILS',
      maximumFractionDigits: 2,
    },
  ).format(value);
}

function PayrollStatisticsView({
  years,
  months,
  dispatcherIds,
  driverIds,
}: PayrollStatisticsViewProps) {
  const {
    hasPermission,
  } = useAuth();

  const [data, setData] =
    useState<PayrollStatisticsResponse | null>(
      null,
    );

  const [error, setError] =
    useState<string | null>(null);

  const [isLoading, setIsLoading] =
    useState(true);

  const canViewAttendance =
    hasPermission(
      'attendance.view',
    );

  useEffect(() => {
    let isCancelled = false;

    const load = async (): Promise<void> => {
      setIsLoading(true);
      setError(null);

      try {
        const response =
          await statisticsService
            .getPayrollStatistics(
              {
                years,
                months,
              },
            );

        if (!isCancelled) {
          setData(response);
        }
      } catch (loadError) {
        if (!isCancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'לא ניתן היה לטעון את נתוני השכר.',
          );
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };

    void load();

    return () => {
      isCancelled = true;
    };
  }, [months, years]);

  if (isLoading) {
    return (
      <div className="statistics-loading">
        טוען נתוני שכר...
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="statistics-error"
        role="alert"
      >
        {error}
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const visibleDispatchers =
    dispatcherIds.length === 0
      ? data.dispatchers
      : data.dispatchers.filter(
          (row) =>
            dispatcherIds.includes(
              row.userId,
            ),
        );

  const visibleDrivers =
    driverIds.length === 0
      ? data.drivers
      : data.drivers.filter(
          (row) =>
            driverIds.includes(
              row.userId,
            ),
        );

  const projectedDispatcherPay =
    visibleDispatchers.reduce(
      (sum, row) =>
        sum +
        (row.projectedPay ?? 0),
      0,
    );

  const projectedDriverPay =
    visibleDrivers.reduce(
      (sum, row) =>
        sum +
        (row.projectedPay ?? 0),
      0,
    );

  return (
    <div className="statistics-payroll-view">
      <section className="statistics-summary-grid">
        <article>
          <WalletCards
            size={22}
            aria-hidden="true"
          />

          <div>
            <span>
              שכר מוקדנים צפוי
            </span>

            <strong>
              {formatCurrency(
                projectedDispatcherPay,
              )}
            </strong>
          </div>
        </article>

        <article>
          <WalletCards
            size={22}
            aria-hidden="true"
          />

          <div>
            <span>
              עלות כוננויות צפויה
            </span>

            <strong>
              {formatCurrency(
                projectedDriverPay,
              )}
            </strong>
          </div>
        </article>

        <article>
          <Clock3
            size={22}
            aria-hidden="true"
          />

          <div>
            <span>
              נוכחות בפועל
            </span>

            <strong>
              {data.attendanceAvailable
                ? 'מחובר'
                : 'ממתין ל-TimeWatch'}
            </strong>
          </div>
        </article>
      </section>

      <section className="statistics-section">
        <header>
          <h2>שכר מוקדנים צפוי</h2>
          <p>
            מחושב לפי שעות המשמרות המתוכננות והסימון הקיים של משמרות 200%.
          </p>
        </header>

        <div className="statistics-table-wrapper">
          <table className="statistics-table">
            <thead>
              <tr>
                <th>מוקדן</th>
                <th>שכר שעתי</th>
                <th>שעות מתוכננות</th>
                <th>שעות 200%</th>
                <th>שכר צפוי</th>
                <th>שכר בפועל</th>
              </tr>
            </thead>

            <tbody>
              {visibleDispatchers.map(
                (row) => (
                  <tr key={row.userId}>
                    <td>
                      {row.scheduleName ??
                        row.displayName}
                    </td>
                    <td>
                      {formatCurrency(
                        row.hourlyRate,
                      )}
                    </td>
                    <td>
                      {row.scheduledHours}
                    </td>
                    <td>
                      {row.premiumHours}
                    </td>
                    <td>
                      {formatCurrency(
                        row.projectedPay,
                      )}
                    </td>
                    <td>
                      ממתין ל-TimeWatch
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="statistics-section">
        <header>
          <h2>עלות כוננויות צפויה</h2>
          <p>
            מחושבת לפי עלות כוננות יומית שהוגדרה לכל כונן.
          </p>
        </header>

        <div className="statistics-table-wrapper">
          <table className="statistics-table">
            <thead>
              <tr>
                <th>כונן</th>
                <th>עלות יומית</th>
                <th>מספר כוננויות</th>
                <th>עלות צפויה</th>
              </tr>
            </thead>

            <tbody>
              {visibleDrivers.map(
                (row) => (
                  <tr key={row.userId}>
                    <td>
                      {row.scheduleName ??
                        row.displayName}
                    </td>
                    <td>
                      {formatCurrency(
                        row.dailyDutyRate,
                      )}
                    </td>
                    <td>
                      {row.totalDuties}
                    </td>
                    <td>
                      {formatCurrency(
                        row.projectedPay,
                      )}
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      </section>

      {canViewAttendance ? (
        <section className="statistics-section statistics-attendance-placeholder">
          <header>
            <h2>כניסה, יציאה וחריגות</h2>
            <p>
              האזור מוכן להרשאת attendance.view. הנתונים יופיעו כאן לאחר חיבור API של TimeWatch.
            </p>
          </header>
        </section>
      ) : null}
    </div>
  );
}

export default PayrollStatisticsView;
