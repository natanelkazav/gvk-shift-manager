import {
  CalendarPlus,
  CheckCircle2,
  RefreshCw,
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
import { useAvailabilityPeriods } from '../hooks/useAvailabilityPeriods';
import type {
  AvailabilityPeriodStatus,
} from '../types/availability';
import '../styles/availability.css';

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

const statusLabels:
  Record<
    AvailabilityPeriodStatus,
    string
  > = {
    draft: 'טיוטה',
    open: 'פתוח להגשה',
    closed: 'סגור',
    archived: 'בארכיון',
  };

function formatDate(
  value: string | null,
): string {
  if (!value) {
    return 'לא הוגדר';
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
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

function AvailabilityPage() {
  const {
    hasPermission,
  } = useAuth();

  const canManage =
    hasPermission(
      'availability.manage',
    );

  const now =
    new Date();

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
              state.isCreating
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
                  state.isCreating
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
                      key={
                        monthName
                      }
                      value={
                        index + 1
                      }
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
                  state.isCreating
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
                  state.isCreating
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
                  state.isCreating
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
                state.isCreating
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
                state.isCreating
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
              (period) => (
                <article
                  key={period.id}
                  className="availability-period-item"
                >
                  <div>
                    <strong>
                      {period.title ??
                        `${hebrewMonths[
                          period.month -
                            1
                        ]} ${period.year}`}
                    </strong>

                    <span>
                      מועד אחרון:{' '}
                      {formatDate(
                        period
                          .submissionDeadline,
                      )}
                    </span>
                  </div>

                  <span
                    className={`availability-status availability-status-${period.status}`}
                  >
                    {
                      statusLabels[
                        period.status
                      ]
                    }
                  </span>
                </article>
              ),
            )}
          </div>
        )}
      </div>
    </section>
  );
}

export default AvailabilityPage;