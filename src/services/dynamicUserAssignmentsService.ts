/**
 * קובץ: src/services/dynamicUserAssignmentsService.ts
 * מטרה: ניהול שיוכי עובדים לתפקידים דינמיים ולתפקידי ניהול.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: normalizeEditor.
 * - קריאות RPC המופעלות בקובץ: get_dynamic_user_assignment_editor, save_dynamic_user_assignments.
 * - ריכוז הפנייה למקור הנתונים ועיבוד התשובה בהתאם לפונקציות להלן.
 */
import { supabase } from '../lib/supabase';
import { PerformanceDebugService } from './performanceDebugService';
import type {
  DynamicUserAssignmentEditor,
  DynamicUserAssignmentSelection,
} from '../types/dynamicUserAssignments';

/**
 * פעולה normalizeEditor: נרמול הנתון normalizeEditor בהקשר הפעולה.
 * @param data — נתונים.
 * @param userId — מזהה משתמש.
 * @returns DynamicUserAssignmentEditor — הפלט בהתאם לחתימה.
 */
function normalizeEditor(data: unknown, userId: string): DynamicUserAssignmentEditor {
  // value — ערך.
  const value = (data ?? {}) as Partial<DynamicUserAssignmentEditor>;
  return {
    userId: typeof value.userId === 'string' ? value.userId : userId,
    assignments: Array.isArray(value.assignments) ? value.assignments : [],
  };
}

// dynamicUserAssignmentsService — דינמי / משתמש / הקצאות / שירות.
export const dynamicUserAssignmentsService = {
  /**
   * פעולה אסינכרונית getEditor: שליפה או חישוב של הנתון getEditor בהקשר הפעולה.
   * @param userId — מזהה משתמש.
   * @returns Promise<DynamicUserAssignmentEditor> — הפלט בהתאם לחתימה.
   */
  async getEditor(userId: string): Promise<DynamicUserAssignmentEditor> {
    return PerformanceDebugService.measureAsync('dynamic-users.phase10.4.load-assignments', async () => {
      // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
      const { data, error } = await supabase.rpc('get_dynamic_user_assignment_editor', {
        target_user_id: userId,
      });

      // עצירת הפעולה עם שגיאה כאשר error.
      if (error) {
        throw new Error(error.message || 'לא ניתן לטעון את שיוכי התפקידים של המשתמש.');
      }

      return normalizeEditor(data, userId);
    });
  },

  /**
   * פעולה אסינכרונית save: שמירת הנתון save בהקשר הפעולה.
   * @param userId — מזהה משתמש.
   * @param assignments — הקצאות.
   * @returns Promise<void> — הפלט בהתאם לחתימה.
   */
  async save(userId: string, assignments: DynamicUserAssignmentSelection[]): Promise<void> {
    await PerformanceDebugService.measureAsync('dynamic-users.phase10.4.save-assignments', async () => {
      // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
      const { error } = await supabase.rpc('save_dynamic_user_assignments', {
        target_user_id: userId,
        requested_assignments: assignments,
      });

      // עצירת הפעולה עם שגיאה כאשר error.
      if (error) {
        throw new Error(error.message || 'לא ניתן לשמור את שיוכי התפקידים של המשתמש.');
      }
    });
  },
};
