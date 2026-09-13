import { supabase } from '../lib/supabase';
import { PerformanceDebugService } from './performanceDebugService';
import type {
  DynamicCutoverState,
  LegacyFreezeReadiness,
} from '../types/dynamicCutover';

const normalize = (value: unknown): DynamicCutoverState => {
  const row = (value ?? {}) as Partial<DynamicCutoverState>;
  return {
    dynamicFirstEnabled: Boolean(row.dynamicFirstEnabled),
    hasDynamicMembership: Boolean(row.hasDynamicMembership),
    useDynamicRuntime: Boolean(row.useDynamicRuntime),
    legacyFrozen: Boolean(row.legacyFrozen),
  };
};

const normalizeReadiness = (value: unknown): LegacyFreezeReadiness => {
  const row = (value ?? {}) as Partial<LegacyFreezeReadiness>;
  return {
    ready: Boolean(row.ready),
    dynamicFirstEnabled: Boolean(row.dynamicFirstEnabled),
    missingLegacyMemberships: Number(row.missingLegacyMemberships ?? 0),
    missingUsers: Array.isArray(row.missingUsers) ? row.missingUsers : [],
  };
};

export const dynamicCutoverService = {
  getState(): Promise<DynamicCutoverState> {
    return PerformanceDebugService.measureAsync('dynamic-cutover.get-state', async () => {
      const { data, error } = await supabase.rpc('get_dynamic_cutover_state');
      if (error) throw error;
      return normalize(data);
    });
  },

  setEnabled(enabled: boolean): Promise<DynamicCutoverState> {
    return PerformanceDebugService.measureAsync('dynamic-cutover.set-state', async () => {
      const { data, error } = await supabase.rpc('set_dynamic_cutover_state', { p_enabled: enabled });
      if (error) throw error;
      return normalize(data);
    });
  },

  getLegacyFreezeReadiness(): Promise<LegacyFreezeReadiness> {
    return PerformanceDebugService.measureAsync('dynamic-cutover.legacy-freeze-readiness', async () => {
      const { data, error } = await supabase.rpc('get_legacy_freeze_readiness');
      if (error) throw error;
      return normalizeReadiness(data);
    });
  },

  setLegacyFrozen(frozen: boolean): Promise<DynamicCutoverState> {
    return PerformanceDebugService.measureAsync('dynamic-cutover.set-legacy-frozen', async () => {
      const { data, error } = await supabase.rpc('set_legacy_freeze_state', { p_frozen: frozen });
      if (error) throw error;
      return normalize(data);
    });
  },
};
