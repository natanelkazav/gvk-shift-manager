import { supabase } from '../lib/supabase';
import type { ScheduleExcelLayout } from '../types/scheduleFileLayout';

export const scheduleExportLayoutSettingsService = {
  async load(): Promise<ScheduleExcelLayout | null> {
    const { data, error } = await supabase.rpc('get_schedule_excel_export_layout');
    if (error) throw error;
    return data as ScheduleExcelLayout | null;
  },
  async save(layout: ScheduleExcelLayout): Promise<void> {
    const { error } = await supabase.rpc('save_schedule_excel_export_layout', { p_layout: layout });
    if (error) throw error;
  },
  async loadMonthlySnapshot(year: number, month: number): Promise<ScheduleExcelLayout | null> {
    const { data, error } = await supabase.rpc('get_schedule_excel_export_month_snapshot', { p_year: year, p_month: month });
    if (error) throw error;
    return data as ScheduleExcelLayout | null;
  },
  async approveMonthlySnapshot(year: number, month: number, layout: ScheduleExcelLayout): Promise<ScheduleExcelLayout> {
    const { data, error } = await supabase.rpc('approve_schedule_excel_export_month_snapshot', {
      p_year: year, p_month: month, p_layout: layout,
    });
    if (error) throw error;
    return data as ScheduleExcelLayout;
  },
};
