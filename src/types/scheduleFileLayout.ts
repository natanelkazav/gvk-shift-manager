export type ScheduleFileMappingMode = 'slot_rows' | 'daily_span';

export interface ScheduleFileJobTypeOption {
  id: string;
  name: string;
  workMode: 'shifts' | 'on_call_hourly' | 'on_call_daily' | 'unknown';
}

export interface ScheduleExcelLayout {
  morningRowJobTypeId: string | null;
  eveningRowJobTypeId: string | null;
  nightRowJobTypeId: string | null;
  parallelMorningJobTypeId: string | null;
  dailyJobTypeId: string | null;
}

export interface ScheduleExcelLayoutPreviewColumn {
  column: string;
  header: string;
  purpose: string;
  mappedJobTypeId: string | null;
}

export const EMPTY_SCHEDULE_EXCEL_LAYOUT: ScheduleExcelLayout = {
  morningRowJobTypeId: null,
  eveningRowJobTypeId: null,
  nightRowJobTypeId: null,
  parallelMorningJobTypeId: null,
  dailyJobTypeId: null,
};
