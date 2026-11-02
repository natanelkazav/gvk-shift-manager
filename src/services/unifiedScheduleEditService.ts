/**
 * קובץ: src/services/unifiedScheduleEditService.ts
 * מטרה: ריכוז פעולות עריכת שיבוצים דרך נקודת כניסה אחידה לסוגי הלוחות.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: UnifiedScheduleEditRequest, UnifiedScheduleEditResponse, getFunctionErrorMessage, UnifiedScheduleEditService.
 * - ריכוז פעולות העיבוד והחישוב בהתאם לפונקציות להלן.
 */
import {
  FunctionsHttpError,
} from '@supabase/supabase-js';

import {
  supabase,
} from '../lib/supabase';

import type {
  UnifiedScheduleCategory,
} from '../types/unifiedSchedule';

/**
 * חוזה הנתונים UnifiedScheduleEditRequest: שיבוץ / נתוני הבקשה.
 */
export interface UnifiedScheduleEditRequest {
  category:
    UnifiedScheduleCategory;
  // sourceId — מקור / מזהה.
  sourceId: string;
  // year — שנה.
  year: number;
  // month — חודש.
  month: number;
  // newUserId — מזהה העובד לאחר השינוי.
  newUserId: string;
  reason:
    string | null;
}

/**
 * חוזה הנתונים UnifiedScheduleEditResponse: שיבוץ / תוצאת הפעולה.
 */
export interface UnifiedScheduleEditResponse {
  category:
    UnifiedScheduleCategory;
  // sourceId — מקור / מזהה.
  sourceId: string;
  // newUserId — מזהה העובד לאחר השינוי.
  newUserId:
    string | null;
  // newUserName — משתמש / שם.
  newUserName:
    string | null;
  // notificationIds — התראות.
  notificationIds:
    string[];
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
    // body — תוכן.
    const body =
      await error.context
        .json() as {
          // error — שגיאה (אופציונלי).
          error?: unknown;
        };

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר typeof body.error === 'string' && body.error.trim().
    if (
      typeof body.error ===
        'string' &&
      body.error.trim()
    ) {
      return body.error;
    }
  } catch {
    // Fall back to the default function message.
  }

  return (
    error.message ||
    'עדכון השיבוץ נכשל.'
  );
}

/**
 * איגוד פעולות שיבוץ / שירות במחלקה UnifiedScheduleEditService.
 */
class UnifiedScheduleEditService {
  /**
   * פעולה אסינכרונית updateEntry: עדכון רשומה.
   * @param request — נתוני הבקשה.
   * @returns Promise<UnifiedScheduleEditResponse> — הפלט בהתאם לחתימה.
   */
  async updateEntry(
    request:
      UnifiedScheduleEditRequest,
  ): Promise<UnifiedScheduleEditResponse> {
    // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
    const {
      data,
      error,
    } =
      await supabase.functions
        .invoke(
          'unified-schedule-edit-action',
          {
            body: {
              category:
                request.category,
              sourceId:
                request.sourceId.trim(),
              year:
                request.year,
              month:
                request.month,
              newUserId:
                request.newUserId.trim(),
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
      UnifiedScheduleEditResponse;
  }
}

// unifiedScheduleEditService — שיבוץ / שירות.
export const unifiedScheduleEditService =
  new UnifiedScheduleEditService();
