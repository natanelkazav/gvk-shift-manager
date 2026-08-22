import {
  supabase,
} from '../lib/supabase';

import type {
  ExecuteScheduleExcelImportRequest,
  ExecuteScheduleExcelImportResponse,
  PreviewScheduleExcelImportRequest,
  PreviewScheduleExcelImportResponse,
} from '../types/scheduleImport';

interface SupabaseErrorShape {
  message?: unknown;

  details?: unknown;

  hint?: unknown;

  code?: unknown;
}

function normalizeScheduleImportExecutionError(
  error: unknown,
): Error {
  console.error(
    'Schedule import execution error:',
    error,
  );

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
    const databaseError =
      error as
        SupabaseErrorShape;

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

function validatePeriodDetails(
  request:
    PreviewScheduleExcelImportRequest,
): void {
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

function validateResolvedData(
  request:
    PreviewScheduleExcelImportRequest,
): void {
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

function validateExecutionRequest(
  request:
    ExecuteScheduleExcelImportRequest,
): void {
  validatePreviewRequest(
    request,
  );

  if (
    !request.fileName.trim()
  ) {
    throw new Error(
      'שם קובץ הייבוא חסר.',
    );
  }

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

  if (
    request.periodType ===
      'future'
  ) {
    throw new Error(
      'לא ניתן לבצע ייבוא של חודש עתידי.',
    );
  }

}

class ScheduleImportExecutionService {
  async previewImport(
    request:
      PreviewScheduleExcelImportRequest,
  ): Promise<PreviewScheduleExcelImportResponse> {
    validatePreviewRequest(
      request,
    );

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

    if (error) {
      throw normalizeScheduleImportExecutionError(
        error,
      );
    }

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

  async executeImport(
    request:
      ExecuteScheduleExcelImportRequest,
  ): Promise<ExecuteScheduleExcelImportResponse> {
    validateExecutionRequest(
      request,
    );

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

    if (error) {
      throw normalizeScheduleImportExecutionError(
        error,
      );
    }

    if (
      !data ||
      typeof data !==
        'object'
    ) {
      throw new Error(
        'התקבלה תשובה לא תקינה לאחר ביצוע הייבוא.',
      );
    }

    const response =
      data as
        ExecuteScheduleExcelImportResponse;

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

export const scheduleImportExecutionService =
  new ScheduleImportExecutionService();