import {
  supabase,
} from '../lib/supabase';

import type {
  DispatcherStatisticsRow,
  DriverStatisticsRow,
  PayrollStatisticsResponse,
  StatisticsDashboardRequest,
  StatisticsDashboardResponse,
  StatisticsSinglePeriodRequest,
} from '../types/statistics';

interface SupabaseErrorShape {
  message?: unknown;
  details?: unknown;
  hint?: unknown;
  code?: unknown;
}

interface LegacyStatisticsResponse
  extends Omit<
    StatisticsDashboardResponse,
    'filters'
  > {
  filters: {
    year: number | null;
    month: number | null;
  };
}

function normalizeStatisticsError(
  error: unknown,
): Error {
  console.error(
    'Statistics Supabase error:',
    error,
  );

  if (error instanceof Error) {
    return error;
  }

  if (
    typeof error === 'object' &&
    error !== null
  ) {
    const databaseError =
      error as SupabaseErrorShape;

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
      (part): part is string =>
        Boolean(part),
    );

    if (errorParts.length > 0) {
      return new Error(
        errorParts.join(' | '),
      );
    }
  }

  return new Error(
    'אירעה שגיאה בעת טעינת הסטטיסטיקות.',
  );
}

function isLegacyStatisticsResponse(
  value: unknown,
): value is LegacyStatisticsResponse {
  if (
    typeof value !== 'object' ||
    value === null
  ) {
    return false;
  }

  const response =
    value as Partial<LegacyStatisticsResponse>;

  return (
    typeof response.filters ===
      'object' &&
    response.filters !== null &&
    typeof response.summary ===
      'object' &&
    response.summary !== null &&
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

function mergeDispatcherRows(
  responses: LegacyStatisticsResponse[],
): DispatcherStatisticsRow[] {
  const rows =
    new Map<
      string,
      DispatcherStatisticsRow
    >();

  for (const response of responses) {
    for (
      const row of
        response.dispatcherStatistics
    ) {
      const current =
        rows.get(row.userId);

      if (!current) {
        rows.set(row.userId, {
          ...row,
        });
        continue;
      }

      current.totalShifts +=
        row.totalShifts;
      current.premiumShifts +=
        row.premiumShifts;
      current.regularShifts +=
        row.regularShifts;
      current.weekdayShifts +=
        row.weekdayShifts;
      current.fridayShifts +=
        row.fridayShifts;
      current.saturdayShifts +=
        row.saturdayShifts;
      current.holidayShifts +=
        row.holidayShifts;
      current.nightShifts +=
        row.nightShifts;
      current.importedShifts +=
        row.importedShifts;
    }
  }

  return Array.from(rows.values())
    .sort(
      (firstRow, secondRow) =>
        secondRow.totalShifts -
        firstRow.totalShifts,
    );
}

function mergeDriverRows(
  responses: LegacyStatisticsResponse[],
): DriverStatisticsRow[] {
  const rows =
    new Map<
      string,
      DriverStatisticsRow
    >();

  for (const response of responses) {
    for (
      const row of
        response.driverStatistics
    ) {
      const current =
        rows.get(row.userId);

      if (!current) {
        rows.set(row.userId, {
          ...row,
        });
        continue;
      }

      current.totalDuties +=
        row.totalDuties;
      current.weekdayDuties +=
        row.weekdayDuties;
      current.fridayDuties +=
        row.fridayDuties;
      current.saturdayDuties +=
        row.saturdayDuties;
      current.weekendDuties +=
        row.weekendDuties;
      current.holidayDuties +=
        row.holidayDuties;
      current.importedDuties +=
        row.importedDuties;
    }
  }

  return Array.from(rows.values())
    .sort(
      (firstRow, secondRow) =>
        secondRow.totalDuties -
        firstRow.totalDuties,
    );
}

function mergeResponses(
  request: StatisticsDashboardRequest,
  responses: LegacyStatisticsResponse[],
): StatisticsDashboardResponse {
  const dispatcherStatistics =
    mergeDispatcherRows(responses);

  const driverStatistics =
    mergeDriverRows(responses);

  const monthlyStatistics =
    responses
      .flatMap(
        (response) =>
          response.monthlyStatistics,
      )
      .filter(
        (
          row,
          index,
          rows,
        ) =>
          rows.findIndex(
            (candidate) =>
              candidate.year ===
                row.year &&
              candidate.month ===
                row.month,
          ) === index,
      )
      .sort(
        (firstRow, secondRow) =>
          firstRow.year -
            secondRow.year ||
          firstRow.month -
            secondRow.month,
      );

  const dispatcherMonthlyBreakdown =
    responses.flatMap(
      (response) =>
        response.dispatcherMonthlyBreakdown,
    );

  const driverMonthlyBreakdown =
    responses.flatMap(
      (response) =>
        response.driverMonthlyBreakdown,
    );

  const total = (
    key:
      keyof LegacyStatisticsResponse['summary'],
  ): number =>
    responses.reduce(
      (sum, response) =>
        sum +
        Number(
          response.summary[key],
        ),
      0,
    );

  return {
    filters: {
      years: [...request.years],
      months: [...request.months],
    },
    summary: {
      dispatcherCount:
        dispatcherStatistics.length,
      driverCount:
        driverStatistics.length,
      totalDispatcherShifts:
        total(
          'totalDispatcherShifts',
        ),
      totalDriverDuties:
        total(
          'totalDriverDuties',
        ),
      premiumShifts:
        total('premiumShifts'),
      regularShifts:
        total('regularShifts'),
      nightShifts:
        total('nightShifts'),
      holidayShifts:
        total('holidayShifts'),
      weekendShifts:
        total('weekendShifts'),
      weekdayDriverDuties:
        total(
          'weekdayDriverDuties',
        ),
      weekendDriverDuties:
        total(
          'weekendDriverDuties',
        ),
      holidayDriverDuties:
        total(
          'holidayDriverDuties',
        ),
    },
    dispatcherStatistics,
    driverStatistics,
    monthlyStatistics,
    dispatcherMonthlyBreakdown,
    driverMonthlyBreakdown,
    generatedAt:
      responses
        .map(
          (response) =>
            response.generatedAt,
        )
        .sort()
        .at(-1) ??
      new Date().toISOString(),
  };
}

class StatisticsService {
  private async getSinglePeriod(
    request:
      StatisticsSinglePeriodRequest,
  ): Promise<LegacyStatisticsResponse> {
    const {
      data,
      error,
    } = await supabase.rpc(
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
      !isLegacyStatisticsResponse(
        data,
      )
    ) {
      throw new Error(
        'התקבלה תשובה לא תקינה ממסך הסטטיסטיקות.',
      );
    }

    return data;
  }

  async getStatisticsDashboard(
    request:
      StatisticsDashboardRequest,
  ): Promise<StatisticsDashboardResponse> {
    const years =
      Array.from(
        new Set(request.years),
      ).sort();

    const months =
      Array.from(
        new Set(request.months),
      ).sort();

    if (
      years.some(
        (year) =>
          !Number.isInteger(year) ||
          year < 2020 ||
          year > 2100,
      )
    ) {
      throw new Error(
        'שנת הסטטיסטיקה אינה תקינה.',
      );
    }

    if (
      months.some(
        (month) =>
          !Number.isInteger(month) ||
          month < 1 ||
          month > 12,
      )
    ) {
      throw new Error(
        'חודש הסטטיסטיקה אינו תקין.',
      );
    }

    if (
      years.length === 0 &&
      months.length > 0
    ) {
      throw new Error(
        'יש לבחור לפחות שנה אחת כאשר נבחרים חודשים ספציפיים.',
      );
    }

    let periods:
      StatisticsSinglePeriodRequest[];

    if (years.length === 0) {
      periods = [
        {
          year: null,
          month: null,
        },
      ];
    } else if (months.length === 0) {
      periods = years.map(
        (year) => ({
          year,
          month: null,
        }),
      );
    } else {
      periods = years.flatMap(
        (year) =>
          months.map(
            (month) => ({
              year,
              month,
            }),
          ),
      );
    }

    const responses =
      await Promise.all(
        periods.map(
          (period) =>
            this.getSinglePeriod(
              period,
            ),
        ),
      );

    return mergeResponses(
      {
        years,
        months,
      },
      responses,
    );
  }

  async getPayrollStatistics(
    request:
      StatisticsDashboardRequest,
  ): Promise<PayrollStatisticsResponse> {
    const {
      data,
      error,
    } = await supabase.rpc(
      'get_payroll_statistics',
      {
        requested_years:
          request.years.length > 0
            ? request.years
            : null,
        requested_months:
          request.months.length > 0
            ? request.months
            : null,
      },
    );

    if (error) {
      throw normalizeStatisticsError(
        error,
      );
    }

    if (
      typeof data !== 'object' ||
      data === null
    ) {
      throw new Error(
        'התקבלה תשובה לא תקינה מנתוני השכר.',
      );
    }

    return data as PayrollStatisticsResponse;
  }
}

export const statisticsService =
  new StatisticsService();
