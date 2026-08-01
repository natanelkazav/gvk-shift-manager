import { supabase } from '../lib/supabase';
import type {
  AvailabilitySubmissionStatus,
  DispatcherAvailabilityShift,
  DispatcherAvailabilityStatus,
  MyOpenAvailability,
  SaveShiftAvailabilityInput,
  SaveShiftAvailabilityResult,
} from '../types/dispatcherAvailability';

interface MyOpenAvailabilityDatabaseRow {
  period_id: string;
  period_year: number;
  period_month: number;
  period_title: string | null;
  period_instructions: string | null;
  submission_deadline: string | null;
  period_status: 'open';

  submission_status:
    AvailabilitySubmissionStatus;

  submitted_at: string | null;
  last_saved_at: string | null;
  available_count: number;
  unavailable_count: number;

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

  availability_status:
    DispatcherAvailabilityStatus | null;

  availability_note: string | null;

  availability_updated_at:
    string | null;
}
interface SaveShiftAvailabilityDatabaseRow {
  shift_slot_id: string;
  availability_status:
    DispatcherAvailabilityStatus;
  availability_note: string | null;
  availability_updated_at: string;
  available_count: number;
  unavailable_count: number;
  answered_count: number;
  total_shift_count: number;
}
function mapShiftRow(
  row: MyOpenAvailabilityDatabaseRow,
): DispatcherAvailabilityShift {
  return {
    id: row.shift_slot_id,
    date: row.shift_date,
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

    availabilityStatus:
      row.availability_status,

    note:
      row.availability_note,

    availabilityUpdatedAt:
      row.availability_updated_at,
  };
}

async function getMyOpenAvailability():
  Promise<MyOpenAvailability | null> {
  const {
    data,
    error,
  } = await supabase.rpc(
    'get_my_open_availability',
  );

  if (error) {
    console.error(
      'GET MY OPEN AVAILABILITY ERROR:',
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
        'המשתמש אינו פעיל. יש לפנות למנהל המערכת.',
      );
    }

    if (
      normalizedMessage.includes(
        'not allowed',
      )
    ) {
      throw new Error(
        'אין לך הרשאה לצפות באילוצי המוקדנים.',
      );
    }

    throw new Error(
      'לא ניתן היה לטעון את רשימת המשמרות להגשת אילוצים.',
    );
  }

  const rows =
    (
      data as
        | MyOpenAvailabilityDatabaseRow[]
        | null
    ) ?? [];

  if (rows.length === 0) {
    return null;
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

      instructions:
        firstRow.period_instructions,

      submissionDeadline:
        firstRow.submission_deadline,

      status:
        firstRow.period_status,
    },

    submission: {
      status:
        firstRow.submission_status,

      submittedAt:
        firstRow.submitted_at,

      lastSavedAt:
        firstRow.last_saved_at,

      availableCount:
        firstRow.available_count,

      unavailableCount:
        firstRow.unavailable_count,
    },

    shifts:
      rows.map(mapShiftRow),
  };
}
async function saveShiftAvailability(
  input: SaveShiftAvailabilityInput,
): Promise<SaveShiftAvailabilityResult> {
  const normalizedShiftSlotId =
    input.shiftSlotId.trim();

  if (!normalizedShiftSlotId) {
    throw new Error(
      'לא התקבל מזהה משמרת תקין.',
    );
  }

  const normalizedNote =
    input.note?.trim() || null;

  const {
    data,
    error,
  } = await supabase.rpc(
    'save_my_shift_availability',
    {
      requested_shift_slot_id:
        normalizedShiftSlotId,

      requested_availability_status:
        input.status,

      requested_note:
        normalizedNote,
    },
  );

  if (error) {
    console.error(
      'SAVE SHIFT AVAILABILITY ERROR:',
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
        'deadline has passed',
      )
    ) {
      throw new Error(
        'מועד הגשת האילוצים כבר עבר.',
      );
    }

    if (
      normalizedMessage.includes(
        'period is not open',
      )
    ) {
      throw new Error(
        'תקופת האילוצים אינה פתוחה להגשה.',
      );
    }

    if (
      normalizedMessage.includes(
        'already submitted',
      )
    ) {
      throw new Error(
        'האילוצים כבר הוגשו ולא ניתן לשנותם.',
      );
    }

    if (
      normalizedMessage.includes(
        'not found',
      )
    ) {
      throw new Error(
        'המשמרת לא נמצאה.',
      );
    }

    throw new Error(
      'לא ניתן היה לשמור את האילוץ.',
    );
  }

  const rows =
    data as
      | SaveShiftAvailabilityDatabaseRow[]
      | null;

  const result =
    rows?.[0];

  if (!result) {
    throw new Error(
      'שמירת האילוץ הסתיימה ללא תשובה תקינה מהשרת.',
    );
  }

  return {
    shiftSlotId:
      result.shift_slot_id,

    availabilityStatus:
      result.availability_status,

    availabilityNote:
      result.availability_note,

    availabilityUpdatedAt:
      result.availability_updated_at,

    availableCount:
      result.available_count,

    unavailableCount:
      result.unavailable_count,

    answeredCount:
      result.answered_count,

    totalShiftCount:
      result.total_shift_count,
  };
}
export const dispatcherAvailabilityService = {
  getMyOpenAvailability,
  saveShiftAvailability,
};