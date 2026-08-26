import {
  useMemo,
  useState,
} from 'react';

interface StackedBarSeries {
  key: string;
  label: string;
}

interface StackedBarItem {
  key: string;
  label: string;
  values: Record<string, number>;
}

interface StatisticsStackedBarChartProps {
  title: string;
  description?: string;
  series: StackedBarSeries[];
  items: StackedBarItem[];
  emptyMessage?: string;
}

function StatisticsStackedBarChart({
  title,
  description,
  series,
  items,
  emptyMessage = 'אין נתונים להצגה.',
}: StatisticsStackedBarChartProps) {
  const [hiddenSeriesKeys, setHiddenSeriesKeys] =
    useState<string[]>([]);

  const visibleSeries = useMemo(
    () => series.filter((entry) => !hiddenSeriesKeys.includes(entry.key)),
    [series, hiddenSeriesKeys],
  );

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

                <span>{entry.label}</span>
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
            const selectedTotal = visibleSeries.reduce(
              (sum, entry) => sum + (item.values[entry.key] ?? 0),
              0,
            );

            return (
              <div
                key={item.key}
                className="statistics-stacked-bar-column"
              >
                <strong>{selectedTotal}</strong>

                <div
                  className="statistics-stacked-bar-track"
                  aria-label={`${item.label}: ${selectedTotal} משמרות`}
                >
                  {visibleSeries.map((entry) => {
                    const originalIndex =
                      series.findIndex((candidate) => candidate.key === entry.key);
                    const value = item.values[entry.key] ?? 0;
                    const height =
                      maximumTotal > 0
                        ? (value / maximumTotal) * 100
                        : 0;

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
                        <span>{value}</span>
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
