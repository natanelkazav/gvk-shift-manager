import {
  supabase,
} from '../lib/supabase';

import type {
  StatisticsDashboardRequest,
  StatisticsDashboardResponse,
} from '../types/statistics';

interface SupabaseErrorShape {
  message?: unknown;

  details?: unknown;

  hint?: unknown;

  code?: unknown;
}

function normalizeStatisticsError(
  error: unknown,
): Error {
  console.error(
    'Statistics Supabase error:',
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
    'אירעה שגיאה בעת טעינת הסטטיסטיקות.',
  );
}

function isStatisticsDashboardResponse(
  value: unknown,
): value is StatisticsDashboardResponse {
  if (
    typeof value !==
      'object' ||
    value === null
  ) {
    return false;
  }

  const response =
    value as
      Partial<StatisticsDashboardResponse>;

  return (
    typeof response.filters ===
      'object' &&
    response.filters !==
      null &&
    typeof response.summary ===
      'object' &&
    response.summary !==
      null &&
    Array.isArray(
      response.dispatcherStatistics,
    ) &&
    Array.isArray(
      response.driverStatistics,
    ) &&
    Array.isArray(
      response.monthlyStatistics,
    ) &&
    Array.isArray(
      response.dispatcherMonthlyBreakdown,
    ) &&
    Array.isArray(
      response.driverMonthlyBreakdown,
    ) &&
    typeof response.generatedAt ===
      'string'
  );
}

class StatisticsService {
  async getStatisticsDashboard(
    request:
      StatisticsDashboardRequest,
  ): Promise<StatisticsDashboardResponse> {
    if (
      request.month !==
        null &&
      (
        !Number.isInteger(
          request.month,
        ) ||
        request.month < 1 ||
        request.month > 12
      )
    ) {
      throw new Error(
        'חודש הסטטיסטיקה אינו תקין.',
      );
    }

    if (
      request.year !==
        null &&
      (
        !Number.isInteger(
          request.year,
        ) ||
        request.year < 2020 ||
        request.year > 2100
      )
    ) {
      throw new Error(
        'שנת הסטטיסטיקה אינה תקינה.',
      );
    }

    if (
      request.month !==
        null &&
      request.year ===
        null
    ) {
      throw new Error(
        'יש לבחור שנה כאשר נבחר חודש.',
      );
    }

    const {
      data,
      error,
    } =
      await supabase.rpc(
        'get_statistics_dashboard',
        {
          requested_year:
            request.year,

          requested_month:
            request.month,
        },
      );

    if (error) {
      throw normalizeStatisticsError(
        error,
      );
    }

    if (
      !isStatisticsDashboardResponse(
        data,
      )
    ) {
      throw new Error(
        'התקבלה תשובה לא תקינה ממסך הסטטיסטיקות.',
      );
    }

    return data;
  }
}

export const statisticsService =
  new StatisticsService();