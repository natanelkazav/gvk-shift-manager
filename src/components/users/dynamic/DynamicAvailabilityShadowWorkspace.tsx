/* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
import { Check, GitCompareArrows, LoaderCircle, Save, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { dynamicSchedulingService } from '../../../services/dynamicSchedulingService';
import type {
  DynamicAvailabilityLegacyComparison,
  DynamicAvailabilityWorkspace,
  DynamicJobType,
  SaveDynamicAvailabilityShadowSubmissionInput,
} from '../../../types/dynamicScheduling';
import { Button } from '../../ui';

interface Props { jobType: DynamicJobType; year: number; month: number; refreshKey: number; canEdit?: boolean; }

type Status = 'available' | 'unavailable' | 'preferred' | 'avoid';
const weekdayOptions = [
  { value: 0, label: 'ראשון' },
  { value: 1, label: 'שני' },
  { value: 2, label: 'שלישי' },
  { value: 3, label: 'רביעי' },
  { value: 4, label: 'חמישי' },
  { value: 5, label: 'שישי' },
  { value: 6, label: 'שבת' },
] as const;

const getSlotWeekday = (date: string): number => {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
};

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
  const [comparison, setComparison] = useState<DynamicAvailabilityLegacyComparison | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [bulkStatus, setBulkStatus] = useState<Status>('available');
  const [bulkWeekday, setBulkWeekday] = useState<number>(0);
  const [bulkShiftKeys, setBulkShiftKeys] = useState<string[] | null>(null);

  const load = async () => {
    setBusy(true); setError(null);
    try {
      const data = await dynamicSchedulingService.getAvailabilityShadowWorkspace(jobType.id, year, month);
      setWorkspace(data);
      setSelectedUserId((current) => current && data.members.some((m) => m.userId === current) ? current : (data.members[0]?.userId ?? ''));
    } catch (err) { setError(err instanceof Error ? err.message : 'טעינת סביבת האילוצים נכשלה.'); }
    finally { setBusy(false); }
  };

  useEffect(() => { void load(); }, [jobType.id, year, month, refreshKey]);

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

  const getShiftKey = (shiftName: string, startTime: string, endTime: string): string =>
    `${shiftName}__${startTime.slice(0, 5)}__${endTime.slice(0, 5)}`;

  const bulkShiftOptions = useMemo(() => {
    if (!workspace) return [];
    const unique = new Map<string, { key: string; label: string }>();
    workspace.slots
      .filter((slot) => getSlotWeekday(slot.date) === bulkWeekday)
      .forEach((slot) => {
        const key = getShiftKey(slot.shiftName, slot.startTime, slot.endTime);
        if (!unique.has(key)) {
          unique.set(key, {
            key,
            label: `${slot.shiftName} · ${slot.startTime.slice(0, 5)}–${slot.endTime.slice(0, 5)}`,
          });
        }
      });
    return [...unique.values()];
  }, [workspace, bulkWeekday]);

  const selectedBulkShiftKeys = useMemo(() => {
    const validKeys = new Set(bulkShiftOptions.map((option) => option.key));
    if (bulkShiftKeys === null) return bulkShiftOptions.map((option) => option.key);
    return bulkShiftKeys.filter((key) => validKeys.has(key));
  }, [bulkShiftKeys, bulkShiftOptions]);

  const toggleBulkShift = (key: string): void => {
    setBulkShiftKeys((current) => {
      const selected = current === null ? bulkShiftOptions.map((option) => option.key) : current;
      return selected.includes(key)
        ? selected.filter((value) => value !== key)
        : [...selected, key];
    });
  };

  const matchingBulkSlotIds = useMemo(() => {
    if (!workspace || selectedBulkShiftKeys.length === 0) return new Set<string>();
    const selectedKeys = new Set(selectedBulkShiftKeys);
    return new Set(workspace.slots
      .filter((slot) => getSlotWeekday(slot.date) === bulkWeekday)
      .filter((slot) => selectedKeys.has(getShiftKey(slot.shiftName, slot.startTime, slot.endTime)))
      .map((slot) => slot.id));
  }, [workspace, bulkWeekday, selectedBulkShiftKeys]);

  const applyWholeMonthRule = (): void => {
    if (!form || !workspace?.slots.length) return;
    const allSlotIds = new Set(workspace.slots.map((slot) => slot.id));
    setForm({
      ...form,
      entries: form.entries.map((entry) => allSlotIds.has(entry.slotId)
        ? { ...entry, status: bulkStatus }
        : entry),
    });
    setMessage(`כל ${allSlotIds.size} משמרות החודש סומנו כ${statusLabels[bulkStatus]}. אפשר לשנות כל משמרת ידנית או להחיל כלל נוסף לפני השמירה.`);
  };

  const applyBulkRule = (): void => {
    if (!form || matchingBulkSlotIds.size === 0) return;
    setForm({
      ...form,
      entries: form.entries.map((entry) => matchingBulkSlotIds.has(entry.slotId)
        ? { ...entry, status: bulkStatus }
        : entry),
    });
    setMessage(`הכלל הוחל על ${matchingBulkSlotIds.size} משמרות. אפשר עדיין לשנות משמרות בודדות לפני השמירה.`);
  };
  const setNumber = (key: 'minimum'|'target'|'maximum', value: string) => setForm((current) => current ? ({ ...current, [key]: value === '' ? null : Number(value) }) : current);

  const save = async () => {
    if (!canEdit || !form || !selectedUserId) return;
    setBusy(true); setError(null); setMessage(null);
    try {
      await dynamicSchedulingService.saveAvailabilityShadowSubmission(jobType.id, year, month, selectedUserId, form);
      setMessage('האילוצים נשמרו ב־Shadow בלבד.'); await load();
    } catch (err) { setError(err instanceof Error ? err.message : 'שמירת האילוצים נכשלה.'); }
    finally { setBusy(false); }
  };

  const compare = async () => {
    setBusy(true); setError(null);
    try { setComparison(await dynamicSchedulingService.compareAvailabilityShadowToLegacy(jobType.id, year, month)); }
    catch (err) { setError(err instanceof Error ? err.message : 'השוואת Legacy נכשלה.'); }
    finally { setBusy(false); }
  };

  if (busy && !workspace) return <div className="dynamic-shadow-loading"><LoaderCircle className="spin" size={18}/> טוען סביבת אילוצים...</div>;
  if (!workspace?.materialized) return <div className="dynamic-shadow-empty">יש ליצור קודם תקופת Shadow לחודש הנבחר.</div>;

  const availabilityConfig = workspace.availabilityConfig ?? fallbackAvailabilityConfig;
  const monthlyCapacity = availabilityConfig.monthlyCapacity ?? fallbackAvailabilityConfig.monthlyCapacity;
  const statuses = availabilityConfig.statuses?.length ? availabilityConfig.statuses : fallbackAvailabilityConfig.statuses;

  return <div className="dynamic-availability-workspace">
    {!canEdit ? <div className="dynamic-period-workflow-note">מצב צפייה בלבד — אין לך הרשאת ניהול הגשות אילוצים עבור התפקיד הזה.</div> : null}
    {error ? <div className="users-error" role="alert">{error}</div> : null}
    {message ? <div className="dynamic-shadow-success"><Check size={15}/>{message}</div> : null}
    <div className="dynamic-availability-toolbar">
      <label>עובד<select value={selectedUserId} onChange={(e) => setSelectedUserId(e.target.value)}>{workspace.members.map((m) => <option key={m.userId} value={m.userId}>{m.displayName}{m.isActive ? '' : ' · מושבת'}</option>)}</select></label>
      <Button variant="secondary" disabled={busy} onClick={() => void compare()}><GitCompareArrows size={16}/> השווה למערכת הקיימת</Button>
    </div>

    {form && member ? <>
      <div className="dynamic-availability-bulk-rule">
        <div className="dynamic-availability-bulk-rule-head">
          <div>
            <h4><Sparkles size={17}/> החלת כלל מהירה</h4>
            <p>במקום לעבור משמרת-משמרת, בנה כלל והחל אותו בבת אחת. לאחר מכן אפשר לתקן חריגים ידנית.</p>
          </div>
          <span>{matchingBulkSlotIds.size} משמרות יתעדכנו</span>
        </div>
        <div className="dynamic-availability-rule-sentence">
          <span>סמן</span>
          <select value={bulkStatus} onChange={(event) => setBulkStatus(event.target.value as Status)} aria-label="סטטוס אילוץ">
            {statuses.map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}
          </select>
          <span>במשמרות ביום</span>
          <select
            value={bulkWeekday}
            onChange={(event) => {
              setBulkWeekday(Number(event.target.value));
              setBulkShiftKeys(null);
            }}
            aria-label="יום בשבוע"
          >
            {weekdayOptions.map((day) => <option key={day.value} value={day.value}>{day.label}</option>)}
          </select>
          <span>במשמרות</span>
        </div>
        <div className="dynamic-availability-shift-picker" aria-label="בחירת משמרות ביום שנבחר">
          {bulkShiftOptions.length ? bulkShiftOptions.map((shift) => (
            <label key={shift.key} className={selectedBulkShiftKeys.includes(shift.key) ? 'is-selected' : ''}>
              <input
                type="checkbox"
                checked={selectedBulkShiftKeys.includes(shift.key)}
                onChange={() => toggleBulkShift(shift.key)}
              />
              <span>{shift.label}</span>
            </label>
          )) : <small>לא נמצאו משמרות ביום שנבחר.</small>}
        </div>
        {bulkShiftOptions.length ? (
          <div className="dynamic-availability-shift-picker-actions">
            <button type="button" onClick={() => setBulkShiftKeys(null)}>סמן את כל המשמרות</button>
            <button type="button" onClick={() => setBulkShiftKeys([])}>נקה בחירה</button>
          </div>
        ) : null}
        <small className="dynamic-availability-rule-help">ברירת המחדל היא כל המשמרות ביום שנבחר. אפשר לבטל משמרות שלא רוצים לכלול בכלל.</small>
        <div className="dynamic-availability-rule-actions">
          <Button variant="secondary" disabled={!canEdit || matchingBulkSlotIds.size === 0} onClick={applyBulkRule}>
            החל כלל על {matchingBulkSlotIds.size} משמרות
          </Button>
          {matchingBulkSlotIds.size === 0 ? <small>בחר לפחות משמרת אחת ביום שנבחר כדי להחיל את הכלל.</small> : null}
        </div>

        <div className="dynamic-availability-whole-month-rule">
          <div>
            <strong>החלה על כל החודש</strong>
            <span>סמן את כל {workspace.slots.length} משמרות החודש כ־{statusLabels[bulkStatus]}, ואז תקן חריגים ידנית או באמצעות החוק שמעל.</span>
          </div>
          <Button variant="secondary" disabled={!canEdit || workspace.slots.length === 0} onClick={applyWholeMonthRule}>
            החל {statusLabels[bulkStatus]} על כל החודש
          </Button>
        </div>
      </div>

      <div className="dynamic-capacity-row">
        {monthlyCapacity.minEnabled ? <label>מינימום<input type="number" min="0" value={form.minimum ?? ''} onChange={(e) => setNumber('minimum',e.target.value)}/></label> : null}
        {monthlyCapacity.targetEnabled ? <label>יעד<input type="number" min="0" value={form.target ?? ''} onChange={(e) => setNumber('target',e.target.value)}/></label> : null}
        {monthlyCapacity.maxEnabled ? <label>מקסימום<input type="number" min="0" value={form.maximum ?? ''} onChange={(e) => setNumber('maximum',e.target.value)}/></label> : null}
        <label>מצב<select disabled={!canEdit} value={form.submissionStatus} onChange={(e) => setForm({ ...form, submissionStatus: e.target.value as SaveDynamicAvailabilityShadowSubmissionInput['submissionStatus'] })}><option value="draft">טיוטה</option><option value="submitted">הוגש</option><option value="reopened">נפתח מחדש</option></select></label>
      </div>
      <div className="dynamic-availability-grid">
        {workspace.slots.map((slot) => {
          const entry = form.entries.find((item) => item.slotId === slot.id)!;
          return <div className="dynamic-availability-slot" key={slot.id}>
            <div><strong>{new Date(`${slot.date}T12:00:00`).toLocaleDateString('he-IL',{day:'2-digit',month:'2-digit',weekday:'short'})}</strong><span>{slot.shiftName} · {slot.startTime.slice(0,5)}–{slot.endTime.slice(0,5)}</span>{slot.holidayName ? <small>{slot.holidayName}</small> : null}</div>
            <select value={entry.status} onChange={(e) => setEntry(slot.id,e.target.value as Status)}>{statuses.map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}</select>
          </div>;
        })}
      </div>
      <div className="dynamic-availability-save"><Button disabled={busy || !canEdit} onClick={() => void save()}><Save size={16}/> שמור אילוצי Shadow</Button></div>
    </> : <div className="dynamic-shadow-empty">אין עובדים משויכים לסוג התפקיד.</div>}

    {comparison ? <div className="dynamic-legacy-comparison">
      <h4>השוואה למערכת הקיימת</h4>
      {comparison.supported ? <div className="dynamic-shadow-metrics">
        <div><span>משמרות Dynamic / קיים</span><strong>{comparison.dynamic.slots} / {comparison.legacy.slots}</strong></div>
        <div><span>עובדים Dynamic / קיים</span><strong>{comparison.dynamic.members} / {comparison.legacy.members}</strong></div>
        <div><span>סימוני אילוצים</span><strong>{comparison.dynamic.entries} / {comparison.legacy.entries}</strong></div>
      </div> : <p>{comparison.note}</p>}
    </div> : null}
  </div>;
}

export default DynamicAvailabilityShadowWorkspace;
