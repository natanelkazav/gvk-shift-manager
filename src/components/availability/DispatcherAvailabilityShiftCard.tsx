import {
  Check,
  Clock3,
  LoaderCircle,
  Moon,
  Sparkles,
  X,
} from 'lucide-react';

import type {
  DispatcherAvailabilityShift,
  DispatcherAvailabilityStatus,
} from '../../types/dispatcherAvailability';

interface DispatcherAvailabilityShiftCardProps {
  shift:
    DispatcherAvailabilityShift;

  isSaving:
    boolean;

  isReadOnly:
    boolean;

  onSelectStatus: (
    shiftSlotId:
      string,

    status:
      DispatcherAvailabilityStatus,
  ) =>
    void |
    Promise<void>;
}

function formatShiftTime(
  timeValue:
    string,
): string {
  return timeValue.slice(
    0,
    5,
  );
}

function formatDate(
  dateValue:
    string,
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
      day:
        '2-digit',

      month:
        '2-digit',

      year:
        'numeric',
    },
  ).format(
    date,
  );
}

function DispatcherAvailabilityShiftCard({
  shift,
  isSaving,
  isReadOnly,
  onSelectStatus,
}: DispatcherAvailabilityShiftCardProps) {
  const isAvailable =
    shift.availabilityStatus ===
    'available';

  const isUnavailable =
    shift.availabilityStatus ===
    'unavailable';

  const handleSelectStatus =
    async (
      status:
        DispatcherAvailabilityStatus,
    ): Promise<void> => {
      if (
        isSaving ||
        isReadOnly ||
        shift.availabilityStatus ===
          status
      ) {
        return;
      }

      await onSelectStatus(
        shift.id,
        status,
      );
    };

  return (
    <article
      className={[
        'dispatcher-availability-shift-card',

        isAvailable
          ? 'dispatcher-availability-shift-card-available'
          : '',

        isUnavailable
          ? 'dispatcher-availability-shift-card-unavailable'
          : '',

        shift.isPremium
          ? 'dispatcher-availability-shift-card-premium'
          : '',

        isReadOnly
          ? 'dispatcher-availability-shift-card-readonly'
          : '',
      ]
        .filter(
          Boolean,
        )
        .join(
          ' ',
        )}
    >
      <div className="dispatcher-availability-shift-main">
        <div className="dispatcher-availability-shift-date">
          <strong>
            {formatDate(
              shift.date,
            )}
          </strong>

          <span>
            יום{' '}
            {
              shift.weekdayName
            }
          </span>
        </div>

        <div className="dispatcher-availability-shift-time">
          <Clock3
            size={
              18
            }
            aria-hidden="true"
          />

          <strong>
            {formatShiftTime(
              shift.startTime,
            )}
            {' – '}
            {formatShiftTime(
              shift.endTime,
            )}
          </strong>

          {shift.endsNextDay ? (
            <span title="המשמרת מסתיימת ביום הבא">
              <Moon
                size={
                  15
                }
                aria-hidden="true"
              />

              יום למחרת
            </span>
          ) : null}
        </div>

        <div className="dispatcher-availability-shift-labels">
          {shift.holidayName ? (
            <span className="dispatcher-availability-holiday-badge">
              {
                shift.holidayName
              }
            </span>
          ) : null}

          {shift.isPremium ? (
            <span className="dispatcher-availability-premium-badge">
              <Sparkles
                size={
                  14
                }
                aria-hidden="true"
              />

              200%
            </span>
          ) : null}
        </div>
      </div>

      <div className="dispatcher-availability-shift-actions">
        <button
          type="button"
          className={[
            'dispatcher-availability-status-button',

            'dispatcher-availability-status-button-available',

            isAvailable
              ? 'dispatcher-availability-status-button-selected'
              : '',
          ]
            .filter(
              Boolean,
            )
            .join(
              ' ',
            )}
          disabled={
            isSaving ||
            isReadOnly
          }
          aria-pressed={
            isAvailable
          }
          onClick={() => {
            void handleSelectStatus(
              'available',
            );
          }}
        >
          {isSaving ? (
            <LoaderCircle
              size={
                18
              }
              className="dispatcher-availability-loading-icon"
              aria-hidden="true"
            />
          ) : (
            <Check
              size={
                18
              }
              aria-hidden="true"
            />
          )}

          זמין
        </button>

        <button
          type="button"
          className={[
            'dispatcher-availability-status-button',

            'dispatcher-availability-status-button-unavailable',

            isUnavailable
              ? 'dispatcher-availability-status-button-selected'
              : '',
          ]
            .filter(
              Boolean,
            )
            .join(
              ' ',
            )}
          disabled={
            isSaving ||
            isReadOnly
          }
          aria-pressed={
            isUnavailable
          }
          onClick={() => {
            void handleSelectStatus(
              'unavailable',
            );
          }}
        >
          {isSaving ? (
            <LoaderCircle
              size={
                18
              }
              className="dispatcher-availability-loading-icon"
              aria-hidden="true"
            />
          ) : (
            <X
              size={
                18
              }
              aria-hidden="true"
            />
          )}

          לא זמין
        </button>
      </div>
    </article>
  );
}

export default DispatcherAvailabilityShiftCard;