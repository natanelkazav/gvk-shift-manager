/**
 * קובץ: src/components/driverAvailability/MyDriverAvailabilityPanel.tsx
 * מטרה: מימוש רכיב תצוגה ואינטראקציה עבור כוננים / אילוצים וזמינות.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: EditableDriverAvailabilityEntry, MyDriverAvailabilityPanelProps, DriverAvailabilityDayView, formatDate, formatDateTime, getStatusLabel, getStatusIcon, MyDriverAvailabilityPanel.
 * - קישור מאפיינים ומצב מקומי לתצוגה ולטיפול בפעולות המשתמש.
 */
import {
  CalendarDays,
  CheckCircle2,
  CircleAlert,
  Clock3,
  RefreshCw,
  Save,
  Send,
  XCircle,
} from 'lucide-react';

import {
  useMemo,
} from 'react';

import {
  Button,
} from '../ui';

import type {
  DriverAvailabilityDay,
  DriverAvailabilityPersonalData,
  DriverAvailabilityStatus,
  SaveDriverAvailabilityResponse,
  SubmitDriverAvailabilityResponse,
} from '../../types/driverAvailability';

/**
 * חוזה הנתונים EditableDriverAvailabilityEntry: כוננים / אילוצים וזמינות / רשומה.
 */
interface EditableDriverAvailabilityEntry {
  // dayId — מזהה היום.
  dayId: string;

  // availabilityStatus — מצב הזמינות.
  availabilityStatus:
    DriverAvailabilityStatus | null;

  // note — הערה.
  note: string;
}

/**
 * חוזה הנתונים MyDriverAvailabilityPanelProps: כוננים / אילוצים וזמינות / מאפייני הרכיב.
 */
interface MyDriverAvailabilityPanelProps {
  // data — נתונים.
  data:
    DriverAvailabilityPersonalData | null;

  // draftEntries — טיוטה / רשומות.
  draftEntries:
    EditableDriverAvailabilityEntry[];

  // isLoading — האם טעינה מתבצעת.
  isLoading: boolean;

  // isSaving — האם שמירה מתבצעת.
  isSaving: boolean;

  isDirty: boolean;

  // isSubmitting — האם הגשה מתבצעת.
  isSubmitting: boolean;

  // error — שגיאה.
  error:
    string | null;

  // lastSaveResult — תוצאה.
  lastSaveResult:
    SaveDriverAvailabilityResponse | null;

  // lastSubmitResult — תוצאה.
  lastSubmitResult:
    SubmitDriverAvailabilityResponse | null;

  // onSetDayStatus — קבוצה ייחודית / יום / סטטוס.
  onSetDayStatus: (
    dayId: string,
    status:
      DriverAvailabilityStatus,
  ) => void;

  // onSetDayNote — קבוצה ייחודית / יום / הערה.
  onSetDayNote: (
    dayId: string,
    note: string,
  ) => void;

  onMarkAllAvailable:
    () => void;

  onSave:
    () => void;

  // onSubmit — פונקציית טיפול בהגשה.
  onSubmit:
    () => void;

  onRefresh:
    () => void;
}

/**
 * חוזה הנתונים DriverAvailabilityDayView: כוננים / אילוצים וזמינות / יום.
 */
interface DriverAvailabilityDayView {
  // day — יום.
  day:
    DriverAvailabilityDay;

  // availabilityStatus — מצב הזמינות.
  availabilityStatus:
    DriverAvailabilityStatus | null;

  // note — הערה.
  note: string;
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
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    },
  ).format(date);
}

/**
 * פעולה formatDateTime: עיצוב ערך לתצוגה עבור תאריך / זמן.
 * @param value — ערך.
 * @returns string — הפלט בהתאם לחתימה.
 */
function formatDateTime(
  value:
    string | null,
): string {
  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !value.
  if (!value) {
    return 'לא הוגדר';
  }

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
      dateStyle: 'short',
      timeStyle: 'short',
    },
  ).format(date);
}

/**
 * פעולה getStatusLabel: שליפה או חישוב של סטטוס / תווית.
 * @param status — סטטוס.
 * @returns string — הפלט בהתאם לחתימה.
 */
function getStatusLabel(
  status:
    DriverAvailabilityStatus | null,
): string {
  switch (status) {
    case 'available':
      return 'זמין';

    case 'unavailable':
      return 'לא זמין';

    default:
      return 'טרם סומן';
  }
}

/**
 * פעולה getStatusIcon: שליפה או חישוב של סטטוס.
 * @param status — סטטוס.
 */
function getStatusIcon(
  status:
    DriverAvailabilityStatus | null,
) {
  switch (status) {
    case 'available':
      return CheckCircle2;

    case 'unavailable':
      return XCircle;

    default:
      return CircleAlert;
  }
}

/**
 * פעולה MyDriverAvailabilityPanel: כוננים / אילוצים וזמינות.
 * פרמטר מפורק — שדות הקלט נגישים מקומית בשמות המוגדרים בחתימה.
 */
function MyDriverAvailabilityPanel({
  data,
  draftEntries,
  isLoading,
  isSaving,
  isDirty,
  isSubmitting,
  error,
  lastSaveResult,
  lastSubmitResult,
  onSetDayStatus,
  onSetDayNote,
  onMarkAllAvailable,
  onSave,
  onSubmit,
  onRefresh,
}: MyDriverAvailabilityPanelProps) {
  // ערך מחושב dayViews — יום; נשמר בין רינדורים עד שינוי התלויות.
  const dayViews =
    useMemo<
      DriverAvailabilityDayView[]
    >(
      () => {
        // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !data?.period.
        if (
          !data?.period
        ) {
          return [];
        }

        // draftEntriesByDayId — מזהה היום; מיפוי לחיפוש לפי מפתח.
        const draftEntriesByDayId =
          new Map<
            string,
            EditableDriverAvailabilityEntry
          >(
            draftEntries.map(
              (entry) => [
                entry.dayId,
                entry,
              ],
            ),
          );

        return [
          ...data.days,
        ]
          .sort(
            (
              firstDay,
              secondDay,
            ) =>
              firstDay.sortOrder -
              secondDay.sortOrder,
          )
          .map(
            (day) => {
              // draftEntry — טיוטה / רשומה.
              const draftEntry =
                draftEntriesByDayId.get(
                  day.id,
                );

              return {
                day,

                availabilityStatus:
                  draftEntry
                    ?.availabilityStatus ??
                  null,

                note:
                  draftEntry
                    ?.note ??
                  '',
              };
            },
          );
      },
      [
        data,
        draftEntries,
      ],
    );

  // ערך מחושב summary — סיכום; נשמר בין רינדורים עד שינוי התלויות.
  const summary =
    useMemo(
      () => {
        // availableCount — מספר הסימונים כזמין.
        let availableCount =
          0;

        // unavailableCount — מספר הסימונים כלא זמין.
        let unavailableCount =
          0;

        // unmarkedCount — מספר הפריטים שטרם סומנו.
        let unmarkedCount =
          0;

        // עיבוד כל פריט מתוך dayViews בנפרד.
        for (
          const item
          of dayViews
        ) {
          if (
            item
              .availabilityStatus ===
            'available'
          ) {
            availableCount +=
              1;

            continue;
          }

          if (
            item
              .availabilityStatus ===
            'unavailable'
          ) {
            unavailableCount +=
              1;

            continue;
          }

          unmarkedCount +=
            1;
        }

        return {
          availableCount,

          unavailableCount,

          unmarkedCount,

          totalDays:
            dayViews.length,
        };
      },
      [
        dayViews,
      ],
    );

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר isLoading.
  if (isLoading) {
    return (
      <section className="my-driver-availability-panel">
        <div className="my-driver-availability-loading">
          <RefreshCw
            size={30}
            className="my-driver-availability-loading-icon"
            aria-hidden="true"
          />

          <strong>
            טוען את אילוצי הכוננים
          </strong>

          <span>
            נא להמתין בזמן טעינת
            ימי החודש.
          </span>
        </div>
      </section>
    );
  }

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר error.
  if (error) {
    return (
      <section className="my-driver-availability-panel">
        <div
          className="my-driver-availability-error"
          role="alert"
        >
          <CircleAlert
            size={30}
            aria-hidden="true"
          />

          <strong>
            לא ניתן היה לטעון
            את האילוצים
          </strong>

          <span>
            {error}
          </span>

          <Button
            type="button"
            onClick={
              onRefresh
            }
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

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !data?.period.
  if (
    !data?.period
  ) {
    return (
      <section className="my-driver-availability-panel">
        <div className="my-driver-availability-empty">
          <CalendarDays
            size={34}
            aria-hidden="true"
          />

          <strong>
            אין כרגע חודש פתוח
            להגשת אילוצים
          </strong>

          <span>
            לאחר שמנהל יפתח חודש
            אילוצים, יופיעו כאן כל
            ימי החודש לסימון זמינות.
          </span>

          <Button
            type="button"
            variant="secondary"
            onClick={
              onRefresh
            }
          >
            <RefreshCw
              size={17}
              aria-hidden="true"
            />

            רענון
          </Button>
        </div>
      </section>
    );
  }

  // periodTitle — תקופה / כותרת.
  const periodTitle =
    data.period.title ??
    `${
      hebrewMonths[
        data.period.month - 1
      ]
    } ${data.period.year}`;

  // submissionStatus — מצב ההגשה.
  const submissionStatus =
    data.submission?.status ??
    'draft';

  // isSubmitted — הוגש.
  const isSubmitted =
    submissionStatus ===
    'submitted';

  // isPeriodOpen — תקופה.
  const isPeriodOpen =
    data.period.status ===
    'open';

// isEditable — הנתון isEditable בהקשר הפעולה.
const isEditable =
  isPeriodOpen &&
  !isSubmitted &&
  !isSaving &&
  !isSubmitting;

  return (
    <section className="my-driver-availability-panel">
      <header className="my-driver-availability-header">
        <div className="my-driver-availability-heading">
          <span className="my-driver-availability-heading-icon">
            <CalendarDays
              size={23}
              aria-hidden="true"
            />
          </span>

          <div>
            <span>
              אילוצי הכוננות שלי
            </span>

            <h2>
              {periodTitle}
            </h2>

            <p>
              כל יום מייצג כוננות
              מלאה של 24 שעות.
            </p>
          </div>
        </div>

        <div className="availability-quick-actions">
          {!isSubmitted ? (
            <button
              type="button"
              className="availability-mark-all-button"
              disabled={
                !isEditable
              }
              onClick={() => {
                const confirmed =
                  window.confirm(
                    'לסמן את כל ימי הכוננות כזמינים?\n\nהפעולה תשנה רק את הטיוטה במסך ולא תשמור או תגיש אותה.',
                  );

                if (
                  confirmed
                ) {
                  onMarkAllAvailable();
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
              isSaving
            }
            onClick={
              onRefresh
            }
          >
            <RefreshCw
              size={17}
              aria-hidden="true"
            />

            רענון
          </Button>
        </div>
      </header>

      <div className="my-driver-availability-period-info">
        <div>
          <Clock3
            size={18}
            aria-hidden="true"
          />

          <span>
            מועד אחרון להגשה:
          </span>

          <strong>
            {formatDateTime(
              data.period
                .submissionDeadline,
            )}
          </strong>
        </div>

        <span
          className={[
            'my-driver-availability-submission-status',

            `my-driver-availability-submission-status-${submissionStatus}`,
          ].join(' ')}
        >
          {submissionStatus ===
          'submitted'
            ? 'הוגש'
            : submissionStatus ===
                'reopened'
              ? 'נפתח מחדש'
              : 'טרם הוגש'}
        </span>
      </div>

      {data.period.instructions ? (
        <div className="my-driver-availability-instructions">
          <strong>
            הנחיות
          </strong>

          <p>
            {
              data.period
                .instructions
            }
          </p>
        </div>
      ) : null}

      {lastSaveResult ? (
        <div
          className="my-driver-availability-save-success"
          role="status"
        >
          <CheckCircle2
            size={20}
            aria-hidden="true"
          />

          <div>
            <strong>
              האילוצים נשמרו בהצלחה
            </strong>

            <span>
              נשמרו{' '}
              {
                lastSaveResult
                  .savedEntries
              }{' '}
              סימונים בתאריך{' '}
              {formatDateTime(
                lastSaveResult
                  .savedAt,
              )}
              .
            </span>
          </div>
        </div>
      ) : null}
      {lastSubmitResult ? (
        <div
          className="my-driver-availability-save-success"
          role="status"
        >
          <CheckCircle2
            size={20}
            aria-hidden="true"
          />

          <div>
            <strong>
              האילוצים הוגשו בהצלחה
            </strong>

            <span>
              ההגשה הושלמה בתאריך{' '}
              {formatDateTime(
                lastSubmitResult
                  .submittedAt,
              )}
              .
            </span>
          </div>
        </div>
      ) : null}
      {!isPeriodOpen ? (
        <div className="my-driver-availability-locked-note">
          תקופת האילוצים סגורה
          ולכן לא ניתן לערוך את
          הסימונים.
        </div>
      ) : null}

      {isSubmitted ? (
        <div className="my-driver-availability-locked-note">
          האילוצים כבר הוגשו.
          כדי לערוך אותם מחדש,
          מנהל צריך לפתוח את
          ההגשה מחדש.
        </div>
      ) : null}

      <div className="my-driver-availability-summary">
        <article>
          <CheckCircle2
            size={21}
            aria-hidden="true"
          />

          <div>
            <strong>
              {
                summary
                  .availableCount
              }
            </strong>

            <span>
              ימים זמינים
            </span>
          </div>
        </article>

        <article>
          <XCircle
            size={21}
            aria-hidden="true"
          />

          <div>
            <strong>
              {
                summary
                  .unavailableCount
              }
            </strong>

            <span>
              ימים לא זמינים
            </span>
          </div>
        </article>

        <article>
          <CircleAlert
            size={21}
            aria-hidden="true"
          />

          <div>
            <strong>
              {
                summary
                  .unmarkedCount
              }
            </strong>

            <span>
              טרם סומנו
            </span>
          </div>
        </article>

        <article>
          <CalendarDays
            size={21}
            aria-hidden="true"
          />

          <div>
            <strong>
              {
                summary
                  .totalDays
              }
            </strong>

            <span>
              ימים בחודש
            </span>
          </div>
        </article>
      </div>

      <div className="my-driver-availability-days-grid">
        {dayViews.map(
          ({
            day,
            availabilityStatus,
            note,
          }) => {
            // StatusIcon — סטטוס.
            const StatusIcon =
              getStatusIcon(
                availabilityStatus,
              );

            return (
              <article
                key={day.id}
                className={[
                  'my-driver-availability-day',

                  availabilityStatus
                    ? `my-driver-availability-day-${availabilityStatus}`
                    : 'my-driver-availability-day-unmarked',
                ].join(' ')}
              >
                <header>
                  <div>
                    <span>
                      {
                        day
                          .weekdayName
                      }
                    </span>

                    <strong>
                      {formatDate(
                        day
                          .availabilityDate,
                      )}
                    </strong>

                    {day.holidayName ? (
                      <span className="availability-holiday-badge">
                        {day.holidayScheduleType === 'holiday_eve'
                          ? 'ערב חג'
                          : day.holidayScheduleType === 'holiday_end'
                            ? 'מוצאי חג'
                            : 'חג / מועד'}
                        {' · '}
                        {day.holidayName}
                      </span>
                    ) : null}
                  </div>

                  <span className="my-driver-availability-day-number">
                    {
                      day
                        .sortOrder
                    }
                  </span>
                </header>

                <div className="my-driver-availability-day-status">
                  <StatusIcon
                    size={18}
                    aria-hidden="true"
                  />

                  <strong>
                    {getStatusLabel(
                      availabilityStatus,
                    )}
                  </strong>
                </div>

                <div className="my-driver-availability-day-actions">
                  <button
                    type="button"
                    className={[
                      'my-driver-availability-choice',

                      'my-driver-availability-choice-available',

                      availabilityStatus ===
                      'available'
                        ? 'my-driver-availability-choice-active'
                        : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    disabled={
                      !isEditable
                    }
                    aria-pressed={
                      availabilityStatus ===
                      'available'
                    }
                    onClick={() => {
                      onSetDayStatus(
                        day.id,
                        'available',
                      );
                    }}
                  >
                    <CheckCircle2
                      size={15}
                      aria-hidden="true"
                    />

                    זמין
                  </button>

                  <button
                    type="button"
                    className={[
                      'my-driver-availability-choice',

                      'my-driver-availability-choice-unavailable',

                      availabilityStatus ===
                      'unavailable'
                        ? 'my-driver-availability-choice-active'
                        : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    disabled={
                      !isEditable
                    }
                    aria-pressed={
                      availabilityStatus ===
                      'unavailable'
                    }
                    onClick={() => {
                      onSetDayStatus(
                        day.id,
                        'unavailable',
                      );
                    }}
                  >
                    <XCircle
                      size={15}
                      aria-hidden="true"
                    />

                    לא זמין
                  </button>
                </div>

                <label className="my-driver-availability-day-note-field">
                  <span>
                    הערה
                  </span>

                  <textarea
                    rows={2}
                    value={
                      note
                    }
                    disabled={
                      !isEditable
                    }
                    placeholder="הערה אופציונלית"
                    onChange={(
                      event,
                    ) => {
                      onSetDayNote(
                        day.id,
                        event
                          .target
                          .value,
                      );
                    }}
                  />
                </label>
              </article>
            );
          },
        )}
      </div>

<footer className="my-driver-availability-footer">
  <div>
    {isDirty ? (
      <span className="my-driver-availability-unsaved">
        קיימים שינויים שטרם
        נשמרו.
      </span>
    ) : summary.unmarkedCount > 0 ? (
      <span>
        נותרו{' '}
        {summary.unmarkedCount}{' '}
        ימים שטרם סומנו.
      </span>
    ) : isSubmitted ? (
      <span>
        האילוצים הוגשו.
      </span>
    ) : (
      <span>
        כל הסימונים נשמרו
        וניתן להגיש.
      </span>
    )}
  </div>

  <div className="my-driver-availability-footer-actions">
    <Button
      type="button"
      disabled={
        !isEditable ||
        !isDirty
      }
      onClick={
        onSave
      }
    >
      <Save
        size={18}
        aria-hidden="true"
      />

      {isSaving
        ? 'שומר אילוצים...'
        : 'שמירת אילוצים'}
    </Button>

    <Button
      type="button"
      variant="secondary"
      disabled={
        !isEditable ||
        isDirty ||
        summary.unmarkedCount > 0 ||
        isSubmitting
      }
      onClick={
        onSubmit
      }
    >
      <Send
        size={18}
        aria-hidden="true"
      />

      {isSubmitting
        ? 'מגיש אילוצים...'
        : 'הגשת אילוצים'}
    </Button>
  </div>
</footer>
      
    </section>
  );
}

export default MyDriverAvailabilityPanel;