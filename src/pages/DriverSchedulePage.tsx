import {
  CalendarDays,
  CalendarPlus,
  CalendarRange,
  List,
  CheckCircle2,
  ClipboardList,
  RefreshCw,
  Send,
  FileSpreadsheet,
  ShieldCheck,
  Trash2,
  UnlockKeyhole,
} from 'lucide-react';
import ScheduleImportPanel
  from '../components/scheduleImport/ScheduleImportPanel';

import DriverScheduleCalendar
  from '../components/driverSchedule/DriverScheduleCalendar';
import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from 'react';
import DriverScheduleDayEditor
  from '../components/driverSchedule/DriverScheduleDayEditor';
import {
  useAuth,
} from '../auth/AuthContext';
import {
  useDriverScheduleDraft,
} from '../hooks/useDriverScheduleDraft';
import {
  Button,
  PageHeader,
} from '../components/ui';

import {
  useDriverAvailabilityPeriods,
} from '../hooks/useDriverAvailabilityPeriods';

import type {
  DriverAvailabilityPeriodStatus,
} from '../types/driverAvailability';

import '../styles/driverSchedule.css';
import MyDriverAvailabilityPanel
  from '../components/driverAvailability/MyDriverAvailabilityPanel';
import DriverAvailabilityManagementPanel
  from '../components/driverAvailability/DriverAvailabilityManagementPanel';

import {
  useDriverAvailabilityManagement,
} from '../hooks/useDriverAvailabilityManagement';
import {
  useMyDriverAvailability,
} from '../hooks/useMyDriverAvailability';

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

const periodStatusLabels: Record<
  DriverAvailabilityPeriodStatus,
  string
> = {
  draft: 'טיוטה',
  open: 'פתוח להגשה',
  closed: 'סגור',
  archived: 'בארכיון',
};

type DriverScheduleWorkspaceTab =
  | 'schedule'
  | 'periods'
  | 'submissions'
  | 'create-period'
  | 'import-data'
  | 'my-availability';

interface DriverScheduleWorkspaceTabDefinition {
  id: DriverScheduleWorkspaceTab;
  label: string;
  description: string;
  icon: typeof CalendarDays;
  isVisible: boolean;
}

function getDefaultPeriod(): {
  month: number;
  year: number;
} {
  const now =
    new Date();

  const nextMonthDate =
    new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      1,
    );

  return {
    month:
      nextMonthDate.getMonth() + 1,

    year:
      nextMonthDate.getFullYear(),
  };
}

function formatDate(
  value: string | null,
): string {
  if (!value) {
    return 'לא הוגדר';
  }

  const date =
    new Date(value);

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
      dateStyle: 'short',
      timeStyle: 'short',
    },
  ).format(date);
}

function DriverSchedulePage() {
  const {
    user:
      authenticatedUser,

    hasPermission,
  } =
    useAuth();

  const canSubmitAvailability =
    hasPermission(
      'driver_availability.view',
    );

  const canManageAvailability =
    hasPermission(
      'driver_availability.manage',
    );

  const canViewPersonalSchedule =
    hasPermission(
      'driver_schedule.view',
    );

  const canViewTeamSchedule =
    hasPermission(
      'driver_schedule.view_team',
    );
  const {
    state:
      scheduleDraftState,

    loadLatestSchedule,

    loadScheduleByMonth,

    createDraft:
      createDriverScheduleDraft,

    updateScheduleDay,

    publishSchedule,

    clearError:
      clearScheduleDraftError,
  } =
    useDriverScheduleDraft();
  const canEditSchedule =
    hasPermission(
      'driver_schedule.edit',
    );

  const defaultPeriod =
    useMemo(
      () =>
        getDefaultPeriod(),
      [],
    );

  const [
    selectedMonth,
    setSelectedMonth,
  ] =
    useState(
      defaultPeriod.month,
    );

  const [
    selectedYear,
    setSelectedYear,
  ] =
    useState(
      defaultPeriod.year,
    );

  const [
    title,
    setTitle,
  ] =
    useState('');

  const [
    instructions,
    setInstructions,
  ] =
    useState('');

  const [
    submissionDeadline,
    setSubmissionDeadline,
  ] =
    useState('');

  const {
    state,
    loadPeriods,
    createPeriod,
    openPeriod,
    closePeriod,
    reopenPeriod,
    deletePeriod,
    clearError,
    reset,
  } =
    useDriverAvailabilityPeriods();
const {
  state: myAvailabilityState,
  draftEntries:
    myAvailabilityDraftEntries,
  loadMyAvailability,
  setDayStatus,
  setDayNote,
  saveMyAvailability,
    markAllAvailable,
  submitMyAvailability,
} =
  useMyDriverAvailability();
const {
  state:
    managementState,

  loadManagementData,
} =
  useDriverAvailabilityManagement();

const [
  selectedManagementPeriodId,
  setSelectedManagementPeriodId,
] =
  useState<string | null>(
    null,
  );


const [
  activeWorkspaceTab,
  setActiveWorkspaceTab,
] =
  useState<DriverScheduleWorkspaceTab>(
    canSubmitAvailability &&
    !canManageAvailability
      ? 'my-availability'
      : 'schedule',
  );
  const now =
  new Date();

const [
  viewedScheduleMonth,
  setViewedScheduleMonth,
] =
  useState({
    year:
      now.getFullYear(),

    month:
      now.getMonth() + 1,
  });
  const [
  scheduleViewMode,
  setScheduleViewMode,
] =
  useState<DriverScheduleViewMode>(
    'calendar',
  );
  const availableYears =
    useMemo(
      () => {
        const currentYear =
          new Date()
            .getFullYear();

        return [
          currentYear,
          currentYear + 1,
          currentYear + 2,
        ];
      },
      [],
    );

useEffect(() => {
  if (canManageAvailability) {
    void loadPeriods();
  }

  if (canSubmitAvailability) {
    void loadMyAvailability();
  }

if (
  canViewPersonalSchedule ||
  canViewTeamSchedule ||
  canEditSchedule
) {
  const currentDate =
    new Date();

  void loadScheduleByMonth(
    currentDate.getFullYear(),
    currentDate.getMonth() + 1,
  );
}
}, [
  canManageAvailability,
  canSubmitAvailability,
  canViewPersonalSchedule,
  canViewTeamSchedule,
  canEditSchedule,
  loadPeriods,
  loadMyAvailability,
  loadScheduleByMonth,
]);

  const handleCreatePeriod =
    async (
      event:
        FormEvent<HTMLFormElement>,
    ): Promise<void> => {
      event.preventDefault();

      if (
        !canManageAvailability ||
        state.isCreating
      ) {
        return;
      }

      clearError();

      try {
        await createPeriod({
          year:
            selectedYear,

          month:
            selectedMonth,

          title:
            title.trim() ||
            null,

          instructions:
            instructions.trim() ||
            null,

          submissionDeadline:
            submissionDeadline
              ? new Date(
                  submissionDeadline,
                ).toISOString()
              : null,
        });

        setTitle('');
        setInstructions('');
        setSubmissionDeadline('');
      } catch {
        /*
         * השגיאה נשמרת ב-Hook.
         */
      }
    };

  const handleOpenPeriod =
    async (
      periodId: string,
      periodTitle: string,
    ): Promise<void> => {
      if (
        !canManageAvailability ||
        state.openingPeriodId
      ) {
        return;
      }

      const confirmed =
        window.confirm(
          `האם לפתוח את "${periodTitle}" להגשת אילוצים?\n\n` +
          'לאחר הפתיחה הכוננים יוכלו לסמן את הזמינות שלהם לכל יום בחודש.',
        );

      if (!confirmed) {
        return;
      }

      clearError();

      try {
        await openPeriod(
          periodId,
        );
                    setSelectedManagementPeriodId(
              periodId,
            );

            void loadManagementData(
              periodId,
            );
      } catch {
        /*
         * השגיאה נשמרת ב-Hook.
         */
      }
    };
const handleClosePeriod =
  async (
    periodId: string,
    periodTitle: string,
  ): Promise<void> => {
    if (
      !canManageAvailability ||
      state.closingPeriodId
    ) {
      return;
    }

    const confirmed =
      window.confirm(
        `האם לסגור את "${periodTitle}" להגשת אילוצים?\n\n` +
        'לאחר הסגירה הכוננים לא יוכלו לערוך או להגיש אילוצים.',
      );

    if (!confirmed) {
      return;
    }

    clearError();

    try {
      await closePeriod(
        periodId,
        false,
      );

      setSelectedManagementPeriodId(
        periodId,
      );

      await loadManagementData(
        periodId,
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
              .trim()
              .toLowerCase()
          : '';

      if (
        !errorMessage.includes(
          'not all active drivers submitted availability',
        )
      ) {
        return;
      }

      const forceConfirmed =
        window.confirm(
          'לא כל הכוננים הפעילים הגישו אילוצים.\n\n' +
          'האם לסגור את החודש בכל זאת?',
        );

      if (!forceConfirmed) {
        return;
      }

      try {
        await closePeriod(
          periodId,
          true,
        );

        setSelectedManagementPeriodId(
          periodId,
        );

        await loadManagementData(
          periodId,
        );
      } catch {
        /*
         * הודעת השגיאה נשמרת בתוך ה-Hook.
         */
      }
    }
  };

  const handleReopenPeriod =
    async (
      periodId: string,
      periodTitle: string,
    ): Promise<void> => {
      if (
        !canManageAvailability ||
        state.reopeningPeriodId
      ) {
        return;
      }

      const confirmed =
        window.confirm(
          `האם לפתוח מחדש את "${periodTitle}" להגשת אילוצים?\n\n` +
          'הכוננים יוכלו שוב לערוך, לשמור ולהגיש את הזמינות שלהם.',
        );

      if (!confirmed) {
        return;
      }

      clearError();

      try {
        await reopenPeriod(
          periodId,
        );

        setSelectedManagementPeriodId(
          periodId,
        );

        await loadManagementData(
          periodId,
        );
      } catch {
        /*
         * השגיאה נשמרת בתוך ה-Hook.
         */
      }
    };

  const handleDeletePeriod =
    async (
      periodId: string,
      periodTitle: string,
    ): Promise<void> => {
      if (
        !canManageAvailability ||
        state.deletingPeriodId
      ) {
        return;
      }

      const firstConfirmation =
        window.confirm(
          `האם למחוק את "${periodTitle}"?\n\n` +
          'הפעולה תמחק את כל ימי הכוננות, סימוני הזמינות וההגשות של החודש.',
        );

      if (!firstConfirmation) {
        return;
      }

      const finalConfirmation =
        window.confirm(
          'אישור אחרון: לא ניתן לבטל את המחיקה.\n\nהאם להמשיך?',
        );

      if (!finalConfirmation) {
        return;
      }

      clearError();

      try {
        await deletePeriod(
          periodId,
        );

        if (
          selectedManagementPeriodId ===
          periodId
        ) {
          setSelectedManagementPeriodId(
            null,
          );
        }
      } catch {
        /*
         * השגיאה נשמרת בתוך ה-Hook.
         */
      }
    };

  const handleCreateScheduleDraft =
  async (
    availabilityPeriodId: string,
    periodTitle: string,
  ): Promise<void> => {
    if (
      !canEditSchedule ||
      scheduleDraftState.isCreating
    ) {
      return;
    }

    const confirmed =
      window.confirm(
        `האם ליצור טיוטת לוח כוננים עבור "${periodTitle}"?\n\n` +
        'המערכת תתחשב בזמינות, תאסור כוננות ביומיים רצופים ותעדיף מרווח של חמישה ימים.',
      );

    if (!confirmed) {
      return;
    }

    clearScheduleDraftError();

    try {
      await createDriverScheduleDraft(
        availabilityPeriodId,
      );
    } catch {
      /*
       * הודעת השגיאה נשמרת
       * בתוך useDriverScheduleDraft.
       */
    }
  };
  const createdPeriodTitle =
    state.lastCreatedResult
      ? (
          state
            .lastCreatedResult
            .title ??
          `${
            hebrewMonths[
              state
                .lastCreatedResult
                .month - 1
            ]
          } ${
            state
              .lastCreatedResult
              .year
          }`
        )
      : null;

  const openedPeriodTitle =
    state.lastOpenedResult
      ? `${
          hebrewMonths[
            state
              .lastOpenedResult
              .month - 1
          ]
        } ${
          state
            .lastOpenedResult
            .year
        }`
      : null;

  const hasAnyScheduleAccess =
    canViewPersonalSchedule ||
    canViewTeamSchedule ||
    canEditSchedule;
type DriverScheduleViewMode =
  | 'calendar'
  | 'list';
const workspaceTabs =
  useMemo<DriverScheduleWorkspaceTabDefinition[]>(
    () => [
      {
        id: 'schedule',
        label: 'לוח כוננים',
        description: 'צפייה, עריכה ופרסום של לוח הכוננים',
        icon: ClipboardList,
        isVisible: hasAnyScheduleAccess,
      },
      {
        id: 'periods',
        label: 'ניהול חודשים',
        description: 'פתיחה, סגירה וניהול של תקופות אילוצים',
        icon: CalendarDays,
        isVisible: canManageAvailability,
      },
      {
        id: 'submissions',
        label: 'מעקב הגשות',
        description: 'סטטוס כוננים ומטריצת זמינות',
        icon: CheckCircle2,
        isVisible: canManageAvailability,
      },
      {
        id: 'create-period',
        label: 'יצירת חודש',
        description: 'יצירת תקופת אילוצים חדשה',
        icon: CalendarPlus,
        isVisible: canManageAvailability,
      },
      {
        id: 'import-data',
        label: 'ייבוא נתונים',
        description: 'ייבוא לוחות שיבוץ וכוננויות מקובצי Excel',
        icon: FileSpreadsheet,
        isVisible: canManageAvailability,
      },
      {
        id: 'my-availability',
        label: 'האילוצים שלי',
        description: 'סימון ושמירת הזמינות האישית',
        icon: CalendarDays,
        isVisible: canSubmitAvailability,
      },
    ],
    [
      hasAnyScheduleAccess,
      canManageAvailability,
      canSubmitAvailability,
    ],
  );

const visibleWorkspaceTabs =
  workspaceTabs.filter(
    (tab) => tab.isVisible,
  );

const effectiveWorkspaceTab =
  visibleWorkspaceTabs.some(
    (tab) =>
      tab.id === activeWorkspaceTab,
  )
    ? activeWorkspaceTab
    : visibleWorkspaceTabs[0]?.id ??
      'schedule';

const isBusy =
  state.isLoading ||
  state.isCreating ||
  state.openingPeriodId !==
    null ||
  state.closingPeriodId !==
    null ||
  state.reopeningPeriodId !==
    null ||
  state.deletingPeriodId !==
    null ||
  scheduleDraftState.isLoading ||
  scheduleDraftState.isPublishing ||
  scheduleDraftState.isCreating;

  return (
    <section className="driver-schedule-page">
      <PageHeader
        title="לוח כוננים"
        description="אילוצי זמינות, יצירת שיבוץ וצפייה בלוח הכוננים."
        actions={
          <Button
            type="button"
            variant="secondary"
            disabled={
              isBusy
            }
            onClick={() => {
              if (canManageAvailability) {
                void loadPeriods();
              }

              if (canSubmitAvailability) {
                void loadMyAvailability();
              }

              if (hasAnyScheduleAccess) {
                void loadLatestSchedule();
              }
            }}
          >
            <RefreshCw
              size={17}
              aria-hidden="true"
            />
            {isBusy
              ? 'טוען...'
              : 'רענון'}
          </Button>
        }
      />

      <section className="driver-schedule-access-summary">
        <div className="driver-schedule-access-heading">
          <ShieldCheck
            size={22}
            aria-hidden="true"
          />

          <div>
            <strong>
              הגישה שלך למערכת הכוננים
            </strong>

            <span>
              האפשרויות במסך מוצגות לפי
              ההרשאות שהוגדרו למשתמש.
            </span>
          </div>
        </div>

        <div className="driver-schedule-access-badges">
          {canSubmitAvailability ? (
            <span>
              הגשת אילוצים
            </span>
          ) : null}

          {canManageAvailability ? (
            <span>
              ניהול אילוצים
            </span>
          ) : null}

          {canViewPersonalSchedule ? (
            <span>
              צפייה בלוח אישי
            </span>
          ) : null}

          {canViewTeamSchedule ? (
            <span>
              צפייה בלוח צוות
            </span>
          ) : null}
          {canEditSchedule ? (
            <span>
              עריכת לוח
            </span>
          ) : null}
        </div>
      </section>

      {visibleWorkspaceTabs.length > 1 ? (
        <nav
          className="driver-schedule-workspace-tabs"
          aria-label="אזורי מערכת הכוננים"
        >
          {visibleWorkspaceTabs.map(
            (tab) => {
              const Icon = tab.icon;
              const isActive =
                effectiveWorkspaceTab ===
                tab.id;

              return (
                <button
                  key={tab.id}
                  type="button"
                  className={[
                    'driver-schedule-workspace-tab',
                    isActive
                      ? 'driver-schedule-workspace-tab-active'
                      : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  aria-current={
                    isActive
                      ? 'page'
                      : undefined
                  }
                  onClick={() => {
                    setActiveWorkspaceTab(
                      tab.id,
                    );
                  }}
                >
                  <span className="driver-schedule-workspace-tab-icon">
                    <Icon
                      size={20}
                      aria-hidden="true"
                    />
                  </span>

                  <span className="driver-schedule-workspace-tab-content">
                    <strong>
                      {tab.label}
                    </strong>

                    <small>
                      {tab.description}
                    </small>
                  </span>
                </button>
              );
            },
          )}
        </nav>
      ) : null}

      {state.error ? (
        <div
          className="driver-schedule-error"
          role="alert"
        >
          <div>
            <strong>
              לא ניתן היה לבצע את הפעולה
            </strong>

            <span>
              {state.error}
            </span>
          </div>

          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              reset();

              if (canManageAvailability) {
                void loadPeriods();
              }
            }}
          >
            ניסיון נוסף
          </Button>
        </div>
      ) : null}
      {scheduleDraftState.error ? (
        <div
          className="driver-schedule-error"
          role="alert"
        >
          <div>
            <strong>
              לא ניתן היה לטעון או ליצור
              את לוח הכוננים
            </strong>

            <span>
              {scheduleDraftState.error}
            </span>
          </div>

          <Button
            type="button"
            variant="secondary"
            disabled={
              scheduleDraftState.isLoading
            }
            onClick={() => {
              void loadLatestSchedule();
            }}
          >
            ניסיון נוסף
          </Button>
        </div>
      ) : null}
      {state.lastCreatedResult ? (
        <div
          className="driver-schedule-success"
          role="status"
        >
          <CheckCircle2
            size={23}
            aria-hidden="true"
          />

          <div>
            <strong>
              חודש אילוצי הכוננים נוצר
              בהצלחה
            </strong>

            <span>
              נוצרה התקופה{' '}
              <b>
                {createdPeriodTitle}
              </b>{' '}
              עם{' '}
              {
                state
                  .lastCreatedResult
                  .createdDays
              }{' '}
              ימי כוננות.
            </span>
          </div>
        </div>
      ) : null}
{scheduleDraftState.lastCreatedResult  ? (
  <div
    className="driver-schedule-success"
    role="status"
  >
    <CheckCircle2
      size={23}
      aria-hidden="true"
    />

    <div>
      <strong>
        טיוטת לוח הכוננים נוצרה
        בהצלחה
      </strong>

      <span>
        שובצו{' '}
        {
          scheduleDraftState
            .lastCreatedResult 
            .assignedDays
        }{' '}
        מתוך{' '}
        {
          scheduleDraftState
            .lastCreatedResult 
            .createdDays
        }{' '}
        ימים.

        {scheduleDraftState
          .lastCreatedResult 
          .unassignedDays > 0 ? (
          <>
            {' '}
            {
              scheduleDraftState
                .lastCreatedResult 
                .unassignedDays
            }{' '}
            ימים נשארו ללא כונן.
          </>
        ) : null}

        {scheduleDraftState
          .lastCreatedResult 
          .warningCount > 0 ? (
          <>
            {' '}
            קיימות{' '}
            {
              scheduleDraftState
                .lastCreatedResult 
                .warningCount
            }{' '}
            אזהרות מרווח קצר.
          </>
        ) : null}
      </span>
    </div>
  </div>
) : null}
      {scheduleDraftState.lastPublishedResult ? (
        <div
          className="driver-schedule-success"
          role="status"
        >
          <CheckCircle2
            size={23}
            aria-hidden="true"
          />

          <div>
            <strong>
              לוח הכוננים פורסם בהצלחה
            </strong>

            <span>
              פורסמו{' '}
              {
                scheduleDraftState
                  .lastPublishedResult
                  .assignedDays
              }{' '}
              ימי כוננות.
            </span>
          </div>
        </div>
      ) : null}
      {state.lastOpenedResult ? (
        <div
          className="driver-schedule-success"
          role="status"
        >
          <CheckCircle2
            size={23}
            aria-hidden="true"
          />

          <div>
            <strong>
              חודש האילוצים נפתח להגשה
            </strong>

            <span>
              התקופה{' '}
              <b>
                {openedPeriodTitle}
              </b>{' '}
              פתוחה כעת עבור הכוננים.
            </span>
          </div>
        </div>
      ) : null}
      {state.lastClosedResult ? (
        <div
          className="driver-schedule-success"
          role="status"
        >
          <CheckCircle2
            size={23}
            aria-hidden="true"
          />

          <div>
            <strong>
              חודש האילוצים נסגר בהצלחה
            </strong>

            <span>
              {
                state
                  .lastClosedResult
                  .submittedDrivers
              }{' '}
              מתוך{' '}
              {
                state
                  .lastClosedResult
                  .totalDrivers
              }{' '}
              כוננים הגישו אילוצים.

              {state
                .lastClosedResult
                .forced ? (
                <>
                  {' '}
                  החודש נסגר בסגירה
                  כפויה.
                </>
              ) : null}
            </span>
          </div>
        </div>
      ) : null}
      {state.lastReopenedResult ? (
        <div
          className="driver-schedule-success"
          role="status"
        >
          <UnlockKeyhole
            size={23}
            aria-hidden="true"
          />

          <div>
            <strong>
              חודש האילוצים נפתח מחדש
            </strong>

            <span>
              הכוננים יכולים כעת לערוך ולהגיש מחדש את האילוצים שלהם.
            </span>
          </div>
        </div>
      ) : null}

      {state.lastDeletedResult ? (
        <div
          className="driver-schedule-success"
          role="status"
        >
          <Trash2
            size={23}
            aria-hidden="true"
          />

          <div>
            <strong>
              חודש האילוצים נמחק
            </strong>

            <span>
              נמחקו{' '}
              {
                state
                  .lastDeletedResult
                  .deletedDays
              }{' '}
              ימי כוננות ו־
              {
                state
                  .lastDeletedResult
                  .deletedSubmissions
              }{' '}
              הגשות.
            </span>
          </div>
        </div>
      ) : null}

      {canManageAvailability &&
      effectiveWorkspaceTab ===
        'periods' ? (
        <>
          <section className="driver-availability-periods-card">
            <header className="driver-schedule-section-header">
              <span className="driver-schedule-section-icon">
                <CalendarDays
                  size={22}
                  aria-hidden="true"
                />
              </span>

              <div>
                <h2>
                  חודשי אילוצי כוננים
                </h2>

                <p>
                  צפייה בתקופות שנוצרו
                  ופתיחת חודש להגשה.
                </p>
              </div>
            </header>

            {state.isLoading ? (
              <div className="driver-schedule-empty-state">
                <RefreshCw
                  size={28}
                  aria-hidden="true"
                />

                <strong>
                  טוען חודשים...
                </strong>
              </div>
            ) : state.periods.length ===
              0 ? (
              <div className="driver-schedule-empty-state">
                <CalendarDays
                  size={30}
                  aria-hidden="true"
                />

                <strong>
                  עדיין לא נוצרו חודשים
                </strong>

                <span>
                  צור חודש אילוצים חדש
                  באמצעות הטופס שבהמשך.
                </span>
              </div>
            ) : (
              <div className="driver-availability-periods-list">
                {state.periods.map(
                  (period) => {
                    const periodTitle =
                      period.title ??
                      `${
                        hebrewMonths[
                          period.month - 1
                        ]
                      } ${period.year}`;

                    return (
                      <article
                        key={
                          period.id
                        }
                        className="driver-availability-period-item"
                      >
                        <div className="driver-availability-period-main">
                          <strong>
                            {periodTitle}
                          </strong>

                          <span>
                            {
                              period
                                .daysCount
                            }{' '}
                            ימי כוננות
                          </span>

                          <span>
                            מועד אחרון:{' '}
                            {formatDate(
                              period
                                .submissionDeadline,
                            )}
                          </span>

                          {period.openedAt ? (
                            <span>
                              נפתח:{' '}
                              {formatDate(
                                period
                                  .openedAt,
                              )}
                            </span>
                          ) : null}
                        </div>

                        <div className="driver-availability-period-actions">
                          <span
                            className={`driver-availability-status driver-availability-status-${period.status}`}
                          >
                            {
                              periodStatusLabels[
                                period.status
                              ]
                            }
                          </span>

                          {period.status ===
                              'draft' ? (
                                <Button
                                  type="button"
                                  disabled={
                                    isBusy
                                  }
                                  onClick={() => {
                                    void handleOpenPeriod(
                                      period.id,
                                      periodTitle,
                                    );
                                  }}
                                >
                                  <Send
                                    size={17}
                                    aria-hidden="true"
                                  />

                                  {state.openingPeriodId ===
                                  period.id
                                    ? 'פותח להגשה...'
                                    : 'פתיחה להגשה'}
                                </Button>
                              ) : null}

                              <Button
                                type="button"
                                variant="secondary"
                                disabled={
                                  managementState.isLoading &&
                                  selectedManagementPeriodId ===
                                    period.id
                                }
                                onClick={() => {
                                  setSelectedManagementPeriodId(
                                    period.id,
                                  );

                                  setActiveWorkspaceTab(
                                    'submissions',
                                  );

                                  void loadManagementData(
                                    period.id,
                                  );
                                }}
                              >
                                {managementState.isLoading &&
                                selectedManagementPeriodId ===
                                  period.id
                                  ? 'טוען ניהול...'
                                  : 'ניהול'}
                              </Button>
                                {period.status ===
                                'open' ? (
                                  <>
                                    <span className="driver-availability-open-note">
                                      הכוננים יכולים
                                      להגיש אילוצים
                                    </span>

                                    <Button
                                      type="button"
                                      variant="secondary"
                                      disabled={
                                        isBusy
                                      }
                                      onClick={() => {
                                        void handleClosePeriod(
                                          period.id,
                                          periodTitle,
                                        );
                                      }}
                                    >
                                      {state.closingPeriodId ===
                                      period.id
                                        ? 'סוגר הגשות...'
                                        : 'סגירת הגשות'}
                                    </Button>
                                  </>
                                ) : null}

                          {period.status ===
                          'closed' ? (
                            <Button
                              type="button"
                              variant="secondary"
                              disabled={
                                isBusy
                              }
                              onClick={() => {
                                void handleReopenPeriod(
                                  period.id,
                                  periodTitle,
                                );
                              }}
                            >
                              <UnlockKeyhole
                                size={17}
                                aria-hidden="true"
                              />

                              {state.reopeningPeriodId ===
                              period.id
                                ? 'פותח מחדש...'
                                : 'פתיחה מחדש'}
                            </Button>
                          ) : null}

                          {period.status !==
                          'archived' ? (
                            <Button
                              type="button"
                              variant="secondary"
                              disabled={
                                isBusy
                              }
                              onClick={() => {
                                void handleDeletePeriod(
                                  period.id,
                                  periodTitle,
                                );
                              }}
                            >
                              <Trash2
                                size={17}
                                aria-hidden="true"
                              />

                              {state.deletingPeriodId ===
                              period.id
                                ? 'מוחק חודש...'
                                : 'מחיקת חודש'}
                            </Button>
                          ) : null}

                          {period.status ===
                          'closed' ? (
                            <span className="driver-availability-submission-summary">
                              {
                                period
                                  .submittedCount
                              }{' '}
                              מתוך{' '}
                              {
                                period
                                  .submissionsCount
                              }{' '}
                              הגישו
                            </span>
                          ) : null}
                          {period.status ===
                            'closed' &&
                          canEditSchedule ? (
                            <Button
                              type="button"
                              disabled={
                                isBusy
                              }
                              onClick={() => {
                                void handleCreateScheduleDraft(
                                  period.id,
                                  periodTitle,
                                );
                              }}
                            >
                              <ClipboardList
                                size={17}
                                aria-hidden="true"
                              />

                              {scheduleDraftState.isCreating
                                ? 'יוצר טיוטת שיבוץ...'
                                : 'יצירת טיוטת שיבוץ'}
                            </Button>
                          ) : null}
                        </div>
                      </article>
                    );
                  },
                )}
              </div>
            )}
          </section>
        </>
      ) : null}

      {canManageAvailability &&
      effectiveWorkspaceTab ===
        'submissions' ? (
        selectedManagementPeriodId ? (
            <DriverAvailabilityManagementPanel
              data={
                managementState.data
              }
              isLoading={
                managementState.isLoading
              }
              error={
                managementState.error
              }
              onRefresh={() => {
                void loadManagementData(
                  selectedManagementPeriodId,
                );
              }}
            />
        ) : (
          <section className="driver-schedule-placeholder-card">
            <CheckCircle2
              size={31}
              aria-hidden="true"
            />

            <div>
              <strong>
                בחר חודש למעקב
              </strong>

              <span>
                עבור לניהול חודשים ולחץ על ניהול בחודש הרצוי.
              </span>
            </div>
          </section>
        )
      ) : null}

      {canManageAvailability &&
      effectiveWorkspaceTab ===
        'create-period' ? (
          <section className="driver-availability-management-card">
            <header className="driver-schedule-section-header">
              <span className="driver-schedule-section-icon">
                <CalendarPlus
                  size={22}
                  aria-hidden="true"
                />
              </span>

              <div>
                <h2>
                  יצירת חודש אילוצים
                </h2>

                <p>
                  יצירת יום כוננות מלא
                  עבור כל תאריך בחודש.
                </p>
              </div>
            </header>

            <form
              className="driver-availability-create-form"
              onSubmit={
                handleCreatePeriod
              }
            >
              <div className="driver-availability-form-grid">
                <label>
                  <span>
                    חודש
                  </span>

                  <select
                    value={
                      selectedMonth
                    }
                    disabled={
                      state.isCreating
                    }
                    onChange={(
                      event,
                    ) => {
                      setSelectedMonth(
                        Number(
                          event
                            .target
                            .value,
                        ),
                      );
                    }}
                  >
                    {hebrewMonths.map(
                      (
                        monthName,
                        index,
                      ) => (
                        <option
                          key={
                            monthName
                          }
                          value={
                            index + 1
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

                <label>
                  <span>
                    שנה
                  </span>

                  <select
                    value={
                      selectedYear
                    }
                    disabled={
                      state.isCreating
                    }
                    onChange={(
                      event,
                    ) => {
                      setSelectedYear(
                        Number(
                          event
                            .target
                            .value,
                        ),
                      );
                    }}
                  >
                    {availableYears.map(
                      (year) => (
                        <option
                          key={
                            year
                          }
                          value={
                            year
                          }
                        >
                          {year}
                        </option>
                      ),
                    )}
                  </select>
                </label>

                <label>
                  <span>
                    מועד אחרון להגשה
                  </span>

                  <input
                    type="datetime-local"
                    value={
                      submissionDeadline
                    }
                    disabled={
                      state.isCreating
                    }
                    onChange={(
                      event,
                    ) => {
                      setSubmissionDeadline(
                        event
                          .target
                          .value,
                      );
                    }}
                  />
                </label>

                <label>
                  <span>
                    כותרת מותאמת
                  </span>

                  <input
                    type="text"
                    value={
                      title
                    }
                    disabled={
                      state.isCreating
                    }
                    placeholder="לדוגמה: אילוצי כוננים לספטמבר"
                    onChange={(
                      event,
                    ) => {
                      setTitle(
                        event
                          .target
                          .value,
                      );
                    }}
                  />
                </label>
              </div>

              <label className="driver-availability-instructions-field">
                <span>
                  הנחיות לכוננים
                </span>

                <textarea
                  rows={4}
                  value={
                    instructions
                  }
                  disabled={
                    state.isCreating
                  }
                  placeholder="לדוגמה: יש לסמן זמינות או אי־זמינות לכל יום בחודש."
                  onChange={(
                    event,
                  ) => {
                    setInstructions(
                      event
                        .target
                        .value,
                    );
                  }}
                />
              </label>

              <div className="driver-availability-create-actions">
                <Button
                  type="submit"
                  disabled={
                    state.isCreating
                  }
                >
                  <CalendarPlus
                    size={18}
                    aria-hidden="true"
                  />

                  {state.isCreating
                    ? 'יוצר חודש...'
                    : 'יצירת חודש אילוצים'}
                </Button>
              </div>
            </form>
          </section>
      ) : null}
      {canManageAvailability &&
      effectiveWorkspaceTab ===
        'import-data' ? (
        <ScheduleImportPanel
          disabled={
            isBusy
          }
        />
      ) : null}
      {canSubmitAvailability &&
      effectiveWorkspaceTab ===
        'my-availability' ? (
      <MyDriverAvailabilityPanel
        data={
          myAvailabilityState.data
        }
        draftEntries={
          myAvailabilityDraftEntries
        }
        isLoading={
          myAvailabilityState.isLoading
        }
        isSaving={
          myAvailabilityState.isSaving
        }
        isDirty={
          myAvailabilityState.isDirty
        }
        isSubmitting={
          myAvailabilityState.isSubmitting
        }
        error={
          myAvailabilityState.error
        }
        lastSaveResult={
          myAvailabilityState.lastSaveResult
        }
        lastSubmitResult={
          myAvailabilityState.lastSubmitResult
        }
        onSetDayStatus={
          setDayStatus
        }
        onSetDayNote={
          setDayNote
        }
                onMarkAllAvailable={
          markAllAvailable
        }
        onSave={() => {
          void saveMyAvailability();
        }}
        onSubmit={() => {
          const confirmed =
            window.confirm(
              'לאחר ההגשה לא יהיה ניתן לערוך את האילוצים ללא פתיחה מחדש על ידי מנהל.\n\nהאם להגיש את האילוצים?',
            );

          if (!confirmed) {
            return;
          }

          void submitMyAvailability();
        }}
        onRefresh={() => {
          void loadMyAvailability();
        }}
      />
      ) : null}

{hasAnyScheduleAccess &&
effectiveWorkspaceTab ===
  'schedule' ? (
  <section className="driver-schedule-view">
    <div className="driver-schedule-view-toolbar">
      <div>
        <strong>
          תצוגת לוח הכוננים
        </strong>

        <span>
          מעבר בין לוח חודשי
          לרשימת הניהול.
        </span>
      </div>

      <div className="driver-schedule-view-switcher">
        <button
          type="button"
          className={[
            'driver-schedule-view-button',

            scheduleViewMode ===
            'calendar'
              ? 'driver-schedule-view-button-active'
              : '',
          ]
            .filter(Boolean)
            .join(' ')}
          aria-pressed={
            scheduleViewMode ===
            'calendar'
          }
          onClick={() => {
            setScheduleViewMode(
              'calendar',
            );
          }}
        >
          <CalendarRange
            size={17}
            aria-hidden="true"
          />

          תצוגת חודש
        </button>

        {canEditSchedule ? (
          <button
            type="button"
            className={[
              'driver-schedule-view-button',

              scheduleViewMode ===
              'list'
                ? 'driver-schedule-view-button-active'
                : '',
            ]
              .filter(Boolean)
              .join(' ')}
            aria-pressed={
              scheduleViewMode ===
              'list'
            }
            onClick={() => {
              setScheduleViewMode(
                'list',
              );
            }}
          >
            <List
              size={17}
              aria-hidden="true"
            />

            רשימת עריכה
          </button>
        ) : null}
      </div>
    </div>

    {scheduleViewMode ===
    'calendar' ? (
        <DriverScheduleCalendar
          data={
            scheduleDraftState.data
          }
          viewedYear={
            viewedScheduleMonth.year
          }
          viewedMonth={
            viewedScheduleMonth.month
          }
          currentUserId={
            authenticatedUser?.id ??
            null
          }
          canViewTeamSchedule={
            canViewTeamSchedule
          }
          canEditSchedule={
            canEditSchedule
          }
          showManagementDetails={
            canManageAvailability
          }
          isLoading={
            scheduleDraftState.isLoading
          }
          onLoadMonth={async (
            year,
            month,
          ) => {
            setViewedScheduleMonth({
              year,
              month,
            });

            await loadScheduleByMonth(
              year,
              month,
            );
          }}
        />
    ) : scheduleDraftState.isLoading ? (
      <section className="driver-schedule-placeholder-card">
        <RefreshCw
          size={31}
          className="my-driver-availability-loading-icon"
          aria-hidden="true"
        />

        <div>
          <strong>
            טוען את לוח הכוננים
          </strong>

          <span>
            נא להמתין בזמן טעינת
            השיבוץ.
          </span>
        </div>
      </section>
    ) : scheduleDraftState.data?.period &&
      canEditSchedule ? (
      <section className="driver-schedule-draft-preview">
        <header className="driver-schedule-section-header">
          <span className="driver-schedule-section-icon">
            <ClipboardList
              size={22}
              aria-hidden="true"
            />
          </span>

          <div>
            <h2>
              {scheduleDraftState
                .data
                .period
                .title ??
                `לוח כוננים ${
                  hebrewMonths[
                    scheduleDraftState
                      .data
                      .period
                      .month - 1
                  ]
                } ${
                  scheduleDraftState
                    .data
                    .period
                    .year
                }`}
            </h2>

            <p>
              {scheduleDraftState
                .data
                .period
                .status ===
              'published'
                ? 'לוח הכוננים שפורסם.'
                : 'טיוטת לוח הכוננים לפני פרסום.'}
            </p>
          </div>

          {scheduleDraftState
            .data
            .period
            .status ===
          'draft' ? (
            <Button
              type="button"
              disabled={
                scheduleDraftState.isPublishing ||
                scheduleDraftState.updatingDayId !==
                  null ||
                scheduleDraftState
                  .data
                  .statistics
                  .unassignedDays > 0
              }
              onClick={() => {
                const confirmed =
                  window.confirm(
                    'האם לפרסם את לוח הכוננים?\n\n' +
                    'לאחר הפרסום הלוח יינעל לעריכה.',
                  );

                if (!confirmed) {
                  return;
                }

                void publishSchedule();
              }}
            >
              <Send
                size={17}
                aria-hidden="true"
              />

              {scheduleDraftState.isPublishing
                ? 'מפרסם לוח...'
                : 'פרסום לוח הכוננים'}
            </Button>
          ) : null}
        </header>

        <div className="driver-schedule-draft-statistics">
          <article>
            <strong>
              {
                scheduleDraftState
                  .data
                  .statistics
                  .totalDays
              }
            </strong>

            <span>
              ימים בחודש
            </span>
          </article>

          <article>
            <strong>
              {
                scheduleDraftState
                  .data
                  .statistics
                  .assignedDays
              }
            </strong>

            <span>
              ימים משובצים
            </span>
          </article>

          <article>
            <strong>
              {
                scheduleDraftState
                  .data
                  .statistics
                  .unassignedDays
              }
            </strong>

            <span>
              ללא כונן
            </span>
          </article>

          <article>
            <strong>
              {
                scheduleDraftState
                  .data
                  .statistics
                  .warningCount
              }
            </strong>

            <span>
              אזהרות
            </span>
          </article>
        </div>

        <div className="driver-schedule-draft-list">
          {scheduleDraftState
            .data
            .days
            .map(
              (
                scheduleDay,
              ) => (
                <DriverScheduleDayEditor
                  key={`${scheduleDay.id}-${scheduleDay.updatedAt}`}
                  day={
                    scheduleDay
                  }
                  drivers={
                    scheduleDraftState
                      .data
                      ?.drivers ??
                    []
                  }
                  isEditable={
                    canEditSchedule &&
                    scheduleDraftState
                      .data
                      ?.period
                      ?.status ===
                      'draft'
                  }
                  isSaving={
                    scheduleDraftState
                      .updatingDayId ===
                    scheduleDay.id
                  }
                  onSave={async (
                    request,
                  ) => {
                    try {
                      await updateScheduleDay(
                        request,
                      );
                    } catch {
                      /*
                       * השגיאה נשמרת
                       * בתוך ה-Hook.
                       */
                    }
                  }}
                />
              ),
            )}
        </div>
      </section>
    ) : (
      <section className="driver-schedule-placeholder-card">
        <ClipboardList
          size={31}
          aria-hidden="true"
        />

        <div>
          <strong>
            אין לוח לעריכה בחודש הזה
          </strong>

          <span>
            אפשר להמשיך לעבור בין
            חודשים בתצוגת החודש.
          </span>
        </div>
      </section>
    )}
  </section>
) : null}
      {!canManageAvailability &&
      !canSubmitAvailability &&
      !hasAnyScheduleAccess ? (
        <section className="driver-schedule-empty-state">
          <ShieldCheck
            size={34}
            aria-hidden="true"
          />

          <strong>
            אין הרשאות זמינות במסך
            הכוננים
          </strong>

          <span>
            יש לפנות למנהל המערכת
            לקבלת הרשאה מתאימה.
          </span>
        </section>
      ) : null}
    </section>
  );
}

export default DriverSchedulePage;