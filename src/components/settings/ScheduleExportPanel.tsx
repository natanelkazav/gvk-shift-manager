import {
  Download,
  FileSpreadsheet,
  LoaderCircle,
} from 'lucide-react';

import {
  useMemo,
  useState,
} from 'react';

import {
  scheduleExportService,
} from '../../services/scheduleExportService';

import {
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Select,
} from '../ui';

const hebrewMonths = [
  'ינואר',
  'פברואר',
  'מרץ',
  'אפריל',
  'מאי',
  'יוני',
  'יולי',
  'אוגוסט',
  'ספטמבר',
  'אוקטובר',
  'נובמבר',
  'דצמבר',
];

type ExportTarget =
  | 'current'
  | 'next';

function getMonthTarget(
  target: ExportTarget,
): {
  year: number;
  month: number;
} {
  const now =
    new Date();

  const monthOffset =
    target === 'next'
      ? 1
      : 0;

  const targetDate =
    new Date(
      now.getFullYear(),
      now.getMonth() +
        monthOffset,
      1,
      12,
      0,
      0,
      0,
    );

  return {
    year:
      targetDate.getFullYear(),
    month:
      targetDate.getMonth() +
      1,
  };
}

function formatMonthLabel(
  year: number,
  month: number,
): string {
  return `${hebrewMonths[month - 1] ?? month} ${year}`;
}

function getErrorMessage(
  error: unknown,
): string {
  if (
    error instanceof Error &&
    error.message.trim()
  ) {
    return error.message;
  }

  return 'אירעה שגיאה ביצירת קובץ האקסל.';
}

function ScheduleExportPanel() {
  const [
    target,
    setTarget,
  ] =
    useState<ExportTarget>(
      'current',
    );

  const [
    isExporting,
    setIsExporting,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState<string | null>(
      null,
    );

  const [
    successMessage,
    setSuccessMessage,
  ] =
    useState<string | null>(
      null,
    );

  const currentTarget =
    useMemo(
      () =>
        getMonthTarget(
          'current',
        ),
      [],
    );

  const nextTarget =
    useMemo(
      () =>
        getMonthTarget(
          'next',
        ),
      [],
    );

  const selectedTarget =
    target === 'next'
      ? nextTarget
      : currentTarget;

  const handleExport =
    async (): Promise<void> => {
      setIsExporting(true);
      setError(null);
      setSuccessMessage(null);

      try {
        const result =
          await scheduleExportService
            .exportMonth(
              selectedTarget.year,
              selectedTarget.month,
            );

        setSuccessMessage(
          `הקובץ ${result.fileName} נוצר והורד בהצלחה.`,
        );
      } catch (
        exportError
      ) {
        setError(
          getErrorMessage(
            exportError,
          ),
        );
      } finally {
        setIsExporting(false);
      }
    };

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <span className="settings-card-title-with-icon">
            <FileSpreadsheet
              size={19}
              aria-hidden="true"
            />

            ייצוא לוח שיבוצים
          </span>
        </CardTitle>
      </CardHeader>

      <CardBody>
        <div className="schedule-export-panel">
          <p className="settings-placeholder-text">
            יצירת קובץ Excel לפי תבנית לוח השיבוצים של החברה. הקובץ משלב מוקדנים, כוננים וכונני בוקר מלוחות שפורסמו בלבד.
          </p>

          <Select
            label="חודש לייצוא"
            value={target}
            disabled={isExporting}
            options={[
              {
                value: 'current',
                label:
                  `החודש הנוכחי — ${formatMonthLabel(
                    currentTarget.year,
                    currentTarget.month,
                  )}`,
              },
              {
                value: 'next',
                label:
                  `החודש הבא — ${formatMonthLabel(
                    nextTarget.year,
                    nextTarget.month,
                  )}`,
              },
            ]}
            helperText="החודש הבא ניתן לייצוא לאחר פרסום כל שלושת הלוחות."
            onChange={(
              event,
            ) => {
              setTarget(
                event.target
                  .value as ExportTarget,
              );

              setError(null);
              setSuccessMessage(null);
            }}
          />

          <div className="schedule-export-summary">
            <span>
              הקובץ שייווצר
            </span>

            <strong>
              {`לוח שיבוצים ${formatMonthLabel(
                selectedTarget.year,
                selectedTarget.month,
              )}.xlsx`}
            </strong>
          </div>

          {error ? (
            <div
              className="settings-message settings-message-error"
              role="alert"
            >
              {error}
            </div>
          ) : null}

          {successMessage ? (
            <div
              className="settings-message settings-message-success"
              role="status"
            >
              {successMessage}
            </div>
          ) : null}

          <Button
            type="button"
            disabled={isExporting}
            onClick={() => {
              void handleExport();
            }}
          >
            {isExporting ? (
              <LoaderCircle
                className="schedule-export-spinner"
                size={17}
                aria-hidden="true"
              />
            ) : (
              <Download
                size={17}
                aria-hidden="true"
              />
            )}

            {isExporting
              ? 'יוצר קובץ...'
              : 'הורדת קובץ Excel'}
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}

export default ScheduleExportPanel;
