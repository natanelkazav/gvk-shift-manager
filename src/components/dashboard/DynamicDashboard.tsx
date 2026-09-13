import {
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  Settings2,
  Users,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import type {
  DynamicRuntimeContext,
  DynamicRuntimeRole,
} from '../../types/dynamicRuntime';

interface DynamicDashboardProps {
  context: DynamicRuntimeContext;
}

const workModeLabels: Record<DynamicRuntimeRole['workMode'], string> = {
  shifts: 'משמרות',
  on_call_hourly: 'כוננות שעתית',
  on_call_daily: 'כוננות יומית',
};

const strategyLabels: Record<DynamicRuntimeRole['schedulingStrategy'], string> = {
  availability_optimizer: 'שיבוץ לפי אילוצים',
  monthly_rotation_constraints: 'סבב חודשי + אילוצים',
};

function formatDate(value: string): string {
  const [year, month, day] = value.split('-').map(Number);
  return new Intl.DateTimeFormat('he-IL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(year, month - 1, day));
}

function formatTime(value: string): string {
  return value.slice(0, 5);
}

function getAvailabilityText(role: DynamicRuntimeRole): string {
  if (!role.availabilityEnabled) return 'התפקיד אינו משתמש במערכת אילוצים';
  if (!role.availability) return 'אין כרגע תקופת אילוצים פעילה';

  if (role.availability.submissionStatus === 'submitted') {
    return `האילוצים הוגשו · ${role.availability.filledCount}/${role.availability.slotCount}`;
  }

  return `מולאו ${role.availability.filledCount}/${role.availability.slotCount} משמרות`;
}

function DynamicDashboard({ context }: DynamicDashboardProps) {
  return (
    <div className="dynamic-dashboard-stack">
      <section className="dashboard-card dynamic-dashboard-intro">
        <div className="dashboard-card-body">
          <div className="dynamic-dashboard-intro-icon" aria-hidden="true">
            <Settings2 size={24} />
          </div>
          <div>
            <h2>סביבת העבודה שלי</h2>
            <p>
              התצוגה נבנית אוטומטית מהתפקידים שהוגדרו לך במערכת — ללא תלות
              בתפקידי Legacy קבועים.
            </p>
          </div>
        </div>
      </section>

      <div className="dynamic-dashboard-role-grid">
        {context.roles.map((role) => (
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

              <div className="dynamic-dashboard-fact">
                <CheckCircle2 size={18} aria-hidden="true" />
                <div>
                  <strong>אילוצים</strong>
                  <span>{getAvailabilityText(role)}</span>
                </div>
              </div>
            </div>

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
