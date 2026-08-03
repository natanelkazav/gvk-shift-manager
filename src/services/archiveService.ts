import {
  supabase,
} from '../lib/supabase';

import type {
  ArchivePeriodsResponse,
} from '../types/archive';

interface SupabaseErrorShape {
  message?: unknown;

  details?: unknown;

  hint?: unknown;

  code?: unknown;
}

function normalizeArchiveError(
  error: unknown,
): Error {
  console.error(
    'Archive Supabase error:',
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
        part,
      ): part is string =>
        Boolean(part),
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
    'אירעה שגיאה בעת טעינת הארכיון.',
  );
}

function isArchivePeriodsResponse(
  value: unknown,
): value is ArchivePeriodsResponse {
  if (
    typeof value !==
      'object' ||
    value === null
  ) {
    return false;
  }

  const response =
    value as
      Partial<ArchivePeriodsResponse>;

  return (
    Array.isArray(
      response.periods,
    ) &&
    typeof response.count ===
      'number' &&
    typeof response.generatedAt ===
      'string'
  );
}

class ArchiveService {
  async getPeriods():
    Promise<ArchivePeriodsResponse> {
    const {
      data,
      error,
    } =
      await supabase.rpc(
        'get_archive_periods',
      );

    if (error) {
      throw normalizeArchiveError(
        error,
      );
    }

    if (
      !isArchivePeriodsResponse(
        data,
      )
    ) {
      throw new Error(
        'התקבלה תשובה לא תקינה בעת טעינת הארכיון.',
      );
    }

    return data;
  }
}

export const archiveService =
  new ArchiveService();