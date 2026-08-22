import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  CircleDashed,
  Clock3,
  RefreshCw,
  Sparkles,
  UserCheck,
  UserX,
  X,
  XCircle,
} from 'lucide-react';
import { Button } from '../ui';
import type {
  AvailabilityMatrixDispatcher,
  AvailabilityMatrixShift,
  AvailabilityPeriodMatrix,
} from '../../types/availabilityMatrix';

interface AvailabilityMatrixStatistics {
  totalShifts: number;
  noAvailableShifts: number;
  singleAvailableShifts: number;
  multipleAvailableShifts: number;
  incompleteShifts: number;
}

interface AvailabilityMatrixPanelProps {
  data: AvailabilityPeriodMatrix | null;
  statistics: AvailabilityMatrixStatistics;
  isLoading: boolean;
  error: string | null;

  onRefresh: () => Promise<void>;
  onClose: () => void;
}

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

function formatDate(
  value: string,
): string {
  const date = new Date(
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

function getShiftStateClass(
  shift: AvailabilityMatrixShift,
): string {
  if (
    shift.unansweredDispatchers > 0
  ) {
    return 'availability-matrix-shift-incomplete';
  }

  if (
    shift.availableDispatchers === 0
  ) {
    return 'availability-matrix-shift-none';
  }

  if (
    shift.availableDispatchers === 1
  ) {
    return 'availability-matrix-shift-single';
  }

  return 'availability-matrix-shift-multiple';
}

function getShiftStateLabel(
  shift: AvailabilityMatrixShift,
): string {
  if (
    shift.unansweredDispatchers > 0
  ) {
    return 'ממתין לתשובות';
  }

  if (
    shift.availableDispatchers === 0
  ) {
    return 'אין מוקדן זמין';
  }

  if (
    shift.availableDispatchers === 1
  ) {
    return 'מוקדן זמין יחיד';
  }

  return 'זמינות מספקת';
}

function getDispatcherStatusClass(
  dispatcher:
    AvailabilityMatrixDispatcher,
): string {
  if (
    dispatcher.availabilityStatus ===
    'available'
  ) {
    return 'availability-matrix-dispatcher-available';
  }

  if (
    dispatcher.availabilityStatus ===
    'unavailable'
  ) {
    return 'availability-matrix-dispatcher-unavailable';
  }

  return 'availability-matrix-dispatcher-unanswered';
}

function getDispatcherStatusLabel(
  dispatcher:
    AvailabilityMatrixDispatcher,
): string {
  if (
    dispatcher.availabilityStatus ===
    'available'
  ) {
    return 'זמין';
  }

  if (
    dispatcher.availabilityStatus ===
    'unavailable'
  ) {
    return 'לא זמין';
  }

  return 'לא סימן';
}

function DispatcherStatusIcon({
  dispatcher,
}: {
  dispatcher:
    AvailabilityMatrixDispatcher;
}) {
  if (
    dispatcher.availabilityStatus ===
    'available'
  ) {
    return (
      <UserCheck
        size={17}
        aria-hidden="true"
      />
    );
  }

  if (
    dispatcher.availabilityStatus ===
    'unavailable'
  ) {
    return (
      <UserX
        size={17}
        aria-hidden="true"
      />
    );
  }

  return (
    <CircleDashed
      size={17}
      aria-hidden="true"
    />
  );
}

function AvailabilityMatrixPanel({
  data,
  statistics,
  isLoading,
  error,
  onRefresh,
  onClose,
}: AvailabilityMatrixPanelProps) {
  if (isLoading) {
    return (
      <section className="availability-matrix-panel">
        <div className="availability-matrix-loading">
          <RefreshCw
            size={30}
            className="dispatcher-availability-loading-icon"
            aria-hidden="true"
          />

          <span>
            טוען את מטריצת
            הזמינות...
          </span>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="availability-matrix-panel">
        <div
          className="availability-matrix-error"
          role="alert"
        >
          <strong>
            לא ניתן היה לטעון את
            מטריצת הזמינות
          </strong>

          <span>
            {error}
          </span>

          <div className="availability-matrix-error-actions">
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

  return (
    <section className="availability-matrix-panel">
      <header className="availability-matrix-header">
        <div>
          <span className="availability-matrix-eyebrow">
            ניתוח זמינות
          </span>

          <h2>
            זמינות למשמרות —{' '}
            {periodTitle}
          </h2>

          <p>
            השוואת הזמינות של כל
            המוקדנים לפי משמרת.
          </p>
        </div>

        <div className="availability-matrix-header-actions">
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

      <div className="availability-matrix-summary">
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
              משמרות
            </span>
          </div>
        </article>

        <article className="availability-matrix-summary-danger">
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
              ללא מוקדן זמין
            </span>
          </div>
        </article>

        <article className="availability-matrix-summary-warning">
          <AlertTriangle
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
              מוקדן יחיד
            </span>
          </div>
        </article>

        <article className="availability-matrix-summary-success">
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
              שניים ומעלה
            </span>
          </div>
        </article>

        <article>
          <CircleDashed
            size={21}
            aria-hidden="true"
          />

          <div>
            <strong>
              {
                statistics
                  .incompleteShifts
              }
            </strong>

            <span>
              תשובות חסרות
            </span>
          </div>
        </article>
      </div>

      <div className="availability-matrix-legend">
        <span>
          <i className="availability-matrix-legend-none" />
          אין זמין
        </span>

        <span>
          <i className="availability-matrix-legend-single" />
          זמין יחיד
        </span>

        <span>
          <i className="availability-matrix-legend-multiple" />
          שניים ומעלה
        </span>

        <span>
          <i className="availability-matrix-legend-incomplete" />
          תשובה חסרה
        </span>
      </div>

      <div className="availability-matrix-list">
        {data.shifts.map(
          (shift) => (
            <article
              key={shift.id}
              className={[
                'availability-matrix-shift',
                getShiftStateClass(
                  shift,
                ),
              ].join(' ')}
            >
              <div className="availability-matrix-shift-header">
                <div className="availability-matrix-shift-date">
                  <strong>
                    {formatDate(
                      shift.date,
                    )}
                  </strong>

                  <span>
                    יום{' '}
                    {shift.weekdayName}
                  </span>
                </div>

                <div className="availability-matrix-shift-time">
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

                <div className="availability-matrix-shift-badges">
                  {shift.holidayName ? (
                    <span className="availability-matrix-holiday-badge">
                      {
                        shift.holidayName
                      }
                    </span>
                  ) : null}

                  {shift.isPremium ? (
                    <span className="availability-matrix-premium-badge">
                      <Sparkles
                        size={13}
                        aria-hidden="true"
                      />

                      200%
                    </span>
                  ) : null}
                </div>

                <div className="availability-matrix-shift-summary">
                  <strong>
                    {getShiftStateLabel(
                      shift,
                    )}
                  </strong>

                  <span>
                    זמין:{' '}
                    {
                      shift
                        .availableDispatchers
                    }
                    {' · '}
                    לא זמין:{' '}
                    {
                      shift
                        .unavailableDispatchers
                    }
                    {' · '}
                    ללא תשובה:{' '}
                    {
                      shift
                        .unansweredDispatchers
                    }
                  </span>
                </div>
              </div>

              <div className="availability-matrix-dispatchers">
                {shift.dispatchers.map(
                  (dispatcher) => (
                    <div
                      key={
                        dispatcher.userId
                      }
                      className={[
                        'availability-matrix-dispatcher',
                        getDispatcherStatusClass(
                          dispatcher,
                        ),
                      ].join(' ')}
                    >
                      <DispatcherStatusIcon
                        dispatcher={
                          dispatcher
                        }
                      />

                      <div>
                        <strong>
                          {
                            dispatcher
                              .displayName
                          }
                        </strong>

                        <span>
                          {getDispatcherStatusLabel(
                            dispatcher,
                          )}
                        </span>

                        {dispatcher.note ? (
                          <small>
                            {
                              dispatcher
                                .note
                            }
                          </small>
                        ) : null}
                      </div>
                    </div>
                  ),
                )}
              </div>
            </article>
          ),
        )}
      </div>
    </section>
  );
}

export default AvailabilityMatrixPanel;