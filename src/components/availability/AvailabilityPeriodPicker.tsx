import {
  CalendarDays,
  ChevronDown,
} from 'lucide-react';
import type {
  AvailabilityPeriod,
  AvailabilityPeriodStatus,
} from '../../types/availability';

interface AvailabilityPeriodPickerProps {
  periods:
    AvailabilityPeriod[];

  selectedPeriodId:
    string | null;

  allowedStatuses?:
    AvailabilityPeriodStatus[];

  label: string;
  emptyMessage: string;

  isLoading?: boolean;
  disabled?: boolean;

  onSelect: (
    periodId: string,
  ) => void;
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
              const periodId =
                event.target.value;

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