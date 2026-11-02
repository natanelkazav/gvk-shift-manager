/**
 * קובץ: src/features/statistics/views/PayrollStatisticsView.tsx
 * מטרה: מימוש רכיב תצוגה ואינטראקציה עבור חישובי שכר / סטטיסטיקה.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: PayrollStatisticsViewProps, formatCurrency, PayrollStatisticsView.
 * - קישור מאפיינים ומצב מקומי לתצוגה ולטיפול בפעולות המשתמש.
 */
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

/**
 * חוזה הנתונים PayrollStatisticsViewProps: חישובי שכר / סטטיסטיקה / מאפייני הרכיב.
 */
interface PayrollStatisticsViewProps {
  // years — שנים.
  years: number[];
  // months — חודשים.
  months: number[];
  // dispatcherIds — מוקדנים.
  dispatcherIds: string[];
  // driverIds — כוננים.
  driverIds: string[];
  // morningDriverIds — כונני בוקר.
  morningDriverIds: string[];
  // mode — מצב פעולה.
  mode: 'dispatchers' | 'drivers' | 'morning_drivers';
}

/**
 * פעולה formatCurrency: עיצוב ערך לתצוגה עבור הנתון formatCurrency בהקשר הפעולה.
 * @param value — ערך.
 * @returns string — הפלט בהתאם לחתימה.
 */
function formatCurrency(
  value: number | null,
): string {
  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר value === null.
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

/**
 * פעולה PayrollStatisticsView: חישובי שכר / סטטיסטיקה.
 * פרמטר מפורק — שדות הקלט נגישים מקומית בשמות המוגדרים בחתימה.
 */
function PayrollStatisticsView({
  years,
  months,
  dispatcherIds,
  driverIds,
  morningDriverIds,
  mode,
}: PayrollStatisticsViewProps) {
  const {
    hasPermission,
  } = useAuth();

  // מצב מקומי: data — נתונים; setData מעדכנת אותו ומפעילה רינדור לפי React.
  const [data, setData] =
    useState<PayrollStatisticsResponse | null>(
      null,
    );

  // מצב מקומי: error — שגיאה; setError מעדכנת אותו ומפעילה רינדור לפי React.
  const [error, setError] =
    useState<string | null>(null);

  // מצב מקומי: isLoading — האם טעינה מתבצעת; setIsLoading מעדכנת אותו ומפעילה רינדור לפי React.
  const [isLoading, setIsLoading] =
    useState(true);

  // canViewAttendance — האם צפייה מותרת.
  const canViewAttendance =
    hasPermission(
      'attendance.view',
    );

  // תופעת לוואי לאחר רינדור בהתאם לתלויות [months, years].
  useEffect(() => {
    // isCancelled — הנתון isCancelled בהקשר הפעולה.
    let isCancelled = false;

    /**
     * פעולה אסינכרונית load: טעינת הנתון load בהקשר הפעולה.
     * @returns Promise<void> — הפלט בהתאם לחתימה.
     */
    const load = async (): Promise<void> => {
      setIsLoading(true);
      setError(null);

      // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
      try {
        // response — תוצאת הפעולה.
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

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר isLoading.
  if (isLoading) {
    return (
      <div className="statistics-loading">
        טוען נתוני שכר...
      </div>
    );
  }

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר error.
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

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !data.
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

  // visibleMorningDrivers — כונני בוקר.
  const visibleMorningDrivers =
    morningDriverIds.length === 0
      ? (data.morningDrivers ?? [])
      : (data.morningDrivers ?? []).filter(
          (row) =>
            morningDriverIds.includes(
              row.userId,
            ),
        );

  // projectedDispatcherPay — מוקדנים.
  const projectedDispatcherPay =
    visibleDispatchers.reduce(
      (sum, row) =>
        sum +
        (row.projectedPay ?? 0),
      0,
    );

  // projectedDriverPay — כוננים.
  const projectedDriverPay =
    visibleDrivers.reduce(
      (sum, row) =>
        sum +
        (row.projectedPay ?? 0),
      0,
    );

  // projectedMorningDriverPay — כונני בוקר.
  const projectedMorningDriverPay =
    visibleMorningDrivers.reduce(
      (sum, row) =>
        sum +
        (row.projectedPay ?? 0),
      0,
    );

  return (
    <div className="statistics-payroll-view">
      <section className="statistics-summary-grid">
        {mode === 'dispatchers' ? (
          <>
            <article>
              <WalletCards size={22} aria-hidden="true" />
              <div>
                <span>שכר מוקדנים צפוי</span>
                <strong>{formatCurrency(projectedDispatcherPay)}</strong>
              </div>
            </article>
            <article>
              <Clock3 size={22} aria-hidden="true" />
              <div>
                <span>נוכחות בפועל</span>
                <strong>{data.attendanceAvailable ? 'מחובר' : 'ממתין ל-TimeWatch'}</strong>
              </div>
            </article>
          </>
        ) : mode === 'drivers' ? (
          <article>
            <WalletCards size={22} aria-hidden="true" />
            <div>
              <span>עלות כוננויות צפויה</span>
              <strong>{formatCurrency(projectedDriverPay)}</strong>
            </div>
          </article>
        ) : (
          <article>
            <WalletCards size={22} aria-hidden="true" />
            <div>
              <span>שכר כונני בוקר צפוי</span>
              <strong>{formatCurrency(projectedMorningDriverPay)}</strong>
            </div>
          </article>
        )}
      </section>

      {mode === 'dispatchers' ? (
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

      ) : null}

      {mode === 'drivers' ? (
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

      ) : null}

      {mode === 'dispatchers' && canViewAttendance ? (
        <section className="statistics-section statistics-attendance-placeholder">
          <header>
            <h2>כניסה, יציאה וחריגות</h2>
            <p>
              האזור מוכן להרשאת attendance.view. הנתונים יופיעו כאן לאחר חיבור API של TimeWatch.
            </p>
          </header>
        </section>
      ) : null}

      {mode === 'morning_drivers' ? (
        <section className="statistics-section">
          <header>
            <h2>שכר כונני בוקר צפוי</h2>
            <p>
              מחושב לפי התעריף הקבוע למשמרת שהוגדר לכל כונן בוקר ולפי מספר המשמרות בלוחות שפורסמו.
            </p>
          </header>

          <div className="statistics-table-wrapper">
            <table className="statistics-table">
              <thead>
                <tr>
                  <th>כונן בוקר</th>
                  <th>תעריף למשמרת</th>
                  <th>משמרות</th>
                  <th>שכר צפוי</th>
                </tr>
              </thead>
              <tbody>
                {visibleMorningDrivers.map((row) => (
                  <tr key={row.userId}>
                    <td>{row.scheduleName ?? row.displayName}</td>
                    <td>{formatCurrency(row.shiftRate)}</td>
                    <td>{row.totalShifts}</td>
                    <td>{formatCurrency(row.projectedPay)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}

export default PayrollStatisticsView;
