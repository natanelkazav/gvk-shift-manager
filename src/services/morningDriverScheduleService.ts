/**
 * קובץ: src/services/morningDriverScheduleService.ts
 * מטרה: ניהול טיוטות ולוחות כונני בוקר ושינוי ההקצאות במשמרות.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: normalizeMorningDriverScheduleError, MorningDriverScheduleService.
 * - קריאות RPC המופעלות בקובץ: create_morning_driver_schedule_draft, get_morning_driver_schedule_by_month, get_morning_driver_schedule, update_morning_driver_schedule_shift_time, update_morning_driver_schedule_assignment, set_morning_driver_assignment_intentionally_unassigned, publish_morning_driver_schedule, transfer_my_morning_driver_assignment.
 * - ריכוז הפנייה למקור הנתונים ועיבוד התשובה בהתאם לפונקציות להלן.
 */
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
  UpdateMorningDriverShiftTimeRequest,
  TransferMyMorningDriverAssignmentRequest,
  TransferMyMorningDriverAssignmentResponse,
} from '../types/morningDriverSchedule';

/**
 * פעולה normalizeMorningDriverScheduleError: נרמול כונני בוקר.
 * @param error — שגיאה.
 * @returns Error — הפלט בהתאם לחתימה.
 */
function normalizeMorningDriverScheduleError(
  error: unknown,
): Error {
  console.error(
    'Morning driver schedule Supabase error:',
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
        Boolean(
          part?.trim(),
        ),
    );

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר parts.length > 0.
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

/**
 * איגוד פעולות כונני בוקר במחלקה MorningDriverScheduleService.
 */
class MorningDriverScheduleService {
  /**
   * פעולה אסינכרונית createDraft: יצירת טיוטה.
   * הפעולה פונה ל־RPC: create_morning_driver_schedule_draft.
   * @param availabilityPeriodId — תקופת אילוצים.
   * @returns Promise<CreateMorningDriverScheduleDraftResponse> — הפלט בהתאם לחתימה.
   */
  async createDraft(
    availabilityPeriodId: string,
  ): Promise<CreateMorningDriverScheduleDraftResponse> {
    // normalizedId — מזהה.
    const normalizedId =
      availabilityPeriodId.trim();

    // עצירת הפעולה עם שגיאה כאשר !normalizedId.
    if (!normalizedId) {
      throw new Error(
        'Morning driver availability period id is required.',
      );
    }

    // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
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

    // עצירת הפעולה עם שגיאה כאשר error.
    if (error) {
      throw normalizeMorningDriverScheduleError(
        error,
      );
    }

    // עצירת הפעולה עם שגיאה כאשר !data.
    if (!data) {
      throw new Error(
        'לא התקבלה תשובה בעת יצירת טיוטת לוח כונני הבוקר.',
      );
    }

    return data as
      CreateMorningDriverScheduleDraftResponse;
  }

  /**
   * פעולה אסינכרונית getScheduleByMonthIncludingArchive: שליפה או חישוב של שיבוץ / חודש / ארכיון.
   * הפעולה פונה ל־RPC: get_morning_driver_schedule_by_month.
   * @param year — שנה.
   * @param month — חודש.
   * @returns Promise<MorningDriverScheduleData | null> — הפלט בהתאם לחתימה.
   */
  async getScheduleByMonthIncludingArchive(
    year:
      number,

    month:
      number,
  ): Promise<MorningDriverScheduleData | null> {
    // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
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

    // עצירת הפעולה עם שגיאה כאשר error.
    if (error) {
      throw normalizeMorningDriverScheduleError(
        error,
      );
    }

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !data.
    if (!data) {
      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר year !== null && month !== null.
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

    // scheduleData — שיבוץ / נתונים.
    const scheduleData =
      data as
        MorningDriverScheduleData;

    /*
     * Imported historical periods can exist with their assignments
     * while the legacy RPC returns an empty active-period result.
     * In a month-specific read, retry through the archive-aware RPC.
     */
    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר year !== null && month !== null && scheduleData.assignments .length === 0 && scheduleData.period ?.status === 'archived'.
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

  /**
   * פעולה אסינכרונית getSchedule: שליפה או חישוב של שיבוץ.
   * הפעולה פונה ל־RPC: get_morning_driver_schedule.
   * @param schedulePeriodId — תקופת שיבוץ.
   * @param year — שנה.
   * @param month — חודש.
   * @returns Promise<MorningDriverScheduleData | null> — הפלט בהתאם לחתימה.
   */
  async getSchedule(
    schedulePeriodId:
      string | null = null,

    year:
      number | null = null,

    month:
      number | null = null,
  ): Promise<MorningDriverScheduleData | null> {
    // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
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

    // עצירת הפעולה עם שגיאה כאשר error.
    if (error) {
      throw normalizeMorningDriverScheduleError(
        error,
      );
    }

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !data.
    if (!data) {
      return null;
    }

    return data as
      MorningDriverScheduleData;
  }

  /**
   * פעולה אסינכרונית updateShiftTime: עדכון משמרת / זמן.
   * הפעולה פונה ל־RPC: update_morning_driver_schedule_shift_time.
   * @param request — נתוני הבקשה.
   * @returns Promise<void> — הפלט בהתאם לחתימה.
   */
  async updateShiftTime(
    request: UpdateMorningDriverShiftTimeRequest,
  ): Promise<void> {
    // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
    const { error } = await supabase.rpc(
      'update_morning_driver_schedule_shift_time',
      {
        requested_assignment_id: request.assignmentId.trim(),
        requested_start_time: request.startTime,
        requested_end_time: request.endTime,
      },
    );

    // עצירת הפעולה עם שגיאה כאשר error.
    if (error) {
      throw normalizeMorningDriverScheduleError(error);
    }
  }

  /**
   * פעולה אסינכרונית updateAssignment: עדכון הקצאה.
   * הפעולה פונה ל־RPC: update_morning_driver_schedule_assignment.
   * @param request — נתוני הבקשה.
   * @returns Promise<UpdateMorningDriverScheduleAssignmentResponse> — הפלט בהתאם לחתימה.
   */
  async updateAssignment(
    request:
      UpdateMorningDriverScheduleAssignmentRequest,
  ): Promise<UpdateMorningDriverScheduleAssignmentResponse> {
    // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
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

    // עצירת הפעולה עם שגיאה כאשר error.
    if (error) {
      throw normalizeMorningDriverScheduleError(
        error,
      );
    }

    // עצירת הפעולה עם שגיאה כאשר !data.
    if (!data) {
      throw new Error(
        'לא התקבלה תשובה בעת עדכון שיבוץ כונן הבוקר.',
      );
    }

    return data as
      UpdateMorningDriverScheduleAssignmentResponse;
  }


  /**
   * פעולה אסינכרונית setIntentionallyUnassigned: קביעת קבוצה ייחודית.
   * הפעולה פונה ל־RPC: set_morning_driver_assignment_intentionally_unassigned.
   * @param request — נתוני הבקשה.
   * @returns Promise<void> — הפלט בהתאם לחתימה.
   */
  async setIntentionallyUnassigned(
    request:
      SetMorningDriverIntentionallyUnassignedRequest,
  ): Promise<void> {
    // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
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

    // עצירת הפעולה עם שגיאה כאשר error.
    if (error) {
      throw normalizeMorningDriverScheduleError(
        error,
      );
    }
  }

  /**
   * פעולה אסינכרונית publishSchedule: פרסום שיבוץ.
   * הפעולה פונה ל־RPC: publish_morning_driver_schedule.
   * @param schedulePeriodId — תקופת שיבוץ.
   * @returns Promise<PublishMorningDriverScheduleResponse> — הפלט בהתאם לחתימה.
   */
  async publishSchedule(
    schedulePeriodId: string,
  ): Promise<PublishMorningDriverScheduleResponse> {
    // normalizedId — מזהה.
    const normalizedId =
      schedulePeriodId.trim();

    // עצירת הפעולה עם שגיאה כאשר !normalizedId.
    if (!normalizedId) {
      throw new Error(
        'Morning driver schedule period id is required.',
      );
    }

    // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
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

    // עצירת הפעולה עם שגיאה כאשר error.
    if (error) {
      throw normalizeMorningDriverScheduleError(
        error,
      );
    }

    // עצירת הפעולה עם שגיאה כאשר !data.
    if (!data) {
      throw new Error(
        'לא התקבלה תשובה בעת פרסום לוח כונני הבוקר.',
      );
    }

    // response — תוצאת הפעולה.
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

  /**
   * פעולה אסינכרונית transferMyAssignment: הקצאה.
   * הפעולה פונה ל־RPC: transfer_my_morning_driver_assignment.
   * @param request — נתוני הבקשה.
   * @returns Promise<TransferMyMorningDriverAssignmentResponse> — הפלט בהתאם לחתימה.
   */
  async transferMyAssignment(
    request:
      TransferMyMorningDriverAssignmentRequest,
  ): Promise<TransferMyMorningDriverAssignmentResponse> {
    // normalizedAssignmentId — הקצאה / מזהה.
    const normalizedAssignmentId =
      request.assignmentId.trim();

    // normalizedNewDriverId — כוננים / מזהה.
    const normalizedNewDriverId =
      request.newDriverId.trim();

    // עצירת הפעולה עם שגיאה כאשר !normalizedAssignmentId.
    if (
      !normalizedAssignmentId
    ) {
      throw new Error(
        'Morning driver assignment id is required.',
      );
    }

    // עצירת הפעולה עם שגיאה כאשר !normalizedNewDriverId.
    if (
      !normalizedNewDriverId
    ) {
      throw new Error(
        'New morning driver id is required.',
      );
    }

    // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
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

    // עצירת הפעולה עם שגיאה כאשר error.
    if (error) {
      throw normalizeMorningDriverScheduleError(
        error,
      );
    }

    // עצירת הפעולה עם שגיאה כאשר !data.
    if (!data) {
      throw new Error(
        'לא התקבלה תשובה בעת העברת כוננות הבוקר.',
      );
    }

    return data as
      TransferMyMorningDriverAssignmentResponse;
  }

}

// morningDriverScheduleService — כונני בוקר.
export const morningDriverScheduleService =
  new MorningDriverScheduleService();