/**
 * קובץ: src/components/dashboard/DynamicDashboard.tsx
 * מטרה: מימוש רכיב תצוגה ואינטראקציה עבור דינמי / לוח בקרה.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: DynamicDashboardProps, formatDate, formatTime, getAvailabilityText, DynamicDashboard.
 * - קישור מאפיינים ומצב מקומי לתצוגה ולטיפול בפעולות המשתמש.
 */
import {
  AlertTriangle,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  Users,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import './dynamicCoverageAlerts.css';
import { useEffect, useState } from 'react';
import { dynamicSchedulingService } from '../../services/dynamicSchedulingService';
import type { MyOnCallCoverageConflict, MyDynamicAvailabilityPeriod } from '../../types/dynamicScheduling';
import DailyReportDashboardCards from '../../features/dailyReports/components/DailyReportDashboardCards';
import AttendanceClockCards from './AttendanceClockCards';
import ManagerConfigurableWidgets from './ManagerConfigurableWidgets';
import ContactChangesWidget from './ContactChangesWidget';
import ActivityTrackingCards from './ActivityTrackingCards';
import type {
  DynamicRuntimeContext,
  DynamicRuntimeRole,
} from '../../types/dynamicRuntime';

/**
 * חוזה הנתונים DynamicDashboardProps: דינמי / לוח בקרה / מאפייני הרכיב.
 */
interface DynamicDashboardProps {
  context: DynamicRuntimeContext;
}

// workModeLabels — מצב פעולה.
const workModeLabels: Record<DynamicRuntimeRole['workMode'], string> = {
  none: 'ללא שיבוץ',
  shifts: 'משמרות',
  on_call_hourly: 'כוננות שעתית',
  on_call_daily: 'כוננות יומית',
};

// strategyLabels — שיטת שיבוץ.
const strategyLabels: Record<DynamicRuntimeRole['schedulingStrategy'], string> = {
  none: 'ללא שיבוצים',
  availability_optimizer: 'שיבוץ לפי אילוצים',
  monthly_rotation_constraints: 'סבב חודשי + אילוצים',
};

/**
 * פעולה formatDate: עיצוב ערך לתצוגה עבור תאריך.
 * @param value — ערך.
 * @returns string — הפלט בהתאם לחתימה.
 */
function formatDate(value: string): string {
  const [year, month, day] = value.split('-').map(Number);
  return new Intl.DateTimeFormat('he-IL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(year, month - 1, day));
}

/**
 * פעולה formatTime: עיצוב ערך לתצוגה עבור זמן.
 * @param value — ערך.
 * @returns string — הפלט בהתאם לחתימה.
 */
function formatTime(value: string): string {
  return value.slice(0, 5);
}

/**
 * פעולה getAvailabilityText: שליפה או חישוב של אילוצים וזמינות.
 * @param role — הנתון role בהקשר הפעולה.
 * @param period — תקופה.
 * @returns string — הפלט בהתאם לחתימה.
 */
function getAvailabilityText(role: DynamicRuntimeRole, period?: MyDynamicAvailabilityPeriod): string {
  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר period.
  if (period) {
    const suffix = `${String(period.month).padStart(2,'0')}/${period.year}`;
    return `${period.submissionStatus==='submitted'?'האילוצים הוגשו':'מולאו'} · ${period.filledCount}/${period.slotCount} · ${suffix}`;
  }
  if (!role.availabilityEnabled) return 'התפקיד אינו משתמש במערכת אילוצים';
  if (!role.availability) return 'אין כרגע תקופת אילוצים פעילה';

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר role.availability.submissionStatus === 'submitted'.
  if (role.availability.submissionStatus === 'submitted') {
    return `האילוצים הוגשו · ${role.availability.filledCount}/${role.availability.slotCount}`;
  }

  return `מולאו ${role.availability.filledCount}/${role.availability.slotCount} משמרות`;
}

/**
 * פעולה DynamicDashboard: דינמי / לוח בקרה.
 * פרמטר מפורק — שדות הקלט נגישים מקומית בשמות המוגדרים בחתימה.
 */
function DynamicDashboard({ context }: DynamicDashboardProps) {
  // מצב מקומי: periods — תקופות; setPeriods מעדכנת אותו ומפעילה רינדור לפי React.
  const [periods, setPeriods] = useState<MyDynamicAvailabilityPeriod[]>([]);
  // מצב מקומי: coverageConflicts — הנתון coverageConflicts בהקשר הפעולה; setCoverageConflicts מעדכנת אותו ומפעילה רינדור לפי React.
  const [coverageConflicts, setCoverageConflicts] = useState<MyOnCallCoverageConflict[]>([]);
  // תופעת לוואי לאחר רינדור בהתאם לתלויות [].
  useEffect(() => {
    // active — פעיל.
    let active = true;
    /**
     * פעולה refresh: רענון הנתון refresh בהקשר הפעולה.
     */
    const refresh = () => { void dynamicSchedulingService.getMyOnCallCoverageConflicts()
      .then((items) => { if (active) setCoverageConflicts(items); })
      .catch((error) => console.error('Failed to load on-call coverage conflicts', error)); };
    refresh();
    window.addEventListener('focus', refresh);
    window.addEventListener('gvk:dynamic-schedule-changed', refresh);
    return () => { active = false; window.removeEventListener('focus', refresh); window.removeEventListener('gvk:dynamic-schedule-changed', refresh); };
  }, []);

  // תופעת לוואי לאחר רינדור בהתאם לתלויות [].
  useEffect(() => { let active = true; dynamicSchedulingService.getMyDynamicAvailabilityPeriods().then(data => { if (active) setPeriods(data); }).catch(() => {}); return () => { active = false; }; }, []);
  /**
   * פעולה getRelevantPeriod: שליפה או חישוב של תקופה.
   * @param jobTypeId — מזהה סוג התפקיד.
   */
  const getRelevantPeriod = (jobTypeId: string) => {
    const matches = periods.filter(p => p.jobTypeId === jobTypeId && (p.periodStatus === 'open' || p.periodStatus === 'closed'));
    return matches.sort((a,b) => (a.periodStatus === 'open' ? 0 : 1) - (b.periodStatus === 'open' ? 0 : 1) || (b.year-a.year) || (b.month-a.month))[0];
  };
  return (
    <div className="dynamic-dashboard-stack">
      <ActivityTrackingCards />
      <DailyReportDashboardCards />
      <AttendanceClockCards />
      <ManagerConfigurableWidgets />
      <ContactChangesWidget />
      <div className="dynamic-dashboard-role-grid">
        {context.roles.filter((role) => !(role.workMode === 'none' && role.schedulingStrategy === 'none')).map((role) => (
          <section className="dashboard-card dynamic-dashboard-role-card" key={role.jobTypeId}>
            <div className="dashboard-card-header">
              <div className="dashboard-card-title-wrap">
                <div className="dashboard-card-icon" aria-hidden="true">
                  <Users size={19} />
                </div>
                <div>
                  <h2>{role.jobTypeName}</h2>
                  <span className="dynamic-dashboard-role-meta">
                    {workModeLabels[role.workMode]} · {strategyLabels[role.schedulingStrategy]}
                  </span>
                </div>
              </div>
              {role.isPrimary ? (
                <span className="dashboard-status-badge dashboard-status-active">תפקיד ראשי</span>
              ) : null}
            </div>

            <div className="dashboard-card-body dynamic-dashboard-role-body">
              {role.description ? <p className="dynamic-dashboard-description">{role.description}</p> : null}

              {role.schedulingStrategy !== 'none' ? (
                <>
              <div className="dynamic-dashboard-fact">
                <CalendarClock size={18} aria-hidden="true" />
                <div>
                  <strong>המשמרת הבאה</strong>
                  {role.nextAssignment ? (
                    <span>
                      {formatDate(role.nextAssignment.shiftDate)} · {role.nextAssignment.shiftName}
                      {' · '}
                      <bdi dir="ltr">{formatTime(role.nextAssignment.startTime)}–{formatTime(role.nextAssignment.endTime)}</bdi>
                    </span>
                  ) : (
                    <span>אין כרגע שיבוץ עתידי מפורסם</span>
                  )}
                </div>
              </div>

                </>
              ) : null}

              {coverageConflicts.some((item) => item.jobTypeId === role.jobTypeId) ? (
                <div className="dynamic-dashboard-coverage-alert" role="alert">
                  <AlertTriangle size={20} aria-hidden="true" />
                  <div>
                    <strong>עליך למצוא חלופה לכוננויות</strong>
                    <span>סימנת ״לא זמין״ בתאריכים שבהם שובצת לפי הסבב:</span>
                    <div className="dynamic-dashboard-coverage-dates">
                      {coverageConflicts.filter((item) => item.jobTypeId === role.jobTypeId).map((item) => <span key={item.assignmentId}>{formatDate(item.shiftDate)}</span>)}
                    </div>
                    <Link to="/my-shifts">מעבר לכוננויות שלי והגשת בקשת חילוף</Link>
                  </div>
                </div>
              ) : null}

              {role.parallelAssignments.length > 0 ? (
                <div className="dynamic-dashboard-parallel">
                  <div className="dynamic-dashboard-parallel-heading">
                    <Users size={18} aria-hidden="true" />
                    <div>
                      <strong>מי עובד במקביל</strong>
                      <span>לפי התפקידים שהוגדרו להצגה בלוח הבקרה</span>
                    </div>
                  </div>
                  <div className="dynamic-dashboard-parallel-list">
                    {role.parallelAssignments.map((assignment) => (
                      <div className="dynamic-dashboard-parallel-row" key={`${assignment.jobTypeId}-${assignment.assignmentId}`}>
                        <div>
                          <strong>{assignment.jobTypeName}</strong>
                          <span>{assignment.displayName ?? 'לא משובץ'} · {assignment.shiftName}</span>
                        </div>
                        <bdi dir="ltr">{formatTime(assignment.startTime)}–{formatTime(assignment.endTime)}</bdi>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {role.schedulingStrategy !== 'none' ? (
                <>
              <div className="dynamic-dashboard-fact">
                <CheckCircle2 size={18} aria-hidden="true" />
                <div>
                  <strong>אילוצים</strong>
                  <span>{getAvailabilityText(role, getRelevantPeriod(role.jobTypeId))}</span>
                </div>
              </div>
                </>
              ) : null}
            </div>

            {role.schedulingStrategy !== 'none' ? (
            <div className="dashboard-card-footer dynamic-dashboard-actions">
              {role.availabilityEnabled && role.availability ? (
                <Link to="/my-availability">האילוצים שלי</Link>
              ) : null}
              {role.publishedAssignmentCount > 0 ? (
                <Link to="/my-shifts">המשמרות שלי</Link>
              ) : null}
              {role.scheduleChangeMode === 'shift_exchange' && role.publishedAssignmentCount > 0 ? (
                <Link to="/my-shift-exchanges">חילופי משמרות</Link>
              ) : null}
            </div>
            ) : null}
          </section>
        ))}
      </div>

      {context.canManageDynamicScheduling && context.managedRoles.length > 0 ? (
        <section className="dashboard-card">
          <div className="dashboard-card-header">
            <div className="dashboard-card-title-wrap">
              <div className="dashboard-card-icon" aria-hidden="true">
                <CalendarDays size={19} />
              </div>
              <h2>תפקידים בניהול</h2>
            </div>
          </div>
          <div className="dashboard-card-body dynamic-dashboard-managed-grid">
            {context.managedRoles.map((role) => (
              <div className="dynamic-dashboard-managed-role" key={role.jobTypeId}>
                <strong>{role.jobTypeName}</strong>
                <span>{role.memberCount} עובדים</span>
                <span>
                  {role.currentPeriodStatus
                    ? `מצב החודש: ${role.currentPeriodStatus}`
                    : 'טרם נפתחה תקופה החודש'}
                </span>
                <span>{role.publishedAssignmentCount} שיבוצים מפורסמים החודש</span>
              </div>
            ))}
          </div>
          <div className="dashboard-card-footer dynamic-dashboard-actions">
            <Link to="/shifts">ניהול שיבוצים</Link>
            <Link to="/users">ניהול משתמשים</Link>
          </div>
        </section>
      ) : null}
    </div>
  );
}

export default DynamicDashboard;
