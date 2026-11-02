/**
 * קובץ: src/services/gvkLegacyMigrationService.ts
 * מטרה: הפעלת תהליכי מעבר מנתוני המערכת הוותיקה למבנה הדינמי.
 * מטרות עיקריות:
 * - קריאות RPC המופעלות בקובץ: preview_gvk_legacy_migration, run_gvk_legacy_migration.
 * - ריכוז הפנייה למקור הנתונים ועיבוד התשובה בהתאם לפונקציות להלן.
 */
import { supabase } from '../lib/supabase';
import { PerformanceDebugService } from './performanceDebugService';
import type {
  GvkLegacyMigrationMappings,
  GvkLegacyMigrationPreview,
  GvkLegacyMigrationResult,
} from '../types/gvkLegacyMigration';

/**
 * פעולה throwRpcError: שגיאה.
 * @param context — הנתון context בהקשר הפעולה.
 * @param error — שגיאה.
 * @returns never — הפלט בהתאם לחתימה.
 */
const throwRpcError = (
  context: string,
  error: { message: string; code?: string | null },
): never => {
  console.error(`${context} Supabase error:`, error);
  throw new Error(`${error.message}${error.code ? ` | Code: ${error.code}` : ''}`);
};

// gvkLegacyMigrationService — שירות.
export const gvkLegacyMigrationService = {
  /**
   * פעולה אסינכרונית preview: הנתון preview בהקשר הפעולה.
   * @param mappings — הנתון mappings בהקשר הפעולה.
   * @returns Promise<GvkLegacyMigrationPreview> — הפלט בהתאם לחתימה.
   */
  async preview(mappings: GvkLegacyMigrationMappings): Promise<GvkLegacyMigrationPreview> {
    return PerformanceDebugService.measureAsync('gvk-legacy-migration.preview', async () => {
      // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
      const { data, error } = await supabase.rpc('preview_gvk_legacy_migration', {
        requested_mappings: mappings,
      });
      if (error) throwRpcError('GVK legacy migration preview', error);
      return data as GvkLegacyMigrationPreview;
    });
  },

  /**
   * פעולה אסינכרונית run: הנתון run בהקשר הפעולה.
   * @param mappings — הנתון mappings בהקשר הפעולה.
   * @returns Promise<GvkLegacyMigrationResult> — הפלט בהתאם לחתימה.
   */
  async run(mappings: GvkLegacyMigrationMappings): Promise<GvkLegacyMigrationResult> {
    return PerformanceDebugService.measureAsync('gvk-legacy-migration.run', async () => {
      // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
      const { data, error } = await supabase.rpc('run_gvk_legacy_migration', {
        requested_mappings: mappings,
      });
      if (error) throwRpcError('GVK legacy migration run', error);
      return data as GvkLegacyMigrationResult;
    });
  },
};
