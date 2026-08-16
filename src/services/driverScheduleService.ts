import {
  supabase,
} from '../lib/supabase';

import type {
  CreateDriverScheduleDraftResponse,
  DriverScheduleData,
  GetDriverScheduleRequest,
  UpdateDriverScheduleDayRequest,
  PublishDriverScheduleResponse,
  UpdateDriverScheduleDayResponse,
  TransferMyDriverDutyRequest,
  TransferMyDriverDutyResponse,
} from '../types/driverSchedule';

function normalizeDriverScheduleError(
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
        Boolean(part),
    );

    if (parts.length > 0) {
      return new Error(
        parts.join(' | '),
      );
    }
  }

  return new Error(
    'אירעה שגיאה לא צפויה במערכת אילוצי הכוננים.',
  );
}

class DriverScheduleService {
  async createDraft(
    availabilityPeriodId: string,
  ): Promise<CreateDriverScheduleDraftResponse> {
    const normalizedAvailabilityPeriodId =
      availabilityPeriodId.trim();

    if (
      !normalizedAvailabilityPeriodId
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
        'create_driver_schedule_draft',
        {
          requested_availability_period_id:
            normalizedAvailabilityPeriodId,
        },
      );

    if (error) {
      throw normalizeDriverScheduleError(
        error,
      );
    }

    if (!data) {
      throw new Error(
        'לא התקבלה תשובה בעת יצירת טיוטת לוח הכוננים.',
      );
    }

    return data as
      CreateDriverScheduleDraftResponse;
  }
  async publishSchedule(
    schedulePeriodId: string,
  ): Promise<PublishDriverScheduleResponse> {
    const normalizedSchedulePeriodId =
      schedulePeriodId.trim();

    if (!normalizedSchedulePeriodId) {
      throw new Error(
        'Driver schedule period id is required.',
      );
    }

    const {
      data,
      error,
    } =
      await supabase.rpc(
        'publish_driver_schedule',
        {
          requested_schedule_period_id:
            normalizedSchedulePeriodId,
        },
      );

    if (error) {
      throw normalizeDriverScheduleError(
        error,
      );
    }

    if (!data) {
      throw new Error(
        'לא התקבלה תשובה בעת פרסום לוח הכוננים.',
      );
    }

    return data as
      PublishDriverScheduleResponse;
  }
  async getSchedule(
    request:
      GetDriverScheduleRequest = {},
  ): Promise<DriverScheduleData | null> {
    const normalizedSchedulePeriodId =
      request.schedulePeriodId
        ?.trim() ||
      null;

    const normalizedYear =
      request.year ??
      null;

    const normalizedMonth =
      request.month ??
      null;

    if (
      normalizedMonth !== null &&
      (
        !Number.isInteger(
          normalizedMonth,
        ) ||
        normalizedMonth < 1 ||
        normalizedMonth > 12
      )
    ) {
      throw new Error(
        'Driver schedule month is invalid.',
      );
    }

    if (
      normalizedYear !== null &&
      (
        !Number.isInteger(
          normalizedYear,
        ) ||
        normalizedYear < 2020 ||
        normalizedYear > 2100
      )
    ) {
      throw new Error(
        'Driver schedule year is invalid.',
      );
    }

    const {
      data,
      error,
    } =
      await supabase.rpc(
        'get_driver_schedule_draft',
        {
          requested_schedule_period_id:
            normalizedSchedulePeriodId,

          requested_year:
            normalizedYear,

          requested_month:
            normalizedMonth,
        },
      );

    if (error) {
      throw normalizeDriverScheduleError(
        error,
      );
    }

    if (!data) {
      return null;
    }

    const response =
      data as DriverScheduleData;

    if (!response.period) {
      return null;
    }

    return response;
  }

  async getLatestSchedule():
    Promise<DriverScheduleData | null> {
    return this.getSchedule();
  }

  async getScheduleById(
    schedulePeriodId: string,
  ): Promise<DriverScheduleData | null> {
    const normalizedSchedulePeriodId =
      schedulePeriodId.trim();

    if (
      !normalizedSchedulePeriodId
    ) {
      throw new Error(
        'Driver schedule period id is required.',
      );
    }

    return this.getSchedule({
      schedulePeriodId:
        normalizedSchedulePeriodId,
    });
  }

  async getScheduleByMonth(
    year: number,
    month: number,
  ): Promise<DriverScheduleData | null> {
    return this.getSchedule({
      year,
      month,
    });
  }
  async updateScheduleDay(
  request:
    UpdateDriverScheduleDayRequest,
): Promise<UpdateDriverScheduleDayResponse> {
  const normalizedScheduleDayId =
    request.scheduleDayId.trim();

  if (!normalizedScheduleDayId) {
    throw new Error(
      'Driver schedule day id is required.',
    );
  }

  const normalizedAssignedUserId =
    request.assignedUserId
      ?.trim() ||
    null;

  const normalizedNote =
    request.note
      ?.trim() ||
    null;

  const {
    data,
    error,
  } =
    await supabase.rpc(
      'update_driver_schedule_day',
      {
        requested_schedule_day_id:
          normalizedScheduleDayId,

        requested_assigned_user_id:
          normalizedAssignedUserId,

        requested_is_locked:
          request.isLocked,

        requested_note:
          normalizedNote,
      },
    );

  if (error) {
    throw normalizeDriverScheduleError(
      error,
    );
  }

  if (!data) {
    throw new Error(
      'לא התקבלה תשובה בעת עדכון יום בלוח הכוננים.',
    );
  }

  return data as
    UpdateDriverScheduleDayResponse;
}
  async transferMyDuty(
    request:
      TransferMyDriverDutyRequest,
  ): Promise<TransferMyDriverDutyResponse> {
    const normalizedScheduleDayId =
      request.scheduleDayId.trim();

    const normalizedNewDriverId =
      request.newDriverId.trim();

    if (
      !normalizedScheduleDayId
    ) {
      throw new Error(
        'Driver schedule day id is required.',
      );
    }

    if (
      !normalizedNewDriverId
    ) {
      throw new Error(
        'New on-call driver id is required.',
      );
    }

    const {
      data,
      error,
    } =
      await supabase.functions
        .invoke(
          'driver-duty-transfer-action',
          {
            body: {
              scheduleDayId:
                normalizedScheduleDayId,

              newDriverId:
                normalizedNewDriverId,
            },
          },
        );

    if (error) {
      const context =
        typeof error === 'object' &&
        error !== null &&
        'context' in error
          ? (
              error as {
                context?: Response;
              }
            ).context
          : undefined;

      if (
        context instanceof Response
      ) {
        try {
          const responseBody =
            await context.json() as {
              error?: unknown;
            };

          if (
            typeof responseBody.error ===
              'string' &&
            responseBody.error.trim()
          ) {
            throw new Error(
              responseBody.error,
            );
          }
        } catch (
          functionError
        ) {
          if (
            functionError instanceof Error &&
            functionError.message !==
              error.message
          ) {
            throw functionError;
          }
        }
      }

      throw normalizeDriverScheduleError(
        error,
      );
    }

    if (!data) {
      throw new Error(
        'לא התקבלה תשובה בעת העברת הכוננות.',
      );
    }

    return data as
      TransferMyDriverDutyResponse;
  }

}

export const driverScheduleService =
  new DriverScheduleService();