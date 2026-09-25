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
  const [show200PercentHours, setShow200PercentHours] = useState(true);

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

  const draftStatistics = useMemo(() => {
    if (!workspace) return { shiftTypes: [], rows: [] };

    const shiftTypes = Array.from(new Map(
      workspace.slots.map((slot) => {
        const displayName = dynamicShiftDisplayName(slot.shiftName, 'משמרת');
        const key = `${displayName}__${formatTime(slot.startTime)}__${formatTime(slot.endTime)}`;
        return [key, {
          key,
          name: displayName,
          startTime: formatTime(slot.startTime),
          endTime: formatTime(slot.endTime),
        }] as const;
      }),
    ).values());

    const members = new Map<string, string>();
    workspace.slots.forEach((slot) => {
      slot.candidates.forEach((candidate) => members.set(candidate.userId, candidate.displayName));
      slot.assignments.forEach((assignment) => members.set(assignment.userId, assignment.displayName));
    });

    const availabilityWeight = (status: DynamicDraftEditorCandidate['availabilityStatus']): number => {
      if (status === 'preferred') return 1.25;
      if (status === 'available') return 1;
      if (status === 'avoid') return 0.2;
      return 0;
    };

    const opportunities = new Map<string, Record<string, number>>();
    members.forEach((_displayName, userId) => {
      opportunities.set(userId, Object.fromEntries(shiftTypes.map((shiftType) => [shiftType.key, 0])));
    });
    workspace.slots.forEach((slot) => {
      const key = `${dynamicShiftDisplayName(slot.shiftName, 'משמרת')}__${formatTime(slot.startTime)}__${formatTime(slot.endTime)}`;
      slot.candidates.forEach((candidate) => {
        const memberOpportunities = opportunities.get(candidate.userId);
        if (memberOpportunities) memberOpportunities[key] = (memberOpportunities[key] ?? 0) + availabilityWeight(candidate.availabilityStatus);
      });
    });

    const assignedByType = Object.fromEntries(shiftTypes.map((shiftType) => [shiftType.key, 0])) as Record<string, number>;
    workspace.slots.forEach((slot) => {
      const key = `${dynamicShiftDisplayName(slot.shiftName, 'משמרת')}__${formatTime(slot.startTime)}__${formatTime(slot.endTime)}`;
      assignedByType[key] = (assignedByType[key] ?? 0) + slot.assignments.length;
    });
    const totalAssigned = Object.values(assignedByType).reduce((sum, count) => sum + count, 0);
    const totalOpportunityWeight = Array.from(opportunities.values()).reduce(
      (sum, values) => sum + Object.values(values).reduce((inner, value) => inner + value, 0), 0,
    );

    const balanceTone = (actual: number, expected: number, opportunityWeight: number): 'good' | 'watch' | 'bad' | 'muted' => {
      if (opportunityWeight <= 0) return actual === 0 ? 'muted' : 'bad';
      const difference = Math.abs(actual - expected);
      if (difference <= Math.max(1, expected * 0.25)) return 'good';
      if (difference <= Math.max(2, expected * 0.5)) return 'watch';
      return 'bad';
    };

    const rows = Array.from(members, ([userId, displayName]) => {
      const counts = Object.fromEntries(shiftTypes.map((shiftType) => [shiftType.key, 0])) as Record<string, number>;
      let total = 0;
      let hours200Percent = 0;
      workspace.slots.forEach((slot) => {
        const assignedHere = slot.assignments.filter((assignment) => assignment.userId === userId).length;
        if (assignedHere === 0) return;
        const key = `${dynamicShiftDisplayName(slot.shiftName, 'משמרת')}__${formatTime(slot.startTime)}__${formatTime(slot.endTime)}`;
        counts[key] = (counts[key] ?? 0) + assignedHere;
        total += assignedHere;
        hours200Percent += assignedHere * Number(slot.hours200Percent ?? 0);
      });

      const memberOpportunities = opportunities.get(userId) ?? {};
      const typeBalance = Object.fromEntries(shiftTypes.map((shiftType) => {
        const opportunityWeight = memberOpportunities[shiftType.key] ?? 0;
        const allOpportunityWeight = Array.from(opportunities.values()).reduce((sum, values) => sum + (values[shiftType.key] ?? 0), 0);
        const expected = allOpportunityWeight > 0 ? (assignedByType[shiftType.key] ?? 0) * opportunityWeight / allOpportunityWeight : 0;
        return [shiftType.key, { expected, tone: balanceTone(counts[shiftType.key] ?? 0, expected, opportunityWeight) }] as const;
      }));
      const memberTotalOpportunityWeight = Object.values(memberOpportunities).reduce((sum, value) => sum + value, 0);
      const expectedTotal = totalOpportunityWeight > 0 ? totalAssigned * memberTotalOpportunityWeight / totalOpportunityWeight : 0;

      return {
        userId, displayName, total, hours200Percent, counts, typeBalance,
        totalBalance: { expected: expectedTotal, tone: balanceTone(total, expectedTotal, memberTotalOpportunityWeight) },
      };
    }).sort((a, b) => a.displayName.localeCompare(b.displayName, 'he'));

    return { shiftTypes, rows };
  }, [workspace]);

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

      <section className="dynamic-draft-statistics" aria-labelledby="dynamic-draft-statistics-title">
        <div className="dynamic-draft-statistics-head">
          <div>
            <h5 id="dynamic-draft-statistics-title">סטטיסטיקת הטיוטה</h5>
            <p>סיכום זמני של השיבוץ הנוכחי. הנתונים מתעדכנים לאחר כל שינוי בטיוטה.</p>
          </div>
          <label className="dynamic-draft-statistics-option">
            <span>הצג שעות 200%</span>
            <input
              type="checkbox"
              checked={show200PercentHours}
              onChange={(event) => setShow200PercentHours(event.target.checked)}
            />
            <span className="dynamic-draft-statistics-switch" aria-hidden="true"><span /></span>
          </label>
        </div>
        <div className="dynamic-draft-statistics-table-wrap">
          <table className="dynamic-draft-statistics-table">
            <thead>
              <tr>
                <th scope="col">עובד</th>
                <th scope="col">סה״כ</th>
                {show200PercentHours ? <th scope="col"><span>שעות 200%</span><small>בטיוטה</small></th> : null}
                {draftStatistics.shiftTypes.map((shiftType) => (
                  <th scope="col" key={shiftType.key}>
                    <span>{shiftType.name}</span>
                    <small><bdi dir="ltr">{shiftType.startTime}–{shiftType.endTime}</bdi></small>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {draftStatistics.rows.map((row) => (
                <tr key={row.userId}>
                  <th scope="row">{row.displayName}</th>
                  <td className={`balance-cell balance-${row.totalBalance.tone}`} title={`צפי יחסי לפי האילוצים: ${row.totalBalance.expected.toFixed(1)}`}><strong>{row.total}</strong></td>
                  {show200PercentHours ? (
                    <td className="balance-cell" title="סך שעות 200% במשמרות ששובצו לעובד בטיוטה"><strong>{new Intl.NumberFormat('he-IL', { maximumFractionDigits: 2 }).format(row.hours200Percent)}</strong></td>
                  ) : null}
                  {draftStatistics.shiftTypes.map((shiftType) => {
                    const balance = row.typeBalance[shiftType.key];
                    return (
                      <td
                        key={shiftType.key}
                        className={`balance-cell balance-${balance.tone}`}
                        title={`צפי יחסי לפי זמין/מעדיף/מעדיף שלא: ${balance.expected.toFixed(1)}`}
                      >
                        {row.counts[shiftType.key] ?? 0}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

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
