import { CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, List, LoaderCircle, Pencil, RefreshCw, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import MonthCalendar from '../components/calendar/MonthCalendar';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import { calendarHolidayService, type CalendarHoliday } from '../services/calendarHolidayService';
import { dynamicSchedulingService } from '../services/dynamicSchedulingService';
import type {
  MyDynamicSchedulePeriod,
  MyDynamicScheduleWorkspace,
  MyDynamicScheduleAssignment,
  DynamicSelfEditWorkspace,
} from '../types/dynamicScheduling';
import '../styles/myDynamicShifts.css';
import { dynamicShiftDisplayName } from '../utils/dynamicShiftDisplayName';

type ViewMode = 'list' | 'calendar';

const weekdays = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

function localDate(value: string): Date {
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

function formatDate(value: string): string {
  const [year, month, day] = value.slice(0, 10).split('-');
  return `${day}/${month}/${year}`;
}

function formatTime(value: string): string {
  return value.slice(0, 5);
}


function modeTitle(workMode: MyDynamicSchedulePeriod['workMode'] | MyDynamicScheduleWorkspace['workMode']): string {
  return workMode === 'shifts' ? 'המשמרות שלי' : 'הכוננויות שלי';
}

function changeModeText(mode: MyDynamicScheduleWorkspace['scheduleChangeMode']): string | null {
  if (mode === 'shift_exchange') return 'לתפקיד הזה פעילה מערכת חילופי משמרות. את הבקשות מגישים מהטאב „חילופי משמרות”.';
  return null;
}

function MyDynamicShiftsPage() {
  const [periods, setPeriods] = useState<MyDynamicSchedulePeriod[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [selectedJobTypeId, setSelectedJobTypeId] = useState<string>('');
  const [workspace, setWorkspace] = useState<MyDynamicScheduleWorkspace | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('calendar');
  const [holidays, setHolidays] = useState<CalendarHoliday[]>([]);
  const [loading, setLoading] = useState(true);
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selfEditOpen, setSelfEditOpen] = useState(false);
  const [selfEditWorkspace, setSelfEditWorkspace] = useState<DynamicSelfEditWorkspace | null>(null);
  const [selfEditLoading, setSelfEditLoading] = useState(false);
  const [selfEditSavingId, setSelfEditSavingId] = useState<string | null>(null);
  const [selectedCalendarAssignmentId, setSelectedCalendarAssignmentId] = useState<string | null>(null);
  const [selectedAssigneeId, setSelectedAssigneeId] = useState<string>('all');
  const [selfEditPermissionState, setSelfEditPermissionState] = useState({ canSelfEdit: false, canViewOthers: false, canEditAll: false });

  const loadPeriods = async () => {
    setLoading(true);
    setError(null);
    try {
      const nextPeriods = await dynamicSchedulingService.getMyDynamicSchedulePeriods();
      setPeriods(nextPeriods);
      setSelectedId((current) =>
        current && nextPeriods.some((period) => period.publicationId === current)
          ? current
          : nextPeriods[0]?.publicationId ?? '',
      );
      setSelectedJobTypeId((current) =>
        current && nextPeriods.some((period) => period.jobTypeId === current)
          ? current
          : nextPeriods[0]?.jobTypeId ?? '',
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'טעינת המשמרות נכשלה.');
    } finally {
      setLoading(false);
    }
  };

  const loadSelfEditWorkspace = async (publicationId: string) => {
    setSelfEditLoading(true);
    setError(null);
    try {
      const data = await dynamicSchedulingService.getMyDynamicSelfEditWorkspace(publicationId);
      setSelfEditWorkspace(data);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'טעינת עריכת השיבוץ נכשלה.');
      setSelfEditWorkspace(null);
    } finally {
      setSelfEditLoading(false);
    }
  };

  const reloadPersonalWorkspace = async (publicationId: string) => {
    const data = await dynamicSchedulingService.getMyDynamicScheduleWorkspace(publicationId);
    setWorkspace(data);
  };

  const handleSelfEditAssignment = async (assignmentId: string, userId: string) => {
    if (!selectedId) return;
    setSelfEditSavingId(assignmentId);
    setError(null);
    try {
      await dynamicSchedulingService.updateMyDynamicPublishedAssignment(selectedId, assignmentId, userId);
      await Promise.all([
        loadSelfEditWorkspace(selectedId),
        reloadPersonalWorkspace(selectedId),
        loadPeriods(),
      ]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'עדכון השיבוץ נכשל.');
    } finally {
      setSelfEditSavingId(null);
    }
  };

  useEffect(() => {
    void loadPeriods();
  }, []);

  useEffect(() => {
    setSelfEditOpen(false);
    setSelfEditWorkspace(null);
    setSelectedCalendarAssignmentId(null);
    setSelectedAssigneeId('all');
    if (!selectedId) {
      setWorkspace(null);
      return;
    }

    let active = true;
    setWorkspaceLoading(true);
    setError(null);
    void dynamicSchedulingService.getMyDynamicScheduleWorkspace(selectedId)
      .then((data) => {
        if (active) setWorkspace(data);
      })
      .catch((caught: unknown) => {
        if (active) setError(caught instanceof Error ? caught.message : 'טעינת הלוח נכשלה.');
      })
      .finally(() => {
        if (active) setWorkspaceLoading(false);
      });
    return () => { active = false; };
  }, [selectedId]);

  useEffect(() => {
    if (!workspace || workspace.periodSource !== 'publication' || workspace.scheduleChangeMode !== 'self_edit') {
      setSelfEditPermissionState({ canSelfEdit: false, canViewOthers: false, canEditAll: false });
      return;
    }

    let active = true;
    void Promise.all([
      dynamicSchedulingService.hasMyDynamicJobTypePermission('schedule.self_edit', workspace.jobTypeId),
      dynamicSchedulingService.hasMyDynamicJobTypePermission('schedule.view_others', workspace.jobTypeId),
      dynamicSchedulingService.hasMyDynamicJobTypePermission('schedule.edit_all', workspace.jobTypeId),
    ]).then(([canSelfEdit, canViewOthers, canEditAll]) => {
      if (active) setSelfEditPermissionState({ canSelfEdit, canViewOthers, canEditAll });
    }).catch(() => {
      if (active) setSelfEditPermissionState({ canSelfEdit: false, canViewOthers: false, canEditAll: false });
    });

    return () => { active = false; };
  }, [workspace?.jobTypeId, workspace?.periodSource, workspace?.scheduleChangeMode]);

  useEffect(() => {
    if (!workspace) {
      setHolidays([]);
      return;
    }

    let active = true;
    void calendarHolidayService.getCalendarHolidays(workspace.year, workspace.month)
      .then((items) => {
        if (active) setHolidays(items);
      })
      .catch(() => {
        if (active) setHolidays([]);
      });

    return () => { active = false; };
  }, [workspace?.year, workspace?.month]);

  const holidayLabels = useMemo(() => {
    const labels = new Map<string, string[]>();
    holidays.forEach((holiday) => {
      const current = labels.get(holiday.date) ?? [];
      if (!current.includes(holiday.name)) current.push(holiday.name);
      labels.set(holiday.date, current);
    });
    return labels;
  }, [holidays]);

  const availableRoles = useMemo(() => {
    const byId = new Map<string, MyDynamicSchedulePeriod>();
    for (const period of periods) {
      if (!byId.has(period.jobTypeId)) byId.set(period.jobTypeId, period);
    }
    return [...byId.values()].sort((first, second) => first.jobTypeName.localeCompare(second.jobTypeName, 'he'));
  }, [periods]);

  const rolePeriods = useMemo(
    () => periods
      .filter((period) => period.jobTypeId === selectedJobTypeId)
      .sort((first, second) => (first.year * 12 + first.month) - (second.year * 12 + second.month)),
    [periods, selectedJobTypeId],
  );

  const selectedRolePeriodIndex = rolePeriods.findIndex((period) => period.publicationId === selectedId);
  const previousPeriod = selectedRolePeriodIndex > 0 ? rolePeriods[selectedRolePeriodIndex - 1] : null;
  const nextPeriod = selectedRolePeriodIndex >= 0 && selectedRolePeriodIndex < rolePeriods.length - 1
    ? rolePeriods[selectedRolePeriodIndex + 1]
    : null;

  useEffect(() => {
    if (!selectedJobTypeId) return;
    const selectedStillBelongsToRole = rolePeriods.some((period) => period.publicationId === selectedId);
    if (!selectedStillBelongsToRole) {
      const latest = rolePeriods[rolePeriods.length - 1];
      setSelectedId(latest?.publicationId ?? '');
    }
  }, [rolePeriods, selectedId, selectedJobTypeId]);

  const selectedPeriod = periods.find((period) => period.publicationId === selectedId) ?? null;
  const pageTitle = workspace
    ? modeTitle(workspace.workMode)
    : selectedPeriod
      ? modeTitle(selectedPeriod.workMode)
      : 'המשמרות שלי';

  const visibleAssignees = useMemo(() => {
    if (!workspace?.canViewOthers) return [];
    const byId = new Map<string, string>();
    for (const assignment of workspace.assignments) {
      if (assignment.userId && assignment.displayName && !byId.has(assignment.userId)) {
        byId.set(assignment.userId, assignment.displayName);
      }
    }
    return [...byId.entries()]
      .map(([userId, displayName]) => ({ userId, displayName }))
      .sort((first, second) => first.displayName.localeCompare(second.displayName, 'he'));
  }, [workspace]);

  useEffect(() => {
    if (selectedAssigneeId !== 'all' && !visibleAssignees.some((assignee) => assignee.userId === selectedAssigneeId)) {
      setSelectedAssigneeId('all');
    }
  }, [selectedAssigneeId, visibleAssignees]);

  const visibleAssignments = useMemo(() => {
    const assignments = workspace?.assignments ?? [];
    if (!workspace?.canViewOthers || selectedAssigneeId === 'all') return assignments;
    return assignments.filter((assignment) => assignment.userId === selectedAssigneeId);
  }, [selectedAssigneeId, workspace]);

  const assignmentsByDate = useMemo(() => {
    const map = new Map<string, MyDynamicScheduleAssignment[]>();
    for (const assignment of visibleAssignments) {
      const current = map.get(assignment.shiftDate) ?? [];
      current.push(assignment);
      map.set(assignment.shiftDate, current);
    }
    return map;
  }, [visibleAssignments]);

  const groupedDates = useMemo(
    () => [...assignmentsByDate.entries()].sort(([first], [second]) => first.localeCompare(second)),
    [assignmentsByDate],
  );

  const selfEditGroupedDates = useMemo(() => {
    const map = new Map<string, DynamicSelfEditWorkspace['assignments']>();
    for (const assignment of selfEditWorkspace?.assignments ?? []) {
      const current = map.get(assignment.shiftDate) ?? [];
      current.push(assignment);
      map.set(assignment.shiftDate, current);
    }
    return [...map.entries()].sort(([first], [second]) => first.localeCompare(second));
  }, [selfEditWorkspace]);

  const selectedCalendarAssignment = useMemo(
    () => workspace?.assignments.find((assignment) => assignment.id === selectedCalendarAssignmentId) ?? null,
    [workspace, selectedCalendarAssignmentId],
  );

  const selectedCalendarEditorAssignment = useMemo(
    () => selfEditWorkspace?.assignments.find((assignment) => assignment.id === selectedCalendarAssignmentId) ?? null,
    [selfEditWorkspace, selectedCalendarAssignmentId],
  );

  const canEditAssignment = (assignment: MyDynamicScheduleAssignment): boolean => {
    if (!workspace || workspace.readOnly || workspace.scheduleChangeMode !== 'self_edit') return false;
    if (selfEditPermissionState.canEditAll) return true;
    return assignment.isMine && selfEditPermissionState.canSelfEdit;
  };

  const openCalendarAssignmentEditor = (assignment: MyDynamicScheduleAssignment) => {
    if (!canEditAssignment(assignment)) return;
    setSelectedCalendarAssignmentId(assignment.id);
    if (!selfEditWorkspace || selfEditWorkspace.publicationId !== workspace?.publicationId) {
      void loadSelfEditWorkspace(workspace!.publicationId);
    }
  };

  if (loading) {
    return <main className="my-dynamic-shifts page-shell" dir="rtl"><div className="my-shifts-loading"><LoaderCircle className="spin" /> טוען לוחות שפורסמו…</div></main>;
  }

  return (
    <main className="my-dynamic-shifts page-shell" dir="rtl">
      <header className="my-shifts-header">
        <div>
          <h1><CalendarDays size={27} /> {pageTitle}</h1>
          <p>הלוחות כאן כוללים פרסומים דינמיים וגם היסטוריה שיובאה מחודשים קודמים.</p>
        </div>
        <Button variant="secondary" onClick={() => void loadPeriods()}><RefreshCw size={16} /> רענן</Button>
      </header>

      {error ? <div className="users-error" role="alert">{error}</div> : null}

      {!periods.length ? (
        <section className="my-shifts-empty">
          <CalendarDays size={34} />
          <h2>אין עדיין לוח דינמי שפורסם עבורך</h2>
          <p>לא נמצאו עבורך לוחות שפורסמו או חודשים היסטוריים שיובאו לתפקידים הדינמיים שלך.</p>
        </section>
      ) : (
        <>
          <section className="my-shifts-period-controls" aria-label="בחירת תפקיד וחודש">
            <label>
              <span>תפקיד</span>
              <select
                value={selectedJobTypeId}
                onChange={(event) => setSelectedJobTypeId(event.target.value)}
              >
                {availableRoles.map((period) => (
                  <option key={period.jobTypeId} value={period.jobTypeId}>{period.jobTypeName}</option>
                ))}
              </select>
            </label>

            <div className="my-shifts-month-navigation">
              <button
                type="button"
                className="my-shifts-month-arrow"
                disabled={!previousPeriod}
                onClick={() => previousPeriod && setSelectedId(previousPeriod.publicationId)}
                aria-label="חודש קודם"
                title={previousPeriod ? 'חודש קודם' : 'אין חודש קודם זמין'}
              >
                <ChevronRight size={18} />
              </button>

              <label>
                <span>חודש</span>
                <select
                  value={selectedId}
                  onChange={(event) => setSelectedId(event.target.value)}
                >
                  {rolePeriods.map((period) => (
                    <option key={period.publicationId} value={period.publicationId}>
                      {String(period.month).padStart(2, '0')}/{period.year}
                    </option>
                  ))}
                </select>
              </label>

              <button
                type="button"
                className="my-shifts-month-arrow"
                disabled={!nextPeriod}
                onClick={() => nextPeriod && setSelectedId(nextPeriod.publicationId)}
                aria-label="חודש הבא"
                title={nextPeriod ? 'חודש הבא' : 'אין חודש הבא זמין'}
              >
                <ChevronLeft size={18} />
              </button>
            </div>

            <div className="my-shifts-period-meta">
              {selectedPeriod ? (
                <>
                  <strong>{selectedPeriod.jobTypeName}</strong>
                  <span dir="ltr">{String(selectedPeriod.month).padStart(2, '0')}/{selectedPeriod.year}</span>
                  <small>{selectedPeriod.assignmentCount} {selectedPeriod.workMode === 'shifts' ? 'משמרות' : 'כוננויות'} · {selectedPeriod.periodSource === 'history' ? 'היסטוריה מיובאת' : 'לוח שפורסם'}</small>
                </>
              ) : null}
            </div>
          </section>

          {workspaceLoading ? (
            <section className="my-shifts-loading"><LoaderCircle className="spin" /> טוען לוח…</section>
          ) : workspace ? (
            <section className="my-shifts-card">
              <div className="my-shifts-toolbar">
                <div className="my-shifts-summary">
                  <span className={workspace.periodSource === 'history' ? 'my-shifts-history' : 'my-shifts-published'}><CheckCircle2 size={16} /> {workspace.periodSource === 'history' ? 'היסטוריה מיובאת' : 'פורסם'}</span>
                  <strong>{visibleAssignments.length}</strong>
                  <span>{workspace.canViewOthers
                    ? (workspace.workMode === 'shifts' ? 'משמרות התפקיד בחודש' : 'כוננויות התפקיד בחודש')
                    : (workspace.workMode === 'shifts' ? 'המשמרות שלי בחודש' : 'הכוננויות שלי בחודש')}</span>
                </div>
                <div className="my-shifts-view-toggle" role="group" aria-label="תצוגת לוח">
                  <button type="button" className={viewMode === 'calendar' ? 'is-active' : ''} onClick={() => setViewMode('calendar')}><CalendarDays size={16} /> טבלה חודשית</button>
                  <button type="button" className={viewMode === 'list' ? 'is-active' : ''} onClick={() => setViewMode('list')}><List size={16} /> רשימה</button>
                </div>
              </div>

              {workspace.canViewOthers ? (
                <div className="my-shifts-assignee-filter">
                  <label>
                    <span>סינון לפי עובד</span>
                    <select value={selectedAssigneeId} onChange={(event) => setSelectedAssigneeId(event.target.value)}>
                      <option value="all">כל העובדים</option>
                      {visibleAssignees.map((assignee) => (
                        <option key={assignee.userId} value={assignee.userId}>{assignee.displayName}</option>
                      ))}
                    </select>
                  </label>
                  <small>הסינון משפיע גם על הטבלה החודשית וגם על תצוגת הרשימה.</small>
                </div>
              ) : null}

              {viewMode === 'list'
                && !workspace.readOnly
                && workspace.scheduleChangeMode === 'self_edit'
                && (selfEditPermissionState.canSelfEdit || selfEditPermissionState.canEditAll)
                && (workspace.assignments.length > 0 || selfEditPermissionState.canViewOthers || selfEditPermissionState.canEditAll) ? (
                <div className="my-shifts-self-edit-entry">
                  <div>
                    <strong>שינוי שיבוץ עצמי פעיל לתפקיד הזה</strong>
                    <span>ניתן לפתוח את הלוח המלא של התפקיד ולשנות את העובד המשובץ, בהתאם לחלון העריכה.</span>
                  </div>
                  <Button
                    variant={selfEditOpen ? 'secondary' : 'primary'}
                    onClick={() => {
                      const nextOpen = !selfEditOpen;
                      setSelfEditOpen(nextOpen);
                      if (nextOpen && !selfEditWorkspace) void loadSelfEditWorkspace(workspace.publicationId);
                    }}
                  >
                    {selfEditOpen ? <><X size={16} /> סגור עריכה</> : <><Pencil size={16} /> ערוך שיבוץ</>}
                  </Button>
                </div>
              ) : null}

              {workspace.readOnly ? (
                <div className="my-shifts-transition-note">זהו חודש היסטורי שיובא מהמערכת הקודמת ולכן הוא מוצג לקריאה בלבד.</div>
              ) : changeModeText(workspace.scheduleChangeMode) ? (
                <div className="my-shifts-transition-note">{changeModeText(workspace.scheduleChangeMode)}</div>
              ) : null}

              {selfEditOpen ? (
                <section className="my-shifts-self-edit-panel" aria-label="עריכת שיבוץ עצמי">
                  <header>
                    <div>
                      <h2>עריכת שיבוץ</h2>
                      <p>זהו הלוח המלא של התפקיד. שינוי נשמר מיד ומתועד ביומן המערכת.</p>
                    </div>
                    {selfEditWorkspace ? (
                      <span className={selfEditWorkspace.editable ? 'is-editable' : 'is-locked'}>
                        {selfEditWorkspace.editable ? 'פתוח לעריכה' : 'קריאה בלבד'}
                      </span>
                    ) : null}
                  </header>

                  {selfEditLoading ? (
                    <div className="my-shifts-loading"><LoaderCircle className="spin" /> טוען לוח לעריכה…</div>
                  ) : selfEditWorkspace ? (
                    <>
                      {!selfEditWorkspace.editable && selfEditWorkspace.editabilityReason ? (
                        <div className="my-shifts-self-edit-warning">{selfEditWorkspace.editabilityReason}</div>
                      ) : null}
                      <div className="my-shifts-transition-note">
                        {selfEditWorkspace.canViewOthers
                          ? 'מוצג הלוח המלא של התפקיד, כולל משמרות/כוננויות של עובדים אחרים.'
                          : 'מוצגים רק השיבוצים שלך. הרשאת „הצגת משמרות/כוננויות של משתמשים אחרים” כבויה לתפקיד הזה.'}
                      </div>
                      <div className="my-shifts-self-edit-list">
                        {selfEditGroupedDates.map(([date, assignments]) => {
                          const dateObject = localDate(date);
                          return (
                            <section key={date} className="my-shifts-self-edit-day">
                              <header>
                                <strong>{weekdays[dateObject.getDay()]}</strong>
                                <span dir="ltr">{formatDate(date)}</span>
                              </header>
                              <div>
                                {assignments.map((assignment) => (
                                  <article key={assignment.id} className={assignment.isMine ? 'is-mine' : ''}>
                                    <div className="my-shifts-self-edit-shift">
                                      <strong>{dynamicShiftDisplayName(assignment.shiftName, workspace?.workMode === 'on_call_daily' ? 'כוננות' : 'משמרת')}</strong>
                                      <span dir="ltr">{formatTime(assignment.startTime)}–{formatTime(assignment.endTime)}</span>
                                    </div>
                                    <label>
                                      <span>משובץ</span>
                                      <select
                                        value={assignment.userId}
                                        disabled={!selfEditWorkspace.editable || (!assignment.isMine && !selfEditWorkspace.canEditAll) || selfEditSavingId === assignment.id}
                                        onChange={(event) => void handleSelfEditAssignment(assignment.id, event.target.value)}
                                      >
                                        {selfEditWorkspace.members.map((member) => (
                                          <option key={member.userId} value={member.userId}>{member.displayName}</option>
                                        ))}
                                      </select>
                                    </label>
                                    {selfEditSavingId === assignment.id ? <LoaderCircle className="spin" size={17} /> : null}
                                  </article>
                                ))}
                              </div>
                            </section>
                          );
                        })}
                      </div>
                    </>
                  ) : null}
                </section>
              ) : null}

              {!visibleAssignments.length ? (
                <div className="my-shifts-no-assignments">
                  {workspace.canViewOthers
                    ? 'הלוח פורסם, אך אין שיבוצים להצגה לתפקיד בחודש זה.'
                    : `הלוח פורסם, אך לא שובצת ${workspace.workMode === 'shifts' ? 'למשמרות' : 'לכוננויות'} בחודש זה.`}
                </div>
              ) : viewMode === 'calendar' ? (
                <MonthCalendar
                  year={workspace.year}
                  month={workspace.month}
                  emptyMessage="אין משמרות להצגה בחודש הזה."
                  dayLabels={holidayLabels}
                  getDayClassName={({ date }) => assignmentsByDate.has(date) ? 'my-shifts-calendar-has-assignment' : null}
                  renderDayContent={({ date }) => {
                    const dayAssignments = assignmentsByDate.get(date) ?? [];
                    if (!dayAssignments.length) return null;
                    return (
                      <div className="my-shifts-calendar-items">
                        {dayAssignments.map((assignment) => {
                          const editable = canEditAssignment(assignment);
                          return (
                            <button
                              key={assignment.id}
                              type="button"
                              className={`my-shifts-calendar-item${editable ? ' is-editable' : ''}`}
                              onClick={() => openCalendarAssignmentEditor(assignment)}
                              disabled={!editable}
                              title={editable ? 'לחץ לעריכת השיבוץ' : undefined}
                            >
                              <div className="my-shifts-assignment-title">
                                <strong>{dynamicShiftDisplayName(assignment.shiftName, workspace?.workMode === 'on_call_daily' ? 'כוננות' : 'משמרת')}</strong>
                                {assignment.contains200Percent ? <span className="my-shifts-premium-badge">200%</span> : null}
                              </div>
                              <span className="my-shifts-time" dir="ltr">{formatTime(assignment.startTime)}–{formatTime(assignment.endTime)}</span>
                              {workspace.canViewOthers && assignment.displayName ? (
                                <small className="my-shifts-assignee">{assignment.displayName}{assignment.isMine ? ' · אני' : ''}</small>
                              ) : null}
                              {assignment.holidayName ? <small className="my-shifts-holiday-note">{assignment.holidayName}</small> : null}
                            </button>
                          );
                        })}
                      </div>
                    );
                  }}
                />
              ) : (
                <div className="my-shifts-list">
                  {groupedDates.map(([date, dayAssignments]) => {
                    const dateObject = localDate(date);
                    return (
                      <section key={date} className="my-shifts-day-group">
                        <header>
                          <strong>{weekdays[dateObject.getDay()]}</strong>
                          <span className="my-shifts-date" dir="ltr">{formatDate(date)}</span>
                        </header>
                        <div>
                          {dayAssignments.map((assignment) => (
                            <article key={assignment.id} className="my-shifts-row">
                              <div>
                                <div className="my-shifts-assignment-title">
                                  <strong>{dynamicShiftDisplayName(assignment.shiftName, workspace?.workMode === 'on_call_daily' ? 'כוננות' : 'משמרת')}</strong>
                                  {assignment.contains200Percent ? <span className="my-shifts-premium-badge">200%</span> : null}
                                </div>
                                {workspace.canViewOthers && assignment.displayName ? (
                                  <small className="my-shifts-assignee">משובץ: {assignment.displayName}{assignment.isMine ? ' · אני' : ''}</small>
                                ) : null}
                                {assignment.holidayName ? <small className="my-shifts-holiday-note">{assignment.holidayName}</small> : null}
                                {assignment.managerEdited ? <small>השיבוץ עודכן ידנית על ידי מנהל</small> : null}
                              </div>
                              <span className="my-shifts-time" dir="ltr">{formatTime(assignment.startTime)}–{formatTime(assignment.endTime)}</span>
                            </article>
                          ))}
                        </div>
                      </section>
                    );
                  })}
                </div>
              )}
            </section>
          ) : null}
        </>
      )}

      <Modal
        isOpen={Boolean(selectedCalendarAssignmentId)}
        title={selectedCalendarAssignment ? `עריכת ${workspace?.workMode === 'shifts' ? 'משמרת' : 'כוננות'} · ${selectedCalendarAssignment.shiftName}` : 'עריכת שיבוץ'}
        onClose={() => setSelectedCalendarAssignmentId(null)}
        footer={<Button variant="secondary" onClick={() => setSelectedCalendarAssignmentId(null)}>סגור</Button>}
        className="my-shifts-calendar-edit-modal"
      >
        {selectedCalendarAssignment ? (
          <div className="my-shifts-calendar-edit-content">
            <div className="my-shifts-calendar-edit-meta">
              <span><strong>תאריך:</strong> <bdi dir="ltr">{formatDate(selectedCalendarAssignment.shiftDate)}</bdi></span>
              <span><strong>שעות:</strong> <bdi dir="ltr">{formatTime(selectedCalendarAssignment.startTime)}–{formatTime(selectedCalendarAssignment.endTime)}</bdi></span>
              {selectedCalendarAssignment.holidayName ? <span><strong>מועד:</strong> {selectedCalendarAssignment.holidayName}</span> : null}
            </div>

            {selfEditLoading ? (
              <div className="my-shifts-loading"><LoaderCircle className="spin" /> טוען אפשרויות שיבוץ…</div>
            ) : selfEditWorkspace && selectedCalendarEditorAssignment ? (
              <label className="my-shifts-calendar-edit-select">
                <span>משובץ</span>
                <select
                  value={selectedCalendarEditorAssignment.userId}
                  disabled={!selfEditWorkspace.editable || (!selectedCalendarEditorAssignment.isMine && !selfEditWorkspace.canEditAll) || selfEditSavingId === selectedCalendarEditorAssignment.id}
                  onChange={(event) => void handleSelfEditAssignment(selectedCalendarEditorAssignment.id, event.target.value)}
                >
                  {selfEditWorkspace.members.map((member) => (
                    <option key={member.userId} value={member.userId}>{member.displayName}</option>
                  ))}
                </select>
                {selfEditSavingId === selectedCalendarEditorAssignment.id ? <small><LoaderCircle className="spin" size={15} /> שומר…</small> : null}
              </label>
            ) : (
              <div className="my-shifts-self-edit-warning">לא ניתן לטעון את פרטי העריכה של השיבוץ.</div>
            )}

            {selfEditWorkspace && !selfEditWorkspace.editable && selfEditWorkspace.editabilityReason ? (
              <div className="my-shifts-self-edit-warning">{selfEditWorkspace.editabilityReason}</div>
            ) : null}
          </div>
        ) : null}
      </Modal>
    </main>
  );
}

export default MyDynamicShiftsPage;
