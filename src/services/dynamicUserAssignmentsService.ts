import { supabase } from '../lib/supabase';
import { PerformanceDebugService } from './performanceDebugService';
import type {
  DynamicUserAssignmentEditor,
  DynamicUserAssignmentSelection,
} from '../types/dynamicUserAssignments';

function normalizeEditor(data: unknown, userId: string): DynamicUserAssignmentEditor {
  const value = (data ?? {}) as Partial<DynamicUserAssignmentEditor>;
  return {
    userId: typeof value.userId === 'string' ? value.userId : userId,
    assignments: Array.isArray(value.assignments) ? value.assignments : [],
  };
}

export const dynamicUserAssignmentsService = {
  async getEditor(userId: string): Promise<DynamicUserAssignmentEditor> {
    return PerformanceDebugService.measureAsync('dynamic-users.phase10.4.load-assignments', async () => {
      const { data, error } = await supabase.rpc('get_dynamic_user_assignment_editor', {
        target_user_id: userId,
      });

      if (error) {
        throw new Error(error.message || 'לא ניתן לטעון את שיוכי התפקידים של המשתמש.');
      }

      return normalizeEditor(data, userId);
    });
  },

  async save(userId: string, assignments: DynamicUserAssignmentSelection[]): Promise<void> {
    await PerformanceDebugService.measureAsync('dynamic-users.phase10.4.save-assignments', async () => {
      const { error } = await supabase.rpc('save_dynamic_user_assignments', {
        target_user_id: userId,
        requested_assignments: assignments,
      });

      if (error) {
        throw new Error(error.message || 'לא ניתן לשמור את שיוכי התפקידים של המשתמש.');
      }
    });
  },
};
