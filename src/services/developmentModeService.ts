/**
 * קובץ: src/services/developmentModeService.ts
 * מטרה: ניהול תצורת מצב הפיתוח ומידע הסשן הקשור אליו.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: DevelopmentModeState, DevelopmentModeRow, mapState.
 * - קריאות RPC המופעלות בקובץ: get_my_development_mode, set_my_development_mode.
 * - ריכוז הפנייה למקור הנתונים ועיבוד התשובה בהתאם לפונקציות להלן.
 */
import { supabase } from '../lib/supabase';

/**
 * חוזה הנתונים DevelopmentModeState: מצב פיתוח / מצב פעולה / מצב.
 */
export interface DevelopmentModeState {
  // enabled — האם האפשרות מופעלת.
  enabled: boolean;
  expiresAt: string | null;
  // enabledAt — האם האפשרות מופעלת.
  enabledAt: string | null;
}

/**
 * חוזה הנתונים DevelopmentModeRow: מצב פיתוח / מצב פעולה / שורה.
 */
interface DevelopmentModeRow {
  // enabled — האם האפשרות מופעלת.
  enabled: boolean;
  expires_at: string | null;
  // enabled_at — האם האפשרות מופעלת.
  enabled_at: string | null;
}

/**
 * פעולה mapState: מיפוי מפת התאמה / מצב.
 * @param row — שורה.
 * @returns DevelopmentModeState — הפלט בהתאם לחתימה.
 */
function mapState(row: DevelopmentModeRow | null): DevelopmentModeState {
  return {
    enabled: Boolean(row?.enabled),
    expiresAt: row?.expires_at ?? null,
    enabledAt: row?.enabled_at ?? null,
  };
}

// developmentModeService — מצב פיתוח / מצב פעולה / שירות.
export const developmentModeService = {
  /**
   * פעולה אסינכרונית getState: שליפה או חישוב של מצב.
   * הפעולה פונה ל־RPC: get_my_development_mode.
   * @returns Promise<DevelopmentModeState> — הפלט בהתאם לחתימה.
   */
  async getState(): Promise<DevelopmentModeState> {
    // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
    const { data, error } = await supabase.rpc('get_my_development_mode');
    if (error) throw error;
    return mapState((data as DevelopmentModeRow[] | null)?.[0] ?? null);
  },

  /**
   * פעולה אסינכרונית setState: קביעת קבוצה ייחודית / מצב.
   * הפעולה פונה ל־RPC: set_my_development_mode.
   * @param enabled — האם האפשרות מופעלת.
   * @param durationMinutes — משך / דקות.
   * @returns Promise<DevelopmentModeState> — הפלט בהתאם לחתימה.
   */
  async setState(enabled: boolean, durationMinutes: number | null): Promise<DevelopmentModeState> {
    // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
    const { data, error } = await supabase.rpc('set_my_development_mode', {
      requested_enabled: enabled,
      requested_duration_minutes: durationMinutes,
    });
    if (error) throw error;
    return mapState((data as DevelopmentModeRow[] | null)?.[0] ?? null);
  },
};
