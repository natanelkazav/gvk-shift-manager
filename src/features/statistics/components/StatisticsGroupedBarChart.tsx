/**
 * קובץ: src/features/statistics/components/StatisticsGroupedBarChart.tsx
 * מטרה: מימוש רכיב תצוגה ואינטראקציה עבור סטטיסטיקה.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: GroupedBarSeries, GroupedBarItem, StatisticsGroupedBarChartProps, StatisticsGroupedBarChart.
 * - קישור מאפיינים ומצב מקומי לתצוגה ולטיפול בפעולות המשתמש.
 */
/**
 * חוזה הנתונים GroupedBarSeries: הנתון GroupedBarSeries בהקשר הפעולה.
 */
interface GroupedBarSeries {
  // key — מפתח.
  key: string;
  // label — תווית.
  label: string;
}

/**
 * חוזה הנתונים GroupedBarItem: פריט.
 */
interface GroupedBarItem {
  // label — תווית.
  label: string;
  // values — ערכים.
  values: Record<string, number>;
}

/**
 * חוזה הנתונים StatisticsGroupedBarChartProps: סטטיסטיקה / מאפייני הרכיב.
 */
interface StatisticsGroupedBarChartProps {
  // title — כותרת.
  title: string;
  description?: string;
  series: GroupedBarSeries[];
  // items — פריטים.
  items: GroupedBarItem[];
  // emptyMessage — הודעה (אופציונלי).
  emptyMessage?: string;
}

/**
 * פעולה StatisticsGroupedBarChart: סטטיסטיקה.
 * פרמטר מפורק — שדות הקלט נגישים מקומית בשמות המוגדרים בחתימה.
 */
function StatisticsGroupedBarChart({
  title,
  description,
  series,
  items,
  emptyMessage = 'אין נתונים להצגה.',
}: StatisticsGroupedBarChartProps) {
  // maximumValue — ערך.
  const maximumValue =
    Math.max(
      0,
      ...items.flatMap(
        (item) =>
          series.map(
            (entry) =>
              item.values[entry.key] ?? 0,
          ),
      ),
    );

  return (
    <article className="statistics-chart-card">
      <header>
        <div>
          <h3>{title}</h3>
          {description ? <p>{description}</p> : null}
        </div>
      </header>

      {items.length === 0 ? (
        <div className="statistics-chart-empty">
          {emptyMessage}
        </div>
      ) : (
        <>
          <div className="statistics-grouped-legend">
            {series.map((entry, index) => (
              <span key={entry.key}>
                <i
                  className={`statistics-grouped-series-marker statistics-grouped-series-marker-${index + 1}`}
                />
                {entry.label}
              </span>
            ))}
          </div>

          <div className="statistics-grouped-bars">
            {items.map((item) => (
              <div
                key={item.label}
                className="statistics-grouped-bar-column"
              >
                <div className="statistics-grouped-bar-values">
                  {series.map((entry, index) => {
                    // value — ערך.
                    const value =
                      item.values[entry.key] ?? 0;

                    const percentage =
                      maximumValue > 0
                        ? Math.max(
                            value > 0 ? 4 : 0,
                            Math.round(
                              (value / maximumValue) * 100,
                            ),
                          )
                        : 0;

                    return (
                      <div
                        key={entry.key}
                        className="statistics-grouped-bar-series"
                        title={`${entry.label}: ${value}`}
                      >
                        <strong>{value}</strong>
                        <i
                          className={`statistics-grouped-series-fill statistics-grouped-series-fill-${index + 1}`}
                          style={{
                            height: `${percentage}%`,
                          }}
                        />
                      </div>
                    );
                  })}
                </div>

                <span title={item.label}>
                  {item.label}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </article>
  );
}

export default StatisticsGroupedBarChart;
