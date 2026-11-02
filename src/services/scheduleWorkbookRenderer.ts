import type ExcelJS from 'exceljs';
import type { DynamicScheduleCalendarSlot, DynamicScheduleCalendarWorkspace } from '../types/dynamicShiftsWorkspace';
import type { ScheduleExcelLayout } from '../types/scheduleFileLayout';

const FIRST_DATA_ROW = 2;
const ROWS_PER_DAY = 3;
const MAX_DAYS = 31;
const LAST_TEMPLATE_ROW = FIRST_DATA_ROW + MAX_DAYS * ROWS_PER_DAY - 1;
const ROW_TARGET_STARTS = [8 * 60, 16 * 60, 23 * 60] as const;
const hebrewWeekdays = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

function padNumber(value: number): string {
  return String(value).padStart(2, '0');
}

function createDateKey(year: number, month: number, day: number): string {
  return `${year}-${padNumber(month)}-${padNumber(day)}`;
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function normalizeTime(value: string): string {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})/);
  if (!match) return value.trim();
  return `${padNumber(Number(match[1]))}:${match[2]}`;
}

function timeToMinutes(value: string): number {
  const normalized = normalizeTime(value);
  const match = normalized.match(/^(\d{2}):(\d{2})$/);
  if (!match) return 0;
  return Number(match[1]) * 60 + Number(match[2]);
}

function getInterval(slot: DynamicScheduleCalendarSlot): { start: number; end: number } {
  const start = timeToMinutes(slot.startTime);
  let end = timeToMinutes(slot.endTime);
  if (end <= start) end += 24 * 60;
  return { start, end };
}

function overlapMinutes(a: DynamicScheduleCalendarSlot, b: DynamicScheduleCalendarSlot): number {
  const first = getInterval(a);
  const second = getInterval(b);
  const start = Math.max(first.start, second.start);
  const end = Math.min(first.end, second.end);
  return Math.max(0, end - start);
}

function circularMinuteDistance(first: number, second: number): number {
  const distance = Math.abs(first - second);
  return Math.min(distance, 24 * 60 - distance);
}

function sortSlots(slots: DynamicScheduleCalendarSlot[]): DynamicScheduleCalendarSlot[] {
  return [...slots].sort((a, b) => {
    const startDelta = timeToMinutes(a.startTime) - timeToMinutes(b.startTime);
    if (startDelta !== 0) return startDelta;
    return a.shiftName.localeCompare(b.shiftName, 'he');
  });
}

function assignmentNames(slot: DynamicScheduleCalendarSlot | undefined): string | null {
  if (!slot) return null;
  const names = Array.from(
    new Set(
      slot.assignments
        .map((assignment) => (assignment.scheduleName?.trim() || assignment.displayName.trim()))
        .filter(Boolean),
    ),
  );
  return names.length > 0 ? names.join(' / ') : null;
}

function countAssignments(slots: DynamicScheduleCalendarSlot[]): number {
  return slots.reduce((sum, slot) => sum + slot.assignments.length, 0);
}

function groupByDate(
  workspace: DynamicScheduleCalendarWorkspace,
  jobTypeId: string | null,
): Map<string, DynamicScheduleCalendarSlot[]> {
  const result = new Map<string, DynamicScheduleCalendarSlot[]>();
  if (!jobTypeId) return result;

  workspace.slots
    .filter((slot) => slot.jobTypeId === jobTypeId)
    .forEach((slot) => {
      const current = result.get(slot.shiftDate) ?? [];
      current.push(slot);
      result.set(slot.shiftDate, current);
    });

  result.forEach((slots, date) => result.set(date, sortSlots(slots)));
  return result;
}

function getRoleSlotsForDate(
  workspace: DynamicScheduleCalendarWorkspace,
  jobTypeId: string | null,
  dateKey: string,
): DynamicScheduleCalendarSlot[] {
  if (!jobTypeId) return [];
  return sortSlots(
    workspace.slots.filter(
      (slot) => slot.jobTypeId === jobTypeId && slot.shiftDate === dateKey,
    ),
  );
}

function slotContainsTargetMinute(slot: DynamicScheduleCalendarSlot, targetMinute: number): boolean {
  const interval = getInterval(slot);
  const candidates = [targetMinute, targetMinute + 24 * 60];
  return candidates.some((candidate) => candidate >= interval.start && candidate < interval.end);
}

function selectClosestUnusedSlot(
  slots: DynamicScheduleCalendarSlot[],
  usedSlotKeys: Set<string>,
  targetStart: number,
): DynamicScheduleCalendarSlot | undefined {
  // A row represents a time band, not merely the closest slot in the Job Type.
  // Requiring the slot to actually contain the row anchor prevents an evening
  // 16:00-23:00 slot from being exported into the morning row when the dedicated
  // morning Job Type has no concrete slot that day.
  return slots
    .filter((slot) => !usedSlotKeys.has(getSlotKey(slot)))
    .filter((slot) => slotContainsTargetMinute(slot, targetStart))
    .map((slot) => ({
      slot,
      assigned: slot.assignments.length > 0 ? 1 : 0,
      distance: circularMinuteDistance(timeToMinutes(slot.startTime), targetStart),
    }))
    .sort((a, b) => b.assigned - a.assigned || a.distance - b.distance || timeToMinutes(a.slot.startTime) - timeToMinutes(b.slot.startTime))[0]?.slot;
}

function getSlotKey(slot: DynamicScheduleCalendarSlot): string {
  return `${slot.jobTypeId}:${slot.sourcePeriodId}:${slot.sourceSlotId ?? slot.shiftCode}:${slot.shiftDate}`;
}

function getPrimaryRoleCandidates(
  layout: ScheduleExcelLayout,
  rowOffset: number,
): Array<string | null> {
  if (rowOffset === 0) {
    // Weekdays may use a dedicated morning Job Type, while Friday/Saturday/holidays
    // often use the main dispatcher Job Type for the morning shift as well.
    // Keep that behavior generic by trying the configured morning role first and
    // then the regular shift role for the same time band.
    return Array.from(new Set([
      layout.morningRowJobTypeId,
      layout.eveningRowJobTypeId,
    ]));
  }

  if (rowOffset === 1) return [layout.eveningRowJobTypeId];
  return [layout.nightRowJobTypeId];
}

function mapPrimaryRows(
  workspace: DynamicScheduleCalendarWorkspace,
  dateKey: string,
  layout: ScheduleExcelLayout,
): Array<DynamicScheduleCalendarSlot | undefined> {
  const used = new Set<string>();

  return ROW_TARGET_STARTS.map((targetStart, rowOffset) => {
    const roleCandidates = getPrimaryRoleCandidates(layout, rowOffset);

    for (const jobTypeId of roleCandidates) {
      const slot = selectClosestUnusedSlot(
        getRoleSlotsForDate(workspace, jobTypeId, dateKey),
        used,
        targetStart,
      );
      if (slot) {
        used.add(getSlotKey(slot));
        return slot;
      }
    }

    return undefined;
  });
}

function mostCommonRangeForRoleAndRow(
  workspace: DynamicScheduleCalendarWorkspace,
  jobTypeId: string | null,
  targetStart: number,
): string | null {
  if (!jobTypeId) return null;

  const counts = new Map<string, number>();
  workspace.slots
    .filter((slot) => slot.jobTypeId === jobTypeId)
    .filter((slot) => slotContainsTargetMinute(slot, targetStart))
    .forEach((slot) => {
      const range = `${normalizeTime(slot.startTime)}-${normalizeTime(slot.endTime)}`;
      counts.set(range, (counts.get(range) ?? 0) + 1);
    });

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

function resolvePrimaryRowHours(
  workspace: DynamicScheduleCalendarWorkspace,
  layout: ScheduleExcelLayout,
  rowOffset: number,
  slot: DynamicScheduleCalendarSlot | undefined,
): string | null {
  if (slot) return `${normalizeTime(slot.startTime)}-${normalizeTime(slot.endTime)}`;

  const targetStart = ROW_TARGET_STARTS[rowOffset];
  for (const jobTypeId of getPrimaryRoleCandidates(layout, rowOffset)) {
    const fallback = mostCommonRangeForRoleAndRow(workspace, jobTypeId, targetStart);
    if (fallback) return fallback;
  }

  return null;
}

function selectMorningParallelSlot(
  morningPrimary: DynamicScheduleCalendarSlot | undefined,
  parallelSlots: DynamicScheduleCalendarSlot[],
): DynamicScheduleCalendarSlot | undefined {
  if (parallelSlots.length === 0) return undefined;

  // For a parallel morning role (for example a morning on-call role) the
  // published assignment is the source of truth. A Job Type may contain more
  // than one template with similar morning hours (06:00-14:00 / 06:00-16:00).
  // Previously the exporter picked the slot with the greatest overlap with the
  // primary row, which could export an unassigned 06:00-14:00 template instead
  // of the actually assigned 06:00-16:00 duty. Prefer assigned slots first.
  return parallelSlots
    .map((slot) => ({
      slot,
      assigned: slot.assignments.length > 0 ? 1 : 0,
      overlap: morningPrimary ? overlapMinutes(morningPrimary, slot) : 0,
      distance: circularMinuteDistance(timeToMinutes(slot.startTime), ROW_TARGET_STARTS[0]),
      duration: getInterval(slot).end - getInterval(slot).start,
    }))
    .sort((a, b) =>
      b.assigned - a.assigned
      || b.overlap - a.overlap
      || a.distance - b.distance
      || b.duration - a.duration
    )[0]?.slot;
}

function buildDayRemarks(slots: Array<DynamicScheduleCalendarSlot | undefined>): string | null {
  const holidayNames = Array.from(
    new Set(
      slots
        .map((slot) => slot?.holidayName?.trim())
        .filter((value): value is string => Boolean(value)),
    ),
  );
  return holidayNames.length > 0 ? holidayNames.join(' / ') : null;
}

function clearDataFill(cell: ExcelJS.Cell): void {
  // The supplied workbook contains orange/grey fills in C, E, F and G.
  // Do not inherit template fills or infer premium pay from their colors.
  cell.fill = { type: 'pattern', pattern: 'none' };
}


function clearTemplateValues(worksheet: ExcelJS.Worksheet): void {
  for (let row = FIRST_DATA_ROW; row <= LAST_TEMPLATE_ROW; row += 1) {
    for (let column = 1; column <= 8; column += 1) {
      worksheet.getCell(row, column).value = null;
    }
    // Clear all data-area fills (C:G). The source template also contains
    // orange/grey fills in F and merged daily-duty cells in G.
    // Preserve headers, borders, alignment and merged-cell structure.
    for (let column = 3; column <= 7; column += 1) {
      clearDataFill(worksheet.getCell(row, column));
    }
  }
}

function setExportDate(
  worksheet: ExcelJS.Worksheet,
  address: string,
  year: number,
  month: number,
  day: number,
): void {
  const cell = worksheet.getCell(address);
  cell.value = new Date(year, month - 1, day, 12, 0, 0, 0);
  cell.numFmt = 'dd/mm/yyyy';
}

function hideUnusedRows(worksheet: ExcelJS.Worksheet, daysInMonth: number): void {
  const firstUnusedRow = FIRST_DATA_ROW + daysInMonth * ROWS_PER_DAY;
  for (let row = FIRST_DATA_ROW; row <= LAST_TEMPLATE_ROW; row += 1) {
    worksheet.getRow(row).hidden = row >= firstUnusedRow;
  }
}

function applyWorksheetPresentation(worksheet: ExcelJS.Worksheet): void {
  // Keep the date visible even when Excel opens the file with a narrow default
  // width. The other widths intentionally stay close to the supplied template.
  worksheet.getColumn('A').width = Math.max(worksheet.getColumn('A').width ?? 0, 15);
  worksheet.getColumn('H').width = Math.max(worksheet.getColumn('H').width ?? 0, 24);
  worksheet.getCell('H1').value = 'הערות';

  const headerFill: ExcelJS.Fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF4472C4' },
  };
  for (let column = 1; column <= 8; column += 1) {
    const cell = worksheet.getCell(1, column);
    cell.fill = headerFill;
    cell.font = { ...cell.font, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.alignment = { ...cell.alignment, vertical: 'middle', horizontal: 'center', wrapText: true };
  }
  worksheet.getRow(1).height = Math.max(worksheet.getRow(1).height ?? 0, 28);
}

export interface ScheduleWorkbookRenderResult {
  primaryAssignments: number;
  parallelAssignments: number;
  dailyAssignments: number;
}

/** Pure workbook renderer: no fetch, DOM, Supabase, or mail transport. */
export function renderScheduleWorkbook(
  workbook: ExcelJS.Workbook,
  workspace: DynamicScheduleCalendarWorkspace,
  calendarHolidays: Array<{ date: string; name: string }>,
  year: number,
  month: number,
  layout: ScheduleExcelLayout,
): ScheduleWorkbookRenderResult {
    const holidayNamesByDate = new Map<string, string[]>();
    calendarHolidays.forEach((holiday) => {
      const current = holidayNamesByDate.get(holiday.date) ?? [];
      if (holiday.name && !current.includes(holiday.name)) current.push(holiday.name);
      holidayNamesByDate.set(holiday.date, current);
    });

    const worksheet = workbook.worksheets[0];
    if (!worksheet) throw new Error('לא נמצא גיליון בתבנית הייצוא.');

    const parallelByDate = groupByDate(workspace, layout.parallelMorningJobTypeId);
    const dailyByDate = groupByDate(workspace, layout.dailyJobTypeId);

    clearTemplateValues(worksheet);
    applyWorksheetPresentation(worksheet);

    const primaryExportedSlots: DynamicScheduleCalendarSlot[] = [];
    const parallelExportedSlots: DynamicScheduleCalendarSlot[] = [];
    const daysInMonth = getDaysInMonth(year, month);
    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = new Date(year, month - 1, day, 12, 0, 0, 0);
      const dateKey = createDateKey(year, month, day);
      const firstRow = FIRST_DATA_ROW + (day - 1) * ROWS_PER_DAY;
      const primaryRows = mapPrimaryRows(workspace, dateKey, layout);
      const parallelSlots = parallelByDate.get(dateKey) ?? [];
      const dailySlots = dailyByDate.get(dateKey) ?? [];
      const parallelMorningSlot = selectMorningParallelSlot(primaryRows[0], parallelSlots);

      setExportDate(worksheet, `A${firstRow}`, year, month, day);
      worksheet.getCell(`B${firstRow}`).value = hebrewWeekdays[date.getDay()] ?? '';

      for (let rowOffset = 0; rowOffset < ROWS_PER_DAY; rowOffset += 1) {
        const row = firstRow + rowOffset;
        const primarySlot = primaryRows[rowOffset];

        worksheet.getCell(`C${row}`).value = resolvePrimaryRowHours(
          workspace,
          layout,
          rowOffset,
          primarySlot,
        );
        worksheet.getCell(`D${row}`).value = assignmentNames(primarySlot);
        if (primarySlot) primaryExportedSlots.push(primarySlot);

        // The parallel/morning-duty area represents one duty per day. It is
        // intentionally written only on the first row instead of duplicating
        // the same person across the evening/night rows.
        if (rowOffset === 0) {
          worksheet.getCell(`E${row}`).value = parallelMorningSlot
            ? `${normalizeTime(parallelMorningSlot.startTime)}-${normalizeTime(parallelMorningSlot.endTime)}`
            : null;
          worksheet.getCell(`F${row}`).value = assignmentNames(parallelMorningSlot);
          if (parallelMorningSlot) parallelExportedSlots.push(parallelMorningSlot);
        } else {
          worksheet.getCell(`E${row}`).value = null;
          worksheet.getCell(`F${row}`).value = null;
        }
      }

      worksheet.getCell(`G${firstRow}`).value = assignmentNames(dailySlots[0]);

      const explicitHolidayNames = holidayNamesByDate.get(dateKey) ?? [];
      const slotHolidayRemarks = buildDayRemarks([
        ...primaryRows,
        parallelMorningSlot,
        ...dailySlots,
      ]);
      const dayRemarks = explicitHolidayNames.length > 0
        ? explicitHolidayNames.join(' / ')
        : slotHolidayRemarks;
      worksheet.getCell(`H${firstRow}`).value = dayRemarks;
      worksheet.getCell(`H${firstRow}`).alignment = {
        ...worksheet.getCell(`H${firstRow}`).alignment,
        vertical: 'middle',
        horizontal: 'right',
        wrapText: true,
      };
    }

    hideUnusedRows(worksheet, daysInMonth);

    return {
      primaryAssignments: countAssignments(primaryExportedSlots),
      parallelAssignments: countAssignments(parallelExportedSlots),
      dailyAssignments: countAssignments(Array.from(dailyByDate.values()).flat()),
    };
}
