/**
 * קובץ: src/services/scheduleImportExecutionService.ts
 * מטרה: שליחת נתוני הייבוא המאומתים לביצוע במסד ועיבוד סיכום ריצת הייבוא.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: SupabaseErrorShape, normalizeScheduleImportExecutionError, validatePeriodDetails, validateResolvedData, validatePreviewRequest, validateExecutionRequest, ScheduleImportExecutionService.
 * - קריאות RPC המופעלות בקובץ: preview_schedule_excel_import, execute_schedule_excel_import.
 * - ריכוז הפנייה למקור הנתונים ועיבוד התשובה בהתאם לפונקציות להלן.
 */
import {
  supabase,
} from '../lib/supabase';

import type {
  ExecuteScheduleExcelImportRequest,
  ExecuteScheduleExcelImportResponse,
  PreviewScheduleExcelImportRequest,
  PreviewScheduleExcelImportResponse,
} from '../types/scheduleImport';

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
 * פעולה normalizeScheduleImportExecutionError: נרמול שיבוץ / ייבוא / שגיאה.
 * @param error — שגיאה.
 * @returns Error — הפלט בהתאם לחתימה.
 */
function normalizeScheduleImportExecutionError(
  error: unknown,
): Error {
  console.error(
    'Schedule import execution error:',
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
    // databaseError — שגיאה.
    const databaseError =
      error as
        SupabaseErrorShape;

    // errorParts — שגיאה.
    const errorParts = [
      typeof databaseError.message ===
        'string' &&
      databaseError.message.trim()
        ? databaseError.message
        : null,

      typeof databaseError.details ===
        'string' &&
      databaseError.details.trim()
        ? databaseError.details
        : null,

      typeof databaseError.hint ===
        'string' &&
      databaseError.hint.trim()
        ? `Hint: ${databaseError.hint}`
        : null,

      typeof databaseError.code ===
        'string' &&
      databaseError.code.trim()
        ? `Code: ${databaseError.code}`
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
    'אירעה שגיאה בעת ביצוע ייבוא השיבוצים.',
  );
}

/**
 * פעולה validatePeriodDetails: בדיקת תקינות של תקופה.
 * @param request — נתוני הבקשה.
 * @returns void — הפלט בהתאם לחתימה.
 */
function validatePeriodDetails(
  request:
    PreviewScheduleExcelImportRequest,
): void {
  // עצירת הפעולה עם שגיאה כאשר !Number.isInteger( request.year, ) || request.year < 2020 || request.year > 2100.
  if (
    !Number.isInteger(
      request.year,
    ) ||
    request.year < 2020 ||
    request.year > 2100
  ) {
    throw new Error(
      'שנת הייבוא אינה תקינה.',
    );
  }

  // עצירת הפעולה עם שגיאה כאשר !Number.isInteger( request.month, ) || request.month < 1 || request.month > 12.
  if (
    !Number.isInteger(
      request.month,
    ) ||
    request.month < 1 ||
    request.month > 12
  ) {
    throw new Error(
      'חודש הייבוא אינו תקין.',
    );
  }

  // עצירת הפעולה עם שגיאה כאשר request.periodType !== 'historical' && request.periodType !== 'current' && request.periodType !== 'future'.
  if (
    request.periodType !==
      'historical' &&
    request.periodType !==
      'current' &&
    request.periodType !==
      'future'
  ) {
    throw new Error(
      'סוג תקופת הייבוא אינו תקין.',
    );
  }

  // עצירת הפעולה עם שגיאה כאשר request.importStrategy !== 'missing_only' && request.importStrategy !== 'replace' && request.importStrategy !== 'rebuild' && request.importS.
  if (
    request.importStrategy !==
      'missing_only' &&
    request.importStrategy !==
      'replace' &&
    request.importStrategy !==
      'rebuild' &&
    request.importStrategy !==
      'historical_archive'
  ) {
    throw new Error(
      'אסטרטגיית הייבוא אינה תקינה.',
    );
  }
}

/**
 * פעולה validateResolvedData: בדיקת תקינות של נתונים.
 * @param request — נתוני הבקשה.
 * @returns void — הפלט בהתאם לחתימה.
 */
function validateResolvedData(
  request:
    PreviewScheduleExcelImportRequest,
): void {
  // עצירת הפעולה עם שגיאה כאשר request.dispatcherShifts.some( (shift) => !shift.date.trim() || !shift.startTime.trim() || !shift.endTime.trim() || !shift.userId.trim(), ).
  if (
    request.dispatcherShifts.some(
      (shift) =>
        !shift.date.trim() ||
        !shift.startTime.trim() ||
        !shift.endTime.trim() ||
        !shift.userId.trim(),
    )
  ) {
    throw new Error(
      'אחת ממשמרות המוקדנים אינה מכילה את כל הנתונים הדרושים.',
    );
  }

  // עצירת הפעולה עם שגיאה כאשר request.driverDuties.some( (duty) => !duty.date.trim() || !duty.userId.trim(), ).
  if (
    request.driverDuties.some(
      (duty) =>
        !duty.date.trim() ||
        !duty.userId.trim(),
    )
  ) {
    throw new Error(
      'אחת מכוננויות הטכנאים אינה מכילה את כל הנתונים הדרושים.',
    );
  }

  // עצירת הפעולה עם שגיאה כאשר request.morningDriverShifts.some( (shift) => !shift.date.trim() || !shift.startTime.trim() || !shift.endTime.trim() || !shift.userId.trim() .
  if (
    request.morningDriverShifts.some(
      (shift) =>
        !shift.date.trim() ||
        !shift.startTime.trim() ||
        !shift.endTime.trim() ||
        !shift.userId.trim() ||
        !Number.isInteger(
          shift.assignmentSlot,
        ) ||
        shift.assignmentSlot < 1 ||
        shift.assignmentSlot > 2,
    )
  ) {
    throw new Error(
      'אחד משיבוצי כונני הבוקר אינו מכיל את כל הנתונים הדרושים.',
    );
  }
}

/**
 * פעולה validatePreviewRequest: בדיקת תקינות של נתוני הבקשה.
 * @param request — נתוני הבקשה.
 * @returns void — הפלט בהתאם לחתימה.
 */
function validatePreviewRequest(
  request:
    PreviewScheduleExcelImportRequest,
): void {
  validatePeriodDetails(
    request,
  );

  validateResolvedData(
    request,
  );
}

/**
 * פעולה validateExecutionRequest: בדיקת תקינות של נתוני הבקשה.
 * @param request — נתוני הבקשה.
 * @returns void — הפלט בהתאם לחתימה.
 */
function validateExecutionRequest(
  request:
    ExecuteScheduleExcelImportRequest,
): void {
  validatePreviewRequest(
    request,
  );

  // עצירת הפעולה עם שגיאה כאשר !request.fileName.trim().
  if (
    !request.fileName.trim()
  ) {
    throw new Error(
      'שם קובץ הייבוא חסר.',
    );
  }

  // עצירת הפעולה עם שגיאה כאשר !Number.isFinite( request.fileSizeBytes, ) || request.fileSizeBytes < 0.
  if (
    !Number.isFinite(
      request.fileSizeBytes,
    ) ||
    request.fileSizeBytes < 0
  ) {
    throw new Error(
      'גודל קובץ הייבוא אינו תקין.',
    );
  }

  // עצירת הפעולה עם שגיאה כאשר !Array.isArray( request.warnings, ) || request.warnings.some( (warning) => typeof warning !== 'string', ).
  if (
    !Array.isArray(
      request.warnings,
    ) ||
    request.warnings.some(
      (warning) =>
        typeof warning !==
          'string',
    )
  ) {
    throw new Error(
      'רשימת אזהרות הייבוא אינה תקינה.',
    );
  }

  // עצירת הפעולה עם שגיאה כאשר request.periodType === 'future'.
  if (
    request.periodType ===
      'future'
  ) {
    throw new Error(
      'לא ניתן לבצע ייבוא של חודש עתידי.',
    );
  }

}

/**
 * איגוד פעולות שיבוץ / ייבוא / שירות במחלקה ScheduleImportExecutionService.
 */
class ScheduleImportExecutionService {
  /**
   * פעולה אסינכרונית previewImport: ייבוא.
   * הפעולה פונה ל־RPC: preview_schedule_excel_import.
   * @param request — נתוני הבקשה.
   * @returns Promise<PreviewScheduleExcelImportResponse> — הפלט בהתאם לחתימה.
   */
  async previewImport(
    request:
      PreviewScheduleExcelImportRequest,
  ): Promise<PreviewScheduleExcelImportResponse> {
    validatePreviewRequest(
      request,
    );

    // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
    const {
      data,
      error,
    } =
      await supabase.rpc(
        'preview_schedule_excel_import',
        {
          requested_year:
            request.year,

          requested_month:
            request.month,

          requested_period_type:
            request.periodType,

          requested_import_strategy:
            request.importStrategy,

          requested_dispatcher_shifts:
            request.dispatcherShifts,

          requested_driver_duties:
            request.driverDuties,

          requested_morning_driver_shifts:
            request.morningDriverShifts,
        },
      );

    // עצירת הפעולה עם שגיאה כאשר error.
    if (error) {
      throw normalizeScheduleImportExecutionError(
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
        'התקבלה תשובה לא תקינה מסימולציית הייבוא.',
      );
    }

    return data as
      PreviewScheduleExcelImportResponse;
  }

  /**
   * פעולה אסינכרונית executeImport: ייבוא.
   * הפעולה פונה ל־RPC: execute_schedule_excel_import.
   * @param request — נתוני הבקשה.
   * @returns Promise<ExecuteScheduleExcelImportResponse> — הפלט בהתאם לחתימה.
   */
  async executeImport(
    request:
      ExecuteScheduleExcelImportRequest,
  ): Promise<ExecuteScheduleExcelImportResponse> {
    validateExecutionRequest(
      request,
    );

    // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
    const {
      data,
      error,
    } =
      await supabase.rpc(
        'execute_schedule_excel_import',
        {
          requested_file_name:
            request.fileName.trim(),

          requested_file_size_bytes:
            Math.round(
              request.fileSizeBytes,
            ),

          requested_year:
            request.year,

          requested_month:
            request.month,

          requested_period_type:
            request.periodType,

          requested_import_strategy:
            request.importStrategy,

          requested_dispatcher_shifts:
            request.dispatcherShifts,

          requested_driver_duties:
            request.driverDuties,

          requested_morning_driver_shifts:
            request.morningDriverShifts,

          requested_warnings:
            request.warnings,
        },
      );

    // עצירת הפעולה עם שגיאה כאשר error.
    if (error) {
      throw normalizeScheduleImportExecutionError(
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
        'התקבלה תשובה לא תקינה לאחר ביצוע הייבוא.',
      );
    }

    // response — תוצאת הפעולה.
    const response =
      data as
        ExecuteScheduleExcelImportResponse;

    // עצירת הפעולה עם שגיאה כאשר !response.importRunId || !response.schedulePeriodId || !response.driverSchedulePeriodId || !response.morningDriverAvailabilityPeriodId || !r.
    if (
      !response.importRunId ||
      !response.schedulePeriodId ||
      !response.driverSchedulePeriodId ||
      !response.morningDriverAvailabilityPeriodId ||
      !response.morningDriverSchedulePeriodId
    ) {
      throw new Error(
        'תוצאת הייבוא אינה מכילה את מזהי הרשומות שנוצרו.',
      );
    }

    return response;
  }
}

// scheduleImportExecutionService — שיבוץ / ייבוא / שירות.
export const scheduleImportExecutionService =
  new ScheduleImportExecutionService();