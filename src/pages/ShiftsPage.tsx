import {
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDashed,
  List,
  LoaderCircle,
  RefreshCw,
  UsersRound,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import DynamicAllSchedulesCalendar from '../components/shifts/DynamicAllSchedulesCalendar';
import DynamicPeriodWorkflowPanel from '../components/users/dynamic/DynamicPeriodWorkflowPanel';
import { Button, Card, CardBody, PageHeader } from '../components/ui';
import { dynamicSchedulingService } from '../services/dynamicSchedulingService';
import type {
  DynamicScheduleCalendarWorkspace,
  DynamicShiftsManagementWorkspace,
  DynamicShiftsWorkspaceRole,
} from '../types/dynamicShiftsWorkspace';
import '../styles/dynamicShiftsWorkspace.css';

const HEBREW_MONTHS = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר',
];

type SchedulingHubView = 'schedules' | 'management';
type ScheduleDisplayMode = 'calendar' | 'list';

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

function ShiftsPage() {
  const { profile } = useAuth();
  const initial = useMemo(getCurrentMonth, []);
  const [searchParams, setSearchParams] = useSearchParams();
  const [year, setYear] = useState(() => Number(searchParams.get('year')) || initial.year);
  const [month, setMonth] = useState(() => Number(searchParams.get('month')) || initial.month);
  const [hubView, setHubView] = useState<SchedulingHubView>(() => (
    searchParams.get('view') === 'management' ? 'management' : 'schedules'
  ));
  const [displayMode, setDisplayMode] = useState<ScheduleDisplayMode>(() => (
    searchParams.get('mode') === 'list' || searchParams.get('view') === 'boards' ? 'list' : 'calendar'
  ));
  const [workspace, setWorkspace] = useState<DynamicShiftsManagementWorkspace | null>(null);
  const [selectedJobTypeId, setSelectedJobTypeId] = useState<string | null>(() => searchParams.get('jobType'));
  const [calendarWorkspace, setCalendarWorkspace] = useState<DynamicScheduleCalendarWorkspace | null>(null);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [calendarError, setCalendarError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadManagement = useCallback(async (background = false): Promise<void> => {
    if (background) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const data = await dynamicSchedulingService.getShiftsManagementWorkspace(year, month);
      const schedulingRoles = data.roles.filter((role) => role.jobType.schedulingStrategy !== 'none');
      setWorkspace({ ...data, roles: schedulingRoles });
      setSelectedJobTypeId((current) => {
        if (current && schedulingRoles.some((role) => role.jobType.id === current)) return current;
        return schedulingRoles[0]?.jobType.id ?? null;
      });
    } catch (loadError) {
      setWorkspace(null);
      setError(loadError instanceof Error ? loadError.message : 'טעינת סביבת השיבוצים הדינמית נכשלה.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [year, month]);

  const loadCalendarWorkspace = useCallback(async (): Promise<void> => {
    if (hubView !== 'schedules') return;
    setCalendarLoading(true);
    setCalendarError(null);
    try {
      const data = await dynamicSchedulingService.getScheduleCalendarWorkspace(year, month);
      setCalendarWorkspace(data);
    } catch (loadError) {
      setCalendarWorkspace(null);
      setCalendarError(loadError instanceof Error ? loadError.message : 'טעינת לוח השיבוצים המאוחד נכשלה.');
    } finally {
      setCalendarLoading(false);
    }
  }, [hubView, month, year]);

  useEffect(() => {
    if (hubView === 'management') void loadManagement();
  }, [hubView, loadManagement]);

  useEffect(() => {
    void loadCalendarWorkspace();
  }, [loadCalendarWorkspace]);

  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    next.set('year', String(year));
    next.set('month', String(month));
    next.set('view', hubView);
    next.set('mode', displayMode);
    if (selectedJobTypeId) next.set('jobType', selectedJobTypeId);
    else next.delete('jobType');
    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true });
    }
  }, [year, month, hubView, displayMode, selectedJobTypeId, searchParams, setSearchParams]);

  const selectedRole = workspace?.roles.find((role) => role.jobType.id === selectedJobTypeId) ?? null;

  const changeMonth = (delta: number): void => {
    const next = moveMonth(year, month, delta);
    if (hubView === 'schedules') {
      const current = getCurrentMonth();
      if ((next.year * 100 + next.month) > (current.year * 100 + current.month)) return;
    }
    setYear(next.year);
    setMonth(next.month);
  };

  const openSchedulesView = (): void => {
    const current = getCurrentMonth();
    if ((year * 100 + month) > (current.year * 100 + current.month)) {
      setYear(current.year);
      setMonth(current.month);
    }
    setHubView('schedules');
  };

  return (
    <div className="dynamic-shifts-page">
      <PageHeader
        title="שיבוצים"
        description="לוח מאוחד לכל השיבוצים וניהול חודשי מסודר לפי תפקיד."
      />

      <div className="dynamic-shifts-hub-tabs" role="tablist" aria-label="תצוגת מרכז השיבוצים">
        <button
          type="button"
          role="tab"
          aria-selected={hubView === 'schedules'}
          className={hubView === 'schedules' ? 'is-active' : ''}
          onClick={openSchedulesView}
        >
          <CalendarDays size={18} />
          <span>שיבוצים</span>
          <small>לוח שנה או רשימה · חודש נוכחי והיסטוריה</small>
        </button>
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
      </div>

      {hubView === 'schedules' ? (
        <section className="dynamic-shifts-boards-section" aria-labelledby="all-schedules-title">
          <div className="dynamic-schedules-toolbar">
            <div>
              <h2 id="all-schedules-title">כל השיבוצים</h2>
              <p>תצוגה מאוחדת לפי תפקיד, עובד ומצב איוש. לחיצה על שיבוץ פותחת את פרטיו.</p>
            </div>

            <div className="dynamic-schedules-toolbar-actions">
              <div className="dynamic-schedule-display-toggle" role="group" aria-label="אופן תצוגת שיבוצים">
                <button
                  type="button"
                  className={displayMode === 'calendar' ? 'is-active' : ''}
                  onClick={() => setDisplayMode('calendar')}
                >
                  <CalendarDays size={16} /> לוח שנה
                </button>
                <button
                  type="button"
                  className={displayMode === 'list' ? 'is-active' : ''}
                  onClick={() => setDisplayMode('list')}
                >
                  <List size={16} /> רשימה
                </button>
              </div>

              <div className="dynamic-calendar-compact-nav" aria-label="ניווט חודשי">
                <Button variant="secondary" onClick={() => changeMonth(-1)} aria-label="חודש קודם"><ChevronRight size={16} /></Button>
                <strong>{HEBREW_MONTHS[month - 1]} {year}</strong>
                <Button
                  variant="secondary"
                  onClick={() => changeMonth(1)}
                  disabled={(year * 100 + month) >= (initial.year * 100 + initial.month)}
                  aria-label="חודש הבא"
                ><ChevronLeft size={16} /></Button>
                <Button variant="secondary" disabled={calendarLoading} onClick={() => void loadCalendarWorkspace()}>
                  <RefreshCw size={16} className={calendarLoading ? 'spin' : undefined} /> רענן
                </Button>
              </div>
            </div>
          </div>

          {calendarError ? <div className="dynamic-shifts-board-warning">{calendarError}</div> : null}

          {calendarLoading ? (
            <div className="dynamic-shifts-loading"><LoaderCircle className="spin" size={22} /> טוען שיבוצים…</div>
          ) : calendarWorkspace ? (
            <DynamicAllSchedulesCalendar
              workspace={calendarWorkspace}
              displayMode={displayMode}
              defaultAssignmentFilter={profile?.role === 'admin' ? 'assigned' : 'all'}
              currentUserId={profile?.id ?? null}
              onChanged={loadCalendarWorkspace}
            />
          ) : (
            <div className="dynamic-shifts-empty">
              <CalendarDays size={24} />
              <div>
                <strong>אין נתוני שיבוצים להצגה</strong>
                <span>בחר חודש נוכחי או חודש קודם ורענן.</span>
              </div>
            </div>
          )}
        </section>
      ) : (
        <>
          <section className="dynamic-monthly-management-shell">
            <div className="dynamic-monthly-management-toolbar">
              <div>
                <h2>ניהול חודשי</h2>
                <p>בחר חודש ותפקיד, ואז המשך את מחזור האילוצים והשיבוץ במקום אחד.</p>
              </div>
              <div className="dynamic-calendar-compact-nav" aria-label="ניווט חודשי בניהול">
                <Button variant="secondary" onClick={() => changeMonth(-1)} aria-label="חודש קודם"><ChevronRight size={16} /></Button>
                <strong>{HEBREW_MONTHS[month - 1]} {year}</strong>
                <Button variant="secondary" onClick={() => changeMonth(1)} aria-label="חודש הבא"><ChevronLeft size={16} /></Button>
                <Button variant="secondary" disabled={refreshing || loading} onClick={() => void loadManagement(true)}>
                  <RefreshCw size={16} className={refreshing ? 'spin' : undefined} /> רענן
                </Button>
              </div>
            </div>

            {error ? (
              <div className="dynamic-shifts-error" role="alert">
                <strong>לא ניתן לטעון את הניהול החודשי</strong>
                <span>{error}</span>
                <Button variant="secondary" onClick={() => void loadManagement()}><RefreshCw size={16} /> נסה שוב</Button>
              </div>
            ) : loading ? (
              <div className="dynamic-shifts-loading"><LoaderCircle className="spin" size={22} /> טוען תפקידים ומצב חודש…</div>
            ) : workspace ? (
              <>
                <div className="dynamic-management-role-selector" role="listbox" aria-label="בחירת תפקיד לניהול">
                  {workspace.roles.map((role) => {
                    const stage = getRoleStage(role);
                    const selected = role.jobType.id === selectedJobTypeId;
                    return (
                      <button
                        type="button"
                        key={role.jobType.id}
                        className={selected ? 'is-selected' : ''}
                        onClick={() => setSelectedJobTypeId(role.jobType.id)}
                      >
                        <span className="dynamic-management-role-selector-head">
                          <strong>{role.jobType.name}</strong>
                          {selected ? <CheckCircle2 size={18} /> : <CircleDashed size={18} />}
                        </span>
                        <span className={`dynamic-management-role-stage is-${stage.tone}`}>{stage.label}</span>
                        <small><UsersRound size={13} /> {role.workflow.memberCount} עובדים · {stage.detail}</small>
                      </button>
                    );
                  })}
                </div>

                {workspace.roles.length === 0 ? (
                  <div className="dynamic-shifts-empty">
                    <UsersRound size={24} />
                    <div>
                      <strong>אין תפקידים לניהול</strong>
                      <span>לא נמצא תפקיד פעיל שאתה מנהל.</span>
                    </div>
                  </div>
                ) : null}
              </>
            ) : null}
          </section>

          {selectedRole && workspace && !loading && !error ? (
            <section className="dynamic-shifts-management-section">
              <div className="dynamic-shifts-selected-role-head compact">
                <div>
                  <span>מחזור שיבוץ פעיל</span>
                  <h2>{selectedRole.jobType.name} · {HEBREW_MONTHS[month - 1]} {year}</h2>
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
                    key={`${selectedRole.jobType.id}-${year}-${month}`}
                    jobType={selectedRole.jobType}
                    selectedYear={year}
                    selectedMonth={month}
                    showPeriodPicker={false}
                    onWorkflowChanged={() => void loadManagement(true)}
                  />
                </CardBody>
              </Card>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}

export default ShiftsPage;
