import {
  supabase,
} from '../lib/supabase';

import type {
  ArchivePeriod,
  ArchivePeriodsResponse,
  DynamicArchivePeriodsResponse,
  UnifiedArchivePeriod,
} from '../types/archive';

interface MorningDriverArchiveSummary {
  year: number;
  month: number;
  periodId: string | null;
  status: string | null;
  assignmentCount: number;
  driverCount: number;
  archivedAt: string | null;
  hasSchedule: boolean;
}

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

    if (
      archiveResult.error
    ) {
      throw normalizeArchiveError(
        archiveResult.error,
      );
    }

    if (
      morningDriverResult.error
    ) {
      throw normalizeArchiveError(
        morningDriverResult.error,
      );
    }

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

    const periods =
      archiveResult.data
        .periods.map(
          (
            period,
          ) => {
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
    for (
      const summary
      of morningSummaries
    ) {
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
  async getPeriods(): Promise<{ periods: UnifiedArchivePeriod[]; count: number; generatedAt: string }> {
    const [legacyResult, dynamicResult] = await Promise.all([
      this.getLegacyPeriods().catch((error) => {
        console.warn('Legacy archive read failed; Dynamic archive remains available.', error);
        return { periods: [], count: 0, generatedAt: new Date().toISOString() } as ArchivePeriodsResponse;
      }),
      supabase.rpc('get_dynamic_archive_periods'),
    ]);

    if (dynamicResult.error) {
      throw normalizeArchiveError(dynamicResult.error);
    }

    const dynamic = (
      dynamicResult.data ?? {
        periods: [],
        generatedAt: new Date().toISOString(),
      }
    ) as unknown as DynamicArchivePeriodsResponse;

    const byMonth = new Map<string, UnifiedArchivePeriod>();

    for (const period of legacyResult.periods) {
      byMonth.set(`${period.year}-${period.month}`, {
        ...period,
        dynamicJobTypes: [],
        dynamicArchivedAt: null,
        hasDynamicArchive: false,
        archiveRun: null,
      });
    }

    for (const dynamicPeriod of dynamic.periods ?? []) {
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

export const archiveService =
  new ArchiveService();