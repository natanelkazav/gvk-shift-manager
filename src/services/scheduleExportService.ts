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

const TEMPLATE_URL =
  '/templates/schedule-export-template.xlsx';

const TEMPLATE_SHEET_NAME =
  'לוח זמנים ריק לכוננים';

const FIRST_DATA_ROW = 2;
const ROWS_PER_DAY = 3;
const MAX_DAYS = 31;
const LAST_TEMPLATE_ROW =
  FIRST_DATA_ROW +
  MAX_DAYS * ROWS_PER_DAY -
  1;

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

const hebrewWeekdays = [
  'ראשון',
  'שני',
  'שלישי',
  'רביעי',
  'חמישי',
  'שישי',
  'שבת',
];

interface ScheduleExportResult {
  fileName: string;
  year: number;
  month: number;
  dispatcherShifts: number;
  driverDuties: number;
  morningDriverAssignments: number;
}

interface ScheduleExportFile {
  blob: Blob;
  result: ScheduleExportResult;
}

interface DayRowDefinition {
  dispatcherHours: string;
  morningDriverHours: string;
}

function padNumber(
  value: number,
): string {
  return String(value)
    .padStart(2, '0');
}

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

function normalizeTime(
  value: string | null,
): string | null {
  if (!value) {
    return null;
  }

  const trimmedValue =
    value.trim();

  const plainTimeMatch =
    trimmedValue.match(
      /^(\d{1,2}):(\d{2})/,
    );

  if (plainTimeMatch) {
    return `${padNumber(
      Number(
        plainTimeMatch[1],
      ),
    )}:${plainTimeMatch[2]}`;
  }

  const date =
    new Date(
      trimmedValue,
    );

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

function createShiftRange(
  startTime: string | null,
  endTime: string | null,
): string | null {
  const normalizedStart =
    normalizeTime(
      startTime,
    );

  const normalizedEnd =
    normalizeTime(
      endTime,
    );

  if (
    !normalizedStart ||
    !normalizedEnd
  ) {
    return null;
  }

  return `${normalizedStart}-${normalizedEnd}`;
}

function getDayRows(
  weekdayNumber: number,
  useWeekendOrHolidayLayout: boolean,
): DayRowDefinition[] {
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

function getTemplateSourceRow(
  weekdayNumber: number,
  rowOffset: number,
  useWeekendOrHolidayLayout: boolean,
): number {
  if (
    weekdayNumber === 6 ||
    useWeekendOrHolidayLayout
  ) {
    return 2 + rowOffset;
  }

  if (weekdayNumber === 5) {
    return 20 + rowOffset;
  }

  return 5 + rowOffset;
}

function deepClone<T>(
  value: T,
): T {
  return JSON.parse(
    JSON.stringify(value),
  ) as T;
}

function copyTemplateRowStyle(
  worksheet: ExcelJS.Worksheet,
  sourceRowNumber: number,
  targetRowNumber: number,
): void {
  const sourceRow =
    worksheet.getRow(
      sourceRowNumber,
    );

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
    const sourceCell =
      sourceRow.getCell(
        columnNumber,
      );

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

function createDispatcherMap(
  shifts:
    DispatcherScheduleMonthShift[],
): Map<
  string,
  DispatcherScheduleMonthShift
> {
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

function createDispatcherShiftsByDate(
  shifts:
    DispatcherScheduleMonthShift[],
): Map<
  string,
  DispatcherScheduleMonthShift[]
> {
  const map =
    new Map<
      string,
      DispatcherScheduleMonthShift[]
    >();

  shifts.forEach(
    (
      shift,
    ) => {
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

function createHolidayNoteMap(
  shifts:
    DispatcherScheduleMonthShift[],
): Map<string, string> {
  const notesByDate =
    new Map<
      string,
      Set<string>
    >();

  shifts.forEach(
    (
      shift,
    ) => {
      const holidayName =
        shift.holidayName
          ?.trim();

      if (!holidayName) {
        return;
      }

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

function createDriverMap(
  days:
    DriverScheduleDay[],
): Map<
  string,
  DriverScheduleDay
> {
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

function createMorningDriverMap(
  assignments:
    MorningDriverScheduleAssignment[],
): Map<string, string> {
  const groupedAssignments =
    new Map<
      string,
      MorningDriverScheduleAssignment[]
    >();

  assignments.forEach(
    (
      assignment,
    ) => {
      if (
        !assignment.assignedUserName
      ) {
        return;
      }

      const range =
        createShiftRange(
          assignment.startTime,
          assignment.endTime,
        );

      if (!range) {
        return;
      }

      const key =
        `${assignment.shiftDate}|${range}`;

      const current =
        groupedAssignments.get(
          key,
        ) ?? [];

      current.push(
        assignment,
      );

      groupedAssignments.set(
        key,
        current,
      );
    },
  );

  const result =
    new Map<
      string,
      string
    >();

  groupedAssignments.forEach(
    (
      values,
      key,
    ) => {
      const names =
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
              value.assignedUserName,
          )
          .filter(
            (
              value,
            ): value is string =>
              Boolean(value),
          );

      result.set(
        key,
        Array.from(
          new Set(names),
        ).join('/'),
      );
    },
  );

  return result;
}

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

function copyFill(
  worksheet: ExcelJS.Worksheet,
  sourceAddress: string,
  targetAddress: string,
): void {
  const sourceCell =
    worksheet.getCell(
      sourceAddress,
    );

  const targetCell =
    worksheet.getCell(
      targetAddress,
    );

  targetCell.fill =
    deepClone(
      sourceCell.fill,
    );
}

function applyShiftHourStyle(
  worksheet: ExcelJS.Worksheet,
  row: number,
  isPremium: boolean,
  isNight: boolean,
): void {
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

function hideUnusedRows(
  worksheet: ExcelJS.Worksheet,
  daysInMonth: number,
): void {
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

  if (
    missing.length > 0
  ) {
    throw new Error(
      `לא ניתן לייצא לפני שכל הלוחות פורסמו. חסר פרסום עבור: ${missing.join(', ')}.`,
    );
  }
}

async function loadTemplate():
  Promise<ExcelJS.Workbook> {
  const response =
    await fetch(
      TEMPLATE_URL,
      {
        cache:
          'no-store',
      },
    );

  if (!response.ok) {
    throw new Error(
      'לא ניתן היה לטעון את תבנית קובץ האקסל.',
    );
  }

  const arrayBuffer =
    await response
      .arrayBuffer();

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

function createFileName(
  year: number,
  month: number,
): string {
  const monthName =
    hebrewMonths[
      month - 1
    ] ??
    padNumber(month);

  const shortYear =
    padNumber(
      year % 100,
    );

  return `לוח שיבוצים ${monthName} ${shortYear}.xlsx`;
}

async function createWorkbookBlob(
  workbook: ExcelJS.Workbook,
): Promise<Blob> {
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

function downloadWorkbookBlob(
  blob: Blob,
  fileName: string,
): void {
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

class ScheduleExportService {
  async createMonthFile(
    year: number,
    month: number,
  ): Promise<ScheduleExportFile> {
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

    if (!worksheet) {
      throw new Error(
        'גיליון התבנית הנדרש לא נמצא בקובץ.',
      );
    }

    const dispatcherMap =
      createDispatcherMap(
        dispatcherSchedule.shifts,
      );

    const dispatcherShiftsByDate =
      createDispatcherShiftsByDate(
        dispatcherSchedule.shifts,
      );

    const driverMap =
      createDriverMap(
        driverSchedule.days,
      );

    const holidayNoteMap =
      createHolidayNoteMap(
        dispatcherSchedule.shifts,
      );

    const morningDriverMap =
      createMorningDriverMap(
        morningDriverSchedule
          .assignments,
      );

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

      const dateKey =
        createDateKey(
          year,
          month,
          day,
        );

      const dayDispatcherShifts =
        dispatcherShiftsByDate.get(
          dateKey,
        ) ?? [];

      const weekendOrHolidayLayout =
        hasWeekendOrHolidayDispatcherLayout(
          dayDispatcherShifts,
        );

      const firstRow =
        FIRST_DATA_ROW +
        (day - 1) *
          ROWS_PER_DAY;

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

          worksheet.getCell(
            `E${targetRow}`,
          ).value =
            rowDefinition
              .morningDriverHours;

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
          ).value =
            morningDriverMap.get(
              `${dateKey}|${rowDefinition.morningDriverHours}`,
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

      worksheet.getCell(
        `B${firstRow}`,
      ).value =
        hebrewWeekdays[
          weekdayNumber
        ] ??
        '';

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
        wrapText: true,
        vertical: 'middle',
      };

      notesCell.value =
        holidayNote;
    }

    hideUnusedRows(
      worksheet,
      daysInMonth,
    );

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

  async exportMonth(
    year: number,
    month: number,
  ): Promise<ScheduleExportResult> {
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

export const scheduleExportService =
  new ScheduleExportService();

export type {
  ScheduleExportFile,
  ScheduleExportResult,
};
