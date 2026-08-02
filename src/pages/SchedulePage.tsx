import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  Crown,
  RefreshCw,
  Send,
  Sparkles,
  UserRound,
  Users,
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

import {
  useSchedule,
} from '../hooks/useSchedule';

import type {
  DispatcherMonthlyStatistics,
  ScheduleShift,
  ScheduleViewMode,
} from '../types/schedule';

import '../styles/schedule.css';

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
}: {
  shift:
    ScheduleShift;

  showAssignedUser:
    boolean;
}) {
  return (
    <article
      className={[
        'schedule-shift-card',

        `schedule-shift-card-${shift.progressState}`,

        shift.isPremium
          ? 'schedule-shift-card-premium'
          : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="schedule-shift-card-main">
        <div>
          <strong>
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
        <div className="schedule-shift-assigned-user">
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
                'ללא שיבוץ'}
            </strong>
          </div>
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
    selectedUserId,
    setSelectedUserId,
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
          return currentSchedule
            .personalStatistics;
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
        selectedUserId,
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

  const handlePublishSchedule =
    async (): Promise<void> => {
      if (
        !currentSchedule
          ?.period
      ) {
        return;
      }

      if (
        !currentSchedule
          .access
          .canEditSchedule
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
          title="שיבוץ מוקדנים"
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
          title="שיבוץ מוקדנים"
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
          title="שיבוץ מוקדנים"
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

  const periodTitle =
    currentSchedule
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
          title="שיבוץ מוקדנים"
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
  currentSchedule
    .access
    .canEditSchedule &&
  currentSchedule
    .period
    .status ===
    'scheduling';

  return (
    <section className="schedule-page">
      <PageHeader
        title="שיבוץ מוקדנים"
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
            חודש נוכחי
          </span>

          <strong>
            {periodTitle}
          </strong>
        </div>

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
              משמרות החודש
            </h2>

            <p>
              מוצגות{' '}
              {
                displayedShifts
                  .length
              }{' '}
              משמרות.
            </p>
          </div>
        </div>

        {groupedShifts.length ===
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
                            'team'
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