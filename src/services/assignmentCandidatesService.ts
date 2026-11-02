/**
 * קובץ: src/services/assignmentCandidatesService.ts
 * מטרה: טעינת משמרות ומועמדים לצורך הצעת שיבוץ ובדיקת זמינות.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: AssignmentCandidateDatabaseRow, mapCandidateShift, getAssignmentCandidates.
 * - קריאות RPC המופעלות בקובץ: get_availability_assignment_candidates.
 * - ריכוז הפנייה למקור הנתונים ועיבוד התשובה בהתאם לפונקציות להלן.
 */
import { supabase } from '../lib/supabase';
import type {
  AssignmentCandidateShift,
  AssignmentCandidateState,
  AssignmentCandidatesData,
} from '../types/assignmentCandidates';

/**
 * חוזה הנתונים AssignmentCandidateDatabaseRow: הקצאה / שורה.
 */
interface AssignmentCandidateDatabaseRow {
  // period_id — מזהה התקופה.
  period_id: string;
  // period_year — תקופה / שנה.
  period_year: number;
  // period_month — תקופה / חודש.
  period_month: number;
  // period_title — תקופה / כותרת.
  period_title: string | null;
  // period_status — תקופה / סטטוס.
  period_status: 'closed';

  // shift_slot_id — משמרת / מזהה.
  shift_slot_id: string;
  // shift_date — תאריך המשמרת.
  shift_date: string;
  weekday_number: number;
  // weekday_name — שם.
  weekday_name: string;
  // start_time — שעת התחלה.
  start_time: string;
  // end_time — שעת סיום.
  end_time: string;
  // ends_next_day — יום.
  ends_next_day: boolean;
  // schedule_type — סוג יום השיבוץ.
  schedule_type: string;
  // holiday_name — חג / שם.
  holiday_name: string | null;
  // is_premium — תעריף מוגדל.
  is_premium: boolean;
  // sort_order — סדר המיון.
  sort_order: number;

  // total_dispatchers — סך הכול.
  total_dispatchers: number;
  available_dispatchers: number;
  unavailable_dispatchers: number;

  // assignment_state — הקצאה / מצב.
  assignment_state:
    AssignmentCandidateState;

  // sole_available_user_id — מזהה משתמש.
  sole_available_user_id:
    string | null;

  // sole_available_display_name — שם תצוגה.
  sole_available_display_name:
    string | null;

  // sole_available_schedule_name — שיבוץ / שם.
  sole_available_schedule_name:
    string | null;

  // available_user_ids — מזהה משתמש.
  available_user_ids:
    string[] | null;

  // available_display_names — שם תצוגה.
  available_display_names:
    string[] | null;

  // available_schedule_names — שיבוץ.
  available_schedule_names:
    (string | null)[] | null;
}

/**
 * פעולה mapCandidateShift: המרת נתוני משמרת ממקור המועמדים למבנה הפנימי של מנוע השיבוץ.
 * @param row — שורה.
 * @returns AssignmentCandidateShift — הפלט בהתאם לחתימה.
 */
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

/**
 * פעולה אסינכרונית getAssignmentCandidates: שליפה או חישוב של הקצאה.
 * הפעולה פונה ל־RPC: get_availability_assignment_candidates.
 * @param periodId — מזהה התקופה.
 * @returns Promise<AssignmentCandidatesData> — הפלט בהתאם לחתימה.
 */
async function getAssignmentCandidates(
  periodId: string,
): Promise<AssignmentCandidatesData> {
  // normalizedPeriodId — מזהה התקופה.
  const normalizedPeriodId =
    periodId.trim();

  // עצירת הפעולה עם שגיאה כאשר !normalizedPeriodId.
  if (!normalizedPeriodId) {
    throw new Error(
      'לא התקבל מזהה תקופת אילוצים תקין.',
    );
  }

  // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
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

  // עצירת הפעולה עם שגיאה כאשר error.
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

    // normalizedMessage — הודעה.
    const normalizedMessage =
      error.message.toLowerCase();

    // עצירת הפעולה עם שגיאה כאשר normalizedMessage.includes( 'not authenticated', ).
    if (
      normalizedMessage.includes(
        'not authenticated',
      )
    ) {
      throw new Error(
        'לא נמצאה התחברות פעילה. יש להתחבר מחדש.',
      );
    }

    // עצירת הפעולה עם שגיאה כאשר normalizedMessage.includes( 'not active', ).
    if (
      normalizedMessage.includes(
        'not active',
      )
    ) {
      throw new Error(
        'המשתמש אינו פעיל.',
      );
    }

    // עצירת הפעולה עם שגיאה כאשר normalizedMessage.includes( 'not allowed', ).
    if (
      normalizedMessage.includes(
        'not allowed',
      )
    ) {
      throw new Error(
        'אין לך הרשאה להכין שיבוץ.',
      );
    }

    // עצירת הפעולה עם שגיאה כאשר normalizedMessage.includes( 'must be closed', ).
    if (
      normalizedMessage.includes(
        'must be closed',
      )
    ) {
      throw new Error(
        'יש לסגור את תקופת האילוצים לפני הכנת השיבוץ.',
      );
    }

    // עצירת הפעולה עם שגיאה כאשר normalizedMessage.includes( 'not found', ).
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

  // rows — שורות.
  const rows =
    (
      data as
        | AssignmentCandidateDatabaseRow[]
        | null
    ) ?? [];

  // עצירת הפעולה עם שגיאה כאשר rows.length === 0.
  if (rows.length === 0) {
    throw new Error(
      'לא נמצאו משמרות להכנת השיבוץ.',
    );
  }

  // firstRow — שורה.
  const firstRow =
    rows[0];

  // shifts — משמרות.
  const shifts =
    rows
      .map(mapCandidateShift)
      .sort(
        (
          firstShift,
          secondShift,
        ) => {
          // stateOrder — מצב.
          const stateOrder:
            Record<
              AssignmentCandidateState,
              number
            > = {
              no_available: 1,
              single_available: 2,
              multiple_available: 3,
            };

          // stateComparison — מצב.
          const stateComparison =
            stateOrder[
              firstShift
                .assignmentState
            ] -
            stateOrder[
              secondShift
                .assignmentState
            ];

          // טיפול במקרה מיוחד ויציאה מוקדמת כאשר stateComparison !== 0.
          if (
            stateComparison !== 0
          ) {
            return stateComparison;
          }

          // dateComparison — תאריך.
          const dateComparison =
            firstShift.date.localeCompare(
              secondShift.date,
            );

          // טיפול במקרה מיוחד ויציאה מוקדמת כאשר dateComparison !== 0.
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

// assignmentCandidatesService — הקצאה / שירות.
export const assignmentCandidatesService = {
  getAssignmentCandidates,
};