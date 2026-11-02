/**
 * קובץ: src/components/availability/AvailabilityPeriodPicker.tsx
 * מטרה: מימוש רכיב תצוגה ואינטראקציה עבור תקופת אילוצים.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: AvailabilityPeriodPickerProps, getPeriodTitle, AvailabilityPeriodPicker.
 * - קישור מאפיינים ומצב מקומי לתצוגה ולטיפול בפעולות המשתמש.
 */
import {
  CalendarDays,
  ChevronDown,
} from 'lucide-react';
import type {
  AvailabilityPeriod,
  AvailabilityPeriodStatus,
} from '../../types/availability';

/**
 * חוזה הנתונים AvailabilityPeriodPickerProps: תקופת אילוצים.
 */
interface AvailabilityPeriodPickerProps {
  // periods — תקופות.
  periods:
    AvailabilityPeriod[];

  // selectedPeriodId — מזהה התקופה.
  selectedPeriodId:
    string | null;

  allowedStatuses?:
    AvailabilityPeriodStatus[];

  // label — תווית.
  label: string;
  // emptyMessage — הודעה.
  emptyMessage: string;

  // isLoading — האם טעינה מתבצעת (אופציונלי).
  isLoading?: boolean;
  // disabled — האם האפשרות מושבתת (אופציונלי).
  disabled?: boolean;

  onSelect: (
    periodId: string,
  ) => void;
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

// statusLabels — סטטוס.
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

/**
 * פעולה getPeriodTitle: שליפה או חישוב של תקופה / כותרת.
 * @param period — תקופה.
 * @returns string — הפלט בהתאם לחתימה.
 */
function getPeriodTitle(
  period:
    AvailabilityPeriod,
): string {
  return (
    period.title ??
    `${hebrewMonths[
      period.month - 1
    ]} ${period.year}`
  );
}

/**
 * פעולה AvailabilityPeriodPicker: תקופת אילוצים.
 * פרמטר מפורק — שדות הקלט נגישים מקומית בשמות המוגדרים בחתימה.
 */
function AvailabilityPeriodPicker({
  periods,
  selectedPeriodId,
  allowedStatuses,
  label,
  emptyMessage,
  isLoading = false,
  disabled = false,
  onSelect,
}: AvailabilityPeriodPickerProps) {
  // availablePeriods — תקופות.
  const availablePeriods =
    periods.filter(
      (period) =>
        !allowedStatuses ||
        allowedStatuses.includes(
          period.status,
        ),
    );

  return (
    <section className="availability-period-picker">
      <div className="availability-period-picker-heading">
        <span className="availability-period-picker-icon">
          <CalendarDays
            size={20}
            aria-hidden="true"
          />
        </span>

        <div>
          <strong>
            {label}
          </strong>

          <span>
            בחר את החודש שעליו ברצונך
            לעבוד.
          </span>
        </div>
      </div>

      {availablePeriods.length >
      0 ? (
        <label className="availability-period-picker-field">
          <span className="sr-only">
            {label}
          </span>

          <select
            value={
              selectedPeriodId ?? ''
            }
            disabled={
              disabled ||
              isLoading
            }
            onChange={(
              event,
            ) => {
              // periodId — מזהה התקופה.
              const periodId =
                event.target.value;

              // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !periodId.
              if (!periodId) {
                return;
              }

              onSelect(periodId);
            }}
          >
            <option value="">
              בחירת חודש
            </option>

            {availablePeriods.map(
              (period) => (
                <option
                  key={period.id}
                  value={period.id}
                >
                  {getPeriodTitle(
                    period,
                  )}
                  {' — '}
                  {
                    statusLabels[
                      period.status
                    ]
                  }
                </option>
              ),
            )}
          </select>

          <ChevronDown
            size={18}
            aria-hidden="true"
          />
        </label>
      ) : (
        <div className="availability-period-picker-empty">
          {emptyMessage}
        </div>
      )}
    </section>
  );
}

export default AvailabilityPeriodPicker;