import {
  AlertTriangle,
  CheckCircle2,
  RotateCcw,
  Trash2,
  UserRoundCog,
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

interface EditableSchedulingAssignmentsProps {
  data:
    AssignmentCandidatesData;

  originalDraft:
    SchedulingDraft;

  assignments:
    SchedulingAssignment[];

  dispatchers:
    SchedulingDispatcherSummary[];

  validation:
    EditableSchedulingValidationResult;

  onAssignDispatcher: (
    shiftId: string,
    userId: string,
  ) => void;

  onRemoveAssignment: (
    shiftId: string,
  ) => void;

  onResetShiftAssignment: (
    shiftId: string,
  ) => void;
}

function formatDate(
  value: string,
): string {
  const date =
    new Date(
      `${value}T12:00:00`,
    );

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

function formatTime(
  value: string,
): string {
  return value.slice(0, 5);
}

function getAssignmentSourceLabel(
  assignment:
    SchedulingAssignment | undefined,
): string {
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

function EditableSchedulingAssignments({
  data,
  originalDraft,
  assignments,
  dispatchers,
  validation,
  onAssignDispatcher,
  onRemoveAssignment,
  onResetShiftAssignment,
}: EditableSchedulingAssignmentsProps) {
  const assignmentsByShiftId =
    new Map(
      assignments.map(
        (assignment) => [
          assignment.shiftId,
          assignment,
        ],
      ),
    );

  const originalAssignmentsByShiftId =
    new Map(
      originalDraft.assignments.map(
        (assignment) => [
          assignment.shiftId,
          assignment,
        ],
      ),
    );

  return (
    <details className="assignment-draft-details">
      <summary>
        עריכת שיבוצים{' '}
        ({data.shifts.length})
      </summary>

      <div className="editable-scheduling-list">
        {data.shifts.map(
          (shift) => {
            const currentAssignment =
              assignmentsByShiftId.get(
                shift.id,
              );

            const originalAssignment =
              originalAssignmentsByShiftId.get(
                shift.id,
              );

            const shiftValidation =
              validation
                .shiftValidations[
                  shift.id
                ];

            const shiftIssues =
              shiftValidation
                ?.issues ??
              [];

            const currentUserId =
              currentAssignment?.userId ??
              '';

            const isManuallyChanged =
              currentAssignment?.source ===
                'manual' ||
              currentUserId !==
                (
                  originalAssignment
                    ?.userId ??
                  ''
                );

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

                  !currentAssignment
                    ? 'editable-scheduling-row-unassigned'
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
                    {formatTime(
                      shift.startTime,
                    )}
                    –
                    {formatTime(
                      shift.endTime,
                    )}
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
                      const nextUserId =
                        event.target
                          .value;

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
                      ללא שיבוץ
                    </option>

                    {dispatchers.map(
                      (dispatcher) => {
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
                    {getAssignmentSourceLabel(
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

                  {isManuallyChanged ? (
                    <small className="editable-scheduling-modified-label">
                      שונה ידנית
                    </small>
                  ) : null}
                </div>

                <div className="editable-scheduling-actions">
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
                ) : currentAssignment ? (
                  <div className="editable-scheduling-validation editable-scheduling-validation-valid">
                    <CheckCircle2
                      size={16}
                      aria-hidden="true"
                    />

                    <span>
                      לא נמצאה בעיה
                      בשיבוץ זה.
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