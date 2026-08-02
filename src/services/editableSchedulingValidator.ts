import type {
  AssignmentCandidateShift,
  AssignmentCandidatesData,
} from '../types/assignmentCandidates';

import type {
  SchedulingAssignment,
} from '../types/autoScheduling';

export type EditableSchedulingValidationIssueType =
  | 'unassigned_shift'
  | 'dispatcher_unavailable'
  | 'overlapping_shifts'
  | 'consecutive_shifts'
  | 'invalid_shift_time'
  | 'unknown_shift'
  | 'unknown_dispatcher';

export type EditableSchedulingValidationSeverity =
  | 'error'
  | 'warning';

export interface EditableSchedulingValidationIssue {
  id: string;

  type:
    EditableSchedulingValidationIssueType;

  severity:
    EditableSchedulingValidationSeverity;

  shiftId: string;

  relatedShiftId:
    string | null;

  userId:
    string | null;

  message: string;
}

export interface EditableSchedulingShiftValidation {
  shiftId: string;

  issues:
    EditableSchedulingValidationIssue[];

  hasErrors: boolean;
  hasWarnings: boolean;
}

export interface EditableSchedulingValidationResult {
  issues:
    EditableSchedulingValidationIssue[];

  shiftValidations:
    Record<
      string,
      EditableSchedulingShiftValidation
    >;

  errorCount: number;
  warningCount: number;

  unassignedShiftCount: number;
  unavailableAssignmentCount: number;
  overlapCount: number;
  consecutiveShiftCount: number;

  isValid: boolean;
}

interface ParsedShiftInterval {
  shift:
    AssignmentCandidateShift;

  assignment:
    SchedulingAssignment;

  startsAt:
    Date;

  endsAt:
    Date;
}

function normalizeTime(
  value: string,
): string {
  return value
    .trim()
    .slice(0, 5);
}

function parseTimeParts(
  value: string,
): {
  hours: number;
  minutes: number;
} | null {
  const normalizedValue =
    normalizeTime(value);

  const match =
    normalizedValue.match(
      /^(\d{1,2}):(\d{2})$/,
    );

  if (!match) {
    return null;
  }

  const hours =
    Number(match[1]);

  const minutes =
    Number(match[2]);

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

function createDateAtTime(
  dateValue: string,
  timeValue: string,
): Date | null {
  const timeParts =
    parseTimeParts(
      timeValue,
    );

  if (!timeParts) {
    return null;
  }

  const dateMatch =
    dateValue
      .trim()
      .match(
        /^(\d{4})-(\d{2})-(\d{2})$/,
      );

  if (!dateMatch) {
    return null;
  }

  const year =
    Number(dateMatch[1]);

  const month =
    Number(dateMatch[2]);

  const day =
    Number(dateMatch[3]);

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

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return null;
  }

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

function createShiftInterval(
  shift:
    AssignmentCandidateShift,

  assignment:
    SchedulingAssignment,
): ParsedShiftInterval | null {
  const startsAt =
    createDateAtTime(
      shift.date,
      shift.startTime,
    );

  const endsAt =
    createDateAtTime(
      shift.date,
      shift.endTime,
    );

  if (
    !startsAt ||
    !endsAt
  ) {
    return null;
  }

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

  const validation =
    shiftValidations[
      issue.shiftId
    ];

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

function createKnownDispatcherIds(
  data:
    AssignmentCandidatesData,
): Set<string> {
  const userIds =
    new Set<string>();

  for (
    const shift
    of data.shifts
  ) {
    for (
      const userId
      of shift.availableUserIds
    ) {
      userIds.add(userId);
    }
  }

  return userIds;
}

function validateUnassignedShifts(
  data:
    AssignmentCandidatesData,

  assignmentsByShiftId:
    Map<
      string,
      SchedulingAssignment
    >,
): EditableSchedulingValidationIssue[] {
  const issues:
    EditableSchedulingValidationIssue[] =
    [];

  for (
    const shift
    of data.shifts
  ) {
    if (
      assignmentsByShiftId.has(
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

function validateAssignments(
  data:
    AssignmentCandidatesData,

  assignments:
    SchedulingAssignment[],
): {
  issues:
    EditableSchedulingValidationIssue[];

  intervalsByUserId:
    Map<
      string,
      ParsedShiftInterval[]
    >;
} {
  const issues:
    EditableSchedulingValidationIssue[] =
    [];

  const shiftsById =
    new Map(
      data.shifts.map(
        (shift) => [
          shift.id,
          shift,
        ],
      ),
    );

  const knownDispatcherIds =
    createKnownDispatcherIds(
      data,
    );

  const intervalsByUserId =
    new Map<
      string,
      ParsedShiftInterval[]
    >();

  for (
    const assignment
    of assignments
  ) {
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
      const previousInterval =
        sortedIntervals[
          index - 1
        ];

      const currentInterval =
        sortedIntervals[
          index
        ];

      const previousEnd =
        previousInterval
          .endsAt
          .getTime();

      const currentStart =
        currentInterval
          .startsAt
          .getTime();

      if (
        currentStart <
        previousEnd
      ) {
        const firstMessage =
          `השיבוץ חופף למשמרת ` +
          `${formatShiftLabel(
            currentInterval.shift,
          )}.`;

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
        const firstMessage =
          `המשמרת מסתיימת בדיוק כאשר ` +
          `המשמרת ${formatShiftLabel(
            currentInterval.shift,
          )} מתחילה. ` +
          'אסור לשבץ אותו מוקדן למשמרות רצופות.';

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

export function validateEditableSchedulingDraft(
  data:
    AssignmentCandidatesData | null,

  assignments:
    SchedulingAssignment[],
): EditableSchedulingValidationResult {
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

  const assignmentsByShiftId =
    new Map<
      string,
      SchedulingAssignment
    >();

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
    );

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

  const issueMap =
    new Map<
      string,
      EditableSchedulingValidationIssue
    >();

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

  const shiftValidations:
    Record<
      string,
      EditableSchedulingShiftValidation
    > = {};

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

  for (
    const issue
    of issues
  ) {
    addIssueToShiftValidation(
      shiftValidations,
      issue,
    );
  }

  const errorCount =
    issues.filter(
      (issue) =>
        issue.severity ===
        'error',
    ).length;

  const warningCount =
    issues.filter(
      (issue) =>
        issue.severity ===
        'warning',
    ).length;

  const unassignedShiftCount =
    issues.filter(
      (issue) =>
        issue.type ===
        'unassigned_shift',
    ).length;

  const unavailableAssignmentCount =
    issues.filter(
      (issue) =>
        issue.type ===
        'dispatcher_unavailable',
    ).length;

  const overlapCount =
    issues.filter(
      (issue) =>
        issue.type ===
        'overlapping_shifts',
    ).length;

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