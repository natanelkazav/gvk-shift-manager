/**
 * קובץ: src/features/statistics/views/MorningDriverStatisticsView.tsx
 * מטרה: מימוש רכיב תצוגה ואינטראקציה עבור כונני בוקר.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: MorningDriverStatisticsViewProps, nameOf, shiftTimeStartMinutes, buildShiftTimeSeries, buildShiftTimeItems, MorningDriverStatisticsView.
 * - קישור מאפיינים ומצב מקומי לתצוגה ולטיפול בפעולות המשתמש.
 */
import type {
  MorningDriverMonthlyBreakdownRow,
  MorningDriverStatisticsRow,
  ShiftTimeDistributionRow,
} from '../../../types/statistics';

import StatisticsBarChart
  from '../components/StatisticsBarChart';
import StatisticsPieChart
  from '../components/StatisticsPieChart';
import StatisticsTrendChart
  from '../components/StatisticsTrendChart';
import StatisticsStackedBarChart
  from '../components/StatisticsStackedBarChart';

/**
 * חוזה הנתונים MorningDriverStatisticsViewProps: כונני בוקר.
 */
interface MorningDriverStatisticsViewProps {
  // rows — שורות.
  rows: MorningDriverStatisticsRow[];
  // monthlyRows — שורות.
  monthlyRows: MorningDriverMonthlyBreakdownRow[];
  // shiftTimeRows — משמרת / זמן / שורות.
  shiftTimeRows: ShiftTimeDistributionRow[];
  // mode — מצב פעולה.
  mode: 'charts' | 'tables';
}

// monthNames — חודש.
const monthNames = [
  'ינו׳', 'פבר׳', 'מרץ', 'אפר׳', 'מאי', 'יוני',
  'יולי', 'אוג׳', 'ספט׳', 'אוק׳', 'נוב׳', 'דצמ׳',
];

/**
 * פעולה nameOf: שם.
 * @param row — שורה.
 * @returns string — הפלט בהתאם לחתימה.
 */
function nameOf(row: MorningDriverStatisticsRow): string {
  return row.scheduleName?.trim() || row.displayName.trim() || 'ללא שם';
}

/**
 * פעולה shiftTimeStartMinutes: משמרת / זמן / דקות.
 * @param shiftTime — משמרת / זמן.
 * @returns number — הפלט בהתאם לחתימה.
 */
function shiftTimeStartMinutes(
  shiftTime: string,
): number {
  const start = shiftTime.split('–')[0] ?? shiftTime.split('-')[0] ?? '';
  const [hours, minutes] = start.split(':').map(Number);

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !Number.isFinite(hours) || !Number.isFinite(minutes).
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return Number.MAX_SAFE_INTEGER;
  }

  return (hours * 60) + minutes;
}

/**
 * פעולה buildShiftTimeSeries: הרכבת משמרת / זמן.
 * @param rows — שורות.
 */
function buildShiftTimeSeries(
  rows: ShiftTimeDistributionRow[],
) {
  return Array.from(new Set(rows.map((row) => row.shiftTime)))
    .sort((first, second) =>
      shiftTimeStartMinutes(first) - shiftTimeStartMinutes(second) ||
      first.localeCompare(second),
    )
    .map((shiftTime) => ({
      key: shiftTime,
      label: shiftTime,
    }));
}

/**
 * פעולה buildShiftTimeItems: הרכבת משמרת / זמן / פריטים.
 * @param rows — שורות.
 */
function buildShiftTimeItems(
  rows: ShiftTimeDistributionRow[],
) {
  // items — פריטים; מיפוי לחיפוש לפי מפתח.
  const items = new Map<
    string,
    {
      // key — מפתח.
      key: string;
      // label — תווית.
      label: string;
      // values — ערכים.
      values: Record<string, number>;
    }
  >();

  // עיבוד כל פריט מתוך rows בנפרד.
  for (const row of rows) {
    // current — הנתון current בהקשר הפעולה.
    const current = items.get(row.userId) ?? {
      key: row.userId,
      label: row.scheduleName?.trim() || row.displayName.trim() || 'ללא שם',
      values: {},
    };

    current.values[row.shiftTime] =
      (current.values[row.shiftTime] ?? 0) + row.shiftCount;

    items.set(row.userId, current);
  }

  return Array.from(items.values()).sort(
    (first, second) => first.label.localeCompare(second.label, 'he'),
  );
}

/**
 * פעולה MorningDriverStatisticsView: כונני בוקר.
 * פרמטר מפורק — שדות הקלט נגישים מקומית בשמות המוגדרים בחתימה.
 */
function MorningDriverStatisticsView({
  rows,
  monthlyRows,
  shiftTimeRows,
  mode,
}: MorningDriverStatisticsViewProps) {
  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר mode === 'tables'.
  if (mode === 'tables') {
    return (
      <section className="statistics-section">
        <header>
          <div>
            <h2>פירוט כונני בוקר</h2>
            <p>חלוקת השיבוצים בפועל לפי שעות וסופי שבוע.</p>
          </div>
        </header>

        <div className="statistics-table-wrapper">
          <table className="statistics-table">
            <thead>
              <tr>
                <th>כונן בוקר</th>
                <th>סה״כ שיבוצים</th>
                <th>בוקר</th>
                <th>צהריים</th>
                <th>ערב</th>
                <th>שישי</th>
                <th>סוף שבוע</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.userId}>
                  <td><strong>{nameOf(row)}</strong></td>
                  <td>{row.totalShifts}</td>
                  <td>{row.morningShifts}</td>
                  <td>{row.afternoonShifts}</td>
                  <td>{row.eveningShifts}</td>
                  <td>{row.fridayShifts}</td>
                  <td>{row.weekendShifts}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    );
  }

  const monthlyTotals = new Map<string, number>();
  // עיבוד כל פריט מתוך monthlyRows בנפרד.
  for (const row of monthlyRows) {
    // key — מפתח.
    const key = `${row.year}-${String(row.month).padStart(2, '0')}`;
    monthlyTotals.set(key, (monthlyTotals.get(key) ?? 0) + row.totalShifts);
  }

  // shiftTimeSeries — משמרת / זמן.
  const shiftTimeSeries =
    buildShiftTimeSeries(shiftTimeRows);

  // shiftTimeItems — משמרת / זמן / פריטים.
  const shiftTimeItems =
    buildShiftTimeItems(shiftTimeRows);

  return (
    <div className="statistics-charts-grid">
      <StatisticsBarChart
        title="שיבוצים לפי כונן בוקר"
        description="מספר השיבוצים בפועל בתקופה שנבחרה."
        items={rows.map((row) => ({ label: nameOf(row), value: row.totalShifts }))}
      />

      <StatisticsStackedBarChart
        title="הרכב המשמרות לפי כונן בוקר"
        description="גובה העמודה הוא מספר המשמרות בפועל. הצבעים מייצגים את שעות המשמרת האמיתיות, כולל שעות ששונו ידנית בטיוטה לפני הפרסום."
        series={shiftTimeSeries}
        items={shiftTimeItems}
      />

      <StatisticsPieChart
        title="חלוקת השיבוצים לפי חלק היום"
        description="בוקר, צהריים וערב בכל כונני הבוקר שנבחרו."
        slices={[
          { label: 'בוקר', value: rows.reduce((sum, row) => sum + row.morningShifts, 0) },
          { label: 'צהריים', value: rows.reduce((sum, row) => sum + row.afternoonShifts, 0) },
          { label: 'ערב', value: rows.reduce((sum, row) => sum + row.eveningShifts, 0) },
        ]}
      />

      <StatisticsTrendChart
        title="מגמת שיבוצי כונני בוקר"
        description="שינוי במספר השיבוצים לאורך החודשים שנבחרו."
        points={Array.from(monthlyTotals.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([key, value]) => {
            const [year, month] = key.split('-').map(Number);
            return {
              label: `${monthNames[month - 1]} ${year}`,
              value,
            };
          })}
      />
    </div>
  );
}

export default MorningDriverStatisticsView;
