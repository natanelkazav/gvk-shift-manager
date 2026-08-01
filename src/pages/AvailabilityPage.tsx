import {
  CalendarPlus,
  CheckCircle2,
  Download,
  RefreshCw,
  RotateCcw,
  Send,
} from 'lucide-react';
import {
  useMemo,
  useState,
  type FormEvent,
} from 'react';
import { useAuth } from '../auth/AuthContext';
import {
  Button,
  PageHeader,
} from '../components/ui';
import {
  useAvailabilityPeriods,
} from '../hooks/useAvailabilityPeriods';
import type {
  AvailabilityPeriodStatus,
  SpecialDayScheduleType,
} from '../types/availability';
import '../styles/availability.css';
import DispatcherAvailabilityPanel from '../components/availability/DispatcherAvailabilityPanel';
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

const statusLabels: Record<
  AvailabilityPeriodStatus,
  string
> = {
  draft: 'טיוטה',
  open: 'פתוח להגשה',
  closed: 'סגור',
  archived: 'בארכיון',
};

const specialDayTypeLabels: Record<
  SpecialDayScheduleType,
  string
> = {
  holiday_eve: 'ערב חג',
  holiday_full: 'חג מלא',
  holiday_end: 'מוצאי / סיום חג',
  chol_hamoed: 'חול המועד',
};

function formatDate(
  value: string | null,
): string {
  if (!value) {
    return 'לא הוגדר';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'תאריך לא תקין';
  }

  return new Intl.DateTimeFormat(
    'he-IL',
    {
      dateStyle: 'short',
      timeStyle: 'short',
    },
  ).format(date);
}

function formatDateOnly(
  value: string,
): string {
  const date = new Date(
    `${value}T12:00:00`,
  );

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(
    'he-IL',
    {
      dateStyle: 'short',
    },
  ).format(date);
}

function AvailabilityPage() {
    const {
      profile,
      hasPermission,
    } = useAuth();

  const canManage =
    hasPermission(
      'availability.manage',
    );

  const now = new Date();

  const defaultNextMonth =
    now.getMonth() === 11
      ? 1
      : now.getMonth() + 2;

  const defaultYear =
    now.getMonth() === 11
      ? now.getFullYear() + 1
      : now.getFullYear();

  const [
    selectedMonth,
    setSelectedMonth,
  ] = useState(
    defaultNextMonth,
  );

  const [
    selectedYear,
    setSelectedYear,
  ] = useState(
    defaultYear,
  );

  const [
    importYear,
    setImportYear,
  ] = useState(
    defaultYear,
  );

  const [
    title,
    setTitle,
  ] = useState('');

  const [
    instructions,
    setInstructions,
  ] = useState('');

  const [
    deadline,
    setDeadline,
  ] = useState('');

  const {
    state,
    loadPeriods,
    createPeriod,
    importSpecialDays,
    rebuildPeriodSlots,
    openPeriod,
    clearError,
  } = useAvailabilityPeriods();

  const availableYears =
    useMemo(
      () => {
        const currentYear =
          new Date()
            .getFullYear();

        return [
          currentYear,
          currentYear + 1,
          currentYear + 2,
        ];
      },
      [],
    );

  const handleRebuildPeriod =
    async (
      periodId: string,
      periodTitle: string,
    ): Promise<void> => {
      const confirmed =
        window.confirm(
          `האם לבנות מחדש את כל המשמרות עבור "${periodTitle}"?\n\nהפעולה תמחק את המשמרות הקיימות של החודש ותיצור אותן מחדש לפי החגים והמועדים המעודכנים.`,
        );

      if (!confirmed) {
        return;
      }

      clearError();

      await rebuildPeriodSlots(
        periodId,
      );
    };

  const handleOpenPeriod =
    async (
      periodId: string,
      periodTitle: string,
    ): Promise<void> => {
      const confirmed =
        window.confirm(
          `האם לפתוח את "${periodTitle}" להגשת אילוצים?\n\nלאחר הפתיחה המוקדנים יוכלו להזין זמינות, ולא יהיה ניתן לבנות מחדש את משמרות החודש.`,
        );

      if (!confirmed) {
        return;
      }

      clearError();

      await openPeriod(
        periodId,
      );
    };

  const handleSubmit =
    async (
      event:
        FormEvent<HTMLFormElement>,
    ): Promise<void> => {
      event.preventDefault();

      clearError();

      await createPeriod({
        year:
          selectedYear,

        month:
          selectedMonth,

        submissionDeadline:
          deadline
            ? new Date(
                deadline,
              ).toISOString()
            : null,

        title:
          title.trim() ||
          null,

        instructions:
          instructions.trim() ||
          null,
      });

      setTitle('');
      setInstructions('');
      setDeadline('');
    };

  const handleImportSpecialDays =
    async (): Promise<void> => {
      clearError();

      await importSpecialDays(
        importYear,
      );
    };

  return (
    <section className="availability-page">
      <PageHeader
        title="אילוצי מוקדנים"
        description="פתיחת חודשים להגשת אילוצים וניהול תקופות הזמינות."
        actions={
          <Button
            type="button"
            variant="secondary"
            disabled={
              state.isLoading ||
              state.isCreating ||
              state
                .isImportingSpecialDays ||
              state.rebuildingPeriodId !==
                null ||
              state.openingPeriodId !==
                null
            }
            onClick={() => {
              void loadPeriods();
            }}
          >
            <RefreshCw
              size={18}
              aria-hidden="true"
            />

            רענון
          </Button>
        }
      />
      {profile?.role === 'dispatcher' ? (
        <DispatcherAvailabilityPanel />
) : null}
      {state.error ? (
        <div
          className="availability-error"
          role="alert"
        >
          {state.error}
        </div>
      ) : null}

      {state.lastCreatedResult ? (
        <div
          className="availability-success"
          role="status"
        >
          <CheckCircle2
            size={22}
            aria-hidden="true"
          />

          <div>
            <strong>
              תקופת האילוצים נוצרה
              בהצלחה
            </strong>

            <span>
              נוצרו{' '}
              {
                state
                  .lastCreatedResult
                  .createdSlots
              }{' '}
              משמרות במצב טיוטה.
            </span>
          </div>
        </div>
      ) : null}

      {state.lastRebuildResult ? (
        <div
          className="availability-success"
          role="status"
        >
          <CheckCircle2
            size={22}
            aria-hidden="true"
          />

          <div>
            <strong>
              משמרות החודש נבנו מחדש
            </strong>

            <span>
              נוצרו מחדש{' '}
              {
                state
                  .lastRebuildResult
                  .createdSlots
              }{' '}
              משמרות בהתאם לחגים
              ולמועדים המעודכנים.
            </span>
          </div>
        </div>
      ) : null}

      {state.lastOpenedResult ? (
        <div
          className="availability-success"
          role="status"
        >
          <CheckCircle2
            size={22}
            aria-hidden="true"
          />

          <div>
            <strong>
              תקופת האילוצים נפתחה
              להגשה
            </strong>

            <span>
              המוקדנים יכולים כעת
              להזין אילוצים עבור{' '}
              {
                state
                  .lastOpenedResult
                  .shiftSlotsCount
              }{' '}
              משמרות.
            </span>
          </div>
        </div>
      ) : null}

      {state.lastImportResult ? (
        <div className="availability-import-result">
          <div className="availability-import-summary">
            <CheckCircle2
              size={22}
              aria-hidden="true"
            />

            <div>
              <strong>
                ייבוא החגים לשנת{' '}
                {
                  state
                    .lastImportResult
                    .year
                }{' '}
                הושלם
              </strong>

              <span>
                התקבלו{' '}
                {
                  state
                    .lastImportResult
                    .fetchedEvents
                }{' '}
                אירועים, ומתוכם
                נשמרו{' '}
                {
                  state
                    .lastImportResult
                    .importedEvents
                }{' '}
                ימים מיוחדים.
              </span>
            </div>
          </div>

          <div className="availability-imported-days">
            {state
              .lastImportResult
              .importedDays
              .map((day) => (
                <div
                  key={`${day.date}-${day.scheduleType}-${day.name}`}
                  className="availability-imported-day"
                >
                  <div>
                    <strong>
                      {day.name}
                    </strong>

                    <span>
                      {formatDateOnly(
                        day.date,
                      )}
                    </span>
                  </div>

                  <span className="availability-special-day-type">
                    {
                      specialDayTypeLabels[
                        day.scheduleType
                      ]
                    }
                  </span>
                </div>
              ))}
          </div>
        </div>
      ) : null}

      {canManage ? (
        <div className="availability-import-card">
          <div className="availability-card-header">
            <Download
              size={22}
              aria-hidden="true"
            />

            <div>
              <h2>
                ייבוא חגים ומועדים
              </h2>

              <p>
                ייבוא חגי ישראל
                מ־Hebcal עבור השנה
                שנבחרה.
              </p>
            </div>
          </div>

          <div className="availability-import-controls">
            <label>
              <span>
                שנת ייבוא
              </span>

              <select
                value={importYear}
                disabled={
                  state
                    .isImportingSpecialDays ||
                  state.isCreating ||
                  state.rebuildingPeriodId !==
                    null ||
                  state.openingPeriodId !==
                    null
                }
                onChange={(
                  event,
                ) => {
                  setImportYear(
                    Number(
                      event.target
                        .value,
                    ),
                  );
                }}
              >
                {availableYears.map(
                  (year) => (
                    <option
                      key={year}
                      value={year}
                    >
                      {year}
                    </option>
                  ),
                )}
              </select>
            </label>

            <Button
              type="button"
              disabled={
                state
                  .isImportingSpecialDays ||
                state.isCreating ||
                state.rebuildingPeriodId !==
                  null ||
                state.openingPeriodId !==
                  null
              }
              onClick={() => {
                void handleImportSpecialDays();
              }}
            >
              <Download
                size={18}
                aria-hidden="true"
              />

              {state
                .isImportingSpecialDays
                ? 'מייבא חגים...'
                : `ייבוא חגים לשנת ${importYear}`}
            </Button>
          </div>
        </div>
      ) : null}

      {canManage ? (
        <form
          className="availability-create-card"
          onSubmit={
            handleSubmit
          }
        >
          <div className="availability-card-header">
            <CalendarPlus
              size={22}
              aria-hidden="true"
            />

            <div>
              <h2>
                יצירת חודש אילוצים
              </h2>

              <p>
                המערכת תפיק את כל
                המשמרות האפשריות בחודש.
              </p>
            </div>
          </div>

          <div className="availability-form-grid">
            <label>
              <span>חודש</span>

              <select
                value={
                  selectedMonth
                }
                disabled={
                  state.isCreating ||
                  state
                    .isImportingSpecialDays ||
                  state.rebuildingPeriodId !==
                    null ||
                  state.openingPeriodId !==
                    null
                }
                onChange={(
                  event,
                ) => {
                  setSelectedMonth(
                    Number(
                      event.target
                        .value,
                    ),
                  );
                }}
              >
                {hebrewMonths.map(
                  (
                    monthName,
                    index,
                  ) => (
                    <option
                      key={monthName}
                      value={index + 1}
                    >
                      {monthName}
                    </option>
                  ),
                )}
              </select>
            </label>

            <label>
              <span>שנה</span>

              <select
                value={
                  selectedYear
                }
                disabled={
                  state.isCreating ||
                  state
                    .isImportingSpecialDays ||
                  state.rebuildingPeriodId !==
                    null ||
                  state.openingPeriodId !==
                    null
                }
                onChange={(
                  event,
                ) => {
                  setSelectedYear(
                    Number(
                      event.target
                        .value,
                    ),
                  );
                }}
              >
                {availableYears.map(
                  (year) => (
                    <option
                      key={year}
                      value={year}
                    >
                      {year}
                    </option>
                  ),
                )}
              </select>
            </label>

            <label>
              <span>
                מועד אחרון להגשה
              </span>

              <input
                type="datetime-local"
                value={deadline}
                disabled={
                  state.isCreating ||
                  state
                    .isImportingSpecialDays ||
                  state.rebuildingPeriodId !==
                    null ||
                  state.openingPeriodId !==
                    null
                }
                onChange={(
                  event,
                ) => {
                  setDeadline(
                    event.target
                      .value,
                  );
                }}
              />
            </label>

            <label>
              <span>
                כותרת מותאמת
              </span>

              <input
                type="text"
                value={title}
                disabled={
                  state.isCreating ||
                  state
                    .isImportingSpecialDays ||
                  state.rebuildingPeriodId !==
                    null ||
                  state.openingPeriodId !==
                    null
                }
                placeholder="אופציונלי"
                onChange={(
                  event,
                ) => {
                  setTitle(
                    event.target
                      .value,
                  );
                }}
              />
            </label>
          </div>

          <label className="availability-instructions-field">
            <span>
              הנחיות למוקדנים
            </span>

            <textarea
              rows={4}
              value={
                instructions
              }
              disabled={
                state.isCreating ||
                state
                  .isImportingSpecialDays ||
                state.rebuildingPeriodId !==
                  null ||
                state.openingPeriodId !==
                  null
              }
              placeholder="לדוגמה: יש למלא את כל המשמרות עד למועד האחרון."
              onChange={(
                event,
              ) => {
                setInstructions(
                  event.target
                    .value,
                );
              }}
            />
          </label>

          <div className="availability-create-actions">
            <Button
              type="submit"
              disabled={
                state.isCreating ||
                state
                  .isImportingSpecialDays ||
                state.rebuildingPeriodId !==
                  null ||
                state.openingPeriodId !==
                  null
              }
            >
              <CalendarPlus
                size={18}
                aria-hidden="true"
              />

              {state.isCreating
                ? 'יוצר חודש...'
                : 'יצירת חודש אילוצים'}
            </Button>
          </div>
        </form>
      ) : null}

      <div className="availability-periods-card">
        <h2>
          תקופות אילוצים
        </h2>

        {state.isLoading ? (
          <div className="availability-empty-state">
            טוען תקופות אילוצים...
          </div>
        ) : state.periods.length ===
          0 ? (
          <div className="availability-empty-state">
            עדיין לא נוצרו תקופות
            אילוצים.
          </div>
        ) : (
          <div className="availability-periods-list">
            {state.periods.map(
              (period) => {
                const periodTitle =
                  period.title ??
                  `${hebrewMonths[
                    period.month - 1
                  ]} ${period.year}`;

                return (
                  <article
                    key={period.id}
                    className="availability-period-item"
                  >
                    <div className="availability-period-main">
                      <strong>
                        {periodTitle}
                      </strong>

                      <span>
                        מועד אחרון:{' '}
                        {formatDate(
                          period
                            .submissionDeadline,
                        )}
                      </span>

                      {period.openedAt ? (
                        <span>
                          נפתח להגשה:{' '}
                          {formatDate(
                            period.openedAt,
                          )}
                        </span>
                      ) : null}
                    </div>

                    <div className="availability-period-actions">
                      <span
                        className={`availability-status availability-status-${period.status}`}
                      >
                        {
                          statusLabels[
                            period.status
                          ]
                        }
                      </span>

                      {canManage &&
                      period.status ===
                        'draft' ? (
                        <Button
                          type="button"
                          variant="secondary"
                          disabled={
                            state.rebuildingPeriodId !==
                              null ||
                            state.openingPeriodId !==
                              null ||
                            state.isCreating ||
                            state
                              .isImportingSpecialDays
                          }
                          onClick={() => {
                            void handleRebuildPeriod(
                              period.id,
                              periodTitle,
                            );
                          }}
                        >
                          <RotateCcw
                            size={17}
                            aria-hidden="true"
                          />

                          {state.rebuildingPeriodId ===
                          period.id
                            ? 'בונה מחדש...'
                            : 'בנייה מחדש'}
                        </Button>
                      ) : null}

                      {canManage &&
                      period.status ===
                        'draft' ? (
                        <Button
                          type="button"
                          disabled={
                            state.openingPeriodId !==
                              null ||
                            state.rebuildingPeriodId !==
                              null ||
                            state.isCreating ||
                            state
                              .isImportingSpecialDays
                          }
                          onClick={() => {
                            void handleOpenPeriod(
                              period.id,
                              periodTitle,
                            );
                          }}
                        >
                          <Send
                            size={17}
                            aria-hidden="true"
                          />

                          {state.openingPeriodId ===
                          period.id
                            ? 'פותח להגשה...'
                            : 'פתיחה להגשה'}
                        </Button>
                      ) : null}
                    </div>
                  </article>
                );
              },
            )}
          </div>
        )}
      </div>
    </section>
  );
}

export default AvailabilityPage;  