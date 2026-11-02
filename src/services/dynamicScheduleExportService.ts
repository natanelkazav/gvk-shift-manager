/**
 * קובץ: src/services/dynamicScheduleExportService.ts
 * מטרה: ייצוא שיבוצים דינמיים תוך שימוש בהגדרות הפריסה של קובץ היעד.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: DynamicScheduleExportResult, DynamicScheduleExportFile, padNumber, loadTemplate, createFileName, createWorkbookBlob, downloadWorkbookBlob, getWorkMode, assertLayout.
 * - ריכוז פעולות העיבוד והחישוב בהתאם לפונקציות להלן.
 */
import type ExcelJS from 'exceljs';
import { renderScheduleWorkbook } from './scheduleWorkbookRenderer';

import { calendarHolidayService } from './calendarHolidayService';
import { dynamicSchedulingService } from './dynamicSchedulingService';

import type {
  ScheduleExcelLayout,
  ScheduleFileJobTypeOption,
} from '../types/scheduleFileLayout';

// TEMPLATE_URL — תבנית / כתובת יעד.
const TEMPLATE_URL = '/templates/dynamic-schedule-layout-template.xlsx';
// hebrewMonths — חודשים.
const hebrewMonths = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר',
];

/**
 * חוזה הנתונים DynamicScheduleExportResult: דינמי / שיבוץ / ייצוא / תוצאה.
 */
export interface DynamicScheduleExportResult {
  // fileName — קובץ / שם.
  fileName: string;
  // year — שנה.
  year: number;
  // month — חודש.
  month: number;
  // primaryAssignments — הקצאות.
  primaryAssignments: number;
  // parallelAssignments — הקצאות.
  parallelAssignments: number;
  // dailyAssignments — הקצאות.
  dailyAssignments: number;
}

/**
 * חוזה הנתונים DynamicScheduleExportFile: דינמי / שיבוץ / ייצוא / קובץ.
 */
export interface DynamicScheduleExportFile {
  blob: Blob;
  // result — תוצאה.
  result: DynamicScheduleExportResult;
}


/**
 * פעולה padNumber: הנתון padNumber בהקשר הפעולה.
 * @param value — ערך.
 * @returns string — הפלט בהתאם לחתימה.
 */
function padNumber(value: number): string { return String(value).padStart(2, '0'); }
/**
 * פעולה אסינכרונית loadTemplate: טעינת תבנית.
 * @returns Promise<ExcelJS.Workbook> — הפלט בהתאם לחתימה.
 */
async function loadTemplate(): Promise<ExcelJS.Workbook> {
  // response — תוצאת הפעולה.
  const response = await fetch(TEMPLATE_URL, { cache: 'no-store' });
  if (!response.ok) throw new Error('לא ניתן היה לטעון את תבנית קובץ האקסל.');

  const module = await import('exceljs');
  const workbook = new module.default.Workbook();
  await workbook.xlsx.load(await response.arrayBuffer());
  return workbook;
}

/**
 * פעולה createFileName: יצירת קובץ / שם.
 * @param year — שנה.
 * @param month — חודש.
 * @returns string — הפלט בהתאם לחתימה.
 */
function createFileName(year: number, month: number): string {
  // monthName — חודש / שם.
  const monthName = hebrewMonths[month - 1] ?? padNumber(month);
  return `לוח שיבוצים ${monthName} ${padNumber(year % 100)}.xlsx`;
}

/**
 * פעולה אסינכרונית createWorkbookBlob: יצירת הנתון createWorkbookBlob בהקשר הפעולה.
 * @param workbook — הנתון workbook בהקשר הפעולה.
 * @returns Promise<Blob> — הפלט בהתאם לחתימה.
 */
async function createWorkbookBlob(workbook: ExcelJS.Workbook): Promise<Blob> {
  // buffer — מאגר בינארי.
  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer as BlobPart], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

/**
 * פעולה downloadWorkbookBlob: הנתון downloadWorkbookBlob בהקשר הפעולה.
 * @param blob — הנתון blob בהקשר הפעולה.
 * @param fileName — קובץ / שם.
 * @returns void — הפלט בהתאם לחתימה.
 */
function downloadWorkbookBlob(blob: Blob, fileName: string): void {
  // url — כתובת יעד.
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

/**
 * פעולה getWorkMode: שליפה או חישוב של מצב פעולה.
 * @param jobType — סוג תפקיד.
 * @returns ScheduleFileJobTypeOption['workMode'] — הפלט בהתאם לחתימה.
 */
function getWorkMode(jobType: {
  // schedulingConfig — תצורה (אופציונלי).
  schedulingConfig?: { shiftPattern?: unknown } | null;
}): ScheduleFileJobTypeOption['workMode'] {
  // shiftPattern — משמרת.
  const shiftPattern = jobType.schedulingConfig?.shiftPattern;
  if (!shiftPattern || typeof shiftPattern !== 'object') return 'unknown';
  // workMode — מצב פעולה.
  const workMode = (shiftPattern as { workMode?: unknown }).workMode;
  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר workMode === 'shifts' || workMode === 'on_call_hourly' || workMode === 'on_call_daily'.
  if (workMode === 'shifts' || workMode === 'on_call_hourly' || workMode === 'on_call_daily') {
    return workMode;
  }
  return 'unknown';
}

/**
 * פעולה assertLayout: פריסת מסך.
 * @param layout — פריסת מסך.
 * @returns void — הפלט בהתאם לחתימה.
 */
function assertLayout(layout: ScheduleExcelLayout): void {
  // selected — נבחר.
  const selected = [
    layout.morningRowJobTypeId,
    layout.eveningRowJobTypeId,
    layout.nightRowJobTypeId,
    layout.parallelMorningJobTypeId,
    layout.dailyJobTypeId,
  ].filter(Boolean);
  if (selected.length === 0) throw new Error('יש לבחור לפחות תפקיד אחד לייצוא.');
}

// dynamicScheduleExportService — דינמי / שיבוץ / ייצוא / שירות.
export const dynamicScheduleExportService = {
  /**
   * פעולה אסינכרונית getJobTypeOptions: שליפה או חישוב של סוג תפקיד.
   * @returns Promise<ScheduleFileJobTypeOption[]> — הפלט בהתאם לחתימה.
   */
  async getJobTypeOptions(): Promise<ScheduleFileJobTypeOption[]> {
    // adminData — נתונים.
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

  /**
   * פעולה createDefaultLayout: יצירת פריסת מסך.
   * @param options — אפשרויות בחירה.
   * @returns ScheduleExcelLayout — הפלט בהתאם לחתימה.
   */
  createDefaultLayout(options: ScheduleFileJobTypeOption[]): ScheduleExcelLayout {
    // shiftRoles — משמרת.
    const shiftRoles = options.filter((option) => option.workMode === 'shifts');
    /**
     * פעולה nameHasMorning: שם.
     * @param name — שם.
     * @returns boolean — הפלט בהתאם לחתימה.
     */
    const nameHasMorning = (name: string): boolean => /בוקר|morning/i.test(name);
    /**
     * פעולה nameLooksDispatcher: שם / מוקדנים.
     * @param name — שם.
     * @returns boolean — הפלט בהתאם לחתימה.
     */
    const nameLooksDispatcher = (name: string): boolean => /מוקד|dispatcher|dispatch/i.test(name);
    /**
     * פעולה nameLooksOnCall: שם.
     * @param name — שם.
     * @returns boolean — הפלט בהתאם לחתימה.
     */
    const nameLooksOnCall = (name: string): boolean => /כונ|on.?call|duty/i.test(name);

    // Keep the exporter generic, but make the first-run defaults deterministic
    // when several morning roles exist. Prefer a morning shift/dispatcher role
    // for C+D row 1, and a morning on-call role for E+F. The user can override
    // every mapping in the UI and the UI persists that explicit selection.
    const morningRole = shiftRoles.find((option) => nameHasMorning(option.name) && nameLooksDispatcher(option.name))
      ?? shiftRoles.find((option) => nameHasMorning(option.name));

    // mainShiftRole — משמרת.
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

  /**
   * פעולה אסינכרונית createMonthFile: יצירת חודש / קובץ.
   * @param year — שנה.
   * @param month — חודש.
   * @param layout — פריסת מסך.
   * @returns Promise<DynamicScheduleExportFile> — הפלט בהתאם לחתימה.
   */
  async createMonthFile(
    year: number,
    month: number,
    layout: ScheduleExcelLayout,
  ): Promise<DynamicScheduleExportFile> {
    assertLayout(layout);

    // עצירת הפעולה עם שגיאה כאשר !Number.isInteger(year) || year < 2020 || year > 2100 || !Number.isInteger(month) || month < 1 || month > 12.
    if (!Number.isInteger(year) || year < 2020 || year > 2100 || !Number.isInteger(month) || month < 1 || month > 12) {
      throw new Error('החודש שנבחר לייצוא אינו תקין.');
    }

    // selectedJobTypeIds — מזהה סוג התפקיד.
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

  /**
   * פעולה אסינכרונית exportMonth: ייצוא ייצוא / חודש.
   * @param year — שנה.
   * @param month — חודש.
   * @param layout — פריסת מסך.
   * @returns Promise<DynamicScheduleExportResult> — הפלט בהתאם לחתימה.
   */
  async exportMonth(year: number, month: number, layout: ScheduleExcelLayout): Promise<DynamicScheduleExportResult> {
    // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
    const { blob, result } = await this.createMonthFile(year, month, layout);
    downloadWorkbookBlob(blob, result.fileName);
    return result;
  },
};
