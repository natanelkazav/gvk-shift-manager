/**
 * קובץ: src/components/users/dynamic/DynamicAvailabilityShadowWorkspace.tsx
 * מטרה: מימוש רכיב תצוגה ואינטראקציה עבור דינמי / אילוצים וזמינות / טיוטות שיבוץ במנגנון הדינמי.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: Props, Status, CapacitySlot, DynamicAvailabilityShadowWorkspace.
 * - קישור מאפיינים ומצב מקומי לתצוגה ולטיפול בפעולות המשתמש.
 */
/* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
import { Check, LoaderCircle, Save } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { dynamicSchedulingService } from '../../../services/dynamicSchedulingService';
import type {
  DynamicAvailabilityWorkspace,
  DynamicJobType,
  SaveDynamicAvailabilityShadowSubmissionInput,
} from '../../../types/dynamicScheduling';
import { Button } from '../../ui';
import './dynamicAvailabilityShadowPreferences.css';

/**
 * חוזה הנתונים Props: מאפייני הרכיב.
 */
interface Props { jobType: DynamicJobType; year: number; month: number; refreshKey: number; canEdit?: boolean; }

/**
 * טיפוס Status: סטטוס.
 */
type Status = 'available' | 'unavailable' | 'preferred' | 'avoid';

// statusLabels — סטטוס.
const statusLabels: Record<Status, string> = { available: 'זמין', unavailable: 'לא זמין', preferred: 'מעדיף', avoid: 'מעדיף שלא' };

/**
 * טיפוס CapacitySlot: הנתון CapacitySlot בהקשר הפעולה.
 */
type CapacitySlot = { date:string; startTime:string; endTime:string };
/**
 * פעולה slotBounds: הנתון slotBounds בהקשר הפעולה.
 * @param slot — הנתון slot בהקשר הפעולה.
 */
const slotBounds = (slot: CapacitySlot) => {
  const start = new Date(`${slot.date}T${slot.startTime.slice(0,8)}`).getTime();
  let end = new Date(`${slot.date}T${slot.endTime.slice(0,8)}`).getTime();
  if (end <= start) end += 24 * 60 * 60 * 1000;
  return { ...slot, start, end };
};
/**
 * פעולה calculateTheoreticalMaximum: חישוב הנתון calculateTheoreticalMaximum בהקשר הפעולה.
 * @param workspace — הנתון workspace בהקשר הפעולה.
 */
const calculateTheoreticalMaximum = (workspace: DynamicAvailabilityWorkspace | null) => {
  if (!workspace?.slots.length) return 0;
  // rules — כללים.
  const rules = workspace.schedulingConfig?.rules;
  const noOverlap = rules?.noOverlap?.enabled ?? true;
  const noConsecutive = rules?.noConsecutive?.enabled ?? true;
  // minRestMs — מנוחה.
  const minRestMs = (rules?.minimumRestMinutes?.enabled ? Math.max(0, rules.minimumRestMinutes.value) : 0) * 60_000;
  // maxPerDay — יום.
  const maxPerDay = rules?.maxShiftsPerDay?.enabled ? Math.max(1, rules.maxShiftsPerDay.value) : Number.POSITIVE_INFINITY;
  const slots = workspace.slots.map(slotBounds).sort((a,b)=>a.start-b.start || a.end-b.end);
  const memo = new Map<string,number>();
  /**
   * פעולה solve: הנתון solve בהקשר הפעולה.
   * @param index — מיקום באוסף.
   * @param lastIndex — מיקום באוסף.
   * @param countOnDate — כמות / תאריך.
   * @returns number — הפלט בהתאם לחתימה.
   */
  const solve = (index:number,lastIndex:number,countOnDate:number):number => {
    if (index >= slots.length) return 0;
    // currentDate — תאריך.
    const currentDate = slots[index].date;
    // previousDate — תאריך.
    const previousDate = index > 0 ? slots[index-1].date : currentDate;
    // normalizedCount — כמות.
    const normalizedCount = index > 0 && currentDate !== previousDate ? 0 : countOnDate;
    // key — מפתח.
    const key = `${index}|${lastIndex}|${normalizedCount}`;
    const cached = memo.get(key); if (cached !== undefined) return cached;
    let best = solve(index+1,lastIndex,normalizedCount);
    const slot = slots[index];
    // previous — הנתון previous בהקשר הפעולה.
    const previous = lastIndex >= 0 ? slots[lastIndex] : null;
    const gap = previous ? slot.start-previous.end : Number.POSITIVE_INFINITY;
    const timingAllowed = !previous || ((!noOverlap || slot.start >= previous.end) && (!noConsecutive || slot.start !== previous.end) && gap >= minRestMs);
    if (timingAllowed && normalizedCount < maxPerDay) best = Math.max(best,1+solve(index+1,index,normalizedCount+1));
    memo.set(key,best); return best;
  };
  return solve(0,-1,0);
};

// fallbackAvailabilityConfig — אילוצים וזמינות / תצורה.
const fallbackAvailabilityConfig = {
  showEmployeePreferences: true,
  showWeeklyShiftLimit: false,
  enabled: true,
  statuses: ['available', 'unavailable'] as Status[],
  allowNotes: true,
  monthlyCapacity: { enabled: false, minEnabled: false, targetEnabled: false, maxEnabled: false, defaultMin: null, defaultTarget: null, defaultMax: null },
  limits: { maxNightsEnabled: false, defaultMaxNights: null, maxWeekendsEnabled: false, defaultMaxWeekends: null, maxHolidaysEnabled: false, defaultMaxHolidays: null },
};

/**
 * פעולה DynamicAvailabilityShadowWorkspace: דינמי / אילוצים וזמינות / טיוטות שיבוץ במנגנון הדינמי.
 * פרמטר מפורק — שדות הקלט נגישים מקומית בשמות המוגדרים בחתימה.
 */
function DynamicAvailabilityShadowWorkspace({ jobType, year, month, refreshKey, canEdit = true }: Props) {
  // מצב מקומי: workspace — הנתון workspace בהקשר הפעולה; setWorkspace מעדכנת אותו ומפעילה רינדור לפי React.
  const [workspace, setWorkspace] = useState<DynamicAvailabilityWorkspace | null>(null);
  // מצב מקומי: selectedUserId — מזהה משתמש; setSelectedUserId מעדכנת אותו ומפעילה רינדור לפי React.
  const [selectedUserId, setSelectedUserId] = useState('');
  // מצב מקומי: form — הנתון form בהקשר הפעולה; setForm מעדכנת אותו ומפעילה רינדור לפי React.
  const [form, setForm] = useState<SaveDynamicAvailabilityShadowSubmissionInput | null>(null);
  // מצב מקומי: busy — הנתון busy בהקשר הפעולה; setBusy מעדכנת אותו ומפעילה רינדור לפי React.
  const [busy, setBusy] = useState(false);
  // מצב מקומי: error — שגיאה; setError מעדכנת אותו ומפעילה רינדור לפי React.
  const [error, setError] = useState<string | null>(null);
  // מצב מקומי: message — הודעה; setMessage מעדכנת אותו ומפעילה רינדור לפי React.
  const [message, setMessage] = useState<string | null>(null);
  // הפניה יציבה loadGenerationRef בין רינדורים; שינוי current אינו מפעיל רינדור בפני עצמו.
  const loadGenerationRef = useRef(0);

  /**
   * פעולה אסינכרונית load: טעינת הנתון load בהקשר הפעולה.
   */
  const load = async () => {
    const generation = ++loadGenerationRef.current;
    setBusy(true); setError(null);
    // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
    try {
      // data — נתונים.
      const data = await dynamicSchedulingService.getAvailabilityShadowWorkspace(jobType.id, year, month);
      if (generation !== loadGenerationRef.current) return;
      setWorkspace(data);
      setSelectedUserId((current) => current && data.members.some((m) => m.userId === current) ? current : (data.members[0]?.userId ?? ''));
    } catch (err) {
      if (generation !== loadGenerationRef.current) return;
      setError(err instanceof Error ? err.message : 'טעינת סביבת האילוצים נכשלה.');
    } finally {
      if (generation === loadGenerationRef.current) setBusy(false);
    }
  };

  // תופעת לוואי לאחר רינדור בהתאם לתלויות [jobType.id, year, month, refreshKey].
  useEffect(() => {
    loadGenerationRef.current += 1;
    setWorkspace(null);
    setSelectedUserId('');
    setForm(null);
    setMessage(null);
    void load();
  }, [jobType.id, year, month, refreshKey]);

  // ערך מחושב member — הנתון member בהקשר הפעולה; נשמר בין רינדורים עד שינוי התלויות.
  const member = useMemo(() => workspace?.members.find((item) => item.userId === selectedUserId) ?? null, [workspace, selectedUserId]);

  // תופעת לוואי לאחר רינדור בהתאם לתלויות [member, workspace].
  useEffect(() => {
    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !member || !workspace.
    if (!member || !workspace) { setForm(null); return; }
    // config — תצורה.
    const config = jobType.availabilityConfig ?? workspace.availabilityConfig ?? fallbackAvailabilityConfig;
    const defaults = config.monthlyCapacity ?? fallbackAvailabilityConfig.monthlyCapacity;
    const limits = config.limits ?? fallbackAvailabilityConfig.limits;
    setForm({
      submissionStatus: member.status ?? 'draft',
      minimum: member.minimum ?? defaults.defaultMin,
      target: member.targetUnlimited ? null : (member.target ?? defaults.defaultTarget),
      targetUnlimited: Boolean(member.targetUnlimited),
      maximum: null,
      maxWeeklyShifts: member.maxWeeklyShifts ?? null,
      maxNights: member.maxNights ?? limits.defaultMaxNights,
      maxWeekends: member.maxWeekends ?? limits.defaultMaxWeekends,
      maxHolidays: member.maxHolidays ?? limits.defaultMaxHolidays,
      note: member.note,
      entries: workspace.slots.map((slot) => ({ slotId: slot.id, status: member.entries[slot.id]?.status ?? 'available', note: member.entries[slot.id]?.note ?? null })),
    });
  }, [member, workspace]);

  /**
   * פעולה setEntry: קביעת קבוצה ייחודית / רשומה.
   * @param slotId — מזהה.
   * @param status — סטטוס.
   */
  const setEntry = (slotId: string, status: Status) => setForm((current) => current ? ({ ...current, entries: current.entries.map((entry) => entry.slotId === slotId ? { ...entry, status } : entry) }) : current);

  /**
   * פעולה setNumber: קביעת קבוצה ייחודית.
   * @param key — מפתח.
   * @param value — ערך.
   */
  const setNumber = (key: 'minimum'|'target'|'maxWeeklyShifts', value: string) => setForm((current) => current ? ({ ...current, [key]: value === '' ? null : Number(value), ...(key === 'target' ? {targetUnlimited:false} : {}) }) : current);

  /**
   * פעולה אסינכרונית save: שמירת הנתון save בהקשר הפעולה.
   */
  const save = async () => {
    if (!canEdit || !form || !selectedUserId) return;
    setBusy(true); setError(null); setMessage(null);
    // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
    try {
      await dynamicSchedulingService.saveAvailabilityShadowSubmission(jobType.id, year, month, selectedUserId, { ...form, maximum: null, maxWeeklyShifts: availabilityConfig.showWeeklyShiftLimit ? form.maxWeeklyShifts : member?.maxWeeklyShifts ?? null });
      setMessage('אילוצי העובד נשמרו בהצלחה.'); await load();
    } catch (err) { setError(err instanceof Error ? err.message : 'שמירת האילוצים נכשלה.'); }
    finally { setBusy(false); }
  };



  if (busy && !workspace) return <div className="dynamic-shadow-loading"><LoaderCircle className="spin" size={18}/> טוען אילוצי עובדים...</div>;
  if (!workspace?.materialized) return <div className="dynamic-shadow-empty">יש ליצור קודם תקופת אילוצים לחודש הנבחר.</div>;

  // availabilityConfig — אילוצים וזמינות / תצורה.
  const availabilityConfig = jobType.availabilityConfig ?? workspace.availabilityConfig ?? fallbackAvailabilityConfig;
  const monthlyCapacity = availabilityConfig.monthlyCapacity ?? fallbackAvailabilityConfig.monthlyCapacity;
  const statuses = availabilityConfig.statuses?.length ? availabilityConfig.statuses : fallbackAvailabilityConfig.statuses;
  // theoreticalMaximum — הנתון theoreticalMaximum בהקשר הפעולה.
  const theoreticalMaximum = calculateTheoreticalMaximum(workspace);

  return <div className="dynamic-availability-workspace">
    {!canEdit ? <div className="dynamic-period-workflow-note">מצב צפייה בלבד — אין לך הרשאת ניהול הגשות אילוצים עבור התפקיד הזה.</div> : null}
    {error ? <div className="users-error" role="alert">{error}</div> : null}
    {message ? <div className="dynamic-shadow-success"><Check size={15}/>{message}</div> : null}
    <div className="dynamic-availability-toolbar">
      <label>עובד<select value={selectedUserId} onChange={(e) => setSelectedUserId(e.target.value)}>{workspace.members.map((m) => <option key={m.userId} value={m.userId}>{m.displayName}{m.isActive ? '' : ' · מושבת'}</option>)}</select></label>
    </div>

    {form && member ? <>


      <section className="shadow-preferences-section" aria-label="העדפת כמות משמרות">
        <div className="shadow-preferences-heading">העדפת כמות משמרות</div>
        <div className="shadow-preferences-grid">
          {availabilityConfig.showEmployeePreferences !== false && monthlyCapacity.minEnabled ? <label className="shadow-preference-card">
            <span className="shadow-preference-title">מינימום משמרות</span>
            <input type="number" min="0" value={form.minimum ?? ''} disabled={!canEdit} onChange={(e) => setNumber('minimum', e.target.value)}/>
          </label> : null}
          {availabilityConfig.showEmployeePreferences !== false && monthlyCapacity.targetEnabled ? <div className="shadow-preference-card">
            <label className="shadow-preference-title" htmlFor="shadow-monthly-target">יעד משמרות חודשי</label>
            <input id="shadow-monthly-target" type="number" min="0" max={theoreticalMaximum || undefined} value={form.targetUnlimited ? '' : form.target ?? ''} disabled={!canEdit || Boolean(form.targetUnlimited)} onChange={(e) => setNumber('target', e.target.value)}/>
            <label className="shadow-preference-check"><input type="checkbox" checked={Boolean(form.targetUnlimited)} disabled={!canEdit || theoreticalMaximum === 0} onChange={(e) => setForm((current) => current ? ({ ...current, targetUnlimited:e.target.checked, target:e.target.checked ? null : current.target }) : current)}/> כמה שיותר</label>
            <small className="shadow-preference-original">{member.targetUnlimited ? 'העדפת העובד: כמה שיותר' : member.target == null ? 'העדפת העובד: לא הוזן יעד חודשי' : `העדפת העובד: ${member.target} משמרות`}</small>
          </div> : null}
          {availabilityConfig.showWeeklyShiftLimit ? <div className="shadow-preference-card">
            <label className="shadow-preference-title" htmlFor="shadow-weekly-limit">מקסימום משמרות בשבוע</label>
            <input id="shadow-weekly-limit" type="number" min="1" value={form.maxWeeklyShifts ?? ''} disabled={!canEdit || form.maxWeeklyShifts == null} placeholder="" onChange={(e) => setNumber('maxWeeklyShifts', e.target.value)}/>
            <label className="shadow-preference-check"><input type="checkbox" checked={form.maxWeeklyShifts == null} disabled={!canEdit} onChange={(e) => setForm((current) => current ? ({ ...current, maxWeeklyShifts: e.target.checked ? null : 5 }) : current)}/> כמה שיותר</label>
            <small className="shadow-preference-original">{member.maxWeeklyShifts == null ? (member.submissionId ? 'העדפת העובד: כמה שיותר (ללא מגבלה שבועית)' : 'העדפת העובד: טרם הוזנה מגבלה שבועית') : `העדפת העובד: עד ${member.maxWeeklyShifts} משמרות בשבוע`}</small>
          </div> : null}
        </div>
      </section>
      <div className="shadow-submission-row"><label>מצב הגשה<select className={`dynamic-submission-status is-${form.submissionStatus}`} disabled={!canEdit} value={form.submissionStatus} onChange={(e) => setForm({ ...form, submissionStatus: e.target.value as SaveDynamicAvailabilityShadowSubmissionInput['submissionStatus'] })}><option value="draft">טיוטה</option><option value="submitted">הוגש</option><option value="reopened">נפתח מחדש</option></select></label></div>
      <div className="dynamic-availability-grid">
        {workspace.slots.map((slot) => {
          // entry — רשומה.
          const entry = form.entries.find((item) => item.slotId === slot.id);
          if (!entry) return null;
          return <div className="dynamic-availability-slot" key={slot.id}>
            <div><strong>{new Date(`${slot.date}T12:00:00`).toLocaleDateString('he-IL',{day:'2-digit',month:'2-digit',weekday:'short'})}</strong><span>{slot.shiftName} · {slot.startTime.slice(0,5)}–{slot.endTime.slice(0,5)}</span>{slot.holidayName ? <small>{slot.holidayName}</small> : null}</div>
            <select value={entry.status} onChange={(e) => setEntry(slot.id,e.target.value as Status)}>{statuses.map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}</select>
          </div>;
        })}
      </div>
      <div className="dynamic-availability-save"><Button disabled={busy || !canEdit} onClick={() => void save()}><Save size={16}/> שמור אילוצי עובד</Button></div>
    </> : <div className="dynamic-shadow-empty">אין עובדים משויכים לסוג התפקיד.</div>}

  </div>;
}

export default DynamicAvailabilityShadowWorkspace;
