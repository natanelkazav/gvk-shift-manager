/**
 * קובץ: src/services/availabilityMatrixService.ts
 * מטרה: טעינת מטריצת זמינות עובדים לצורך תצוגת ניהול האילוצים.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: AvailabilityMatrixDatabaseRow, mapDispatcher, createShiftFromRow, getAvailabilityPeriodMatrix.
 * - קריאות RPC המופעלות בקובץ: get_availability_period_matrix.
 * - ריכוז הפנייה למקור הנתונים ועיבוד התשובה בהתאם לפונקציות להלן.
 */
import { supabase } from '../lib/supabase';
import type {
  AvailabilityMatrixDispatcher,
  AvailabilityMatrixShift,
  AvailabilityMatrixStatus,
  AvailabilityPeriodMatrix,
} from '../types/availabilityMatrix';

/**
 * חוזה הנתונים AvailabilityMatrixDatabaseRow: אילוצים וזמינות / מטריצת נתונים / שורה.
 */
interface AvailabilityMatrixDatabaseRow {
  // period_id — מזהה התקופה.
  period_id: string;
  // period_year — תקופה / שנה.
  period_year: number;
  // period_month — תקופה / חודש.
  period_month: number;
  // period_title — תקופה / כותרת.
  period_title: string | null;
  // period_status — תקופה / סטטוס.
  period_status: string;

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
  unanswered_dispatchers: number;

  // user_id — מזהה משתמש.
  user_id: string;
  // display_name — שם תצוגה.
  display_name: string;
  // email — כתובת דוא״ל.
  email: string;
  // schedule_name — שיבוץ / שם.
  schedule_name: string | null;

  // submission_status — מצב ההגשה.
  submission_status: string;

  // availability_status — מצב הזמינות.
  availability_status:
    AvailabilityMatrixStatus;

  // availability_note — אילוצים וזמינות / הערה.
  availability_note: string | null;

  // availability_updated_at — מועד עדכון.
  availability_updated_at:
    string | null;
}

/**
 * פעולה mapDispatcher: מיפוי מפת התאמה / מוקדנים.
 * @param row — שורה.
 * @returns AvailabilityMatrixDispatcher — הפלט בהתאם לחתימה.
 */
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

/**
 * פעולה createShiftFromRow: יצירת משמרת / שורה.
 * @param row — שורה.
 * @returns AvailabilityMatrixShift — הפלט בהתאם לחתימה.
 */
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

/**
 * פעולה אסינכרונית getAvailabilityPeriodMatrix: שליפה או חישוב של תקופת אילוצים.
 * הפעולה פונה ל־RPC: get_availability_period_matrix.
 * @param periodId — מזהה התקופה.
 * @returns Promise<AvailabilityPeriodMatrix> — הפלט בהתאם לחתימה.
 */
async function getAvailabilityPeriodMatrix(
  periodId: string,
): Promise<AvailabilityPeriodMatrix> {
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
    'get_availability_period_matrix',
    {
      requested_period_id:
        normalizedPeriodId,
    },
  );

  // עצירת הפעולה עם שגיאה כאשר error.
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
        'אין לך הרשאה לצפות במטריצת הזמינות.',
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
      'לא ניתן היה לטעון את מטריצת הזמינות.',
    );
  }

  // rows — שורות.
  const rows =
    (
      data as
        | AvailabilityMatrixDatabaseRow[]
        | null
    ) ?? [];

  // עצירת הפעולה עם שגיאה כאשר rows.length === 0.
  if (rows.length === 0) {
    throw new Error(
      'לא נמצאו נתוני זמינות עבור התקופה.',
    );
  }

  // firstRow — שורה.
  const firstRow =
    rows[0];

  // shiftsById — משמרות / מזהה; מיפוי לחיפוש לפי מפתח.
  const shiftsById =
    new Map<
      string,
      AvailabilityMatrixShift
    >();

  // עיבוד כל פריט מתוך rows בנפרד.
  for (const row of rows) {
    // shift — משמרת.
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

  // shifts — משמרות.
  const shifts =
    Array.from(
      shiftsById.values(),
    ).sort(
      (
        firstShift,
        secondShift,
      ) => {
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

// availabilityMatrixService — אילוצים וזמינות / מטריצת נתונים / שירות.
export const availabilityMatrixService = {
  getAvailabilityPeriodMatrix,
};