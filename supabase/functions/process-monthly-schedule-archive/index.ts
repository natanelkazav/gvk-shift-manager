import ExcelJS from 'npm:exceljs@4.4.0';

import {
  createClient,
} from 'npm:@supabase/supabase-js@2';

import {
  scheduleExportTemplateBase64,
} from './templateBase64.ts';

const archiveSubject =
  'GVK_MONTHLY_TEAMS_ARCHIVE';

const TEMPLATE_SHEET_NAME =
  'לוח זמנים ריק לכוננים';

const FIRST_DATA_ROW = 2;
const ROWS_PER_DAY = 3;
const MAX_DAYS = 31;

const LAST_TEMPLATE_ROW =
  FIRST_DATA_ROW +
  MAX_DAYS *
    ROWS_PER_DAY -
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

interface ProfileRow {
  id: string;
  display_name:
    string | null;
  schedule_name:
    string | null;
}

interface DispatcherShiftRow {
  id: string;
  shift_date: string;
  starts_at: string;
  ends_at: string;
  is_premium: boolean;
  holiday_name:
    string | null;
  assigned_user_id:
    string | null;
}

interface DriverDayRow {
  duty_date: string;
  assigned_user_id:
    string | null;
}

interface MorningAssignmentRow {
  availability_shift_id: string;
  assignment_slot: number;
  assigned_user_id:
    string | null;
}

interface MorningAvailabilityShiftRow {
  id: string;
  shift_date: string;
  start_time: string;
  end_time: string;
}

interface ExportDispatcherShift {
  shiftDate: string;
  startsAt: string;
  endsAt: string;
  isPremium: boolean;
  holidayName:
    string | null;
  assignedUserName:
    string | null;
}

interface ExportDriverDay {
  dutyDate: string;
  assignedUserName:
    string | null;
}

interface ExportMorningAssignment {
  shiftDate: string;
  startTime: string;
  endTime: string;
  assignmentSlot: number;
  assignedUserName:
    string | null;
}

interface DayRowDefinition {
  dispatcherHours: string;
  morningDriverHours: string;
}

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

function requiredEnv(
  name: string,
): string {
  const value =
    Deno.env
      .get(
        name,
      )
      ?.trim();

  if (!value) {
    throw new Error(
      `Missing environment variable: ${name}`,
    );
  }

  return value;
}

function padNumber(
  value: number,
): string {
  return String(value)
    .padStart(
      2,
      '0',
    );
}

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

function getIsraelMonth():
  {
    year: number;
    month: number;
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

function normalizeTime(
  value:
    string | null,
): string | null {
  if (!value) {
    return null;
  }

  const trimmed =
    value.trim();

  const plainMatch =
    trimmed.match(
      /^(\d{1,2}):(\d{2})/,
    );

  if (plainMatch) {
    return `${padNumber(
      Number(
        plainMatch[1],
      ),
    )}:${plainMatch[2]}`;
  }

  const date =
    new Date(
      trimmed,
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
    .format(
      date,
    )
    .replace(
      /\s/g,
      '',
    );
}

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

  if (
    !start ||
    !end
  ) {
    return null;
  }

  return `${start}-${end}`;
}

function getDayRows(
  weekdayNumber:
    number,
  weekendOrHoliday:
    boolean,
): DayRowDefinition[] {
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

function getTemplateSourceRow(
  weekdayNumber:
    number,
  rowOffset:
    number,
  weekendOrHoliday:
    boolean,
): number {
  if (
    weekdayNumber === 6 ||
    weekendOrHoliday
  ) {
    return 2 +
      rowOffset;
  }

  if (
    weekdayNumber === 5
  ) {
    return 20 +
      rowOffset;
  }

  return 5 +
    rowOffset;
}

function deepClone<T>(
  value: T,
): T {
  return JSON.parse(
    JSON.stringify(
      value,
    ),
  ) as T;
}

function copyTemplateRowStyle(
  worksheet:
    ExcelJS.Worksheet,
  sourceRowNumber:
    number,
  targetRowNumber:
    number,
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

function hideUnusedRows(
  worksheet:
    ExcelJS.Worksheet,
  daysInMonth:
    number,
): void {
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

function createFileName(
  year: number,
  month: number,
): string {
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
  const uniqueIds =
    Array.from(
      new Set(
        userIds.filter(
          Boolean,
        ),
      ),
    );

  if (
    uniqueIds.length ===
      0
  ) {
    return new Map();
  }

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

interface DynamicPublishedAssignment {
  id: string;
  shift_date: string;
  shift_code: string | null;
  shift_name: string | null;
  start_time: string;
  end_time: string;
  user_id: string | null;
  slot_id: string | null;
}

/** The export is intentionally restricted to the three original Teams columns. */
async function loadMonthData(
  adminClient: ReturnType<typeof createClient>,
  year: number,
  month: number,
): Promise<{
  dispatcherShifts: ExportDispatcherShift[];
  driverDays: ExportDriverDay[];
  morningAssignments: ExportMorningAssignment[];
}> {
  // Resolve the *published* dynamic job types for this month, rather than
  // legacy_role codes. The manual export panel also excludes legacy roles.
  const { data: publications, error: publicationsError } = await adminClient
    .from('dynamic_schedule_publications')
    .select('id, job_type_id, status, config_snapshot')
    .eq('year', year)
    .eq('month', month)
    .in('status', ['published', 'archived']);
  if (publicationsError) throw publicationsError;

  const { data: jobs, error: jobsError } = await adminClient
    .from('job_types')
    .select('id, name, code, legacy_role');
  if (jobsError) throw jobsError;
  const jobById = new Map((jobs ?? []).map((job) => [job.id, job]));

  type ArchiveRole = 'dispatcher' | 'on_call' | 'morning_driver';
  const candidates: Record<ArchiveRole, Array<{ id: string; job_type_id: string }>> = {
    dispatcher: [], on_call: [], morning_driver: [],
  };
  for (const publication of publications ?? []) {
    const job = jobById.get(publication.job_type_id);
    // Never silently export a legacy job type or an orphaned publication.
    if (!job || job.legacy_role) continue;
    const snapshot = publication.config_snapshot as {
      jobType?: { shiftPattern?: { workMode?: unknown } };
    } | null;
    const mode = snapshot?.jobType?.shiftPattern?.workMode;
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
  const selected = roles.map((role) => {
    const matching = candidates[role];
    if (matching.length !== 1) {
      throw new Error(
        `לא ניתן לזהות פרסום יחיד עבור ${labels[role]} בחודש ${month}/${year}: נמצאו ${matching.length}. ` +
        'יש לבדוק את סוגי התפקידים והפרסומים; לא נבחר לוח באופן אוטומטי.'
      );
    }
    return matching[0];
  });

  const results = await Promise.all(selected.map((publication) =>
    adminClient
      .from('dynamic_schedule_published_assignments')
      .select('id, shift_date, shift_code, shift_name, start_time, end_time, user_id, slot_id')
      .eq('publication_id', publication.id)
      .order('shift_date')
      .order('start_time')
  ));
  for (const result of results) if (result.error) throw result.error;
  const [dispatchers, drivers, mornings] = results.map((result) =>
    (result.data ?? []) as DynamicPublishedAssignment[]
  );
  if (!dispatchers.length || !drivers.length || !mornings.length) {
    throw new Error('אחד הלוחות המפורסמים ריק; הארכיון נעצר כדי לא לשלוח קובץ חסר.');
  }

  const profileMap = await loadProfileMap(adminClient, [
    ...dispatchers, ...drivers, ...mornings,
  ].map((row) => row.user_id ?? ''));
  const getName = (id: string | null) => id ? profileMap.get(id) ?? null : null;

  // Published assignments are the authoritative edited assignments, not rotation seeds.
  const dispatcherShifts: ExportDispatcherShift[] = dispatchers.map((row) => ({
    shiftDate: row.shift_date,
    startsAt: row.start_time,
    endsAt: row.end_time,
    isPremium: false,
    holidayName: null,
    assignedUserName: getName(row.user_id),
  }));

  // Preserve premium / holiday formatting using the original availability slot snapshot.
  const slotIds = Array.from(new Set(dispatchers.map((row) => row.slot_id).filter((id): id is string => !!id)));
  if (dispatchers.some((row) => !row.slot_id)) {
    throw new Error('חלק ממשמרות המוקדנים חסרות מזהה משמרת מקורית; לא ניתן לאמת רכיבי 200%.');
  }
  if (slotIds.length) {
    const { data: slots, error: slotsError } = await adminClient
      .from('dynamic_availability_slots')
      .select('id, holiday_name, pay_segments_snapshot')
      .in('id', slotIds);
    if (slotsError) throw slotsError;
    const slotMap = new Map((slots ?? []).map((slot) => [slot.id, slot]));
    dispatchers.forEach((row, index) => {
      const slot = row.slot_id ? slotMap.get(row.slot_id) : null;
      dispatcherShifts[index].holidayName = slot?.holiday_name ?? null;
      if (!slot) {
        throw new Error(`לא נמצאו נתוני משמרת מקוריים עבור ${row.shift_date} (${row.slot_id ?? 'ללא מזהה משמרת'}).`);
      }
      const segments: unknown = slot.pay_segments_snapshot;
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

  const driverByDate = new Map<string, string | null>();
  for (const row of drivers) {
    if (driverByDate.has(row.shift_date) && driverByDate.get(row.shift_date) !== row.user_id) {
      throw new Error(`נמצאו שני כוננים שונים בתאריך ${row.shift_date}; התבנית תומכת בכונן אחד בלבד.`);
    }
    driverByDate.set(row.shift_date, row.user_id);
  }
  const driverDays: ExportDriverDay[] = [...driverByDate].map(([dutyDate, userId]) => ({
    dutyDate,
    assignedUserName: getName(userId),
  }));

  const morningBySlot = new Map<string, number>();
  const morningAssignments: ExportMorningAssignment[] = mornings.map((row) => {
    const key = `${row.shift_date}|${createShiftRange(row.start_time, row.end_time)}`;
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
  for (const row of dispatcherShifts) {
    const day = new Date(`${row.shiftDate}T12:00:00Z`).getUTCDay();
    const ranges = [
      ...getDayRows(day, false), ...getDayRows(day, true),
    ].map((item) => item.dispatcherHours);
    if (!ranges.includes(createShiftRange(row.startsAt, row.endsAt) ?? '')) {
      throw new Error(`משמרת מוקדן ${row.shiftDate} ${row.startsAt}-${row.endsAt} אינה תואמת לתבנית Teams.`);
    }
  }
  for (const row of morningAssignments) {
    const day = new Date(`${row.shiftDate}T12:00:00Z`).getUTCDay();
    const ranges = [
      ...getDayRows(day, false), ...getDayRows(day, true),
    ].map((item) => item.morningDriverHours);
    if (!ranges.includes(createShiftRange(row.startTime, row.endTime) ?? '')) {
      throw new Error(`משמרת כונן בוקר ${row.shiftDate} ${row.startTime}-${row.endTime} אינה תואמת לתבנית Teams.`);
    }
  }

  return { dispatcherShifts, driverDays, morningAssignments };
}

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
  fileName: string;
  fileBase64: string;
}> {
  const workbook =
    new ExcelJS
      .Workbook();

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

  if (
    !worksheet
  ) {
    throw new Error(
      'גיליון תבנית הייצוא לא נמצא.',
    );
  }

  const dispatcherMap =
    new Map<
      string,
      ExportDispatcherShift
    >();

  const shiftsByDate =
    new Map<
      string,
      ExportDispatcherShift[]
    >();

  const holidayNotes =
    new Map<
      string,
      Set<string>
    >();

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

    const key =
      `${assignment.shiftDate}|${range}`;

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

  const morningMap =
    new Map<
      string,
      string
    >();

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

    const dateKey =
      createDateKey(
        year,
        month,
        day,
      );

    const dayShifts =
      shiftsByDate.get(
        dateKey,
      ) ??
      [];

    const weekendOrHoliday =
      hasWeekendOrHolidayLayout(
        dayShifts,
      );

    const firstRow =
      FIRST_DATA_ROW +
      (
        day - 1
      ) *
        ROWS_PER_DAY;

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

    const lastNoteRow =
      firstRow +
      ROWS_PER_DAY -
      1;

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

  const responseText =
    await response
      .text();

  if (
    !response.ok
  ) {
    throw new Error(
      `Resend failed (${response.status}): ${responseText}`,
    );
  }

  try {
    const responseBody =
      JSON.parse(
        responseText,
      ) as {
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


const archiveDynamicPublications = async (
  adminClient: ReturnType<typeof createClient>,
  year: number,
  month: number,
) => {
  const archivedAt = new Date().toISOString();
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

      const israelDate =
        getIsraelMonth();

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

  const previousMonthDate =
    new Date(
      Date.UTC(
        israelDate.year,
        israelDate.month - 2,
        1,
      ),
    );

  const year =
    previousMonthDate
      .getUTCFullYear();

  const month =
    previousMonthDate
      .getUTCMonth() +
      1;

      const supabaseUrl =
        requiredEnv(
          'SUPABASE_URL',
        );

      const serviceRoleKey =
        requiredEnv(
          'SUPABASE_SERVICE_ROLE_KEY',
        );

      const resendApiKey =
        requiredEnv(
          'RESEND_API_KEY',
        );

      const fromEmail =
        requiredEnv(
          'RESEND_FROM_EMAIL',
        );

      const recipientEmail =
        requiredEnv(
          'SCHEDULE_ARCHIVE_RECIPIENT_EMAIL',
        );

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

      if (
        existingError
      ) {
        throw existingError;
      }

      if (
        existingRun
          ?.status ===
          'sent'
      ) {
        const dynamicArchive = await archiveDynamicPublications(adminClient, year, month);
        return jsonResponse({
          skipped: true, reason: 'already_sent', year, month,
          emailId: existingRun.email_id, sentAt: existingRun.sent_at, dynamicArchive,
        });
      }

      let runId:
        string;

      if (
        existingRun
      ) {
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

        if (
          insertError ||
          !insertedRun
        ) {
          /*
           * אם שתי ריצות הגיעו יחד, ה-unique
           * על year/month ימנע כפילות.
           */
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

      try {
        const monthData =
          await loadMonthData(
            adminClient,
            year,
            month,
          );

        const {
          fileName,
          fileBase64,
        } =
          await createWorkbook(
            year,
            month,
            monthData,
          );

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

        const dynamicArchive = await archiveDynamicPublications(adminClient, year, month);

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
