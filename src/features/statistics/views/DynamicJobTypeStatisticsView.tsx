/**
 * קובץ: src/features/statistics/views/DynamicJobTypeStatisticsView.tsx
 * מטרה: מימוש רכיב תצוגה ואינטראקציה עבור סוג תפקיד.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: ViewMode, Props, displayName, formatHours, DynamicJobTypeStatisticsView.
 * - קישור מאפיינים ומצב מקומי לתצוגה ולטיפול בפעולות המשתמש.
 */
import { useEffect, useState } from 'react';
import { attendanceService } from '../../../services/attendanceService';
import type { AttendanceStatisticsRow } from '../../../types/attendance';
import {
  AlertTriangle,
  CalendarDays,
  Clock3,
  Edit3,
  Pencil,
  UserRoundCheck,
  Users,
  UserX,
  WalletCards,
} from 'lucide-react';

import Modal from '../../../components/ui/Modal';

import type { DynamicStatisticsWorkspace } from '../../../types/dynamicStatistics';
import StatisticsBarChart from '../components/StatisticsBarChart';
import StatisticsPieChart from '../components/StatisticsPieChart';

/**
 * טיפוס ViewMode: מצב פעולה.
 */
type ViewMode = 'overview' | 'charts' | 'tables' | 'availability' | 'payroll';

/**
 * חוזה הנתונים Props: מאפייני הרכיב.
 */
interface Props {
  // data — נתונים.
  data: DynamicStatisticsWorkspace;
  // selectedUserIds — מזהי המשתמשים שנבחרו.
  selectedUserIds: string[];
  // mode — מצב פעולה.
  mode: ViewMode;
  // attendanceEnabled — נוכחות / האם האפשרות מופעלת (אופציונלי).
  attendanceEnabled?: boolean;
}

/**
 * פעולה displayName: שם תצוגה.
 * @param displayNameValue — שם תצוגה.
 * @param scheduleName — שיבוץ / שם.
 * @returns string — הפלט בהתאם לחתימה.
 */
function displayName(
  displayNameValue: string,
  scheduleName: string | null,
): string {
  return scheduleName?.trim() || displayNameValue.trim() || 'ללא שם';
}

/**
 * פעולה formatHours: עיצוב ערך לתצוגה עבור שעות.
 * @param value — ערך.
 * @returns string — הפלט בהתאם לחתימה.
 */
function formatHours(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

/**
 * פעולה DynamicJobTypeStatisticsView: סוג תפקיד.
 * פרמטר מפורק — שדות הקלט נגישים מקומית בשמות המוגדרים בחתימה.
 */
function DynamicJobTypeStatisticsView({
  data,
  selectedUserIds,
  mode,
  attendanceEnabled = false,
}: Props) {
  // selected — נבחר; אוסף ערכים ייחודיים.
  const selected = new Set(selectedUserIds);
  // מצב מקומי: attendanceRows — נוכחות / שורות; setAttendanceRows מעדכנת אותו ומפעילה רינדור לפי React.
  const [attendanceRows, setAttendanceRows] = useState<AttendanceStatisticsRow[]>([]);
  // מצב מקומי: attendanceError — נוכחות / שגיאה; setAttendanceError מעדכנת אותו ומפעילה רינדור לפי React.
  const [attendanceError, setAttendanceError] = useState<string | null>(null);
  // מצב מקומי: attendanceRefresh — נוכחות; setAttendanceRefresh מעדכנת אותו ומפעילה רינדור לפי React.
  const [attendanceRefresh, setAttendanceRefresh] = useState(0);
  // מצב מקומי: editingAttendance — נוכחות; setEditingAttendance מעדכנת אותו ומפעילה רינדור לפי React.
  const [editingAttendance, setEditingAttendance] = useState<AttendanceStatisticsRow | null>(null);
  // מצב מקומי: editClockIn — הנתון editClockIn בהקשר הפעולה; setEditClockIn מעדכנת אותו ומפעילה רינדור לפי React.
  const [editClockIn, setEditClockIn] = useState('');
  // מצב מקומי: editClockOut — הנתון editClockOut בהקשר הפעולה; setEditClockOut מעדכנת אותו ומפעילה רינדור לפי React.
  const [editClockOut, setEditClockOut] = useState('');
  // מצב מקומי: editReason — הנתון editReason בהקשר הפעולה; setEditReason מעדכנת אותו ומפעילה רינדור לפי React.
  const [editReason, setEditReason] = useState('');
  // מצב מקומי: editSaving — שמירה; setEditSaving מעדכנת אותו ומפעילה רינדור לפי React.
  const [editSaving, setEditSaving] = useState(false);
  // מצב מקומי: editError — שגיאה; setEditError מעדכנת אותו ומפעילה רינדור לפי React.
  const [editError, setEditError] = useState<string | null>(null);
  // תופעת לוואי לאחר רינדור בהתאם לתלויות [mode,attendanceEnabled,data.jobType.jobTypeId,data.filters.years,data.filters.months,selectedUserIds,attendanceRefresh].
  useEffect(() => {
    // shouldLoadAttendance — נוכחות.
    const shouldLoadAttendance = attendanceEnabled && (mode === 'tables' || (mode === 'overview' && selectedUserIds.length === 1));
    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !shouldLoadAttendance.
    if (!shouldLoadAttendance) {
      setAttendanceRows([]);
      setAttendanceError(null);
      return;
    }
    let cancelled=false;
    void attendanceService.getStatistics(data.jobType.jobTypeId,data.filters.years,data.filters.months,selectedUserIds).then((rows)=>{if(!cancelled){setAttendanceRows(rows);setAttendanceError(null);}}).catch((error)=>{if(!cancelled)setAttendanceError(error instanceof Error?error.message:'לא ניתן לטעון נוכחות');});
    return ()=>{cancelled=true;};
  },[mode,attendanceEnabled,data.jobType.jobTypeId,data.filters.years,data.filters.months,selectedUserIds,attendanceRefresh]);
  const people = selected.size === 0
    ? data.people
    : data.people.filter((row) => selected.has(row.userId));
  // availabilityPeople — אילוצים וזמינות.
  const availabilityPeople = selected.size === 0
    ? data.availabilityPeople
    : data.availabilityPeople.filter((row) => selected.has(row.userId));

  // filteredAssignmentCount — הקצאה / כמות.
  const filteredAssignmentCount = people.reduce(
    (sum, row) => sum + row.assignmentCount,
    0,
  );
  // filteredTimedHours — שעות.
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
  // visibleAssignments — הקצאות.
  const visibleAssignments = selected.size === 0 ? data.summary.assignmentCount : filteredAssignmentCount;
  // visibleHours — שעות.
  const visibleHours = selected.size === 0 ? data.summary.timedHours : filteredTimedHours;
  // workersWithAssignments — הקצאות.
  const workersWithAssignments = people.filter((row) => row.assignmentCount > 0).length;
  // averageAssignmentsPerWorker — הקצאות.
  const averageAssignmentsPerWorker = workersWithAssignments ? visibleAssignments / workersWithAssignments : 0;
  // averageHoursPerTimedAssignment — שעות / הקצאה.
  const averageHoursPerTimedAssignment = data.summary.timedAssignmentCount ? visibleHours / data.summary.timedAssignmentCount : 0;

  /**
   * פעולה formatCurrency: עיצוב ערך לתצוגה עבור הנתון formatCurrency בהקשר הפעולה.
   * @param value — ערך.
   * @returns string — הפלט בהתאם לחתימה.
   */
  const formatCurrency = (value: number): string => new Intl.NumberFormat('he-IL', {
    style: 'currency',
    currency: 'ILS',
    maximumFractionDigits: 2,
  }).format(value);
  // singleSelectedPayroll — נבחר / חישובי שכר.
  const singleSelectedPayroll = selectedUserIds.length === 1
    ? data.payrollPeople.find((row) => row.userId === selectedUserIds[0])
    : null;
  // attendanceActualPay — נוכחות.
  const attendanceActualPay = attendanceRows.reduce((sum, row) => sum + (row.wage ?? 0), 0);

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר mode === 'overview'.
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
          <article>
            <CalendarDays size={22} aria-hidden="true" />
            <div><span>ממוצע שיבוצים לעובד פעיל</span><strong>{formatHours(averageAssignmentsPerWorker)}</strong></div>
          </article>
          <article>
            <Clock3 size={22} aria-hidden="true" />
            <div><span>ממוצע שעות לשיבוץ מתוזמן</span><strong>{formatHours(averageHoursPerTimedAssignment)}</strong></div>
          </article>

          {attendanceEnabled && selectedUserIds.length === 1 ? (
            <>
              <article>
                <WalletCards size={22} aria-hidden="true" />
                <div>
                  <span>שכר לפי כניסה ויציאה</span>
                  <strong>{formatCurrency(attendanceActualPay)}</strong>
                </div>
              </article>
              <article>
                <WalletCards size={22} aria-hidden="true" />
                <div>
                  <span>שכר לפי משמרות</span>
                  <strong>{singleSelectedPayroll ? formatCurrency(singleSelectedPayroll.projectedPay) : '—'}</strong>
                </div>
              </article>
            </>
          ) : null}
        </div>

        {data.summary.untimedAssignmentCount > 0 ? (
          <div className="statistics-inline-warning">
            {data.summary.untimedAssignmentCount} שיבוצים הם יחידות עבודה ללא שעות התחלה/סיום, ולכן אינם נכללים בסך השעות. זה תקין למשל בכוננות יומית.
          </div>
        ) : null}
      </section>
    );
  }

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר mode === 'charts'.
  if (mode === 'charts') {
    return (
      <div className="statistics-charts-grid">
        <StatisticsPieChart
          title="חלוקת שיבוצים לפי סוג עבודה"
          description="היחס בין סוגי המשמרות או יחידות העבודה בתקופה שנבחרה."
          slices={data.shifts.filter((row) => row.assignmentCount > 0).map((row) => ({ label: row.shiftName || row.shiftCode, value: row.assignmentCount }))}
        />

        <StatisticsPieChart
          title="חלוקת עומס בין עובדים"
          description="איזה חלק מסך השיבוצים בוצע על ידי כל עובד שנבחר."
          slices={people.filter((row) => row.assignmentCount > 0).map((row) => ({ label: displayName(row.displayName,row.scheduleName), value: row.assignmentCount }))}
        />

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
          title="שיבוצים לפי חודש"
          items={data.monthly.map((row) => ({
            label: `${String(row.month).padStart(2, '0')}/${row.year}`,
            value: row.assignmentCount,
          }))}
        />
      </div>
    );
  }


  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר mode === 'payroll'.
  if (mode === 'payroll') {
    // visiblePayroll — חישובי שכר.
    const visiblePayroll = selected.size === 0
      ? data.payrollPeople
      : data.payrollPeople.filter((row) => selected.has(row.userId));
    // totalPay — סך הכול.
    const totalPay = visiblePayroll.reduce((sum, row) => sum + row.projectedPay, 0);
    return (
      <>
        <section className="statistics-section">
          <header>
            <div>
              <h2>שכר צפוי · {data.jobType.name}</h2>
              <p>מחושב מהשיבוצים שנבחרו: התפקיד קובע את שיטת החישוב, והתעריף נלקח מהגדרת השכר האישית של כל עובד.</p>
            </div>
          </header>
          <div className="statistics-summary-grid">
            <article>
              <WalletCards size={22} aria-hidden="true" />
              <div><span>שכר צפוי</span><strong>{formatCurrency(totalPay)}</strong></div>
            </article>
            <article>
              <Clock3 size={22} aria-hidden="true" />
              <div><span>שעות מתוזמנות</span><strong>{formatHours(visiblePayroll.reduce((sum,row)=>sum+row.timedHours,0))}</strong></div>
            </article>
          </div>
        </section>

        <div className="statistics-charts-grid">
          <StatisticsBarChart
            title="שכר צפוי לפי עובד"
            items={visiblePayroll.filter((row) => row.projectedPay > 0).map((row) => ({
              label: displayName(row.displayName, row.scheduleName),
              value: Math.round(row.projectedPay * 100) / 100,
            }))}
          />
        </div>

        <section className="statistics-section">
          <div className="statistics-table-wrapper">
            <table className="statistics-table">
              <thead><tr><th>עובד</th><th>תעריף אישי</th><th>שיבוצים</th><th>ימי עבודה</th><th>שעות</th><th>שכר צפוי</th></tr></thead>
              <tbody>
                {visiblePayroll.map((row) => (
                  <tr key={row.userId}>
                    <td><strong>{displayName(row.displayName, row.scheduleName)}</strong></td>
                    <td>{row.compensationRate == null ? 'לא הוגדר' : formatCurrency(row.compensationRate)}</td>
                    <td>{row.assignmentCount}</td>
                    <td>{row.workDayCount}</td>
                    <td>{formatHours(row.timedHours)}</td>
                    <td>{formatCurrency(row.projectedPay)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </>
    );
  }

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר mode === 'availability'.
  if (mode === 'availability') {
    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !data.jobType.availabilityEnabled && data.availabilitySummary.periodCount === 0.
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

  /**
   * פעולה money: הנתון money בהקשר הפעולה.
   * @param value — ערך.
   */
  const money = (value: number | null) => value == null
    ? '—'
    : new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS' }).format(value);
  /**
   * פעולה dateTime: תאריך / זמן.
   * @param value — ערך.
   */
  const dateTime = (value: string | null) => value
    ? new Intl.DateTimeFormat('he-IL', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
    : '—';
  /**
   * פעולה mapLink: מיפוי מפת התאמה.
   * @param lat — הנתון lat בהקשר הפעולה.
   * @param lng — הנתון lng בהקשר הפעולה.
   */
  const mapLink = (lat: number | null, lng: number | null) => lat == null || lng == null
    ? null
    : `https://www.google.com/maps?q=${lat},${lng}`;
  /**
   * פעולה formatWorkedHours: עיצוב ערך לתצוגה עבור שעות.
   * @param value — ערך.
   * @returns string — הפלט בהתאם לחתימה.
   */
  const formatWorkedHours = (value: number): string => value.toFixed(2);
  /**
   * פעולה toLocalInput: המרה עבור קלט.
   * @param value — ערך.
   * @returns string — הפלט בהתאם לחתימה.
   */
  const toLocalInput = (value: string | null): string => {
    if (!value) return '';
    // date — תאריך.
    const date = new Date(value);
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0,16);
  };
  /**
   * פעולה openAttendanceEdit: פתיחת נוכחות.
   * @param row — שורה.
   */
  const openAttendanceEdit = (row: AttendanceStatisticsRow) => {
    setEditingAttendance(row);
    setEditClockIn(toLocalInput(row.clockInAt));
    setEditClockOut(toLocalInput(row.clockOutAt));
    setEditReason('');
    setEditError(null);
  };
  /**
   * פעולה אסינכרונית saveAttendanceEdit: שמירת נוכחות.
   */
  const saveAttendanceEdit = async () => {
    if (!editingAttendance || !editClockIn) return;
    setEditSaving(true); setEditError(null);
    // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
    try {
      await attendanceService.updateSession(editingAttendance.id,new Date(editClockIn).toISOString(),editClockOut?new Date(editClockOut).toISOString():null,editReason);
      setEditingAttendance(null); setAttendanceRefresh((value)=>value+1);
    } catch(error) { setEditError(error instanceof Error?error.message:'לא ניתן לשמור את התיקון'); }
    finally { setEditSaving(false); }
  };
  /**
   * פעולה attendanceTime: נוכחות / זמן.
   * @param value — ערך.
   * @param edited — הנתון edited בהקשר הפעולה.
   * @param missing — הנתון missing בהקשר הפעולה.
   */
  const attendanceTime = (value:string|null,edited:boolean,missing=false) => {
    if (missing) return <span className="attendance-missing-exit"><AlertTriangle size={16} aria-hidden="true" /> לא ביצע יציאה</span>;
    if (!value) return '—';
    return <span className="attendance-time-source" title={edited?'נערך על ידי מנהל התפקיד':'דווח על ידי בעל התפקיד'}>{edited?<Pencil size={16} aria-hidden="true" />:<UserRoundCheck size={16} aria-hidden="true" />}{dateTime(value)}</span>;
  };
  /**
   * פעולה locationCell: הנתון locationCell בהקשר הפעולה.
   * @param lat — הנתון lat בהקשר הפעולה.
   * @param lng — הנתון lng בהקשר הפעולה.
   * @param distanceM — הנתון distanceM בהקשר הפעולה.
   * @param withinRadius — הנתון withinRadius בהקשר הפעולה.
   */
  const locationCell = (lat: number | null, lng: number | null, distanceM: number | null, withinRadius: boolean | null) => {
    const href = mapLink(lat, lng);
    if (!href) return '—';
    const outside = withinRadius === false;
    return (
      <span className={outside ? 'attendance-location attendance-location--outside' : 'attendance-location'}>
        {outside ? <AlertTriangle size={17} aria-label="מחוץ לרדיוס המותר" /> : null}
        {distanceM != null ? <span>{Math.round(distanceM)} מ׳</span> : null}
        <span>·</span>
        <a href={href} target="_blank" rel="noreferrer">Google Maps</a>
        {outside ? <strong>מחוץ לרדיוס</strong> : null}
      </span>
    );
  };

  return (
    <>
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

    {attendanceEnabled ? (
      <section className="statistics-section">
        <header>
          <div>
            <h2>נוכחות ושכר בפועל</h2>
            <p>דיווחי הכניסה והיציאה של העובדים שנבחרו, כולל מיקום הדיווח וחישוב השכר בפועל.</p>
          </div>
        </header>
        {attendanceError ? <div className="statistics-error">{attendanceError}</div> : null}
        <div className="statistics-table-wrapper">
          <table className="statistics-table">
            <thead><tr><th>עובד</th><th>תאריך</th><th>כניסה</th><th>מיקום כניסה</th><th>יציאה</th><th>מיקום יציאה</th><th>שעות בפועל</th><th>תעריף</th><th>שכר</th><th>פעולות</th></tr></thead>
            <tbody>
              {attendanceRows.map((row) => (
                <tr key={row.id}>
                  <td><strong>{displayName(row.displayName, row.scheduleName)}</strong></td>
                  <td>{row.workDate}</td>
                  <td>{attendanceTime(row.clockInAt,row.clockInEdited)}</td>
                  <td>{row.clockInEdited ? '---------' : locationCell(row.clockInLat, row.clockInLng, row.clockInDistanceM, row.clockInWithinRadius)}</td>
                  <td>{attendanceTime(row.clockOutAt,row.clockOutEdited,row.missingExit)}</td>
                  <td>{row.clockOutEdited ? '---------' : locationCell(row.clockOutLat, row.clockOutLng, row.clockOutDistanceM, row.clockOutWithinRadius)}</td>
                  <td>{row.workedHours == null ? 'פתוח' : formatWorkedHours(row.workedHours)}</td>
                  <td>{money(row.hourlyRate)}</td>
                  <td><strong>{money(row.wage)}</strong></td>
                  <td>{row.canEdit ? <button type="button" className="attendance-edit-button" onClick={()=>openAttendanceEdit(row)}><Edit3 size={16} aria-hidden="true" /> עריכה</button> : row.archived ? <span className="attendance-archived-label">ארכיון</span> : '—'}</td>
                </tr>
              ))}
              {attendanceRows.length === 0 ? <tr><td colSpan={10}>אין דיווחי נוכחות בתקופה שנבחרה.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
    ) : null}
    <Modal
      isOpen={editingAttendance !== null}
      title={editingAttendance ? `עריכת נוכחות — ${displayName(editingAttendance.displayName,editingAttendance.scheduleName)}` : 'עריכת נוכחות'}
      onClose={()=>{if(!editSaving)setEditingAttendance(null);}}
      footer={<><button type="button" onClick={()=>setEditingAttendance(null)} disabled={editSaving}>ביטול</button><button type="button" className="attendance-edit-save" onClick={()=>void saveAttendanceEdit()} disabled={editSaving||!editClockIn}>{editSaving?'שומר...':'שמור תיקון'}</button></>}
    >
      <div className="attendance-edit-form">
        {editingAttendance?.archived ? <div className="attendance-archive-warning"><AlertTriangle size={18} aria-hidden="true" /> זהו חודש מארכיון. נדרשת הרשאת עריכת נוכחות בארכיון.</div> : null}
        <label>כניסה<input type="datetime-local" value={editClockIn} onChange={(event)=>setEditClockIn(event.target.value)} /></label>
        <label>יציאה<input type="datetime-local" value={editClockOut} onChange={(event)=>setEditClockOut(event.target.value)} /></label>
        <label>סיבת התיקון<textarea value={editReason} onChange={(event)=>setEditReason(event.target.value)} placeholder="לדוגמה: העובד שכח לבצע יציאה" rows={3} /></label>
        <p className="attendance-edit-note">שעה שנערכת על ידי מנהל תסומן כאירוע ערוך, והמיקום שלה יוצג כ־--------- . נתוני המיקום המקוריים נשמרים ביומן השינויים.</p>
        {editError ? <div className="statistics-error">{editError}</div> : null}
      </div>
    </Modal>
    </>
  );
}

export default DynamicJobTypeStatisticsView;
