/**
 * קובץ: src/components/dashboard/AttendanceClockCards.tsx
 * מטרה: מימוש רכיב תצוגה ואינטראקציה עבור נוכחות.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: AttendanceClockCards.
 * - קישור מאפיינים ומצב מקומי לתצוגה ולטיפול בפעולות המשתמש.
 */
import { Clock3, LogIn, LogOut, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { attendanceService } from '../../services/attendanceService';
import type { AttendanceRoleWorkspace } from '../../types/attendance';
import { Button } from '../ui';

/**
 * פעולה time: זמן.
 * @param value — ערך.
 */
const time = (value: string) => new Intl.DateTimeFormat('he-IL', {
  hour: '2-digit',
  minute: '2-digit',
}).format(new Date(value));

/**
 * פעולה AttendanceClockCards: נוכחות.
 */
export default function AttendanceClockCards() {
  // מצב מקומי: roles — הנתון roles בהקשר הפעולה; setRoles מעדכנת אותו ומפעילה רינדור לפי React.
  const [roles, setRoles] = useState<AttendanceRoleWorkspace[]>([]);
  // מצב מקומי: busy — הנתון busy בהקשר הפעולה; setBusy מעדכנת אותו ומפעילה רינדור לפי React.
  const [busy, setBusy] = useState<string | null>(null);
  // מצב מקומי: error — שגיאה; setError מעדכנת אותו ומפעילה רינדור לפי React.
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
    try {
      setRoles(await attendanceService.getMyWorkspace());
    } catch (loadError) {
      console.error(loadError);
    }
  }, []);

  // תופעת לוואי לאחר רינדור בהתאם לתלויות [load].
  useEffect(() => {
    void load();
  }, [load]);

  if (!roles.length) return null;

  /**
   * פעולה אסינכרונית act: הנתון act בהקשר הפעולה.
   * @param role — הנתון role בהקשר הפעולה.
   * @param action — הנתון action בהקשר הפעולה.
   */
  const act = async (role: AttendanceRoleWorkspace, action: 'in' | 'out') => {
    setBusy(role.jobTypeId);
    setError(null);
    // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
    try {
      await attendanceService.clock(role.jobTypeId, action, role.config.requireLocation !== false);
      await load();
    } catch (actionError) {
      // message — הודעה.
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
        // hasOpenSession — סשן.
        const hasOpenSession = Boolean(role.openSession);
        // isBusy — הנתון isBusy בהקשר הפעולה.
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
