/**
 * קובץ: src/pages/MorningDriverAvailabilityPage.tsx
 * מטרה: מימוש מסך המשתמש עבור כונני בוקר.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: CreatePeriodFormState, createInitialFormState, formatDateTime, getPeriodLabel, MorningDriverAvailabilityPage.
 * - קישור מאפיינים ומצב מקומי לתצוגה ולטיפול בפעולות המשתמש.
 */
import {
  ArrowRight,
  CalendarDays,
  ClipboardCheck,
  Clock3,
  LoaderCircle,
  Plus,
  RefreshCw,
  SunMedium,
  Trash2,
  Unlock,
  Users,
  X,
} from 'lucide-react';

import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from 'react';

import {
  useNavigate,
} from 'react-router-dom';

import {
  useAuth,
} from '../auth/AuthContext';

import {
  useMorningDriverAvailabilityPeriods,
} from '../hooks/useMorningDriverAvailabilityPeriods';

import {
  useMorningDriverAvailabilityManagement,
} from '../hooks/useMorningDriverAvailabilityManagement';

import {
  useMorningDriverSchedule,
} from '../hooks/useMorningDriverSchedule';

import MorningDriverAvailabilityManagementPanel
  from '../components/morningDriverAvailability/MorningDriverAvailabilityManagementPanel';

import MyMorningDriverAvailabilityPanel
  from '../components/morningDriverAvailability/MyMorningDriverAvailabilityPanel';

import type {
  MorningDriverAvailabilityPeriodListItem,
  MorningDriverAvailabilityPeriodStatus,
} from '../types/morningDriverAvailability';

import '../styles/morningDriverAvailability.css';
import '../styles/morningDriverAvailabilityManagement.css';

/**
 * חוזה הנתונים CreatePeriodFormState: תקופה / מצב.
 */
interface CreatePeriodFormState {
  // year — שנה.
  year: string;
  // month — חודש.
  month: string;
  // title — כותרת.
  title: string;
  instructions: string;
  // submissionDeadline — מועד אחרון להגשת אילוצים.
  submissionDeadline: string;
}

// HEBREW_MONTHS — חודשים.
const HEBREW_MONTHS = [
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
] as const;

// STATUS_LABELS — סטטוס.
const STATUS_LABELS:
  Record<
    MorningDriverAvailabilityPeriodStatus,
    string
  > = {
    draft:
      'טיוטה',

    open:
      'פתוח להגשה',

    closed:
      'סגור',

    archived:
      'בארכיון',
  };

/**
 * פעולה createInitialFormState: יצירת מצב.
 * @returns CreatePeriodFormState — הפלט בהתאם לחתימה.
 */
function createInitialFormState():
  CreatePeriodFormState {
  // currentDate — תאריך.
  const currentDate =
    new Date();

  // targetDate — יעד / תאריך.
  const targetDate =
    new Date(
      currentDate.getFullYear(),
      currentDate.getMonth() + 1,
      1,
    );

  return {
    year:
      String(
        targetDate.getFullYear(),
      ),

    month:
      String(
        targetDate.getMonth() + 1,
      ),

    title:
      `אילוצי כונני בוקר ${HEBREW_MONTHS[targetDate.getMonth()]} ${targetDate.getFullYear()}`,

    instructions:
      'יש לסמן זמינות לכל המשמרות ולשלוח את האילוצים עד למועד האחרון.',

    submissionDeadline:
      '',
  };
}

/**
 * פעולה formatDateTime: עיצוב ערך לתצוגה עבור תאריך / זמן.
 * @param value — ערך.
 * @returns string — הפלט בהתאם לחתימה.
 */
function formatDateTime(
  value:
    string | null,
): string {
  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !value.
  if (!value) {
    return 'לא הוגדר';
  }

  // date — תאריך.
  const date =
    new Date(
      value,
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
      dateStyle:
        'short',

      timeStyle:
        'short',
    },
  ).format(
    date,
  );
}

/**
 * פעולה getPeriodLabel: שליפה או חישוב של תקופה / תווית.
 * @param period — תקופה.
 * @returns string — הפלט בהתאם לחתימה.
 */
function getPeriodLabel(
  period:
    MorningDriverAvailabilityPeriodListItem,
): string {
  // monthLabel — חודש / תווית.
  const monthLabel =
    HEBREW_MONTHS[
      period.month - 1
    ] ??
    String(
      period.month,
    );

  return `${monthLabel} ${period.year}`;
}

/**
 * פעולה MorningDriverAvailabilityPage: כונני בוקר.
 */
function MorningDriverAvailabilityPage() {
  const navigate = useNavigate();
  const {
    hasPermission,
  } =
    useAuth();

  const {
    state,
    loadPeriods,
    createPeriod,
    openPeriod,
    reopenPeriod,
    deletePeriod,
    clearError,
  } =
    useMorningDriverAvailabilityPeriods();

  const {
    state:
      managementState,

    loadManagement,

    reopenSubmission,

    closePeriod,

    reset:
      resetManagement,
  } =
    useMorningDriverAvailabilityManagement();

  const {
    state:
      scheduleState,

    createDraft:
      createMorningDriverScheduleDraft,
  } =
    useMorningDriverSchedule();

  // מצב מקומי: isCreateDialogOpen — הנתון isCreateDialogOpen בהקשר הפעולה; setIsCreateDialogOpen מעדכנת אותו ומפעילה רינדור לפי React.
  const [
    isCreateDialogOpen,
    setIsCreateDialogOpen,
  ] =
    useState(false);

  // מצב מקומי: formState — מצב; setFormState מעדכנת אותו ומפעילה רינדור לפי React.
  const [
    formState,
    setFormState,
  ] =
    useState<CreatePeriodFormState>(
      createInitialFormState,
    );

  // מצב מקומי: formError — שגיאה; setFormError מעדכנת אותו ומפעילה רינדור לפי React.
  const [
    formError,
    setFormError,
  ] =
    useState<string | null>(
      null,
    );

  // canSubmit — הנתון canSubmit בהקשר הפעולה.
  const canSubmit =
    hasPermission(
      'morning_driver_availability.view',
    );

  // canManage — האם פעולת ניהול מותרת.
  const canManage =
    hasPermission(
      'morning_driver_availability.manage',
    );

  // תופעת לוואי לאחר רינדור בהתאם לתלויות [ canManage, loadPeriods, ].
  useEffect(
    () => {
      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !canManage.
      if (!canManage) {
        return undefined;
      }

      // timeoutId — משך המתנה / מזהה.
      const timeoutId =
        window.setTimeout(
          () => {
            void loadPeriods();
          },
          0,
        );

      return () => {
        window.clearTimeout(
          timeoutId,
        );
      };
    },
    [
      canManage,
      loadPeriods,
    ],
  );

  // ערך מחושב sortedPeriods — תקופות; נשמר בין רינדורים עד שינוי התלויות.
  const sortedPeriods =
    useMemo(
      () =>
        [...state.periods]
          .sort(
            (
              firstPeriod,
              secondPeriod,
            ) =>
              secondPeriod.year -
                firstPeriod.year ||
              secondPeriod.month -
                firstPeriod.month,
          ),
      [
        state.periods,
      ],
    );

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר canSubmit && !canManage.
  if (
    canSubmit &&
    !canManage
  ) {
    return (
      <section className="morning-driver-availability-page morning-driver-availability-page-personal">
        <MyMorningDriverAvailabilityPanel />
      </section>
    );
  }

  /**
   * פעולה openCreateDialog: פתיחת הנתון openCreateDialog בהקשר הפעולה.
   * @returns void — הפלט בהתאם לחתימה.
   */
  const openCreateDialog =
    (): void => {
      setFormState(
        createInitialFormState(),
      );

      setFormError(
        null,
      );

      clearError();

      setIsCreateDialogOpen(
        true,
      );
    };

  /**
   * פעולה closeCreateDialog: סגירת הנתון closeCreateDialog בהקשר הפעולה.
   * @returns void — הפלט בהתאם לחתימה.
   */
  const closeCreateDialog =
    (): void => {
      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר state.isCreating.
      if (
        state.isCreating
      ) {
        return;
      }

      setIsCreateDialogOpen(
        false,
      );

      setFormError(
        null,
      );
    };

  /**
   * פעולה אסינכרונית handleCreatePeriod: טיפול באירוע עבור תקופה.
   * @param event — אירוע.
   * @returns Promise<void> — הפלט בהתאם לחתימה.
   */
  const handleCreatePeriod =
    async (
      event:
        FormEvent<HTMLFormElement>,
    ): Promise<void> => {
      event.preventDefault();

      // year — שנה.
      const year =
        Number(
          formState.year,
        );

      // month — חודש.
      const month =
        Number(
          formState.month,
        );

      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !Number.isInteger( year, ) || year < 2020 || year > 2100.
      if (
        !Number.isInteger(
          year,
        ) ||
        year < 2020 ||
        year > 2100
      ) {
        setFormError(
          'יש לבחור שנה תקינה.',
        );

        return;
      }

      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !Number.isInteger( month, ) || month < 1 || month > 12.
      if (
        !Number.isInteger(
          month,
        ) ||
        month < 1 ||
        month > 12
      ) {
        setFormError(
          'יש לבחור חודש תקין.',
        );

        return;
      }

      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !formState .submissionDeadline.
      if (
        !formState
          .submissionDeadline
      ) {
        setFormError(
          'יש להגדיר מועד אחרון להגשת האילוצים.',
        );

        return;
      }

      const deadline =
        new Date(
          formState
            .submissionDeadline,
        );

      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר Number.isNaN( deadline.getTime(), ).
      if (
        Number.isNaN(
          deadline.getTime(),
        )
      ) {
        setFormError(
          'מועד ההגשה שנבחר אינו תקין.',
        );

        return;
      }

      setFormError(
        null,
      );

      // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
      try {
        await createPeriod({
          year,
          month,

          title:
            formState.title
              .trim() ||
            null,

          instructions:
            formState
              .instructions
              .trim() ||
            null,

          submissionDeadline:
            deadline.toISOString(),
        });

        setIsCreateDialogOpen(
          false,
        );
      } catch {
        /*
         * הודעת השגיאה מוצגת מתוך ה-Hook.
         */
      }
    };

  /**
   * פעולה אסינכרונית handleOpenPeriod: טיפול באירוע עבור תקופה.
   * @param period — תקופה.
   * @returns Promise<void> — הפלט בהתאם לחתימה.
   */
  const handleOpenPeriod =
    async (
      period:
        MorningDriverAvailabilityPeriodListItem,
    ): Promise<void> => {
      const confirmed =
        window.confirm(
          `לפתוח את חודש האילוצים ${getPeriodLabel(period)} להגשה?\n\n` +
          'בפתיחה תיווצר רשומת הגשה לכל כונן בוקר פעיל.',
        );

      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !confirmed.
      if (!confirmed) {
        return;
      }

      // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
      try {
        await openPeriod(
          period.id,
        );
      } catch {
        /*
         * הודעת השגיאה מוצגת מתוך ה-Hook.
         */
      }
    };

  /**
   * פעולה אסינכרונית handleDeletePeriod: טיפול באירוע עבור תקופה.
   * @param period — תקופה.
   * @returns Promise<void> — הפלט בהתאם לחתימה.
   */
  const handleDeletePeriod =
    async (
      period:
        MorningDriverAvailabilityPeriodListItem,
    ): Promise<void> => {
      const confirmed =
        window.confirm(
          `למחוק את טיוטת אילוצי כונני הבוקר של ${getPeriodLabel(period)}?\n\n` +
          'הפעולה תמחק את התקופה ואת כל המשמרות שנוצרו עבורה.',
        );

      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !confirmed.
      if (!confirmed) {
        return;
      }

      // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
      try {
        await deletePeriod(
          period.id,
        );
      } catch {
        /*
         * הודעת השגיאה מוצגת מתוך ה-Hook.
         */
      }
    };


  /**
   * פעולה אסינכרונית handleOpenManagement: טיפול באירוע עבור הנתון handleOpenManagement בהקשר הפעולה.
   * @param period — תקופה.
   * @returns Promise<void> — הפלט בהתאם לחתימה.
   */
  const handleOpenManagement =
    async (
      period:
        MorningDriverAvailabilityPeriodListItem,
    ): Promise<void> => {
      // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
      try {
        await loadManagement(
          period.id,
        );
      } catch {
        /*
         * הודעת השגיאה מוצגת מתוך Hook הניהול.
         */
      }
    };

  /**
   * פעולה אסינכרונית handleCloseManagement: טיפול באירוע עבור הנתון handleCloseManagement בהקשר הפעולה.
   * @returns Promise<void> — הפלט בהתאם לחתימה.
   */
  const handleCloseManagement =
    async (): Promise<void> => {
      resetManagement();

      // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
      try {
        await loadPeriods();
      } catch {
        /*
         * הודעת השגיאה מוצגת מתוך Hook התקופות.
         */
      }
    };

  /**
   * פעולה אסינכרונית handleClosePeriod: טיפול באירוע עבור תקופה.
   * @param force — הנתון force בהקשר הפעולה.
   * @returns Promise<void> — הפלט בהתאם לחתימה.
   */
  const handleClosePeriod =
    async (
      force: boolean,
    ): Promise<void> => {
      // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
      try {
        await closePeriod(
          force,
        );

        await loadPeriods();
      } catch {
        /*
         * הודעת השגיאה מוצגת מתוך Hook הניהול.
         */
      }
    };

  /**
   * פעולה אסינכרונית handleReopenManagementPeriod: טיפול באירוע עבור תקופה.
   * @returns Promise<void> — הפלט בהתאם לחתימה.
   */
  const handleReopenManagementPeriod =
    async (): Promise<void> => {
      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !managementState.data.
      if (
        !managementState.data
      ) {
        return;
      }

      const confirmed =
        window.confirm(
          'לפתוח מחדש את חודש האילוצים? כונני הבוקר יוכלו שוב לערוך ולהגיש.',
        );

      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !confirmed.
      if (!confirmed) {
        return;
      }

      // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
      try {
        await reopenPeriod(
          managementState.data.period.id,
        );

        await loadManagement(
          managementState.data.period.id,
        );

        await loadPeriods();
      } catch {
        // Hook exposes the error.
      }
    };

  /**
   * פעולה אסינכרונית handleDeleteManagementPeriod: טיפול באירוע עבור תקופה.
   * @returns Promise<void> — הפלט בהתאם לחתימה.
   */
  const handleDeleteManagementPeriod =
    async (): Promise<void> => {
      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !managementState.data.
      if (
        !managementState.data
      ) {
        return;
      }

      const confirmed =
        window.confirm(
          'למחוק את חודש אילוצי כונני הבוקר ואת כל הנתונים שנשמרו בו?',
        );

      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !confirmed.
      if (!confirmed) {
        return;
      }

      // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
      try {
        await deletePeriod(
          managementState.data.period.id,
        );

        resetManagement();
        await loadPeriods();
      } catch {
        // Hook exposes the error.
      }
    };

  /**
   * פעולה אסינכרונית handlePrepareMorningDriverSchedule: טיפול באירוע עבור כונני בוקר.
   * @returns Promise<void> — הפלט בהתאם לחתימה.
   */
  const handlePrepareMorningDriverSchedule =
    async (): Promise<void> => {
      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !managementState.data || scheduleState.isCreating.
      if (
        !managementState.data ||
        scheduleState.isCreating
      ) {
        return;
      }

      const confirmed =
        window.confirm(
          'ליצור טיוטת לוח כונני בוקר מהאילוצים הסגורים?',
        );

      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !confirmed.
      if (!confirmed) {
        return;
      }

      // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
      try {
        await createMorningDriverScheduleDraft(
          managementState.data.period.id,
        );
      } catch {
        // Schedule hook exposes the error.
      }
    };

  return (
    <section className="morning-driver-availability-page">
      <header className="morning-driver-page-header">
        <div>
          <span className="morning-driver-page-eyebrow">
            <SunMedium
              size={18}
              aria-hidden="true"
            />

            מערכת כונני בוקר
          </span>

          <h1>
            אילוצי כונני בוקר
          </h1>

          <p>
            פתיחת חודשי אילוצים, מעקב אחר התקופות וניהול ההגשה.
          </p>
        </div>

        <div className="morning-driver-page-actions">
          <button
            type="button"
            className="morning-driver-secondary-button"
            disabled={
              state.isLoading
            }
            onClick={() => {
              void loadPeriods();
            }}
          >
            <RefreshCw
              size={18}
              className={
                state.isLoading
                  ? 'morning-driver-spin'
                  : ''
              }
              aria-hidden="true"
            />

            רענון
          </button>

          {canManage ? (
            <button
              type="button"
              className="morning-driver-primary-button"
              disabled={
                state.isCreating
              }
              onClick={
                openCreateDialog
              }
            >
              <Plus
                size={18}
                aria-hidden="true"
              />

              פתיחת חודש חדש
            </button>
          ) : null}
        </div>
      </header>

      <section className="morning-driver-rules-card">
        <div className="morning-driver-rules-icon">
          <Clock3
            size={24}
            aria-hidden="true"
          />
        </div>

        <div>
          <strong>
            מבנה המשמרות
          </strong>

          <span>
            ימים א׳–ה׳, 06:00–16:00: מומלץ לשבץ שני כונני בוקר במקביל, אך ניתן לקיים את המשמרת גם עם כונן אחד. במשמרת 15:00–23:00 וביום שישי 06:00–14:00 נדרש כונן אחד.
          </span>
        </div>
      </section>

      {state.error ? (
        <div
          className="morning-driver-error"
          role="alert"
        >
          <span>
            {state.error}
          </span>

          <button
            type="button"
            onClick={
              clearError
            }
          >
            סגירה
          </button>
        </div>
      ) : null}

      {state.lastCreatedResult ? (
        <div
          className="morning-driver-success"
          role="status"
        >
          חודש האילוצים נוצר בהצלחה עם{' '}
          <strong>
            {
              state
                .lastCreatedResult
                .createdShifts
            }
          </strong>{' '}
          משמרות.
        </div>
      ) : null}

      {state.lastOpenedResult ? (
        <div
          className="morning-driver-success"
          role="status"
        >
          חודש האילוצים נפתח להגשה. נוצרו{' '}
          <strong>
            {
              state
                .lastOpenedResult
                .createdSubmissions
            }
          </strong>{' '}
          הגשות לכונני בוקר פעילים.
        </div>
      ) : null}

      {state.lastDeletedResult ? (
        <div
          className="morning-driver-success"
          role="status"
        >
          טיוטת חודש האילוצים נמחקה בהצלחה.
        </div>
      ) : null}

      {managementState.selectedPeriodId ? (
        <section className="morning-driver-management-workspace">
          <div className="morning-driver-management-workspace-toolbar">
            <button
              type="button"
              className="morning-driver-secondary-button"
              disabled={
                managementState.isLoading ||
                managementState.isClosing ||
                managementState.reopeningUserId !==
                  null
              }
              onClick={() => {
                void handleCloseManagement();
              }}
            >
              <ArrowRight
                size={18}
                aria-hidden="true"
              />

              חזרה לרשימת החודשים
            </button>
          </div>

          <MorningDriverAvailabilityManagementPanel
            data={
              managementState.data
            }
            isLoading={
              managementState.isLoading
            }
            reopeningUserId={
              managementState.reopeningUserId
            }
            isClosing={
              managementState.isClosing
            }
            error={
              managementState.error
            }
            onRefresh={() => {
              if (
                managementState.selectedPeriodId
              ) {
                void loadManagement(
                  managementState.selectedPeriodId,
                );
              }
            }}
            onReopenSubmission={(
              userId: string,
            ) => {
              void reopenSubmission(
                userId,
              );
            }}
            onClosePeriod={(
              force: boolean,
            ) => {
              void handleClosePeriod(
                force,
              );
            }}
            onReopenPeriod={() => {
              void handleReopenManagementPeriod();
            }}
            onDeletePeriod={() => {
              void handleDeleteManagementPeriod();
            }}
            onPrepareSchedule={() => {
              void handlePrepareMorningDriverSchedule();
            }}
            onGoToSchedule={() => {
              navigate(
                '/morning-driver-schedule',
              );
            }}
          />
        </section>
      ) : state.isLoading &&
      sortedPeriods.length ===
        0 ? (
        <section className="morning-driver-empty-state">
          <LoaderCircle
            size={34}
            className="morning-driver-spin"
            aria-hidden="true"
          />

          <strong>
            טוען חודשי אילוצים
          </strong>
        </section>
      ) : sortedPeriods.length ===
        0 ? (
        <section className="morning-driver-empty-state">
          <CalendarDays
            size={36}
            aria-hidden="true"
          />

          <strong>
            עדיין לא נוצרו חודשי אילוצים
          </strong>

          <span>
            מנהל יכול ליצור את חודש האילוצים הראשון באמצעות הכפתור למעלה.
          </span>
        </section>
      ) : (
        <div className="morning-driver-period-grid">
          {sortedPeriods.map(
            (
              period,
            ) => {
              // isOpening — האם המצב פתוח.
              const isOpening =
                state.openingPeriodId ===
                period.id;

              // isDeleting — הנתון isDeleting בהקשר הפעולה.
              const isDeleting =
                state.deletingPeriodId ===
                period.id;

              // isBusy — הנתון isBusy בהקשר הפעולה.
              const isBusy =
                isOpening ||
                isDeleting;

              return (
                <article
                  key={
                    period.id
                  }
                  className="morning-driver-period-card"
                >
                  <header className="morning-driver-period-header">
                    <div>
                      <span>
                        חודש אילוצים
                      </span>

                      <h2>
                        {
                          getPeriodLabel(
                            period,
                          )
                        }
                      </h2>
                    </div>

                    <span
                      className={[
                        'morning-driver-status-badge',

                        `morning-driver-status-${period.status}`,
                      ].join(
                        ' ',
                      )}
                    >
                      {
                        STATUS_LABELS[
                          period.status
                        ]
                      }
                    </span>
                  </header>

                  {period.title ? (
                    <p className="morning-driver-period-title">
                      {
                        period.title
                      }
                    </p>
                  ) : null}

                  <div className="morning-driver-period-stat-grid">
                    <div>
                      <CalendarDays
                        size={18}
                        aria-hidden="true"
                      />

                      <span>
                        משמרות
                      </span>

                      <strong>
                        {
                          period.shiftsCount
                        }
                      </strong>
                    </div>

                    <div>
                      <Users
                        size={18}
                        aria-hidden="true"
                      />

                      <span>
                        הגישו
                      </span>

                      <strong>
                        {
                          period.submittedCount
                        }
                        /
                        {
                          period.submissionsCount
                        }
                      </strong>
                    </div>
                  </div>

                  <dl className="morning-driver-period-details">
                    <div>
                      <dt>
                        מועד אחרון
                      </dt>

                      <dd>
                        {
                          formatDateTime(
                            period.submissionDeadline,
                          )
                        }
                      </dd>
                    </div>

                    <div>
                      <dt>
                        נוצר
                      </dt>

                      <dd>
                        {
                          formatDateTime(
                            period.createdAt,
                          )
                        }
                      </dd>
                    </div>
                  </dl>

                  {period.instructions ? (
                    <div className="morning-driver-period-instructions">
                      {
                        period.instructions
                      }
                    </div>
                  ) : null}

                  {canManage ? (
                    <footer className="morning-driver-period-actions">
                      {period.status ===
                      'draft' ? (
                        <>
                          <button
                            type="button"
                            className="morning-driver-open-button"
                            disabled={
                              isBusy
                            }
                            onClick={() => {
                              void handleOpenPeriod(
                                period,
                              );
                            }}
                          >
                            {isOpening ? (
                              <LoaderCircle
                                size={17}
                                className="morning-driver-spin"
                                aria-hidden="true"
                              />
                            ) : (
                              <Unlock
                                size={17}
                                aria-hidden="true"
                              />
                            )}

                            {isOpening
                              ? 'פותח...'
                              : 'פתיחה להגשה'}
                          </button>

                          <button
                            type="button"
                            className="morning-driver-delete-button"
                            disabled={
                              isBusy
                            }
                            onClick={() => {
                              void handleDeletePeriod(
                                period,
                              );
                            }}
                          >
                            {isDeleting ? (
                              <LoaderCircle
                                size={17}
                                className="morning-driver-spin"
                                aria-hidden="true"
                              />
                            ) : (
                              <Trash2
                                size={17}
                                aria-hidden="true"
                              />
                            )}

                            {isDeleting
                              ? 'מוחק...'
                              : 'מחיקת טיוטה'}
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          className="morning-driver-management-button"
                          disabled={
                            managementState.isLoading
                          }
                          onClick={() => {
                            void handleOpenManagement(
                              period,
                            );
                          }}
                        >
                          <ClipboardCheck
                            size={17}
                            aria-hidden="true"
                          />

                          מעקב הגשות
                        </button>
                      )}
                    </footer>
                  ) : null}
                </article>
              );
            },
          )}
        </div>
      )}

      {isCreateDialogOpen ? (
        <div
          className="morning-driver-dialog-backdrop"
          role="presentation"
          onMouseDown={(
            event,
          ) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              closeCreateDialog();
            }
          }}
        >
          <section
            className="morning-driver-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="morning-driver-create-title"
          >
            <header className="morning-driver-dialog-header">
              <div>
                <h2 id="morning-driver-create-title">
                  פתיחת חודש אילוצים
                </h2>

                <p>
                  יצירת המשמרות מתבצעת אוטומטית לפי חוקי כונני הבוקר.
                </p>
              </div>

              <button
                type="button"
                aria-label="סגירת החלון"
                disabled={
                  state.isCreating
                }
                onClick={
                  closeCreateDialog
                }
              >
                <X
                  size={20}
                  aria-hidden="true"
                />
              </button>
            </header>

            <form
              className="morning-driver-create-form"
              onSubmit={
                handleCreatePeriod
              }
            >
              {formError ? (
                <div
                  className="morning-driver-form-error"
                  role="alert"
                >
                  {formError}
                </div>
              ) : null}

              <div className="morning-driver-form-grid">
                <label>
                  <span>
                    שנה
                  </span>

                  <input
                    type="number"
                    min="2020"
                    max="2100"
                    value={
                      formState.year
                    }
                    disabled={
                      state.isCreating
                    }
                    onChange={(
                      event,
                    ) => {
                      setFormState(
                        (
                          currentState,
                        ) => ({
                          ...currentState,

                          year:
                            event.target.value,
                        }),
                      );
                    }}
                    required
                  />
                </label>

                <label>
                  <span>
                    חודש
                  </span>

                  <select
                    value={
                      formState.month
                    }
                    disabled={
                      state.isCreating
                    }
                    onChange={(
                      event,
                    ) => {
                      // nextMonth — חודש.
                      const nextMonth =
                        Number(
                          event.target.value,
                        );

                      setFormState(
                        (
                          currentState,
                        ) => ({
                          ...currentState,

                          month:
                            event.target.value,

                          title:
                            `אילוצי כונני בוקר ${HEBREW_MONTHS[nextMonth - 1]} ${currentState.year}`,
                        }),
                      );
                    }}
                  >
                    {HEBREW_MONTHS.map(
                      (
                        monthName,
                        monthIndex,
                      ) => (
                        <option
                          key={
                            monthName
                          }
                          value={
                            monthIndex + 1
                          }
                        >
                          {
                            monthName
                          }
                        </option>
                      ),
                    )}
                  </select>
                </label>
              </div>

              <label>
                <span>
                  כותרת
                </span>

                <input
                  type="text"
                  value={
                    formState.title
                  }
                  disabled={
                    state.isCreating
                  }
                  onChange={(
                    event,
                  ) => {
                    setFormState(
                      (
                        currentState,
                      ) => ({
                        ...currentState,

                        title:
                          event.target.value,
                      }),
                    );
                  }}
                />
              </label>

              <label>
                <span>
                  מועד אחרון להגשה
                </span>

                <input
                  type="datetime-local"
                  value={
                    formState
                      .submissionDeadline
                  }
                  disabled={
                    state.isCreating
                  }
                  onChange={(
                    event,
                  ) => {
                    setFormState(
                      (
                        currentState,
                      ) => ({
                        ...currentState,

                        submissionDeadline:
                          event.target.value,
                      }),
                    );

                    setFormError(
                      null,
                    );
                  }}
                  required
                />
              </label>

              <label>
                <span>
                  הנחיות
                </span>

                <textarea
                  rows={4}
                  value={
                    formState.instructions
                  }
                  disabled={
                    state.isCreating
                  }
                  onChange={(
                    event,
                  ) => {
                    setFormState(
                      (
                        currentState,
                      ) => ({
                        ...currentState,

                        instructions:
                          event.target.value,
                      }),
                    );
                  }}
                />
              </label>

              <div className="morning-driver-created-shifts-preview">
                <strong>
                  המשמרות שייווצרו:
                </strong>

                <span>
                  א׳–ה׳: משמרת בוקר שבה שני כוננים מומלצים אך כונן אחד מספיק, ומשמרת ערב לכונן אחד; שישי: משמרת אחת; שבת: ללא משמרת.
                </span>
              </div>

              <footer className="morning-driver-dialog-actions">
                <button
                  type="button"
                  className="morning-driver-secondary-button"
                  disabled={
                    state.isCreating
                  }
                  onClick={
                    closeCreateDialog
                  }
                >
                  ביטול
                </button>

                <button
                  type="submit"
                  className="morning-driver-primary-button"
                  disabled={
                    state.isCreating
                  }
                >
                  {state.isCreating ? (
                    <LoaderCircle
                      size={18}
                      className="morning-driver-spin"
                      aria-hidden="true"
                    />
                  ) : (
                    <Plus
                      size={18}
                      aria-hidden="true"
                    />
                  )}

                  {state.isCreating
                    ? 'יוצר חודש...'
                    : 'יצירת חודש'}
                </button>
              </footer>
            </form>
          </section>
        </div>
      ) : null}
    </section>
  );
}

export default MorningDriverAvailabilityPage;