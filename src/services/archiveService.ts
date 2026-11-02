/**
 * קובץ: src/services/archiveService.ts
 * מטרה: טעינת התקופות והנתונים הזמינים במסכי הארכיון.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: MorningDriverArchiveSummary, SupabaseErrorShape, normalizeArchiveError, isArchivePeriodsResponse, ArchiveService.
 * - קריאות RPC המופעלות בקובץ: get_archive_periods, get_morning_driver_archive_summary, get_dynamic_archive_periods.
 * - ריכוז הפנייה למקור הנתונים ועיבוד התשובה בהתאם לפונקציות להלן.
 */
import {
  supabase,
} from '../lib/supabase';

import type {
  ArchivePeriod,
  ArchivePeriodsResponse,
  DynamicArchivePeriodsResponse,
  UnifiedArchivePeriod,
} from '../types/archive';

/**
 * חוזה הנתונים MorningDriverArchiveSummary: כונני בוקר.
 */
interface MorningDriverArchiveSummary {
  // year — שנה.
  year: number;
  // month — חודש.
  month: number;
  // periodId — מזהה התקופה.
  periodId: string | null;
  // status — סטטוס.
  status: string | null;
  // assignmentCount — הקצאה / כמות.
  assignmentCount: number;
  // driverCount — כוננים / כמות.
  driverCount: number;
  archivedAt: string | null;
  // hasSchedule — שיבוץ.
  hasSchedule: boolean;
}

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
 * פעולה normalizeArchiveError: נרמול ארכיון / שגיאה.
 * @param error — שגיאה.
 * @returns Error — הפלט בהתאם לחתימה.
 */
function normalizeArchiveError(
  error: unknown,
): Error {
  console.error(
    'Archive Supabase error:',
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
        part,
      ): part is string =>
        Boolean(part),
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
    'אירעה שגיאה בעת טעינת הארכיון.',
  );
}

/**
 * פעולה isArchivePeriodsResponse: בדיקת תנאי עבור ארכיון / תקופות / תוצאת הפעולה.
 * @param value — ערך.
 * @returns value is ArchivePeriodsResponse — הפלט בהתאם לחתימה.
 */
function isArchivePeriodsResponse(
  value: unknown,
): value is ArchivePeriodsResponse {
  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר typeof value !== 'object' || value === null.
  if (
    typeof value !==
      'object' ||
    value === null
  ) {
    return false;
  }

  // response — תוצאת הפעולה.
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

/**
 * איגוד פעולות ארכיון / שירות במחלקה ArchiveService.
 */
class ArchiveService {
  /**
   * פעולה אסינכרונית getLegacyPeriods: שליפה או חישוב של תקופות.
   * הפעולה פונה ל־RPC: get_archive_periods, get_morning_driver_archive_summary.
   * @returns Promise<ArchivePeriodsResponse> — הפלט בהתאם לחתימה.
   */
  private async getLegacyPeriods():
    Promise<ArchivePeriodsResponse> {
    const [
      archiveResult,
      morningDriverResult,
    ] =
      await Promise.all([
        supabase.rpc(
          'get_archive_periods',
        ),

        supabase.rpc(
          'get_morning_driver_archive_summary',
        ),
      ]);

    // עצירת הפעולה עם שגיאה כאשר archiveResult.error.
    if (
      archiveResult.error
    ) {
      throw normalizeArchiveError(
        archiveResult.error,
      );
    }

    // עצירת הפעולה עם שגיאה כאשר morningDriverResult.error.
    if (
      morningDriverResult.error
    ) {
      throw normalizeArchiveError(
        morningDriverResult.error,
      );
    }

    // עצירת הפעולה עם שגיאה כאשר !isArchivePeriodsResponse( archiveResult.data, ).
    if (
      !isArchivePeriodsResponse(
        archiveResult.data,
      )
    ) {
      throw new Error(
        'התקבלה תשובה לא תקינה בעת טעינת הארכיון.',
      );
    }

    const morningSummaries =
      Array.isArray(
        morningDriverResult.data,
      )
        ? morningDriverResult
            .data as
              MorningDriverArchiveSummary[]
        : [];

    // summaryMap — סיכום / מפת התאמה; מיפוי לחיפוש לפי מפתח.
    const summaryMap =
      new Map(
        morningSummaries.map(
          (
            summary,
          ) => [
            `${summary.year}-${summary.month}`,
            summary,
          ],
        ),
      );

    // periods — תקופות.
    const periods =
      archiveResult.data
        .periods.map(
          (
            period,
          ) => {
            // summary — סיכום.
            const summary =
              summaryMap.get(
                `${period.year}-${period.month}`,
              );

            return {
              ...period,

              morningDriverPeriodId:
                summary?.periodId ??
                null,

              morningDriverStatus:
                summary?.status ??
                null,

              morningDriverAssignmentCount:
                summary?.assignmentCount ??
                0,

              morningDriverCount:
                summary?.driverCount ??
                0,

              morningDriverArchivedAt:
                summary?.archivedAt ??
                null,

              hasMorningDriverSchedule:
                summary?.hasSchedule ??
                false,

              isFullyArchived:
                period.isFullyArchived &&
                (
                  !summary ||
                  summary.status ===
                    'archived'
                ),
            };
          },
        );

    /*
     * A historical import may theoretically contain only a morning-driver
     * period. Include those months even if the legacy archive RPC does not.
     */
    // עיבוד כל פריט מתוך morningSummaries בנפרד.
    for (
      const summary
      of morningSummaries
    ) {
      // key — מפתח.
      const key =
        `${summary.year}-${summary.month}`;

      if (
        periods.some(
          (
            period,
          ) =>
            `${period.year}-${period.month}` ===
              key,
        )
      ) {
        continue;
      }

      periods.push({
        year:
          summary.year,

        month:
          summary.month,

        dispatcherPeriodId:
          null,

        driverPeriodId:
          null,

        morningDriverPeriodId:
          summary.periodId,

        dispatcherStatus:
          null,

        driverStatus:
          null,

        morningDriverStatus:
          summary.status,

        dispatcherShiftCount:
          0,

        driverDutyCount:
          0,

        morningDriverAssignmentCount:
          summary.assignmentCount,

        dispatcherCount:
          0,

        driverCount:
          0,

        morningDriverCount:
          summary.driverCount,

        dispatcherPublishedAt:
          null,

        driverPublishedAt:
          null,

        dispatcherArchivedAt:
          null,

        driverArchivedAt:
          null,

        morningDriverArchivedAt:
          summary.archivedAt,

        importRunId:
          null,

        importFileName:
          null,

        importedAt:
          null,

        importedBy:
          null,

        isFullyArchived:
          summary.status ===
            'archived',

        hasDispatcherSchedule:
          false,

        hasDriverSchedule:
          false,

        hasMorningDriverSchedule:
          summary.hasSchedule,
      });
    }

    periods.sort(
      (
        first,
        second,
      ) =>
        second.year -
          first.year ||
        second.month -
          first.month,
    );

    return {
      ...archiveResult.data,
      periods,
      count:
        periods.length,
    };
  }
  /**
   * פעולה אסינכרונית getPeriods: שליפה או חישוב של תקופות.
   * הפעולה פונה ל־RPC: get_dynamic_archive_periods.
   * @returns Promise<{ periods: UnifiedArchivePeriod[]; count: number; generatedAt: string }> — הפלט בהתאם לחתימה.
   */
  async getPeriods(): Promise<{ periods: UnifiedArchivePeriod[]; count: number; generatedAt: string }> {
    const [legacyResult, dynamicResult] = await Promise.all([
      this.getLegacyPeriods().catch((error) => {
        console.warn('Legacy archive read failed; Dynamic archive remains available.', error);
        return { periods: [], count: 0, generatedAt: new Date().toISOString() } as ArchivePeriodsResponse;
      }),
      supabase.rpc('get_dynamic_archive_periods'),
    ]);

    // עצירת הפעולה עם שגיאה כאשר dynamicResult.error.
    if (dynamicResult.error) {
      throw normalizeArchiveError(dynamicResult.error);
    }

    // dynamic — דינמי.
    const dynamic = (
      dynamicResult.data ?? {
        periods: [],
        generatedAt: new Date().toISOString(),
      }
    ) as unknown as DynamicArchivePeriodsResponse;

    // byMonth — חודש; מיפוי לחיפוש לפי מפתח.
    const byMonth = new Map<string, UnifiedArchivePeriod>();

    // עיבוד כל פריט מתוך legacyResult.periods בנפרד.
    for (const period of legacyResult.periods) {
      byMonth.set(`${period.year}-${period.month}`, {
        ...period,
        dynamicJobTypes: [],
        dynamicArchivedAt: null,
        hasDynamicArchive: false,
        archiveRun: null,
      });
    }

    // עיבוד כל פריט מתוך dynamic.periods ?? [] בנפרד.
    for (const dynamicPeriod of dynamic.periods ?? []) {
      // key — מפתח.
      const key = `${dynamicPeriod.year}-${dynamicPeriod.month}`;
      const existing = byMonth.get(key);
      const emptyLegacy: ArchivePeriod = {
        year: dynamicPeriod.year,
        month: dynamicPeriod.month,
        dispatcherPeriodId: null,
        driverPeriodId: null,
        morningDriverPeriodId: null,
        dispatcherStatus: null,
        driverStatus: null,
        morningDriverStatus: null,
        dispatcherShiftCount: 0,
        driverDutyCount: 0,
        morningDriverAssignmentCount: 0,
        dispatcherCount: 0,
        driverCount: 0,
        morningDriverCount: 0,
        dispatcherPublishedAt: null,
        driverPublishedAt: null,
        dispatcherArchivedAt: null,
        driverArchivedAt: null,
        morningDriverArchivedAt: null,
        importRunId: null,
        importFileName: null,
        importedAt: null,
        importedBy: null,
        isFullyArchived: dynamicPeriod.isFullyArchived,
        hasDispatcherSchedule: false,
        hasDriverSchedule: false,
        hasMorningDriverSchedule: false,
      };

      byMonth.set(key, {
        ...(existing ?? emptyLegacy),
        isFullyArchived: dynamicPeriod.isFullyArchived &&
          (existing ? existing.isFullyArchived : true),
        dynamicJobTypes: dynamicPeriod.jobTypes ?? [],
        dynamicArchivedAt: dynamicPeriod.archivedAt,
        hasDynamicArchive: (dynamicPeriod.jobTypes?.length ?? 0) > 0,
        archiveRun: dynamicPeriod.archiveRun ?? null,
      });
    }

    // periods — תקופות.
    const periods = Array.from(byMonth.values()).sort(
      (a,b) => b.year-a.year || b.month-a.month,
    );

    return {
      periods,
      count: periods.length,
      generatedAt: dynamic.generatedAt ?? legacyResult.generatedAt,
    };
  }

}

// archiveService — ארכיון / שירות.
export const archiveService =
  new ArchiveService();