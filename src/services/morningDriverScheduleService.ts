import {
  schedulePublicationNotificationService,
} from './schedulePublicationNotificationService';

import {
  supabase,
} from '../lib/supabase';

import type {
  CreateMorningDriverScheduleDraftResponse,
  MorningDriverScheduleData,
  PublishMorningDriverScheduleResponse,
  SetMorningDriverIntentionallyUnassignedRequest,
  UpdateMorningDriverScheduleAssignmentRequest,
  UpdateMorningDriverScheduleAssignmentResponse,
  TransferMyMorningDriverAssignmentRequest,
  TransferMyMorningDriverAssignmentResponse,
} from '../types/morningDriverSchedule';

function normalizeMorningDriverScheduleError(
  error: unknown,
): Error {
  console.error(
    'Morning driver schedule Supabase error:',
    error,
  );

  if (
    error instanceof Error
  ) {
    return error;
  }

  if (
    typeof error === 'object' &&
    error !== null
  ) {
    const supabaseError =
      error as {
        message?: unknown;
        details?: unknown;
        hint?: unknown;
        code?: unknown;
      };

    const parts = [
      typeof supabaseError.message ===
        'string'
        ? supabaseError.message
        : null,

      typeof supabaseError.details ===
        'string'
        ? supabaseError.details
        : null,

      typeof supabaseError.hint ===
        'string'
        ? `Hint: ${supabaseError.hint}`
        : null,

      typeof supabaseError.code ===
        'string'
        ? `Code: ${supabaseError.code}`
        : null,
    ].filter(
      (
        part,
      ): part is string =>
        Boolean(
          part?.trim(),
        ),
    );

    if (
      parts.length > 0
    ) {
      return new Error(
        parts.join(' | '),
      );
    }
  }

  return new Error(
    'אירעה שגיאה לא צפויה בלוח כונני הבוקר.',
  );
}

class MorningDriverScheduleService {
  async createDraft(
    availabilityPeriodId: string,
  ): Promise<CreateMorningDriverScheduleDraftResponse> {
    const normalizedId =
      availabilityPeriodId.trim();

    if (!normalizedId) {
      throw new Error(
        'Morning driver availability period id is required.',
      );
    }

    const {
      data,
      error,
    } =
      await supabase.rpc(
        'create_morning_driver_schedule_draft',
        {
          requested_availability_period_id:
            normalizedId,
        },
      );

    if (error) {
      throw normalizeMorningDriverScheduleError(
        error,
      );
    }

    if (!data) {
      throw new Error(
        'לא התקבלה תשובה בעת יצירת טיוטת לוח כונני הבוקר.',
      );
    }

    return data as
      CreateMorningDriverScheduleDraftResponse;
  }

  async getScheduleByMonthIncludingArchive(
    year:
      number,

    month:
      number,
  ): Promise<MorningDriverScheduleData | null> {
    const {
      data,
      error,
    } =
      await supabase.rpc(
        'get_morning_driver_schedule_by_month',
        {
          requested_year:
            year,

          requested_month:
            month,
        },
      );

    if (error) {
      throw normalizeMorningDriverScheduleError(
        error,
      );
    }

    if (!data) {
      if (
        year !==
          null &&
        month !==
          null
      ) {
        return this
          .getScheduleByMonthIncludingArchive(
            year,
            month,
          );
      }

      return null;
    }

    const scheduleData =
      data as
        MorningDriverScheduleData;

    /*
     * Imported historical periods can exist with their assignments
     * while the legacy RPC returns an empty active-period result.
     * In a month-specific read, retry through the archive-aware RPC.
     */
    if (
      year !==
        null &&
      month !==
        null &&
      scheduleData.assignments
        .length ===
        0 &&
      scheduleData.period
        ?.status ===
        'archived'
    ) {
      return this
        .getScheduleByMonthIncludingArchive(
          year,
          month,
        );
    }

    return scheduleData;
  }

  async getSchedule(
    schedulePeriodId:
      string | null = null,

    year:
      number | null = null,

    month:
      number | null = null,
  ): Promise<MorningDriverScheduleData | null> {
    const {
      data,
      error,
    } =
      await supabase.rpc(
        'get_morning_driver_schedule',
        {
          requested_schedule_period_id:
            schedulePeriodId
              ?.trim() ||
            null,

          requested_year:
            year,

          requested_month:
            month,
        },
      );

    if (error) {
      throw normalizeMorningDriverScheduleError(
        error,
      );
    }

    if (!data) {
      return null;
    }

    return data as
      MorningDriverScheduleData;
  }

  async updateAssignment(
    request:
      UpdateMorningDriverScheduleAssignmentRequest,
  ): Promise<UpdateMorningDriverScheduleAssignmentResponse> {
    const {
      data,
      error,
    } =
      await supabase.rpc(
        'update_morning_driver_schedule_assignment',
        {
          requested_assignment_id:
            request.assignmentId.trim(),

          requested_assigned_user_id:
            request.assignedUserId
              ?.trim() ||
            null,

          requested_is_locked:
            request.isLocked,

          requested_note:
            request.note
              ?.trim() ||
            null,
        },
      );

    if (error) {
      throw normalizeMorningDriverScheduleError(
        error,
      );
    }

    if (!data) {
      throw new Error(
        'לא התקבלה תשובה בעת עדכון שיבוץ כונן הבוקר.',
      );
    }

    return data as
      UpdateMorningDriverScheduleAssignmentResponse;
  }


  async setIntentionallyUnassigned(
    request:
      SetMorningDriverIntentionallyUnassignedRequest,
  ): Promise<void> {
    const { error } =
      await supabase.rpc(
        'set_morning_driver_assignment_intentionally_unassigned',
        {
          requested_assignment_id:
            request.assignmentId.trim(),

          requested_is_intentionally_unassigned:
            request.isIntentionallyUnassigned,
        },
      );

    if (error) {
      throw normalizeMorningDriverScheduleError(
        error,
      );
    }
  }

  async publishSchedule(
    schedulePeriodId: string,
  ): Promise<PublishMorningDriverScheduleResponse> {
    const normalizedId =
      schedulePeriodId.trim();

    if (!normalizedId) {
      throw new Error(
        'Morning driver schedule period id is required.',
      );
    }

    const {
      data,
      error,
    } =
      await supabase.rpc(
        'publish_morning_driver_schedule',
        {
          requested_schedule_period_id:
            normalizedId,
        },
      );

    if (error) {
      throw normalizeMorningDriverScheduleError(
        error,
      );
    }

    if (!data) {
      throw new Error(
        'לא התקבלה תשובה בעת פרסום לוח כונני הבוקר.',
      );
    }

    const response =
      data as PublishMorningDriverScheduleResponse;

    if (!response.alreadyPublished) {
      await schedulePublicationNotificationService
        .notifyPublished(
          'morning_driver',
          normalizedId,
        );
    }

    return response;
  }

  async transferMyAssignment(
    request:
      TransferMyMorningDriverAssignmentRequest,
  ): Promise<TransferMyMorningDriverAssignmentResponse> {
    const normalizedAssignmentId =
      request.assignmentId.trim();

    const normalizedNewDriverId =
      request.newDriverId.trim();

    if (
      !normalizedAssignmentId
    ) {
      throw new Error(
        'Morning driver assignment id is required.',
      );
    }

    if (
      !normalizedNewDriverId
    ) {
      throw new Error(
        'New morning driver id is required.',
      );
    }

    const {
      data,
      error,
    } =
      await supabase.rpc(
        'transfer_my_morning_driver_assignment',
        {
          requested_assignment_id:
            normalizedAssignmentId,

          requested_new_driver_id:
            normalizedNewDriverId,
        },
      );

    if (error) {
      throw normalizeMorningDriverScheduleError(
        error,
      );
    }

    if (!data) {
      throw new Error(
        'לא התקבלה תשובה בעת העברת כוננות הבוקר.',
      );
    }

    return data as
      TransferMyMorningDriverAssignmentResponse;
  }

}

export const morningDriverScheduleService =
  new MorningDriverScheduleService();