import {
  supabase,
} from '../lib/supabase';

import type {
  CreateDriverScheduleDraftResponse,
  DriverScheduleData,
  GetDriverScheduleRequest,
} from '../types/driverSchedule';

function normalizeDriverScheduleError(
  error: unknown,
): Error {
  if (
    error instanceof Error
  ) {
    return error;
  }

  return new Error(
    'אירעה שגיאה לא צפויה במערכת שיבוץ הכוננים.',
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
}

export const driverScheduleService =
  new DriverScheduleService();