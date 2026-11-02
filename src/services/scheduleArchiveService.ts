/**
 * קובץ: src/services/scheduleArchiveService.ts
 * מטרה: ניהול פעולות ארכוב ושליחת לוחות שיבוצים.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: SendScheduleArchiveResponse, FunctionErrorResponse, blobToBase64, getFunctionErrorMessage, ScheduleArchiveService.
 * - ריכוז פעולות העיבוד והחישוב בהתאם לפונקציות להלן.
 */
import {
  supabase,
} from '../lib/supabase';

/**
 * חוזה הנתונים SendScheduleArchiveResponse: שיבוץ / ארכיון / תוצאת הפעולה.
 */
interface SendScheduleArchiveResponse {
  success: boolean;
  // emailId — כתובת דוא״ל / מזהה.
  emailId: string | null;
  // auditLogged — יומן שינויים.
  auditLogged: boolean;
}

/**
 * חוזה הנתונים FunctionErrorResponse: שגיאה / תוצאת הפעולה.
 */
interface FunctionErrorResponse {
  // error — שגיאה (אופציונלי).
  error?: string;
}

/**
 * פעולה אסינכרונית blobToBase64: הנתון blobToBase64 בהקשר הפעולה.
 * @param blob — הנתון blob בהקשר הפעולה.
 * @returns Promise<string> — הפלט בהתאם לחתימה.
 */
async function blobToBase64(
  blob: Blob,
): Promise<string> {
  // buffer — מאגר בינארי.
  const buffer =
    await blob
      .arrayBuffer();

  const bytes =
    new Uint8Array(
      buffer,
    );

  const chunkSize =
    0x8000;

  let binary =
    '';

  for (
    let offset = 0;
    offset < bytes.length;
    offset +=
      chunkSize
  ) {
    const chunk =
      bytes.subarray(
        offset,
        Math.min(
          offset +
            chunkSize,
          bytes.length,
        ),
      );

    binary +=
      String.fromCharCode(
        ...chunk,
      );
  }

  return window.btoa(
    binary,
  );
}

/**
 * פעולה אסינכרונית getFunctionErrorMessage: שליפה או חישוב של הודעת שגיאה.
 * @param error — שגיאה.
 * @returns Promise<string> — הפלט בהתאם לחתימה.
 */
async function getFunctionErrorMessage(
  error: unknown,
): Promise<string> {
  if (
    typeof error ===
      'object' &&
    error !==
      null &&
    'context' in
      error
  ) {
    const context =
      (
        error as {
          context?:
            Response;
        }
      ).context;

    if (
      context instanceof
        Response
    ) {
      // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
      try {
        // body — תוכן.
        const body =
          await context
            .json() as
            FunctionErrorResponse;

        // טיפול במקרה מיוחד ויציאה מוקדמת כאשר body.error.
        if (
          body.error
        ) {
          return body.error;
        }
      } catch {
        // Use the generic message below.
      }
    }
  }

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר error instanceof Error && error.message .trim().
  if (
    error instanceof
      Error &&
    error.message
      .trim()
  ) {
    return error.message;
  }

  return 'לא ניתן היה לשלוח את קובץ השיבוצים.';
}

/**
 * איגוד פעולות שיבוץ / ארכיון / שירות במחלקה ScheduleArchiveService.
 */
class ScheduleArchiveService {
  /**
   * פעולה אסינכרונית sendScheduleFile: שליחת שיבוץ / קובץ.
   * @param blob — הנתון blob בהקשר הפעולה.
   * @param fileName — קובץ / שם.
   * @param year — שנה.
   * @param month — חודש.
   * @returns Promise<SendScheduleArchiveResponse> — הפלט בהתאם לחתימה.
   */
  async sendScheduleFile(
    blob: Blob,
    fileName: string,
    year: number,
    month: number,
  ): Promise<SendScheduleArchiveResponse> {
    // עצירת הפעולה עם שגיאה כאשר blob.size === 0.
    if (
      blob.size ===
        0
    ) {
      throw new Error(
        'קובץ השיבוצים שנוצר ריק.',
      );
    }

    /*
     * קובץ שיבוצים אמור להיות קטן משמעותית.
     * המגבלה מונעת שליחת payload חריג בטעות.
     */
    // עצירת הפעולה עם שגיאה כאשר blob.size > 8 * 1024 * 1024.
    if (
      blob.size >
        8 *
        1024 *
        1024
    ) {
      throw new Error(
        'קובץ השיבוצים גדול מדי לשליחה אוטומטית.',
      );
    }

    // fileBase64 — קובץ.
    const fileBase64 =
      await blobToBase64(
        blob,
      );

    // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
    const {
      data,
      error,
    } =
      await supabase.functions
        .invoke<
          SendScheduleArchiveResponse
        >(
          'send-schedule-archive',
          {
            body: {
              fileName,
              fileBase64,
              year,
              month,
            },
          },
        );

    // עצירת הפעולה עם שגיאה כאשר error.
    if (
      error
    ) {
      throw new Error(
        await getFunctionErrorMessage(
          error,
        ),
      );
    }

    // עצירת הפעולה עם שגיאה כאשר !data || data.success !== true.
    if (
      !data ||
      data.success !==
        true
    ) {
      throw new Error(
        'השרת לא אישר שהמייל נשלח.',
      );
    }

    return data;
  }
}

// scheduleArchiveService — שיבוץ / ארכיון / שירות.
export const scheduleArchiveService =
  new ScheduleArchiveService();
