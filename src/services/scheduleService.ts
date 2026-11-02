/**
 * קובץ: src/services/scheduleService.ts
 * מטרה: טעינה וניהול של לוחות מוקדנים ואפשרויות עריכה של משמרות.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: SaveScheduleDraftRequest, SaveScheduleDraftResponse, PublishSchedulePeriodResponse, getFunctionErrorMessage, ScheduleService.
 * - קריאות RPC המופעלות בקובץ: save_schedule_draft, get_current_schedule, get_dispatcher_schedule_by_month, get_schedule_draft_edit_context, update_schedule_draft_shift, get_current_schedule_edit_options, publish_schedule_period.
 * - ריכוז הפנייה למקור הנתונים ועיבוד התשובה בהתאם לפונקציות להלן.
 */
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

/**
 * חוזה הנתונים SaveScheduleDraftRequest: שיבוץ / טיוטה / נתוני הבקשה.
 */
export interface SaveScheduleDraftRequest {
  // availabilityPeriodId — תקופת אילוצים.
  availabilityPeriodId: string;

  // assignments — הקצאות.
  assignments:
    SchedulingAssignment[];

  // intentionallyUnassignedShiftIds — מזהה המשמרת.
  intentionallyUnassignedShiftIds:
    string[];

  confirmWarnings: boolean;
}

/**
 * חוזה הנתונים SaveScheduleDraftResponse: שיבוץ / טיוטה / תוצאת הפעולה.
 */
export interface SaveScheduleDraftResponse {
  // schedulePeriodId — תקופת שיבוץ.
  schedulePeriodId: string;

  // availabilityPeriodId — תקופת אילוצים.
  availabilityPeriodId: string;

  // year — שנה.
  year: number;

  // month — חודש.
  month: number;

  // status — סטטוס.
  status: string;

  // savedShifts — משמרות.
  savedShifts: number;

  // automaticAssignments — הקצאות.
  automaticAssignments: number;

  // manualAssignments — הקצאות.
  manualAssignments: number;

  // intentionallyUnassignedShifts — משמרות.
  intentionallyUnassignedShifts: number;

  // warningCount — כמות.
  warningCount: number;

  approvedBy: string;

  approvedAt: string;
}

/**
 * חוזה הנתונים PublishSchedulePeriodResponse: תקופת שיבוץ.
 */
export interface PublishSchedulePeriodResponse {
  // schedulePeriodId — תקופת שיבוץ.
  schedulePeriodId: string;

  // year — שנה.
  year: number;

  // month — חודש.
  month: number;

  // status — סטטוס.
  status: 'published';

  // publishedAt — פורסם.
  publishedAt: string;

  // publishedBy — פורסם.
  publishedBy:
    string | null;

  // publishedShifts — פורסם / משמרות.
  publishedShifts:
    number | null;

  // intentionallyUnassignedShifts — משמרות (אופציונלי).
  intentionallyUnassignedShifts?:
    number | null;

  // alreadyPublished — פורסם.
  alreadyPublished: boolean;
}


/**
 * פעולה אסינכרונית getFunctionErrorMessage: שליפה או חישוב של הודעת שגיאה.
 * @param error — שגיאה.
 * @returns Promise<string> — הפלט בהתאם לחתימה.
 */
async function getFunctionErrorMessage(
  error:
    FunctionsHttpError,
): Promise<string> {
  // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
  try {
    // responseBody — תוצאת הפעולה / תוכן.
    const responseBody =
      await error.context
        .json() as {
          // error — שגיאה (אופציונלי).
          error?: unknown;
        };

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר typeof responseBody.error === 'string' && responseBody.error.trim().
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

/**
 * איגוד פעולות שיבוץ / שירות במחלקה ScheduleService.
 */
class ScheduleService {
  /**
   * פעולה אסינכרונית saveScheduleDraft: שמירת שיבוץ / טיוטה.
   * הפעולה פונה ל־RPC: save_schedule_draft.
   * @param request — נתוני הבקשה.
   * @returns Promise<SaveScheduleDraftResponse> — הפלט בהתאם לחתימה.
   */
  async saveScheduleDraft(
    request:
      SaveScheduleDraftRequest,
  ): Promise<SaveScheduleDraftResponse> {
    // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
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

    // עצירת הפעולה עם שגיאה כאשר error.
    if (error) {
      throw error;
    }

    // עצירת הפעולה עם שגיאה כאשר !data.
    if (!data) {
      throw new Error(
        'Save schedule response is empty.',
      );
    }

    return data as
      SaveScheduleDraftResponse;
  }

  /**
   * פעולה אסינכרונית getCurrentSchedule: שליפה או חישוב של שיבוץ.
   * הפעולה פונה ל־RPC: get_current_schedule.
   * @returns Promise<CurrentScheduleData> — הפלט בהתאם לחתימה.
   */
  async getCurrentSchedule():
    Promise<CurrentScheduleData> {
    // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
    const {
      data,
      error,
    } = await supabase.rpc(
      'get_current_schedule',
    );

    // עצירת הפעולה עם שגיאה כאשר error.
    if (error) {
      throw error;
    }

    // עצירת הפעולה עם שגיאה כאשר !data.
    if (!data) {
      throw new Error(
        'Current schedule response is empty.',
      );
    }

    return data as
      CurrentScheduleData;
  }
/**
 * פעולה אסינכרונית getScheduleByMonth: שליפה או חישוב של שיבוץ / חודש.
 * הפעולה פונה ל־RPC: get_dispatcher_schedule_by_month.
 * @param year — שנה.
 * @param month — חודש.
 * @returns Promise<DispatcherScheduleMonthData> — הפלט בהתאם לחתימה.
 */
async getScheduleByMonth(
  year: number,
  month: number,
): Promise<DispatcherScheduleMonthData> {
  // עצירת הפעולה עם שגיאה כאשר !Number.isInteger(year) || year < 2020 || year > 2100.
  if (
    !Number.isInteger(year) ||
    year < 2020 ||
    year > 2100
  ) {
    throw new Error(
      'Dispatcher schedule year is invalid.',
    );
  }

  // עצירת הפעולה עם שגיאה כאשר !Number.isInteger(month) || month < 1 || month > 12.
  if (
    !Number.isInteger(month) ||
    month < 1 ||
    month > 12
  ) {
    throw new Error(
      'Dispatcher schedule month is invalid.',
    );
  }

  // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
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

  // עצירת הפעולה עם שגיאה כאשר error.
  if (error) {
    throw error;
  }

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !data.
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

  /**
   * פעולה אסינכרונית getScheduleDraftEditContext: שליפה או חישוב של שיבוץ / טיוטה.
   * הפעולה פונה ל־RPC: get_schedule_draft_edit_context.
   * @param schedulePeriodId — תקופת שיבוץ.
   * @returns Promise<ScheduleDraftEditContext> — הפלט בהתאם לחתימה.
   */
  async getScheduleDraftEditContext(
    schedulePeriodId: string,
  ): Promise<ScheduleDraftEditContext> {
    // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
    const { data, error } = await supabase.rpc(
      'get_schedule_draft_edit_context',
      { requested_schedule_period_id: schedulePeriodId },
    );

    // עצירת הפעולה עם שגיאה כאשר error.
    if (error) {
      throw error;
    }

    // עצירת הפעולה עם שגיאה כאשר !data || typeof data !== 'object'.
    if (!data || typeof data !== 'object') {
      throw new Error('לא ניתן היה לטעון את נתוני עריכת הטיוטה.');
    }

    return data as ScheduleDraftEditContext;
  }

  /**
   * פעולה אסינכרונית updateScheduleDraftShift: עדכון שיבוץ / טיוטה / משמרת.
   * הפעולה פונה ל־RPC: update_schedule_draft_shift.
   * @param request — נתוני הבקשה.
   * @returns Promise<void> — הפלט בהתאם לחתימה.
   */
  async updateScheduleDraftShift(
    request: UpdateScheduleDraftShiftRequest,
  ): Promise<void> {
    // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
    const { error } = await supabase.rpc(
      'update_schedule_draft_shift',
      {
        requested_shift_id: request.shiftId,
        requested_new_user_id: request.newUserId,
        requested_intentionally_unassigned: request.intentionallyUnassigned,
      },
    );

    // עצירת הפעולה עם שגיאה כאשר error.
    if (error) {
      throw error;
    }
  }

  /**
   * פעולה אסינכרונית getCurrentScheduleEditOptions: שליפה או חישוב של שיבוץ / אפשרויות בחירה.
   * הפעולה פונה ל־RPC: get_current_schedule_edit_options.
   * @param shiftId — מזהה המשמרת.
   * @returns Promise<CurrentScheduleEditOptions> — הפלט בהתאם לחתימה.
   */
  async getCurrentScheduleEditOptions(
    shiftId: string,
  ): Promise<CurrentScheduleEditOptions> {
    // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
    const {
      data,
      error,
    } = await supabase.rpc(
      'get_current_schedule_edit_options',
      { requested_shift_id: shiftId },
    );

    // עצירת הפעולה עם שגיאה כאשר error.
    if (error) {
      throw error;
    }

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !data || typeof data !== 'object'.
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

  /**
   * פעולה אסינכרונית updateCurrentScheduleShift: עדכון שיבוץ / משמרת.
   * @param request — נתוני הבקשה.
   * @returns Promise<UpdateCurrentScheduleShiftResponse> — הפלט בהתאם לחתימה.
   */
  async updateCurrentScheduleShift(
    request:
      UpdateCurrentScheduleShiftRequest,
  ): Promise<UpdateCurrentScheduleShiftResponse> {
    // shiftId — מזהה המשמרת.
    const shiftId =
      request.shiftId.trim();

    // newUserId — מזהה העובד לאחר השינוי.
    const newUserId =
      request.newUserId.trim();

    // עצירת הפעולה עם שגיאה כאשר !shiftId || !newUserId.
    if (!shiftId || !newUserId) {
      throw new Error(
        'נתוני שינוי השיבוץ חסרים.',
      );
    }

    // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
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

    // עצירת הפעולה עם שגיאה כאשר error.
    if (error) {
      // עצירת הפעולה עם שגיאה כאשר error instanceof FunctionsHttpError.
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

    // עצירת הפעולה עם שגיאה כאשר !data || typeof data !== 'object'.
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

  /**
   * פעולה אסינכרונית publishSchedulePeriod: פרסום תקופת שיבוץ.
   * הפעולה פונה ל־RPC: publish_schedule_period.
   * @param schedulePeriodId — תקופת שיבוץ.
   * @returns Promise<PublishSchedulePeriodResponse> — הפלט בהתאם לחתימה.
   */
  async publishSchedulePeriod(
    schedulePeriodId: string,
  ): Promise<PublishSchedulePeriodResponse> {
    // normalizedSchedulePeriodId — תקופת שיבוץ.
    const normalizedSchedulePeriodId =
      schedulePeriodId.trim();

    // עצירת הפעולה עם שגיאה כאשר !normalizedSchedulePeriodId.
    if (
      !normalizedSchedulePeriodId
    ) {
      throw new Error(
        'Schedule period id is required.',
      );
    }

    // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
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

    // עצירת הפעולה עם שגיאה כאשר error.
    if (error) {
      throw error;
    }

    // עצירת הפעולה עם שגיאה כאשר !data.
    if (!data) {
      throw new Error(
        'Publish schedule response is empty.',
      );
    }

    // response — תוצאת הפעולה.
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

// scheduleService — שיבוץ / שירות.
export const scheduleService =
  new ScheduleService();