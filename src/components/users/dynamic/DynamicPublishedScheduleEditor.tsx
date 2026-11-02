/**
 * קובץ: src/components/users/dynamic/DynamicPublishedScheduleEditor.tsx
 * מטרה: מימוש רכיב תצוגה ואינטראקציה עבור דינמי / פורסם / שיבוץ.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: Props, DynamicPublishedScheduleEditor.
 * - קישור מאפיינים ומצב מקומי לתצוגה ולטיפול בפעולות המשתמש.
 */
import { AlertTriangle, CalendarDays, CheckCircle2, List, LoaderCircle, Save, UserRoundX } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { dynamicSchedulingService } from '../../../services/dynamicSchedulingService';
import type { DynamicPublishedEditorWorkspace } from '../../../types/dynamicScheduling';
import { Button } from '../../ui';
import { dynamicShiftDisplayName } from '../../../utils/dynamicShiftDisplayName';
import MonthCalendar from '../../calendar/MonthCalendar';

/**
 * חוזה הנתונים Props: מאפייני הרכיב.
 */
interface Props {
  // publicationId — מזהה.
  publicationId: string;
  // refreshKey — מפתח (אופציונלי).
  refreshKey?: number;
  // onChanged — פונקציית דיווח על שינוי (אופציונלי).
  onChanged?: () => void;
}

// UNASSIGNED_VALUE — ערך.
const UNASSIGNED_VALUE = '__UNASSIGNED__';

// availabilityLabel — אילוצים וזמינות / תווית.
const availabilityLabel: Record<string, string> = {
  preferred: 'מעדיף',
  available: 'זמין',
  avoid: 'מעדיף שלא',
  unavailable: 'לא זמין',
};

/**
 * פעולה formatDate: עיצוב ערך לתצוגה עבור תאריך.
 * @param value — ערך.
 * @returns string — הפלט בהתאם לחתימה.
 */
const formatDate = (value: string): string => {
  const [year, month, day] = value.slice(0, 10).split('-');
  return `${day}/${month}/${year}`;
};

/**
 * פעולה formatTime: עיצוב ערך לתצוגה עבור זמן.
 * @param value — ערך.
 * @returns string — הפלט בהתאם לחתימה.
 */
const formatTime = (value: string): string => value.slice(0, 5);

/**
 * פעולה DynamicPublishedScheduleEditor: דינמי / פורסם / שיבוץ.
 * פרמטר מפורק — שדות הקלט נגישים מקומית בשמות המוגדרים בחתימה.
 */
function DynamicPublishedScheduleEditor({ publicationId, refreshKey = 0, onChanged }: Props) {
  // מצב מקומי: workspace — הנתון workspace בהקשר הפעולה; setWorkspace מעדכנת אותו ומפעילה רינדור לפי React.
  const [workspace, setWorkspace] = useState<DynamicPublishedEditorWorkspace | null>(null);
  // מצב מקומי: busy — הנתון busy בהקשר הפעולה; setBusy מעדכנת אותו ומפעילה רינדור לפי React.
  const [busy, setBusy] = useState(false);
  // מצב מקומי: error — שגיאה; setError מעדכנת אותו ומפעילה רינדור לפי React.
  const [error, setError] = useState<string | null>(null);
  // מצב מקומי: message — הודעה; setMessage מעדכנת אותו ומפעילה רינדור לפי React.
  const [message, setMessage] = useState<string | null>(null);
  // מצב מקומי: selection — בחירה; setSelection מעדכנת אותו ומפעילה רינדור לפי React.
  const [selection, setSelection] = useState<Record<string, string>>({});
  // מצב מקומי: reason — הנתון reason בהקשר הפעולה; setReason מעדכנת אותו ומפעילה רינדור לפי React.
  const [reason, setReason] = useState<Record<string, string>>({});
  // מצב מקומי: viewMode — מצב פעולה; setViewMode מעדכנת אותו ומפעילה רינדור לפי React.
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('calendar');

  /**
   * פעולה אסינכרונית load: טעינת הנתון load בהקשר הפעולה.
   * @returns Promise<void> — הפלט בהתאם לחתימה.
   */
  const load = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
    try {
      // next — הנתון next בהקשר הפעולה.
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

  // תופעת לוואי לאחר רינדור בהתאם לתלויות [publicationId, refreshKey].
  useEffect(() => { void load(); }, [publicationId, refreshKey]);

  // ערך מחושב assignmentCount — הקצאה / כמות; נשמר בין רינדורים עד שינוי התלויות.
  const assignmentCount = useMemo(
    () => workspace?.slots.reduce((sum, slot) => sum + slot.assignments.length, 0) ?? 0,
    [workspace],
  );

  // ערך מחושב unassignedCount — כמות; נשמר בין רינדורים עד שינוי התלויות.
  const unassignedCount = useMemo(
    () => workspace?.slots.reduce((sum, slot) => sum + slot.intentionallyUnassignedCount, 0) ?? 0,
    [workspace],
  );

  // ערך מחושב pendingChanges — ממתין; נשמר בין רינדורים עד שינוי התלויות.
  const pendingChanges = useMemo(() => {
    if (!workspace) return [];

    const changes: Array<{
      // slotId — מזהה.
      slotId: string;
      // assignmentId — הקצאה / מזהה.
      assignmentId: string | null;
      // userId — מזהה משתמש.
      userId: string | null;
      // reasonKey — מפתח.
      reasonKey: string;
    }> = [];

    workspace.slots.forEach((slot) => {
      slot.assignments.forEach((assignment) => {
        // selected — נבחר.
        const selected = selection[assignment.id];
        if (!selected || selected === assignment.userId) return;

        changes.push({
          slotId: slot.slotId,
          assignmentId: assignment.id,
          userId: selected === UNASSIGNED_VALUE ? null : selected,
          reasonKey: assignment.id,
        });
      });

      // emptyKey — מפתח.
      const emptyKey = `empty-${slot.slotId}`;
      // selectedForEmpty — נבחר.
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

  // hasUnsavedChanges — הנתון hasUnsavedChanges בהקשר הפעולה.
  const hasUnsavedChanges = pendingChanges.length > 0;

  /**
   * פעולה candidateLabel: תווית.
   * @param displayName — שם תצוגה.
   * @param status — סטטוס.
   * @returns string — הפלט בהתאם לחתימה.
   */
  const candidateLabel = (displayName: string, status: string | null): string =>
    `${displayName} · ${status ? availabilityLabel[status] ?? status : 'לא הוגש'}`;

  /**
   * פעולה renderAssignmentSelect: בניית תצוגה עבור הקצאה.
   * @param slot — הנתון slot בהקשר הפעולה.
   * @param assignment — הקצאה.
   */
  const renderAssignmentSelect = (slot: DynamicPublishedEditorWorkspace['slots'][number], assignment: DynamicPublishedEditorWorkspace['slots'][number]['assignments'][number]) => {
    // selected — נבחר.
    const selected = selection[assignment.id] ?? assignment.userId;
    return (
      <select
        value={selected}
        disabled={busy || !workspace?.editable}
        onChange={(event) => {
          setMessage(null);
          setSelection((current) => ({ ...current, [assignment.id]: event.target.value }));
        }}
      >
        <option value={assignment.userId}>{candidateLabel(assignment.displayName, slot.candidates.find((candidate) => candidate.userId === assignment.userId)?.availabilityStatus ?? null)} (נוכחי)</option>
        <option value={UNASSIGNED_VALUE}>— השאר משמרת לא מאוישת —</option>
        {slot.candidates
          .filter((candidate) => candidate.userId !== assignment.userId)
          .map((candidate) => <option key={candidate.userId} value={candidate.userId}>{candidateLabel(candidate.displayName, candidate.availabilityStatus)}</option>)}
      </select>
    );
  };

  // תופעת לוואי לאחר רינדור בהתאם לתלויות [hasUnsavedChanges].
  useEffect(() => {
    /**
     * פעולה handleBeforeUnload: טיפול באירוע עבור הנתון handleBeforeUnload בהקשר הפעולה.
     * @param event — אירוע.
     * @returns void — הפלט בהתאם לחתימה.
     */
    const handleBeforeUnload = (event: BeforeUnloadEvent): void => {
      if (!hasUnsavedChanges) return;
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  /**
   * פעולה אסינכרונית saveAll: שמירת הנתון saveAll בהקשר הפעולה.
   * @returns Promise<void> — הפלט בהתאם לחתימה.
   */
  const saveAll = async (): Promise<void> => {
    if (!workspace?.editable || pendingChanges.length === 0) return;

    setBusy(true);
    setError(null);
    setMessage(null);

    // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
    try {
      // עיבוד כל פריט מתוך pendingChanges בנפרד.
      for (const change of pendingChanges) {
        await dynamicSchedulingService.setPublishedScheduleAssignment({
          publicationId,
          slotId: change.slotId,
          assignmentId: change.assignmentId,
          userId: change.userId,
          reason: reason[change.reasonKey]?.trim() || null,
        });
      }

      // savedCount — כמות.
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

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר busy && !workspace.
  if (busy && !workspace) {
    return <div className="dynamic-job-types-loading"><LoaderCircle className="spin" size={18} /> טוען לוח מפורסם…</div>;
  }

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !workspace.
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

      <div className="dynamic-draft-view-toggle" role="group" aria-label="תצוגת עריכת לוח מפורסם">
        <button type="button" className={viewMode === 'list' ? 'is-active' : ''} onClick={() => setViewMode('list')}><List size={16} /> רשימה</button>
        <button type="button" className={viewMode === 'calendar' ? 'is-active' : ''} onClick={() => setViewMode('calendar')}><CalendarDays size={16} /> טבלה חודשית</button>
      </div>

      {viewMode === 'calendar' ? (
        <div className="dynamic-draft-calendar">
          <MonthCalendar
            year={workspace.year}
            month={workspace.month}
            renderDayContent={({ date }) => {
              // daySlots — יום.
              const daySlots = workspace.slots.filter((slot) => slot.shiftDate.slice(0, 10) === date);
              if (daySlots.length === 0) return <span className="dynamic-draft-calendar-empty">אין משמרות</span>;
              return (
                <div className="dynamic-draft-calendar-slots">
                  {daySlots.map((slot) => (
                    <div key={slot.slotId} className="dynamic-draft-calendar-shift">
                      <div className="dynamic-draft-calendar-shift-head">
                        <strong>{dynamicShiftDisplayName(slot.shiftName, 'משמרת')}</strong>
                        <bdi dir="ltr">{formatTime(slot.startTime)}–{formatTime(slot.endTime)}</bdi>
                      </div>
                      {slot.assignments.map((assignment) => (
                        <div key={assignment.id}>{renderAssignmentSelect(slot, assignment)}</div>
                      ))}
                      {slot.assignments.length === 0 && slot.intentionallyUnassignedCount === 0 ? <span className="dynamic-draft-calendar-unassigned">לא מאויש</span> : null}
                      {slot.intentionallyUnassignedCount > 0 ? (
                        <select
                          value={selection[`empty-${slot.slotId}`] ?? ''}
                          disabled={busy || !workspace.editable}
                          aria-label={`${dynamicShiftDisplayName(slot.shiftName, 'משמרת')} - עמדה לא מאוישת`}
                          onChange={(event) => {
                            setMessage(null);
                            setSelection((current) => ({ ...current, [`empty-${slot.slotId}`]: event.target.value }));
                          }}
                        >
                          <option value="">לא מאויש בכוונה</option>
                          {slot.candidates.map((candidate) => <option key={candidate.userId} value={candidate.userId}>{candidateLabel(candidate.displayName, candidate.availabilityStatus)}</option>)}
                        </select>
                      ) : null}
                    </div>
                  ))}
                </div>
              );
            }}
            getDayClassName={({ date }) => workspace.slots.some((slot) => slot.shiftDate.slice(0, 10) === date) ? 'dynamic-draft-calendar-day' : null}
          />
        </div>
      ) : (
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
              // key — מפתח.
              const key = assignment.id;
              // selected — נבחר.
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
                  {renderAssignmentSelect(slot, assignment)}
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
                  {slot.candidates.map((candidate) => <option key={candidate.userId} value={candidate.userId}>{candidateLabel(candidate.displayName, candidate.availabilityStatus)}</option>)}
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
      )}

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
