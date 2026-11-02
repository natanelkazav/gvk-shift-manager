/**
 * קובץ: src/features/statistics/components/StatisticsStackedBarChart.tsx
 * מטרה: מימוש רכיב תצוגה ואינטראקציה עבור סטטיסטיקה.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: StackedBarSeries, StackedBarItem, StatisticsStackedBarChartProps, StatisticsStackedBarChart.
 * - קישור מאפיינים ומצב מקומי לתצוגה ולטיפול בפעולות המשתמש.
 */
import {
  useMemo,
  useState,
} from 'react';

/**
 * חוזה הנתונים StackedBarSeries: הנתון StackedBarSeries בהקשר הפעולה.
 */
interface StackedBarSeries {
  // key — מפתח.
  key: string;
  // label — תווית.
  label: string;
}

/**
 * חוזה הנתונים StackedBarItem: פריט.
 */
interface StackedBarItem {
  // key — מפתח.
  key: string;
  // label — תווית.
  label: string;
  // values — ערכים.
  values: Record<string, number>;
}

/**
 * חוזה הנתונים StatisticsStackedBarChartProps: סטטיסטיקה / מאפייני הרכיב.
 */
interface StatisticsStackedBarChartProps {
  // title — כותרת.
  title: string;
  description?: string;
  series: StackedBarSeries[];
  // items — פריטים.
  items: StackedBarItem[];
  // emptyMessage — הודעה (אופציונלי).
  emptyMessage?: string;
  // unitLabel — תווית (אופציונלי).
  unitLabel?: string;
  // valueFormatter — ערך (אופציונלי).
  valueFormatter?: (value: number) => string;
}

/**
 * פעולה StatisticsStackedBarChart: סטטיסטיקה.
 * פרמטר מפורק — שדות הקלט נגישים מקומית בשמות המוגדרים בחתימה.
 */
function StatisticsStackedBarChart({
  title,
  description,
  series,
  items,
  emptyMessage = 'אין נתונים להצגה.',
  unitLabel = 'משמרות',
  valueFormatter = (value) => String(value),
}: StatisticsStackedBarChartProps) {
  // מצב מקומי: hiddenSeriesKeys — הנתון hiddenSeriesKeys בהקשר הפעולה; setHiddenSeriesKeys מעדכנת אותו ומפעילה רינדור לפי React.
  const [hiddenSeriesKeys, setHiddenSeriesKeys] =
    useState<string[]>([]);

  // ערך מחושב visibleSeries — הנתון visibleSeries בהקשר הפעולה; נשמר בין רינדורים עד שינוי התלויות.
  const visibleSeries = useMemo(
    () => series.filter((entry) => !hiddenSeriesKeys.includes(entry.key)),
    [series, hiddenSeriesKeys],
  );

  // ערך מחושב maximumTotal — סך הכול; נשמר בין רינדורים עד שינוי התלויות.
  const maximumTotal = useMemo(
    () => Math.max(
      0,
      ...items.map((item) =>
        visibleSeries.reduce(
          (sum, entry) => sum + (item.values[entry.key] ?? 0),
          0,
        )),
    ),
    [items, visibleSeries],
  );

  // hasVisibleData — נתונים.
  const hasVisibleData =
    visibleSeries.length > 0 &&
    items.some((item) =>
      visibleSeries.some((entry) => (item.values[entry.key] ?? 0) > 0));

  return (
    <article className="statistics-chart-card statistics-chart-card-wide">
      <header className="statistics-stacked-chart-header">
        <div>
          <h3>{title}</h3>
          {description ? <p>{description}</p> : null}
        </div>

        <div className="statistics-stacked-chart-actions">
          <button
            type="button"
            onClick={() => setHiddenSeriesKeys([])}
          >
            הצג הכול
          </button>

          <button
            type="button"
            onClick={() => setHiddenSeriesKeys(series.map((entry) => entry.key))}
          >
            נקה בחירה
          </button>
        </div>
      </header>

      {series.length > 0 ? (
        <div
          className="statistics-stacked-series-picker"
          aria-label="סוגי משמרות להצגה בגרף"
        >
          {series.map((entry, index) => {
            const checked = !hiddenSeriesKeys.includes(entry.key);

            return (
              <label
                key={entry.key}
                className={checked
                  ? 'statistics-stacked-series-chip statistics-stacked-series-chip-active'
                  : 'statistics-stacked-series-chip'}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => {
                    setHiddenSeriesKeys((current) =>
                      checked
                        ? [...current, entry.key]
                        : current.filter((key) => key !== entry.key));
                  }}
                />

                <i
                  className={`statistics-stacked-series-marker statistics-stacked-series-marker-${(index % 8) + 1}`}
                  aria-hidden="true"
                />

                <span className="statistics-stacked-series-label" dir="ltr">{entry.label}</span>
              </label>
            );
          })}
        </div>
      ) : null}

      {!hasVisibleData ? (
        <div className="statistics-chart-empty">
          {visibleSeries.length === 0
            ? 'יש לבחור לפחות סוג משמרת אחד להצגה.'
            : emptyMessage}
        </div>
      ) : (
        <div className="statistics-stacked-bars">
          {items.map((item) => {
            // selectedTotal — נבחר / סך הכול.
            const selectedTotal = visibleSeries.reduce(
              (sum, entry) => sum + (item.values[entry.key] ?? 0),
              0,
            );

            return (
              <div
                key={item.key}
                className="statistics-stacked-bar-column"
              >
                <strong>{valueFormatter(selectedTotal)}</strong>

                <div
                  className="statistics-stacked-bar-track"
                  aria-label={`${item.label}: ${valueFormatter(selectedTotal)} ${unitLabel}`}
                >
                  {visibleSeries.map((entry) => {
                    // originalIndex — מיקום באוסף.
                    const originalIndex =
                      series.findIndex((candidate) => candidate.key === entry.key);
                    // value — ערך.
                    const value = item.values[entry.key] ?? 0;
                    // height — גובה.
                    const height =
                      maximumTotal > 0
                        ? (value / maximumTotal) * 100
                        : 0;

                    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר value <= 0.
                    if (value <= 0) {
                      return null;
                    }

                    return (
                      <div
                        key={entry.key}
                        className={`statistics-stacked-bar-segment statistics-stacked-series-fill-${(originalIndex % 8) + 1}`}
                        style={{ height: `${height}%` }}
                        title={`${entry.label}: ${value}`}
                      >
                        <span>{valueFormatter(value)}</span>
                      </div>
                    );
                  })}
                </div>

                <span title={item.label}>{item.label}</span>
              </div>
            );
          })}
        </div>
      )}
    </article>
  );
}

export default StatisticsStackedBarChart;
