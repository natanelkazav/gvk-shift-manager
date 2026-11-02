/**
 * קובץ: src/features/statistics/components/StatisticsPieChart.tsx
 * מטרה: מימוש רכיב תצוגה ואינטראקציה עבור סטטיסטיקה.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: PieSlice, StatisticsPieChartProps, createConicGradient, StatisticsPieChart.
 * - קישור מאפיינים ומצב מקומי לתצוגה ולטיפול בפעולות המשתמש.
 */
/**
 * חוזה הנתונים PieSlice: הנתון PieSlice בהקשר הפעולה.
 */
interface PieSlice {
  // label — תווית.
  label: string;

  // value — ערך.
  value: number;
}

/**
 * חוזה הנתונים StatisticsPieChartProps: סטטיסטיקה / מאפייני הרכיב.
 */
interface StatisticsPieChartProps {
  // title — כותרת.
  title: string;

  description?: string;

  slices:
    PieSlice[];
  // valueFormatter — ערך (אופציונלי).
  valueFormatter?: (value: number) => string;
}

// chartColors — הנתון chartColors בהקשר הפעולה.
const chartColors = [
  '#2563eb',
  '#0f766e',
  '#d97706',
  '#7c3aed',
  '#dc2626',
  '#0891b2',
];

/**
 * פעולה createConicGradient: יצירת הנתון createConicGradient בהקשר הפעולה.
 * @param slices — הנתון slices בהקשר הפעולה.
 * @returns string — הפלט בהתאם לחתימה.
 */
function createConicGradient(
  slices:
    PieSlice[],
): string {
  // total — סך הכול.
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

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר total <= 0.
  if (
    total <=
    0
  ) {
    return '#e5e7eb';
  }

  // currentPercentage — הנתון currentPercentage בהקשר הפעולה.
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

/**
 * פעולה StatisticsPieChart: סטטיסטיקה.
 * פרמטר מפורק — שדות הקלט נגישים מקומית בשמות המוגדרים בחתימה.
 */
function StatisticsPieChart({
  title,
  description,
  slices,
  valueFormatter = (value) => String(value),
}: StatisticsPieChartProps) {
  // total — סך הכול.
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
              {valueFormatter(total)}
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
                  {valueFormatter(slice.value)}
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