import { Eye, LoaderCircle, Plus, Save, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { dashboardWidgetService } from '../../services/dashboardWidgetService';
import type {
  DashboardStaffingTimeScope,
  DashboardWidgetPreference,
  DashboardWidgetSettings as SettingsPayload,
} from '../../types/dashboardWidgets';
import { Button } from '../ui';

function DashboardWidgetSettings() {
  const [data, setData] = useState<SettingsPayload | null>(null);
  const [widgets, setWidgets] = useState<DashboardWidgetPreference[]>([]);
  const [busy, setBusy] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void dashboardWidgetService.getSettings()
      .then((result) => {
        if (!active) return;
        setData(result);
        setWidgets(result.widgets);
      })
      .catch((e) => active && setError(e instanceof Error ? e.message : 'טעינת ההגדרות נכשלה.'))
      .finally(() => active && setBusy(false));
    return () => { active = false; };
  }, []);

  const available = useMemo(() => data?.jobTypes ?? [], [data?.jobTypes]);

  const add = () => {
    if (!available.length) return;
    setWidgets((current) => [
      ...current,
      { widgetType: 'staffing', timeScope: 'current', jobTypeId: available[0].id },
    ]);
  };

  const update = (index: number, patch: Partial<DashboardWidgetPreference>) => {
    setWidgets((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  };

  const remove = (index: number) => setWidgets((current) => current.filter((_, itemIndex) => itemIndex !== index));

  const save = async () => {
    setBusy(true); setError(null); setMessage(null);
    try {
      const result = await dashboardWidgetService.saveSettings(widgets);
      setData(result); setWidgets(result.widgets);
      setMessage('הגדרות לוח הבקרה נשמרו.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'שמירת ההגדרות נכשלה.');
    } finally { setBusy(false); }
  };

  if (busy && !data) return <div className="settings-inline-loading"><LoaderCircle className="spin" size={18}/> טוען הגדרות לוח בקרה…</div>;

  return (
    <div className="dashboard-widget-settings">
      <div className="settings-subsection-heading">
        <Eye size={20} aria-hidden="true" />
        <div>
          <h3>לוח הבקרה שלי</h3>
          <p>בחר איזה מידע תפעולי יוצג לך. ניתן להוסיף כמה כרטיסים מתפקידים שונים.</p>
        </div>
      </div>

      {error ? <div className="users-error" role="alert">{error}</div> : null}
      {message ? <div className="dashboard-widget-settings-success">{message}</div> : null}

      <div className="dashboard-widget-settings-list">
        {widgets.map((widget, index) => (
          <div className="dashboard-widget-settings-row" key={`${widget.jobTypeId}-${widget.timeScope}-${index}`}>
            <span>להראות מי</span>
            <select
              value={widget.timeScope}
              onChange={(e) => update(index, { timeScope: e.target.value as DashboardStaffingTimeScope })}
            >
              <option value="current">כרגע</option>
              <option value="today">היום</option>
            </select>
            <span>מהתפקיד</span>
            <select value={widget.jobTypeId} onChange={(e) => update(index, { jobTypeId: e.target.value })}>
              {available.map((jobType) => <option key={jobType.id} value={jobType.id}>{jobType.name}</option>)}
            </select>
            <button type="button" className="dashboard-widget-remove" onClick={() => remove(index)} aria-label="הסר כרטיס">
              <Trash2 size={17}/>
            </button>
          </div>
        ))}
      </div>

      {!widgets.length ? <p className="settings-empty-note">לא הוגדר עדיין מידע נוסף ללוח הבקרה.</p> : null}

      <div className="dashboard-widget-settings-actions">
        <Button variant="secondary" disabled={!available.length || widgets.length >= 12 || busy} onClick={add}>
          <Plus size={17}/> הוסף מידע
        </Button>
        <Button disabled={busy} onClick={() => void save()}>
          {busy ? <LoaderCircle className="spin" size={17}/> : <Save size={17}/>} שמור
        </Button>
      </div>
    </div>
  );
}

export default DashboardWidgetSettings;
