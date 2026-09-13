import { FlaskConical, ShieldAlert } from 'lucide-react';
import { useState } from 'react';
import { useDevelopmentMode } from '../../features/developmentMode/DevelopmentModeContext';

export default function DevelopmentModeSettings() {
  const { enabled, expiresAt, isLoading, setEnabled } = useDevelopmentMode();
  const [duration, setDuration] = useState('60');
  const [error, setError] = useState<string | null>(null);

  const toggle = async () => {
    setError(null);
    try {
      await setEnabled(!enabled, enabled ? null : Number(duration));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'לא ניתן לעדכן מצב פיתוח.');
    }
  };

  return (
    <div className="development-mode-settings">
      <div className="development-mode-settings-heading">
        <FlaskConical size={22} aria-hidden="true" />
        <div><h3>מצב פיתוח / סימולציה</h3><p>מצב אישי למנהל המערכת. משתמשים אחרים ממשיכים לעבוד כרגיל.</p></div>
      </div>
      <div className="development-mode-control">
        <label className="development-mode-toggle-row">
          <input type="checkbox" checked={enabled} disabled={isLoading} onChange={() => void toggle()} />
          <span><strong>{enabled ? 'פעיל' : 'כבוי'}</strong><small>חוסם בצד מסד הנתונים שינויי Production שמבוצעים תחת המשתמש שלך.</small></span>
        </label>
        {!enabled ? (
          <label className="development-mode-duration">כיבוי אוטומטי
            <select value={duration} onChange={(event) => setDuration(event.target.value)}>
              <option value="30">30 דקות</option><option value="60">שעה</option><option value="240">4 שעות</option><option value="720">12 שעות</option>
            </select>
          </label>
        ) : null}
      </div>
      <div className="development-mode-safety-note"><ShieldAlert size={18} aria-hidden="true" /><span>Shadow/Preview של המנוע הדינמי נשאר זמין. פעולות Production ייחסמו עם הודעת סימולציה במקום לשנות שיבוצים, משתמשים, אילוצים, הרשאות או התראות.</span></div>
      {enabled && expiresAt ? <p className="development-mode-expiry">כיבוי אוטומטי: {new Date(expiresAt).toLocaleString('he-IL')}</p> : null}
      {error ? <p className="form-error-message">{error}</p> : null}
    </div>
  );
}
