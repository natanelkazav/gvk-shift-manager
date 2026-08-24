import {
  CalendarPlus,
  CheckCircle2,
  ClipboardCheck,
  Download,
  RefreshCw,
  RotateCcw,
  Send,
  Trash2,
  WandSparkles,
} from 'lucide-react';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import {
  useEditableSchedulingDraft,
} from '../hooks/useEditableSchedulingDraft';
import { useAuth } from '../auth/AuthContext';
import {
  useSchedule,
} from '../hooks/useSchedule';
import {
    useNavigate,
  useSearchParams,
} from 'react-router-dom';
import AvailabilityMatrixPanel from '../components/availability/AvailabilityMatrixPanel';
import AvailabilityPeriodPicker from '../components/availability/AvailabilityPeriodPicker';
import AvailabilitySubmissionsPanel from '../components/availability/AvailabilitySubmissionsPanel';
import AvailabilityWorkspaceTabs, {
  type AvailabilityWorkspaceTab,
} from '../components/availability/AvailabilityWorkspaceTabs';
import DispatcherAvailabilityPanel from '../components/availability/DispatcherAvailabilityPanel';
import AssignmentCandidatesPanel from '../components/schedule/AssignmentCandidatesPanel';
import {
  Button,
  PageHeader,
} from '../components/ui';

import {
  useAssignmentCandidates,
} from '../hooks/useAssignmentCandidates';
import {
  useAutoSchedulingDraft,
} from '../hooks/useAutoSchedulingDraft';
import {
  useAvailabilityPeriodMatrix,
} from '../hooks/useAvailabilityPeriodMatrix';
import {
  useAvailabilityPeriods,
} from '../hooks/useAvailabilityPeriods';
import {
  useAvailabilityPeriodSubmissions,
} from '../hooks/useAvailabilityPeriodSubmissions';

import type {
  AvailabilityPeriodStatus,
  SpecialDayScheduleType,
} from '../types/availability';

import '../styles/availability.css';

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

const statusLabels: Record<
  AvailabilityPeriodStatus,
  string
> = {
  draft: 'טיוטה',
  open: 'פתוח להגשה',
  closed: 'סגור',
  archived: 'בארכיון',
};

const specialDayTypeLabels: Record<
  SpecialDayScheduleType,
  string
> = {
  holiday_eve: 'ערב חג',
  holiday_full: 'חג מלא',
  holiday_end: 'מוצאי / סיום חג',
  chol_hamoed: 'חול המועד',
};

function formatDate(
  value: string | null,
): string {
  if (!value) {
    return 'לא הוגדר';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
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

function formatDateOnly(
  value: string,
): string {
  const date = new Date(
    `${value}T12:00:00`,
  );

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(
    'he-IL',
    {
      dateStyle: 'short',
    },
  ).format(date);
}

function AvailabilityPage() {
const {
  profile,
  hasPermission,
} = useAuth();
const [
  searchParams,
  setSearchParams,
] =
  useSearchParams();
  const navigate =
  useNavigate();
const canSubmitAvailability =
  hasPermission(
    'availability.view',
  );

const canManageAvailability =
  hasPermission(
    'availability.manage',
  );

const canPrepareSchedule =
  hasPermission(
    'schedule.edit',
  );
const requestedTab =
  searchParams.get(
    'tab',
  );

const requestedPeriodId =
  searchParams.get(
    'periodId',
  );
  const returnTo =
  searchParams.get(
    'returnTo',
  );
const isDispatcher =
  profile?.role ===
  'dispatcher';

const pageTitle =
  isDispatcher
    ? 'האילוצים שלי'
    : 'אילוצי מוקדנים';

const pageDescription =
  isDispatcher
    ? 'סימון והגשת האילוצים האישיים שלי.'
    : 'פתיחת חודשים להגשת אילוצים וניהול תקופות הזמינות.';

const getInitialWorkspaceTab =
  (): AvailabilityWorkspaceTab => {

    if (
      canSubmitAvailability
    ) {
      return 'my-availability';
    }

    if (
      canManageAvailability
    ) {
      return 'period-management';
    }

    return 'schedule-preparation';
  };

const [
  activeWorkspaceTab,
  setActiveWorkspaceTab,
] =
  useState<AvailabilityWorkspaceTab>(
    getInitialWorkspaceTab(),
  );
  const now = new Date();

  const defaultNextMonth =
    now.getMonth() === 11
      ? 1
      : now.getMonth() + 2;

  const defaultYear =
    now.getMonth() === 11
      ? now.getFullYear() + 1
      : now.getFullYear();

  const [
    selectedMonth,
    setSelectedMonth,
  ] = useState(
    defaultNextMonth,
  );

  const [
    selectedYear,
    setSelectedYear,
  ] = useState(
    defaultYear,
  );

  const [
    importYear,
    setImportYear,
  ] = useState(
    defaultYear,
  );

  const [
    title,
    setTitle,
  ] = useState('');

  const [
    instructions,
    setInstructions,
  ] = useState('');

  const [
    deadline,
    setDeadline,
  ] = useState('');

  const {
    state:
      submissionsState,

    selectedPeriodId,

    loadPeriodSubmissions,

    reset:
      resetSubmissionsTracking,
  } =
    useAvailabilityPeriodSubmissions();

  const {
    state:
      autoSchedulingDraftState,

    generateDraft:
      generateAutoSchedulingDraft,

    reset:
      resetAutoSchedulingDraft,
  } =
    useAutoSchedulingDraft();

  const {
    state:
      assignmentCandidatesState,

    selectedPeriodId:
      selectedAssignmentPeriodId,

    statistics:
      assignmentCandidatesStatistics,

    loadCandidates,

    reset:
      resetAssignmentCandidates,
  } =
    useAssignmentCandidates();
    
const {
  state:
    editableSchedulingDraftState,

  assignments:
    editableSchedulingAssignments,

  dispatcherSummaries:
    editableDispatcherSummaries,

  validation:
    editableSchedulingValidation,

  intentionallyUnassignedShiftIds:
    intentionallyUnassignedShiftIds,

  loadDraft:
    loadEditableSchedulingDraft,

  assignDispatcher:
    assignEditableDispatcher,

  removeAssignment:
    removeEditableAssignment,

  markShiftIntentionallyUnassigned:
    markEditableShiftIntentionallyUnassigned,

  resetShiftAssignment:
    resetEditableShiftAssignment,

  resetAllChanges:
    resetAllEditableChanges,

  clear:
    clearEditableSchedulingDraft,
} =
  useEditableSchedulingDraft(
    assignmentCandidatesState.data,
  );
  const {
  state:
    scheduleState,

  saveDraft:
    saveScheduleDraft,

  clearError:
    clearScheduleError,

  reset:
    resetScheduleState,
} =
  useSchedule();
  useEffect(() => {
  if (
    !autoSchedulingDraftState
      .draft
  ) {
    clearEditableSchedulingDraft();

    return;
  }

  loadEditableSchedulingDraft(
    autoSchedulingDraftState
      .draft,
  );
}, [
  autoSchedulingDraftState
    .draft,
  loadEditableSchedulingDraft,
  clearEditableSchedulingDraft,
]);
  const {
    state:
      matrixState,

    selectedPeriodId:
      selectedMatrixPeriodId,

    statistics:
      matrixStatistics,

    loadMatrix,

    reset:
      resetMatrix,
  } =
    useAvailabilityPeriodMatrix();

  const {
    state,
    loadPeriods,
    createPeriod,
    importSpecialDays,
    rebuildPeriodSlots,
    openPeriod,
    closePeriod,
    reopenPeriod,
    deletePeriod,
    clearError,
  } =
    useAvailabilityPeriods();
  useEffect(
  () => {
    if (
      requestedTab !==
        'submissions' ||
      !requestedPeriodId ||
      !canManageAvailability
    ) {
      return;
    }

    setActiveWorkspaceTab(
      'submissions',
    );

    void loadPeriodSubmissions(
      requestedPeriodId,
    );
  },
  [
    canManageAvailability,
    loadPeriodSubmissions,
    requestedPeriodId,
    requestedTab,
  ],
);
  const submissionsPanelRef =
    useRef<HTMLDivElement | null>(
      null,
    );

  const matrixPanelRef =
    useRef<HTMLDivElement | null>(
      null,
    );

  const assignmentCandidatesPanelRef =
    useRef<HTMLDivElement | null>(
      null,
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
  const isActiveTabVisible =
    (
      activeWorkspaceTab ===
        'my-availability' &&
      canSubmitAvailability
    ) ||
    (
      activeWorkspaceTab ===
        'period-management' &&
      canManageAvailability
    ) ||
    (
      activeWorkspaceTab ===
        'submissions' &&
      canManageAvailability
    ) ||
    (
      activeWorkspaceTab ===
        'schedule-preparation' &&
      canPrepareSchedule
    );

  if (isActiveTabVisible) {
    return;
  }

  if (canSubmitAvailability) {
    setActiveWorkspaceTab(
      'my-availability',
    );

    return;
  }

  if (canManageAvailability) {
    setActiveWorkspaceTab(
      'period-management',
    );

    return;
  }

  if (canPrepareSchedule) {
    setActiveWorkspaceTab(
      'schedule-preparation',
    );
  }
}, [
  activeWorkspaceTab,
  canSubmitAvailability,
  canManageAvailability,
  canPrepareSchedule,
]);

  const handleRebuildPeriod =
    async (
      periodId: string,
      periodTitle: string,
    ): Promise<void> => {
      const confirmed =
        window.confirm(
          `האם לבנות מחדש את כל המשמרות עבור "${periodTitle}"?\n\n` +
          'הפעולה תמחק את המשמרות הקיימות של החודש ותיצור אותן מחדש לפי החגים והמועדים המעודכנים.',
        );

      if (!confirmed) {
        return;
      }

      clearError();

      await rebuildPeriodSlots(
        periodId,
      );
    };

  const handleOpenPeriod =
    async (
      periodId: string,
      periodTitle: string,
    ): Promise<void> => {
      const confirmed =
        window.confirm(
          `האם לפתוח את "${periodTitle}" להגשת אילוצים?\n\n` +
          'לאחר הפתיחה המוקדנים יוכלו להזין זמינות, ולא יהיה ניתן לבנות מחדש את משמרות החודש.',
        );

      if (!confirmed) {
        return;
      }

      clearError();

      await openPeriod(
        periodId,
      );
    };

  const handleSubmit =
    async (
      event:
        FormEvent<HTMLFormElement>,
    ): Promise<void> => {
      event.preventDefault();

      clearError();

      await createPeriod({
        year:
          selectedYear,

        month:
          selectedMonth,

        submissionDeadline:
          deadline
            ? new Date(
                deadline,
              ).toISOString()
            : null,

        title:
          title.trim() ||
          null,

        instructions:
          instructions.trim() ||
          null,
      });

      setTitle('');
      setInstructions('');
      setDeadline('');
    };

  const handleImportSpecialDays =
    async (): Promise<void> => {
      clearError();

      await importSpecialDays(
        importYear,
      );
    };
const handleCloseSubmissionsTracking =
  (): void => {
    resetSubmissionsTracking();

    resetMatrix();

    if (
      returnTo ===
      '/shifts?tab=availability'
    ) {
      navigate(
        returnTo,
      );

      return;
    }

    setSearchParams(
      {},
      {
        replace:
          true,
      },
    );
  };
  const handleOpenSubmissionsTracking =
    async (
      periodId: string,
    ): Promise<void> => {
      resetMatrix();
      resetAssignmentCandidates();
      resetAutoSchedulingDraft();
      clearEditableSchedulingDraft();
      resetScheduleState();

      setActiveWorkspaceTab(
        'submissions',
      );

      await loadPeriodSubmissions(
        periodId,
      );

      window.setTimeout(() => {
        submissionsPanelRef
          .current
          ?.scrollIntoView({
            behavior: 'smooth',
            block: 'start',
          });
      }, 0);
    };

  const handleRefreshSubmissionsTracking =
    async (): Promise<void> => {
      if (!selectedPeriodId) {
        return;
      }

      await loadPeriodSubmissions(
        selectedPeriodId,
      );
    };

  const handleCloseAvailabilityPeriod =
    async (): Promise<void> => {
      if (
        !selectedPeriodId ||
        !submissionsState.data
      ) {
        return;
      }

      const {
        summary,
        period,
      } = submissionsState.data;

      if (
        summary.totalDispatchers ===
          0
      ) {
        return;
      }

      const periodTitle =
        period.title ??
        `${hebrewMonths[
          period.month - 1
        ]} ${period.year}`;

      const missingSubmissions =
        Math.max(
          summary.totalDispatchers -
            summary.submittedDispatchers,
          0,
        );

      const confirmed =
        window.confirm(
          missingSubmissions > 0
            ? `האם לסגור את תקופת האילוצים "${periodTitle}"?\n\n` +
              `יש ${missingSubmissions} מוקדנים שלא הגישו בזמן. ` +
              'כל משמרת שלא סומנה אצלם תסומן אוטומטית כזמין עם הערה על אי־הגשה בזמן.\n\n' +
              'לאחר הסגירה לא ניתן יהיה לערוך או להגיש אילוצים.'
            : `האם לסגור את תקופת האילוצים "${periodTitle}"?\n\n` +
              'לאחר הסגירה המוקדנים לא יוכלו עוד לשנות או להגיש אילוצים.',
        );

      if (!confirmed) {
        return;
      }

      clearError();

      try {
        await closePeriod(
          selectedPeriodId,
        );

        await loadPeriodSubmissions(
          selectedPeriodId,
        );
      } catch {
        /*
         * הודעת השגיאה מוצגת
         * מתוך useAvailabilityPeriods.
         */
      }
    };

  const handleReopenAvailabilityPeriod =
    async (): Promise<void> => {
      if (
        !selectedPeriodId ||
        !submissionsState.data
      ) {
        return;
      }

      const confirmed =
        window.confirm(
          'לפתוח מחדש את תקופת האילוצים? המוקדנים יוכלו שוב לערוך ולהגיש.',
        );

      if (!confirmed) {
        return;
      }

      try {
        await reopenPeriod(
          selectedPeriodId,
        );

        await loadPeriodSubmissions(
          selectedPeriodId,
        );
      } catch {
        // Hook exposes the error.
      }
    };

  const handleDeleteSelectedAvailabilityPeriod =
    async (): Promise<void> => {
      if (
        !selectedPeriodId ||
        !submissionsState.data
      ) {
        return;
      }

      const title =
        submissionsState.data
          .period.title ??
        `${submissionsState.data.period.month}/${submissionsState.data.period.year}`;

      await handleDeleteAvailabilityPeriod(
        selectedPeriodId,
        title,
      );
    };

  const handlePrepareSelectedAvailabilityPeriod =
    async (): Promise<void> => {
      if (!selectedPeriodId) {
        return;
      }

      setActiveWorkspaceTab(
        'schedule-preparation',
      );

      await handleOpenAssignmentCandidates(
        selectedPeriodId,
      );
    };

  const canCloseSelectedPeriod =
    Boolean(
      submissionsState.data &&
      submissionsState.data.period
        .status === 'open' &&
      submissionsState.data.summary
        .totalDispatchers > 0,
    );

  const handleOpenAvailabilityMatrix =
    async (): Promise<void> => {
      if (!selectedPeriodId) {
        return;
      }

      await loadMatrix(
        selectedPeriodId,
      );

      window.setTimeout(() => {
        matrixPanelRef
          .current
          ?.scrollIntoView({
            behavior: 'smooth',
            block: 'start',
          });
      }, 0);
    };

  const handleRefreshAvailabilityMatrix =
    async (): Promise<void> => {
      if (!selectedMatrixPeriodId) {
        return;
      }

      await loadMatrix(
        selectedMatrixPeriodId,
      );
    };

  const handleOpenAssignmentCandidates =
    async (
      periodId: string,
    ): Promise<void> => {
    resetAutoSchedulingDraft();
    clearEditableSchedulingDraft();
    resetScheduleState();

    setActiveWorkspaceTab(
      'schedule-preparation',
    );

    await loadCandidates(
      periodId,
    );

    window.setTimeout(() => {
      assignmentCandidatesPanelRef
        .current
        ?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
    }, 0);
  };

  useEffect(
    () => {
      if (
        requestedTab !==
          'schedule-preparation' ||
        !requestedPeriodId ||
        !canPrepareSchedule
      ) {
        return;
      }

      resetAutoSchedulingDraft();
      clearEditableSchedulingDraft();
      resetScheduleState();

      setActiveWorkspaceTab(
        'schedule-preparation',
      );

      void loadCandidates(
        requestedPeriodId,
      );

      window.setTimeout(
        () => {
          assignmentCandidatesPanelRef
            .current
            ?.scrollIntoView({
              behavior:
                'smooth',
              block:
                'start',
            });
        },
        0,
      );
    },
    [
      canPrepareSchedule,
      clearEditableSchedulingDraft,
      loadCandidates,
      requestedPeriodId,
      requestedTab,
      resetAutoSchedulingDraft,
      resetScheduleState,
    ],
  );

  const handleRefreshAssignmentCandidates =
    async (): Promise<void> => {
      if (
        !selectedAssignmentPeriodId
      ) {
        return;
      }

      await loadCandidates(
        selectedAssignmentPeriodId,
      );
    };

  const handleGenerateSchedulingDraft =
    (): void => {
      if (
        !assignmentCandidatesState
          .data
      ) {
        return;
      }

      generateAutoSchedulingDraft(
        assignmentCandidatesState
          .data,
      );
    };
  const handleSaveSchedulingDraft =
    async (): Promise<void> => {
    if (
      !selectedAssignmentPeriodId
    ) {
      return;
    }

    if (
      editableSchedulingValidation
        .errorCount > 0
    ) {
      window.alert(
        'לא ניתן לשמור את השיבוץ כל עוד קיימות שגיאות חוסמות.',
      );

      return;
    }

    if (
      editableSchedulingAssignments
        .length +
        intentionallyUnassignedShiftIds
          .length !==
      assignmentCandidatesState
        .data?.shifts.length
    ) {
      window.alert(
        'לא ניתן לשמור שיבוץ חלקי. יש לשבץ כל משמרת או לסמן אותה במפורש כמשמרת לא מאוישת.',
      );

      return;
    }

    let confirmWarnings =
      false;

    if (
      editableSchedulingValidation
        .warningCount > 0
    ) {
      const warningsConfirmed =
        window.confirm(
          `בטיוטה קיימות ${editableSchedulingValidation.warningCount} אזהרות.\n\n` +
          `מתוכן ${editableSchedulingValidation.unavailableAssignmentCount} שיבוצים למוקדנים שלא סימנו זמינות.\n\n` +
          'האם להמשיך ולשמור את השיבוץ?',
        );

      if (!warningsConfirmed) {
        return;
      }

      confirmWarnings =
        true;
    } else {
      const confirmed =
        window.confirm(
          `האם לשמור את השיבוץ?\n\n` +
          `יישמרו ${editableSchedulingAssignments.length} משמרות מאוישות` +
          (intentionallyUnassignedShiftIds.length > 0
            ? ` ו־${intentionallyUnassignedShiftIds.length} משמרות שסומנו במפורש כלא מאוישות.`
            : '.'),
        );

      if (!confirmed) {
        return;
      }
    }

    clearScheduleError();

    try {
      await saveScheduleDraft({
        availabilityPeriodId:
          selectedAssignmentPeriodId,

        assignments:
          editableSchedulingAssignments,

        intentionallyUnassignedShiftIds,

        confirmWarnings,
      });
    } catch {
      /*
       * הודעת השגיאה נשמרת בתוך
       * useSchedule ומוצגת במסך.
       */
    }
  };
  const handleDeleteAvailabilityPeriod =
    async (
      periodId: string,
      periodTitle: string,
    ): Promise<void> => {
      const warningConfirmed =
        window.confirm(
          `מחיקת "${periodTitle}" תמחק לצמיתות את כל המידע הבא:\n\n` +
          '• תקופת האילוצים\n' +
          '• כל המשמרות שנוצרו לחודש\n' +
          '• כל סימוני הזמינות\n' +
          '• כל הגשות המוקדנים\n\n' +
          'לא ניתן לבטל פעולה זו.\n\n' +
          'האם להמשיך?',
        );

      if (!warningConfirmed) {
        return;
      }

      const finalConfirmation =
        window.confirm(
          `אישור סופי למחיקת "${periodTitle}"\n\n` +
          'הפעולה תתבצע מיד ולא ניתן יהיה לשחזר את הנתונים.\n\n' +
          'האם אתה בטוח שברצונך למחוק את החודש?',
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
          selectedPeriodId ===
          periodId
        ) {
          resetSubmissionsTracking();
        }

        if (
          selectedMatrixPeriodId ===
          periodId
        ) {
          resetMatrix();
        }

        if (
          selectedAssignmentPeriodId ===
          periodId
        ) {
          resetAssignmentCandidates();
          resetAutoSchedulingDraft();
          clearEditableSchedulingDraft();
          resetScheduleState();
        }
      } catch {
        /*
         * הודעת השגיאה נשמרת
         * ומוצגת דרך useAvailabilityPeriods.
         */
      }
    };

  return (
    <section className="availability-page">
      <PageHeader
        title={
          pageTitle
        }
        description={
          pageDescription
        }
        actions={
          <Button
            type="button"
            variant="secondary"
            disabled={
              state.isLoading ||
              state.isCreating ||
              state
                .isImportingSpecialDays ||
              state.rebuildingPeriodId !==
                null ||
              state.openingPeriodId !==
                null ||
              state.closingPeriodId !==
                null ||
              state.deletingPeriodId !==
                null
            }
            onClick={() => {
              void loadPeriods();
            }}
          >
            <RefreshCw
              size={18}
              aria-hidden="true"
            />

            רענון
          </Button>
        }
      />

      <AvailabilityWorkspaceTabs
        activeTab={
          activeWorkspaceTab
        }
        canSubmitAvailability={
          canSubmitAvailability
        }
        canManageAvailability={
          canManageAvailability
        }
        canPrepareSchedule={
          canPrepareSchedule
        }
        onChange={
          setActiveWorkspaceTab
        }
      />

      {state.error ? (
        <div
          className="availability-error"
          role="alert"
        >
          {state.error}
        </div>
      ) : null}

      {state.lastClosedResult ? (
        <div
          className="availability-success"
          role="status"
        >
          <CheckCircle2
            size={22}
            aria-hidden="true"
          />

          <div>
            <strong>
              תקופת האילוצים נסגרה
            </strong>

            <span>
              התקופה נעולה. חוסרים של
              מוקדנים שלא הגישו בזמן
              הושלמו אוטומטית כזמין,
              בלי לדרוס סימונים שכבר
              נשמרו.
            </span>
          </div>
        </div>
      ) : null}

      {state.lastDeletedResult ? (
        <div
          className="availability-success"
          role="status"
        >
          <CheckCircle2
            size={22}
            aria-hidden="true"
          />

          <div>
            <strong>
              תקופת האילוצים נמחקה
            </strong>

            <span>
              נמחקו{' '}
              {
                state
                  .lastDeletedResult
                  .deletedShiftSlots
              }{' '}
              משמרות,{' '}
              {
                state
                  .lastDeletedResult
                  .deletedAvailabilityRows
              }{' '}
              סימוני זמינות ו־
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

      {state.lastCreatedResult ? (
        <div
          className="availability-success"
          role="status"
        >
          <CheckCircle2
            size={22}
            aria-hidden="true"
          />

          <div>
            <strong>
              תקופת האילוצים נוצרה
              בהצלחה
            </strong>

            <span>
              נוצרו{' '}
              {
                state
                  .lastCreatedResult
                  .createdSlots
              }{' '}
              משמרות במצב טיוטה.
            </span>
          </div>
        </div>
      ) : null}

      {state.lastRebuildResult ? (
        <div
          className="availability-success"
          role="status"
        >
          <CheckCircle2
            size={22}
            aria-hidden="true"
          />

          <div>
            <strong>
              משמרות החודש נבנו מחדש
            </strong>

            <span>
              נוצרו מחדש{' '}
              {
                state
                  .lastRebuildResult
                  .createdSlots
              }{' '}
              משמרות בהתאם לחגים
              ולמועדים המעודכנים.
            </span>
          </div>
        </div>
      ) : null}

      {state.lastOpenedResult ? (
        <div
          className="availability-success"
          role="status"
        >
          <CheckCircle2
            size={22}
            aria-hidden="true"
          />

          <div>
            <strong>
              תקופת האילוצים נפתחה
              להגשה
            </strong>

            <span>
              המוקדנים יכולים כעת
              להזין אילוצים עבור{' '}
              {
                state
                  .lastOpenedResult
                  .shiftSlotsCount
              }{' '}
              משמרות.
            </span>
          </div>
        </div>
      ) : null}

      {state.lastImportResult ? (
        <div className="availability-import-result">
          <div className="availability-import-summary">
            <CheckCircle2
              size={22}
              aria-hidden="true"
            />

            <div>
              <strong>
                ייבוא החגים לשנת{' '}
                {
                  state
                    .lastImportResult
                    .year
                }{' '}
                הושלם
              </strong>

              <span>
                התקבלו{' '}
                {
                  state
                    .lastImportResult
                    .fetchedEvents
                }{' '}
                אירועים, ומתוכם נשמרו{' '}
                {
                  state
                    .lastImportResult
                    .importedEvents
                }{' '}
                ימים מיוחדים.
              </span>
            </div>
          </div>

          <div className="availability-imported-days">
            {state
              .lastImportResult
              .importedDays
              .map((day) => (
                <div
                  key={`${day.date}-${day.scheduleType}-${day.name}`}
                  className="availability-imported-day"
                >
                  <div>
                    <strong>
                      {day.name}
                    </strong>

                    <span>
                      {formatDateOnly(
                        day.date,
                      )}
                    </span>
                  </div>

                  <span className="availability-special-day-type">
                    {
                      specialDayTypeLabels[
                        day.scheduleType
                      ]
                    }
                  </span>
                </div>
              ))}
          </div>
        </div>
      ) : null}

      {activeWorkspaceTab ===
        'my-availability' &&
      canSubmitAvailability ? (
        <DispatcherAvailabilityPanel />
      ) : null}

      {activeWorkspaceTab ===
        'period-management' &&
      canManageAvailability ? (
        <>
          <div className="availability-periods-card">
            <div className="availability-card-header">
              <ClipboardCheck
                size={22}
                aria-hidden="true"
              />

              <div>
                <h2>
                  תקופות אילוצים
                </h2>

                <p>
                  ניהול חודשי
                  האילוצים, פתיחה,
                  מעקב ומחיקה.
                </p>
              </div>
            </div>

            {state.isLoading ? (
              <div className="availability-empty-state">
                טוען תקופות אילוצים...
              </div>
            ) : state.periods.length ===
              0 ? (
              <div className="availability-empty-state">
                עדיין לא נוצרו תקופות
                אילוצים.
              </div>
            ) : (
              <div className="availability-periods-list">
                {state.periods.map(
                  (period) => {
                    const periodTitle =
                      period.title ??
                      `${hebrewMonths[
                        period.month - 1
                      ]} ${period.year}`;

                    return (
                      <article
                        key={period.id}
                        className="availability-period-item"
                      >
                        <div className="availability-period-main">
                          <strong>
                            {periodTitle}
                          </strong>

                          <span>
                            מועד אחרון:{' '}
                            {formatDate(
                              period
                                .submissionDeadline,
                            )}
                          </span>

                          {period.openedAt ? (
                            <span>
                              נפתח להגשה:{' '}
                              {formatDate(
                                period.openedAt,
                              )}
                            </span>
                          ) : null}
                        </div>

                        <div className="availability-period-actions">
                          <span
                            className={`availability-status availability-status-${period.status}`}
                          >
                            {
                              statusLabels[
                                period.status
                              ]
                            }
                          </span>

                          {period.status !==
                          'draft' ? (
                            <Button
                              type="button"
                              variant="secondary"
                              disabled={
                                submissionsState
                                  .isLoading
                              }
                              onClick={() => {
                                void handleOpenSubmissionsTracking(
                                  period.id,
                                );
                              }}
                            >
                              <ClipboardCheck
                                size={17}
                                aria-hidden="true"
                              />

                              {submissionsState
                                .isLoading &&
                              selectedPeriodId ===
                                period.id
                                ? 'טוען מעקב...'
                                : 'מעקב הגשות'}
                            </Button>
                          ) : null}

                          {canPrepareSchedule &&
                          period.status ===
                            'closed' ? (
                            <Button
                              type="button"
                              disabled={
                                assignmentCandidatesState
                                  .isLoading
                              }
                              onClick={() => {
                                void handleOpenAssignmentCandidates(
                                  period.id,
                                );
                              }}
                            >
                              <WandSparkles
                                size={17}
                                aria-hidden="true"
                              />

                              {assignmentCandidatesState
                                .isLoading &&
                              selectedAssignmentPeriodId ===
                                period.id
                                ? 'מכין נתונים...'
                                : 'הכנה לשיבוץ'}
                            </Button>
                          ) : null}

                          {period.status ===
                          'draft' ? (
                            <Button
                              type="button"
                              variant="secondary"
                              disabled={
                                state.rebuildingPeriodId !==
                                  null ||
                                state.openingPeriodId !==
                                  null ||
                                state.isCreating ||
                                state
                                  .isImportingSpecialDays ||
                                state.deletingPeriodId !==
                                  null
                              }
                              onClick={() => {
                                void handleRebuildPeriod(
                                  period.id,
                                  periodTitle,
                                );
                              }}
                            >
                              <RotateCcw
                                size={17}
                                aria-hidden="true"
                              />

                              {state.rebuildingPeriodId ===
                              period.id
                                ? 'בונה מחדש...'
                                : 'בנייה מחדש'}
                            </Button>
                          ) : null}

                          {period.status ===
                          'draft' ? (
                            <Button
                              type="button"
                              disabled={
                                state.openingPeriodId !==
                                  null ||
                                state.rebuildingPeriodId !==
                                  null ||
                                state.isCreating ||
                                state
                                  .isImportingSpecialDays ||
                                state.deletingPeriodId !==
                                  null
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
                            className="availability-delete-period-button"
                            disabled={
                              state.deletingPeriodId !==
                                null ||
                              state.rebuildingPeriodId !==
                                null ||
                              state.openingPeriodId !==
                                null ||
                              state.closingPeriodId !==
                                null ||
                              state.isCreating ||
                              state
                                .isImportingSpecialDays
                            }
                            onClick={() => {
                              void handleDeleteAvailabilityPeriod(
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
                        </div>
                      </article>
                    );
                  },
                )}
              </div>
            )}
          </div>

          <div className="availability-management-tools">
            <details className="availability-management-details">
              <summary className="availability-management-summary">
                <span>
                  <CalendarPlus
                    size={20}
                    aria-hidden="true"
                  />
                </span>

                <div>
                  <strong>
                    יצירת חודש אילוצים
                  </strong>

                  <small>
                    הפקת רשימת המשמרות
                    לחודש חדש
                  </small>
                </div>
              </summary>

              <div className="availability-management-details-content">
                <form
                  className="availability-create-card availability-create-card-embedded"
                  onSubmit={handleSubmit}
                >
                  <div className="availability-form-grid">
                    <label>
                      <span>
                        חודש
                      </span>

                      <select
                        value={
                          selectedMonth
                        }
                        disabled={
                          state.isCreating ||
                          state
                            .isImportingSpecialDays ||
                          state.rebuildingPeriodId !==
                            null ||
                          state.openingPeriodId !==
                            null
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
                          state.isCreating ||
                          state
                            .isImportingSpecialDays ||
                          state.rebuildingPeriodId !==
                            null ||
                          state.openingPeriodId !==
                            null
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
                          deadline
                        }
                        disabled={
                          state.isCreating ||
                          state
                            .isImportingSpecialDays ||
                          state.rebuildingPeriodId !==
                            null ||
                          state.openingPeriodId !==
                            null
                        }
                        onChange={(
                          event,
                        ) => {
                          setDeadline(
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
                          state.isCreating ||
                          state
                            .isImportingSpecialDays ||
                          state.rebuildingPeriodId !==
                            null ||
                          state.openingPeriodId !==
                            null
                        }
                        placeholder="אופציונלי"
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

                  <label className="availability-instructions-field">
                    <span>
                      הנחיות למוקדנים
                    </span>

                    <textarea
                      rows={4}
                      value={
                        instructions
                      }
                      disabled={
                        state.isCreating ||
                        state
                          .isImportingSpecialDays ||
                        state.rebuildingPeriodId !==
                          null ||
                        state.openingPeriodId !==
                          null
                      }
                      placeholder="לדוגמה: יש למלא את כל המשמרות עד למועד האחרון."
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

                  <div className="availability-create-actions">
                    <Button
                      type="submit"
                      disabled={
                        state.isCreating ||
                        state
                          .isImportingSpecialDays ||
                        state.rebuildingPeriodId !==
                          null ||
                        state.openingPeriodId !==
                          null
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
              </div>
            </details>

            <details className="availability-management-details">
              <summary className="availability-management-summary">
                <span>
                  <Download
                    size={20}
                    aria-hidden="true"
                  />
                </span>

                <div>
                  <strong>
                    ייבוא חגים ומועדים
                  </strong>

                  <small>
                    עדכון חגי ישראל
                    מ־Hebcal
                  </small>
                </div>
              </summary>

              <div className="availability-management-details-content">
                <div className="availability-import-card availability-import-card-embedded">
                  <div className="availability-import-controls">
                    <label>
                      <span>
                        שנת ייבוא
                      </span>

                      <select
                        value={
                          importYear
                        }
                        disabled={
                          state
                            .isImportingSpecialDays ||
                          state.isCreating ||
                          state.rebuildingPeriodId !==
                            null ||
                          state.openingPeriodId !==
                            null
                        }
                        onChange={(
                          event,
                        ) => {
                          setImportYear(
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

                    <Button
                      type="button"
                      disabled={
                        state
                          .isImportingSpecialDays ||
                        state.isCreating ||
                        state.rebuildingPeriodId !==
                          null ||
                        state.openingPeriodId !==
                          null
                      }
                      onClick={() => {
                        void handleImportSpecialDays();
                      }}
                    >
                      <Download
                        size={18}
                        aria-hidden="true"
                      />

                      {state
                        .isImportingSpecialDays
                        ? 'מייבא חגים...'
                        : `ייבוא חגים לשנת ${importYear}`}
                    </Button>
                  </div>
                </div>
              </div>
            </details>
          </div>
        </>
      ) : null}

      {activeWorkspaceTab ===
        'submissions' &&
      canManageAvailability ? (
        <>
          <AvailabilityPeriodPicker
            periods={
              state.periods
            }
            selectedPeriodId={
              selectedPeriodId
            }
            allowedStatuses={[
              'open',
              'closed',
              'archived',
            ]}
            label="בחירת חודש למעקב"
            emptyMessage="אין כרגע תקופות זמינות למעקב."
            isLoading={
              submissionsState
                .isLoading
            }
            onSelect={(periodId) => {
              void handleOpenSubmissionsTracking(
                periodId,
              );
            }}
          />

          {selectedPeriodId ? (
            <div
              ref={
                submissionsPanelRef
              }
              className="availability-submissions-anchor"
            >
              <AvailabilitySubmissionsPanel
                isLoading={
                  submissionsState
                    .isLoading
                }
                isClosing={
                  state.closingPeriodId ===
                  selectedPeriodId
                }
                canClose={
                  canCloseSelectedPeriod
                }
                error={
                  submissionsState.error ??
                  state.error
                }
                data={
                  submissionsState.data
                }
                onRefresh={
                  handleRefreshSubmissionsTracking
                }
                onOpenMatrix={
                  handleOpenAvailabilityMatrix
                }
                onClosePeriod={
                  handleCloseAvailabilityPeriod
                }
                onReopenPeriod={
                  handleReopenAvailabilityPeriod
                }
                onDeletePeriod={
                  handleDeleteSelectedAvailabilityPeriod
                }
                onPrepareSchedule={
                  handlePrepareSelectedAvailabilityPeriod
                }
                onGoToSchedule={() => {
                  navigate('/schedule');
                }}
                onClose={
                  handleCloseSubmissionsTracking
                }
              />
            </div>
          ) : (
            <div className="availability-workspace-empty">
              <strong>
                בחר חודש למעקב
              </strong>

              <span>
                לאחר בחירת חודש יוצגו
                סטטוס ההגשות וכלי
                הניהול שלו.
              </span>
            </div>
          )}

          {selectedMatrixPeriodId ? (
            <div
              ref={matrixPanelRef}
              className="availability-matrix-anchor"
            >
              <AvailabilityMatrixPanel
                data={
                  matrixState.data
                }
                statistics={
                  matrixStatistics
                }
                isLoading={
                  matrixState
                    .isLoading
                }
                error={
                  matrixState.error
                }
                onRefresh={
                  handleRefreshAvailabilityMatrix
                }
                onClose={
                  resetMatrix
                }
              />
            </div>
          ) : null}
        </>
      ) : null}

      {activeWorkspaceTab ===
        'schedule-preparation' &&
      canPrepareSchedule ? (
        <>
          <AvailabilityPeriodPicker
            periods={
              state.periods
            }
            selectedPeriodId={
              selectedAssignmentPeriodId
            }
            allowedStatuses={[
              'closed',
            ]}
            label="בחירת חודש להכנת שיבוץ"
            emptyMessage="אין כרגע תקופת אילוצים סגורה שניתן להכין ממנה שיבוץ."
            isLoading={
              assignmentCandidatesState
                .isLoading
            }
          onSelect={(periodId) => {
            void handleOpenAssignmentCandidates(
              periodId,
            );
          }}
          />

          {scheduleState.error ? (
            <div
              className="availability-error"
              role="alert"
            >
              {scheduleState.error}
            </div>
          ) : null}

          {scheduleState.lastSavedDraft ? (
            <div
              className="availability-success"
              role="status"
            >
              <CheckCircle2
                size={22}
                aria-hidden="true"
              />

              <div>
                <strong>
                  השיבוץ נשמר בהצלחה
                </strong>

                <span>
                  נשמרו{' '}
                  {
                    scheduleState
                      .lastSavedDraft
                      .savedShifts
                  }{' '}
                  משמרות: {' '}
                  {
                    scheduleState
                      .lastSavedDraft
                      .automaticAssignments
                  }{' '}
                  אוטומטיות ו־
                  {
                    scheduleState
                      .lastSavedDraft
                      .manualAssignments
                  }{' '}
                  ידניות.
                </span>
              </div>
            </div>
          ) : null}

          {selectedAssignmentPeriodId ? (
            <div
              ref={
                assignmentCandidatesPanelRef
              }
              className="assignment-candidates-anchor"
            >
          <AssignmentCandidatesPanel
            data={
              assignmentCandidatesState
                .data
            }
            statistics={
              assignmentCandidatesStatistics
            }
            isLoading={
              assignmentCandidatesState
                .isLoading
            }
            isGeneratingDraft={
              autoSchedulingDraftState
                .isGenerating
            }
            isSavingSchedule={
              scheduleState.isSaving
            }
            hasSavedSchedule={
              scheduleState.lastSavedDraft !==
              null
            }
            error={
              assignmentCandidatesState
                .error
            }
            draftError={
              autoSchedulingDraftState
                .error
            }
            draft={
              autoSchedulingDraftState
                .draft
            }
            editableAssignments={
              editableSchedulingAssignments
            }
            editableDispatcherSummaries={
              editableDispatcherSummaries
            }
            validation={
              editableSchedulingValidation
            }
            intentionallyUnassignedShiftIds={
              intentionallyUnassignedShiftIds
            }
            isDraftDirty={
              editableSchedulingDraftState
                .isDirty
            }
            onAssignDispatcher={
              assignEditableDispatcher
            }
            onRemoveAssignment={
              removeEditableAssignment
            }
            onMarkShiftIntentionallyUnassigned={
              markEditableShiftIntentionallyUnassigned
            }
            onResetShiftAssignment={
              resetEditableShiftAssignment
            }
            onResetAllChanges={
              resetAllEditableChanges
            }
            onSaveSchedule={
              handleSaveSchedulingDraft
            }
            onRefresh={
              handleRefreshAssignmentCandidates
            }
            onGenerateDraft={
              handleGenerateSchedulingDraft
            }
            onClose={() => {
              resetAssignmentCandidates();
              resetAutoSchedulingDraft();
              clearEditableSchedulingDraft();
              resetScheduleState();
            }}
          />
            </div>
          ) : (
            <div className="availability-workspace-empty">
              <strong>
                בחר חודש להכנת שיבוץ
              </strong>

              <span>
                רק תקופות אילוצים
                סגורות זמינות בשלב זה.
              </span>
            </div>
          )}
        </>
      ) : null}
    </section>
  );
}

export default AvailabilityPage;