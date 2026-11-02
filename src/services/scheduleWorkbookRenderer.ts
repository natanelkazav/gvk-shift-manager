/**
 * קובץ: src/services/scheduleWorkbookRenderer.ts
 * מטרה: רינדור נתוני שיבוץ לתאים ולטבלאות בחוברת Excel.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: padNumber, createDateKey, getDaysInMonth, normalizeTime, timeToMinutes, getInterval, overlapMinutes, circularMinuteDistance, sortSlots, assignmentNames ועוד.
 * - ריכוז פעולות העיבוד והחישוב בהתאם לפונקציות להלן.
 */
import type ExcelJS from 'exceljs';
import type { DynamicScheduleCalendarSlot, DynamicScheduleCalendarWorkspace } from '../types/dynamicShiftsWorkspace';
import type { ScheduleExcelLayout } from '../types/scheduleFileLayout';

// FIRST_DATA_ROW — נתונים / שורה.
const FIRST_DATA_ROW = 2;
// ROWS_PER_DAY — שורות / יום.
const ROWS_PER_DAY = 3;
// MAX_DAYS — ימים.
const MAX_DAYS = 31;
// LAST_TEMPLATE_ROW — תבנית / שורה.
const LAST_TEMPLATE_ROW = FIRST_DATA_ROW + MAX_DAYS * ROWS_PER_DAY - 1;
// ROW_TARGET_STARTS — שורה / יעד.
const ROW_TARGET_STARTS = [8 * 60, 16 * 60, 23 * 60] as const;
// hebrewWeekdays — הנתון hebrewWeekdays בהקשר הפעולה.
const hebrewWeekdays = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

/**
 * פעולה padNumber: הנתון padNumber בהקשר הפעולה.
 * @param value — ערך.
 * @returns string — הפלט בהתאם לחתימה.
 */
function padNumber(value: number): string {
  return String(value).padStart(2, '0');
}

/**
 * פעולה createDateKey: יצירת תאריך / מפתח.
 * @param year — שנה.
 * @param month — חודש.
 * @param day — יום.
 * @returns string — הפלט בהתאם לחתימה.
 */
function createDateKey(year: number, month: number, day: number): string {
  return `${year}-${padNumber(month)}-${padNumber(day)}`;
}

/**
 * פעולה getDaysInMonth: שליפה או חישוב של ימים / חודש.
 * @param year — שנה.
 * @param month — חודש.
 * @returns number — הפלט בהתאם לחתימה.
 */
function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/**
 * פעולה normalizeTime: נרמול זמן.
 * @param value — ערך.
 * @returns string — הפלט בהתאם לחתימה.
 */
function normalizeTime(value: string): string {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})/);
  if (!match) return value.trim();
  return `${padNumber(Number(match[1]))}:${match[2]}`;
}

/**
 * פעולה timeToMinutes: זמן / דקות.
 * @param value — ערך.
 * @returns number — הפלט בהתאם לחתימה.
 */
function timeToMinutes(value: string): number {
  // normalized — הנתון normalized בהקשר הפעולה.
  const normalized = normalizeTime(value);
  const match = normalized.match(/^(\d{2}):(\d{2})$/);
  if (!match) return 0;
  return Number(match[1]) * 60 + Number(match[2]);
}

/**
 * פעולה getInterval: שליפה או חישוב של מרווח זמן.
 * @param slot — הנתון slot בהקשר הפעולה.
 * @returns { start: number; end: number } — הפלט בהתאם לחתימה.
 */
function getInterval(slot: DynamicScheduleCalendarSlot): { start: number; end: number } {
  const start = timeToMinutes(slot.startTime);
  let end = timeToMinutes(slot.endTime);
  if (end <= start) end += 24 * 60;
  return { start, end };
}

/**
 * פעולה overlapMinutes: דקות.
 * @param a — הנתון a בהקשר הפעולה.
 * @param b — הנתון b בהקשר הפעולה.
 * @returns number — הפלט בהתאם לחתימה.
 */
function overlapMinutes(a: DynamicScheduleCalendarSlot, b: DynamicScheduleCalendarSlot): number {
  const first = getInterval(a);
  const second = getInterval(b);
  const start = Math.max(first.start, second.start);
  const end = Math.min(first.end, second.end);
  return Math.max(0, end - start);
}

/**
 * פעולה circularMinuteDistance: הנתון circularMinuteDistance בהקשר הפעולה.
 * @param first — הנתון first בהקשר הפעולה.
 * @param second — הנתון second בהקשר הפעולה.
 * @returns number — הפלט בהתאם לחתימה.
 */
function circularMinuteDistance(first: number, second: number): number {
  const distance = Math.abs(first - second);
  return Math.min(distance, 24 * 60 - distance);
}

/**
 * פעולה sortSlots: מיון הנתון sortSlots בהקשר הפעולה.
 * @param slots — הנתון slots בהקשר הפעולה.
 * @returns DynamicScheduleCalendarSlot[] — הפלט בהתאם לחתימה.
 */
function sortSlots(slots: DynamicScheduleCalendarSlot[]): DynamicScheduleCalendarSlot[] {
  return [...slots].sort((a, b) => {
    const startDelta = timeToMinutes(a.startTime) - timeToMinutes(b.startTime);
    if (startDelta !== 0) return startDelta;
    return a.shiftName.localeCompare(b.shiftName, 'he');
  });
}

/**
 * פעולה assignmentNames: הקצאה.
 * @param slot — הנתון slot בהקשר הפעולה.
 * @returns string | null — הפלט בהתאם לחתימה.
 */
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

/**
 * פעולה countAssignments: כמות / הקצאות.
 * @param slots — הנתון slots בהקשר הפעולה.
 * @returns number — הפלט בהתאם לחתימה.
 */
function countAssignments(slots: DynamicScheduleCalendarSlot[]): number {
  return slots.reduce((sum, slot) => sum + slot.assignments.length, 0);
}

/**
 * פעולה groupByDate: קיבוץ קבוצה / תאריך.
 * @param workspace — הנתון workspace בהקשר הפעולה.
 * @param jobTypeId — מזהה סוג התפקיד.
 * @returns Map<string, DynamicScheduleCalendarSlot[]> — הפלט בהתאם לחתימה.
 */
function groupByDate(
  workspace: DynamicScheduleCalendarWorkspace,
  jobTypeId: string | null,
): Map<string, DynamicScheduleCalendarSlot[]> {
  // result — תוצאה; מיפוי לחיפוש לפי מפתח.
  const result = new Map<string, DynamicScheduleCalendarSlot[]>();
  if (!jobTypeId) return result;

  workspace.slots
    .filter((slot) => slot.jobTypeId === jobTypeId)
    .forEach((slot) => {
      // current — הנתון current בהקשר הפעולה.
      const current = result.get(slot.shiftDate) ?? [];
      current.push(slot);
      result.set(slot.shiftDate, current);
    });

  result.forEach((slots, date) => result.set(date, sortSlots(slots)));
  return result;
}

/**
 * פעולה getRoleSlotsForDate: שליפה או חישוב של תאריך.
 * @param workspace — הנתון workspace בהקשר הפעולה.
 * @param jobTypeId — מזהה סוג התפקיד.
 * @param dateKey — תאריך / מפתח.
 * @returns DynamicScheduleCalendarSlot[] — הפלט בהתאם לחתימה.
 */
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

/**
 * פעולה slotContainsTargetMinute: יעד.
 * @param slot — הנתון slot בהקשר הפעולה.
 * @param targetMinute — יעד.
 * @returns boolean — הפלט בהתאם לחתימה.
 */
function slotContainsTargetMinute(slot: DynamicScheduleCalendarSlot, targetMinute: number): boolean {
  // interval — מרווח זמן.
  const interval = getInterval(slot);
  const candidates = [targetMinute, targetMinute + 24 * 60];
  return candidates.some((candidate) => candidate >= interval.start && candidate < interval.end);
}

/**
 * פעולה selectClosestUnusedSlot: בחירת הנתון selectClosestUnusedSlot בהקשר הפעולה.
 * @param slots — הנתון slots בהקשר הפעולה.
 * @param usedSlotKeys — הנתון usedSlotKeys בהקשר הפעולה.
 * @param targetStart — יעד.
 * @returns DynamicScheduleCalendarSlot | undefined — הפלט בהתאם לחתימה.
 */
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

/**
 * פעולה getSlotKey: שליפה או חישוב של מפתח.
 * @param slot — הנתון slot בהקשר הפעולה.
 * @returns string — הפלט בהתאם לחתימה.
 */
function getSlotKey(slot: DynamicScheduleCalendarSlot): string {
  return `${slot.jobTypeId}:${slot.sourcePeriodId}:${slot.sourceSlotId ?? slot.shiftCode}:${slot.shiftDate}`;
}

/**
 * פעולה getPrimaryRoleCandidates: שליפה או חישוב של הנתון getPrimaryRoleCandidates בהקשר הפעולה.
 * @param layout — פריסת מסך.
 * @param rowOffset — שורה / מיקום תחילת התוצאות.
 * @returns Array<string | null> — הפלט בהתאם לחתימה.
 */
function getPrimaryRoleCandidates(
  layout: ScheduleExcelLayout,
  rowOffset: number,
): Array<string | null> {
  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר rowOffset === 0.
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

/**
 * פעולה mapPrimaryRows: מיפוי מפת התאמה / שורות.
 * @param workspace — הנתון workspace בהקשר הפעולה.
 * @param dateKey — תאריך / מפתח.
 * @param layout — פריסת מסך.
 * @returns Array<DynamicScheduleCalendarSlot | undefined> — הפלט בהתאם לחתימה.
 */
function mapPrimaryRows(
  workspace: DynamicScheduleCalendarWorkspace,
  dateKey: string,
  layout: ScheduleExcelLayout,
): Array<DynamicScheduleCalendarSlot | undefined> {
  const used = new Set<string>();

  return ROW_TARGET_STARTS.map((targetStart, rowOffset) => {
    const roleCandidates = getPrimaryRoleCandidates(layout, rowOffset);

    // עיבוד כל פריט מתוך roleCandidates בנפרד.
    for (const jobTypeId of roleCandidates) {
      const slot = selectClosestUnusedSlot(
        getRoleSlotsForDate(workspace, jobTypeId, dateKey),
        used,
        targetStart,
      );
      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר slot.
      if (slot) {
        used.add(getSlotKey(slot));
        return slot;
      }
    }

    return undefined;
  });
}

/**
 * פעולה mostCommonRangeForRoleAndRow: שורה.
 * @param workspace — הנתון workspace בהקשר הפעולה.
 * @param jobTypeId — מזהה סוג התפקיד.
 * @param targetStart — יעד.
 * @returns string | null — הפלט בהתאם לחתימה.
 */
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

/**
 * פעולה resolvePrimaryRowHours: קביעת ערך עבור שורה / שעות.
 * @param workspace — הנתון workspace בהקשר הפעולה.
 * @param layout — פריסת מסך.
 * @param rowOffset — שורה / מיקום תחילת התוצאות.
 * @param slot — הנתון slot בהקשר הפעולה.
 * @returns string | null — הפלט בהתאם לחתימה.
 */
function resolvePrimaryRowHours(
  workspace: DynamicScheduleCalendarWorkspace,
  layout: ScheduleExcelLayout,
  rowOffset: number,
  slot: DynamicScheduleCalendarSlot | undefined,
): string | null {
  if (slot) return `${normalizeTime(slot.startTime)}-${normalizeTime(slot.endTime)}`;

  // targetStart — יעד.
  const targetStart = ROW_TARGET_STARTS[rowOffset];
  // עיבוד כל פריט מתוך getPrimaryRoleCandidates(layout, rowOffset) בנפרד.
  for (const jobTypeId of getPrimaryRoleCandidates(layout, rowOffset)) {
    const fallback = mostCommonRangeForRoleAndRow(workspace, jobTypeId, targetStart);
    if (fallback) return fallback;
  }

  return null;
}

/**
 * פעולה selectMorningParallelSlot: בחירת הנתון selectMorningParallelSlot בהקשר הפעולה.
 * @param morningPrimary — הנתון morningPrimary בהקשר הפעולה.
 * @param parallelSlots — הנתון parallelSlots בהקשר הפעולה.
 * @returns DynamicScheduleCalendarSlot | undefined — הפלט בהתאם לחתימה.
 */
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

/**
 * פעולה buildDayRemarks: הרכבת יום.
 * @param slots — הנתון slots בהקשר הפעולה.
 * @returns string | null — הפלט בהתאם לחתימה.
 */
function buildDayRemarks(slots: Array<DynamicScheduleCalendarSlot | undefined>): string | null {
  // holidayNames — חג.
  const holidayNames = Array.from(
    new Set(
      slots
        .map((slot) => slot?.holidayName?.trim())
        .filter((value): value is string => Boolean(value)),
    ),
  );
  return holidayNames.length > 0 ? holidayNames.join(' / ') : null;
}

/**
 * פעולה clearDataFill: נתונים.
 * @param cell — הנתון cell בהקשר הפעולה.
 * @returns void — הפלט בהתאם לחתימה.
 */
function clearDataFill(cell: ExcelJS.Cell): void {
  // The supplied workbook contains orange/grey fills in C, E, F and G.
  // Do not inherit template fills or infer premium pay from their colors.
  cell.fill = { type: 'pattern', pattern: 'none' };
}


/**
 * פעולה clearTemplateValues: תבנית / ערכים.
 * @param worksheet — הנתון worksheet בהקשר הפעולה.
 * @returns void — הפלט בהתאם לחתימה.
 */
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

/**
 * פעולה setExportDate: קביעת קבוצה ייחודית / ייצוא / תאריך.
 * @param worksheet — הנתון worksheet בהקשר הפעולה.
 * @param address — הנתון address בהקשר הפעולה.
 * @param year — שנה.
 * @param month — חודש.
 * @param day — יום.
 * @returns void — הפלט בהתאם לחתימה.
 */
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

/**
 * פעולה hideUnusedRows: שורות.
 * @param worksheet — הנתון worksheet בהקשר הפעולה.
 * @param daysInMonth — ימים / חודש.
 * @returns void — הפלט בהתאם לחתימה.
 */
function hideUnusedRows(worksheet: ExcelJS.Worksheet, daysInMonth: number): void {
  // firstUnusedRow — שורה.
  const firstUnusedRow = FIRST_DATA_ROW + daysInMonth * ROWS_PER_DAY;
  for (let row = FIRST_DATA_ROW; row <= LAST_TEMPLATE_ROW; row += 1) {
    worksheet.getRow(row).hidden = row >= firstUnusedRow;
  }
}

/**
 * פעולה applyWorksheetPresentation: החלת הנתון applyWorksheetPresentation בהקשר הפעולה.
 * @param worksheet — הנתון worksheet בהקשר הפעולה.
 * @returns void — הפלט בהתאם לחתימה.
 */
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

/**
 * חוזה הנתונים ScheduleWorkbookRenderResult: שיבוץ / תוצאה.
 */
export interface ScheduleWorkbookRenderResult {
  // primaryAssignments — הקצאות.
  primaryAssignments: number;
  // parallelAssignments — הקצאות.
  parallelAssignments: number;
  // dailyAssignments — הקצאות.
  dailyAssignments: number;
}

/** Pure workbook renderer: no fetch, DOM, Supabase, or mail transport. */
/**
 * פעולה renderScheduleWorkbook: בניית תצוגה עבור שיבוץ.
 * @param workbook — הנתון workbook בהקשר הפעולה.
 * @param workspace — הנתון workspace בהקשר הפעולה.
 * @param calendarHolidays — לוח שנה / חגים.
 * @param year — שנה.
 * @param month — חודש.
 * @param layout — פריסת מסך.
 * @returns ScheduleWorkbookRenderResult — הפלט בהתאם לחתימה.
 */
export function renderScheduleWorkbook(
  workbook: ExcelJS.Workbook,
  workspace: DynamicScheduleCalendarWorkspace,
  calendarHolidays: Array<{ date: string; name: string }>,
  year: number,
  month: number,
  layout: ScheduleExcelLayout,
): ScheduleWorkbookRenderResult {
    // holidayNamesByDate — חג / תאריך; מיפוי לחיפוש לפי מפתח.
    const holidayNamesByDate = new Map<string, string[]>();
    calendarHolidays.forEach((holiday) => {
      // current — הנתון current בהקשר הפעולה.
      const current = holidayNamesByDate.get(holiday.date) ?? [];
      if (holiday.name && !current.includes(holiday.name)) current.push(holiday.name);
      holidayNamesByDate.set(holiday.date, current);
    });

    const worksheet = workbook.worksheets[0];
    if (!worksheet) throw new Error('לא נמצא גיליון בתבנית הייצוא.');

    // parallelByDate — תאריך.
    const parallelByDate = groupByDate(workspace, layout.parallelMorningJobTypeId);
    // dailyByDate — תאריך.
    const dailyByDate = groupByDate(workspace, layout.dailyJobTypeId);

    clearTemplateValues(worksheet);
    applyWorksheetPresentation(worksheet);

    const primaryExportedSlots: DynamicScheduleCalendarSlot[] = [];
    const parallelExportedSlots: DynamicScheduleCalendarSlot[] = [];
    // daysInMonth — ימים / חודש.
    const daysInMonth = getDaysInMonth(year, month);
    for (let day = 1; day <= daysInMonth; day += 1) {
      // date — תאריך.
      const date = new Date(year, month - 1, day, 12, 0, 0, 0);
      // dateKey — תאריך / מפתח.
      const dateKey = createDateKey(year, month, day);
      // firstRow — שורה.
      const firstRow = FIRST_DATA_ROW + (day - 1) * ROWS_PER_DAY;
      // primaryRows — שורות.
      const primaryRows = mapPrimaryRows(workspace, dateKey, layout);
      const parallelSlots = parallelByDate.get(dateKey) ?? [];
      const dailySlots = dailyByDate.get(dateKey) ?? [];
      const parallelMorningSlot = selectMorningParallelSlot(primaryRows[0], parallelSlots);

      setExportDate(worksheet, `A${firstRow}`, year, month, day);
      worksheet.getCell(`B${firstRow}`).value = hebrewWeekdays[date.getDay()] ?? '';

      for (let rowOffset = 0; rowOffset < ROWS_PER_DAY; rowOffset += 1) {
        // row — שורה.
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

      // explicitHolidayNames — חג.
      const explicitHolidayNames = holidayNamesByDate.get(dateKey) ?? [];
      // slotHolidayRemarks — חג.
      const slotHolidayRemarks = buildDayRemarks([
        ...primaryRows,
        parallelMorningSlot,
        ...dailySlots,
      ]);
      // dayRemarks — יום.
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
