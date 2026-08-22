import {
  BarChart3,
  CircleDashed,
  Clock3,
  LockKeyhole,
  RefreshCw,
  UserRoundCheck,
  UsersRound,
} from 'lucide-react';

import AvailabilityManagementHeader
  from './AvailabilityManagementHeader';

import AvailabilityManagementStats
  from './AvailabilityManagementStats';

import AvailabilityManagementActionBar
  from './AvailabilityManagementActionBar';
import { Button } from '../ui';
import type {
  AvailabilitySubmissionTrackingDispatcher,
  AvailabilityTrackingStatus,
} from '../../types/availabilitySubmissions';

interface AvailabilitySubmissionsPanelProps {
  isLoading: boolean;
  isClosing: boolean;
  canClose: boolean;
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
  onOpenMatrix: () => Promise<void>;
  onClosePeriod: () => Promise<void>;
  onReopenPeriod?: () => Promise<void>;
  onDeletePeriod?: () => Promise<void>;
  onPrepareSchedule?: () => Promise<void>;
  onGoToSchedule?: () => void;
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
  isClosing,
  canClose,
  error,
  data,
  onRefresh,
  onOpenMatrix,
  onClosePeriod,
  onReopenPeriod,
  onDeletePeriod,
  onPrepareSchedule,
  onGoToSchedule,
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
      <AvailabilityManagementHeader
        category="dispatcher"
        categoryLabel="מוקדנים"
        title={
          data.period.title ??
          `${data.period.month}/${data.period.year}`
        }
        description="מעקב אחר סטטוס ההגשות, זמינות למשמרות וכלי ניהול התקופה."
        periodId={
          data.period.id
        }
        periodStatus={
          data.period.status
        }
        submissionDeadline={
          data.period.submissionDeadline
        }
        isBusy={
          isLoading ||
          isClosing
        }
        error={error}
        onRefresh={
          onRefresh
        }
        actions={
          <>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                void onOpenMatrix();
              }}
            >
              <BarChart3
                size={17}
                aria-hidden="true"
              />

              מטריצת זמינות
            </Button>

            {data.period.status ===
            'open' ? (
              <Button
                type="button"
                disabled={
                  !canClose ||
                  isClosing
                }
                onClick={() => {
                  void onClosePeriod();
                }}
              >
                <LockKeyhole
                  size={17}
                  aria-hidden="true"
                />

                {isClosing
                  ? 'סוגר תקופה...'
                  : 'סגירת תקופה'}
              </Button>
            ) : null}

            <Button
              type="button"
              variant="secondary"
              onClick={
                onClose
              }
            >
              סגירה
            </Button>
          </>
        }
      />

      <AvailabilityManagementActionBar
        status={data.period.status}
        isBusy={
          isLoading ||
          isClosing
        }
        onClose={
          data.period.status === 'open' &&
          canClose
            ? () => {
                void onClosePeriod();
              }
            : null
        }
        onReopen={
          data.period.status === 'closed' &&
          onReopenPeriod
            ? () => {
                void onReopenPeriod();
              }
            : null
        }
        onDelete={
          onDeletePeriod
            ? () => {
                void onDeletePeriod();
              }
            : null
        }
        onPrepareSchedule={
          data.period.status === 'closed' &&
          onPrepareSchedule
            ? () => {
                void onPrepareSchedule();
              }
            : null
        }
        onGoToSchedule={
          onGoToSchedule ??
          null
        }
      />

      <AvailabilityManagementStats
        items={[
          {
            label:
              'מוקדנים פעילים',
            value:
              data.summary.totalDispatchers,
            icon:
              UsersRound,
          },
          {
            label:
              'הגישו',
            value:
              data.summary.submittedDispatchers,
            icon:
              UserRoundCheck,
          },
          {
            label:
              'בטיוטה',
            value:
              data.summary.draftDispatchers,
            icon:
              Clock3,
          },
          {
            label:
              'לא התחילו',
            value:
              data.summary.notStartedDispatchers,
            icon:
              CircleDashed,
          },
        ]}
      />

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