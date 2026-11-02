/**
 * קובץ: src/components/shifts/UnifiedScheduleEntryEditModal.tsx
 * מטרה: מימוש רכיב תצוגה ואינטראקציה עבור שיבוץ / רשומה.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: UnifiedScheduleEditUser, UnifiedScheduleEntryEditModalProps, getUserLabel, UnifiedScheduleEntryEditModal.
 * - קישור מאפיינים ומצב מקומי לתצוגה ולטיפול בפעולות המשתמש.
 */
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

/**
 * חוזה הנתונים UnifiedScheduleEditUser: שיבוץ / משתמש.
 */
interface UnifiedScheduleEditUser {
  // id — מזהה.
  id: string;
  // displayName — שם תצוגה.
  displayName: string;
  // scheduleName — שיבוץ / שם.
  scheduleName: string | null;
}

/**
 * חוזה הנתונים UnifiedScheduleEntryEditModalProps: שיבוץ / רשומה / מאפייני הרכיב.
 */
interface UnifiedScheduleEntryEditModalProps {
  // entry — רשומה.
  entry:
    UnifiedScheduleEntry | null;
  // users — משתמשים.
  users:
    UnifiedScheduleEditUser[];
  // isLoadingUsers — האם טעינה מתבצעת.
  isLoadingUsers:
    boolean;
  // isSaving — האם שמירה מתבצעת.
  isSaving:
    boolean;
  // error — שגיאה.
  error:
    string | null;
  // onClose — פונקציית סגירת התצוגה.
  onClose:
    () => void;
  onSave: (
    userId: string,
    reason: string | null,
  ) => Promise<void>;
}

// categoryLabels — הנתון categoryLabels בהקשר הפעולה.
const categoryLabels = {
  dispatcher:
    'מוקדן',
  morning_driver:
    'כונן בוקר',
  on_call:
    'כונן',
} as const;

/**
 * פעולה getUserLabel: שליפה או חישוב של משתמש / תווית.
 * @param user — משתמש.
 * @returns string — הפלט בהתאם לחתימה.
 */
function getUserLabel(
  user:
    UnifiedScheduleEditUser,
): string {
  return (
    user.scheduleName ??
    user.displayName
  );
}

/**
 * פעולה UnifiedScheduleEntryEditModal: שיבוץ / רשומה.
 * פרמטר מפורק — שדות הקלט נגישים מקומית בשמות המוגדרים בחתימה.
 */
function UnifiedScheduleEntryEditModal({
  entry,
  users,
  isLoadingUsers,
  isSaving,
  error,
  onClose,
  onSave,
}: UnifiedScheduleEntryEditModalProps) {
  // מצב מקומי: selectedUserId — מזהה משתמש; setSelectedUserId מעדכנת אותו ומפעילה רינדור לפי React.
  const [
    selectedUserId,
    setSelectedUserId,
  ] = useState(
    entry?.assignedUserId ??
    '',
  );

  // מצב מקומי: reason — הנתון reason בהקשר הפעולה; setReason מעדכנת אותו ומפעילה רינדור לפי React.
  const [
    reason,
    setReason,
  ] = useState('');



  // ערך מחושב sortedUsers — משתמשים; נשמר בין רינדורים עד שינוי התלויות.
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

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !entry.
  if (!entry) {
    return null;
  }

  // hasChanged — הנתון hasChanged בהקשר הפעולה.
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
