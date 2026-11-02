/**
 * קובץ: src/components/availability/DispatcherAvailabilityShiftCard.tsx
 * מטרה: מימוש רכיב תצוגה ואינטראקציה עבור מוקדנים / אילוצים וזמינות / משמרת.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: DispatcherAvailabilityShiftCardProps, formatShiftTime, formatDate, DispatcherAvailabilityShiftCard.
 * - קישור מאפיינים ומצב מקומי לתצוגה ולטיפול בפעולות המשתמש.
 */
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

/**
 * חוזה הנתונים DispatcherAvailabilityShiftCardProps: מוקדנים / אילוצים וזמינות / משמרת / מאפייני הרכיב.
 */
interface DispatcherAvailabilityShiftCardProps {
  // shift — משמרת.
  shift:
    DispatcherAvailabilityShift;

  // isSaving — האם שמירה מתבצעת.
  isSaving:
    boolean;

  isReadOnly:
    boolean;

  // onSelectStatus — סטטוס.
  onSelectStatus: (
    shiftSlotId:
      string,

    status:
      DispatcherAvailabilityStatus,
  ) =>
    void |
    Promise<void>;
}

/**
 * פעולה formatShiftTime: עיצוב ערך לתצוגה עבור משמרת / זמן.
 * @param timeValue — זמן / ערך.
 * @returns string — הפלט בהתאם לחתימה.
 */
function formatShiftTime(
  timeValue:
    string,
): string {
  return timeValue.slice(
    0,
    5,
  );
}

/**
 * פעולה formatDate: עיצוב ערך לתצוגה עבור תאריך.
 * @param dateValue — תאריך / ערך.
 * @returns string — הפלט בהתאם לחתימה.
 */
function formatDate(
  dateValue:
    string,
): string {
  // date — תאריך.
  const date =
    new Date(
      `${dateValue}T12:00:00`,
    );

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר Number.isNaN( date.getTime(), ).
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

/**
 * פעולה DispatcherAvailabilityShiftCard: מוקדנים / אילוצים וזמינות / משמרת.
 * פרמטר מפורק — שדות הקלט נגישים מקומית בשמות המוגדרים בחתימה.
 */
function DispatcherAvailabilityShiftCard({
  shift,
  isSaving,
  isReadOnly,
  onSelectStatus,
}: DispatcherAvailabilityShiftCardProps) {
  // isAvailable — הנתון isAvailable בהקשר הפעולה.
  const isAvailable =
    shift.availabilityStatus ===
    'available';

  // isUnavailable — הנתון isUnavailable בהקשר הפעולה.
  const isUnavailable =
    shift.availabilityStatus ===
    'unavailable';

  /**
   * פעולה אסינכרונית handleSelectStatus: טיפול באירוע עבור סטטוס.
   * @param status — סטטוס.
   * @returns Promise<void> — הפלט בהתאם לחתימה.
   */
  const handleSelectStatus =
    async (
      status:
        DispatcherAvailabilityStatus,
    ): Promise<void> => {
      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר isSaving || isReadOnly || shift.availabilityStatus === status.
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

          <strong dir="ltr">
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