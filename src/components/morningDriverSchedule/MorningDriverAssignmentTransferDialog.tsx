/**
 * קובץ: src/components/morningDriverSchedule/MorningDriverAssignmentTransferDialog.tsx
 * מטרה: מימוש רכיב תצוגה ואינטראקציה עבור כונני בוקר.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: MorningDriverAssignmentTransferDialogProps, formatDate, formatTime, MorningDriverAssignmentTransferDialog.
 * - קישור מאפיינים ומצב מקומי לתצוגה ולטיפול בפעולות המשתמש.
 */
import {
  ArrowLeftRight,
  CalendarDays,
  Clock3,
  LoaderCircle,
  X,
} from 'lucide-react';

import {
  useMemo,
  useState,
} from 'react';

import type {
  MorningDriverScheduleAssignment,
  MorningDriverScheduleDriver,
} from '../../types/morningDriverSchedule';

/**
 * חוזה הנתונים MorningDriverAssignmentTransferDialogProps: כונני בוקר.
 */
interface MorningDriverAssignmentTransferDialogProps {
  // assignment — הקצאה.
  assignment:
    MorningDriverScheduleAssignment;

  drivers:
    MorningDriverScheduleDriver[];

  // currentUserId — המשתמש הנוכחי הנוכחי.
  currentUserId: string;

  // isSaving — האם שמירה מתבצעת.
  isSaving: boolean;

  // onClose — פונקציית סגירת התצוגה.
  onClose:
    () => void;

  onTransfer: (
    newDriverId: string,
  ) => Promise<void>;
}

/**
 * פעולה formatDate: עיצוב ערך לתצוגה עבור תאריך.
 * @param dateValue — תאריך / ערך.
 * @returns string — הפלט בהתאם לחתימה.
 */
function formatDate(
  dateValue: string,
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
      weekday: 'long',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      timeZone:
        'Asia/Jerusalem',
    },
  ).format(
    date,
  );
}

/**
 * פעולה formatTime: עיצוב ערך לתצוגה עבור זמן.
 * @param value — ערך.
 * @returns string — הפלט בהתאם לחתימה.
 */
function formatTime(
  value: string,
): string {
  return value.slice(
    0,
    5,
  );
}

/**
 * פעולה MorningDriverAssignmentTransferDialog: כונני בוקר.
 * פרמטר מפורק — שדות הקלט נגישים מקומית בשמות המוגדרים בחתימה.
 */
function MorningDriverAssignmentTransferDialog({
  assignment,
  drivers,
  currentUserId,
  isSaving,
  onClose,
  onTransfer,
}: MorningDriverAssignmentTransferDialogProps) {
  // מצב מקומי: selectedDriverId — נבחר / כוננים / מזהה; setSelectedDriverId מעדכנת אותו ומפעילה רינדור לפי React.
  const [
    selectedDriverId,
    setSelectedDriverId,
  ] =
    useState('');

  // ערך מחושב availableDrivers — הנתון availableDrivers בהקשר הפעולה; נשמר בין רינדורים עד שינוי התלויות.
  const availableDrivers =
    useMemo(
      () =>
        drivers.filter(
          (
            driver,
          ) =>
            driver.isActive &&
            driver.id !==
              currentUserId,
        ),
      [
        currentUserId,
        drivers,
      ],
    );

  // selectedDriver — נבחר / כוננים.
  const selectedDriver =
    availableDrivers.find(
      (
        driver,
      ) =>
        driver.id ===
        selectedDriverId,
    ) ??
    null;

  return (
    <div
      className="morning-driver-transfer-backdrop"
      role="presentation"
      onMouseDown={(
        event,
      ) => {
        if (
          event.target ===
            event.currentTarget &&
          !isSaving
        ) {
          onClose();
        }
      }}
    >
      <section
        className="morning-driver-transfer-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="morning-driver-transfer-title"
      >
        <header className="morning-driver-transfer-header">
          <div>
            <span className="morning-driver-transfer-icon">
              <ArrowLeftRight
                size={22}
                aria-hidden="true"
              />
            </span>

            <div>
              <h2 id="morning-driver-transfer-title">
                שינוי כונן בוקר
              </h2>

              <p>
                העברת הכוננות שלך לכונן בוקר פעיל אחר.
              </p>
            </div>
          </div>

          <button
            type="button"
            className="morning-driver-transfer-close"
            aria-label="סגירת חלון שינוי הכוננות"
            disabled={
              isSaving
            }
            onClick={
              onClose
            }
          >
            <X
              size={20}
              aria-hidden="true"
            />
          </button>
        </header>

        <div className="morning-driver-transfer-shift">
          <div>
            <CalendarDays
              size={18}
              aria-hidden="true"
            />

            <span>
              {
                formatDate(
                  assignment.shiftDate,
                )
              }
            </span>
          </div>

          <div>
            <Clock3
              size={18}
              aria-hidden="true"
            />

            <span dir="ltr">
              {
                formatTime(
                  assignment.startTime,
                )
              }
              {' – '}
              {
                formatTime(
                  assignment.endTime,
                )
              }
            </span>
          </div>
        </div>

        <div className="morning-driver-transfer-current">
          <span>
            הכונן הנוכחי
          </span>

          <strong>
            {
              assignment.assignedUserName ??
              'הכוננות שלי'
            }
          </strong>
        </div>

        <label className="morning-driver-transfer-field">
          <span>
            כונן מחליף
          </span>

          <select
            value={
              selectedDriverId
            }
            disabled={
              isSaving
            }
            onChange={(
              event,
            ) => {
              setSelectedDriverId(
                event.target.value,
              );
            }}
          >
            <option value="">
              בחירת כונן בוקר
            </option>

            {availableDrivers.map(
              (
                driver,
              ) => (
                <option
                  key={
                    driver.id
                  }
                  value={
                    driver.id
                  }
                >
                  {
                    driver.scheduleName ??
                    driver.displayName
                  }
                </option>
              ),
            )}
          </select>
        </label>

        {availableDrivers.length ===
        0 ? (
          <div className="morning-driver-transfer-notice">
            לא נמצאו כונני בוקר פעילים נוספים.
          </div>
        ) : null}

        {selectedDriver ? (
          <div className="morning-driver-transfer-confirmation">
            הכוננות תועבר אל{' '}
            <strong>
              {
                selectedDriver.scheduleName ??
                selectedDriver.displayName
              }
            </strong>
            .
          </div>
        ) : null}

        <footer className="morning-driver-transfer-actions">
          <button
            type="button"
            className="morning-driver-schedule-secondary-button"
            disabled={
              isSaving
            }
            onClick={
              onClose
            }
          >
            ביטול
          </button>

          <button
            type="button"
            className="morning-driver-schedule-primary-button"
            disabled={
              !selectedDriverId ||
              isSaving
            }
            onClick={() => {
              void onTransfer(
                selectedDriverId,
              );
            }}
          >
            {isSaving ? (
              <LoaderCircle
                size={18}
                className="morning-driver-schedule-spin"
                aria-hidden="true"
              />
            ) : (
              <ArrowLeftRight
                size={18}
                aria-hidden="true"
              />
            )}

            {isSaving
              ? 'מעביר כוננות...'
              : 'אישור העברה'}
          </button>
        </footer>
      </section>
    </div>
  );
}

export default MorningDriverAssignmentTransferDialog;