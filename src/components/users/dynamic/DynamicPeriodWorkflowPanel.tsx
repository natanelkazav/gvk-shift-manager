import { CalendarClock, CheckCircle2, ChevronUp, LoaderCircle, LockKeyhole, PencilLine, Play, Send, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { dynamicSchedulingService } from '../../../services/dynamicSchedulingService';
import type { DynamicJobType, DynamicPeriodWorkflowState } from '../../../types/dynamicScheduling';
import { Button } from '../../ui';
import DynamicAvailabilityShadowWorkspace from './DynamicAvailabilityShadowWorkspace';
import DynamicScheduleDraftEditor from './DynamicScheduleDraftEditor';
import DynamicPublishedScheduleEditor from './DynamicPublishedScheduleEditor';

interface Props {
  jobType: DynamicJobType;
  selectedYear?: number;
  selectedMonth?: number;
  showPeriodPicker?: boolean;
  onWorkflowChanged?: () => void;
}

const getInitialMonth = (): { year: number; month: number } => {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
};

const statusLabel: Record<string, string> = {
  shadow: 'נוצר',
  draft: 'טיוטה',
  open: 'אילוצים פתוחים',
  closed: 'אילוצים סגורים',
  archived: 'בארכיון',
  generated: 'טיוטת שיבוץ מוכנה',
  incomplete: 'טיוטה עם חוסרים',
  failed: 'יצירת טיוטה נכשלה',
  published: 'פורסם',
};

function DynamicPeriodWorkflowPanel({
  jobType,
  selectedYear,
  selectedMonth,
  showPeriodPicker = true,
  onWorkflowChanged,
}: Props) {
  const initial = useMemo(getInitialMonth, []);
  const [internalYear, setInternalYear] = useState(initial.year);
  const [internalMonth, setInternalMonth] = useState(initial.month);
  const year = selectedYear ?? internalYear;
  const month = selectedMonth ?? internalMonth;
  const [state, setState] = useState<DynamicPeriodWorkflowState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [showDraftEditor, setShowDraftEditor] = useState(false);
  const [showPublishedEditor, setShowPublishedEditor] = useState(false);

  const load = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      setState(await dynamicSchedulingService.getPeriodWorkflow(jobType.id, year, month));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'טעינת ניהול התקופה נכשלה.');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    setShowDraftEditor(false);
    setShowPublishedEditor(false);
    void load();
  }, [jobType.id, year, month]);

  const run = async (action: () => Promise<unknown>, successMessage: string): Promise<void> => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await action();
      setMessage(successMessage);
      setRefreshKey((value) => value + 1);
      await load();
      onWorkflowChanged?.();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'הפעולה נכשלה.');
    } finally {
      setBusy(false);
    }
  };

  const [deadlineInput, setDeadlineInput] = useState('');

  useEffect(() => {
    if (!state?.period?.submissionDeadline) {
      setDeadlineInput('');
      return;
    }
    const deadline = new Date(state.period.submissionDeadline);
    const offset = deadline.getTimezoneOffset();
    const local = new Date(deadline.getTime() - offset * 60_000);
    setDeadlineInput(local.toISOString().slice(0, 16));
  }, [state?.period?.submissionDeadline]);

  const saveDeadline = (): Promise<void> => run(
    async () => {
      await dynamicSchedulingService.setDynamicPeriodSubmissionDeadline(
        jobType.id,
        year,
        month,
        deadlineInput ? new Date(deadlineInput).toISOString() : null,
      );
    },
    'מועד ההגשה עודכן.',
  );

  const createPeriod = (): Promise<void> => run(
    async () => {
      if (!deadlineInput) {
        throw new Error('יש לקבוע מועד אחרון להגשת אילוצים לפני יצירת התקופה.');
      }
      await dynamicSchedulingService.createAvailabilityShadowPeriod(jobType.id, year, month);
      await dynamicSchedulingService.setDynamicPeriodSubmissionDeadline(
        jobType.id,
        year,
        month,
        new Date(deadlineInput).toISOString(),
      );
    },
    'תקופת האילוצים נוצרה ומועד ההגשה נשמר. אפשר לפתוח אותה להגשה.',
  );

  const openPeriod = (): Promise<void> => run(
    async () => {
      if (!state?.period?.submissionDeadline) {
        throw new Error('יש לקבוע ולשמור מועד אחרון להגשת אילוצים לפני פתיחת התקופה.');
      }
      await dynamicSchedulingService.setPeriodStatus(jobType.id, year, month, 'open');
    },
    'תקופת האילוצים נפתחה.',
  );

  const closePeriod = (): Promise<void> => run(
    async () => { await dynamicSchedulingService.setPeriodStatus(jobType.id, year, month, 'close'); },
    'תקופת האילוצים נסגרה. אפשר ליצור טיוטת שיבוץ.',
  );

  const createDraft = (): Promise<void> => run(
    async () => {
      if (state?.schedulingStrategy === 'monthly_rotation_constraints') {
        await dynamicSchedulingService.createMonthlyRotationDraft(jobType.id, year, month);
      } else {
        await dynamicSchedulingService.createSchedulingShadowDraft(jobType.id, year, month);
      }
    },
    state?.schedulingStrategy === 'monthly_rotation_constraints'
      ? 'טיוטת הסבב החודשי נוצרה. הרוטציה המקורית נשמרה בנפרד מהשיבוץ בפועל.'
      : 'טיוטת השיבוץ נוצרה במנוע הדינמי.',
  );

  const publishDraft = (): Promise<void> => {
    if (!state?.draft?.id) return Promise.resolve();
    return run(
      async () => { await dynamicSchedulingService.publishSchedulingDraft(state.draft!.id); },
      'הלוח הדינמי פורסם ונשמר כ־snapshot עצמאי.',
    );
  };

  const periodStatus = state?.period?.status ?? null;
  const draftStatus = state?.draft?.status ?? null;
  const unfilled = Number(state?.draft?.metrics?.unfilledRequiredPositions ?? 0);
  const effectiveUnfilled = Number(state?.draft?.metrics?.effectiveUnfilledRequiredPositions ?? unfilled);
  const canPublish = Boolean(state?.draft && periodStatus === 'closed' && effectiveUnfilled === 0 && ['generated', 'incomplete'].includes(draftStatus ?? ''));
  const permissions = state?.permissions ?? {};
  const can = (permissionKey: string): boolean => permissions[permissionKey] === true;
  const canOpenPeriod = can('availability.open_period');
  const canClosePeriod = can('availability.close_period');
  const canViewAvailability = can('availability.view_team');
  const canManageSubmissions = can('availability.manage_submissions');
  const canCreateDraft = state?.schedulingStrategy === 'monthly_rotation_constraints'
    ? can('rotation.generate')
    : can('schedule.create_draft');
  const canEditDraft = can('schedule.edit_draft');
  const canPublishSchedule = can('schedule.publish');
  const canEditPublished = can('schedule.edit_published');

  return (
    <div className="dynamic-period-workflow">
      <div className="dynamic-period-workflow-head">
        <div>
          <h4>ניהול תקופה דינמי</h4>
          <p>הזרימה כאן מחוברת ל־<code>job_type_id</code>: אילוצים → סגירה → יצירת טיוטה → פרסום.</p>
        </div>
        {showPeriodPicker ? (
          <div className="dynamic-period-workflow-picker">
            <label>
              חודש
              <select value={month} onChange={(event) => setInternalMonth(Number(event.target.value))}>
                {Array.from({ length: 12 }, (_, index) => index + 1).map((value) => (
                  <option value={value} key={value}>{String(value).padStart(2, '0')}</option>
                ))}
              </select>
            </label>
            <label>
              שנה
              <input type="number" min="2020" max="2100" value={year} onChange={(event) => setInternalYear(Number(event.target.value) || initial.year)} />
            </label>
          </div>
        ) : null}
      </div>

      {error ? <div className="users-error" role="alert">{error}</div> : null}
      {message ? <div className="dynamic-shadow-success"><CheckCircle2 size={16} />{message}</div> : null}

      {busy && !state ? (
        <div className="dynamic-job-types-loading"><LoaderCircle className="spin" size={18} /> טוען תקופה…</div>
      ) : state ? (
        <>
          <div className="dynamic-period-workflow-steps">
            <div className={state.period ? 'is-done' : 'is-current'}>
              <span>1</span><strong>תקופת אילוצים</strong><small>{state.period ? statusLabel[state.period.status] ?? state.period.status : 'טרם נוצרה'}</small>
            </div>
            <div className={state.draft ? 'is-done' : state.period?.status === 'closed' ? 'is-current' : ''}>
              <span>2</span><strong>טיוטת שיבוץ</strong><small>{state.draft ? statusLabel[state.draft.status] ?? state.draft.status : 'טרם נוצרה'}</small>
            </div>
            <div className={state.publication ? 'is-done' : state.draft ? 'is-current' : ''}>
              <span>3</span><strong>פרסום</strong><small>{state.publication ? `פורסם · ${state.publication.assignmentCount} שיבוצים` : 'טרם פורסם'}</small>
            </div>
          </div>

          <div className="dynamic-period-workflow-metrics">
            <span><strong>{state.memberCount}</strong> עובדים</span>
            <span><strong>{state.period?.slotCount ?? 0}</strong> משמרות/יחידות</span>
            <span><strong>{state.period?.submittedCount ?? 0}/{state.memberCount}</strong> הגישו</span>
            {state.draft ? <span><strong>{effectiveUnfilled}</strong> חוסרים שמונעים פרסום</span> : null}
          </div>

          {state.period?.status !== 'archived' ? (
            <div className="dynamic-period-deadline-card">
              <div>
                <strong>מועד אחרון להגשת אילוצים</strong>
                <span>
                  {state.period
                    ? 'המועד נשמר בתקופה הדינמית ומשמש את מסך ההגשה האישי.'
                    : 'קבע מועד הגשה לפני יצירת התקופה. המועד יישמר יחד עם יצירת תקופת האילוצים.'}
                </span>
              </div>
              <div className="dynamic-period-deadline-controls">
                <input
                  type="datetime-local"
                  value={deadlineInput}
                  disabled={!canOpenPeriod}
                  onChange={(event) => setDeadlineInput(event.target.value)}
                  aria-label="מועד אחרון להגשת אילוצים"
                />
                {state.period ? (
                  <Button variant="secondary" disabled={busy || !canOpenPeriod || !deadlineInput} onClick={() => void saveDeadline()}>שמור מועד</Button>
                ) : null}
              </div>
            </div>
          ) : null}

          <div className="dynamic-period-workflow-actions">
            {!state.period ? (
              <Button disabled={busy || !state.availabilityEnabled || !canOpenPeriod || !deadlineInput} onClick={() => void createPeriod()}><CalendarClock size={16} /> צור תקופת אילוצים</Button>
            ) : null}
            {state.period && ['shadow', 'draft', 'closed'].includes(state.period.status) && !state.publication ? (
              <Button disabled={busy || !canOpenPeriod || !state.period.submissionDeadline} onClick={() => void openPeriod()}><Play size={16} /> {state.period.status === 'closed' ? 'פתח אילוצים מחדש' : 'פתח אילוצים'}</Button>
            ) : null}
            {state.period?.status === 'open' ? (
              <Button disabled={busy || !canClosePeriod} onClick={() => void closePeriod()}><LockKeyhole size={16} /> סגור אילוצים</Button>
            ) : null}
            {state.period?.status === 'closed' && ['availability_optimizer', 'monthly_rotation_constraints'].includes(state.schedulingStrategy) ? (
              <Button disabled={busy || !canCreateDraft} onClick={() => void createDraft()}><Sparkles size={16} /> {state.draft ? 'צור טיוטה מחדש' : state.schedulingStrategy === 'monthly_rotation_constraints' ? 'צור טיוטת סבב חודשי' : 'צור טיוטת שיבוץ'}</Button>
            ) : null}
            {state.period?.status === 'closed' && state.schedulingStrategy === 'monthly_rotation_constraints' ? (
              <div className="dynamic-period-workflow-note">הסבב נשמר כרוטציה מקורית קבועה. אילוץ יכול להחליף את העובד בפועל ביום מסוים בלי להזיז את סדר הרוטציה של הימים והחודשים הבאים.</div>
            ) : null}
            {state.draft && !state.publication ? (
              <Button
                variant="secondary"
                disabled={busy || !canEditDraft}
                onClick={() => setShowDraftEditor((value) => !value)}
              >
                {showDraftEditor ? <ChevronUp size={16} /> : <PencilLine size={16} />}
                {showDraftEditor ? 'סגור עורך טיוטה' : 'ערוך טיוטת שיבוץ'}
              </Button>
            ) : null}
            {state.draft && !state.publication ? (
              <Button disabled={busy || !canPublish || !canPublishSchedule} onClick={() => void publishDraft()}><Send size={16} /> פרסם לוח דינמי</Button>
            ) : null}
            {state.publication?.status === 'published' ? (
              <Button
                variant="secondary"
                disabled={busy || !canEditPublished}
                onClick={() => setShowPublishedEditor((value) => !value)}
              >
                {showPublishedEditor ? <ChevronUp size={16} /> : <PencilLine size={16} />}
                {showPublishedEditor ? 'סגור עריכת לוח מפורסם' : 'ערוך לוח מפורסם'}
              </Button>
            ) : null}
          </div>

          {state.draft && effectiveUnfilled > 0 ? (
            <div className="dynamic-period-workflow-note is-warning">לא ניתן לפרסם כל עוד קיימות {effectiveUnfilled} עמדות חובה לא מאוישות שלא סומנו במפורש כחוסר מכוון.</div>
          ) : null}

          {state.draft && !state.publication && showDraftEditor && canEditDraft ? (
            <div className="dynamic-period-draft-editor-shell">
              <div className="dynamic-period-draft-editor-shell-head">
                <div>
                  <strong>טיוטת השיבוץ מוכנה לעריכה</strong>
                  <span>העריכה כאן משפיעה על הטיוטה הדינמית של החודש בלבד עד לפרסום.</span>
                </div>
              </div>
              <DynamicScheduleDraftEditor draftId={state.draft.id} refreshKey={refreshKey} onChanged={() => void load()} />
            </div>
          ) : null}

          {state.publication ? (
            <div className="dynamic-period-workflow-published"><CheckCircle2 size={18} /><div><strong>הלוח פורסם במערכת הדינמית</strong><span>{state.publication.assignmentCount} שיבוצים נשמרו ב־snapshot לפי התפקיד והחודש.</span></div></div>
          ) : null}

          {state.publication?.status === 'published' && showPublishedEditor && canEditPublished ? (
            <div className="dynamic-period-draft-editor-shell">
              <DynamicPublishedScheduleEditor
                publicationId={state.publication.id}
                refreshKey={refreshKey}
                onChanged={() => {
                  setRefreshKey((value) => value + 1);
                  void load();
                }}
              />
            </div>
          ) : null}

          {state.period?.status === 'open' && canViewAvailability ? (
            <div className="dynamic-period-workflow-availability">
              <h4>אילוצי העובדים</h4>
              <DynamicAvailabilityShadowWorkspace
                jobType={jobType}
                year={year}
                month={month}
                refreshKey={refreshKey}
                canEdit={canManageSubmissions}
              />
            </div>
          ) : state.period?.status === 'open' ? (
            <div className="dynamic-period-workflow-note">אין לך הרשאה לצפות באילוצי עובדי התפקיד.</div>
          ) : state.period ? (
            <div className="dynamic-period-workflow-note">עריכת אילוצים זמינה רק כאשר התקופה במצב פתוח.</div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

export default DynamicPeriodWorkflowPanel;
