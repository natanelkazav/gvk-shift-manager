/**
 * קובץ: src/components/schedule/EditableSchedulingAssignments.tsx
 * מטרה: מימוש רכיב תצוגה ואינטראקציה עבור הקצאות.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: EditableSchedulingAssignmentsProps, formatDate, formatTime, getAssignmentSourceLabel, EditableSchedulingAssignments.
 * - קישור מאפיינים ומצב מקומי לתצוגה ולטיפול בפעולות המשתמש.
 */
import {
  AlertTriangle,
  CheckCircle2,
  RotateCcw,
  Trash2,
  UserRoundCog,
  UserX,
} from 'lucide-react';

import type {
  AssignmentCandidatesData,
} from '../../types/assignmentCandidates';

import type {
  EditableSchedulingValidationResult,
} from '../../services/editableSchedulingValidator';

import type {
  SchedulingAssignment,
  SchedulingDispatcherSummary,
  SchedulingDraft,
} from '../../types/autoScheduling';

import { Button } from '../ui';

/**
 * חוזה הנתונים EditableSchedulingAssignmentsProps: הקצאות / מאפייני הרכיב.
 */
interface EditableSchedulingAssignmentsProps {
  // data — נתונים.
  data:
    AssignmentCandidatesData;

  // originalDraft — טיוטה.
  originalDraft:
    SchedulingDraft;

  // assignments — הקצאות.
  assignments:
    SchedulingAssignment[];

  dispatchers:
    SchedulingDispatcherSummary[];

  // validation — אימות נתונים.
  validation:
    EditableSchedulingValidationResult;

  // intentionallyUnassignedShiftIds — מזהה המשמרת.
  intentionallyUnassignedShiftIds:
    string[];

  // onAssignDispatcher — מוקדנים.
  onAssignDispatcher: (
    shiftId: string,
    userId: string,
  ) => void;

  // onRemoveAssignment — הקצאה.
  onRemoveAssignment: (
    shiftId: string,
  ) => void;

  // onMarkShiftIntentionallyUnassigned — משמרת.
  onMarkShiftIntentionallyUnassigned: (
    shiftId: string,
  ) => void;

  // onResetShiftAssignment — משמרת / הקצאה.
  onResetShiftAssignment: (
    shiftId: string,
  ) => void;
}

/**
 * פעולה formatDate: עיצוב ערך לתצוגה עבור תאריך.
 * @param value — ערך.
 * @returns string — הפלט בהתאם לחתימה.
 */
function formatDate(
  value: string,
): string {
  // date — תאריך.
  const date =
    new Date(
      `${value}T12:00:00`,
    );

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר Number.isNaN( date.getTime(), ).
  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return value;
  }

  return new Intl.DateTimeFormat(
    'he-IL',
    {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    },
  ).format(date);
}

/**
 * פעולה formatTime: עיצוב ערך לתצוגה עבור זמן.
 * @param value — ערך.
 * @returns string — הפלט בהתאם לחתימה.
 */
function formatTime(
  value: string,
): string {
  return value.slice(0, 5);
}

/**
 * פעולה getAssignmentSourceLabel: שליפה או חישוב של מקור השיבוץ.
 * @param assignment — הקצאה.
 * @returns string — הפלט בהתאם לחתימה.
 */
function getAssignmentSourceLabel(
  assignment:
    SchedulingAssignment | undefined,
): string {
  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !assignment.
  if (!assignment) {
    return 'ללא שיבוץ';
  }

  switch (assignment.source) {
    case 'automatic_single_candidate':
      return 'זמין יחיד';

    case 'automatic_scoring':
      return 'מנוע ניקוד';

    case 'manual':
      return 'שינוי ידני';

    default:
      return 'לא ידוע';
  }
}

/**
 * פעולה EditableSchedulingAssignments: הקצאות.
 * פרמטר מפורק — שדות הקלט נגישים מקומית בשמות המוגדרים בחתימה.
 */
function EditableSchedulingAssignments({
  data,
  originalDraft,
  assignments,
  dispatchers,
  validation,
  intentionallyUnassignedShiftIds,
  onAssignDispatcher,
  onRemoveAssignment,
  onMarkShiftIntentionallyUnassigned,
  onResetShiftAssignment,
}: EditableSchedulingAssignmentsProps) {
  // assignmentsByShiftId — מזהה המשמרת; מיפוי לחיפוש לפי מפתח.
  const assignmentsByShiftId =
    new Map(
      assignments.map(
        (assignment) => [
          assignment.shiftId,
          assignment,
        ],
      ),
    );

  // originalAssignmentsByShiftId — מזהה המשמרת; מיפוי לחיפוש לפי מפתח.
  const originalAssignmentsByShiftId =
    new Map(
      originalDraft.assignments.map(
        (assignment) => [
          assignment.shiftId,
          assignment,
        ],
      ),
    );

  // intentionallyUnassignedSet — קבוצה ייחודית; אוסף ערכים ייחודיים.
  const intentionallyUnassignedSet =
    new Set(
      intentionallyUnassignedShiftIds,
    );

  // sortedShifts — משמרות.
  const sortedShifts =
    [...data.shifts].sort(
      (firstShift, secondShift) => {
        // dateCompare — תאריך.
        const dateCompare =
          firstShift.date.localeCompare(
            secondShift.date,
          );

        // טיפול במקרה מיוחד ויציאה מוקדמת כאשר dateCompare !== 0.
        if (dateCompare !== 0) {
          return dateCompare;
        }

        // timeCompare — זמן.
        const timeCompare =
          firstShift.startTime.localeCompare(
            secondShift.startTime,
          );

        // טיפול במקרה מיוחד ויציאה מוקדמת כאשר timeCompare !== 0.
        if (timeCompare !== 0) {
          return timeCompare;
        }

        return (
          firstShift.sortOrder -
          secondShift.sortOrder
        );
      },
    );

  return (
    <details className="assignment-draft-details">
      <summary>
        עריכת שיבוצים{' '}
        ({data.shifts.length})
      </summary>

      <div className="editable-scheduling-list">
        {sortedShifts.map(
          (shift) => {
            // currentAssignment — הקצאה.
            const currentAssignment =
              assignmentsByShiftId.get(
                shift.id,
              );

            // originalAssignment — הקצאה.
            const originalAssignment =
              originalAssignmentsByShiftId.get(
                shift.id,
              );

            // shiftValidation — משמרת / אימות נתונים.
            const shiftValidation =
              validation
                .shiftValidations[
                  shift.id
                ];

            // shiftIssues — משמרת.
            const shiftIssues =
              shiftValidation
                ?.issues ??
              [];

            // currentUserId — המשתמש הנוכחי הנוכחי.
            const currentUserId =
              currentAssignment?.userId ??
              '';

            // isIntentionallyUnassigned — הנתון isIntentionallyUnassigned בהקשר הפעולה.
            const isIntentionallyUnassigned =
              intentionallyUnassignedSet.has(
                shift.id,
              );

            // isManuallyChanged — הנתון isManuallyChanged בהקשר הפעולה.
            const isManuallyChanged =
              currentAssignment?.source ===
                'manual' ||
              currentUserId !==
                (
                  originalAssignment
                    ?.userId ??
                  ''
                );

            // isSelectedUserAvailable — נבחר / משתמש.
            const isSelectedUserAvailable =
              !currentUserId ||
              shift.availableUserIds.includes(
                currentUserId,
              );

            return (
              <article
                key={shift.id}
                className={[
                  'editable-scheduling-row',

                  !currentAssignment &&
                  !isIntentionallyUnassigned
                    ? 'editable-scheduling-row-unassigned'
                    : '',

                  isIntentionallyUnassigned
                    ? 'editable-scheduling-row-intentionally-unassigned'
                    : '',

                  isManuallyChanged
                    ? 'editable-scheduling-row-modified'
                    : '',

                  shiftValidation
                    ?.hasErrors
                    ? 'editable-scheduling-row-error'
                    : '',

                  !shiftValidation
                    ?.hasErrors &&
                  shiftValidation
                    ?.hasWarnings
                    ? 'editable-scheduling-row-warning'
                    : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                <div className="editable-scheduling-shift">
                  <strong>
                    {formatDate(
                      shift.date,
                    )}
                    {' · '}
                    <bdi dir="ltr">
                      {formatTime(
                        shift.startTime,
                      )}
                      –
                      {formatTime(
                        shift.endTime,
                      )}
                    </bdi>
                  </strong>

                  <span>
                    יום {shift.weekdayName}
                  </span>

                  <div className="editable-scheduling-badges">
                    {shift.isPremium ? (
                      <span>
                        200%
                      </span>
                    ) : null}

                    {shift.holidayName ? (
                      <span>
                        {shift.holidayName}
                      </span>
                    ) : null}
                  </div>
                </div>

                <label className="editable-scheduling-select-field">
                  <span>
                    מוקדן משובץ
                  </span>

                  <select
                    value={
                      currentUserId
                    }
                    onChange={(
                      event,
                    ) => {
                      // nextUserId — מזהה משתמש הבא.
                      const nextUserId =
                        event.target
                          .value;

                      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !nextUserId.
                      if (!nextUserId) {
                        onRemoveAssignment(
                          shift.id,
                        );

                        return;
                      }

                      onAssignDispatcher(
                        shift.id,
                        nextUserId,
                      );
                    }}
                  >
                    <option value="">
                      {isIntentionallyUnassigned
                        ? 'משמרת לא מאוישת (מאושר)'
                        : 'ללא שיבוץ'}
                    </option>

                    {dispatchers.map(
                      (dispatcher) => {
                        // isAvailable — הנתון isAvailable בהקשר הפעולה.
                        const isAvailable =
                          shift.availableUserIds.includes(
                            dispatcher
                              .userId,
                          );

                        return (
                          <option
                            key={
                              dispatcher
                                .userId
                            }
                            value={
                              dispatcher
                                .userId
                            }
                          >
                            {
                              dispatcher
                                .displayName
                            }

                            {dispatcher
                              .scheduleName
                              ? ` (${dispatcher.scheduleName})`
                              : ''}

                            {isAvailable
                              ? ''
                              : ' — לא סימן זמינות'}
                          </option>
                        );
                      },
                    )}
                  </select>
                </label>

                <div className="editable-scheduling-status">
                  <span>
                    מקור
                  </span>

                  <strong>
                    {isIntentionallyUnassigned
                      ? 'לא מאוישת במכוון'
                      : getAssignmentSourceLabel(
                          currentAssignment,
                        )}
                  </strong>

                  {!isSelectedUserAvailable ? (
                    <small className="editable-scheduling-warning">
                      המוקדן שנבחר לא
                      סימן זמינות
                      למשמרת זו.
                    </small>
                  ) : null}

                  {isIntentionallyUnassigned ? (
                    <small className="editable-scheduling-intentionally-unassigned-label">
                      אושר לפרסום ללא מוקדן
                    </small>
                  ) : isManuallyChanged ? (
                    <small className="editable-scheduling-modified-label">
                      שונה ידנית
                    </small>
                  ) : null}
                </div>

                <div className="editable-scheduling-actions">
                  <Button
                    type="button"
                    variant={
                      isIntentionallyUnassigned
                        ? 'primary'
                        : 'secondary'
                    }
                    onClick={() => {
                      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר isIntentionallyUnassigned.
                      if (isIntentionallyUnassigned) {
                        onResetShiftAssignment(
                          shift.id,
                        );

                        return;
                      }

                      const confirmed =
                        window.confirm(
                          'המשמרת תישאר ללא מוקדן ותוכל להתפרסם כך. האם להמשיך?',
                        );

                      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !confirmed.
                      if (!confirmed) {
                        return;
                      }

                      onMarkShiftIntentionallyUnassigned(
                        shift.id,
                      );
                    }}
                  >
                    <UserX
                      size={16}
                      aria-hidden="true"
                    />

                    {isIntentionallyUnassigned
                      ? 'בטל השארה לא מאוישת'
                      : 'השאר משמרת לא מאוישת'}
                  </Button>

                  <Button
                    type="button"
                    variant="secondary"
                    disabled={
                      !currentAssignment
                    }
                    onClick={() => {
                      onRemoveAssignment(
                        shift.id,
                      );
                    }}
                  >
                    <Trash2
                      size={16}
                      aria-hidden="true"
                    />

                    הסרת שיבוץ
                  </Button>

                  <Button
                    type="button"
                    variant="secondary"
                    disabled={
                      !isManuallyChanged
                    }
                    onClick={() => {
                      onResetShiftAssignment(
                        shift.id,
                      );
                    }}
                  >
                    <RotateCcw
                      size={16}
                      aria-hidden="true"
                    />

                    שחזור הצעת המנוע
                  </Button>
                </div>

                {shiftIssues.length >
                0 ? (
                  <div className="editable-scheduling-validation">
                    {shiftIssues.map(
                      (issue) => (
                        <div
                          key={issue.id}
                          className={[
                            'editable-scheduling-validation-item',

                            issue.severity ===
                            'error'
                              ? 'editable-scheduling-validation-item-error'
                              : 'editable-scheduling-validation-item-warning',
                          ]
                            .filter(Boolean)
                            .join(' ')}
                        >
                          {issue.severity ===
                          'error' ? (
                            <AlertTriangle
                              size={16}
                              aria-hidden="true"
                            />
                          ) : (
                            <AlertTriangle
                              size={16}
                              aria-hidden="true"
                            />
                          )}

                          <span>
                            {issue.message}
                          </span>
                        </div>
                      ),
                    )}
                  </div>
                ) : currentAssignment ||
                  isIntentionallyUnassigned ? (
                  <div className="editable-scheduling-validation editable-scheduling-validation-valid">
                    <CheckCircle2
                      size={16}
                      aria-hidden="true"
                    />

                    <span>
                      {isIntentionallyUnassigned
                        ? 'המשמרת אושרה לפרסום ללא מוקדן.'
                        : 'לא נמצאה בעיה בשיבוץ זה.'}
                    </span>
                  </div>
                ) : null}
              </article>
            );
          },
        )}
      </div>

      <div className="editable-scheduling-footer">
        <UserRoundCog
          size={18}
          aria-hidden="true"
        />

        <span>
          שגיאות חוסמות חייבות להיפתר
          לפני שמירת השיבוץ. ניתן
          לבחור מוקדן שלא סימן זמינות,
          אך הדבר יוצג כאזהרה.
        </span>
      </div>
    </details>
  );
}

export default EditableSchedulingAssignments;