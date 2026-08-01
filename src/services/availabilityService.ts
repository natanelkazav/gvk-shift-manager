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

interface AvailabilityPeriodDatabaseRow {
  id: string;
  year: number;
  month: number;
  status:
    AvailabilityPeriodStatus;
  title: string | null;
  instructions: string | null;
  submission_deadline:
    string | null;
  opened_at: string | null;
  closed_at: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}
interface DeleteAvailabilityPeriodDatabaseRow {
  deleted_period_id: string;
  deleted_period_title: string | null;
  deleted_period_year: number;
  deleted_period_month: number;
  deleted_shift_slots: number;
  deleted_availability_rows: number;
  deleted_submissions: number;
}
interface CreateAvailabilityPeriodDatabaseRow {
  period_id: string;
  created_slots: number;
  period_status:
    AvailabilityPeriodStatus;
}

interface FunctionErrorResponse {
  error?: string;
}
interface RebuildAvailabilityPeriodDatabaseRow {
  period_id: string;
  created_slots: number;
}
interface OpenAvailabilityPeriodDatabaseRow {
  period_id: string;
  period_status: 'open';
  opened_at: string;
  shift_slots_count: number;
}
interface CloseAvailabilityPeriodDatabaseRow {
  period_id: string;
  period_status: 'closed';
  closed_at: string;
  total_dispatchers: number;
  submitted_dispatchers: number;
}
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
      try {
        const body =
          (await context.json()) as
            FunctionErrorResponse;

        if (body.error) {
          return body.error;
        }
      } catch {
        return 'לא ניתן היה לקרוא את תגובת השרת.';
      }
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'אירעה שגיאה בלתי צפויה.';
}

async function getAvailabilityPeriods():
  Promise<AvailabilityPeriod[]> {
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

async function createAvailabilityPeriod(
  input:
    CreateAvailabilityPeriodInput,
): Promise<CreateAvailabilityPeriodResult> {
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

  if (error) {
    console.error(
      'CREATE AVAILABILITY PERIOD ERROR:',
      error,
    );

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

  const resultRows =
    data as
      | CreateAvailabilityPeriodDatabaseRow[]
      | null;

  const result =
    resultRows?.[0];

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

async function importCalendarSpecialDays(
  year: number,
): Promise<ImportSpecialDaysResult> {
  if (
    !Number.isInteger(year) ||
    year < 2020 ||
    year > 2200
  ) {
    throw new Error(
      'שנת הייבוא אינה תקינה.',
    );
  }

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

  if (error) {
    console.error(
      'IMPORT CALENDAR SPECIAL DAYS ERROR:',
      error,
    );

    const errorMessage =
      await getFunctionErrorMessage(
        error,
      );

    throw new Error(errorMessage);
  }

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
async function rebuildAvailabilityPeriodSlots(
  periodId: string,
): Promise<RebuildAvailabilityPeriodResult> {
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
    'rebuild_availability_period_slots',
    {
      requested_period_id:
        normalizedPeriodId,
    },
  );

  if (error) {
    console.error(
      'REBUILD AVAILABILITY PERIOD SLOTS ERROR:',
      error,
    );

    const normalizedMessage =
      error.message.toLowerCase();

    if (
      normalizedMessage.includes(
        'only draft',
      )
    ) {
      throw new Error(
        'ניתן לבנות מחדש משמרות רק בתקופת אילוצים שנמצאת במצב טיוטה.',
      );
    }

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

  const resultRows =
    data as
      | RebuildAvailabilityPeriodDatabaseRow[]
      | null;

  const result =
    resultRows?.[0];

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
async function openAvailabilityPeriod(
  periodId: string,
): Promise<OpenAvailabilityPeriodResult> {
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
    'open_availability_period',
    {
      requested_period_id:
        normalizedPeriodId,
    },
  );

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
const normalizedMessage =
    error.message.toLowerCase();

  if (
    normalizedMessage.includes(
      'only draft',
    )
  ) {
    throw new Error(
      'ניתן לפתוח להגשה רק תקופת אילוצים במצב טיוטה.',
    );
  }

  if (
    normalizedMessage.includes(
      'does not contain shift slots',
    )
  ) {
    throw new Error(
      'לא ניתן לפתוח את התקופה משום שלא נוצרו עבורה משמרות.',
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
    'לא ניתן היה לפתוח את תקופת האילוצים להגשה.',
  );
}

// מכאן ממשיכים ישירות ל־resultRows
const resultRows =
  data as
    | OpenAvailabilityPeriodDatabaseRow[]
    | null;

  const result =
    resultRows?.[0];

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
async function closeAvailabilityPeriod(
  periodId: string,
): Promise<CloseAvailabilityPeriodResult> {
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
    'close_availability_period',
    {
      requested_period_id:
        normalizedPeriodId,
    },
  );

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

    const normalizedMessage =
      error.message.toLowerCase();

    if (
      normalizedMessage.includes(
        'only open',
      )
    ) {
      throw new Error(
        'ניתן לסגור רק תקופת אילוצים שפתוחה להגשה.',
      );
    }

    if (
      normalizedMessage.includes(
        'not all active dispatchers',
      )
    ) {
      throw new Error(
        'לא ניתן לסגור את התקופה לפני שכל המוקדנים הפעילים הגישו את האילוצים.',
      );
    }

    if (
      normalizedMessage.includes(
        'no active dispatchers',
      )
    ) {
      throw new Error(
        'לא נמצאו מוקדנים פעילים עבור התקופה.',
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

  const rows =
    data as
      | CloseAvailabilityPeriodDatabaseRow[]
      | null;

  const result =
    rows?.[0];

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
async function deleteAvailabilityPeriod(
  periodId: string,
): Promise<DeleteAvailabilityPeriodResult> {
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
    'delete_availability_period',
    {
      requested_period_id:
        normalizedPeriodId,
    },
  );

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
        'אין לך הרשאה למחוק תקופות אילוצים.',
      );
    }

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

  const rows =
    data as
      | DeleteAvailabilityPeriodDatabaseRow[]
      | null;

  const result =
    rows?.[0];

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
export const availabilityService = {
  getAvailabilityPeriods,
  createAvailabilityPeriod,
  importCalendarSpecialDays,
  rebuildAvailabilityPeriodSlots,
  openAvailabilityPeriod,
  closeAvailabilityPeriod,
  deleteAvailabilityPeriod,
};