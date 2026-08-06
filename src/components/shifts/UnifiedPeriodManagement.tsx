import {
  ArrowLeft,
  CalendarCheck2,
  Car,
  Headphones,
  Send,
  SunMedium,
} from 'lucide-react';

import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  useNavigate,
} from 'react-router-dom';

import {
  useAuth,
} from '../../auth/AuthContext';

import {
  useAvailabilityPeriods,
} from '../../hooks/useAvailabilityPeriods';

import {
  useDriverAvailabilityPeriods,
} from '../../hooks/useDriverAvailabilityPeriods';

import {
  useDriverScheduleDraft,
} from '../../hooks/useDriverScheduleDraft';

import {
  useMorningDriverAvailabilityPeriods,
} from '../../hooks/useMorningDriverAvailabilityPeriods';

import {
  useMorningDriverSchedule,
} from '../../hooks/useMorningDriverSchedule';

import {
  scheduleService,
} from '../../services/scheduleService';

import {
  createDispatcherWorkflowState,
  createDriverWorkflowState,
  createMorningDriverWorkflowState,
} from '../../features/shifts/utils/periodWorkflowAdapters';

import type {
  PeriodWorkflowState,
  WorkflowAvailabilityStatus,
  WorkflowPublicationStatus,
  WorkflowScheduleStatus,
} from '../../features/shifts/utils/periodWorkflow';

import type {
  DispatcherScheduleMonthData,
} from '../../types/unifiedSchedule';

import {
  Button,
  Card,
  CardBody,
} from '../ui';

interface UnifiedPeriodManagementProps {
  year: number;

  month: number;
}

type PeriodCategoryId =
  | 'dispatchers'
  | 'morning-drivers'
  | 'drivers';

interface PeriodCategoryViewModel {
  id:
    PeriodCategoryId;

  title: string;

  description: string;

  route: string;

  icon:
    typeof Headphones;

  className: string;

  workflow:
    PeriodWorkflowState;

  isLoading:
    boolean;

  error:
    string | null;

  createLabel:
    string;

  publishLabel:
    string;
}

interface DispatcherScheduleState {
  data:
    DispatcherScheduleMonthData | null;

  isLoading:
    boolean;

  error:
    string | null;
}

const initialDispatcherScheduleState:
  DispatcherScheduleState = {
    data:
      null,

    isLoading:
      false,

    error:
      null,
  };

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

function getAvailabilityStatusLabel(
  status:
    WorkflowAvailabilityStatus,
): string {
  switch (
    status
  ) {
    case 'draft':
      return 'טיוטה';

    case 'open':
      return 'פתוח להגשה';

    case 'closed':
      return 'סגור';

    case 'archived':
      return 'בארכיון';

    case 'missing':
    default:
      return 'לא נוצרה תקופה';
  }
}

function getScheduleStatusLabel(
  status:
    WorkflowScheduleStatus,
): string {
  switch (
    status
  ) {
    case 'draft':
      return 'טיוטה';

    case 'published':
      return 'פורסם';

    case 'archived':
      return 'בארכיון';

    case 'missing':
    default:
      return 'טרם נוצר';
  }
}

function getPublicationStatusLabel(
  status:
    WorkflowPublicationStatus,
): string {
  switch (
    status
  ) {
    case 'published':
      return 'פורסם';

    case 'archived':
      return 'בארכיון';

    case 'notPublished':
    default:
      return 'טרם פורסם';
  }
}

function getAvailabilityStatusClassName(
  status:
    WorkflowAvailabilityStatus,
): string {
  switch (
    status
  ) {
    case 'open':
      return 'unified-period-status-open';

    case 'closed':
      return 'unified-period-status-ready';

    case 'draft':
      return 'unified-period-status-draft';

    case 'archived':
      return 'unified-period-status-archived';

    case 'missing':
    default:
      return 'unified-period-status-missing';
  }
}

function getScheduleStatusClassName(
  status:
    WorkflowScheduleStatus,
): string {
  switch (
    status
  ) {
    case 'published':
      return 'unified-period-status-ready';

    case 'draft':
      return 'unified-period-status-draft';

    case 'archived':
      return 'unified-period-status-archived';

    case 'missing':
    default:
      return 'unified-period-status-missing';
  }
}

function getPublicationStatusClassName(
  status:
    WorkflowPublicationStatus,
): string {
  switch (
    status
  ) {
    case 'published':
      return 'unified-period-status-ready';

    case 'archived':
      return 'unified-period-status-archived';

    case 'notPublished':
    default:
      return 'unified-period-status-missing';
  }
}

function getErrorMessage(
  error: unknown,
): string {
  if (
    error instanceof Error
  ) {
    return error.message;
  }

  return 'אירעה שגיאה בטעינת מצב השיבוץ.';
}

function UnifiedPeriodManagement({
  year,
  month,
}: UnifiedPeriodManagementProps) {
  const navigate =
    useNavigate();

  const {
    hasPermission,
  } =
    useAuth();

  const [
    dispatcherScheduleState,
    setDispatcherScheduleState,
  ] =
    useState<DispatcherScheduleState>(
      initialDispatcherScheduleState,
    );

  const {
    state:
      dispatcherAvailabilityState,

    loadPeriods:
      loadDispatcherAvailabilityPeriods,
  } =
    useAvailabilityPeriods();

  const {
    state:
      driverAvailabilityState,

    loadPeriods:
      loadDriverAvailabilityPeriods,
  } =
    useDriverAvailabilityPeriods();

  const {
    state:
      morningDriverAvailabilityState,

    loadPeriods:
      loadMorningDriverAvailabilityPeriods,
  } =
    useMorningDriverAvailabilityPeriods();

  const {
    state:
      driverScheduleState,

    loadScheduleByMonth:
      loadDriverScheduleByMonth,
  } =
    useDriverScheduleDraft();

  const {
    state:
      morningDriverScheduleState,

    loadSchedule:
      loadMorningDriverSchedule,
  } =
    useMorningDriverSchedule();

  const canViewDispatchers =
    hasPermission(
      'availability.manage',
    ) ||
    hasPermission(
      'schedule.view',
    ) ||
    hasPermission(
      'schedule.edit',
    );

  const canViewMorningDrivers =
    hasPermission(
      'morning_driver_availability.manage',
    ) ||
    hasPermission(
      'morning_driver_schedule.view_team',
    ) ||
    hasPermission(
      'morning_driver_schedule.edit',
    );

  const canViewDrivers =
    hasPermission(
      'driver_availability.manage',
    ) ||
    hasPermission(
      'driver_schedule.view_team',
    ) ||
    hasPermission(
      'driver_schedule.edit',
    );

  useEffect(
    () => {
      if (
        canViewDispatchers
      ) {
        void loadDispatcherAvailabilityPeriods();
      }

      if (
        canViewDrivers
      ) {
        void loadDriverAvailabilityPeriods();

        void loadDriverScheduleByMonth(
          year,
          month,
        );
      }

      if (
        canViewMorningDrivers
      ) {
        void loadMorningDriverAvailabilityPeriods();

        void loadMorningDriverSchedule(
          year,
          month,
        );
      }
    },
    [
      canViewDispatchers,
      canViewDrivers,
      canViewMorningDrivers,
      loadDispatcherAvailabilityPeriods,
      loadDriverAvailabilityPeriods,
      loadDriverScheduleByMonth,
      loadMorningDriverAvailabilityPeriods,
      loadMorningDriverSchedule,
      month,
      year,
    ],
  );

  useEffect(
    () => {
      if (
        !canViewDispatchers
      ) {
        return;
      }

      let isCancelled =
        false;

      const loadDispatcherSchedule =
        async (): Promise<void> => {
          setDispatcherScheduleState({
            data:
              null,

            isLoading:
              true,

            error:
              null,
          });

          try {
            const data =
              await scheduleService
                .getScheduleByMonth(
                  year,
                  month,
                );

            if (
              isCancelled
            ) {
              return;
            }

            setDispatcherScheduleState({
              data,

              isLoading:
                false,

              error:
                null,
            });
          } catch (
            error
          ) {
            if (
              isCancelled
            ) {
              return;
            }

            setDispatcherScheduleState({
              data:
                null,

              isLoading:
                false,

              error:
                getErrorMessage(
                  error,
                ),
            });
          }
        };

      void loadDispatcherSchedule();

      return () => {
        isCancelled =
          true;
      };
    },
    [
      canViewDispatchers,
      month,
      year,
    ],
  );

  const dispatcherAvailabilityPeriod =
    useMemo(
      () =>
        dispatcherAvailabilityState
          .periods
          .find(
            (
              period,
            ) =>
              period.year ===
                year &&
              period.month ===
                month,
          ) ??
        null,
      [
        dispatcherAvailabilityState
          .periods,
        month,
        year,
      ],
    );

  const driverAvailabilityPeriod =
    useMemo(
      () =>
        driverAvailabilityState
          .periods
          .find(
            (
              period,
            ) =>
              period.year ===
                year &&
              period.month ===
                month,
          ) ??
        null,
      [
        driverAvailabilityState
          .periods,
        month,
        year,
      ],
    );

  const morningDriverAvailabilityPeriod =
    useMemo(
      () =>
        morningDriverAvailabilityState
          .periods
          .find(
            (
              period,
            ) =>
              period.year ===
                year &&
              period.month ===
                month,
          ) ??
        null,
      [
        morningDriverAvailabilityState
          .periods,
        month,
        year,
      ],
    );

  const dispatcherWorkflow =
    useMemo(
      () =>
        createDispatcherWorkflowState({
          availabilityPeriod:
            dispatcherAvailabilityPeriod,

          schedulePeriod:
            dispatcherScheduleState
              .data
              ?.period ??
            null,

          shifts:
            dispatcherScheduleState
              .data
              ?.shifts ??
            [],
        }),
      [
        dispatcherAvailabilityPeriod,
        dispatcherScheduleState
          .data,
      ],
    );

  const driverWorkflow =
    useMemo(
      () =>
        createDriverWorkflowState({
          availabilityPeriod:
            driverAvailabilityPeriod,

          schedulePeriod:
            driverScheduleState
              .data
              ?.period ??
            null,

          statistics:
            driverScheduleState
              .data
              ?.statistics ??
            null,
        }),
      [
        driverAvailabilityPeriod,
        driverScheduleState
          .data,
      ],
    );

  const morningDriverWorkflow =
    useMemo(
      () =>
        createMorningDriverWorkflowState({
          availabilityPeriod:
            morningDriverAvailabilityPeriod,

          schedulePeriod:
            morningDriverScheduleState
              .data
              ?.period ??
            null,

          statistics:
            morningDriverScheduleState
              .data
              ?.statistics ??
            null,
        }),
      [
        morningDriverAvailabilityPeriod,
        morningDriverScheduleState
          .data,
      ],
    );

  const periodCategories =
    useMemo(
      (): PeriodCategoryViewModel[] => {
        const categories:
          PeriodCategoryViewModel[] = [];

        if (
          canViewDispatchers
        ) {
          categories.push({
            id:
              'dispatchers',

            title:
              'שיבוץ מוקדנים',

            description:
              'יצירת שיבוץ חודשי למוקדנים, בדיקת השיבוץ ופרסומו.',

            route:
              '/schedule',

            icon:
              Headphones,

            className:
              'unified-period-card-dispatchers',

            workflow:
              dispatcherWorkflow,

            isLoading:
              dispatcherAvailabilityState
                .isLoading ||
              dispatcherScheduleState
                .isLoading,

            error:
              dispatcherAvailabilityState
                .error ??
              dispatcherScheduleState
                .error,

            createLabel:
              'יצירת שיבוץ מוקדנים',

            publishLabel:
              'פרסום שיבוץ מוקדנים',
          });
        }

        if (
          canViewMorningDrivers
        ) {
          categories.push({
            id:
              'morning-drivers',

            title:
              'שיבוץ כונני בוקר',

            description:
              'יצירת לוח כונני בוקר, בדיקת הכיסוי ופרסום הלוח.',

            route:
              '/morning-driver-schedule',

            icon:
              SunMedium,

            className:
              'unified-period-card-morning-drivers',

            workflow:
              morningDriverWorkflow,

            isLoading:
              morningDriverAvailabilityState
                .isLoading ||
              morningDriverScheduleState
                .isLoading,

            error:
              morningDriverAvailabilityState
                .error ??
              morningDriverScheduleState
                .error,

            createLabel:
              'יצירת שיבוץ כונני בוקר',

            publishLabel:
              'פרסום שיבוץ כונני בוקר',
          });
        }

        if (
          canViewDrivers
        ) {
          categories.push({
            id:
              'drivers',

            title:
              'שיבוץ כוננים',

            description:
              'יצירת לוח כוננויות חודשי, עריכת השיבוץ ופרסומו.',

            route:
              '/driver-schedule',

            icon:
              Car,

            className:
              'unified-period-card-drivers',

            workflow:
              driverWorkflow,

            isLoading:
              driverAvailabilityState
                .isLoading ||
              driverScheduleState
                .isLoading,

            error:
              driverAvailabilityState
                .error ??
              driverScheduleState
                .error,

            createLabel:
              'יצירת שיבוץ כוננים',

            publishLabel:
              'פרסום שיבוץ כוננים',
          });
        }

        return categories;
      },
      [
        canViewDispatchers,
        canViewDrivers,
        canViewMorningDrivers,
        dispatcherAvailabilityState
          .error,
        dispatcherAvailabilityState
          .isLoading,
        dispatcherScheduleState
          .error,
        dispatcherScheduleState
          .isLoading,
        dispatcherWorkflow,
        driverAvailabilityState
          .error,
        driverAvailabilityState
          .isLoading,
        driverScheduleState
          .error,
        driverScheduleState
          .isLoading,
        driverWorkflow,
        morningDriverAvailabilityState
          .error,
        morningDriverAvailabilityState
          .isLoading,
        morningDriverScheduleState
          .error,
        morningDriverScheduleState
          .isLoading,
        morningDriverWorkflow,
      ],
    );

  const handleOpenCategory =
    (
      route: string,
    ): void => {
      navigate(
        route,
      );
    };

  const handlePendingAction =
    (
      actionLabel: string,
    ): void => {
      window.alert(
        `${actionLabel} יחובר בשלב הבא למנגנון הקיים.`,
      );
    };

  return (
    <section className="unified-period-management">
      <header className="unified-period-header">
        <div>
          <h2>
            ניהול תקופה
          </h2>

          <p>
            יצירה ופרסום שיבוצים עבור{' '}
            {
              hebrewMonths[
                month - 1
              ]
            }{' '}
            {year}.
          </p>
        </div>
      </header>

      {periodCategories.length ===
      0 ? (
        <Card>
          <CardBody>
            <div className="unified-period-empty">
              אין לך הרשאה לצפות או לנהל תהליכי שיבוץ.
            </div>
          </CardBody>
        </Card>
      ) : (
        <div className="unified-period-grid">
          {periodCategories.map(
            (
              category,
            ) => {
              const Icon =
                category.icon;

              return (
                <Card
                  key={
                    category.id
                  }
                  className={[
                    'unified-period-card',

                    category.className,
                  ].join(
                    ' ',
                  )}
                >
                  <CardBody>
                    <div className="unified-period-card-heading">
                      <div className="unified-period-card-icon">
                        <Icon
                          size={
                            25
                          }
                          aria-hidden="true"
                        />
                      </div>

                      <div>
                        <h3>
                          {
                            category.title
                          }
                        </h3>

                        <p>
                          {
                            category.description
                          }
                        </p>
                      </div>
                    </div>

                    {category.error ? (
                      <div
                        className="unified-period-error"
                        role="alert"
                      >
                        {
                          category.error
                        }
                      </div>
                    ) : null}

                    <dl className="unified-period-card-status">
                      <div>
                        <dt>
                          מצב אילוצים
                        </dt>

                        <dd>
                          <span
                            className={[
                              'unified-period-status-badge',

                              getAvailabilityStatusClassName(
                                category.workflow
                                  .availabilityStatus,
                              ),
                            ].join(
                              ' ',
                            )}
                          >
                            {
                              category.isLoading
                                ? 'טוען...'
                                : getAvailabilityStatusLabel(
                                    category.workflow
                                      .availabilityStatus,
                                  )
                            }
                          </span>
                        </dd>
                      </div>

                      <div>
                        <dt>
                          מצב שיבוץ
                        </dt>

                        <dd>
                          <span
                            className={[
                              'unified-period-status-badge',

                              getScheduleStatusClassName(
                                category.workflow
                                  .scheduleStatus,
                              ),
                            ].join(
                              ' ',
                            )}
                          >
                            {
                              category.isLoading
                                ? 'טוען...'
                                : getScheduleStatusLabel(
                                    category.workflow
                                      .scheduleStatus,
                                  )
                            }
                          </span>
                        </dd>
                      </div>

                      <div>
                        <dt>
                          מצב פרסום
                        </dt>

                        <dd>
                          <span
                            className={[
                              'unified-period-status-badge',

                              getPublicationStatusClassName(
                                category.workflow
                                  .publicationStatus,
                              ),
                            ].join(
                              ' ',
                            )}
                          >
                            {
                              category.isLoading
                                ? 'טוען...'
                                : getPublicationStatusLabel(
                                    category.workflow
                                      .publicationStatus,
                                  )
                            }
                          </span>
                        </dd>
                      </div>
                    </dl>

                    {!category.isLoading ? (
                      <div className="unified-period-recommendation">
                        <strong>
                          הפעולה הבאה המומלצת
                        </strong>

                        <span>
                          {
                            category.workflow
                              .recommendation
                          }
                        </span>

                        {category.workflow
                          .blockingReason ? (
                          <small>
                            {
                              category.workflow
                                .blockingReason
                            }
                          </small>
                        ) : null}
                      </div>
                    ) : null}

                    <div className="unified-period-card-actions">
                      <Button
                        type="button"
                        variant="primary"
                        disabled={
                          category.isLoading
                        }
                        onClick={() =>
                          handlePendingAction(
                            category.createLabel,
                          )
                        }
                      >
                        <CalendarCheck2
                          size={
                            17
                          }
                          aria-hidden="true"
                        />

                        {
                          category.createLabel
                        }
                      </Button>

                      <Button
                        type="button"
                        variant="secondary"
                        disabled={
                          category.isLoading
                        }
                        onClick={() =>
                          handlePendingAction(
                            category.publishLabel,
                          )
                        }
                      >
                        <Send
                          size={
                            17
                          }
                          aria-hidden="true"
                        />

                        {
                          category.publishLabel
                        }
                      </Button>

                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() =>
                          handleOpenCategory(
                            category.route,
                          )
                        }
                      >
                        פתיחת המסך המלא

                        <ArrowLeft
                          size={
                            17
                          }
                          aria-hidden="true"
                        />
                      </Button>
                    </div>
                  </CardBody>
                </Card>
              );
            },
          )}
        </div>
      )}
    </section>
  );
}

export default UnifiedPeriodManagement;