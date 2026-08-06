import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Settings2,
} from 'lucide-react';

import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import UnifiedAvailabilityManagement
  from '../components/shifts/UnifiedAvailabilityManagement';

import UnifiedPeriodManagement
  from '../components/shifts/UnifiedPeriodManagement';

import MonthCalendar, {
  type MonthCalendarDayContext,
} from '../components/calendar/MonthCalendar';
import {
  useSearchParams,
} from 'react-router-dom';
import {
  Button,
  Card,
  CardBody,
  Modal,
  PageHeader,
} from '../components/ui';

import {
  useUnifiedSchedule,
} from '../hooks/useUnifiedSchedule';

import type {
  UnifiedScheduleCategory,
  UnifiedScheduleEntry,
  UnifiedScheduleFilters,
} from '../types/unifiedSchedule';

import '../styles/shifts.css';

type ShiftsWorkspaceTab =
  | 'calendar'
  | 'availability'
  | 'period-management';

interface ShiftsWorkspaceTabDefinition {
  id: ShiftsWorkspaceTab;

  label: string;

  description: string;

  icon: typeof CalendarDays;
}

const workspaceTabs:
  ShiftsWorkspaceTabDefinition[] = [
    {
      id: 'calendar',

      label: 'לוח משמרות',

      description:
        'צפייה מאוחדת בשיבוצי מוקדנים, כונני בוקר וכוננים.',

      icon: CalendarDays,
    },

    {
      id: 'availability',

      label: 'אילוצים',

      description:
        'פתיחת תקופות אילוצים ומעקב אחר הגשות.',

      icon: ClipboardList,
    },

    {
      id: 'period-management',

      label: 'ניהול תקופה',

      description:
        'יצירת שיבוצים, בדיקתם ופרסומם.',

      icon: Settings2,
    },
  ];

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

const categoryLabels:
  Record<
    UnifiedScheduleCategory,
    string
  > = {
    dispatcher:
      'מוקדן',

    morning_driver:
      'כונן בוקר',

    on_call:
      'כונן',
  };

const filterDefinitions: Array<{
  key:
    keyof UnifiedScheduleFilters;

  category:
    UnifiedScheduleCategory;

  label:
    string;
}> = [
  {
    key: 'dispatcher',

    category:
      'dispatcher',

    label:
      'מוקדנים',
  },

  {
    key:
      'morningDriver',

    category:
      'morning_driver',

    label:
      'כונני בוקר',
  },

  {
    key:
      'onCall',

    category:
      'on_call',

    label:
      'כוננים',
  },
];

const maximumVisibleEntriesPerDay =
  3;

function getCurrentMonth(): {
  year: number;

  month: number;
} {
  const currentDate =
    new Date();

  return {
    year:
      currentDate.getFullYear(),

    month:
      currentDate.getMonth() +
      1,
  };
}

function getPreviousMonth(
  year: number,
  month: number,
): {
  year: number;

  month: number;
} {
  if (
    month === 1
  ) {
    return {
      year:
        year - 1,

      month:
        12,
    };
  }

  return {
    year,

    month:
      month - 1,
  };
}

function getNextMonth(
  year: number,
  month: number,
): {
  year: number;

  month: number;
} {
  if (
    month === 12
  ) {
    return {
      year:
        year + 1,

      month:
        1,
    };
  }

  return {
    year,

    month:
      month + 1,
  };
}

function formatEntryTime(
  entry:
    UnifiedScheduleEntry,
): string | null {
  if (
    !entry.startTime &&
    !entry.endTime
  ) {
    return null;
  }

  if (
    entry.startTime &&
    entry.endTime
  ) {
    return (
      `${entry.startTime}–` +
      `${entry.endTime}`
    );
  }

  return (
    entry.startTime ??
    entry.endTime
  );
}

function formatDate(
  dateValue: string,
): string {
  const date =
    new Date(
      `${dateValue}T12:00:00`,
    );

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return dateValue;
  }

  return new Intl.DateTimeFormat(
    'he-IL',
    {
      weekday:
        'long',

      day:
        '2-digit',

      month:
        '2-digit',

      year:
        'numeric',

      timeZone:
        'Asia/Jerusalem',
    },
  ).format(date);
}

function getEntryDisplayName(
  entry:
    UnifiedScheduleEntry,
): string {
  return (
    entry.assignedUserName ??
    'לא משובץ'
  );
}

function ShiftsPage() {
  const initialMonth =
    useMemo(
      () =>
        getCurrentMonth(),
      [],
    );
const initialPlanningMonth =
  useMemo(
    () =>
      getNextMonth(
        initialMonth.year,
        initialMonth.month,
      ),
    [
      initialMonth.month,
      initialMonth.year,
    ],
  );

const [
  searchParams,
  setSearchParams,
] =
  useSearchParams();

const requestedWorkspaceTab =
  searchParams.get(
    'tab',
  );

const initialWorkspaceTab:
  ShiftsWorkspaceTab =
    requestedWorkspaceTab ===
      'availability' ||
    requestedWorkspaceTab ===
      'period-management' ||
    requestedWorkspaceTab ===
      'calendar'
      ? requestedWorkspaceTab
      : 'calendar';
  const [
    displayedYear,
    setDisplayedYear,
  ] =
    useState(
      initialMonth.year,
    );
const [
  activeTab,
  setActiveTab,
] =
  useState<ShiftsWorkspaceTab>(
    initialWorkspaceTab,
  );
  const [
    displayedMonth,
    setDisplayedMonth,
  ] =
    useState(
      initialMonth.month,
    );

    const [
  planningYear,
  setPlanningYear,
] =
  useState(
    initialPlanningMonth.year,
  );

const [
  planningMonth,
  setPlanningMonth,
] =
  useState(
    initialPlanningMonth.month,
  );

  const [
    selectedDate,
    setSelectedDate,
  ] =
    useState<
      string | null
    >(
      null,
    );

  const {
    state,
    filters,
    visibleEntries,
    loadMonth,
    setCategoryVisibility,
  } =
    useUnifiedSchedule();

  useEffect(
    () => {
      void loadMonth({
        year:
          displayedYear,

        month:
          displayedMonth,
      });
    },
    [
      displayedMonth,
      displayedYear,
      loadMonth,
    ],
  );

  const activeTabDefinition =
    workspaceTabs.find(
      (
        tab,
      ) =>
        tab.id ===
        activeTab,
    ) ??
    workspaceTabs[0];

  const entriesByDate =
    useMemo(
      () => {
        const groupedEntries =
          new Map<
            string,
            UnifiedScheduleEntry[]
          >();

        visibleEntries.forEach(
          (
            entry,
          ) => {
            const existingEntries =
              groupedEntries.get(
                entry.date,
              ) ??
              [];

            existingEntries.push(
              entry,
            );

            groupedEntries.set(
              entry.date,
              existingEntries,
            );
          },
        );

        return groupedEntries;
      },
      [
        visibleEntries,
      ],
    );

  const selectedDateEntries =
    useMemo(
      () => {
        if (
          !selectedDate
        ) {
          return [];
        }

        return (
          entriesByDate.get(
            selectedDate,
          ) ??
          []
        );
      },
      [
        entriesByDate,
        selectedDate,
      ],
    );

  const warningMessages =
    useMemo(
      () =>
        Object.values(
          state.data.warnings,
        ).filter(
          (
            warning,
          ): warning is string =>
            Boolean(
              warning,
            ),
        ),
      [
        state.data.warnings,
      ],
    );
const handlePreviousPlanningMonth =
  (): void => {
    const previousMonth =
      getPreviousMonth(
        planningYear,
        planningMonth,
      );

    setPlanningYear(
      previousMonth.year,
    );

    setPlanningMonth(
      previousMonth.month,
    );
  };

const handleNextPlanningMonth =
  (): void => {
    const nextMonth =
      getNextMonth(
        planningYear,
        planningMonth,
      );

    setPlanningYear(
      nextMonth.year,
    );

    setPlanningMonth(
      nextMonth.month,
    );
  };

const handleNextMonthPlanning =
  (): void => {
    const currentMonth =
      getCurrentMonth();

    const nextMonth =
      getNextMonth(
        currentMonth.year,
        currentMonth.month,
      );

    setPlanningYear(
      nextMonth.year,
    );

    setPlanningMonth(
      nextMonth.month,
    );
  };
  const handlePreviousMonth =
    (): void => {
      const previousMonth =
        getPreviousMonth(
          displayedYear,
          displayedMonth,
        );

      setDisplayedYear(
        previousMonth.year,
      );

      setDisplayedMonth(
        previousMonth.month,
      );

      setSelectedDate(
        null,
      );
    };
const handleWorkspaceTabChange =
  (
    tab:
      ShiftsWorkspaceTab,
  ): void => {
    setActiveTab(
      tab,
    );

    setSearchParams(
      {
        tab,
      },
      {
        replace:
          true,
      },
    );
  };
  const handleNextMonth =
    (): void => {
      const nextMonth =
        getNextMonth(
          displayedYear,
          displayedMonth,
        );

      setDisplayedYear(
        nextMonth.year,
      );

      setDisplayedMonth(
        nextMonth.month,
      );

      setSelectedDate(
        null,
      );
    };

  const handleCurrentMonth =
    (): void => {
      const currentMonth =
        getCurrentMonth();

      setDisplayedYear(
        currentMonth.year,
      );

      setDisplayedMonth(
        currentMonth.month,
      );

      setSelectedDate(
        null,
      );
    };

  const renderCalendarDayContent =
    (
      context:
        MonthCalendarDayContext,
    ) => {
      const dayEntries =
        entriesByDate.get(
          context.date,
        ) ??
        [];

      if (
        dayEntries.length ===
        0
      ) {
        return (
          <span className="unified-calendar-empty-day">
            אין שיבוצים
          </span>
        );
      }

      const visibleDayEntries =
        dayEntries.slice(
          0,
          maximumVisibleEntriesPerDay,
        );

      const hiddenEntriesCount =
        dayEntries.length -
        visibleDayEntries.length;

      return (
        <>
          {visibleDayEntries.map(
            (
              entry,
            ) => {
              const timeLabel =
                formatEntryTime(
                  entry,
                );

              return (
                <div
                  key={
                    entry.id
                  }
                  className={[
                    'unified-calendar-entry',

                    `unified-calendar-entry-${entry.category}`,

                    !entry.assignedUserName
                      ? 'unified-calendar-entry-unassigned'
                      : '',
                  ]
                    .filter(
                      Boolean,
                    )
                    .join(
                      ' ',
                    )}
                >
                  <span className="unified-calendar-entry-category">
                    {
                      categoryLabels[
                        entry.category
                      ]
                    }
                  </span>

                  <span className="unified-calendar-entry-name">
                    {
                      getEntryDisplayName(
                        entry,
                      )
                    }
                  </span>

                  {timeLabel ? (
                    <span className="unified-calendar-entry-time">
                      {
                        timeLabel
                      }
                    </span>
                  ) : null}
                </div>
              );
            },
          )}

          {hiddenEntriesCount >
          0 ? (
            <span className="unified-calendar-more">
              +
              {
                hiddenEntriesCount
              }{' '}
              נוספים
            </span>
          ) : null}
        </>
      );
    };

  const handleDayClick =
    (
      context:
        MonthCalendarDayContext,
    ): void => {
      const dayEntries =
        entriesByDate.get(
          context.date,
        ) ??
        [];

      if (
        dayEntries.length ===
        0
      ) {
        return;
      }

      setSelectedDate(
        context.date,
      );
    };

  return (
    <>
      <PageHeader
        title="משמרות"
        description="ניהול מאוחד של מוקדנים, כונני בוקר וכוננים."
      />

      <nav
        className="shifts-workspace-tabs"
        aria-label="אזורי ניהול משמרות"
      >
        {workspaceTabs.map(
          (
            tab,
          ) => {
            const Icon =
              tab.icon;

            const isActive =
              activeTab ===
              tab.id;

            return (
              <Button
                key={
                  tab.id
                }
                type="button"
                variant={
                  isActive
                    ? 'primary'
                    : 'secondary'
                }
                className="shifts-workspace-tab"
                aria-pressed={
                  isActive
                }
                onClick={() =>
                  handleWorkspaceTabChange(
                    tab.id,
                  )
                }
              >
                <Icon
                  size={
                    18
                  }
                  aria-hidden="true"
                />

                {
                  tab.label
                }
              </Button>
            );
          },
        )}
      </nav>
{activeTab !==
'calendar' ? (
  <Card>
    <CardBody>
      <div className="unified-schedule-toolbar">
        <div className="unified-schedule-month-navigation">
          <Button
            type="button"
            variant="secondary"
            className="unified-schedule-navigation-button"
            aria-label="תקופת התכנון הקודמת"
            onClick={
              handlePreviousPlanningMonth
            }
          >
            <ChevronRight
              size={
                18
              }
              aria-hidden="true"
            />

            חודש קודם
          </Button>

          <div className="unified-schedule-current-month">
            <strong>
              {
                hebrewMonths[
                  planningMonth -
                    1
                ]
              }
            </strong>

            <span>
              {
                planningYear
              }
            </span>
          </div>

          <Button
            type="button"
            variant="secondary"
            className="unified-schedule-navigation-button"
            aria-label="תקופת התכנון הבאה"
            onClick={
              handleNextPlanningMonth
            }
          >
            חודש הבא

            <ChevronLeft
              size={
                18
              }
              aria-hidden="true"
            />
          </Button>
        </div>

        <Button
          type="button"
          variant="secondary"
          onClick={
            handleNextMonthPlanning
          }
        >
          החודש הבא לתכנון
        </Button>
      </div>
    </CardBody>
  </Card>
) : null}
    {activeTab ===
    'calendar' ? (
      <section className="unified-schedule-workspace">
          <Card>
            <CardBody>
              <div className="unified-schedule-toolbar">
                <div className="unified-schedule-month-navigation">
                  <Button
                    type="button"
                    variant="secondary"
                    className="unified-schedule-navigation-button"
                    aria-label="החודש הקודם"
                    onClick={
                      handlePreviousMonth
                    }
                  >
                    <ChevronRight
                      size={
                        18
                      }
                      aria-hidden="true"
                    />

                    חודש קודם
                  </Button>

                  <div className="unified-schedule-current-month">
                    <strong>
                      {
                        hebrewMonths[
                          displayedMonth -
                            1
                        ]
                      }
                    </strong>

                    <span>
                      {
                        displayedYear
                      }
                    </span>
                  </div>

                  <Button
                    type="button"
                    variant="secondary"
                    className="unified-schedule-navigation-button"
                    aria-label="החודש הבא"
                    onClick={
                      handleNextMonth
                    }
                  >
                    חודש הבא

                    <ChevronLeft
                      size={
                        18
                      }
                      aria-hidden="true"
                    />
                  </Button>
                </div>

                <Button
                  type="button"
                  variant="secondary"
                  onClick={
                    handleCurrentMonth
                  }
                >
                  החודש הנוכחי
                </Button>
              </div>

              <fieldset className="unified-schedule-filters">
                <legend>
                  הצג בלוח
                </legend>

                <div className="unified-schedule-filter-options">
                  {filterDefinitions.map(
                    (
                      filter,
                    ) => (
                      <label
                        key={
                          filter.key
                        }
                        className={[
                          'unified-schedule-filter',

                          `unified-schedule-filter-${filter.category}`,
                        ].join(
                          ' ',
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={
                            filters[
                              filter.key
                            ]
                          }
                          onChange={(
                            event,
                          ) =>
                            setCategoryVisibility(
                              filter.key,
                              event
                                .target
                                .checked,
                            )
                          }
                        />

                        <span>
                          {
                            filter.label
                          }
                        </span>
                      </label>
                    ),
                  )}
                </div>
              </fieldset>
            </CardBody>
          </Card>

          {state.error ? (
            <div
              className="unified-schedule-message unified-schedule-message-error"
              role="alert"
            >
              {
                state.error
              }
            </div>
          ) : null}

          {warningMessages.length >
          0 ? (
            <div className="unified-schedule-message unified-schedule-message-warning">
              <strong>
                חלק מהמידע לא נטען:
              </strong>

              <ul>
                {warningMessages.map(
                  (
                    warning,
                  ) => (
                    <li
                      key={
                        warning
                      }
                    >
                      {
                        warning
                      }
                    </li>
                  ),
                )}
              </ul>
            </div>
          ) : null}

          {state.isLoading ? (
            <Card>
              <CardBody>
                <div className="unified-schedule-loading">
                  טוען את לוחות המשמרות...
                </div>
              </CardBody>
            </Card>
          ) : (
            <MonthCalendar
              year={
                displayedYear
              }
              month={
                displayedMonth
              }
              renderDayContent={
                renderCalendarDayContent
              }
              onDayClick={
                handleDayClick
              }
            />
          )}
        </section>
          ) : activeTab ===
            'availability' ? (
          <UnifiedAvailabilityManagement
            year={
              planningYear
            }
            month={
              planningMonth
            }
          />
          ) : activeTab ===
            'period-management' ? (
          <UnifiedPeriodManagement
            year={
              planningYear
            }
            month={
              planningMonth
            }
          />
          ) : (
            <Card>
              <CardBody>
                <section className="shifts-placeholder">
                  <activeTabDefinition.icon
                    size={
                      36
                    }
                    aria-hidden="true"
                  />

                  <div>
                    <h2>
                      {
                        activeTabDefinition.label
                      }
                    </h2>

                    <p>
                      {
                        activeTabDefinition.description
                      }
                    </p>
                  </div>
                </section>
              </CardBody>
            </Card>
          )}

      <Modal
        isOpen={
          selectedDate !==
          null
        }
        title={
          selectedDate
            ? `משמרות ליום ${formatDate(
                selectedDate,
              )}`
            : 'פרטי משמרות'
        }
        footer={
          <Button
            type="button"
            variant="secondary"
            onClick={() =>
              setSelectedDate(
                null,
              )
            }
          >
            סגירה
          </Button>
        }
        onClose={() =>
          setSelectedDate(
            null,
          )
        }
      >
        <div className="unified-schedule-day-details">
          {selectedDateEntries.map(
            (
              entry,
            ) => {
              const timeLabel =
                formatEntryTime(
                  entry,
                );

              return (
                <article
                  key={
                    entry.id
                  }
                  className={[
                    'unified-schedule-day-entry',

                    `unified-schedule-day-entry-${entry.category}`,
                  ].join(
                    ' ',
                  )}
                >
                  <div className="unified-schedule-day-entry-header">
                    <span className="unified-schedule-day-entry-category">
                      {
                        categoryLabels[
                          entry.category
                        ]
                      }
                    </span>

                    {entry.isLocked ? (
                      <span className="unified-schedule-day-entry-status">
                        נעול
                      </span>
                    ) : null}
                  </div>

                  <strong>
                    {
                      getEntryDisplayName(
                        entry,
                      )
                    }
                  </strong>

                  {timeLabel ? (
                    <span>
                      שעות:{' '}
                      {
                        timeLabel
                      }
                    </span>
                  ) : (
                    <span>
                      משמרת יום מלאה
                    </span>
                  )}

                  {entry.notes ? (
                    <p>
                      {
                        entry.notes
                      }
                    </p>
                  ) : null}
                </article>
              );
            },
          )}
        </div>
      </Modal>
    </>
  );
}

export default ShiftsPage;