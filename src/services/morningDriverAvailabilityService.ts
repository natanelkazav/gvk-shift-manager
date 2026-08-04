import {
  supabase,
} from '../lib/supabase';

import type {
  CreateMorningDriverAvailabilityPeriodRequest,
  CreateMorningDriverAvailabilityPeriodResponse,
  CloseMorningDriverAvailabilityPeriodResponse,
  DeleteMorningDriverAvailabilityPeriodResponse,
  MorningDriverAvailabilityManagementData,
  MorningDriverAvailabilityPeriodListItem,
  OpenMorningDriverAvailabilityPeriodResponse,
  MorningDriverAvailabilityPersonalData,
  SaveMorningDriverAvailabilityRequest,
  ReopenMorningDriverAvailabilitySubmissionResponse,
  SaveMorningDriverAvailabilityResponse,
  SubmitMorningDriverAvailabilityResponse,
} from '../types/morningDriverAvailability';

function normalizeMorningDriverAvailabilityError(
  error: unknown,
): Error {
  console.error(
    'Morning driver availability Supabase error:',
    error,
  );

  if (
    error instanceof Error
  ) {
    return error;
  }

  if (
    typeof error ===
      'object' &&
    error !== null
  ) {
    const supabaseError =
      error as {
        message?: unknown;
        details?: unknown;
        hint?: unknown;
        code?: unknown;
      };

    const errorParts = [
      typeof supabaseError
        .message ===
        'string' &&
      supabaseError.message.trim()
        ? supabaseError.message
        : null,

      typeof supabaseError
        .details ===
        'string' &&
      supabaseError.details.trim()
        ? supabaseError.details
        : null,

      typeof supabaseError
        .hint ===
        'string' &&
      supabaseError.hint.trim()
        ? `Hint: ${supabaseError.hint}`
        : null,

      typeof supabaseError
        .code ===
        'string' &&
      supabaseError.code.trim()
        ? `Code: ${supabaseError.code}`
        : null,
    ].filter(
      (
        errorPart,
      ): errorPart is string =>
        Boolean(
          errorPart,
        ),
    );

    if (
      errorParts.length >
      0
    ) {
      return new Error(
        errorParts.join(
          ' | ',
        ),
      );
    }
  }

  return new Error(
    'אירעה שגיאה לא צפויה במערכת אילוצי כונני הבוקר.',
  );
}

class MorningDriverAvailabilityService {
  async getPeriods():
    Promise<
      MorningDriverAvailabilityPeriodListItem[]
    > {
    const {
      data,
      error,
    } =
      await supabase.rpc(
        'get_morning_driver_availability_periods',
      );

    if (error) {
      throw normalizeMorningDriverAvailabilityError(
        error,
      );
    }

    if (!data) {
      return [];
    }

    if (
      !Array.isArray(
        data,
      )
    ) {
      throw new Error(
        'התקבלה תשובה לא תקינה בעת טעינת חודשי אילוצי כונני הבוקר.',
      );
    }

    return data as
      MorningDriverAvailabilityPeriodListItem[];
  }

  async createPeriod(
    request:
      CreateMorningDriverAvailabilityPeriodRequest,
  ): Promise<CreateMorningDriverAvailabilityPeriodResponse> {
    const {
      data,
      error,
    } =
      await supabase.rpc(
        'create_morning_driver_availability_period',
        {
          requested_year:
            request.year,

          requested_month:
            request.month,

          requested_title:
            request.title
              ?.trim() ||
            null,

          requested_instructions:
            request.instructions
              ?.trim() ||
            null,

          requested_submission_deadline:
            request
              .submissionDeadline,
        },
      );

    if (error) {
      throw normalizeMorningDriverAvailabilityError(
        error,
      );
    }

    if (!data) {
      throw new Error(
        'לא התקבלה תשובה בעת יצירת חודש אילוצי כונני הבוקר.',
      );
    }

    return data as
      CreateMorningDriverAvailabilityPeriodResponse;
  }

  async openPeriod(
    periodId: string,
  ): Promise<OpenMorningDriverAvailabilityPeriodResponse> {
    const normalizedPeriodId =
      periodId.trim();

    if (
      !normalizedPeriodId
    ) {
      throw new Error(
        'Morning driver availability period id is required.',
      );
    }

    const {
      data,
      error,
    } =
      await supabase.rpc(
        'open_morning_driver_availability_period',
        {
          requested_period_id:
            normalizedPeriodId,
        },
      );

    if (error) {
      throw normalizeMorningDriverAvailabilityError(
        error,
      );
    }

    if (!data) {
      throw new Error(
        'לא התקבלה תשובה בעת פתיחת חודש אילוצי כונני הבוקר.',
      );
    }

    return data as
      OpenMorningDriverAvailabilityPeriodResponse;
  }

  async deletePeriod(
    periodId: string,
  ): Promise<DeleteMorningDriverAvailabilityPeriodResponse> {
    const normalizedPeriodId =
      periodId.trim();

    if (
      !normalizedPeriodId
    ) {
      throw new Error(
        'Morning driver availability period id is required.',
      );
    }

    const {
      data,
      error,
    } =
      await supabase.rpc(
        'delete_morning_driver_availability_period',
        {
          requested_period_id:
            normalizedPeriodId,
        },
      );

    if (error) {
      throw normalizeMorningDriverAvailabilityError(
        error,
      );
    }

    if (!data) {
      throw new Error(
        'לא התקבלה תשובה בעת מחיקת חודש אילוצי כונני הבוקר.',
      );
    }

    return data as
      DeleteMorningDriverAvailabilityPeriodResponse;
  }

  async getMyAvailability(
    periodId: string | null = null,
  ): Promise<MorningDriverAvailabilityPersonalData | null> {
    const normalizedPeriodId =
      periodId?.trim() || null;

    const {
      data,
      error,
    } = await supabase.rpc(
      'get_my_morning_driver_availability',
      {
        requested_period_id:
          normalizedPeriodId,
      },
    );

    if (error) {
      throw normalizeMorningDriverAvailabilityError(
        error,
      );
    }

    return data
      ? data as MorningDriverAvailabilityPersonalData
      : null;
  }

  async saveMyAvailability(
    request: SaveMorningDriverAvailabilityRequest,
  ): Promise<SaveMorningDriverAvailabilityResponse> {
    const normalizedPeriodId =
      request.periodId.trim();

    if (!normalizedPeriodId) {
      throw new Error(
        'Morning driver availability period id is required.',
      );
    }

    const requestedEntries =
      request.entries.map(
        (entry) => ({
          shiftId:
            entry.shiftId.trim(),

          availabilityStatus:
            entry.availabilityStatus,

          note:
            entry.note?.trim() || null,
        }),
      );

    const {
      data,
      error,
    } = await supabase.rpc(
      'save_my_morning_driver_availability',
      {
        requested_period_id:
          normalizedPeriodId,

        requested_entries:
          requestedEntries,
      },
    );

    if (error) {
      throw normalizeMorningDriverAvailabilityError(
        error,
      );
    }

    if (!data) {
      throw new Error(
        'לא התקבלה תשובה בעת שמירת אילוצי כונני הבוקר.',
      );
    }

    return data as
      SaveMorningDriverAvailabilityResponse;
  }

  async submitMyAvailability(
    periodId: string,
  ): Promise<SubmitMorningDriverAvailabilityResponse> {
    const normalizedPeriodId =
      periodId.trim();

    if (!normalizedPeriodId) {
      throw new Error(
        'Morning driver availability period id is required.',
      );
    }

    const {
      data,
      error,
    } = await supabase.rpc(
      'submit_my_morning_driver_availability',
      {
        requested_period_id:
          normalizedPeriodId,
      },
    );

    if (error) {
      throw normalizeMorningDriverAvailabilityError(
        error,
      );
    }

    if (!data) {
      throw new Error(
        'לא התקבלה תשובה בעת הגשת אילוצי כונני הבוקר.',
      );
    }

    return data as
      SubmitMorningDriverAvailabilityResponse;
  }

async getManagementData(
    periodId: string,
  ): Promise<MorningDriverAvailabilityManagementData> {
    const normalizedPeriodId =
      periodId.trim();

    if (!normalizedPeriodId) {
      throw new Error(
        'Morning driver availability period id is required.',
      );
    }

    const {
      data,
      error,
    } =
      await supabase.rpc(
        'get_morning_driver_availability_management',
        {
          requested_period_id:
            normalizedPeriodId,
        },
      );

    if (error) {
      throw normalizeMorningDriverAvailabilityError(
        error,
      );
    }

    if (!data) {
      throw new Error(
        'לא התקבלה תשובה בעת טעינת נתוני ניהול אילוצי כונני הבוקר.',
      );
    }

    return data as
      MorningDriverAvailabilityManagementData;
  }

  async reopenSubmission(
    periodId: string,
    userId: string,
  ): Promise<ReopenMorningDriverAvailabilitySubmissionResponse> {
    const normalizedPeriodId =
      periodId.trim();

    const normalizedUserId =
      userId.trim();

    if (!normalizedPeriodId) {
      throw new Error(
        'Morning driver availability period id is required.',
      );
    }

    if (!normalizedUserId) {
      throw new Error(
        'Morning driver user id is required.',
      );
    }

    const {
      data,
      error,
    } =
      await supabase.rpc(
        'reopen_morning_driver_availability_submission',
        {
          requested_period_id:
            normalizedPeriodId,

          requested_user_id:
            normalizedUserId,
        },
      );

    if (error) {
      throw normalizeMorningDriverAvailabilityError(
        error,
      );
    }

    if (!data) {
      throw new Error(
        'לא התקבלה תשובה בעת פתיחת ההגשה מחדש.',
      );
    }

    return data as
      ReopenMorningDriverAvailabilitySubmissionResponse;
  }

  async closePeriod(
    periodId: string,
    force = false,
  ): Promise<CloseMorningDriverAvailabilityPeriodResponse> {
    const normalizedPeriodId =
      periodId.trim();

    if (!normalizedPeriodId) {
      throw new Error(
        'Morning driver availability period id is required.',
      );
    }

    const {
      data,
      error,
    } =
      await supabase.rpc(
        'close_morning_driver_availability_period',
        {
          requested_period_id:
            normalizedPeriodId,

          requested_force:
            force,
        },
      );

    if (error) {
      throw normalizeMorningDriverAvailabilityError(
        error,
      );
    }

    if (!data) {
      throw new Error(
        'לא התקבלה תשובה בעת סגירת חודש אילוצי כונני הבוקר.',
      );
    }

    return data as
      CloseMorningDriverAvailabilityPeriodResponse;
  }
}

export const morningDriverAvailabilityService =
  new MorningDriverAvailabilityService();