import {
  FunctionsHttpError,
} from '@supabase/supabase-js';

import {
  supabase,
} from '../lib/supabase';

import type {
  UnifiedScheduleCategory,
} from '../types/unifiedSchedule';

export interface UnifiedScheduleEditRequest {
  category:
    UnifiedScheduleCategory;
  sourceId: string;
  year: number;
  month: number;
  newUserId: string;
  reason:
    string | null;
}

export interface UnifiedScheduleEditResponse {
  category:
    UnifiedScheduleCategory;
  sourceId: string;
  newUserId:
    string | null;
  newUserName:
    string | null;
  notificationIds:
    string[];
}

async function getFunctionErrorMessage(
  error:
    FunctionsHttpError,
): Promise<string> {
  try {
    const body =
      await error.context
        .json() as {
          error?: unknown;
        };

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

class UnifiedScheduleEditService {
  async updateEntry(
    request:
      UnifiedScheduleEditRequest,
  ): Promise<UnifiedScheduleEditResponse> {
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

    if (error) {
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

export const unifiedScheduleEditService =
  new UnifiedScheduleEditService();
