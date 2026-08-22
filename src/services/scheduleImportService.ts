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

interface ExpectedImportPeriod {
  year: number;
  month: number;
  source:
    | 'file_name'
    | 'dominant_dates';
}

interface ParsedImportDate {
  dateKey: string | null;
  wasCorrected: boolean;
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
  morningDriverHours: 4,
  morningDriverNames: 5,
  driverName: 6,
  note: 7,
} as const;

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


function parseYearFromFileName(
  value: string,
): number | null {
  const numericYear =
    Number(value);

  if (
    !Number.isInteger(
      numericYear,
    )
  ) {
    return null;
  }

  if (
    numericYear >= 2000 &&
    numericYear <= 2100
  ) {
    return numericYear;
  }

  if (
    numericYear >= 0 &&
    numericYear <= 99
  ) {
    return 2000 +
      numericYear;
  }

  return null;
}

function detectPeriodFromFileName(
  fileName: string,
): ExpectedImportPeriod | null {
  const normalizedFileName =
    normalizeText(
      fileName,
    )
      .replace(
        /[_-]+/g,
        ' ',
      );

  for (
    const [
      monthName,
      monthNumber,
    ] of Object.entries(
      HEBREW_MONTH_NUMBERS,
    )
  ) {
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

  if (!numericMatch) {
    return null;
  }

  const year =
    parseYearFromFileName(
      numericMatch[2],
    );

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

function detectDominantPeriod(
  parsedSheet:
    ParsedScheduleSheet,
): ExpectedImportPeriod | null {
  const periodCounts =
    new Map<string, number>();

  const dataRows =
    parsedSheet.rows.slice(
      parsedSheet.headerRowIndex +
        1,
    );

  dataRows.forEach(
    (row) => {
      const parsedDate =
        parseExcelDate(
          row[
            COLUMN_INDEX.date
          ],
        );

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

function parseImportDate(
  value: RawCellValue,
  expectedPeriod:
    ExpectedImportPeriod | null,
): ParsedImportDate {
  const parsedDate =
    parseExcelDate(
      value,
    );

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

  const year =
    Number(yearText);

  const month =
    Number(monthText);

  const day =
    Number(dayText);

  const isExcelDateCell =
    value instanceof Date ||
    (
      typeof value ===
        'number' &&
      Number.isFinite(
        value,
      )
    );

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

  const correctedDate =
    formatDateKey(
      expectedPeriod.year,
      expectedPeriod.month,
      month,
    );

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


function splitMorningDriverNames(
  value: RawCellValue,
): string[] {
  const normalizedValue =
    normalizeText(
      value,
    );

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

function getMorningDriverShiftType(
  shiftRange:
    ParsedShiftRange,
): ImportedMorningDriverShiftType | null {
  const shiftKey =
    `${shiftRange.startTime}-${shiftRange.endTime}`;

  /*
   * לוחות היסטוריים השתמשו גם ב-06:00-15:00,
   * בעוד שהמבנה הנוכחי הוא 06:00-16:00.
   * שתי התבניות מייצגות את משמרת הבוקר של א'-ה'.
   */
  if (
    shiftKey ===
      '06:00-16:00' ||
    shiftKey ===
      '06:00-15:00'
  ) {
    return 'weekday_morning';
  }

  if (
    shiftKey ===
      '15:00-23:00' ||
    shiftKey ===
      '16:00-23:00'
  ) {
    return 'weekday_evening';
  }

  if (
    shiftKey ===
      '06:00-14:00'
  ) {
    return 'friday_morning';
  }

  return null;
}

function getMorningDriverStaffing(
  shiftType:
    ImportedMorningDriverShiftType,
): {
  minimumWorkers: number;
  recommendedWorkers: number;
} {
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
  expectedPeriod:
    ExpectedImportPeriod | null,
): Omit<
  ScheduleImportPreview,
  'periodType'
> {
  const dispatcherShifts:
    ImportedDispatcherShift[] =
    [];

  const driverDutiesByDate =
    new Map<
      string,
      ImportedDriverDuty
    >();

  const morningDriverShifts:
    ImportedMorningDriverShift[] =
    [];

  const dispatcherShiftKeys =
    new Set<string>();

  const morningDriverShiftKeys =
    new Set<string>();

  const warnings:
    string[] = [];

  const detectedPeriods =
    new Set<string>();

  let skippedRows = 0;

  let correctedDateCount = 0;

  let legacyMorningHoursCount = 0;

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

      const parsedImportDate =
        parseImportDate(
          row[
            COLUMN_INDEX.date
          ],
          expectedPeriod,
        );

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

                    const shiftKey =
                      createMorningDriverShiftKey(
                        importedShift,
                      );

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


  morningDriverShifts.sort(
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

      const startTimeComparison =
        firstShift.startTime.localeCompare(
          secondShift.startTime,
        );

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

  if (
    morningDriverShifts.length ===
    0
  ) {
    warnings.push(
      'לא זוהו שיבוצי כונני בוקר בעמודות E ו-F.',
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
    morningDriverShifts,
    skippedRows,
    warnings,
  };
}
function getImportPeriodType(
  year: number,
  month: number,
): ScheduleImportPeriodType {
  const currentDate =
    new Date();

  const currentPeriodValue =
    currentDate.getFullYear() *
      12 +
    currentDate.getMonth();

  const importedPeriodValue =
    year * 12 +
    (month - 1);

  if (
    importedPeriodValue <
    currentPeriodValue
  ) {
    return 'historical';
  }

  if (
    importedPeriodValue ===
    currentPeriodValue
  ) {
    return 'current';
  }

  return 'future';
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

export const scheduleImportService = {
  analyzeScheduleWorkbook,
};