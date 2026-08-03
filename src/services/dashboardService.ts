import {
  supabase,
} from '../lib/supabase';

import type {
  DashboardResponse,
} from '../types/dashboard';

interface SupabaseErrorShape {
  message?: unknown;
  details?: unknown;
  hint?: unknown;
  code?: unknown;
}

function normalizeDashboardError(
  error: unknown,
): Error {
  console.error(
    'Dashboard Supabase error:',
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
      typeof databaseError.message === 'string' &&
      databaseError.message.trim()
        ? databaseError.message
        : null,
      typeof databaseError.details === 'string' &&
      databaseError.details.trim()
        ? databaseError.details
        : null,
      typeof databaseError.hint === 'string' &&
      databaseError.hint.trim()
        ? `Hint: ${databaseError.hint}`
        : null,
      typeof databaseError.code === 'string' &&
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
    'אירעה שגיאה בעת טעינת לוח הבקרה.',
  );
}

function isDashboardResponse(
  value: unknown,
): value is DashboardResponse {
  if (
    typeof value !== 'object' ||
    value === null
  ) {
    return false;
  }

  const response =
    value as Partial<DashboardResponse>;

  return (
    typeof response.user === 'object' &&
    response.user !== null &&
    typeof response.user.id === 'string' &&
    typeof response.user.role === 'string' &&
    typeof response.generatedAt === 'string'
  );
}

class DashboardService {
  async getMyDashboard():
    Promise<DashboardResponse> {
    const {
      data,
      error,
    } = await supabase.rpc(
      'get_my_dashboard',
    );

    if (error) {
      throw normalizeDashboardError(
        error,
      );
    }

    if (!isDashboardResponse(data)) {
      throw new Error(
        'התקבלה תשובה לא תקינה בעת טעינת לוח הבקרה.',
      );
    }

    return data;
  }
}

export const dashboardService =
  new DashboardService();