import { supabase } from '../lib/supabase';
import type {
  AvailabilityPeriodSubmissionsTracking,
  AvailabilitySubmissionTrackingDispatcher,
  AvailabilityTrackingStatus,
} from '../types/availabilitySubmissions';

interface AvailabilityPeriodSubmissionDatabaseRow {
  period_id: string;
  period_year: number;
  period_month: number;
  period_title: string | null;
  period_status: string;
  submission_deadline: string | null;

  total_dispatchers: number;
  submitted_dispatchers: number;
  draft_dispatchers: number;
  not_started_dispatchers: number;

  user_id: string;
  display_name: string;
  email: string;
  schedule_name: string | null;

  submission_status:
    AvailabilityTrackingStatus;

  submitted_at: string | null;
  last_saved_at: string | null;

  available_count: number;
  unavailable_count: number;
  answered_count: number;
  unanswered_count: number;
  total_shift_count: number;
  completion_percentage: number;
}

function mapDispatcherRow(
  row:
    AvailabilityPeriodSubmissionDatabaseRow,
): AvailabilitySubmissionTrackingDispatcher {
  return {
    userId:
      row.user_id,

    displayName:
      row.display_name,

    email:
      row.email,

    scheduleName:
      row.schedule_name,

    status:
      row.submission_status,

    submittedAt:
      row.submitted_at,

    lastSavedAt:
      row.last_saved_at,

    availableCount:
      row.available_count,

    unavailableCount:
      row.unavailable_count,

    answeredCount:
      row.answered_count,

    unansweredCount:
      row.unanswered_count,

    totalShiftCount:
      row.total_shift_count,

    completionPercentage:
      row.completion_percentage,
  };
}

async function getPeriodSubmissions(
  periodId: string,
): Promise<AvailabilityPeriodSubmissionsTracking> {
  const normalizedPeriodId =
    periodId.trim();

  if (!normalizedPeriodId) {
    throw new Error(
      'לא התקבל מזהה תקופת אילוצים תקין.',
    );
  }

  const {
    data,
    error,
  } = await supabase.rpc(
    'get_availability_period_submissions',
    {
      requested_period_id:
        normalizedPeriodId,
    },
  );

  if (error) {
    console.error(
      'GET AVAILABILITY PERIOD SUBMISSIONS ERROR:',
      {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      },
    );

    const normalizedMessage =
      error.message.toLowerCase();

    if (
      normalizedMessage.includes(
        'not authenticated',
      )
    ) {
      throw new Error(
        'לא נמצאה התחברות פעילה. יש להתחבר מחדש.',
      );
    }

    if (
      normalizedMessage.includes(
        'not active',
      )
    ) {
      throw new Error(
        'המשתמש אינו פעיל.',
      );
    }

    if (
      normalizedMessage.includes(
        'not allowed',
      )
    ) {
      throw new Error(
        'אין לך הרשאה לצפות במעקב ההגשות.',
      );
    }

    if (
      normalizedMessage.includes(
        'not found',
      )
    ) {
      throw new Error(
        'תקופת האילוצים לא נמצאה.',
      );
    }

    throw new Error(
      'לא ניתן היה לטעון את מעקב ההגשות.',
    );
  }

  const rows =
    (
      data as
        | AvailabilityPeriodSubmissionDatabaseRow[]
        | null
    ) ?? [];

  if (rows.length === 0) {
    throw new Error(
      'לא נמצאו נתוני הגשה עבור תקופת האילוצים.',
    );
  }

  const firstRow =
    rows[0];

  return {
    period: {
      id:
        firstRow.period_id,

      year:
        firstRow.period_year,

      month:
        firstRow.period_month,

      title:
        firstRow.period_title,

      status:
        firstRow.period_status,

      submissionDeadline:
        firstRow.submission_deadline,
    },

    summary: {
      totalDispatchers:
        firstRow.total_dispatchers,

      submittedDispatchers:
        firstRow.submitted_dispatchers,

      draftDispatchers:
        firstRow.draft_dispatchers,

      notStartedDispatchers:
        firstRow.not_started_dispatchers,
    },

    dispatchers:
      rows.map(
        mapDispatcherRow,
      ),
  };
}

export const availabilitySubmissionsService = {
  getPeriodSubmissions,
};