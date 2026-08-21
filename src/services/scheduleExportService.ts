import * as XLSX
  from 'xlsx';

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

interface DayRowDefinition {
  dispatcherHours: string;
  morningDriverHours: string;
}

interface StyledCell
  extends XLSX.CellObject {
  s?: unknown;
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

function getExcelDateSerial(
  year: number,
  month: number,
  day: number,
): number {
  return (
    Date.UTC(
      year,
      month - 1,
      day,
    ) /
      86_400_000 +
    25_569
  );
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
): DayRowDefinition[] {
  if (
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
): number {
  if (weekdayNumber === 6) {
    return 2 + rowOffset;
  }

  if (weekdayNumber === 5) {
    return 20 + rowOffset;
  }

  return 5 + rowOffset;
}

function cloneStyle(
  value: unknown,
): unknown {
  if (
    value === null ||
    value === undefined
  ) {
    return value;
  }

  return JSON.parse(
    JSON.stringify(value),
  ) as unknown;
}

function copyTemplateRowStyle(
  worksheet: XLSX.WorkSheet,
  sourceRow: number,
  targetRow: number,
): void {
  for (
    let columnIndex = 0;
    columnIndex < 8;
    columnIndex += 1
  ) {
    const sourceAddress =
      XLSX.utils.encode_cell({
        r:
          sourceRow - 1,
        c:
          columnIndex,
      });

    const targetAddress =
      XLSX.utils.encode_cell({
        r:
          targetRow - 1,
        c:
          columnIndex,
      });

    const sourceCell =
      worksheet[
        sourceAddress
      ] as StyledCell | undefined;

    const targetCell =
      worksheet[
        targetAddress
      ] as StyledCell | undefined;

    if (!targetCell) {
      worksheet[
        targetAddress
      ] = {
        t: 's',
        v: '',
      } satisfies StyledCell;
    }

    const ensuredTargetCell =
      worksheet[
        targetAddress
      ] as StyledCell;

    ensuredTargetCell.s =
      cloneStyle(
        sourceCell?.s,
      );

    if (
      sourceCell?.z
    ) {
      ensuredTargetCell.z =
        sourceCell.z;
    }
  }

  const rows =
    worksheet['!rows'] ??
    [];

  worksheet['!rows'] =
    rows;

  const sourceRowInfo =
    rows[
      sourceRow - 1
    ];

  rows[
    targetRow - 1
  ] = sourceRowInfo
    ? {
        ...sourceRowInfo,
        hidden: false,
      }
    : {
        hidden: false,
      };
}

function setCellValue(
  worksheet: XLSX.WorkSheet,
  address: string,
  value:
    | string
    | number
    | null,
  type:
    's' | 'n' = 's',
): void {
  const cell =
    (
      worksheet[
        address
      ] ?? {
        t: type,
        v:
          value ?? '',
      }
    ) as StyledCell;

  if (
    value === null
  ) {
    cell.t = 's';
    cell.v = '';
  } else {
    cell.t = type;
    cell.v = value;
  }

  worksheet[
    address
  ] = cell;
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

      if (
        !holidayName
      ) {
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
        ).join(
          ' / ',
        ),
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

function copyCellStyle(
  worksheet: XLSX.WorkSheet,
  sourceAddress: string,
  targetAddress: string,
): void {
  const sourceCell =
    worksheet[
      sourceAddress
    ] as StyledCell | undefined;

  const targetCell =
    (
      worksheet[
        targetAddress
      ] ?? {
        t: 's',
        v: '',
      }
    ) as StyledCell;

  targetCell.s =
    cloneStyle(
      sourceCell?.s,
    );

  if (sourceCell?.z) {
    targetCell.z =
      sourceCell.z;
  }

  worksheet[
    targetAddress
  ] = targetCell;
}

function applyShiftHourStyle(
  worksheet: XLSX.WorkSheet,
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

  copyCellStyle(
    worksheet,
    `C${sourceRow}`,
    `C${row}`,
  );

  copyCellStyle(
    worksheet,
    `E${sourceRow}`,
    `E${row}`,
  );
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

function setExportDate(
  worksheet: XLSX.WorkSheet,
  address: string,
  year: number,
  month: number,
  day: number,
): void {
  setCellValue(
    worksheet,
    address,
    getExcelDateSerial(
      year,
      month,
      day,
    ),
    'n',
  );

  const cell =
    worksheet[
      address
    ] as StyledCell;

  cell.z =
    'dd/mm/yyyy';
}

function clearTemplateValues(
  worksheet: XLSX.WorkSheet,
): void {
  for (
    let row = FIRST_DATA_ROW;
    row <= LAST_TEMPLATE_ROW;
    row += 1
  ) {
    for (
      let column = 0;
      column < 8;
      column += 1
    ) {
      setCellValue(
        worksheet,
        XLSX.utils.encode_cell({
          r: row - 1,
          c: column,
        }),
        null,
      );
    }
  }
}

function hideUnusedRows(
  worksheet: XLSX.WorkSheet,
  daysInMonth: number,
): void {
  const firstUnusedRow =
    FIRST_DATA_ROW +
    daysInMonth *
      ROWS_PER_DAY;

  const rows =
    worksheet['!rows'] ??
    [];

  worksheet['!rows'] =
    rows;

  for (
    let row = FIRST_DATA_ROW;
    row <= LAST_TEMPLATE_ROW;
    row += 1
  ) {
    rows[row - 1] = {
      ...(rows[row - 1] ?? {}),
      hidden:
        row >=
        firstUnusedRow,
    };
  }
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
  Promise<XLSX.WorkBook> {
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
    await response.arrayBuffer();

  return XLSX.read(
    arrayBuffer,
    {
      type: 'array',
      cellStyles: true,
      cellDates: false,
    },
  );
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

class ScheduleExportService {
  async exportMonth(
    year: number,
    month: number,
  ): Promise<ScheduleExportResult> {
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
      workbook.Sheets[
        TEMPLATE_SHEET_NAME
      ];

    if (!worksheet) {
      throw new Error(
        'גיליון התבנית הנדרש לא נמצא בקובץ.',
      );
    }

    const dispatcherMap =
      createDispatcherMap(
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

    setCellValue(
      worksheet,
      'H1',
      'הערות',
    );

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

      const firstRow =
        FIRST_DATA_ROW +
        (day - 1) *
          ROWS_PER_DAY;

      const rows =
        getDayRows(
          weekdayNumber,
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
            ),
            targetRow,
          );

          setCellValue(
            worksheet,
            `C${targetRow}`,
            rowDefinition
              .dispatcherHours,
          );

          const dispatcherShift =
            dispatcherMap.get(
              `${dateKey}|${rowDefinition.dispatcherHours}`,
            );

          setCellValue(
            worksheet,
            `D${targetRow}`,
            dispatcherShift
              ?.assignedUserName ??
              null,
          );

          setCellValue(
            worksheet,
            `E${targetRow}`,
            rowDefinition
              .morningDriverHours,
          );

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

          setCellValue(
            worksheet,
            `F${targetRow}`,
            morningDriverMap.get(
              `${dateKey}|${rowDefinition.morningDriverHours}`,
            ) ??
              null,
          );
        },
      );

      setExportDate(
        worksheet,
        `A${firstRow}`,
        year,
        month,
        day,
      );

      setCellValue(
        worksheet,
        `B${firstRow}`,
        hebrewWeekdays[
          weekdayNumber
        ] ??
          '',
      );

      const driverDuty =
        driverMap.get(
          dateKey,
        );

      setCellValue(
        worksheet,
        `G${firstRow}`,
        driverDuty
          ?.assignedUserName ??
          null,
      );

      const holidayNote =
        holidayNoteMap.get(
          dateKey,
        ) ??
        null;

      const driverNote =
        driverDuty?.notes
          ?.trim() ??
        null;

      const dayNote =
        [
          holidayNote,
          driverNote,
        ]
          .filter(
            (
              value,
            ): value is string =>
              Boolean(
                value,
              ),
          )
          .filter(
            (
              value,
              index,
              values,
            ) =>
              values.indexOf(
                value,
              ) ===
              index,
          )
          .join(
            ' / ',
          ) ||
        null;

      setCellValue(
        worksheet,
        `H${firstRow}`,
        dayNote,
      );
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

    XLSX.writeFile(
      workbook,
      fileName,
      {
        bookType: 'xlsx',
        cellStyles: true,
        compression: true,
      },
    );

    return {
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
    };
  }
}

export const scheduleExportService =
  new ScheduleExportService();

export type {
  ScheduleExportResult,
};
