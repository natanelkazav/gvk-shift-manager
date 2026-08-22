import {
  supabase,
} from '../lib/supabase';

export type AvailabilityDeadlineCategory =
  | 'dispatcher'
  | 'driver'
  | 'morning_driver';

interface UpdateAvailabilityDeadlineResponse {
  category: AvailabilityDeadlineCategory;
  periodId: string;
  submissionDeadline: string | null;
  updatedAt: string;
}

function normalizeError(
  error: unknown,
): Error {
  if (
    error instanceof
      Error
  ) {
    return error;
  }

  if (
    typeof error ===
      'object' &&
    error !== null &&
    'message' in error &&
    typeof (
      error as {
        message?: unknown;
      }
    ).message ===
      'string'
  ) {
    return new Error(
      (
        error as {
          message: string;
        }
      ).message,
    );
  }

  return new Error(
    'לא ניתן היה לעדכן את מועד הגשת האילוצים.',
  );
}

class AvailabilityDeadlineService {
  async updateDeadline(
    category:
      AvailabilityDeadlineCategory,

    periodId:
      string,

    submissionDeadline:
      string,
  ): Promise<UpdateAvailabilityDeadlineResponse> {
    const normalizedPeriodId =
      periodId.trim();

    if (
      !normalizedPeriodId
    ) {
      throw new Error(
        'לא נבחרה תקופת אילוצים לעדכון.',
      );
    }

    const normalizedDeadline =
      submissionDeadline
        .trim();

    if (
      !normalizedDeadline
    ) {
      throw new Error(
        'יש לבחור מועד אחרון להגשת האילוצים.',
      );
    }

    const deadline =
      new Date(
        normalizedDeadline,
      );

    if (
      Number.isNaN(
        deadline.getTime(),
      )
    ) {
      throw new Error(
        'מועד ההגשה שנבחר אינו תקין.',
      );
    }

    const {
      data,
      error,
    } =
      await supabase.rpc(
        'update_availability_submission_deadline',
        {
          requested_category:
            category,

          requested_period_id:
            normalizedPeriodId,

          requested_deadline:
            deadline
              .toISOString(),
        },
      );

    if (
      error
    ) {
      throw normalizeError(
        error,
      );
    }

    if (
      !data ||
      typeof data !==
        'object'
    ) {
      throw new Error(
        'לא התקבלה תשובה תקינה לאחר עדכון מועד ההגשה.',
      );
    }

    return data as
      UpdateAvailabilityDeadlineResponse;
  }
}

export const availabilityDeadlineService =
  new AvailabilityDeadlineService();
