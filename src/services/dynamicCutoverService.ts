/**
 * קובץ: src/services/dynamicCutoverService.ts
 * מטרה: בדיקת מצב המעבר בין המסכים הוותיקים למנגנון הדינמי וניהול הגדרות המעבר.
 * מטרות עיקריות:
 * - קריאות RPC המופעלות בקובץ: get_dynamic_cutover_state, set_dynamic_cutover_state, get_legacy_freeze_readiness, set_legacy_freeze_state.
 * - ריכוז הפנייה למקור הנתונים ועיבוד התשובה בהתאם לפונקציות להלן.
 */
import { supabase } from '../lib/supabase';
import { PerformanceDebugService } from './performanceDebugService';
import type {
  DynamicCutoverState,
  LegacyFreezeReadiness,
} from '../types/dynamicCutover';

/**
 * פעולה normalize: נרמול הנתון normalize בהקשר הפעולה.
 * @param value — ערך.
 * @returns DynamicCutoverState — הפלט בהתאם לחתימה.
 */
const normalize = (value: unknown): DynamicCutoverState => {
  // row — שורה.
  const row = (value ?? {}) as Partial<DynamicCutoverState>;
  return {
    dynamicFirstEnabled: Boolean(row.dynamicFirstEnabled),
    hasDynamicMembership: Boolean(row.hasDynamicMembership),
    useDynamicRuntime: Boolean(row.useDynamicRuntime),
    legacyFrozen: Boolean(row.legacyFrozen),
  };
};

/**
 * פעולה normalizeReadiness: נרמול הנתון normalizeReadiness בהקשר הפעולה.
 * @param value — ערך.
 * @returns LegacyFreezeReadiness — הפלט בהתאם לחתימה.
 */
const normalizeReadiness = (value: unknown): LegacyFreezeReadiness => {
  // row — שורה.
  const row = (value ?? {}) as Partial<LegacyFreezeReadiness>;
  return {
    ready: Boolean(row.ready),
    dynamicFirstEnabled: Boolean(row.dynamicFirstEnabled),
    missingLegacyMemberships: Number(row.missingLegacyMemberships ?? 0),
    missingUsers: Array.isArray(row.missingUsers) ? row.missingUsers : [],
  };
};

// dynamicCutoverService — דינמי / מעבר למנגנון הדינמי / שירות.
export const dynamicCutoverService = {
  /**
   * פעולה getState: שליפה או חישוב של מצב.
   * @returns Promise<DynamicCutoverState> — הפלט בהתאם לחתימה.
   */
  getState(): Promise<DynamicCutoverState> {
    return PerformanceDebugService.measureAsync('dynamic-cutover.get-state', async () => {
      // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
      const { data, error } = await supabase.rpc('get_dynamic_cutover_state');
      if (error) throw error;
      return normalize(data);
    });
  },

  /**
   * פעולה setEnabled: קביעת קבוצה ייחודית / האם האפשרות מופעלת.
   * @param enabled — האם האפשרות מופעלת.
   * @returns Promise<DynamicCutoverState> — הפלט בהתאם לחתימה.
   */
  setEnabled(enabled: boolean): Promise<DynamicCutoverState> {
    return PerformanceDebugService.measureAsync('dynamic-cutover.set-state', async () => {
      // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
      const { data, error } = await supabase.rpc('set_dynamic_cutover_state', { p_enabled: enabled });
      if (error) throw error;
      return normalize(data);
    });
  },

  /**
   * פעולה getLegacyFreezeReadiness: שליפה או חישוב של הנתון getLegacyFreezeReadiness בהקשר הפעולה.
   * @returns Promise<LegacyFreezeReadiness> — הפלט בהתאם לחתימה.
   */
  getLegacyFreezeReadiness(): Promise<LegacyFreezeReadiness> {
    return PerformanceDebugService.measureAsync('dynamic-cutover.legacy-freeze-readiness', async () => {
      // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
      const { data, error } = await supabase.rpc('get_legacy_freeze_readiness');
      if (error) throw error;
      return normalizeReadiness(data);
    });
  },

  /**
   * פעולה setLegacyFrozen: קביעת קבוצה ייחודית.
   * @param frozen — הנתון frozen בהקשר הפעולה.
   * @returns Promise<DynamicCutoverState> — הפלט בהתאם לחתימה.
   */
  setLegacyFrozen(frozen: boolean): Promise<DynamicCutoverState> {
    return PerformanceDebugService.measureAsync('dynamic-cutover.set-legacy-frozen', async () => {
      // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
      const { data, error } = await supabase.rpc('set_legacy_freeze_state', { p_frozen: frozen });
      if (error) throw error;
      return normalize(data);
    });
  },
};
