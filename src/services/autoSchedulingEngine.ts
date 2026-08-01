import {
  schedulingEngineConfig,
} from '../config/schedulingEngineConfig';
import type {
  AssignmentCandidateShift,
  AssignmentCandidatesData,
} from '../types/assignmentCandidates';
import type {
  CandidateEligibilityResult,
  CandidateScoreResult,
  SchedulingAssignment,
  SchedulingDispatcher,
  SchedulingDraft,
  SchedulingDispatcherSummary,
  SchedulingIssue,
  SchedulingShift,
  SchedulingShiftCategory,
} from '../types/autoScheduling';
type DetailedShiftCounterKey =
  | 'weekdayEveningShifts'
  | 'weekdayNightShifts'
  | 'fridayMorningShifts'
  | 'fridayAfternoonShifts'
  | 'fridayNightShifts'
  | 'saturdayMorningShifts'
  | 'saturdayAfternoonShifts'
  | 'saturdayNightShifts';
function normalizeTimeValue(
  value: string,
): string {
  return value.slice(0, 5);
}

function createShiftDateTime(
  dateValue: string,
  timeValue: string,
): Date {
  const normalizedTime =
    normalizeTimeValue(timeValue);

  const result =
    new Date(
      `${dateValue}T${normalizedTime}:00`,
    );

  if (
    Number.isNaN(
      result.getTime(),
    )
  ) {
    throw new Error(
      `Invalid shift date/time: ${dateValue} ${timeValue}`,
    );
  }

  return result;
}

function normalizeScheduleType(
  value: string,
): SchedulingShiftCategory {
  switch (value) {
    case 'weekday':
    case 'friday':
    case 'saturday':
    case 'holiday_eve':
    case 'holiday_full':
    case 'holiday_end':
    case 'chol_hamoed':
      return value;

    default:
      return 'other';
  }
}

function isNightShift(
  shift:
    AssignmentCandidateShift,
): boolean {
  const startTime =
    normalizeTimeValue(
      shift.startTime,
    );

  return (
    shift.endsNextDay ||
    startTime === '22:00' ||
    startTime === '23:00'
  );
}

function isHolidayShift(
  shift:
    SchedulingShift,
): boolean {
  return (
    shift.scheduleType ===
      'holiday_eve' ||
    shift.scheduleType ===
      'holiday_full' ||
    shift.scheduleType ===
      'holiday_end'
  );
}
function isFridayShift(
  shift: SchedulingShift,
): boolean {
  return (
    shift.weekdayName === 'שישי' ||
    shift.scheduleType ===
      'friday'
  );
}

function isSaturdayShift(
  shift: SchedulingShift,
): boolean {
  return (
    shift.weekdayName === 'שבת' ||
    shift.scheduleType ===
      'saturday'
  );
}

function getDetailedShiftCounterKey(
  shift: SchedulingShift,
): DetailedShiftCounterKey | null {
  const startTime =
    normalizeTimeValue(
      shift.startTime,
    );

  const endTime =
    normalizeTimeValue(
      shift.endTime,
    );

  if (isFridayShift(shift)) {
    if (
      startTime === '06:00' &&
      endTime === '14:00'
    ) {
      return 'fridayMorningShifts';
    }

    if (
      startTime === '14:00' &&
      endTime === '22:00'
    ) {
      return 'fridayAfternoonShifts';
    }

    if (
      startTime === '22:00' &&
      endTime === '06:00'
    ) {
      return 'fridayNightShifts';
    }

    return null;
  }

  if (isSaturdayShift(shift)) {
    if (
      startTime === '06:00' &&
      endTime === '14:00'
    ) {
      return 'saturdayMorningShifts';
    }

    if (
      startTime === '14:00' &&
      endTime === '22:00'
    ) {
      return 'saturdayAfternoonShifts';
    }

    if (
      startTime === '22:00' &&
      endTime === '06:00'
    ) {
      return 'saturdayNightShifts';
    }

    return null;
  }

  if (
    startTime === '16:00' &&
    endTime === '23:00'
  ) {
    return 'weekdayEveningShifts';
  }

  if (
    startTime === '23:00' &&
    endTime === '06:00'
  ) {
    return 'weekdayNightShifts';
  }

  return null;
}

function getNightShiftCount(
  dispatcher:
    SchedulingDispatcher,
): number {
  return (
    dispatcher.counters
      .weekdayNightShifts +
    dispatcher.counters
      .fridayNightShifts +
    dispatcher.counters
      .saturdayNightShifts
  );
}

function getFridayShiftCount(
  dispatcher:
    SchedulingDispatcher,
): number {
  return (
    dispatcher.counters
      .fridayMorningShifts +
    dispatcher.counters
      .fridayAfternoonShifts +
    dispatcher.counters
      .fridayNightShifts
  );
}

function getSaturdayShiftCount(
  dispatcher:
    SchedulingDispatcher,
): number {
  return (
    dispatcher.counters
      .saturdayMorningShifts +
    dispatcher.counters
      .saturdayAfternoonShifts +
    dispatcher.counters
      .saturdayNightShifts
  );
}
function mapCandidateShift(
  shift:
    AssignmentCandidateShift,
): SchedulingShift {
  const startsAt =
    createShiftDateTime(
      shift.date,
      shift.startTime,
    );

  const endsAt =
    createShiftDateTime(
      shift.date,
      shift.endTime,
    );

  if (
    shift.endsNextDay ||
    endsAt <= startsAt
  ) {
    endsAt.setDate(
      endsAt.getDate() + 1,
    );
  }

  return {
    id:
      shift.id,

    date:
      shift.date,

    weekdayNumber:
      shift.weekdayNumber,

    weekdayName:
      shift.weekdayName,

    startTime:
      normalizeTimeValue(
        shift.startTime,
      ),

    endTime:
      normalizeTimeValue(
        shift.endTime,
      ),

    startsAt,
    endsAt,

    endsNextDay:
      shift.endsNextDay,

    scheduleType:
      normalizeScheduleType(
        shift.scheduleType,
      ),

    holidayName:
      shift.holidayName,

    isPremium:
      shift.isPremium,

    isNightShift:
      isNightShift(shift),

    sortOrder:
      shift.sortOrder,

    assignmentState:
      shift.assignmentState,

    availableUserIds:
      [...shift.availableUserIds],

    soleAvailableUserId:
      shift.soleAvailableUserId,
  };
}

function shiftsOverlap(
  firstShift: SchedulingShift,
  secondShift: SchedulingShift,
): boolean {
  return (
    firstShift.startsAt <
      secondShift.endsAt &&
    secondShift.startsAt <
      firstShift.endsAt
  );
}

function shiftsTouch(
  firstShift: SchedulingShift,
  secondShift: SchedulingShift,
): boolean {
  return (
    firstShift.endsAt.getTime() ===
      secondShift.startsAt.getTime() ||
    secondShift.endsAt.getTime() ===
      firstShift.startsAt.getTime()
  );
}

function getAssignedShiftsForDispatcher(
  dispatcher:
    SchedulingDispatcher,

  shiftsById:
    Map<string, SchedulingShift>,
): SchedulingShift[] {
  return dispatcher.assignedShiftIds
    .map(
      (shiftId) =>
        shiftsById.get(shiftId),
    )
    .filter(
      (
        shift,
      ): shift is SchedulingShift =>
        Boolean(shift),
    );
}

function checkCandidateEligibility(
  dispatcher:
    SchedulingDispatcher,

  targetShift:
    SchedulingShift,

  shiftsById:
    Map<string, SchedulingShift>,
): CandidateEligibilityResult {
  const reasons: string[] = [];

  if (
    !targetShift.availableUserIds.includes(
      dispatcher.userId,
    )
  ) {
    reasons.push(
      'המוקדן לא סימן שהוא זמין למשמרת.',
    );
  }

  const assignedShifts =
    getAssignedShiftsForDispatcher(
      dispatcher,
      shiftsById,
    );

  for (
    const assignedShift
    of assignedShifts
  ) {
    if (
      schedulingEngineConfig
        .preventOverlappingShifts &&
      shiftsOverlap(
        assignedShift,
        targetShift,
      )
    ) {
      reasons.push(
        `חפיפה עם משמרת ${assignedShift.date} ${assignedShift.startTime}–${assignedShift.endTime}.`,
      );
    }

    if (
      schedulingEngineConfig
        .preventTouchingShifts &&
      shiftsTouch(
        assignedShift,
        targetShift,
      )
    ) {
      reasons.push(
        `משמרת רצופה בזמן עם ${assignedShift.date} ${assignedShift.startTime}–${assignedShift.endTime}.`,
      );
    }
  }

  return {
    isEligible:
      reasons.length === 0,

    reasons,
  };
}

function createDispatcherMap(
  data:
    AssignmentCandidatesData,
): Map<
  string,
  SchedulingDispatcher
> {
  const dispatchers =
    new Map<
      string,
      SchedulingDispatcher
    >();

  for (
    const shift
    of data.shifts
  ) {
    shift.availableUserIds.forEach(
      (
        userId,
        index,
      ) => {
        if (
          dispatchers.has(userId)
        ) {
          return;
        }

        dispatchers.set(
          userId,
          {
            userId,

            displayName:
              shift
                .availableDisplayNames[
                  index
                ] ??
              userId,

            scheduleName:
              shift
                .availableScheduleNames[
                  index
                ] ??
              null,

            counters: {
              totalShifts: 0,

              weekdayEveningShifts:
                0,

              weekdayNightShifts:
                0,

              fridayMorningShifts:
                0,

              fridayAfternoonShifts:
                0,

              fridayNightShifts:
                0,

              saturdayMorningShifts:
                0,

              saturdayAfternoonShifts:
                0,

              saturdayNightShifts:
                0,

              premiumShifts: 0,

              holidayShifts: 0,
            },

            assignedShiftIds: [],
          },
        );
      },
    );
  }

  return dispatchers;
}

function getCategoryShiftCount(
  dispatcher:
    SchedulingDispatcher,

  shift:
    SchedulingShift,
): number {
  const counterKey =
    getDetailedShiftCounterKey(
      shift,
    );

  if (counterKey) {
    return dispatcher
      .counters[counterKey];
  }

  if (shift.isPremium) {
    return dispatcher
      .counters
      .premiumShifts;
  }

  if (isHolidayShift(shift)) {
    return dispatcher
      .counters
      .holidayShifts;
  }

  return 0;
}

function updateDispatcherCounters(
  dispatcher:
    SchedulingDispatcher,

  shift:
    SchedulingShift,
): void {
  dispatcher.counters.totalShifts +=
    1;

  const detailedCounterKey =
    getDetailedShiftCounterKey(
      shift,
    );

  if (detailedCounterKey) {
    dispatcher.counters[
      detailedCounterKey
    ] += 1;
  }

  if (shift.isPremium) {
    dispatcher.counters
      .premiumShifts += 1;
  }

  if (isHolidayShift(shift)) {
    dispatcher.counters
      .holidayShifts += 1;
  }

  dispatcher.assignedShiftIds.push(
    shift.id,
  );
}

function getMaximumCounter(
  dispatchers:
    SchedulingDispatcher[],

  selector: (
    dispatcher:
      SchedulingDispatcher,
  ) => number,
): number {
  if (
    dispatchers.length === 0
  ) {
    return 0;
  }

  return Math.max(
    ...dispatchers.map(selector),
  );
}

function calculateCandidateScore(
  dispatcher:
    SchedulingDispatcher,

  targetShift:
    SchedulingShift,

  eligibleDispatchers:
    SchedulingDispatcher[],
): CandidateScoreResult {
  const reasons: string[] = [];

  let score = 100;

  const {
    weights,
  } = schedulingEngineConfig;

  const maximumTotalShifts =
    getMaximumCounter(
      eligibleDispatchers,
      (candidate) =>
        candidate.counters
          .totalShifts,
    );

  const totalShiftDifference =
    maximumTotalShifts -
    dispatcher.counters
      .totalShifts;

  if (
    totalShiftDifference > 0
  ) {
    const totalBalanceBonus =
      totalShiftDifference *
      weights.totalShiftBalance;

    score +=
      totalBalanceBonus;

    reasons.push(
      `איזון משמרות כולל: +${totalBalanceBonus}.`,
    );
  }

  const maximumCategoryShifts =
    getMaximumCounter(
      eligibleDispatchers,
      (candidate) =>
        getCategoryShiftCount(
          candidate,
          targetShift,
        ),
    );

  const categoryShiftCount =
    getCategoryShiftCount(
      dispatcher,
      targetShift,
    );

  const categoryDifference =
    maximumCategoryShifts -
    categoryShiftCount;

  if (
    categoryDifference > 0
  ) {
    const categoryBonus =
      categoryDifference *
      weights.sameCategoryBalance;

    score +=
      categoryBonus;

    reasons.push(
      `איזון משמרות מאותו סוג: +${categoryBonus}.`,
    );
  }

  if (
    targetShift.isNightShift
  ) {
    const maximumNightShifts =
      getMaximumCounter(
        eligibleDispatchers,
        getNightShiftCount,
      );

    const difference =
      maximumNightShifts -
      getNightShiftCount(
        dispatcher,
      );

    if (difference > 0) {
      const bonus =
        difference *
        weights.nightShiftBalance;

      score += bonus;

      reasons.push(
        `איזון משמרות לילה: +${bonus}.`,
      );
    }
  }

  if (
    isFridayShift(
      targetShift,
    )
  ) {
    const maximumFridayShifts =
      getMaximumCounter(
        eligibleDispatchers,
        getFridayShiftCount,
      );

    const difference =
      maximumFridayShifts -
      getFridayShiftCount(
        dispatcher,
      );

    if (difference > 0) {
      const bonus =
        difference *
        weights.fridayShiftBalance;

      score += bonus;

      reasons.push(
        `איזון משמרות שישי: +${bonus}.`,
      );
    }
  }

  if (
    isSaturdayShift(
      targetShift,
    )
  ) {
    const maximumSaturdayShifts =
      getMaximumCounter(
        eligibleDispatchers,
        getSaturdayShiftCount,
      );

    const difference =
      maximumSaturdayShifts -
      getSaturdayShiftCount(
        dispatcher,
      );

    if (difference > 0) {
      const bonus =
        difference *
        weights.saturdayShiftBalance;

      score += bonus;

      reasons.push(
        `איזון משמרות שבת: +${bonus}.`,
      );
    }
  }

  if (targetShift.isPremium) {
    const maximumPremiumShifts =
      getMaximumCounter(
        eligibleDispatchers,
        (candidate) =>
          candidate.counters
            .premiumShifts,
      );

    const difference =
      maximumPremiumShifts -
      dispatcher.counters
        .premiumShifts;

    if (difference > 0) {
      const bonus =
        difference *
        weights.premiumShiftBalance;

      score += bonus;

      reasons.push(
        `איזון משמרות 200%: +${bonus}.`,
      );
    }
  }

  if (
    isHolidayShift(
      targetShift,
    )
  ) {
    const maximumHolidayShifts =
      getMaximumCounter(
        eligibleDispatchers,
        (candidate) =>
          candidate.counters
            .holidayShifts,
      );

    const difference =
      maximumHolidayShifts -
      dispatcher.counters
        .holidayShifts;

    if (difference > 0) {
      const bonus =
        difference *
        weights.holidayShiftBalance;

      score += bonus;

      reasons.push(
        `איזון משמרות חג: +${bonus}.`,
      );
    }
  }

  if (
    reasons.length === 0
  ) {
    reasons.push(
      'כל מדדי האיזון היו שווים.',
    );
  }

  return {
    userId:
      dispatcher.userId,

    score,

    reasons,
  };
}

function createStableTieBreaker(
  shiftId: string,
  userId: string,
): number {
  const value =
    `${shiftId}:${userId}`;

  let hash = 0;

  for (
    let index = 0;
    index < value.length;
    index += 1
  ) {
    hash =
      (
        hash * 31 +
        value.charCodeAt(index)
      ) >>> 0;
  }

  return hash;
}

function compareScoredCandidates(
  first:
    CandidateScoreResult,

  second:
    CandidateScoreResult,

  dispatchers:
    Map<
      string,
      SchedulingDispatcher
    >,

  shift:
    SchedulingShift,
): number {
  if (
    first.score !==
    second.score
  ) {
    return (
      second.score -
      first.score
    );
  }

  const firstDispatcher =
    dispatchers.get(
      first.userId,
    );

  const secondDispatcher =
    dispatchers.get(
      second.userId,
    );

  if (
    firstDispatcher &&
    secondDispatcher
  ) {
    const totalDifference =
      firstDispatcher
        .counters
        .totalShifts -
      secondDispatcher
        .counters
        .totalShifts;

    if (
      totalDifference !== 0
    ) {
      return totalDifference;
    }

    const categoryDifference =
      getCategoryShiftCount(
        firstDispatcher,
        shift,
      ) -
      getCategoryShiftCount(
        secondDispatcher,
        shift,
      );

    if (
      categoryDifference !== 0
    ) {
      return categoryDifference;
    }

    const nightDifference =
      getNightShiftCount(
        firstDispatcher,
      ) -
      getNightShiftCount(
        secondDispatcher,
      );

    if (
      nightDifference !== 0
    ) {
      return nightDifference;
    }

    const premiumDifference =
      firstDispatcher
        .counters
        .premiumShifts -
      secondDispatcher
        .counters
        .premiumShifts;

    if (
      premiumDifference !== 0
    ) {
      return premiumDifference;
    }
  }

  return (
    createStableTieBreaker(
      shift.id,
      first.userId,
    ) -
    createStableTieBreaker(
      shift.id,
      second.userId,
    )
  );
}

function assignSingleCandidateShift(
  shift:
    SchedulingShift,

  dispatchers:
    Map<
      string,
      SchedulingDispatcher
    >,

  shiftsById:
    Map<string, SchedulingShift>,
): {
  assignment:
    SchedulingAssignment | null;

  issue:
    SchedulingIssue | null;
} {
  const userId =
    shift.soleAvailableUserId;

  if (!userId) {
    return {
      assignment: null,

      issue: {
        shiftId:
          shift.id,

        type:
          'no_available_dispatcher',

        message:
          'לא נמצא מוקדן זמין יחיד תקין למשמרת.',

        candidateUserIds: [],
      },
    };
  }

  const dispatcher =
    dispatchers.get(userId);

  if (!dispatcher) {
    return {
      assignment: null,

      issue: {
        shiftId:
          shift.id,

        type:
          'single_candidate_conflict',

        message:
          'המוקדן הזמין היחיד לא נמצא ברשימת המוקדנים של המנוע.',

        candidateUserIds: [
          userId,
        ],
      },
    };
  }

  const eligibility =
    checkCandidateEligibility(
      dispatcher,
      shift,
      shiftsById,
    );

  if (!eligibility.isEligible) {
    return {
      assignment: null,

      issue: {
        shiftId:
          shift.id,

        type:
          'single_candidate_conflict',

        message:
          `לא ניתן לשבץ את המוקדן הזמין היחיד: ${eligibility.reasons.join(' ')}`,

        candidateUserIds: [
          userId,
        ],
      },
    };
  }

  updateDispatcherCounters(
    dispatcher,
    shift,
  );

  return {
    assignment: {
      shiftId:
        shift.id,

      userId,

      source:
        'automatic_single_candidate',

      score:
        null,

      reasons: [
        'המוקדן הוא המועמד הזמין היחיד למשמרת.',
      ],
    },

    issue:
      null,
  };
}

function assignMultipleCandidateShift(
  shift:
    SchedulingShift,

  dispatchers:
    Map<
      string,
      SchedulingDispatcher
    >,

  shiftsById:
    Map<string, SchedulingShift>,
): {
  assignment:
    SchedulingAssignment | null;

  issue:
    SchedulingIssue | null;
} {
  const eligibleDispatchers =
    shift.availableUserIds
      .map(
        (userId) =>
          dispatchers.get(userId),
      )
      .filter(
        (
          dispatcher,
        ): dispatcher is
          SchedulingDispatcher =>
          Boolean(dispatcher),
      )
      .filter(
        (dispatcher) =>
          checkCandidateEligibility(
            dispatcher,
            shift,
            shiftsById,
          ).isEligible,
      );

  if (
    eligibleDispatchers.length ===
    0
  ) {
    const blockedReasons =
      shift.availableUserIds
        .map((userId) => {
          const dispatcher =
            dispatchers.get(userId);

          if (!dispatcher) {
            return `${userId}: המוקדן לא נמצא במנוע.`;
          }

          const eligibility =
            checkCandidateEligibility(
              dispatcher,
              shift,
              shiftsById,
            );

          return `${dispatcher.displayName}: ${eligibility.reasons.join(' ')}`;
        })
        .join(' ');

    return {
      assignment: null,

      issue: {
        shiftId:
          shift.id,

        type:
          'no_legal_candidate',

        message:
          blockedReasons ||
          'לא נמצא מועמד חוקי למשמרת.',

        candidateUserIds: [
          ...shift.availableUserIds,
        ],
      },
    };
  }

  const scoredCandidates =
    eligibleDispatchers
      .map(
        (dispatcher) =>
          calculateCandidateScore(
            dispatcher,
            shift,
            eligibleDispatchers,
          ),
      )
      .sort(
        (
          firstCandidate,
          secondCandidate,
        ) =>
          compareScoredCandidates(
            firstCandidate,
            secondCandidate,
            dispatchers,
            shift,
          ),
      );

  const selectedCandidate =
    scoredCandidates[0];

  const selectedDispatcher =
    dispatchers.get(
      selectedCandidate.userId,
    );

  if (!selectedDispatcher) {
    return {
      assignment: null,

      issue: {
        shiftId:
          shift.id,

        type:
          'no_legal_candidate',

        message:
          'המועמד שנבחר אינו קיים במנוע השיבוץ.',

        candidateUserIds: [
          ...shift.availableUserIds,
        ],
      },
    };
  }

  updateDispatcherCounters(
    selectedDispatcher,
    shift,
  );

  return {
    assignment: {
      shiftId:
        shift.id,

      userId:
        selectedDispatcher.userId,

      source:
        'automatic_scoring',

      score:
        selectedCandidate.score,

      reasons:
        selectedCandidate.reasons,
    },

    issue:
      null,
  };
}

function sortShiftsForInitialProcessing(
  shifts:
    SchedulingShift[],
): SchedulingShift[] {
  const statePriority =
    {
      no_available: 1,
      single_available: 2,
      multiple_available: 3,
    } as const;

  return [...shifts].sort(
    (
      firstShift,
      secondShift,
    ) => {
      const stateDifference =
        statePriority[
          firstShift.assignmentState
        ] -
        statePriority[
          secondShift.assignmentState
        ];

      if (
        stateDifference !== 0
      ) {
        return stateDifference;
      }

      const candidateDifference =
        firstShift
          .availableUserIds
          .length -
        secondShift
          .availableUserIds
          .length;

      if (
        candidateDifference !== 0
      ) {
        return candidateDifference;
      }

      if (
        firstShift.isPremium !==
        secondShift.isPremium
      ) {
        return firstShift.isPremium
          ? -1
          : 1;
      }

      const dateDifference =
        firstShift.startsAt.getTime() -
        secondShift.startsAt.getTime();

      if (dateDifference !== 0) {
        return dateDifference;
      }

      return (
        firstShift.sortOrder -
        secondShift.sortOrder
      );
    },
  );
}
function createDispatcherSummaries(
  dispatchers:
    Map<
      string,
      SchedulingDispatcher
    >,
): SchedulingDispatcherSummary[] {
  return Array.from(
    dispatchers.values(),
  )
    .map(
      (
        dispatcher,
      ): SchedulingDispatcherSummary => ({
        userId:
          dispatcher.userId,

        displayName:
          dispatcher.displayName,

        scheduleName:
          dispatcher.scheduleName,

        totalShifts:
          dispatcher.counters
            .totalShifts,

        weekdayEveningShifts:
          dispatcher.counters
            .weekdayEveningShifts,

        weekdayNightShifts:
          dispatcher.counters
            .weekdayNightShifts,

        fridayMorningShifts:
          dispatcher.counters
            .fridayMorningShifts,

        fridayAfternoonShifts:
          dispatcher.counters
            .fridayAfternoonShifts,

        fridayNightShifts:
          dispatcher.counters
            .fridayNightShifts,

        saturdayMorningShifts:
          dispatcher.counters
            .saturdayMorningShifts,

        saturdayAfternoonShifts:
          dispatcher.counters
            .saturdayAfternoonShifts,

        saturdayNightShifts:
          dispatcher.counters
            .saturdayNightShifts,

        premiumShifts:
          dispatcher.counters
            .premiumShifts,

        holidayShifts:
          dispatcher.counters
            .holidayShifts,
      }),
    )
    .sort(
      (
        firstDispatcher,
        secondDispatcher,
      ) =>
        firstDispatcher
          .displayName
          .localeCompare(
            secondDispatcher
              .displayName,
            'he',
          ),
    );
}
function buildSchedulingDraft(
  data:
    AssignmentCandidatesData,
): SchedulingDraft {
  const shifts =
    data.shifts.map(
      mapCandidateShift,
    );

  const shiftsById =
    new Map(
      shifts.map(
        (shift) => [
          shift.id,
          shift,
        ],
      ),
    );

  if (
    shiftsById.size !==
    shifts.length
  ) {
    throw new Error(
      'נמצאו משמרות כפולות בנתוני ההכנה לשיבוץ.',
    );
  }

  const dispatchers =
    createDispatcherMap(data);

  const assignments:
    SchedulingAssignment[] = [];

  const issues:
    SchedulingIssue[] = [];

  const unassignedShiftIds:
    string[] = [];

  const sortedShifts =
    sortShiftsForInitialProcessing(
      shifts,
    );

  for (
    const shift
    of sortedShifts
  ) {
    if (
      shift.assignmentState ===
      'no_available'
    ) {
      unassignedShiftIds.push(
        shift.id,
      );

      issues.push({
        shiftId:
          shift.id,

        type:
          'no_available_dispatcher',

        message:
          'אין אף מוקדן זמין למשמרת.',

        candidateUserIds: [],
      });

      continue;
    }

    if (
      shift.assignmentState ===
      'single_available'
    ) {
      const result =
        assignSingleCandidateShift(
          shift,
          dispatchers,
          shiftsById,
        );

      if (result.assignment) {
        assignments.push(
          result.assignment,
        );
      } else {
        unassignedShiftIds.push(
          shift.id,
        );
      }

      if (result.issue) {
        issues.push(
          result.issue,
        );
      }

      continue;
    }

    const result =
      assignMultipleCandidateShift(
        shift,
        dispatchers,
        shiftsById,
      );

    if (result.assignment) {
      assignments.push(
        result.assignment,
      );
    } else {
      unassignedShiftIds.push(
        shift.id,
      );
    }

    if (result.issue) {
      issues.push(
        result.issue,
      );
    }
  }

    return {
      assignments,
      unassignedShiftIds,
      issues,

      dispatcherSummaries:
        createDispatcherSummaries(
          dispatchers,
        ),
    };
}

export const autoSchedulingEngine = {
  buildSchedulingDraft,
  checkCandidateEligibility,
  calculateCandidateScore,
  shiftsOverlap,
  shiftsTouch,
};