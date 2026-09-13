import { useEffect, useState } from 'react';
import {
  LockKeyhole,
  RotateCcw,
  ShieldCheck,
  UnlockKeyhole,
} from 'lucide-react';
import { Button } from '../ui';
import { dynamicCutoverService } from '../../services/dynamicCutoverService';
import type {
  DynamicCutoverState,
  LegacyFreezeReadiness,
} from '../../types/dynamicCutover';

export default function DynamicCutoverSettings() {
  const [state, setState] = useState<DynamicCutoverState | null>(null);
  const [readiness, setReadiness] = useState<LegacyFreezeReadiness | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reloadReadiness = async (): Promise<void> => {
    setReadiness(await dynamicCutoverService.getLegacyFreezeReadiness());
  };

  useEffect(() => {
    let active = true;
    void Promise.all([
      dynamicCutoverService.getState(),
      dynamicCutoverService.getLegacyFreezeReadiness(),
    ])
      .then(([nextState, nextReadiness]) => {
        if (!active) return;
        setState(nextState);
        setReadiness(nextReadiness);
      })
      .catch((e: unknown) => {
        if (!active) return;
        setError(e instanceof Error ? e.message : 'טעינת מצב המעבר נכשלה.');
      });
    return () => {
      active = false;
    };
  }, []);

  const toggleDynamicFirst = async (): Promise<void> => {
    if (!state || saving) return;
    const next = !state.dynamicFirstEnabled;
    const question = next
      ? 'להפעיל Dynamic-first? המערכת החדשה תהפוך לברירת המחדל למשתמשים דינמיים ולמנהלים.'
      : state.legacyFrozen
        ? 'לא ניתן לחזור ל-Legacy-first בזמן שה-Legacy מוקפא. יש לבטל קודם את ההקפאה.'
        : 'לבצע Rollback ל-Legacy-first? הנתונים הדינמיים לא יימחקו.';

    if (!next && state.legacyFrozen) {
      setError(question);
      return;
    }

    if (!window.confirm(question)) return;
    setSaving(true);
    setError(null);
    try {
      setState(await dynamicCutoverService.setEnabled(next));
      await reloadReadiness();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'עדכון מצב המעבר נכשל.');
    } finally {
      setSaving(false);
    }
  };

  const toggleLegacyFreeze = async (): Promise<void> => {
    if (!state || saving) return;
    const next = !state.legacyFrozen;
    const question = next
      ? 'להקפיא את Legacy? העבודה השוטפת תישאר Dynamic-first, והמסכים הישנים יישארו זמינים רק דרך אזור השחזור.'
      : 'לבטל את הקפאת Legacy? פעולה זו מיועדת ל-Rollback או טיפול תקלה בלבד.';
    if (!window.confirm(question)) return;

    setSaving(true);
    setError(null);
    try {
      setState(await dynamicCutoverService.setLegacyFrozen(next));
      await reloadReadiness();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'עדכון מצב Legacy נכשל.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="dynamic-cutover-settings" dir="rtl">
      <div className={state?.dynamicFirstEnabled ? 'settings-cutover-status settings-cutover-on' : 'settings-cutover-status'}>
        <ShieldCheck size={20} />
        <div>
          <strong>{state?.dynamicFirstEnabled ? 'Dynamic-first פעיל' : 'Dynamic-first כבוי'}</strong>
          <p>
            {state?.dynamicFirstEnabled
              ? 'המערכת החדשה היא סביבת העבודה הראשית. Legacy נשמר כרגע רק לשחזור ותאימות.'
              : 'המערכת הישנה עדיין יכולה לשמש כברירת מחדל. אין להקפיא Legacy לפני הפעלת Dynamic-first.'}
          </p>
        </div>
      </div>

      <div className={state?.legacyFrozen ? 'settings-cutover-status settings-cutover-on' : 'settings-cutover-status'}>
        {state?.legacyFrozen ? <LockKeyhole size={20} /> : <UnlockKeyhole size={20} />}
        <div>
          <strong>{state?.legacyFrozen ? 'Legacy מוקפא' : 'Legacy עדיין לא מוקפא'}</strong>
          <p>
            {state?.legacyFrozen
              ? 'המערכת הישנה איננה חלק מהעבודה השוטפת. נתיבי Recovery נשמרו למנהל לצורך Rollback בלבד.'
              : readiness?.ready
                ? 'בדיקת המוכנות עברה. ניתן להקפיא את Legacy בבטחה יחסית ולהשאיר אותו רק כרשת ביטחון.'
                : `טרם ניתן להקפיא. חסרים שיוכים דינמיים ל-${readiness?.missingLegacyMemberships ?? 0} משתמשים פעילים או ש-Dynamic-first כבוי.`}
          </p>
        </div>
      </div>

      {readiness && readiness.missingUsers.length > 0 ? (
        <div className="settings-legacy-freeze-blockers">
          <strong>משתמשים שעדיין תלויים בתפקיד Legacy:</strong>
          <ul>
            {readiness.missingUsers.slice(0, 8).map((user) => (
              <li key={user.userId}>{user.displayName} · {user.legacyRole}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {error ? <div className="settings-error" role="alert">{error}</div> : null}

      <div className="settings-cutover-actions">
        <Button
          variant={state?.dynamicFirstEnabled ? 'secondary' : 'primary'}
          onClick={() => void toggleDynamicFirst()}
          disabled={!state || saving}
        >
          {state?.dynamicFirstEnabled ? <><RotateCcw size={17} /> חזרה זמנית ל-Legacy</> : 'הפעל Dynamic-first'}
        </Button>

        <Button
          variant={state?.legacyFrozen ? 'secondary' : 'primary'}
          onClick={() => void toggleLegacyFreeze()}
          disabled={!state || saving || (!state.legacyFrozen && !readiness?.ready)}
        >
          {state?.legacyFrozen ? <><UnlockKeyhole size={17} /> בטל הקפאת Legacy</> : <><LockKeyhole size={17} /> הקפא Legacy</>}
        </Button>
      </div>
    </div>
  );
}
