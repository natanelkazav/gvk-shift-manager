/**
 * קובץ: src/features/statistics/components/StatisticsTrendChart.tsx
 * מטרה: מימוש רכיב תצוגה ואינטראקציה עבור סטטיסטיקה.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: TrendPoint, StatisticsTrendChartProps, StatisticsTrendChart.
 * - קישור מאפיינים ומצב מקומי לתצוגה ולטיפול בפעולות המשתמש.
 */
/**
 * חוזה הנתונים TrendPoint: הנתון TrendPoint בהקשר הפעולה.
 */
interface TrendPoint {
  // label — תווית.
  label: string;
  // value — ערך.
  value: number;
}

/**
 * חוזה הנתונים StatisticsTrendChartProps: סטטיסטיקה / מאפייני הרכיב.
 */
interface StatisticsTrendChartProps {
  // title — כותרת.
  title: string;
  description?: string;
  points: TrendPoint[];
}

/**
 * פעולה StatisticsTrendChart: סטטיסטיקה.
 * פרמטר מפורק — שדות הקלט נגישים מקומית בשמות המוגדרים בחתימה.
 */
function StatisticsTrendChart({
  title,
  description,
  points,
}: StatisticsTrendChartProps) {
  // maximumValue — ערך.
  const maximumValue =
    Math.max(
      1,
      ...points.map(
        (point) => point.value,
      ),
    );

  // width — רוחב.
  const width = 640;
  // height — גובה.
  const height = 220;
  const horizontalPadding = 42;
  const verticalPadding = 28;
  // chartWidth — רוחב.
  const chartWidth =
    width -
    horizontalPadding * 2;
  // chartHeight — גובה.
  const chartHeight =
    height -
    verticalPadding * 2;

  const coordinates =
    points.map(
      (point, index) => {
        const x =
          horizontalPadding +
          (
            points.length <= 1
              ? chartWidth / 2
              : index /
                (points.length - 1) *
                chartWidth
          );

        const y =
          verticalPadding +
          chartHeight -
          point.value /
            maximumValue *
            chartHeight;

        return {
          ...point,
          x,
          y,
        };
      },
    );

  const polylinePoints =
    coordinates
      .map(
        (point) =>
          `${point.x},${point.y}`,
      )
      .join(' ');

  return (
    <article className="statistics-chart-card statistics-trend-card">
      <header>
        <div>
          <h3>{title}</h3>

          {description ? (
            <p>{description}</p>
          ) : null}
        </div>
      </header>

      {points.length === 0 ? (
        <div className="statistics-chart-empty">
          אין נתונים להצגה.
        </div>
      ) : (
        <div className="statistics-trend-chart-wrapper">
          <svg
            className="statistics-trend-chart"
            viewBox={`0 0 ${width} ${height}`}
            role="img"
            aria-label={title}
          >
            <line
              x1={horizontalPadding}
              y1={height - verticalPadding}
              x2={width - horizontalPadding}
              y2={height - verticalPadding}
              className="statistics-trend-axis"
            />

            <polyline
              points={polylinePoints}
              className="statistics-trend-line"
              fill="none"
            />

            {coordinates.map(
              (point) => (
                <g key={point.label}>
                  <circle
                    cx={point.x}
                    cy={point.y}
                    r="5"
                    className="statistics-trend-point"
                  />

                  <text
                    x={point.x}
                    y={point.y - 12}
                    textAnchor="middle"
                    className="statistics-trend-value"
                  >
                    {point.value}
                  </text>

                  <text
                    x={point.x}
                    y={height - 7}
                    textAnchor="middle"
                    className="statistics-trend-label"
                  >
                    {point.label}
                  </text>
                </g>
              ),
            )}
          </svg>
        </div>
      )}
    </article>
  );
}

export default StatisticsTrendChart;
