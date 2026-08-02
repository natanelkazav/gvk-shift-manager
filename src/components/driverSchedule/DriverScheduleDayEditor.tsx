import {
  AlertTriangle,
  Lock,
  Save,
  Trash2,
  Unlock,
} from 'lucide-react';

import {
  useState,
} from 'react';

import {
  Button,
} from '../ui';

import type {
  DriverScheduleDay,
  DriverScheduleDriver,
  UpdateDriverScheduleDayRequest,
} from '../../types/driverSchedule';

interface DriverScheduleDayEditorProps {
  day:
    DriverScheduleDay;

  drivers:
    DriverScheduleDriver[];

  isEditable: boolean;

  isSaving: boolean;

  onSave: (
    request:
      UpdateDriverScheduleDayRequest,
  ) => Promise<void>;
}

interface DriverScheduleDayEditorState {
  assignedUserId:
    string;

  isLocked: boolean;

  note:
    string;
}

function createEditorState(
  day: DriverScheduleDay,
): DriverScheduleDayEditorState {
  return {
    assignedUserId:
      day.assignedUserId ??
      '',

    isLocked:
      day.isLocked,

    note:
      day.notes ??
      '',
  };
}

function DriverScheduleDayEditor({
  day,
  drivers,
  isEditable,
  isSaving,
  onSave,
}: DriverScheduleDayEditorProps) {
  const [
    formState,
    setFormState,
  ] =
    useState<DriverScheduleDayEditorState>(
      () =>
        createEditorState(
          day,
        ),
    );



  const initialState =
    createEditorState(
      day,
    );

  const isDirty =
    formState.assignedUserId !==
      initialState.assignedUserId ||
    formState.isLocked !==
      initialState.isLocked ||
    formState.note !==
      initialState.note;

  const handleSave =
    async (): Promise<void> => {
      if (
        !isEditable ||
        isSaving ||
        !isDirty
      ) {
        return;
      }

      await onSave({
        scheduleDayId:
          day.id,

        assignedUserId:
          formState.assignedUserId ||
          null,

        isLocked:
          formState.isLocked,

        note:
          formState.note.trim() ||
          null,
      });
    };

  const handleClearAssignment =
    (): void => {
      if (
        !isEditable ||
        isSaving
      ) {
        return;
      }

      setFormState(
        (currentState) => ({
          ...currentState,

          assignedUserId:
            '',
        }),
      );
    };

  return (
    <article
      className={[
        'driver-schedule-day-editor',

        day.spacingWarning
          ? 'driver-schedule-day-editor-warning'
          : '',

        !day.assignedUserId
          ? 'driver-schedule-day-editor-unassigned'
          : '',

        day.isLocked
          ? 'driver-schedule-day-editor-locked'
          : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <header className="driver-schedule-day-editor-header">
        <div className="driver-schedule-day-editor-date">
          <strong>
            {day.weekdayName}
          </strong>

          <span>
            {new Intl.DateTimeFormat(
              'he-IL',
              {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
              },
            ).format(
              new Date(
                `${day.dutyDate}T12:00:00`,
              ),
            )}
          </span>
        </div>

        <button
          type="button"
          className={[
            'driver-schedule-day-lock-button',

            formState.isLocked
              ? 'driver-schedule-day-lock-button-active'
              : '',
          ]
            .filter(Boolean)
            .join(' ')}
          disabled={
            !isEditable ||
            isSaving
          }
          aria-pressed={
            formState.isLocked
          }
          onClick={() => {
            setFormState(
              (currentState) => ({
                ...currentState,

                isLocked:
                  !currentState.isLocked,
              }),
            );
          }}
        >
          {formState.isLocked ? (
            <Lock
              size={16}
              aria-hidden="true"
            />
          ) : (
            <Unlock
              size={16}
              aria-hidden="true"
            />
          )}

          {formState.isLocked
            ? 'נעול'
            : 'לא נעול'}
        </button>
      </header>

      <div className="driver-schedule-day-editor-grid">
        <label className="driver-schedule-day-editor-field">
          <span>
            כונן משובץ
          </span>

          <select
            value={
              formState.assignedUserId
            }
            disabled={
              !isEditable ||
              isSaving
            }
            onChange={(
              event,
            ) => {
              setFormState(
                (currentState) => ({
                  ...currentState,

                  assignedUserId:
                    event.target.value,
                }),
              );
            }}
          >
            <option value="">
              ללא שיבוץ
            </option>

            {drivers.map(
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

        <label className="driver-schedule-day-editor-field driver-schedule-day-editor-note-field">
          <span>
            הערה
          </span>

          <textarea
            rows={2}
            value={
              formState.note
            }
            disabled={
              !isEditable ||
              isSaving
            }
            placeholder="הערה אופציונלית"
            onChange={(
              event,
            ) => {
              setFormState(
                (currentState) => ({
                  ...currentState,

                  note:
                    event.target.value,
                }),
              );
            }}
          />
        </label>
      </div>

      <div className="driver-schedule-day-editor-current">
        <span>
          מקור שיבוץ:
        </span>

        <strong>
          {day.assignmentSource ===
          'automatic'
            ? 'אוטומטי'
            : day.assignmentSource ===
                'manual'
              ? 'ידני'
              : day.assignmentSource ===
                  'swap'
                ? 'החלפה'
                : day.assignmentSource ===
                    'import'
                  ? 'ייבוא'
                  : 'ללא שיבוץ'}
        </strong>

        {day.originalUserName &&
        day.originalUserName !==
          day.assignedUserName ? (
          <>
            <span>
              שיבוץ מקורי:
            </span>

            <strong>
              {day.originalUserName}
            </strong>
          </>
        ) : null}
      </div>

      {day.spacingWarning ||
      day.notes ? (
        <div className="driver-schedule-day-editor-warning-box">
          <AlertTriangle
            size={18}
            aria-hidden="true"
          />

          <div>
            <strong>
              אזהרה או הערה
            </strong>

            <span>
              {day.notes ??
                'קיים מרווח קצר בין כוננויות.'}
            </span>
          </div>
        </div>
      ) : null}

      <footer className="driver-schedule-day-editor-actions">
        <Button
          type="button"
          variant="secondary"
          disabled={
            !isEditable ||
            isSaving ||
            !formState.assignedUserId
          }
          onClick={
            handleClearAssignment
          }
        >
          <Trash2
            size={17}
            aria-hidden="true"
          />

          הסרת שיבוץ
        </Button>

        <Button
          type="button"
          disabled={
            !isEditable ||
            isSaving ||
            !isDirty
          }
          onClick={() => {
            void handleSave();
          }}
        >
          <Save
            size={17}
            aria-hidden="true"
          />

          {isSaving
            ? 'שומר...'
            : 'שמירת שינוי'}
        </Button>
      </footer>
    </article>
  );
}

export default DriverScheduleDayEditor;