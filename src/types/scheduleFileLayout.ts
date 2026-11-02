/**
 * קובץ: src/types/scheduleFileLayout.ts
 * מטרה: הגדרת טיפוסים וחוזי נתונים עבור שיבוץ / קובץ / פריסת מסך.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: ScheduleFileMappingMode, ScheduleFileJobTypeOption, ScheduleExcelLayout, ScheduleExcelLayoutPreviewColumn.
 * - תיאור מבנה הקלט והפלט לבדיקת טיפוסים בזמן פיתוח.
 */
/**
 * טיפוס ScheduleFileMappingMode: שיבוץ / קובץ / מצב פעולה.
 */
export type ScheduleFileMappingMode = 'slot_rows' | 'daily_span';

/**
 * חוזה הנתונים ScheduleFileJobTypeOption: סוג תפקיד.
 */
export interface ScheduleFileJobTypeOption {
  // id — מזהה.
  id: string;
  // name — שם.
  name: string;
  // workMode — מצב פעולה.
  workMode: 'shifts' | 'on_call_hourly' | 'on_call_daily' | 'unknown';
}

/**
 * חוזה הנתונים ScheduleExcelLayout: שיבוץ / Excel / פריסת מסך.
 */
export interface ScheduleExcelLayout {
  // morningRowJobTypeId — מזהה סוג התפקיד.
  morningRowJobTypeId: string | null;
  // eveningRowJobTypeId — מזהה סוג התפקיד.
  eveningRowJobTypeId: string | null;
  // nightRowJobTypeId — מזהה סוג התפקיד.
  nightRowJobTypeId: string | null;
  // parallelMorningJobTypeId — מזהה סוג התפקיד.
  parallelMorningJobTypeId: string | null;
  // dailyJobTypeId — מזהה סוג התפקיד.
  dailyJobTypeId: string | null;
}

/**
 * חוזה הנתונים ScheduleExcelLayoutPreviewColumn: שיבוץ / Excel / פריסת מסך.
 */
export interface ScheduleExcelLayoutPreviewColumn {
  column: string;
  header: string;
  purpose: string;
  // mappedJobTypeId — מזהה סוג התפקיד.
  mappedJobTypeId: string | null;
}

// EMPTY_SCHEDULE_EXCEL_LAYOUT — שיבוץ / Excel / פריסת מסך.
export const EMPTY_SCHEDULE_EXCEL_LAYOUT: ScheduleExcelLayout = {
  morningRowJobTypeId: null,
  eveningRowJobTypeId: null,
  nightRowJobTypeId: null,
  parallelMorningJobTypeId: null,
  dailyJobTypeId: null,
};
