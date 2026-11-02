/**
 * קובץ: src/components/schedule/ScheduleShiftEditModal.tsx
 * מטרה: מימוש רכיב תצוגה ואינטראקציה עבור שיבוץ / משמרת.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: ScheduleShiftEditModalProps, formatShiftDate, formatShiftTime, ScheduleShiftEditModal.
 * - קישור מאפיינים ומצב מקומי לתצוגה ולטיפול בפעולות המשתמש.
 */
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

/**
 * חוזה הנתונים ScheduleShiftEditModalProps: שיבוץ / משמרת / מאפייני הרכיב.
 */
interface ScheduleShiftEditModalProps {
  // shift — משמרת.
  shift: ScheduleShift | null;
  dispatchers: ScheduleEditDispatcher[];
  // isLoadingOptions — האם טעינה מתבצעת.
  isLoadingOptions: boolean;
  // isSaving — האם שמירה מתבצעת.
  isSaving: boolean;
  // error — שגיאה.
  error: string | null;
  // onClose — פונקציית סגירת התצוגה.
  onClose: () => void;
  onSave: (
    newUserId: string,
    reason: string | null,
  ) => Promise<void>;
  onMarkUnassigned?: () => Promise<void>;
  candidateHint?: string | null;
}

/**
 * פעולה formatShiftDate: עיצוב ערך לתצוגה עבור תאריך המשמרת.
 * @param value — ערך.
 * @returns string — הפלט בהתאם לחתימה.
 */
function formatShiftDate(
  value: string,
): string {
  // date — תאריך.
  const date = new Date(
    `${value}T12:00:00`,
  );

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר Number.isNaN(date.getTime()).
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

/**
 * פעולה formatShiftTime: עיצוב ערך לתצוגה עבור משמרת / זמן.
 * @param value — ערך.
 * @returns string — הפלט בהתאם לחתימה.
 */
function formatShiftTime(
  value: string,
): string {
  // date — תאריך.
  const date = new Date(value);

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר Number.isNaN(date.getTime()).
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

/**
 * פעולה ScheduleShiftEditModal: שיבוץ / משמרת.
 * פרמטר מפורק — שדות הקלט נגישים מקומית בשמות המוגדרים בחתימה.
 */
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
  // מצב מקומי: selectedUserId — מזהה משתמש; setSelectedUserId מעדכנת אותו ומפעילה רינדור לפי React.
  const [selectedUserId, setSelectedUserId] =
    useState(
      shift?.assignedUser?.id ?? '',
    );
  // מצב מקומי: reason — הנתון reason בהקשר הפעולה; setReason מעדכנת אותו ומפעילה רינדור לפי React.
  const [reason, setReason] =
    useState('');

  // currentUserId — המשתמש הנוכחי הנוכחי.
  const currentUserId =
    shift?.assignedUser?.id ?? null;

  // ערך מחושב dispatcherOptions — מוקדנים / אפשרויות בחירה; נשמר בין רינדורים עד שינוי התלויות.
  const dispatcherOptions = useMemo(
    () =>
      [...dispatchers]
        .sort((first, second) => {
          /**
           * פעולה priority: הנתון priority בהקשר הפעולה.
           * @param dispatcher — מוקדנים.
           * @returns number — הפלט בהתאם לחתימה.
           */
          const priority = (
            dispatcher:
              ScheduleEditDispatcher,
          ): number => {
            // טיפול במקרה מיוחד ויציאה מוקדמת כאשר dispatcher.availabilityStatus === 'available' && !dispatcher.isAutoCompleted.
            if (
              dispatcher.availabilityStatus ===
                'available' &&
              !dispatcher.isAutoCompleted
            ) {
              return 0;
            }

            // טיפול במקרה מיוחד ויציאה מוקדמת כאשר dispatcher.availabilityStatus === 'unavailable'.
            if (
              dispatcher.availabilityStatus ===
              'unavailable'
            ) {
              return 1;
            }

            return 2;
          };

          const priorityDifference =
            priority(first) -
            priority(second);

          // טיפול במקרה מיוחד ויציאה מוקדמת כאשר priorityDifference !== 0.
          if (priorityDifference !== 0) {
            return priorityDifference;
          }

          return (
            first.scheduleName ??
            first.displayName
          ).localeCompare(
            second.scheduleName ??
            second.displayName,
            'he',
          );
        })
        .map(
          (dispatcher) => {
            // name — שם.
            const name =
              dispatcher.scheduleName ??
              dispatcher.displayName;

            // statusLabel — סטטוס / תווית.
            const statusLabel =
              dispatcher.availabilityStatus ===
                  'available' &&
                !dispatcher.isAutoCompleted
                ? 'זמין'
                : dispatcher.availabilityStatus ===
                    'unavailable'
                  ? 'סימן כלא זמין'
                  : dispatcher.availabilityStatus ===
                        'available' &&
                      dispatcher.isAutoCompleted
                    ? 'לא הגיש — הושלם אוטומטית כזמין'
                    : 'לא סימן אילוץ';

            return {
              value: dispatcher.id,
              label:
                `${name} — ${statusLabel}`,
            };
          },
        ),
    [dispatchers],
  );

  // canSave — הנתון canSave בהקשר הפעולה.
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
