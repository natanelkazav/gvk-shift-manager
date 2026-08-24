interface GroupedBarSeries {
  key: string;
  label: string;
}

interface GroupedBarItem {
  label: string;
  values: Record<string, number>;
}

interface StatisticsGroupedBarChartProps {
  title: string;
  description?: string;
  series: GroupedBarSeries[];
  items: GroupedBarItem[];
  emptyMessage?: string;
}

function StatisticsGroupedBarChart({
  title,
  description,
  series,
  items,
  emptyMessage = 'אין נתונים להצגה.',
}: StatisticsGroupedBarChartProps) {
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
