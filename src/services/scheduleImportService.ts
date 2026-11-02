/**
 * קובץ: src/services/scheduleImportService.ts
 * מטרה: פענוח קובצי שיבוץ, זיהוי מבנה הנתונים והכנת תצוגה מקדימה של הייבוא.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: RawCellValue, RawWorksheetRow, ParsedShiftRange, ParsedScheduleSheet, ExpectedImportPeriod, ParsedImportDate, normalizeText, normalizeHeaderText, padNumber, formatDateKey ועוד.
 * - ריכוז פעולות העיבוד והחישוב בהתאם לפונקציות להלן.
 */
import * as XLSX
  from 'xlsx';

import type {
  ImportedDispatcherShift,
  ImportedDriverDuty,
  ImportedMorningDriverShift,
  ImportedMorningDriverShiftType,
  ScheduleImportPreview,
  ScheduleImportPeriodType,
} from '../types/scheduleImport';

/**
 * טיפוס RawCellValue: ערך.
 */
type RawCellValue =
  | string
  | number
  | boolean
  | Date
  | null
  | undefined;

/**
 * טיפוס RawWorksheetRow: שורה.
 */
type RawWorksheetRow =
  RawCellValue[];

/**
 * חוזה הנתונים ParsedShiftRange: משמרת.
 */
interface ParsedShiftRange {
  // startTime — שעת התחלה.
  startTime: string;
  // endTime — שעת סיום.
  endTime: string;
}

/**
 * חוזה הנתונים ParsedScheduleSheet: שיבוץ.
 */
interface ParsedScheduleSheet {
  // sheetName — שם.
  sheetName: string;
  // headerRowIndex — שורה / מיקום באוסף.
  headerRowIndex: number;
  // rows — שורות.
  rows: RawWorksheetRow[];
}

/**
 * חוזה הנתונים ExpectedImportPeriod: ייבוא / תקופה.
 */
interface ExpectedImportPeriod {
  // year — שנה.
  year: number;
  // month — חודש.
  month: number;
  // source — מקור.
  source:
    | 'file_name'
    | 'dominant_dates';
}

/**
 * חוזה הנתונים ParsedImportDate: ייבוא / תאריך.
 */
interface ParsedImportDate {
  // dateKey — תאריך / מפתח.
  dateKey: string | null;
  wasCorrected: boolean;
}

// MAX_FILE_SIZE_BYTES — קובץ.
const MAX_FILE_SIZE_BYTES =
  15 * 1024 * 1024;

// SUPPORTED_FILE_EXTENSIONS — קובץ; אוסף ערכים ייחודיים.
const SUPPORTED_FILE_EXTENSIONS =
  new Set([
    'xlsx',
    'xls',
    'xlsm',
  ]);

// COLUMN_INDEX — מיקום באוסף.
const COLUMN_INDEX = {
  date: 0,
  shiftHours: 2,
  dispatcherName: 3,
  morningDriverHours: 4,
  morningDriverNames: 5,
  driverName: 6,
  note: 7,
} as const;

// HEBREW_MONTH_NUMBERS — חודש.
const HEBREW_MONTH_NUMBERS:
  Readonly<Record<string, number>> = {
    ינואר: 1,
    פברואר: 2,
    מרץ: 3,
    אפריל: 4,
    מאי: 5,
    יוני: 6,
    יולי: 7,
    אוגוסט: 8,
    ספטמבר: 9,
    אוקטובר: 10,
    נובמבר: 11,
    דצמבר: 12,
  };

/**
 * פעולה normalizeText: נרמול הנתון normalizeText בהקשר הפעולה.
 * @param value — ערך.
 * @returns string — הפלט בהתאם לחתימה.
 */
function normalizeText(
  value: RawCellValue,
): string {
  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר value === null || value === undefined.
  if (
    value === null ||
    value === undefined
  ) {
    return '';
  }

  return String(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * פעולה normalizeHeaderText: נרמול הנתון normalizeHeaderText בהקשר הפעולה.
 * @param value — ערך.
 * @returns string — הפלט בהתאם לחתימה.
 */
function normalizeHeaderText(
  value: RawCellValue,
): string {
  return normalizeText(value)
    .replace(/[״"'׳]/g, '')
    .replace(/\s+/g, '')
    .toLowerCase();
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
 * פעולה formatDateKey: עיצוב ערך לתצוגה עבור תאריך / מפתח.
 * @param year — שנה.
 * @param month — חודש.
 * @param day — יום.
 * @returns string | null — הפלט בהתאם לחתימה.
 */
function formatDateKey(
  year: number,
  month: number,
  day: number,
): string | null {
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

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר Number.isNaN( date.getTime(), ) || date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day.
  if (
    Number.isNaN(
      date.getTime(),
    ) ||
    date.getFullYear() !==
      year ||
    date.getMonth() !==
      month - 1 ||
    date.getDate() !==
      day
  ) {
    return null;
  }

  return [
    year,
    padNumber(month),
    padNumber(day),
  ].join('-');
}

/**
 * פעולה parseTwoDigitYear: פענוח קלט עבור שנה.
 * @param year — שנה.
 * @returns number — הפלט בהתאם לחתימה.
 */
function parseTwoDigitYear(
  year: number,
): number {
  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר year >= 100.
  if (year >= 100) {
    return year;
  }

  return 2000 + year;
}

/**
 * פעולה parseExcelDate: פענוח קלט עבור Excel / תאריך.
 * @param value — ערך.
 * @returns string | null — הפלט בהתאם לחתימה.
 */
function parseExcelDate(
  value: RawCellValue,
): string | null {
  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר value instanceof Date.
  if (value instanceof Date) {
    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר Number.isNaN( value.getTime(), ).
    if (
      Number.isNaN(
        value.getTime(),
      )
    ) {
      return null;
    }

    return formatDateKey(
      value.getFullYear(),
      value.getMonth() + 1,
      value.getDate(),
    );
  }

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר typeof value === 'number' && Number.isFinite(value).
  if (
    typeof value === 'number' &&
    Number.isFinite(value)
  ) {
    // parsedDate — תאריך.
    const parsedDate =
      XLSX.SSF.parse_date_code(
        value,
      );

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !parsedDate.
    if (!parsedDate) {
      return null;
    }

    return formatDateKey(
      parsedDate.y,
      parsedDate.m,
      parsedDate.d,
    );
  }

  // normalizedValue — ערך.
  const normalizedValue =
    normalizeText(value);

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !normalizedValue.
  if (!normalizedValue) {
    return null;
  }

  const isoMatch =
    normalizedValue.match(
      /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/,
    );

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר isoMatch.
  if (isoMatch) {
    return formatDateKey(
      Number(isoMatch[1]),
      Number(isoMatch[2]),
      Number(isoMatch[3]),
    );
  }

  // israeliDateMatch — תאריך.
  const israeliDateMatch =
    normalizedValue.match(
      /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/,
    );

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר israeliDateMatch.
  if (israeliDateMatch) {
    return formatDateKey(
      parseTwoDigitYear(
        Number(
          israeliDateMatch[3],
        ),
      ),
      Number(
        israeliDateMatch[2],
      ),
      Number(
        israeliDateMatch[1],
      ),
    );
  }

  return null;
}


/**
 * פעולה parseYearFromFileName: פענוח קלט עבור שנה / קובץ / שם.
 * @param value — ערך.
 * @returns number | null — הפלט בהתאם לחתימה.
 */
function parseYearFromFileName(
  value: string,
): number | null {
  // numericYear — שנה.
  const numericYear =
    Number(value);

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !Number.isInteger( numericYear, ).
  if (
    !Number.isInteger(
      numericYear,
    )
  ) {
    return null;
  }

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר numericYear >= 2000 && numericYear <= 2100.
  if (
    numericYear >= 2000 &&
    numericYear <= 2100
  ) {
    return numericYear;
  }

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר numericYear >= 0 && numericYear <= 99.
  if (
    numericYear >= 0 &&
    numericYear <= 99
  ) {
    return 2000 +
      numericYear;
  }

  return null;
}

/**
 * פעולה detectPeriodFromFileName: תקופה / קובץ / שם.
 * @param fileName — קובץ / שם.
 * @returns ExpectedImportPeriod | null — הפלט בהתאם לחתימה.
 */
function detectPeriodFromFileName(
  fileName: string,
): ExpectedImportPeriod | null {
  // normalizedFileName — קובץ / שם.
  const normalizedFileName =
    normalizeText(
      fileName,
    )
      .replace(
        /[_-]+/g,
        ' ',
      );

  // עיבוד כל פריט מתוך Object.entries( HEBREW_MONTH_NUMBERS, ) בנפרד.
  for (
    const [
      monthName,
      monthNumber,
    ] of Object.entries(
      HEBREW_MONTH_NUMBERS,
    )
  ) {
    // monthPattern — חודש.
    const monthPattern =
      new RegExp(
        `${monthName}\\s+(\\d{2}|\\d{4})(?:\\D|$)`,
        'i',
      );

    const match =
      normalizedFileName.match(
        monthPattern,
      );

    if (!match) {
      continue;
    }

    // year — שנה.
    const year =
      parseYearFromFileName(
        match[1],
      );

    if (!year) {
      continue;
    }

    return {
      year,
      month:
        monthNumber,
      source:
        'file_name',
    };
  }

  const numericMatch =
    normalizedFileName.match(
      /(?:^|\D)(0?[1-9]|1[0-2])[\s./-]+(\d{2}|\d{4})(?:\D|$)/,
    );

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !numericMatch.
  if (!numericMatch) {
    return null;
  }

  // year — שנה.
  const year =
    parseYearFromFileName(
      numericMatch[2],
    );

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !year.
  if (!year) {
    return null;
  }

  return {
    year,
    month:
      Number(
        numericMatch[1],
      ),
    source:
      'file_name',
  };
}

/**
 * פעולה detectDominantPeriod: תקופה.
 * @param parsedSheet — הנתון parsedSheet בהקשר הפעולה.
 * @returns ExpectedImportPeriod | null — הפלט בהתאם לחתימה.
 */
function detectDominantPeriod(
  parsedSheet:
    ParsedScheduleSheet,
): ExpectedImportPeriod | null {
  // periodCounts — תקופה; מיפוי לחיפוש לפי מפתח.
  const periodCounts =
    new Map<string, number>();

  // dataRows — נתונים / שורות.
  const dataRows =
    parsedSheet.rows.slice(
      parsedSheet.headerRowIndex +
        1,
    );

  dataRows.forEach(
    (row) => {
      // parsedDate — תאריך.
      const parsedDate =
        parseExcelDate(
          row[
            COLUMN_INDEX.date
          ],
        );

      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !parsedDate.
      if (!parsedDate) {
        return;
      }

      const {
        year,
        month,
      } =
        getYearAndMonth(
          parsedDate,
        );

      // periodKey — תקופה / מפתח.
      const periodKey =
        `${year}-${padNumber(month)}`;

      periodCounts.set(
        periodKey,
        (
          periodCounts.get(
            periodKey,
          ) ?? 0
        ) + 1,
      );
    },
  );

  // dominantEntry — רשומה.
  const dominantEntry =
    Array.from(
      periodCounts.entries(),
    ).sort(
      (
        firstEntry,
        secondEntry,
      ) =>
        secondEntry[1] -
        firstEntry[1],
    )[0];

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !dominantEntry.
  if (!dominantEntry) {
    return null;
  }

  const [
    yearText,
    monthText,
  ] =
    dominantEntry[0].split(
      '-',
    );

  return {
    year:
      Number(yearText),
    month:
      Number(monthText),
    source:
      'dominant_dates',
  };
}

/**
 * פעולה detectExpectedImportPeriod: ייבוא / תקופה.
 * @param parsedSheet — הנתון parsedSheet בהקשר הפעולה.
 * @param fileName — קובץ / שם.
 * @returns ExpectedImportPeriod | null — הפלט בהתאם לחתימה.
 */
function detectExpectedImportPeriod(
  parsedSheet:
    ParsedScheduleSheet,
  fileName: string,
): ExpectedImportPeriod | null {
  return (
    detectPeriodFromFileName(
      fileName,
    ) ??
    detectDominantPeriod(
      parsedSheet,
    )
  );
}

/**
 * פעולה parseImportDate: פענוח קלט עבור ייבוא / תאריך.
 * @param value — ערך.
 * @param expectedPeriod — תקופה.
 * @returns ParsedImportDate — הפלט בהתאם לחתימה.
 */
function parseImportDate(
  value: RawCellValue,
  expectedPeriod:
    ExpectedImportPeriod | null,
): ParsedImportDate {
  // parsedDate — תאריך.
  const parsedDate =
    parseExcelDate(
      value,
    );

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !parsedDate || !expectedPeriod.
  if (
    !parsedDate ||
    !expectedPeriod
  ) {
    return {
      dateKey:
        parsedDate,
      wasCorrected:
        false,
    };
  }

  const [
    yearText,
    monthText,
    dayText,
  ] =
    parsedDate.split(
      '-',
    );

  // year — שנה.
  const year =
    Number(yearText);

  // month — חודש.
  const month =
    Number(monthText);

  // day — יום.
  const day =
    Number(dayText);

  // isExcelDateCell — Excel / תאריך.
  const isExcelDateCell =
    value instanceof Date ||
    (
      typeof value ===
        'number' &&
      Number.isFinite(
        value,
      )
    );

  // looksLikeSwappedIsraeliDate — תאריך.
  const looksLikeSwappedIsraeliDate =
    isExcelDateCell &&
    year ===
      expectedPeriod.year &&
    month !==
      expectedPeriod.month &&
    day ===
      expectedPeriod.month &&
    month >= 1 &&
    month <= 12;

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !looksLikeSwappedIsraeliDate.
  if (
    !looksLikeSwappedIsraeliDate
  ) {
    return {
      dateKey:
        parsedDate,
      wasCorrected:
        false,
    };
  }

  // correctedDate — תאריך.
  const correctedDate =
    formatDateKey(
      expectedPeriod.year,
      expectedPeriod.month,
      month,
    );

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !correctedDate.
  if (!correctedDate) {
    return {
      dateKey:
        parsedDate,
      wasCorrected:
        false,
    };
  }

  return {
    dateKey:
      correctedDate,
    wasCorrected:
      true,
  };
}

/**
 * פעולה normalizeTime: נרמול זמן.
 * @param hourValue — ערך.
 * @param minuteValue — ערך.
 * @returns string | null — הפלט בהתאם לחתימה.
 */
function normalizeTime(
  hourValue: string,
  minuteValue:
    string | undefined,
): string | null {
  const hour =
    Number(hourValue);

  const minute =
    minuteValue
      ? Number(minuteValue)
      : 0;

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !Number.isInteger(hour) || !Number.isInteger(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59.
  if (
    !Number.isInteger(hour) ||
    !Number.isInteger(minute) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return null;
  }

  return `${padNumber(hour)}:${padNumber(minute)}`;
}

/**
 * פעולה parseShiftRange: פענוח קלט עבור משמרת.
 * @param value — ערך.
 * @returns ParsedShiftRange | null — הפלט בהתאם לחתימה.
 */
function parseShiftRange(
  value: RawCellValue,
): ParsedShiftRange | null {
  // normalizedValue — ערך.
  const normalizedValue =
    normalizeText(value)
      .replace(/[–—−]/g, '-')
      .replace(/\s+/g, '');

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !normalizedValue.
  if (!normalizedValue) {
    return null;
  }

  const rangeMatch =
    normalizedValue.match(
      /^(\d{1,2})(?::(\d{1,2}))?-(\d{1,2})(?::(\d{1,2}))?$/,
    );

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !rangeMatch.
  if (!rangeMatch) {
    return null;
  }

  // startTime — שעת התחלה.
  const startTime =
    normalizeTime(
      rangeMatch[1],
      rangeMatch[2],
    );

  // endTime — שעת סיום.
  const endTime =
    normalizeTime(
      rangeMatch[3],
      rangeMatch[4],
    );

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !startTime || !endTime.
  if (
    !startTime ||
    !endTime
  ) {
    return null;
  }

  return {
    startTime,
    endTime,
  };
}


/**
 * פעולה splitMorningDriverNames: כונני בוקר.
 * @param value — ערך.
 * @returns string[] — הפלט בהתאם לחתימה.
 */
function splitMorningDriverNames(
  value: RawCellValue,
): string[] {
  // normalizedValue — ערך.
  const normalizedValue =
    normalizeText(
      value,
    );

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !normalizedValue.
  if (
    !normalizedValue
  ) {
    return [];
  }

  return normalizedValue
    .split(
      /\s*(?:\/|\\|;|,|&|\+)\s*/g,
    )
    .map(
      (
        name,
      ) =>
        name.trim(),
    )
    .filter(
      Boolean,
    );
}

/**
 * פעולה getMorningDriverShiftType: שליפה או חישוב של כונני בוקר.
 * @param shiftRange — משמרת.
 * @returns ImportedMorningDriverShiftType | null — הפלט בהתאם לחתימה.
 */
function getMorningDriverShiftType(
  shiftRange:
    ParsedShiftRange,
): ImportedMorningDriverShiftType | null {
  // shiftKey — משמרת / מפתח.
  const shiftKey =
    `${shiftRange.startTime}-${shiftRange.endTime}`;

  /*
   * לוחות היסטוריים השתמשו גם ב-06:00-15:00,
   * בעוד שהמבנה הנוכחי הוא 06:00-16:00.
   * שתי התבניות מייצגות את משמרת הבוקר של א'-ה'.
   */
  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר shiftKey === '06:00-16:00' || shiftKey === '06:00-15:00'.
  if (
    shiftKey ===
      '06:00-16:00' ||
    shiftKey ===
      '06:00-15:00'
  ) {
    return 'weekday_morning';
  }

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר shiftKey === '15:00-23:00' || shiftKey === '16:00-23:00'.
  if (
    shiftKey ===
      '15:00-23:00' ||
    shiftKey ===
      '16:00-23:00'
  ) {
    return 'weekday_evening';
  }

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר shiftKey === '06:00-14:00'.
  if (
    shiftKey ===
      '06:00-14:00'
  ) {
    return 'friday_morning';
  }

  return null;
}

/**
 * פעולה getMorningDriverStaffing: שליפה או חישוב של כונני בוקר.
 * @param shiftType — משמרת.
 * @returns { minimumWorkers: number; recommendedWorkers: number; } — הפלט בהתאם לחתימה.
 */
function getMorningDriverStaffing(
  shiftType:
    ImportedMorningDriverShiftType,
): {
  // minimumWorkers — מספר העובדים המזערי.
  minimumWorkers: number;
  // recommendedWorkers — מספר העובדים המומלץ.
  recommendedWorkers: number;
} {
  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר shiftType === 'weekday_morning'.
  if (
    shiftType ===
      'weekday_morning'
  ) {
    return {
      minimumWorkers: 1,
      recommendedWorkers: 2,
    };
  }

  return {
    minimumWorkers: 1,
    recommendedWorkers: 1,
  };
}

/**
 * פעולה createMorningDriverShiftKey: יצירת כונני בוקר.
 * @param shift — משמרת.
 * @returns string — הפלט בהתאם לחתימה.
 */
function createMorningDriverShiftKey(
  shift:
    ImportedMorningDriverShift,
): string {
  return [
    shift.date,
    shift.startTime,
    shift.endTime,
    shift.assignmentSlot,
    shift.morningDriverName,
  ].join('|');
}

/**
 * פעולה getFileExtension: שליפה או חישוב של קובץ.
 * @param fileName — קובץ / שם.
 * @returns string — הפלט בהתאם לחתימה.
 */
function getFileExtension(
  fileName: string,
): string {
  // fileNameParts — קובץ / שם.
  const fileNameParts =
    fileName
      .toLowerCase()
      .split('.');

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר fileNameParts.length < 2.
  if (
    fileNameParts.length <
    2
  ) {
    return '';
  }

  return (
    fileNameParts.pop() ??
    ''
  );
}

/**
 * פעולה validateFile: בדיקת תקינות של קובץ.
 * @param file — קובץ.
 * @returns void — הפלט בהתאם לחתימה.
 */
function validateFile(
  file: File,
): void {
  // עצירת הפעולה עם שגיאה כאשר !file.
  if (!file) {
    throw new Error(
      'לא נבחר קובץ לייבוא.',
    );
  }

  const extension =
    getFileExtension(
      file.name,
    );

  // עצירת הפעולה עם שגיאה כאשר !SUPPORTED_FILE_EXTENSIONS.has( extension, ).
  if (
    !SUPPORTED_FILE_EXTENSIONS.has(
      extension,
    )
  ) {
    throw new Error(
      'יש לבחור קובץ Excel מסוג XLSX, XLS או XLSM.',
    );
  }

  // עצירת הפעולה עם שגיאה כאשר file.size === 0.
  if (file.size === 0) {
    throw new Error(
      'קובץ האקסל ריק.',
    );
  }

  // עצירת הפעולה עם שגיאה כאשר file.size > MAX_FILE_SIZE_BYTES.
  if (
    file.size >
    MAX_FILE_SIZE_BYTES
  ) {
    throw new Error(
      'קובץ האקסל גדול מדי. הגודל המרבי הוא 15MB.',
    );
  }
}

/**
 * פעולה isScheduleHeaderRow: בדיקת תנאי עבור שיבוץ / שורה.
 * @param row — שורה.
 * @returns boolean — הפלט בהתאם לחתימה.
 */
function isScheduleHeaderRow(
  row: RawWorksheetRow,
): boolean {
  // normalizedCells — הנתון normalizedCells בהקשר הפעולה.
  const normalizedCells =
    row.map(
      normalizeHeaderText,
    );

  // hasDispatcherHeader — מוקדנים.
  const hasDispatcherHeader =
    normalizedCells.some(
      (cellValue) =>
        cellValue.includes(
          'מוקדן',
        ),
    );

  // hasDriverHeader — כוננים.
  const hasDriverHeader =
    normalizedCells.some(
      (cellValue) =>
        cellValue.includes(
          'כונןטכני',
        ) ||
        cellValue.includes(
          'כונן',
        ),
    );

  // hasDateHeader — תאריך.
  const hasDateHeader =
    normalizedCells.some(
      (cellValue) =>
        cellValue.includes(
          'תאריך',
        ),
    );

  return (
    hasDispatcherHeader &&
    hasDriverHeader &&
    hasDateHeader
  );
}

/**
 * פעולה findHeaderRowIndex: איתור שורה / מיקום באוסף.
 * @param rows — שורות.
 * @returns number — הפלט בהתאם לחתימה.
 */
function findHeaderRowIndex(
  rows: RawWorksheetRow[],
): number {
  // maximumRowsToInspect — שורות.
  const maximumRowsToInspect =
    Math.min(
      rows.length,
      20,
    );

  for (
    let rowIndex = 0;
    rowIndex <
    maximumRowsToInspect;
    rowIndex += 1
  ) {
    // row — שורה.
    const row =
      rows[rowIndex] ??
      [];

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר isScheduleHeaderRow( row, ).
    if (
      isScheduleHeaderRow(
        row,
      )
    ) {
      return rowIndex;
    }
  }

  return -1;
}

/**
 * פעולה findScheduleSheet: איתור שיבוץ.
 * @param workbook — הנתון workbook בהקשר הפעולה.
 * @returns ParsedScheduleSheet — הפלט בהתאם לחתימה.
 */
function findScheduleSheet(
  workbook:
    XLSX.WorkBook,
): ParsedScheduleSheet {
  // עיבוד כל פריט מתוך workbook.SheetNames בנפרד.
  for (
    const sheetName of
    workbook.SheetNames
  ) {
    const worksheet =
      workbook.Sheets[
        sheetName
      ];

    if (!worksheet) {
      continue;
    }

    // rows — שורות.
    const rows =
      XLSX.utils.sheet_to_json<
        RawWorksheetRow
      >(
        worksheet,
        {
          header: 1,
          raw: true,
          defval: null,
          blankrows: false,
        },
      );

    // headerRowIndex — שורה / מיקום באוסף.
    const headerRowIndex =
      findHeaderRowIndex(
        rows,
      );

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר headerRowIndex >= 0.
    if (
      headerRowIndex >= 0
    ) {
      return {
        sheetName,
        headerRowIndex,
        rows,
      };
    }
  }

  throw new Error(
    'לא נמצא בקובץ גיליון התואם לתבנית לוח השיבוצים.',
  );
}

/**
 * פעולה getYearAndMonth: שליפה או חישוב של שנה / חודש.
 * @param dateKey — תאריך / מפתח.
 * @returns { year: number; month: number; } — הפלט בהתאם לחתימה.
 */
function getYearAndMonth(
  dateKey: string,
): {
  // year — שנה.
  year: number;
  // month — חודש.
  month: number;
} {
  const [
    yearText,
    monthText,
  ] =
    dateKey.split('-');

  return {
    year:
      Number(yearText),

    month:
      Number(monthText),
  };
}

/**
 * פעולה createDispatcherShiftKey: יצירת מוקדנים / משמרת / מפתח.
 * @param shift — משמרת.
 * @returns string — הפלט בהתאם לחתימה.
 */
function createDispatcherShiftKey(
  shift:
    ImportedDispatcherShift,
): string {
  return [
    shift.date,
    shift.startTime,
    shift.endTime,
    shift.dispatcherName,
  ].join('|');
}

/**
 * פעולה parseScheduleRows: פענוח קלט עבור שיבוץ / שורות.
 * @param parsedSheet — הנתון parsedSheet בהקשר הפעולה.
 * @param expectedPeriod — תקופה.
 * @returns Omit< ScheduleImportPreview, 'periodType' > — הפלט בהתאם לחתימה.
 */
function parseScheduleRows(
  parsedSheet:
    ParsedScheduleSheet,
  expectedPeriod:
    ExpectedImportPeriod | null,
): Omit<
  ScheduleImportPreview,
  'periodType'
> {
  // dispatcherShifts — מוקדנים / משמרות.
  const dispatcherShifts:
    ImportedDispatcherShift[] =
    [];

  // driverDutiesByDate — כוננים / תאריך; מיפוי לחיפוש לפי מפתח.
  const driverDutiesByDate =
    new Map<
      string,
      ImportedDriverDuty
    >();

  // morningDriverShifts — כונני בוקר.
  const morningDriverShifts:
    ImportedMorningDriverShift[] =
    [];

  // dispatcherShiftKeys — מוקדנים / משמרת; אוסף ערכים ייחודיים.
  const dispatcherShiftKeys =
    new Set<string>();

  // morningDriverShiftKeys — כונני בוקר; אוסף ערכים ייחודיים.
  const morningDriverShiftKeys =
    new Set<string>();

  const warnings:
    string[] = [];

  // detectedPeriods — תקופות; אוסף ערכים ייחודיים.
  const detectedPeriods =
    new Set<string>();

  // skippedRows — שורות.
  let skippedRows = 0;

  // correctedDateCount — תאריך / כמות.
  let correctedDateCount = 0;

  // legacyMorningHoursCount — שעות / כמות.
  let legacyMorningHoursCount = 0;

  // currentDate — תאריך.
  let currentDate:
    string | null =
    null;

  // currentDriverName — כוננים / שם.
  let currentDriverName =
    '';

  // currentDayNote — יום / הערה.
  let currentDayNote:
    string | null =
    null;

  // dataRows — נתונים / שורות.
  const dataRows =
    parsedSheet.rows.slice(
      parsedSheet.headerRowIndex +
        1,
    );

  dataRows.forEach(
    (
      row,
      relativeRowIndex,
    ) => {
      // excelRowNumber — Excel / שורה.
      const excelRowNumber =
        parsedSheet.headerRowIndex +
        relativeRowIndex +
        2;

      // parsedImportDate — ייבוא / תאריך.
      const parsedImportDate =
        parseImportDate(
          row[
            COLUMN_INDEX.date
          ],
          expectedPeriod,
        );

      // parsedDate — תאריך.
      const parsedDate =
        parsedImportDate.dateKey;

      if (
        parsedImportDate
          .wasCorrected
      ) {
        correctedDateCount += 1;
      }

      if (parsedDate) {
        currentDate =
          parsedDate;

        currentDriverName =
          '';

        currentDayNote =
          null;

        const {
          year,
          month,
        } =
          getYearAndMonth(
            parsedDate,
          );

        detectedPeriods.add(
          `${year}-${padNumber(month)}`,
        );
      }

      // driverNameInRow — כוננים / שם / שורה.
      const driverNameInRow =
        normalizeText(
          row[
            COLUMN_INDEX
              .driverName
          ],
        );

      if (driverNameInRow) {
        currentDriverName =
          driverNameInRow;
      }

      // noteInRow — הערה / שורה.
      const noteInRow =
        normalizeText(
          row[
            COLUMN_INDEX.note
          ],
        );

      if (noteInRow) {
        currentDayNote =
          currentDayNote
            ? `${currentDayNote}\n${noteInRow}`
            : noteInRow;
      }

      if (
        currentDate &&
        currentDriverName
      ) {
        driverDutiesByDate.set(
          currentDate,
          {
            date:
              currentDate,

            driverName:
              currentDriverName,

            note:
              currentDayNote,
          },
        );
      }


      // morningDriverNames — כונני בוקר.
      const morningDriverNames =
        splitMorningDriverNames(
          row[
            COLUMN_INDEX
              .morningDriverNames
          ],
        );

      if (
        morningDriverNames.length >
        0
      ) {
        if (!currentDate) {
          skippedRows +=
            morningDriverNames.length;

          warnings.push(
            `שורה ${excelRowNumber}: נמצאו כונני בוקר ללא תאריך תקין.`,
          );
        } else {
          // morningShiftRange — משמרת.
          const morningShiftRange =
            parseShiftRange(
              row[
                COLUMN_INDEX
                  .morningDriverHours
              ],
            );

          if (
            !morningShiftRange
          ) {
            skippedRows +=
              morningDriverNames.length;

            warnings.push(
              `שורה ${excelRowNumber}: נמצאו כונני בוקר אך לא ניתן לזהות את שעות המשמרת בעמודה E.`,
            );
          } else {
            // morningShiftType — משמרת.
            const morningShiftType =
              getMorningDriverShiftType(
                morningShiftRange,
              );

            if (!morningShiftType) {
              skippedRows +=
                morningDriverNames.length;

              warnings.push(
                `שורה ${excelRowNumber}: שעות כונני הבוקר ${morningShiftRange.startTime}-${morningShiftRange.endTime} אינן תואמות למשמרת מוכרת.`,
              );
            } else {
              // morningShiftKey — משמרת / מפתח.
              const morningShiftKey =
                `${morningShiftRange.startTime}-${morningShiftRange.endTime}`;

              if (
                morningShiftKey ===
                  '06:00-15:00' ||
                morningShiftKey ===
                  '16:00-23:00'
              ) {
                legacyMorningHoursCount +=
                  1;
              }

              if (
                morningDriverNames.length >
                2
              ) {
                warnings.push(
                  `שורה ${excelRowNumber}: נמצאו ${morningDriverNames.length} כונני בוקר. רק שני השמות הראשונים ייובאו.`,
                );
              }

              const staffing =
                getMorningDriverStaffing(
                  morningShiftType,
                );

              morningDriverNames
                .slice(
                  0,
                  2,
                )
                .forEach(
                  (
                    morningDriverName,
                    nameIndex,
                  ) => {
                    // importedShift — משמרת.
                    const importedShift:
                      ImportedMorningDriverShift = {
                        date:
                          currentDate as string,

                        startTime:
                          morningShiftRange.startTime,

                        endTime:
                          morningShiftRange.endTime,

                        morningDriverName,

                        assignmentSlot:
                          nameIndex + 1,

                        shiftType:
                          morningShiftType,

                        minimumWorkers:
                          staffing.minimumWorkers,

                        recommendedWorkers:
                          staffing.recommendedWorkers,
                      };

                    // shiftKey — משמרת / מפתח.
                    const shiftKey =
                      createMorningDriverShiftKey(
                        importedShift,
                      );

                    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר morningDriverShiftKeys.has( shiftKey, ).
                    if (
                      morningDriverShiftKeys.has(
                        shiftKey,
                      )
                    ) {
                      warnings.push(
                        `שורה ${excelRowNumber}: נמצא שיבוץ כפול של ${morningDriverName} במשמרת כונני הבוקר בתאריך ${currentDate}.`,
                      );

                      return;
                    }

                    morningDriverShiftKeys.add(
                      shiftKey,
                    );

                    morningDriverShifts.push(
                      importedShift,
                    );
                  },
                );
            }
          }
        }
      }

      // dispatcherName — מוקדנים / שם.
      const dispatcherName =
        normalizeText(
          row[
            COLUMN_INDEX
              .dispatcherName
          ],
        );

      /*
       * עמודה D ריקה בשורות מוקד
       * הבוקר ולכן זו אינה שגיאה.
       */
      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !dispatcherName.
      if (!dispatcherName) {
        return;
      }

      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !currentDate.
      if (!currentDate) {
        skippedRows += 1;

        warnings.push(
          `שורה ${excelRowNumber}: נמצא מוקדן ללא תאריך תקין.`,
        );

        return;
      }

      // shiftRange — משמרת.
      const shiftRange =
        parseShiftRange(
          row[
            COLUMN_INDEX
              .shiftHours
          ],
        );

      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !shiftRange.
      if (!shiftRange) {
        skippedRows += 1;

        warnings.push(
          `שורה ${excelRowNumber}: לא ניתן לזהות את שעות המשמרת של ${dispatcherName}.`,
        );

        return;
      }

      // dispatcherShift — מוקדנים / משמרת.
      const dispatcherShift:
        ImportedDispatcherShift = {
          date:
            currentDate,

          startTime:
            shiftRange.startTime,

          endTime:
            shiftRange.endTime,

          dispatcherName,
        };

      // dispatcherShiftKey — מוקדנים / משמרת / מפתח.
      const dispatcherShiftKey =
        createDispatcherShiftKey(
          dispatcherShift,
        );

      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר dispatcherShiftKeys.has( dispatcherShiftKey, ).
      if (
        dispatcherShiftKeys.has(
          dispatcherShiftKey,
        )
      ) {
        warnings.push(
          `שורה ${excelRowNumber}: נמצאה משמרת כפולה של ${dispatcherName} בתאריך ${currentDate}.`,
        );

        return;
      }

      dispatcherShiftKeys.add(
        dispatcherShiftKey,
      );

      dispatcherShifts.push(
        dispatcherShift,
      );
    },
  );

  // driverDuties — כוננים.
  const driverDuties =
    Array.from(
      driverDutiesByDate.values(),
    ).sort(
      (
        firstDuty,
        secondDuty,
      ) =>
        firstDuty.date.localeCompare(
          secondDuty.date,
        ),
    );

  dispatcherShifts.sort(
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

      return firstShift.startTime.localeCompare(
        secondShift.startTime,
      );
    },
  );


  morningDriverShifts.sort(
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

      // startTimeComparison — שעת התחלה.
      const startTimeComparison =
        firstShift.startTime.localeCompare(
          secondShift.startTime,
        );

      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר startTimeComparison !== 0.
      if (
        startTimeComparison !== 0
      ) {
        return startTimeComparison;
      }

      return (
        firstShift.assignmentSlot -
        secondShift.assignmentSlot
      );
    },
  );

  // עצירת הפעולה עם שגיאה כאשר detectedPeriods.size === 0.
  if (
    detectedPeriods.size ===
    0
  ) {
    throw new Error(
      'לא נמצאו בקובץ תאריכים תקינים.',
    );
  }

  if (
    correctedDateCount > 0 &&
    expectedPeriod
  ) {
    warnings.push(
      `תוקנו אוטומטית ${correctedDateCount} תאריכים ש-Excel פירש בפורמט אמריקאי. החודש זוהה כ-${padNumber(expectedPeriod.month)}/${expectedPeriod.year}.`,
    );
  }

  if (
    legacyMorningHoursCount >
      0
  ) {
    warnings.push(
      `זוהו ${legacyMorningHoursCount} שורות של כונני בוקר במבנה שעות היסטורי. הן סווגו אוטומטית לפי סוג המשמרת המתאים.`,
    );
  }

  // sortedPeriods — תקופות.
  const sortedPeriods =
    Array.from(
      detectedPeriods,
    ).sort();

  if (
    sortedPeriods.length >
    1
  ) {
    warnings.push(
      `הקובץ מכיל תאריכים ממספר חודשים: ${sortedPeriods.join(', ')}.`,
    );
  }

  const [
    firstYearText,
    firstMonthText,
  ] =
    sortedPeriods[0].split(
      '-',
    );

  // year — שנה.
  const year =
    Number(
      firstYearText,
    );

  // month — חודש.
  const month =
    Number(
      firstMonthText,
    );

  if (
    dispatcherShifts.length ===
    0
  ) {
    warnings.push(
      'לא זוהו שיבוצי מוקדנים בקובץ.',
    );
  }

  if (
    driverDuties.length ===
    0
  ) {
    warnings.push(
      'לא זוהו כוננויות טכניות בקובץ.',
    );
  }

  if (
    morningDriverShifts.length ===
    0
  ) {
    warnings.push(
      'לא זוהו שיבוצי כונני בוקר בעמודות E ו-F.',
    );
  }

  // expectedDaysInMonth — ימים / חודש.
  const expectedDaysInMonth =
    new Date(
      year,
      month,
      0,
    ).getDate();

  if (
    driverDuties.length !==
    expectedDaysInMonth
  ) {
    warnings.push(
      `זוהו ${driverDuties.length} ימי כוננות מתוך ${expectedDaysInMonth} ימים בחודש.`,
    );
  }

  return {
    year,
    month,
    dispatcherShifts,
    driverDuties,
    morningDriverShifts,
    skippedRows,
    warnings,
  };
}
/**
 * פעולה getImportPeriodType: שליפה או חישוב של ייבוא / תקופה.
 * @param year — שנה.
 * @param month — חודש.
 * @returns ScheduleImportPeriodType — הפלט בהתאם לחתימה.
 */
function getImportPeriodType(
  year: number,
  month: number,
): ScheduleImportPeriodType {
  // currentDate — תאריך.
  const currentDate =
    new Date();

  // currentPeriodValue — תקופה / ערך.
  const currentPeriodValue =
    currentDate.getFullYear() *
      12 +
    currentDate.getMonth();

  // importedPeriodValue — תקופה / ערך.
  const importedPeriodValue =
    year * 12 +
    (month - 1);

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר importedPeriodValue < currentPeriodValue.
  if (
    importedPeriodValue <
    currentPeriodValue
  ) {
    return 'historical';
  }

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר importedPeriodValue === currentPeriodValue.
  if (
    importedPeriodValue ===
    currentPeriodValue
  ) {
    return 'current';
  }

  return 'future';
}
/**
 * פעולה אסינכרונית analyzeScheduleWorkbook: שיבוץ.
 * @param file — קובץ.
 * @returns Promise<ScheduleImportPreview> — הפלט בהתאם לחתימה.
 */
async function analyzeScheduleWorkbook(
  file: File,
): Promise<ScheduleImportPreview> {
  validateFile(file);

  // fileBuffer — קובץ / מאגר בינארי.
  let fileBuffer:
    ArrayBuffer;

  // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
  try {
    fileBuffer =
      await file.arrayBuffer();
  } catch (error) {
    throw new Error(
      'לא ניתן היה לקרוא את קובץ האקסל.',
      {
        cause: error,
      },
    );
  }

  let workbook:
    XLSX.WorkBook;

  // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
  try {
    workbook =
      XLSX.read(
        fileBuffer,
        {
          type: 'array',
          cellDates: true,
          dense: true,
        },
      );
  } catch (error) {
    console.error(
      'SCHEDULE IMPORT WORKBOOK ERROR:',
      error,
    );

    throw new Error(
      'קובץ האקסל אינו תקין או שאינו נתמך.',
      {
        cause: error,
      },
    );
  }

  // עצירת הפעולה עם שגיאה כאשר workbook.SheetNames.length === 0.
  if (
    workbook.SheetNames.length ===
    0
  ) {
    throw new Error(
      'קובץ האקסל אינו מכיל גיליונות.',
    );
  }

  const parsedSheet =
    findScheduleSheet(
      workbook,
    );

  // expectedPeriod — תקופה.
  const expectedPeriod =
    detectExpectedImportPeriod(
      parsedSheet,
      file.name,
    );

  const parsedPreview =
    parseScheduleRows(
      parsedSheet,
      expectedPeriod,
    );

  return {
    ...parsedPreview,

    periodType:
      getImportPeriodType(
        parsedPreview.year,
        parsedPreview.month,
      ),
  };
}

// scheduleImportService — שיבוץ / ייבוא / שירות.
export const scheduleImportService = {
  analyzeScheduleWorkbook,
};