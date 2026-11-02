/**
 * קובץ: src/components/users/dynamic/DynamicMonthlyRotationPanel.tsx
 * מטרה: מימוש רכיב תצוגה ואינטראקציה עבור דינמי / סבב כוננויות.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: DynamicMonthlyRotationPanel.
 * - קישור מאפיינים ומצב מקומי לתצוגה ולטיפול בפעולות המשתמש.
 */
import { ArrowDown, ArrowUp, CalendarRange, LoaderCircle, RefreshCw, Save } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { dynamicSchedulingService } from '../../../services/dynamicSchedulingService';
import type { DynamicJobType, DynamicRotationWorkspace } from '../../../types/dynamicScheduling';
import { Button } from '../../ui';

// sourceLabel — מקור / תווית.
const sourceLabel: Record<string, string> = {
  historical_best_window: 'נלמד מההיסטוריה',
  membership_fallback: 'נוצר מרשימת העובדים',
  manual: 'הוגדר ידנית',
};

/**
 * פעולה DynamicMonthlyRotationPanel: דינמי / סבב כוננויות.
 * פרמטר מפורק — שדות הקלט נגישים מקומית בשמות המוגדרים בחתימה.
 */
function DynamicMonthlyRotationPanel({ jobType }: { jobType: DynamicJobType }) {
  // מצב מקומי: data — נתונים; setData מעדכנת אותו ומפעילה רינדור לפי React.
  const [data, setData] = useState<DynamicRotationWorkspace | null>(null);
  // מצב מקומי: order — הנתון order בהקשר הפעולה; setOrder מעדכנת אותו ומפעילה רינדור לפי React.
  const [order, setOrder] = useState<string[]>([]);
  // מצב מקומי: anchorDate — תאריך; setAnchorDate מעדכנת אותו ומפעילה רינדור לפי React.
  const [anchorDate, setAnchorDate] = useState('');
  // מצב מקומי: reason — הנתון reason בהקשר הפעולה; setReason מעדכנת אותו ומפעילה רינדור לפי React.
  const [reason, setReason] = useState('');
  // מצב מקומי: busy — הנתון busy בהקשר הפעולה; setBusy מעדכנת אותו ומפעילה רינדור לפי React.
  const [busy, setBusy] = useState(false);
  // מצב מקומי: error — שגיאה; setError מעדכנת אותו ומפעילה רינדור לפי React.
  const [error, setError] = useState<string | null>(null);
  // מצב מקומי: message — הודעה; setMessage מעדכנת אותו ומפעילה רינדור לפי React.
  const [message, setMessage] = useState<string | null>(null);

  /**
   * פעולה אסינכרונית load: טעינת הנתון load בהקשר הפעולה.
   */
  const load = async () => {
    setBusy(true); setError(null);
    // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
    try {
      // result — תוצאה.
      const result = await dynamicSchedulingService.getRotationWorkspace(jobType.id);
      setData(result);
      setOrder(result.rotationUserIds ?? []);
      setAnchorDate(result.anchorDate ?? '');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'טעינת הסבב החודשי נכשלה.');
    } finally { setBusy(false); }
  };

  // תופעת לוואי לאחר רינדור בהתאם לתלויות [jobType.id].
  useEffect(() => { void load(); }, [jobType.id]);

  // ערך מחושב names — הנתון names בהקשר הפעולה; נשמר בין רינדורים עד שינוי התלויות.
  const names = useMemo(
    () => new Map((data?.members ?? []).map((member) => [member.userId, member.displayName])),
    [data?.members],
  );

  /**
   * פעולה אסינכרונית initialize: הנתון initialize בהקשר הפעולה.
   */
  const initialize = async () => {
    setBusy(true); setError(null); setMessage(null);
    // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
    try {
      // result — תוצאה.
      const result = await dynamicSchedulingService.initializeRotation(jobType.id);
      setData(result); setOrder(result.rotationUserIds); setAnchorDate(result.anchorDate ?? '');
      setMessage('הסבב חושב ונשמר. מעכשיו הוא נשמר כרצף המקורי של התפקיד.');
    } catch (e) { setError(e instanceof Error ? e.message : 'אתחול הסבב נכשל.'); }
    finally { setBusy(false); }
  };

  /**
   * פעולה move: הנתון move בהקשר הפעולה.
   * @param index — מיקום באוסף.
   * @param delta — הנתון delta בהקשר הפעולה.
   */
  const move = (index: number, delta: number) => {
    // nextIndex — מיקום באוסף.
    const nextIndex = index + delta;
    if (nextIndex < 0 || nextIndex >= order.length) return;
    // next — הנתון next בהקשר הפעולה.
    const next = [...order];
    [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
    setOrder(next);
  };

  /**
   * פעולה אסינכרונית save: שמירת הנתון save בהקשר הפעולה.
   */
  const save = async () => {
    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !anchorDate.
    if (!anchorDate) { setError('יש לבחור תאריך עוגן.'); return; }
    setBusy(true); setError(null); setMessage(null);
    // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
    try {
      // result — תוצאה.
      const result = await dynamicSchedulingService.updateRotation(jobType.id, order, anchorDate, reason);
      setData(result); setOrder(result.rotationUserIds); setReason('');
      setMessage('הסבב החודשי עודכן. שינויים עתידיים ימשיכו מהרצף הזה.');
    } catch (e) { setError(e instanceof Error ? e.message : 'שמירת הסבב נכשלה.'); }
    finally { setBusy(false); }
  };

  if (busy && !data) return <div className="dynamic-job-types-loading"><LoaderCircle className="spin" size={18}/> טוען סבב חודשי…</div>;

  return (
    <div className="dynamic-rotation-workspace">
      <div className="dynamic-rotation-header">
        <div>
          <h4><CalendarRange size={19}/> הסבב המקורי</h4>
          <p>זהו רצף האמת של התפקיד. החלפה עקב אילוץ משנה את השיבוץ בפועל בלבד ואינה מזיזה את הסבב העתידי.</p>
        </div>
        <Button variant="secondary" disabled={busy} onClick={() => void load()}><RefreshCw size={16}/> רענן</Button>
      </div>

      {error ? <div className="users-error" role="alert">{error}</div> : null}
      {message ? <div className="dynamic-rotation-success">{message}</div> : null}

      {!data?.initialized ? (
        <div className="dynamic-rotation-empty">
          <strong>עדיין לא נשמר סבב קבוע לתפקיד הזה.</strong>
          <p>המערכת תנסה ללמוד פעם אחת את הרצף הטוב ביותר מההיסטוריה. אם אין מספיק היסטוריה, היא תיצור בסיס מרשימת העובדים ותאפשר לך לתקן אותו.</p>
          <Button disabled={busy} onClick={() => void initialize()}>{busy ? <LoaderCircle className="spin" size={16}/> : null} חשב סבב מהיסטוריה</Button>
        </div>
      ) : (
        <>
          <div className="dynamic-rotation-meta">
            <span><strong>מקור:</strong> {sourceLabel[data.source ?? ''] ?? data.source ?? 'לא ידוע'}</span>
            <label><strong>תאריך עוגן:</strong><input type="date" value={anchorDate} onChange={(e) => setAnchorDate(e.target.value)}/></label>
          </div>

          <div className="dynamic-rotation-order">
            <h4>סדר הסבב</h4>
            {order.map((userId, index) => (
              <div className="dynamic-rotation-order-row" key={userId}>
                <span className="dynamic-rotation-index">{index + 1}</span>
                <strong>{names.get(userId) ?? userId}</strong>
                <div>
                  <button type="button" disabled={index === 0 || busy} onClick={() => move(index,-1)} aria-label="הזז למעלה"><ArrowUp size={16}/></button>
                  <button type="button" disabled={index === order.length-1 || busy} onClick={() => move(index,1)} aria-label="הזז למטה"><ArrowDown size={16}/></button>
                </div>
              </div>
            ))}
          </div>

          <div className="dynamic-rotation-save">
            <label>סיבת שינוי — אופציונלי<input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="לדוגמה: תיקון סדר הסבב לפי ההיסטוריה"/></label>
            <Button disabled={busy || order.length < 2 || !anchorDate} onClick={() => void save()}><Save size={16}/> שמור סבב</Button>
          </div>

          <div className="dynamic-rotation-preview">
            <h4>תצוגה קדימה</h4>
            <p>השיבוץ בפועל מוצג כאשר כבר קיים פרסום לאותו יום.</p>
            <div className="dynamic-rotation-preview-table">
              <div className="is-head"><span>תאריך</span><span>סבב מקורי</span><span>שיבוץ בפועל</span><span>מצב</span></div>
              {data.preview.map((day) => (
                <div key={day.date}>
                  <span>{new Intl.DateTimeFormat('he-IL',{weekday:'short',day:'2-digit',month:'2-digit'}).format(new Date(`${day.date}T12:00:00`))}</span>
                  <span>{day.originalDisplayName}</span>
                  <span>{day.actualDisplayName ?? 'טרם פורסם'}</span>
                  <span className={day.isSubstitution ? 'is-substitution' : day.actualUserId ? 'is-original' : ''}>
                    {day.isSubstitution ? 'הוחלף עקב שיבוץ' : day.actualUserId ? 'לפי הסבב' : 'צפוי'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
export default DynamicMonthlyRotationPanel;
