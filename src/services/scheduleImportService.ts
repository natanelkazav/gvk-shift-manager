import * as XLSX
  from 'xlsx';

import type {
  ImportedDispatcherShift,
  ImportedDriverDuty,
  ScheduleImportPreview,
} from '../types/scheduleImport';

type RawCellValue =
  | string
  | number
  | boolean
  | Date
  | null
  | undefined;

type RawWorksheetRow =
  RawCellValue[];

interface ParsedShiftRange {
  startTime: string;
  endTime: string;
}

interface ParsedScheduleSheet {
  sheetName: string;
  headerRowIndex: number;
  rows: RawWorksheetRow[];
}

const MAX_FILE_SIZE_BYTES =
  15 * 1024 * 1024;

const SUPPORTED_FILE_EXTENSIONS =
  new Set([
    'xlsx',
    'xls',
    'xlsm',
  ]);

const COLUMN_INDEX = {
  date: 0,
  shiftHours: 2,
  dispatcherName: 3,
  driverName: 6,
  note: 7,
} as const;

function normalizeText(
  value: RawCellValue,
): string {
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

function normalizeHeaderText(
  value: RawCellValue,
): string {
  return normalizeText(value)
    .replace(/[״"'׳]/g, '')
    .replace(/\s+/g, '')
    .toLowerCase();
}

function padNumber(
  value: number,
): string {
  return String(value)
    .padStart(2, '0');
}

function formatDateKey(
  year: number,
  month: number,
  day: number,
): string | null {
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

function parseTwoDigitYear(
  year: number,
): number {
  if (year >= 100) {
    return year;
  }

  return 2000 + year;
}

function parseExcelDate(
  value: RawCellValue,
): string | null {
  if (value instanceof Date) {
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

  if (
    typeof value === 'number' &&
    Number.isFinite(value)
  ) {
    const parsedDate =
      XLSX.SSF.parse_date_code(
        value,
      );

    if (!parsedDate) {
      return null;
    }

    return formatDateKey(
      parsedDate.y,
      parsedDate.m,
      parsedDate.d,
    );
  }

  const normalizedValue =
    normalizeText(value);

  if (!normalizedValue) {
    return null;
  }

  const isoMatch =
    normalizedValue.match(
      /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/,
    );

  if (isoMatch) {
    return formatDateKey(
      Number(isoMatch[1]),
      Number(isoMatch[2]),
      Number(isoMatch[3]),
    );
  }

  const israeliDateMatch =
    normalizedValue.match(
      /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/,
    );

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

function parseShiftRange(
  value: RawCellValue,
): ParsedShiftRange | null {
  const normalizedValue =
    normalizeText(value)
      .replace(/[–—−]/g, '-')
      .replace(/\s+/g, '');

  if (!normalizedValue) {
    return null;
  }

  const rangeMatch =
    normalizedValue.match(
      /^(\d{1,2})(?::(\d{1,2}))?-(\d{1,2})(?::(\d{1,2}))?$/,
    );

  if (!rangeMatch) {
    return null;
  }

  const startTime =
    normalizeTime(
      rangeMatch[1],
      rangeMatch[2],
    );

  const endTime =
    normalizeTime(
      rangeMatch[3],
      rangeMatch[4],
    );

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

function getFileExtension(
  fileName: string,
): string {
  const fileNameParts =
    fileName
      .toLowerCase()
      .split('.');

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

function validateFile(
  file: File,
): void {
  if (!file) {
    throw new Error(
      'לא נבחר קובץ לייבוא.',
    );
  }

  const extension =
    getFileExtension(
      file.name,
    );

  if (
    !SUPPORTED_FILE_EXTENSIONS.has(
      extension,
    )
  ) {
    throw new Error(
      'יש לבחור קובץ Excel מסוג XLSX, XLS או XLSM.',
    );
  }

  if (file.size === 0) {
    throw new Error(
      'קובץ האקסל ריק.',
    );
  }

  if (
    file.size >
    MAX_FILE_SIZE_BYTES
  ) {
    throw new Error(
      'קובץ האקסל גדול מדי. הגודל המרבי הוא 15MB.',
    );
  }
}

function isScheduleHeaderRow(
  row: RawWorksheetRow,
): boolean {
  const normalizedCells =
    row.map(
      normalizeHeaderText,
    );

  const hasDispatcherHeader =
    normalizedCells.some(
      (cellValue) =>
        cellValue.includes(
          'מוקדן',
        ),
    );

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

function findHeaderRowIndex(
  rows: RawWorksheetRow[],
): number {
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
    const row =
      rows[rowIndex] ??
      [];

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

function findScheduleSheet(
  workbook:
    XLSX.WorkBook,
): ParsedScheduleSheet {
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

    const headerRowIndex =
      findHeaderRowIndex(
        rows,
      );

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

function getYearAndMonth(
  dateKey: string,
): {
  year: number;
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

function parseScheduleRows(
  parsedSheet:
    ParsedScheduleSheet,
): ScheduleImportPreview {
  const dispatcherShifts:
    ImportedDispatcherShift[] =
    [];

  const driverDutiesByDate =
    new Map<
      string,
      ImportedDriverDuty
    >();

  const dispatcherShiftKeys =
    new Set<string>();

  const warnings:
    string[] = [];

  const detectedPeriods =
    new Set<string>();

  let skippedRows = 0;

  let currentDate:
    string | null =
    null;

  let currentDriverName =
    '';

  let currentDayNote:
    string | null =
    null;

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
      const excelRowNumber =
        parsedSheet.headerRowIndex +
        relativeRowIndex +
        2;

      const parsedDate =
        parseExcelDate(
          row[
            COLUMN_INDEX.date
          ],
        );

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
      if (!dispatcherName) {
        return;
      }

      if (!currentDate) {
        skippedRows += 1;

        warnings.push(
          `שורה ${excelRowNumber}: נמצא מוקדן ללא תאריך תקין.`,
        );

        return;
      }

      const shiftRange =
        parseShiftRange(
          row[
            COLUMN_INDEX
              .shiftHours
          ],
        );

      if (!shiftRange) {
        skippedRows += 1;

        warnings.push(
          `שורה ${excelRowNumber}: לא ניתן לזהות את שעות המשמרת של ${dispatcherName}.`,
        );

        return;
      }

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

      const dispatcherShiftKey =
        createDispatcherShiftKey(
          dispatcherShift,
        );

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
      const dateComparison =
        firstShift.date.localeCompare(
          secondShift.date,
        );

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

  if (
    detectedPeriods.size ===
    0
  ) {
    throw new Error(
      'לא נמצאו בקובץ תאריכים תקינים.',
    );
  }

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

  const year =
    Number(
      firstYearText,
    );

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
    skippedRows,
    warnings,
  };
}

async function analyzeScheduleWorkbook(
  file: File,
): Promise<ScheduleImportPreview> {
  validateFile(file);

  let fileBuffer:
    ArrayBuffer;

  try {
    fileBuffer =
      await file.arrayBuffer();
  } catch {
    throw new Error(
      'לא ניתן היה לקרוא את קובץ האקסל.',
    );
  }

  let workbook:
    XLSX.WorkBook;

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
    );
  }

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

  return parseScheduleRows(
    parsedSheet,
  );
}

export const scheduleImportService = {
  analyzeScheduleWorkbook,
};