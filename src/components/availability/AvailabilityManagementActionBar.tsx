/**
 * קובץ: src/components/availability/AvailabilityManagementActionBar.tsx
 * מטרה: מימוש רכיב תצוגה ואינטראקציה עבור אילוצים וזמינות.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: AvailabilityManagementActionBarProps, AvailabilityManagementActionBar.
 * - קישור מאפיינים ומצב מקומי לתצוגה ולטיפול בפעולות המשתמש.
 */
import {
  CalendarRange,
  ClipboardList,
  LockKeyhole,
  RotateCcw,
  Trash2,
  UnlockKeyhole,
} from 'lucide-react';

import {
  Button,
} from '../ui';

/**
 * חוזה הנתונים AvailabilityManagementActionBarProps: אילוצים וזמינות / מאפייני הרכיב.
 */
interface AvailabilityManagementActionBarProps {
  // status — סטטוס.
  status: string;

  isBusy?: boolean;

  // canPrepareSchedule — שיבוץ (אופציונלי).
  canPrepareSchedule?: boolean;

  onOpen?: (() => void) | null;

  // onClose — פונקציית סגירת התצוגה (אופציונלי).
  onClose?: (() => void) | null;

  onReopen?: (() => void) | null;

  onDelete?: (() => void) | null;

  // onPrepareSchedule — שיבוץ (אופציונלי).
  onPrepareSchedule?: (() => void) | null;

  // onGoToSchedule — שיבוץ (אופציונלי).
  onGoToSchedule?: (() => void) | null;
}

/**
 * פעולה AvailabilityManagementActionBar: אילוצים וזמינות.
 * פרמטר מפורק — שדות הקלט נגישים מקומית בשמות המוגדרים בחתימה.
 */
function AvailabilityManagementActionBar({
  status,
  isBusy = false,
  canPrepareSchedule = true,
  onOpen = null,
  onClose = null,
  onReopen = null,
  onDelete = null,
  onPrepareSchedule = null,
  onGoToSchedule = null,
}: AvailabilityManagementActionBarProps) {
  return (
    <section className="availability-management-action-bar">
      <div className="availability-management-action-copy">
        <strong>
          פעולות תקופה
        </strong>

        <span>
          אותן פעולות ניהול זמינות בכל מערכות האילוצים.
        </span>
      </div>

      <div className="availability-management-action-buttons">
        {status === 'draft' &&
        onOpen ? (
          <Button
            type="button"
            disabled={isBusy}
            onClick={onOpen}
          >
            <UnlockKeyhole
              size={17}
              aria-hidden="true"
            />

            פתיחה להגשה
          </Button>
        ) : null}

        {status === 'open' &&
        onClose ? (
          <Button
            type="button"
            disabled={isBusy}
            onClick={onClose}
          >
            <LockKeyhole
              size={17}
              aria-hidden="true"
            />

            סגירת תקופה
          </Button>
        ) : null}

        {status === 'closed' &&
        onReopen ? (
          <Button
            type="button"
            variant="secondary"
            disabled={isBusy}
            onClick={onReopen}
          >
            <RotateCcw
              size={17}
              aria-hidden="true"
            />

            פתיחה מחדש
          </Button>
        ) : null}

        {status === 'closed' &&
        canPrepareSchedule &&
        onPrepareSchedule ? (
          <Button
            type="button"
            disabled={isBusy}
            onClick={onPrepareSchedule}
          >
            <ClipboardList
              size={17}
              aria-hidden="true"
            />

            הכנה לשיבוץ
          </Button>
        ) : null}

        {onGoToSchedule ? (
          <Button
            type="button"
            variant="secondary"
            disabled={isBusy}
            onClick={onGoToSchedule}
          >
            <CalendarRange
              size={17}
              aria-hidden="true"
            />

            מעבר ללוח
          </Button>
        ) : null}

        {status !== 'archived' &&
        onDelete ? (
          <Button
            type="button"
            variant="danger"
            disabled={isBusy}
            onClick={onDelete}
          >
            <Trash2
              size={17}
              aria-hidden="true"
            />

            מחיקת חודש
          </Button>
        ) : null}
      </div>
    </section>
  );
}

export default AvailabilityManagementActionBar;
