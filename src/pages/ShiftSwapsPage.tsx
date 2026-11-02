/**
 * קובץ: src/pages/ShiftSwapsPage.tsx
 * מטרה: מימוש מסך המשתמש עבור החלפת משמרות.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: formatShift, formatRequestShift, getErrorMessage, ShiftSwapsPage.
 * - קישור מאפיינים ומצב מקומי לתצוגה ולטיפול בפעולות המשתמש.
 */
import {
  ArrowLeft,
  ArrowLeftRight,
  Check,
  Clock3,
  ChevronDown,
  Plus,
  RefreshCw,
  X,
} from 'lucide-react';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useAuth } from '../auth/AuthContext';
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Modal,
  PageHeader,
  Select,
} from '../components/ui';
import { shiftSwapService } from '../services/shiftSwapService';
import type {
  ShiftSwapCreateOptions,
  ShiftSwapRequest,
  ShiftSwapShiftOption,
  ShiftSwapStatus,
  ShiftSwapType,
} from '../types/shiftSwap';
import '../styles/shiftSwaps.css';

// EMPTY_OPTIONS — אפשרויות בחירה.
const EMPTY_OPTIONS: ShiftSwapCreateOptions = {
  myShifts: [],
  dispatchers: [],
  counterpartyShifts: [],
};

// STATUS_LABELS — סטטוס.
const STATUS_LABELS: Record<
  ShiftSwapStatus,
  string
> = {
  pending_counterparty:
    'ממתין לאישור מוקדן',
  pending_manager:
    'ממתין לאישור מנהל',
  approved:
    'אושר',
  rejected_by_counterparty:
    'נדחה על ידי המוקדן',
  rejected_by_manager:
    'נדחה על ידי מנהל',
  cancelled:
    'בוטל',
  expired:
    'פג תוקף',
};

/**
 * פעולה formatShift: עיצוב ערך לתצוגה עבור משמרת.
 * @param shift — משמרת.
 * @returns string — הפלט בהתאם לחתימה.
 */
function formatShift(
  shift: ShiftSwapShiftOption,
): string {
  // date — תאריך.
  const date = new Intl.DateTimeFormat(
    'he-IL',
    {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      timeZone: 'Asia/Jerusalem',
    },
  ).format(
    new Date(
      `${shift.shiftDate}T12:00:00`,
    ),
  );

  const start = new Intl.DateTimeFormat(
    'he-IL',
    {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'Asia/Jerusalem',
    },
  ).format(new Date(shift.startsAt));

  const end = new Intl.DateTimeFormat(
    'he-IL',
    {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'Asia/Jerusalem',
    },
  ).format(new Date(shift.endsAt));

  const weekday = new Intl.DateTimeFormat(
    'he-IL',
    {
      weekday: 'long',
      timeZone: 'Asia/Jerusalem',
    },
  ).format(
    new Date(`${shift.shiftDate}T12:00:00`),
  );

  return `${weekday} · ${date} · \u2066${start}–${end}\u2069`;
}

/**
 * פעולה formatRequestShift: עיצוב ערך לתצוגה עבור נתוני הבקשה / משמרת.
 * @param date — תאריך.
 * @param startsAt — מועד התחלה.
 * @param endsAt — מועד סיום.
 * @returns string — הפלט בהתאם לחתימה.
 */
function formatRequestShift(
  date: string | null,
  startsAt: string | null,
  endsAt: string | null,
): string {
  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !date || !startsAt || !endsAt.
  if (
    !date ||
    !startsAt ||
    !endsAt
  ) {
    return '—';
  }

  return formatShift({
    id: '',
    periodId: '',
    shiftDate: date,
    startsAt,
    endsAt,
    shiftCode: '',
    scheduleType: '',
    isPremium: false,
    holidayName: null,
    periodYear: 0,
    periodMonth: 0,
  });
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
  if (error instanceof Error) {
    return error.message;
  }

  return 'אירעה שגיאה לא צפויה.';
}

/**
 * פעולה ShiftSwapsPage: החלפת משמרות.
 */
function ShiftSwapsPage() {
  const {
    user,
    profile,
    hasPermission,
  } = useAuth();

  // מצב מקומי: requests — הנתון requests בהקשר הפעולה; setRequests מעדכנת אותו ומפעילה רינדור לפי React.
  const [requests, setRequests] =
    useState<ShiftSwapRequest[]>([]);
  // מצב מקומי: options — אפשרויות בחירה; setOptions מעדכנת אותו ומפעילה רינדור לפי React.
  const [options, setOptions] =
    useState<ShiftSwapCreateOptions>(
      EMPTY_OPTIONS,
    );
  // מצב מקומי: isLoading — האם טעינה מתבצעת; setIsLoading מעדכנת אותו ומפעילה רינדור לפי React.
  const [isLoading, setIsLoading] =
    useState(true);
  // מצב מקומי: error — שגיאה; setError מעדכנת אותו ומפעילה רינדור לפי React.
  const [error, setError] =
    useState<string | null>(null);
  // מצב מקומי: success — הנתון success בהקשר הפעולה; setSuccess מעדכנת אותו ומפעילה רינדור לפי React.
  const [success, setSuccess] =
    useState<string | null>(null);
  // מצב מקומי: isCreateOpen — הנתון isCreateOpen בהקשר הפעולה; setIsCreateOpen מעדכנת אותו ומפעילה רינדור לפי React.
  const [isCreateOpen, setIsCreateOpen] =
    useState(false);
  // מצב מקומי: swapType — הנתון swapType בהקשר הפעולה; setSwapType מעדכנת אותו ומפעילה רינדור לפי React.
  const [swapType, setSwapType] =
    useState<ShiftSwapType>('one_way');
  // מצב מקומי: requesterShiftId — מזהה המשמרת; setRequesterShiftId מעדכנת אותו ומפעילה רינדור לפי React.
  const [requesterShiftId, setRequesterShiftId] =
    useState('');
  // מצב מקומי: counterpartyUserId — מזהה משתמש; setCounterpartyUserId מעדכנת אותו ומפעילה רינדור לפי React.
  const [counterpartyUserId, setCounterpartyUserId] =
    useState('');
  // מצב מקומי: counterpartyShiftId — מזהה המשמרת; setCounterpartyShiftId מעדכנת אותו ומפעילה רינדור לפי React.
  const [counterpartyShiftId, setCounterpartyShiftId] =
    useState('');
  // מצב מקומי: busyRequestId — מזהה הבקשה; setBusyRequestId מעדכנת אותו ומפעילה רינדור לפי React.
  const [busyRequestId, setBusyRequestId] =
    useState<string | null>(null);
  // מצב מקומי: isCreating — הנתון isCreating בהקשר הפעולה; setIsCreating מעדכנת אותו ומפעילה רינדור לפי React.
  const [isCreating, setIsCreating] =
    useState(false);
  // מצב מקומי: createError — שגיאה; setCreateError מעדכנת אותו ומפעילה רינדור לפי React.
  const [createError, setCreateError] =
    useState<string | null>(null);
  // מצב מקומי: collapsedSections — הנתון collapsedSections בהקשר הפעולה; setCollapsedSections מעדכנת אותו ומפעילה רינדור לפי React.
  const [collapsedSections, setCollapsedSections] =
    useState<Record<string, boolean>>({
      myRequests: true,
      swappedWithMe: true,
    });
  // מצב מקומי: sectionSeenAt — הנתון sectionSeenAt בהקשר הפעולה; setSectionSeenAt מעדכנת אותו ומפעילה רינדור לפי React.
  const [sectionSeenAt, setSectionSeenAt] =
    useState<Record<string, string | null>>(() => ({
      myRequests: localStorage.getItem('shift-swaps:my-requests-seen-at'),
      swappedWithMe: localStorage.getItem('shift-swaps:swapped-with-me-seen-at'),
    }));
  // canCreate — הנתון canCreate בהקשר הפעולה.
  const canCreate =
    profile?.role === 'dispatcher' &&
    hasPermission('shift_swaps.view');

  // canApprove — הנתון canApprove בהקשר הפעולה.
  const canApprove =
    hasPermission('shift_swaps.approve');

  // loadData — נתונים.
  const loadData = useCallback(
    async (): Promise<void> => {
      setIsLoading(true);
      setError(null);

      // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
      try {
        const requestsPromise =
          shiftSwapService.getRequests();

        // optionsPromise — אפשרויות בחירה.
        const optionsPromise = canCreate
          ? shiftSwapService.getCreateOptions()
          : Promise.resolve(
              EMPTY_OPTIONS,
            );

        const [
          loadedRequests,
          loadedOptions,
        ] = await Promise.all([
          requestsPromise,
          optionsPromise,
        ]);

        setRequests(loadedRequests);
        setOptions(loadedOptions);
      } catch (loadError) {
        setError(
          getErrorMessage(loadError),
        );
      } finally {
        setIsLoading(false);
      }
    },
    [canCreate],
  );

// תופעת לוואי לאחר רינדור בהתאם לתלויות [canCreate].
useEffect(() => {
  // isCancelled — הנתון isCancelled בהקשר הפעולה.
  let isCancelled = false;

  /**
   * פעולה אסינכרונית loadInitialData: טעינת נתונים.
   * @returns Promise<void> — הפלט בהתאם לחתימה.
   */
  const loadInitialData = async (): Promise<void> => {
    // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
    try {
      const requestsPromise =
        shiftSwapService.getRequests();

      // optionsPromise — אפשרויות בחירה.
      const optionsPromise = canCreate
        ? shiftSwapService.getCreateOptions()
        : Promise.resolve(EMPTY_OPTIONS);

      const [
        loadedRequests,
        loadedOptions,
      ] = await Promise.all([
        requestsPromise,
        optionsPromise,
      ]);

      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר isCancelled.
      if (isCancelled) {
        return;
      }

      setRequests(loadedRequests);
      setOptions(loadedOptions);
    } catch (loadError) {
      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר isCancelled.
      if (isCancelled) {
        return;
      }

      setError(
        getErrorMessage(loadError),
      );
    } finally {
      if (!isCancelled) {
        setIsLoading(false);
      }
    }
  };

  void loadInitialData();

  return () => {
    isCancelled = true;
  };
}, [canCreate]);

  // ערך מחושב myRequests — הנתון myRequests בהקשר הפעולה; נשמר בין רינדורים עד שינוי התלויות.
  const myRequests = useMemo(
    () =>
      requests.filter(
        (request) =>
          request.requesterUserId ===
          user?.id,
      ),
    [requests, user?.id],
  );


  // ערך מחושב swappedWithMe — הנתון swappedWithMe בהקשר הפעולה; נשמר בין רינדורים עד שינוי התלויות.
  const swappedWithMe = useMemo(
    () =>
      requests.filter(
        (request) =>
          request.counterpartyUserId === user?.id &&
          request.status === 'approved',
      ),
    [requests, user?.id],
  );

  /**
   * פעולה getLatestUpdatedAt: שליפה או חישוב של מועד עדכון.
   * @param items — פריטים.
   * @returns string | null — הפלט בהתאם לחתימה.
   */
  const getLatestUpdatedAt = (
    items: ShiftSwapRequest[],
  ): string | null =>
    items.reduce<string | null>(
      (latest, request) =>
        !latest || request.updatedAt > latest
          ? request.updatedAt
          : latest,
      null,
    );

  // latestMyRequestsUpdatedAt — מועד עדכון.
  const latestMyRequestsUpdatedAt =
    getLatestUpdatedAt(myRequests);
  // latestSwappedWithMeUpdatedAt — מועד עדכון.
  const latestSwappedWithMeUpdatedAt =
    getLatestUpdatedAt(swappedWithMe);

  // hasNewMyRequests — הנתון hasNewMyRequests בהקשר הפעולה.
  const hasNewMyRequests = Boolean(
    latestMyRequestsUpdatedAt &&
      (!sectionSeenAt.myRequests ||
        latestMyRequestsUpdatedAt > sectionSeenAt.myRequests),
  );

  // hasNewSwappedWithMe — הנתון hasNewSwappedWithMe בהקשר הפעולה.
  const hasNewSwappedWithMe = Boolean(
    latestSwappedWithMeUpdatedAt &&
      (!sectionSeenAt.swappedWithMe ||
        latestSwappedWithMeUpdatedAt > sectionSeenAt.swappedWithMe),
  );

  /**
   * פעולה markSectionSeen: הנתון markSectionSeen בהקשר הפעולה.
   * @param sectionKey — מפתח.
   * @returns void — הפלט בהתאם לחתימה.
   */
  const markSectionSeen = (
    sectionKey: 'myRequests' | 'swappedWithMe',
  ): void => {
    // latestUpdatedAt — מועד עדכון.
    const latestUpdatedAt =
      sectionKey === 'myRequests'
        ? latestMyRequestsUpdatedAt
        : latestSwappedWithMeUpdatedAt;

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !latestUpdatedAt.
    if (!latestUpdatedAt) {
      return;
    }

    // storageKey — מפתח.
    const storageKey =
      sectionKey === 'myRequests'
        ? 'shift-swaps:my-requests-seen-at'
        : 'shift-swaps:swapped-with-me-seen-at';

    localStorage.setItem(storageKey, latestUpdatedAt);
    setSectionSeenAt((current) => ({
      ...current,
      [sectionKey]: latestUpdatedAt,
    }));
  };

  /**
   * פעולה toggleSection: החלפת בחירה עבור הנתון toggleSection בהקשר הפעולה.
   * @param sectionKey — מפתח.
   * @returns void — הפלט בהתאם לחתימה.
   */
  const toggleSection = (
    sectionKey: 'myRequests' | 'swappedWithMe',
  ): void => {
    setCollapsedSections((current) => {
      const willOpen = Boolean(current[sectionKey]);

      if (willOpen) {
        markSectionSeen(sectionKey);
      }

      return {
        ...current,
        [sectionKey]: !current[sectionKey],
      };
    });
  };

  // ערך מחושב awaitingMyResponse — תוצאת הפעולה; נשמר בין רינדורים עד שינוי התלויות.
  const awaitingMyResponse = useMemo(
    () =>
      requests.filter(
        (request) =>
          request.counterpartyUserId ===
            user?.id &&
          request.status ===
            'pending_counterparty',
      ),
    [requests, user?.id],
  );

  // ערך מחושב awaitingManager — הנתון awaitingManager בהקשר הפעולה; נשמר בין רינדורים עד שינוי התלויות.
  const awaitingManager = useMemo(
    () =>
      canApprove
        ? requests.filter(
            (request) =>
              request.status ===
              'pending_manager',
          )
        : [],
    [canApprove, requests],
  );

  // selectedRequesterShift — נבחר / משמרת.
  const selectedRequesterShift =
    options.myShifts.find(
      (shift) =>
        shift.id === requesterShiftId,
    ) ?? null;

  // ערך מחושב availableCounterpartyShifts — מספר הסימונים כזמין; נשמר בין רינדורים עד שינוי התלויות.
  const availableCounterpartyShifts =
    useMemo(() => {
      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !counterpartyUserId || !selectedRequesterShift.
      if (
        !counterpartyUserId ||
        !selectedRequesterShift
      ) {
        return [];
      }

      return options.counterpartyShifts.filter(
        (shift) =>
          shift.assignedUserId ===
            counterpartyUserId &&
          shift.periodId ===
            selectedRequesterShift.periodId,
      );
    }, [
      counterpartyUserId,
      options.counterpartyShifts,
      selectedRequesterShift,
    ]);

  /**
   * פעולה resetCreateForm: איפוס הנתון resetCreateForm בהקשר הפעולה.
   * @returns void — הפלט בהתאם לחתימה.
   */
  const resetCreateForm =
    (): void => {
      setSwapType('one_way');
      setRequesterShiftId('');
      setCounterpartyUserId('');
      setCounterpartyShiftId('');
    };

/**
 * פעולה אסינכרונית handleCreate: טיפול באירוע עבור הנתון handleCreate בהקשר הפעולה.
 * @returns Promise<void> — הפלט בהתאם לחתימה.
 */
const handleCreate =
  async (): Promise<void> => {
    setIsCreating(true);
    setCreateError(null);
    setSuccess(null);

    // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
    try {
      await shiftSwapService.createRequest({
        swapType,
        requesterShiftId,
        counterpartyUserId,
        counterpartyShiftId:
          swapType === 'two_way'
            ? counterpartyShiftId
            : null,
      });

      setSuccess(
        'בקשת ההחלפה נשלחה למוקדן השני לאישור.',
      );

      setIsCreateOpen(false);
      resetCreateForm();

      await loadData();
    } catch (createRequestError) {
      setCreateError(
        getErrorMessage(createRequestError),
      );
    } finally {
      setIsCreating(false);
    }
  };

  /**
   * פעולה אסינכרונית runRequestAction: נתוני הבקשה.
   * @param requestId — מזהה הבקשה.
   * @param action — הנתון action בהקשר הפעולה.
   * @param successMessage — הודעה.
   * @returns Promise<void> — הפלט בהתאם לחתימה.
   */
  const runRequestAction =
    async (
      requestId: string,
      action: () => Promise<unknown>,
      successMessage: string,
    ): Promise<void> => {
      setBusyRequestId(requestId);
      setError(null);
      setSuccess(null);

      // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
      try {
        await action();
        setSuccess(successMessage);
        await loadData();
      } catch (actionError) {
        setError(
          getErrorMessage(actionError),
        );
      } finally {
        setBusyRequestId(null);
      }
    };

  /**
   * פעולה renderRequestCard: בניית תצוגה עבור נתוני הבקשה.
   * @param request — נתוני הבקשה.
   * @param actions — הנתון actions בהקשר הפעולה.
   * @returns React.ReactNode — הפלט בהתאם לחתימה.
   */
  const renderRequestCard = (
    request: ShiftSwapRequest,
    actions?: React.ReactNode,
  ): React.ReactNode => (
    <Card
      key={request.id}
      className="shift-swap-card"
    >
      <CardHeader className="shift-swap-card-header">
        <div>
          <CardTitle>
            {request.swapType === 'one_way'
              ? 'חילוף חד-כיווני'
              : 'חילוף דו-כיווני'}
          </CardTitle>

          <span
            className={`shift-swap-status shift-swap-status-${request.status}`}
          >
            {STATUS_LABELS[request.status]}
          </span>
        </div>

        {request.swapType === 'one_way' ? (
          <ArrowLeft
            size={22}
            aria-hidden="true"
          />
        ) : (
          <ArrowLeftRight
            size={22}
            aria-hidden="true"
          />
        )}
      </CardHeader>

      <CardBody>
        <div className="shift-swap-flow">
          <div>
            <span>מגיש הבקשה</span>
            <strong>
              {request.requesterName}
            </strong>
            <small>
              {formatRequestShift(
                request.requesterShiftDate,
                request.requesterStartsAt,
                request.requesterEndsAt,
              )}
            </small>
          </div>

          {request.swapType === 'one_way' ? (
            <ArrowLeft
              size={18}
              aria-hidden="true"
            />
          ) : (
            <ArrowLeftRight
              size={18}
              aria-hidden="true"
            />
          )}

          <div>
            <span>המוקדן השני</span>
            <strong>
              {request.counterpartyName}
            </strong>
            <small>
              {request.swapType === 'two_way'
                ? formatRequestShift(
                    request.counterpartyShiftDate,
                    request.counterpartyStartsAt,
                    request.counterpartyEndsAt,
                  )
                : 'מקבל את המשמרת'}
            </small>
          </div>
        </div>

        {request.rejectionReason ? (
          <p className="shift-swap-rejection-reason">
            סיבת דחייה: {request.rejectionReason}
          </p>
        ) : null}

        {actions ? (
          <div className="shift-swap-card-actions">
            {actions}
          </div>
        ) : null}
      </CardBody>
    </Card>
  );

  return (
    <div className="shift-swaps-page">
      <PageHeader
        title="החלפות משמרת"
        description="בקשות לחילוף משמרות מוקדנים בחודש הנוכחי ובחודש הבא לאחר פרסום הלוח."
        actions={(
          <div className="shift-swaps-header-actions">
            <Button
              variant="secondary"
              onClick={() => {
                void loadData();
              }}
              disabled={isLoading}
            >
              <RefreshCw
                size={17}
                aria-hidden="true"
              />
              רענון
            </Button>

            {canCreate ? (
              <Button
                onClick={() => {
                  setCreateError(null);
                  setIsCreateOpen(true);
                }}
              >
                <Plus
                  size={18}
                  aria-hidden="true"
                />
                בקשת החלפה חדשה
              </Button>
            ) : null}
          </div>
        )}
      />

      {error ? (
        <div className="shift-swap-message shift-swap-message-error">
          {error}
        </div>
      ) : null}

      {success ? (
        <div className="shift-swap-message shift-swap-message-success">
          {success}
        </div>
      ) : null}

      {isLoading ? (
        <div className="shift-swap-empty-state">
          <Clock3
            size={26}
            aria-hidden="true"
          />
          טוען בקשות החלפה...
        </div>
      ) : (
        <div className="shift-swaps-sections">
          {awaitingMyResponse.length > 0 ? (
            <section>
              <h2>ממתינות לפעולה שלי</h2>
              <div className="shift-swap-grid">
                {awaitingMyResponse.map(
                  (request) =>
                    renderRequestCard(
                      request,
                      <>
                        <Button
                          onClick={() => {
                            void runRequestAction(
                              request.id,
                              () =>
                                shiftSwapService.respondToRequest(
                                  request.id,
                                  true,
                                ),
                              'הבקשה אושרה והועברה לאישור מנהל.',
                            );
                          }}
                          disabled={
                            busyRequestId ===
                            request.id
                          }
                        >
                          <Check
                            size={17}
                            aria-hidden="true"
                          />
                          אישור
                        </Button>

                        <Button
                          variant="danger"
                          onClick={() => {
                            void runRequestAction(
                              request.id,
                              () =>
                                shiftSwapService.respondToRequest(
                                  request.id,
                                  false,
                                ),
                              'בקשת ההחלפה נדחתה.',
                            );
                          }}
                          disabled={
                            busyRequestId ===
                            request.id
                          }
                        >
                          <X
                            size={17}
                            aria-hidden="true"
                          />
                          דחייה
                        </Button>
                      </>,
                    ),
                )}
              </div>
            </section>
          ) : null}

          {awaitingManager.length > 0 ? (
            <section>
              <h2>ממתינות לאישור מנהל</h2>
              <div className="shift-swap-grid">
                {awaitingManager.map(
                  (request) =>
                    renderRequestCard(
                      request,
                      <>
                        <Button
                          onClick={() => {
                            void runRequestAction(
                              request.id,
                              () =>
                                shiftSwapService.reviewRequest(
                                  request.id,
                                  true,
                                ),
                              'ההחלפה אושרה ולוח השיבוצים עודכן.',
                            );
                          }}
                          disabled={
                            busyRequestId ===
                            request.id
                          }
                        >
                          <Check
                            size={17}
                            aria-hidden="true"
                          />
                          אישור סופי
                        </Button>

                        <Button
                          variant="danger"
                          onClick={() => {
                            void runRequestAction(
                              request.id,
                              () =>
                                shiftSwapService.reviewRequest(
                                  request.id,
                                  false,
                                ),
                              'בקשת ההחלפה נדחתה על ידי מנהל.',
                            );
                          }}
                          disabled={
                            busyRequestId ===
                            request.id
                          }
                        >
                          <X
                            size={17}
                            aria-hidden="true"
                          />
                          דחייה
                        </Button>
                      </>,
                    ),
                )}
              </div>
            </section>
          ) : null}

          <section className="shift-swap-collapsible-section">
            <button
              type="button"
              className="shift-swap-section-toggle"
              onClick={() => {
                toggleSection('myRequests');
              }}
              aria-expanded={!collapsedSections.myRequests}
            >
              <span>
                <span className="shift-swap-section-title-row">
                  <strong>הבקשות שלי</strong>
                  {hasNewMyRequests ? (
                    <span className="shift-swap-new-badge">חדש</span>
                  ) : null}
                </span>
                <small>{myRequests.length} בקשות</small>
              </span>
              <ChevronDown
                size={20}
                className={collapsedSections.myRequests ? 'collapsed' : ''}
                aria-hidden="true"
              />
            </button>

            {!collapsedSections.myRequests ? (
              myRequests.length === 0 ? (
                <div className="shift-swap-empty-state">
                  עדיין לא הגשת בקשות החלפה.
                </div>
              ) : (
                <div className="shift-swap-grid">
                  {myRequests.map((request) =>
                    renderRequestCard(
                      request,
                      request.status === 'pending_counterparty' ||
                        request.status === 'pending_manager'
                        ? (
                            <Button
                              variant="secondary"
                              onClick={() => {
                                void runRequestAction(
                                  request.id,
                                  () => shiftSwapService.cancelRequest(request.id),
                                  'בקשת ההחלפה בוטלה.',
                                );
                              }}
                              disabled={busyRequestId === request.id}
                            >
                              ביטול בקשה
                            </Button>
                          )
                        : undefined,
                    ),
                  )}
                </div>
              )
            ) : null}
          </section>

          <section className="shift-swap-collapsible-section">
            <button
              type="button"
              className="shift-swap-section-toggle"
              onClick={() => {
                toggleSection('swappedWithMe');
              }}
              aria-expanded={!collapsedSections.swappedWithMe}
            >
              <span>
                <span className="shift-swap-section-title-row">
                  <strong>משמרות שהוחלפו איתי</strong>
                  {hasNewSwappedWithMe ? (
                    <span className="shift-swap-new-badge">חדש</span>
                  ) : null}
                </span>
                <small>{swappedWithMe.length} החלפות שאושרו</small>
              </span>
              <ChevronDown
                size={20}
                className={collapsedSections.swappedWithMe ? 'collapsed' : ''}
                aria-hidden="true"
              />
            </button>

            {!collapsedSections.swappedWithMe ? (
              swappedWithMe.length === 0 ? (
                <div className="shift-swap-empty-state">
                  עדיין אין משמרות שהוחלפו איתך.
                </div>
              ) : (
                <div className="shift-swap-grid">
                  {swappedWithMe.map((request) =>
                    renderRequestCard(request),
                  )}
                </div>
              )
            ) : null}
          </section>
        </div>
      )}

      <Modal
        isOpen={isCreateOpen}
        title="בקשת החלפת משמרת חדשה"
        onClose={() => {
          if (!isCreating) {
            setIsCreateOpen(false);
          }
        }}
        footer={(
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setIsCreateOpen(false);
              }}
              disabled={isCreating}
            >
              ביטול
            </Button>

            <Button
              onClick={() => {
                void handleCreate();
              }}
              disabled={
                isCreating ||
                !requesterShiftId ||
                !counterpartyUserId ||
                (
                  swapType === 'two_way' &&
                  !counterpartyShiftId
                )
              }
            >
              שליחת בקשה
            </Button>
          </>
        )}
      >
        <div className="shift-swap-create-form">
        {createError ? (
          <div className="shift-swap-message shift-swap-message-error">
            {createError}
          </div>
        ) : null}
          <div className="shift-swap-type-selector">
            <button
              type="button"
              className={
                swapType === 'one_way'
                  ? 'active'
                  : ''
              }
              onClick={() => {
                setSwapType('one_way');
                setCounterpartyShiftId('');
              }}
            >
              <strong>חד-כיווני</strong>
              <span>
                המוקדן השני לוקח את המשמרת שלך.
              </span>
            </button>

            <button
              type="button"
              className={
                swapType === 'two_way'
                  ? 'active'
                  : ''
              }
              onClick={() => {
                setSwapType('two_way');
              }}
            >
              <strong>דו-כיווני</strong>
              <span>
                החלפה בין שתי משמרות של שני מוקדנים.
              </span>
            </button>
          </div>

          <Select
            label="המשמרת שלי"
            value={requesterShiftId}
            placeholder="בחירת משמרת"
            options={options.myShifts.map(
              (shift) => ({
                value: shift.id,
                label: formatShift(shift),
              }),
            )}
            onChange={(event) => {
              setRequesterShiftId(
                event.target.value,
              );
              setCounterpartyShiftId('');
            }}
          />

          <Select
            label="מוקדן מחליף"
            value={counterpartyUserId}
            placeholder="בחירת מוקדן"
            options={options.dispatchers.map(
              (dispatcher) => ({
                value: dispatcher.id,
                label:
                  dispatcher.scheduleName ??
                  dispatcher.displayName,
              }),
            )}
            onChange={(event) => {
              setCounterpartyUserId(
                event.target.value,
              );
              setCounterpartyShiftId('');
            }}
          />

          {swapType === 'two_way' ? (
            <Select
              label="המשמרת של המוקדן השני"
              value={counterpartyShiftId}
              placeholder="בחירת משמרת להחלפה"
              options={availableCounterpartyShifts.map(
                (shift) => ({
                  value: shift.id,
                  label: formatShift(shift),
                }),
              )}
              helperText={
                requesterShiftId &&
                counterpartyUserId &&
                availableCounterpartyShifts.length ===
                  0
                  ? 'לא נמצאו למוקדן הזה משמרות עתידיות באותו חודש שיבוץ.'
                  : undefined
              }
              onChange={(event) => {
                setCounterpartyShiftId(
                  event.target.value,
                );
              }}
            />
          ) : null}

          <div className="shift-swap-validation-note">
            המערכת תבדוק לפני השליחה, לפני אישור המוקדן ולפני האישור הסופי שלא נוצרת חפיפה או משמרת רצופה אסורה.
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default ShiftSwapsPage;
