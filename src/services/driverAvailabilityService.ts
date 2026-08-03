import {
  supabase,
} from '../lib/supabase';

import type {
  CloseDriverAvailabilityPeriodResponse,
  CreateDriverAvailabilityPeriodRequest,
  CreateDriverAvailabilityPeriodResponse,
  DriverAvailabilityManagementData,
  DriverAvailabilityPeriodListItem,
  DriverAvailabilityPersonalData,
  OpenDriverAvailabilityPeriodResponse,
  SaveDriverAvailabilityRequest,
  SaveDriverAvailabilityResponse,
  SubmitDriverAvailabilityResponse,
} from '../types/driverAvailability';

export interface ReopenDriverAvailabilityPeriodResponse {
  periodId: string;
  year: number;
  month: number;
  status: 'open';
  openedAt: string | null;
  reopenedSubmissions: number;
}

export interface DeleteDriverAvailabilityPeriodResponse {
  deletedPeriodId: string;
  year: number;
  month: number;
  title: string | null;
  deletedDays: number;
  deletedEntries: number;
  deletedSubmissions: number;
}

function normalizeDriverAvailabilityError(
  error: unknown,
): Error {
  console.error(
    'Driver availability Supabase error:',
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

    const errorParts = [
      typeof supabaseError.message ===
        'string' &&
      supabaseError.message.trim()
        ? supabaseError.message
        : null,

      typeof supabaseError.details ===
        'string' &&
      supabaseError.details.trim()
        ? supabaseError.details
        : null,

      typeof supabaseError.hint ===
        'string' &&
      supabaseError.hint.trim()
        ? `Hint: ${supabaseError.hint}`
        : null,

      typeof supabaseError.code ===
        'string' &&
      supabaseError.code.trim()
        ? `Code: ${supabaseError.code}`
        : null,
    ].filter(
      (
        errorPart,
      ): errorPart is string =>
        Boolean(errorPart),
    );

    if (
      errorParts.length > 0
    ) {
      return new Error(
        errorParts.join(' | '),
      );
    }
  }

  return new Error(
    'אירעה שגיאה לא צפויה במערכת אילוצי הכוננים.',
  );
}

class DriverAvailabilityService {
  async createPeriod(
    request:
      CreateDriverAvailabilityPeriodRequest,
  ): Promise<CreateDriverAvailabilityPeriodResponse> {
    const normalizedTitle =
      request.title
        ?.trim() ||
      null;

    const normalizedInstructions =
      request.instructions
        ?.trim() ||
      null;

    const {
      data,
      error,
    } =
      await supabase.rpc(
        'create_driver_availability_period',
        {
          requested_year:
            request.year,

          requested_month:
            request.month,

          requested_title:
            normalizedTitle,

          requested_instructions:
            normalizedInstructions,

          requested_submission_deadline:
            request.submissionDeadline,
        },
      );

    if (error) {
      throw normalizeDriverAvailabilityError(
        error,
      );
    }

    if (!data) {
      throw new Error(
        'לא התקבלה תשובה בעת יצירת חודש אילוצי הכוננים.',
      );
    }

    return data as
      CreateDriverAvailabilityPeriodResponse;
  }

  async getPeriods():
    Promise<DriverAvailabilityPeriodListItem[]> {
    const {
      data,
      error,
    } =
      await supabase.rpc(
        'get_driver_availability_periods',
      );

    if (error) {
      throw normalizeDriverAvailabilityError(
        error,
      );
    }

    if (!data) {
      return [];
    }

    if (
      !Array.isArray(data)
    ) {
      throw new Error(
        'התקבלה תשובה לא תקינה בעת טעינת חודשי אילוצי הכוננים.',
      );
    }

    return data as
      DriverAvailabilityPeriodListItem[];
  }

  async openPeriod(
    periodId: string,
  ): Promise<OpenDriverAvailabilityPeriodResponse> {
    const normalizedPeriodId =
      periodId.trim();

    if (
      !normalizedPeriodId
    ) {
      throw new Error(
        'Driver availability period id is required.',
      );
    }

    const {
      data,
      error,
    } =
      await supabase.rpc(
        'open_driver_availability_period',
        {
          requested_period_id:
            normalizedPeriodId,
        },
      );

    if (error) {
      throw normalizeDriverAvailabilityError(
        error,
      );
    }

    if (!data) {
      throw new Error(
        'לא התקבלה תשובה בעת פתיחת חודש אילוצי הכוננים.',
      );
    }

    return data as
      OpenDriverAvailabilityPeriodResponse;
  }

  async closePeriod(
    periodId: string,
    force = false,
  ): Promise<CloseDriverAvailabilityPeriodResponse> {
    const normalizedPeriodId =
      periodId.trim();

    if (
      !normalizedPeriodId
    ) {
      throw new Error(
        'Driver availability period id is required.',
      );
    }

    const {
      data,
      error,
    } =
      await supabase.rpc(
        'close_driver_availability_period',
        {
          requested_period_id:
            normalizedPeriodId,

          requested_force:
            force,
        },
      );

    if (error) {
      throw normalizeDriverAvailabilityError(
        error,
      );
    }

    if (!data) {
      throw new Error(
        'לא התקבלה תשובה בעת סגירת חודש אילוצי הכוננים.',
      );
    }

    return data as
      CloseDriverAvailabilityPeriodResponse;
  }

  async reopenPeriod(
    periodId: string,
  ): Promise<ReopenDriverAvailabilityPeriodResponse> {
    const normalizedPeriodId =
      periodId.trim();

    if (
      !normalizedPeriodId
    ) {
      throw new Error(
        'Driver availability period id is required.',
      );
    }

    const {
      data,
      error,
    } =
      await supabase.rpc(
        'reopen_driver_availability_period',
        {
          requested_period_id:
            normalizedPeriodId,
        },
      );

    if (error) {
      throw normalizeDriverAvailabilityError(
        error,
      );
    }

    if (!data) {
      throw new Error(
        'לא התקבלה תשובה בעת פתיחה מחדש של חודש אילוצי הכוננים.',
      );
    }

    return data as
      ReopenDriverAvailabilityPeriodResponse;
  }

  async deletePeriod(
    periodId: string,
  ): Promise<DeleteDriverAvailabilityPeriodResponse> {
    const normalizedPeriodId =
      periodId.trim();

    if (
      !normalizedPeriodId
    ) {
      throw new Error(
        'Driver availability period id is required.',
      );
    }

    const {
      data,
      error,
    } =
      await supabase.rpc(
        'delete_driver_availability_period',
        {
          requested_period_id:
            normalizedPeriodId,
        },
      );

    if (error) {
      throw normalizeDriverAvailabilityError(
        error,
      );
    }

    if (!data) {
      throw new Error(
        'לא התקבלה תשובה בעת מחיקת חודש אילוצי הכוננים.',
      );
    }

    return data as
      DeleteDriverAvailabilityPeriodResponse;
  }

  async getManagementData(
    periodId: string,
  ): Promise<DriverAvailabilityManagementData> {
    const normalizedPeriodId =
      periodId.trim();

    if (
      !normalizedPeriodId
    ) {
      throw new Error(
        'Driver availability period id is required.',
      );
    }

    const {
      data,
      error,
    } =
      await supabase.rpc(
        'get_driver_availability_management',
        {
          requested_period_id:
            normalizedPeriodId,
        },
      );

    if (error) {
      throw normalizeDriverAvailabilityError(
        error,
      );
    }

    if (!data) {
      throw new Error(
        'לא התקבלה תשובה בעת טעינת נתוני ניהול אילוצי הכוננים.',
      );
    }

    return data as
      DriverAvailabilityManagementData;
  }

  async getMyAvailability(
    periodId:
      string | null = null,
  ): Promise<DriverAvailabilityPersonalData | null> {
    const normalizedPeriodId =
      periodId
        ?.trim() ||
      null;

    const {
      data,
      error,
    } =
      await supabase.rpc(
        'get_my_driver_availability',
        {
          requested_period_id:
            normalizedPeriodId,
        },
      );

    if (error) {
      throw normalizeDriverAvailabilityError(
        error,
      );
    }

    if (!data) {
      return null;
    }

    const response =
      data as
        DriverAvailabilityPersonalData;

    if (
      !response.period
    ) {
      return null;
    }

    return response;
  }

  async saveMyAvailability(
    request:
      SaveDriverAvailabilityRequest,
  ): Promise<SaveDriverAvailabilityResponse> {
    const normalizedPeriodId =
      request.periodId.trim();

    if (
      !normalizedPeriodId
    ) {
      throw new Error(
        'Driver availability period id is required.',
      );
    }

    const normalizedEntries =
      request.entries.map(
        (entry) => ({
          dayId:
            entry.dayId.trim(),

          availabilityStatus:
            entry.availabilityStatus,

          note:
            entry.note
              ?.trim() ||
            null,
        }),
      );

    if (
      normalizedEntries.some(
        (entry) =>
          !entry.dayId,
      )
    ) {
      throw new Error(
        'One or more driver availability day ids are missing.',
      );
    }

    const {
      data,
      error,
    } =
      await supabase.rpc(
        'save_my_driver_availability',
        {
          requested_period_id:
            normalizedPeriodId,

          requested_entries:
            normalizedEntries,
        },
      );

    if (error) {
      throw normalizeDriverAvailabilityError(
        error,
      );
    }

    if (!data) {
      throw new Error(
        'לא התקבלה תשובה בעת שמירת אילוצי הכוננים.',
      );
    }

    return data as
      SaveDriverAvailabilityResponse;
  }

  async submitMyAvailability(
    periodId: string,
  ): Promise<SubmitDriverAvailabilityResponse> {
    const normalizedPeriodId =
      periodId.trim();

    if (
      !normalizedPeriodId
    ) {
      throw new Error(
        'Driver availability period id is required.',
      );
    }

    const {
      data,
      error,
    } =
      await supabase.rpc(
        'submit_my_driver_availability',
        {
          requested_period_id:
            normalizedPeriodId,
        },
      );

    if (error) {
      throw normalizeDriverAvailabilityError(
        error,
      );
    }

    if (!data) {
      throw new Error(
        'לא התקבלה תשובה בעת הגשת אילוצי הכוננים.',
      );
    }

    return data as
      SubmitDriverAvailabilityResponse;
  }
}

export const driverAvailabilityService =
  new DriverAvailabilityService();