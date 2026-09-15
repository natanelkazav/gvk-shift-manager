import { Clock3, LoaderCircle, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { dynamicShiftDisplayName } from '../../utils/dynamicShiftDisplayName';
import { dashboardWidgetService } from '../../services/dashboardWidgetService';
import type { ManagerDashboardStaffingWidget } from '../../types/dashboardWidgets';

const timeLabel = { current: 'כרגע', today: 'היום' } as const;

function formatTime(value: string) { return value.slice(0, 5); }

function ManagerConfigurableWidgets() {
  const [widgets, setWidgets] = useState<ManagerDashboardStaffingWidget[]>([]);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    let active = true;

    void dashboardWidgetService.canConfigure()
      .then(async (allowed) => {
        if (!active || !allowed) return;
        const result = await dashboardWidgetService.getDashboardWidgets();
        if (active) setWidgets(result);
      })
      .catch((error) => console.error('Manager dashboard widgets failed:', error))
      .finally(() => {
        if (active) setBusy(false);
      });

    return () => { active = false; };
  }, []);

  if (busy) return <div className="dynamic-manager-widgets-loading"><LoaderCircle className="spin" size={17}/> טוען מידע תפעולי…</div>;
  if (!widgets.length) return null;

  return (
    <div className="dynamic-manager-widget-grid">
      {widgets.map((widget) => (
        <section className="dashboard-card dynamic-manager-staffing-card" key={widget.id}>
          <div className="dashboard-card-header">
            <div className="dashboard-card-title-wrap">
              <div className="dashboard-card-icon" aria-hidden="true"><Users size={19}/></div>
              <div>
                <h2>מי {timeLabel[widget.timeScope]} · {widget.jobTypeName}</h2>
                <span className="dynamic-dashboard-role-meta">
                  {widget.timeScope === 'current' ? 'שיבוץ פעיל בזמן הנוכחי' : 'כל השיבוצים של היום'}
                </span>
              </div>
            </div>
          </div>
          <div className="dashboard-card-body dynamic-manager-staffing-body">
            {widget.assignments.length ? widget.assignments.map((assignment) => (
              <div className="dynamic-manager-staffing-row" key={assignment.assignmentId}>
                <div>
                  <strong>{assignment.displayName}</strong>
                  <span>{dynamicShiftDisplayName(assignment.shiftName, widget.workMode === 'on_call_daily' ? 'כוננות' : 'משמרת')}</span>
                </div>
                {widget.workMode !== 'on_call_daily' ? (
                  <span className="dynamic-manager-staffing-time"><Clock3 size={15}/><bdi dir="ltr">{formatTime(assignment.startTime)}–{formatTime(assignment.endTime)}</bdi></span>
                ) : null}
              </div>
            )) : (
              <div className="dynamic-manager-staffing-empty">אין שיבוץ {widget.timeScope === 'current' ? 'פעיל כרגע' : 'להיום'}.</div>
            )}
          </div>
        </section>
      ))}
    </div>
  );
}
export default ManagerConfigurableWidgets;
