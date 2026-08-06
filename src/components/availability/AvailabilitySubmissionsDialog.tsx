import {
  Button,
  Modal,
} from '../ui';

import AvailabilitySubmissionsPanel
  from './AvailabilitySubmissionsPanel';

import type {
  AvailabilitySubmissionTrackingDispatcher,
} from '../../types/availabilitySubmissions';

interface AvailabilitySubmissionsDialogProps {
  isOpen: boolean;

  isLoading: boolean;

  isClosing: boolean;

  canClose: boolean;

  error:
    string | null;

  data: {
    period: {
      id: string;

      year: number;

      month: number;

      title:
        string | null;

      status: string;

      submissionDeadline:
        string | null;
    };

    summary: {
      totalDispatchers: number;

      submittedDispatchers: number;

      draftDispatchers: number;

      notStartedDispatchers: number;
    };

    dispatchers:
      AvailabilitySubmissionTrackingDispatcher[];
  } | null;

  onRefresh:
    () => Promise<void>;

  onOpenMatrix:
    () => Promise<void>;

  onClosePeriod:
    () => Promise<void>;

  onClose:
    () => void;
}

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