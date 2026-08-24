import {
  AlertTriangle,
  CalendarCheck2,
  Clock3,
  Moon,
  Sun,
  UserCheck,
  UserX,
} from 'lucide-react';

import type {
  DispatcherAvailabilityStatisticsRow,
  StatisticsDashboardResponse,
} from '../../../types/statistics';

import StatisticsBarChart
  from '../components/StatisticsBarChart';

import StatisticsPieChart
  from '../components/StatisticsPieChart';

interface DispatcherAvailabilityInsightsProps {
  data: StatisticsDashboardResponse;
  mode: 'dashboard' | 'charts' | 'tables';
}

function getDisplayName(
  row: DispatcherAvailabilityStatisticsRow,
): string {
  return (
    row.scheduleName?.trim() ||
    row.displayName.trim() ||
    'ללא שם'
  );
}

function formatPercent(
  value: number,
): string {
  return `${Math.round(value * 10) / 10}%`;
}

function DispatcherAvailabilityInsights({
  data,
  mode,
}: DispatcherAvailabilityInsightsProps) {
  const summary =
    data.dispatcherAvailabilitySummary;

  const rows =
    data.dispatcherAvailabilityStatistics;

  const nonSubmitters =
    rows.filter(
      (row) =>
        row.noSubmissionPeriods > 0,
    );

  if (summary.periodCount === 0) {
    return (
      <section className="statistics-section">
        <header>
          <div>
            <div>
              <h2>סטטיסטיקות אילוצי מוקדנים</h2>
              <p>
                הנתונים מחושבים מתקופות אילוצים שנסגרו בלבד, כדי לא לסמן מוקדן כמי שלא הגיש בזמן שתקופה עדיין פתוחה.
              </p>
            </div>
          </div>
        </header>

        <div className="statistics-empty">
          אין תקופות אילוצים סגורות בתקופה שנבחרה.
        </div>
      </section>
    );
  }

  if (mode === 'charts') {
    return (
      <>
        <StatisticsPieChart
          title="אופן סיום הגשת האילוצים"
          description="הגשה עצמאית לעומת השלמה אוטומטית בעת סגירת התקופה."
          slices={[
            {
              label: 'הוגש עצמאית',
              value: summary.manualSubmissionPeriods,
            },
            {
              label: 'הושלם חלקית אוטומטית',
              value: summary.autoPartialPeriods,
            },
            {
              label: 'לא הוגש כלל',
              value: summary.noSubmissionPeriods,
            },
          ]}
        />

        <StatisticsBarChart
          title="זמינות לשישי בבוקר"
          description="מספר משמרות שישי בוקר שכל מוקדן סימן בעצמו כזמין. השלמות אוטומטיות אינן נספרות."
          items={rows.map((row) => ({
            label: getDisplayName(row),
            value: row.fridayMorningAvailableCount,
          }))}
        />

        <StatisticsBarChart
          title="זמינות למשמרות לילה"
          description="כמה משמרות לילה סומנו כזמינות באופן יזום על ידי כל מוקדן."
          items={rows.map((row) => ({
            label: getDisplayName(row),
            value: row.nightAvailableCount,
          }))}
        />

        <StatisticsBarChart
          title="זמינות למשמרות 200%"
          description="כמה משמרות 200% סומנו כזמינות באופן יזום."
          items={rows.map((row) => ({
            label: getDisplayName(row),
            value: row.premiumAvailableCount,
          }))}
        />

        <StatisticsBarChart
          title="סה״כ זמינות שהוצהרה"
          description="זמינות שהמוקדן סימן בעצמו בלבד, ללא משמרות שהמערכת השלימה אוטומטית."
          items={rows.map((row) => ({
            label: getDisplayName(row),
            value: row.declaredAvailableCount,
          }))}
        />
      </>
    );
  }

  if (mode === 'tables') {
    return (
      <section className="statistics-section">
        <header>
          <div>
            <div>
              <h2>פירוט אילוצי מוקדנים</h2>
              <p>
                זמינות יזומה, סוגי משמרות ואופן ההגשה. ערכי השלמה אוטומטית מוצגים בנפרד ואינם נחשבים כהעדפה של המוקדן.
              </p>
            </div>
          </div>
        </header>

        <div className="statistics-table-wrapper">
          <table className="statistics-table statistics-availability-table">
            <thead>
              <tr>
                <th>מוקדן</th>
                <th>תקופות</th>
                <th>הוגש עצמאית</th>
                <th>לא הוגש</th>
                <th>השלמה חלקית</th>
                <th>זמין</th>
                <th>לא זמין</th>
                <th>אחוז זמינות</th>
                <th>שישי בוקר</th>
                <th>שישי צהריים</th>
                <th>שישי לילה</th>
                <th>שבת בוקר</th>
                <th>שבת צהריים</th>
                <th>שבת לילה</th>
                <th>לילות</th>
                <th>200%</th>
                <th>חגים</th>
                <th>הושלם אוטומטית</th>
              </tr>
            </thead>

            <tbody>
              {rows.map((row) => (
                <tr key={row.userId}>
                  <td>
                    <strong>{getDisplayName(row)}</strong>
                  </td>
                  <td>{row.periodCount}</td>
                  <td>{row.manualSubmissionPeriods}</td>
                  <td>{row.noSubmissionPeriods}</td>
                  <td>{row.autoPartialPeriods}</td>
                  <td>{row.declaredAvailableCount}</td>
                  <td>{row.declaredUnavailableCount}</td>
                  <td>{formatPercent(row.declaredAvailabilityRate)}</td>
                  <td>{row.fridayMorningAvailableCount}</td>
                  <td>{row.fridayAfternoonAvailableCount}</td>
                  <td>{row.fridayNightAvailableCount}</td>
                  <td>{row.saturdayMorningAvailableCount}</td>
                  <td>{row.saturdayAfternoonAvailableCount}</td>
                  <td>{row.saturdayNightAvailableCount}</td>
                  <td>{row.nightAvailableCount}</td>
                  <td>{row.premiumAvailableCount}</td>
                  <td>{row.holidayAvailableCount}</td>
                  <td>{row.autoCompletedAvailableCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    );
  }

  return (
    <section className="statistics-availability-dashboard">
      <section className="statistics-section">
        <header>
          <div>
            <div>
              <h2>אילוצי מוקדנים</h2>
              <p>
                מבט ניהולי על הגשות וזמינות. זמינות שהמערכת השלימה לאחר אי־הגשה נשמרת לצורכי שיבוץ, אך אינה נספרת כהעדפה של המוקדן.
              </p>
            </div>
          </div>
        </header>

        <div className="statistics-summary-grid">
          <article>
            <CalendarCheck2 size={22} aria-hidden="true" />
            <div>
              <span>תקופות שנותחו</span>
              <strong>{summary.periodCount}</strong>
            </div>
          </article>

          <article>
            <UserCheck size={22} aria-hidden="true" />
            <div>
              <span>הגשות עצמאיות</span>
              <strong>{summary.manualSubmissionPeriods}</strong>
            </div>
          </article>

          <article>
            <UserX size={22} aria-hidden="true" />
            <div>
              <span>לא הוגשו כלל</span>
              <strong>{summary.noSubmissionPeriods}</strong>
            </div>
          </article>

          <article>
            <Clock3 size={22} aria-hidden="true" />
            <div>
              <span>השלמה חלקית</span>
              <strong>{summary.autoPartialPeriods}</strong>
            </div>
          </article>

          <article>
            <Sun size={22} aria-hidden="true" />
            <div>
              <span>זמינויות שישי בוקר</span>
              <strong>{summary.fridayMorningAvailableCount}</strong>
            </div>
          </article>

          <article>
            <Moon size={22} aria-hidden="true" />
            <div>
              <span>זמינויות לילה</span>
              <strong>{summary.nightAvailableCount}</strong>
            </div>
          </article>
        </div>
      </section>

      {nonSubmitters.length > 0 ? (
        <section className="statistics-availability-warning" role="status">
          <AlertTriangle size={22} aria-hidden="true" />
          <div>
            <strong>מוקדנים שלא הגישו אילוצים</strong>
            <p>
              בתקופה שנבחרה נמצאו הגשות שהמערכת השלימה במלואן. הן אינן נחשבות לזמינות יזומה בסטטיסטיקה.
            </p>
            <div className="statistics-availability-warning-list">
              {nonSubmitters.map((row) => (
                <span key={row.userId}>
                  {getDisplayName(row)} · {row.noSubmissionPeriods} תקופות
                </span>
              ))}
            </div>
          </div>
        </section>
      ) : null}
    </section>
  );
}

export default DispatcherAvailabilityInsights;
