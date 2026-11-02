/**
 * קובץ: src/components/driverSchedule/DriverDutyTransferDialog.tsx
 * מטרה: מימוש רכיב תצוגה ואינטראקציה עבור כוננים.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: DriverDutyTransferDialogProps, formatDutyDate, DriverDutyTransferDialog.
 * - קישור מאפיינים ומצב מקומי לתצוגה ולטיפול בפעולות המשתמש.
 */
import {
  ArrowLeftRight,
  CalendarDays,
  LoaderCircle,
  X,
} from 'lucide-react';

import {
  useMemo,
  useState,
} from 'react';

import {
  Button,
} from '../ui';

import type {
  DriverScheduleDay,
  DriverScheduleDriver,
} from '../../types/driverSchedule';

/**
 * חוזה הנתונים DriverDutyTransferDialogProps: כוננים / מאפייני הרכיב.
 */
interface DriverDutyTransferDialogProps {
  // day — יום.
  day:
    DriverScheduleDay;

  drivers:
    DriverScheduleDriver[];

  // currentUserId — המשתמש הנוכחי הנוכחי.
  currentUserId:
    string;

  // isSaving — האם שמירה מתבצעת.
  isSaving:
    boolean;

  // onClose — פונקציית סגירת התצוגה.
  onClose:
    () => void;

  onTransfer: (
    newDriverId: string,
  ) => Promise<void>;
}

/**
 * פעולה formatDutyDate: עיצוב ערך לתצוגה עבור תאריך.
 * @param dateValue — תאריך / ערך.
 * @returns string — הפלט בהתאם לחתימה.
 */
function formatDutyDate(
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
    },
  ).format(date);
}

/**
 * פעולה DriverDutyTransferDialog: כוננים.
 * פרמטר מפורק — שדות הקלט נגישים מקומית בשמות המוגדרים בחתימה.
 */
function DriverDutyTransferDialog({
  day,
  drivers,
  currentUserId,
  isSaving,
  onClose,
  onTransfer,
}: DriverDutyTransferDialogProps) {
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
          (driver) =>
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
      (driver) =>
        driver.id ===
        selectedDriverId,
    ) ??
    null;

  /**
   * פעולה אסינכרונית handleSubmit: טיפול באירוע עבור הנתון handleSubmit בהקשר הפעולה.
   * @returns Promise<void> — הפלט בהתאם לחתימה.
   */
  const handleSubmit =
    async (): Promise<void> => {
      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !selectedDriverId || isSaving.
      if (
        !selectedDriverId ||
        isSaving
      ) {
        return;
      }

      await onTransfer(
        selectedDriverId,
      );
    };

  return (
    <div
      className="driver-duty-transfer-backdrop"
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
        className="driver-duty-transfer-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="driver-duty-transfer-title"
      >
        <header className="driver-duty-transfer-header">
          <div className="driver-duty-transfer-heading">
            <span className="driver-duty-transfer-icon">
              <ArrowLeftRight
                size={22}
                aria-hidden="true"
              />
            </span>

            <div>
              <h2 id="driver-duty-transfer-title">
                שינוי כוננות
              </h2>

              <p>
                העברת הכוננות לכונן פעיל אחר.
              </p>
            </div>
          </div>

          <button
            type="button"
            className="driver-duty-transfer-close"
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

        <div className="driver-duty-transfer-date">
          <CalendarDays
            size={19}
            aria-hidden="true"
          />

          <div>
            <span>
              תאריך הכוננות
            </span>

            <strong>
              {formatDutyDate(
                day.dutyDate,
              )}
            </strong>
          </div>
        </div>

        <div className="driver-duty-transfer-current">
          <span>
            הכונן הנוכחי
          </span>

          <strong>
            {day.assignedUserName ??
              'הכוננות שלי'}
          </strong>
        </div>

        <label className="driver-duty-transfer-field">
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
              בחירת כונן
            </option>

            {availableDrivers.map(
              (driver) => (
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
          <div className="driver-duty-transfer-notice">
            לא נמצאו כוננים פעילים נוספים שניתן להעביר אליהם את הכוננות.
          </div>
        ) : null}

        {selectedDriver ? (
          <div className="driver-duty-transfer-confirmation">
            הכוננות תועבר אל{' '}
            <strong>
              {selectedDriver.scheduleName ??
                selectedDriver.displayName}
            </strong>
            .
          </div>
        ) : null}

        <footer className="driver-duty-transfer-actions">
          <Button
            type="button"
            variant="secondary"
            disabled={
              isSaving
            }
            onClick={
              onClose
            }
          >
            ביטול
          </Button>

          <Button
            type="button"
            disabled={
              !selectedDriverId ||
              isSaving
            }
            onClick={() => {
              void handleSubmit();
            }}
          >
            {isSaving ? (
              <LoaderCircle
                size={18}
                className="driver-duty-transfer-loading"
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
          </Button>
        </footer>
      </section>
    </div>
  );
}

export default DriverDutyTransferDialog;