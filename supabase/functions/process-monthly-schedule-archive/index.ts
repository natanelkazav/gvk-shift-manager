/**
 * קובץ: supabase/functions/process-monthly-schedule-archive/index.ts
 * מטרה: טיפול בבקשות HTTP לפעולת השרת process-monthly-schedule-archive.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: ProfileRow, DispatcherShiftRow, DriverDayRow, MorningAssignmentRow, MorningAvailabilityShiftRow, ExportDispatcherShift, ExportDriverDay, ExportMorningAssignment, DayRowDefinition, jsonResponse ועוד.
 * - מקורות נתונים הנזכרים בקריאות from: profiles, dynamic_schedule_publications, job_types, dynamic_schedule_published_assignments, dynamic_availability_slots, monthly_schedule_archive_runs, audit_logs.
 * - ריכוז ההגדרות והלוגיקה המפורטות בהמשך הקובץ.
 */
import ExcelJS from 'npm:exceljs@4.4.0';

import {
  createClient,
} from 'npm:@supabase/supabase-js@2';

import {
  scheduleExportTemplateBase64,
} from './templateBase64.ts';

// archiveSubject — ארכיון.
const archiveSubject =
  'GVK_MONTHLY_TEAMS_ARCHIVE';

// TEMPLATE_SHEET_NAME — תבנית / שם.
const TEMPLATE_SHEET_NAME =
  'לוח זמנים ריק לכוננים';

// FIRST_DATA_ROW — נתונים / שורה.
const FIRST_DATA_ROW = 2;
// ROWS_PER_DAY — שורות / יום.
const ROWS_PER_DAY = 3;
// MAX_DAYS — ימים.
const MAX_DAYS = 31;

// LAST_TEMPLATE_ROW — תבנית / שורה.
const LAST_TEMPLATE_ROW =
  FIRST_DATA_ROW +
  MAX_DAYS *
    ROWS_PER_DAY -
  1;

// hebrewMonths — חודשים.
const hebrewMonths = [
  'ינואר',
  'פברואר',
  'מרץ',
  'אפריל',
  'מאי',
  'יוני',
  'יולי',
  'אוגוסט',
  'ספטמבר',
  'אוקטובר',
  'נובמבר',
  'דצמבר',
];

// hebrewWeekdays — הנתון hebrewWeekdays בהקשר הפעולה.
const hebrewWeekdays = [
  'ראשון',
  'שני',
  'שלישי',
  'רביעי',
  'חמישי',
  'שישי',
  'שבת',
];

/**
 * חוזה הנתונים ProfileRow: פרופיל / שורה.
 */
interface ProfileRow {
  // id — מזהה.
  id: string;
  // display_name — שם תצוגה.
  display_name:
    string | null;
  // schedule_name — שיבוץ / שם.
  schedule_name:
    string | null;
}

/**
 * חוזה הנתונים DispatcherShiftRow: מוקדנים / משמרת / שורה.
 */
interface DispatcherShiftRow {
  // id — מזהה.
  id: string;
  // shift_date — תאריך המשמרת.
  shift_date: string;
  // starts_at — מועד התחלה.
  starts_at: string;
  // ends_at — מועד סיום.
  ends_at: string;
  // is_premium — תעריף מוגדל.
  is_premium: boolean;
  // holiday_name — חג / שם.
  holiday_name:
    string | null;
  // assigned_user_id — מזהה העובד המשובץ.
  assigned_user_id:
    string | null;
}

/**
 * חוזה הנתונים DriverDayRow: כוננים / יום / שורה.
 */
interface DriverDayRow {
  // duty_date — תאריך.
  duty_date: string;
  // assigned_user_id — מזהה העובד המשובץ.
  assigned_user_id:
    string | null;
}

/**
 * חוזה הנתונים MorningAssignmentRow: הקצאה / שורה.
 */
interface MorningAssignmentRow {
  // availability_shift_id — מזהה המשמרת.
  availability_shift_id: string;
  // assignment_slot — הקצאה.
  assignment_slot: number;
  // assigned_user_id — מזהה העובד המשובץ.
  assigned_user_id:
    string | null;
}

/**
 * חוזה הנתונים MorningAvailabilityShiftRow: אילוצים וזמינות / משמרת / שורה.
 */
interface MorningAvailabilityShiftRow {
  // id — מזהה.
  id: string;
  // shift_date — תאריך המשמרת.
  shift_date: string;
  // start_time — שעת התחלה.
  start_time: string;
  // end_time — שעת סיום.
  end_time: string;
}

/**
 * חוזה הנתונים ExportDispatcherShift: ייצוא / מוקדנים / משמרת.
 */
interface ExportDispatcherShift {
  // shiftDate — תאריך המשמרת.
  shiftDate: string;
  // startsAt — מועד התחלה.
  startsAt: string;
  // endsAt — מועד סיום.
  endsAt: string;
  // isPremium — תעריף מוגדל.
  isPremium: boolean;
  // holidayName — חג / שם.
  holidayName:
    string | null;
  // assignedUserName — משתמש / שם.
  assignedUserName:
    string | null;
}

/**
 * חוזה הנתונים ExportDriverDay: ייצוא / כוננים / יום.
 */
interface ExportDriverDay {
  // dutyDate — תאריך.
  dutyDate: string;
  // assignedUserName — משתמש / שם.
  assignedUserName:
    string | null;
}

/**
 * חוזה הנתונים ExportMorningAssignment: ייצוא / הקצאה.
 */
interface ExportMorningAssignment {
  // shiftDate — תאריך המשמרת.
  shiftDate: string;
  // startTime — שעת התחלה.
  startTime: string;
  // endTime — שעת סיום.
  endTime: string;
  // assignmentSlot — הקצאה.
  assignmentSlot: number;
  // assignedUserName — משתמש / שם.
  assignedUserName:
    string | null;
}

/**
 * חוזה הנתונים DayRowDefinition: יום / שורה.
 */
interface DayRowDefinition {
  // dispatcherHours — מוקדנים / שעות.
  dispatcherHours: string;
  // morningDriverHours — כונני בוקר.
  morningDriverHours: string;
}

/**
 * פעולה jsonResponse: תוצאת הפעולה.
 * @param body — תוכן.
 * @param status — סטטוס.
 * @returns Response — הפלט בהתאם לחתימה.
 */
function jsonResponse(
  body: unknown,
  status = 200,
): Response {
  return new Response(
    JSON.stringify(
      body,
    ),
    {
      status,
      headers: {
        'Content-Type':
          'application/json; charset=utf-8',
      },
    },
  );
}

/**
 * פעולה requiredEnv: הנתון requiredEnv בהקשר הפעולה.
 * @param name — שם.
 * @returns string — הפלט בהתאם לחתימה.
 */
function requiredEnv(
  name: string,
): string {
  // value — ערך.
  const value =
    Deno.env
      .get(
        name,
      )
      ?.trim();

  // עצירת הפעולה עם שגיאה כאשר !value.
  if (!value) {
    throw new Error(
      `Missing environment variable: ${name}`,
    );
  }

  return value;
}

/**
 * פעולה padNumber: הנתון padNumber בהקשר הפעולה.
 * @param value — ערך.
 * @returns string — הפלט בהתאם לחתימה.
 */
function padNumber(
  value: number,
): string {
  return String(value)
    .padStart(
      2,
      '0',
    );
}

/**
 * פעולה createDateKey: יצירת תאריך / מפתח.
 * @param year — שנה.
 * @param month — חודש.
 * @param day — יום.
 * @returns string — הפלט בהתאם לחתימה.
 */
function createDateKey(
  year: number,
  month: number,
  day: number,
): string {
  return [
    year,
    padNumber(
      month,
    ),
    padNumber(
      day,
    ),
  ].join(
    '-',
  );
}

/**
 * פעולה getDaysInMonth: שליפה או חישוב של ימים / חודש.
 * @param year — שנה.
 * @param month — חודש.
 * @returns number — הפלט בהתאם לחתימה.
 */
function getDaysInMonth(
  year: number,
  month: number,
): number {
  return new Date(
    year,
    month,
    0,
  ).getDate();
}

/**
 * פעולה getIsraelMonth: שליפה או חישוב של חודש.
 * @returns { year: number; month: number; day: number; } — הפלט בהתאם לחתימה.
 */
function getIsraelMonth():
  {
    // year — שנה.
    year: number;
    // month — חודש.
    month: number;
    // day — יום.
    day: number;
  } {
  const parts =
    new Intl.DateTimeFormat(
      'en-CA',
      {
        timeZone:
          'Asia/Jerusalem',
        year:
          'numeric',
        month:
          '2-digit',
        day:
          '2-digit',
      },
    )
      .formatToParts(
        new Date(),
      );

  // values — ערכים.
  const values =
    Object.fromEntries(
      parts.map(
        (
          part,
        ) => [
          part.type,
          part.value,
        ],
      ),
    );

  return {
    year:
      Number(
        values.year,
      ),
    month:
      Number(
        values.month,
      ),
    day:
      Number(
        values.day,
      ),
  };
}

/**
 * פעולה normalizeTime: נרמול זמן.
 * @param value — ערך.
 * @returns string | null — הפלט בהתאם לחתימה.
 */
function normalizeTime(
  value:
    string | null,
): string | null {
  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !value.
  if (!value) {
    return null;
  }

  const trimmed =
    value.trim();

  const plainMatch =
    trimmed.match(
      /^(\d{1,2}):(\d{2})/,
    );

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר plainMatch.
  if (plainMatch) {
    return `${padNumber(
      Number(
        plainMatch[1],
      ),
    )}:${plainMatch[2]}`;
  }

  // date — תאריך.
  const date =
    new Date(
      trimmed,
    );

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר Number.isNaN( date.getTime(), ).
  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return null;
  }

  return new Intl.DateTimeFormat(
    'he-IL',
    {
      timeZone:
        'Asia/Jerusalem',
      hour:
        '2-digit',
      minute:
        '2-digit',
      hourCycle:
        'h23',
    },
  )
    .format(
      date,
    )
    .replace(
      /\s/g,
      '',
    );
}

/**
 * פעולה createShiftRange: יצירת משמרת.
 * @param startTime — שעת התחלה.
 * @param endTime — שעת סיום.
 * @returns string | null — הפלט בהתאם לחתימה.
 */
function createShiftRange(
  startTime:
    string | null,
  endTime:
    string | null,
): string | null {
  const start =
    normalizeTime(
      startTime,
    );

  const end =
    normalizeTime(
      endTime,
    );

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !start || !end.
  if (
    !start ||
    !end
  ) {
    return null;
  }

  return `${start}-${end}`;
}

/**
 * פעולה getDayRows: שליפה או חישוב של יום / שורות.
 * @param weekdayNumber — הנתון weekdayNumber בהקשר הפעולה.
 * @param weekendOrHoliday — חג.
 * @returns DayRowDefinition[] — הפלט בהתאם לחתימה.
 */
function getDayRows(
  weekdayNumber:
    number,
  weekendOrHoliday:
    boolean,
): DayRowDefinition[] {
  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר weekendOrHoliday || weekdayNumber === 5 || weekdayNumber === 6.
  if (
    weekendOrHoliday ||
    weekdayNumber === 5 ||
    weekdayNumber === 6
  ) {
    return [
      {
        dispatcherHours:
          '06:00-14:00',
        morningDriverHours:
          '06:00-14:00',
      },
      {
        dispatcherHours:
          '14:00-22:00',
        morningDriverHours:
          '14:00-23:00',
      },
      {
        dispatcherHours:
          '22:00-06:00',
        morningDriverHours:
          '22:00-06:00',
      },
    ];
  }

  return [
    {
      dispatcherHours:
        '06:00-16:00',
      morningDriverHours:
        '06:00-16:00',
    },
    {
      dispatcherHours:
        '16:00-23:00',
      morningDriverHours:
        '15:00-23:00',
    },
    {
      dispatcherHours:
        '23:00-06:00',
      morningDriverHours:
        '23:00-06:00',
    },
  ];
}

/**
 * פעולה getTemplateSourceRow: שליפה או חישוב של תבנית / מקור / שורה.
 * @param weekdayNumber — הנתון weekdayNumber בהקשר הפעולה.
 * @param rowOffset — שורה / מיקום תחילת התוצאות.
 * @param weekendOrHoliday — חג.
 * @returns number — הפלט בהתאם לחתימה.
 */
function getTemplateSourceRow(
  weekdayNumber:
    number,
  rowOffset:
    number,
  weekendOrHoliday:
    boolean,
): number {
  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר weekdayNumber === 6 || weekendOrHoliday.
  if (
    weekdayNumber === 6 ||
    weekendOrHoliday
  ) {
    return 2 +
      rowOffset;
  }

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר weekdayNumber === 5.
  if (
    weekdayNumber === 5
  ) {
    return 20 +
      rowOffset;
  }

  return 5 +
    rowOffset;
}

/**
 * פעולה deepClone: הנתון deepClone בהקשר הפעולה.
 * @param value — ערך.
 * @returns T — הפלט בהתאם לחתימה.
 */
function deepClone<T>(
  value: T,
): T {
  return JSON.parse(
    JSON.stringify(
      value,
    ),
  ) as T;
}

/**
 * פעולה copyTemplateRowStyle: תבנית / שורה.
 * @param worksheet — הנתון worksheet בהקשר הפעולה.
 * @param sourceRowNumber — מקור / שורה.
 * @param targetRowNumber — יעד / שורה.
 * @returns void — הפלט בהתאם לחתימה.
 */
function copyTemplateRowStyle(
  worksheet:
    ExcelJS.Worksheet,
  sourceRowNumber:
    number,
  targetRowNumber:
    number,
): void {
  // sourceRow — מקור / שורה.
  const sourceRow =
    worksheet.getRow(
      sourceRowNumber,
    );

  // targetRow — יעד / שורה.
  const targetRow =
    worksheet.getRow(
      targetRowNumber,
    );

  targetRow.height =
    sourceRow.height;

  for (
    let column = 1;
    column <= 8;
    column += 1
  ) {
    targetRow
      .getCell(
        column,
      )
      .style =
        deepClone(
          sourceRow
            .getCell(
              column,
            )
            .style,
        );
  }
}

/**
 * פעולה copyFill: הנתון copyFill בהקשר הפעולה.
 * @param worksheet — הנתון worksheet בהקשר הפעולה.
 * @param sourceAddress — מקור.
 * @param targetAddress — יעד.
 * @returns void — הפלט בהתאם לחתימה.
 */
function copyFill(
  worksheet:
    ExcelJS.Worksheet,
  sourceAddress:
    string,
  targetAddress:
    string,
): void {
  worksheet
    .getCell(
      targetAddress,
    )
    .fill =
      deepClone(
        worksheet
          .getCell(
            sourceAddress,
          )
          .fill,
      );
}

/**
 * פעולה isNightShiftRange: בדיקת תנאי עבור משמרת.
 * @param range — הנתון range בהקשר הפעולה.
 * @returns boolean — הפלט בהתאם לחתימה.
 */
function isNightShiftRange(
  range:
    string,
): boolean {
  return (
    range ===
      '22:00-06:00' ||
    range ===
      '23:00-06:00'
  );
}

/**
 * פעולה applyShiftHourStyle: החלת משמרת.
 * @param worksheet — הנתון worksheet בהקשר הפעולה.
 * @param row — שורה.
 * @param isPremium — תעריף מוגדל.
 * @param isNight — הנתון isNight בהקשר הפעולה.
 * @returns void — הפלט בהתאם לחתימה.
 */
function applyShiftHourStyle(
  worksheet:
    ExcelJS.Worksheet,
  row:
    number,
  isPremium:
    boolean,
  isNight:
    boolean,
): void {
  // sourceRow — מקור / שורה.
  const sourceRow =
    isPremium
      ? 2
      : isNight
        ? 4
        : 5;

  copyFill(
    worksheet,
    `C${sourceRow}`,
    `C${row}`,
  );

  copyFill(
    worksheet,
    `E${sourceRow}`,
    `E${row}`,
  );
}

/**
 * פעולה clearTemplateValues: תבנית / ערכים.
 * @param worksheet — הנתון worksheet בהקשר הפעולה.
 * @returns void — הפלט בהתאם לחתימה.
 */
function clearTemplateValues(
  worksheet:
    ExcelJS.Worksheet,
): void {
  for (
    let row =
      FIRST_DATA_ROW;
    row <=
      LAST_TEMPLATE_ROW;
    row += 1
  ) {
    for (
      let column = 1;
      column <= 8;
      column += 1
    ) {
      worksheet
        .getCell(
          row,
          column,
        )
        .value =
          null;
    }
  }
}

/**
 * פעולה setExportDate: קביעת קבוצה ייחודית / ייצוא / תאריך.
 * @param worksheet — הנתון worksheet בהקשר הפעולה.
 * @param address — הנתון address בהקשר הפעולה.
 * @param year — שנה.
 * @param month — חודש.
 * @param day — יום.
 * @returns void — הפלט בהתאם לחתימה.
 */
function setExportDate(
  worksheet:
    ExcelJS.Worksheet,
  address:
    string,
  year:
    number,
  month:
    number,
  day:
    number,
): void {
  const cell =
    worksheet.getCell(
      address,
    );

  cell.value =
    new Date(
      Date.UTC(
        year,
        month - 1,
        day,
        12,
        0,
        0,
      ),
    );

  cell.numFmt =
    'dd/mm/yyyy';
}

/**
 * פעולה hideUnusedRows: שורות.
 * @param worksheet — הנתון worksheet בהקשר הפעולה.
 * @param daysInMonth — ימים / חודש.
 * @returns void — הפלט בהתאם לחתימה.
 */
function hideUnusedRows(
  worksheet:
    ExcelJS.Worksheet,
  daysInMonth:
    number,
): void {
  // firstUnusedRow — שורה.
  const firstUnusedRow =
    FIRST_DATA_ROW +
    daysInMonth *
      ROWS_PER_DAY;

  for (
    let row =
      FIRST_DATA_ROW;
    row <=
      LAST_TEMPLATE_ROW;
    row += 1
  ) {
    worksheet
      .getRow(
        row,
      )
      .hidden =
        row >=
        firstUnusedRow;
  }
}

/**
 * פעולה hasWeekendOrHolidayLayout: בדיקת קיום עבור חג / פריסת מסך.
 * @param shifts — משמרות.
 * @returns boolean — הפלט בהתאם לחתימה.
 */
function hasWeekendOrHolidayLayout(
  shifts:
    ExportDispatcherShift[],
): boolean {
  const ranges =
    new Set(
      shifts
        .map(
          (
            shift,
          ) =>
            createShiftRange(
              shift.startsAt,
              shift.endsAt,
            ),
        )
        .filter(
          (
            value,
          ): value is string =>
            Boolean(
              value,
            ),
        ),
    );

  return (
    ranges.has(
      '06:00-14:00',
    ) ||
    ranges.has(
      '14:00-22:00',
    ) ||
    ranges.has(
      '22:00-06:00',
    )
  );
}

/**
 * פעולה createFileName: יצירת קובץ / שם.
 * @param year — שנה.
 * @param month — חודש.
 * @returns string — הפלט בהתאם לחתימה.
 */
function createFileName(
  year: number,
  month: number,
): string {
  // monthName — חודש / שם.
  const monthName =
    hebrewMonths[
      month - 1
    ] ??
    padNumber(
      month,
    );

  return `לוח שיבוצים ${monthName} ${padNumber(
    year % 100,
  )}.xlsx`;
}

/**
 * פעולה base64ToBytes: הנתון base64ToBytes בהקשר הפעולה.
 * @param value — ערך.
 * @returns Uint8Array — הפלט בהתאם לחתימה.
 */
function base64ToBytes(
  value: string,
): Uint8Array {
  const binary =
    atob(
      value,
    );

  const bytes =
    new Uint8Array(
      binary.length,
    );

  for (
    let index = 0;
    index <
      binary.length;
    index += 1
  ) {
    bytes[index] =
      binary.charCodeAt(
        index,
      );
  }

  return bytes;
}

/**
 * פעולה bytesToBase64: הנתון bytesToBase64 בהקשר הפעולה.
 * @param bytes — הנתון bytes בהקשר הפעולה.
 * @returns string — הפלט בהתאם לחתימה.
 */
function bytesToBase64(
  bytes:
    Uint8Array,
): string {
  const chunkSize =
    0x8000;

  let binary =
    '';

  for (
    let offset = 0;
    offset <
      bytes.length;
    offset +=
      chunkSize
  ) {
    binary +=
      String.fromCharCode(
        ...bytes.subarray(
          offset,
          Math.min(
            offset +
              chunkSize,
            bytes.length,
          ),
        ),
      );
  }

  return btoa(
    binary,
  );
}

/**
 * פעולה אסינכרונית loadProfileMap: טעינת פרופיל / מפת התאמה.
 * @param adminClient — לקוח.
 * @param userIds — מזהה משתמש.
 * @returns Promise< Map< string, string > > — הפלט בהתאם לחתימה.
 */
async function loadProfileMap(
  adminClient:
    ReturnType<
      typeof createClient
    >,
  userIds:
    string[],
): Promise<
  Map<
    string,
    string
  >
> {
  // uniqueIds — הנתון uniqueIds בהקשר הפעולה.
  const uniqueIds =
    Array.from(
      new Set(
        userIds.filter(
          Boolean,
        ),
      ),
    );

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר uniqueIds.length === 0.
  if (
    uniqueIds.length ===
      0
  ) {
    return new Map();
  }

  // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
  const {
    data,
    error,
  } =
    await adminClient
      .from(
        'profiles',
      )
      .select(
        'id, display_name, schedule_name',
      )
      .in(
        'id',
        uniqueIds,
      );

  // עצירת הפעולה עם שגיאה כאשר error.
  if (
    error
  ) {
    throw error;
  }

  return new Map(
    (
      data as
        ProfileRow[] |
        null
    )?.map(
      (
        profile,
      ) => [
        profile.id,
        profile.schedule_name
          ?.trim() ||
        profile.display_name
          ?.trim() ||
        '',
      ],
    ) ??
    [],
  );
}

/**
 * חוזה הנתונים DynamicPublishedAssignment: דינמי / פורסם / הקצאה.
 */
interface DynamicPublishedAssignment {
  // id — מזהה.
  id: string;
  // shift_date — תאריך המשמרת.
  shift_date: string;
  // shift_code — משמרת.
  shift_code: string | null;
  // shift_name — משמרת / שם.
  shift_name: string | null;
  // start_time — שעת התחלה.
  start_time: string;
  // end_time — שעת סיום.
  end_time: string;
  // user_id — מזהה משתמש.
  user_id: string | null;
  // slot_id — מזהה.
  slot_id: string | null;
}

/** The export is intentionally restricted to the three original Teams columns. */
/**
 * פעולה אסינכרונית loadMonthData: טעינת חודש / נתונים.
 * @param adminClient — לקוח.
 * @param year — שנה.
 * @param month — חודש.
 * @returns Promise<{ dispatcherShifts: ExportDispatcherShift[]; driverDays: ExportDriverDay[]; morningAssignments: ExportMorningAssignment[]; — הפלט בהתאם לחתימה.
 */
async function loadMonthData(
  adminClient: ReturnType<typeof createClient>,
  year: number,
  month: number,
): Promise<{
  // dispatcherShifts — מוקדנים / משמרות.
  dispatcherShifts: ExportDispatcherShift[];
  // driverDays — כוננים / ימים.
  driverDays: ExportDriverDay[];
  // morningAssignments — הקצאות.
  morningAssignments: ExportMorningAssignment[];
}> {
  // Resolve the *published* dynamic job types for this month, rather than
  // legacy_role codes. The manual export panel also excludes legacy roles.
  // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
  const { data: publications, error: publicationsError } = await adminClient
    .from('dynamic_schedule_publications')
    .select('id, job_type_id, status, config_snapshot')
    .eq('year', year)
    .eq('month', month)
    .in('status', ['published', 'archived']);
  if (publicationsError) throw publicationsError;

  // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
  const { data: jobs, error: jobsError } = await adminClient
    .from('job_types')
    .select('id, name, code, legacy_role');
  if (jobsError) throw jobsError;
  // jobById — מזהה; מיפוי לחיפוש לפי מפתח.
  const jobById = new Map((jobs ?? []).map((job) => [job.id, job]));

  /**
   * טיפוס ArchiveRole: ארכיון.
   */
  type ArchiveRole = 'dispatcher' | 'on_call' | 'morning_driver';
  const candidates: Record<ArchiveRole, Array<{ id: string; job_type_id: string }>> = {
    dispatcher: [], on_call: [], morning_driver: [],
  };
  // עיבוד כל פריט מתוך publications ?? [] בנפרד.
  for (const publication of publications ?? []) {
    const job = jobById.get(publication.job_type_id);
    // Never silently export a legacy job type or an orphaned publication.
    if (!job || job.legacy_role) continue;
    const snapshot = publication.config_snapshot as {
      // jobType — סוג תפקיד (אופציונלי).
      jobType?: { shiftPattern?: { workMode?: unknown } };
    } | null;
    // mode — מצב פעולה.
    const mode = snapshot?.jobType?.shiftPattern?.workMode;
    // name — שם.
    const name = String(job.name ?? '');
    let role: ArchiveRole | null = null;
    if (mode === 'shifts' && /מוקד|dispatcher|dispatch/i.test(name)) role = 'dispatcher';
    else if (mode === 'on_call_daily' && /כונ|on.?call|duty/i.test(name)) role = 'on_call';
    else if (mode === 'on_call_hourly' && /בוקר|morning/i.test(name) && /כונ|on.?call|duty/i.test(name)) role = 'morning_driver';
    if (role) candidates[role].push({ id: publication.id, job_type_id: publication.job_type_id });
  }

  const roles: ArchiveRole[] = ['dispatcher', 'on_call', 'morning_driver'];
  const labels: Record<ArchiveRole, string> = {
    dispatcher: 'לוח המוקדנים', on_call: 'לוח הכוננים', morning_driver: 'לוח כונני הבוקר',
  };
  // selected — נבחר.
  const selected = roles.map((role) => {
    const matching = candidates[role];
    // עצירת הפעולה עם שגיאה כאשר matching.length !== 1.
    if (matching.length !== 1) {
      throw new Error(
        `לא ניתן לזהות פרסום יחיד עבור ${labels[role]} בחודש ${month}/${year}: נמצאו ${matching.length}. ` +
        'יש לבדוק את סוגי התפקידים והפרסומים; לא נבחר לוח באופן אוטומטי.'
      );
    }
    return matching[0];
  });

  // results — תוצאות.
  const results = await Promise.all(selected.map((publication) =>
    adminClient
      .from('dynamic_schedule_published_assignments')
      .select('id, shift_date, shift_code, shift_name, start_time, end_time, user_id, slot_id')
      .eq('publication_id', publication.id)
      .order('shift_date')
      .order('start_time')
  ));
  // עיבוד כל פריט מתוך results בנפרד.
  for (const result of results) if (result.error) throw result.error;
  const [dispatchers, drivers, mornings] = results.map((result) =>
    (result.data ?? []) as DynamicPublishedAssignment[]
  );
  // עצירת הפעולה עם שגיאה כאשר !dispatchers.length || !drivers.length || !mornings.length.
  if (!dispatchers.length || !drivers.length || !mornings.length) {
    throw new Error('אחד הלוחות המפורסמים ריק; הארכיון נעצר כדי לא לשלוח קובץ חסר.');
  }

  // profileMap — פרופיל / מפת התאמה.
  const profileMap = await loadProfileMap(adminClient, [
    ...dispatchers, ...drivers, ...mornings,
  ].map((row) => row.user_id ?? ''));
  /**
   * פעולה getName: שליפה או חישוב של שם.
   * @param id — מזהה.
   */
  const getName = (id: string | null) => id ? profileMap.get(id) ?? null : null;

  // Published assignments are the authoritative edited assignments, not rotation seeds.
  // dispatcherShifts — מוקדנים / משמרות.
  const dispatcherShifts: ExportDispatcherShift[] = dispatchers.map((row) => ({
    shiftDate: row.shift_date,
    startsAt: row.start_time,
    endsAt: row.end_time,
    isPremium: false,
    holidayName: null,
    assignedUserName: getName(row.user_id),
  }));

  // Preserve premium / holiday formatting using the original availability slot snapshot.
  // slotIds — הנתון slotIds בהקשר הפעולה.
  const slotIds = Array.from(new Set(dispatchers.map((row) => row.slot_id).filter((id): id is string => !!id)));
  // עצירת הפעולה עם שגיאה כאשר dispatchers.some((row) => !row.slot_id).
  if (dispatchers.some((row) => !row.slot_id)) {
    throw new Error('חלק ממשמרות המוקדנים חסרות מזהה משמרת מקורית; לא ניתן לאמת רכיבי 200%.');
  }
  if (slotIds.length) {
    // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
    const { data: slots, error: slotsError } = await adminClient
      .from('dynamic_availability_slots')
      .select('id, holiday_name, pay_segments_snapshot')
      .in('id', slotIds);
    if (slotsError) throw slotsError;
    // slotMap — מפת התאמה; מיפוי לחיפוש לפי מפתח.
    const slotMap = new Map((slots ?? []).map((slot) => [slot.id, slot]));
    dispatchers.forEach((row, index) => {
      const slot = row.slot_id ? slotMap.get(row.slot_id) : null;
      dispatcherShifts[index].holidayName = slot?.holiday_name ?? null;
      // עצירת הפעולה עם שגיאה כאשר !slot.
      if (!slot) {
        throw new Error(`לא נמצאו נתוני משמרת מקוריים עבור ${row.shift_date} (${row.slot_id ?? 'ללא מזהה משמרת'}).`);
      }
      const segments: unknown = slot.pay_segments_snapshot;
      // עצירת הפעולה עם שגיאה כאשר !Array.isArray(segments).
      if (!Array.isArray(segments)) {
        throw new Error(`מבנה רכיבי התעריף אינו תקין עבור ${row.shift_date} (${row.slot_id}).`);
      }
      dispatcherShifts[index].isPremium = segments.some((segment: unknown) => {
        if (!segment || typeof segment !== 'object') return false;
        const pay = segment as Record<string, unknown>;
        return pay.type === 'premium_hours'
          && typeof pay.multiplier === 'number'
          && pay.multiplier >= 2
          && typeof pay.hours === 'number'
          && pay.hours > 0;
      });
    });
  }

  // driverByDate — כוננים / תאריך; מיפוי לחיפוש לפי מפתח.
  const driverByDate = new Map<string, string | null>();
  // עיבוד כל פריט מתוך drivers בנפרד.
  for (const row of drivers) {
    // עצירת הפעולה עם שגיאה כאשר driverByDate.has(row.shift_date) && driverByDate.get(row.shift_date) !== row.user_id.
    if (driverByDate.has(row.shift_date) && driverByDate.get(row.shift_date) !== row.user_id) {
      throw new Error(`נמצאו שני כוננים שונים בתאריך ${row.shift_date}; התבנית תומכת בכונן אחד בלבד.`);
    }
    driverByDate.set(row.shift_date, row.user_id);
  }
  // driverDays — כוננים / ימים.
  const driverDays: ExportDriverDay[] = [...driverByDate].map(([dutyDate, userId]) => ({
    dutyDate,
    assignedUserName: getName(userId),
  }));

  const morningBySlot = new Map<string, number>();
  // morningAssignments — הקצאות.
  const morningAssignments: ExportMorningAssignment[] = mornings.map((row) => {
    // key — מפתח.
    const key = `${row.shift_date}|${createShiftRange(row.start_time, row.end_time)}`;
    // assignmentSlot — הקצאה.
    const assignmentSlot = (morningBySlot.get(key) ?? 0) + 1;
    morningBySlot.set(key, assignmentSlot);
    return {
      shiftDate: row.shift_date,
      startTime: row.start_time,
      endTime: row.end_time,
      assignmentSlot,
      assignedUserName: getName(row.user_id),
    };
  });

  // Fail closed if any actual shift cannot fit the unchanged Teams workbook template.
  // עיבוד כל פריט מתוך dispatcherShifts בנפרד.
  for (const row of dispatcherShifts) {
    // day — יום.
    const day = new Date(`${row.shiftDate}T12:00:00Z`).getUTCDay();
    const ranges = [
      ...getDayRows(day, false), ...getDayRows(day, true),
    ].map((item) => item.dispatcherHours);
    // עצירת הפעולה עם שגיאה כאשר !ranges.includes(createShiftRange(row.startsAt, row.endsAt) ?? '').
    if (!ranges.includes(createShiftRange(row.startsAt, row.endsAt) ?? '')) {
      throw new Error(`משמרת מוקדן ${row.shiftDate} ${row.startsAt}-${row.endsAt} אינה תואמת לתבנית Teams.`);
    }
  }
  // עיבוד כל פריט מתוך morningAssignments בנפרד.
  for (const row of morningAssignments) {
    // day — יום.
    const day = new Date(`${row.shiftDate}T12:00:00Z`).getUTCDay();
    const ranges = [
      ...getDayRows(day, false), ...getDayRows(day, true),
    ].map((item) => item.morningDriverHours);
    // עצירת הפעולה עם שגיאה כאשר !ranges.includes(createShiftRange(row.startTime, row.endTime) ?? '').
    if (!ranges.includes(createShiftRange(row.startTime, row.endTime) ?? '')) {
      throw new Error(`משמרת כונן בוקר ${row.shiftDate} ${row.startTime}-${row.endTime} אינה תואמת לתבנית Teams.`);
    }
  }

  return { dispatcherShifts, driverDays, morningAssignments };
}

/**
 * פעולה אסינכרונית createWorkbook: יצירת הנתון createWorkbook בהקשר הפעולה.
 * @param year — שנה.
 * @param month — חודש.
 * @param data — נתונים.
 * @returns Promise<{ fileName: string; fileBase64: string; }> — הפלט בהתאם לחתימה.
 */
async function createWorkbook(
  year:
    number,
  month:
    number,
  data:
    Awaited<
      ReturnType<
        typeof loadMonthData
      >
    >,
): Promise<{
  // fileName — קובץ / שם.
  fileName: string;
  // fileBase64 — קובץ.
  fileBase64: string;
}> {
  const workbook =
    new ExcelJS
      .Workbook();

  // templateBytes — תבנית.
  const templateBytes =
    base64ToBytes(
      scheduleExportTemplateBase64,
    );

  await workbook.xlsx.load(
    templateBytes.buffer,
  );

  const worksheet =
    workbook.getWorksheet(
      TEMPLATE_SHEET_NAME,
    );

  // עצירת הפעולה עם שגיאה כאשר !worksheet.
  if (
    !worksheet
  ) {
    throw new Error(
      'גיליון תבנית הייצוא לא נמצא.',
    );
  }

  // dispatcherMap — מוקדנים / מפת התאמה; מיפוי לחיפוש לפי מפתח.
  const dispatcherMap =
    new Map<
      string,
      ExportDispatcherShift
    >();

  // shiftsByDate — משמרות / תאריך; מיפוי לחיפוש לפי מפתח.
  const shiftsByDate =
    new Map<
      string,
      ExportDispatcherShift[]
    >();

  // holidayNotes — חג / הערות; מיפוי לחיפוש לפי מפתח.
  const holidayNotes =
    new Map<
      string,
      Set<string>
    >();

  // עיבוד כל פריט מתוך data .dispatcherShifts בנפרד.
  for (
    const shift
    of data
      .dispatcherShifts
  ) {
    const range =
      createShiftRange(
        shift.startsAt,
        shift.endsAt,
      );

    if (
      range
    ) {
      dispatcherMap.set(
        `${shift.shiftDate}|${range}`,
        shift,
      );
    }

    // dateShifts — תאריך / משמרות.
    const dateShifts =
      shiftsByDate.get(
        shift.shiftDate,
      ) ??
      [];

    dateShifts.push(
      shift,
    );

    shiftsByDate.set(
      shift.shiftDate,
      dateShifts,
    );

    // holiday — חג.
    const holiday =
      shift.holidayName
        ?.trim();

    if (
      holiday
    ) {
      const names =
        holidayNotes.get(
          shift.shiftDate,
        ) ??
        new Set<
          string
        >();

      names.add(
        holiday,
      );

      holidayNotes.set(
        shift.shiftDate,
        names,
      );
    }
  }

  // driverMap — כוננים / מפת התאמה; מיפוי לחיפוש לפי מפתח.
  const driverMap =
    new Map(
      data.driverDays
        .map(
          (
            day,
          ) => [
            day.dutyDate,
            day,
          ],
        ),
    );

  const morningGrouped =
    new Map<
      string,
      ExportMorningAssignment[]
    >();

  // עיבוד כל פריט מתוך data .morningAssignments בנפרד.
  for (
    const assignment
    of data
      .morningAssignments
  ) {
    if (
      !assignment
        .assignedUserName
    ) {
      continue;
    }

    const range =
      createShiftRange(
        assignment.startTime,
        assignment.endTime,
      );

    if (
      !range
    ) {
      continue;
    }

    // key — מפתח.
    const key =
      `${assignment.shiftDate}|${range}`;

    // values — ערכים.
    const values =
      morningGrouped.get(
        key,
      ) ??
      [];

    values.push(
      assignment,
    );

    morningGrouped.set(
      key,
      values,
    );
  }

  // morningMap — מפת התאמה; מיפוי לחיפוש לפי מפתח.
  const morningMap =
    new Map<
      string,
      string
    >();

  // עיבוד כל פריט מתוך morningGrouped בנפרד.
  for (
    const [
      key,
      values,
    ]
    of morningGrouped
  ) {
    morningMap.set(
      key,
      Array.from(
        new Set(
          values
            .sort(
              (
                first,
                second,
              ) =>
                first.assignmentSlot -
                second.assignmentSlot,
            )
            .map(
              (
                value,
              ) =>
                value
                  .assignedUserName,
            )
            .filter(
              (
                value,
              ): value is string =>
                Boolean(
                  value,
                ),
            ),
        ),
      ).join(
        '/',
      ),
    );
  }

  clearTemplateValues(
    worksheet,
  );

  // notesHeader — הערות.
  const notesHeader =
    worksheet.getCell(
      'H1',
    );

  notesHeader.style =
    deepClone(
      worksheet.getCell(
        'G1',
      ).style,
    );

  notesHeader.value =
    'הערות';

  worksheet
    .getColumn(
      8,
    )
    .width =
      32;

  // daysInMonth — ימים / חודש.
  const daysInMonth =
    getDaysInMonth(
      year,
      month,
    );

  for (
    let day = 1;
    day <=
      daysInMonth;
    day += 1
  ) {
    // date — תאריך.
    const date =
      new Date(
        Date.UTC(
          year,
          month - 1,
          day,
          12,
        ),
      );

    const weekdayNumber =
      date.getUTCDay();

    // dateKey — תאריך / מפתח.
    const dateKey =
      createDateKey(
        year,
        month,
        day,
      );

    // dayShifts — יום / משמרות.
    const dayShifts =
      shiftsByDate.get(
        dateKey,
      ) ??
      [];

    // weekendOrHoliday — חג.
    const weekendOrHoliday =
      hasWeekendOrHolidayLayout(
        dayShifts,
      );

    // firstRow — שורה.
    const firstRow =
      FIRST_DATA_ROW +
      (
        day - 1
      ) *
        ROWS_PER_DAY;

    // rows — שורות.
    const rows =
      getDayRows(
        weekdayNumber,
        weekendOrHoliday,
      );

    rows.forEach(
      (
        definition,
        rowOffset,
      ) => {
        // targetRow — יעד / שורה.
        const targetRow =
          firstRow +
          rowOffset;

        copyTemplateRowStyle(
          worksheet,
          getTemplateSourceRow(
            weekdayNumber,
            rowOffset,
            weekendOrHoliday,
          ),
          targetRow,
        );

        // shift — משמרת.
        const shift =
          dispatcherMap.get(
            `${dateKey}|${definition.dispatcherHours}`,
          );

        worksheet
          .getCell(
            `C${targetRow}`,
          )
          .value =
            definition
              .dispatcherHours;

        worksheet
          .getCell(
            `D${targetRow}`,
          )
          .value =
            shift
              ?.assignedUserName ??
            null;

        worksheet
          .getCell(
            `E${targetRow}`,
          )
          .value =
            definition
              .morningDriverHours;

        applyShiftHourStyle(
          worksheet,
          targetRow,
          shift
            ?.isPremium ===
            true,
          isNightShiftRange(
            definition
              .dispatcherHours,
          ),
        );

        worksheet
          .getCell(
            `F${targetRow}`,
          )
          .value =
            morningMap.get(
              `${dateKey}|${definition.morningDriverHours}`,
            ) ??
            null;
      },
    );

    setExportDate(
      worksheet,
      `A${firstRow}`,
      year,
      month,
      day,
    );

    worksheet
      .getCell(
        `B${firstRow}`,
      )
      .value =
        hebrewWeekdays[
          weekdayNumber
        ] ??
        '';

    worksheet
      .getCell(
        `G${firstRow}`,
      )
      .value =
        driverMap.get(
          dateKey,
        )
          ?.assignedUserName ??
        null;

    // lastNoteRow — הערה / שורה.
    const lastNoteRow =
      firstRow +
      ROWS_PER_DAY -
      1;

    // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
    try {
      worksheet.unMergeCells(
        `H${firstRow}:H${lastNoteRow}`,
      );
    } catch {
      // The source template may not contain this merge yet.
    }

    worksheet.mergeCells(
      `H${firstRow}:H${lastNoteRow}`,
    );

    // notesCell — הערות.
    const notesCell =
      worksheet.getCell(
        `H${firstRow}`,
      );

    notesCell.style =
      deepClone(
        worksheet.getCell(
          `G${firstRow}`,
        ).style,
      );

    notesCell.alignment = {
      ...notesCell
        .alignment,
      wrapText:
        true,
      vertical:
        'middle',
    };

    notesCell.value =
      holidayNotes.has(
        dateKey,
      )
        ? Array.from(
            holidayNotes.get(
              dateKey,
            )!,
          ).join(
            ' / ',
          )
        : null;
  }

  hideUnusedRows(
    worksheet,
    daysInMonth,
  );

  // output — פלט.
  const output =
    await workbook.xlsx
      .writeBuffer();

  const bytes =
    new Uint8Array(
      output,
    );

  return {
    fileName:
      createFileName(
        year,
        month,
      ),

    fileBase64:
      bytesToBase64(
        bytes,
      ),
  };
}

/**
 * פעולה אסינכרונית sendArchiveEmail: שליחת ארכיון / כתובת דוא״ל.
 * @param resendApiKey — מפתח.
 * @param fromEmail — כתובת דוא״ל.
 * @param recipientEmail — כתובת דוא״ל.
 * @param fileName — קובץ / שם.
 * @param fileBase64 — קובץ.
 * @param year — שנה.
 * @param month — חודש.
 * @returns Promise<string | null> — הפלט בהתאם לחתימה.
 */
async function sendArchiveEmail(
  resendApiKey:
    string,
  fromEmail:
    string,
  recipientEmail:
    string,
  fileName:
    string,
  fileBase64:
    string,
  year:
    number,
  month:
    number,
): Promise<string | null> {
  // response — תוצאת הפעולה.
  const response =
    await fetch(
      'https://api.resend.com/emails',
      {
        method:
          'POST',

        headers: {
          Authorization:
            `Bearer ${resendApiKey}`,

          'Content-Type':
            'application/json',
        },

        body:
          JSON.stringify({
            from:
              fromEmail,

            to: [
              recipientEmail,
            ],

            subject:
              archiveSubject,

            text: [
              'קובץ שיבוצים חודשי שנשלח אוטומטית מ-צוות GVK.',

              `תקופה: ${padNumber(
                month,
              )}/${year}`,

              '',

              'הודעה זו מיועדת להפעלת תהליך הארכיון הקיים ב-Power Automate.',
            ].join(
              '\n',
            ),

            attachments: [
              {
                filename:
                  fileName,

                content:
                  fileBase64,

                content_type:
                  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
              },
            ],
          }),
      },
    );

  // responseText — תוצאת הפעולה.
  const responseText =
    await response
      .text();

  // עצירת הפעולה עם שגיאה כאשר !response.ok.
  if (
    !response.ok
  ) {
    throw new Error(
      `Resend failed (${response.status}): ${responseText}`,
    );
  }

  // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
  try {
    // responseBody — תוצאת הפעולה / תוכן.
    const responseBody =
      JSON.parse(
        responseText,
      ) as {
        // id — מזהה (אופציונלי).
        id?: unknown;
      };

    return typeof responseBody.id ===
        'string'
      ? responseBody.id
      : null;
  } catch {
    return null;
  }
}


/**
 * פעולה אסינכרונית archiveDynamicPublications: ארכיון / דינמי.
 * @param adminClient — לקוח.
 * @param year — שנה.
 * @param month — חודש.
 */
const archiveDynamicPublications = async (
  adminClient: ReturnType<typeof createClient>,
  year: number,
  month: number,
) => {
  const archivedAt = new Date().toISOString();
  // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
  const { data, error } = await adminClient
    .from('dynamic_schedule_publications')
    .update({ status: 'archived', updated_at: archivedAt })
    .eq('year', year).eq('month', month).eq('status', 'published')
    .select('id, job_type_id');
  if (error) throw new Error(`Dynamic archive finalization failed: ${error.message}`);
  return { archivedAt, archivedPublications: data?.length ?? 0 };
};

Deno.serve(
  async (
    request:
      Request,
  ): Promise<Response> => {
    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר request.method !== 'POST'.
    if (
      request.method !==
        'POST'
    ) {
      return jsonResponse(
        {
          error:
            'Method not allowed.',
        },
        405,
      );
    }

    // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
    try {
      const cronSecret =
        requiredEnv(
          'MONTHLY_ARCHIVE_CRON_SECRET',
        );

      const suppliedSecret =
        request.headers
          .get(
            'x-cron-secret',
          )
          ?.trim();

      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר suppliedSecret !== cronSecret.
      if (
        suppliedSecret !==
          cronSecret
      ) {
        return jsonResponse(
          {
            error:
              'Unauthorized.',
          },
          401,
        );
      }

      // israelDate — תאריך.
      const israelDate =
        getIsraelMonth();

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר israelDate.day !== 1.
    if (
      israelDate.day !==
        1
    ) {
      return jsonResponse({
        skipped:
          true,
        reason:
          'not_first_day_of_month',
        israelDate,
      });
    }

  // previousMonthDate — חודש / תאריך.
  const previousMonthDate =
    new Date(
      Date.UTC(
        israelDate.year,
        israelDate.month - 2,
        1,
      ),
    );

  // year — שנה.
  const year =
    previousMonthDate
      .getUTCFullYear();

  // month — חודש.
  const month =
    previousMonthDate
      .getUTCMonth() +
      1;

      // supabaseUrl — כתובת יעד.
      const supabaseUrl =
        requiredEnv(
          'SUPABASE_URL',
        );

      // serviceRoleKey — שירות / מפתח.
      const serviceRoleKey =
        requiredEnv(
          'SUPABASE_SERVICE_ROLE_KEY',
        );

      // resendApiKey — מפתח.
      const resendApiKey =
        requiredEnv(
          'RESEND_API_KEY',
        );

      // fromEmail — כתובת דוא״ל.
      const fromEmail =
        requiredEnv(
          'RESEND_FROM_EMAIL',
        );

      // recipientEmail — כתובת דוא״ל.
      const recipientEmail =
        requiredEnv(
          'SCHEDULE_ARCHIVE_RECIPIENT_EMAIL',
        );

      // adminClient — לקוח.
      const adminClient =
        createClient(
          supabaseUrl,
          serviceRoleKey,
          {
            auth: {
              persistSession:
                false,
              autoRefreshToken:
                false,
            },
          },
        );

      // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
      const {
        data:
          existingRun,

        error:
          existingError,
      } =
        await adminClient
          .from(
            'monthly_schedule_archive_runs',
          )
          .select(
            'id, status, attempt_count, email_id, sent_at',
          )
          .eq(
            'year',
            year,
          )
          .eq(
            'month',
            month,
          )
          .maybeSingle();

      // עצירת הפעולה עם שגיאה כאשר existingError.
      if (
        existingError
      ) {
        throw existingError;
      }

      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר existingRun ?.status === 'sent'.
      if (
        existingRun
          ?.status ===
          'sent'
      ) {
        // dynamicArchive — דינמי / ארכיון.
        const dynamicArchive = await archiveDynamicPublications(adminClient, year, month);
        return jsonResponse({
          skipped: true, reason: 'already_sent', year, month,
          emailId: existingRun.email_id, sentAt: existingRun.sent_at, dynamicArchive,
        });
      }

      // runId — מזהה.
      let runId:
        string;

      if (
        existingRun
      ) {
        // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
        const {
          data:
            updatedRun,
          error:
            updateError,
        } =
          await adminClient
            .from(
              'monthly_schedule_archive_runs',
            )
            .update({
              status:
                'processing',

              attempt_count:
                (
                  existingRun
                    .attempt_count ??
                  0
                ) +
                1,

              last_error:
                null,

              updated_at:
                new Date()
                  .toISOString(),
            })
            .eq(
              'id',
              existingRun.id,
            )
            .select(
              'id',
            )
            .single();

        // עצירת הפעולה עם שגיאה כאשר updateError || !updatedRun.
        if (
          updateError ||
          !updatedRun
        ) {
          throw updateError ??
            new Error(
              'Could not update archive run.',
            );
        }

        runId =
          updatedRun.id;
      } else {
        // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
        const {
          data:
            insertedRun,
          error:
            insertError,
        } =
          await adminClient
            .from(
              'monthly_schedule_archive_runs',
            )
            .insert({
              year,
              month,
              status:
                'processing',
              attempt_count:
                1,
            })
            .select(
              'id',
            )
            .single();

        // עצירת הפעולה עם שגיאה כאשר insertError || !insertedRun.
        if (
          insertError ||
          !insertedRun
        ) {
          /*
           * אם שתי ריצות הגיעו יחד, ה-unique
           * על year/month ימנע כפילות.
           */
          // טיפול במקרה מיוחד ויציאה מוקדמת כאשר insertError ?.code === '23505'.
          if (
            insertError
              ?.code ===
              '23505'
          ) {
            return jsonResponse({
              skipped:
                true,
              reason:
                'duplicate_run_claim',
              year,
              month,
            });
          }

          throw insertError ??
            new Error(
              'Could not create archive run.',
            );
        }

        runId =
          insertedRun.id;
      }

      // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
      try {
        // monthData — חודש / נתונים.
        const monthData =
          await loadMonthData(
            adminClient,
            year,
            month,
          );

        // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
        const {
          fileName,
          fileBase64,
        } =
          await createWorkbook(
            year,
            month,
            monthData,
          );

        // emailId — כתובת דוא״ל / מזהה.
        const emailId =
          await sendArchiveEmail(
            resendApiKey,
            fromEmail,
            recipientEmail,
            fileName,
            fileBase64,
            year,
            month,
          );

        const sentAt =
          new Date()
            .toISOString();

        // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
        const {
          error:
            runUpdateError,
        } =
          await adminClient
            .from(
              'monthly_schedule_archive_runs',
            )
            .update({
              status:
                'sent',
              file_name:
                fileName,
              email_id:
                emailId,
              sent_at:
                sentAt,
              last_error:
                null,
              updated_at:
                sentAt,
            })
            .eq(
              'id',
              runId,
            );

        if (
          runUpdateError
        ) {
          console.error(
            'ARCHIVE RUN FINALIZE ERROR:',
            runUpdateError,
          );
        }

        // dynamicArchive — דינמי / ארכיון.
        const dynamicArchive = await archiveDynamicPublications(adminClient, year, month);

        // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
        const {
          error:
            auditError,
        } =
          await adminClient
            .from(
              'audit_logs',
            )
            .insert({
              user_id:
                null,

              action:
                'schedule.archive.auto_sent',

              entity_type:
                'schedule_export',

              entity_id:
                null,

              summary:
                `קובץ השיבוצים ${fileName} נשלח אוטומטית לארכיון Teams`,

              actor_user_id:
                null,

              actor_email:
                null,

              actor_display_name:
                'מערכת',

              metadata: {
                source:
                  'process-monthly-schedule-archive',
                year,
                month,
                fileName,
                emailId,
                subject:
                  archiveSubject,
                recipientEmail,
                dynamicArchive,
              },
            });

        if (
          auditError
        ) {
          console.error(
            'MONTHLY ARCHIVE AUDIT ERROR:',
            auditError,
          );
        }

        return jsonResponse({
          success:
            true,
          year,
          month,
          fileName,
          emailId,
          auditLogged:
            !auditError,
          dynamicArchive,
        });
      } catch (
        processError
      ) {
        // message — הודעה.
        const message =
          processError instanceof
            Error
            ? processError
                .message
            : String(
                processError,
              );

        await adminClient
          .from(
            'monthly_schedule_archive_runs',
          )
          .update({
            status:
              'failed',
            last_error:
              message,
            updated_at:
              new Date()
                .toISOString(),
          })
          .eq(
            'id',
            runId,
          );

        throw processError;
      }
    } catch (
      error
    ) {
      console.error(
        'process-monthly-schedule-archive failed:',
        error,
      );

      return jsonResponse(
        {
          error:
            error instanceof
              Error
              ? error.message
              : 'Unexpected monthly archive error.',
        },
        500,
      );
    }
  },
);
