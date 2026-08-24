import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileCog,
  Play,
  RefreshCw,
  Save,
  Sparkles,
  UserCheck,
  Users,
  X,
  XCircle,
} from 'lucide-react';

import type {
  AssignmentCandidateShift,
  AssignmentCandidatesData,
} from '../../types/assignmentCandidates';

import type {
  SchedulingDraft,
} from '../../types/autoScheduling';

import type {
  EditableSchedulingValidationResult,
} from '../../services/editableSchedulingValidator';

import { Button } from '../ui';
import EditableSchedulingAssignments from './EditableSchedulingAssignments';

interface AssignmentCandidatesStatistics {
  totalShifts: number;
  noAvailableShifts: number;
  singleAvailableShifts: number;
  multipleAvailableShifts: number;
}

interface AssignmentCandidatesPanelProps {
  data:
    AssignmentCandidatesData | null;

  statistics:
    AssignmentCandidatesStatistics;

  isLoading: boolean;
  isGeneratingDraft: boolean;
  isSavingSchedule: boolean;
  hasSavedSchedule: boolean;

  error: string | null;
  draftError: string | null;

  draft:
    SchedulingDraft | null;

  editableAssignments:
    SchedulingDraft['assignments'];

  editableDispatcherSummaries:
    SchedulingDraft['dispatcherSummaries'];

  validation:
    EditableSchedulingValidationResult;

  intentionallyUnassignedShiftIds:
    string[];

  isDraftDirty: boolean;

  onRefresh:
    () => Promise<void>;

  onGenerateDraft:
    () => void;

  onAssignDispatcher: (
    shiftId: string,
    userId: string,
  ) => void;

  onRemoveAssignment: (
    shiftId: string,
  ) => void;

  onMarkShiftIntentionallyUnassigned: (
    shiftId: string,
  ) => void;

  onResetShiftAssignment: (
    shiftId: string,
  ) => void;

  onResetAllChanges:
    () => void;

  onSaveSchedule:
    () => Promise<void>;

  onClose:
    () => void;
}

type BalanceMetricKey =
  | 'weekdayEveningShifts'
  | 'weekdayNightShifts'
  | 'fridayMorningShifts'
  | 'fridayAfternoonShifts'
  | 'fridayNightShifts'
  | 'saturdayMorningShifts'
  | 'saturdayAfternoonShifts'
  | 'saturdayNightShifts'
  | 'premiumShifts'
  | 'holidayShifts'
  | 'totalShifts';

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

function getBalanceCellClassName(
  summaries:
    SchedulingDraft['dispatcherSummaries'],

  metric:
    BalanceMetricKey,

  currentValue: number,
): string {
  if (summaries.length === 0) {
    return '';
  }

  const values =
    summaries.map(
      (summary) =>
        summary[metric],
    );

  const minimumValue =
    Math.min(...values);

  const maximumValue =
    Math.max(...values);

  const difference =
    maximumValue -
    minimumValue;

  if (
    maximumValue ===
    minimumValue
  ) {
    return 'assignment-draft-balance-cell-balanced';
  }

  if (
    currentValue ===
    minimumValue
  ) {
    return 'assignment-draft-balance-cell-low';
  }

  if (
    currentValue ===
    maximumValue
  ) {
    return difference >= 2
      ? 'assignment-draft-balance-cell-high'
      : 'assignment-draft-balance-cell-warning';
  }

  return 'assignment-draft-balance-cell-warning';
}

function getBalanceCellTitle(
  summaries:
    SchedulingDraft['dispatcherSummaries'],

  metric:
    BalanceMetricKey,

  currentValue: number,
): string {
  if (summaries.length === 0) {
    return '';
  }

  const values =
    summaries.map(
      (summary) =>
        summary[metric],
    );

  const minimumValue =
    Math.min(...values);

  const maximumValue =
    Math.max(...values);

  if (
    minimumValue ===
    maximumValue
  ) {
    return 'חלוקה שווה בין המוקדנים';
  }

  if (
    currentValue ===
    minimumValue
  ) {
    return 'הכמות הנמוכה ביותר בקטגוריה';
  }

  if (
    currentValue ===
    maximumValue
  ) {
    return 'הכמות הגבוהה ביותר בקטגוריה';
  }

  return 'כמות ביניים בקטגוריה';
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

function getSchedulingIssueLabel(
  issueType:
    SchedulingDraft['issues'][number]['type'],
): string {
  switch (issueType) {
    case 'no_available_dispatcher':
      return 'אין מוקדן זמין';

    case 'single_candidate_conflict':
      return 'המועמד היחיד חסום';

    case 'no_legal_candidate':
      return 'אין מועמד חוקי';

    case 'invalid_shift_time':
      return 'זמן משמרת לא תקין';

    case 'duplicate_shift':
      return 'משמרת כפולה';

    default:
      return 'בעיה לא ידועה';
  }
}

function getShiftClassName(
  shift:
    AssignmentCandidateShift,
): string {
  switch (
    shift.assignmentState
  ) {
    case 'no_available':
      return 'assignment-candidate-shift-no-available';

    case 'single_available':
      return 'assignment-candidate-shift-single';

    case 'multiple_available':
      return 'assignment-candidate-shift-multiple';

    default:
      return '';
  }
}

function getShiftStatusLabel(
  shift:
    AssignmentCandidateShift,
): string {
  switch (
    shift.assignmentState
  ) {
    case 'no_available':
      return 'אין מוקדן זמין';

    case 'single_available':
      return 'מוקדן זמין יחיד';

    case 'multiple_available':
      return 'כמה מוקדנים זמינים';

    default:
      return 'מצב לא ידוע';
  }
}

function getShiftStatusIcon(
  shift:
    AssignmentCandidateShift,
) {
  switch (
    shift.assignmentState
  ) {
    case 'no_available':
      return (
        <XCircle
          size={19}
          aria-hidden="true"
        />
      );

    case 'single_available':
      return (
        <UserCheck
          size={19}
          aria-hidden="true"
        />
      );

    case 'multiple_available':
      return (
        <Users
          size={19}
          aria-hidden="true"
        />
      );

    default:
      return null;
  }
}

function AssignmentCandidateCard({
  shift,
}: {
  shift:
    AssignmentCandidateShift;
}) {
  return (
    <article
      className={[
        'assignment-candidate-shift',
        getShiftClassName(
          shift,
        ),
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="assignment-candidate-shift-header">
        <div className="assignment-candidate-shift-date">
          <strong>
            {formatDate(
              shift.date,
            )}
          </strong>

          <span>
            יום {shift.weekdayName}
          </span>
        </div>

        <div className="assignment-candidate-shift-time">
          <Clock3
            size={17}
            aria-hidden="true"
          />

          <strong dir="ltr">
            {formatTime(
              shift.startTime,
            )}
            {' – '}
            {formatTime(
              shift.endTime,
            )}
          </strong>

          {shift.endsNextDay ? (
            <small>
              מסתיימת ביום הבא
            </small>
          ) : null}
        </div>

        <div className="assignment-candidate-shift-badges">
          {shift.holidayName ? (
            <span className="assignment-candidate-holiday-badge">
              {shift.holidayName}
            </span>
          ) : null}

          {shift.isPremium ? (
            <span className="assignment-candidate-premium-badge">
              <Sparkles
                size={13}
                aria-hidden="true"
              />

              200%
            </span>
          ) : null}
        </div>

        <div className="assignment-candidate-shift-status">
          {getShiftStatusIcon(
            shift,
          )}

          <div>
            <strong>
              {getShiftStatusLabel(
                shift,
              )}
            </strong>

            <span>
              {
                shift
                  .availableDispatchers
              }{' '}
              מתוך{' '}
              {
                shift
                  .totalDispatchers
              }{' '}
              מוקדנים זמינים
            </span>
          </div>
        </div>
      </div>

      {shift.assignmentState ===
      'no_available' ? (
        <div className="assignment-candidate-problem">
          <AlertTriangle
            size={18}
            aria-hidden="true"
          />

          <span>
            לא ניתן לשבץ משמרת זו
            אוטומטית. נדרשת החלטה
            ידנית של מנהל.
          </span>
        </div>
      ) : null}

      {shift.assignmentState ===
        'single_available' &&
      shift
        .soleAvailableDisplayName ? (
        <div className="assignment-candidate-sole-user">
          <UserCheck
            size={18}
            aria-hidden="true"
          />

          <div>
            <span>
              מועמד יחיד לשיבוץ
            </span>

            <strong>
              {
                shift
                  .soleAvailableDisplayName
              }
            </strong>

            {shift
              .soleAvailableScheduleName ? (
              <small>
                שם בשיבוץ:{' '}
                {
                  shift
                    .soleAvailableScheduleName
                }
              </small>
            ) : null}
          </div>
        </div>
      ) : null}

      {shift.assignmentState ===
      'multiple_available' ? (
        <div className="assignment-candidate-users">
          <span className="assignment-candidate-users-title">
            מועמדים זמינים
          </span>

          <div className="assignment-candidate-users-list">
            {shift.availableDisplayNames.map(
              (
                displayName,
                index,
              ) => {
                const scheduleName =
                  shift
                    .availableScheduleNames[
                      index
                    ];

                const userId =
                  shift
                    .availableUserIds[
                      index
                    ] ??
                  String(index);

                return (
                  <span
                    key={`${shift.id}-${userId}`}
                    className="assignment-candidate-user-chip"
                  >
                    <strong>
                      {displayName}
                    </strong>

                    {scheduleName ? (
                      <small>
                        {scheduleName}
                      </small>
                    ) : null}
                  </span>
                );
              },
            )}
          </div>
        </div>
      ) : null}
    </article>
  );
}

function AssignmentCandidatesPanel({
  data,
  statistics,
  isLoading,
  isGeneratingDraft,
  isSavingSchedule,
  hasSavedSchedule,
  error,
  draftError,
  draft,
  editableAssignments,
  editableDispatcherSummaries,
  validation,
  intentionallyUnassignedShiftIds,
  isDraftDirty,
  onRefresh,
  onGenerateDraft,
  onAssignDispatcher,
  onRemoveAssignment,
  onMarkShiftIntentionallyUnassigned,
  onResetShiftAssignment,
  onResetAllChanges,
  onSaveSchedule,
  onClose,
}: AssignmentCandidatesPanelProps) {
  if (isLoading) {
    return (
      <section className="assignment-candidates-panel">
        <div className="assignment-candidates-loading">
          <RefreshCw
            size={30}
            className="dispatcher-availability-loading-icon"
            aria-hidden="true"
          />

          <span>
            טוען את נתוני ההכנה
            לשיבוץ...
          </span>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="assignment-candidates-panel">
        <div
          className="assignment-candidates-error"
          role="alert"
        >
          <strong>
            לא ניתן היה לטעון את
            נתוני ההכנה לשיבוץ
          </strong>

          <span>
            {error}
          </span>

          <div className="assignment-candidates-error-actions">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                void onRefresh();
              }}
            >
              <RefreshCw
                size={17}
                aria-hidden="true"
              />

              ניסיון נוסף
            </Button>

            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
            >
              סגירה
            </Button>
          </div>
        </div>
      </section>
    );
  }

  if (!data) {
    return null;
  }

  const periodTitle =
    data.period.title ??
    `${hebrewMonths[
      data.period.month - 1
    ]} ${data.period.year}`;

  const noAvailableShifts =
    data.shifts.filter(
      (shift) =>
        shift.assignmentState ===
        'no_available',
    );

  const singleAvailableShifts =
    data.shifts.filter(
      (shift) =>
        shift.assignmentState ===
        'single_available',
    );

  const multipleAvailableShifts =
    data.shifts.filter(
      (shift) =>
        shift.assignmentState ===
        'multiple_available',
    );

  const unassignedCount =
    data.shifts.length -
    editableAssignments.length;

  return (
    <section className="assignment-candidates-panel">
      <header className="assignment-candidates-header">
        <div>
          <span className="assignment-candidates-eyebrow">
            הכנה לשיבוץ
          </span>

          <h2>
            ניתוח מועמדים —{' '}
            {periodTitle}
          </h2>

          <p>
            סקירת הזמינות לפני הפעלת
            מנוע השיבוץ האוטומטי.
          </p>
        </div>

        <div className="assignment-candidates-header-actions">
          <Button
            type="button"
            disabled={
              isGeneratingDraft ||
              isLoading
            }
            onClick={
              onGenerateDraft
            }
          >
            <Play
              size={17}
              aria-hidden="true"
            />

            {isGeneratingDraft
              ? 'יוצר טיוטה...'
              : 'צור טיוטת שיבוץ'}
          </Button>

          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              void onRefresh();
            }}
          >
            <RefreshCw
              size={17}
              aria-hidden="true"
            />

            רענון
          </Button>

          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
          >
            <X
              size={17}
              aria-hidden="true"
            />

            סגירה
          </Button>
        </div>
      </header>

      {draftError ? (
        <div
          className="assignment-draft-error"
          role="alert"
        >
          <AlertTriangle
            size={19}
            aria-hidden="true"
          />

          <span>
            {draftError}
          </span>
        </div>
      ) : null}

      <div className="assignment-candidates-summary">
        <article>
          <CalendarDays
            size={21}
            aria-hidden="true"
          />

          <div>
            <strong>
              {statistics.totalShifts}
            </strong>

            <span>
              סך הכול משמרות
            </span>
          </div>
        </article>

        <article className="assignment-candidates-summary-danger">
          <XCircle
            size={21}
            aria-hidden="true"
          />

          <div>
            <strong>
              {
                statistics
                  .noAvailableShifts
              }
            </strong>

            <span>
              ללא זמינים
            </span>
          </div>
        </article>

        <article className="assignment-candidates-summary-warning">
          <UserCheck
            size={21}
            aria-hidden="true"
          />

          <div>
            <strong>
              {
                statistics
                  .singleAvailableShifts
              }
            </strong>

            <span>
              זמין יחיד
            </span>
          </div>
        </article>

        <article className="assignment-candidates-summary-success">
          <CheckCircle2
            size={21}
            aria-hidden="true"
          />

          <div>
            <strong>
              {
                statistics
                  .multipleAvailableShifts
              }
            </strong>

            <span>
              כמה זמינים
            </span>
          </div>
        </article>
      </div>

      {draft ? (
        <section className="assignment-draft-result">
          <header className="assignment-draft-result-header">
            <FileCog
              size={22}
              aria-hidden="true"
            />

            <div>
              <h3>
                טיוטת שיבוץ ראשונית
              </h3>

              <p>
                הטיוטה כוללת שיבוצים
                של מועמדים יחידים
                ושיבוצים שנבחרו באמצעות
                מנוע האיזון והניקוד.
                היא עדיין לא נשמרה
                במסד הנתונים.
              </p>
            </div>
          </header>

          <div className="assignment-draft-summary">
            <article>
              <CheckCircle2
                size={20}
                aria-hidden="true"
              />

              <div>
                <strong>
                  {
                    editableAssignments
                      .length
                  }
                </strong>

                <span>
                  משמרות משובצות
                </span>
              </div>
            </article>

            <article>
              <Clock3
                size={20}
                aria-hidden="true"
              />

              <div>
                <strong>
                  {
                    unassignedCount
                  }
                </strong>

                <span>
                  עדיין ללא שיבוץ
                </span>
              </div>
            </article>

            <article>
              <AlertTriangle
                size={20}
                aria-hidden="true"
              />

              <div>
                <strong>
                  {
                    validation.errorCount +
                    validation.warningCount
                  }
                </strong>

                <span>
                  בעיות ואזהרות
                </span>
              </div>
            </article>
          </div>

          <div
            className={[
              'assignment-draft-validation-summary',
              validation.isValid
                ? 'assignment-draft-validation-summary-valid'
                : 'assignment-draft-validation-summary-invalid',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            {validation.isValid ? (
              <CheckCircle2
                size={21}
                aria-hidden="true"
              />
            ) : (
              <AlertTriangle
                size={21}
                aria-hidden="true"
              />
            )}

            <div>
              <strong>
                {validation.isValid
                  ? 'הטיוטה תקינה'
                  : 'הטיוטה דורשת טיפול'}
              </strong>

              <span>
                {validation.errorCount}{' '}
                שגיאות חוסמות ו־
                {validation.warningCount}{' '}
                אזהרות.
              </span>
            </div>

            <div className="assignment-draft-validation-metrics">
              <span>
                ללא שיבוץ:{' '}
                <strong>{validation.unassignedShiftCount}</strong>
              </span>

              <span>
                חפיפות:{' '}
                <strong>{validation.overlapCount}</strong>
              </span>

              <span>
                רצופות:{' '}
                <strong>{validation.consecutiveShiftCount}</strong>
              </span>

              <span>
                ללא זמינות:{' '}
                <strong>{validation.unavailableAssignmentCount}</strong>
              </span>
            </div>
          </div>

          {isDraftDirty ? (
            <div className="assignment-draft-edit-notice">
              <div>
                <strong>
                  קיימים שינויים ידניים
                  בטיוטה
                </strong>

                <span>
                  טבלת האיזון חושבה
                  מחדש לפי השיבוצים
                  המעודכנים.
                </span>
              </div>

              <Button
                type="button"
                variant="secondary"
                onClick={
                  onResetAllChanges
                }
              >
                <RefreshCw
                  size={16}
                  aria-hidden="true"
                />

                ביטול כל השינויים
              </Button>
            </div>
          ) : null}

          <div className="assignment-draft-balance-section">
            <div className="assignment-draft-balance-header">
              <div>
                <h4>
                  טבלת איזון מוקדנים
                </h4>

                <p>
                  סיכום השיבוצים שנוצרו
                  בטיוטה לפי ימים ושעות
                  משמרת.
                </p>
              </div>
            </div>

            <div className="assignment-draft-balance-table-wrapper">
              <table className="assignment-draft-balance-table assignment-draft-balance-table-detailed">
                <thead>
                  <tr>
                    <th rowSpan={2}>
                      מוקדן
                    </th>

                    <th
                      colSpan={2}
                      className="assignment-draft-balance-group-weekday"
                    >
                      יום חול
                    </th>

                    <th
                      colSpan={3}
                      className="assignment-draft-balance-group-friday"
                    >
                      שישי
                    </th>

                    <th
                      colSpan={3}
                      className="assignment-draft-balance-group-saturday"
                    >
                      שבת
                    </th>

                    <th
                      rowSpan={2}
                      className="assignment-draft-balance-group-premium"
                    >
                      200%
                    </th>

                    <th
                      rowSpan={2}
                      className="assignment-draft-balance-group-holiday"
                    >
                      חג
                    </th>

                    <th
                      rowSpan={2}
                      className="assignment-draft-balance-total-column"
                    >
                      סה״כ
                    </th>
                  </tr>

                  <tr>
                    <th>
                      ערב
                      <small>
                        16–23
                      </small>
                    </th>

                    <th>
                      לילה
                      <small>
                        23–06
                      </small>
                    </th>

                    <th>
                      בוקר
                      <small>
                        06–14
                      </small>
                    </th>

                    <th>
                      צהריים
                      <small>
                        14–22
                      </small>
                    </th>

                    <th>
                      לילה
                      <small>
                        22–06
                      </small>
                    </th>

                    <th>
                      בוקר
                      <small>
                        06–14
                      </small>
                    </th>

                    <th>
                      צהריים
                      <small>
                        14–22
                      </small>
                    </th>

                    <th>
                      לילה
                      <small>
                        22–06
                      </small>
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {editableDispatcherSummaries.map(
                    (dispatcher) => (
                      <tr
                        key={
                          dispatcher
                            .userId
                        }
                      >
                        <td className="assignment-draft-balance-dispatcher">
                          <strong>
                            {
                              dispatcher
                                .displayName
                            }
                          </strong>

                          {dispatcher
                            .scheduleName ? (
                            <small>
                              {
                                dispatcher
                                  .scheduleName
                              }
                            </small>
                          ) : null}
                        </td>

                        <td
                          className={getBalanceCellClassName(
                            editableDispatcherSummaries,
                            'weekdayEveningShifts',
                            dispatcher.weekdayEveningShifts,
                          )}
                          title={getBalanceCellTitle(
                            editableDispatcherSummaries,
                            'weekdayEveningShifts',
                            dispatcher.weekdayEveningShifts,
                          )}
                        >
                          {
                            dispatcher
                              .weekdayEveningShifts
                          }
                        </td>

                        <td
                          className={getBalanceCellClassName(
                            editableDispatcherSummaries,
                            'weekdayNightShifts',
                            dispatcher.weekdayNightShifts,
                          )}
                          title={getBalanceCellTitle(
                            editableDispatcherSummaries,
                            'weekdayNightShifts',
                            dispatcher.weekdayNightShifts,
                          )}
                        >
                          {
                            dispatcher
                              .weekdayNightShifts
                          }
                        </td>

                        <td
                          className={getBalanceCellClassName(
                            editableDispatcherSummaries,
                            'fridayMorningShifts',
                            dispatcher.fridayMorningShifts,
                          )}
                          title={getBalanceCellTitle(
                            editableDispatcherSummaries,
                            'fridayMorningShifts',
                            dispatcher.fridayMorningShifts,
                          )}
                        >
                          {
                            dispatcher
                              .fridayMorningShifts
                          }
                        </td>

                        <td
                          className={getBalanceCellClassName(
                            editableDispatcherSummaries,
                            'fridayAfternoonShifts',
                            dispatcher.fridayAfternoonShifts,
                          )}
                          title={getBalanceCellTitle(
                            editableDispatcherSummaries,
                            'fridayAfternoonShifts',
                            dispatcher.fridayAfternoonShifts,
                          )}
                        >
                          {
                            dispatcher
                              .fridayAfternoonShifts
                          }
                        </td>

                        <td
                          className={getBalanceCellClassName(
                            editableDispatcherSummaries,
                            'fridayNightShifts',
                            dispatcher.fridayNightShifts,
                          )}
                          title={getBalanceCellTitle(
                            editableDispatcherSummaries,
                            'fridayNightShifts',
                            dispatcher.fridayNightShifts,
                          )}
                        >
                          {
                            dispatcher
                              .fridayNightShifts
                          }
                        </td>

                        <td
                          className={getBalanceCellClassName(
                            editableDispatcherSummaries,
                            'saturdayMorningShifts',
                            dispatcher.saturdayMorningShifts,
                          )}
                          title={getBalanceCellTitle(
                            editableDispatcherSummaries,
                            'saturdayMorningShifts',
                            dispatcher.saturdayMorningShifts,
                          )}
                        >
                          {
                            dispatcher
                              .saturdayMorningShifts
                          }
                        </td>

                        <td
                          className={getBalanceCellClassName(
                            editableDispatcherSummaries,
                            'saturdayAfternoonShifts',
                            dispatcher.saturdayAfternoonShifts,
                          )}
                          title={getBalanceCellTitle(
                            editableDispatcherSummaries,
                            'saturdayAfternoonShifts',
                            dispatcher.saturdayAfternoonShifts,
                          )}
                        >
                          {
                            dispatcher
                              .saturdayAfternoonShifts
                          }
                        </td>

                        <td
                          className={getBalanceCellClassName(
                            editableDispatcherSummaries,
                            'saturdayNightShifts',
                            dispatcher.saturdayNightShifts,
                          )}
                          title={getBalanceCellTitle(
                            editableDispatcherSummaries,
                            'saturdayNightShifts',
                            dispatcher.saturdayNightShifts,
                          )}
                        >
                          {
                            dispatcher
                              .saturdayNightShifts
                          }
                        </td>

                        <td
                          className={[
                            'assignment-draft-balance-premium-cell',
                            getBalanceCellClassName(
                              editableDispatcherSummaries,
                              'premiumShifts',
                              dispatcher.premiumShifts,
                            ),
                          ]
                            .filter(Boolean)
                            .join(' ')}
                          title={getBalanceCellTitle(
                            editableDispatcherSummaries,
                            'premiumShifts',
                            dispatcher.premiumShifts,
                          )}
                        >
                          {
                            dispatcher
                              .premiumShifts
                          }
                        </td>

                        <td
                          className={[
                            'assignment-draft-balance-holiday-cell',
                            getBalanceCellClassName(
                              editableDispatcherSummaries,
                              'holidayShifts',
                              dispatcher.holidayShifts,
                            ),
                          ]
                            .filter(Boolean)
                            .join(' ')}
                          title={getBalanceCellTitle(
                            editableDispatcherSummaries,
                            'holidayShifts',
                            dispatcher.holidayShifts,
                          )}
                        >
                          {
                            dispatcher
                              .holidayShifts
                          }
                        </td>

                        <td
                          className={[
                            'assignment-draft-balance-total-cell',
                            getBalanceCellClassName(
                              editableDispatcherSummaries,
                              'totalShifts',
                              dispatcher.totalShifts,
                            ),
                          ]
                            .filter(Boolean)
                            .join(' ')}
                          title={getBalanceCellTitle(
                            editableDispatcherSummaries,
                            'totalShifts',
                            dispatcher.totalShifts,
                          )}
                        >
                          {
                            dispatcher
                              .totalShifts
                          }
                        </td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>

            <div className="assignment-draft-balance-legend">
              <span>
                <i className="assignment-draft-balance-legend-low" />
                נמוך ביחס לאחרים
              </span>

              <span>
                <i className="assignment-draft-balance-legend-warning" />
                פער קטן או ערך ביניים
              </span>

              <span>
                <i className="assignment-draft-balance-legend-high" />
                גבוה באופן חריג
              </span>

              <span>
                <i className="assignment-draft-balance-legend-balanced" />
                חלוקה שווה
              </span>
            </div>

            <p className="assignment-draft-balance-note">
              הצבעים מיועדים להדגיש
              פערים בין המוקדנים ואינם
              בהכרח מעידים על שיבוץ
              שגוי. עמודות 200% וחג הן
              מדדים מצטברים ועשויות
              לכלול משמרות שכבר נספרו
              בעמודות היום והשעה.
            </p>
          </div>

          {draft.issues.length >
          0 ? (
            <details
              className="assignment-draft-details assignment-draft-issues-details"
              open
            >
              <summary>
                בעיות שהתגלו{' '}
                ({draft.issues.length})
              </summary>

              <div className="assignment-draft-section">
                <div className="assignment-draft-issues">
                  {draft.issues.map(
                    (
                      issue,
                      index,
                    ) => {
                      const shift =
                        data.shifts.find(
                          (
                            candidateShift,
                          ) =>
                            candidateShift
                              .id ===
                            issue.shiftId,
                        );

                      return (
                        <article
                          key={`${issue.shiftId}-${issue.type}-${index}`}
                          className="assignment-draft-issue-row"
                        >
                          <AlertTriangle
                            size={18}
                            aria-hidden="true"
                          />

                          <div>
                            <strong>
                              {getSchedulingIssueLabel(
                                issue.type,
                              )}
                            </strong>

                            {shift ? (
                              <span>
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
                              </span>
                            ) : null}

                            <p>
                              {
                                issue
                                  .message
                              }
                            </p>
                          </div>
                        </article>
                      );
                    },
                  )}
                </div>
              </div>
            </details>
          ) : null}

          <EditableSchedulingAssignments
            data={
              data
            }
            originalDraft={
              draft
            }
            assignments={
              editableAssignments
            }
            dispatchers={
              editableDispatcherSummaries
            }
            validation={
              validation
            }
            intentionallyUnassignedShiftIds={
              intentionallyUnassignedShiftIds
            }
            onAssignDispatcher={
              onAssignDispatcher
            }
            onRemoveAssignment={
              onRemoveAssignment
            }
            onMarkShiftIntentionallyUnassigned={
              onMarkShiftIntentionallyUnassigned
            }
            onResetShiftAssignment={
              onResetShiftAssignment
            }
          />

          <div
            className={[
              'assignment-draft-save-section',
              validation.isValid
                ? 'assignment-draft-save-section-valid'
                : 'assignment-draft-save-section-invalid',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            <div>
              <strong>
                {validation.isValid
                  ? 'השיבוץ מוכן לשמירה'
                  : 'לא ניתן עדיין לשמור את השיבוץ'}
              </strong>

              <span>
                {validation.isValid
                  ? validation.warningCount > 0
                    ? `קיימות ${validation.warningCount} אזהרות שידרשו אישור לפני השמירה.`
                    : intentionallyUnassignedShiftIds.length > 0
                      ? `${intentionallyUnassignedShiftIds.length} משמרות אושרו כלא מאוישות ולא נמצאו שגיאות חוסמות.`
                      : 'כל המשמרות משובצות ולא נמצאו שגיאות חוסמות.'
                  : `יש לפתור ${validation.errorCount} שגיאות חוסמות לפני השמירה.`}
              </span>
            </div>

            <Button
              type="button"
              disabled={
                !validation.isValid ||
                isSavingSchedule ||
                editableAssignments.length +
                  intentionallyUnassignedShiftIds.length !==
                  data.shifts.length
              }
              onClick={() => {
                void onSaveSchedule();
              }}
            >
              {hasSavedSchedule ? (
                <CheckCircle2
                  size={18}
                  aria-hidden="true"
                />
              ) : (
                <Save
                  size={18}
                  aria-hidden="true"
                />
              )}

              {isSavingSchedule
                ? 'שומר שיבוץ...'
                : hasSavedSchedule
                  ? 'השיבוץ נשמר'
                  : 'אישור ושמירת השיבוץ'}
            </Button>
          </div>
        </section>
      ) : null}

      {noAvailableShifts.length >
      0 ? (
        <details
          className="assignment-candidates-group assignment-candidates-group-details"
          open
        >
          <summary className="assignment-candidates-group-header assignment-candidates-group-header-danger">
            <XCircle
              size={20}
              aria-hidden="true"
            />

            <div>
              <h3>
                משמרות ללא מוקדן זמין
              </h3>

              <p>
                משמרות אלו מחייבות
                טיפול ידני לפני יצירת
                שיבוץ.
              </p>
            </div>

            <strong className="assignment-candidates-group-count">
              {
                noAvailableShifts
                  .length
              }
            </strong>
          </summary>

          <div className="assignment-candidates-list">
            {noAvailableShifts.map(
              (shift) => (
                <AssignmentCandidateCard
                  key={shift.id}
                  shift={shift}
                />
              ),
            )}
          </div>
        </details>
      ) : null}

      {singleAvailableShifts.length >
      0 ? (
        <details className="assignment-candidates-group assignment-candidates-group-details">
          <summary className="assignment-candidates-group-header assignment-candidates-group-header-warning">
            <UserCheck
              size={20}
              aria-hidden="true"
            />

            <div>
              <h3>
                משמרות עם מוקדן זמין
                יחיד
              </h3>

              <p>
                משמרות אלו מועמדות
                לשיבוץ מוקדם בכפוף
                לבדיקת רצף משמרות.
              </p>
            </div>

            <strong className="assignment-candidates-group-count">
              {
                singleAvailableShifts
                  .length
              }
            </strong>
          </summary>

          <div className="assignment-candidates-list">
            {singleAvailableShifts.map(
              (shift) => (
                <AssignmentCandidateCard
                  key={shift.id}
                  shift={shift}
                />
              ),
            )}
          </div>
        </details>
      ) : null}

      {multipleAvailableShifts.length >
      0 ? (
        <details className="assignment-candidates-group assignment-candidates-group-details">
          <summary className="assignment-candidates-group-header assignment-candidates-group-header-success">
            <Users
              size={20}
              aria-hidden="true"
            />

            <div>
              <h3>
                משמרות עם כמה מוקדנים
                זמינים
              </h3>

              <p>
                משמרות אלו מועברות
                למנוע האיזון של
                השיבוץ.
              </p>
            </div>

            <strong className="assignment-candidates-group-count">
              {
                multipleAvailableShifts
                  .length
              }
            </strong>
          </summary>

          <div className="assignment-candidates-list">
            {multipleAvailableShifts.map(
              (shift) => (
                <AssignmentCandidateCard
                  key={shift.id}
                  shift={shift}
                />
              ),
            )}
          </div>
        </details>
      ) : null}
    </section>
  );
}

export default AssignmentCandidatesPanel;