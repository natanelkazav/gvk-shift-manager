/**
 * קובץ: src/services/autoSchedulingEngine.ts
 * מטרה: בניית טיוטת שיבוץ מוקדנים באמצעות בדיקת כשירות, ניקוד מועמדים ואיזון מוני המשמרות.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: DetailedShiftCounterKey, normalizeTimeValue, createShiftDateTime, normalizeScheduleType, isNightShift, isHolidayShift, isFridayShift, isSaturdayShift, getDetailedShiftCounterKey, getNightShiftCount ועוד.
 * - ריכוז פעולות העיבוד והחישוב בהתאם לפונקציות להלן.
 */
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
/**
 * טיפוס DetailedShiftCounterKey: משמרת / מפתח.
 */
type DetailedShiftCounterKey =
  | 'weekdayEveningShifts'
  | 'weekdayNightShifts'
  | 'fridayMorningShifts'
  | 'fridayAfternoonShifts'
  | 'fridayNightShifts'
  | 'saturdayMorningShifts'
  | 'saturdayAfternoonShifts'
  | 'saturdayNightShifts';
/**
 * פעולה normalizeTimeValue: חיתוך ערך השעה לחמשת התווים הראשונים, בפורמט HH:mm.
 * @param value — ערך.
 * @returns string — הפלט בהתאם לחתימה.
 */
function normalizeTimeValue(
  value: string,
): string {
  return value.slice(0, 5);
}

/**
 * פעולה createShiftDateTime: חיבור תאריך ושעה ל־Date וזריקת שגיאה אם התאריך שהתקבל אינו תקין.
 * @param dateValue — תאריך / ערך.
 * @param timeValue — זמן / ערך.
 * @returns Date — הפלט בהתאם לחתימה.
 */
function createShiftDateTime(
  dateValue: string,
  timeValue: string,
): Date {
  // normalizedTime — זמן.
  const normalizedTime =
    normalizeTimeValue(timeValue);

  // result — תוצאה.
  const result =
    new Date(
      `${dateValue}T${normalizedTime}:00`,
    );

  // עצירת הפעולה עם שגיאה כאשר Number.isNaN( result.getTime(), ).
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

/**
 * פעולה normalizeScheduleType: מיפוי סוג היום לקטגוריית משמרת שבה משתמש מנוע השיבוץ.
 * @param value — ערך.
 * @returns SchedulingShiftCategory — הפלט בהתאם לחתימה.
 */
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

/**
 * פעולה isNightShift: זיהוי משמרת לילה לפי זמני המשמרת שנבדקים בגוף הפונקציה.
 * @param shift — משמרת.
 * @returns boolean — הפלט בהתאם לחתימה.
 */
function isNightShift(
  shift:
    AssignmentCandidateShift,
): boolean {
  // startTime — שעת התחלה.
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

/**
 * פעולה isHolidayShift: בדיקת תנאי עבור חג / משמרת.
 * @param shift — משמרת.
 * @returns boolean — הפלט בהתאם לחתימה.
 */
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
/**
 * פעולה isFridayShift: בדיקת תנאי עבור משמרת.
 * @param shift — משמרת.
 * @returns boolean — הפלט בהתאם לחתימה.
 */
function isFridayShift(
  shift: SchedulingShift,
): boolean {
  return (
    shift.weekdayName === 'שישי' ||
    shift.scheduleType ===
      'friday'
  );
}

/**
 * פעולה isSaturdayShift: בדיקת תנאי עבור משמרת.
 * @param shift — משמרת.
 * @returns boolean — הפלט בהתאם לחתימה.
 */
function isSaturdayShift(
  shift: SchedulingShift,
): boolean {
  return (
    shift.weekdayName === 'שבת' ||
    shift.scheduleType ===
      'saturday'
  );
}

/**
 * פעולה getDetailedShiftCounterKey: בחירת מפתח מונה מפורט לפי סוג היום ושעת המשמרת.
 * @param shift — משמרת.
 * @returns DetailedShiftCounterKey | null — הפלט בהתאם לחתימה.
 */
function getDetailedShiftCounterKey(
  shift: SchedulingShift,
): DetailedShiftCounterKey | null {
  // startTime — שעת התחלה.
  const startTime =
    normalizeTimeValue(
      shift.startTime,
    );

  // endTime — שעת סיום.
  const endTime =
    normalizeTimeValue(
      shift.endTime,
    );

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר isFridayShift(shift).
  if (isFridayShift(shift)) {
    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר startTime === '06:00' && endTime === '14:00'.
    if (
      startTime === '06:00' &&
      endTime === '14:00'
    ) {
      return 'fridayMorningShifts';
    }

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר startTime === '14:00' && endTime === '22:00'.
    if (
      startTime === '14:00' &&
      endTime === '22:00'
    ) {
      return 'fridayAfternoonShifts';
    }

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר startTime === '22:00' && endTime === '06:00'.
    if (
      startTime === '22:00' &&
      endTime === '06:00'
    ) {
      return 'fridayNightShifts';
    }

    return null;
  }

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר isSaturdayShift(shift).
  if (isSaturdayShift(shift)) {
    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר startTime === '06:00' && endTime === '14:00'.
    if (
      startTime === '06:00' &&
      endTime === '14:00'
    ) {
      return 'saturdayMorningShifts';
    }

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר startTime === '14:00' && endTime === '22:00'.
    if (
      startTime === '14:00' &&
      endTime === '22:00'
    ) {
      return 'saturdayAfternoonShifts';
    }

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר startTime === '22:00' && endTime === '06:00'.
    if (
      startTime === '22:00' &&
      endTime === '06:00'
    ) {
      return 'saturdayNightShifts';
    }

    return null;
  }

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר startTime === '16:00' && endTime === '23:00'.
  if (
    startTime === '16:00' &&
    endTime === '23:00'
  ) {
    return 'weekdayEveningShifts';
  }

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר startTime === '23:00' && endTime === '06:00'.
  if (
    startTime === '23:00' &&
    endTime === '06:00'
  ) {
    return 'weekdayNightShifts';
  }

  return null;
}

/**
 * פעולה getNightShiftCount: שליפה או חישוב של משמרת / כמות.
 * @param dispatcher — מוקדנים.
 * @returns number — הפלט בהתאם לחתימה.
 */
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

/**
 * פעולה getFridayShiftCount: שליפה או חישוב של משמרת / כמות.
 * @param dispatcher — מוקדנים.
 * @returns number — הפלט בהתאם לחתימה.
 */
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

/**
 * פעולה getSaturdayShiftCount: שליפה או חישוב של משמרת / כמות.
 * @param dispatcher — מוקדנים.
 * @returns number — הפלט בהתאם לחתימה.
 */
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
/**
 * פעולה mapCandidateShift: המרת נתוני משמרת ממקור המועמדים למבנה הפנימי של מנוע השיבוץ.
 * @param shift — משמרת.
 * @returns SchedulingShift — הפלט בהתאם לחתימה.
 */
function mapCandidateShift(
  shift:
    AssignmentCandidateShift,
): SchedulingShift {
  // startsAt — מועד התחלה.
  const startsAt =
    createShiftDateTime(
      shift.date,
      shift.startTime,
    );

  // endsAt — מועד סיום.
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

/**
 * פעולה shiftsOverlap: בדיקת חפיפה בין טווחי הזמנים של שתי משמרות.
 * @param firstShift — משמרת.
 * @param secondShift — משמרת.
 * @returns boolean — הפלט בהתאם לחתימה.
 */
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

/**
 * פעולה shiftsTouch: בדיקת הצמדה בין סוף משמרת אחת לתחילת האחרת.
 * @param firstShift — משמרת.
 * @param secondShift — משמרת.
 * @returns boolean — הפלט בהתאם לחתימה.
 */
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

/**
 * פעולה getAssignedShiftsForDispatcher: איתור פרטי המשמרות שכבר הוקצו למוקדן באמצעות מפת המזהים.
 * @param dispatcher — מוקדנים.
 * @param shiftsById — משמרות / מזהה.
 * @returns SchedulingShift[] — הפלט בהתאם לחתימה.
 */
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

/**
 * פעולה checkCandidateEligibility: איסוף סיבות לפסילת מועמד לפי זמינות וחפיפות או משמרות צמודות, בהתאם לתצורה.
 * @param dispatcher — מוקדנים.
 * @param targetShift — יעד / משמרת.
 * @param shiftsById — משמרות / מזהה.
 * @returns CandidateEligibilityResult — הפלט בהתאם לחתימה.
 */
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

  // assignedShifts — משמרות.
  const assignedShifts =
    getAssignedShiftsForDispatcher(
      dispatcher,
      shiftsById,
    );

  // עיבוד כל פריט מתוך assignedShifts בנפרד.
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

/**
 * פעולה createDispatcherMap: בניית מפת מוקדנים ומוני ההקצאות המשמשים לבדיקות ולניקוד.
 * @param data — נתונים.
 * @returns Map< string, SchedulingDispatcher > — הפלט בהתאם לחתימה.
 */
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

  // עיבוד כל פריט מתוך data.shifts בנפרד.
  for (
    const shift
    of data.shifts
  ) {
    shift.availableUserIds.forEach(
      (
        userId,
        index,
      ) => {
        // טיפול במקרה מיוחד ויציאה מוקדמת כאשר dispatchers.has(userId).
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

/**
 * פעולה getCategoryShiftCount: שליפת מונה המשמרות הרלוונטי לקטגוריית המשמרת הנבדקת.
 * @param dispatcher — מוקדנים.
 * @param shift — משמרת.
 * @returns number — הפלט בהתאם לחתימה.
 */
function getCategoryShiftCount(
  dispatcher:
    SchedulingDispatcher,

  shift:
    SchedulingShift,
): number {
  // counterKey — מפתח.
  const counterKey =
    getDetailedShiftCounterKey(
      shift,
    );

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר counterKey.
  if (counterKey) {
    return dispatcher
      .counters[counterKey];
  }

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר shift.isPremium.
  if (shift.isPremium) {
    return dispatcher
      .counters
      .premiumShifts;
  }

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר isHolidayShift(shift).
  if (isHolidayShift(shift)) {
    return dispatcher
      .counters
      .holidayShifts;
  }

  return 0;
}

/**
 * פעולה updateDispatcherCounters: עדכון מוני הקטגוריות ורשימת מזהי המשמרות לאחר הקצאה.
 * @param dispatcher — מוקדנים.
 * @param shift — משמרת.
 * @returns void — הפלט בהתאם לחתימה.
 */
function updateDispatcherCounters(
  dispatcher:
    SchedulingDispatcher,

  shift:
    SchedulingShift,
): void {
  dispatcher.counters.totalShifts +=
    1;

  // detailedCounterKey — מפתח.
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

/**
 * פעולה getMaximumCounter: חישוב הערך המרבי של מונה נבחר באוכלוסיית המועמדים.
 * @param dispatchers — הנתון dispatchers בהקשר הפעולה.
 * @param selector — הנתון selector בהקשר הפעולה.
 * @returns number — הפלט בהתאם לחתימה.
 */
function getMaximumCounter(
  dispatchers:
    SchedulingDispatcher[],

  selector: (
    dispatcher:
      SchedulingDispatcher,
  ) => number,
): number {
  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר dispatchers.length === 0.
  if (
    dispatchers.length === 0
  ) {
    return 0;
  }

  return Math.max(
    ...dispatchers.map(selector),
  );
}

/**
 * פעולה calculateCandidateScore: חישוב ניקוד מועמד החל מציון בסיס, עם בונוסים ומשקלים לאיזון והסבר לכל רכיב ניקוד.
 * @param dispatcher — מוקדנים.
 * @param targetShift — יעד / משמרת.
 * @param eligibleDispatchers — הנתון eligibleDispatchers בהקשר הפעולה.
 * @returns CandidateScoreResult — הפלט בהתאם לחתימה.
 */
function calculateCandidateScore(
  dispatcher:
    SchedulingDispatcher,

  targetShift:
    SchedulingShift,

  eligibleDispatchers:
    SchedulingDispatcher[],
): CandidateScoreResult {
  const reasons: string[] = [];

  // score — ניקוד.
  let score = 100;

  const {
    weights,
  } = schedulingEngineConfig;

  // maximumTotalShifts — סך הכול / משמרות.
  const maximumTotalShifts =
    getMaximumCounter(
      eligibleDispatchers,
      (candidate) =>
        candidate.counters
          .totalShifts,
    );

  // totalShiftDifference — סך הכול / משמרת.
  const totalShiftDifference =
    maximumTotalShifts -
    dispatcher.counters
      .totalShifts;

  if (
    totalShiftDifference > 0
  ) {
    // totalBalanceBonus — סך הכול.
    const totalBalanceBonus =
      totalShiftDifference *
      weights.totalShiftBalance;

    score +=
      totalBalanceBonus;

    reasons.push(
      `איזון משמרות כולל: +${totalBalanceBonus}.`,
    );
  }

  // maximumCategoryShifts — משמרות.
  const maximumCategoryShifts =
    getMaximumCounter(
      eligibleDispatchers,
      (candidate) =>
        getCategoryShiftCount(
          candidate,
          targetShift,
        ),
    );

  // categoryShiftCount — משמרת / כמות.
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
    // maximumNightShifts — משמרות.
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
    // maximumFridayShifts — משמרות.
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
    // maximumSaturdayShifts — משמרות.
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
    // maximumPremiumShifts — תעריף מוגדל / משמרות.
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
    // maximumHolidayShifts — חג / משמרות.
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

/**
 * פעולה createStableTieBreaker: חישוב hash דטרמיניסטי מצמד מזהי משמרת ומשתמש לצורך הכרעה עקבית בשוויון.
 * @param shiftId — מזהה המשמרת.
 * @param userId — מזהה משתמש.
 * @returns number — הפלט בהתאם לחתימה.
 */
function createStableTieBreaker(
  shiftId: string,
  userId: string,
): number {
  // value — ערך.
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

/**
 * פעולה compareScoredCandidates: מיון מועמדים לפי ניקוד ולאחריו כללי הכרעה ומוני השיבוץ המפורטים בגוף הפונקציה.
 * @param first — הנתון first בהקשר הפעולה.
 * @param second — הנתון second בהקשר הפעולה.
 * @param dispatchers — הנתון dispatchers בהקשר הפעולה.
 * @param shift — משמרת.
 * @returns number — הפלט בהתאם לחתימה.
 */
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
  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר first.score !== second.score.
  if (
    first.score !==
    second.score
  ) {
    return (
      second.score -
      first.score
    );
  }

  // firstDispatcher — מוקדנים.
  const firstDispatcher =
    dispatchers.get(
      first.userId,
    );

  // secondDispatcher — מוקדנים.
  const secondDispatcher =
    dispatchers.get(
      second.userId,
    );

  if (
    firstDispatcher &&
    secondDispatcher
  ) {
    // totalDifference — סך הכול.
    const totalDifference =
      firstDispatcher
        .counters
        .totalShifts -
      secondDispatcher
        .counters
        .totalShifts;

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר totalDifference !== 0.
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

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר categoryDifference !== 0.
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

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר nightDifference !== 0.
    if (
      nightDifference !== 0
    ) {
      return nightDifference;
    }

    // premiumDifference — תעריף מוגדל.
    const premiumDifference =
      firstDispatcher
        .counters
        .premiumShifts -
      secondDispatcher
        .counters
        .premiumShifts;

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר premiumDifference !== 0.
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

/**
 * פעולה assignSingleCandidateShift: טיפול במשמרת בעלת מועמד יחיד תוך בדיקת תנאי ההקצאה ועדכון תוצאת השיבוץ.
 * @param shift — משמרת.
 * @param dispatchers — הנתון dispatchers בהקשר הפעולה.
 * @param shiftsById — משמרות / מזהה.
 * @returns { assignment: SchedulingAssignment | null; issue: SchedulingIssue | null; } — הפלט בהתאם לחתימה.
 */
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
  // assignment — הקצאה.
  assignment:
    SchedulingAssignment | null;

  issue:
    SchedulingIssue | null;
} {
  // userId — מזהה משתמש.
  const userId =
    shift.soleAvailableUserId;

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !userId.
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

  // dispatcher — מוקדנים.
  const dispatcher =
    dispatchers.get(userId);

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !dispatcher.
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

  // eligibility — כשירות לשיבוץ.
  const eligibility =
    checkCandidateEligibility(
      dispatcher,
      shift,
      shiftsById,
    );

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !eligibility.isEligible.
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

/**
 * פעולה assignMultipleCandidateShift: בחינת מועמדים מרובים למשמרת ובחירת מועמד בהתאם לכשירות ולניקוד.
 * @param shift — משמרת.
 * @param dispatchers — הנתון dispatchers בהקשר הפעולה.
 * @param shiftsById — משמרות / מזהה.
 * @returns { assignment: SchedulingAssignment | null; issue: SchedulingIssue | null; } — הפלט בהתאם לחתימה.
 */
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
  // assignment — הקצאה.
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

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר eligibleDispatchers.length === 0.
  if (
    eligibleDispatchers.length ===
    0
  ) {
    const blockedReasons =
      shift.availableUserIds
        .map((userId) => {
          // dispatcher — מוקדנים.
          const dispatcher =
            dispatchers.get(userId);

          // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !dispatcher.
          if (!dispatcher) {
            return `${userId}: המוקדן לא נמצא במנוע.`;
          }

          // eligibility — כשירות לשיבוץ.
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

  // selectedCandidate — נבחר.
  const selectedCandidate =
    scoredCandidates[0];

  // selectedDispatcher — נבחר / מוקדנים.
  const selectedDispatcher =
    dispatchers.get(
      selectedCandidate.userId,
    );

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !selectedDispatcher.
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

/**
 * פעולה sortShiftsForInitialProcessing: קביעת סדר עיבוד המשמרות לפני הקצאת עובדים.
 * @param shifts — משמרות.
 * @returns SchedulingShift[] — הפלט בהתאם לחתימה.
 */
function sortShiftsForInitialProcessing(
  shifts:
    SchedulingShift[],
): SchedulingShift[] {
  // statePriority — מצב.
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
      // stateDifference — מצב.
      const stateDifference =
        statePriority[
          firstShift.assignmentState
        ] -
        statePriority[
          secondShift.assignmentState
        ];

      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר stateDifference !== 0.
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

      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר candidateDifference !== 0.
      if (
        candidateDifference !== 0
      ) {
        return candidateDifference;
      }

      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר firstShift.isPremium !== secondShift.isPremium.
      if (
        firstShift.isPremium !==
        secondShift.isPremium
      ) {
        return firstShift.isPremium
          ? -1
          : 1;
      }

      // dateDifference — תאריך.
      const dateDifference =
        firstShift.startsAt.getTime() -
        secondShift.startsAt.getTime();

      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר dateDifference !== 0.
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
/**
 * פעולה createDispatcherSummaries: המרת מצב המוקדנים והמונים לסיכומי טיוטת השיבוץ.
 * @param dispatchers — הנתון dispatchers בהקשר הפעולה.
 * @returns SchedulingDispatcherSummary[] — הפלט בהתאם לחתימה.
 */
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
/**
 * פעולה buildSchedulingDraft: הרכבת טיוטת השיבוץ, ההקצאות, סיכומי העובדים ורשימת הבעיות.
 * @param data — נתונים.
 * @returns SchedulingDraft — הפלט בהתאם לחתימה.
 */
function buildSchedulingDraft(
  data:
    AssignmentCandidatesData,
): SchedulingDraft {
  // shifts — משמרות.
  const shifts =
    data.shifts.map(
      mapCandidateShift,
    );

  // shiftsById — משמרות / מזהה; מיפוי לחיפוש לפי מפתח.
  const shiftsById =
    new Map(
      shifts.map(
        (shift) => [
          shift.id,
          shift,
        ],
      ),
    );

  // עצירת הפעולה עם שגיאה כאשר shiftsById.size !== shifts.length.
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

  // assignments — הקצאות.
  const assignments:
    SchedulingAssignment[] = [];

  const issues:
    SchedulingIssue[] = [];

  // unassignedShiftIds — מזהה המשמרת.
  const unassignedShiftIds:
    string[] = [];

  // sortedShifts — משמרות.
  const sortedShifts =
    sortShiftsForInitialProcessing(
      shifts,
    );

  // עיבוד כל פריט מתוך sortedShifts בנפרד.
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
      // result — תוצאה.
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

    // result — תוצאה.
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

// autoSchedulingEngine — הנתון autoSchedulingEngine בהקשר הפעולה.
export const autoSchedulingEngine = {
  buildSchedulingDraft,
  checkCandidateEligibility,
  calculateCandidateScore,
  shiftsOverlap,
  shiftsTouch,
};