import {
  useState,
} from 'react';

import {
  CalendarDays,
  CheckCircle2,
  Gauge,
  Scale,
  UserCheck,
  UsersRound,
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

type BalanceMetric = Exclude<
  keyof DispatcherBalanceRow,
  'userId' | 'displayName' | 'scheduleName'
>;

type CoreShiftGroup =
  | 'weekday'
  | 'fridayLike'
  | 'saturdayLike'
  | 'holidayOnly';

type BalanceColumnGroup =
  | 'weekday'
  | 'friday'
  | 'saturday'
  | 'premium'
  | 'holiday'
  | 'total';

const balanceColumnOptions: Array<{
  key: BalanceColumnGroup;
  label: string;
}> = [
  { key: 'total', label: 'סה״כ' },
  { key: 'weekday', label: 'יום חול' },
  { key: 'friday', label: 'שישי / ערב חג' },
  { key: 'saturday', label: 'שבת / מוצאי חג' },
  { key: 'holiday', label: 'חג / מועד' },
  { key: 'premium', label: '200%' },
];

const defaultBalanceGroups = new Set<BalanceColumnGroup>([
  'total',
  'weekday',
  'friday',
  'saturday',
]);

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

function getActualWeekday(shift: ScheduleShift): number {
  const [year, month, day] = shift.shiftDate
    .split('-')
    .map(Number);

  if (!year || !month || !day) {
    return -1;
  }

  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

function getCoreShiftGroup(shift: ScheduleShift): CoreShiftGroup {
  if (shift.scheduleType === 'friday' || shift.scheduleType === 'holiday_eve') {
    return 'fridayLike';
  }

  if (shift.scheduleType === 'saturday' || shift.scheduleType === 'holiday_end') {
    return 'saturdayLike';
  }

  if (shift.scheduleType === 'holiday_full') {
    return 'holidayOnly';
  }

  if (shift.scheduleType === 'chol_hamoed') {
    const weekday = getActualWeekday(shift);
    if (weekday === 5) return 'fridayLike';
    if (weekday === 6) return 'saturdayLike';
  }

  return 'weekday';
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

    const row = rows.get(userId);
    if (!row) {
      continue;
    }

    row.total += 1;

    // Premium and holiday are cross-cutting indicators. They intentionally
    // overlap the day/time columns and therefore are not meant to sum to total.
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
    const group = getCoreShiftGroup(shift);

    if (group === 'holidayOnly') {
      continue;
    }

    if (group === 'fridayLike') {
      if (hour >= 21 || hour < 6) row.fridayNight += 1;
      else if (hour < 12) row.fridayMorning += 1;
      else row.fridayAfternoon += 1;
      continue;
    }

    if (group === 'saturdayLike') {
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

function getBalanceLabel(gap: number): string {
  if (gap === 0) return 'מאוזן לחלוטין';
  if (gap === 1) return 'איזון מצוין';
  if (gap === 2) return 'איזון טוב';
  return 'כדאי לבדוק את הפער';
}

export default function ScheduleDraftOverview({
  shifts,
  context,
}: ScheduleDraftOverviewProps) {
  const [visibleGroups, setVisibleGroups] =
    useState<Set<BalanceColumnGroup>>(
      () => new Set(defaultBalanceGroups),
    );

  if (!context) {
    return null;
  }

  const toggleBalanceGroup = (group: BalanceColumnGroup) => {
    setVisibleGroups((current) => {
      const next = new Set(current);
      if (next.has(group)) {
        next.delete(group);
      } else {
        next.add(group);
      }
      return next.size > 0 ? next : new Set(['total']);
    });
  };

  const totalShifts = context.shifts.length;
  const noAvailable = context.shifts.filter((item) => item.availableCount === 0).length;
  const singleAvailable = context.shifts.filter((item) => item.availableCount === 1).length;
  const multipleAvailable = context.shifts.filter((item) => item.availableCount > 1).length;
  const balanceRows = buildBalanceRows(shifts, context);
  const assignedShifts = balanceRows.reduce((sum, row) => sum + row.total, 0);
  const intentionallyUnassigned = shifts.filter(
    (shift) => shift.isIntentionallyUnassigned,
  ).length;
  const totals = balanceRows.map((row) => row.total);
  const minimumAssignments = totals.length > 0 ? Math.min(...totals) : 0;
  const maximumAssignments = totals.length > 0 ? Math.max(...totals) : 0;
  const assignmentGap = maximumAssignments - minimumAssignments;
  const averageAssignments = balanceRows.length > 0
    ? assignedShifts / balanceRows.length
    : 0;

  const renderCell = (row: DispatcherBalanceRow, metric: BalanceMetric) => (
    <td className={getMetricClass(balanceRows, metric, row[metric])}>
      <span className="schedule-draft-balance-value">{row[metric]}</span>
    </td>
  );

  return (
    <section className="schedule-draft-overview" aria-label="ניתוח טיוטת השיבוץ">
      <header className="schedule-draft-overview-header">
        <div>
          <span>טיוטת שיבוץ</span>
          <h2>ניתוח מועמדים ואיזון</h2>
          <p>
            הנתונים מתעדכנים לאחר כל שינוי שנשמר בטיוטה ומחושבים מהשיבוץ המוצג כרגע.
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

      <div className="schedule-draft-balance-insights">
        <article>
          <UsersRound size={20} aria-hidden="true" />
          <div>
            <strong>{assignedShifts}</strong>
            <span>משמרות מאוישות בטיוטה</span>
          </div>
          {intentionallyUnassigned > 0 ? (
            <small>{intentionallyUnassigned} לא מאוישות במכוון</small>
          ) : null}
        </article>

        <article>
          <Scale size={20} aria-hidden="true" />
          <div>
            <strong>{assignmentGap}</strong>
            <span>פער בין הכי מעט להכי הרבה</span>
          </div>
          <small>{minimumAssignments}–{maximumAssignments} משמרות למוקדן</small>
        </article>

        <article className={assignmentGap <= 2 ? 'is-balanced' : 'needs-attention'}>
          <Gauge size={20} aria-hidden="true" />
          <div>
            <strong>{getBalanceLabel(assignmentGap)}</strong>
            <span>ממוצע {averageAssignments.toFixed(1)} משמרות למוקדן</span>
          </div>
        </article>
      </div>

      <div className="schedule-draft-balance-section">
        <div className="schedule-draft-balance-heading">
          <div>
            <h3>איזון השיבוץ בפועל</h3>
            <p>
              כל שורה מחושבת מהטיוטה השמורה כרגע. צבעים משווים בין המוקדנים באותה עמודה.
            </p>
          </div>
          <div className="schedule-draft-balance-legend" aria-label="מקרא צבעים">
            <span className="schedule-draft-legend-low">נמוך יחסית</span>
            <span className="schedule-draft-legend-balanced">מאוזן</span>
            <span className="schedule-draft-legend-medium">בינוני</span>
            <span className="schedule-draft-legend-high">גבוה יחסית</span>
          </div>
        </div>

        <div className="schedule-draft-balance-controls">
          <div>
            <strong>מה להציג בטבלה?</strong>
            <span>בחרו רק את המדדים שרלוונטיים לבדיקה הנוכחית.</span>
          </div>
          <div className="schedule-draft-balance-toggles">
            {balanceColumnOptions.map((option) => (
              <label
                key={option.key}
                className={visibleGroups.has(option.key) ? 'is-active' : undefined}
              >
                <input
                  type="checkbox"
                  checked={visibleGroups.has(option.key)}
                  onChange={() => toggleBalanceGroup(option.key)}
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="schedule-draft-balance-table-wrapper">
          <table className="schedule-draft-balance-table">
            <thead>
              <tr>
                <th rowSpan={2} className="schedule-draft-person-column">מוקדן</th>
                {visibleGroups.has('weekday') ? (
                  <th colSpan={2} className="schedule-draft-group-weekday">יום חול</th>
                ) : null}
                {visibleGroups.has('friday') ? (
                  <th colSpan={3} className="schedule-draft-group-friday">שישי / ערב חג</th>
                ) : null}
                {visibleGroups.has('saturday') ? (
                  <th colSpan={3} className="schedule-draft-group-saturday">שבת / מוצאי חג</th>
                ) : null}
                {visibleGroups.has('premium') ? (
                  <th rowSpan={2} className="schedule-draft-group-premium">200%</th>
                ) : null}
                {visibleGroups.has('holiday') ? (
                  <th rowSpan={2} className="schedule-draft-group-holiday">חג / מועד</th>
                ) : null}
                {visibleGroups.has('total') ? (
                  <th rowSpan={2} className="schedule-draft-total-column">סה״כ שיבוצים</th>
                ) : null}
              </tr>
              <tr>
                {visibleGroups.has('weekday') ? (<>
                  <th>ערב<small>16–23</small></th>
                  <th>לילה<small>23–06</small></th>
                </>) : null}
                {visibleGroups.has('friday') ? (<>
                  <th>בוקר<small>06–14</small></th>
                  <th>צהריים<small>14–22</small></th>
                  <th>לילה<small>22–06</small></th>
                </>) : null}
                {visibleGroups.has('saturday') ? (<>
                  <th>בוקר<small>06–14</small></th>
                  <th>צהריים<small>14–22</small></th>
                  <th>לילה<small>22–06</small></th>
                </>) : null}
              </tr>
            </thead>
            <tbody>
              {balanceRows.map((row) => {
                const totalClass = getMetricClass(balanceRows, 'total', row.total);
                const progress = maximumAssignments > 0
                  ? Math.max(8, (row.total / maximumAssignments) * 100)
                  : 0;

                return (
                  <tr key={row.userId}>
                    <td className="schedule-draft-balance-person">
                      <strong>{row.scheduleName ?? row.displayName}</strong>
                      {row.scheduleName ? <small>{row.displayName}</small> : null}
                    </td>
                    {visibleGroups.has('weekday') ? (<>
                      {renderCell(row, 'weekdayEvening')}
                      {renderCell(row, 'weekdayNight')}
                    </>) : null}
                    {visibleGroups.has('friday') ? (<>
                      {renderCell(row, 'fridayMorning')}
                      {renderCell(row, 'fridayAfternoon')}
                      {renderCell(row, 'fridayNight')}
                    </>) : null}
                    {visibleGroups.has('saturday') ? (<>
                      {renderCell(row, 'saturdayMorning')}
                      {renderCell(row, 'saturdayAfternoon')}
                      {renderCell(row, 'saturdayNight')}
                    </>) : null}
                    {visibleGroups.has('premium') ? renderCell(row, 'premium') : null}
                    {visibleGroups.has('holiday') ? renderCell(row, 'holiday') : null}
                    {visibleGroups.has('total') ? (
                      <td className={`schedule-draft-total-cell ${totalClass}`}>
                        <strong>{row.total}</strong>
                        <span className="schedule-draft-total-track" aria-hidden="true">
                          <span style={{ width: `${progress}%` }} />
                        </span>
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <p className="schedule-draft-balance-note">
          חג ו־200% הם מדדים חופפים לבדיקת עומס ואינם חלק מחישוב הסה״כ. לכן הם מוסתרים כברירת מחדל וניתן להציג אותם לפי הצורך. הסה״כ מציג כל משמרת פעם אחת בלבד.
        </p>
      </div>
    </section>
  );
}
