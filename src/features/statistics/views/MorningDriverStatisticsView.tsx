import type {
  MorningDriverMonthlyBreakdownRow,
  MorningDriverStatisticsRow,
} from '../../../types/statistics';

import StatisticsBarChart
  from '../components/StatisticsBarChart';
import StatisticsPieChart
  from '../components/StatisticsPieChart';
import StatisticsTrendChart
  from '../components/StatisticsTrendChart';

interface MorningDriverStatisticsViewProps {
  rows: MorningDriverStatisticsRow[];
  monthlyRows: MorningDriverMonthlyBreakdownRow[];
  mode: 'charts' | 'tables';
}

const monthNames = [
  'ינו׳', 'פבר׳', 'מרץ', 'אפר׳', 'מאי', 'יוני',
  'יולי', 'אוג׳', 'ספט׳', 'אוק׳', 'נוב׳', 'דצמ׳',
];

function nameOf(row: MorningDriverStatisticsRow): string {
  return row.scheduleName?.trim() || row.displayName.trim() || 'ללא שם';
}

function MorningDriverStatisticsView({
  rows,
  monthlyRows,
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

  return (
    <div className="statistics-charts-grid">
      <StatisticsBarChart
        title="שיבוצים לפי כונן בוקר"
        description="מספר השיבוצים בפועל בתקופה שנבחרה."
        items={rows.map((row) => ({ label: nameOf(row), value: row.totalShifts }))}
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
