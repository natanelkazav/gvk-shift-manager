/**
 * קובץ: src/services/scheduleExportLayoutSettingsService.ts
 * מטרה: טעינה ושמירה של הגדרות פריסת ייצוא ושל תמונות מצב חודשיות של הפריסה.
 * מטרות עיקריות:
 * - קריאות RPC המופעלות בקובץ: get_schedule_excel_export_layout, save_schedule_excel_export_layout, get_schedule_excel_export_month_snapshot, approve_schedule_excel_export_month_snapshot.
 * - ריכוז הפנייה למקור הנתונים ועיבוד התשובה בהתאם לפונקציות להלן.
 */
import { supabase } from '../lib/supabase';
import type { ScheduleExcelLayout } from '../types/scheduleFileLayout';

// scheduleExportLayoutSettingsService — שיבוץ / ייצוא / פריסת מסך / הגדרות.
export const scheduleExportLayoutSettingsService = {
  /**
   * פעולה אסינכרונית load: טעינת הנתון load בהקשר הפעולה.
   * הפעולה פונה ל־RPC: get_schedule_excel_export_layout.
   * @returns Promise<ScheduleExcelLayout | null> — הפלט בהתאם לחתימה.
   */
  async load(): Promise<ScheduleExcelLayout | null> {
    // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
    const { data, error } = await supabase.rpc('get_schedule_excel_export_layout');
    if (error) throw error;
    return data as ScheduleExcelLayout | null;
  },
  /**
   * פעולה אסינכרונית save: שמירת הנתון save בהקשר הפעולה.
   * הפעולה פונה ל־RPC: save_schedule_excel_export_layout.
   * @param layout — פריסת מסך.
   * @returns Promise<void> — הפלט בהתאם לחתימה.
   */
  async save(layout: ScheduleExcelLayout): Promise<void> {
    // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
    const { error } = await supabase.rpc('save_schedule_excel_export_layout', { p_layout: layout });
    if (error) throw error;
  },
  /**
   * פעולה אסינכרונית loadMonthlySnapshot: טעינת הנתון loadMonthlySnapshot בהקשר הפעולה.
   * הפעולה פונה ל־RPC: get_schedule_excel_export_month_snapshot.
   * @param year — שנה.
   * @param month — חודש.
   * @returns Promise<ScheduleExcelLayout | null> — הפלט בהתאם לחתימה.
   */
  async loadMonthlySnapshot(year: number, month: number): Promise<ScheduleExcelLayout | null> {
    // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
    const { data, error } = await supabase.rpc('get_schedule_excel_export_month_snapshot', { p_year: year, p_month: month });
    if (error) throw error;
    return data as ScheduleExcelLayout | null;
  },
  /**
   * פעולה אסינכרונית approveMonthlySnapshot: אישור הנתון approveMonthlySnapshot בהקשר הפעולה.
   * הפעולה פונה ל־RPC: approve_schedule_excel_export_month_snapshot.
   * @param year — שנה.
   * @param month — חודש.
   * @param layout — פריסת מסך.
   * @returns Promise<ScheduleExcelLayout> — הפלט בהתאם לחתימה.
   */
  async approveMonthlySnapshot(year: number, month: number, layout: ScheduleExcelLayout): Promise<ScheduleExcelLayout> {
    // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
    const { data, error } = await supabase.rpc('approve_schedule_excel_export_month_snapshot', {
      p_year: year, p_month: month, p_layout: layout,
    });
    if (error) throw error;
    return data as ScheduleExcelLayout;
  },
};
