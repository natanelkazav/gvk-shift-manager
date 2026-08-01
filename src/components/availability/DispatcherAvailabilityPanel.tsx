import {
  CalendarCheck2,
  CheckCircle2,
  CircleDashed,
  RefreshCw,
  Send,
LockKeyhole,
  XCircle,
} from 'lucide-react';
import { Button } from '../ui';
import { useDispatcherAvailability } from '../../hooks/useDispatcherAvailability';
import type {
  DispatcherAvailabilityStatus,
} from '../../types/dispatcherAvailability';
import DispatcherAvailabilityShiftCard from './DispatcherAvailabilityShiftCard';

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

function formatDate(
  value: string | null,
): string {
  if (!value) {
    return 'לא הוגדר';
  }

  const date = new Date(value);

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

function DispatcherAvailabilityPanel() {
  const {
    state,
    statistics,
    savingShiftId,
    loadAvailability,
    saveShiftAvailability,
    isSubmitting,
    lastSubmitResult,
    submitAvailability,
  } = useDispatcherAvailability();

  const handleSelectStatus =
    async (
      shiftSlotId: string,
      status:
        DispatcherAvailabilityStatus,
    ): Promise<void> => {
      try {
        await saveShiftAvailability(
          shiftSlotId,
          status,
        );
      } catch {
        /*
         * השגיאה נשמרת ומוצגת
         * מתוך ה-Hook.
         */
      }
    };

  if (state.isLoading) {
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

  if (state.error && !state.data) {
    return (
      <section className="dispatcher-availability-panel">
        <div
          className="dispatcher-availability-error"
          role="alert"
        >
          <strong>
            לא ניתן היה לטעון את
            האילוצים
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

  if (!state.data) {
    return (
      <section className="dispatcher-availability-panel">
        <div className="dispatcher-availability-empty-state">
          <CalendarCheck2
            size={36}
            aria-hidden="true"
          />

          <strong>
            אין כרגע תקופת אילוצים
            פתוחה
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
  } = state.data;
const isSubmitted =
  submission.status ===
  'submitted';

const canSubmit =
  !isSubmitted &&
  statistics.total > 0 &&
  statistics.unanswered === 0 &&
  savingShiftId === null &&
  !isSubmitting;
  const periodTitle =
    period.title ??
    `${hebrewMonths[
      period.month - 1
    ]} ${period.year}`;
const handleSubmitAvailability =
  async (): Promise<void> => {
    if (!canSubmit) {
      return;
    }

    const confirmed =
      window.confirm(
        'האם להגיש את האילוצים?\n\nלאחר ההגשה לא יהיה ניתן לשנות את הבחירות ללא פתיחה מחדש על ידי מנהל.',
      );

    if (!confirmed) {
      return;
    }

    try {
      await submitAvailability();
    } catch {
      /*
       * השגיאה מוצגת מתוך ה-Hook.
       */
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

        <Button
          type="button"
          variant="secondary"
          disabled={
            state.isLoading ||
            savingShiftId !== null
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
            {
              statistics
                .completionPercentage
            }
            %
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
          (shift) => (
            <DispatcherAvailabilityShiftCard
              key={shift.id}
              shift={shift}
              isSaving={
                savingShiftId ===
                shift.id
              }
              onSelectStatus={
                handleSelectStatus
              }
              isReadOnly={
                isSubmitted ||
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
          {statistics.unanswered === 0
            ? 'כל המשמרות סומנו'
            : `נותרו ${statistics.unanswered} משמרות לסימון`}
        </strong>

        <span>
          לאחר ההגשה לא ניתן יהיה
          לשנות את האילוצים ללא
          פתיחה מחדש על ידי מנהל.
        </span>
      </div>

      <Button
        type="button"
        disabled={!canSubmit}
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
    </>
  )}
</footer>
    </section>
  );
}

export default DispatcherAvailabilityPanel;