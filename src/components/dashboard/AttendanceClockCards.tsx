import { Clock3, LogIn, LogOut, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { attendanceService } from '../../services/attendanceService';
import type { AttendanceRoleWorkspace } from '../../types/attendance';
import { Button } from '../ui';

const time = (value: string) => new Intl.DateTimeFormat('he-IL', {
  hour: '2-digit',
  minute: '2-digit',
}).format(new Date(value));

export default function AttendanceClockCards() {
  const [roles, setRoles] = useState<AttendanceRoleWorkspace[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setRoles(await attendanceService.getMyWorkspace());
    } catch (loadError) {
      console.error(loadError);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (!roles.length) return null;

  const act = async (role: AttendanceRoleWorkspace, action: 'in' | 'out') => {
    setBusy(role.jobTypeId);
    setError(null);
    try {
      await attendanceService.clock(role.jobTypeId, action, role.config.requireLocation !== false);
      await load();
    } catch (actionError) {
      const message = actionError instanceof GeolocationPositionError
        ? 'לא ניתן לקבל מיקום. יש לאפשר הרשאת מיקום ל־צוות GVK.'
        : actionError instanceof Error
          ? actionError.message
          : 'הדיווח נכשל';
      setError(message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="attendance-dashboard-grid">
      {roles.map((role) => {
        const hasOpenSession = Boolean(role.openSession);
        const isBusy = busy === role.jobTypeId;

        return (
          <section className="dashboard-card attendance-clock-card" key={role.jobTypeId}>
            <div className="dashboard-card-header">
              <div className="dashboard-card-title-wrap">
                <div className="dashboard-card-icon"><Clock3 size={19} /></div>
                <div>
                  <h2>שעון עבודה · {role.jobTypeName}</h2>
                  <span>{role.config.workplaceName || 'מקום העבודה'}</span>
                </div>
              </div>
            </div>

            <div className="dashboard-card-body">
              {role.currentAssignment ? (
                <p>
                  <strong>{role.currentAssignment.shiftName}</strong>
                  {' · '}
                  <bdi dir="ltr">
                    {role.currentAssignment.startTime.slice(0, 5)}–{role.currentAssignment.endTime.slice(0, 5)}
                  </bdi>
                </p>
              ) : (
                <p>אין משמרת מתוכננת סמוך לשעה הנוכחית.</p>
              )}

              {role.openSession ? (
                <div className="attendance-active">
                  <strong>נכנסת ב־{time(role.openSession.clockInAt)}</strong>
                  <span>הכניסה נקלטה בהצלחה</span>
                </div>
              ) : null}

              {error ? <div className="users-error">{error}</div> : null}
            </div>

            <div className="dashboard-card-footer attendance-clock-actions">
              <Button
                className="attendance-clock-in-button"
                disabled={isBusy || hasOpenSession}
                onClick={() => void act(role, 'in')}
              >
                {isBusy && !hasOpenSession
                  ? <RefreshCw className="spin" size={18} />
                  : <LogIn size={18} />}
                כניסה למשמרת
              </Button>

              <Button
                variant="danger"
                className="attendance-clock-out-button"
                disabled={isBusy || !hasOpenSession}
                onClick={() => void act(role, 'out')}
              >
                {isBusy && hasOpenSession
                  ? <RefreshCw className="spin" size={18} />
                  : <LogOut size={18} />}
                יציאה מהמשמרת
              </Button>
            </div>
          </section>
        );
      })}
    </div>
  );
}
