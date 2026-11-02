/**
 * קובץ: src/services/dynamicPilotQaService.ts
 * מטרה: הרצת בדיקות פיילוט והשוואות למנגנון השיבוץ הדינמי.
 * מטרות עיקריות:
 * - קריאות RPC המופעלות בקובץ: get_dynamic_pilot_qa_report.
 * - ריכוז הפנייה למקור הנתונים ועיבוד התשובה בהתאם לפונקציות להלן.
 */
import { supabase } from '../lib/supabase';
import { PerformanceDebugService } from './performanceDebugService';
import type { DynamicPilotQaReport } from '../types/dynamicPilotQa';

// dynamicPilotQaService — דינמי / שירות.
export const dynamicPilotQaService = {
  /**
   * פעולה getReport: שליפה או חישוב של דוח.
   * @returns Promise<DynamicPilotQaReport> — הפלט בהתאם לחתימה.
   */
  getReport(): Promise<DynamicPilotQaReport> {
    return PerformanceDebugService.measureAsync('dynamic-pilot-qa.get-report', async () => {
      // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
      const { data, error } = await supabase.rpc('get_dynamic_pilot_qa_report');
      // עצירת הפעולה עם שגיאה כאשר error.
      if (error) {
        console.error('Dynamic pilot QA report Supabase error:', error);
        throw new Error(`${error.message}${error.code ? ` | Code: ${error.code}` : ''}`);
      }
      return data as DynamicPilotQaReport;
    });
  },
};
