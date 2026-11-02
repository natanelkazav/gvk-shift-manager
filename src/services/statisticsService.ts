/**
 * קובץ: src/services/statisticsService.ts
 * מטרה: טעינת נתוני סטטיסטיקה ועיבודם לתצוגות סיכום והשוואה.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: SupabaseErrorShape, LegacyStatisticsResponse, DispatcherAvailabilityStatisticsResponse, MorningDriverStatisticsResponse, ShiftTimeDistributionStatisticsResponse, CombinedSinglePeriodResponse, normalizeStatisticsError, isLegacyStatisticsResponse, isDispatcherAvailabilityStatisticsResponse, mergeDispatcherRows ועוד.
 * - קריאות RPC המופעלות בקובץ: get_statistics_people, get_statistics_dashboard, get_dispatcher_availability_statistics, get_morning_driver_statistics, get_shift_time_distribution_statistics, get_payroll_statistics.
 * - ריכוז הפנייה למקור הנתונים ועיבוד התשובה בהתאם לפונקציות להלן.
 */
import {
  supabase,
} from '../lib/supabase';

import type {
  DispatcherAvailabilityMonthlyRow,
  DispatcherAvailabilityStatisticsRow,
  DispatcherAvailabilityStatisticsSummary,
  DispatcherStatisticsRow,
  DriverStatisticsRow,
  MorningDriverMonthlyBreakdownRow,
  MorningDriverStatisticsRow,
  PayrollStatisticsResponse,
  StatisticsDashboardRequest,
  StatisticsDashboardResponse,
  StatisticsSinglePeriodRequest,
  StatisticsPersonOption,
  ShiftTimeDistributionRow,
} from '../types/statistics';

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
 * חוזה הנתונים LegacyStatisticsResponse: סטטיסטיקה / תוצאת הפעולה.
 */
interface LegacyStatisticsResponse
  extends Omit<
    StatisticsDashboardResponse,
    | 'filters'
    | 'dispatcherAvailabilitySummary'
    | 'dispatcherAvailabilityStatistics'
    | 'dispatcherAvailabilityMonthlyBreakdown'
    | 'morningDriverStatistics'
    | 'morningDriverMonthlyBreakdown'
    | 'dispatcherShiftTimeDistribution'
    | 'morningDriverShiftTimeDistribution'
  > {
  // filters — מסננים.
  filters: {
    // year — שנה.
    year: number | null;
    // month — חודש.
    month: number | null;
  };
}


/**
 * חוזה הנתונים DispatcherAvailabilityStatisticsResponse: מוקדנים / אילוצים וזמינות / סטטיסטיקה / תוצאת הפעולה.
 */
interface DispatcherAvailabilityStatisticsResponse {
  // summary — סיכום.
  summary: DispatcherAvailabilityStatisticsSummary;
  // dispatcherStatistics — מוקדנים / סטטיסטיקה.
  dispatcherStatistics: DispatcherAvailabilityStatisticsRow[];
  monthlyBreakdown: DispatcherAvailabilityMonthlyRow[];
  generatedAt: string;
}

/**
 * חוזה הנתונים MorningDriverStatisticsResponse: כונני בוקר.
 */
interface MorningDriverStatisticsResponse {
  // statistics — סטטיסטיקה.
  statistics: MorningDriverStatisticsRow[];
  monthlyBreakdown: MorningDriverMonthlyBreakdownRow[];
  generatedAt: string;
}

/**
 * חוזה הנתונים ShiftTimeDistributionStatisticsResponse: משמרת / זמן / סטטיסטיקה / תוצאת הפעולה.
 */
interface ShiftTimeDistributionStatisticsResponse {
  dispatchers: ShiftTimeDistributionRow[];
  // morningDrivers — כונני בוקר.
  morningDrivers: ShiftTimeDistributionRow[];
  generatedAt: string;
}

/**
 * חוזה הנתונים CombinedSinglePeriodResponse: תקופה / תוצאת הפעולה.
 */
interface CombinedSinglePeriodResponse extends LegacyStatisticsResponse {
  // dispatcherAvailabilitySummary — מוקדנים / אילוצים וזמינות / סיכום.
  dispatcherAvailabilitySummary: DispatcherAvailabilityStatisticsSummary;
  // dispatcherAvailabilityStatistics — מוקדנים / אילוצים וזמינות / סטטיסטיקה.
  dispatcherAvailabilityStatistics: DispatcherAvailabilityStatisticsRow[];
  // dispatcherAvailabilityMonthlyBreakdown — מוקדנים / אילוצים וזמינות.
  dispatcherAvailabilityMonthlyBreakdown: DispatcherAvailabilityMonthlyRow[];
  // morningDriverStatistics — כונני בוקר.
  morningDriverStatistics: MorningDriverStatisticsRow[];
  // morningDriverMonthlyBreakdown — כונני בוקר.
  morningDriverMonthlyBreakdown: MorningDriverMonthlyBreakdownRow[];
  // dispatcherShiftTimeDistribution — מוקדנים / משמרת / זמן.
  dispatcherShiftTimeDistribution: ShiftTimeDistributionRow[];
  // morningDriverShiftTimeDistribution — כונני בוקר.
  morningDriverShiftTimeDistribution: ShiftTimeDistributionRow[];
}

/**
 * פעולה normalizeStatisticsError: נרמול סטטיסטיקה / שגיאה.
 * @param error — שגיאה.
 * @returns Error — הפלט בהתאם לחתימה.
 */
function normalizeStatisticsError(
  error: unknown,
): Error {
  console.error(
    'Statistics Supabase error:',
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

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר errorParts.length > 0.
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

/**
 * פעולה isLegacyStatisticsResponse: בדיקת תנאי עבור סטטיסטיקה / תוצאת הפעולה.
 * @param value — ערך.
 * @returns value is LegacyStatisticsResponse — הפלט בהתאם לחתימה.
 */
function isLegacyStatisticsResponse(
  value: unknown,
): value is LegacyStatisticsResponse {
  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר typeof value !== 'object' || value === null.
  if (
    typeof value !== 'object' ||
    value === null
  ) {
    return false;
  }

  // response — תוצאת הפעולה.
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

/**
 * פעולה isDispatcherAvailabilityStatisticsResponse: בדיקת תנאי עבור מוקדנים / אילוצים וזמינות / סטטיסטיקה / תוצאת הפעולה.
 * @param value — ערך.
 * @returns value is DispatcherAvailabilityStatisticsResponse — הפלט בהתאם לחתימה.
 */
function isDispatcherAvailabilityStatisticsResponse(
  value: unknown,
): value is DispatcherAvailabilityStatisticsResponse {
  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר typeof value !== 'object' || value === null.
  if (
    typeof value !== 'object' ||
    value === null
  ) {
    return false;
  }

  // response — תוצאת הפעולה.
  const response =
    value as Partial<DispatcherAvailabilityStatisticsResponse>;

  return (
    typeof response.summary === 'object' &&
    response.summary !== null &&
    Array.isArray(response.dispatcherStatistics) &&
    Array.isArray(response.monthlyBreakdown) &&
    typeof response.generatedAt === 'string'
  );
}

/**
 * פעולה mergeDispatcherRows: איחוד מוקדנים / שורות.
 * @param responses — הנתון responses בהקשר הפעולה.
 * @returns DispatcherStatisticsRow[] — הפלט בהתאם לחתימה.
 */
function mergeDispatcherRows(
  responses: LegacyStatisticsResponse[],
): DispatcherStatisticsRow[] {
  // rows — שורות; מיפוי לחיפוש לפי מפתח.
  const rows =
    new Map<
      string,
      DispatcherStatisticsRow
    >();

  // עיבוד כל פריט מתוך responses בנפרד.
  for (const response of responses) {
    // עיבוד כל פריט מתוך response.dispatcherStatistics בנפרד.
    for (
      const row of
        response.dispatcherStatistics
    ) {
      // current — הנתון current בהקשר הפעולה.
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

/**
 * פעולה mergeDriverRows: איחוד כוננים / שורות.
 * @param responses — הנתון responses בהקשר הפעולה.
 * @returns DriverStatisticsRow[] — הפלט בהתאם לחתימה.
 */
function mergeDriverRows(
  responses: LegacyStatisticsResponse[],
): DriverStatisticsRow[] {
  // rows — שורות; מיפוי לחיפוש לפי מפתח.
  const rows =
    new Map<
      string,
      DriverStatisticsRow
    >();

  // עיבוד כל פריט מתוך responses בנפרד.
  for (const response of responses) {
    // עיבוד כל פריט מתוך response.driverStatistics בנפרד.
    for (
      const row of
        response.driverStatistics
    ) {
      // current — הנתון current בהקשר הפעולה.
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

/**
 * פעולה mergeShiftTimeDistributionRows: איחוד משמרת / זמן / שורות.
 * @param responses — הנתון responses בהקשר הפעולה.
 * @returns ShiftTimeDistributionRow[] — הפלט בהתאם לחתימה.
 */
function mergeShiftTimeDistributionRows(
  responses: ShiftTimeDistributionRow[][],
): ShiftTimeDistributionRow[] {
  // rows — שורות; מיפוי לחיפוש לפי מפתח.
  const rows = new Map<string, ShiftTimeDistributionRow>();

  // עיבוד כל פריט מתוך responses בנפרד.
  for (const responseRows of responses) {
    // עיבוד כל פריט מתוך responseRows בנפרד.
    for (const row of responseRows) {
      // key — מפתח.
      const key = `${row.userId}::${row.shiftTime}`;
      // current — הנתון current בהקשר הפעולה.
      const current = rows.get(key);

      if (!current) {
        rows.set(key, { ...row });
        continue;
      }

      current.shiftCount += row.shiftCount;
    }
  }

  return Array.from(rows.values()).sort(
    (firstRow, secondRow) =>
      firstRow.displayName.localeCompare(secondRow.displayName, 'he') ||
      firstRow.shiftTime.localeCompare(secondRow.shiftTime),
  );
}

/**
 * פעולה mergeResponses: איחוד הנתון mergeResponses בהקשר הפעולה.
 * @param request — נתוני הבקשה.
 * @param responses — הנתון responses בהקשר הפעולה.
 * @returns StatisticsDashboardResponse — הפלט בהתאם לחתימה.
 */
function mergeResponses(
  request: StatisticsDashboardRequest,
  responses: CombinedSinglePeriodResponse[],
): StatisticsDashboardResponse {
  // dispatcherStatistics — מוקדנים / סטטיסטיקה.
  const dispatcherStatistics =
    mergeDispatcherRows(responses);

  // driverStatistics — כוננים / סטטיסטיקה.
  const driverStatistics =
    mergeDriverRows(responses);

  // availabilityRows — אילוצים וזמינות / שורות; מיפוי לחיפוש לפי מפתח.
  const availabilityRows =
    new Map<string, DispatcherAvailabilityStatisticsRow>();

  // עיבוד כל פריט מתוך responses בנפרד.
  for (const response of responses) {
    // עיבוד כל פריט מתוך response.dispatcherAvailabilityStatistics בנפרד.
    for (const row of response.dispatcherAvailabilityStatistics) {
      // current — הנתון current בהקשר הפעולה.
      const current = availabilityRows.get(row.userId);

      if (!current) {
        availabilityRows.set(row.userId, { ...row });
        continue;
      }

      current.periodCount += row.periodCount;
      current.manualSubmissionPeriods += row.manualSubmissionPeriods;
      current.autoPartialPeriods += row.autoPartialPeriods;
      current.noSubmissionPeriods += row.noSubmissionPeriods;
      current.declaredAvailableCount += row.declaredAvailableCount;
      current.declaredUnavailableCount += row.declaredUnavailableCount;
      current.autoCompletedAvailableCount += row.autoCompletedAvailableCount;
      current.fridayMorningAvailableCount += row.fridayMorningAvailableCount;
      current.fridayAfternoonAvailableCount += row.fridayAfternoonAvailableCount;
      current.fridayNightAvailableCount += row.fridayNightAvailableCount;
      current.saturdayMorningAvailableCount += row.saturdayMorningAvailableCount;
      current.saturdayAfternoonAvailableCount += row.saturdayAfternoonAvailableCount;
      current.saturdayNightAvailableCount += row.saturdayNightAvailableCount;
      current.nightAvailableCount += row.nightAvailableCount;
      current.premiumAvailableCount += row.premiumAvailableCount;
      current.holidayAvailableCount += row.holidayAvailableCount;
      current.weekendAvailableCount += row.weekendAvailableCount;

      // declaredTotal — סך הכול.
      const declaredTotal =
        current.declaredAvailableCount +
        current.declaredUnavailableCount;

      current.declaredAvailabilityRate =
        declaredTotal > 0
          ? Math.round(
              (current.declaredAvailableCount / declaredTotal) * 1000,
            ) / 10
          : 0;
    }
  }

  // dispatcherAvailabilityStatistics — מוקדנים / אילוצים וזמינות / סטטיסטיקה.
  const dispatcherAvailabilityStatistics =
    Array.from(availabilityRows.values()).sort(
      (firstRow, secondRow) =>
        secondRow.declaredAvailableCount -
          firstRow.declaredAvailableCount ||
        firstRow.displayName.localeCompare(secondRow.displayName, 'he'),
    );

  // dispatcherAvailabilityMonthlyBreakdown — מוקדנים / אילוצים וזמינות.
  const dispatcherAvailabilityMonthlyBreakdown =
    responses.flatMap(
      (response) =>
        response.dispatcherAvailabilityMonthlyBreakdown,
    );

  /**
   * פעולה availabilityTotal: אילוצים וזמינות / סך הכול.
   * @param key — מפתח.
   * @returns number — הפלט בהתאם לחתימה.
   */
  const availabilityTotal = (
    key: keyof DispatcherAvailabilityStatisticsSummary,
  ): number =>
    responses.reduce(
      (sum, response) =>
        sum + Number(response.dispatcherAvailabilitySummary[key]),
      0,
    );

  // dispatcherAvailabilitySummary — מוקדנים / אילוצים וזמינות / סיכום.
  const dispatcherAvailabilitySummary: DispatcherAvailabilityStatisticsSummary = {
    periodCount: availabilityTotal('periodCount'),
    dispatcherCount: dispatcherAvailabilityStatistics.length,
    manualSubmissionPeriods: availabilityTotal('manualSubmissionPeriods'),
    autoPartialPeriods: availabilityTotal('autoPartialPeriods'),
    noSubmissionPeriods: availabilityTotal('noSubmissionPeriods'),
    declaredAvailableCount: availabilityTotal('declaredAvailableCount'),
    declaredUnavailableCount: availabilityTotal('declaredUnavailableCount'),
    autoCompletedAvailableCount: availabilityTotal('autoCompletedAvailableCount'),
    fridayMorningAvailableCount: availabilityTotal('fridayMorningAvailableCount'),
    nightAvailableCount: availabilityTotal('nightAvailableCount'),
    premiumAvailableCount: availabilityTotal('premiumAvailableCount'),
    holidayAvailableCount: availabilityTotal('holidayAvailableCount'),
  };

  // monthlyStatistics — סטטיסטיקה.
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

  // dispatcherMonthlyBreakdown — מוקדנים.
  const dispatcherMonthlyBreakdown =
    responses.flatMap(
      (response) =>
        response.dispatcherMonthlyBreakdown,
    );

  // driverMonthlyBreakdown — כוננים.
  const driverMonthlyBreakdown =
    responses.flatMap(
      (response) =>
        response.driverMonthlyBreakdown,
    );

  // morningRows — שורות; מיפוי לחיפוש לפי מפתח.
  const morningRows = new Map<string, MorningDriverStatisticsRow>();

  // עיבוד כל פריט מתוך responses בנפרד.
  for (const response of responses) {
    // עיבוד כל פריט מתוך response.morningDriverStatistics בנפרד.
    for (const row of response.morningDriverStatistics) {
      // current — הנתון current בהקשר הפעולה.
      const current = morningRows.get(row.userId);
      if (!current) {
        morningRows.set(row.userId, { ...row });
        continue;
      }
      current.totalShifts += row.totalShifts;
      current.morningShifts += row.morningShifts;
      current.afternoonShifts += row.afternoonShifts;
      current.eveningShifts += row.eveningShifts;
      current.fridayShifts += row.fridayShifts;
      current.weekendShifts += row.weekendShifts;
    }
  }

  // morningDriverStatistics — כונני בוקר.
  const morningDriverStatistics = Array.from(morningRows.values())
    .sort((a, b) => b.totalShifts - a.totalShifts);

  // morningDriverMonthlyBreakdown — כונני בוקר.
  const morningDriverMonthlyBreakdown = responses.flatMap(
    (response) => response.morningDriverMonthlyBreakdown,
  );

  // dispatcherShiftTimeDistribution — מוקדנים / משמרת / זמן.
  const dispatcherShiftTimeDistribution =
    mergeShiftTimeDistributionRows(
      responses.map((response) => response.dispatcherShiftTimeDistribution),
    );

  // morningDriverShiftTimeDistribution — כונני בוקר.
  const morningDriverShiftTimeDistribution =
    mergeShiftTimeDistributionRows(
      responses.map((response) => response.morningDriverShiftTimeDistribution),
    );

  /**
   * פעולה total: סך הכול.
   * @param key — מפתח.
   * @returns number — הפלט בהתאם לחתימה.
   */
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
    morningDriverStatistics,
    monthlyStatistics,
    dispatcherMonthlyBreakdown,
    driverMonthlyBreakdown,
    morningDriverMonthlyBreakdown,
    dispatcherShiftTimeDistribution,
    morningDriverShiftTimeDistribution,
    dispatcherAvailabilitySummary,
    dispatcherAvailabilityStatistics,
    dispatcherAvailabilityMonthlyBreakdown,
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

/**
 * איגוד פעולות סטטיסטיקה / שירות במחלקה StatisticsService.
 */
class StatisticsService {

  /**
   * פעולה אסינכרונית getStatisticsPeople: שליפה או חישוב של סטטיסטיקה.
   * הפעולה פונה ל־RPC: get_statistics_people.
   * @returns Promise<StatisticsPersonOption[]> — הפלט בהתאם לחתימה.
   */
  async getStatisticsPeople(): Promise<StatisticsPersonOption[]> {
    // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
    const { data, error } = await supabase.rpc(
      'get_statistics_people',
    );

    // עצירת הפעולה עם שגיאה כאשר error.
    if (error) {
      throw normalizeStatisticsError(error);
    }

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !Array.isArray(data).
    if (!Array.isArray(data)) {
      return [];
    }

    return data.flatMap((item): StatisticsPersonOption[] => {
      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר typeof item !== 'object' || item === null.
      if (typeof item !== 'object' || item === null) {
        return [];
      }

      // row — שורה.
      const row = item as Record<string, unknown>;
      // userType — משתמש.
      const userType = row.userType;
      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר typeof row.userId !== 'string' || typeof row.displayName !== 'string' || (userType !== 'dispatchers' && userType !== 'drivers' && userType !.
      if (
        typeof row.userId !== 'string' ||
        typeof row.displayName !== 'string' ||
        (userType !== 'dispatchers' &&
          userType !== 'drivers' &&
          userType !== 'morning_drivers')
      ) {
        return [];
      }

      return [{
        userId: row.userId,
        displayName: row.displayName,
        scheduleName: typeof row.scheduleName === 'string'
          ? row.scheduleName
          : null,
        userType,
        isActive: row.isActive !== false,
      }];
    });
  }

  /**
   * פעולה אסינכרונית getSinglePeriod: שליפה או חישוב של תקופה.
   * הפעולה פונה ל־RPC: get_statistics_dashboard, get_dispatcher_availability_statistics, get_morning_driver_statistics, get_shift_time_distribution_statistics.
   * @param request — נתוני הבקשה.
   * @returns Promise<CombinedSinglePeriodResponse> — הפלט בהתאם לחתימה.
   */
  private async getSinglePeriod(
    request:
      StatisticsSinglePeriodRequest,
  ): Promise<CombinedSinglePeriodResponse> {
    const [
      scheduleResult,
      availabilityResult,
      morningDriverResult,
      shiftTimeDistributionResult,
    ] = await Promise.all([
      supabase.rpc(
        'get_statistics_dashboard',
        {
          requested_year: request.year,
          requested_month: request.month,
        },
      ),
      supabase.rpc(
        'get_dispatcher_availability_statistics',
        {
          requested_year: request.year,
          requested_month: request.month,
        },
      ),
      supabase.rpc(
        'get_morning_driver_statistics',
        {
          requested_year: request.year,
          requested_month: request.month,
        },
      ),
      supabase.rpc(
        'get_shift_time_distribution_statistics',
        {
          requested_year: request.year,
          requested_month: request.month,
        },
      ),
    ]);

    // עצירת הפעולה עם שגיאה כאשר scheduleResult.error.
    if (scheduleResult.error) {
      throw normalizeStatisticsError(scheduleResult.error);
    }

    // עצירת הפעולה עם שגיאה כאשר availabilityResult.error.
    if (availabilityResult.error) {
      throw normalizeStatisticsError(availabilityResult.error);
    }

    // עצירת הפעולה עם שגיאה כאשר morningDriverResult.error.
    if (morningDriverResult.error) {
      throw normalizeStatisticsError(morningDriverResult.error);
    }

    // עצירת הפעולה עם שגיאה כאשר shiftTimeDistributionResult.error.
    if (shiftTimeDistributionResult.error) {
      throw normalizeStatisticsError(shiftTimeDistributionResult.error);
    }

    // עצירת הפעולה עם שגיאה כאשר !isLegacyStatisticsResponse(scheduleResult.data).
    if (!isLegacyStatisticsResponse(scheduleResult.data)) {
      throw new Error(
        'התקבלה תשובה לא תקינה ממסך הסטטיסטיקות.',
      );
    }

    // עצירת הפעולה עם שגיאה כאשר !isDispatcherAvailabilityStatisticsResponse( availabilityResult.data, ).
    if (
      !isDispatcherAvailabilityStatisticsResponse(
        availabilityResult.data,
      )
    ) {
      throw new Error(
        'התקבלה תשובה לא תקינה מנתוני אילוצי המוקדנים.',
      );
    }

    // morningData — נתונים.
    const morningData = morningDriverResult.data as MorningDriverStatisticsResponse | null;
    // עצירת הפעולה עם שגיאה כאשר !morningData || !Array.isArray(morningData.statistics) || !Array.isArray(morningData.monthlyBreakdown).
    if (
      !morningData ||
      !Array.isArray(morningData.statistics) ||
      !Array.isArray(morningData.monthlyBreakdown)
    ) {
      throw new Error('התקבלה תשובה לא תקינה מנתוני כונני הבוקר.');
    }

    // shiftTimeData — משמרת / זמן / נתונים.
    const shiftTimeData =
      shiftTimeDistributionResult.data as ShiftTimeDistributionStatisticsResponse | null;

    // עצירת הפעולה עם שגיאה כאשר !shiftTimeData || !Array.isArray(shiftTimeData.dispatchers) || !Array.isArray(shiftTimeData.morningDrivers).
    if (
      !shiftTimeData ||
      !Array.isArray(shiftTimeData.dispatchers) ||
      !Array.isArray(shiftTimeData.morningDrivers)
    ) {
      throw new Error('התקבלה תשובה לא תקינה מנתוני חלוקת שעות המשמרות.');
    }

    return {
      ...scheduleResult.data,
      dispatcherAvailabilitySummary:
        availabilityResult.data.summary,
      dispatcherAvailabilityStatistics:
        availabilityResult.data.dispatcherStatistics,
      dispatcherAvailabilityMonthlyBreakdown:
        availabilityResult.data.monthlyBreakdown,
      morningDriverStatistics: morningData.statistics,
      morningDriverMonthlyBreakdown: morningData.monthlyBreakdown,
      dispatcherShiftTimeDistribution: shiftTimeData.dispatchers,
      morningDriverShiftTimeDistribution: shiftTimeData.morningDrivers,
    };
  }

  /**
   * פעולה אסינכרונית getStatisticsDashboard: שליפה או חישוב של סטטיסטיקה / לוח בקרה.
   * @param request — נתוני הבקשה.
   * @returns Promise<StatisticsDashboardResponse> — הפלט בהתאם לחתימה.
   */
  async getStatisticsDashboard(
    request:
      StatisticsDashboardRequest,
  ): Promise<StatisticsDashboardResponse> {
    // years — שנים.
    const years =
      Array.from(
        new Set(request.years),
      ).sort();

    // months — חודשים.
    const months =
      Array.from(
        new Set(request.months),
      ).sort();

    // עצירת הפעולה עם שגיאה כאשר years.some( (year) => !Number.isInteger(year) || year < 2020 || year > 2100, ).
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

    // עצירת הפעולה עם שגיאה כאשר months.some( (month) => !Number.isInteger(month) || month < 1 || month > 12, ).
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

    // עצירת הפעולה עם שגיאה כאשר years.length === 0 && months.length > 0.
    if (
      years.length === 0 &&
      months.length > 0
    ) {
      throw new Error(
        'יש לבחור לפחות שנה אחת כאשר נבחרים חודשים ספציפיים.',
      );
    }

    // periods — תקופות.
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

  /**
   * פעולה אסינכרונית getPayrollStatistics: שליפה או חישוב של חישובי שכר / סטטיסטיקה.
   * הפעולה פונה ל־RPC: get_payroll_statistics.
   * @param request — נתוני הבקשה.
   * @returns Promise<PayrollStatisticsResponse> — הפלט בהתאם לחתימה.
   */
  async getPayrollStatistics(
    request:
      StatisticsDashboardRequest,
  ): Promise<PayrollStatisticsResponse> {
    // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
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

    // עצירת הפעולה עם שגיאה כאשר error.
    if (error) {
      throw normalizeStatisticsError(
        error,
      );
    }

    // עצירת הפעולה עם שגיאה כאשר typeof data !== 'object' || data === null.
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

// statisticsService — סטטיסטיקה / שירות.
export const statisticsService =
  new StatisticsService();
