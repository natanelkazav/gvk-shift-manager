/**
 * קובץ: src/components/availability/AvailabilitySubmissionsDialog.tsx
 * מטרה: מימוש רכיב תצוגה ואינטראקציה עבור אילוצים וזמינות.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: AvailabilitySubmissionsDialogProps, AvailabilitySubmissionsDialog.
 * - קישור מאפיינים ומצב מקומי לתצוגה ולטיפול בפעולות המשתמש.
 */
import {
  Button,
  Modal,
} from '../ui';

import AvailabilitySubmissionsPanel
  from './AvailabilitySubmissionsPanel';

import type {
  AvailabilitySubmissionTrackingDispatcher,
} from '../../types/availabilitySubmissions';

/**
 * חוזה הנתונים AvailabilitySubmissionsDialogProps: אילוצים וזמינות / מאפייני הרכיב.
 */
interface AvailabilitySubmissionsDialogProps {
  // isOpen — האם המצב פתוח.
  isOpen: boolean;

  // isLoading — האם טעינה מתבצעת.
  isLoading: boolean;

  isClosing: boolean;

  canClose: boolean;

  // error — שגיאה.
  error:
    string | null;

  // data — נתונים.
  data: {
    // period — תקופה.
    period: {
      // id — מזהה.
      id: string;

      // year — שנה.
      year: number;

      // month — חודש.
      month: number;

      // title — כותרת.
      title:
        string | null;

      // status — סטטוס.
      status: string;

      // submissionDeadline — מועד אחרון להגשת אילוצים.
      submissionDeadline:
        string | null;
    };

    // summary — סיכום.
    summary: {
      // totalDispatchers — סך הכול.
      totalDispatchers: number;

      // submittedDispatchers — הוגש.
      submittedDispatchers: number;

      // draftDispatchers — טיוטה.
      draftDispatchers: number;

      notStartedDispatchers: number;
    };

    dispatchers:
      AvailabilitySubmissionTrackingDispatcher[];
  } | null;

  onRefresh:
    () => Promise<void>;

  // onOpenMatrix — מטריצת נתונים.
  onOpenMatrix:
    () => Promise<void>;

  // onClosePeriod — פונקציית סגירת התצוגה.
  onClosePeriod:
    () => Promise<void>;

  // onClose — פונקציית סגירת התצוגה.
  onClose:
    () => void;
}

/**
 * פעולה AvailabilitySubmissionsDialog: אילוצים וזמינות.
 * פרמטר מפורק — שדות הקלט נגישים מקומית בשמות המוגדרים בחתימה.
 */
function AvailabilitySubmissionsDialog({
  isOpen,
  isLoading,
  isClosing,
  canClose,
  error,
  data,
  onRefresh,
  onOpenMatrix,
  onClosePeriod,
  onClose,
}: AvailabilitySubmissionsDialogProps) {
  // dialogTitle — כותרת.
  const dialogTitle =
    data?.period.title
      ? `מעקב הגשות — ${data.period.title}`
      : 'מעקב הגשות מוקדנים';

  return (
    <Modal
      isOpen={
        isOpen
      }
      title={
        dialogTitle
      }
      footer={
        <Button
          type="button"
          variant="secondary"
          onClick={
            onClose
          }
        >
          סגירה
        </Button>
      }
      onClose={
        onClose
      }
    >
      <AvailabilitySubmissionsPanel
        isLoading={
          isLoading
        }
        isClosing={
          isClosing
        }
        canClose={
          canClose
        }
        error={
          error
        }
        data={
          data
        }
        onRefresh={
          onRefresh
        }
        onOpenMatrix={
          onOpenMatrix
        }
        onClosePeriod={
          onClosePeriod
        }
        onClose={
          onClose
        }
      />
    </Modal>
  );
}

export default AvailabilitySubmissionsDialog;