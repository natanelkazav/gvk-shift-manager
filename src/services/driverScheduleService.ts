/**
 * קובץ: src/services/driverScheduleService.ts
 * מטרה: ניהול טיוטות, פרסום ושינויי שיבוץ של כוננים טכניים.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: normalizeDriverScheduleError, DriverScheduleService.
 * - קריאות RPC המופעלות בקובץ: create_driver_schedule_draft, publish_driver_schedule, get_driver_schedule_draft, update_driver_schedule_day, update_current_driver_schedule_day, transfer_my_driver_duty.
 * - ריכוז הפנייה למקור הנתונים ועיבוד התשובה בהתאם לפונקציות להלן.
 */
import {
  schedulePublicationNotificationService,
} from './schedulePublicationNotificationService';

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

/**
 * פעולה normalizeDriverScheduleError: נרמול כוננים / שיבוץ / שגיאה.
 * @param error — שגיאה.
 * @returns Error — הפלט בהתאם לחתימה.
 */
function normalizeDriverScheduleError(
  error: unknown,
): Error {
  console.error(
    'Driver availability Supabase error:',
    error,
  );

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר error instanceof Error.
  if (
    error instanceof Error
  ) {
    return error;
  }

  if (
    typeof error === 'object' &&
    error !== null
  ) {
    // supabaseError — שגיאה.
    const supabaseError =
      error as {
        // message — הודעה (אופציונלי).
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

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר parts.length > 0.
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

/**
 * איגוד פעולות כוננים / שיבוץ / שירות במחלקה DriverScheduleService.
 */
class DriverScheduleService {
  /**
   * פעולה אסינכרונית createDraft: יצירת טיוטה.
   * הפעולה פונה ל־RPC: create_driver_schedule_draft.
   * @param availabilityPeriodId — תקופת אילוצים.
   * @returns Promise<CreateDriverScheduleDraftResponse> — הפלט בהתאם לחתימה.
   */
  async createDraft(
    availabilityPeriodId: string,
  ): Promise<CreateDriverScheduleDraftResponse> {
    // normalizedAvailabilityPeriodId — תקופת אילוצים.
    const normalizedAvailabilityPeriodId =
      availabilityPeriodId.trim();

    // עצירת הפעולה עם שגיאה כאשר !normalizedAvailabilityPeriodId.
    if (
      !normalizedAvailabilityPeriodId
    ) {
      throw new Error(
        'Driver availability period id is required.',
      );
    }

    // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
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

    // עצירת הפעולה עם שגיאה כאשר error.
    if (error) {
      throw normalizeDriverScheduleError(
        error,
      );
    }

    // עצירת הפעולה עם שגיאה כאשר !data.
    if (!data) {
      throw new Error(
        'לא התקבלה תשובה בעת יצירת טיוטת לוח הכוננים.',
      );
    }

    return data as
      CreateDriverScheduleDraftResponse;
  }
  /**
   * פעולה אסינכרונית publishSchedule: פרסום שיבוץ.
   * הפעולה פונה ל־RPC: publish_driver_schedule.
   * @param schedulePeriodId — תקופת שיבוץ.
   * @returns Promise<PublishDriverScheduleResponse> — הפלט בהתאם לחתימה.
   */
  async publishSchedule(
    schedulePeriodId: string,
  ): Promise<PublishDriverScheduleResponse> {
    // normalizedSchedulePeriodId — תקופת שיבוץ.
    const normalizedSchedulePeriodId =
      schedulePeriodId.trim();

    // עצירת הפעולה עם שגיאה כאשר !normalizedSchedulePeriodId.
    if (!normalizedSchedulePeriodId) {
      throw new Error(
        'Driver schedule period id is required.',
      );
    }

    // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
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

    // עצירת הפעולה עם שגיאה כאשר error.
    if (error) {
      throw normalizeDriverScheduleError(
        error,
      );
    }

    // עצירת הפעולה עם שגיאה כאשר !data.
    if (!data) {
      throw new Error(
        'לא התקבלה תשובה בעת פרסום לוח הכוננים.',
      );
    }

    // response — תוצאת הפעולה.
    const response =
      data as PublishDriverScheduleResponse;

    if (!response.alreadyPublished) {
      await schedulePublicationNotificationService
        .notifyPublished(
          'driver',
          normalizedSchedulePeriodId,
        );
    }

    return response;
  }
  /**
   * פעולה אסינכרונית getSchedule: שליפה או חישוב של שיבוץ.
   * הפעולה פונה ל־RPC: get_driver_schedule_draft.
   * @param request — נתוני הבקשה.
   * @returns Promise<DriverScheduleData | null> — הפלט בהתאם לחתימה.
   */
  async getSchedule(
    request:
      GetDriverScheduleRequest = {},
  ): Promise<DriverScheduleData | null> {
    // normalizedSchedulePeriodId — תקופת שיבוץ.
    const normalizedSchedulePeriodId =
      request.schedulePeriodId
        ?.trim() ||
      null;

    // normalizedYear — שנה.
    const normalizedYear =
      request.year ??
      null;

    // normalizedMonth — חודש.
    const normalizedMonth =
      request.month ??
      null;

    // עצירת הפעולה עם שגיאה כאשר normalizedMonth !== null && ( !Number.isInteger( normalizedMonth, ) || normalizedMonth < 1 || normalizedMonth > 12 ).
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

    // עצירת הפעולה עם שגיאה כאשר normalizedYear !== null && ( !Number.isInteger( normalizedYear, ) || normalizedYear < 2020 || normalizedYear > 2100 ).
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

    // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
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

    // עצירת הפעולה עם שגיאה כאשר error.
    if (error) {
      throw normalizeDriverScheduleError(
        error,
      );
    }

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !data.
    if (!data) {
      return null;
    }

    // response — תוצאת הפעולה.
    const response =
      data as DriverScheduleData;

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !response.period.
    if (!response.period) {
      return null;
    }

    return response;
  }

  /**
   * פעולה אסינכרונית getLatestSchedule: שליפה או חישוב של שיבוץ.
   * @returns Promise<DriverScheduleData | null> — הפלט בהתאם לחתימה.
   */
  async getLatestSchedule():
    Promise<DriverScheduleData | null> {
    return this.getSchedule();
  }

  /**
   * פעולה אסינכרונית getScheduleById: שליפה או חישוב של שיבוץ / מזהה.
   * @param schedulePeriodId — תקופת שיבוץ.
   * @returns Promise<DriverScheduleData | null> — הפלט בהתאם לחתימה.
   */
  async getScheduleById(
    schedulePeriodId: string,
  ): Promise<DriverScheduleData | null> {
    // normalizedSchedulePeriodId — תקופת שיבוץ.
    const normalizedSchedulePeriodId =
      schedulePeriodId.trim();

    // עצירת הפעולה עם שגיאה כאשר !normalizedSchedulePeriodId.
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

  /**
   * פעולה אסינכרונית getScheduleByMonth: שליפה או חישוב של שיבוץ / חודש.
   * @param year — שנה.
   * @param month — חודש.
   * @returns Promise<DriverScheduleData | null> — הפלט בהתאם לחתימה.
   */
  async getScheduleByMonth(
    year: number,
    month: number,
  ): Promise<DriverScheduleData | null> {
    return this.getSchedule({
      year,
      month,
    });
  }
  /**
   * פעולה אסינכרונית updateScheduleDay: עדכון שיבוץ / יום.
   * הפעולה פונה ל־RPC: update_driver_schedule_day.
   * @param request — נתוני הבקשה.
   * @returns Promise<UpdateDriverScheduleDayResponse> — הפלט בהתאם לחתימה.
   */
  async updateScheduleDay(
  request:
    UpdateDriverScheduleDayRequest,
): Promise<UpdateDriverScheduleDayResponse> {
  // normalizedScheduleDayId — מזהה היום.
  const normalizedScheduleDayId =
    request.scheduleDayId.trim();

  // עצירת הפעולה עם שגיאה כאשר !normalizedScheduleDayId.
  if (!normalizedScheduleDayId) {
    throw new Error(
      'Driver schedule day id is required.',
    );
  }

  // normalizedAssignedUserId — מזהה העובד המשובץ.
  const normalizedAssignedUserId =
    request.assignedUserId
      ?.trim() ||
    null;

  // normalizedNote — הערה.
  const normalizedNote =
    request.note
      ?.trim() ||
    null;

  // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
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

  // עצירת הפעולה עם שגיאה כאשר error.
  if (error) {
    throw normalizeDriverScheduleError(
      error,
    );
  }

  // עצירת הפעולה עם שגיאה כאשר !data.
  if (!data) {
    throw new Error(
      'לא התקבלה תשובה בעת עדכון יום בלוח הכוננים.',
    );
  }

  return data as
    UpdateDriverScheduleDayResponse;
}
  /**
   * פעולה אסינכרונית updatePublishedScheduleDay: עדכון פורסם / שיבוץ / יום.
   * הפעולה פונה ל־RPC: update_current_driver_schedule_day.
   * @param request — נתוני הבקשה.
   * @returns Promise<UpdateDriverScheduleDayResponse> — הפלט בהתאם לחתימה.
   */
  async updatePublishedScheduleDay(
    request:
      UpdateDriverScheduleDayRequest,
  ): Promise<UpdateDriverScheduleDayResponse> {
    // normalizedScheduleDayId — מזהה היום.
    const normalizedScheduleDayId =
      request.scheduleDayId.trim();

    // עצירת הפעולה עם שגיאה כאשר !normalizedScheduleDayId.
    if (!normalizedScheduleDayId) {
      throw new Error(
        'Driver schedule day id is required.',
      );
    }

    // normalizedAssignedUserId — מזהה העובד המשובץ.
    const normalizedAssignedUserId =
      request.assignedUserId
        ?.trim() ||
      null;

    // normalizedNote — הערה.
    const normalizedNote =
      request.note
        ?.trim() ||
      null;

    // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
    const {
      data,
      error,
    } =
      await supabase.rpc(
        'update_current_driver_schedule_day',
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

    // עצירת הפעולה עם שגיאה כאשר error.
    if (error) {
      throw normalizeDriverScheduleError(
        error,
      );
    }

    // עצירת הפעולה עם שגיאה כאשר !data.
    if (!data) {
      throw new Error(
        'לא התקבלה תשובה בעת עדכון יום בלוח הכוננים.',
      );
    }

    return data as
      UpdateDriverScheduleDayResponse;
  }

  /**
   * פעולה אסינכרונית transferMyDuty: הנתון transferMyDuty בהקשר הפעולה.
   * הפעולה פונה ל־RPC: transfer_my_driver_duty.
   * @param request — נתוני הבקשה.
   * @returns Promise<TransferMyDriverDutyResponse> — הפלט בהתאם לחתימה.
   */
  async transferMyDuty(
    request:
      TransferMyDriverDutyRequest,
  ): Promise<TransferMyDriverDutyResponse> {
    // normalizedScheduleDayId — מזהה היום.
    const normalizedScheduleDayId =
      request.scheduleDayId.trim();

    // normalizedNewDriverId — כוננים / מזהה.
    const normalizedNewDriverId =
      request.newDriverId.trim();

    // עצירת הפעולה עם שגיאה כאשר !normalizedScheduleDayId.
    if (
      !normalizedScheduleDayId
    ) {
      throw new Error(
        'Driver schedule day id is required.',
      );
    }

    // עצירת הפעולה עם שגיאה כאשר !normalizedNewDriverId.
    if (
      !normalizedNewDriverId
    ) {
      throw new Error(
        'New on-call driver id is required.',
      );
    }

    // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
    const {
      data,
      error,
    } =
      await supabase.rpc(
        'transfer_my_driver_duty',
        {
          requested_schedule_day_id:
            normalizedScheduleDayId,

          requested_new_driver_id:
            normalizedNewDriverId,
        },
      );

    // עצירת הפעולה עם שגיאה כאשר error.
    if (error) {
      throw normalizeDriverScheduleError(
        error,
      );
    }

    // עצירת הפעולה עם שגיאה כאשר !data.
    if (!data) {
      throw new Error(
        'לא התקבלה תשובה בעת העברת הכוננות.',
      );
    }

    return data as
      TransferMyDriverDutyResponse;
  }

}

// driverScheduleService — כוננים / שיבוץ / שירות.
export const driverScheduleService =
  new DriverScheduleService();