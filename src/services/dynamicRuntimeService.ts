import { supabase } from '../lib/supabase';
import { PerformanceDebugService } from './performanceDebugService';
import type { DynamicRuntimeContext } from '../types/dynamicRuntime';

interface SupabaseErrorShape {
  message?: unknown;
  details?: unknown;
  hint?: unknown;
  code?: unknown;
}

function normalizeError(error: unknown): Error {
  if (error instanceof Error) return error;

  if (typeof error === 'object' && error !== null) {
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

export const dynamicRuntimeService = {
  async getMyRuntimeContext(): Promise<DynamicRuntimeContext> {
    return PerformanceDebugService.measureAsync(
      'dynamic-scheduling.phase8.7.runtime-context',
      async () => {
        const { data, error } = await supabase.rpc('get_my_dynamic_runtime_context');
        if (error) throw normalizeError(error);
        return data as DynamicRuntimeContext;
      },
    );
  },
};
