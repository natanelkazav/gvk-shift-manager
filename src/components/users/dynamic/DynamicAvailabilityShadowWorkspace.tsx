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

interface Props { jobType: DynamicJobType; year: number; month: number; refreshKey: number; canEdit?: boolean; }

type Status = 'available' | 'unavailable' | 'preferred' | 'avoid';

const statusLabels: Record<Status, string> = { available: 'זמין', unavailable: 'לא זמין', preferred: 'מעדיף', avoid: 'מעדיף שלא' };

type CapacitySlot = { date:string; startTime:string; endTime:string };
const slotBounds = (slot: CapacitySlot) => {
  const start = new Date(`${slot.date}T${slot.startTime.slice(0,8)}`).getTime();
  let end = new Date(`${slot.date}T${slot.endTime.slice(0,8)}`).getTime();
  if (end <= start) end += 24 * 60 * 60 * 1000;
  return { ...slot, start, end };
};
const calculateTheoreticalMaximum = (workspace: DynamicAvailabilityWorkspace | null) => {
  if (!workspace?.slots.length) return 0;
  const rules = workspace.schedulingConfig?.rules;
  const noOverlap = rules?.noOverlap?.enabled ?? true;
  const noConsecutive = rules?.noConsecutive?.enabled ?? true;
  const minRestMs = (rules?.minimumRestMinutes?.enabled ? Math.max(0, rules.minimumRestMinutes.value) : 0) * 60_000;
  const maxPerDay = rules?.maxShiftsPerDay?.enabled ? Math.max(1, rules.maxShiftsPerDay.value) : Number.POSITIVE_INFINITY;
  const slots = workspace.slots.map(slotBounds).sort((a,b)=>a.start-b.start || a.end-b.end);
  const memo = new Map<string,number>();
  const solve = (index:number,lastIndex:number,countOnDate:number):number => {
    if (index >= slots.length) return 0;
    const currentDate = slots[index].date;
    const previousDate = index > 0 ? slots[index-1].date : currentDate;
    const normalizedCount = index > 0 && currentDate !== previousDate ? 0 : countOnDate;
    const key = `${index}|${lastIndex}|${normalizedCount}`;
    const cached = memo.get(key); if (cached !== undefined) return cached;
    let best = solve(index+1,lastIndex,normalizedCount);
    const slot = slots[index];
    const previous = lastIndex >= 0 ? slots[lastIndex] : null;
    const gap = previous ? slot.start-previous.end : Number.POSITIVE_INFINITY;
    const timingAllowed = !previous || ((!noOverlap || slot.start >= previous.end) && (!noConsecutive || slot.start !== previous.end) && gap >= minRestMs);
    if (timingAllowed && normalizedCount < maxPerDay) best = Math.max(best,1+solve(index+1,index,normalizedCount+1));
    memo.set(key,best); return best;
  };
  return solve(0,-1,0);
};

const fallbackAvailabilityConfig = {
  enabled: true,
  statuses: ['available', 'unavailable'] as Status[],
  allowNotes: true,
  monthlyCapacity: { enabled: false, minEnabled: false, targetEnabled: false, maxEnabled: false, defaultMin: null, defaultTarget: null, defaultMax: null },
  limits: { maxNightsEnabled: false, defaultMaxNights: null, maxWeekendsEnabled: false, defaultMaxWeekends: null, maxHolidaysEnabled: false, defaultMaxHolidays: null },
};

function DynamicAvailabilityShadowWorkspace({ jobType, year, month, refreshKey, canEdit = true }: Props) {
  const [workspace, setWorkspace] = useState<DynamicAvailabilityWorkspace | null>(null);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [form, setForm] = useState<SaveDynamicAvailabilityShadowSubmissionInput | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const loadGenerationRef = useRef(0);

  const load = async () => {
    const generation = ++loadGenerationRef.current;
    setBusy(true); setError(null);
    try {
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

  useEffect(() => {
    loadGenerationRef.current += 1;
    setWorkspace(null);
    setSelectedUserId('');
    setForm(null);
    setMessage(null);
    void load();
  }, [jobType.id, year, month, refreshKey]);

  const member = useMemo(() => workspace?.members.find((item) => item.userId === selectedUserId) ?? null, [workspace, selectedUserId]);

  useEffect(() => {
    if (!member || !workspace) { setForm(null); return; }
    const config = workspace.availabilityConfig ?? fallbackAvailabilityConfig;
    const defaults = config.monthlyCapacity ?? fallbackAvailabilityConfig.monthlyCapacity;
    const limits = config.limits ?? fallbackAvailabilityConfig.limits;
    setForm({
      submissionStatus: member.status ?? 'draft',
      minimum: member.minimum ?? defaults.defaultMin,
      target: member.target ?? defaults.defaultTarget,
      maximum: null,
      maxNights: member.maxNights ?? limits.defaultMaxNights,
      maxWeekends: member.maxWeekends ?? limits.defaultMaxWeekends,
      maxHolidays: member.maxHolidays ?? limits.defaultMaxHolidays,
      note: member.note,
      entries: workspace.slots.map((slot) => ({ slotId: slot.id, status: member.entries[slot.id]?.status ?? 'unavailable', note: member.entries[slot.id]?.note ?? null })),
    });
  }, [member, workspace]);

  const setEntry = (slotId: string, status: Status) => setForm((current) => current ? ({ ...current, entries: current.entries.map((entry) => entry.slotId === slotId ? { ...entry, status } : entry) }) : current);

  const setNumber = (key: 'minimum'|'target', value: string) => setForm((current) => current ? ({ ...current, [key]: value === '' ? null : Number(value) }) : current);

  const save = async () => {
    if (!canEdit || !form || !selectedUserId) return;
    setBusy(true); setError(null); setMessage(null);
    try {
      await dynamicSchedulingService.saveAvailabilityShadowSubmission(jobType.id, year, month, selectedUserId, { ...form, maximum: null });
      setMessage('אילוצי העובד נשמרו בהצלחה.'); await load();
    } catch (err) { setError(err instanceof Error ? err.message : 'שמירת האילוצים נכשלה.'); }
    finally { setBusy(false); }
  };



  if (busy && !workspace) return <div className="dynamic-shadow-loading"><LoaderCircle className="spin" size={18}/> טוען אילוצי עובדים...</div>;
  if (!workspace?.materialized) return <div className="dynamic-shadow-empty">יש ליצור קודם תקופת אילוצים לחודש הנבחר.</div>;

  const availabilityConfig = workspace.availabilityConfig ?? fallbackAvailabilityConfig;
  const monthlyCapacity = availabilityConfig.monthlyCapacity ?? fallbackAvailabilityConfig.monthlyCapacity;
  const statuses = availabilityConfig.statuses?.length ? availabilityConfig.statuses : fallbackAvailabilityConfig.statuses;
  const theoreticalMaximum = calculateTheoreticalMaximum(workspace);

  return <div className="dynamic-availability-workspace">
    {!canEdit ? <div className="dynamic-period-workflow-note">מצב צפייה בלבד — אין לך הרשאת ניהול הגשות אילוצים עבור התפקיד הזה.</div> : null}
    {error ? <div className="users-error" role="alert">{error}</div> : null}
    {message ? <div className="dynamic-shadow-success"><Check size={15}/>{message}</div> : null}
    <div className="dynamic-availability-toolbar">
      <label>עובד<select value={selectedUserId} onChange={(e) => setSelectedUserId(e.target.value)}>{workspace.members.map((m) => <option key={m.userId} value={m.userId}>{m.displayName}{m.isActive ? '' : ' · מושבת'}</option>)}</select></label>
    </div>

    {form && member ? <>


      <div className="dynamic-capacity-row">
        {monthlyCapacity.minEnabled ? <label>מינימום<input type="number" min="0" value={form.minimum ?? ''} onChange={(e) => setNumber('minimum',e.target.value)}/></label> : null}
        <label>
          <span>יעד</span>
          <input type="number" min="0" max={theoreticalMaximum || undefined} value={form.target ?? ''} onChange={(e) => setNumber('target',e.target.value)}/>
          {theoreticalMaximum > 0 && form.target !== null && form.target >= theoreticalMaximum ? <small className="dynamic-capacity-preference">העדפת העובד: כמה שיותר</small> : form.target !== null ? <small className="dynamic-capacity-preference">העדפת העובד: {form.target} משמרות</small> : null}
        </label>
        <label>מצב<select className={`dynamic-submission-status is-${form.submissionStatus}`} disabled={!canEdit} value={form.submissionStatus} onChange={(e) => setForm({ ...form, submissionStatus: e.target.value as SaveDynamicAvailabilityShadowSubmissionInput['submissionStatus'] })}><option value="draft">טיוטה</option><option value="submitted">הוגש</option><option value="reopened">נפתח מחדש</option></select></label>
      </div>
      <div className="dynamic-availability-grid">
        {workspace.slots.map((slot) => {
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
