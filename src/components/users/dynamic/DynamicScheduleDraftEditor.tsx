import { AlertTriangle, CalendarDays, CheckCircle2, List, LoaderCircle, Trash2, UserPlus, WandSparkles } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { dynamicSchedulingService } from '../../../services/dynamicSchedulingService';
import type { DynamicDraftEditorCandidate, DynamicDraftEditorWorkspace } from '../../../types/dynamicScheduling';
import { Button } from '../../ui';
import MonthCalendar from '../../calendar/MonthCalendar';
import { dynamicShiftDisplayName } from '../../../utils/dynamicShiftDisplayName';

interface Props {
  draftId: string;
  refreshKey?: number;
  onChanged?: () => void;
}

const availabilityLabel: Record<string, string> = {
  preferred: 'מעדיף', available: 'זמין', avoid: 'מעדיף שלא', unavailable: 'לא זמין',
};

const formatDate = (value: string): string => {
  const [year, month, day] = value.slice(0, 10).split('-');
  return `${day}/${month}/${year}`;
};

const formatTime = (value: string): string => value.slice(0, 5);

function candidateLabel(candidate: DynamicDraftEditorCandidate): string {
  const status = candidate.availabilityStatus ? availabilityLabel[candidate.availabilityStatus] ?? candidate.availabilityStatus : 'לא הוגש';
  const max = candidate.maximum == null ? '' : ` · ${candidate.assignedCount}/${candidate.maximum}`;
  return `${candidate.displayName} · ${status}${max}`;
}

function DynamicScheduleDraftEditor({ draftId, refreshKey = 0, onChanged }: Props) {
  const [workspace, setWorkspace] = useState<DynamicDraftEditorWorkspace | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pendingCandidate, setPendingCandidate] = useState<Record<string, string>>({});
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');

  const load = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      setWorkspace(await dynamicSchedulingService.getDraftEditor(draftId));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'טעינת טיוטת השיבוץ נכשלה.');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => { void load(); }, [draftId, refreshKey]);

  const run = async (action: () => Promise<void>, success: string): Promise<void> => {
    setBusy(true); setError(null); setMessage(null);
    try {
      await action();
      setMessage(success);
      await load();
      onChanged?.();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'הפעולה נכשלה.');
    } finally { setBusy(false); }
  };

  const metrics = workspace?.metrics ?? {};
  const effectiveMissing = Number(metrics.effectiveUnfilledRequiredPositions ?? metrics.unfilledRequiredPositions ?? 0);
  const intentionalMissing = Number(metrics.intentionalUnfilledRequiredPositions ?? 0);
  const managerEdits = Number(metrics.managerEditedAssignments ?? 0);
  const totalAssignments = useMemo(() => workspace?.slots.reduce((sum, slot) => sum + slot.assignments.length, 0) ?? 0, [workspace]);

  if (busy && !workspace) return <div className="dynamic-job-types-loading"><LoaderCircle className="spin" size={18} /> טוען טיוטה…</div>;
  if (!workspace) return error ? <div className="users-error" role="alert">{error}</div> : null;

  return (
    <div className="dynamic-draft-editor">
      <div className="dynamic-draft-editor-head">
        <div>
          <h4><WandSparkles size={18} /> עריכת טיוטת שיבוץ</h4>
          <p>המנוע יצר בסיס. אפשר להחליף עובדים, להשלים חוסרים או לסמן עמדה כחסרה בכוונה לפני הפרסום.</p>
        </div>
        <div className="dynamic-draft-editor-summary">
          <span><strong>{totalAssignments}</strong> שיבוצים</span>
          <span><strong>{managerEdits}</strong> שונו ידנית</span>
          <span className={effectiveMissing > 0 ? 'is-warning' : 'is-ok'}><strong>{effectiveMissing}</strong> חוסרים לפרסום</span>
          {intentionalMissing > 0 ? <span><strong>{intentionalMissing}</strong> לא מאוישים בכוונה</span> : null}
        </div>
      </div>

      {error ? <div className="users-error" role="alert">{error}</div> : null}
      {message ? <div className="dynamic-shadow-success"><CheckCircle2 size={16} />{message}</div> : null}

      <div className="dynamic-draft-view-toggle" role="group" aria-label="תצוגת טיוטת שיבוץ">
        <button type="button" className={viewMode === 'list' ? 'is-active' : ''} onClick={() => setViewMode('list')}><List size={16} /> רשימה</button>
        <button type="button" className={viewMode === 'calendar' ? 'is-active' : ''} onClick={() => setViewMode('calendar')}><CalendarDays size={16} /> טבלה חודשית</button>
      </div>

      {viewMode === 'calendar' ? (
        <div className="dynamic-draft-calendar">
          <MonthCalendar
            year={workspace.year}
            month={workspace.month}
            renderDayContent={({ date }) => {
              const daySlots = workspace.slots.filter((slot) => slot.date.slice(0, 10) === date);
              if (daySlots.length === 0) return <span className="dynamic-draft-calendar-empty">אין משמרות</span>;
              return (
                <div className="dynamic-draft-calendar-slots">
                  {daySlots.map((slot) => {
                    const requiredAssigned = slot.assignments.filter((assignment) => assignment.tier === 'required').length;
                    const missing = Math.max(slot.minWorkers - requiredAssigned, 0);
                    const effectiveSlotMissing = Math.max(missing - slot.intentionallyUnassignedCount, 0);
                    return (
                      <div key={slot.slotId} className={`dynamic-draft-calendar-shift ${effectiveSlotMissing > 0 ? 'has-missing' : ''}`}>
                        <div className="dynamic-draft-calendar-shift-head">
                          <strong>{dynamicShiftDisplayName(slot.shiftName, 'משמרת')}</strong>
                          <bdi dir="ltr">{formatTime(slot.startTime)}–{formatTime(slot.endTime)}</bdi>
                        </div>
                        {slot.assignments.length > 0 ? slot.assignments.map((assignment) => (
                          <select
                            key={assignment.id}
                            value={assignment.userId}
                            disabled={busy}
                            aria-label={`${dynamicShiftDisplayName(slot.shiftName, 'משמרת')} - עובד משובץ`}
                            onChange={(event) => {
                              const nextUserId = event.target.value;
                              if (!nextUserId || nextUserId === assignment.userId) return;
                              void run(() => dynamicSchedulingService.setDraftAssignment(workspace.draftId, slot.slotId, assignment.id, nextUserId), 'השיבוץ עודכן ידנית.');
                            }}
                          >
                            {slot.candidates.map((candidate) => <option key={candidate.userId} value={candidate.userId}>{candidateLabel(candidate)}</option>)}
                          </select>
                        )) : <span className="dynamic-draft-calendar-unassigned">לא מאויש</span>}
                        <small>{requiredAssigned}/{slot.minWorkers} חובה{slot.intentionallyUnassignedCount > 0 ? ' · חוסר מאושר' : ''}</small>
                      </div>
                    );
                  })}
                </div>
              );
            }}
            getDayClassName={({ date }) => workspace.slots.some((slot) => slot.date.slice(0, 10) === date) ? 'dynamic-draft-calendar-day' : null}
          />
        </div>
      ) : (
      <div className="dynamic-draft-editor-list">
        {workspace.slots.map((slot) => {
          const requiredAssigned = slot.assignments.filter((assignment) => assignment.tier === 'required').length;
          const missing = Math.max(slot.minWorkers - requiredAssigned, 0);
          const effectiveSlotMissing = Math.max(missing - slot.intentionallyUnassignedCount, 0);
          const availableCandidates = slot.candidates.filter((candidate) => !candidate.isAssignedHere);
          return (
            <section className={`dynamic-draft-slot ${effectiveSlotMissing > 0 ? 'has-missing' : ''}`} key={slot.slotId}>
              <header>
                <div>
                  <strong>{dynamicShiftDisplayName(slot.shiftName, 'משמרת')}</strong>
                  <span><bdi dir="ltr">{formatDate(slot.date)}</bdi> · <bdi dir="ltr">{formatTime(slot.startTime)}–{formatTime(slot.endTime)}</bdi></span>
                </div>
                <span className="dynamic-draft-slot-coverage">{requiredAssigned}/{slot.minWorkers} חובה</span>
              </header>

              <div className="dynamic-draft-assignments">
                {slot.assignments.map((assignment) => (
                  <div className={`dynamic-draft-assignment ${assignment.managerEdited ? 'is-edited' : ''}`} key={assignment.id}>
                    <select
                      value={assignment.userId}
                      disabled={busy}
                      onChange={(event) => {
                        const nextUserId = event.target.value;
                        if (!nextUserId || nextUserId === assignment.userId) return;
                        void run(
                          () => dynamicSchedulingService.setDraftAssignment(workspace.draftId, slot.slotId, assignment.id, nextUserId),
                          'השיבוץ עודכן ידנית.',
                        );
                      }}
                    >
                      {slot.candidates.map((candidate) => <option key={candidate.userId} value={candidate.userId}>{candidateLabel(candidate)}</option>)}
                    </select>
                    <div className="dynamic-draft-assignment-meta">
                      {assignment.managerEdited ? (
                        <span className="is-edited-note">בחירת המנוע: {assignment.engineDisplayName ?? '—'}</span>
                      ) : <span>בחירת המנוע</span>}
                    </div>
                    <button
                      type="button"
                      className="icon-button danger"
                      title="הסר שיבוץ"
                      disabled={busy}
                      onClick={() => void run(() => dynamicSchedulingService.removeDraftAssignment(workspace.draftId, assignment.id), 'השיבוץ הוסר מהטיוטה.')}
                    ><Trash2 size={15} /></button>
                  </div>
                ))}
              </div>

              {slot.assignments.length < slot.maxWorkers && availableCandidates.length > 0 ? (
                <div className="dynamic-draft-add-worker">
                  <select value={pendingCandidate[slot.slotId] ?? ''} onChange={(event) => setPendingCandidate((current) => ({ ...current, [slot.slotId]: event.target.value }))}>
                    <option value="">בחר עובד להוספה…</option>
                    {availableCandidates.map((candidate) => <option key={candidate.userId} value={candidate.userId}>{candidateLabel(candidate)}</option>)}
                  </select>
                  <Button
                    disabled={busy || !pendingCandidate[slot.slotId]}
                    onClick={() => void run(async () => {
                      await dynamicSchedulingService.setDraftAssignment(workspace.draftId, slot.slotId, null, pendingCandidate[slot.slotId]);
                      setPendingCandidate((current) => ({ ...current, [slot.slotId]: '' }));
                    }, 'עובד נוסף לטיוטה.')}
                  ><UserPlus size={15} /> הוסף</Button>
                </div>
              ) : null}

              {missing > 0 ? (
                <div className="dynamic-draft-missing-control">
                  <AlertTriangle size={16} />
                  <span>חסרות {missing} עמדות חובה.</span>
                  <label>
                    <input
                      type="checkbox"
                      checked={slot.intentionallyUnassignedCount >= missing && missing > 0}
                      disabled={busy}
                      onChange={(event) => void run(
                        () => dynamicSchedulingService.setDraftIntentionallyUnassigned(workspace.draftId, slot.slotId, event.target.checked ? missing : 0),
                        event.target.checked ? 'המשמרת סומנה כלא מאוישת בכוונה.' : 'סימון הלא־מאוישת הוסר.',
                      )}
                    />
                    השאר את החוסר לא מאויש בכוונה
                  </label>
                </div>
              ) : null}
            </section>
          );
        })}
      </div>
      )}
    </div>
  );
}

export default DynamicScheduleDraftEditor;
