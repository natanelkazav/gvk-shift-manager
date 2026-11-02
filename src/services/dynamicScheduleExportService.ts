import type ExcelJS from 'exceljs';
import { renderScheduleWorkbook } from './scheduleWorkbookRenderer';

import { calendarHolidayService } from './calendarHolidayService';
import { dynamicSchedulingService } from './dynamicSchedulingService';

import type {
  ScheduleExcelLayout,
  ScheduleFileJobTypeOption,
} from '../types/scheduleFileLayout';

const TEMPLATE_URL = '/templates/dynamic-schedule-layout-template.xlsx';
const hebrewMonths = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר',
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


function padNumber(value: number): string { return String(value).padStart(2, '0'); }
async function loadTemplate(): Promise<ExcelJS.Workbook> {
  const response = await fetch(TEMPLATE_URL, { cache: 'no-store' });
  if (!response.ok) throw new Error('לא ניתן היה לטעון את תבנית קובץ האקסל.');

  const module = await import('exceljs');
  const workbook = new module.default.Workbook();
  await workbook.xlsx.load(await response.arrayBuffer());
  return workbook;
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

    const counts = renderScheduleWorkbook(workbook, workspace, calendarHolidays, year, month, layout);

    const blob = await createWorkbookBlob(workbook);
    return {
      blob,
      result: {
        fileName: createFileName(year, month),
        year,
        month,
        primaryAssignments: counts.primaryAssignments,
        parallelAssignments: counts.parallelAssignments,
        dailyAssignments: counts.dailyAssignments,
      },
    };
  },

  async exportMonth(year: number, month: number, layout: ScheduleExcelLayout): Promise<DynamicScheduleExportResult> {
    const { blob, result } = await this.createMonthFile(year, month, layout);
    downloadWorkbookBlob(blob, result.fileName);
    return result;
  },
};
