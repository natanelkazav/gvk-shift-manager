import { supabase } from '../lib/supabase';
import type {
  DynamicStatisticsJobTypeOption,
  DynamicStatisticsWorkspace,
} from '../types/dynamicStatistics';

interface RpcErrorShape {
  message?: string;
  details?: string;
  hint?: string;
  code?: string;
}

function normalizeError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }

  if (typeof error === 'object' && error !== null) {
    const value = error as RpcErrorShape;
    const parts = [value.message, value.details, value.hint, value.code]
      .filter((part): part is string => Boolean(part?.trim()));

    if (parts.length > 0) {
      return new Error(parts.join(' | '));
    }
  }

  return new Error('לא ניתן היה לטעון את הסטטיסטיקות הדינמיות.');
}

class DynamicStatisticsService {
  async getAvailablePeriods(jobTypeId: string): Promise<Array<{ year: number; month: number }>> {
    const { data, error } = await supabase.rpc('get_dynamic_statistics_data_periods', {
      requested_job_type_id: jobTypeId,
    });

    if (error) {
      throw normalizeError(error);
    }

    if (!Array.isArray(data)) {
      return [];
    }

    return data
      .map((item) => item as { year?: unknown; month?: unknown })
      .filter((item) => Number.isInteger(Number(item.year)) && Number.isInteger(Number(item.month)))
      .map((item) => ({ year: Number(item.year), month: Number(item.month) }));
  }

  async getJobTypes(): Promise<DynamicStatisticsJobTypeOption[]> {
    const { data, error } = await supabase.rpc('get_dynamic_statistics_job_types');

    if (error) {
      throw normalizeError(error);
    }

    if (!Array.isArray(data)) {
      return [];
    }

    return data as DynamicStatisticsJobTypeOption[];
  }

  async getWorkspace(
    jobTypeId: string,
    years: number[],
    months: number[],
    userIds: string[] = [],
    includeInactive = false,
  ): Promise<DynamicStatisticsWorkspace> {
    const { data, error } = await supabase.rpc('get_dynamic_job_type_statistics', {
      requested_job_type_id: jobTypeId,
      requested_years: years.length > 0 ? years : null,
      requested_months: months.length > 0 ? months : null,
      requested_user_ids: userIds.length > 0 ? userIds : null,
      requested_include_inactive: includeInactive,
    });

    if (error) {
      throw normalizeError(error);
    }

    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      throw new Error('השרת החזיר מבנה סטטיסטיקות דינמי לא תקין.');
    }

    const workspace = data as unknown as DynamicStatisticsWorkspace;

    // Legacy dispatcher availability predates the dynamic availability tables.
    // During the cutover, historical months can have an empty dynamic period while
    // the real answers still live in availability_periods / dispatcher_availability.
    // Prefer dynamic data whenever it exists; only bridge a completely empty
    // dispatcher availability result for a single selected month.
    const dynamicAvailabilityEntries =
      workspace.availabilitySummary.availableCount +
      workspace.availabilitySummary.unavailableCount +
      workspace.availabilitySummary.preferredCount +
      workspace.availabilitySummary.avoidCount;

    let legacyRole: string | null = null;

    if (
      years.length === 1 &&
      months.length === 1 &&
      dynamicAvailabilityEntries === 0
    ) {
      const { data: jobTypeRow, error: jobTypeError } = await supabase
        .from('job_types')
        .select('legacy_role')
        .eq('id', jobTypeId)
        .maybeSingle();

      if (jobTypeError) {
        throw normalizeError(jobTypeError);
      }

      legacyRole =
        jobTypeRow && typeof jobTypeRow.legacy_role === 'string'
          ? jobTypeRow.legacy_role
          : null;
    }

    if (
      legacyRole === 'dispatcher' &&
      years.length === 1 &&
      months.length === 1 &&
      dynamicAvailabilityEntries === 0
    ) {
      const { data: legacyData, error: legacyError } = await supabase.rpc(
        'get_dispatcher_availability_statistics',
        {
          requested_year: years[0],
          requested_month: months[0],
        },
      );

      if (legacyError) {
        throw normalizeError(legacyError);
      }

      if (legacyData && typeof legacyData === 'object' && !Array.isArray(legacyData)) {
        const legacy = legacyData as Record<string, unknown>;
        const legacySummary = legacy.summary as Record<string, unknown> | undefined;
        const legacyRows = Array.isArray(legacy.dispatcherStatistics)
          ? legacy.dispatcherStatistics as Array<Record<string, unknown>>
          : [];
        const activeByUser = new Map(workspace.people.map((person) => [person.userId, person.isActive]));
        const selected = new Set(userIds);

        const visibleRows = legacyRows.filter((row) => {
          const userId = typeof row.userId === 'string' ? row.userId : '';
          if (!userId) return false;
          if (selected.size > 0 && !selected.has(userId)) return false;
          if (!includeInactive && activeByUser.get(userId) === false) return false;
          return true;
        });

        if (visibleRows.length > 0 || Number(legacySummary?.periodCount ?? 0) > 0) {
          const availabilityPeople = visibleRows.map((row) => {
            const declaredAvailable = Number(row.declaredAvailableCount ?? 0);
            const autoAvailable = Number(row.autoCompletedAvailableCount ?? 0);
            const unavailable = Number(row.declaredUnavailableCount ?? 0);
            const manual = Number(row.manualSubmissionPeriods ?? 0);
            const partial = Number(row.autoPartialPeriods ?? 0);
            const userId = String(row.userId);
            return {
              userId,
              displayName: String(row.displayName ?? ''),
              scheduleName: typeof row.scheduleName === 'string' ? row.scheduleName : null,
              isActive: activeByUser.get(userId) !== false,
              submittedPeriods: manual + partial,
              availableCount: declaredAvailable + autoAvailable,
              unavailableCount: unavailable,
              preferredCount: 0,
              avoidCount: 0,
              totalEntries: declaredAvailable + autoAvailable + unavailable,
            };
          });

          workspace.availabilityPeople = availabilityPeople;
          workspace.availabilitySummary = {
            periodCount: Number(legacySummary?.periodCount ?? 0),
            submissionCount: availabilityPeople.reduce((sum, row) => sum + row.submittedPeriods, 0),
            availableCount: availabilityPeople.reduce((sum, row) => sum + row.availableCount, 0),
            unavailableCount: availabilityPeople.reduce((sum, row) => sum + row.unavailableCount, 0),
            preferredCount: 0,
            avoidCount: 0,
          };
        }
      }
    }

    return workspace;
  }
}

export const dynamicStatisticsService = new DynamicStatisticsService();
