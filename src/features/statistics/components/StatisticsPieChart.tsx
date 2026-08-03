interface PieSlice {
  label: string;

  value: number;
}

interface StatisticsPieChartProps {
  title: string;

  description?: string;

  slices:
    PieSlice[];
}

const chartColors = [
  '#2563eb',
  '#0f766e',
  '#d97706',
  '#7c3aed',
  '#dc2626',
  '#0891b2',
];

function createConicGradient(
  slices:
    PieSlice[],
): string {
  const total =
    slices.reduce(
      (
        sum,
        slice,
      ) =>
        sum +
        Math.max(
          0,
          slice.value,
        ),
      0,
    );

  if (
    total <=
    0
  ) {
    return '#e5e7eb';
  }

  let currentPercentage =
    0;

  const segments =
    slices
      .filter(
        (
          slice,
        ) =>
          slice.value >
          0,
      )
      .map(
        (
          slice,
          index,
        ) => {
          const start =
            currentPercentage;

          const size =
            (
              slice.value /
              total
            ) *
            100;

          currentPercentage +=
            size;

          return `${chartColors[
            index %
              chartColors.length
          ]} ${start}% ${currentPercentage}%`;
        },
      );

  return `conic-gradient(${segments.join(
    ', ',
  )})`;
}

function StatisticsPieChart({
  title,
  description,
  slices,
}: StatisticsPieChartProps) {
  const total =
    slices.reduce(
      (
        sum,
        slice,
      ) =>
        sum +
        Math.max(
          0,
          slice.value,
        ),
      0,
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

      <div className="statistics-pie-layout">
        <div
          className="statistics-pie"
          style={{
            background:
              createConicGradient(
                slices,
              ),
          }}
          aria-label={`${title}: ${total}`}
        >
          <div className="statistics-pie-center">
            <strong>
              {total}
            </strong>

            <span>
              סה״כ
            </span>
          </div>
        </div>

        <div className="statistics-chart-legend">
          {slices.map(
            (
              slice,
              index,
            ) => (
              <div
                key={
                  slice.label
                }
              >
                <span
                  className="statistics-chart-legend-color"
                  style={{
                    background:
                      chartColors[
                        index %
                          chartColors.length
                      ],
                  }}
                />

                <span>
                  {
                    slice.label
                  }
                </span>

                <strong>
                  {
                    slice.value
                  }
                </strong>
              </div>
            ),
          )}
        </div>
      </div>
    </article>
  );
}

export default StatisticsPieChart;