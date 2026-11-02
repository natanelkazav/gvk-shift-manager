/**
 * קובץ: src/pages/LegacyShiftsPage.tsx
 * מטרה: מימוש מסך המשתמש עבור משמרות.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: ShiftsWorkspaceTab, UnifiedScheduleDisplayMode, ShiftsWorkspaceTabDefinition, getCurrentMonth, getPreviousMonth, getNextMonth, formatEntryTime, formatDate, getEntryDisplayName, LegacyShiftsPage.
 * - קישור מאפיינים ומצב מקומי לתצוגה ולטיפול בפעולות המשתמש.
 */
import {
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  LayoutList,
  Pencil,
  Settings2,
} from 'lucide-react';

import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import UnifiedAvailabilityManagement
  from '../components/shifts/UnifiedAvailabilityManagement';

import UnifiedPeriodManagement
  from '../components/shifts/UnifiedPeriodManagement';

import UnifiedScheduleEntryEditModal, {
  type UnifiedScheduleEditUser,
} from '../components/shifts/UnifiedScheduleEntryEditModal';

import MonthCalendar, {
  type MonthCalendarDayContext,
} from '../components/calendar/MonthCalendar';
import {
  useSearchParams,
} from 'react-router-dom';
import {
  Button,
  Card,
  CardBody,
  Modal,
  PageHeader,
} from '../components/ui';

import {
  useUnifiedSchedule,
} from '../hooks/useUnifiedSchedule';

import {
  useAuth,
} from '../auth/AuthContext';

import {
  scheduleService,
} from '../services/scheduleService';

import {
  driverScheduleService,
} from '../services/driverScheduleService';

import {
  morningDriverScheduleService,
} from '../services/morningDriverScheduleService';

import {
  unifiedScheduleEditService,
} from '../services/unifiedScheduleEditService';

import type {
  UnifiedScheduleCategory,
  UnifiedScheduleEntry,
  UnifiedScheduleFilters,
} from '../types/unifiedSchedule';

import '../styles/shifts.css';

/**
 * טיפוס ShiftsWorkspaceTab: משמרות.
 */
type ShiftsWorkspaceTab =
  | 'calendar'
  | 'availability'
  | 'period-management';

/**
 * טיפוס UnifiedScheduleDisplayMode: שיבוץ / מצב פעולה.
 */
type UnifiedScheduleDisplayMode =
  | 'calendar'
  | 'list';

/**
 * חוזה הנתונים ShiftsWorkspaceTabDefinition: משמרות.
 */
interface ShiftsWorkspaceTabDefinition {
  // id — מזהה.
  id: ShiftsWorkspaceTab;

  // label — תווית.
  label: string;

  description: string;

  icon: typeof CalendarDays;
}

// workspaceTabs — הנתון workspaceTabs בהקשר הפעולה.
const workspaceTabs:
  ShiftsWorkspaceTabDefinition[] = [
    {
      id: 'calendar',

      label: 'לוח משמרות',

      description:
        'צפייה מאוחדת בשיבוצי מוקדנים, כונני בוקר וכוננים.',

      icon: CalendarDays,
    },

    {
      id: 'availability',

      label: 'אילוצים',

      description:
        'פתיחת תקופות אילוצים ומעקב אחר הגשות.',

      icon: ClipboardList,
    },

    {
      id: 'period-management',

      label: 'ניהול תקופה',

      description:
        'יצירת שיבוצים, בדיקתם ופרסומם.',

      icon: Settings2,
    },
  ];

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

// categoryLabels — הנתון categoryLabels בהקשר הפעולה.
const categoryLabels:
  Record<
    UnifiedScheduleCategory,
    string
  > = {
    dispatcher:
      'מוקדן',

    morning_driver:
      'כונן בוקר',

    on_call:
      'כונן',
  };

// filterDefinitions — סינון.
const filterDefinitions: Array<{
  // key — מפתח.
  key:
    keyof UnifiedScheduleFilters;

  category:
    UnifiedScheduleCategory;

  // label — תווית.
  label:
    string;
}> = [
  {
    key: 'dispatcher',

    category:
      'dispatcher',

    label:
      'מוקדנים',
  },

  {
    key:
      'morningDriver',

    category:
      'morning_driver',

    label:
      'כונני בוקר',
  },

  {
    key:
      'onCall',

    category:
      'on_call',

    label:
      'כוננים',
  },
];

// maximumVisibleEntriesPerDay — רשומות / יום.
const maximumVisibleEntriesPerDay =
  3;

/**
 * פעולה getCurrentMonth: שליפה או חישוב של חודש.
 * @returns { year: number; month: number; } — הפלט בהתאם לחתימה.
 */
function getCurrentMonth(): {
  // year — שנה.
  year: number;

  // month — חודש.
  month: number;
} {
  // currentDate — תאריך.
  const currentDate =
    new Date();

  return {
    year:
      currentDate.getFullYear(),

    month:
      currentDate.getMonth() +
      1,
  };
}

/**
 * פעולה getPreviousMonth: שליפה או חישוב של חודש.
 * @param year — שנה.
 * @param month — חודש.
 * @returns { year: number; month: number; } — הפלט בהתאם לחתימה.
 */
function getPreviousMonth(
  year: number,
  month: number,
): {
  // year — שנה.
  year: number;

  // month — חודש.
  month: number;
} {
  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר month === 1.
  if (
    month === 1
  ) {
    return {
      year:
        year - 1,

      month:
        12,
    };
  }

  return {
    year,

    month:
      month - 1,
  };
}

/**
 * פעולה getNextMonth: שליפה או חישוב של חודש.
 * @param year — שנה.
 * @param month — חודש.
 * @returns { year: number; month: number; } — הפלט בהתאם לחתימה.
 */
function getNextMonth(
  year: number,
  month: number,
): {
  // year — שנה.
  year: number;

  // month — חודש.
  month: number;
} {
  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר month === 12.
  if (
    month === 12
  ) {
    return {
      year:
        year + 1,

      month:
        1,
    };
  }

  return {
    year,

    month:
      month + 1,
  };
}

/**
 * פעולה formatEntryTime: עיצוב ערך לתצוגה עבור רשומה / זמן.
 * @param entry — רשומה.
 * @returns string | null — הפלט בהתאם לחתימה.
 */
function formatEntryTime(
  entry:
    UnifiedScheduleEntry,
): string | null {
  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !entry.startTime && !entry.endTime.
  if (
    !entry.startTime &&
    !entry.endTime
  ) {
    return null;
  }

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר entry.startTime && entry.endTime.
  if (
    entry.startTime &&
    entry.endTime
  ) {
    return (
      `${entry.startTime}–` +
      `${entry.endTime}`
    );
  }

  return (
    entry.startTime ??
    entry.endTime
  );
}

/**
 * פעולה formatDate: עיצוב ערך לתצוגה עבור תאריך.
 * @param dateValue — תאריך / ערך.
 * @returns string — הפלט בהתאם לחתימה.
 */
function formatDate(
  dateValue: string,
): string {
  // date — תאריך.
  const date =
    new Date(
      `${dateValue}T12:00:00`,
    );

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר Number.isNaN( date.getTime(), ).
  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return dateValue;
  }

  return new Intl.DateTimeFormat(
    'he-IL',
    {
      weekday:
        'long',

      day:
        '2-digit',

      month:
        '2-digit',

      year:
        'numeric',

      timeZone:
        'Asia/Jerusalem',
    },
  ).format(date);
}

/**
 * פעולה getEntryDisplayName: שליפה או חישוב של שם תצוגה.
 * @param entry — רשומה.
 * @returns string — הפלט בהתאם לחתימה.
 */
function getEntryDisplayName(
  entry:
    UnifiedScheduleEntry,
): string {
  return (
    entry.assignedUserName ??
    'לא משובץ'
  );
}

/**
 * פעולה LegacyShiftsPage: משמרות.
 */
function LegacyShiftsPage() {
  const {
    hasPermission,
  } =
    useAuth();

  // ערך מחושב initialMonth — חודש; נשמר בין רינדורים עד שינוי התלויות.
  const initialMonth =
    useMemo(
      () =>
        getCurrentMonth(),
      [],
    );
// ערך מחושב initialPlanningMonth — חודש; נשמר בין רינדורים עד שינוי התלויות.
const initialPlanningMonth =
  useMemo(
    () =>
      getNextMonth(
        initialMonth.year,
        initialMonth.month,
      ),
    [
      initialMonth.month,
      initialMonth.year,
    ],
  );

const [
  searchParams,
  setSearchParams,
] =
  useSearchParams();

const requestedWorkspaceTab =
  searchParams.get(
    'tab',
  );

const initialWorkspaceTab:
  ShiftsWorkspaceTab =
    requestedWorkspaceTab ===
      'availability' ||
    requestedWorkspaceTab ===
      'period-management' ||
    requestedWorkspaceTab ===
      'calendar'
      ? requestedWorkspaceTab
      : 'calendar';
  // מצב מקומי: displayedYear — שנה; setDisplayedYear מעדכנת אותו ומפעילה רינדור לפי React.
  const [
    displayedYear,
    setDisplayedYear,
  ] =
    useState(
      initialMonth.year,
    );
// מצב מקומי: activeTab — פעיל; setActiveTab מעדכנת אותו ומפעילה רינדור לפי React.
const [
  activeTab,
  setActiveTab,
] =
  useState<ShiftsWorkspaceTab>(
    initialWorkspaceTab,
  );
  // מצב מקומי: displayedMonth — חודש; setDisplayedMonth מעדכנת אותו ומפעילה רינדור לפי React.
  const [
    displayedMonth,
    setDisplayedMonth,
  ] =
    useState(
      initialMonth.month,
    );

    // מצב מקומי: planningYear — שנה; setPlanningYear מעדכנת אותו ומפעילה רינדור לפי React.
    const [
  planningYear,
  setPlanningYear,
] =
  useState(
    initialPlanningMonth.year,
  );

// מצב מקומי: planningMonth — חודש; setPlanningMonth מעדכנת אותו ומפעילה רינדור לפי React.
const [
  planningMonth,
  setPlanningMonth,
] =
  useState(
    initialPlanningMonth.month,
  );

  // מצב מקומי: selectedDate — נבחר / תאריך; setSelectedDate מעדכנת אותו ומפעילה רינדור לפי React.
  const [
    selectedDate,
    setSelectedDate,
  ] =
    useState<
      string | null
    >(
      null,
    );

  // מצב מקומי: scheduleDisplayMode — שיבוץ / מצב פעולה; setScheduleDisplayMode מעדכנת אותו ומפעילה רינדור לפי React.
  const [
    scheduleDisplayMode,
    setScheduleDisplayMode,
  ] =
    useState<UnifiedScheduleDisplayMode>(
      'calendar',
    );

  // מצב מקומי: editingEntry — רשומה; setEditingEntry מעדכנת אותו ומפעילה רינדור לפי React.
  const [
    editingEntry,
    setEditingEntry,
  ] =
    useState<UnifiedScheduleEntry | null>(
      null,
    );

  // מצב מקומי: editUsers — משתמשים; setEditUsers מעדכנת אותו ומפעילה רינדור לפי React.
  const [
    editUsers,
    setEditUsers,
  ] =
    useState<UnifiedScheduleEditUser[]>(
      [],
    );

  // מצב מקומי: isLoadingEditUsers — האם טעינה מתבצעת; setIsLoadingEditUsers מעדכנת אותו ומפעילה רינדור לפי React.
  const [
    isLoadingEditUsers,
    setIsLoadingEditUsers,
  ] =
    useState(false);

  // מצב מקומי: isSavingEdit — האם שמירה מתבצעת; setIsSavingEdit מעדכנת אותו ומפעילה רינדור לפי React.
  const [
    isSavingEdit,
    setIsSavingEdit,
  ] =
    useState(false);

  // מצב מקומי: editError — שגיאה; setEditError מעדכנת אותו ומפעילה רינדור לפי React.
  const [
    editError,
    setEditError,
  ] =
    useState<string | null>(
      null,
    );

  // מצב מקומי: editSuccess — הנתון editSuccess בהקשר הפעולה; setEditSuccess מעדכנת אותו ומפעילה רינדור לפי React.
  const [
    editSuccess,
    setEditSuccess,
  ] =
    useState<string | null>(
      null,
    );

  const {
    state,
    filters,
    visibleEntries,
    loadMonth,
    setCategoryVisibility,
  } =
    useUnifiedSchedule();

  // תופעת לוואי לאחר רינדור בהתאם לתלויות [ displayedMonth, displayedYear, loadMonth, ].
  useEffect(
    () => {
      void loadMonth({
        year:
          displayedYear,

        month:
          displayedMonth,
      });
    },
    [
      displayedMonth,
      displayedYear,
      loadMonth,
    ],
  );

  // activeTabDefinition — פעיל.
  const activeTabDefinition =
    workspaceTabs.find(
      (
        tab,
      ) =>
        tab.id ===
        activeTab,
    ) ??
    workspaceTabs[0];

  // ערך מחושב entriesByDate — רשומות / תאריך; נשמר בין רינדורים עד שינוי התלויות.
  const entriesByDate =
    useMemo(
      () => {
        // groupedEntries — רשומות; מיפוי לחיפוש לפי מפתח.
        const groupedEntries =
          new Map<
            string,
            UnifiedScheduleEntry[]
          >();

        visibleEntries.forEach(
          (
            entry,
          ) => {
            // existingEntries — רשומות.
            const existingEntries =
              groupedEntries.get(
                entry.date,
              ) ??
              [];

            existingEntries.push(
              entry,
            );

            groupedEntries.set(
              entry.date,
              existingEntries,
            );
          },
        );

        return groupedEntries;
      },
      [
        visibleEntries,
      ],
    );

  // ערך מחושב selectedDateEntries — נבחר / תאריך / רשומות; נשמר בין רינדורים עד שינוי התלויות.
  const selectedDateEntries =
    useMemo(
      () => {
        // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !selectedDate.
        if (
          !selectedDate
        ) {
          return [];
        }

        return (
          entriesByDate.get(
            selectedDate,
          ) ??
          []
        );
      },
      [
        entriesByDate,
        selectedDate,
      ],
    );

  // ערך מחושב warningMessages — הודעות; נשמר בין רינדורים עד שינוי התלויות.
  const warningMessages =
    useMemo(
      () =>
        Object.values(
          state.data.warnings,
        ).filter(
          (
            warning,
          ): warning is string =>
            Boolean(
              warning,
            ),
        ),
      [
        state.data.warnings,
      ],
    );
/**
 * פעולה handlePreviousPlanningMonth: טיפול באירוע עבור חודש.
 * @returns void — הפלט בהתאם לחתימה.
 */
const handlePreviousPlanningMonth =
  (): void => {
    // previousMonth — חודש.
    const previousMonth =
      getPreviousMonth(
        planningYear,
        planningMonth,
      );

    setPlanningYear(
      previousMonth.year,
    );

    setPlanningMonth(
      previousMonth.month,
    );
  };

/**
 * פעולה handleNextPlanningMonth: טיפול באירוע עבור חודש.
 * @returns void — הפלט בהתאם לחתימה.
 */
const handleNextPlanningMonth =
  (): void => {
    // nextMonth — חודש.
    const nextMonth =
      getNextMonth(
        planningYear,
        planningMonth,
      );

    setPlanningYear(
      nextMonth.year,
    );

    setPlanningMonth(
      nextMonth.month,
    );
  };

/**
 * פעולה handleNextMonthPlanning: טיפול באירוע עבור חודש.
 * @returns void — הפלט בהתאם לחתימה.
 */
const handleNextMonthPlanning =
  (): void => {
    // currentMonth — חודש.
    const currentMonth =
      getCurrentMonth();

    // nextMonth — חודש.
    const nextMonth =
      getNextMonth(
        currentMonth.year,
        currentMonth.month,
      );

    setPlanningYear(
      nextMonth.year,
    );

    setPlanningMonth(
      nextMonth.month,
    );
  };
  /**
   * פעולה handlePreviousMonth: טיפול באירוע עבור חודש.
   * @returns void — הפלט בהתאם לחתימה.
   */
  const handlePreviousMonth =
    (): void => {
      // previousMonth — חודש.
      const previousMonth =
        getPreviousMonth(
          displayedYear,
          displayedMonth,
        );

      setDisplayedYear(
        previousMonth.year,
      );

      setDisplayedMonth(
        previousMonth.month,
      );

      setSelectedDate(
        null,
      );
    };
/**
 * פעולה handleWorkspaceTabChange: טיפול באירוע עבור הנתון handleWorkspaceTabChange בהקשר הפעולה.
 * @param tab — הנתון tab בהקשר הפעולה.
 * @returns void — הפלט בהתאם לחתימה.
 */
const handleWorkspaceTabChange =
  (
    tab:
      ShiftsWorkspaceTab,
  ): void => {
    setActiveTab(
      tab,
    );

    setSearchParams(
      {
        tab,
      },
      {
        replace:
          true,
      },
    );
  };
  /**
   * פעולה handleNextMonth: טיפול באירוע עבור חודש.
   * @returns void — הפלט בהתאם לחתימה.
   */
  const handleNextMonth =
    (): void => {
      // nextMonth — חודש.
      const nextMonth =
        getNextMonth(
          displayedYear,
          displayedMonth,
        );

      setDisplayedYear(
        nextMonth.year,
      );

      setDisplayedMonth(
        nextMonth.month,
      );

      setSelectedDate(
        null,
      );
    };

  /**
   * פעולה handleCurrentMonth: טיפול באירוע עבור חודש.
   * @returns void — הפלט בהתאם לחתימה.
   */
  const handleCurrentMonth =
    (): void => {
      // currentMonth — חודש.
      const currentMonth =
        getCurrentMonth();

      setDisplayedYear(
        currentMonth.year,
      );

      setDisplayedMonth(
        currentMonth.month,
      );

      setSelectedDate(
        null,
      );
    };

  // currentPeriodValue — תקופה / ערך.
  const currentPeriodValue =
    initialMonth.year * 12 +
    initialMonth.month - 1;

  // displayedPeriodValue — תקופה / ערך.
  const displayedPeriodValue =
    displayedYear * 12 +
    displayedMonth - 1;

  // isDisplayedCurrentMonth — חודש.
  const isDisplayedCurrentMonth =
    displayedPeriodValue ===
      currentPeriodValue;

  // isDisplayedCurrentOrNextMonth — חודש.
  const isDisplayedCurrentOrNextMonth =
    displayedPeriodValue ===
      currentPeriodValue ||
    displayedPeriodValue ===
      currentPeriodValue + 1;

  /**
   * פעולה canEditEntry: בדיקת אפשרות פעולה עבור האם עריכה מותרת.
   * @param entry — רשומה.
   * @returns boolean — הפלט בהתאם לחתימה.
   */
  const canEditEntry =
    (
      entry:
        UnifiedScheduleEntry,
    ): boolean => {
      switch (
        entry.category
      ) {
        case 'dispatcher':
          /*
           * Dispatcher behavior stays unchanged.
           * Dispatcher shift changes continue through
           * the existing dispatcher flow / swap system.
           */
          return (
            isDisplayedCurrentMonth &&
            hasPermission(
              'schedule.edit',
            )
          );

        case 'on_call':
          return (
            isDisplayedCurrentOrNextMonth &&
            entry.scheduleStatus ===
              'published' &&
            hasPermission(
              'driver_schedule.edit_any',
            )
          );

        case 'morning_driver':
          return (
            isDisplayedCurrentOrNextMonth &&
            entry.scheduleStatus ===
              'published' &&
            hasPermission(
              'morning_driver_schedule.edit_any',
            )
          );

        default:
          return false;
      }
    };

  /**
   * פעולה אסינכרונית openEntryEditor: פתיחת רשומה.
   * @param entry — רשומה.
   * @returns Promise<void> — הפלט בהתאם לחתימה.
   */
  const openEntryEditor =
    async (
      entry:
        UnifiedScheduleEntry,
    ): Promise<void> => {
      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !canEditEntry( entry, ).
      if (
        !canEditEntry(
          entry,
        )
      ) {
        return;
      }

      setEditingEntry(
        entry,
      );
      setEditUsers([]);
      setEditError(null);
      setEditSuccess(null);
      setIsLoadingEditUsers(true);

      // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
      try {
        // טיפול במקרה מיוחד ויציאה מוקדמת כאשר entry.category === 'dispatcher'.
        if (
          entry.category ===
            'dispatcher'
        ) {
          // options — אפשרויות בחירה.
          const options =
            await scheduleService
              .getCurrentScheduleEditOptions(entry.sourceId);

          setEditUsers(
            options.dispatchers.map(
              (dispatcher) => ({
                id:
                  dispatcher.id,
                displayName:
                  dispatcher.displayName,
                scheduleName:
                  dispatcher.scheduleName,
              }),
            ),
          );

          return;
        }

        // טיפול במקרה מיוחד ויציאה מוקדמת כאשר entry.category === 'on_call'.
        if (
          entry.category ===
            'on_call'
        ) {
          // schedule — שיבוץ.
          const schedule =
            await driverScheduleService
              .getScheduleByMonth(
                displayedYear,
                displayedMonth,
              );

          setEditUsers(
            (
              schedule?.drivers ??
              []
            ).map(
              (driver) => ({
                id:
                  driver.id,
                displayName:
                  driver.displayName,
                scheduleName:
                  driver.scheduleName,
              }),
            ),
          );

          return;
        }

        // schedule — שיבוץ.
        const schedule =
          await morningDriverScheduleService
            .getSchedule(
              null,
              displayedYear,
              displayedMonth,
            );

        setEditUsers(
          (
            schedule?.drivers ??
            []
          ).map(
            (driver) => ({
              id:
                driver.id,
              displayName:
                driver.displayName,
              scheduleName:
                driver.scheduleName,
            }),
          ),
        );
      } catch (error) {
        setEditError(
          error instanceof Error
            ? error.message
            : 'לא ניתן היה לטעון את אפשרויות העריכה.',
        );
      } finally {
        setIsLoadingEditUsers(
          false,
        );
      }
    };

  /**
   * פעולה אסינכרונית saveEntryEdit: שמירת רשומה.
   * @param newUserId — מזהה העובד לאחר השינוי.
   * @param reason — הנתון reason בהקשר הפעולה.
   * @returns Promise<void> — הפלט בהתאם לחתימה.
   */
  const saveEntryEdit =
    async (
      newUserId:
        string,
      reason:
        string | null,
    ): Promise<void> => {
      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !editingEntry.
      if (
        !editingEntry
      ) {
        return;
      }

      setIsSavingEdit(true);
      setEditError(null);

      // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
      try {
        if (
          editingEntry.category ===
            'dispatcher'
        ) {
          await scheduleService
            .updateCurrentScheduleShift({
              shiftId:
                editingEntry.sourceId,
              newUserId,
              reason,
            });
        } else {
          await unifiedScheduleEditService
            .updateEntry({
              category:
                editingEntry.category,
              sourceId:
                editingEntry.sourceId,
              year:
                displayedYear,
              month:
                displayedMonth,
              newUserId,
              reason,
            });
        }

        setEditingEntry(null);
        setSelectedDate(null);
        setEditSuccess(
          'השיבוץ עודכן בהצלחה והמשתמשים שהושפעו קיבלו התראה.',
        );

        await loadMonth({
          year:
            displayedYear,
          month:
            displayedMonth,
        });
      } catch (error) {
        setEditError(
          error instanceof Error
            ? error.message
            : 'לא ניתן היה לעדכן את השיבוץ.',
        );
      } finally {
        setIsSavingEdit(false);
      }
    };

  /**
   * פעולה renderCalendarDayContent: בניית תצוגה עבור לוח שנה / יום.
   * @param context — הנתון context בהקשר הפעולה.
   */
  const renderCalendarDayContent =
    (
      context:
        MonthCalendarDayContext,
    ) => {
      // dayEntries — יום / רשומות.
      const dayEntries =
        entriesByDate.get(
          context.date,
        ) ??
        [];

      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר dayEntries.length === 0.
      if (
        dayEntries.length ===
        0
      ) {
        return (
          <span className="unified-calendar-empty-day">
            אין שיבוצים
          </span>
        );
      }

      // visibleDayEntries — יום / רשומות.
      const visibleDayEntries =
        dayEntries.slice(
          0,
          maximumVisibleEntriesPerDay,
        );

      // hiddenEntriesCount — רשומות / כמות.
      const hiddenEntriesCount =
        dayEntries.length -
        visibleDayEntries.length;

      return (
        <>
          {visibleDayEntries.map(
            (
              entry,
            ) => {
              // timeLabel — זמן / תווית.
              const timeLabel =
                formatEntryTime(
                  entry,
                );

              return (
                <div
                  key={
                    entry.id
                  }
                  className={[
                    'unified-calendar-entry',

                    `unified-calendar-entry-${entry.category}`,

                    !entry.assignedUserName
                      ? 'unified-calendar-entry-unassigned'
                      : '',
                  ]
                    .filter(
                      Boolean,
                    )
                    .join(
                      ' ',
                    )}
                >
                  <span className="unified-calendar-entry-category">
                    {
                      categoryLabels[
                        entry.category
                      ]
                    }
                  </span>

                  <span className="unified-calendar-entry-name">
                    {
                      getEntryDisplayName(
                        entry,
                      )
                    }
                  </span>

                  {timeLabel ? (
                    <span
                      className="unified-calendar-entry-time"
                      dir="ltr"
                    >
                      {
                        timeLabel
                      }
                    </span>
                  ) : null}
                </div>
              );
            },
          )}

          {hiddenEntriesCount >
          0 ? (
            <span className="unified-calendar-more">
              +
              {
                hiddenEntriesCount
              }{' '}
              נוספים
            </span>
          ) : null}
        </>
      );
    };

  /**
   * פעולה handleDayClick: טיפול באירוע עבור יום.
   * @param context — הנתון context בהקשר הפעולה.
   * @returns void — הפלט בהתאם לחתימה.
   */
  const handleDayClick =
    (
      context:
        MonthCalendarDayContext,
    ): void => {
      // dayEntries — יום / רשומות.
      const dayEntries =
        entriesByDate.get(
          context.date,
        ) ??
        [];

      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר dayEntries.length === 0.
      if (
        dayEntries.length ===
        0
      ) {
        return;
      }

      setSelectedDate(
        context.date,
      );
    };

  return (
    <>
      <PageHeader
        title="משמרות"
        description="ניהול מאוחד של מוקדנים, כונני בוקר וכוננים."
      />

      <nav
        className="shifts-workspace-tabs"
        aria-label="אזורי ניהול משמרות"
      >
        {workspaceTabs.map(
          (
            tab,
          ) => {
            const Icon =
              tab.icon;

            // isActive — האם הרשומה פעילה.
            const isActive =
              activeTab ===
              tab.id;

            return (
              <Button
                key={
                  tab.id
                }
                type="button"
                variant={
                  isActive
                    ? 'primary'
                    : 'secondary'
                }
                className="shifts-workspace-tab"
                aria-pressed={
                  isActive
                }
                onClick={() =>
                  handleWorkspaceTabChange(
                    tab.id,
                  )
                }
              >
                <Icon
                  size={
                    18
                  }
                  aria-hidden="true"
                />

                {
                  tab.label
                }
              </Button>
            );
          },
        )}
      </nav>
{activeTab !==
'calendar' ? (
  <Card>
    <CardBody>
      <div className="unified-schedule-toolbar">
        <div className="unified-schedule-month-navigation">
          <Button
            type="button"
            variant="secondary"
            className="unified-schedule-navigation-button"
            aria-label="תקופת התכנון הקודמת"
            onClick={
              handlePreviousPlanningMonth
            }
          >
            <ChevronRight
              size={
                18
              }
              aria-hidden="true"
            />

            חודש קודם
          </Button>

          <div className="unified-schedule-current-month">
            <strong>
              {
                hebrewMonths[
                  planningMonth -
                    1
                ]
              }
            </strong>

            <span>
              {
                planningYear
              }
            </span>
          </div>

          <Button
            type="button"
            variant="secondary"
            className="unified-schedule-navigation-button"
            aria-label="תקופת התכנון הבאה"
            onClick={
              handleNextPlanningMonth
            }
          >
            חודש הבא

            <ChevronLeft
              size={
                18
              }
              aria-hidden="true"
            />
          </Button>
        </div>

        <Button
          type="button"
          variant="secondary"
          onClick={
            handleNextMonthPlanning
          }
        >
          החודש הבא לתכנון
        </Button>
      </div>
    </CardBody>
  </Card>
) : null}
    {activeTab ===
    'calendar' ? (
      <section className="unified-schedule-workspace">
          <Card>
            <CardBody>
              <div className="unified-schedule-toolbar">
                <div className="unified-schedule-month-navigation">
                  <Button
                    type="button"
                    variant="secondary"
                    className="unified-schedule-navigation-button"
                    aria-label="החודש הקודם"
                    onClick={
                      handlePreviousMonth
                    }
                  >
                    <ChevronRight
                      size={
                        18
                      }
                      aria-hidden="true"
                    />

                    חודש קודם
                  </Button>

                  <div className="unified-schedule-current-month">
                    <strong>
                      {
                        hebrewMonths[
                          displayedMonth -
                            1
                        ]
                      }
                    </strong>

                    <span>
                      {
                        displayedYear
                      }
                    </span>
                  </div>

                  <Button
                    type="button"
                    variant="secondary"
                    className="unified-schedule-navigation-button"
                    aria-label="החודש הבא"
                    onClick={
                      handleNextMonth
                    }
                  >
                    חודש הבא

                    <ChevronLeft
                      size={
                        18
                      }
                      aria-hidden="true"
                    />
                  </Button>
                </div>

                <Button
                  type="button"
                  variant="secondary"
                  onClick={
                    handleCurrentMonth
                  }
                >
                  החודש הנוכחי
                </Button>
              </div>

              <div
                className="unified-schedule-display-mode"
                role="group"
                aria-label="בחירת תצוגת לוח"
              >
                <Button
                  type="button"
                  variant={
                    scheduleDisplayMode ===
                      'calendar'
                      ? 'primary'
                      : 'secondary'
                  }
                  onClick={() => {
                    setScheduleDisplayMode(
                      'calendar',
                    );
                  }}
                >
                  <CalendarDays
                    size={17}
                    aria-hidden="true"
                  />
                  לוח שנה
                </Button>

                <Button
                  type="button"
                  variant={
                    scheduleDisplayMode ===
                      'list'
                      ? 'primary'
                      : 'secondary'
                  }
                  onClick={() => {
                    setScheduleDisplayMode(
                      'list',
                    );
                  }}
                >
                  <LayoutList
                    size={17}
                    aria-hidden="true"
                  />
                  רשימה
                </Button>
              </div>

              <fieldset className="unified-schedule-filters">
                <legend>
                  הצג בלוח
                </legend>

                <div className="unified-schedule-filter-options">
                  {filterDefinitions.map(
                    (
                      filter,
                    ) => (
                      <label
                        key={
                          filter.key
                        }
                        className={[
                          'unified-schedule-filter',

                          `unified-schedule-filter-${filter.category}`,
                        ].join(
                          ' ',
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={
                            filters[
                              filter.key
                            ]
                          }
                          onChange={(
                            event,
                          ) =>
                            setCategoryVisibility(
                              filter.key,
                              event
                                .target
                                .checked,
                            )
                          }
                        />

                        <span>
                          {
                            filter.label
                          }
                        </span>
                      </label>
                    ),
                  )}
                </div>
              </fieldset>
            </CardBody>
          </Card>

          {editSuccess ? (
            <div
              className="unified-schedule-message unified-schedule-message-success"
              role="status"
            >
              <CheckCircle2
                size={18}
                aria-hidden="true"
              />
              {editSuccess}
            </div>
          ) : null}

          {state.error ? (
            <div
              className="unified-schedule-message unified-schedule-message-error"
              role="alert"
            >
              {
                state.error
              }
            </div>
          ) : null}

          {warningMessages.length >
          0 ? (
            <div className="unified-schedule-message unified-schedule-message-warning">
              <strong>
                חלק מהמידע לא נטען:
              </strong>

              <ul>
                {warningMessages.map(
                  (
                    warning,
                  ) => (
                    <li
                      key={
                        warning
                      }
                    >
                      {
                        warning
                      }
                    </li>
                  ),
                )}
              </ul>
            </div>
          ) : null}

          {state.isLoading ? (
            <Card>
              <CardBody>
                <div className="unified-schedule-loading">
                  טוען את לוחות המשמרות...
                </div>
              </CardBody>
            </Card>
          ) : scheduleDisplayMode ===
            'calendar' ? (
            <MonthCalendar
              year={
                displayedYear
              }
              month={
                displayedMonth
              }
              renderDayContent={
                renderCalendarDayContent
              }
              onDayClick={
                handleDayClick
              }
            />
          ) : (
            <div className="unified-schedule-list">
              {visibleEntries.length ===
              0 ? (
                <Card>
                  <CardBody>
                    <div className="unified-schedule-loading">
                      אין משמרות להצגה.
                    </div>
                  </CardBody>
                </Card>
              ) : (
                visibleEntries.map(
                  (entry) => {
                    // timeLabel — זמן / תווית.
                    const timeLabel =
                      formatEntryTime(
                        entry,
                      );

                    return (
                      <article
                        key={entry.id}
                        className={[
                          'unified-schedule-list-entry',
                          `unified-schedule-list-entry-${entry.category}`,
                        ].join(' ')}
                      >
                        <div>
                          <span className="unified-schedule-day-entry-category">
                            {categoryLabels[entry.category]}
                          </span>
                          <strong>
                            {formatDate(entry.date)}
                          </strong>
                          <span>
                            {getEntryDisplayName(entry)}
                            {' · '}
                            {timeLabel ? (
                              <bdi dir="ltr">
                                {timeLabel}
                              </bdi>
                            ) : (
                              'משמרת יום מלאה'
                            )}
                          </span>
                        </div>

                        {canEditEntry(
                          entry,
                        ) ? (
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={() => {
                              void openEntryEditor(
                                entry,
                              );
                            }}
                          >
                            <Pencil
                              size={16}
                              aria-hidden="true"
                            />
                            עריכת שיבוץ
                          </Button>
                        ) : null}
                      </article>
                    );
                  },
                )
              )}
            </div>
          )}
        </section>
          ) : activeTab ===
            'availability' ? (
          <UnifiedAvailabilityManagement
            year={
              planningYear
            }
            month={
              planningMonth
            }
          />
          ) : activeTab ===
            'period-management' ? (
          <UnifiedPeriodManagement
            year={
              planningYear
            }
            month={
              planningMonth
            }
          />
          ) : (
            <Card>
              <CardBody>
                <section className="shifts-placeholder">
                  <activeTabDefinition.icon
                    size={
                      36
                    }
                    aria-hidden="true"
                  />

                  <div>
                    <h2>
                      {
                        activeTabDefinition.label
                      }
                    </h2>

                    <p>
                      {
                        activeTabDefinition.description
                      }
                    </p>
                  </div>
                </section>
              </CardBody>
            </Card>
          )}

      <Modal
        isOpen={
          selectedDate !==
          null
        }
        title={
          selectedDate
            ? `משמרות ליום ${formatDate(
                selectedDate,
              )}`
            : 'פרטי משמרות'
        }
        footer={
          <Button
            type="button"
            variant="secondary"
            onClick={() =>
              setSelectedDate(
                null,
              )
            }
          >
            סגירה
          </Button>
        }
        onClose={() =>
          setSelectedDate(
            null,
          )
        }
      >
        <div className="unified-schedule-day-details">
          {selectedDateEntries.map(
            (
              entry,
            ) => {
              // timeLabel — זמן / תווית.
              const timeLabel =
                formatEntryTime(
                  entry,
                );

              return (
                <article
                  key={
                    entry.id
                  }
                  className={[
                    'unified-schedule-day-entry',

                    `unified-schedule-day-entry-${entry.category}`,
                  ].join(
                    ' ',
                  )}
                >
                  <div className="unified-schedule-day-entry-header">
                    <span className="unified-schedule-day-entry-category">
                      {
                        categoryLabels[
                          entry.category
                        ]
                      }
                    </span>

                    {entry.isLocked ? (
                      <span className="unified-schedule-day-entry-status">
                        נעול
                      </span>
                    ) : null}
                  </div>

                  <strong>
                    {
                      getEntryDisplayName(
                        entry,
                      )
                    }
                  </strong>

                  {timeLabel ? (
                    <span>
                      שעות:{' '}
                      <bdi dir="ltr">
                        {
                          timeLabel
                        }
                      </bdi>
                    </span>
                  ) : (
                    <span>
                      משמרת יום מלאה
                    </span>
                  )}

                  {canEditEntry(
                    entry,
                  ) ? (
                    <div className="unified-schedule-day-entry-actions">
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => {
                          void openEntryEditor(
                            entry,
                          );
                        }}
                      >
                        <Pencil
                          size={16}
                          aria-hidden="true"
                        />
                        עריכת שיבוץ
                      </Button>
                    </div>
                  ) : null}

                  {entry.notes ? (
                    <p>
                      {
                        entry.notes
                      }
                    </p>
                  ) : null}
                </article>
              );
            },
          )}
        </div>
      </Modal>

      <UnifiedScheduleEntryEditModal
        key={
          editingEntry?.id ??
          'closed'
        }
        entry={editingEntry}
        users={editUsers}
        isLoadingUsers={
          isLoadingEditUsers
        }
        isSaving={
          isSavingEdit
        }
        error={editError}
        onClose={() => {
          if (
            !isSavingEdit
          ) {
            setEditingEntry(null);
            setEditError(null);
          }
        }}
        onSave={saveEntryEdit}
      />
    </>
  );
}

export default LegacyShiftsPage;