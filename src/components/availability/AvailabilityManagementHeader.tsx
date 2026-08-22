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

interface AvailabilityManagementHeaderProps {
  category:
    AvailabilityDeadlineCategory;

  categoryLabel: string;

  title: string;

  description: string;

  periodId: string;

  periodStatus: string;

  submissionDeadline:
    string | null;

  isBusy?: boolean;

  error?: string | null;

  actions?: ReactNode;

  onRefresh:
    () => void | Promise<void>;
}

function formatDateTime(
  value:
    string | null,
): string {
  if (
    !value
  ) {
    return 'לא נקבע';
  }

  const date =
    new Date(
      value,
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

function toDateTimeLocalValue(
  value:
    string | null,
): string {
  const date =
    value
      ? new Date(
          value,
        )
      : new Date();

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
  const [
    isDeadlineModalOpen,
    setIsDeadlineModalOpen,
  ] =
    useState(
      false,
    );

  const [
    deadlineValue,
    setDeadlineValue,
  ] =
    useState(
      '',
    );

  const [
    deadlineError,
    setDeadlineError,
  ] =
    useState<
      string | null
    >(
      null,
    );

  const [
    isSavingDeadline,
    setIsSavingDeadline,
  ] =
    useState(
      false,
    );

  const canEditDeadline =
    periodStatus ===
      'draft' ||
    periodStatus ===
      'open';

  const statusClassName =
    useMemo(
      () =>
        `availability-management-status availability-management-status-${periodStatus}`,
      [
        periodStatus,
      ],
    );

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

  const handleSaveDeadline =
    async (): Promise<void> => {
      setDeadlineError(
        null,
      );

      setIsSavingDeadline(
        true,
      );

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
