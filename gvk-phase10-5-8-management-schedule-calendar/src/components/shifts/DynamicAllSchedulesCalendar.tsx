import { CalendarDays, Filter, UserRoundCheck, UserRoundX } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useCalendarHolidays } from '../../hooks/useCalendarHolidays';
import type {
  DynamicScheduleCalendarSlot,
  DynamicScheduleCalendarWorkspace,
} from '../../types/dynamicShiftsWorkspace';
import MonthCalendar from '../calendar/MonthCalendar';

type AssignmentFilter = 'all' | 'assigned' | 'unassigned';

interface DynamicAllSchedulesCalendarProps {
  workspace: DynamicScheduleCalendarWorkspace;
}

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

function DynamicAllSchedulesCalendar({ workspace }: DynamicAllSchedulesCalendarProps) {
  const holidayLabels = useCalendarHolidays(workspace.year, workspace.month);
  const [selectedJobTypeIds, setSelectedJobTypeIds] = useState<string[]>([]);
  const [assignmentFilter, setAssignmentFilter] = useState<AssignmentFilter>('all');

  useEffect(() => {
    setSelectedJobTypeIds(workspace.jobTypes.map((jobType) => jobType.id));
    setAssignmentFilter('all');
  }, [workspace.year, workspace.month, workspace.jobTypes]);

  const allRolesSelected = workspace.jobTypes.length > 0
    && selectedJobTypeIds.length === workspace.jobTypes.length;

  const filteredSlots = useMemo(() => workspace.slots.filter((slot) => (
    selectedJobTypeIds.includes(slot.jobTypeId)
    && matchesAssignmentFilter(slot, assignmentFilter)
  )), [assignmentFilter, selectedJobTypeIds, workspace.slots]);

  const slotsByDate = useMemo(() => {
    const map = new Map<string, DynamicScheduleCalendarSlot[]>();
    filteredSlots.forEach((slot) => {
      const current = map.get(slot.shiftDate) ?? [];
      current.push(slot);
      map.set(slot.shiftDate, current);
    });
    return map;
  }, [filteredSlots]);

  const summary = useMemo(() => ({
    shifts: filteredSlots.length,
    assignments: filteredSlots.reduce((sum, slot) => sum + slot.assignments.length, 0),
    unassigned: filteredSlots.reduce((sum, slot) => sum + slot.unassignedCount, 0),
  }), [filteredSlots]);

  const toggleJobType = (jobTypeId: string): void => {
    setSelectedJobTypeIds((current) => current.includes(jobTypeId)
      ? current.filter((id) => id !== jobTypeId)
      : [...current, jobTypeId]);
  };

  const selectAllJobTypes = (): void => {
    setSelectedJobTypeIds(workspace.jobTypes.map((jobType) => jobType.id));
  };

  return (
    <div className="dynamic-all-calendar-layout">
      <aside className="dynamic-all-calendar-filters" aria-label="סינון לוח השיבוצים">
        <div className="dynamic-all-calendar-filter-title">
          <Filter size={18} />
          <div>
            <strong>סינון תצוגה</strong>
            <span>תפקידים ומצב איוש</span>
          </div>
        </div>

        <fieldset className="dynamic-all-calendar-filter-group">
          <legend>תפקידים</legend>
          <label>
            <input
              type="checkbox"
              checked={allRolesSelected}
              onChange={selectAllJobTypes}
            />
            <span>כל התפקידים</span>
          </label>
          {workspace.jobTypes.map((jobType) => (
            <label key={jobType.id}>
              <input
                type="checkbox"
                checked={selectedJobTypeIds.includes(jobType.id)}
                onChange={() => toggleJobType(jobType.id)}
              />
              <span>{jobType.name}</span>
            </label>
          ))}
        </fieldset>

        <fieldset className="dynamic-all-calendar-filter-group">
          <legend>איוש</legend>
          <label>
            <input
              type="radio"
              name="schedule-assignment-filter"
              checked={assignmentFilter === 'all'}
              onChange={() => setAssignmentFilter('all')}
            />
            <span>הכול</span>
          </label>
          <label>
            <input
              type="radio"
              name="schedule-assignment-filter"
              checked={assignmentFilter === 'assigned'}
              onChange={() => setAssignmentFilter('assigned')}
            />
            <span>רק משובצים</span>
          </label>
          <label>
            <input
              type="radio"
              name="schedule-assignment-filter"
              checked={assignmentFilter === 'unassigned'}
              onChange={() => setAssignmentFilter('unassigned')}
            />
            <span>רק לא משובצים</span>
          </label>
        </fieldset>

        <div className="dynamic-all-calendar-summary">
          <div><CalendarDays size={15} /><strong>{summary.shifts}</strong><span>משמרות / כוננויות</span></div>
          <div><UserRoundCheck size={15} /><strong>{summary.assignments}</strong><span>שיבוצי עובדים</span></div>
          <div><UserRoundX size={15} /><strong>{summary.unassigned}</strong><span>מקומות לא משובצים</span></div>
        </div>
      </aside>

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
                {slots.map((slot, index) => {
                  const isUnassigned = slot.unassignedCount > 0 || slot.assignments.length === 0;
                  return (
                    <article
                      className={`dynamic-all-calendar-shift ${isUnassigned ? 'is-unassigned' : ''}`}
                      key={`${slot.jobTypeId}-${slot.shiftCode}-${slot.startTime}-${index}`}
                    >
                      <div className="dynamic-all-calendar-shift-head">
                        <span className="dynamic-all-calendar-role">{slot.jobTypeName}</span>
                        {slot.contains200Percent ? <span className="dynamic-all-calendar-premium">200%</span> : null}
                      </div>
                      <strong>{slot.shiftName}</strong>
                      <span className="dynamic-all-calendar-time">
                        {slot.startTime.slice(0, 5)}–{slot.endTime.slice(0, 5)}
                      </span>
                      <div className="dynamic-all-calendar-assignees">
                        {slot.assignments.map((assignment) => (
                          <span key={`${slot.sourcePeriodId}-${assignment.userId}`}>{assignment.displayName}</span>
                        ))}
                        {isUnassigned ? (
                          <span className="is-unassigned-label">
                            {slot.unassignedCount > 1
                              ? `${slot.unassignedCount} מקומות לא משובצים`
                              : 'לא משובץ'}
                          </span>
                        ) : null}
                      </div>
                    </article>
                  );
                })}
              </div>
            );
          }}
        />
      </div>
    </div>
  );
}

export default DynamicAllSchedulesCalendar;
