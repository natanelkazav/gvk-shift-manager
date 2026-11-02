/**
 * קובץ: src/services/scheduleExportService.ts
 * מטרה: הכנת נתוני לוח השיבוצים וייצואם לקובץ לפי הפריסה שנבחרה.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: ScheduleExportResult, ScheduleExportFile, DayRowDefinition, padNumber, createDateKey, getDaysInMonth, normalizeTime, createShiftRange, getDayRows, getTemplateSourceRow ועוד.
 * - ריכוז פעולות העיבוד והחישוב בהתאם לפונקציות להלן.
 */
import type ExcelJS from 'exceljs';

import {
  driverScheduleService,
} from './driverScheduleService';

import {
  morningDriverScheduleService,
} from './morningDriverScheduleService';

import {
  scheduleService,
} from './scheduleService';

import type {
  DispatcherScheduleMonthShift,
} from '../types/unifiedSchedule';

import type {
  DriverScheduleDay,
} from '../types/driverSchedule';

import type {
  MorningDriverScheduleAssignment,
} from '../types/morningDriverSchedule';

// TEMPLATE_URL — תבנית / כתובת יעד.
const TEMPLATE_URL =
  '/templates/schedule-export-template.xlsx';

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
  MAX_DAYS * ROWS_PER_DAY -
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
 * חוזה הנתונים ScheduleExportResult: שיבוץ / ייצוא / תוצאה.
 */
interface ScheduleExportResult {
  // fileName — קובץ / שם.
  fileName: string;
  // year — שנה.
  year: number;
  // month — חודש.
  month: number;
  // dispatcherShifts — מוקדנים / משמרות.
  dispatcherShifts: number;
  // driverDuties — כוננים.
  driverDuties: number;
  // morningDriverAssignments — כונני בוקר.
  morningDriverAssignments: number;
}

/**
 * חוזה הנתונים ScheduleExportFile: שיבוץ / ייצוא / קובץ.
 */
interface ScheduleExportFile {
  blob: Blob;
  // result — תוצאה.
  result: ScheduleExportResult;
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
 * פעולה padNumber: הנתון padNumber בהקשר הפעולה.
 * @param value — ערך.
 * @returns string — הפלט בהתאם לחתימה.
 */
function padNumber(
  value: number,
): string {
  return String(value)
    .padStart(2, '0');
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
    padNumber(month),
    padNumber(day),
  ].join('-');
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
 * פעולה normalizeTime: נרמול זמן.
 * @param value — ערך.
 * @returns string | null — הפלט בהתאם לחתימה.
 */
function normalizeTime(
  value: string | null,
): string | null {
  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !value.
  if (!value) {
    return null;
  }

  // trimmedValue — ערך.
  const trimmedValue =
    value.trim();

  // plainTimeMatch — זמן.
  const plainTimeMatch =
    trimmedValue.match(
      /^(\d{1,2}):(\d{2})/,
    );

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר plainTimeMatch.
  if (plainTimeMatch) {
    return `${padNumber(
      Number(
        plainTimeMatch[1],
      ),
    )}:${plainTimeMatch[2]}`;
  }

  // date — תאריך.
  const date =
    new Date(
      trimmedValue,
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
    .format(date)
    .replace(/\s/g, '');
}

/**
 * פעולה createShiftRange: יצירת משמרת.
 * @param startTime — שעת התחלה.
 * @param endTime — שעת סיום.
 * @returns string | null — הפלט בהתאם לחתימה.
 */
function createShiftRange(
  startTime: string | null,
  endTime: string | null,
): string | null {
  // normalizedStart — הנתון normalizedStart בהקשר הפעולה.
  const normalizedStart =
    normalizeTime(
      startTime,
    );

  // normalizedEnd — הנתון normalizedEnd בהקשר הפעולה.
  const normalizedEnd =
    normalizeTime(
      endTime,
    );

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !normalizedStart || !normalizedEnd.
  if (
    !normalizedStart ||
    !normalizedEnd
  ) {
    return null;
  }

  return `${normalizedStart}-${normalizedEnd}`;
}

/**
 * פעולה getDayRows: שליפה או חישוב של יום / שורות.
 * @param weekdayNumber — הנתון weekdayNumber בהקשר הפעולה.
 * @param useWeekendOrHolidayLayout — חג / פריסת מסך.
 * @returns DayRowDefinition[] — הפלט בהתאם לחתימה.
 */
function getDayRows(
  weekdayNumber: number,
  useWeekendOrHolidayLayout: boolean,
): DayRowDefinition[] {
  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר useWeekendOrHolidayLayout || weekdayNumber === 5 || weekdayNumber === 6.
  if (
    useWeekendOrHolidayLayout ||
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
 * @param useWeekendOrHolidayLayout — חג / פריסת מסך.
 * @returns number — הפלט בהתאם לחתימה.
 */
function getTemplateSourceRow(
  weekdayNumber: number,
  rowOffset: number,
  useWeekendOrHolidayLayout: boolean,
): number {
  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר weekdayNumber === 6 || useWeekendOrHolidayLayout.
  if (
    weekdayNumber === 6 ||
    useWeekendOrHolidayLayout
  ) {
    return 2 + rowOffset;
  }

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר weekdayNumber === 5.
  if (weekdayNumber === 5) {
    return 20 + rowOffset;
  }

  return 5 + rowOffset;
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
    JSON.stringify(value),
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
  worksheet: ExcelJS.Worksheet,
  sourceRowNumber: number,
  targetRowNumber: number,
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
    let columnNumber = 1;
    columnNumber <= 8;
    columnNumber += 1
  ) {
    // sourceCell — מקור.
    const sourceCell =
      sourceRow.getCell(
        columnNumber,
      );

    // targetCell — יעד.
    const targetCell =
      targetRow.getCell(
        columnNumber,
      );

    targetCell.style =
      deepClone(
        sourceCell.style,
      );
  }
}

/**
 * פעולה createDispatcherMap: בניית מפת מוקדנים ומוני ההקצאות המשמשים לבדיקות ולניקוד.
 * @param shifts — משמרות.
 * @returns Map< string, DispatcherScheduleMonthShift > — הפלט בהתאם לחתימה.
 */
function createDispatcherMap(
  shifts:
    DispatcherScheduleMonthShift[],
): Map<
  string,
  DispatcherScheduleMonthShift
> {
  // map — מפת התאמה; מיפוי לחיפוש לפי מפתח.
  const map =
    new Map<
      string,
      DispatcherScheduleMonthShift
    >();

  shifts.forEach(
    (
      shift,
    ) => {
      const range =
        createShiftRange(
          shift.startsAt,
          shift.endsAt,
        );

      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !range.
      if (!range) {
        return;
      }

      map.set(
        `${shift.shiftDate}|${range}`,
        shift,
      );
    },
  );

  return map;
}

/**
 * פעולה createDispatcherShiftsByDate: יצירת מוקדנים / משמרות / תאריך.
 * @param shifts — משמרות.
 * @returns Map< string, DispatcherScheduleMonthShift[] > — הפלט בהתאם לחתימה.
 */
function createDispatcherShiftsByDate(
  shifts:
    DispatcherScheduleMonthShift[],
): Map<
  string,
  DispatcherScheduleMonthShift[]
> {
  // map — מפת התאמה; מיפוי לחיפוש לפי מפתח.
  const map =
    new Map<
      string,
      DispatcherScheduleMonthShift[]
    >();

  shifts.forEach(
    (
      shift,
    ) => {
      // current — הנתון current בהקשר הפעולה.
      const current =
        map.get(
          shift.shiftDate,
        ) ?? [];

      current.push(
        shift,
      );

      map.set(
        shift.shiftDate,
        current,
      );
    },
  );

  return map;
}

/**
 * פעולה createHolidayNoteMap: יצירת חג / הערה / מפת התאמה.
 * @param shifts — משמרות.
 * @returns Map<string, string> — הפלט בהתאם לחתימה.
 */
function createHolidayNoteMap(
  shifts:
    DispatcherScheduleMonthShift[],
): Map<string, string> {
  // notesByDate — הערות / תאריך; מיפוי לחיפוש לפי מפתח.
  const notesByDate =
    new Map<
      string,
      Set<string>
    >();

  shifts.forEach(
    (
      shift,
    ) => {
      // holidayName — חג / שם.
      const holidayName =
        shift.holidayName
          ?.trim();

      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !holidayName.
      if (!holidayName) {
        return;
      }

      // existingNotes — הערות.
      const existingNotes =
        notesByDate.get(
          shift.shiftDate,
        ) ??
        new Set<string>();

      existingNotes.add(
        holidayName,
      );

      notesByDate.set(
        shift.shiftDate,
        existingNotes,
      );
    },
  );

  return new Map(
    Array.from(
      notesByDate.entries(),
    ).map(
      (
        [
          date,
          notes,
        ],
      ) => [
        date,
        Array.from(
          notes,
        ).join(' / '),
      ],
    ),
  );
}

/**
 * פעולה createDriverMap: יצירת כוננים / מפת התאמה.
 * @param days — ימים.
 * @returns Map< string, DriverScheduleDay > — הפלט בהתאם לחתימה.
 */
function createDriverMap(
  days:
    DriverScheduleDay[],
): Map<
  string,
  DriverScheduleDay
> {
  // map — מפת התאמה; מיפוי לחיפוש לפי מפתח.
  const map =
    new Map<
      string,
      DriverScheduleDay
    >();

  days.forEach(
    (
      day,
    ) => {
      map.set(
        day.dutyDate,
        day,
      );
    },
  );

  return map;
}

/**
 * פעולה createMorningDriverMap: יצירת כונני בוקר.
 * @param assignments — הקצאות.
 * @returns Map<string, { hours: string; names: string }> — הפלט בהתאם לחתימה.
 */
function createMorningDriverMap(
  assignments: MorningDriverScheduleAssignment[],
): Map<string, { hours: string; names: string }> {
  const grouped = new Map<string, MorningDriverScheduleAssignment[]>();

  assignments.forEach((assignment) => {
    if (!assignment.assignedUserName) return;
    // key — מפתח.
    const key = `${assignment.shiftDate}|${assignment.shiftType}`;
    // current — הנתון current בהקשר הפעולה.
    const current = grouped.get(key) ?? [];
    current.push(assignment);
    grouped.set(key, current);
  });

  // result — תוצאה; מיפוי לחיפוש לפי מפתח.
  const result = new Map<string, { hours: string; names: string }>();
  grouped.forEach((values, key) => {
    const first = values[0];
    // hours — שעות.
    const hours = createShiftRange(first.startTime, first.endTime);
    if (!hours) return;
    const names = Array.from(
      new Set(
        values
          .sort((a, b) => a.assignmentSlot - b.assignmentSlot)
          .map((value) => value.assignedUserName)
          .filter((value): value is string => Boolean(value)),
      ),
    ).join('/');
    result.set(key, { hours, names });
  });
  return result;
}

/**
 * פעולה isNightShiftRange: בדיקת תנאי עבור משמרת.
 * @param range — הנתון range בהקשר הפעולה.
 * @returns boolean — הפלט בהתאם לחתימה.
 */
function isNightShiftRange(
  range: string,
): boolean {
  return (
    range ===
      '22:00-06:00' ||
    range ===
      '23:00-06:00'
  );
}

/**
 * פעולה copyFill: הנתון copyFill בהקשר הפעולה.
 * @param worksheet — הנתון worksheet בהקשר הפעולה.
 * @param sourceAddress — מקור.
 * @param targetAddress — יעד.
 * @returns void — הפלט בהתאם לחתימה.
 */
function copyFill(
  worksheet: ExcelJS.Worksheet,
  sourceAddress: string,
  targetAddress: string,
): void {
  // sourceCell — מקור.
  const sourceCell =
    worksheet.getCell(
      sourceAddress,
    );

  // targetCell — יעד.
  const targetCell =
    worksheet.getCell(
      targetAddress,
    );

  targetCell.fill =
    deepClone(
      sourceCell.fill,
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
  worksheet: ExcelJS.Worksheet,
  row: number,
  isPremium: boolean,
  isNight: boolean,
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
  worksheet: ExcelJS.Worksheet,
): void {
  for (
    let row = FIRST_DATA_ROW;
    row <= LAST_TEMPLATE_ROW;
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
        .value = null;
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
  worksheet: ExcelJS.Worksheet,
  address: string,
  year: number,
  month: number,
  day: number,
): void {
  const cell =
    worksheet.getCell(
      address,
    );

  cell.value =
    new Date(
      year,
      month - 1,
      day,
      12,
      0,
      0,
      0,
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
  worksheet: ExcelJS.Worksheet,
  daysInMonth: number,
): void {
  // firstUnusedRow — שורה.
  const firstUnusedRow =
    FIRST_DATA_ROW +
    daysInMonth *
      ROWS_PER_DAY;

  for (
    let row = FIRST_DATA_ROW;
    row <= LAST_TEMPLATE_ROW;
    row += 1
  ) {
    worksheet
      .getRow(row)
      .hidden =
        row >=
        firstUnusedRow;
  }
}

/**
 * פעולה hasWeekendOrHolidayDispatcherLayout: בדיקת קיום עבור חג / מוקדנים / פריסת מסך.
 * @param shifts — משמרות.
 * @returns boolean — הפלט בהתאם לחתימה.
 */
function hasWeekendOrHolidayDispatcherLayout(
  shifts:
    DispatcherScheduleMonthShift[],
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
            Boolean(value),
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
 * פעולה validatePublishedSchedules: בדיקת תקינות של פורסם.
 * @param dispatcherStatus — מוקדנים / סטטוס.
 * @param driverStatus — כוננים / סטטוס.
 * @param morningDriverStatus — כונני בוקר.
 * @returns void — הפלט בהתאם לחתימה.
 */
function validatePublishedSchedules(
  dispatcherStatus:
    string | null,
  driverStatus:
    string | null,
  morningDriverStatus:
    string | null,
): void {
  const missing: string[] =
    [];

  if (
    dispatcherStatus !==
      'published'
  ) {
    missing.push(
      'לוח המוקדנים',
    );
  }

  if (
    driverStatus !==
      'published'
  ) {
    missing.push(
      'לוח הכוננים',
    );
  }

  if (
    morningDriverStatus !==
      'published'
  ) {
    missing.push(
      'לוח כונני הבוקר',
    );
  }

  // עצירת הפעולה עם שגיאה כאשר missing.length > 0.
  if (
    missing.length > 0
  ) {
    throw new Error(
      `לא ניתן לייצא לפני שכל הלוחות פורסמו. חסר פרסום עבור: ${missing.join(', ')}.`,
    );
  }
}

/**
 * פעולה אסינכרונית loadTemplate: טעינת תבנית.
 * @returns Promise<ExcelJS.Workbook> — הפלט בהתאם לחתימה.
 */
async function loadTemplate():
  Promise<ExcelJS.Workbook> {
  // response — תוצאת הפעולה.
  const response =
    await fetch(
      TEMPLATE_URL,
      {
        cache:
          'no-store',
      },
    );

  // עצירת הפעולה עם שגיאה כאשר !response.ok.
  if (!response.ok) {
    throw new Error(
      'לא ניתן היה לטעון את תבנית קובץ האקסל.',
    );
  }

  // arrayBuffer — מאגר בינארי.
  const arrayBuffer =
    await response
      .arrayBuffer();

  // excelJsModule — Excel.
  const excelJsModule =
    await import(
      'exceljs'
    );

  const workbook =
    new excelJsModule
      .default
      .Workbook();

  await workbook.xlsx.load(
    arrayBuffer,
  );

  return workbook;
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
    padNumber(month);

  // shortYear — שנה.
  const shortYear =
    padNumber(
      year % 100,
    );

  return `לוח שיבוצים ${monthName} ${shortYear}.xlsx`;
}

/**
 * פעולה אסינכרונית createWorkbookBlob: יצירת הנתון createWorkbookBlob בהקשר הפעולה.
 * @param workbook — הנתון workbook בהקשר הפעולה.
 * @returns Promise<Blob> — הפלט בהתאם לחתימה.
 */
async function createWorkbookBlob(
  workbook: ExcelJS.Workbook,
): Promise<Blob> {
  // buffer — מאגר בינארי.
  const buffer =
    await workbook.xlsx
      .writeBuffer();

  return new Blob(
    [
      buffer as BlobPart,
    ],
    {
      type:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    },
  );
}

/**
 * פעולה downloadWorkbookBlob: הנתון downloadWorkbookBlob בהקשר הפעולה.
 * @param blob — הנתון blob בהקשר הפעולה.
 * @param fileName — קובץ / שם.
 * @returns void — הפלט בהתאם לחתימה.
 */
function downloadWorkbookBlob(
  blob: Blob,
  fileName: string,
): void {
  // url — כתובת יעד.
  const url =
    URL.createObjectURL(
      blob,
    );

  const anchor =
    document.createElement(
      'a',
    );

  anchor.href = url;
  anchor.download =
    fileName;

  document.body.appendChild(
    anchor,
  );

  anchor.click();
  anchor.remove();

  window.setTimeout(
    () => {
      URL.revokeObjectURL(
        url,
      );
    },
    0,
  );
}

/**
 * איגוד פעולות שיבוץ / ייצוא / שירות במחלקה ScheduleExportService.
 */
class ScheduleExportService {
  /**
   * פעולה אסינכרונית createMonthFile: יצירת חודש / קובץ.
   * @param year — שנה.
   * @param month — חודש.
   * @returns Promise<ScheduleExportFile> — הפלט בהתאם לחתימה.
   */
  async createMonthFile(
    year: number,
    month: number,
  ): Promise<ScheduleExportFile> {
    // עצירת הפעולה עם שגיאה כאשר !Number.isInteger(year) || year < 2020 || year > 2100 || !Number.isInteger(month) || month < 1 || month > 12.
    if (
      !Number.isInteger(year) ||
      year < 2020 ||
      year > 2100 ||
      !Number.isInteger(month) ||
      month < 1 ||
      month > 12
    ) {
      throw new Error(
        'החודש שנבחר לייצוא אינו תקין.',
      );
    }

    const [
      dispatcherSchedule,
      driverSchedule,
      morningDriverSchedule,
      workbook,
    ] = await Promise.all([
      scheduleService
        .getScheduleByMonth(
          year,
          month,
        ),

      driverScheduleService
        .getSchedule({
          year,
          month,
        }),

      morningDriverScheduleService
        .getSchedule(
          null,
          year,
          month,
        ),

      loadTemplate(),
    ]);

    validatePublishedSchedules(
      dispatcherSchedule.period
        ?.status ??
        null,
      driverSchedule?.period
        ?.status ??
        null,
      morningDriverSchedule
        ?.period
        ?.status ??
        null,
    );

    // עצירת הפעולה עם שגיאה כאשר !driverSchedule || !morningDriverSchedule.
    if (
      !driverSchedule ||
      !morningDriverSchedule
    ) {
      throw new Error(
        'חלק מנתוני השיבוץ החודשיים חסרים.',
      );
    }

    const worksheet =
      workbook.getWorksheet(
        TEMPLATE_SHEET_NAME,
      );

    // עצירת הפעולה עם שגיאה כאשר !worksheet.
    if (!worksheet) {
      throw new Error(
        'גיליון התבנית הנדרש לא נמצא בקובץ.',
      );
    }

    // dispatcherMap — מוקדנים / מפת התאמה.
    const dispatcherMap =
      createDispatcherMap(
        dispatcherSchedule.shifts,
      );

    // dispatcherShiftsByDate — מוקדנים / משמרות / תאריך.
    const dispatcherShiftsByDate =
      createDispatcherShiftsByDate(
        dispatcherSchedule.shifts,
      );

    // driverMap — כוננים / מפת התאמה.
    const driverMap =
      createDriverMap(
        driverSchedule.days,
      );

    // holidayNoteMap — חג / הערה / מפת התאמה.
    const holidayNoteMap =
      createHolidayNoteMap(
        dispatcherSchedule.shifts,
      );

    // morningDriverMap — כונני בוקר.
    const morningDriverMap =
      createMorningDriverMap(
        morningDriverSchedule
          .assignments,
      );

    // daysInMonth — ימים / חודש.
    const daysInMonth =
      getDaysInMonth(
        year,
        month,
      );

    clearTemplateValues(
      worksheet,
    );

    /*
     * עמודת H מיועדת להערות עסקיות בלבד.
     * אין להכניס לכאן אזהרות פנימיות של מנוע
     * השיבוץ (driverDuty.notes).
     */
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

    worksheet.getColumn(8).width =
      32;

    for (
      let day = 1;
      day <= daysInMonth;
      day += 1
    ) {
      // date — תאריך.
      const date =
        new Date(
          year,
          month - 1,
          day,
          12,
          0,
          0,
          0,
        );

      const weekdayNumber =
        date.getDay();

      // dateKey — תאריך / מפתח.
      const dateKey =
        createDateKey(
          year,
          month,
          day,
        );

      // dayDispatcherShifts — יום / מוקדנים / משמרות.
      const dayDispatcherShifts =
        dispatcherShiftsByDate.get(
          dateKey,
        ) ?? [];

      // weekendOrHolidayLayout — חג / פריסת מסך.
      const weekendOrHolidayLayout =
        hasWeekendOrHolidayDispatcherLayout(
          dayDispatcherShifts,
        );

      // firstRow — שורה.
      const firstRow =
        FIRST_DATA_ROW +
        (day - 1) *
          ROWS_PER_DAY;

      // rows — שורות.
      const rows =
        getDayRows(
          weekdayNumber,
          weekendOrHolidayLayout,
        );

      rows.forEach(
        (
          rowDefinition,
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
              weekendOrHolidayLayout,
            ),
            targetRow,
          );

          // dispatcherShift — מוקדנים / משמרת.
          const dispatcherShift =
            dispatcherMap.get(
              `${dateKey}|${rowDefinition.dispatcherHours}`,
            );

          worksheet.getCell(
            `C${targetRow}`,
          ).value =
            rowDefinition
              .dispatcherHours;

          worksheet.getCell(
            `D${targetRow}`,
          ).value =
            dispatcherShift
              ?.assignedUserName ??
            null;

          // morningShiftType — משמרת.
          const morningShiftType =
            weekdayNumber === 5 && rowOffset === 0
              ? 'friday_morning'
              : weekdayNumber !== 5 && weekdayNumber !== 6 && rowOffset === 0
                ? 'weekday_morning'
                : weekdayNumber !== 5 && weekdayNumber !== 6 && rowOffset === 1
                  ? 'weekday_evening'
                  : null;

          // morningAssignment — הקצאה.
          const morningAssignment = morningShiftType
            ? morningDriverMap.get(`${dateKey}|${morningShiftType}`)
            : undefined;

          worksheet.getCell(
            `E${targetRow}`,
          ).value =
            morningAssignment?.hours ?? rowDefinition.morningDriverHours;

          applyShiftHourStyle(
            worksheet,
            targetRow,
            dispatcherShift
              ?.isPremium ===
              true,
            isNightShiftRange(
              rowDefinition
                .dispatcherHours,
            ),
          );

          worksheet.getCell(
            `F${targetRow}`,
          ).value = morningAssignment?.names ?? null;
        },
      );

      setExportDate(
        worksheet,
        `A${firstRow}`,
        year,
        month,
        day,
      );

      worksheet.getCell(
        `B${firstRow}`,
      ).value =
        hebrewWeekdays[
          weekdayNumber
        ] ??
        '';

      // driverDuty — כוננים.
      const driverDuty =
        driverMap.get(
          dateKey,
        );

      worksheet.getCell(
        `G${firstRow}`,
      ).value =
        driverDuty
          ?.assignedUserName ??
        null;

      // holidayNote — חג / הערה.
      const holidayNote =
        holidayNoteMap.get(
          dateKey,
        ) ??
        null;

      worksheet.mergeCells(
        `H${firstRow}:H${
          firstRow +
          ROWS_PER_DAY -
          1
        }`,
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
        ...notesCell.alignment,
        horizontal: 'center',
        wrapText: true,
        vertical: 'middle',
      };

      /*
       * עמודת ההערות מחולקת ויזואלית לפי ימים.
       * כל יום הוא תא ממוזג עצמאי של שלוש שורות,
       * ולכן מוסיפים מסגרת מפורשת סביב כל בלוק יום.
       * בלי המסגרת, תאים ריקים סמוכים נראים באקסל
       * כמו עמודה רציפה אחת.
       */
      notesCell.border = {
        top: {
          style: 'thin',
          color: {
            argb: 'FFD1D5DB',
          },
        },
        right: {
          style: 'thin',
          color: {
            argb: 'FFD1D5DB',
          },
        },
        bottom: {
          style: 'thin',
          color: {
            argb: 'FFD1D5DB',
          },
        },
        left: {
          style: 'thin',
          color: {
            argb: 'FFD1D5DB',
          },
        },
      };

      notesCell.value =
        holidayNote;
    }

    hideUnusedRows(
      worksheet,
      daysInMonth,
    );

    // fileName — קובץ / שם.
    const fileName =
      createFileName(
        year,
        month,
      );

    const blob =
      await createWorkbookBlob(
        workbook,
      );

    return {
      blob,

      result: {
        fileName,
        year,
        month,
        dispatcherShifts:
          dispatcherSchedule
            .shifts.length,
        driverDuties:
          driverSchedule.days
            .filter(
              (
                day,
              ) =>
                Boolean(
                  day.assignedUserId,
                ),
            )
            .length,
        morningDriverAssignments:
          morningDriverSchedule
            .assignments
            .filter(
              (
                assignment,
              ) =>
                Boolean(
                  assignment.assignedUserId,
                ),
            )
            .length,
      },
    };
  }

  /**
   * פעולה אסינכרונית exportMonth: ייצוא ייצוא / חודש.
   * @param year — שנה.
   * @param month — חודש.
   * @returns Promise<ScheduleExportResult> — הפלט בהתאם לחתימה.
   */
  async exportMonth(
    year: number,
    month: number,
  ): Promise<ScheduleExportResult> {
    // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
    const {
      blob,
      result,
    } =
      await this.createMonthFile(
        year,
        month,
      );

    downloadWorkbookBlob(
      blob,
      result.fileName,
    );

    return result;
  }
}

// scheduleExportService — שיבוץ / ייצוא / שירות.
export const scheduleExportService =
  new ScheduleExportService();

export type {
  ScheduleExportFile,
  ScheduleExportResult,
};
