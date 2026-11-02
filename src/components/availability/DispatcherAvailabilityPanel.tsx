/**
 * קובץ: src/components/availability/DispatcherAvailabilityPanel.tsx
 * מטרה: מימוש רכיב תצוגה ואינטראקציה עבור מוקדנים / אילוצים וזמינות.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: formatDate, DispatcherAvailabilityPanel.
 * - קישור מאפיינים ומצב מקומי לתצוגה ולטיפול בפעולות המשתמש.
 */
import {
  CalendarCheck2,
  CheckCircle2,
  CircleDashed,
  LockKeyhole,
  RefreshCw,
  Save,
  Send,
  XCircle,
} from 'lucide-react';

import {
  Button,
} from '../ui';

import {
  useDispatcherAvailability,
} from '../../hooks/useDispatcherAvailability';

import type {
  DispatcherAvailabilityStatus,
} from '../../types/dispatcherAvailability';

import DispatcherAvailabilityShiftCard
  from './DispatcherAvailabilityShiftCard';

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
  value:
    string | null,
): string {
  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !value.
  if (
    !value
  ) {
    return 'לא הוגדר';
  }

  // date — תאריך.
  const date =
    new Date(
      value,
    );

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר Number.isNaN( date.getTime(), ).
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
      dateStyle:
        'short',
      timeStyle:
        'short',
    },
  ).format(
    date,
  );
}

/**
 * פעולה DispatcherAvailabilityPanel: מוקדנים / אילוצים וזמינות.
 */
function DispatcherAvailabilityPanel() {
  const {
    state,
    statistics,
    isDirty,
    isSavingDraft,
    isSubmitting,
    lastSubmitResult,
    loadAvailability,
    setShiftAvailability,
    markAllAvailable,
    saveAvailabilityDraft,
    submitAvailability,
  } =
    useDispatcherAvailability();

  /**
   * פעולה handleSelectStatus: טיפול באירוע עבור סטטוס.
   * @param shiftSlotId — משמרת / מזהה.
   * @param status — סטטוס.
   * @returns void — הפלט בהתאם לחתימה.
   */
  const handleSelectStatus =
    (
      shiftSlotId:
        string,
      status:
        DispatcherAvailabilityStatus,
    ): void => {
      setShiftAvailability(
        shiftSlotId,
        status,
      );
    };

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר state.isLoading.
  if (
    state.isLoading
  ) {
    return (
      <section className="dispatcher-availability-panel">
        <div className="dispatcher-availability-loading-state">
          <RefreshCw
            size={30}
            className="dispatcher-availability-loading-icon"
            aria-hidden="true"
          />

          <p>
            טוען את רשימת המשמרות...
          </p>
        </div>
      </section>
    );
  }

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר state.error && !state.data.
  if (
    state.error &&
    !state.data
  ) {
    return (
      <section className="dispatcher-availability-panel">
        <div
          className="dispatcher-availability-error"
          role="alert"
        >
          <strong>
            לא ניתן היה לטעון את האילוצים
          </strong>

          <span>
            {state.error}
          </span>

          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              void loadAvailability();
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

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !state.data.
  if (
    !state.data
  ) {
    return (
      <section className="dispatcher-availability-panel">
        <div className="dispatcher-availability-empty-state">
          <CalendarCheck2
            size={36}
            aria-hidden="true"
          />

          <strong>
            אין כרגע תקופת אילוצים פתוחה
          </strong>

          <span>
            כאשר תיפתח תקופה חדשה,
            המשמרות יופיעו כאן.
          </span>
        </div>
      </section>
    );
  }

  const {
    period,
    submission,
    shifts,
  } =
    state.data;

  // isSubmitted — הוגש.
  const isSubmitted =
    submission.status ===
    'submitted';

  // canSubmit — הנתון canSubmit בהקשר הפעולה.
  const canSubmit =
    !isSubmitted &&
    !isDirty &&
    statistics.total >
      0 &&
    statistics.unanswered ===
      0 &&
    !isSavingDraft &&
    !isSubmitting;

  // periodTitle — תקופה / כותרת.
  const periodTitle =
    period.title ??
    `${hebrewMonths[
      period.month - 1
    ]} ${period.year}`;

  /**
   * פעולה אסינכרונית handleSubmitAvailability: טיפול באירוע עבור אילוצים וזמינות.
   * @returns Promise<void> — הפלט בהתאם לחתימה.
   */
  const handleSubmitAvailability =
    async (): Promise<void> => {
      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !canSubmit.
      if (
        !canSubmit
      ) {
        return;
      }

      const confirmed =
        window.confirm(
          'האם להגיש את האילוצים?\n\nלאחר ההגשה לא יהיה ניתן לשנות את הבחירות ללא פתיחה מחדש על ידי מנהל.',
        );

      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !confirmed.
      if (
        !confirmed
      ) {
        return;
      }

      // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
      try {
        await submitAvailability();
      } catch {
        // השגיאה מוצגת מתוך ה-Hook.
      }
    };

  /**
   * פעולה handleMarkAllAvailable: טיפול באירוע עבור הנתון handleMarkAllAvailable בהקשר הפעולה.
   * @returns void — הפלט בהתאם לחתימה.
   */
  const handleMarkAllAvailable =
    (): void => {
      const confirmed =
        window.confirm(
          'לסמן את כל המשמרות כזמינות?\n\nהפעולה תשנה רק את הטיוטה במסך ולא תשמור או תגיש אותה.',
        );

      if (
        confirmed
      ) {
        markAllAvailable();
      }
    };

  return (
    <section className="dispatcher-availability-panel">
      <header className="dispatcher-availability-header">
        <div>
          <span className="dispatcher-availability-eyebrow">
            הגשת אילוצים
          </span>

          <h2>
            {periodTitle}
          </h2>

          <p>
            יש לסמן זמינות עבור כל
            משמרת ברשימה.
          </p>
        </div>

        <div className="availability-quick-actions">
          {!isSubmitted ? (
            <button
              type="button"
              className="availability-mark-all-button"
              disabled={
                isSavingDraft ||
                isSubmitting
              }
              onClick={
                handleMarkAllAvailable
              }
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
              state.isLoading ||
              isSavingDraft
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

      {period.instructions ? (
        <div className="dispatcher-availability-instructions">
          <strong>
            הנחיות
          </strong>

          <p>
            {period.instructions}
          </p>
        </div>
      ) : null}

      <div className="dispatcher-availability-period-info">
        <span>
          מועד אחרון להגשה:
        </span>

        <strong>
          {formatDate(
            period.submissionDeadline,
          )}
        </strong>

        {submission.lastSavedAt ? (
          <>
            <span>
              שמירה אחרונה:
            </span>

            <strong>
              {formatDate(
                submission.lastSavedAt,
              )}
            </strong>
          </>
        ) : null}
      </div>

      {state.error ? (
        <div
          className="dispatcher-availability-error"
          role="alert"
        >
          {state.error}
        </div>
      ) : null}

      <div className="dispatcher-availability-statistics">
        <article>
          <CalendarCheck2
            size={21}
            aria-hidden="true"
          />

          <div>
            <strong>
              {statistics.total}
            </strong>

            <span>
              סך הכול משמרות
            </span>
          </div>
        </article>

        <article>
          <CheckCircle2
            size={21}
            aria-hidden="true"
          />

          <div>
            <strong>
              {statistics.available}
            </strong>

            <span>
              זמין
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
              {statistics.unavailable}
            </strong>

            <span>
              לא זמין
            </span>
          </div>
        </article>

        <article>
          <CircleDashed
            size={21}
            aria-hidden="true"
          />

          <div>
            <strong>
              {statistics.unanswered}
            </strong>

            <span>
              טרם סומנו
            </span>
          </div>
        </article>
      </div>

      <div className="dispatcher-availability-progress">
        <div className="dispatcher-availability-progress-header">
          <span>
            התקדמות
          </span>

          <strong>
            {statistics.completionPercentage}%
          </strong>
        </div>

        <div className="dispatcher-availability-progress-track">
          <div
            className="dispatcher-availability-progress-value"
            style={{
              width:
                `${statistics.completionPercentage}%`,
            }}
          />
        </div>
      </div>

      <div className="dispatcher-availability-shifts-list">
        {shifts.map(
          (
            shift,
          ) => (
            <DispatcherAvailabilityShiftCard
              key={
                shift.id
              }
              shift={
                shift
              }
              isSaving={
                false
              }
              onSelectStatus={
                handleSelectStatus
              }
              isReadOnly={
                isSubmitted ||
                isSavingDraft ||
                isSubmitting
              }
            />
          ),
        )}
      </div>

      <footer className="dispatcher-availability-submit-section">
        {lastSubmitResult ||
        isSubmitted ? (
          <div
            className="dispatcher-availability-submitted-message"
            role="status"
          >
            <LockKeyhole
              size={22}
              aria-hidden="true"
            />

            <div>
              <strong>
                האילוצים הוגשו בהצלחה
              </strong>

              <span>
                ההגשה נעולה ולא ניתן
                לשנות את הבחירות.
              </span>

              {submission.submittedAt ? (
                <small>
                  הוגש בתאריך{' '}
                  {formatDate(
                    submission.submittedAt,
                  )}
                </small>
              ) : null}
            </div>
          </div>
        ) : (
          <>
            <div className="dispatcher-availability-submit-summary">
              <strong>
                {isDirty
                  ? 'קיימים שינויים שטרם נשמרו'
                  : statistics.unanswered ===
                      0
                    ? 'כל המשמרות סומנו'
                    : `נותרו ${statistics.unanswered} משמרות לסימון`}
              </strong>

              <span>
                סימון הכול כזמין משנה
                רק את הטיוטה. יש לשמור
                לפני ההגשה.
              </span>
            </div>

            <div className="availability-footer-actions">
              <Button
                type="button"
                disabled={
                  !isDirty ||
                  isSavingDraft ||
                  isSubmitting
                }
                onClick={() => {
                  void saveAvailabilityDraft();
                }}
              >
                <Save
                  size={18}
                  aria-hidden="true"
                />

                {isSavingDraft
                  ? 'שומר טיוטה...'
                  : 'שמירת אילוצים'}
              </Button>

              <Button
                type="button"
                variant="secondary"
                disabled={
                  !canSubmit
                }
                onClick={() => {
                  void handleSubmitAvailability();
                }}
              >
                <Send
                  size={18}
                  aria-hidden="true"
                />

                {isSubmitting
                  ? 'מגיש אילוצים...'
                  : 'הגש אילוצים'}
              </Button>
            </div>
          </>
        )}
      </footer>
    </section>
  );
}

export default DispatcherAvailabilityPanel;