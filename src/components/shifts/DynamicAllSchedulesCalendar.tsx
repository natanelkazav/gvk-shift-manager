import {
  CalendarDays,
  ChevronDown,
  ChevronUp,
  Filter,
  LoaderCircle,
  Save,
  UserRoundCheck,
  UserRoundX,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useCalendarHolidays } from '../../hooks/useCalendarHolidays';
import { dynamicSchedulingService } from '../../services/dynamicSchedulingService';
import type { DynamicHistoricalSlotEditorWorkspace, DynamicPublishedEditorWorkspace } from '../../types/dynamicScheduling';
import type {
  DynamicScheduleCalendarSlot,
  DynamicScheduleCalendarWorkspace,
} from '../../types/dynamicShiftsWorkspace';
import MonthCalendar from '../calendar/MonthCalendar';
import Button from '../ui/Button';
import Modal from '../ui/Modal';
import { dynamicShiftDisplayName } from '../../utils/dynamicShiftDisplayName';

type AssignmentFilter = 'all' | 'assigned' | 'unassigned';
type ScheduleDisplayMode = 'calendar' | 'list';

interface DynamicAllSchedulesCalendarProps {
  workspace: DynamicScheduleCalendarWorkspace;
  displayMode?: ScheduleDisplayMode;
  defaultAssignmentFilter?: AssignmentFilter;
  currentUserId?: string | null;
  onChanged?: () => void | Promise<void>;
}

const ROLE_TONE_COUNT = 8;
const UNASSIGNED_VALUE = '__unassigned__';

const matchesAssignmentFilter = (
  slot: DynamicScheduleCalendarSlot,
  filter: AssignmentFilter,
): boolean => {
  const hasAssigned = slot.assignments.length > 0;
  const hasUnassigned = slot.unassignedCount > 0 || !hasAssigned;
  if (filter === 'assigned') return hasAssigned;
  if (filter === 'unassigned') return hasUnassigned;
  return true;
};

const formatScheduleDate = (value: string): string => {
  const date = new Date(`${value}T12:00:00`);
  return new Intl.DateTimeFormat('he-IL', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
  }).format(date);
};

function DynamicAllSchedulesCalendar({
  workspace,
  displayMode = 'calendar',
  defaultAssignmentFilter = 'all',
  currentUserId = null,
  onChanged,
}: DynamicAllSchedulesCalendarProps) {
  const holidayLabels = useCalendarHolidays(workspace.year, workspace.month);
  const [selectedJobTypeIds, setSelectedJobTypeIds] = useState<string[]>([]);
  const [assignmentFilter, setAssignmentFilter] = useState<AssignmentFilter>(defaultAssignmentFilter);
  const [selectedAssigneeId, setSelectedAssigneeId] = useState('all');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<DynamicScheduleCalendarSlot | null>(null);
  const [editor, setEditor] = useState<DynamicPublishedEditorWorkspace | null>(null);
  const [historyEditor, setHistoryEditor] = useState<DynamicHistoricalSlotEditorWorkspace | null>(null);
  const [editorLoading, setEditorLoading] = useState(false);
  const [editorError, setEditorError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [assignmentSelection, setAssignmentSelection] = useState<Record<string, string>>({});
  const [emptySelection, setEmptySelection] = useState('');
  const [changeReason, setChangeReason] = useState('');

  useEffect(() => {
    setSelectedJobTypeIds(workspace.jobTypes.map((jobType) => jobType.id));
    setAssignmentFilter(defaultAssignmentFilter);
    setSelectedAssigneeId('all');
    setSelectedSlot(null);
  }, [defaultAssignmentFilter, workspace.year, workspace.month, workspace.jobTypes]);

  const roleToneById = useMemo(() => new Map(
    workspace.jobTypes.map((jobType, index) => [jobType.id, index % ROLE_TONE_COUNT]),
  ), [workspace.jobTypes]);

  const allRolesSelected = workspace.jobTypes.length > 0
    && selectedJobTypeIds.length === workspace.jobTypes.length;

  const visibleAssignees = useMemo(() => {
    const byId = new Map<string, { userId: string; displayName: string; scheduleName?: string | null }>();
    workspace.slots.forEach((slot) => {
      if (!selectedJobTypeIds.includes(slot.jobTypeId)) return;
      slot.assignments.forEach((assignment) => {
        if (!byId.has(assignment.userId)) byId.set(assignment.userId, assignment);
      });
    });
    return Array.from(byId.values()).sort((a, b) => (
      (a.scheduleName || a.displayName).localeCompare(b.scheduleName || b.displayName, 'he')
    ));
  }, [selectedJobTypeIds, workspace.slots]);

  useEffect(() => {
    if (selectedAssigneeId !== 'all' && !visibleAssignees.some((assignee) => assignee.userId === selectedAssigneeId)) {
      setSelectedAssigneeId('all');
    }
  }, [selectedAssigneeId, visibleAssignees]);

  const filteredSlots = useMemo(() => workspace.slots
    .filter((slot) => (
      selectedJobTypeIds.includes(slot.jobTypeId)
      && matchesAssignmentFilter(slot, assignmentFilter)
      && (selectedAssigneeId === 'all' || slot.assignments.some((assignment) => assignment.userId === selectedAssigneeId))
    ))
    .sort((a, b) => (
      a.shiftDate.localeCompare(b.shiftDate)
      || a.startTime.localeCompare(b.startTime)
      || a.jobTypeName.localeCompare(b.jobTypeName, 'he')
      || a.shiftName.localeCompare(b.shiftName, 'he')
    )), [assignmentFilter, selectedAssigneeId, selectedJobTypeIds, workspace.slots]);

  const slotsByDate = useMemo(() => {
    const map = new Map<string, DynamicScheduleCalendarSlot[]>();
    filteredSlots.forEach((slot) => {
      const current = map.get(slot.shiftDate) ?? [];
      current.push(slot);
      map.set(slot.shiftDate, current);
    });
    return map;
  }, [filteredSlots]);

  const groupedSlots = useMemo(() => Array.from(slotsByDate.entries()), [slotsByDate]);

  const summary = useMemo(() => ({
    shifts: filteredSlots.length,
    assignments: filteredSlots.reduce((sum, slot) => sum + slot.assignments.length, 0),
    unassigned: filteredSlots.reduce((sum, slot) => sum + slot.unassignedCount, 0),
  }), [filteredSlots]);

  const selectedEditorSlot = useMemo(() => {
    if (!selectedSlot?.sourceSlotId || !editor) return null;
    return editor.slots.find((slot) => slot.slotId === selectedSlot.sourceSlotId) ?? null;
  }, [editor, selectedSlot]);

  const toggleJobType = (jobTypeId: string): void => {
    setSelectedJobTypeIds((current) => current.includes(jobTypeId)
      ? current.filter((id) => id !== jobTypeId)
      : [...current, jobTypeId]);
  };

  const selectAllJobTypes = (): void => {
    setSelectedJobTypeIds(allRolesSelected ? [] : workspace.jobTypes.map((jobType) => jobType.id));
  };

  const openSlot = async (slot: DynamicScheduleCalendarSlot): Promise<void> => {
    setSelectedSlot(slot);
    setEditor(null);
    setHistoryEditor(null);
    setEditorError(null);
    setAssignmentSelection({});
    setEmptySelection('');
    setChangeReason('');

    setEditorLoading(true);
    try {
      if (slot.periodSource === 'publication') {
        if (!slot.sourceSlotId) return;
        const data = await dynamicSchedulingService.getPublishedScheduleEditor(slot.sourcePeriodId);
        setEditor(data);
        const matchingSlot = data.slots.find((candidate) => candidate.slotId === slot.sourceSlotId);
        if (matchingSlot) {
          setAssignmentSelection(Object.fromEntries(
            matchingSlot.assignments.map((assignment) => [assignment.id, assignment.userId]),
          ));
        }
      } else {
        const data = await dynamicSchedulingService.getHistoricalSlotEditor({
          historicalPeriodId: slot.sourcePeriodId,
          workDate: slot.shiftDate,
          shiftCode: slot.shiftCode,
          startTime: slot.startTime,
          endTime: slot.endTime,
        });
        setHistoryEditor(data);
        setAssignmentSelection(Object.fromEntries(
          data.assignments.map((assignment) => [assignment.id, assignment.userId ?? UNASSIGNED_VALUE]),
        ));
      }
    } catch (error) {
      setEditorError(error instanceof Error ? error.message : 'טעינת פרטי המשמרת נכשלה.');
    } finally {
      setEditorLoading(false);
    }
  };

  const saveSlotChanges = async (): Promise<void> => {
    if (!selectedSlot || !editor || !selectedEditorSlot || !editor.editable) return;

    const changes = selectedEditorSlot.assignments
      .map((assignment) => ({
        assignment,
        selected: assignmentSelection[assignment.id] ?? assignment.userId,
      }))
      .filter(({ assignment, selected }) => selected !== assignment.userId);

    setSaving(true);
    setEditorError(null);
    try {
      for (const { assignment, selected } of changes) {
        await dynamicSchedulingService.setPublishedScheduleAssignment({
          publicationId: editor.publicationId,
          slotId: selectedEditorSlot.slotId,
          assignmentId: assignment.id,
          userId: selected === UNASSIGNED_VALUE ? null : selected,
          reason: changeReason.trim() || null,
        });
      }

      if (emptySelection) {
        await dynamicSchedulingService.setPublishedScheduleAssignment({
          publicationId: editor.publicationId,
          slotId: selectedEditorSlot.slotId,
          assignmentId: null,
          userId: emptySelection,
          reason: changeReason.trim() || null,
        });
      }

      const refreshed = await dynamicSchedulingService.getPublishedScheduleEditor(editor.publicationId);
      setEditor(refreshed);
      setAssignmentSelection(Object.fromEntries(
        (refreshed.slots.find((candidate) => candidate.slotId === selectedEditorSlot.slotId)?.assignments ?? [])
          .map((assignment) => [assignment.id, assignment.userId]),
      ));
      setEmptySelection('');
      setChangeReason('');
      await onChanged?.();
    } catch (error) {
      setEditorError(error instanceof Error ? error.message : 'שמירת השינוי במשמרת נכשלה.');
    } finally {
      setSaving(false);
    }
  };

  const saveHistoricalChanges = async (): Promise<void> => {
    if (!selectedSlot || !historyEditor || !historyEditor.editable) return;

    const changes = historyEditor.assignments
      .map((assignment) => ({
        assignment,
        selected: assignmentSelection[assignment.id] ?? assignment.userId ?? UNASSIGNED_VALUE,
      }))
      .filter(({ assignment, selected }) => selected !== (assignment.userId ?? UNASSIGNED_VALUE));

    setSaving(true);
    setEditorError(null);
    try {
      for (const { assignment, selected } of changes) {
        await dynamicSchedulingService.setHistoricalAssignment({
          historicalPeriodId: historyEditor.historicalPeriodId,
          assignmentId: assignment.id,
          userId: selected === UNASSIGNED_VALUE ? null : selected,
          reason: changeReason.trim() || null,
        });
      }

      const refreshed = await dynamicSchedulingService.getHistoricalSlotEditor({
        historicalPeriodId: selectedSlot.sourcePeriodId,
        workDate: selectedSlot.shiftDate,
        shiftCode: selectedSlot.shiftCode,
        startTime: selectedSlot.startTime,
        endTime: selectedSlot.endTime,
      });
      setHistoryEditor(refreshed);
      setAssignmentSelection(Object.fromEntries(
        refreshed.assignments.map((assignment) => [assignment.id, assignment.userId ?? UNASSIGNED_VALUE]),
      ));
      setChangeReason('');
      await onChanged?.();
    } catch (error) {
      setEditorError(error instanceof Error ? error.message : 'שמירת השינוי בשיבוץ ההיסטורי נכשלה.');
    } finally {
      setSaving(false);
    }
  };

  const hasPendingChanges = Boolean(selectedEditorSlot && (
    selectedEditorSlot.assignments.some((assignment) =>
      (assignmentSelection[assignment.id] ?? assignment.userId) !== assignment.userId)
    || emptySelection
  ));

  const hasPendingHistoricalChanges = Boolean(historyEditor?.assignments.some((assignment) =>
    (assignmentSelection[assignment.id] ?? assignment.userId ?? UNASSIGNED_VALUE)
      !== (assignment.userId ?? UNASSIGNED_VALUE)));

  const renderSlotCard = (slot: DynamicScheduleCalendarSlot, key: string) => {
    const isUnassigned = slot.unassignedCount > 0 || slot.assignments.length === 0;
    const tone = roleToneById.get(slot.jobTypeId) ?? 0;
    const isMine = selectedAssigneeId === 'all' && Boolean(currentUserId)
      && slot.assignments.some((assignment) => assignment.userId === currentUserId);
    return (
      <button
        type="button"
        className={`dynamic-all-calendar-shift role-tone-${tone} ${isUnassigned ? 'is-unassigned' : ''} ${isMine ? 'is-my-assignment' : ''}`}
        key={key}
        onClick={() => void openSlot(slot)}
      >
        <div className="dynamic-all-calendar-shift-head">
          <span className="dynamic-all-calendar-role">{slot.jobTypeName}</span>
          <span className="dynamic-all-calendar-shift-badges">
            {isMine ? <span className="dynamic-all-calendar-mine-badge">שלי</span> : null}
            {slot.contains200Percent ? <span className="dynamic-all-calendar-premium">200%</span> : null}
          </span>
        </div>
        <strong>{dynamicShiftDisplayName(slot.shiftName, 'משמרת')}</strong>
        <span className="dynamic-all-calendar-time">
          <bdi dir="ltr">{slot.startTime.slice(0, 5)}–{slot.endTime.slice(0, 5)}</bdi>
        </span>
        <div className="dynamic-all-calendar-assignees">
          {slot.assignments.map((assignment) => (
            <span
              key={`${slot.sourcePeriodId}-${assignment.userId}`}
              className={isMine && assignment.userId === currentUserId ? 'is-current-user' : undefined}
            >
              {assignment.displayName}{isMine && assignment.userId === currentUserId ? <small>שלי</small> : null}
            </span>
          ))}
          {isUnassigned ? (
            <span className="is-unassigned-label">
              {slot.unassignedCount > 1 ? `${slot.unassignedCount} מקומות לא משובצים` : 'לא משובץ'}
            </span>
          ) : null}
        </div>
      </button>
    );
  };

  return (
    <>
      <div className="dynamic-all-calendar-toolbar">
        <button
          type="button"
          className="dynamic-all-calendar-filter-toggle"
          aria-expanded={filtersOpen}
          onClick={() => setFiltersOpen((current) => !current)}
        >
          <Filter size={17} />
          <span>סינון תצוגה</span>
          <small>{selectedJobTypeIds.length}/{workspace.jobTypes.length} תפקידים · {assignmentFilter === 'all' ? 'הכול' : assignmentFilter === 'assigned' ? 'משובצים' : 'לא משובצים'} · {selectedAssigneeId === 'all' ? 'כל העובדים' : (visibleAssignees.find((assignee) => assignee.userId === selectedAssigneeId)?.scheduleName || visibleAssignees.find((assignee) => assignee.userId === selectedAssigneeId)?.displayName || 'עובד')}</small>
          {filtersOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        <div className="dynamic-all-calendar-legend" aria-label="מקרא תפקידים">
          {workspace.jobTypes.map((jobType) => (
            <span key={jobType.id} className={`role-tone-${roleToneById.get(jobType.id) ?? 0}`}>
              <i aria-hidden="true" />{jobType.name}
            </span>
          ))}
        </div>
      </div>

      {filtersOpen ? (
        <div className="dynamic-all-calendar-filters-panel" aria-label="סינון לוח השיבוצים">
          <fieldset className="dynamic-all-calendar-filter-group">
            <legend>תפקידים</legend>
            <label>
              <input type="checkbox" checked={allRolesSelected} onChange={selectAllJobTypes} />
              <span>כל התפקידים</span>
            </label>
            {workspace.jobTypes.map((jobType) => (
              <label key={jobType.id}>
                <input
                  type="checkbox"
                  checked={selectedJobTypeIds.includes(jobType.id)}
                  onChange={() => toggleJobType(jobType.id)}
                />
                <span className={`dynamic-all-calendar-role-choice role-tone-${roleToneById.get(jobType.id) ?? 0}`}>
                  <i aria-hidden="true" />{jobType.name}
                </span>
              </label>
            ))}
          </fieldset>

          <fieldset className="dynamic-all-calendar-filter-group dynamic-all-calendar-assignee-filter">
            <legend>עובד / משובץ</legend>
            <select
              value={selectedAssigneeId}
              onChange={(event) => setSelectedAssigneeId(event.target.value)}
              aria-label="סינון שיבוצים לפי עובד"
            >
              <option value="all">כל העובדים</option>
              {visibleAssignees.map((assignee) => (
                <option key={assignee.userId} value={assignee.userId}>
                  {assignee.scheduleName || assignee.displayName}
                </option>
              ))}
            </select>
            <small>הצג רק משמרות וכוננויות של העובד שנבחר.</small>
          </fieldset>

          <fieldset className="dynamic-all-calendar-filter-group">
            <legend>איוש</legend>
            {([
              ['all', 'הכול'],
              ['assigned', 'רק משובצים'],
              ['unassigned', 'רק לא משובצים'],
            ] as const).map(([value, label]) => (
              <label key={value}>
                <input
                  type="radio"
                  name="schedule-assignment-filter"
                  checked={assignmentFilter === value}
                  onChange={() => setAssignmentFilter(value)}
                />
                <span>{label}</span>
              </label>
            ))}
          </fieldset>

          <div className="dynamic-all-calendar-summary">
            <div><CalendarDays size={15} /><strong>{summary.shifts}</strong><span>משמרות / כוננויות</span></div>
            <div><UserRoundCheck size={15} /><strong>{summary.assignments}</strong><span>שיבוצי עובדים</span></div>
            <div><UserRoundX size={15} /><strong>{summary.unassigned}</strong><span>מקומות לא משובצים</span></div>
          </div>
        </div>
      ) : null}

      {displayMode === 'calendar' ? (
        <div className="dynamic-all-calendar-board">
          <MonthCalendar
            year={workspace.year}
            month={workspace.month}
            dayLabels={holidayLabels}
            emptyMessage="אין שיבוצים להצגה בחודש הזה."
            renderDayContent={({ date }) => {
              const slots = slotsByDate.get(date) ?? [];
              if (slots.length === 0) return null;
              return (
                <div className="dynamic-all-calendar-day-items">
                  {slots.map((slot, index) => renderSlotCard(
                    slot,
                    `${slot.jobTypeId}-${slot.shiftDate}-${slot.shiftCode}-${slot.startTime}-${index}`,
                  ))}
                </div>
              );
            }}
          />
        </div>
      ) : (
        <div className="dynamic-all-schedules-list">
          {groupedSlots.length === 0 ? (
            <div className="dynamic-shifts-empty">
              <CalendarDays size={22} />
              <div><strong>אין שיבוצים להצגה</strong><span>שנה את הסינון או בחר חודש אחר.</span></div>
            </div>
          ) : groupedSlots.map(([date, slots]) => (
            <section className="dynamic-all-schedules-list-day" key={date}>
              <div className="dynamic-all-schedules-list-date">
                <strong>{formatScheduleDate(date)}</strong>
                {holidayLabels.get(date)?.map((label) => <span key={label}>{label}</span>)}
              </div>
              <div className="dynamic-all-schedules-list-rows">
                {slots.map((slot, index) => {
                  const isUnassigned = slot.unassignedCount > 0 || slot.assignments.length === 0;
                  const tone = roleToneById.get(slot.jobTypeId) ?? 0;
                  const isMine = selectedAssigneeId === 'all' && Boolean(currentUserId)
                    && slot.assignments.some((assignment) => assignment.userId === currentUserId);
                  return (
                    <button
                      type="button"
                      className={`dynamic-all-schedules-list-row role-tone-${tone} ${isUnassigned ? 'is-unassigned' : ''} ${isMine ? 'is-my-assignment' : ''}`}
                      key={`${slot.jobTypeId}-${slot.shiftCode}-${slot.startTime}-${index}`}
                      onClick={() => void openSlot(slot)}
                    >
                      <span className="dynamic-all-schedules-list-role"><i aria-hidden="true" />{slot.jobTypeName}</span>
                      <span className="dynamic-all-schedules-list-shift">
                        <strong>{dynamicShiftDisplayName(slot.shiftName, 'משמרת')}</strong>
                        <small>{slot.startTime.slice(0, 5)}–{slot.endTime.slice(0, 5)}</small>
                      </span>
                      <span className="dynamic-all-schedules-list-workers">
                        {slot.assignments.length ? slot.assignments.map((assignment) => (
                          <span key={assignment.userId} className={isMine && assignment.userId === currentUserId ? 'is-current-user' : undefined}>
                            {assignment.displayName}{isMine && assignment.userId === currentUserId ? <small>שלי</small> : null}
                          </span>
                        )) : 'אין עובד משובץ'}
                        {slot.unassignedCount > 0 ? <small>{slot.unassignedCount} מקום/ות לא משובצים</small> : null}
                      </span>
                      <span className="dynamic-all-calendar-shift-badges">
                        {isMine ? <span className="dynamic-all-calendar-mine-badge">שלי</span> : null}
                        {slot.contains200Percent ? <span className="dynamic-all-calendar-premium">200%</span> : null}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      <Modal
        isOpen={Boolean(selectedSlot)}
        title={selectedSlot ? `${selectedSlot.jobTypeName} · ${dynamicShiftDisplayName(selectedSlot.shiftName, 'משמרת')}` : 'פרטי משמרת'}
        onClose={() => setSelectedSlot(null)}
        className="dynamic-calendar-slot-modal"
        footer={(selectedSlot?.periodSource === 'publication' && editor?.editable)
          || (selectedSlot?.periodSource === 'history' && historyEditor?.editable) ? (
          <>
            <Button variant="secondary" onClick={() => setSelectedSlot(null)}>סגור</Button>
            {selectedSlot?.periodSource === 'history' ? (
              <Button disabled={saving || !hasPendingHistoricalChanges} onClick={() => void saveHistoricalChanges()}>
                {saving ? <LoaderCircle className="spin" size={16} /> : <Save size={16} />} שמור שינוי היסטורי
              </Button>
            ) : (
              <Button disabled={saving || !hasPendingChanges} onClick={() => void saveSlotChanges()}>
                {saving ? <LoaderCircle className="spin" size={16} /> : <Save size={16} />} שמור שינויים
              </Button>
            )}
          </>
        ) : undefined}
      >
        {selectedSlot ? (
          <div className="dynamic-calendar-slot-details">
            <div className="dynamic-calendar-slot-facts">
              <div><span>תאריך</span><strong>{new Intl.DateTimeFormat('he-IL', { dateStyle: 'full' }).format(new Date(`${selectedSlot.shiftDate}T12:00:00`))}</strong></div>
              <div><span>שעות</span><strong><bdi dir="ltr">{selectedSlot.startTime.slice(0, 5)}–{selectedSlot.endTime.slice(0, 5)}</bdi></strong></div>
              <div><span>תפקיד</span><strong>{selectedSlot.jobTypeName}</strong></div>
              <div><span>מקור</span><strong>{selectedSlot.periodSource === 'publication' ? 'לוח מפורסם' : 'היסטוריה מיובאת'}</strong></div>
            </div>

            {selectedSlot.holidayName ? <div className="dynamic-calendar-slot-note">חג / מועד: {selectedSlot.holidayName}</div> : null}
            {selectedSlot.contains200Percent ? <div className="dynamic-calendar-slot-note is-premium">כולל רכיב 200%{selectedSlot.premium200Hours ? ` · ${selectedSlot.premium200Hours} שעות` : ''}</div> : null}

            {editorLoading ? (
              <div className="dynamic-shifts-loading"><LoaderCircle className="spin" size={18} /> טוען אפשרויות עריכה…</div>
            ) : editorError ? (
              <div className="users-error" role="alert">{editorError}</div>
            ) : selectedSlot.periodSource === 'history' && historyEditor ? (
              <div className="dynamic-calendar-slot-editor">
                {!historyEditor.editable ? (
                  <div className="dynamic-period-workflow-note">
                    {historyEditor.editabilityReason ?? 'החודש ההיסטורי מוצג לקריאה בלבד.'}
                  </div>
                ) : (
                  <div className="dynamic-period-workflow-note is-warning">
                    זהו שיבוץ עבר מיובא. כל שינוי נשמר בהיסטוריה ומתועד ביומן המערכת, בעוד נתון המקור המקורי נשמר.
                  </div>
                )}

                {historyEditor.assignments.map((assignment, index) => (
                  <label key={assignment.id} className="dynamic-calendar-slot-assignment-row">
                    <span>{historyEditor.assignments.length > 1 ? `שיבוץ ${index + 1}` : 'עובד משובץ'}</span>
                    <select
                      value={assignmentSelection[assignment.id] ?? assignment.userId ?? UNASSIGNED_VALUE}
                      disabled={!historyEditor.editable || saving}
                      onChange={(event) => setAssignmentSelection((current) => ({ ...current, [assignment.id]: event.target.value }))}
                    >
                      {assignment.userId && assignment.displayName ? (
                        <option value={assignment.userId}>{assignment.displayName} (נוכחי)</option>
                      ) : null}
                      <option value={UNASSIGNED_VALUE}>— השאר לא משובץ —</option>
                      {historyEditor.members
                        .filter((member) => member.userId !== assignment.userId)
                        .map((member) => <option key={member.userId} value={member.userId}>{member.displayName}</option>)}
                    </select>
                  </label>
                ))}

                {historyEditor.editable ? (
                  <label className="dynamic-calendar-slot-reason">
                    <span>סיבת שינוי (מומלץ)</span>
                    <input value={changeReason} onChange={(event) => setChangeReason(event.target.value)} placeholder="לדוגמה: תיקון שיבוץ היסטורי" />
                  </label>
                ) : null}
              </div>
            ) : selectedSlot.periodSource === 'history' ? (
              <div className="dynamic-period-workflow-note">לא נמצאו פרטי עריכה עבור השיבוץ ההיסטורי.</div>
            ) : selectedEditorSlot && editor ? (
              <div className="dynamic-calendar-slot-editor">
                {!editor.editable ? <div className="dynamic-period-workflow-note is-warning">{editor.editabilityReason ?? 'המשמרת אינה פתוחה לעריכה.'}</div> : null}
                {selectedEditorSlot.assignments.map((assignment) => (
                  <label key={assignment.id} className="dynamic-calendar-slot-assignment-row">
                    <span>עובד משובץ</span>
                    <select
                      value={assignmentSelection[assignment.id] ?? assignment.userId}
                      disabled={!editor.editable || saving}
                      onChange={(event) => setAssignmentSelection((current) => ({ ...current, [assignment.id]: event.target.value }))}
                    >
                      <option value={assignment.userId}>{assignment.displayName} (נוכחי)</option>
                      <option value={UNASSIGNED_VALUE}>— השאר לא משובץ —</option>
                      {editor.members.filter((member) => member.userId !== assignment.userId).map((member) => (
                        <option key={member.userId} value={member.userId}>{member.displayName}</option>
                      ))}
                    </select>
                  </label>
                ))}

                {selectedEditorSlot.intentionallyUnassignedCount > 0 ? (
                  <label className="dynamic-calendar-slot-assignment-row">
                    <span>עמדה לא משובצת</span>
                    <select value={emptySelection} disabled={!editor.editable || saving} onChange={(event) => setEmptySelection(event.target.value)}>
                      <option value="">השאר לא משובץ</option>
                      {editor.members.map((member) => <option key={member.userId} value={member.userId}>{member.displayName}</option>)}
                    </select>
                  </label>
                ) : null}

                {editor.editable ? (
                  <label className="dynamic-calendar-slot-reason">
                    <span>סיבת שינוי (אופציונלי)</span>
                    <input value={changeReason} onChange={(event) => setChangeReason(event.target.value)} placeholder="לדוגמה: החלפה באישור מנהל" />
                  </label>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </Modal>
    </>
  );
}

export default DynamicAllSchedulesCalendar;
