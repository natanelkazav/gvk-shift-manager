/**
 * קובץ: src/components/availability/AvailabilityManagementHeader.tsx
 * מטרה: מימוש רכיב תצוגה ואינטראקציה עבור אילוצים וזמינות.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: AvailabilityManagementHeaderProps, formatDateTime, toDateTimeLocalValue, getStatusLabel, AvailabilityManagementHeader.
 * - קישור מאפיינים ומצב מקומי לתצוגה ולטיפול בפעולות המשתמש.
 */
import {
  CalendarClock,
  Pencil,
  RefreshCw,
} from 'lucide-react';

import {
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import {
  availabilityDeadlineService,
  type AvailabilityDeadlineCategory,
} from '../../services/availabilityDeadlineService';

import {
  Button,
  Modal,
} from '../ui';

import './availabilityManagementShared.css';

/**
 * חוזה הנתונים AvailabilityManagementHeaderProps: אילוצים וזמינות / מאפייני הרכיב.
 */
interface AvailabilityManagementHeaderProps {
  category:
    AvailabilityDeadlineCategory;

  // categoryLabel — תווית.
  categoryLabel: string;

  // title — כותרת.
  title: string;

  description: string;

  // periodId — מזהה התקופה.
  periodId: string;

  // periodStatus — תקופה / סטטוס.
  periodStatus: string;

  // submissionDeadline — מועד אחרון להגשת אילוצים.
  submissionDeadline:
    string | null;

  isBusy?: boolean;

  // error — שגיאה (אופציונלי).
  error?: string | null;

  actions?: ReactNode;

  onRefresh:
    () => void | Promise<void>;
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
  if (
    !value
  ) {
    return 'לא נקבע';
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
    return value;
  }

  return new Intl.DateTimeFormat(
    'he-IL',
    {
      dateStyle:
        'short',
      timeStyle:
        'short',
      timeZone:
        'Asia/Jerusalem',
      hourCycle:
        'h23',
    },
  ).format(
    date,
  );
}

/**
 * פעולה toDateTimeLocalValue: המרה עבור תאריך / זמן / ערך.
 * @param value — ערך.
 * @returns string — הפלט בהתאם לחתימה.
 */
function toDateTimeLocalValue(
  value:
    string | null,
): string {
  // date — תאריך.
  const date =
    value
      ? new Date(
          value,
        )
      : new Date();

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר Number.isNaN( date.getTime(), ).
  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return '';
  }

  const parts =
    new Intl.DateTimeFormat(
      'en-CA',
      {
        timeZone:
          'Asia/Jerusalem',
        year:
          'numeric',
        month:
          '2-digit',
        day:
          '2-digit',
        hour:
          '2-digit',
        minute:
          '2-digit',
        hourCycle:
          'h23',
      },
    ).formatToParts(
      date,
    );

  // values — ערכים.
  const values =
    Object.fromEntries(
      parts.map(
        (
          part,
        ) => [
          part.type,
          part.value,
        ],
      ),
    );

  return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}`;
}

/**
 * פעולה getStatusLabel: שליפה או חישוב של סטטוס / תווית.
 * @param status — סטטוס.
 * @returns string — הפלט בהתאם לחתימה.
 */
function getStatusLabel(
  status: string,
): string {
  switch (
    status
  ) {
    case 'draft':
      return 'טיוטה';

    case 'open':
      return 'פתוח להגשה';

    case 'closed':
      return 'סגור';

    case 'archived':
      return 'בארכיון';

    default:
      return status;
  }
}

/**
 * פעולה AvailabilityManagementHeader: אילוצים וזמינות.
 * פרמטר מפורק — שדות הקלט נגישים מקומית בשמות המוגדרים בחתימה.
 */
function AvailabilityManagementHeader({
  category,
  categoryLabel,
  title,
  description,
  periodId,
  periodStatus,
  submissionDeadline,
  isBusy = false,
  error = null,
  actions,
  onRefresh,
}: AvailabilityManagementHeaderProps) {
  // מצב מקומי: isDeadlineModalOpen — הנתון isDeadlineModalOpen בהקשר הפעולה; setIsDeadlineModalOpen מעדכנת אותו ומפעילה רינדור לפי React.
  const [
    isDeadlineModalOpen,
    setIsDeadlineModalOpen,
  ] =
    useState(
      false,
    );

  // מצב מקומי: deadlineValue — ערך; setDeadlineValue מעדכנת אותו ומפעילה רינדור לפי React.
  const [
    deadlineValue,
    setDeadlineValue,
  ] =
    useState(
      '',
    );

  // מצב מקומי: deadlineError — שגיאה; setDeadlineError מעדכנת אותו ומפעילה רינדור לפי React.
  const [
    deadlineError,
    setDeadlineError,
  ] =
    useState<
      string | null
    >(
      null,
    );

  // מצב מקומי: isSavingDeadline — האם שמירה מתבצעת; setIsSavingDeadline מעדכנת אותו ומפעילה רינדור לפי React.
  const [
    isSavingDeadline,
    setIsSavingDeadline,
  ] =
    useState(
      false,
    );

  // canEditDeadline — האם עריכה מותרת.
  const canEditDeadline =
    periodStatus ===
      'draft' ||
    periodStatus ===
      'open';

  // ערך מחושב statusClassName — סטטוס / שם; נשמר בין רינדורים עד שינוי התלויות.
  const statusClassName =
    useMemo(
      () =>
        `availability-management-status availability-management-status-${periodStatus}`,
      [
        periodStatus,
      ],
    );

  /**
   * פעולה openDeadlineEditor: פתיחת הנתון openDeadlineEditor בהקשר הפעולה.
   * @returns void — הפלט בהתאם לחתימה.
   */
  const openDeadlineEditor =
    (): void => {
      setDeadlineError(
        null,
      );

      setDeadlineValue(
        toDateTimeLocalValue(
          submissionDeadline,
        ),
      );

      setIsDeadlineModalOpen(
        true,
      );
    };

  /**
   * פעולה אסינכרונית handleSaveDeadline: טיפול באירוע עבור הנתון handleSaveDeadline בהקשר הפעולה.
   * @returns Promise<void> — הפלט בהתאם לחתימה.
   */
  const handleSaveDeadline =
    async (): Promise<void> => {
      setDeadlineError(
        null,
      );

      setIsSavingDeadline(
        true,
      );

      // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
      try {
        await availabilityDeadlineService
          .updateDeadline(
            category,
            periodId,
            deadlineValue,
          );

        setIsDeadlineModalOpen(
          false,
        );

        await onRefresh();
      } catch (
        updateError
      ) {
        setDeadlineError(
          updateError instanceof
            Error
            ? updateError
                .message
            : 'לא ניתן היה לעדכן את מועד ההגשה.',
        );
      } finally {
        setIsSavingDeadline(
          false,
        );
      }
    };

  return (
    <>
      <header className="availability-management-header">
        <div className="availability-management-heading">
          <span className="availability-management-eyebrow">
            ניהול אילוצים ·{' '}
            {categoryLabel}
          </span>

          <h2>
            {title}
          </h2>

          <p>
            {description}
          </p>
        </div>

        <div className="availability-management-actions">
          <Button
            type="button"
            variant="secondary"
            disabled={
              isBusy
            }
            onClick={() => {
              void onRefresh();
            }}
          >
            <RefreshCw
              size={17}
              aria-hidden="true"
            />

            רענון
          </Button>

          {actions}
        </div>
      </header>

      <div className="availability-management-period-bar">
        <div>
          <span>
            סטטוס תקופה
          </span>

          <strong
            className={
              statusClassName
            }
          >
            {getStatusLabel(
              periodStatus,
            )}
          </strong>
        </div>

        <div>
          <span>
            <CalendarClock
              size={16}
              aria-hidden="true"
            />

            מועד אחרון להגשה
          </span>

          <strong>
            {formatDateTime(
              submissionDeadline,
            )}
          </strong>
        </div>

        <Button
          type="button"
          variant="secondary"
          disabled={
            isBusy ||
            !canEditDeadline
          }
          onClick={
            openDeadlineEditor
          }
        >
          <Pencil
            size={16}
            aria-hidden="true"
          />

          עריכת מועד הגשה
        </Button>
      </div>

      {error ? (
        <div
          className="availability-management-inline-error"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      <Modal
        isOpen={
          isDeadlineModalOpen
        }
        title={`עריכת מועד הגשה — ${categoryLabel}`}
        onClose={() => {
          if (
            !isSavingDeadline
          ) {
            setIsDeadlineModalOpen(
              false,
            );
          }
        }}
        footer={
          <>
            <Button
              type="button"
              variant="secondary"
              disabled={
                isSavingDeadline
              }
              onClick={() => {
                setIsDeadlineModalOpen(
                  false,
                );
              }}
            >
              ביטול
            </Button>

            <Button
              type="button"
              disabled={
                isSavingDeadline ||
                !deadlineValue
              }
              onClick={() => {
                void handleSaveDeadline();
              }}
            >
              {isSavingDeadline
                ? 'שומר...'
                : 'שמירת מועד'}
            </Button>
          </>
        }
      >
        <div className="availability-management-deadline-form">
          <label>
            <span>
              מועד אחרון להגשת אילוצים
            </span>

            <input
              type="datetime-local"
              value={
                deadlineValue
              }
              disabled={
                isSavingDeadline
              }
              onChange={(
                event,
              ) => {
                setDeadlineValue(
                  event.target
                    .value,
                );

                setDeadlineError(
                  null,
                );
              }}
            />
          </label>

          <p>
            ניתן לשנות את המועד כל עוד התקופה בטיוטה או פתוחה להגשה.
          </p>

          {deadlineError ? (
            <div
              className="availability-management-inline-error"
              role="alert"
            >
              {deadlineError}
            </div>
          ) : null}
        </div>
      </Modal>
    </>
  );
}

export default AvailabilityManagementHeader;
