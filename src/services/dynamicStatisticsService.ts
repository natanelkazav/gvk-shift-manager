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
  ): Promise<DynamicStatisticsWorkspace> {
    const { data, error } = await supabase.rpc('get_dynamic_job_type_statistics', {
      requested_job_type_id: jobTypeId,
      requested_years: years.length > 0 ? years : null,
      requested_months: months.length > 0 ? months : null,
      requested_user_ids: userIds.length > 0 ? userIds : null,
    });

    if (error) {
      throw normalizeError(error);
    }

    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      throw new Error('השרת החזיר מבנה סטטיסטיקות דינמי לא תקין.');
    }

    return data as unknown as DynamicStatisticsWorkspace;
  }
}

export const dynamicStatisticsService = new DynamicStatisticsService();
