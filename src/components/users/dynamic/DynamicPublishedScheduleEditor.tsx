import { AlertTriangle, CheckCircle2, LoaderCircle, Save, UserRoundX } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { dynamicSchedulingService } from '../../../services/dynamicSchedulingService';
import type { DynamicPublishedEditorWorkspace } from '../../../types/dynamicScheduling';
import { Button } from '../../ui';
import { dynamicShiftDisplayName } from '../../../utils/dynamicShiftDisplayName';

interface Props {
  publicationId: string;
  refreshKey?: number;
  onChanged?: () => void;
}

const UNASSIGNED_VALUE = '__UNASSIGNED__';

const formatDate = (value: string): string => {
  const [year, month, day] = value.slice(0, 10).split('-');
  return `${day}/${month}/${year}`;
};

const formatTime = (value: string): string => value.slice(0, 5);

function DynamicPublishedScheduleEditor({ publicationId, refreshKey = 0, onChanged }: Props) {
  const [workspace, setWorkspace] = useState<DynamicPublishedEditorWorkspace | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [selection, setSelection] = useState<Record<string, string>>({});
  const [reason, setReason] = useState<Record<string, string>>({});

  const load = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      const next = await dynamicSchedulingService.getPublishedScheduleEditor(publicationId);
      setWorkspace(next);
      setSelection({});
      setReason({});
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'טעינת הלוח המפורסם נכשלה.');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => { void load(); }, [publicationId, refreshKey]);

  const assignmentCount = useMemo(
    () => workspace?.slots.reduce((sum, slot) => sum + slot.assignments.length, 0) ?? 0,
    [workspace],
  );

  const unassignedCount = useMemo(
    () => workspace?.slots.reduce((sum, slot) => sum + slot.intentionallyUnassignedCount, 0) ?? 0,
    [workspace],
  );

  const pendingChanges = useMemo(() => {
    if (!workspace) return [];

    const changes: Array<{
      slotId: string;
      assignmentId: string | null;
      userId: string | null;
      reasonKey: string;
    }> = [];

    workspace.slots.forEach((slot) => {
      slot.assignments.forEach((assignment) => {
        const selected = selection[assignment.id];
        if (!selected || selected === assignment.userId) return;

        changes.push({
          slotId: slot.slotId,
          assignmentId: assignment.id,
          userId: selected === UNASSIGNED_VALUE ? null : selected,
          reasonKey: assignment.id,
        });
      });

      const emptyKey = `empty-${slot.slotId}`;
      const selectedForEmpty = selection[emptyKey];
      if (slot.intentionallyUnassignedCount > 0 && selectedForEmpty) {
        changes.push({
          slotId: slot.slotId,
          assignmentId: null,
          userId: selectedForEmpty,
          reasonKey: slot.slotId,
        });
      }
    });

    return changes;
  }, [selection, workspace]);

  const hasUnsavedChanges = pendingChanges.length > 0;

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent): void => {
      if (!hasUnsavedChanges) return;
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  const saveAll = async (): Promise<void> => {
    if (!workspace?.editable || pendingChanges.length === 0) return;

    setBusy(true);
    setError(null);
    setMessage(null);

    try {
      for (const change of pendingChanges) {
        await dynamicSchedulingService.setPublishedScheduleAssignment({
          publicationId,
          slotId: change.slotId,
          assignmentId: change.assignmentId,
          userId: change.userId,
          reason: reason[change.reasonKey]?.trim() || null,
        });
      }

      const savedCount = pendingChanges.length;
      setMessage(savedCount === 1 ? 'השינוי נשמר בהצלחה.' : `${savedCount} שינויים נשמרו בהצלחה.`);
      await load();
      onChanged?.();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'שמירת השינויים בלוח המפורסם נכשלה.');
    } finally {
      setBusy(false);
    }
  };

  if (busy && !workspace) {
    return <div className="dynamic-job-types-loading"><LoaderCircle className="spin" size={18} /> טוען לוח מפורסם…</div>;
  }

  if (!workspace) {
    return error ? <div className="users-error" role="alert">{error}</div> : null;
  }

  return (
    <div className="dynamic-published-editor">
      <div className="dynamic-published-editor-head">
        <div>
          <h4>עריכת לוח מפורסם</h4>
          <p>בצע את כל השינויים הרצויים ולאחר מכן לחץ על „שמור שינויים”. רק חברי תפקיד פעילים מוצגים לבחירה.</p>
        </div>
        <div className="dynamic-draft-editor-summary">
          <span><strong>{assignmentCount}</strong> מאוישים</span>
          <span><strong>{unassignedCount}</strong> לא מאוישים בכוונה</span>
        </div>
      </div>

      {!workspace.editable ? (
        <div className="dynamic-period-workflow-note is-warning">
          <AlertTriangle size={16} /> {workspace.editabilityReason ?? 'הלוח אינו פתוח לעריכה.'}
        </div>
      ) : null}
      {error ? <div className="users-error" role="alert">{error}</div> : null}
      {message ? <div className="dynamic-shadow-success"><CheckCircle2 size={16} />{message}</div> : null}

      <div className="dynamic-published-editor-list">
        {workspace.slots.map((slot) => (
          <section className="dynamic-published-editor-slot" key={slot.slotId}>
            <header>
              <div>
                <strong>{dynamicShiftDisplayName(slot.shiftName, 'משמרת')}</strong>
                <span><bdi dir="ltr">{formatDate(slot.shiftDate)}</bdi> · <bdi dir="ltr">{formatTime(slot.startTime)}–{formatTime(slot.endTime)}</bdi></span>
              </div>
              {slot.intentionallyUnassignedCount > 0 ? <span className="is-unassigned">לא מאויש בכוונה × {slot.intentionallyUnassignedCount}</span> : null}
            </header>

            {slot.assignments.map((assignment) => {
              const key = assignment.id;
              const selected = selection[key] ?? assignment.userId;
              const changed = selected !== assignment.userId;

              return (
                <div className={`dynamic-published-editor-row${changed ? ' has-pending-change' : ''}`} key={assignment.id}>
                  <div className="dynamic-published-editor-current">
                    <span>שיבוץ נוכחי</span>
                    <strong>{assignment.displayName}</strong>
                    {!assignment.userIsActive ? <small className="is-inactive">משתמש לא פעיל — נשמר כהיסטוריה אך אינו זמין לבחירה מחדש.</small> : null}
                    {assignment.originalDisplayName && assignment.originalUserId !== assignment.userId ? <small>סבב מקורי: {assignment.originalDisplayName}</small> : null}
                  </div>
                  <select
                    value={selected}
                    disabled={busy || !workspace.editable}
                    onChange={(event) => {
                      setMessage(null);
                      setSelection((current) => ({ ...current, [key]: event.target.value }));
                    }}
                  >
                    <option value={assignment.userId}>{assignment.displayName} (נוכחי)</option>
                    <option value={UNASSIGNED_VALUE}>— השאר משמרת לא מאוישת —</option>
                    {workspace.members
                      .filter((member) => member.userId !== assignment.userId)
                      .map((member) => <option key={member.userId} value={member.userId}>{member.displayName}</option>)}
                  </select>
                  <input
                    type="text"
                    value={reason[key] ?? ''}
                    disabled={busy || !workspace.editable}
                    placeholder="סיבת שינוי (אופציונלי)"
                    onChange={(event) => setReason((current) => ({ ...current, [key]: event.target.value }))}
                  />
                  {changed ? (
                    <span className="dynamic-published-editor-pending">
                      {selected === UNASSIGNED_VALUE ? <UserRoundX size={15} /> : null}
                      ממתין לשמירה
                    </span>
                  ) : null}
                </div>
              );
            })}

            {slot.intentionallyUnassignedCount > 0 ? (
              <div className={`dynamic-published-editor-row is-empty${selection[`empty-${slot.slotId}`] ? ' has-pending-change' : ''}`}>
                <div className="dynamic-published-editor-current">
                  <span>עמדה פנויה</span>
                  <strong>לא מאויש</strong>
                </div>
                <select
                  value={selection[`empty-${slot.slotId}`] ?? ''}
                  disabled={busy || !workspace.editable}
                  onChange={(event) => {
                    setMessage(null);
                    setSelection((current) => ({ ...current, [`empty-${slot.slotId}`]: event.target.value }));
                  }}
                >
                  <option value="">השאר לא מאויש…</option>
                  {workspace.members.map((member) => <option key={member.userId} value={member.userId}>{member.displayName}</option>)}
                </select>
                <input
                  type="text"
                  value={reason[slot.slotId] ?? ''}
                  disabled={busy || !workspace.editable}
                  placeholder="סיבת שינוי (אופציונלי)"
                  onChange={(event) => setReason((current) => ({ ...current, [slot.slotId]: event.target.value }))}
                />
                {selection[`empty-${slot.slotId}`] ? <span className="dynamic-published-editor-pending">ממתין לשמירה</span> : null}
              </div>
            ) : null}
          </section>
        ))}
      </div>

      <div className={`dynamic-published-editor-savebar${hasUnsavedChanges ? ' has-changes' : ''}`}>
        <div>
          <strong>{hasUnsavedChanges ? `${pendingChanges.length} שינויים ממתינים לשמירה` : 'אין שינויים שטרם נשמרו'}</strong>
          <span>{hasUnsavedChanges ? 'השינויים לא יחולו על הלוח עד ללחיצה על שמירה.' : 'בחר עובד אחר או „השאר משמרת לא מאוישת” כדי לבצע שינוי.'}</span>
        </div>
        <Button
          disabled={busy || !workspace.editable || !hasUnsavedChanges}
          onClick={() => void saveAll()}
        >
          {busy ? <LoaderCircle className="spin" size={16} /> : <Save size={16} />}
          שמור שינויים
        </Button>
      </div>
    </div>
  );
}

export default DynamicPublishedScheduleEditor;
