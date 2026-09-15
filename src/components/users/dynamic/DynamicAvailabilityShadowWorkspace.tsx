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
      maximum: member.maximum ?? defaults.defaultMax,
      maxNights: member.maxNights ?? limits.defaultMaxNights,
      maxWeekends: member.maxWeekends ?? limits.defaultMaxWeekends,
      maxHolidays: member.maxHolidays ?? limits.defaultMaxHolidays,
      note: member.note,
      entries: workspace.slots.map((slot) => ({ slotId: slot.id, status: member.entries[slot.id]?.status ?? 'unavailable', note: member.entries[slot.id]?.note ?? null })),
    });
  }, [member, workspace]);

  const setEntry = (slotId: string, status: Status) => setForm((current) => current ? ({ ...current, entries: current.entries.map((entry) => entry.slotId === slotId ? { ...entry, status } : entry) }) : current);

  const setNumber = (key: 'minimum'|'target'|'maximum', value: string) => setForm((current) => current ? ({ ...current, [key]: value === '' ? null : Number(value) }) : current);

  const save = async () => {
    if (!canEdit || !form || !selectedUserId) return;
    setBusy(true); setError(null); setMessage(null);
    try {
      await dynamicSchedulingService.saveAvailabilityShadowSubmission(jobType.id, year, month, selectedUserId, form);
      setMessage('אילוצי העובד נשמרו בהצלחה.'); await load();
    } catch (err) { setError(err instanceof Error ? err.message : 'שמירת האילוצים נכשלה.'); }
    finally { setBusy(false); }
  };



  if (busy && !workspace) return <div className="dynamic-shadow-loading"><LoaderCircle className="spin" size={18}/> טוען אילוצי עובדים...</div>;
  if (!workspace?.materialized) return <div className="dynamic-shadow-empty">יש ליצור קודם תקופת אילוצים לחודש הנבחר.</div>;

  const availabilityConfig = workspace.availabilityConfig ?? fallbackAvailabilityConfig;
  const monthlyCapacity = availabilityConfig.monthlyCapacity ?? fallbackAvailabilityConfig.monthlyCapacity;
  const statuses = availabilityConfig.statuses?.length ? availabilityConfig.statuses : fallbackAvailabilityConfig.statuses;

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
        {monthlyCapacity.targetEnabled ? <label>יעד<input type="number" min="0" value={form.target ?? ''} onChange={(e) => setNumber('target',e.target.value)}/></label> : null}
        {monthlyCapacity.maxEnabled ? <label>מקסימום<input type="number" min="0" value={form.maximum ?? ''} onChange={(e) => setNumber('maximum',e.target.value)}/></label> : null}
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
