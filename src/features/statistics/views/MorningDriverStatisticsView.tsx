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

interface MorningDriverStatisticsViewProps {
  rows: MorningDriverStatisticsRow[];
  monthlyRows: MorningDriverMonthlyBreakdownRow[];
  shiftTimeRows: ShiftTimeDistributionRow[];
  mode: 'charts' | 'tables';
}

const monthNames = [
  'ינו׳', 'פבר׳', 'מרץ', 'אפר׳', 'מאי', 'יוני',
  'יולי', 'אוג׳', 'ספט׳', 'אוק׳', 'נוב׳', 'דצמ׳',
];

function nameOf(row: MorningDriverStatisticsRow): string {
  return row.scheduleName?.trim() || row.displayName.trim() || 'ללא שם';
}

function shiftTimeStartMinutes(
  shiftTime: string,
): number {
  const start = shiftTime.split('–')[0] ?? shiftTime.split('-')[0] ?? '';
  const [hours, minutes] = start.split(':').map(Number);

  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return Number.MAX_SAFE_INTEGER;
  }

  return (hours * 60) + minutes;
}

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

function buildShiftTimeItems(
  rows: ShiftTimeDistributionRow[],
) {
  const items = new Map<
    string,
    {
      key: string;
      label: string;
      values: Record<string, number>;
    }
  >();

  for (const row of rows) {
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

function MorningDriverStatisticsView({
  rows,
  monthlyRows,
  shiftTimeRows,
  mode,
}: MorningDriverStatisticsViewProps) {
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
  for (const row of monthlyRows) {
    const key = `${row.year}-${String(row.month).padStart(2, '0')}`;
    monthlyTotals.set(key, (monthlyTotals.get(key) ?? 0) + row.totalShifts);
  }

  const shiftTimeSeries =
    buildShiftTimeSeries(shiftTimeRows);

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
