import {
  CircleDashed,
  Clock3,
  RefreshCw,
  UserRoundCheck,
  UsersRound,
} from 'lucide-react';
import { Button } from '../ui';
import type {
  AvailabilitySubmissionTrackingDispatcher,
  AvailabilityTrackingStatus,
} from '../../types/availabilitySubmissions';

interface AvailabilitySubmissionsPanelProps {
  isLoading: boolean;
  error: string | null;

  data: {
    period: {
      id: string;
      year: number;
      month: number;
      title: string | null;
      status: string;
      submissionDeadline: string | null;
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

  onRefresh: () => Promise<void>;
  onClose: () => void;
}

const statusLabels: Record<
  AvailabilityTrackingStatus,
  string
> = {
  submitted: 'הוגש',
  draft: 'בטיוטה',
  not_started: 'לא התחיל',
};

function formatDate(
  value: string | null,
): string {
  if (!value) {
    return 'לא הוגדר';
  }

  const date = new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return 'תאריך לא תקין';
  }

  return new Intl.DateTimeFormat(
    'he-IL',
    {
      dateStyle: 'short',
      timeStyle: 'short',
    },
  ).format(date);
}

function AvailabilitySubmissionsPanel({
  isLoading,
  error,
  data,
  onRefresh,
  onClose,
}: AvailabilitySubmissionsPanelProps) {
  if (isLoading) {
    return (
      <section className="availability-submissions-panel">
        <div className="availability-submissions-loading">
          <RefreshCw
            size={28}
            className="dispatcher-availability-loading-icon"
            aria-hidden="true"
          />

          <span>
            טוען את נתוני ההגשות...
          </span>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="availability-submissions-panel">
        <div
          className="availability-submissions-error"
          role="alert"
        >
          <strong>
            לא ניתן היה לטעון את מעקב
            ההגשות
          </strong>

          <span>
            {error}
          </span>

          <div className="availability-submissions-error-actions">
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

  return (
    <section className="availability-submissions-panel">
      <header className="availability-submissions-header">
        <div>
          <span className="availability-submissions-eyebrow">
            מעקב מנהל
          </span>

          <h2>
            מעקב הגשות —{' '}
            {data.period.title ??
              `${data.period.month}/${data.period.year}`}
          </h2>

          <p>
            מועד אחרון להגשה:{' '}
            {formatDate(
              data.period.submissionDeadline,
            )}
          </p>
        </div>

        <div className="availability-submissions-header-actions">
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
            סגירה
          </Button>
        </div>
      </header>

      <div className="availability-submissions-summary">
        <article>
          <UsersRound
            size={21}
            aria-hidden="true"
          />

          <div>
            <strong>
              {
                data.summary
                  .totalDispatchers
              }
            </strong>

            <span>
              מוקדנים פעילים
            </span>
          </div>
        </article>

        <article>
          <UserRoundCheck
            size={21}
            aria-hidden="true"
          />

          <div>
            <strong>
              {
                data.summary
                  .submittedDispatchers
              }
            </strong>

            <span>
              הגישו
            </span>
          </div>
        </article>

        <article>
          <Clock3
            size={21}
            aria-hidden="true"
          />

          <div>
            <strong>
              {
                data.summary
                  .draftDispatchers
              }
            </strong>

            <span>
              בטיוטה
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
                data.summary
                  .notStartedDispatchers
              }
            </strong>

            <span>
              לא התחילו
            </span>
          </div>
        </article>
      </div>

      <div className="availability-submissions-list">
        {data.dispatchers.map(
          (dispatcher) => (
            <article
              key={dispatcher.userId}
              className="availability-submission-row"
            >
              <div className="availability-submission-user">
                <strong>
                  {dispatcher.displayName}
                </strong>

                <span>
                  {dispatcher.email}
                </span>

                {dispatcher.scheduleName ? (
                  <small>
                    שם בשיבוץ:{' '}
                    {dispatcher.scheduleName}
                  </small>
                ) : null}
              </div>

              <div className="availability-submission-status">
                <span
                  className={[
                    'availability-submission-status-badge',
                    `availability-submission-status-${dispatcher.status}`,
                  ].join(' ')}
                >
                  {
                    statusLabels[
                      dispatcher.status
                    ]
                  }
                </span>

                {dispatcher.submittedAt ? (
                  <small>
                    הוגש:{' '}
                    {formatDate(
                      dispatcher.submittedAt,
                    )}
                  </small>
                ) : dispatcher.lastSavedAt ? (
                  <small>
                    שמירה אחרונה:{' '}
                    {formatDate(
                      dispatcher.lastSavedAt,
                    )}
                  </small>
                ) : null}
              </div>

              <div className="availability-submission-counts">
                <span>
                  זמין:{' '}
                  <strong>
                    {
                      dispatcher
                        .availableCount
                    }
                  </strong>
                </span>

                <span>
                  לא זמין:{' '}
                  <strong>
                    {
                      dispatcher
                        .unavailableCount
                    }
                  </strong>
                </span>

                <span>
                  סומנו:{' '}
                  <strong>
                    {
                      dispatcher
                        .answeredCount
                    }
                    /
                    {
                      dispatcher
                        .totalShiftCount
                    }
                  </strong>
                </span>
              </div>

              <div className="availability-submission-progress">
                <div className="availability-submission-progress-header">
                  <span>
                    התקדמות
                  </span>

                  <strong>
                    {
                      dispatcher
                        .completionPercentage
                    }
                    %
                  </strong>
                </div>

                <div className="availability-submission-progress-track">
                  <div
                    className="availability-submission-progress-value"
                    style={{
                      width:
                        `${dispatcher.completionPercentage}%`,
                    }}
                  />
                </div>
              </div>
            </article>
          ),
        )}
      </div>
    </section>
  );
}

export default AvailabilitySubmissionsPanel;