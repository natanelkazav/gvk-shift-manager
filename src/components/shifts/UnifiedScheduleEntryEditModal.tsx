import {
  useMemo,
  useState,
} from 'react';

import {
  Button,
  Modal,
} from '../ui';

import type {
  UnifiedScheduleEntry,
} from '../../types/unifiedSchedule';

interface UnifiedScheduleEditUser {
  id: string;
  displayName: string;
  scheduleName: string | null;
}

interface UnifiedScheduleEntryEditModalProps {
  entry:
    UnifiedScheduleEntry | null;
  users:
    UnifiedScheduleEditUser[];
  isLoadingUsers:
    boolean;
  isSaving:
    boolean;
  error:
    string | null;
  onClose:
    () => void;
  onSave: (
    userId: string,
    reason: string | null,
  ) => Promise<void>;
}

const categoryLabels = {
  dispatcher:
    'מוקדן',
  morning_driver:
    'כונן בוקר',
  on_call:
    'כונן',
} as const;

function getUserLabel(
  user:
    UnifiedScheduleEditUser,
): string {
  return (
    user.scheduleName ??
    user.displayName
  );
}

function UnifiedScheduleEntryEditModal({
  entry,
  users,
  isLoadingUsers,
  isSaving,
  error,
  onClose,
  onSave,
}: UnifiedScheduleEntryEditModalProps) {
  const [
    selectedUserId,
    setSelectedUserId,
  ] = useState(
    entry?.assignedUserId ??
    '',
  );

  const [
    reason,
    setReason,
  ] = useState('');



  const sortedUsers =
    useMemo(
      () =>
        [...users].sort(
          (
            first,
            second,
          ) =>
            getUserLabel(first)
              .localeCompare(
                getUserLabel(second),
                'he',
              ),
        ),
      [users],
    );

  if (!entry) {
    return null;
  }

  const hasChanged =
    Boolean(selectedUserId) &&
    selectedUserId !==
      entry.assignedUserId;

  return (
    <Modal
      isOpen
      title={`עריכת ${categoryLabels[entry.category]}`}
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

          <Button
            type="button"
            disabled={
              isSaving ||
              isLoadingUsers ||
              !hasChanged
            }
            onClick={() => {
              void onSave(
                selectedUserId,
                reason.trim() ||
                  null,
              );
            }}
          >
            {isSaving
              ? 'שומר...'
              : 'שמירת שינוי'}
          </Button>
        </>
      )}
    >
      <div className="unified-schedule-edit-form">
        <div className="unified-schedule-edit-summary">
          <span>
            תאריך
          </span>
          <strong>
            {entry.date}
          </strong>

          <span>
            שיבוץ נוכחי
          </span>
          <strong>
            {entry.assignedUserName ??
              'לא משובץ'}
          </strong>
        </div>

        {error ? (
          <div
            className="unified-schedule-message unified-schedule-message-error"
            role="alert"
          >
            {error}
          </div>
        ) : null}

        <label className="unified-schedule-edit-field">
          <span>
            שיבוץ חדש
          </span>

          <select
            value={selectedUserId}
            disabled={
              isLoadingUsers ||
              isSaving
            }
            onChange={(event) => {
              setSelectedUserId(
                event.target.value,
              );
            }}
          >
            <option value="">
              בחירת משתמש
            </option>

            {sortedUsers.map(
              (user) => (
                <option
                  key={user.id}
                  value={user.id}
                >
                  {getUserLabel(user)}
                </option>
              ),
            )}
          </select>
        </label>

        <label className="unified-schedule-edit-field">
          <span>
            סיבת השינוי (אופציונלי)
          </span>

          <textarea
            value={reason}
            disabled={isSaving}
            rows={3}
            placeholder="לדוגמה: שינוי תפעולי"
            onChange={(event) => {
              setReason(
                event.target.value,
              );
            }}
          />
        </label>

        {isLoadingUsers ? (
          <div className="unified-schedule-edit-loading">
            טוען רשימת משתמשים...
          </div>
        ) : null}
      </div>
    </Modal>
  );
}

export type {
  UnifiedScheduleEditUser,
};

export default UnifiedScheduleEntryEditModal;
