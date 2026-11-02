/**
 * קובץ: src/components/driverSchedule/DriverScheduleDayEditor.tsx
 * מטרה: מימוש רכיב תצוגה ואינטראקציה עבור כוננים / שיבוץ / יום.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: DriverScheduleDayEditorProps, DriverScheduleDayEditorState, createEditorState, DriverScheduleDayEditor.
 * - קישור מאפיינים ומצב מקומי לתצוגה ולטיפול בפעולות המשתמש.
 */
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

/**
 * חוזה הנתונים DriverScheduleDayEditorProps: כוננים / שיבוץ / יום / מאפייני הרכיב.
 */
interface DriverScheduleDayEditorProps {
  // day — יום.
  day:
    DriverScheduleDay;

  drivers:
    DriverScheduleDriver[];

  isEditable: boolean;

  // isSaving — האם שמירה מתבצעת.
  isSaving: boolean;

  // holidayLabels — חג (אופציונלי).
  holidayLabels?: string[];

  onSave: (
    request:
      UpdateDriverScheduleDayRequest,
  ) => Promise<void>;
}

/**
 * חוזה הנתונים DriverScheduleDayEditorState: כוננים / שיבוץ / יום / מצב.
 */
interface DriverScheduleDayEditorState {
  // assignedUserId — מזהה העובד המשובץ.
  assignedUserId:
    string;

  // isLocked — האם הרשומה נעולה.
  isLocked: boolean;

  // note — הערה.
  note:
    string;
}

/**
 * פעולה createEditorState: יצירת מצב.
 * @param day — יום.
 * @returns DriverScheduleDayEditorState — הפלט בהתאם לחתימה.
 */
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

/**
 * פעולה DriverScheduleDayEditor: כוננים / שיבוץ / יום.
 * פרמטר מפורק — שדות הקלט נגישים מקומית בשמות המוגדרים בחתימה.
 */
function DriverScheduleDayEditor({
  day,
  drivers,
  isEditable,
  isSaving,
  holidayLabels = [],
  onSave,
}: DriverScheduleDayEditorProps) {
  // מצב מקומי: formState — מצב; setFormState מעדכנת אותו ומפעילה רינדור לפי React.
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



  // initialState — מצב.
  const initialState =
    createEditorState(
      day,
    );

  // isDirty — הנתון isDirty בהקשר הפעולה.
  const isDirty =
    formState.assignedUserId !==
      initialState.assignedUserId ||
    formState.isLocked !==
      initialState.isLocked ||
    formState.note !==
      initialState.note;

  /**
   * פעולה אסינכרונית handleSave: טיפול באירוע עבור הנתון handleSave בהקשר הפעולה.
   * @returns Promise<void> — הפלט בהתאם לחתימה.
   */
  const handleSave =
    async (): Promise<void> => {
      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !isEditable || isSaving || !isDirty.
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

  /**
   * פעולה handleClearAssignment: טיפול באירוע עבור הקצאה.
   * @returns void — הפלט בהתאם לחתימה.
   */
  const handleClearAssignment =
    (): void => {
      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !isEditable || isSaving.
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

          {holidayLabels.length > 0 ? (
            <div className="driver-schedule-day-editor-holidays">
              {holidayLabels.map((label) => (
                <span key={label}>{label}</span>
              ))}
            </div>
          ) : null}
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
                  key={driver.id}
                  value={driver.id}
                  disabled={
                    !driver.isActive &&
                    driver.id !== day.assignedUserId
                  }
                >
                  {`${driver.scheduleName ?? driver.displayName}${driver.isActive ? '' : ' (מושבת)'}`}
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