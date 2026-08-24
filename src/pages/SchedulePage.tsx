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
  Button,
  PageHeader,
} from '../components/ui';

import MonthCalendar
  from '../components/calendar/MonthCalendar';

import ScheduleShiftEditModal
  from '../components/schedule/ScheduleShiftEditModal';

import {
  useAuth,
} from '../auth/AuthContext';

import {
  useSchedule,
} from '../hooks/useSchedule';

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

type ScheduleDisplayMode =
  | 'calendar'
  | 'list';

interface ScheduleMonthSelection {
  year: number;
  month: number;
}

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

function moveMonth(
  selection:
    ScheduleMonthSelection,
  offset: number,
): ScheduleMonthSelection {
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

function mapHistoricalShift(
  shift:
    DispatcherScheduleMonthShift,
): ScheduleShift {
  const now =
    Date.now();

  const startsAt =
    new Date(
      shift.startsAt,
    ).getTime();

  const endsAt =
    new Date(
      shift.endsAt,
    ).getTime();

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

    isLocked:
      shift.isLocked,

    notes:
      shift.notes,

    progressState,
  };
}

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

const scheduleStatusLabels = {
  draft: 'טיוטה',
  collecting_availability:
    'איסוף אילוצים',
  scheduling: 'בהכנת שיבוץ',
  published: 'פורסם',
  archived: 'בארכיון',
} as const;

function formatDate(
  value: string,
): string {
  const date =
    new Date(
      `${value}T12:00:00`,
    );

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

function formatTime(
  value: string,
): string {
  const date =
    new Date(value);

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

function formatHours(
  value: number,
): string {
  const roundedValue =
    Math.round(
      value * 10,
    ) / 10;

  return `${roundedValue} שעות`;
}

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

function getShiftTypeLabel(
  shift: ScheduleShift,
): string {
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
      if (
        startTime ===
        '06:00'
      ) {
        return 'שישי בוקר';
      }

      if (
        startTime ===
        '14:00'
      ) {
        return 'שישי צהריים';
      }

      return 'שישי לילה';

    case 'saturday':
      if (
        startTime ===
        '06:00'
      ) {
        return 'שבת בוקר';
      }

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

function findNextShift(
  shifts:
    ScheduleShift[],
): ScheduleShift | null {
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

function groupShiftsByDate(
  shifts:
    ScheduleShift[],
): Array<{
  date: string;

  shifts:
    ScheduleShift[];
}> {
  const groups =
    new Map<
      string,
      ScheduleShift[]
    >();

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

function createShiftsByDateMap(
  shifts:
    ScheduleShift[],
): Map<
  string,
  ScheduleShift[]
> {
  const shiftsByDate =
    new Map<
      string,
      ScheduleShift[]
    >();

  for (
    const shift
    of shifts
  ) {
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

function MonthlyProgressCard({
  statistics,
}: {
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

function PersonalStatisticsGrid({
  statistics,
}: {
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

function ScheduleShiftCard({
  shift,
  showAssignedUser,
  onEdit,
}: {
  shift:
    ScheduleShift;

  showAssignedUser:
    boolean;

  onEdit?:
    () => void;
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

function SchedulePage() {
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

  const [
    viewMode,
    setViewMode,
  ] =
    useState<ScheduleViewMode>(
      'personal',
    );

  const [
    displayMode,
    setDisplayMode,
  ] =
    useState<ScheduleDisplayMode>(
      'calendar',
    );


  const [
    selectedMonth,
    setSelectedMonth,
  ] =
    useState<ScheduleMonthSelection>(
      getCurrentMonthSelection,
    );

  const [
    selectedMonthSchedule,
    setSelectedMonthSchedule,
  ] =
    useState<DispatcherScheduleMonthData | null>(
      null,
    );

  const [
    isLoadingSelectedMonth,
    setIsLoadingSelectedMonth,
  ] =
    useState(false);

  const [
    selectedMonthError,
    setSelectedMonthError,
  ] =
    useState<string | null>(
      null,
    );

  const [
    selectedUserId,
    setSelectedUserId,
  ] =
    useState<
      string | null
    >(null);

  const [
    selectedCalendarDate,
    setSelectedCalendarDate,
  ] =
    useState<
      string | null
    >(null);

  const [
    editingShift,
    setEditingShift,
  ] =
    useState<
      ScheduleShift | null
    >(null);

  const [
    editDispatchers,
    setEditDispatchers,
  ] =
    useState<
      ScheduleEditDispatcher[]
    >([]);

  const [
    isLoadingEditOptions,
    setIsLoadingEditOptions,
  ] =
    useState(false);

  const [
    isSavingShiftEdit,
    setIsSavingShiftEdit,
  ] =
    useState(false);

  const [
    shiftEditError,
    setShiftEditError,
  ] =
    useState<
      string | null
    >(null);

  const [
    shiftEditSuccess,
    setShiftEditSuccess,
  ] =
    useState<
      string | null
    >(null);

  useEffect(() => {
    void loadCurrentSchedule();
  }, [
    loadCurrentSchedule,
  ]);

  useEffect(() => {
    const currentSchedule =
      state.currentSchedule;

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

  const currentSchedule =
    state.currentSchedule;

  const currentMonthSelection =
    getCurrentMonthSelection();

  const isPersonalScheduleUser =
    Boolean(
      currentSchedule &&
      !currentSchedule
        .access
        .canViewTeamSchedule,
    );

  const isViewingCurrentMonth =
    isSameMonth(
      selectedMonth,
      currentMonthSelection,
    );

  useEffect(
    () => {
      if (
        !isPersonalScheduleUser ||
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

      let isCancelled =
        false;

      const loadSelectedMonth =
        async (): Promise<void> => {
          setIsLoadingSelectedMonth(
            true,
          );
          setSelectedMonthError(
            null,
          );

          try {
            const data =
              await scheduleService
                .getScheduleByMonth(
                  selectedMonth.year,
                  selectedMonth.month,
                );

            if (
              isCancelled
            ) {
              return;
            }

            setSelectedMonthSchedule(
              data,
            );
          } catch (error) {
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
      isPersonalScheduleUser,
      isViewingCurrentMonth,
      selectedMonth.month,
      selectedMonth.year,
    ],
  );

const canEditCurrentSchedule =
  hasPermission(
    'schedule.edit',
  ) &&
  isViewingCurrentMonth &&
  currentSchedule
    ?.period
    ?.status ===
    'published';

  const getEditErrorMessage =
    (error: unknown): string => {
      if (
        error instanceof Error
      ) {
        const message =
          error.message
            .trim();

        const normalizedMessage =
          message.toLowerCase();

        if (
          normalizedMessage.includes(
            'overlapping or consecutive',
          )
        ) {
          return 'לא ניתן לבצע את השינוי: למוקדן שנבחר קיימת משמרת חופפת או משמרת רצופה אסורה.';
        }

        if (
          normalizedMessage.includes(
            'schedule edit permission required',
          )
        ) {
          return 'אין לך הרשאה לערוך את השיבוץ.';
        }

        if (
          normalizedMessage.includes(
            'only current month schedule',
          )
        ) {
          return 'ניתן לערוך במסך זה רק את שיבוץ החודש הנוכחי.';
        }

        if (
          normalizedMessage.includes(
            'only published current schedule',
          )
        ) {
          return 'ניתן לערוך כאן רק שיבוץ שכבר פורסם.';
        }

        return message;
      }

      return 'לא ניתן היה לעדכן את השיבוץ.';
    };

  const openShiftEditor =
    async (
      shift: ScheduleShift,
    ): Promise<void> => {
      if (
        !canEditCurrentSchedule
      ) {
        return;
      }

      setEditingShift(shift);
      setShiftEditError(null);
      setShiftEditSuccess(null);

      if (
        editDispatchers.length >
        0
      ) {
        return;
      }

      setIsLoadingEditOptions(true);

      try {
        const options =
          await scheduleService
            .getCurrentScheduleEditOptions();

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

  const saveShiftEdit =
    async (
      newUserId: string,
      reason: string | null,
    ): Promise<void> => {
      if (
        !editingShift ||
        !canEditCurrentSchedule
      ) {
        return;
      }

      setIsSavingShiftEdit(true);
      setShiftEditError(null);
      setShiftEditSuccess(null);

      try {
        const result =
          await scheduleService
            .updateCurrentScheduleShift({
              shiftId:
                editingShift.id,
              newUserId,
              reason,
            });

        setEditingShift(null);
        setSelectedCalendarDate(null);
        setShiftEditSuccess(
          `השיבוץ עודכן בהצלחה ל${result.newUserName}. המוקדנים הרלוונטיים קיבלו התראה.`,
        );

        await loadCurrentSchedule();
      } catch (error) {
        setShiftEditError(
          getEditErrorMessage(
            error,
          ),
        );
      } finally {
        setIsSavingShiftEdit(false);
      }
    };

  const isDispatcher =
    profile?.role ===
    'dispatcher';

  const pageTitle =
    isDispatcher
      ? 'השיבוצים שלי'
      : 'שיבוץ מוקדנים';

  const selectedDispatcherStatistics =
    useMemo(
      () => {
        if (
          !currentSchedule
        ) {
          return null;
        }

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

  const displayedShifts =
    useMemo(
      () => {
        if (
          !currentSchedule
        ) {
          return [];
        }

        if (
          isPersonalScheduleUser &&
          !isViewingCurrentMonth
        ) {
          if (
            !user ||
            !selectedMonthSchedule
              ?.period ||
            (
              selectedMonthSchedule
                .period
                .status !==
                'published' &&
              selectedMonthSchedule
                .period
                .status !==
                'archived'
            )
          ) {
            return [];
          }

          return selectedMonthSchedule
            .shifts
            .filter(
              (shift) =>
                shift.assignedUserId ===
                user.id,
            )
            .map(
              mapHistoricalShift,
            );
        }

        if (
          !currentSchedule
            .access
            .canViewTeamSchedule
        ) {
          return currentSchedule
            .visibleShifts;
        }

        if (
          viewMode ===
          'team'
        ) {
          return currentSchedule
            .shifts;
        }

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
        isPersonalScheduleUser,
        isViewingCurrentMonth,
        selectedMonthSchedule,
        selectedUserId,
        user,
        viewMode,
      ],
    );

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

  const selectedCalendarDateShifts =
    useMemo(
      () => {
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

  useEffect(
    () => {
      if (
        !selectedCalendarDate
      ) {
        return;
      }

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

  const handlePublishSchedule =
    async (): Promise<void> => {
      if (
        !currentSchedule
          ?.period
      ) {
        return;
      }

      if (
        !hasPermission(
          'schedule.edit',
        )
      ) {
        return;
      }

      if (
        currentSchedule
          .period
          .status ===
        'published'
      ) {
        return;
      }

      const confirmed =
        window.confirm(
          `האם לפרסם את השיבוץ לחודש ${currentSchedule.period.month}/${currentSchedule.period.year}?\n\n` +
          'לאחר הפרסום המוקדנים יוכלו לראות את המשמרות והנתונים האישיים שלהם.',
        );

      if (!confirmed) {
        return;
      }

      clearError();

      try {
        await publishSchedulePeriod(
          currentSchedule
            .period
            .id,
        );
      } catch {
        /*
         * הודעת השגיאה נשמרת
         * ב-useSchedule ומוצגת במסך.
         */
      }
    };

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

  const selectedMonthTitle =
    `${hebrewMonths[
      selectedMonth.month - 1
    ]} ${selectedMonth.year}`;

  const periodTitle =
    isPersonalScheduleUser &&
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

  const isPersonalUserBlocked =
    !currentSchedule
      .access
      .canViewTeamSchedule &&
    currentSchedule
      .period
      .status !==
      'published';

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

const canPublishSchedule =
  hasPermission(
    'schedule.edit',
  ) &&
  currentSchedule
    .period
    .status ===
    'scheduling';

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
            {isPersonalScheduleUser
              ? 'חודש מוצג'
              : 'חודש נוכחי'}
          </span>

          <strong>
            {periodTitle}
          </strong>
        </div>

        {isViewingCurrentMonth ? (
          <span
            className={`schedule-status schedule-status-${currentSchedule.period.status}`}
          >
            {
              scheduleStatusLabels[
                currentSchedule
                  .period
                  .status
              ]
            }
          </span>
        ) : selectedMonthSchedule
            ?.period ? (
          <span className="schedule-status schedule-status-published">
            {selectedMonthSchedule
              .period
              .status ===
              'archived'
              ? 'בארכיון'
              : 'פורסם'}
          </span>
        ) : null}
      </div>

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

            {isPersonalScheduleUser ? (
              <strong className="schedule-month-section-viewed-month">
                {selectedMonthTitle}
              </strong>
            ) : null}
          </div>

          {isPersonalScheduleUser ? (
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
          ) : null}
        </div>

        {isPersonalScheduleUser &&
        selectedMonthError ? (
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

        {isPersonalScheduleUser &&
        isLoadingSelectedMonth ? (
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
              year={
                isPersonalScheduleUser
                  ? selectedMonth.year
                  : currentSchedule
                      .period
                      .year
              }
              month={
                isPersonalScheduleUser
                  ? selectedMonth.month
                  : currentSchedule
                      .period
                      .month
              }
              getDayClassName={(
                context,
              ) => {
                const dayShifts =
                  shiftsByDate.get(
                    context.date,
                  ) ?? [];

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
                const dayShifts =
                  shiftsByDate.get(
                    context.date,
                  ) ?? [];

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
                const dayShifts =
                  shiftsByDate.get(
                    context.date,
                  ) ?? [];

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
                          showAssignedUser={
                            viewMode ===
                              'team' ||
                            canEditCurrentSchedule
                          }
                          onEdit={
                            canEditCurrentSchedule
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
                      showAssignedUser={
                        viewMode ===
                          'team' ||
                        canEditCurrentSchedule
                      }
                      onEdit={
                        canEditCurrentSchedule
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
        dispatchers={editDispatchers}
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