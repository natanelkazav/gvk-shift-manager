/**
 * קובץ: src/services/availabilityService.ts
 * מטרה: ניהול תקופות אילוצי מוקדנים ושליפת תקופות עבודה זמינות.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: AvailabilityPeriodDatabaseRow, DeleteAvailabilityPeriodDatabaseRow, CreateAvailabilityPeriodDatabaseRow, FunctionErrorResponse, RebuildAvailabilityPeriodDatabaseRow, OpenAvailabilityPeriodDatabaseRow, CloseAvailabilityPeriodDatabaseRow, mapAvailabilityPeriod, getFunctionErrorMessage, getAvailabilityPeriods ועוד.
 * - קריאות RPC המופעלות בקובץ: create_availability_period, rebuild_availability_period_slots, open_availability_period, close_availability_period, reopen_availability_period, delete_availability_period.
 * - מקורות נתונים הנזכרים בקריאות from: availability_periods.
 * - ריכוז הפנייה למקור הנתונים ועיבוד התשובה בהתאם לפונקציות להלן.
 */
import { supabase } from '../lib/supabase';
import type {
  AvailabilityPeriod,
  AvailabilityPeriodStatus,
  CreateAvailabilityPeriodInput,
  CreateAvailabilityPeriodResult,
  ImportSpecialDaysResult,
  OpenAvailabilityPeriodResult,
  CloseAvailabilityPeriodResult,
  DeleteAvailabilityPeriodResult,
  RebuildAvailabilityPeriodResult,
} from '../types/availability';

/**
 * חוזה הנתונים AvailabilityPeriodDatabaseRow: תקופת אילוצים.
 */
interface AvailabilityPeriodDatabaseRow {
  // id — מזהה.
  id: string;
  // year — שנה.
  year: number;
  // month — חודש.
  month: number;
  // status — סטטוס.
  status:
    AvailabilityPeriodStatus;
  // title — כותרת.
  title: string | null;
  instructions: string | null;
  // submission_deadline — מועד אחרון להגשת אילוצים.
  submission_deadline:
    string | null;
  opened_at: string | null;
  closed_at: string | null;
  created_by: string | null;
  updated_by: string | null;
  // created_at — מועד יצירה.
  created_at: string;
  // updated_at — מועד עדכון.
  updated_at: string;
}
/**
 * חוזה הנתונים DeleteAvailabilityPeriodDatabaseRow: תקופת אילוצים.
 */
interface DeleteAvailabilityPeriodDatabaseRow {
  // deleted_period_id — מזהה התקופה.
  deleted_period_id: string;
  // deleted_period_title — תקופה / כותרת.
  deleted_period_title: string | null;
  // deleted_period_year — תקופה / שנה.
  deleted_period_year: number;
  // deleted_period_month — תקופה / חודש.
  deleted_period_month: number;
  // deleted_shift_slots — משמרת.
  deleted_shift_slots: number;
  // deleted_availability_rows — אילוצים וזמינות / שורות.
  deleted_availability_rows: number;
  deleted_submissions: number;
}
/**
 * חוזה הנתונים CreateAvailabilityPeriodDatabaseRow: תקופת אילוצים.
 */
interface CreateAvailabilityPeriodDatabaseRow {
  // period_id — מזהה התקופה.
  period_id: string;
  created_slots: number;
  // period_status — תקופה / סטטוס.
  period_status:
    AvailabilityPeriodStatus;
}

/**
 * חוזה הנתונים FunctionErrorResponse: שגיאה / תוצאת הפעולה.
 */
interface FunctionErrorResponse {
  // error — שגיאה (אופציונלי).
  error?: string;
}
/**
 * חוזה הנתונים RebuildAvailabilityPeriodDatabaseRow: תקופת אילוצים.
 */
interface RebuildAvailabilityPeriodDatabaseRow {
  // period_id — מזהה התקופה.
  period_id: string;
  created_slots: number;
}
/**
 * חוזה הנתונים OpenAvailabilityPeriodDatabaseRow: תקופת אילוצים.
 */
interface OpenAvailabilityPeriodDatabaseRow {
  // period_id — מזהה התקופה.
  period_id: string;
  // period_status — תקופה / סטטוס.
  period_status: 'open';
  opened_at: string;
  // shift_slots_count — משמרת / כמות.
  shift_slots_count: number;
}
/**
 * חוזה הנתונים CloseAvailabilityPeriodDatabaseRow: תקופת אילוצים.
 */
interface CloseAvailabilityPeriodDatabaseRow {
  // period_id — מזהה התקופה.
  period_id: string;
  // period_status — תקופה / סטטוס.
  period_status: 'closed';
  closed_at: string;
  // total_dispatchers — סך הכול.
  total_dispatchers: number;
  // submitted_dispatchers — הוגש.
  submitted_dispatchers: number;
}
/**
 * פעולה mapAvailabilityPeriod: מיפוי תקופת אילוצים.
 * @param row — שורה.
 * @returns AvailabilityPeriod — הפלט בהתאם לחתימה.
 */
function mapAvailabilityPeriod(
  row:
    AvailabilityPeriodDatabaseRow,
): AvailabilityPeriod {
  return {
    id: row.id,
    year: row.year,
    month: row.month,
    status: row.status,
    title: row.title,
    instructions:
      row.instructions,

    submissionDeadline:
      row.submission_deadline,

    openedAt:
      row.opened_at,

    closedAt:
      row.closed_at,

    createdBy:
      row.created_by,

    updatedBy:
      row.updated_by,

    createdAt:
      row.created_at,

    updatedAt:
      row.updated_at,
  };
}

/**
 * פעולה אסינכרונית getFunctionErrorMessage: שליפה או חישוב של הודעת שגיאה.
 * @param error — שגיאה.
 * @returns Promise<string> — הפלט בהתאם לחתימה.
 */
async function getFunctionErrorMessage(
  error: unknown,
): Promise<string> {
  if (
    typeof error === 'object' &&
    error !== null &&
    'context' in error
  ) {
    const context = (
      error as {
        context?: Response;
      }
    ).context;

    if (
      context instanceof Response
    ) {
      // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
      try {
        // body — תוכן.
        const body =
          (await context.json()) as
            FunctionErrorResponse;

        // טיפול במקרה מיוחד ויציאה מוקדמת כאשר body.error.
        if (body.error) {
          return body.error;
        }
      } catch {
        return 'לא ניתן היה לקרוא את תגובת השרת.';
      }
    }
  }

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר error instanceof Error.
  if (error instanceof Error) {
    return error.message;
  }

  return 'אירעה שגיאה בלתי צפויה.';
}

/**
 * פעולה אסינכרונית getAvailabilityPeriods: שליפה או חישוב של תקופות אילוצים.
 * @returns Promise<AvailabilityPeriod[]> — הפלט בהתאם לחתימה.
 */
async function getAvailabilityPeriods():
  Promise<AvailabilityPeriod[]> {
  // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
  const { data, error } =
    await supabase
      .from(
        'availability_periods',
      )
      .select(`
        id,
        year,
        month,
        status,
        title,
        instructions,
        submission_deadline,
        opened_at,
        closed_at,
        created_by,
        updated_by,
        created_at,
        updated_at
      `)
      .order('year', {
        ascending: false,
      })
      .order('month', {
        ascending: false,
      });

  // עצירת הפעולה עם שגיאה כאשר error.
  if (error) {
    console.error(
      'GET AVAILABILITY PERIODS ERROR:',
      error,
    );

    throw new Error(
      'לא ניתן היה לטעון את תקופות האילוצים.',
    );
  }

  return (
    (
      data as
        | AvailabilityPeriodDatabaseRow[]
        | null
    ) ?? []
  ).map(mapAvailabilityPeriod);
}

/**
 * פעולה אסינכרונית createAvailabilityPeriod: יצירת תקופת אילוצים.
 * הפעולה פונה ל־RPC: create_availability_period.
 * @param input — קלט.
 * @returns Promise<CreateAvailabilityPeriodResult> — הפלט בהתאם לחתימה.
 */
async function createAvailabilityPeriod(
  input:
    CreateAvailabilityPeriodInput,
): Promise<CreateAvailabilityPeriodResult> {
  // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
  const {
    data,
    error,
  } = await supabase.rpc(
    'create_availability_period',
    {
      requested_year:
        input.year,

      requested_month:
        input.month,

      requested_submission_deadline:
        input.submissionDeadline,

      requested_title:
        input.title?.trim() ||
        null,

      requested_instructions:
        input.instructions
          ?.trim() ||
        null,
    },
  );

  // עצירת הפעולה עם שגיאה כאשר error.
  if (error) {
    console.error(
      'CREATE AVAILABILITY PERIOD ERROR:',
      error,
    );

    // עצירת הפעולה עם שגיאה כאשר error.message .toLowerCase() .includes( 'already exists', ).
    if (
      error.message
        .toLowerCase()
        .includes(
          'already exists',
        )
    ) {
      throw new Error(
        'כבר קיימת תקופת אילוצים עבור החודש שנבחר.',
      );
    }

    throw new Error(
      'לא ניתן היה ליצור את תקופת האילוצים.',
    );
  }

  // resultRows — תוצאה / שורות.
  const resultRows =
    data as
      | CreateAvailabilityPeriodDatabaseRow[]
      | null;

  // result — תוצאה.
  const result =
    resultRows?.[0];

  // עצירת הפעולה עם שגיאה כאשר !result.
  if (!result) {
    throw new Error(
      'תקופת האילוצים נוצרה ללא תשובה תקינה מהשרת.',
    );
  }

  return {
    periodId:
      result.period_id,

    createdSlots:
      result.created_slots,

    periodStatus:
      result.period_status,
  };
}

/**
 * פעולה אסינכרונית importCalendarSpecialDays: ייבוא ייבוא / לוח שנה / ימים.
 * @param year — שנה.
 * @returns Promise<ImportSpecialDaysResult> — הפלט בהתאם לחתימה.
 */
async function importCalendarSpecialDays(
  year: number,
): Promise<ImportSpecialDaysResult> {
  // עצירת הפעולה עם שגיאה כאשר !Number.isInteger(year) || year < 2020 || year > 2200.
  if (
    !Number.isInteger(year) ||
    year < 2020 ||
    year > 2200
  ) {
    throw new Error(
      'שנת הייבוא אינה תקינה.',
    );
  }

  // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
  const {
    data,
    error,
  } = await supabase.functions.invoke<
    ImportSpecialDaysResult
  >(
    'import-calendar-special-days',
    {
      body: {
        year,
      },
    },
  );

  // עצירת הפעולה עם שגיאה כאשר error.
  if (error) {
    console.error(
      'IMPORT CALENDAR SPECIAL DAYS ERROR:',
      error,
    );

    // errorMessage — הודעת שגיאה.
    const errorMessage =
      await getFunctionErrorMessage(
        error,
      );

    throw new Error(errorMessage);
  }

  // עצירת הפעולה עם שגיאה כאשר !data || data.success !== true.
  if (
    !data ||
    data.success !== true
  ) {
    throw new Error(
      'ייבוא החגים הסתיים ללא תשובה תקינה מהשרת.',
    );
  }

  return data;
}
/**
 * פעולה אסינכרונית rebuildAvailabilityPeriodSlots: תקופת אילוצים.
 * הפעולה פונה ל־RPC: rebuild_availability_period_slots.
 * @param periodId — מזהה התקופה.
 * @returns Promise<RebuildAvailabilityPeriodResult> — הפלט בהתאם לחתימה.
 */
async function rebuildAvailabilityPeriodSlots(
  periodId: string,
): Promise<RebuildAvailabilityPeriodResult> {
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
    'rebuild_availability_period_slots',
    {
      requested_period_id:
        normalizedPeriodId,
    },
  );

  // עצירת הפעולה עם שגיאה כאשר error.
  if (error) {
    console.error(
      'REBUILD AVAILABILITY PERIOD SLOTS ERROR:',
      error,
    );

    // normalizedMessage — הודעה.
    const normalizedMessage =
      error.message.toLowerCase();

    // עצירת הפעולה עם שגיאה כאשר normalizedMessage.includes( 'only draft', ).
    if (
      normalizedMessage.includes(
        'only draft',
      )
    ) {
      throw new Error(
        'ניתן לבנות מחדש משמרות רק בתקופת אילוצים שנמצאת במצב טיוטה.',
      );
    }

    // עצירת הפעולה עם שגיאה כאשר normalizedMessage.includes( 'dispatcher responses', ) || normalizedMessage.includes( 'submission data', ).
    if (
      normalizedMessage.includes(
        'dispatcher responses',
      ) ||
      normalizedMessage.includes(
        'submission data',
      )
    ) {
      throw new Error(
        'לא ניתן לבנות מחדש את החודש לאחר שמוקדנים התחילו להזין אילוצים.',
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
      'לא ניתן היה לבנות מחדש את משמרות החודש.',
    );
  }

  // resultRows — תוצאה / שורות.
  const resultRows =
    data as
      | RebuildAvailabilityPeriodDatabaseRow[]
      | null;

  // result — תוצאה.
  const result =
    resultRows?.[0];

  // עצירת הפעולה עם שגיאה כאשר !result.
  if (!result) {
    throw new Error(
      'הבנייה מחדש הסתיימה ללא תשובה תקינה מהשרת.',
    );
  }

  return {
    periodId:
      result.period_id,

    createdSlots:
      result.created_slots,
  };
}
/**
 * פעולה אסינכרונית openAvailabilityPeriod: פתיחת תקופת אילוצים.
 * הפעולה פונה ל־RPC: open_availability_period.
 * @param periodId — מזהה התקופה.
 * @returns Promise<OpenAvailabilityPeriodResult> — הפלט בהתאם לחתימה.
 */
async function openAvailabilityPeriod(
  periodId: string,
): Promise<OpenAvailabilityPeriodResult> {
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
    'open_availability_period',
    {
      requested_period_id:
        normalizedPeriodId,
    },
  );

// עצירת הפעולה עם שגיאה כאשר error.
if (error) {
  console.error(
    'OPEN AVAILABILITY PERIOD ERROR:',
    JSON.stringify(
      {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      },
      null,
      2,
    ),
  );
// normalizedMessage — הודעה.
const normalizedMessage =
    error.message.toLowerCase();

  // עצירת הפעולה עם שגיאה כאשר normalizedMessage.includes( 'only draft', ).
  if (
    normalizedMessage.includes(
      'only draft',
    )
  ) {
    throw new Error(
      'ניתן לפתוח להגשה רק תקופת אילוצים במצב טיוטה.',
    );
  }

  // עצירת הפעולה עם שגיאה כאשר normalizedMessage.includes( 'does not contain shift slots', ).
  if (
    normalizedMessage.includes(
      'does not contain shift slots',
    )
  ) {
    throw new Error(
      'לא ניתן לפתוח את התקופה משום שלא נוצרו עבורה משמרות.',
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
    'לא ניתן היה לפתוח את תקופת האילוצים להגשה.',
  );
}

// מכאן ממשיכים ישירות ל־resultRows
// resultRows — תוצאה / שורות.
const resultRows =
  data as
    | OpenAvailabilityPeriodDatabaseRow[]
    | null;

  // result — תוצאה.
  const result =
    resultRows?.[0];

  // עצירת הפעולה עם שגיאה כאשר !result.
  if (!result) {
    throw new Error(
      'פתיחת תקופת האילוצים הסתיימה ללא תשובה תקינה מהשרת.',
    );
  }

  return {
    periodId:
      result.period_id,

    periodStatus:
      result.period_status,

    openedAt:
      result.opened_at,

    shiftSlotsCount:
      result.shift_slots_count,
  };
}
/**
 * פעולה אסינכרונית closeAvailabilityPeriod: סגירת תקופת אילוצים.
 * הפעולה פונה ל־RPC: close_availability_period.
 * @param periodId — מזהה התקופה.
 * @returns Promise<CloseAvailabilityPeriodResult> — הפלט בהתאם לחתימה.
 */
async function closeAvailabilityPeriod(
  periodId: string,
): Promise<CloseAvailabilityPeriodResult> {
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
    'close_availability_period',
    {
      requested_period_id:
        normalizedPeriodId,
    },
  );

  // עצירת הפעולה עם שגיאה כאשר error.
  if (error) {
    console.error(
      'CLOSE AVAILABILITY PERIOD ERROR:',
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

    // עצירת הפעולה עם שגיאה כאשר normalizedMessage.includes( 'only open', ).
    if (
      normalizedMessage.includes(
        'only open',
      )
    ) {
      throw new Error(
        'ניתן לסגור רק תקופת אילוצים שפתוחה להגשה.',
      );
    }

    // עצירת הפעולה עם שגיאה כאשר normalizedMessage.includes( 'not all active dispatchers', ).
    if (
      normalizedMessage.includes(
        'not all active dispatchers',
      )
    ) {
      throw new Error(
        'לא ניתן לסגור את התקופה לפני שכל המוקדנים הפעילים הגישו את האילוצים.',
      );
    }

    // עצירת הפעולה עם שגיאה כאשר normalizedMessage.includes( 'no active dispatchers', ).
    if (
      normalizedMessage.includes(
        'no active dispatchers',
      )
    ) {
      throw new Error(
        'לא נמצאו מוקדנים פעילים עבור התקופה.',
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

    // עצירת הפעולה עם שגיאה כאשר normalizedMessage.includes( 'not allowed', ).
    if (
      normalizedMessage.includes(
        'not allowed',
      )
    ) {
      throw new Error(
        'אין לך הרשאה לסגור תקופות אילוצים.',
      );
    }

    throw new Error(
      'לא ניתן היה לסגור את תקופת האילוצים.',
    );
  }

  // rows — שורות.
  const rows =
    data as
      | CloseAvailabilityPeriodDatabaseRow[]
      | null;

  // result — תוצאה.
  const result =
    rows?.[0];

  // עצירת הפעולה עם שגיאה כאשר !result.
  if (!result) {
    throw new Error(
      'סגירת תקופת האילוצים הסתיימה ללא תשובה תקינה מהשרת.',
    );
  }

  return {
    periodId:
      result.period_id,

    periodStatus:
      result.period_status,

    closedAt:
      result.closed_at,

    totalDispatchers:
      result.total_dispatchers,

    submittedDispatchers:
      result.submitted_dispatchers,
  };
}

/**
 * פעולה אסינכרונית reopenAvailabilityPeriod: פתיחה מחדש של תקופת אילוצים.
 * הפעולה פונה ל־RPC: reopen_availability_period.
 * @param periodId — מזהה התקופה.
 * @returns Promise<import('../types/availability').ReopenAvailabilityPeriodResult> — הפלט בהתאם לחתימה.
 */
async function reopenAvailabilityPeriod(
  periodId: string,
): Promise<import('../types/availability').ReopenAvailabilityPeriodResult> {
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
  } =
    await supabase.rpc(
      'reopen_availability_period',
      {
        requested_period_id:
          normalizedPeriodId,
      },
    );

  // עצירת הפעולה עם שגיאה כאשר error.
  if (error) {
    // message — הודעה.
    const message =
      error.message
        .toLowerCase();

    // עצירת הפעולה עם שגיאה כאשר message.includes( 'only closed', ).
    if (
      message.includes(
        'only closed',
      )
    ) {
      throw new Error(
        'ניתן לפתוח מחדש רק תקופת אילוצים סגורה.',
      );
    }

    // עצירת הפעולה עם שגיאה כאשר message.includes( 'not allowed', ).
    if (
      message.includes(
        'not allowed',
      )
    ) {
      throw new Error(
        'אין לך הרשאה לפתוח מחדש תקופת אילוצים.',
      );
    }

    throw new Error(
      'לא ניתן היה לפתוח מחדש את תקופת האילוצים.',
    );
  }

  // עצירת הפעולה עם שגיאה כאשר !data.
  if (!data) {
    throw new Error(
      'לא התקבלה תשובה לאחר פתיחת התקופה מחדש.',
    );
  }

  return data as
    import('../types/availability').ReopenAvailabilityPeriodResult;
}

/**
 * פעולה אסינכרונית deleteAvailabilityPeriod: מחיקת תקופת אילוצים.
 * הפעולה פונה ל־RPC: delete_availability_period.
 * @param periodId — מזהה התקופה.
 * @returns Promise<DeleteAvailabilityPeriodResult> — הפלט בהתאם לחתימה.
 */
async function deleteAvailabilityPeriod(
  periodId: string,
): Promise<DeleteAvailabilityPeriodResult> {
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
    'delete_availability_period',
    {
      requested_period_id:
        normalizedPeriodId,
    },
  );

  // עצירת הפעולה עם שגיאה כאשר error.
  if (error) {
    console.error(
      'DELETE AVAILABILITY PERIOD ERROR:',
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
        'אין לך הרשאה למחוק תקופות אילוצים.',
      );
    }

    // עצירת הפעולה עם שגיאה כאשר normalizedMessage.includes( 'not found', ).
    if (
      normalizedMessage.includes(
        'not found',
      )
    ) {
      throw new Error(
        'תקופת האילוצים לא נמצאה או שכבר נמחקה.',
      );
    }

    throw new Error(
      'לא ניתן היה למחוק את תקופת האילוצים.',
    );
  }

  // rows — שורות.
  const rows =
    data as
      | DeleteAvailabilityPeriodDatabaseRow[]
      | null;

  // result — תוצאה.
  const result =
    rows?.[0];

  // עצירת הפעולה עם שגיאה כאשר !result.
  if (!result) {
    throw new Error(
      'מחיקת תקופת האילוצים הסתיימה ללא תשובה תקינה מהשרת.',
    );
  }

  return {
    deletedPeriodId:
      result.deleted_period_id,

    deletedPeriodTitle:
      result.deleted_period_title,

    deletedPeriodYear:
      result.deleted_period_year,

    deletedPeriodMonth:
      result.deleted_period_month,

    deletedShiftSlots:
      result.deleted_shift_slots,

    deletedAvailabilityRows:
      result.deleted_availability_rows,

    deletedSubmissions:
      result.deleted_submissions,
  };
}
// availabilityService — אילוצים וזמינות / שירות.
export const availabilityService = {
  getAvailabilityPeriods,
  createAvailabilityPeriod,
  importCalendarSpecialDays,
  rebuildAvailabilityPeriodSlots,
  openAvailabilityPeriod,
  closeAvailabilityPeriod,
  reopenAvailabilityPeriod,
  deleteAvailabilityPeriod,
};