import {
  CalendarDays,
  CheckCircle2,
  CircleAlert,
  Clock3,
  RefreshCw,
  Save,
  Send,
  Users,
  XCircle,
} from 'lucide-react';

import {
  useMemo,
} from 'react';

import {
  Button,
} from '../ui';

import {
  useMorningDriverAvailability,
} from '../../hooks/useMorningDriverAvailability';

import type {
  MorningDriverAvailabilityShift,
} from '../../types/morningDriverAvailability';

import '../../styles/morningDriverAvailabilityPersonal.css';

const HEBREW_MONTHS = [
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
] as const;

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
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    },
  ).format(date);
}

function formatDateTime(
  value:
    string | null,
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
    return value;
  }

  return new Intl.DateTimeFormat(
    'he-IL',
    {
      dateStyle: 'short',
      timeStyle: 'short',
    },
  ).format(date);
}

function formatTime(
  value: string,
): string {
  return value.slice(
    0,
    5,
  );
}

function getShiftLabel(
  shift:
    MorningDriverAvailabilityShift,
): string {
  switch (
    shift.shiftType
  ) {
    case 'weekday_morning':
      return 'משמרת בוקר';

    case 'weekday_evening':
      return 'משמרת ערב';

    case 'friday_morning':
      return 'משמרת שישי';

    default:
      return 'משמרת';
  }
}

function MyMorningDriverAvailabilityPanel() {
  const {
    state,
    statistics,
    isDirty,
    loadAvailability,
    setShiftStatus,
    setShiftNote,
    markAllAvailable,
    saveAvailability,
    submitAvailability,
  } =
    useMorningDriverAvailability();

  const groupedShifts =
    useMemo(
      () => {
        const groups =
          new Map<
            string,
            MorningDriverAvailabilityShift[]
          >();

        for (
          const shift
          of state.data?.shifts ??
          []
        ) {
          const currentGroup =
            groups.get(
              shift.shiftDate,
            ) ??
            [];

          currentGroup.push(
            shift,
          );

          groups.set(
            shift.shiftDate,
            currentGroup,
          );
        }

        return Array
          .from(
            groups.entries(),
          )
          .map(
            ([
              date,
              shifts,
            ]) => ({
              date,
              shifts:
                [...shifts]
                  .sort(
                    (
                      firstShift,
                      secondShift,
                    ) =>
                      firstShift.sortOrder -
                      secondShift.sortOrder,
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
      },
      [
        state.data,
      ],
    );

  if (
    state.isLoading
  ) {
    return (
      <section className="my-morning-driver-panel">
        <div className="my-morning-driver-empty">
          <RefreshCw
            size={32}
            className="my-morning-driver-spin"
            aria-hidden="true"
          />

          <strong>
            טוען את אילוצי כונני הבוקר
          </strong>
        </div>
      </section>
    );
  }

  if (
    state.error &&
    !state.data
  ) {
    return (
      <section className="my-morning-driver-panel">
        <div
          className="my-morning-driver-error"
          role="alert"
        >
          <CircleAlert
            size={30}
            aria-hidden="true"
          />

          <strong>
            לא ניתן היה לטעון את האילוצים
          </strong>

          <span>
            {state.error}
          </span>

          <Button
            type="button"
            onClick={() => {
              void loadAvailability();
            }}
          >
            ניסיון נוסף
          </Button>
        </div>
      </section>
    );
  }

  if (
    !state.data
  ) {
    return (
      <section className="my-morning-driver-panel">
        <div className="my-morning-driver-empty">
          <CalendarDays
            size={34}
            aria-hidden="true"
          />

          <strong>
            אין כרגע חודש פתוח להגשת אילוצים
          </strong>

          <span>
            לאחר שמנהל יפתח חודש אילוצים, המשמרות יופיעו כאן.
          </span>

          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              void loadAvailability();
            }}
          >
            רענון
          </Button>
        </div>
      </section>
    );
  }

  const {
    period,
    submission,
  } =
    state.data;

  const periodTitle =
    period.title ??
    `${HEBREW_MONTHS[period.month - 1]} ${period.year}`;

  const isSubmitted =
    submission.status ===
    'submitted';

  const isEditable =
    period.status ===
      'open' &&
    !isSubmitted &&
    !state.isSaving &&
    !state.isSubmitting;

  return (
    <section className="my-morning-driver-panel">
      <header className="my-morning-driver-header">
        <div>
          <span className="my-morning-driver-eyebrow">
            האילוצים שלי
          </span>

          <h2>
            {periodTitle}
          </h2>

          <p>
            יש לסמן זמינות לכל משמרת בנפרד.
          </p>
        </div>

        <div className="my-morning-driver-header-actions">
          {!isSubmitted ? (
            <button
              type="button"
              className="my-morning-driver-mark-all"
              disabled={
                !isEditable
              }
              onClick={() => {
                const confirmed =
                  window.confirm(
                    'לסמן את כל המשמרות כזמינות?\n\nהפעולה משנה רק את הטיוטה במסך ואינה שומרת או מגישה.',
                  );

                if (
                  confirmed
                ) {
                  markAllAvailable();
                }
              }}
            >
              <CheckCircle2
                size={18}
                aria-hidden="true"
              />

              סמן הכול כזמין
            </button>
          ) : null}

          <Button
            type="button"
            variant="secondary"
            disabled={
              state.isSaving ||
              state.isSubmitting
            }
            onClick={() => {
              void loadAvailability();
            }}
          >
            <RefreshCw
              size={17}
              aria-hidden="true"
            />

            רענון
          </Button>
        </div>
      </header>

      <div className="my-morning-driver-period-info">
        <div>
          <Clock3
            size={18}
            aria-hidden="true"
          />

          <span>
            מועד אחרון:
          </span>

          <strong>
            {formatDateTime(
              period.submissionDeadline,
            )}
          </strong>
        </div>

        <span
          className={[
            'my-morning-driver-submission-status',
            `my-morning-driver-submission-status-${submission.status}`,
          ].join(' ')}
        >
          {submission.status ===
          'submitted'
            ? 'הוגש'
            : submission.status ===
                'reopened'
              ? 'נפתח מחדש'
              : 'טיוטה'}
        </span>
      </div>

      {period.instructions ? (
        <div className="my-morning-driver-instructions">
          <strong>
            הנחיות
          </strong>

          <p>
            {period.instructions}
          </p>
        </div>
      ) : null}

      {state.error ? (
        <div
          className="my-morning-driver-inline-error"
          role="alert"
        >
          {state.error}
        </div>
      ) : null}

      {state.lastSaveResult ? (
        <div
          className="my-morning-driver-success"
          role="status"
        >
          האילוצים נשמרו בהצלחה.
        </div>
      ) : null}

      {state.lastSubmitResult ? (
        <div
          className="my-morning-driver-success"
          role="status"
        >
          האילוצים הוגשו בהצלחה.
        </div>
      ) : null}

      {isSubmitted ? (
        <div className="my-morning-driver-locked">
          האילוצים כבר הוגשו. כדי לערוך אותם מחדש, מנהל צריך לפתוח את ההגשה מחדש.
        </div>
      ) : null}

      <div className="my-morning-driver-summary">
        <article>
          <CheckCircle2
            size={21}
            aria-hidden="true"
          />

          <strong>
            {statistics.available}
          </strong>

          <span>
            זמינות
          </span>
        </article>

        <article>
          <XCircle
            size={21}
            aria-hidden="true"
          />

          <strong>
            {statistics.unavailable}
          </strong>

          <span>
            אי־זמינות
          </span>
        </article>

        <article>
          <CircleAlert
            size={21}
            aria-hidden="true"
          />

          <strong>
            {statistics.unmarked}
          </strong>

          <span>
            טרם סומנו
          </span>
        </article>

        <article>
          <Users
            size={21}
            aria-hidden="true"
          />

          <strong>
            {statistics.completionPercentage}%
          </strong>

          <span>
            הושלם
          </span>
        </article>
      </div>

      <div className="my-morning-driver-days">
        {groupedShifts.map(
          (
            group,
          ) => {
            const firstShift =
              group.shifts[0];

            return (
              <article
                key={
                  group.date
                }
                className="my-morning-driver-day-card"
              >
                <header>
                  <div>
                    <span>
                      {
                        firstShift
                          ?.weekdayName
                      }
                    </span>

                    <strong>
                      {formatDate(
                        group.date,
                      )}
                    </strong>
                  </div>

                  <span>
                    {
                      group.shifts
                        .length
                    }{' '}
                    משמרות
                  </span>
                </header>

                <div className="my-morning-driver-shifts">
                  {group.shifts.map(
                    (
                      shift,
                    ) => (
                      <section
                        key={
                          shift.id
                        }
                        className={[
                          'my-morning-driver-shift',
                          shift.availabilityStatus
                            ? `my-morning-driver-shift-${shift.availabilityStatus}`
                            : 'my-morning-driver-shift-unmarked',
                        ].join(' ')}
                      >
                        <div className="my-morning-driver-shift-heading">
                          <div>
                            <strong>
                              {
                                getShiftLabel(
                                  shift,
                                )
                              }
                            </strong>

                            <span dir="ltr">
                              {formatTime(
                                shift.startTime,
                              )}
                              {' – '}
                              {formatTime(
                                shift.endTime,
                              )}
                            </span>
                          </div>

                          <span className="my-morning-driver-workers-badge">
                            {shift.recommendedWorkers >
                            shift.minimumWorkers
                              ? `מומלץ ${shift.recommendedWorkers} כוננים · מינימום ${shift.minimumWorkers}`
                              : `כונן ${shift.minimumWorkers === 1 ? 'אחד' : shift.minimumWorkers}`}
                          </span>
                        </div>

                        <div className="my-morning-driver-shift-actions">
                          <button
                            type="button"
                            className={[
                              'my-morning-driver-choice',
                              'my-morning-driver-choice-available',
                              shift.availabilityStatus ===
                              'available'
                                ? 'my-morning-driver-choice-active'
                                : '',
                            ]
                              .filter(Boolean)
                              .join(' ')}
                            disabled={
                              !isEditable
                            }
                            aria-pressed={
                              shift.availabilityStatus ===
                              'available'
                            }
                            onClick={() => {
                              setShiftStatus(
                                shift.id,
                                'available',
                              );
                            }}
                          >
                            <CheckCircle2
                              size={16}
                              aria-hidden="true"
                            />

                            זמין
                          </button>

                          <button
                            type="button"
                            className={[
                              'my-morning-driver-choice',
                              'my-morning-driver-choice-unavailable',
                              shift.availabilityStatus ===
                              'unavailable'
                                ? 'my-morning-driver-choice-active'
                                : '',
                            ]
                              .filter(Boolean)
                              .join(' ')}
                            disabled={
                              !isEditable
                            }
                            aria-pressed={
                              shift.availabilityStatus ===
                              'unavailable'
                            }
                            onClick={() => {
                              setShiftStatus(
                                shift.id,
                                'unavailable',
                              );
                            }}
                          >
                            <XCircle
                              size={16}
                              aria-hidden="true"
                            />

                            לא זמין
                          </button>
                        </div>

                        <label className="my-morning-driver-note">
                          <span>
                            הערה
                          </span>

                          <textarea
                            rows={2}
                            value={
                              shift.note ??
                              ''
                            }
                            disabled={
                              !isEditable
                            }
                            placeholder="הערה אופציונלית"
                            onChange={(
                              event,
                            ) => {
                              setShiftNote(
                                shift.id,
                                event.target.value,
                              );
                            }}
                          />
                        </label>
                      </section>
                    ),
                  )}
                </div>
              </article>
            );
          },
        )}
      </div>

      <footer className="my-morning-driver-footer">
        <div>
          {isDirty ? (
            <strong>
              קיימים שינויים שטרם נשמרו.
            </strong>
          ) : statistics.unmarked >
            0 ? (
            <span>
              נותרו{' '}
              {
                statistics.unmarked
              }{' '}
              משמרות שטרם סומנו.
            </span>
          ) : isSubmitted ? (
            <span>
              האילוצים הוגשו.
            </span>
          ) : (
            <span>
              כל המשמרות סומנו וניתן להגיש.
            </span>
          )}
        </div>

        <div className="my-morning-driver-footer-actions">
          <Button
            type="button"
            disabled={
              !isEditable ||
              !isDirty
            }
            onClick={() => {
              void saveAvailability();
            }}
          >
            <Save
              size={18}
              aria-hidden="true"
            />

            {state.isSaving
              ? 'שומר...'
              : 'שמירת אילוצים'}
          </Button>

          <Button
            type="button"
            variant="secondary"
            disabled={
              !isEditable ||
              isDirty ||
              statistics.unmarked >
                0
            }
            onClick={() => {
              const confirmed =
                window.confirm(
                  'להגיש את אילוצי כונני הבוקר?\n\nלאחר ההגשה לא ניתן יהיה לערוך אותם ללא פתיחה מחדש על ידי מנהל.',
                );

              if (
                confirmed
              ) {
                void submitAvailability();
              }
            }}
          >
            <Send
              size={18}
              aria-hidden="true"
            />

            {state.isSubmitting
              ? 'מגיש...'
              : 'הגשת אילוצים'}
          </Button>
        </div>
      </footer>
    </section>
  );
}

export default MyMorningDriverAvailabilityPanel;
