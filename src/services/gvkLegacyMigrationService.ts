import { supabase } from '../lib/supabase';
import { PerformanceDebugService } from './performanceDebugService';
import type {
  GvkLegacyMigrationMappings,
  GvkLegacyMigrationPreview,
  GvkLegacyMigrationResult,
} from '../types/gvkLegacyMigration';

const throwRpcError = (
  context: string,
  error: { message: string; code?: string | null },
): never => {
  console.error(`${context} Supabase error:`, error);
  throw new Error(`${error.message}${error.code ? ` | Code: ${error.code}` : ''}`);
};

export const gvkLegacyMigrationService = {
  async preview(mappings: GvkLegacyMigrationMappings): Promise<GvkLegacyMigrationPreview> {
    return PerformanceDebugService.measureAsync('gvk-legacy-migration.preview', async () => {
      const { data, error } = await supabase.rpc('preview_gvk_legacy_migration', {
        requested_mappings: mappings,
      });
      if (error) throwRpcError('GVK legacy migration preview', error);
      return data as GvkLegacyMigrationPreview;
    });
  },

  async run(mappings: GvkLegacyMigrationMappings): Promise<GvkLegacyMigrationResult> {
    return PerformanceDebugService.measureAsync('gvk-legacy-migration.run', async () => {
      const { data, error } = await supabase.rpc('run_gvk_legacy_migration', {
        requested_mappings: mappings,
      });
      if (error) throwRpcError('GVK legacy migration run', error);
      return data as GvkLegacyMigrationResult;
    });
  },
};
