import { supabase } from '../lib/supabase';
import type {
  AssignmentCandidateShift,
  AssignmentCandidateState,
  AssignmentCandidatesData,
} from '../types/assignmentCandidates';

interface AssignmentCandidateDatabaseRow {
  period_id: string;
  period_year: number;
  period_month: number;
  period_title: string | null;
  period_status: 'closed';

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

  assignment_state:
    AssignmentCandidateState;

  sole_available_user_id:
    string | null;

  sole_available_display_name:
    string | null;

  sole_available_schedule_name:
    string | null;

  available_user_ids:
    string[] | null;

  available_display_names:
    string[] | null;

  available_schedule_names:
    (string | null)[] | null;
}

function mapCandidateShift(
  row:
    AssignmentCandidateDatabaseRow,
): AssignmentCandidateShift {
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

    assignmentState:
      row.assignment_state,

    soleAvailableUserId:
      row.sole_available_user_id,

    soleAvailableDisplayName:
      row.sole_available_display_name,

    soleAvailableScheduleName:
      row.sole_available_schedule_name,

    availableUserIds:
      row.available_user_ids ?? [],

    availableDisplayNames:
      row.available_display_names ?? [],

    availableScheduleNames:
      row.available_schedule_names ?? [],
  };
}

async function getAssignmentCandidates(
  periodId: string,
): Promise<AssignmentCandidatesData> {
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
    'get_availability_assignment_candidates',
    {
      requested_period_id:
        normalizedPeriodId,
    },
  );

  if (error) {
    console.error(
      'GET ASSIGNMENT CANDIDATES ERROR:',
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
        'אין לך הרשאה להכין שיבוץ.',
      );
    }

    if (
      normalizedMessage.includes(
        'must be closed',
      )
    ) {
      throw new Error(
        'יש לסגור את תקופת האילוצים לפני הכנת השיבוץ.',
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
      'לא ניתן היה לטעון את נתוני ההכנה לשיבוץ.',
    );
  }

  const rows =
    (
      data as
        | AssignmentCandidateDatabaseRow[]
        | null
    ) ?? [];

  if (rows.length === 0) {
    throw new Error(
      'לא נמצאו משמרות להכנת השיבוץ.',
    );
  }

  const firstRow =
    rows[0];

  const shifts =
    rows
      .map(mapCandidateShift)
      .sort(
        (
          firstShift,
          secondShift,
        ) => {
          const stateOrder:
            Record<
              AssignmentCandidateState,
              number
            > = {
              no_available: 1,
              single_available: 2,
              multiple_available: 3,
            };

          const stateComparison =
            stateOrder[
              firstShift
                .assignmentState
            ] -
            stateOrder[
              secondShift
                .assignmentState
            ];

          if (
            stateComparison !== 0
          ) {
            return stateComparison;
          }

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

export const assignmentCandidatesService = {
  getAssignmentCandidates,
};