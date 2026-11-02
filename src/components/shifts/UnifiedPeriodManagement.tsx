/**
 * קובץ: src/components/shifts/UnifiedPeriodManagement.tsx
 * מטרה: מימוש רכיב תצוגה ואינטראקציה עבור תקופה.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: UnifiedPeriodManagementProps, PeriodCategoryId, PeriodCategoryViewModel, DispatcherScheduleState, getAvailabilityStatusLabel, getScheduleStatusLabel, getPublicationStatusLabel, getAvailabilityStatusClassName, getScheduleStatusClassName, getPublicationStatusClassName ועוד.
 * - קישור מאפיינים ומצב מקומי לתצוגה ולטיפול בפעולות המשתמש.
 */
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

/**
 * חוזה הנתונים UnifiedPeriodManagementProps: תקופה / מאפייני הרכיב.
 */
interface UnifiedPeriodManagementProps {
  // year — שנה.
  year: number;

  // month — חודש.
  month: number;
}

/**
 * טיפוס PeriodCategoryId: תקופה / מזהה.
 */
type PeriodCategoryId =
  | 'dispatchers'
  | 'morning-drivers'
  | 'drivers';

/**
 * חוזה הנתונים PeriodCategoryViewModel: תקופה.
 */
interface PeriodCategoryViewModel {
  // id — מזהה.
  id:
    PeriodCategoryId;

  // title — כותרת.
  title: string;

  description: string;

  route: string;

  icon:
    typeof Headphones;

  // className — שם.
  className: string;

  // workflow — תהליך עבודה.
  workflow:
    PeriodWorkflowState;

  // isLoading — האם טעינה מתבצעת.
  isLoading:
    boolean;

  // error — שגיאה.
  error:
    string | null;

  // createLabel — תווית.
  createLabel:
    string;

  // publishLabel — תווית.
  publishLabel:
    string;
}

/**
 * חוזה הנתונים DispatcherScheduleState: מוקדנים / שיבוץ / מצב.
 */
interface DispatcherScheduleState {
  // data — נתונים.
  data:
    DispatcherScheduleMonthData | null;

  // isLoading — האם טעינה מתבצעת.
  isLoading:
    boolean;

  // error — שגיאה.
  error:
    string | null;
}

// initialDispatcherScheduleState — מוקדנים / שיבוץ / מצב.
const initialDispatcherScheduleState:
  DispatcherScheduleState = {
    data:
      null,

    isLoading:
      false,

    error:
      null,
  };

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
 * פעולה getAvailabilityStatusLabel: שליפה או חישוב של מצב הזמינות.
 * @param status — סטטוס.
 * @returns string — הפלט בהתאם לחתימה.
 */
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

/**
 * פעולה getScheduleStatusLabel: שליפה או חישוב של שיבוץ / סטטוס / תווית.
 * @param status — סטטוס.
 * @returns string — הפלט בהתאם לחתימה.
 */
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

/**
 * פעולה getPublicationStatusLabel: שליפה או חישוב של סטטוס / תווית.
 * @param status — סטטוס.
 * @returns string — הפלט בהתאם לחתימה.
 */
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

/**
 * פעולה getAvailabilityStatusClassName: שליפה או חישוב של מצב הזמינות.
 * @param status — סטטוס.
 * @returns string — הפלט בהתאם לחתימה.
 */
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

/**
 * פעולה getScheduleStatusClassName: שליפה או חישוב של שיבוץ / סטטוס / שם.
 * @param status — סטטוס.
 * @returns string — הפלט בהתאם לחתימה.
 */
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

/**
 * פעולה getPublicationStatusClassName: שליפה או חישוב של סטטוס / שם.
 * @param status — סטטוס.
 * @returns string — הפלט בהתאם לחתימה.
 */
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

/**
 * פעולה getErrorMessage: שליפה או חישוב של הודעת שגיאה.
 * @param error — שגיאה.
 * @returns string — הפלט בהתאם לחתימה.
 */
function getErrorMessage(
  error: unknown,
): string {
  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר error instanceof Error.
  if (
    error instanceof Error
  ) {
    return error.message;
  }

  return 'אירעה שגיאה בטעינת מצב השיבוץ.';
}

/**
 * פעולה UnifiedPeriodManagement: תקופה.
 * פרמטר מפורק — שדות הקלט נגישים מקומית בשמות המוגדרים בחתימה.
 */
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

  // מצב מקומי: dispatcherScheduleState — מוקדנים / שיבוץ / מצב; setDispatcherScheduleState מעדכנת אותו ומפעילה רינדור לפי React.
  const [
    dispatcherScheduleState,
    setDispatcherScheduleState,
  ] =
    useState<DispatcherScheduleState>(
      initialDispatcherScheduleState,
    );

  // מצב מקומי: isDispatcherPublishing — מוקדנים; setIsDispatcherPublishing מעדכנת אותו ומפעילה רינדור לפי React.
  const [
    isDispatcherPublishing,
    setIsDispatcherPublishing,
  ] =
    useState(false);

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

    createDraft:
      createDriverScheduleDraft,

    publishSchedule:
      publishDriverSchedule,
  } =
    useDriverScheduleDraft();

  const {
    state:
      morningDriverScheduleState,

    loadSchedule:
      loadMorningDriverSchedule,

    createDraft:
      createMorningDriverScheduleDraft,

    publishSchedule:
      publishMorningDriverSchedule,
  } =
    useMorningDriverSchedule();

  // canViewDispatchers — האם צפייה מותרת.
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

  // canViewMorningDrivers — כונני בוקר.
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

  // canViewDrivers — האם צפייה מותרת.
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

  // canEditDispatcherSchedule — האם עריכה מותרת.
  const canEditDispatcherSchedule =
    hasPermission(
      'schedule.edit',
    );

  // canEditMorningDriverSchedule — כונני בוקר.
  const canEditMorningDriverSchedule =
    hasPermission(
      'morning_driver_schedule.edit',
    );

  // canEditDriverSchedule — האם עריכה מותרת.
  const canEditDriverSchedule =
    hasPermission(
      'driver_schedule.edit',
    );

  // תופעת לוואי לאחר רינדור בהתאם לתלויות [ canViewDispatchers, canViewDrivers, canViewMorningDrivers, loadDispatcherAvailabilityPeriods, loadDriverAvailabilityPeriods, loadDriverScheduleByMonth, loadMo.
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

  // תופעת לוואי לאחר רינדור בהתאם לתלויות [ canViewDispatchers, month, year, ].
  useEffect(
    () => {
      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !canViewDispatchers.
      if (
        !canViewDispatchers
      ) {
        return;
      }

      // isCancelled — הנתון isCancelled בהקשר הפעולה.
      let isCancelled =
        false;

      /**
       * פעולה אסינכרונית loadDispatcherSchedule: טעינת מוקדנים / שיבוץ.
       * @returns Promise<void> — הפלט בהתאם לחתימה.
       */
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

          // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
          try {
            // data — נתונים.
            const data =
              await scheduleService
                .getScheduleByMonth(
                  year,
                  month,
                );

            // טיפול במקרה מיוחד ויציאה מוקדמת כאשר isCancelled.
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
            // טיפול במקרה מיוחד ויציאה מוקדמת כאשר isCancelled.
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

  // ערך מחושב dispatcherAvailabilityPeriod — תקופת אילוצים; נשמר בין רינדורים עד שינוי התלויות.
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

  // ערך מחושב driverAvailabilityPeriod — תקופת אילוצים; נשמר בין רינדורים עד שינוי התלויות.
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

  // ערך מחושב morningDriverAvailabilityPeriod — תקופת אילוצים; נשמר בין רינדורים עד שינוי התלויות.
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

  // ערך מחושב dispatcherWorkflow — מוקדנים / תהליך עבודה; נשמר בין רינדורים עד שינוי התלויות.
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

  // ערך מחושב driverWorkflow — כוננים / תהליך עבודה; נשמר בין רינדורים עד שינוי התלויות.
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

  // ערך מחושב morningDriverWorkflow — כונני בוקר; נשמר בין רינדורים עד שינוי התלויות.
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

  // ערך מחושב periodCategories — תקופה; נשמר בין רינדורים עד שינוי התלויות.
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

  /**
   * פעולה handleOpenCategory: טיפול באירוע עבור הנתון handleOpenCategory בהקשר הפעולה.
   * @param route — הנתון route בהקשר הפעולה.
   * @returns void — הפלט בהתאם לחתימה.
   */
  const handleOpenCategory =
    (
      route: string,
    ): void => {
      const searchParams =
        new URLSearchParams({
          year:
            String(year),
          month:
            String(month),
        });

      navigate(
        `${route}?${searchParams.toString()}`,
      );
    };

  /**
   * פעולה אסינכרונית handleCreateSchedule: טיפול באירוע עבור שיבוץ.
   * @param category — הנתון category בהקשר הפעולה.
   * @returns Promise<void> — הפלט בהתאם לחתימה.
   */
  const handleCreateSchedule =
    async (
      category:
        PeriodCategoryViewModel,
    ): Promise<void> => {
      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !category.workflow .canCreateSchedule.
      if (
        !category.workflow
          .canCreateSchedule
      ) {
        window.alert(
          category.workflow
            .blockingReason ??
          'לא ניתן ליצור שיבוץ במצב התקופה הנוכחי.',
        );

        return;
      }

      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר category.id === 'dispatchers'.
      if (
        category.id ===
          'dispatchers'
      ) {
        // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !canEditDispatcherSchedule.
        if (
          !canEditDispatcherSchedule
        ) {
          window.alert(
            'אין לך הרשאה ליצור שיבוץ מוקדנים.',
          );

          return;
        }

        // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !dispatcherAvailabilityPeriod.
        if (
          !dispatcherAvailabilityPeriod
        ) {
          window.alert(
            'לא נמצאה תקופת אילוצים למוקדנים בחודש שנבחר.',
          );

          return;
        }

        navigate(
          `/availability?tab=schedule-preparation&periodId=${encodeURIComponent(
            dispatcherAvailabilityPeriod.id,
          )}&returnTo=${encodeURIComponent('/shifts')}`,
        );

        return;
      }

      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר category.id === 'morning-drivers'.
      if (
        category.id ===
          'morning-drivers'
      ) {
        // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !canEditMorningDriverSchedule.
        if (
          !canEditMorningDriverSchedule
        ) {
          window.alert(
            'אין לך הרשאה ליצור שיבוץ כונני בוקר.',
          );

          return;
        }

        // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !morningDriverAvailabilityPeriod.
        if (
          !morningDriverAvailabilityPeriod
        ) {
          window.alert(
            'לא נמצאה תקופת אילוצים לכונני בוקר בחודש שנבחר.',
          );

          return;
        }

        const confirmed =
          window.confirm(
            'ליצור טיוטת שיבוץ לכונני הבוקר עבור החודש שנבחר?',
          );

        // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !confirmed.
        if (!confirmed) {
          return;
        }

        // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
        try {
          await createMorningDriverScheduleDraft(
            morningDriverAvailabilityPeriod.id,
          );

          await loadMorningDriverSchedule(
            year,
            month,
          );
        } catch {
          /*
           * הודעת השגיאה נשמרת בתוך
           * useMorningDriverSchedule ומוצגת בכרטיס.
           */
        }

        return;
      }

      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !canEditDriverSchedule.
      if (
        !canEditDriverSchedule
      ) {
        window.alert(
          'אין לך הרשאה ליצור שיבוץ כוננים.',
        );

        return;
      }

      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !driverAvailabilityPeriod.
      if (
        !driverAvailabilityPeriod
      ) {
        window.alert(
          'לא נמצאה תקופת אילוצים לכוננים בחודש שנבחר.',
        );

        return;
      }

      const confirmed =
        window.confirm(
          'ליצור טיוטת לוח כוננים לפי מנגנון הרוטציה והאילוצים?',
        );

      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !confirmed.
      if (!confirmed) {
        return;
      }

      // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
      try {
        await createDriverScheduleDraft(
          driverAvailabilityPeriod.id,
        );

        await loadDriverScheduleByMonth(
          year,
          month,
        );
      } catch {
        /*
         * הודעת השגיאה נשמרת בתוך
         * useDriverScheduleDraft ומוצגת בכרטיס.
         */
      }
    };

  /**
   * פעולה אסינכרונית handlePublishSchedule: טיפול באירוע עבור שיבוץ.
   * @param category — הנתון category בהקשר הפעולה.
   * @returns Promise<void> — הפלט בהתאם לחתימה.
   */
  const handlePublishSchedule =
    async (
      category:
        PeriodCategoryViewModel,
    ): Promise<void> => {
      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר category.id === 'dispatchers'.
      if (
        category.id ===
          'dispatchers'
      ) {
        // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !canEditDispatcherSchedule.
        if (
          !canEditDispatcherSchedule
        ) {
          window.alert(
            'אין לך הרשאה לפרסם שיבוץ מוקדנים.',
          );

          return;
        }

        // period — תקופה.
        const period =
          dispatcherScheduleState
            .data
            ?.period ??
          null;

        // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !period || period.status !== 'draft' && period.status !== 'scheduling'.
        if (
          !period ||
          period.status !==
            'draft' &&
          period.status !==
            'scheduling'
        ) {
          window.alert(
            period?.status ===
              'published'
              ? 'שיבוץ המוקדנים כבר פורסם.'
              : 'ניתן לפרסם רק טיוטת שיבוץ מוקדנים שנשמרה.',
          );

          return;
        }

        // hasUnassignedShifts — משמרות.
        const hasUnassignedShifts =
          dispatcherScheduleState
            .data
            ?.shifts
            .some(
              (
                shift,
              ) =>
                !shift
                  .assignedUserId &&
                !shift
                  .isIntentionallyUnassigned,
            ) ??
          false;

        // טיפול במקרה מיוחד ויציאה מוקדמת כאשר hasUnassignedShifts.
        if (
          hasUnassignedShifts
        ) {
          window.alert(
            'יש לשבץ כל משמרת או לסמן אותה במפורש כמשמרת לא מאוישת לפני הפרסום.',
          );

          return;
        }

        const confirmed =
          window.confirm(
            `האם לפרסם את שיבוץ המוקדנים לחודש ${month}/${year}?\n\nלאחר הפרסום המוקדנים יוכלו לראות את המשמרות שלהם.`,
          );

        // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !confirmed.
        if (!confirmed) {
          return;
        }

        setIsDispatcherPublishing(
          true,
        );

        // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
        try {
          await scheduleService
            .publishSchedulePeriod(
              period.id,
            );

          // data — נתונים.
          const data =
            await scheduleService
              .getScheduleByMonth(
                year,
                month,
              );

          setDispatcherScheduleState({
            data,
            isLoading:
              false,
            error:
              null,
          });
        } catch (error) {
          setDispatcherScheduleState(
            (
              current,
            ) => ({
              ...current,
              error:
                getErrorMessage(
                  error,
                ),
            }),
          );
        } finally {
          setIsDispatcherPublishing(
            false,
          );
        }

        return;
      }

      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר category.id === 'morning-drivers'.
      if (
        category.id ===
          'morning-drivers'
      ) {
        // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !canEditMorningDriverSchedule.
        if (
          !canEditMorningDriverSchedule
        ) {
          window.alert(
            'אין לך הרשאה לפרסם שיבוץ כונני בוקר.',
          );

          return;
        }

        // scheduleData — שיבוץ / נתונים.
        const scheduleData =
          morningDriverScheduleState
            .data;

        // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !scheduleData || scheduleData.period .status !== 'draft'.
        if (
          !scheduleData ||
          scheduleData.period
            .status !==
            'draft'
        ) {
          window.alert(
            scheduleData?.period
              .status ===
              'published'
              ? 'לוח כונני הבוקר כבר פורסם.'
              : 'ניתן לפרסם רק טיוטת לוח כונני בוקר.',
          );

          return;
        }

        // טיפול במקרה מיוחד ויציאה מוקדמת כאשר scheduleData.statistics .minimumUnfilled > 0.
        if (
          scheduleData.statistics
            .minimumUnfilled >
          0
        ) {
          window.alert(
            'לא ניתן לפרסם עד שיוקצה לפחות כונן בוקר אחד לכל משמרת.',
          );

          return;
        }

        const recommendationWarnings =
          scheduleData.statistics
            .recommendationUnfilled;

        const confirmed =
          window.confirm(
            recommendationWarnings >
              0
              ? `עדיין חסרים ${recommendationWarnings} כוננים להשלמת ההמלצה במשמרות הבוקר.\n\nהמינימום הושלם ולכן ניתן לפרסם. להמשיך?`
              : 'האם לפרסם את לוח כונני הבוקר?',
          );

        // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !confirmed.
        if (!confirmed) {
          return;
        }

        // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
        try {
          await publishMorningDriverSchedule();
        } catch {
          /*
           * הודעת השגיאה נשמרת בתוך
           * useMorningDriverSchedule ומוצגת בכרטיס.
           */
        }

        return;
      }

      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !canEditDriverSchedule.
      if (
        !canEditDriverSchedule
      ) {
        window.alert(
          'אין לך הרשאה לפרסם את לוח הכוננים.',
        );

        return;
      }

      // scheduleData — שיבוץ / נתונים.
      const scheduleData =
        driverScheduleState
          .data;

      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !scheduleData || scheduleData.period ?.status !== 'draft'.
      if (
        !scheduleData ||
        scheduleData.period
          ?.status !==
          'draft'
      ) {
        window.alert(
          scheduleData?.period
            ?.status ===
            'published'
            ? 'לוח הכוננים כבר פורסם.'
            : 'ניתן לפרסם רק טיוטת לוח כוננים.',
        );

        return;
      }

      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר scheduleData.statistics .unassignedDays > 0.
      if (
        scheduleData.statistics
          .unassignedDays >
        0
      ) {
        window.alert(
          'יש לשבץ כונן בכל ימי החודש לפני הפרסום.',
        );

        return;
      }

      const confirmed =
        window.confirm(
          'האם לפרסם את לוח הכוננים?\n\nלאחר הפרסום הכוננים יוכלו לראות את הלוח שלהם.',
        );

      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !confirmed.
      if (!confirmed) {
        return;
      }

      // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
      try {
        await publishDriverSchedule();
      } catch {
        /*
         * הודעת השגיאה נשמרת בתוך
         * useDriverScheduleDraft ומוצגת בכרטיס.
         */
      }
    };

  /**
   * פעולה canCreateCategorySchedule: בדיקת אפשרות פעולה עבור שיבוץ.
   * @param category — הנתון category בהקשר הפעולה.
   * @returns boolean — הפלט בהתאם לחתימה.
   */
  const canCreateCategorySchedule =
    (
      category:
        PeriodCategoryViewModel,
    ): boolean => {
      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !category.workflow .canCreateSchedule.
      if (
        !category.workflow
          .canCreateSchedule
      ) {
        return false;
      }

      switch (
        category.id
      ) {
        case 'dispatchers':
          return canEditDispatcherSchedule;

        case 'morning-drivers':
          return (
            canEditMorningDriverSchedule &&
            !morningDriverScheduleState
              .isCreating
          );

        case 'drivers':
          return (
            canEditDriverSchedule &&
            !driverScheduleState
              .isCreating
          );

        default:
          return false;
      }
    };

  /**
   * פעולה canPublishCategorySchedule: בדיקת אפשרות פעולה עבור שיבוץ.
   * @param category — הנתון category בהקשר הפעולה.
   * @returns boolean — הפלט בהתאם לחתימה.
   */
  const canPublishCategorySchedule =
    (
      category:
        PeriodCategoryViewModel,
    ): boolean => {
      switch (
        category.id
      ) {
        case 'dispatchers':
          return (
            canEditDispatcherSchedule &&
            category.workflow
              .scheduleStatus ===
              'draft' &&
            !isDispatcherPublishing &&
            !(
              dispatcherScheduleState
                .data
                ?.shifts
                .some(
                  (
                    shift,
                  ) =>
                    !shift
                      .assignedUserId &&
                    !shift
                      .isIntentionallyUnassigned,
                ) ??
              false
            )
          );

        case 'morning-drivers':
          return (
            canEditMorningDriverSchedule &&
            morningDriverScheduleState
              .data
              ?.period
              .status ===
              'draft' &&
            (
              morningDriverScheduleState
                .data
                ?.statistics
                .minimumUnfilled ??
              1
            ) ===
              0 &&
            !morningDriverScheduleState
              .isPublishing
          );

        case 'drivers':
          return (
            canEditDriverSchedule &&
            driverScheduleState
              .data
              ?.period
              ?.status ===
              'draft' &&
            (
              driverScheduleState
                .data
                ?.statistics
                .unassignedDays ??
              1
            ) ===
              0 &&
            !driverScheduleState
              .isPublishing
          );

        default:
          return false;
      }
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
                          category.isLoading ||
                          !canCreateCategorySchedule(
                            category,
                          )
                        }
                        onClick={() => {
                          void handleCreateSchedule(
                            category,
                          );
                        }}
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
                          category.isLoading ||
                          !canPublishCategorySchedule(
                            category,
                          )
                        }
                        onClick={() => {
                          void handlePublishSchedule(
                            category,
                          );
                        }}
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