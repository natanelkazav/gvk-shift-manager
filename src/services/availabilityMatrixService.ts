import { supabase } from '../lib/supabase';
import type {
  AvailabilityMatrixDispatcher,
  AvailabilityMatrixShift,
  AvailabilityMatrixStatus,
  AvailabilityPeriodMatrix,
} from '../types/availabilityMatrix';

interface AvailabilityMatrixDatabaseRow {
  period_id: string;
  period_year: number;
  period_month: number;
  period_title: string | null;
  period_status: string;

  shift_slot_id: string;
  shift_date: string;
  weekday_number: number;
  weekday_name: string;
  start_time: string;
  end_time: string;
  ends_next_day: boolean;
  schedule_type: string;
  holiday_name: string | null;
  is_premium: boolean;
  sort_order: number;

  total_dispatchers: number;
  available_dispatchers: number;
  unavailable_dispatchers: number;
  unanswered_dispatchers: number;

  user_id: string;
  display_name: string;
  email: string;
  schedule_name: string | null;

  submission_status: string;

  availability_status:
    AvailabilityMatrixStatus;

  availability_note: string | null;

  availability_updated_at:
    string | null;
}

function mapDispatcher(
  row:
    AvailabilityMatrixDatabaseRow,
): AvailabilityMatrixDispatcher {
  return {
    userId:
      row.user_id,

    displayName:
      row.display_name,

    email:
      row.email,

    scheduleName:
      row.schedule_name,

    submissionStatus:
      row.submission_status,

    availabilityStatus:
      row.availability_status,

    note:
      row.availability_note,

    updatedAt:
      row.availability_updated_at,
  };
}

function createShiftFromRow(
  row:
    AvailabilityMatrixDatabaseRow,
): AvailabilityMatrixShift {
  return {
    id:
      row.shift_slot_id,

    date:
      row.shift_date,

    weekdayNumber:
      row.weekday_number,

    weekdayName:
      row.weekday_name,

    startTime:
      row.start_time,

    endTime:
      row.end_time,

    endsNextDay:
      row.ends_next_day,

    scheduleType:
      row.schedule_type,

    holidayName:
      row.holiday_name,

    isPremium:
      row.is_premium,

    sortOrder:
      row.sort_order,

    totalDispatchers:
      row.total_dispatchers,

    availableDispatchers:
      row.available_dispatchers,

    unavailableDispatchers:
      row.unavailable_dispatchers,

    unansweredDispatchers:
      row.unanswered_dispatchers,

    dispatchers: [],
  };
}

async function getAvailabilityPeriodMatrix(
  periodId: string,
): Promise<AvailabilityPeriodMatrix> {
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
    'get_availability_period_matrix',
    {
      requested_period_id:
        normalizedPeriodId,
    },
  );

  if (error) {
    console.error(
      'GET AVAILABILITY PERIOD MATRIX ERROR:',
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
        'אין לך הרשאה לצפות במטריצת הזמינות.',
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
      'לא ניתן היה לטעון את מטריצת הזמינות.',
    );
  }

  const rows =
    (
      data as
        | AvailabilityMatrixDatabaseRow[]
        | null
    ) ?? [];

  if (rows.length === 0) {
    throw new Error(
      'לא נמצאו נתוני זמינות עבור התקופה.',
    );
  }

  const firstRow =
    rows[0];

  const shiftsById =
    new Map<
      string,
      AvailabilityMatrixShift
    >();

  for (const row of rows) {
    let shift =
      shiftsById.get(
        row.shift_slot_id,
      );

    if (!shift) {
      shift =
        createShiftFromRow(row);

      shiftsById.set(
        row.shift_slot_id,
        shift,
      );
    }

    shift.dispatchers.push(
      mapDispatcher(row),
    );
  }

  const shifts =
    Array.from(
      shiftsById.values(),
    ).sort(
      (
        firstShift,
        secondShift,
      ) => {
        const dateComparison =
          firstShift.date.localeCompare(
            secondShift.date,
          );

        if (
          dateComparison !== 0
        ) {
          return dateComparison;
        }

        return (
          firstShift.sortOrder -
          secondShift.sortOrder
        );
      },
    );

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
    },

    shifts,
  };
}

export const availabilityMatrixService = {
  getAvailabilityPeriodMatrix,
};