/**
 * קובץ: src/services/morningDriverAvailabilityService.ts
 * מטרה: ניהול תקופות אילוצים והגשות הזמינות של כונני הבוקר.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: normalizeMorningDriverAvailabilityError, MorningDriverAvailabilityService.
 * - קריאות RPC המופעלות בקובץ: get_morning_driver_availability_periods, create_morning_driver_availability_period, open_morning_driver_availability_period, reopen_morning_driver_availability_period, delete_morning_driver_availability_period, get_my_morning_driver_availability, save_my_morning_driver_availability, submit_my_morning_driver_availability, get_morning_driver_availability_management, reopen_morning_driver_availability_submission, close_morning_driver_availability_period.
 * - ריכוז הפנייה למקור הנתונים ועיבוד התשובה בהתאם לפונקציות להלן.
 */
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
  ReopenMorningDriverAvailabilityPeriodResponse,
  MorningDriverAvailabilityPersonalData,
  SaveMorningDriverAvailabilityRequest,
  ReopenMorningDriverAvailabilitySubmissionResponse,
  SaveMorningDriverAvailabilityResponse,
  SubmitMorningDriverAvailabilityResponse,
} from '../types/morningDriverAvailability';

/**
 * פעולה normalizeMorningDriverAvailabilityError: נרמול כונני בוקר.
 * @param error — שגיאה.
 * @returns Error — הפלט בהתאם לחתימה.
 */
function normalizeMorningDriverAvailabilityError(
  error: unknown,
): Error {
  console.error(
    'Morning driver availability Supabase error:',
    error,
  );

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר error instanceof Error.
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
    // supabaseError — שגיאה.
    const supabaseError =
      error as {
        // message — הודעה (אופציונלי).
        message?: unknown;
        details?: unknown;
        hint?: unknown;
        code?: unknown;
      };

    // errorParts — שגיאה.
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

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר errorParts.length > 0.
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

/**
 * איגוד פעולות כונני בוקר במחלקה MorningDriverAvailabilityService.
 */
class MorningDriverAvailabilityService {
  /**
   * פעולה אסינכרונית getPeriods: שליפה או חישוב של תקופות.
   * הפעולה פונה ל־RPC: get_morning_driver_availability_periods.
   * @returns Promise< MorningDriverAvailabilityPeriodListItem[] > — הפלט בהתאם לחתימה.
   */
  async getPeriods():
    Promise<
      MorningDriverAvailabilityPeriodListItem[]
    > {
    // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
    const {
      data,
      error,
    } =
      await supabase.rpc(
        'get_morning_driver_availability_periods',
      );

    // עצירת הפעולה עם שגיאה כאשר error.
    if (error) {
      throw normalizeMorningDriverAvailabilityError(
        error,
      );
    }

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !data.
    if (!data) {
      return [];
    }

    // עצירת הפעולה עם שגיאה כאשר !Array.isArray( data, ).
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

  /**
   * פעולה אסינכרונית createPeriod: יצירת תקופה.
   * הפעולה פונה ל־RPC: create_morning_driver_availability_period.
   * @param request — נתוני הבקשה.
   * @returns Promise<CreateMorningDriverAvailabilityPeriodResponse> — הפלט בהתאם לחתימה.
   */
  async createPeriod(
    request:
      CreateMorningDriverAvailabilityPeriodRequest,
  ): Promise<CreateMorningDriverAvailabilityPeriodResponse> {
    // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
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

    // עצירת הפעולה עם שגיאה כאשר error.
    if (error) {
      throw normalizeMorningDriverAvailabilityError(
        error,
      );
    }

    // עצירת הפעולה עם שגיאה כאשר !data.
    if (!data) {
      throw new Error(
        'לא התקבלה תשובה בעת יצירת חודש אילוצי כונני הבוקר.',
      );
    }

    return data as
      CreateMorningDriverAvailabilityPeriodResponse;
  }

  /**
   * פעולה אסינכרונית openPeriod: פתיחת תקופה.
   * הפעולה פונה ל־RPC: open_morning_driver_availability_period.
   * @param periodId — מזהה התקופה.
   * @returns Promise<OpenMorningDriverAvailabilityPeriodResponse> — הפלט בהתאם לחתימה.
   */
  async openPeriod(
    periodId: string,
  ): Promise<OpenMorningDriverAvailabilityPeriodResponse> {
    // normalizedPeriodId — מזהה התקופה.
    const normalizedPeriodId =
      periodId.trim();

    // עצירת הפעולה עם שגיאה כאשר !normalizedPeriodId.
    if (
      !normalizedPeriodId
    ) {
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
        'open_morning_driver_availability_period',
        {
          requested_period_id:
            normalizedPeriodId,
        },
      );

    // עצירת הפעולה עם שגיאה כאשר error.
    if (error) {
      throw normalizeMorningDriverAvailabilityError(
        error,
      );
    }

    // עצירת הפעולה עם שגיאה כאשר !data.
    if (!data) {
      throw new Error(
        'לא התקבלה תשובה בעת פתיחת חודש אילוצי כונני הבוקר.',
      );
    }

    return data as
      OpenMorningDriverAvailabilityPeriodResponse;
  }


  /**
   * פעולה אסינכרונית reopenPeriod: פתיחה מחדש של תקופה.
   * הפעולה פונה ל־RPC: reopen_morning_driver_availability_period.
   * @param periodId — מזהה התקופה.
   * @returns Promise<ReopenMorningDriverAvailabilityPeriodResponse> — הפלט בהתאם לחתימה.
   */
  async reopenPeriod(
    periodId: string,
  ): Promise<ReopenMorningDriverAvailabilityPeriodResponse> {
    // normalizedPeriodId — מזהה התקופה.
    const normalizedPeriodId =
      periodId.trim();

    // עצירת הפעולה עם שגיאה כאשר !normalizedPeriodId.
    if (!normalizedPeriodId) {
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
        'reopen_morning_driver_availability_period',
        {
          requested_period_id:
            normalizedPeriodId,
        },
      );

    // עצירת הפעולה עם שגיאה כאשר error.
    if (error) {
      throw normalizeMorningDriverAvailabilityError(
        error,
      );
    }

    // עצירת הפעולה עם שגיאה כאשר !data.
    if (!data) {
      throw new Error(
        'לא התקבלה תשובה בעת פתיחת חודש אילוצי כונני הבוקר מחדש.',
      );
    }

    return data as
      ReopenMorningDriverAvailabilityPeriodResponse;
  }

  /**
   * פעולה אסינכרונית deletePeriod: מחיקת תקופה.
   * הפעולה פונה ל־RPC: delete_morning_driver_availability_period.
   * @param periodId — מזהה התקופה.
   * @returns Promise<DeleteMorningDriverAvailabilityPeriodResponse> — הפלט בהתאם לחתימה.
   */
  async deletePeriod(
    periodId: string,
  ): Promise<DeleteMorningDriverAvailabilityPeriodResponse> {
    // normalizedPeriodId — מזהה התקופה.
    const normalizedPeriodId =
      periodId.trim();

    // עצירת הפעולה עם שגיאה כאשר !normalizedPeriodId.
    if (
      !normalizedPeriodId
    ) {
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
        'delete_morning_driver_availability_period',
        {
          requested_period_id:
            normalizedPeriodId,
        },
      );

    // עצירת הפעולה עם שגיאה כאשר error.
    if (error) {
      throw normalizeMorningDriverAvailabilityError(
        error,
      );
    }

    // עצירת הפעולה עם שגיאה כאשר !data.
    if (!data) {
      throw new Error(
        'לא התקבלה תשובה בעת מחיקת חודש אילוצי כונני הבוקר.',
      );
    }

    return data as
      DeleteMorningDriverAvailabilityPeriodResponse;
  }

  /**
   * פעולה אסינכרונית getMyAvailability: שליפה או חישוב של אילוצים וזמינות.
   * הפעולה פונה ל־RPC: get_my_morning_driver_availability.
   * @param periodId — מזהה התקופה.
   * @returns Promise<MorningDriverAvailabilityPersonalData | null> — הפלט בהתאם לחתימה.
   */
  async getMyAvailability(
    periodId: string | null = null,
  ): Promise<MorningDriverAvailabilityPersonalData | null> {
    // normalizedPeriodId — מזהה התקופה.
    const normalizedPeriodId =
      periodId?.trim() || null;

    // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
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

    // עצירת הפעולה עם שגיאה כאשר error.
    if (error) {
      throw normalizeMorningDriverAvailabilityError(
        error,
      );
    }

    return data
      ? data as MorningDriverAvailabilityPersonalData
      : null;
  }

  /**
   * פעולה אסינכרונית saveMyAvailability: שמירת אילוצים וזמינות.
   * הפעולה פונה ל־RPC: save_my_morning_driver_availability.
   * @param request — נתוני הבקשה.
   * @returns Promise<SaveMorningDriverAvailabilityResponse> — הפלט בהתאם לחתימה.
   */
  async saveMyAvailability(
    request: SaveMorningDriverAvailabilityRequest,
  ): Promise<SaveMorningDriverAvailabilityResponse> {
    // normalizedPeriodId — מזהה התקופה.
    const normalizedPeriodId =
      request.periodId.trim();

    // עצירת הפעולה עם שגיאה כאשר !normalizedPeriodId.
    if (!normalizedPeriodId) {
      throw new Error(
        'Morning driver availability period id is required.',
      );
    }

    // requestedEntries — רשומות.
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

    // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
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

    // עצירת הפעולה עם שגיאה כאשר error.
    if (error) {
      throw normalizeMorningDriverAvailabilityError(
        error,
      );
    }

    // עצירת הפעולה עם שגיאה כאשר !data.
    if (!data) {
      throw new Error(
        'לא התקבלה תשובה בעת שמירת אילוצי כונני הבוקר.',
      );
    }

    return data as
      SaveMorningDriverAvailabilityResponse;
  }

  /**
   * פעולה אסינכרונית submitMyAvailability: הגשת אילוצים וזמינות.
   * הפעולה פונה ל־RPC: submit_my_morning_driver_availability.
   * @param periodId — מזהה התקופה.
   * @returns Promise<SubmitMorningDriverAvailabilityResponse> — הפלט בהתאם לחתימה.
   */
  async submitMyAvailability(
    periodId: string,
  ): Promise<SubmitMorningDriverAvailabilityResponse> {
    // normalizedPeriodId — מזהה התקופה.
    const normalizedPeriodId =
      periodId.trim();

    // עצירת הפעולה עם שגיאה כאשר !normalizedPeriodId.
    if (!normalizedPeriodId) {
      throw new Error(
        'Morning driver availability period id is required.',
      );
    }

    // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
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

    // עצירת הפעולה עם שגיאה כאשר error.
    if (error) {
      throw normalizeMorningDriverAvailabilityError(
        error,
      );
    }

    // עצירת הפעולה עם שגיאה כאשר !data.
    if (!data) {
      throw new Error(
        'לא התקבלה תשובה בעת הגשת אילוצי כונני הבוקר.',
      );
    }

    return data as
      SubmitMorningDriverAvailabilityResponse;
  }

/**
 * פעולה אסינכרונית getManagementData: שליפה או חישוב של נתונים.
 * הפעולה פונה ל־RPC: get_morning_driver_availability_management.
 * @param periodId — מזהה התקופה.
 * @returns Promise<MorningDriverAvailabilityManagementData> — הפלט בהתאם לחתימה.
 */
async getManagementData(
    periodId: string,
  ): Promise<MorningDriverAvailabilityManagementData> {
    // normalizedPeriodId — מזהה התקופה.
    const normalizedPeriodId =
      periodId.trim();

    // עצירת הפעולה עם שגיאה כאשר !normalizedPeriodId.
    if (!normalizedPeriodId) {
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
        'get_morning_driver_availability_management',
        {
          requested_period_id:
            normalizedPeriodId,
        },
      );

    // עצירת הפעולה עם שגיאה כאשר error.
    if (error) {
      throw normalizeMorningDriverAvailabilityError(
        error,
      );
    }

    // עצירת הפעולה עם שגיאה כאשר !data.
    if (!data) {
      throw new Error(
        'לא התקבלה תשובה בעת טעינת נתוני ניהול אילוצי כונני הבוקר.',
      );
    }

    return data as
      MorningDriverAvailabilityManagementData;
  }

  /**
   * פעולה אסינכרונית reopenSubmission: פתיחה מחדש של הנתון reopenSubmission בהקשר הפעולה.
   * הפעולה פונה ל־RPC: reopen_morning_driver_availability_submission.
   * @param periodId — מזהה התקופה.
   * @param userId — מזהה משתמש.
   * @returns Promise<ReopenMorningDriverAvailabilitySubmissionResponse> — הפלט בהתאם לחתימה.
   */
  async reopenSubmission(
    periodId: string,
    userId: string,
  ): Promise<ReopenMorningDriverAvailabilitySubmissionResponse> {
    // normalizedPeriodId — מזהה התקופה.
    const normalizedPeriodId =
      periodId.trim();

    // normalizedUserId — מזהה משתמש.
    const normalizedUserId =
      userId.trim();

    // עצירת הפעולה עם שגיאה כאשר !normalizedPeriodId.
    if (!normalizedPeriodId) {
      throw new Error(
        'Morning driver availability period id is required.',
      );
    }

    // עצירת הפעולה עם שגיאה כאשר !normalizedUserId.
    if (!normalizedUserId) {
      throw new Error(
        'Morning driver user id is required.',
      );
    }

    // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
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

    // עצירת הפעולה עם שגיאה כאשר error.
    if (error) {
      throw normalizeMorningDriverAvailabilityError(
        error,
      );
    }

    // עצירת הפעולה עם שגיאה כאשר !data.
    if (!data) {
      throw new Error(
        'לא התקבלה תשובה בעת פתיחת ההגשה מחדש.',
      );
    }

    return data as
      ReopenMorningDriverAvailabilitySubmissionResponse;
  }

  /**
   * פעולה אסינכרונית closePeriod: סגירת תקופה.
   * הפעולה פונה ל־RPC: close_morning_driver_availability_period.
   * @param periodId — מזהה התקופה.
   * @param force — הנתון force בהקשר הפעולה.
   * @returns Promise<CloseMorningDriverAvailabilityPeriodResponse> — הפלט בהתאם לחתימה.
   */
  async closePeriod(
    periodId: string,
    force = false,
  ): Promise<CloseMorningDriverAvailabilityPeriodResponse> {
    // normalizedPeriodId — מזהה התקופה.
    const normalizedPeriodId =
      periodId.trim();

    // עצירת הפעולה עם שגיאה כאשר !normalizedPeriodId.
    if (!normalizedPeriodId) {
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
        'close_morning_driver_availability_period',
        {
          requested_period_id:
            normalizedPeriodId,

          requested_force:
            force,
        },
      );

    // עצירת הפעולה עם שגיאה כאשר error.
    if (error) {
      throw normalizeMorningDriverAvailabilityError(
        error,
      );
    }

    // עצירת הפעולה עם שגיאה כאשר !data.
    if (!data) {
      throw new Error(
        'לא התקבלה תשובה בעת סגירת חודש אילוצי כונני הבוקר.',
      );
    }

    return data as
      CloseMorningDriverAvailabilityPeriodResponse;
  }
}

// morningDriverAvailabilityService — כונני בוקר.
export const morningDriverAvailabilityService =
  new MorningDriverAvailabilityService();