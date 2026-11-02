/**
 * קובץ: src/services/driverAvailabilityService.ts
 * מטרה: פתיחה וסגירה של תקופות אילוצי כוננים ושמירה והגשה של הזמינות האישית דרך RPC.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: ReopenDriverAvailabilityPeriodResponse, DeleteDriverAvailabilityPeriodResponse, normalizeDriverAvailabilityError, DriverAvailabilityService.
 * - קריאות RPC המופעלות בקובץ: create_driver_availability_period, get_driver_availability_periods, open_driver_availability_period, close_driver_availability_period, reopen_driver_availability_period, delete_driver_availability_period, get_driver_availability_management, get_my_driver_availability, save_my_driver_availability, submit_my_driver_availability.
 * - ריכוז הפנייה למקור הנתונים ועיבוד התשובה בהתאם לפונקציות להלן.
 */
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

/**
 * חוזה הנתונים ReopenDriverAvailabilityPeriodResponse: תקופת אילוצים.
 */
export interface ReopenDriverAvailabilityPeriodResponse {
  // periodId — מזהה התקופה.
  periodId: string;
  // year — שנה.
  year: number;
  // month — חודש.
  month: number;
  // status — סטטוס.
  status: 'open';
  openedAt: string | null;
  reopenedSubmissions: number;
}

/**
 * חוזה הנתונים DeleteDriverAvailabilityPeriodResponse: תקופת אילוצים.
 */
export interface DeleteDriverAvailabilityPeriodResponse {
  // deletedPeriodId — מזהה התקופה.
  deletedPeriodId: string;
  // year — שנה.
  year: number;
  // month — חודש.
  month: number;
  // title — כותרת.
  title: string | null;
  // deletedDays — ימים.
  deletedDays: number;
  // deletedEntries — רשומות.
  deletedEntries: number;
  deletedSubmissions: number;
}

/**
 * פעולה normalizeDriverAvailabilityError: שמירת שגיאת Error קיימת או איחוד message, details, hint ו־code לשגיאה שניתן להציג.
 * @param error — שגיאה.
 * @returns Error — הפלט בהתאם לחתימה.
 */
function normalizeDriverAvailabilityError(
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

    // errorParts — שגיאה.
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

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר errorParts.length > 0.
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

/**
 * איגוד פעולות כוננים / אילוצים וזמינות / שירות במחלקה DriverAvailabilityService.
 */
class DriverAvailabilityService {
  /**
   * פעולה אסינכרונית createPeriod: יצירת תקופה.
   * הפעולה פונה ל־RPC: create_driver_availability_period.
   * @param request — נתוני הבקשה.
   * @returns Promise<CreateDriverAvailabilityPeriodResponse> — הפלט בהתאם לחתימה.
   */
  async createPeriod(
    request:
      CreateDriverAvailabilityPeriodRequest,
  ): Promise<CreateDriverAvailabilityPeriodResponse> {
    // normalizedTitle — כותרת.
    const normalizedTitle =
      request.title
        ?.trim() ||
      null;

    // normalizedInstructions — הנתון normalizedInstructions בהקשר הפעולה.
    const normalizedInstructions =
      request.instructions
        ?.trim() ||
      null;

    // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
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

    // עצירת הפעולה עם שגיאה כאשר error.
    if (error) {
      throw normalizeDriverAvailabilityError(
        error,
      );
    }

    // עצירת הפעולה עם שגיאה כאשר !data.
    if (!data) {
      throw new Error(
        'לא התקבלה תשובה בעת יצירת חודש אילוצי הכוננים.',
      );
    }

    return data as
      CreateDriverAvailabilityPeriodResponse;
  }

  /**
   * פעולה אסינכרונית getPeriods: שליפה או חישוב של תקופות.
   * הפעולה פונה ל־RPC: get_driver_availability_periods.
   * @returns Promise<DriverAvailabilityPeriodListItem[]> — הפלט בהתאם לחתימה.
   */
  async getPeriods():
    Promise<DriverAvailabilityPeriodListItem[]> {
    // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
    const {
      data,
      error,
    } =
      await supabase.rpc(
        'get_driver_availability_periods',
      );

    // עצירת הפעולה עם שגיאה כאשר error.
    if (error) {
      throw normalizeDriverAvailabilityError(
        error,
      );
    }

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !data.
    if (!data) {
      return [];
    }

    // עצירת הפעולה עם שגיאה כאשר !Array.isArray(data).
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

  /**
   * פעולה אסינכרונית openPeriod: פתיחת תקופה.
   * הפעולה פונה ל־RPC: open_driver_availability_period.
   * @param periodId — מזהה התקופה.
   * @returns Promise<OpenDriverAvailabilityPeriodResponse> — הפלט בהתאם לחתימה.
   */
  async openPeriod(
    periodId: string,
  ): Promise<OpenDriverAvailabilityPeriodResponse> {
    // normalizedPeriodId — מזהה התקופה.
    const normalizedPeriodId =
      periodId.trim();

    // עצירת הפעולה עם שגיאה כאשר !normalizedPeriodId.
    if (
      !normalizedPeriodId
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
        'open_driver_availability_period',
        {
          requested_period_id:
            normalizedPeriodId,
        },
      );

    // עצירת הפעולה עם שגיאה כאשר error.
    if (error) {
      throw normalizeDriverAvailabilityError(
        error,
      );
    }

    // עצירת הפעולה עם שגיאה כאשר !data.
    if (!data) {
      throw new Error(
        'לא התקבלה תשובה בעת פתיחת חודש אילוצי הכוננים.',
      );
    }

    return data as
      OpenDriverAvailabilityPeriodResponse;
  }

  /**
   * פעולה אסינכרונית closePeriod: סגירת תקופה.
   * הפעולה פונה ל־RPC: close_driver_availability_period.
   * @param periodId — מזהה התקופה.
   * @param force — הנתון force בהקשר הפעולה.
   * @returns Promise<CloseDriverAvailabilityPeriodResponse> — הפלט בהתאם לחתימה.
   */
  async closePeriod(
    periodId: string,
    force = false,
  ): Promise<CloseDriverAvailabilityPeriodResponse> {
    // normalizedPeriodId — מזהה התקופה.
    const normalizedPeriodId =
      periodId.trim();

    // עצירת הפעולה עם שגיאה כאשר !normalizedPeriodId.
    if (
      !normalizedPeriodId
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
        'close_driver_availability_period',
        {
          requested_period_id:
            normalizedPeriodId,

          requested_force:
            force,
        },
      );

    // עצירת הפעולה עם שגיאה כאשר error.
    if (error) {
      throw normalizeDriverAvailabilityError(
        error,
      );
    }

    // עצירת הפעולה עם שגיאה כאשר !data.
    if (!data) {
      throw new Error(
        'לא התקבלה תשובה בעת סגירת חודש אילוצי הכוננים.',
      );
    }

    return data as
      CloseDriverAvailabilityPeriodResponse;
  }

  /**
   * פעולה אסינכרונית reopenPeriod: פתיחה מחדש של תקופה.
   * הפעולה פונה ל־RPC: reopen_driver_availability_period.
   * @param periodId — מזהה התקופה.
   * @returns Promise<ReopenDriverAvailabilityPeriodResponse> — הפלט בהתאם לחתימה.
   */
  async reopenPeriod(
    periodId: string,
  ): Promise<ReopenDriverAvailabilityPeriodResponse> {
    // normalizedPeriodId — מזהה התקופה.
    const normalizedPeriodId =
      periodId.trim();

    // עצירת הפעולה עם שגיאה כאשר !normalizedPeriodId.
    if (
      !normalizedPeriodId
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
        'reopen_driver_availability_period',
        {
          requested_period_id:
            normalizedPeriodId,
        },
      );

    // עצירת הפעולה עם שגיאה כאשר error.
    if (error) {
      throw normalizeDriverAvailabilityError(
        error,
      );
    }

    // עצירת הפעולה עם שגיאה כאשר !data.
    if (!data) {
      throw new Error(
        'לא התקבלה תשובה בעת פתיחה מחדש של חודש אילוצי הכוננים.',
      );
    }

    return data as
      ReopenDriverAvailabilityPeriodResponse;
  }

  /**
   * פעולה אסינכרונית deletePeriod: מחיקת תקופה.
   * הפעולה פונה ל־RPC: delete_driver_availability_period.
   * @param periodId — מזהה התקופה.
   * @returns Promise<DeleteDriverAvailabilityPeriodResponse> — הפלט בהתאם לחתימה.
   */
  async deletePeriod(
    periodId: string,
  ): Promise<DeleteDriverAvailabilityPeriodResponse> {
    // normalizedPeriodId — מזהה התקופה.
    const normalizedPeriodId =
      periodId.trim();

    // עצירת הפעולה עם שגיאה כאשר !normalizedPeriodId.
    if (
      !normalizedPeriodId
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
        'delete_driver_availability_period',
        {
          requested_period_id:
            normalizedPeriodId,
        },
      );

    // עצירת הפעולה עם שגיאה כאשר error.
    if (error) {
      throw normalizeDriverAvailabilityError(
        error,
      );
    }

    // עצירת הפעולה עם שגיאה כאשר !data.
    if (!data) {
      throw new Error(
        'לא התקבלה תשובה בעת מחיקת חודש אילוצי הכוננים.',
      );
    }

    return data as
      DeleteDriverAvailabilityPeriodResponse;
  }

  /**
   * פעולה אסינכרונית getManagementData: שליפה או חישוב של נתונים.
   * הפעולה פונה ל־RPC: get_driver_availability_management.
   * @param periodId — מזהה התקופה.
   * @returns Promise<DriverAvailabilityManagementData> — הפלט בהתאם לחתימה.
   */
  async getManagementData(
    periodId: string,
  ): Promise<DriverAvailabilityManagementData> {
    // normalizedPeriodId — מזהה התקופה.
    const normalizedPeriodId =
      periodId.trim();

    // עצירת הפעולה עם שגיאה כאשר !normalizedPeriodId.
    if (
      !normalizedPeriodId
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
        'get_driver_availability_management',
        {
          requested_period_id:
            normalizedPeriodId,
        },
      );

    // עצירת הפעולה עם שגיאה כאשר error.
    if (error) {
      throw normalizeDriverAvailabilityError(
        error,
      );
    }

    // עצירת הפעולה עם שגיאה כאשר !data.
    if (!data) {
      throw new Error(
        'לא התקבלה תשובה בעת טעינת נתוני ניהול אילוצי הכוננים.',
      );
    }

    return data as
      DriverAvailabilityManagementData;
  }

  /**
   * פעולה אסינכרונית getMyAvailability: שליפה או חישוב של אילוצים וזמינות.
   * הפעולה פונה ל־RPC: get_my_driver_availability.
   * @param periodId — מזהה התקופה.
   * @returns Promise<DriverAvailabilityPersonalData | null> — הפלט בהתאם לחתימה.
   */
  async getMyAvailability(
    periodId:
      string | null = null,
  ): Promise<DriverAvailabilityPersonalData | null> {
    // normalizedPeriodId — מזהה התקופה.
    const normalizedPeriodId =
      periodId
        ?.trim() ||
      null;

    // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
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

    // עצירת הפעולה עם שגיאה כאשר error.
    if (error) {
      throw normalizeDriverAvailabilityError(
        error,
      );
    }

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !data.
    if (!data) {
      return null;
    }

    // response — תוצאת הפעולה.
    const response =
      data as
        DriverAvailabilityPersonalData;

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !response.period.
    if (
      !response.period
    ) {
      return null;
    }

    return response;
  }

  /**
   * פעולה אסינכרונית saveMyAvailability: שמירת אילוצים וזמינות.
   * הפעולה פונה ל־RPC: save_my_driver_availability.
   * @param request — נתוני הבקשה.
   * @returns Promise<SaveDriverAvailabilityResponse> — הפלט בהתאם לחתימה.
   */
  async saveMyAvailability(
    request:
      SaveDriverAvailabilityRequest,
  ): Promise<SaveDriverAvailabilityResponse> {
    // normalizedPeriodId — מזהה התקופה.
    const normalizedPeriodId =
      request.periodId.trim();

    // עצירת הפעולה עם שגיאה כאשר !normalizedPeriodId.
    if (
      !normalizedPeriodId
    ) {
      throw new Error(
        'Driver availability period id is required.',
      );
    }

    // normalizedEntries — רשומות.
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

    // עצירת הפעולה עם שגיאה כאשר normalizedEntries.some( (entry) => !entry.dayId, ).
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

    // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
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

    // עצירת הפעולה עם שגיאה כאשר error.
    if (error) {
      throw normalizeDriverAvailabilityError(
        error,
      );
    }

    // עצירת הפעולה עם שגיאה כאשר !data.
    if (!data) {
      throw new Error(
        'לא התקבלה תשובה בעת שמירת אילוצי הכוננים.',
      );
    }

    return data as
      SaveDriverAvailabilityResponse;
  }

  /**
   * פעולה אסינכרונית submitMyAvailability: הגשת אילוצים וזמינות.
   * הפעולה פונה ל־RPC: submit_my_driver_availability.
   * @param periodId — מזהה התקופה.
   * @returns Promise<SubmitDriverAvailabilityResponse> — הפלט בהתאם לחתימה.
   */
  async submitMyAvailability(
    periodId: string,
  ): Promise<SubmitDriverAvailabilityResponse> {
    // normalizedPeriodId — מזהה התקופה.
    const normalizedPeriodId =
      periodId.trim();

    // עצירת הפעולה עם שגיאה כאשר !normalizedPeriodId.
    if (
      !normalizedPeriodId
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
        'submit_my_driver_availability',
        {
          requested_period_id:
            normalizedPeriodId,
        },
      );

    // עצירת הפעולה עם שגיאה כאשר error.
    if (error) {
      throw normalizeDriverAvailabilityError(
        error,
      );
    }

    // עצירת הפעולה עם שגיאה כאשר !data.
    if (!data) {
      throw new Error(
        'לא התקבלה תשובה בעת הגשת אילוצי הכוננים.',
      );
    }

    return data as
      SubmitDriverAvailabilityResponse;
  }
}

// driverAvailabilityService — כוננים / אילוצים וזמינות / שירות.
export const driverAvailabilityService =
  new DriverAvailabilityService();