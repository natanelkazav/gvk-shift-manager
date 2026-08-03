interface BarItem {
  label: string;

  value: number;
}

interface StatisticsBarChartProps {
  title: string;

  description?: string;

  items:
    BarItem[];

  emptyMessage?: string;
}

function StatisticsBarChart({
  title,
  description,
  items,
  emptyMessage =
    'אין נתונים להצגה.',
}: StatisticsBarChartProps) {
  const maximumValue =
    Math.max(
      0,
      ...items.map(
        (
          item,
        ) =>
          item.value,
      ),
    );

  return (
    <article className="statistics-chart-card">
      <header>
        <div>
          <h3>
            {title}
          </h3>

          {description ? (
            <p>
              {description}
            </p>
          ) : null}
        </div>
      </header>

      {items.length ===
      0 ? (
        <div className="statistics-chart-empty">
          {emptyMessage}
        </div>
      ) : (
        <div className="statistics-bars">
          {items.map(
            (
              item,
            ) => {
              const percentage =
                maximumValue >
                0
                  ? Math.max(
                      4,
                      Math.round(
                        (
                          item.value /
                          maximumValue
                        ) *
                        100,
                      ),
                    )
                  : 0;

              return (
                <div
                  key={
                    item.label
                  }
                  className="statistics-bar-row"
                >
                  <span>
                    {
                      item.label
                    }
                  </span>

                  <div className="statistics-bar-track">
                    <i
                      style={{
                        width:
                          `${percentage}%`,
                      }}
                    />
                  </div>

                  <strong>
                    {
                      item.value
                    }
                  </strong>
                </div>
              );
            },
          )}
        </div>
      )}
    </article>
  );
}

export default StatisticsBarChart;