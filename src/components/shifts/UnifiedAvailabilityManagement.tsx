/**
 * קובץ: src/components/shifts/UnifiedAvailabilityManagement.tsx
 * מטרה: מימוש רכיב תצוגה ואינטראקציה עבור אילוצים וזמינות.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: UnifiedAvailabilityManagementProps, AvailabilityCategoryId, AvailabilityCategoryViewModel, getStatusLabel, getStatusClassName, formatDeadline, UnifiedAvailabilityManagement.
 * - קישור מאפיינים ומצב מקומי לתצוגה ולטיפול בפעולות המשתמש.
 */
import {
  ArrowLeft,
  CalendarClock,
  Car,
  Headphones,
  SunMedium,
  Users,
} from 'lucide-react';

import {
  useEffect,
  useMemo,
} from 'react';

import {
  useNavigate,
} from 'react-router-dom';

import {
  useAvailabilityPeriods,
} from '../../hooks/useAvailabilityPeriods';

import {
  useAvailabilityPeriodSubmissions,
} from '../../hooks/useAvailabilityPeriodSubmissions';

import {
  useDriverAvailabilityPeriods,
} from '../../hooks/useDriverAvailabilityPeriods';

import {
  useMorningDriverAvailabilityPeriods,
} from '../../hooks/useMorningDriverAvailabilityPeriods';

import {
  Button,
  Card,
  CardBody,
} from '../ui';

/**
 * חוזה הנתונים UnifiedAvailabilityManagementProps: אילוצים וזמינות / מאפייני הרכיב.
 */
interface UnifiedAvailabilityManagementProps {
  // year — שנה.
  year: number;

  // month — חודש.
  month: number;
}

/**
 * טיפוס AvailabilityCategoryId: אילוצים וזמינות / מזהה.
 */
type AvailabilityCategoryId =
  | 'dispatchers'
  | 'morning-drivers'
  | 'drivers';

/**
 * חוזה הנתונים AvailabilityCategoryViewModel: אילוצים וזמינות.
 */
interface AvailabilityCategoryViewModel {
  // id — מזהה.
  id:
    AvailabilityCategoryId;

  // title — כותרת.
  title: string;

  description: string;

  route: string;
  // periodId — מזהה התקופה.
  periodId: string | null;
  // actionLabel — תווית.
  actionLabel: string;
  
  icon:
    typeof Headphones;

  // className — שם.
  className: string;

  // status — סטטוס.
  status:
    string;

  // statusClassName — סטטוס / שם.
  statusClassName:
    string;

  deadline:
    string;

  submissions:
    string;

  // isLoading — האם טעינה מתבצעת.
  isLoading:
    boolean;

  // error — שגיאה.
  error:
    string | null;
}

// hebrewMonths — חודשים.
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

/**
 * פעולה getStatusLabel: שליפה או חישוב של סטטוס / תווית.
 * @param status — סטטוס.
 * @returns string — הפלט בהתאם לחתימה.
 */
function getStatusLabel(
  status:
    string | null,
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

    default:
      return 'לא נפתחה תקופה';
  }
}

/**
 * פעולה getStatusClassName: שליפה או חישוב של סטטוס / שם.
 * @param status — סטטוס.
 * @returns string — הפלט בהתאם לחתימה.
 */
function getStatusClassName(
  status:
    string | null,
): string {
  switch (
    status
  ) {
    case 'open':
      return 'unified-availability-status-open';

    case 'closed':
      return 'unified-availability-status-closed';

    case 'draft':
      return 'unified-availability-status-draft';

    case 'archived':
      return 'unified-availability-status-archived';

    default:
      return 'unified-availability-status-missing';
  }
}

/**
 * פעולה formatDeadline: עיצוב ערך לתצוגה עבור הנתון formatDeadline בהקשר הפעולה.
 * @param value — ערך.
 * @returns string — הפלט בהתאם לחתימה.
 */
function formatDeadline(
  value:
    string | null | undefined,
): string {
  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !value.
  if (
    !value
  ) {
    return 'לא נקבע';
  }

  // date — תאריך.
  const date =
    new Date(value);

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
      day:
        '2-digit',

      month:
        '2-digit',

      year:
        'numeric',

      hour:
        '2-digit',

      minute:
        '2-digit',

      hourCycle:
        'h23',

      timeZone:
        'Asia/Jerusalem',
    },
  ).format(date);
}



/**
 * פעולה UnifiedAvailabilityManagement: אילוצים וזמינות.
 * פרמטר מפורק — שדות הקלט נגישים מקומית בשמות המוגדרים בחתימה.
 */
function UnifiedAvailabilityManagement({
  year,
  month,
}: UnifiedAvailabilityManagementProps) {
  const navigate =
    useNavigate();
  const {state:dispatcherPeriodsState,} =
    useAvailabilityPeriods();

  const {
    state:
      dispatcherSubmissionsState,

    loadPeriodSubmissions,

    reset:
      resetDispatcherSubmissions,
  } =
    useAvailabilityPeriodSubmissions();

  const {
    state:
      driverPeriodsState,

    loadPeriods:
      loadDriverPeriods,
  } =
    useDriverAvailabilityPeriods();

  const {
    state:
      morningDriverPeriodsState,

    loadPeriods:
      loadMorningDriverPeriods,
  } =
    useMorningDriverAvailabilityPeriods();

  // תופעת לוואי לאחר רינדור בהתאם לתלויות [ loadDriverPeriods, loadMorningDriverPeriods, ].
  useEffect(
    () => {
      void Promise.all([
        loadDriverPeriods(),

        loadMorningDriverPeriods(),
      ]);
    },
    [
      loadDriverPeriods,
      loadMorningDriverPeriods,
    ],
  );

  // ערך מחושב dispatcherPeriod — מוקדנים / תקופה; נשמר בין רינדורים עד שינוי התלויות.
  const dispatcherPeriod =
    useMemo(
      () =>
        dispatcherPeriodsState
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
        dispatcherPeriodsState
          .periods,
        month,
        year,
      ],
    );

  // ערך מחושב driverPeriod — כוננים / תקופה; נשמר בין רינדורים עד שינוי התלויות.
  const driverPeriod =
    useMemo(
      () =>
        driverPeriodsState
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
        driverPeriodsState
          .periods,
        month,
        year,
      ],
    );

  // ערך מחושב morningDriverPeriod — כונני בוקר; נשמר בין רינדורים עד שינוי התלויות.
  const morningDriverPeriod =
    useMemo(
      () =>
        morningDriverPeriodsState
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
        morningDriverPeriodsState
          .periods,
        month,
        year,
      ],
    );

  // תופעת לוואי לאחר רינדור בהתאם לתלויות [ dispatcherPeriod, loadPeriodSubmissions, resetDispatcherSubmissions, ].
  useEffect(
    () => {
      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !dispatcherPeriod.
      if (
        !dispatcherPeriod
      ) {
        resetDispatcherSubmissions();

        return;
      }

      void loadPeriodSubmissions(
        dispatcherPeriod.id,
      );
    },
    [
      dispatcherPeriod,
      loadPeriodSubmissions,
      resetDispatcherSubmissions,
    ],
  );

  // dispatcherSubmissionSummary — מוקדנים / סיכום.
  const dispatcherSubmissionSummary =
    dispatcherSubmissionsState
      .data
      ?.summary ??
    null;

  // availabilityCategories — אילוצים וזמינות.
  const availabilityCategories:
    AvailabilityCategoryViewModel[] = [
      {
        id:
          'dispatchers',

        title:
          'אילוצי מוקדנים',

        description:
          'פתיחת תקופה, קביעת מועד אחרון להגשה ומעקב אחר הגשות המוקדנים.',

        route:
          '/availability',
        periodId: dispatcherPeriod ?.id ?? null,
        actionLabel:
          'ניהול אילוצי מוקדנים',

        icon:
          Headphones,

        className:
          'unified-availability-card-dispatchers',

        status:
          getStatusLabel(
            dispatcherPeriod
              ?.status ??
              null,
          ),

        statusClassName:
          getStatusClassName(
            dispatcherPeriod
              ?.status ??
              null,
          ),

        deadline:
          formatDeadline(
            dispatcherPeriod
              ?.submissionDeadline,
          ),

        submissions:
          dispatcherSubmissionSummary
            ? `${dispatcherSubmissionSummary.submittedDispatchers} מתוך ${dispatcherSubmissionSummary.totalDispatchers}`
            : dispatcherPeriod
              ? 'טוען נתוני הגשות...'
              : 'אין תקופה',

        isLoading:
          dispatcherPeriodsState
            .isLoading ||
          dispatcherSubmissionsState
            .isLoading,

        error:
          dispatcherPeriodsState
            .error ??
          dispatcherSubmissionsState
            .error,
      },

      {
        id:
          'morning-drivers',

        title:
          'אילוצי כונני בוקר',

        description:
          'פתיחת תקופה, קביעת דדליין ומעקב אחר הגשות כונני הבוקר.',

        route:
          '/morning-driver-availability',
        periodId: morningDriverPeriod ?.id ?? null,
        actionLabel:
          'ניהול אילוצי כונני בוקר',

        icon:
          SunMedium,

        className:
          'unified-availability-card-morning-drivers',

        status:
          getStatusLabel(
            morningDriverPeriod
              ?.status ??
              null,
          ),

        statusClassName:
          getStatusClassName(
            morningDriverPeriod
              ?.status ??
              null,
          ),

        deadline:
          formatDeadline(
            morningDriverPeriod
              ?.submissionDeadline,
          ),

        submissions:
          morningDriverPeriod
            ? `${morningDriverPeriod.submittedCount} מתוך ${morningDriverPeriod.submissionsCount}`
            : 'אין תקופה',

        isLoading:
          morningDriverPeriodsState
            .isLoading,

        error:
          morningDriverPeriodsState
            .error,
      },

      {
        id:
          'drivers',

        title:
          'אילוצי כוננים',

        description:
          'ניהול זמינות הכוננים ומעקב אחר ההגשות לפני יצירת לוח הכוננויות.',

        route:
          '/driver-schedule',
        periodId: driverPeriod ?.id ?? null,
        actionLabel:
          'ניהול אילוצי כוננים',

        icon:
          Car,

        className:
          'unified-availability-card-drivers',

        status:
          getStatusLabel(
            driverPeriod
              ?.status ??
              null,
          ),

        statusClassName:
          getStatusClassName(
            driverPeriod
              ?.status ??
              null,
          ),

        deadline:
          formatDeadline(
            driverPeriod
              ?.submissionDeadline,
          ),

        submissions:
          driverPeriod
            ? `${driverPeriod.submittedCount} מתוך ${driverPeriod.submissionsCount}`
            : 'אין תקופה',

        isLoading:
          driverPeriodsState
            .isLoading,

        error:
          driverPeriodsState
            .error,
      },
    ];

    /**
     * פעולה handleOpenCategory: טיפול באירוע עבור הנתון handleOpenCategory בהקשר הפעולה.
     * @param route — הנתון route בהקשר הפעולה.
     * @returns void — הפלט בהתאם לחתימה.
     */
    const handleOpenCategory =
      (
        route: string,
      ): void => {
        navigate(
          route,
        );
      };

    /**
     * פעולה handleOpenSubmissions: טיפול באירוע עבור הנתון handleOpenSubmissions בהקשר הפעולה.
     * @param route — הנתון route בהקשר הפעולה.
     * @param periodId — מזהה התקופה.
     * @returns void — הפלט בהתאם לחתימה.
     */
    const handleOpenSubmissions =
      (
        route: string,
        periodId: string,
      ): void => {
        const searchParameters =
          new URLSearchParams({
            tab:
              'submissions',

            periodId,

            returnTo:
              '/shifts?tab=availability',
          });

        navigate(
          `${route}?${searchParameters.toString()}`,
        );
      };
  return (
    <section className="unified-availability-management">
      <header className="unified-availability-header">
        <div>
          <h2>
            ניהול אילוצים
          </h2>

          <p>
            נתוני תקופות ההגשה עבור{' '}
            {
              hebrewMonths[
                month - 1
              ]
            }{' '}
            {year}.
          </p>
        </div>
      </header>

      <div className="unified-availability-grid">
        {availabilityCategories.map(
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
                  'unified-availability-card',

                  category.className,
                ].join(
                  ' ',
                )}
              >
                <CardBody>
                  <div className="unified-availability-card-content">
                    <div className="unified-availability-card-icon">
                      <Icon
                        size={
                          25
                        }
                        aria-hidden="true"
                      />
                    </div>

                    <div className="unified-availability-card-text">
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
                      className="unified-availability-card-error"
                      role="alert"
                    >
                      {
                        category.error
                      }
                    </div>
                  ) : null}

                  <dl className="unified-availability-card-details">
                    <div>
                      <dt>
                        סטטוס
                      </dt>

                      <dd>
                        <span
                          className={[
                            'unified-availability-status-badge',

                            category.statusClassName,
                          ].join(
                            ' ',
                          )}
                        >
                          {
                            category.isLoading
                              ? 'טוען...'
                              : category.status
                          }
                        </span>
                      </dd>
                    </div>

                    <div>
                      <dt>
                        <CalendarClock
                          size={
                            16
                          }
                          aria-hidden="true"
                        />

                        דדליין
                      </dt>

                      <dd>
                        {
                          category.isLoading
                            ? 'טוען...'
                            : category.deadline
                        }
                      </dd>
                    </div>

                    <div>
                      <dt>
                        <Users
                          size={
                            16
                          }
                          aria-hidden="true"
                        />

                        הגישו
                      </dt>

                      <dd>
                        {
                          category.isLoading
                            ? 'טוען...'
                            : category.submissions
                        }
                      </dd>
                    </div>
                  </dl>


              <div className="unified-availability-card-actions">
                <Button
                  type="button"
                  variant="primary"
                  className="unified-availability-card-action"
                  disabled={
                    !category.periodId
                  }
                  onClick={() => {
                    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !category.periodId.
                    if (
                      !category.periodId
                    ) {
                      return;
                    }

                    handleOpenSubmissions(
                      category.route,
                      category.periodId,
                    );
                  }}
                >
                  מעקב הגשות
                </Button>

                <Button
                  type="button"
                  variant="secondary"
                  className="unified-availability-card-action"
                  onClick={() =>
                    handleOpenCategory(
                      category.route,
                    )
                  }
                >
                  {
                    category.actionLabel
                  }

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
    </section>
  );
}

export default UnifiedAvailabilityManagement;