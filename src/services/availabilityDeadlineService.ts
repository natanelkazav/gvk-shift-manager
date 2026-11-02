/**
 * קובץ: src/services/availabilityDeadlineService.ts
 * מטרה: עיבוד מועדי הגשת אילוצים ובדיקת מצב המועד ביחס לזמן הנוכחי.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: AvailabilityDeadlineCategory, UpdateAvailabilityDeadlineResponse, normalizeError, AvailabilityDeadlineService.
 * - קריאות RPC המופעלות בקובץ: update_availability_submission_deadline.
 * - ריכוז הפנייה למקור הנתונים ועיבוד התשובה בהתאם לפונקציות להלן.
 */
import {
  supabase,
} from '../lib/supabase';

/**
 * טיפוס AvailabilityDeadlineCategory: אילוצים וזמינות.
 */
export type AvailabilityDeadlineCategory =
  | 'dispatcher'
  | 'driver'
  | 'morning_driver';

/**
 * חוזה הנתונים UpdateAvailabilityDeadlineResponse: אילוצים וזמינות / תוצאת הפעולה.
 */
interface UpdateAvailabilityDeadlineResponse {
  category: AvailabilityDeadlineCategory;
  // periodId — מזהה התקופה.
  periodId: string;
  // submissionDeadline — מועד אחרון להגשת אילוצים.
  submissionDeadline: string | null;
  // updatedAt — מועד עדכון.
  updatedAt: string;
}

/**
 * פעולה normalizeError: נרמול שגיאה.
 * @param error — שגיאה.
 * @returns Error — הפלט בהתאם לחתימה.
 */
function normalizeError(
  error: unknown,
): Error {
  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר error instanceof Error.
  if (
    error instanceof
      Error
  ) {
    return error;
  }

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר typeof error === 'object' && error !== null && 'message' in error && typeof ( error as { message?: unknown; } ).message === 'string'.
  if (
    typeof error ===
      'object' &&
    error !== null &&
    'message' in error &&
    typeof (
      error as {
        // message — הודעה (אופציונלי).
        message?: unknown;
      }
    ).message ===
      'string'
  ) {
    return new Error(
      (
        error as {
          // message — הודעה.
          message: string;
        }
      ).message,
    );
  }

  return new Error(
    'לא ניתן היה לעדכן את מועד הגשת האילוצים.',
  );
}

/**
 * איגוד פעולות אילוצים וזמינות / שירות במחלקה AvailabilityDeadlineService.
 */
class AvailabilityDeadlineService {
  /**
   * פעולה אסינכרונית updateDeadline: עדכון הנתון updateDeadline בהקשר הפעולה.
   * הפעולה פונה ל־RPC: update_availability_submission_deadline.
   * @param category — הנתון category בהקשר הפעולה.
   * @param periodId — מזהה התקופה.
   * @param submissionDeadline — מועד אחרון להגשת אילוצים.
   * @returns Promise<UpdateAvailabilityDeadlineResponse> — הפלט בהתאם לחתימה.
   */
  async updateDeadline(
    category:
      AvailabilityDeadlineCategory,

    periodId:
      string,

    submissionDeadline:
      string,
  ): Promise<UpdateAvailabilityDeadlineResponse> {
    // normalizedPeriodId — מזהה התקופה.
    const normalizedPeriodId =
      periodId.trim();

    // עצירת הפעולה עם שגיאה כאשר !normalizedPeriodId.
    if (
      !normalizedPeriodId
    ) {
      throw new Error(
        'לא נבחרה תקופת אילוצים לעדכון.',
      );
    }

    // normalizedDeadline — הנתון normalizedDeadline בהקשר הפעולה.
    const normalizedDeadline =
      submissionDeadline
        .trim();

    // עצירת הפעולה עם שגיאה כאשר !normalizedDeadline.
    if (
      !normalizedDeadline
    ) {
      throw new Error(
        'יש לבחור מועד אחרון להגשת האילוצים.',
      );
    }

    const deadline =
      new Date(
        normalizedDeadline,
      );

    // עצירת הפעולה עם שגיאה כאשר Number.isNaN( deadline.getTime(), ).
    if (
      Number.isNaN(
        deadline.getTime(),
      )
    ) {
      throw new Error(
        'מועד ההגשה שנבחר אינו תקין.',
      );
    }

    // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
    const {
      data,
      error,
    } =
      await supabase.rpc(
        'update_availability_submission_deadline',
        {
          requested_category:
            category,

          requested_period_id:
            normalizedPeriodId,

          requested_deadline:
            deadline
              .toISOString(),
        },
      );

    // עצירת הפעולה עם שגיאה כאשר error.
    if (
      error
    ) {
      throw normalizeError(
        error,
      );
    }

    // עצירת הפעולה עם שגיאה כאשר !data || typeof data !== 'object'.
    if (
      !data ||
      typeof data !==
        'object'
    ) {
      throw new Error(
        'לא התקבלה תשובה תקינה לאחר עדכון מועד ההגשה.',
      );
    }

    return data as
      UpdateAvailabilityDeadlineResponse;
  }
}

// availabilityDeadlineService — אילוצים וזמינות / שירות.
export const availabilityDeadlineService =
  new AvailabilityDeadlineService();
