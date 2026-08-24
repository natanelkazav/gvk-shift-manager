import {
  useMemo,
  useState,
} from 'react';

import {
  Button,
  Modal,
  Select,
  Textarea,
} from '../ui';

import type {
  ScheduleEditDispatcher,
  ScheduleShift,
} from '../../types/schedule';

interface ScheduleShiftEditModalProps {
  shift: ScheduleShift | null;
  dispatchers: ScheduleEditDispatcher[];
  isLoadingOptions: boolean;
  isSaving: boolean;
  error: string | null;
  onClose: () => void;
  onSave: (
    newUserId: string,
    reason: string | null,
  ) => Promise<void>;
  onMarkUnassigned?: () => Promise<void>;
  candidateHint?: string | null;
}

function formatShiftDate(
  value: string,
): string {
  const date = new Date(
    `${value}T12:00:00`,
  );

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(
    'he-IL',
    {
      weekday: 'long',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      timeZone: 'Asia/Jerusalem',
    },
  ).format(date);
}

function formatShiftTime(
  value: string,
): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(
    'he-IL',
    {
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
      timeZone: 'Asia/Jerusalem',
    },
  ).format(date);
}

function ScheduleShiftEditModal({
  shift,
  dispatchers,
  isLoadingOptions,
  isSaving,
  error,
  onClose,
  onSave,
  onMarkUnassigned,
  candidateHint,
}: ScheduleShiftEditModalProps) {
  const [selectedUserId, setSelectedUserId] =
    useState(
      shift?.assignedUser?.id ?? '',
    );
  const [reason, setReason] =
    useState('');

  const currentUserId =
    shift?.assignedUser?.id ?? null;

  const dispatcherOptions = useMemo(
    () =>
      dispatchers.map(
        (dispatcher) => ({
          value: dispatcher.id,
          label:
            dispatcher.scheduleName ??
            dispatcher.displayName,
        }),
      ),
    [dispatchers],
  );

  const canSave =
    Boolean(selectedUserId) &&
    selectedUserId !== currentUserId &&
    !isLoadingOptions &&
    !isSaving;

  return (
    <Modal
      isOpen={Boolean(shift)}
      title="עריכת שיבוץ משמרת"
      onClose={() => {
        if (!isSaving) {
          onClose();
        }
      }}
      footer={(
        <>
          <Button
            type="button"
            variant="secondary"
            disabled={isSaving}
            onClick={onClose}
          >
            ביטול
          </Button>

          {onMarkUnassigned ? (
            <Button
              type="button"
              variant="secondary"
              disabled={isSaving}
              onClick={() => {
                void onMarkUnassigned();
              }}
            >
              השאר משמרת לא מאוישת
            </Button>
          ) : null}

          <Button
            type="button"
            disabled={!canSave}
            onClick={() => {
              void onSave(
                selectedUserId,
                reason.trim() || null,
              );
            }}
          >
            {isSaving
              ? 'שומר שינוי...'
              : 'שמירת שינוי'}
          </Button>
        </>
      )}
    >
      {shift ? (
        <div className="schedule-edit-modal-content">
          <div className="schedule-edit-shift-summary">
            <span>המשמרת שנבחרה</span>
            <strong>
              {formatShiftDate(shift.shiftDate)}
            </strong>
            <small dir="ltr">
              {formatShiftTime(shift.startsAt)}–
              {formatShiftTime(shift.endsAt)}
            </small>
          </div>

          <div className="schedule-edit-current-assignment">
            <span>מוקדן נוכחי</span>
            <strong>
              {shift.assignedUser?.scheduleName ??
                shift.assignedUser?.displayName ??
                'ללא שיבוץ'}
            </strong>
          </div>

          <Select
            label="מוקדן חדש"
            value={selectedUserId}
            placeholder={
              isLoadingOptions
                ? 'טוען מוקדנים...'
                : 'בחירת מוקדן'
            }
            disabled={isLoadingOptions || isSaving}
            options={dispatcherOptions}
            helperText={
              candidateHint ??
              'המערכת תבדוק חפיפה ומשמרות רצופות לפני השמירה.'
            }
            onChange={(event) => {
              setSelectedUserId(
                event.target.value,
              );
            }}
          />

          <Textarea
            label="סיבת השינוי"
            value={reason}
            rows={3}
            disabled={isSaving}
            placeholder="אופציונלי — ניתן לציין מדוע השיבוץ שונה"
            onChange={(event) => {
              setReason(event.target.value);
            }}
          />

          {error ? (
            <div
              className="schedule-edit-error"
              role="alert"
            >
              {error}
            </div>
          ) : null}
        </div>
      ) : null}
    </Modal>
  );
}

export default ScheduleShiftEditModal;
