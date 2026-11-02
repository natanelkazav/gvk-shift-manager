/**
 * קובץ: src/components/settings/DashboardWidgetSettings.tsx
 * מטרה: מימוש רכיב תצוגה ואינטראקציה עבור לוח בקרה / הגדרות.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: DashboardWidgetSettings.
 * - קישור מאפיינים ומצב מקומי לתצוגה ולטיפול בפעולות המשתמש.
 */
import { Eye, LoaderCircle, Plus, Save, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { dashboardWidgetService } from '../../services/dashboardWidgetService';
import type {
  DashboardStaffingTimeScope,
  DashboardWidgetPreference,
  DashboardWidgetSettings as SettingsPayload,
} from '../../types/dashboardWidgets';
import { Button } from '../ui';

/**
 * פעולה DashboardWidgetSettings: לוח בקרה / הגדרות.
 */
function DashboardWidgetSettings() {
  // מצב מקומי: data — נתונים; setData מעדכנת אותו ומפעילה רינדור לפי React.
  const [data, setData] = useState<SettingsPayload | null>(null);
  // מצב מקומי: widgets — הנתון widgets בהקשר הפעולה; setWidgets מעדכנת אותו ומפעילה רינדור לפי React.
  const [widgets, setWidgets] = useState<DashboardWidgetPreference[]>([]);
  // מצב מקומי: busy — הנתון busy בהקשר הפעולה; setBusy מעדכנת אותו ומפעילה רינדור לפי React.
  const [busy, setBusy] = useState(true);
  // מצב מקומי: message — הודעה; setMessage מעדכנת אותו ומפעילה רינדור לפי React.
  const [message, setMessage] = useState<string | null>(null);
  // מצב מקומי: error — שגיאה; setError מעדכנת אותו ומפעילה רינדור לפי React.
  const [error, setError] = useState<string | null>(null);

  // תופעת לוואי לאחר רינדור בהתאם לתלויות [].
  useEffect(() => {
    // active — פעיל.
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

  // ערך מחושב available — הנתון available בהקשר הפעולה; נשמר בין רינדורים עד שינוי התלויות.
  const available = useMemo(() => data?.jobTypes ?? [], [data?.jobTypes]);

  /**
   * פעולה add: הוספת הנתון add בהקשר הפעולה.
   */
  const add = () => {
    if (!available.length) return;
    setWidgets((current) => [
      ...current,
      { widgetType: 'staffing', timeScope: 'current', jobTypeId: available[0].id },
    ]);
  };

  /**
   * פעולה update: עדכון הנתון update בהקשר הפעולה.
   * @param index — מיקום באוסף.
   * @param patch — הנתון patch בהקשר הפעולה.
   */
  const update = (index: number, patch: Partial<DashboardWidgetPreference>) => {
    setWidgets((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  };

  /**
   * פעולה remove: הסרת הנתון remove בהקשר הפעולה.
   * @param index — מיקום באוסף.
   */
  const remove = (index: number) => setWidgets((current) => current.filter((_, itemIndex) => itemIndex !== index));

  /**
   * פעולה אסינכרונית save: שמירת הנתון save בהקשר הפעולה.
   */
  const save = async () => {
    setBusy(true); setError(null); setMessage(null);
    // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
    try {
      // result — תוצאה.
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
