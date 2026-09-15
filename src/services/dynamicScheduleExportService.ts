import type ExcelJS from 'exceljs';

import { calendarHolidayService } from './calendarHolidayService';
import { dynamicSchedulingService } from './dynamicSchedulingService';

import type {
  DynamicScheduleCalendarSlot,
  DynamicScheduleCalendarWorkspace,
} from '../types/dynamicShiftsWorkspace';
import type {
  ScheduleExcelLayout,
  ScheduleFileJobTypeOption,
} from '../types/scheduleFileLayout';

const TEMPLATE_URL = '/templates/dynamic-schedule-layout-template.xlsx';
const FIRST_DATA_ROW = 2;
const ROWS_PER_DAY = 3;
const MAX_DAYS = 31;
const LAST_TEMPLATE_ROW = FIRST_DATA_ROW + MAX_DAYS * ROWS_PER_DAY - 1;
const ROW_TARGET_STARTS = [8 * 60, 16 * 60, 23 * 60] as const;

const hebrewMonths = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר',
];

const hebrewWeekdays = [
  'ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת',
];

export interface DynamicScheduleExportResult {
  fileName: string;
  year: number;
  month: number;
  primaryAssignments: number;
  parallelAssignments: number;
  dailyAssignments: number;
}

export interface DynamicScheduleExportFile {
  blob: Blob;
  result: DynamicScheduleExportResult;
}

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

function isWeekendOrHolidayPremium(
  slot: DynamicScheduleCalendarSlot,
  isHolidayDate: boolean,
): boolean {
  if (isHolidayDate || slot.holidayName?.trim()) return true;
  const day = new Date(`${slot.shiftDate}T12:00:00`).getDay();
  return day === 5 || day === 6;
}

function isNightSlot(slot: DynamicScheduleCalendarSlot): boolean {
  const start = timeToMinutes(slot.startTime);
  const end = timeToMinutes(slot.endTime);
  return end <= start || start >= 22 * 60;
}

function clearDataFill(cell: ExcelJS.Cell): void {
  cell.fill = { type: 'pattern', pattern: 'none' };
}

function applyPrimarySlotFill(
  worksheet: ExcelJS.Worksheet,
  row: number,
  slot: DynamicScheduleCalendarSlot | undefined,
  isHolidayDate: boolean,
): void {
  const cells = [worksheet.getCell(`C${row}`), worksheet.getCell(`D${row}`)];
  cells.forEach(clearDataFill);
  if (!slot) return;

  const fill: ExcelJS.Fill = slot.contains200Percent || isWeekendOrHolidayPremium(slot, isHolidayDate)
    ? { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFCE4D6' } }
    : isNightSlot(slot)
      ? { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9D9D9' } }
      : { type: 'pattern', pattern: 'none' };
  cells.forEach((cell) => { cell.fill = fill; });
}

async function loadTemplate(): Promise<ExcelJS.Workbook> {
  const response = await fetch(TEMPLATE_URL, { cache: 'no-store' });
  if (!response.ok) throw new Error('לא ניתן היה לטעון את תבנית קובץ האקסל.');

  const module = await import('exceljs');
  const workbook = new module.default.Workbook();
  await workbook.xlsx.load(await response.arrayBuffer());
  return workbook;
}

function clearTemplateValues(worksheet: ExcelJS.Worksheet): void {
  for (let row = FIRST_DATA_ROW; row <= LAST_TEMPLATE_ROW; row += 1) {
    for (let column = 1; column <= 8; column += 1) {
      worksheet.getCell(row, column).value = null;
    }
    for (let column = 3; column <= 8; column += 1) {
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

function createFileName(year: number, month: number): string {
  const monthName = hebrewMonths[month - 1] ?? padNumber(month);
  return `לוח שיבוצים ${monthName} ${padNumber(year % 100)}.xlsx`;
}

async function createWorkbookBlob(workbook: ExcelJS.Workbook): Promise<Blob> {
  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer as BlobPart], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

function downloadWorkbookBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function getWorkMode(jobType: {
  schedulingConfig?: { shiftPattern?: unknown } | null;
}): ScheduleFileJobTypeOption['workMode'] {
  const shiftPattern = jobType.schedulingConfig?.shiftPattern;
  if (!shiftPattern || typeof shiftPattern !== 'object') return 'unknown';
  const workMode = (shiftPattern as { workMode?: unknown }).workMode;
  if (workMode === 'shifts' || workMode === 'on_call_hourly' || workMode === 'on_call_daily') {
    return workMode;
  }
  return 'unknown';
}

function assertLayout(layout: ScheduleExcelLayout): void {
  const selected = [
    layout.morningRowJobTypeId,
    layout.eveningRowJobTypeId,
    layout.nightRowJobTypeId,
    layout.parallelMorningJobTypeId,
    layout.dailyJobTypeId,
  ].filter(Boolean);
  if (selected.length === 0) throw new Error('יש לבחור לפחות תפקיד אחד לייצוא.');
}

export const dynamicScheduleExportService = {
  async getJobTypeOptions(): Promise<ScheduleFileJobTypeOption[]> {
    const adminData = await dynamicSchedulingService.getAdminData();
    return adminData.jobTypes
      .filter((jobType) => jobType.isActive && !jobType.legacyRole)
      .map((jobType) => ({
        id: jobType.id,
        name: jobType.name,
        workMode: getWorkMode(jobType),
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'he'));
  },

  createDefaultLayout(options: ScheduleFileJobTypeOption[]): ScheduleExcelLayout {
    const shiftRoles = options.filter((option) => option.workMode === 'shifts');
    const nameHasMorning = (name: string): boolean => /בוקר|morning/i.test(name);
    const nameLooksDispatcher = (name: string): boolean => /מוקד|dispatcher|dispatch/i.test(name);
    const nameLooksOnCall = (name: string): boolean => /כונ|on.?call|duty/i.test(name);

    // Keep the exporter generic, but make the first-run defaults deterministic
    // when several morning roles exist. Prefer a morning shift/dispatcher role
    // for C+D row 1, and a morning on-call role for E+F. The user can override
    // every mapping in the UI and the UI persists that explicit selection.
    const morningRole = shiftRoles.find((option) => nameHasMorning(option.name) && nameLooksDispatcher(option.name))
      ?? shiftRoles.find((option) => nameHasMorning(option.name));

    const mainShiftRole = shiftRoles.find((option) => option.id !== morningRole?.id && nameLooksDispatcher(option.name) && !nameHasMorning(option.name))
      ?? shiftRoles.find((option) => option.id !== morningRole?.id && !nameHasMorning(option.name))
      ?? shiftRoles.find((option) => option.id !== morningRole?.id)
      ?? shiftRoles[0]
      ?? options[0];

    const parallelMorningRole = options.find((option) =>
      option.id !== morningRole?.id
      && option.id !== mainShiftRole?.id
      && option.workMode === 'on_call_hourly'
      && nameHasMorning(option.name)
      && nameLooksOnCall(option.name),
    ) ?? options.find((option) =>
      option.id !== morningRole?.id
      && option.id !== mainShiftRole?.id
      && option.workMode === 'on_call_hourly'
      && nameHasMorning(option.name),
    ) ?? options.find((option) =>
      option.id !== morningRole?.id
      && option.id !== mainShiftRole?.id
      && option.workMode === 'on_call_hourly',
    );

    const daily = options.find((option) =>
      option.id !== morningRole?.id
      && option.id !== mainShiftRole?.id
      && option.id !== parallelMorningRole?.id
      && option.workMode === 'on_call_daily',
    );

    return {
      morningRowJobTypeId: morningRole?.id ?? mainShiftRole?.id ?? null,
      eveningRowJobTypeId: mainShiftRole?.id ?? null,
      nightRowJobTypeId: mainShiftRole?.id ?? null,
      parallelMorningJobTypeId: parallelMorningRole?.id ?? null,
      dailyJobTypeId: daily?.id ?? null,
    };
  },

  async createMonthFile(
    year: number,
    month: number,
    layout: ScheduleExcelLayout,
  ): Promise<DynamicScheduleExportFile> {
    assertLayout(layout);

    if (!Number.isInteger(year) || year < 2020 || year > 2100 || !Number.isInteger(month) || month < 1 || month > 12) {
      throw new Error('החודש שנבחר לייצוא אינו תקין.');
    }

    const selectedJobTypeIds = Array.from(new Set([
      layout.morningRowJobTypeId,
      layout.eveningRowJobTypeId,
      layout.nightRowJobTypeId,
      layout.parallelMorningJobTypeId,
      layout.dailyJobTypeId,
    ].filter((value): value is string => Boolean(value))));

    // Export uses a dedicated raw publication workspace rather than the management
    // calendar. The management calendar intentionally de-duplicates logical cards
    // for display; that is useful on screen but can hide a concrete published slot
    // needed by the Excel mapping (especially a parallel morning role).
    const [workspace, workbook, calendarHolidays] = await Promise.all([
      dynamicSchedulingService.getScheduleExportWorkspace(year, month, selectedJobTypeIds),
      loadTemplate(),
      calendarHolidayService.getCalendarHolidays(year, month),
    ]);

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
        applyPrimarySlotFill(
          worksheet,
          row,
          primarySlot,
          (holidayNamesByDate.get(dateKey)?.length ?? 0) > 0,
        );
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

    const blob = await createWorkbookBlob(workbook);
    return {
      blob,
      result: {
        fileName: createFileName(year, month),
        year,
        month,
        primaryAssignments: countAssignments(primaryExportedSlots),
        parallelAssignments: countAssignments(parallelExportedSlots),
        dailyAssignments: countAssignments(Array.from(dailyByDate.values()).flat()),
      },
    };
  },

  async exportMonth(year: number, month: number, layout: ScheduleExcelLayout): Promise<DynamicScheduleExportResult> {
    const { blob, result } = await this.createMonthFile(year, month, layout);
    downloadWorkbookBlob(blob, result.fileName);
    return result;
  },
};
