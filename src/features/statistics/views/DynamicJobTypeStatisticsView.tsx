import {
  CalendarDays,
  Clock3,
  Edit3,
  Users,
  UserX,
} from 'lucide-react';

import type { DynamicStatisticsWorkspace } from '../../../types/dynamicStatistics';
import StatisticsBarChart from '../components/StatisticsBarChart';
import StatisticsPieChart from '../components/StatisticsPieChart';

type ViewMode = 'overview' | 'charts' | 'tables' | 'availability';

interface Props {
  data: DynamicStatisticsWorkspace;
  selectedUserIds: string[];
  mode: ViewMode;
}

function displayName(
  displayNameValue: string,
  scheduleName: string | null,
): string {
  return scheduleName?.trim() || displayNameValue.trim() || 'ללא שם';
}

function formatHours(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function DynamicJobTypeStatisticsView({
  data,
  selectedUserIds,
  mode,
}: Props) {
  const selected = new Set(selectedUserIds);
  const people = selected.size === 0
    ? data.people
    : data.people.filter((row) => selected.has(row.userId));
  const availabilityPeople = selected.size === 0
    ? data.availabilityPeople
    : data.availabilityPeople.filter((row) => selected.has(row.userId));

  const filteredAssignmentCount = people.reduce(
    (sum, row) => sum + row.assignmentCount,
    0,
  );
  const filteredTimedHours = people.reduce(
    (sum, row) => sum + row.timedHours,
    0,
  );
  const filteredManagerEdits = people.reduce(
    (sum, row) => sum + row.managerEditedCount,
    0,
  );
  const filteredSubstitutions = people.reduce(
    (sum, row) => sum + row.substitutionCount,
    0,
  );

  if (mode === 'overview') {
    return (
      <section className="statistics-section">
        <header>
          <div>
            <h2>{data.jobType.name}</h2>
            <p>
              מדדי ליבה גנריים המחושבים מהלוחות הדינמיים ומהיסטוריה שיובאה לתפקיד הזה בלבד.
            </p>
          </div>
        </header>

        <div className="statistics-summary-grid">
          <article>
            <CalendarDays size={22} aria-hidden="true" />
            <div>
              <span>שיבוצים</span>
              <strong>{selected.size === 0 ? data.summary.assignmentCount : filteredAssignmentCount}</strong>
            </div>
          </article>

          <article>
            <Users size={22} aria-hidden="true" />
            <div>
              <span>עובדים עם שיבוץ</span>
              <strong>{people.filter((row) => row.assignmentCount > 0).length}</strong>
            </div>
          </article>

          <article>
            <Clock3 size={22} aria-hidden="true" />
            <div>
              <span>שעות מתוזמנות</span>
              <strong>{formatHours(selected.size === 0 ? data.summary.timedHours : filteredTimedHours)}</strong>
            </div>
          </article>

          <article>
            <UserX size={22} aria-hidden="true" />
            <div>
              <span>איוש חסר מכוון</span>
              <strong>{data.summary.intentionallyUnassignedCount}</strong>
            </div>
          </article>

          <article>
            <Edit3 size={22} aria-hidden="true" />
            <div>
              <span>שינויי מנהל</span>
              <strong>{selected.size === 0 ? data.summary.managerEditedCount : filteredManagerEdits}</strong>
            </div>
          </article>

          <article>
            <Users size={22} aria-hidden="true" />
            <div>
              <span>החלפות מול הסבב המקורי</span>
              <strong>{selected.size === 0 ? data.summary.substitutionCount : filteredSubstitutions}</strong>
            </div>
          </article>
        </div>

        {data.summary.untimedAssignmentCount > 0 ? (
          <div className="statistics-inline-warning">
            {data.summary.untimedAssignmentCount} שיבוצים הם יחידות עבודה ללא שעות התחלה/סיום, ולכן אינם נכללים בסך השעות. זה תקין למשל בכוננות יומית.
          </div>
        ) : null}
      </section>
    );
  }

  if (mode === 'charts') {
    return (
      <div className="statistics-charts-grid">
        <StatisticsBarChart
          title="שיבוצים לפי עובד"
          description="מספר יחידות העבודה בפועל לכל עובד בתקופה שנבחרה."
          items={people
            .filter((row) => row.assignmentCount > 0)
            .map((row) => ({
              label: displayName(row.displayName, row.scheduleName),
              value: row.assignmentCount,
            }))}
        />

        <StatisticsBarChart
          title="שעות מתוזמנות לפי עובד"
          description="מוצג רק עבור יחידות עבודה שיש להן שעות התחלה וסיום."
          items={people
            .filter((row) => row.timedHours > 0)
            .map((row) => ({
              label: displayName(row.displayName, row.scheduleName),
              value: Math.round(row.timedHours * 10) / 10,
            }))}
        />

        <StatisticsBarChart
          title="שיבוצים לפי סוג משמרת"
          items={data.shifts.map((row) => ({
            label: row.shiftName || row.shiftCode,
            value: row.assignmentCount,
          }))}
        />

        <StatisticsBarChart
          title="שיבוצים לפי חודש"
          items={data.monthly.map((row) => ({
            label: `${String(row.month).padStart(2, '0')}/${row.year}`,
            value: row.assignmentCount,
          }))}
        />
      </div>
    );
  }

  if (mode === 'availability') {
    if (!data.jobType.availabilityEnabled && data.availabilitySummary.periodCount === 0) {
      return (
        <section className="statistics-section">
          <div className="statistics-empty">
            לתפקיד הזה אין כרגע מערכת אילוצים פעילה או היסטוריית אילוצים.
          </div>
        </section>
      );
    }

    return (
      <>
        <div className="statistics-charts-grid">
          <StatisticsPieChart
            title="סטטוסי אילוצים"
            description="הספירה משתמשת בסטטוסים הגנריים של התפקיד ואינה מניחה סוג תפקיד מסוים."
            slices={[
              { label: 'זמין', value: data.availabilitySummary.availableCount },
              { label: 'לא זמין', value: data.availabilitySummary.unavailableCount },
              { label: 'מעדיף', value: data.availabilitySummary.preferredCount },
              { label: 'מעדיף שלא', value: data.availabilitySummary.avoidCount },
            ]}
          />

          <StatisticsBarChart
            title="הגשות לפי עובד"
            items={availabilityPeople.map((row) => ({
              label: displayName(row.displayName, row.scheduleName),
              value: row.submittedPeriods,
            }))}
          />
        </div>

        <section className="statistics-section">
          <header>
            <div>
              <h2>פירוט אילוצים</h2>
              <p>כל הסטטוסים נשמרים לפי התפקיד הדינמי שנבחר.</p>
            </div>
          </header>
          <div className="statistics-table-wrapper">
            <table className="statistics-table">
              <thead>
                <tr>
                  <th>עובד</th>
                  <th>תקופות שהוגשו</th>
                  <th>זמין</th>
                  <th>לא זמין</th>
                  <th>מעדיף</th>
                  <th>מעדיף שלא</th>
                  <th>סה״כ סימונים</th>
                </tr>
              </thead>
              <tbody>
                {availabilityPeople.map((row) => (
                  <tr key={row.userId}>
                    <td><strong>{displayName(row.displayName, row.scheduleName)}</strong></td>
                    <td>{row.submittedPeriods}</td>
                    <td>{row.availableCount}</td>
                    <td>{row.unavailableCount}</td>
                    <td>{row.preferredCount}</td>
                    <td>{row.avoidCount}</td>
                    <td>{row.totalEntries}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </>
    );
  }

  return (
    <section className="statistics-section">
      <header>
        <div>
          <h2>פירוט עובדים</h2>
          <p>הטבלה אינה תלויה בשם או בקטגוריית Legacy של התפקיד.</p>
        </div>
      </header>
      <div className="statistics-table-wrapper">
        <table className="statistics-table">
          <thead>
            <tr>
              <th>עובד</th>
              <th>משויך כיום</th>
              <th>שיבוצים</th>
              <th>שעות מתוזמנות</th>
              <th>חודשים עם עבודה</th>
              <th>שינויי מנהל</th>
              <th>החלפות מהסבב המקורי</th>
            </tr>
          </thead>
          <tbody>
            {people.map((row) => (
              <tr key={row.userId}>
                <td><strong>{displayName(row.displayName, row.scheduleName)}</strong></td>
                <td>{row.isMember ? 'כן' : 'לא'}</td>
                <td>{row.assignmentCount}</td>
                <td>{formatHours(row.timedHours)}</td>
                <td>{row.monthsWorked}</td>
                <td>{row.managerEditedCount}</td>
                <td>{row.substitutionCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default DynamicJobTypeStatisticsView;
