/**
 * קובץ: src/services/dispatcherAvailabilityService.ts
 * מטרה: טעינת אילוצי מוקדן, שמירת סימוני זמינות והגשת הטופס.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: MyOpenAvailabilityDatabaseRow, SaveShiftAvailabilityDatabaseRow, SubmitAvailabilityDatabaseRow, mapShiftRow, getMyOpenAvailability, saveShiftAvailability, submitMyAvailability.
 * - קריאות RPC המופעלות בקובץ: get_my_open_availability, save_my_shift_availability, submit_my_availability.
 * - ריכוז הפנייה למקור הנתונים ועיבוד התשובה בהתאם לפונקציות להלן.
 */
import { supabase } from '../lib/supabase';
import type {
  AvailabilitySubmissionStatus,
  DispatcherAvailabilityShift,
  DispatcherAvailabilityStatus,
  MyOpenAvailability,
  SaveShiftAvailabilityInput,
  SaveShiftAvailabilityResult,
  SubmitAvailabilityResult,
} from '../types/dispatcherAvailability';

/**
 * חוזה הנתונים MyOpenAvailabilityDatabaseRow: אילוצים וזמינות / שורה.
 */
interface MyOpenAvailabilityDatabaseRow {
  // period_id — מזהה התקופה.
  period_id: string;
  // period_year — תקופה / שנה.
  period_year: number;
  // period_month — תקופה / חודש.
  period_month: number;
  // period_title — תקופה / כותרת.
  period_title: string | null;
  // period_instructions — תקופה.
  period_instructions: string | null;
  // submission_deadline — מועד אחרון להגשת אילוצים.
  submission_deadline: string | null;
  // period_status — תקופה / סטטוס.
  period_status: 'open';

  // submission_status — מצב ההגשה.
  submission_status:
    AvailabilitySubmissionStatus;

  // submitted_at — הוגש.
  submitted_at: string | null;
  last_saved_at: string | null;
  // available_count — מספר הסימונים כזמין.
  available_count: number;
  // unavailable_count — מספר הסימונים כלא זמין.
  unavailable_count: number;

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

  // availability_status — מצב הזמינות.
  availability_status:
    DispatcherAvailabilityStatus | null;

  // availability_note — אילוצים וזמינות / הערה.
  availability_note: string | null;

  // availability_updated_at — מועד עדכון.
  availability_updated_at:
    string | null;
}
/**
 * חוזה הנתונים SaveShiftAvailabilityDatabaseRow: משמרת / אילוצים וזמינות / שורה.
 */
interface SaveShiftAvailabilityDatabaseRow {
  // shift_slot_id — משמרת / מזהה.
  shift_slot_id: string;
  // availability_status — מצב הזמינות.
  availability_status:
    DispatcherAvailabilityStatus;
  // availability_note — אילוצים וזמינות / הערה.
  availability_note: string | null;
  // availability_updated_at — מועד עדכון.
  availability_updated_at: string;
  // available_count — מספר הסימונים כזמין.
  available_count: number;
  // unavailable_count — מספר הסימונים כלא זמין.
  unavailable_count: number;
  // answered_count — כמות.
  answered_count: number;
  // total_shift_count — סך הכול / משמרת / כמות.
  total_shift_count: number;
}
/**
 * חוזה הנתונים SubmitAvailabilityDatabaseRow: אילוצים וזמינות / שורה.
 */
interface SubmitAvailabilityDatabaseRow {
  // period_id — מזהה התקופה.
  period_id: string;
  // submission_status — מצב ההגשה.
  submission_status: 'submitted';
  // submitted_at — הוגש.
  submitted_at: string;
  // available_count — מספר הסימונים כזמין.
  available_count: number;
  // unavailable_count — מספר הסימונים כלא זמין.
  unavailable_count: number;
  // answered_count — כמות.
  answered_count: number;
  // total_shift_count — סך הכול / משמרת / כמות.
  total_shift_count: number;
}
/**
 * פעולה mapShiftRow: מיפוי מפת התאמה / משמרת / שורה.
 * @param row — שורה.
 * @returns DispatcherAvailabilityShift — הפלט בהתאם לחתימה.
 */
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

/**
 * פעולה אסינכרונית getMyOpenAvailability: שליפה או חישוב של אילוצים וזמינות.
 * הפעולה פונה ל־RPC: get_my_open_availability.
 * @returns Promise<MyOpenAvailability | null> — הפלט בהתאם לחתימה.
 */
async function getMyOpenAvailability():
  Promise<MyOpenAvailability | null> {
  // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
  const {
    data,
    error,
  } = await supabase.rpc(
    'get_my_open_availability',
  );

  // עצירת הפעולה עם שגיאה כאשר error.
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
        'המשתמש אינו פעיל. יש לפנות למנהל המערכת.',
      );
    }

    // עצירת הפעולה עם שגיאה כאשר normalizedMessage.includes( 'not allowed', ).
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

  // rows — שורות.
  const rows =
    (
      data as
        | MyOpenAvailabilityDatabaseRow[]
        | null
    ) ?? [];

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר rows.length === 0.
  if (rows.length === 0) {
    return null;
  }

  // firstRow — שורה.
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
/**
 * פעולה אסינכרונית saveShiftAvailability: שמירת משמרת / אילוצים וזמינות.
 * הפעולה פונה ל־RPC: save_my_shift_availability.
 * @param input — קלט.
 * @returns Promise<SaveShiftAvailabilityResult> — הפלט בהתאם לחתימה.
 */
async function saveShiftAvailability(
  input: SaveShiftAvailabilityInput,
): Promise<SaveShiftAvailabilityResult> {
  // normalizedShiftSlotId — משמרת / מזהה.
  const normalizedShiftSlotId =
    input.shiftSlotId.trim();

  // עצירת הפעולה עם שגיאה כאשר !normalizedShiftSlotId.
  if (!normalizedShiftSlotId) {
    throw new Error(
      'לא התקבל מזהה משמרת תקין.',
    );
  }

  // normalizedNote — הערה.
  const normalizedNote =
    input.note?.trim() || null;

  // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
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

  // עצירת הפעולה עם שגיאה כאשר error.
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

    // normalizedMessage — הודעה.
    const normalizedMessage =
      error.message.toLowerCase();

    // עצירת הפעולה עם שגיאה כאשר normalizedMessage.includes( 'deadline has passed', ).
    if (
      normalizedMessage.includes(
        'deadline has passed',
      )
    ) {
      throw new Error(
        'מועד הגשת האילוצים כבר עבר.',
      );
    }

    // עצירת הפעולה עם שגיאה כאשר normalizedMessage.includes( 'period is not open', ).
    if (
      normalizedMessage.includes(
        'period is not open',
      )
    ) {
      throw new Error(
        'תקופת האילוצים אינה פתוחה להגשה.',
      );
    }

    // עצירת הפעולה עם שגיאה כאשר normalizedMessage.includes( 'already submitted', ).
    if (
      normalizedMessage.includes(
        'already submitted',
      )
    ) {
      throw new Error(
        'האילוצים כבר הוגשו ולא ניתן לשנותם.',
      );
    }

    // עצירת הפעולה עם שגיאה כאשר normalizedMessage.includes( 'not found', ).
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

  // rows — שורות.
  const rows =
    data as
      | SaveShiftAvailabilityDatabaseRow[]
      | null;

  // result — תוצאה.
  const result =
    rows?.[0];

  // עצירת הפעולה עם שגיאה כאשר !result.
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
/**
 * פעולה אסינכרונית submitMyAvailability: הגשת אילוצים וזמינות.
 * הפעולה פונה ל־RPC: submit_my_availability.
 * @returns Promise<SubmitAvailabilityResult> — הפלט בהתאם לחתימה.
 */
async function submitMyAvailability():
  Promise<SubmitAvailabilityResult> {
  // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
  const {
    data,
    error,
  } = await supabase.rpc(
    'submit_my_availability',
  );

  // עצירת הפעולה עם שגיאה כאשר error.
  if (error) {
    console.error(
      'SUBMIT MY AVAILABILITY ERROR:',
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

    // עצירת הפעולה עם שגיאה כאשר normalizedMessage.includes( 'all shift slots must be answered', ).
    if (
      normalizedMessage.includes(
        'all shift slots must be answered',
      )
    ) {
      throw new Error(
        'יש לסמן זמין או לא זמין עבור כל המשמרות לפני ההגשה.',
      );
    }

    // עצירת הפעולה עם שגיאה כאשר normalizedMessage.includes( 'deadline has passed', ).
    if (
      normalizedMessage.includes(
        'deadline has passed',
      )
    ) {
      throw new Error(
        'מועד הגשת האילוצים כבר עבר.',
      );
    }

    // עצירת הפעולה עם שגיאה כאשר normalizedMessage.includes( 'already submitted', ).
    if (
      normalizedMessage.includes(
        'already submitted',
      )
    ) {
      throw new Error(
        'האילוצים כבר הוגשו.',
      );
    }

    // עצירת הפעולה עם שגיאה כאשר normalizedMessage.includes( 'open availability period was not found', ) || normalizedMessage.includes( 'period is not open', ).
    if (
      normalizedMessage.includes(
        'open availability period was not found',
      ) ||
      normalizedMessage.includes(
        'period is not open',
      )
    ) {
      throw new Error(
        'אין כרגע תקופת אילוצים פתוחה להגשה.',
      );
    }

    // עצירת הפעולה עם שגיאה כאשר normalizedMessage.includes( 'submission record was not found', ).
    if (
      normalizedMessage.includes(
        'submission record was not found',
      )
    ) {
      throw new Error(
        'לא נמצאה רשומת הגשה עבור המשתמש.',
      );
    }

    throw new Error(
      'לא ניתן היה להגיש את האילוצים.',
    );
  }

  // rows — שורות.
  const rows =
    data as
      | SubmitAvailabilityDatabaseRow[]
      | null;

  // result — תוצאה.
  const result =
    rows?.[0];

  // עצירת הפעולה עם שגיאה כאשר !result.
  if (!result) {
    throw new Error(
      'הגשת האילוצים הסתיימה ללא תשובה תקינה מהשרת.',
    );
  }

  return {
    periodId:
      result.period_id,

    submissionStatus:
      result.submission_status,

    submittedAt:
      result.submitted_at,

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
// dispatcherAvailabilityService — מוקדנים / אילוצים וזמינות / שירות.
export const dispatcherAvailabilityService = {
  getMyOpenAvailability,
  saveShiftAvailability,
  submitMyAvailability,
};