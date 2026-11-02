/**
 * קובץ: src/services/dynamicRuntimeService.ts
 * מטרה: טעינת סביבת העבודה הדינמית והפעלת פעולות זמינות ושיבוץ לפי סוג התפקיד.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: SupabaseErrorShape, normalizeError.
 * - קריאות RPC המופעלות בקובץ: get_my_dynamic_runtime_context.
 * - ריכוז הפנייה למקור הנתונים ועיבוד התשובה בהתאם לפונקציות להלן.
 */
import { supabase } from '../lib/supabase';
import { PerformanceDebugService } from './performanceDebugService';
import type { DynamicRuntimeContext } from '../types/dynamicRuntime';

/**
 * חוזה הנתונים SupabaseErrorShape: שגיאה.
 */
interface SupabaseErrorShape {
  // message — הודעה (אופציונלי).
  message?: unknown;
  details?: unknown;
  hint?: unknown;
  code?: unknown;
}

/**
 * פעולה normalizeError: נרמול שגיאה.
 * @param error — שגיאה.
 * @returns Error — הפלט בהתאם לחתימה.
 */
function normalizeError(error: unknown): Error {
  if (error instanceof Error) return error;

  if (typeof error === 'object' && error !== null) {
    // databaseError — שגיאה.
    const databaseError = error as SupabaseErrorShape;
    const parts = [
      typeof databaseError.message === 'string' ? databaseError.message : null,
      typeof databaseError.details === 'string' ? databaseError.details : null,
      typeof databaseError.hint === 'string' ? `Hint: ${databaseError.hint}` : null,
      typeof databaseError.code === 'string' ? `Code: ${databaseError.code}` : null,
    ].filter((part): part is string => Boolean(part));

    if (parts.length > 0) return new Error(parts.join(' | '));
  }

  return new Error('לא ניתן היה לטעון את סביבת העבודה הדינמית.');
}

// dynamicRuntimeService — דינמי / שירות.
export const dynamicRuntimeService = {
  /**
   * פעולה אסינכרונית getMyRuntimeContext: שליפה או חישוב של הנתון getMyRuntimeContext בהקשר הפעולה.
   * @returns Promise<DynamicRuntimeContext> — הפלט בהתאם לחתימה.
   */
  async getMyRuntimeContext(): Promise<DynamicRuntimeContext> {
    return PerformanceDebugService.measureAsync(
      'dynamic-scheduling.phase8.7.runtime-context',
      async () => {
        // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
        const { data, error } = await supabase.rpc('get_my_dynamic_runtime_context');
        if (error) throw normalizeError(error);
        return data as DynamicRuntimeContext;
      },
    );
  },
};
