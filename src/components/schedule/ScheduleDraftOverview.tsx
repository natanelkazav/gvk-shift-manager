import {
  CalendarDays,
  CheckCircle2,
  UserCheck,
  XCircle,
} from 'lucide-react';

import type {
  ScheduleDraftEditContext,
  ScheduleShift,
} from '../../types/schedule';

interface ScheduleDraftOverviewProps {
  shifts: ScheduleShift[];
  context: ScheduleDraftEditContext | null;
}

interface DispatcherBalanceRow {
  userId: string;
  displayName: string;
  scheduleName: string | null;
  weekdayEvening: number;
  weekdayNight: number;
  fridayMorning: number;
  fridayAfternoon: number;
  fridayNight: number;
  saturdayMorning: number;
  saturdayAfternoon: number;
  saturdayNight: number;
  premium: number;
  holiday: number;
  total: number;
}

type BalanceMetric = Exclude<keyof DispatcherBalanceRow, 'userId' | 'displayName' | 'scheduleName'>;

function getLocalStartHour(shift: ScheduleShift): number {
  const date = new Date(shift.startsAt);
  if (Number.isNaN(date.getTime())) {
    return 0;
  }

  return Number(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Jerusalem',
      hour: '2-digit',
      hour12: false,
    }).format(date),
  );
}

function getMetricClass(
  rows: DispatcherBalanceRow[],
  metric: BalanceMetric,
  value: number,
): string {
  if (rows.length <= 1) {
    return 'schedule-draft-balance-cell-balanced';
  }

  const values = rows.map((row) => row[metric]);
  const min = Math.min(...values);
  const max = Math.max(...values);

  if (min === max) {
    return 'schedule-draft-balance-cell-balanced';
  }

  if (value === min) {
    return 'schedule-draft-balance-cell-low';
  }

  if (value === max) {
    return max - min >= 2
      ? 'schedule-draft-balance-cell-high'
      : 'schedule-draft-balance-cell-medium';
  }

  return 'schedule-draft-balance-cell-medium';
}

function buildBalanceRows(
  shifts: ScheduleShift[],
  context: ScheduleDraftEditContext | null,
): DispatcherBalanceRow[] {
  const rows = new Map<string, DispatcherBalanceRow>();

  for (const dispatcher of context?.dispatchers ?? []) {
    rows.set(dispatcher.id, {
      userId: dispatcher.id,
      displayName: dispatcher.displayName,
      scheduleName: dispatcher.scheduleName,
      weekdayEvening: 0,
      weekdayNight: 0,
      fridayMorning: 0,
      fridayAfternoon: 0,
      fridayNight: 0,
      saturdayMorning: 0,
      saturdayAfternoon: 0,
      saturdayNight: 0,
      premium: 0,
      holiday: 0,
      total: 0,
    });
  }

  for (const shift of shifts) {
    const userId = shift.assignedUser?.id;
    if (!userId) {
      continue;
    }

    let row = rows.get(userId);
    if (!row) {
      row = {
        userId,
        displayName: shift.assignedUser?.displayName ?? 'ללא שם',
        scheduleName: shift.assignedUser?.scheduleName ?? null,
        weekdayEvening: 0,
        weekdayNight: 0,
        fridayMorning: 0,
        fridayAfternoon: 0,
        fridayNight: 0,
        saturdayMorning: 0,
        saturdayAfternoon: 0,
        saturdayNight: 0,
        premium: 0,
        holiday: 0,
        total: 0,
      };
      rows.set(userId, row);
    }

    row.total += 1;
    if (shift.isPremium) {
      row.premium += 1;
    }

    if (
      shift.scheduleType === 'holiday_eve' ||
      shift.scheduleType === 'holiday_full' ||
      shift.scheduleType === 'holiday_end' ||
      shift.scheduleType === 'chol_hamoed' ||
      Boolean(shift.holidayName)
    ) {
      row.holiday += 1;
    }

    const hour = getLocalStartHour(shift);

    if (shift.scheduleType === 'friday') {
      if (hour >= 21 || hour < 6) row.fridayNight += 1;
      else if (hour < 12) row.fridayMorning += 1;
      else row.fridayAfternoon += 1;
      continue;
    }

    if (shift.scheduleType === 'saturday') {
      if (hour >= 21 || hour < 6) row.saturdayNight += 1;
      else if (hour < 12) row.saturdayMorning += 1;
      else row.saturdayAfternoon += 1;
      continue;
    }

    if (hour >= 22 || hour < 6) row.weekdayNight += 1;
    else row.weekdayEvening += 1;
  }

  return Array.from(rows.values()).sort((first, second) =>
    (first.scheduleName ?? first.displayName).localeCompare(
      second.scheduleName ?? second.displayName,
      'he',
    ),
  );
}

export default function ScheduleDraftOverview({
  shifts,
  context,
}: ScheduleDraftOverviewProps) {
  if (!context) {
    return null;
  }

  const totalShifts = context.shifts.length;
  const noAvailable = context.shifts.filter((item) => item.availableCount === 0).length;
  const singleAvailable = context.shifts.filter((item) => item.availableCount === 1).length;
  const multipleAvailable = context.shifts.filter((item) => item.availableCount > 1).length;
  const balanceRows = buildBalanceRows(shifts, context);

  const renderCell = (row: DispatcherBalanceRow, metric: BalanceMetric) => (
    <td className={getMetricClass(balanceRows, metric, row[metric])}>
      {row[metric]}
    </td>
  );

  return (
    <section className="schedule-draft-overview" aria-label="ניתוח טיוטת השיבוץ">
      <header className="schedule-draft-overview-header">
        <div>
          <span>טיוטת שיבוץ</span>
          <h2>ניתוח מועמדים ואיזון</h2>
          <p>
            תמונת מצב לפני פרסום: זמינות לכל משמרת וחלוקת סוגי המשמרות בין המוקדנים.
          </p>
        </div>
      </header>

      <div className="schedule-draft-summary-grid">
        <article>
          <CalendarDays size={21} aria-hidden="true" />
          <div><strong>{totalShifts}</strong><span>סך הכול משמרות</span></div>
        </article>
        <article className="schedule-draft-summary-danger">
          <XCircle size={21} aria-hidden="true" />
          <div><strong>{noAvailable}</strong><span>ללא זמינים</span></div>
        </article>
        <article className="schedule-draft-summary-warning">
          <UserCheck size={21} aria-hidden="true" />
          <div><strong>{singleAvailable}</strong><span>זמין יחיד</span></div>
        </article>
        <article className="schedule-draft-summary-success">
          <CheckCircle2 size={21} aria-hidden="true" />
          <div><strong>{multipleAvailable}</strong><span>כמה זמינים</span></div>
        </article>
      </div>

      <div className="schedule-draft-balance-section">
        <div className="schedule-draft-balance-heading">
          <div>
            <h3>טבלת איזון מוקדנים</h3>
            <p>הצבעים מדגישים פערים בין המוקדנים בכל סוג משמרת.</p>
          </div>
          <div className="schedule-draft-balance-legend" aria-label="מקרא צבעים">
            <span className="schedule-draft-legend-low">נמוך יחסית</span>
            <span className="schedule-draft-legend-balanced">מאוזן</span>
            <span className="schedule-draft-legend-medium">בינוני</span>
            <span className="schedule-draft-legend-high">גבוה יחסית</span>
          </div>
        </div>

        <div className="schedule-draft-balance-table-wrapper">
          <table className="schedule-draft-balance-table">
            <thead>
              <tr>
                <th rowSpan={2}>מוקדן</th>
                <th colSpan={2} className="schedule-draft-group-weekday">יום חול</th>
                <th colSpan={3} className="schedule-draft-group-friday">שישי</th>
                <th colSpan={3} className="schedule-draft-group-saturday">שבת</th>
                <th rowSpan={2} className="schedule-draft-group-premium">200%</th>
                <th rowSpan={2} className="schedule-draft-group-holiday">חג</th>
                <th rowSpan={2}>סה״כ</th>
              </tr>
              <tr>
                <th>ערב<small>16–23</small></th>
                <th>לילה<small>23–06</small></th>
                <th>בוקר<small>06–14</small></th>
                <th>צהריים<small>14–22</small></th>
                <th>לילה<small>22–06</small></th>
                <th>בוקר<small>06–14</small></th>
                <th>צהריים<small>14–22</small></th>
                <th>לילה<small>22–06</small></th>
              </tr>
            </thead>
            <tbody>
              {balanceRows.map((row) => (
                <tr key={row.userId}>
                  <td className="schedule-draft-balance-person">
                    <strong>{row.scheduleName ?? row.displayName}</strong>
                    {row.scheduleName ? <small>{row.displayName}</small> : null}
                  </td>
                  {renderCell(row, 'weekdayEvening')}
                  {renderCell(row, 'weekdayNight')}
                  {renderCell(row, 'fridayMorning')}
                  {renderCell(row, 'fridayAfternoon')}
                  {renderCell(row, 'fridayNight')}
                  {renderCell(row, 'saturdayMorning')}
                  {renderCell(row, 'saturdayAfternoon')}
                  {renderCell(row, 'saturdayNight')}
                  {renderCell(row, 'premium')}
                  {renderCell(row, 'holiday')}
                  {renderCell(row, 'total')}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
