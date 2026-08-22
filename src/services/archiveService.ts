import {
  supabase,
} from '../lib/supabase';

import type {
  ArchivePeriodsResponse,
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
  async getPeriods():
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
}

export const archiveService =
  new ArchiveService();