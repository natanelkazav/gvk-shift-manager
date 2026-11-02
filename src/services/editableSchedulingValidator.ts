/**
 * קובץ: src/services/editableSchedulingValidator.ts
 * מטרה: זיהוי שיבוצים חסרים, זמינות חסרה, חפיפות ורצפים בטיוטה הניתנת לעריכה.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: EditableSchedulingValidationIssueType, EditableSchedulingValidationSeverity, EditableSchedulingValidationIssue, EditableSchedulingShiftValidation, EditableSchedulingValidationResult, ParsedShiftInterval, normalizeTime, parseTimeParts, createDateAtTime, createShiftInterval ועוד.
 * - ריכוז פעולות העיבוד והחישוב בהתאם לפונקציות להלן.
 */
import type {
  AssignmentCandidateShift,
  AssignmentCandidatesData,
} from '../types/assignmentCandidates';

import type {
  SchedulingAssignment,
} from '../types/autoScheduling';

/**
 * טיפוס EditableSchedulingValidationIssueType: אימות נתונים.
 */
export type EditableSchedulingValidationIssueType =
  | 'unassigned_shift'
  | 'dispatcher_unavailable'
  | 'overlapping_shifts'
  | 'consecutive_shifts'
  | 'invalid_shift_time'
  | 'unknown_shift'
  | 'unknown_dispatcher';

/**
 * טיפוס EditableSchedulingValidationSeverity: אימות נתונים.
 */
export type EditableSchedulingValidationSeverity =
  | 'error'
  | 'warning';

/**
 * חוזה הנתונים EditableSchedulingValidationIssue: אימות נתונים.
 */
export interface EditableSchedulingValidationIssue {
  // id — מזהה.
  id: string;

  type:
    EditableSchedulingValidationIssueType;

  severity:
    EditableSchedulingValidationSeverity;

  // shiftId — מזהה המשמרת.
  shiftId: string;

  // relatedShiftId — מזהה המשמרת.
  relatedShiftId:
    string | null;

  // userId — מזהה משתמש.
  userId:
    string | null;

  // message — הודעה.
  message: string;
}

/**
 * חוזה הנתונים EditableSchedulingShiftValidation: משמרת / אימות נתונים.
 */
export interface EditableSchedulingShiftValidation {
  // shiftId — מזהה המשמרת.
  shiftId: string;

  issues:
    EditableSchedulingValidationIssue[];

  // hasErrors — שגיאות.
  hasErrors: boolean;
  hasWarnings: boolean;
}

/**
 * חוזה הנתונים EditableSchedulingValidationResult: אימות נתונים / תוצאה.
 */
export interface EditableSchedulingValidationResult {
  issues:
    EditableSchedulingValidationIssue[];

  // shiftValidations — משמרת.
  shiftValidations:
    Record<
      string,
      EditableSchedulingShiftValidation
    >;

  // errorCount — שגיאה / כמות.
  errorCount: number;
  // warningCount — כמות.
  warningCount: number;

  // unassignedShiftCount — משמרת / כמות.
  unassignedShiftCount: number;
  // unavailableAssignmentCount — הקצאה / כמות.
  unavailableAssignmentCount: number;
  // overlapCount — כמות.
  overlapCount: number;
  // consecutiveShiftCount — משמרת / כמות.
  consecutiveShiftCount: number;

  isValid: boolean;
}

/**
 * חוזה הנתונים ParsedShiftInterval: משמרת / מרווח זמן.
 */
interface ParsedShiftInterval {
  // shift — משמרת.
  shift:
    AssignmentCandidateShift;

  // assignment — הקצאה.
  assignment:
    SchedulingAssignment;

  // startsAt — מועד התחלה.
  startsAt:
    Date;

  // endsAt — מועד סיום.
  endsAt:
    Date;
}

/**
 * פעולה normalizeTime: נרמול זמן.
 * @param value — ערך.
 * @returns string — הפלט בהתאם לחתימה.
 */
function normalizeTime(
  value: string,
): string {
  return value
    .trim()
    .slice(0, 5);
}

/**
 * פעולה parseTimeParts: פענוח קלט עבור זמן.
 * @param value — ערך.
 * @returns { hours: number; minutes: number; } | null — הפלט בהתאם לחתימה.
 */
function parseTimeParts(
  value: string,
): {
  // hours — שעות.
  hours: number;
  // minutes — דקות.
  minutes: number;
} | null {
  // normalizedValue — ערך.
  const normalizedValue =
    normalizeTime(value);

  const match =
    normalizedValue.match(
      /^(\d{1,2}):(\d{2})$/,
    );

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !match.
  if (!match) {
    return null;
  }

  // hours — שעות.
  const hours =
    Number(match[1]);

  // minutes — דקות.
  const minutes =
    Number(match[2]);

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !Number.isInteger(hours) || !Number.isInteger(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59.
  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }

  return {
    hours,
    minutes,
  };
}

/**
 * פעולה createDateAtTime: יצירת תאריך / זמן.
 * @param dateValue — תאריך / ערך.
 * @param timeValue — זמן / ערך.
 * @returns Date | null — הפלט בהתאם לחתימה.
 */
function createDateAtTime(
  dateValue: string,
  timeValue: string,
): Date | null {
  // timeParts — זמן.
  const timeParts =
    parseTimeParts(
      timeValue,
    );

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !timeParts.
  if (!timeParts) {
    return null;
  }

  // dateMatch — תאריך.
  const dateMatch =
    dateValue
      .trim()
      .match(
        /^(\d{4})-(\d{2})-(\d{2})$/,
      );

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !dateMatch.
  if (!dateMatch) {
    return null;
  }

  // year — שנה.
  const year =
    Number(dateMatch[1]);

  // month — חודש.
  const month =
    Number(dateMatch[2]);

  // day — יום.
  const day =
    Number(dateMatch[3]);

  // date — תאריך.
  const date =
    new Date(
      year,
      month - 1,
      day,
      timeParts.hours,
      timeParts.minutes,
      0,
      0,
    );

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר Number.isNaN( date.getTime(), ).
  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return null;
  }

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day.
  if (
    date.getFullYear() !== year ||
    date.getMonth() !==
      month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

/**
 * פעולה createShiftInterval: יצירת משמרת / מרווח זמן.
 * @param shift — משמרת.
 * @param assignment — הקצאה.
 * @returns ParsedShiftInterval | null — הפלט בהתאם לחתימה.
 */
function createShiftInterval(
  shift:
    AssignmentCandidateShift,

  assignment:
    SchedulingAssignment,
): ParsedShiftInterval | null {
  // startsAt — מועד התחלה.
  const startsAt =
    createDateAtTime(
      shift.date,
      shift.startTime,
    );

  // endsAt — מועד סיום.
  const endsAt =
    createDateAtTime(
      shift.date,
      shift.endTime,
    );

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !startsAt || !endsAt.
  if (
    !startsAt ||
    !endsAt
  ) {
    return null;
  }

  // adjustedEndsAt — מועד סיום.
  const adjustedEndsAt =
    new Date(
      endsAt.getTime(),
    );

  if (
    shift.endsNextDay ||
    adjustedEndsAt.getTime() <=
      startsAt.getTime()
  ) {
    adjustedEndsAt.setDate(
      adjustedEndsAt.getDate() + 1,
    );
  }

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר adjustedEndsAt.getTime() <= startsAt.getTime().
  if (
    adjustedEndsAt.getTime() <=
    startsAt.getTime()
  ) {
    return null;
  }

  return {
    shift,
    assignment,
    startsAt,
    endsAt:
      adjustedEndsAt,
  };
}

/**
 * פעולה createIssueId: יצירת מזהה.
 * @param type — הנתון type בהקשר הפעולה.
 * @param shiftId — מזהה המשמרת.
 * @param relatedShiftId — מזהה המשמרת.
 * @param userId — מזהה משתמש.
 * @returns string — הפלט בהתאם לחתימה.
 */
function createIssueId(
  type:
    EditableSchedulingValidationIssueType,

  shiftId: string,

  relatedShiftId:
    string | null,

  userId:
    string | null,
): string {
  return [
    type,
    shiftId,
    relatedShiftId ?? 'none',
    userId ?? 'none',
  ].join(':');
}

/**
 * פעולה createIssue: יצירת הנתון createIssue בהקשר הפעולה.
 * @param type — הנתון type בהקשר הפעולה.
 * @param severity — הנתון severity בהקשר הפעולה.
 * @param shiftId — מזהה המשמרת.
 * @param message — הודעה.
 * @param userId — מזהה משתמש.
 * @param relatedShiftId — מזהה המשמרת.
 * @returns EditableSchedulingValidationIssue — הפלט בהתאם לחתימה.
 */
function createIssue(
  type:
    EditableSchedulingValidationIssueType,

  severity:
    EditableSchedulingValidationSeverity,

  shiftId: string,

  message: string,

  userId:
    string | null = null,

  relatedShiftId:
    string | null = null,
): EditableSchedulingValidationIssue {
  return {
    id:
      createIssueId(
        type,
        shiftId,
        relatedShiftId,
        userId,
      ),

    type,
    severity,
    shiftId,
    relatedShiftId,
    userId,
    message,
  };
}

/**
 * פעולה formatShiftLabel: עיצוב ערך לתצוגה עבור משמרת / תווית.
 * @param shift — משמרת.
 * @returns string — הפלט בהתאם לחתימה.
 */
function formatShiftLabel(
  shift:
    AssignmentCandidateShift,
): string {
  return (
    `${shift.date} ` +
    `${normalizeTime(
      shift.startTime,
    )}–` +
    `${normalizeTime(
      shift.endTime,
    )}`
  );
}

/**
 * פעולה createEmptyShiftValidation: יצירת משמרת / אימות נתונים.
 * @param shiftId — מזהה המשמרת.
 * @returns EditableSchedulingShiftValidation — הפלט בהתאם לחתימה.
 */
function createEmptyShiftValidation(
  shiftId: string,
): EditableSchedulingShiftValidation {
  return {
    shiftId,
    issues: [],
    hasErrors: false,
    hasWarnings: false,
  };
}

/**
 * פעולה addIssueToShiftValidation: הוספת משמרת / אימות נתונים.
 * @param shiftValidations — משמרת.
 * @param issue — הנתון issue בהקשר הפעולה.
 * @returns void — הפלט בהתאם לחתימה.
 */
function addIssueToShiftValidation(
  shiftValidations:
    Record<
      string,
      EditableSchedulingShiftValidation
    >,

  issue:
    EditableSchedulingValidationIssue,
): void {
  if (
    !shiftValidations[
      issue.shiftId
    ]
  ) {
    shiftValidations[
      issue.shiftId
    ] =
      createEmptyShiftValidation(
        issue.shiftId,
      );
  }

  // validation — אימות נתונים.
  const validation =
    shiftValidations[
      issue.shiftId
    ];

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר validation.issues.some( (existingIssue) => existingIssue.id === issue.id, ).
  if (
    validation.issues.some(
      (existingIssue) =>
        existingIssue.id ===
        issue.id,
    )
  ) {
    return;
  }

  validation.issues.push(
    issue,
  );

  if (
    issue.severity ===
    'error'
  ) {
    validation.hasErrors =
      true;
  }

  if (
    issue.severity ===
    'warning'
  ) {
    validation.hasWarnings =
      true;
  }
}

/**
 * פעולה createKnownDispatcherIds: יצירת מוקדנים.
 * @param data — נתונים.
 * @returns Set<string> — הפלט בהתאם לחתימה.
 */
function createKnownDispatcherIds(
  data:
    AssignmentCandidatesData,
): Set<string> {
  // userIds — מזהה משתמש; אוסף ערכים ייחודיים.
  const userIds =
    new Set<string>();

  // עיבוד כל פריט מתוך data.shifts בנפרד.
  for (
    const shift
    of data.shifts
  ) {
    // עיבוד כל פריט מתוך shift.availableUserIds בנפרד.
    for (
      const userId
      of shift.availableUserIds
    ) {
      userIds.add(userId);
    }
  }

  return userIds;
}

/**
 * פעולה validateUnassignedShifts: בדיקת תקינות של משמרות.
 * @param data — נתונים.
 * @param assignmentsByShiftId — מזהה המשמרת.
 * @param intentionallyUnassignedShiftIds — מזהה המשמרת.
 * @returns EditableSchedulingValidationIssue[] — הפלט בהתאם לחתימה.
 */
function validateUnassignedShifts(
  data:
    AssignmentCandidatesData,

  assignmentsByShiftId:
    Map<
      string,
      SchedulingAssignment
    >,

  intentionallyUnassignedShiftIds:
    Set<string>,
): EditableSchedulingValidationIssue[] {
  const issues:
    EditableSchedulingValidationIssue[] =
    [];

  // עיבוד כל פריט מתוך data.shifts בנפרד.
  for (
    const shift
    of data.shifts
  ) {
    if (
      assignmentsByShiftId.has(
        shift.id,
      ) ||
      intentionallyUnassignedShiftIds.has(
        shift.id,
      )
    ) {
      continue;
    }

    issues.push(
      createIssue(
        'unassigned_shift',
        'error',
        shift.id,
        `המשמרת ${formatShiftLabel(
          shift,
        )} עדיין אינה משובצת.`,
      ),
    );
  }

  return issues;
}

/**
 * פעולה validateAssignments: בדיקת תקינות של הקצאות.
 * @param data — נתונים.
 * @param assignments — הקצאות.
 * @returns { issues: EditableSchedulingValidationIssue[]; intervalsByUserId: Map< string, ParsedShiftInterval[] >; } — הפלט בהתאם לחתימה.
 */
function validateAssignments(
  data:
    AssignmentCandidatesData,

  assignments:
    SchedulingAssignment[],
): {
  issues:
    EditableSchedulingValidationIssue[];

  // intervalsByUserId — מזהה משתמש.
  intervalsByUserId:
    Map<
      string,
      ParsedShiftInterval[]
    >;
} {
  const issues:
    EditableSchedulingValidationIssue[] =
    [];

  // shiftsById — משמרות / מזהה; מיפוי לחיפוש לפי מפתח.
  const shiftsById =
    new Map(
      data.shifts.map(
        (shift) => [
          shift.id,
          shift,
        ],
      ),
    );

  // knownDispatcherIds — מוקדנים.
  const knownDispatcherIds =
    createKnownDispatcherIds(
      data,
    );

  // intervalsByUserId — מזהה משתמש; מיפוי לחיפוש לפי מפתח.
  const intervalsByUserId =
    new Map<
      string,
      ParsedShiftInterval[]
    >();

  // עיבוד כל פריט מתוך assignments בנפרד.
  for (
    const assignment
    of assignments
  ) {
    // shift — משמרת.
    const shift =
      shiftsById.get(
        assignment.shiftId,
      );

    if (!shift) {
      issues.push(
        createIssue(
          'unknown_shift',
          'error',
          assignment.shiftId,
          'השיבוץ מפנה למשמרת שאינה קיימת בנתוני החודש.',
          assignment.userId,
        ),
      );

      continue;
    }

    if (
      !knownDispatcherIds.has(
        assignment.userId,
      )
    ) {
      issues.push(
        createIssue(
          'unknown_dispatcher',
          'error',
          shift.id,
          'השיבוץ מפנה למוקדן שאינו מוכר בנתוני האילוצים של החודש.',
          assignment.userId,
        ),
      );
    }

    if (
      !shift.availableUserIds.includes(
        assignment.userId,
      )
    ) {
      issues.push(
        createIssue(
          'dispatcher_unavailable',
          'warning',
          shift.id,
          `המוקדן שנבחר לא סימן זמינות למשמרת ${formatShiftLabel(
            shift,
          )}.`,
          assignment.userId,
        ),
      );
    }

    // interval — מרווח זמן.
    const interval =
      createShiftInterval(
        shift,
        assignment,
      );

    if (!interval) {
      issues.push(
        createIssue(
          'invalid_shift_time',
          'error',
          shift.id,
          `לא ניתן לחשב את זמני המשמרת ${formatShiftLabel(
            shift,
          )}.`,
          assignment.userId,
        ),
      );

      continue;
    }

    // userIntervals — משתמש.
    const userIntervals =
      intervalsByUserId.get(
        assignment.userId,
      ) ?? [];

    userIntervals.push(
      interval,
    );

    intervalsByUserId.set(
      assignment.userId,
      userIntervals,
    );
  }

  return {
    issues,
    intervalsByUserId,
  };
}

/**
 * פעולה validateUserShiftSequence: בדיקת תקינות של משתמש / משמרת.
 * @param intervalsByUserId — מזהה משתמש.
 * @returns EditableSchedulingValidationIssue[] — הפלט בהתאם לחתימה.
 */
function validateUserShiftSequence(
  intervalsByUserId:
    Map<
      string,
      ParsedShiftInterval[]
    >,
): EditableSchedulingValidationIssue[] {
  const issues:
    EditableSchedulingValidationIssue[] =
    [];

  // עיבוד כל פריט מתוך intervalsByUserId בנפרד.
  for (
    const [
      userId,
      intervals,
    ]
    of intervalsByUserId
  ) {
    const sortedIntervals = [
      ...intervals,
    ].sort(
      (
        firstInterval,
        secondInterval,
      ) =>
        firstInterval
          .startsAt
          .getTime() -
        secondInterval
          .startsAt
          .getTime(),
    );

    for (
      let index = 1;
      index <
      sortedIntervals.length;
      index += 1
    ) {
      // previousInterval — מרווח זמן.
      const previousInterval =
        sortedIntervals[
          index - 1
        ];

      // currentInterval — מרווח זמן.
      const currentInterval =
        sortedIntervals[
          index
        ];

      // previousEnd — הנתון previousEnd בהקשר הפעולה.
      const previousEnd =
        previousInterval
          .endsAt
          .getTime();

      // currentStart — הנתון currentStart בהקשר הפעולה.
      const currentStart =
        currentInterval
          .startsAt
          .getTime();

      if (
        currentStart <
        previousEnd
      ) {
        // firstMessage — הודעה.
        const firstMessage =
          `השיבוץ חופף למשמרת ` +
          `${formatShiftLabel(
            currentInterval.shift,
          )}.`;

        // secondMessage — הודעה.
        const secondMessage =
          `השיבוץ חופף למשמרת ` +
          `${formatShiftLabel(
            previousInterval.shift,
          )}.`;

        issues.push(
          createIssue(
            'overlapping_shifts',
            'error',
            previousInterval
              .shift.id,
            firstMessage,
            userId,
            currentInterval
              .shift.id,
          ),
        );

        issues.push(
          createIssue(
            'overlapping_shifts',
            'error',
            currentInterval
              .shift.id,
            secondMessage,
            userId,
            previousInterval
              .shift.id,
          ),
        );

        continue;
      }

      if (
        currentStart ===
        previousEnd
      ) {
        // firstMessage — הודעה.
        const firstMessage =
          `המשמרת מסתיימת בדיוק כאשר ` +
          `המשמרת ${formatShiftLabel(
            currentInterval.shift,
          )} מתחילה. ` +
          'אסור לשבץ אותו מוקדן למשמרות רצופות.';

        // secondMessage — הודעה.
        const secondMessage =
          `המשמרת מתחילה בדיוק כאשר ` +
          `המשמרת ${formatShiftLabel(
            previousInterval.shift,
          )} מסתיימת. ` +
          'אסור לשבץ אותו מוקדן למשמרות רצופות.';

        issues.push(
          createIssue(
            'consecutive_shifts',
            'error',
            previousInterval
              .shift.id,
            firstMessage,
            userId,
            currentInterval
              .shift.id,
          ),
        );

        issues.push(
          createIssue(
            'consecutive_shifts',
            'error',
            currentInterval
              .shift.id,
            secondMessage,
            userId,
            previousInterval
              .shift.id,
          ),
        );
      }
    }
  }

  return issues;
}

/**
 * פעולה validateEditableSchedulingDraft: בדיקת תקינות של טיוטה.
 * @param data — נתונים.
 * @param assignments — הקצאות.
 * @param intentionallyUnassignedShiftIds — מזהה המשמרת.
 * @returns EditableSchedulingValidationResult — הפלט בהתאם לחתימה.
 */
export function validateEditableSchedulingDraft(
  data:
    AssignmentCandidatesData | null,

  assignments:
    SchedulingAssignment[],

  intentionallyUnassignedShiftIds:
    string[] = [],
): EditableSchedulingValidationResult {
  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !data.
  if (!data) {
    return {
      issues: [],

      shiftValidations: {},

      errorCount: 0,
      warningCount: 0,

      unassignedShiftCount: 0,
      unavailableAssignmentCount: 0,
      overlapCount: 0,
      consecutiveShiftCount: 0,

      isValid: false,
    };
  }

  // assignmentsByShiftId — מזהה המשמרת; מיפוי לחיפוש לפי מפתח.
  const assignmentsByShiftId =
    new Map<
      string,
      SchedulingAssignment
    >();

  // עיבוד כל פריט מתוך assignments בנפרד.
  for (
    const assignment
    of assignments
  ) {
    assignmentsByShiftId.set(
      assignment.shiftId,
      assignment,
    );
  }

  const unassignedIssues =
    validateUnassignedShifts(
      data,
      assignmentsByShiftId,
      new Set(
        intentionallyUnassignedShiftIds,
      ),
    );

  // assignmentValidation — הקצאה / אימות נתונים.
  const assignmentValidation =
    validateAssignments(
      data,
      assignments,
    );

  const sequenceIssues =
    validateUserShiftSequence(
      assignmentValidation
        .intervalsByUserId,
    );

  // issueMap — מפת התאמה; מיפוי לחיפוש לפי מפתח.
  const issueMap =
    new Map<
      string,
      EditableSchedulingValidationIssue
    >();

  // עיבוד כל פריט מתוך [ ...unassignedIssues, ...assignmentValidation .issues, ...sequenceIssues, ] בנפרד.
  for (
    const issue
    of [
      ...unassignedIssues,
      ...assignmentValidation
        .issues,
      ...sequenceIssues,
    ]
  ) {
    issueMap.set(
      issue.id,
      issue,
    );
  }

  const issues =
    Array.from(
      issueMap.values(),
    );

  // shiftValidations — משמרת.
  const shiftValidations:
    Record<
      string,
      EditableSchedulingShiftValidation
    > = {};

  // עיבוד כל פריט מתוך data.shifts בנפרד.
  for (
    const shift
    of data.shifts
  ) {
    shiftValidations[
      shift.id
    ] =
      createEmptyShiftValidation(
        shift.id,
      );
  }

  // עיבוד כל פריט מתוך issues בנפרד.
  for (
    const issue
    of issues
  ) {
    addIssueToShiftValidation(
      shiftValidations,
      issue,
    );
  }

  // errorCount — שגיאה / כמות.
  const errorCount =
    issues.filter(
      (issue) =>
        issue.severity ===
        'error',
    ).length;

  // warningCount — כמות.
  const warningCount =
    issues.filter(
      (issue) =>
        issue.severity ===
        'warning',
    ).length;

  // unassignedShiftCount — משמרת / כמות.
  const unassignedShiftCount =
    issues.filter(
      (issue) =>
        issue.type ===
        'unassigned_shift',
    ).length;

  // unavailableAssignmentCount — הקצאה / כמות.
  const unavailableAssignmentCount =
    issues.filter(
      (issue) =>
        issue.type ===
        'dispatcher_unavailable',
    ).length;

  // overlapCount — כמות.
  const overlapCount =
    issues.filter(
      (issue) =>
        issue.type ===
        'overlapping_shifts',
    ).length;

  // consecutiveShiftCount — משמרת / כמות.
  const consecutiveShiftCount =
    issues.filter(
      (issue) =>
        issue.type ===
        'consecutive_shifts',
    ).length;

  return {
    issues,

    shiftValidations,

    errorCount,
    warningCount,

    unassignedShiftCount,
    unavailableAssignmentCount,
    overlapCount,
    consecutiveShiftCount,

    isValid:
      errorCount === 0,
  };
}