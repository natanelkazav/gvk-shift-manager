/**
 * קובץ: src/services/dashboardService.ts
 * מטרה: טעינת נתוני לוח הבקרה לפי סוג המשתמש והמרת נתוני השרת לתצוגה.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: SupabaseErrorShape, normalizeDashboardError, isDashboardResponse, DashboardService.
 * - קריאות RPC המופעלות בקובץ: get_my_dashboard, get_my_morning_driver_dashboard.
 * - ריכוז הפנייה למקור הנתונים ועיבוד התשובה בהתאם לפונקציות להלן.
 */
import {
  supabase,
} from '../lib/supabase';

import type {
  DashboardResponse,
  MorningDriverDashboardData,
} from '../types/dashboard';

/**
 * חוזה הנתונים SupabaseErrorShape: שגיאה.
 */
interface SupabaseErrorShape {
  // message — הודעה (אופציונלי).
  message?: unknown;
  details?: unknown;
  hint?: unknown;
  code?: unknown;
}

/**
 * פעולה normalizeDashboardError: נרמול לוח בקרה / שגיאה.
 * @param error — שגיאה.
 * @returns Error — הפלט בהתאם לחתימה.
 */
function normalizeDashboardError(
  error: unknown,
): Error {
  console.error(
    'Dashboard Supabase error:',
    error,
  );

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר error instanceof Error.
  if (error instanceof Error) {
    return error;
  }

  if (
    typeof error === 'object' &&
    error !== null
  ) {
    // databaseError — שגיאה.
    const databaseError =
      error as SupabaseErrorShape;

    // errorParts — שגיאה.
    const errorParts = [
      typeof databaseError.message === 'string' &&
      databaseError.message.trim()
        ? databaseError.message
        : null,
      typeof databaseError.details === 'string' &&
      databaseError.details.trim()
        ? databaseError.details
        : null,
      typeof databaseError.hint === 'string' &&
      databaseError.hint.trim()
        ? `Hint: ${databaseError.hint}`
        : null,
      typeof databaseError.code === 'string' &&
      databaseError.code.trim()
        ? `Code: ${databaseError.code}`
        : null,
    ].filter(
      (part): part is string =>
        Boolean(part),
    );

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר errorParts.length > 0.
    if (errorParts.length > 0) {
      return new Error(
        errorParts.join(' | '),
      );
    }
  }

  return new Error(
    'אירעה שגיאה בעת טעינת לוח הבקרה.',
  );
}

/**
 * פעולה isDashboardResponse: בדיקת תנאי עבור לוח בקרה / תוצאת הפעולה.
 * @param value — ערך.
 * @returns value is DashboardResponse — הפלט בהתאם לחתימה.
 */
function isDashboardResponse(
  value: unknown,
): value is DashboardResponse {
  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר typeof value !== 'object' || value === null.
  if (
    typeof value !== 'object' ||
    value === null
  ) {
    return false;
  }

  // response — תוצאת הפעולה.
  const response =
    value as Partial<DashboardResponse>;

  return (
    typeof response.user === 'object' &&
    response.user !== null &&
    typeof response.user.id === 'string' &&
    typeof response.user.role === 'string' &&
    typeof response.generatedAt === 'string'
  );
}

/**
 * איגוד פעולות לוח בקרה / שירות במחלקה DashboardService.
 */
class DashboardService {
  /**
   * פעולה אסינכרונית getMyDashboard: שליפה או חישוב של לוח בקרה.
   * הפעולה פונה ל־RPC: get_my_dashboard, get_my_morning_driver_dashboard.
   * @returns Promise<DashboardResponse> — הפלט בהתאם לחתימה.
   */
  async getMyDashboard():
    Promise<DashboardResponse> {
    // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
    const {
      data,
      error,
    } = await supabase.rpc(
      'get_my_dashboard',
    );

    // עצירת הפעולה עם שגיאה כאשר error.
    if (error) {
      throw normalizeDashboardError(
        error,
      );
    }

    // עצירת הפעולה עם שגיאה כאשר !isDashboardResponse(data).
    if (!isDashboardResponse(data)) {
      throw new Error(
        'התקבלה תשובה לא תקינה בעת טעינת לוח הבקרה.',
      );
    }

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר data.user.role === 'morning_driver'.
    if (
      data.user.role ===
      'morning_driver'
    ) {
      // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
      const {
        data:
          morningDriverData,
        error:
          morningDriverError,
      } = await supabase.rpc(
        'get_my_morning_driver_dashboard',
      );

      // עצירת הפעולה עם שגיאה כאשר morningDriverError.
      if (morningDriverError) {
        throw normalizeDashboardError(
          morningDriverError,
        );
      }

      return {
        ...data,
        morningDriver:
          morningDriverData as MorningDriverDashboardData,
      };
    }

    return {
      ...data,
      morningDriver:
        null,
    };
  }
}

// dashboardService — לוח בקרה / שירות.
export const dashboardService =
  new DashboardService();