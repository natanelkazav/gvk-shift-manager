/**
 * קובץ: src/pages/SchedulePage.tsx
 * מטרה: מימוש מסך המשתמש עבור שיבוץ.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: ScheduleDisplayMode, ScheduleMonthSelection, getCurrentMonthSelection, getMonthSelectionFromSearchParams, moveMonth, isSameMonth, normalizeScheduleType, mapHistoricalShift, getScheduleStatusLabel, formatDate ועוד.
 * - קישור מאפיינים ומצב מקומי לתצוגה ולטיפול בפעולות המשתמש.
 */
import {
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  LayoutList,
  Pencil,
  Clock3,
  Crown,
  RefreshCw,
  Send,
  Sparkles,
  UserRound,
  Users,
  X,
} from 'lucide-react';

import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  useSearchParams,
} from 'react-router-dom';

import {
  Button,
  PageHeader,
} from '../components/ui';

import MonthCalendar
  from '../components/calendar/MonthCalendar';

import ScheduleShiftEditModal
  from '../components/schedule/ScheduleShiftEditModal';

import ScheduleDraftOverview
  from '../components/schedule/ScheduleDraftOverview';

import {
  useAuth,
} from '../auth/AuthContext';

import {
  useSchedule,
} from '../hooks/useSchedule';

import {
  useCalendarHolidays,
} from '../hooks/useCalendarHolidays';

import {
  scheduleService,
} from '../services/scheduleService';

import type {
  DispatcherMonthlyStatistics,
  ScheduleEditDispatcher,
  ScheduleShift,
  ScheduleShiftType,
  ScheduleViewMode,
} from '../types/schedule';

import type {
  DispatcherScheduleMonthData,
  DispatcherScheduleMonthShift,
} from '../types/unifiedSchedule';

import '../styles/schedule.css';

/**
 * טיפוס ScheduleDisplayMode: שיבוץ / מצב פעולה.
 */
type ScheduleDisplayMode =
  | 'calendar'
  | 'list';

/**
 * חוזה הנתונים ScheduleMonthSelection: שיבוץ / חודש / בחירה.
 */
interface ScheduleMonthSelection {
  // year — שנה.
  year: number;
  // month — חודש.
  month: number;
}

// validScheduleTypes — סוג יום השיבוץ; אוסף ערכים ייחודיים.
const validScheduleTypes =
  new Set<ScheduleShiftType>([
    'weekday',
    'friday',
    'saturday',
    'holiday_eve',
    'holiday_full',
    'holiday_end',
    'chol_hamoed',
  ]);

/**
 * פעולה getCurrentMonthSelection: שליפה או חישוב של חודש / בחירה.
 * @returns ScheduleMonthSelection — הפלט בהתאם לחתימה.
 */
function getCurrentMonthSelection():
  ScheduleMonthSelection {
  const now =
    new Date();

  return {
    year:
      now.getFullYear(),

    month:
      now.getMonth() + 1,
  };
}

/**
 * פעולה getMonthSelectionFromSearchParams: שליפה או חישוב של חודש / בחירה.
 * @param searchParams — הנתון searchParams בהקשר הפעולה.
 * @returns ScheduleMonthSelection — הפלט בהתאם לחתימה.
 */
function getMonthSelectionFromSearchParams(
  searchParams: URLSearchParams,
): ScheduleMonthSelection {
  const fallback =
    getCurrentMonthSelection();

  // year — שנה.
  const year =
    Number(
      searchParams.get('year'),
    );

  // month — חודש.
  const month =
    Number(
      searchParams.get('month'),
    );

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !Number.isInteger(year) || year < 2020 || year > 2100 || !Number.isInteger(month) || month < 1 || month > 12.
  if (
    !Number.isInteger(year) ||
    year < 2020 ||
    year > 2100 ||
    !Number.isInteger(month) ||
    month < 1 ||
    month > 12
  ) {
    return fallback;
  }

  return {
    year,
    month,
  };
}

/**
 * פעולה moveMonth: חודש.
 * @param selection — בחירה.
 * @param offset — מיקום תחילת התוצאות.
 * @returns ScheduleMonthSelection — הפלט בהתאם לחתימה.
 */
function moveMonth(
  selection:
    ScheduleMonthSelection,
  offset: number,
): ScheduleMonthSelection {
  // date — תאריך.
  const date =
    new Date(
      selection.year,
      selection.month - 1 + offset,
      1,
      12,
      0,
      0,
      0,
    );

  return {
    year:
      date.getFullYear(),

    month:
      date.getMonth() + 1,
  };
}

/**
 * פעולה isSameMonth: בדיקת תנאי עבור חודש.
 * @param first — הנתון first בהקשר הפעולה.
 * @param second — הנתון second בהקשר הפעולה.
 * @returns boolean — הפלט בהתאם לחתימה.
 */
function isSameMonth(
  first:
    ScheduleMonthSelection,
  second:
    ScheduleMonthSelection,
): boolean {
  return (
    first.year ===
      second.year &&
    first.month ===
      second.month
  );
}

/**
 * פעולה normalizeScheduleType: מיפוי סוג היום לקטגוריית משמרת שבה משתמש מנוע השיבוץ.
 * @param value — ערך.
 * @returns ScheduleShiftType — הפלט בהתאם לחתימה.
 */
function normalizeScheduleType(
  value: string,
): ScheduleShiftType {
  return validScheduleTypes.has(
    value as
      ScheduleShiftType,
  )
    ? value as
        ScheduleShiftType
    : 'weekday';
}

/**
 * פעולה mapHistoricalShift: מיפוי מפת התאמה / נתונים היסטוריים / משמרת.
 * @param shift — משמרת.
 * @returns ScheduleShift — הפלט בהתאם לחתימה.
 */
function mapHistoricalShift(
  shift:
    DispatcherScheduleMonthShift,
): ScheduleShift {
  const now =
    Date.now();

  // startsAt — מועד התחלה.
  const startsAt =
    new Date(
      shift.startsAt,
    ).getTime();

  // endsAt — מועד סיום.
  const endsAt =
    new Date(
      shift.endsAt,
    ).getTime();

  // progressState — מצב.
  const progressState =
    Number.isFinite(
      startsAt,
    ) &&
    Number.isFinite(
      endsAt,
    )
      ? now >=
          startsAt &&
        now <
          endsAt
        ? 'current'
        : now >=
            endsAt
          ? 'completed'
          : 'upcoming'
      : 'completed';

  return {
    id:
      shift.id,

    periodId:
      shift.periodId,

    availabilityShiftSlotId:
      null,

    shiftDate:
      shift.shiftDate,

    startsAt:
      shift.startsAt,

    endsAt:
      shift.endsAt,

    shiftCode:
      shift.shiftCode,

    scheduleType:
      normalizeScheduleType(
        shift.scheduleType,
      ),

    isPremium:
      shift.isPremium,

    holidayName:
      shift.holidayName,

    assignedUser:
      shift.assignedUserId
        ? {
            id:
              shift.assignedUserId,

            displayName:
              shift.assignedUserName ??
              '',

            scheduleName:
              shift.assignedUserName,

            role:
              'dispatcher',
          }
        : null,

    assignmentSource:
      null,

    assignmentScore:
      null,

    assignmentReasons:
      [],

    isIntentionallyUnassigned:
      shift.isIntentionallyUnassigned,

    isLocked:
      shift.isLocked,

    notes:
      shift.notes,

    progressState,
  };
}

// hebrewMonths — חודשים.
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

// scheduleStatusLabels — שיבוץ / סטטוס.
const scheduleStatusLabels = {
  draft: 'טיוטה',
  collecting_availability:
    'איסוף אילוצים',
  scheduling: 'בהכנת שיבוץ',
  published: 'פורסם',
  archived: 'בארכיון',
} as const;

/**
 * פעולה getScheduleStatusLabel: שליפה או חישוב של שיבוץ / סטטוס / תווית.
 * @param status — סטטוס.
 * @returns string — הפלט בהתאם לחתימה.
 */
function getScheduleStatusLabel(
  status: string,
): string {
  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר status in scheduleStatusLabels.
  if (
    status in
    scheduleStatusLabels
  ) {
    return scheduleStatusLabels[
      status as keyof typeof scheduleStatusLabels
    ];
  }

  return status;
}

/**
 * פעולה formatDate: עיצוב ערך לתצוגה עבור תאריך.
 * @param value — ערך.
 * @returns string — הפלט בהתאם לחתימה.
 */
function formatDate(
  value: string,
): string {
  // date — תאריך.
  const date =
    new Date(
      `${value}T12:00:00`,
    );

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר Number.isNaN( date.getTime(), ).
  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return value;
  }

  return new Intl.DateTimeFormat(
    'he-IL',
    {
      weekday: 'long',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      timeZone:
        'Asia/Jerusalem',
    },
  ).format(date);
}

/**
 * פעולה formatTime: עיצוב ערך לתצוגה עבור זמן.
 * @param value — ערך.
 * @returns string — הפלט בהתאם לחתימה.
 */
function formatTime(
  value: string,
): string {
  // date — תאריך.
  const date =
    new Date(value);

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר Number.isNaN( date.getTime(), ).
  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return value;
  }

  return new Intl.DateTimeFormat(
    'he-IL',
    {
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
      timeZone:
        'Asia/Jerusalem',
    },
  ).format(date);
}

/**
 * פעולה formatHours: עיצוב ערך לתצוגה עבור שעות.
 * @param value — ערך.
 * @returns string — הפלט בהתאם לחתימה.
 */
function formatHours(
  value: number,
): string {
  // roundedValue — ערך.
  const roundedValue =
    Math.round(
      value * 10,
    ) / 10;

  return `${roundedValue} שעות`;
}

/**
 * פעולה getShiftTimeLabel: שליפה או חישוב של משמרת / זמן / תווית.
 * @param shift — משמרת.
 * @returns string — הפלט בהתאם לחתימה.
 */
function getShiftTimeLabel(
  shift: ScheduleShift,
): string {
  return (
    `${formatTime(
      shift.startsAt,
    )}–` +
    `${formatTime(
      shift.endsAt,
    )}`
  );
}

/**
 * פעולה getShiftTypeLabel: שליפה או חישוב של משמרת / תווית.
 * @param shift — משמרת.
 * @returns string — הפלט בהתאם לחתימה.
 */
function getShiftTypeLabel(
  shift: ScheduleShift,
): string {
  // startTime — שעת התחלה.
  const startTime =
    formatTime(
      shift.startsAt,
    );

  switch (
    shift.scheduleType
  ) {
    case 'weekday':
      return startTime ===
        '16:00'
        ? 'ערב יום חול'
        : 'לילה יום חול';

    case 'friday':
      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר startTime === '06:00'.
      if (
        startTime ===
        '06:00'
      ) {
        return 'שישי בוקר';
      }

      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר startTime === '14:00'.
      if (
        startTime ===
        '14:00'
      ) {
        return 'שישי צהריים';
      }

      return 'שישי לילה';

    case 'saturday':
      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר startTime === '06:00'.
      if (
        startTime ===
        '06:00'
      ) {
        return 'שבת בוקר';
      }

      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר startTime === '14:00'.
      if (
        startTime ===
        '14:00'
      ) {
        return 'שבת צהריים';
      }

      return 'שבת לילה';

    case 'holiday_eve':
      return 'ערב חג';

    case 'holiday_full':
      return 'חג';

    case 'holiday_end':
      return 'מוצאי חג';

    case 'chol_hamoed':
      return 'חול המועד';

    default:
      return 'משמרת';
  }
}

/**
 * פעולה getProgressLabel: שליפה או חישוב של תווית.
 * @param shift — משמרת.
 * @returns string — הפלט בהתאם לחתימה.
 */
function getProgressLabel(
  shift: ScheduleShift,
): string {
  switch (
    shift.progressState
  ) {
    case 'completed':
      return 'הושלמה';

    case 'current':
      return 'מתקיימת כעת';

    case 'upcoming':
      return 'עתידית';

    default:
      return '';
  }
}

/**
 * פעולה findNextShift: איתור משמרת.
 * @param shifts — משמרות.
 * @returns ScheduleShift | null — הפלט בהתאם לחתימה.
 */
function findNextShift(
  shifts:
    ScheduleShift[],
): ScheduleShift | null {
  // relevantShifts — משמרות.
  const relevantShifts =
    shifts
      .filter(
        (shift) =>
          shift.progressState ===
            'current' ||
          shift.progressState ===
            'upcoming',
      )
      .sort(
        (
          firstShift,
          secondShift,
        ) =>
          new Date(
            firstShift.startsAt,
          ).getTime() -
          new Date(
            secondShift.startsAt,
          ).getTime(),
      );

  return (
    relevantShifts[0] ??
    null
  );
}

/**
 * פעולה groupShiftsByDate: קיבוץ קבוצה / משמרות / תאריך.
 * @param shifts — משמרות.
 * @returns Array<{ date: string; shifts: ScheduleShift[]; }> — הפלט בהתאם לחתימה.
 */
function groupShiftsByDate(
  shifts:
    ScheduleShift[],
): Array<{
  // date — תאריך.
  date: string;

  // shifts — משמרות.
  shifts:
    ScheduleShift[];
}> {
  // groups — קבוצות; מיפוי לחיפוש לפי מפתח.
  const groups =
    new Map<
      string,
      ScheduleShift[]
    >();

  // עיבוד כל פריט מתוך shifts בנפרד.
  for (
    const shift
    of shifts
  ) {
    const existing =
      groups.get(
        shift.shiftDate,
      ) ?? [];

    existing.push(
      shift,
    );

    groups.set(
      shift.shiftDate,
      existing,
    );
  }

  return Array.from(
    groups.entries(),
  )
    .map(
      ([
        date,
        dateShifts,
      ]) => ({
        date,

        shifts: [
          ...dateShifts,
        ].sort(
          (
            firstShift,
            secondShift,
          ) =>
            new Date(
              firstShift.startsAt,
            ).getTime() -
            new Date(
              secondShift.startsAt,
            ).getTime(),
        ),
      }),
    )
    .sort(
      (
        firstGroup,
        secondGroup,
      ) =>
        firstGroup.date
          .localeCompare(
            secondGroup.date,
          ),
    );
}

/**
 * פעולה createShiftsByDateMap: יצירת משמרות / תאריך / מפת התאמה.
 * @param shifts — משמרות.
 * @returns Map< string, ScheduleShift[] > — הפלט בהתאם לחתימה.
 */
function createShiftsByDateMap(
  shifts:
    ScheduleShift[],
): Map<
  string,
  ScheduleShift[]
> {
  // shiftsByDate — משמרות / תאריך; מיפוי לחיפוש לפי מפתח.
  const shiftsByDate =
    new Map<
      string,
      ScheduleShift[]
    >();

  // עיבוד כל פריט מתוך shifts בנפרד.
  for (
    const shift
    of shifts
  ) {
    // existingShifts — משמרות.
    const existingShifts =
      shiftsByDate.get(
        shift.shiftDate,
      ) ?? [];

    existingShifts.push(
      shift,
    );

    shiftsByDate.set(
      shift.shiftDate,
      existingShifts,
    );
  }

  // עיבוד כל פריט מתוך shiftsByDate בנפרד.
  for (
    const [
      date,
      dateShifts,
    ]
    of shiftsByDate
  ) {
    shiftsByDate.set(
      date,
      [
        ...dateShifts,
      ].sort(
        (
          firstShift,
          secondShift,
        ) =>
          new Date(
            firstShift.startsAt,
          ).getTime() -
          new Date(
            secondShift.startsAt,
          ).getTime(),
      ),
    );
  }

  return shiftsByDate;
}

/**
 * פעולה MonthlyProgressCard: הנתון MonthlyProgressCard בהקשר הפעולה.
 * פרמטר מפורק — שדות הקלט נגישים מקומית בשמות המוגדרים בחתימה.
 */
function MonthlyProgressCard({
  statistics,
}: {
  // statistics — סטטיסטיקה.
  statistics:
    DispatcherMonthlyStatistics;
}) {
  return (
    <article className="schedule-progress-card">
      <div className="schedule-progress-card-header">
        <div>
          <span>
            התקדמות חודשית
          </span>

          <strong>
            {
              statistics
                .completedShifts
            }{' '}
            מתוך{' '}
            {
              statistics
                .totalShifts
            }{' '}
            משמרות
          </strong>
        </div>

        <div className="schedule-progress-percentage">
          {
            statistics
              .completionPercentage
          }
          %
        </div>
      </div>

      <div
        className="schedule-progress-track"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={
          statistics
            .completionPercentage
        }
      >
        <div
          className="schedule-progress-fill"
          style={{
            width:
              `${Math.min(
                100,
                Math.max(
                  0,
                  statistics
                    .completionPercentage,
                ),
              )}%`,
          }}
        />
      </div>

      <div className="schedule-progress-details">
        <span>
          הושלמו{' '}
          <strong>
            {
              statistics
                .completedHours
            }
          </strong>{' '}
          שעות
        </span>

        <span>
          נותרו{' '}
          <strong>
            {
              statistics
                .remainingHours
            }
          </strong>{' '}
          שעות
        </span>
      </div>
    </article>
  );
}

/**
 * פעולה PersonalStatisticsGrid: סטטיסטיקה.
 * פרמטר מפורק — שדות הקלט נגישים מקומית בשמות המוגדרים בחתימה.
 */
function PersonalStatisticsGrid({
  statistics,
}: {
  // statistics — סטטיסטיקה.
  statistics:
    DispatcherMonthlyStatistics;
}) {
  return (
    <div className="schedule-statistics-grid">
      <article>
        <CalendarDays
          size={21}
          aria-hidden="true"
        />

        <div>
          <strong>
            {
              statistics
                .totalShifts
            }
          </strong>

          <span>
            סך המשמרות
          </span>
        </div>
      </article>

      <article>
        <Clock3
          size={21}
          aria-hidden="true"
        />

        <div>
          <strong>
            {
              statistics
                .weekdayNightShifts
            }
          </strong>

          <span>
            לילות חול
          </span>
        </div>
      </article>

      <article>
        <Users
          size={21}
          aria-hidden="true"
        />

        <div>
          <strong>
            {
              statistics
                .fridayMorningShifts +
              statistics
                .fridayAfternoonShifts +
              statistics
                .fridayNightShifts
            }
          </strong>

          <span>
            משמרות שישי
          </span>
        </div>
      </article>

      <article>
        <Crown
          size={21}
          aria-hidden="true"
        />

        <div>
          <strong>
            {
              statistics
                .saturdayMorningShifts +
              statistics
                .saturdayAfternoonShifts +
              statistics
                .saturdayNightShifts
            }
          </strong>

          <span>
            משמרות שבת
          </span>
        </div>
      </article>

      <article>
        <Sparkles
          size={21}
          aria-hidden="true"
        />

        <div>
          <strong>
            {
              statistics
                .premiumShifts
            }
          </strong>

          <span>
            משמרות 200%
          </span>
        </div>
      </article>

      <article>
        <Clock3
          size={21}
          aria-hidden="true"
        />

        <div>
          <strong>
            {
              statistics
                .totalScheduledHours
            }
          </strong>

          <span>
            שעות מתוכננות
          </span>
        </div>
      </article>
    </div>
  );
}

/**
 * פעולה ScheduleShiftCard: שיבוץ / משמרת.
 * פרמטר מפורק — שדות הקלט נגישים מקומית בשמות המוגדרים בחתימה.
 */
function ScheduleShiftCard({
  shift,
  showAssignedUser,
  onEdit,
  availabilityLabel,
}: {
  // shift — משמרת.
  shift:
    ScheduleShift;

  // showAssignedUser — משתמש.
  showAssignedUser:
    boolean;

  onEdit?:
    () => void;

  // availabilityLabel — אילוצים וזמינות / תווית (אופציונלי).
  availabilityLabel?: string | null;
}) {
  return (
    <article
      className={[
        'schedule-shift-card',

        `schedule-shift-card-${shift.progressState}`,

        shift.isPremium
          ? 'schedule-shift-card-premium'
          : '',

        !shift.assignedUser
          ? 'schedule-shift-card-unassigned'
          : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="schedule-shift-card-main">
        <div>
          <strong dir="ltr">
            {getShiftTimeLabel(
              shift,
            )}
          </strong>

          <span>
            {getShiftTypeLabel(
              shift,
            )}
          </span>
        </div>

        <span
          className={`schedule-shift-progress-badge schedule-shift-progress-badge-${shift.progressState}`}
        >
          {getProgressLabel(
            shift,
          )}
        </span>
      </div>

      <div className="schedule-shift-card-badges">
        {shift.isPremium ? (
          <span className="schedule-shift-premium-badge">
            <Sparkles
              size={13}
              aria-hidden="true"
            />

            200%
          </span>
        ) : null}

        {shift.holidayName ? (
          <span className="schedule-shift-holiday-badge">
            {
              shift
                .holidayName
            }
          </span>
        ) : null}

        {shift.isLocked ? (
          <span>
            נעולה
          </span>
        ) : null}
      </div>

      {showAssignedUser ? (
        <div
          className={[
            'schedule-shift-assigned-user',
            !shift.assignedUser
              ? 'schedule-shift-assigned-user-unassigned'
              : '',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          <UserRound
            size={17}
            aria-hidden="true"
          />

          <div>
            <span>
              מוקדן
            </span>

            <strong>
              {shift
                .assignedUser
                ?.scheduleName ??
                shift
                  .assignedUser
                  ?.displayName ??
                'משמרת לא מאוישת'}
            </strong>
          </div>
        </div>
      ) : null}

      {availabilityLabel ? (
        <div className="schedule-shift-candidate-summary">
          {availabilityLabel}
        </div>
      ) : null}

      {onEdit ? (
        <div className="schedule-shift-edit-actions">
          <Button
            type="button"
            variant="secondary"
            onClick={onEdit}
          >
            <Pencil
              size={16}
              aria-hidden="true"
            />

            עריכת שיבוץ
          </Button>
        </div>
      ) : null}

      {shift.notes ? (
        <p className="schedule-shift-notes">
          {shift.notes}
        </p>
      ) : null}
    </article>
  );
}

/**
 * פעולה SchedulePage: שיבוץ.
 */
function SchedulePage() {
  const [
    searchParams,
    setSearchParams,
  ] =
    useSearchParams();

  const {
    user,
    profile,
    hasPermission,
  } =
    useAuth();

  const {
    state,
    loadCurrentSchedule,
    publishSchedulePeriod,
    clearError,
  } =
    useSchedule();

  // מצב מקומי: viewMode — מצב פעולה; setViewMode מעדכנת אותו ומפעילה רינדור לפי React.
  const [
    viewMode,
    setViewMode,
  ] =
    useState<ScheduleViewMode>(
      'personal',
    );

  // מצב מקומי: displayMode — מצב פעולה; setDisplayMode מעדכנת אותו ומפעילה רינדור לפי React.
  const [
    displayMode,
    setDisplayMode,
  ] =
    useState<ScheduleDisplayMode>(() =>
      searchParams.get('view') === 'list'
        ? 'list'
        : 'calendar',
    );


  // מצב מקומי: selectedMonth — נבחר / חודש; setSelectedMonth מעדכנת אותו ומפעילה רינדור לפי React.
  const [
    selectedMonth,
    setSelectedMonth,
  ] =
    useState<ScheduleMonthSelection>(
      () =>
        getMonthSelectionFromSearchParams(
          searchParams,
        ),
    );

  // holidayLabels — חג.
  const holidayLabels =
    useCalendarHolidays(
      selectedMonth.year,
      selectedMonth.month,
    );

  // מצב מקומי: selectedMonthSchedule — נבחר / חודש / שיבוץ; setSelectedMonthSchedule מעדכנת אותו ומפעילה רינדור לפי React.
  const [
    selectedMonthSchedule,
    setSelectedMonthSchedule,
  ] =
    useState<DispatcherScheduleMonthData | null>(
      null,
    );

  // מצב מקומי: isLoadingSelectedMonth — האם טעינה מתבצעת; setIsLoadingSelectedMonth מעדכנת אותו ומפעילה רינדור לפי React.
  const [
    isLoadingSelectedMonth,
    setIsLoadingSelectedMonth,
  ] =
    useState(false);

  // מצב מקומי: selectedMonthError — נבחר / חודש / שגיאה; setSelectedMonthError מעדכנת אותו ומפעילה רינדור לפי React.
  const [
    selectedMonthError,
    setSelectedMonthError,
  ] =
    useState<string | null>(
      null,
    );

  // מצב מקומי: selectedUserId — מזהה משתמש; setSelectedUserId מעדכנת אותו ומפעילה רינדור לפי React.
  const [
    selectedUserId,
    setSelectedUserId,
  ] =
    useState<
      string | null
    >(null);

  // מצב מקומי: selectedCalendarDate — נבחר / לוח שנה / תאריך; setSelectedCalendarDate מעדכנת אותו ומפעילה רינדור לפי React.
  const [
    selectedCalendarDate,
    setSelectedCalendarDate,
  ] =
    useState<
      string | null
    >(null);

  // מצב מקומי: editingShift — משמרת; setEditingShift מעדכנת אותו ומפעילה רינדור לפי React.
  const [
    editingShift,
    setEditingShift,
  ] =
    useState<
      ScheduleShift | null
    >(null);

  // מצב מקומי: editDispatchers — הנתון editDispatchers בהקשר הפעולה; setEditDispatchers מעדכנת אותו ומפעילה רינדור לפי React.
  const [
    editDispatchers,
    setEditDispatchers,
  ] =
    useState<
      ScheduleEditDispatcher[]
    >([]);

  // מצב מקומי: draftEditContext — טיוטה; setDraftEditContext מעדכנת אותו ומפעילה רינדור לפי React.
  const [
    draftEditContext,
    setDraftEditContext,
  ] = useState<import('../types/schedule').ScheduleDraftEditContext | null>(null);

  // מצב מקומי: isLoadingEditOptions — האם טעינה מתבצעת; setIsLoadingEditOptions מעדכנת אותו ומפעילה רינדור לפי React.
  const [
    isLoadingEditOptions,
    setIsLoadingEditOptions,
  ] =
    useState(false);

  // מצב מקומי: isSavingShiftEdit — האם שמירה מתבצעת; setIsSavingShiftEdit מעדכנת אותו ומפעילה רינדור לפי React.
  const [
    isSavingShiftEdit,
    setIsSavingShiftEdit,
  ] =
    useState(false);

  // מצב מקומי: shiftEditError — משמרת / שגיאה; setShiftEditError מעדכנת אותו ומפעילה רינדור לפי React.
  const [
    shiftEditError,
    setShiftEditError,
  ] =
    useState<
      string | null
    >(null);

  // מצב מקומי: shiftEditSuccess — משמרת; setShiftEditSuccess מעדכנת אותו ומפעילה רינדור לפי React.
  const [
    shiftEditSuccess,
    setShiftEditSuccess,
  ] =
    useState<
      string | null
    >(null);

  // תופעת לוואי לאחר רינדור בהתאם לתלויות [ loadCurrentSchedule, ].
  useEffect(() => {
    void loadCurrentSchedule();
  }, [
    loadCurrentSchedule,
  ]);

  // תופעת לוואי לאחר רינדור בהתאם לתלויות [ state.currentSchedule, ].
  useEffect(() => {
    // currentSchedule — שיבוץ.
    const currentSchedule =
      state.currentSchedule;

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !currentSchedule.
    if (!currentSchedule) {
      return;
    }

    setViewMode(
      currentSchedule
        .access
        .defaultViewMode,
    );

    if (
      currentSchedule
        .dispatcherStatistics
        .length > 0
    ) {
      setSelectedUserId(
        currentSchedule
          .dispatcherStatistics[0]
          .userId,
      );
    }
  }, [
    state.currentSchedule,
  ]);

  // תופעת לוואי לאחר רינדור בהתאם לתלויות [ searchParams, selectedMonth.month, selectedMonth.year, setSearchParams, ].
  useEffect(
    () => {
      // nextYear — שנה.
      const nextYear =
        String(selectedMonth.year);

      // nextMonth — חודש.
      const nextMonth =
        String(selectedMonth.month);

      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר searchParams.get('year') === nextYear && searchParams.get('month') === nextMonth.
      if (
        searchParams.get('year') ===
          nextYear &&
        searchParams.get('month') ===
          nextMonth
      ) {
        return;
      }

      // nextSearchParams — הנתון nextSearchParams בהקשר הפעולה.
      const nextSearchParams =
        new URLSearchParams(
          searchParams,
        );

      nextSearchParams.set(
        'year',
        nextYear,
      );
      nextSearchParams.set(
        'month',
        nextMonth,
      );

      setSearchParams(
        nextSearchParams,
        { replace: true },
      );
    },
    [
      searchParams,
      selectedMonth.month,
      selectedMonth.year,
      setSearchParams,
    ],
  );

  // currentSchedule — שיבוץ.
  const currentSchedule =
    state.currentSchedule;

  // currentMonthSelection — חודש / בחירה.
  const currentMonthSelection =
    getCurrentMonthSelection();

  // isViewingCurrentMonth — חודש.
  const isViewingCurrentMonth =
    isSameMonth(
      selectedMonth,
      currentMonthSelection,
    );

  // currentPeriodValue — תקופה / ערך.
  const currentPeriodValue =
    currentMonthSelection.year * 12 +
    currentMonthSelection.month - 1;

  // selectedPeriodValue — נבחר / תקופה / ערך.
  const selectedPeriodValue =
    selectedMonth.year * 12 +
    selectedMonth.month - 1;

  // isViewingCurrentOrNextMonth — חודש.
  const isViewingCurrentOrNextMonth =
    selectedPeriodValue === currentPeriodValue ||
    selectedPeriodValue === currentPeriodValue + 1;

  // activeDisplayedPeriod — פעיל / תקופה.
  const activeDisplayedPeriod =
    isViewingCurrentMonth
      ? currentSchedule?.period ?? null
      : selectedMonthSchedule?.period ?? null;

  // isDraftDisplayedPeriod — טיוטה / תקופה.
  const isDraftDisplayedPeriod =
    activeDisplayedPeriod?.status === 'draft' ||
    activeDisplayedPeriod?.status === 'scheduling';

  // תופעת לוואי לאחר רינדור בהתאם לתלויות [ isViewingCurrentMonth, selectedMonth.month, selectedMonth.year, ].
  useEffect(
    () => {
      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר isViewingCurrentMonth.
      if (
        isViewingCurrentMonth
      ) {
        setSelectedMonthSchedule(
          null,
        );
        setSelectedMonthError(
          null,
        );
        setIsLoadingSelectedMonth(
          false,
        );
        return;
      }

      // isCancelled — הנתון isCancelled בהקשר הפעולה.
      let isCancelled =
        false;

      /**
       * פעולה אסינכרונית loadSelectedMonth: טעינת נבחר / חודש.
       * @returns Promise<void> — הפלט בהתאם לחתימה.
       */
      const loadSelectedMonth =
        async (): Promise<void> => {
          setIsLoadingSelectedMonth(
            true,
          );
          setSelectedMonthError(
            null,
          );

          // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
          try {
            // data — נתונים.
            const data =
              await scheduleService
                .getScheduleByMonth(
                  selectedMonth.year,
                  selectedMonth.month,
                );

            // טיפול במקרה מיוחד ויציאה מוקדמת כאשר isCancelled.
            if (
              isCancelled
            ) {
              return;
            }

            setSelectedMonthSchedule(
              data,
            );
          } catch (error) {
            // טיפול במקרה מיוחד ויציאה מוקדמת כאשר isCancelled.
            if (
              isCancelled
            ) {
              return;
            }

            setSelectedMonthSchedule(
              null,
            );

            setSelectedMonthError(
              error instanceof Error
                ? error.message
                : 'לא ניתן היה לטעון את השיבוץ לחודש שנבחר.',
            );
          } finally {
            if (
              !isCancelled
            ) {
              setIsLoadingSelectedMonth(
                false,
              );
            }
          }
        };

      void loadSelectedMonth();

      return () => {
        isCancelled =
          true;
      };
    },
    [
      isViewingCurrentMonth,
      selectedMonth.month,
      selectedMonth.year,
    ],
  );

// canEditDisplayedSchedule — האם עריכה מותרת.
const canEditDisplayedSchedule =
  hasPermission(
    'schedule.edit',
  ) &&
  Boolean(activeDisplayedPeriod) &&
  (
    isDraftDisplayedPeriod ||
    (
      isViewingCurrentOrNextMonth &&
      activeDisplayedPeriod?.status === 'published'
    )
  );

  // תופעת לוואי לאחר רינדור בהתאם לתלויות [ activeDisplayedPeriod, hasPermission, isDraftDisplayedPeriod, ].
  useEffect(() => {
    let cancelled = false;

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !hasPermission('schedule.edit') || !activeDisplayedPeriod || !isDraftDisplayedPeriod.
    if (
      !hasPermission('schedule.edit') ||
      !activeDisplayedPeriod ||
      !isDraftDisplayedPeriod
    ) {
      setDraftEditContext(null);
      return;
    }

    /**
     * פעולה אסינכרונית loadDraftContext: טעינת טיוטה.
     * @returns Promise<void> — הפלט בהתאם לחתימה.
     */
    const loadDraftContext = async (): Promise<void> => {
      // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
      try {
        const context = await scheduleService.getScheduleDraftEditContext(
          activeDisplayedPeriod.id,
        );

        if (!cancelled) {
          setDraftEditContext(context);
          setEditDispatchers(context.dispatchers);
        }
      } catch (error) {
        if (!cancelled) {
          setShiftEditError(
            error instanceof Error
              ? error.message
              : 'לא ניתן היה לטעון את נתוני עריכת הטיוטה.',
          );
        }
      }
    };

    void loadDraftContext();

    return () => {
      cancelled = true;
    };
  }, [
    activeDisplayedPeriod,
    hasPermission,
    isDraftDisplayedPeriod,
  ]);


  /**
   * פעולה getEditErrorMessage: שליפה או חישוב של הודעת שגיאה.
   * @param error — שגיאה.
   * @returns string — הפלט בהתאם לחתימה.
   */
  const getEditErrorMessage =
    (error: unknown): string => {
      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר error instanceof Error.
      if (
        error instanceof Error
      ) {
        // message — הודעה.
        const message =
          error.message
            .trim();

        // normalizedMessage — הודעה.
        const normalizedMessage =
          message.toLowerCase();

        // טיפול במקרה מיוחד ויציאה מוקדמת כאשר normalizedMessage.includes( 'overlapping or consecutive', ).
        if (
          normalizedMessage.includes(
            'overlapping or consecutive',
          )
        ) {
          return 'לא ניתן לבצע את השינוי: למוקדן שנבחר קיימת משמרת חופפת או משמרת רצופה אסורה.';
        }

        // טיפול במקרה מיוחד ויציאה מוקדמת כאשר normalizedMessage.includes( 'schedule edit permission required', ).
        if (
          normalizedMessage.includes(
            'schedule edit permission required',
          )
        ) {
          return 'אין לך הרשאה לערוך את השיבוץ.';
        }

        // טיפול במקרה מיוחד ויציאה מוקדמת כאשר normalizedMessage.includes( 'only current or next month schedule', ) || normalizedMessage.includes( 'only current month schedule', ).
        if (
          normalizedMessage.includes(
            'only current or next month schedule',
          ) ||
          normalizedMessage.includes(
            'only current month schedule',
          )
        ) {
          return 'ניתן לערוך במסך זה רק את שיבוץ החודש הנוכחי או החודש הבא.';
        }

        // טיפול במקרה מיוחד ויציאה מוקדמת כאשר normalizedMessage.includes( 'only published current or next month schedule', ) || normalizedMessage.includes( 'only published current schedu.
        if (
          normalizedMessage.includes(
            'only published current or next month schedule',
          ) ||
          normalizedMessage.includes(
            'only published current schedule',
          )
        ) {
          return 'לא ניתן לערוך את השיבוץ במצב הנוכחי.';
        }

        return message;
      }

      return 'לא ניתן היה לעדכן את השיבוץ.';
    };

  /**
   * פעולה אסינכרונית openShiftEditor: פתיחת משמרת.
   * @param shift — משמרת.
   * @returns Promise<void> — הפלט בהתאם לחתימה.
   */
  const openShiftEditor =
    async (
      shift: ScheduleShift,
    ): Promise<void> => {
      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !canEditDisplayedSchedule.
      if (
        !canEditDisplayedSchedule
      ) {
        return;
      }

      setEditingShift(shift);
      setShiftEditError(null);
      setShiftEditSuccess(null);

      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר isDraftDisplayedPeriod && editDispatchers.length > 0.
      if (
        isDraftDisplayedPeriod &&
        editDispatchers.length > 0
      ) {
        return;
      }

      setIsLoadingEditOptions(true);

      // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
      try {
        // options — אפשרויות בחירה.
        const options =
          await scheduleService
            .getCurrentScheduleEditOptions(shift.id);

        setEditDispatchers(
          options.dispatchers,
        );
      } catch (error) {
        setShiftEditError(
          getEditErrorMessage(
            error,
          ),
        );
      } finally {
        setIsLoadingEditOptions(false);
      }
    };

  /**
   * פעולה אסינכרונית refreshDisplayedSchedule: רענון שיבוץ.
   * @returns Promise<void> — הפלט בהתאם לחתימה.
   */
  const refreshDisplayedSchedule =
    async (): Promise<void> => {
      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר isViewingCurrentMonth.
      if (isViewingCurrentMonth) {
        await loadCurrentSchedule();
        return;
      }

      setSelectedMonthSchedule(
        await scheduleService.getScheduleByMonth(
          selectedMonth.year,
          selectedMonth.month,
        ),
      );
    };

  /**
   * פעולה אסינכרונית saveShiftEdit: שמירת משמרת.
   * @param newUserId — מזהה העובד לאחר השינוי.
   * @param reason — הנתון reason בהקשר הפעולה.
   * @returns Promise<void> — הפלט בהתאם לחתימה.
   */
  const saveShiftEdit =
    async (
      newUserId: string,
      reason: string | null,
    ): Promise<void> => {
      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !editingShift || !canEditDisplayedSchedule.
      if (
        !editingShift ||
        !canEditDisplayedSchedule
      ) {
        return;
      }

      setIsSavingShiftEdit(true);
      setShiftEditError(null);
      setShiftEditSuccess(null);

      // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
      try {
        if (isDraftDisplayedPeriod) {
          await scheduleService.updateScheduleDraftShift({
            shiftId: editingShift.id,
            newUserId,
            intentionallyUnassigned: false,
          });

          setShiftEditSuccess('השיבוץ בטיוטה עודכן בהצלחה.');
        } else {
          // result — תוצאה.
          const result =
            await scheduleService.updateCurrentScheduleShift({
              shiftId: editingShift.id,
              newUserId,
              reason,
            });

          setShiftEditSuccess(
            `השיבוץ עודכן בהצלחה ל${result.newUserName}. המוקדנים הרלוונטיים קיבלו התראה.`,
          );
        }

        setEditingShift(null);
        setSelectedCalendarDate(null);
        await refreshDisplayedSchedule();
      } catch (error) {
        setShiftEditError(
          getEditErrorMessage(error),
        );
      } finally {
        setIsSavingShiftEdit(false);
      }
    };

  /**
   * פעולה אסינכרונית markShiftIntentionallyUnassigned: משמרת.
   * @returns Promise<void> — הפלט בהתאם לחתימה.
   */
  const markShiftIntentionallyUnassigned =
    async (): Promise<void> => {
      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !editingShift || !isDraftDisplayedPeriod || !canEditDisplayedSchedule.
      if (
        !editingShift ||
        !isDraftDisplayedPeriod ||
        !canEditDisplayedSchedule
      ) {
        return;
      }

      const confirmed = window.confirm(
        'להשאיר את המשמרת ללא מוקדן?\n\nהמשמרת תסומן במפורש כלא מאוישת וניתן יהיה לפרסם את הלוח.',
      );

      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !confirmed.
      if (!confirmed) {
        return;
      }

      setIsSavingShiftEdit(true);
      setShiftEditError(null);

      // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
      try {
        await scheduleService.updateScheduleDraftShift({
          shiftId: editingShift.id,
          newUserId: null,
          intentionallyUnassigned: true,
        });

        setEditingShift(null);
        setSelectedCalendarDate(null);
        setShiftEditSuccess('המשמרת סומנה כלא מאוישת במכוון.');
        await refreshDisplayedSchedule();
      } catch (error) {
        setShiftEditError(getEditErrorMessage(error));
      } finally {
        setIsSavingShiftEdit(false);
      }
    };

  /**
   * פעולה getDraftCandidateLabel: שליפה או חישוב של טיוטה / תווית.
   * @param shift — משמרת.
   * @returns string | null — הפלט בהתאם לחתימה.
   */
  const getDraftCandidateLabel =
    (shift: ScheduleShift): string | null => {
      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !isDraftDisplayedPeriod || !draftEditContext.
      if (!isDraftDisplayedPeriod || !draftEditContext) {
        return null;
      }

      const context = draftEditContext.shifts.find(
        (item) => item.scheduleShiftId === shift.id,
      );

      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !context.
      if (!context) {
        return null;
      }

      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר context.availableCount === 0.
      if (context.availableCount === 0) {
        return 'אין מוקדנים שסימנו זמינות למשמרת זו';
      }

      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר context.availableCount === 1.
      if (context.availableCount === 1) {
        return 'מוקדן זמין יחיד';
      }

      return `${context.availableCount} מוקדנים סימנו זמינות`;
    };

  /**
   * פעולה getEditingCandidateHint: שליפה או חישוב של הנתון getEditingCandidateHint בהקשר הפעולה.
   * @returns string | null — הפלט בהתאם לחתימה.
   */
  const getEditingCandidateHint = (): string | null => {
    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !editingShift || !draftEditContext.
    if (!editingShift || !draftEditContext) {
      return null;
    }

    const context = draftEditContext.shifts.find(
      (item) => item.scheduleShiftId === editingShift.id,
    );

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !context.
    if (!context) {
      return null;
    }

    return `${context.availableCount} מתוך ${context.totalDispatchers} מוקדנים סימנו זמינות בעצמם למשמרת. הרשימה מסמנת גם מי אינו זמין ומי הושלם אוטומטית עקב אי־הגשה.`;
  };

  /**
   * פעולה getEditingDispatchers: שליפה או חישוב של הנתון getEditingDispatchers בהקשר הפעולה.
   * @returns ScheduleEditDispatcher[] — הפלט בהתאם לחתימה.
   */
  const getEditingDispatchers =
    (): ScheduleEditDispatcher[] => {
      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !editingShift || !isDraftDisplayedPeriod || !draftEditContext.
      if (
        !editingShift ||
        !isDraftDisplayedPeriod ||
        !draftEditContext
      ) {
        return editDispatchers;
      }

      const context =
        draftEditContext.shifts.find(
          (item) =>
            item.scheduleShiftId ===
            editingShift.id,
        );

      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !context.
      if (!context) {
        return editDispatchers;
      }

      return context.candidates.map(
        (candidate) => ({
          id: candidate.userId,
          displayName:
            candidate.displayName,
          scheduleName:
            candidate.scheduleName,
          availabilityStatus:
            candidate.availabilityStatus,
          isAutoCompleted:
            candidate.isAutoCompleted,
        }),
      );
    };


  // isDispatcher — מוקדנים.
  const isDispatcher =
    profile?.role ===
    'dispatcher';

  // pageTitle — כותרת.
  const pageTitle =
    isDispatcher
      ? 'השיבוצים שלי'
      : 'שיבוץ מוקדנים';

  // ערך מחושב selectedDispatcherStatistics — נבחר / מוקדנים / סטטיסטיקה; נשמר בין רינדורים עד שינוי התלויות.
  const selectedDispatcherStatistics =
    useMemo(
      () => {
        // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !currentSchedule.
        if (
          !currentSchedule
        ) {
          return null;
        }

        // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !currentSchedule .access .canViewTeamSchedule.
        if (
          !currentSchedule
            .access
            .canViewTeamSchedule
        ) {
          return isViewingCurrentMonth
            ? currentSchedule
                .personalStatistics
            : null;
        }

        // טיפול במקרה מיוחד ויציאה מוקדמת כאשר viewMode === 'team'.
        if (
          viewMode ===
          'team'
        ) {
          return null;
        }

        return (
          currentSchedule
            .dispatcherStatistics
            .find(
              (statistics) =>
                statistics
                  .userId ===
                selectedUserId,
            ) ??
          null
        );
      },
      [
        currentSchedule,
        isViewingCurrentMonth,
        selectedUserId,
        viewMode,
      ],
    );

  // ערך מחושב rawDisplayedShifts — משמרות; נשמר בין רינדורים עד שינוי התלויות.
  const rawDisplayedShifts =
    useMemo(
      () => {
        // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !currentSchedule.
        if (
          !currentSchedule
        ) {
          return [];
        }

        // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !isViewingCurrentMonth.
        if (
          !isViewingCurrentMonth
        ) {
          // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !selectedMonthSchedule ?.period.
          if (
            !selectedMonthSchedule
              ?.period
          ) {
            return [];
          }

          // monthShifts — חודש / משמרות.
          const monthShifts =
            selectedMonthSchedule
              .shifts
              .map(
                mapHistoricalShift,
              );

          // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !currentSchedule .access .canViewTeamSchedule.
          if (
            !currentSchedule
              .access
              .canViewTeamSchedule
          ) {
            // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !user.
            if (!user) {
              return [];
            }

            return monthShifts
              .filter(
                (shift) =>
                  shift
                    .assignedUser
                    ?.id ===
                  user.id,
              );
          }

          // טיפול במקרה מיוחד ויציאה מוקדמת כאשר viewMode === 'team'.
          if (
            viewMode ===
            'team'
          ) {
            return monthShifts;
          }

          // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !selectedUserId.
          if (!selectedUserId) {
            return [];
          }

          return monthShifts
            .filter(
              (shift) =>
                shift
                  .assignedUser
                  ?.id ===
                selectedUserId,
            );
        }

        // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !currentSchedule .access .canViewTeamSchedule.
        if (
          !currentSchedule
            .access
            .canViewTeamSchedule
        ) {
          return currentSchedule
            .visibleShifts;
        }

        // טיפול במקרה מיוחד ויציאה מוקדמת כאשר viewMode === 'team'.
        if (
          viewMode ===
          'team'
        ) {
          return currentSchedule
            .shifts;
        }

        // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !selectedUserId.
        if (!selectedUserId) {
          return [];
        }

        return currentSchedule
          .shifts
          .filter(
            (shift) =>
              shift
                .assignedUser
                ?.id ===
              selectedUserId,
          );
      },
      [
        currentSchedule,
        isViewingCurrentMonth,
        selectedMonthSchedule,
        selectedUserId,
        user,
        viewMode,
      ],
    );

  // Empty/unassigned shifts are operational management information.
  // Users without schedule editing permission should only see actual
  // published assignments, never red "unassigned" placeholders.
  // ערך מחושב displayedShifts — משמרות; נשמר בין רינדורים עד שינוי התלויות.
  const displayedShifts =
    useMemo(
      () =>
        hasPermission('schedule.edit')
          ? rawDisplayedShifts
          : rawDisplayedShifts.filter(
              (shift) => Boolean(shift.assignedUser),
            ),
      [
        hasPermission,
        rawDisplayedShifts,
      ],
    );

  // ערך מחושב groupedShifts — משמרות; נשמר בין רינדורים עד שינוי התלויות.
  const groupedShifts =
    useMemo(
      () =>
        groupShiftsByDate(
          displayedShifts,
        ),
      [
        displayedShifts,
      ],
    );

  // ערך מחושב shiftsByDate — משמרות / תאריך; נשמר בין רינדורים עד שינוי התלויות.
  const shiftsByDate =
    useMemo(
      () =>
        createShiftsByDateMap(
          displayedShifts,
        ),
      [
        displayedShifts,
      ],
    );

  // ערך מחושב selectedCalendarDateShifts — נבחר / לוח שנה / תאריך / משמרות; נשמר בין רינדורים עד שינוי התלויות.
  const selectedCalendarDateShifts =
    useMemo(
      () => {
        // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !selectedCalendarDate.
        if (
          !selectedCalendarDate
        ) {
          return [];
        }

        return (
          shiftsByDate.get(
            selectedCalendarDate,
          ) ?? []
        );
      },
      [
        selectedCalendarDate,
        shiftsByDate,
      ],
    );

  // ערך מחושב nextShift — משמרת; נשמר בין רינדורים עד שינוי התלויות.
  const nextShift =
    useMemo(
      () =>
        findNextShift(
          displayedShifts,
        ),
      [
        displayedShifts,
      ],
    );

  // תופעת לוואי לאחר רינדור בהתאם לתלויות [ selectedCalendarDate, ].
  useEffect(
    () => {
      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !selectedCalendarDate.
      if (
        !selectedCalendarDate
      ) {
        return;
      }

      /**
       * פעולה handleKeyDown: טיפול באירוע עבור מפתח.
       * @param event — אירוע.
       * @returns void — הפלט בהתאם לחתימה.
       */
      const handleKeyDown =
        (
          event:
            KeyboardEvent,
        ): void => {
          if (
            event.key ===
            'Escape'
          ) {
            setSelectedCalendarDate(
              null,
            );
          }
        };

      window.addEventListener(
        'keydown',
        handleKeyDown,
      );

      return () => {
        window.removeEventListener(
          'keydown',
          handleKeyDown,
        );
      };
    },
    [
      selectedCalendarDate,
    ],
  );

  /**
   * פעולה אסינכרונית handlePublishSchedule: טיפול באירוע עבור שיבוץ.
   * @returns Promise<void> — הפלט בהתאם לחתימה.
   */
  const handlePublishSchedule =
    async (): Promise<void> => {
      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !displayedPeriod.
      if (!displayedPeriod) {
        return;
      }

      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !hasPermission( 'schedule.edit', ).
      if (
        !hasPermission(
          'schedule.edit',
        )
      ) {
        return;
      }

      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר displayedPeriod.status === 'published'.
      if (
        displayedPeriod.status ===
        'published'
      ) {
        return;
      }

      const confirmed =
        window.confirm(
          `האם לפרסם את השיבוץ לחודש ${displayedPeriod.month}/${displayedPeriod.year}?\n\n` +
          'לאחר הפרסום המוקדנים יוכלו לראות את המשמרות והנתונים האישיים שלהם.',
        );

      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !confirmed.
      if (!confirmed) {
        return;
      }

      clearError();

      // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
      try {
        await publishSchedulePeriod(
          displayedPeriod.id,
        );

        if (
          !isViewingCurrentMonth
        ) {
          // refreshedMonth — חודש.
          const refreshedMonth =
            await scheduleService
              .getScheduleByMonth(
                selectedMonth.year,
                selectedMonth.month,
              );

          setSelectedMonthSchedule(
            refreshedMonth,
          );
        }
      } catch {
        /*
         * הודעת השגיאה נשמרת
         * ב-useSchedule ומוצגת במסך.
         */
      }
    };

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר state .isLoadingCurrentSchedule.
  if (
    state
      .isLoadingCurrentSchedule
  ) {
    return (
      <section className="schedule-page">
        <PageHeader
          title={pageTitle}
          description="טוען את שיבוץ החודש הנוכחי."
        />

        <div className="schedule-loading-state">
          <RefreshCw
            size={30}
            className="schedule-loading-icon"
            aria-hidden="true"
          />

          <span>
            טוען את השיבוץ...
          </span>
        </div>
      </section>
    );
  }

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר state.error && !currentSchedule.
  if (
    state.error &&
    !currentSchedule
  ) {
    return (
      <section className="schedule-page">
        <PageHeader
          title={pageTitle}
          description="צפייה בשיבוץ החודש הנוכחי."
        />

        <div
          className="schedule-error-state"
          role="alert"
        >
          <strong>
            לא ניתן היה לטעון
            את השיבוץ
          </strong>

          <span>
            {state.error}
          </span>

          <Button
            type="button"
            onClick={() => {
              void loadCurrentSchedule();
            }}
          >
            <RefreshCw
              size={17}
              aria-hidden="true"
            />

            ניסיון נוסף
          </Button>
        </div>
      </section>
    );
  }

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !currentSchedule || !currentSchedule.period.
  if (
    !currentSchedule ||
    !currentSchedule.period
  ) {
    return (
      <section className="schedule-page">
        <PageHeader
          title={pageTitle}
          description="צפייה בשיבוץ החודש הנוכחי."
          actions={
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                void loadCurrentSchedule();
              }}
            >
              <RefreshCw
                size={17}
                aria-hidden="true"
              />

              רענון
            </Button>
          }
        />

        <div className="schedule-empty-state">
          <CalendarDays
            size={34}
            aria-hidden="true"
          />

          <strong>
            עדיין לא קיים שיבוץ
            לחודש הנוכחי
          </strong>

          <span>
            לאחר יצירת השיבוץ
            ושמירתו הוא יוצג כאן.
          </span>
        </div>
      </section>
    );
  }

  // selectedMonthTitle — נבחר / חודש / כותרת.
  const selectedMonthTitle =
    `${hebrewMonths[
      selectedMonth.month - 1
    ]} ${selectedMonth.year}`;

  // periodTitle — תקופה / כותרת.
  const periodTitle =
    !isViewingCurrentMonth
      ? selectedMonthTitle
      : currentSchedule
          .period
          .title ??
        `${hebrewMonths[
          currentSchedule
            .period
            .month - 1
        ]} ${
          currentSchedule
            .period
            .year
        }`;

  // displayedPeriod — תקופה.
  const displayedPeriod = activeDisplayedPeriod;

  // isPersonalUserBlocked — משתמש.
  const isPersonalUserBlocked =
    !currentSchedule
      .access
      .canViewTeamSchedule &&
    currentSchedule
      .period
      .status !==
      'published';

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר isPersonalUserBlocked.
  if (
    isPersonalUserBlocked
  ) {
    return (
      <section className="schedule-page">
        <PageHeader
          title={pageTitle}
          description={
            periodTitle
          }
          actions={
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                void loadCurrentSchedule();
              }}
            >
              <RefreshCw
                size={17}
                aria-hidden="true"
              />

              רענון
            </Button>
          }
        />

        <div className="schedule-empty-state">
          <Clock3
            size={34}
            aria-hidden="true"
          />

          <strong>
            השיבוץ עדיין לא פורסם
          </strong>

          <span>
            השיבוץ נמצא כרגע
            בהכנה. לאחר פרסומו
            המשמרות האישיות שלך
            יוצגו כאן.
          </span>
        </div>
      </section>
    );
  }

// canPublishSchedule — שיבוץ.
const canPublishSchedule =
  hasPermission(
    'schedule.edit',
  ) &&
  (displayedPeriod?.status === 'draft' ||
   displayedPeriod?.status === 'scheduling');

  return (
    <section className="schedule-page">
      <PageHeader
        title={pageTitle}
        description={
          periodTitle
        }
        actions={
          <>
            {canPublishSchedule ? (
              <Button
                type="button"
                disabled={
                  state.isPublishing
                }
                onClick={() => {
                  void handlePublishSchedule();
                }}
              >
                <Send
                  size={17}
                  aria-hidden="true"
                />

                {state.isPublishing
                  ? 'מפרסם שיבוץ...'
                  : 'פרסום השיבוץ למוקדנים'}
              </Button>
            ) : null}

            <Button
              type="button"
              variant="secondary"
              disabled={
                state
                  .isLoadingCurrentSchedule ||
                state.isPublishing
              }
              onClick={() => {
                void loadCurrentSchedule();
              }}
            >
              <RefreshCw
                size={17}
                aria-hidden="true"
              />

              רענון
            </Button>
          </>
        }
      />

      {state.error ? (
        <div
          className="schedule-error-banner"
          role="alert"
        >
          <strong>
            לא ניתן היה לבצע את הפעולה
          </strong>

          <span>
            {state.error}
          </span>
        </div>
      ) : null}

      {shiftEditSuccess ? (
        <div
          className="schedule-success-banner"
          role="status"
        >
          <CheckCircle2
            size={21}
            aria-hidden="true"
          />

          <div>
            <strong>
              השיבוץ עודכן
            </strong>

            <span>
              {shiftEditSuccess}
            </span>
          </div>
        </div>
      ) : null}

      {state.lastPublishedSchedule ? (
        <div
          className="schedule-success-banner"
          role="status"
        >
          <CheckCircle2
            size={21}
            aria-hidden="true"
          />

          <div>
            <strong>
              השיבוץ פורסם בהצלחה
            </strong>

            <span>
              {state
                .lastPublishedSchedule
                .publishedShifts ??
                currentSchedule
                  .teamStatistics
                  .totalShifts}{' '}
              משמרות זמינות כעת
              לצפיית המוקדנים.
            </span>
          </div>
        </div>
      ) : null}

      <div className="schedule-period-bar">
        <div>
          <span>
            חודש מוצג
          </span>

          <strong>
            {periodTitle}
          </strong>
        </div>

        {displayedPeriod ? (
          <span
            className={`schedule-status schedule-status-${displayedPeriod.status}`}
          >
            {getScheduleStatusLabel(
              displayedPeriod.status,
            )}
          </span>
        ) : null}
      </div>


      {isDraftDisplayedPeriod ? (
        <ScheduleDraftOverview
          shifts={displayedShifts}
          context={draftEditContext}
        />
      ) : null}

      <div
        className="schedule-display-mode"
        role="group"
        aria-label="בחירת תצוגת שיבוץ"
      >
        <Button
          type="button"
          variant={
            displayMode ===
            'calendar'
              ? 'primary'
              : 'secondary'
          }
          onClick={() => {
            setDisplayMode(
              'calendar',
            );
          }}
        >
          <CalendarDays
            size={17}
            aria-hidden="true"
          />

          לוח שנה
        </Button>

        <Button
          type="button"
          variant={
            displayMode ===
            'list'
              ? 'primary'
              : 'secondary'
          }
          onClick={() => {
            setDisplayMode(
              'list',
            );
          }}
        >
          <LayoutList
            size={17}
            aria-hidden="true"
          />

          רשימה
        </Button>
      </div>

      {currentSchedule
        .access
        .canViewTeamSchedule ? (
        <div className="schedule-view-controls">
          <div className="schedule-view-mode-buttons">
            <Button
              type="button"
              variant={
                viewMode ===
                'team'
                  ? 'primary'
                  : 'secondary'
              }
              onClick={() => {
                setViewMode(
                  'team',
                );
              }}
            >
              <Users
                size={17}
                aria-hidden="true"
              />

              תצוגת צוות
            </Button>

            <Button
              type="button"
              variant={
                viewMode ===
                'personal'
                  ? 'primary'
                  : 'secondary'
              }
              onClick={() => {
                setViewMode(
                  'personal',
                );
              }}
            >
              <UserRound
                size={17}
                aria-hidden="true"
              />

              תצוגה אישית
            </Button>
          </div>

          {viewMode ===
          'personal' ? (
            <label className="schedule-user-selector">
              <span>
                בחירת מוקדן
              </span>

              <select
                value={
                  selectedUserId ??
                  ''
                }
                onChange={(
                  event,
                ) => {
                  setSelectedUserId(
                    event.target
                      .value ||
                      null,
                  );
                }}
              >
                {currentSchedule
                  .dispatcherStatistics
                  .map(
                    (
                      dispatcher,
                    ) => (
                      <option
                        key={
                          dispatcher
                            .userId
                        }
                        value={
                          dispatcher
                            .userId
                        }
                      >
                        {
                          dispatcher
                            .scheduleName ??
                          dispatcher
                            .displayName
                        }
                      </option>
                    ),
                  )}
              </select>
            </label>
          ) : null}
        </div>
      ) : null}

      {viewMode ===
        'team' &&
      currentSchedule
        .access
        .canViewTeamSchedule ? (
        <div className="schedule-team-summary">
          <article>
            <CalendarDays
              size={22}
              aria-hidden="true"
            />

            <div>
              <strong>
                {
                  currentSchedule
                    .teamStatistics
                    .totalShifts
                }
              </strong>

              <span>
                משמרות בחודש
              </span>
            </div>
          </article>

          <article>
            <CheckCircle2
              size={22}
              aria-hidden="true"
            />

            <div>
              <strong>
                {
                  currentSchedule
                    .teamStatistics
                    .completedShifts
                }
              </strong>

              <span>
                משמרות שהושלמו
              </span>
            </div>
          </article>

          <article>
            <Users
              size={22}
              aria-hidden="true"
            />

            <div>
              <strong>
                {
                  currentSchedule
                    .teamStatistics
                    .assignedDispatchers
                }
              </strong>

              <span>
                מוקדנים משובצים
              </span>
            </div>
          </article>

          <article>
            <Sparkles
              size={22}
              aria-hidden="true"
            />

            <div>
              <strong>
                {
                  currentSchedule
                    .teamStatistics
                    .premiumShifts
                }
              </strong>

              <span>
                משמרות 200%
              </span>
            </div>
          </article>
        </div>
      ) : selectedDispatcherStatistics ? (
        <>
          <div className="schedule-personal-heading">
            <div>
              <span>
                נתוני מוקדן
              </span>

              <h2>
                {
                  selectedDispatcherStatistics
                    .scheduleName ??
                  selectedDispatcherStatistics
                    .displayName
                }
              </h2>
            </div>
          </div>

          <MonthlyProgressCard
            statistics={
              selectedDispatcherStatistics
            }
          />

          <PersonalStatisticsGrid
            statistics={
              selectedDispatcherStatistics
            }
          />
        </>
      ) : null}

      {nextShift ? (
        <section className="schedule-next-shift">
          <div className="schedule-next-shift-heading">
            <Clock3
              size={22}
              aria-hidden="true"
            />

            <div>
              <span>
                המשמרת הקרובה
              </span>

              <strong>
                {formatDate(
                  nextShift
                    .shiftDate,
                )}
              </strong>
            </div>
          </div>

          <ScheduleShiftCard
            shift={
              nextShift
            }
            showAssignedUser={
              viewMode ===
              'team'
            }
          />
        </section>
      ) : null}

      <section className="schedule-month-section">
        <div className="schedule-month-section-header">
          <div>
            <h2>
              {displayMode ===
              'calendar'
                ? 'לוח המשמרות'
                : 'משמרות החודש'}
            </h2>

            <p>
              מוצגות{' '}
              {
                displayedShifts
                  .length
              }{' '}
              משמרות.
            </p>

            <strong className="schedule-month-section-viewed-month">
              {selectedMonthTitle}
            </strong>
          </div>

          <div
              className="schedule-month-navigation"
              aria-label="ניווט בין חודשי השיבוץ"
            >
              <Button
                type="button"
                variant="secondary"
                disabled={
                  isLoadingSelectedMonth
                }
                onClick={() => {
                  setSelectedCalendarDate(
                    null,
                  );
                  setSelectedMonth(
                    (current) =>
                      moveMonth(
                        current,
                        -1,
                      ),
                  );
                }}
              >
                <ChevronRight
                  size={17}
                  aria-hidden="true"
                />
                חודש קודם
              </Button>

              <Button
                type="button"
                variant="secondary"
                disabled={
                  isLoadingSelectedMonth ||
                  isViewingCurrentMonth
                }
                onClick={() => {
                  setSelectedCalendarDate(
                    null,
                  );
                  setSelectedMonth(
                    getCurrentMonthSelection(),
                  );
                }}
              >
                <CalendarDays
                  size={17}
                  aria-hidden="true"
                />
                היום
              </Button>

              <Button
                type="button"
                variant="secondary"
                disabled={
                  isLoadingSelectedMonth
                }
                onClick={() => {
                  setSelectedCalendarDate(
                    null,
                  );
                  setSelectedMonth(
                    (current) =>
                      moveMonth(
                        current,
                        1,
                      ),
                  );
                }}
              >
                חודש הבא
                <ChevronLeft
                  size={17}
                  aria-hidden="true"
                />
              </Button>
            </div>
        </div>

        {selectedMonthError ? (
          <div
            className="schedule-error-banner schedule-month-feedback"
            role="alert"
          >
            <strong>
              לא ניתן היה לטעון את החודש שנבחר
            </strong>
            <span>
              {selectedMonthError}
            </span>
          </div>
        ) : null}

        {isLoadingSelectedMonth ? (
          <div className="schedule-month-loading schedule-month-feedback">
            <RefreshCw
              size={18}
              className="schedule-loading-icon"
              aria-hidden="true"
            />
            טוען את השיבוץ לחודש שנבחר...
          </div>
        ) : null}

        {displayMode ===
        'calendar' ? (
          <div className="schedule-calendar-view">
            <MonthCalendar
              dayLabels={holidayLabels}
              year={
                selectedMonth.year
              }
              month={
                selectedMonth.month
              }
              getDayClassName={(
                context,
              ) => {
                // dayShifts — יום / משמרות.
                const dayShifts =
                  shiftsByDate.get(
                    context.date,
                  ) ?? [];

                // טיפול במקרה מיוחד ויציאה מוקדמת כאשר dayShifts.length === 0.
                if (
                  dayShifts.length ===
                  0
                ) {
                  return null;
                }

                const classNames:
                  string[] = [
                    'schedule-calendar-day-with-shift',
                  ];

                if (
                  dayShifts.some(
                    (shift) =>
                      shift.progressState ===
                      'current',
                  )
                ) {
                  classNames.push(
                    'schedule-calendar-day-current',
                  );
                }

                if (
                  nextShift &&
                  nextShift.shiftDate ===
                    context.date
                ) {
                  classNames.push(
                    'schedule-calendar-day-next',
                  );
                }

                if (
                  dayShifts.some(
                    (shift) =>
                      shift.isPremium,
                  )
                ) {
                  classNames.push(
                    'schedule-calendar-day-premium',
                  );
                }

                return classNames.join(
                  ' ',
                );
              }}
              renderDayContent={(
                context,
              ) => {
                // dayShifts — יום / משמרות.
                const dayShifts =
                  shiftsByDate.get(
                    context.date,
                  ) ?? [];

                // טיפול במקרה מיוחד ויציאה מוקדמת כאשר dayShifts.length === 0.
                if (
                  dayShifts.length ===
                  0
                ) {
                  return null;
                }

                return (
                  <div className="schedule-calendar-assignments">
                    {dayShifts.map(
                      (shift) => (
                        <div
                          key={
                            shift.id
                          }
                          className={[
                            'schedule-calendar-assignment',

                            `schedule-calendar-assignment-${shift.progressState}`,

                            shift.isPremium
                              ? 'schedule-calendar-assignment-premium'
                              : '',

                            !shift.assignedUser
                              ? 'schedule-calendar-assignment-unassigned'
                              : '',
                          ]
                            .filter(
                              Boolean,
                            )
                            .join(
                              ' ',
                            )}
                        >
                          <strong dir="ltr">
                            {
                              getShiftTimeLabel(
                                shift,
                              )
                            }
                          </strong>

                          <span>
                            {
                              getShiftTypeLabel(
                                shift,
                              )
                            }
                          </span>

                          {viewMode ===
                          'team' ? (
                            <small>
                              {shift
                                .assignedUser
                                ?.scheduleName ??
                                shift
                                  .assignedUser
                                  ?.displayName ??
                                'משמרת לא מאוישת'}
                            </small>
                          ) : null}

                          {shift.isPremium ? (
                            <em>
                              <Sparkles
                                size={12}
                                aria-hidden="true"
                              />

                              200%
                            </em>
                          ) : null}
                        </div>
                      ),
                    )}
                  </div>
                );
              }}
              onDayClick={(
                context,
              ) => {
                // dayShifts — יום / משמרות.
                const dayShifts =
                  shiftsByDate.get(
                    context.date,
                  ) ?? [];

                // טיפול במקרה מיוחד ויציאה מוקדמת כאשר dayShifts.length === 0.
                if (
                  dayShifts.length ===
                  0
                ) {
                  return;
                }

                setSelectedCalendarDate(
                  context.date,
                );
              }}
            />
          </div>
        ) : groupedShifts.length ===
          0 ? (
          <div className="schedule-empty-state schedule-empty-state-compact">
            <CalendarDays
              size={29}
              aria-hidden="true"
            />

            <strong>
              אין משמרות להצגה
            </strong>

            <span>
              לא נמצאו משמרות
              המתאימות לתצוגה
              שנבחרה.
            </span>
          </div>
        ) : (
          <div className="schedule-days-list">
            {groupedShifts.map(
              (group) => (
                <section
                  key={
                    group.date
                  }
                  className="schedule-day-group"
                >
                  <header>
                    <strong>
                      {formatDate(
                        group.date,
                      )}
                    </strong>

                    <span>
                      {
                        group
                          .shifts
                          .length
                      }{' '}
                      משמרות
                    </span>
                  </header>

                  <div className="schedule-day-shifts">
                    {group.shifts.map(
                      (shift) => (
                        <ScheduleShiftCard
                          key={
                            shift.id
                          }
                          shift={
                            shift
                          }
                          availabilityLabel={getDraftCandidateLabel(shift)}
                          showAssignedUser={
                            viewMode ===
                              'team' ||
                            canEditDisplayedSchedule
                          }
                          onEdit={
                            canEditDisplayedSchedule
                              ? () => {
                                  void openShiftEditor(
                                    shift,
                                  );
                                }
                              : undefined
                          }
                        />
                      ),
                    )}
                  </div>
                </section>
              ),
            )}
          </div>
        )}
      </section>

      {selectedCalendarDate ? (
        <>
          <button
            type="button"
            className="schedule-day-drawer-backdrop"
            aria-label="סגירת פרטי היום"
            onClick={() => {
              setSelectedCalendarDate(
                null,
              );
            }}
          />

          <aside
            className="schedule-day-drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="schedule-day-drawer-title"
          >
            <header className="schedule-day-drawer-header">
              <div>
                <span>
                  פרטי משמרות
                </span>

                <h2 id="schedule-day-drawer-title">
                  {formatDate(
                    selectedCalendarDate,
                  )}
                </h2>
              </div>

              <button
                type="button"
                className="schedule-day-drawer-close"
                aria-label="סגירת פרטי היום"
                onClick={() => {
                  setSelectedCalendarDate(
                    null,
                  );
                }}
              >
                <X
                  size={22}
                  aria-hidden="true"
                />
              </button>
            </header>

            <div className="schedule-day-drawer-content">
              {selectedCalendarDateShifts.length >
              0 ? (
                selectedCalendarDateShifts.map(
                  (shift) => (
                    <ScheduleShiftCard
                      key={
                        shift.id
                      }
                      shift={
                        shift
                      }
                      availabilityLabel={getDraftCandidateLabel(shift)}
                      showAssignedUser={
                        viewMode ===
                          'team' ||
                        canEditDisplayedSchedule
                      }
                      onEdit={
                        canEditDisplayedSchedule
                          ? () => {
                              void openShiftEditor(
                                shift,
                              );
                            }
                          : undefined
                      }
                    />
                  ),
                )
              ) : (
                <div className="schedule-empty-state schedule-empty-state-compact">
                  <CalendarDays
                    size={29}
                    aria-hidden="true"
                  />

                  <strong>
                    אין משמרות ביום זה
                  </strong>
                </div>
              )}
            </div>
          </aside>
        </>
      ) : null}

      <ScheduleShiftEditModal
        key={
          editingShift?.id ??
          'closed'
        }
        shift={editingShift}
        dispatchers={getEditingDispatchers()}
        isLoadingOptions={
          isLoadingEditOptions
        }
        isSaving={
          isSavingShiftEdit
        }
        error={
          shiftEditError
        }
        onClose={() => {
          if (
            !isSavingShiftEdit
          ) {
            setEditingShift(null);
            setShiftEditError(null);
          }
        }}
        onSave={saveShiftEdit}
        onMarkUnassigned={
          isDraftDisplayedPeriod
            ? markShiftIntentionallyUnassigned
            : undefined
        }
        candidateHint={getEditingCandidateHint()}
      />

      {selectedDispatcherStatistics ? (
        <div className="schedule-hours-summary">
          <span>
            סך שעות מתוכננות:
          </span>

          <strong>
            {formatHours(
              selectedDispatcherStatistics
                .totalScheduledHours,
            )}
          </strong>
        </div>
      ) : null}
    </section>
  );
}

export default SchedulePage;