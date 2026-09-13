import { supabase } from '../lib/supabase';
import { PerformanceDebugService } from './performanceDebugService';
import type { DynamicPilotQaReport } from '../types/dynamicPilotQa';

export const dynamicPilotQaService = {
  getReport(): Promise<DynamicPilotQaReport> {
    return PerformanceDebugService.measureAsync('dynamic-pilot-qa.get-report', async () => {
      const { data, error } = await supabase.rpc('get_dynamic_pilot_qa_report');
      if (error) {
        console.error('Dynamic pilot QA report Supabase error:', error);
        throw new Error(`${error.message}${error.code ? ` | Code: ${error.code}` : ''}`);
      }
      return data as DynamicPilotQaReport;
    });
  },
};
