import {
  schedulePublicationNotificationService,
} from './schedulePublicationNotificationService';

import {
  FunctionsHttpError,
} from '@supabase/supabase-js';

import { supabase } from '../lib/supabase';

import type {
  SchedulingAssignment,
} from '../types/autoScheduling';

import type {
  CurrentScheduleData,
  CurrentScheduleEditOptions,
  UpdateCurrentScheduleShiftRequest,
  UpdateCurrentScheduleShiftResponse,
  ScheduleDraftEditContext,
  UpdateScheduleDraftShiftRequest,
} from '../types/schedule';

import type {
  DispatcherScheduleMonthData,
} from '../types/unifiedSchedule';

export interface SaveScheduleDraftRequest {
  availabilityPeriodId: string;

  assignments:
    SchedulingAssignment[];

  intentionallyUnassignedShiftIds:
    string[];

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

  intentionallyUnassignedShifts: number;

  warningCount: number;

  approvedBy: string;

  approvedAt: string;
}

export interface PublishSchedulePeriodResponse {
  schedulePeriodId: string;

  year: number;

  month: number;

  status: 'published';

  publishedAt: string;

  publishedBy:
    string | null;

  publishedShifts:
    number | null;

  intentionallyUnassignedShifts?:
    number | null;

  alreadyPublished: boolean;
}


async function getFunctionErrorMessage(
  error:
    FunctionsHttpError,
): Promise<string> {
  try {
    const responseBody =
      await error.context
        .json() as {
          error?: unknown;
        };

    if (
      typeof responseBody.error ===
        'string' &&
      responseBody.error.trim()
    ) {
      return responseBody.error;
    }
  } catch {
    // Use the default function error message.
  }

  return (
    error.message ||
    'עדכון השיבוץ נכשל.'
  );
}

class ScheduleService {
  async saveScheduleDraft(
    request:
      SaveScheduleDraftRequest,
  ): Promise<SaveScheduleDraftResponse> {
    const {
      data,
      error,
    } = await supabase.rpc(
      'save_schedule_draft',
      {
        requested_availability_period_id:
          request.availabilityPeriodId,

        requested_assignments: [
          ...request.assignments,
          ...request
            .intentionallyUnassignedShiftIds
            .map(
              (shiftId) => ({
                shiftId,
                userId: null,
                source: 'manual',
                score: null,
                reasons: [
                  'המשמרת סומנה במפורש לפרסום ללא מוקדן.',
                ],
                isIntentionallyUnassigned:
                  true,
              }),
            ),
        ],

        requested_confirm_warnings:
          request.confirmWarnings,
      },
    );

    if (error) {
      throw error;
    }

    if (!data) {
      throw new Error(
        'Save schedule response is empty.',
      );
    }

    return data as
      SaveScheduleDraftResponse;
  }

  async getCurrentSchedule():
    Promise<CurrentScheduleData> {
    const {
      data,
      error,
    } = await supabase.rpc(
      'get_current_schedule',
    );

    if (error) {
      throw error;
    }

    if (!data) {
      throw new Error(
        'Current schedule response is empty.',
      );
    }

    return data as
      CurrentScheduleData;
  }
async getScheduleByMonth(
  year: number,
  month: number,
): Promise<DispatcherScheduleMonthData> {
  if (
    !Number.isInteger(year) ||
    year < 2020 ||
    year > 2100
  ) {
    throw new Error(
      'Dispatcher schedule year is invalid.',
    );
  }

  if (
    !Number.isInteger(month) ||
    month < 1 ||
    month > 12
  ) {
    throw new Error(
      'Dispatcher schedule month is invalid.',
    );
  }

  const {
    data,
    error,
  } = await supabase.rpc(
    'get_dispatcher_schedule_by_month',
    {
      requested_year:
        year,

      requested_month:
        month,
    },
  );

  if (error) {
    throw error;
  }

  if (!data) {
    return {
      period:
        null,

      shifts:
        [],
    };
  }

  return data as
    DispatcherScheduleMonthData;
}

  async getScheduleDraftEditContext(
    schedulePeriodId: string,
  ): Promise<ScheduleDraftEditContext> {
    const { data, error } = await supabase.rpc(
      'get_schedule_draft_edit_context',
      { requested_schedule_period_id: schedulePeriodId },
    );

    if (error) {
      throw error;
    }

    if (!data || typeof data !== 'object') {
      throw new Error('לא ניתן היה לטעון את נתוני עריכת הטיוטה.');
    }

    return data as ScheduleDraftEditContext;
  }

  async updateScheduleDraftShift(
    request: UpdateScheduleDraftShiftRequest,
  ): Promise<void> {
    const { error } = await supabase.rpc(
      'update_schedule_draft_shift',
      {
        requested_shift_id: request.shiftId,
        requested_new_user_id: request.newUserId,
        requested_intentionally_unassigned: request.intentionallyUnassigned,
      },
    );

    if (error) {
      throw error;
    }
  }

  async getCurrentScheduleEditOptions():
    Promise<CurrentScheduleEditOptions> {
    const {
      data,
      error,
    } = await supabase.rpc(
      'get_current_schedule_edit_options',
    );

    if (error) {
      throw error;
    }

    if (
      !data ||
      typeof data !==
        'object'
    ) {
      return {
        dispatchers: [],
      };
    }

    return data as
      CurrentScheduleEditOptions;
  }

  async updateCurrentScheduleShift(
    request:
      UpdateCurrentScheduleShiftRequest,
  ): Promise<UpdateCurrentScheduleShiftResponse> {
    const shiftId =
      request.shiftId.trim();

    const newUserId =
      request.newUserId.trim();

    if (!shiftId || !newUserId) {
      throw new Error(
        'נתוני שינוי השיבוץ חסרים.',
      );
    }

    const {
      data,
      error,
    } = await supabase.functions.invoke(
      'schedule-edit-action',
      {
        body: {
          shiftId,
          newUserId,
          reason:
            request.reason
              ?.trim() ||
            null,
        },
      },
    );

    if (error) {
      if (
        error instanceof
          FunctionsHttpError
      ) {
        throw new Error(
          await getFunctionErrorMessage(
            error,
          ),
        );
      }

      throw error;
    }

    if (
      !data ||
      typeof data !==
        'object'
    ) {
      throw new Error(
        'לא התקבלה תשובה תקינה לאחר שינוי השיבוץ.',
      );
    }

    return data as
      UpdateCurrentScheduleShiftResponse;
  }

  async publishSchedulePeriod(
    schedulePeriodId: string,
  ): Promise<PublishSchedulePeriodResponse> {
    const normalizedSchedulePeriodId =
      schedulePeriodId.trim();

    if (
      !normalizedSchedulePeriodId
    ) {
      throw new Error(
        'Schedule period id is required.',
      );
    }

    const {
      data,
      error,
    } = await supabase.rpc(
      'publish_schedule_period',
      {
        requested_schedule_period_id:
          normalizedSchedulePeriodId,
      },
    );

    if (error) {
      throw error;
    }

    if (!data) {
      throw new Error(
        'Publish schedule response is empty.',
      );
    }

    const response =
      data as PublishSchedulePeriodResponse;

    if (!response.alreadyPublished) {
      await schedulePublicationNotificationService
        .notifyPublished(
          'dispatcher',
          normalizedSchedulePeriodId,
        );
    }

    return response;
  }
}

export const scheduleService =
  new ScheduleService();