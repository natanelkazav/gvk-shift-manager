import {
  CalendarClock,
  CalendarRange,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDashed,
  LayoutGrid,
  LoaderCircle,
  RefreshCw,
  UsersRound,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import DynamicPeriodWorkflowPanel from '../components/users/dynamic/DynamicPeriodWorkflowPanel';
import { Button, Card, CardBody, PageHeader } from '../components/ui';
import { dynamicSchedulingService } from '../services/dynamicSchedulingService';
import type { DynamicPublishedEditorWorkspace } from '../types/dynamicScheduling';
import type {
  DynamicShiftsManagementWorkspace,
  DynamicShiftsWorkspaceRole,
} from '../types/dynamicShiftsWorkspace';
import '../styles/dynamicShiftsWorkspace.css';

const HEBREW_MONTHS = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר',
];

type SchedulingHubView = 'management' | 'boards';

interface CombinedScheduleRow {
  date: string;
  jobTypeId: string;
  jobTypeName: string;
  shiftName: string;
  startTime: string;
  endTime: string;
  assignments: string[];
  intentionallyUnassignedCount: number;
}

const getCurrentMonth = (): { year: number; month: number } => {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
};

const moveMonth = (year: number, month: number, delta: number): { year: number; month: number } => {
  const date = new Date(year, month - 1 + delta, 1);
  return { year: date.getFullYear(), month: date.getMonth() + 1 };
};

const getRoleStage = (role: DynamicShiftsWorkspaceRole): {
  label: string;
  detail: string;
  tone: 'empty' | 'open' | 'draft' | 'published' | 'closed';
} => {
  const { workflow } = role;
  if (workflow.publication?.status === 'published') {
    return {
      label: 'לוח פעיל',
      detail: `${workflow.publication.assignmentCount} שיבוצים פורסמו`,
      tone: 'published',
    };
  }
  if (workflow.draft) {
    const effectiveUnfilled = Number(
      workflow.draft.metrics?.effectiveUnfilledRequiredPositions
      ?? workflow.draft.metrics?.unfilledRequiredPositions
      ?? 0,
    );
    return {
      label: 'טיוטת שיבוץ',
      detail: effectiveUnfilled > 0 ? `${effectiveUnfilled} חוסרים לבדיקה` : 'מוכנה לבדיקה ופרסום',
      tone: 'draft',
    };
  }
  if (workflow.period?.status === 'closed') {
    return { label: 'האילוצים נסגרו', detail: 'אפשר ליצור טיוטת שיבוץ', tone: 'closed' };
  }
  if (workflow.period?.status === 'open') {
    return {
      label: 'אילוצים פתוחים',
      detail: `${workflow.period.submittedCount}/${workflow.memberCount} עובדים הגישו`,
      tone: 'open',
    };
  }
  if (workflow.period) {
    return { label: 'החודש בהכנה', detail: 'תקופת האילוצים נוצרה וטרם נפתחה', tone: 'empty' };
  }
  return { label: 'טרם נפתח חודש', detail: 'אפשר להתחיל את מחזור השיבוץ', tone: 'empty' };
};

const formatScheduleDate = (value: string): string => {
  const date = new Date(`${value}T12:00:00`);
  return new Intl.DateTimeFormat('he-IL', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
  }).format(date);
};

function ShiftsPage() {
  const initial = useMemo(getCurrentMonth, []);
  const [searchParams, setSearchParams] = useSearchParams();
  const [year, setYear] = useState(() => Number(searchParams.get('year')) || initial.year);
  const [month, setMonth] = useState(() => Number(searchParams.get('month')) || initial.month);
  const [hubView, setHubView] = useState<SchedulingHubView>(() =>
    searchParams.get('view') === 'boards' ? 'boards' : 'management',
  );
  const [workspace, setWorkspace] = useState<DynamicShiftsManagementWorkspace | null>(null);
  const [selectedJobTypeId, setSelectedJobTypeId] = useState<string | null>(() => searchParams.get('jobType'));
  const [boardJobTypeFilter, setBoardJobTypeFilter] = useState<string>('all');
  const [publishedEditors, setPublishedEditors] = useState<DynamicPublishedEditorWorkspace[]>([]);
  const [boardsLoading, setBoardsLoading] = useState(false);
  const [boardsError, setBoardsError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (background = false): Promise<void> => {
    if (background) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const data = await dynamicSchedulingService.getShiftsManagementWorkspace(year, month);
      setWorkspace(data);
      setSelectedJobTypeId((current) => {
        if (current && data.roles.some((role) => role.jobType.id === current)) return current;
        return data.roles[0]?.jobType.id ?? null;
      });
    } catch (loadError) {
      setWorkspace(null);
      setError(loadError instanceof Error ? loadError.message : 'טעינת סביבת השיבוצים הדינמית נכשלה.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [year, month]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    next.set('year', String(year));
    next.set('month', String(month));
    next.set('view', hubView === 'boards' ? 'boards' : 'management');
    if (selectedJobTypeId) next.set('jobType', selectedJobTypeId);
    else next.delete('jobType');
    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true });
    }
  }, [year, month, hubView, selectedJobTypeId, searchParams, setSearchParams]);

  const publishedRoles = useMemo(
    () => workspace?.roles.filter((role) => role.workflow.publication?.status === 'published') ?? [],
    [workspace],
  );

  const loadPublishedBoards = useCallback(async (): Promise<void> => {
    if (!workspace || hubView !== 'boards') return;

    const publications = workspace.roles
      .map((role) => role.workflow.publication)
      .filter((publication): publication is NonNullable<typeof publication> => publication?.status === 'published');

    if (publications.length === 0) {
      setPublishedEditors([]);
      setBoardsError(null);
      return;
    }

    setBoardsLoading(true);
    setBoardsError(null);
    try {
      const results = await Promise.allSettled(
        publications.map((publication) =>
          dynamicSchedulingService.getPublishedScheduleEditor(publication.id),
        ),
      );
      const editors = results
        .filter((result): result is PromiseFulfilledResult<DynamicPublishedEditorWorkspace> => result.status === 'fulfilled')
        .map((result) => result.value);
      setPublishedEditors(editors);

      if (editors.length !== publications.length) {
        setBoardsError('חלק מהלוחות לא נטענו. ניתן לרענן ולנסות שוב.');
      }
    } catch (loadError) {
      setPublishedEditors([]);
      setBoardsError(loadError instanceof Error ? loadError.message : 'טעינת הלוחות שפורסמו נכשלה.');
    } finally {
      setBoardsLoading(false);
    }
  }, [hubView, workspace]);

  useEffect(() => {
    void loadPublishedBoards();
  }, [loadPublishedBoards]);

  const selectedRole = workspace?.roles.find((role) => role.jobType.id === selectedJobTypeId) ?? null;

  const combinedScheduleRows = useMemo<CombinedScheduleRow[]>(() => {
    return publishedEditors
      .filter((editor) => boardJobTypeFilter === 'all' || editor.jobTypeId === boardJobTypeFilter)
      .flatMap((editor) =>
        editor.slots.map((slot) => ({
          date: slot.shiftDate,
          jobTypeId: editor.jobTypeId,
          jobTypeName: editor.jobTypeName,
          shiftName: slot.shiftName,
          startTime: slot.startTime,
          endTime: slot.endTime,
          assignments: slot.assignments.map((assignment) => assignment.displayName),
          intentionallyUnassignedCount: slot.intentionallyUnassignedCount,
        })),
      )
      .sort((a, b) => {
        const byDate = a.date.localeCompare(b.date);
        if (byDate !== 0) return byDate;
        const byTime = a.startTime.localeCompare(b.startTime);
        if (byTime !== 0) return byTime;
        return a.jobTypeName.localeCompare(b.jobTypeName, 'he');
      });
  }, [boardJobTypeFilter, publishedEditors]);

  const groupedScheduleRows = useMemo(() => {
    const groups = new Map<string, CombinedScheduleRow[]>();
    combinedScheduleRows.forEach((row) => {
      const current = groups.get(row.date) ?? [];
      current.push(row);
      groups.set(row.date, current);
    });
    return Array.from(groups.entries());
  }, [combinedScheduleRows]);

  const boardSummary = useMemo(() => {
    const assignmentCount = combinedScheduleRows.reduce((sum, row) => sum + row.assignments.length, 0);
    const unassignedCount = combinedScheduleRows.reduce(
      (sum, row) => sum + row.intentionallyUnassignedCount,
      0,
    );
    return {
      roleCount: publishedEditors.filter(
        (editor) => boardJobTypeFilter === 'all' || editor.jobTypeId === boardJobTypeFilter,
      ).length,
      assignmentCount,
      unassignedCount,
    };
  }, [boardJobTypeFilter, combinedScheduleRows, publishedEditors]);

  const changeMonth = (delta: number): void => {
    const next = moveMonth(year, month, delta);
    setYear(next.year);
    setMonth(next.month);
    setBoardJobTypeFilter('all');
  };

  const openRoleManagement = (jobTypeId: string): void => {
    setSelectedJobTypeId(jobTypeId);
    setHubView('management');
  };

  return (
    <div className="dynamic-shifts-page">
      <PageHeader
        title="שיבוצים"
        description="מרכז אחד לכל מחזורי השיבוץ ולכל הלוחות שפורסמו — דינמי לפי תפקיד."
      />

      <div className="dynamic-shifts-hub-tabs" role="tablist" aria-label="תצוגת מרכז השיבוצים">
        <button
          type="button"
          role="tab"
          aria-selected={hubView === 'management'}
          className={hubView === 'management' ? 'is-active' : ''}
          onClick={() => setHubView('management')}
        >
          <CalendarClock size={18} />
          <span>ניהול חודשי</span>
          <small>אילוצים → טיוטה → פרסום</small>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={hubView === 'boards'}
          className={hubView === 'boards' ? 'is-active' : ''}
          onClick={() => setHubView('boards')}
        >
          <LayoutGrid size={18} />
          <span>תצוגת לוחות</span>
          <small>כל השיבוצים שפורסמו במקום אחד</small>
        </button>
      </div>

      <div className="dynamic-shifts-monthbar" aria-label="בחירת חודש">
        <Button variant="secondary" onClick={() => changeMonth(-1)}>
          <ChevronRight size={17} /> חודש קודם
        </Button>
        <div className="dynamic-shifts-month-title">
          <CalendarClock size={20} />
          <div>
            <strong>{HEBREW_MONTHS[month - 1]} {year}</strong>
            <span>{hubView === 'boards' ? 'כל הלוחות שפורסמו בחודש הנבחר' : 'כל התפקידים המנוהלים בחודש הנבחר'}</span>
          </div>
        </div>
        <Button variant="secondary" onClick={() => changeMonth(1)}>
          חודש הבא <ChevronLeft size={17} />
        </Button>
      </div>

      {error ? (
        <Card>
          <CardBody>
            <div className="dynamic-shifts-error" role="alert">
              <strong>לא ניתן לטעון את מרכז השיבוצים הדינמי</strong>
              <span>{error}</span>
              <Button variant="secondary" onClick={() => void load()}><RefreshCw size={16} /> נסה שוב</Button>
            </div>
          </CardBody>
        </Card>
      ) : null}

      {loading ? (
        <div className="dynamic-shifts-loading"><LoaderCircle className="spin" size={22} /> טוען תפקידים ומצב חודש…</div>
      ) : workspace && !error ? (
        hubView === 'management' ? (
          <>
            <section className="dynamic-shifts-role-section" aria-labelledby="managed-job-types-title">
              <div className="dynamic-shifts-section-head">
                <div>
                  <h2 id="managed-job-types-title">תפקידים לניהול</h2>
                  <p>בחר תפקיד כדי להמשיך את מחזור העבודה של {HEBREW_MONTHS[month - 1]}.</p>
                </div>
                <Button variant="secondary" disabled={refreshing} onClick={() => void load(true)}>
                  <RefreshCw size={16} className={refreshing ? 'spin' : undefined} /> רענן
                </Button>
              </div>

              {workspace.roles.length ? (
                <div className="dynamic-shifts-role-grid">
                  {workspace.roles.map((role) => {
                    const stage = getRoleStage(role);
                    const selected = role.jobType.id === selectedJobTypeId;
                    return (
                      <button
                        type="button"
                        key={role.jobType.id}
                        className={`dynamic-shifts-role-card ${selected ? 'is-selected' : ''}`}
                        onClick={() => setSelectedJobTypeId(role.jobType.id)}
                      >
                        <div className="dynamic-shifts-role-card-head">
                          <div>
                            <strong>{role.jobType.name}</strong>
                            <span><UsersRound size={14} /> {role.workflow.memberCount} עובדים</span>
                          </div>
                          {selected ? <CheckCircle2 size={20} /> : <CircleDashed size={20} />}
                        </div>
                        <div className={`dynamic-shifts-stage is-${stage.tone}`}>
                          <strong>{stage.label}</strong>
                          <span>{stage.detail}</span>
                        </div>
                        {role.workflow.period?.submissionDeadline ? (
                          <small>
                            מועד הגשה: {new Intl.DateTimeFormat('he-IL', {
                              day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
                            }).format(new Date(role.workflow.period.submissionDeadline))}
                          </small>
                        ) : <small>אין מועד הגשה מוגדר</small>}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="dynamic-shifts-empty">
                  <UsersRound size={24} />
                  <div>
                    <strong>אין תפקידים לניהול</strong>
                    <span>לא נמצא Job Type פעיל שאתה מנהל במערכת הדינמית.</span>
                  </div>
                </div>
              )}
            </section>

            {selectedRole ? (
              <section className="dynamic-shifts-management-section">
                <div className="dynamic-shifts-selected-role-head">
                  <div>
                    <span>ניהול חודש</span>
                    <h2>{selectedRole.jobType.name} · {HEBREW_MONTHS[month - 1]} {year}</h2>
                    <p>אותו רצף עבודה משמש כל Job Type — בלי הסתעפות למוקדן, כונן או כונן בוקר.</p>
                  </div>
                  <div className="dynamic-shifts-access-badge">
                    {selectedRole.accessSource === 'system_admin'
                      ? 'מנהל מערכת'
                      : selectedRole.accessSource === 'job_type_manager'
                        ? 'מנהל התפקיד'
                        : 'הרשאת מעבר'}
                  </div>
                </div>

                <Card>
                  <CardBody>
                    <DynamicPeriodWorkflowPanel
                      jobType={selectedRole.jobType}
                      selectedYear={year}
                      selectedMonth={month}
                      showPeriodPicker={false}
                      onWorkflowChanged={() => void load(true)}
                    />
                  </CardBody>
                </Card>
              </section>
            ) : null}
          </>
        ) : (
          <section className="dynamic-shifts-boards-section" aria-labelledby="published-schedules-title">
            <div className="dynamic-shifts-section-head">
              <div>
                <h2 id="published-schedules-title">כל הלוחות שפורסמו</h2>
                <p>תצוגה מאוחדת של כל השיבוצים הפעילים בחודש, בלי לעבור בין תפקידים.</p>
              </div>
              <Button variant="secondary" disabled={boardsLoading} onClick={() => void loadPublishedBoards()}>
                <RefreshCw size={16} className={boardsLoading ? 'spin' : undefined} /> רענן לוחות
              </Button>
            </div>

            <div className="dynamic-shifts-board-filters">
              <button
                type="button"
                className={boardJobTypeFilter === 'all' ? 'is-active' : ''}
                onClick={() => setBoardJobTypeFilter('all')}
              >
                כל התפקידים
              </button>
              {publishedRoles.map((role) => (
                <button
                  type="button"
                  key={role.jobType.id}
                  className={boardJobTypeFilter === role.jobType.id ? 'is-active' : ''}
                  onClick={() => setBoardJobTypeFilter(role.jobType.id)}
                >
                  {role.jobType.name}
                </button>
              ))}
            </div>

            {boardsError ? <div className="dynamic-shifts-board-warning">{boardsError}</div> : null}

            {boardsLoading ? (
              <div className="dynamic-shifts-loading"><LoaderCircle className="spin" size={22} /> טוען לוחות שפורסמו…</div>
            ) : publishedEditors.length === 0 ? (
              <div className="dynamic-shifts-empty">
                <CalendarRange size={24} />
                <div>
                  <strong>אין לוחות שפורסמו בחודש הזה</strong>
                  <span>לאחר פרסום שיבוץ של תפקיד, הוא יופיע כאן אוטומטית.</span>
                </div>
              </div>
            ) : (
              <>
                <div className="dynamic-shifts-board-summary">
                  <div><strong>{boardSummary.roleCount}</strong><span>לוחות פעילים</span></div>
                  <div><strong>{boardSummary.assignmentCount}</strong><span>שיבוצים</span></div>
                  <div><strong>{boardSummary.unassignedCount}</strong><span>לא מאוישים במכוון</span></div>
                </div>

                <div className="dynamic-shifts-combined-board">
                  {groupedScheduleRows.map(([date, rows]) => (
                    <section className="dynamic-shifts-board-day" key={date}>
                      <div className="dynamic-shifts-board-day-title">
                        <CalendarRange size={18} />
                        <strong>{formatScheduleDate(date)}</strong>
                      </div>
                      <div className="dynamic-shifts-board-day-rows">
                        {rows.map((row, index) => (
                          <article
                            className="dynamic-shifts-board-row"
                            key={`${row.jobTypeId}-${row.date}-${row.startTime}-${row.shiftName}-${index}`}
                          >
                            <div className="dynamic-shifts-board-role">
                              <button type="button" onClick={() => openRoleManagement(row.jobTypeId)}>
                                {row.jobTypeName}
                              </button>
                            </div>
                            <div className="dynamic-shifts-board-shift">
                              <strong>{row.shiftName}</strong>
                              <span>{row.startTime.slice(0, 5)}–{row.endTime.slice(0, 5)}</span>
                            </div>
                            <div className="dynamic-shifts-board-assignees">
                              {row.assignments.length ? (
                                row.assignments.map((name) => <span key={name}>{name}</span>)
                              ) : (
                                <span className="is-empty">אין עובד משובץ</span>
                              )}
                              {row.intentionallyUnassignedCount > 0 ? (
                                <small>{row.intentionallyUnassignedCount} לא מאויש במכוון</small>
                              ) : null}
                            </div>
                          </article>
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              </>
            )}
          </section>
        )
      ) : null}
    </div>
  );
}

export default ShiftsPage;
