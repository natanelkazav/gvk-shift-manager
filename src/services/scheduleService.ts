import { supabase } from '../lib/supabase';

import type {
  SchedulingAssignment,
} from '../types/autoScheduling';

export interface SaveScheduleDraftRequest {
  availabilityPeriodId: string;

  assignments: SchedulingAssignment[];

  confirmWarnings: boolean;
}

export interface SaveScheduleDraftResponse {
  schedulePeriodId: string;

  availabilityPeriodId: string;

  year: number;

  month: number;

  status: string;

  savedShifts: number;

  automaticAssignments: number;

  manualAssignments: number;

  warningCount: number;

  approvedBy: string;

  approvedAt: string;
}

class ScheduleService {
  async saveScheduleDraft(
    request: SaveScheduleDraftRequest,
  ): Promise<SaveScheduleDraftResponse> {
    const {
      data,
      error,
    } = await supabase.rpc(
      'save_schedule_draft',
      {
        requested_availability_period_id:
          request.availabilityPeriodId,

        requested_assignments:
          request.assignments,

        requested_confirm_warnings:
          request.confirmWarnings,
      },
    );

    if (error) {
      throw error;
    }

    return data as SaveScheduleDraftResponse;
  }
}

export const scheduleService =
  new ScheduleService();