/**
 * קובץ: src/pages/NotificationsPage.tsx
 * מטרה: מימוש מסך המשתמש עבור התראות.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: NotificationFilter, WorkspaceTab, formatNotificationDate, formatSwapShift, getNotificationIcon, getErrorMessage, NotificationsPage.
 * - קישור מאפיינים ומצב מקומי לתצוגה ולטיפול בפעולות המשתמש.
 */
import {
  ArrowLeftRight,
  Bell,
  Check,
  CheckCheck,
  CircleCheck,
  Clock3,
  Download,
  FileText,
  Megaphone,
  Paperclip,
  ChevronDown,
  RefreshCw,
  X,
} from 'lucide-react';
import {
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  useNavigate,
  useSearchParams,
} from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useNotificationContext } from '../features/notifications/context/useNotificationContext';
import type { MyNotification } from '../features/notifications/services/notificationService';
import { dynamicSchedulingService } from '../services/dynamicSchedulingService';
import { shiftSwapService } from '../services/shiftSwapService';
import { dailyReportService } from '../services/dailyReportService';
import Modal from '../components/ui/Modal';
import type { DailyReportDetail } from '../types/dailyReports';
import type { DynamicShiftExchangeRequest } from '../types/dynamicScheduling';
import type { ShiftSwapRequest } from '../types/shiftSwap';
import '../styles/notifications.css';
import { dynamicShiftDisplayName } from '../utils/dynamicShiftDisplayName';
import AnnouncementComposer from '../features/notifications/components/AnnouncementComposer';

/**
 * טיפוס NotificationFilter: התראות / סינון.
 */
type NotificationFilter = 'all' | 'unread' | 'read';
/**
 * טיפוס WorkspaceTab: הנתון WorkspaceTab בהקשר הפעולה.
 */
type WorkspaceTab = 'notifications' | 'requests';

/**
 * פעולה formatNotificationDate: עיצוב ערך לתצוגה עבור התראות / תאריך.
 * @param value — ערך.
 * @returns string — הפלט בהתאם לחתימה.
 */
function formatNotificationDate(value: string): string {
  // date — תאריך.
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('he-IL', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

/**
 * פעולה formatSwapShift: עיצוב ערך לתצוגה עבור משמרת.
 * @param date — תאריך.
 * @param startsAt — מועד התחלה.
 * @param endsAt — מועד סיום.
 * @returns string — הפלט בהתאם לחתימה.
 */
function formatSwapShift(
  date: string | null,
  startsAt: string | null,
  endsAt: string | null,
): string {
  if (!date || !startsAt || !endsAt) return '—';
  // baseDate — תאריך.
  const baseDate = new Date(`${date}T12:00:00`);
  const weekday = new Intl.DateTimeFormat('he-IL', {
    weekday: 'long',
    timeZone: 'Asia/Jerusalem',
  }).format(baseDate);
  // formattedDate — תאריך.
  const formattedDate = new Intl.DateTimeFormat('he-IL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'Asia/Jerusalem',
  }).format(baseDate);
  // timeFormatter — זמן.
  const timeFormatter = new Intl.DateTimeFormat('he-IL', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Jerusalem',
  });
  return `${weekday} · ${formattedDate} · \u2066${timeFormatter.format(new Date(startsAt))}–${timeFormatter.format(new Date(endsAt))}\u2069`;
}

/**
 * פעולה getNotificationIcon: שליפה או חישוב של התראות.
 * @param notification — התראות.
 */
function getNotificationIcon(notification: MyNotification) {
  return notification.isRead ? CircleCheck : Bell;
}

/**
 * פעולה getErrorMessage: שליפה או חישוב של הודעת שגיאה.
 * @param error — שגיאה.
 * @returns string — הפלט בהתאם לחתימה.
 */
function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'אירעה שגיאה לא צפויה.';
}

/**
 * פעולה NotificationsPage: התראות.
 */
function NotificationsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { hasPermission } = useAuth();
  // canViewNotifications — האם צפייה מותרת.
  const canViewNotifications =
    hasPermission('notifications.view') || hasPermission('notifications.manage');
  // canApproveSwaps — הנתון canApproveSwaps בהקשר הפעולה.
  const canApproveSwaps = hasPermission('shift_swaps.approve');
  // canSendAnnouncements — הודעות מנהל.
  const canSendAnnouncements = hasPermission('announcements.send');
  const requestedTab = searchParams.get('tab');
  // activeTab — פעיל.
  const activeTab: WorkspaceTab =
    requestedTab === 'requests' && canApproveSwaps
      ? 'requests'
      : canViewNotifications
        ? 'notifications'
        : 'requests';
  // מצב מקומי: activeFilter — פעיל / סינון; setActiveFilter מעדכנת אותו ומפעילה רינדור לפי React.
  const [activeFilter, setActiveFilter] = useState<NotificationFilter>('all');
  // מצב מקומי: swapRequests — הנתון swapRequests בהקשר הפעולה; setSwapRequests מעדכנת אותו ומפעילה רינדור לפי React.
  const [swapRequests, setSwapRequests] = useState<ShiftSwapRequest[]>([]);
  // מצב מקומי: dynamicSwapRequests — דינמי; setDynamicSwapRequests מעדכנת אותו ומפעילה רינדור לפי React.
  const [dynamicSwapRequests, setDynamicSwapRequests] = useState<DynamicShiftExchangeRequest[]>([]);
  // מצב מקומי: requestsLoading — טעינה; setRequestsLoading מעדכנת אותו ומפעילה רינדור לפי React.
  const [requestsLoading, setRequestsLoading] = useState(canApproveSwaps);
  // מצב מקומי: requestsError — שגיאה; setRequestsError מעדכנת אותו ומפעילה רינדור לפי React.
  const [requestsError, setRequestsError] = useState<string | null>(null);
  // מצב מקומי: requestsSuccess — הנתון requestsSuccess בהקשר הפעולה; setRequestsSuccess מעדכנת אותו ומפעילה רינדור לפי React.
  const [requestsSuccess, setRequestsSuccess] = useState<string | null>(null);
  // מצב מקומי: busyRequestId — מזהה הבקשה; setBusyRequestId מעדכנת אותו ומפעילה רינדור לפי React.
  const [busyRequestId, setBusyRequestId] = useState<string | null>(null);
  // מצב מקומי: isRequestHistoryOpen — נתוני הבקשה / היסטוריה; setIsRequestHistoryOpen מעדכנת אותו ומפעילה רינדור לפי React.
  const [isRequestHistoryOpen, setIsRequestHistoryOpen] = useState(false);
  // מצב מקומי: dailyReportDetail — דוחות פעילות יומיים; setDailyReportDetail מעדכנת אותו ומפעילה רינדור לפי React.
  const [dailyReportDetail, setDailyReportDetail] = useState<DailyReportDetail | null>(null);
  // מצב מקומי: dailyReportDetailLoading — דוחות פעילות יומיים; setDailyReportDetailLoading מעדכנת אותו ומפעילה רינדור לפי React.
  const [dailyReportDetailLoading, setDailyReportDetailLoading] = useState(false);
  // מצב מקומי: dailyReportDetailError — דוחות פעילות יומיים; setDailyReportDetailError מעדכנת אותו ומפעילה רינדור לפי React.
  const [dailyReportDetailError, setDailyReportDetailError] = useState<string | null>(null);
  // מצב מקומי: isAnnouncementComposerOpen — הודעות מנהל; setIsAnnouncementComposerOpen מעדכנת אותו ומפעילה רינדור לפי React.
  const [isAnnouncementComposerOpen, setIsAnnouncementComposerOpen] = useState(
    requestedTab === 'send' && canSendAnnouncements,
  );
  // מצב מקומי: announcementSuccess — הודעות מנהל; setAnnouncementSuccess מעדכנת אותו ומפעילה רינדור לפי React.
  const [announcementSuccess, setAnnouncementSuccess] = useState<string | null>(null);

  const {
    state,
    unreadCount,
    loadNotifications,
    refreshActivity,
    markAsRead,
    markAllAsRead,
  } = useNotificationContext();

  // תופעת לוואי לאחר רינדור בהתאם לתלויות [canApproveSwaps].
  useEffect(() => {
    if (!canApproveSwaps) return;
    let cancelled = false;
    /**
     * פעולה אסינכרונית load: טעינת הנתון load בהקשר הפעולה.
     * @returns Promise<void> — הפלט בהתאם לחתימה.
     */
    const load = async (): Promise<void> => {
      // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
      try {
        const [legacyData, dynamicData] = await Promise.all([
          shiftSwapService.getRequests(),
          dynamicSchedulingService.getDynamicShiftExchangeRequests(),
        ]);
        if (!cancelled) {
          setSwapRequests(legacyData);
          setDynamicSwapRequests(dynamicData);
        }
      } catch (error) {
        if (!cancelled) setRequestsError(getErrorMessage(error));
      } finally {
        if (!cancelled) setRequestsLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [canApproveSwaps]);

  // ערך מחושב pendingManagerRequests — ממתין; נשמר בין רינדורים עד שינוי התלויות.
  const pendingManagerRequests = useMemo(
    () => swapRequests.filter((request) => request.status === 'pending_manager'),
    [swapRequests],
  );

  // ערך מחושב pendingDynamicManagerRequests — ממתין / דינמי; נשמר בין רינדורים עד שינוי התלויות.
  const pendingDynamicManagerRequests = useMemo(
    () => dynamicSwapRequests.filter((request) => request.status === 'pending_manager'),
    [dynamicSwapRequests],
  );

  // ערך מחושב reviewedDynamicManagerRequests — דינמי; נשמר בין רינדורים עד שינוי התלויות.
  const reviewedDynamicManagerRequests = useMemo(
    () =>
      dynamicSwapRequests
        .filter(
          (request) =>
            Boolean(request.managerReviewedAt) &&
            (request.status === 'approved' || request.status === 'rejected_by_manager'),
        )
        .sort((first, second) =>
          (second.managerReviewedAt ?? '').localeCompare(first.managerReviewedAt ?? ''),
        ),
    [dynamicSwapRequests],
  );

  // ערך מחושב reviewedManagerRequests — הנתון reviewedManagerRequests בהקשר הפעולה; נשמר בין רינדורים עד שינוי התלויות.
  const reviewedManagerRequests = useMemo(
    () =>
      swapRequests
        .filter(
          (request) =>
            Boolean(request.managerReviewedAt) &&
            (request.status === 'approved' ||
              request.status === 'rejected_by_manager'),
        )
        .sort((first, second) =>
          (second.managerReviewedAt ?? '').localeCompare(
            first.managerReviewedAt ?? '',
          ),
        ),
    [swapRequests],
  );

  /**
   * פעולה selectWorkspaceTab: בחירת הנתון selectWorkspaceTab בהקשר הפעולה.
   * @param tab — הנתון tab בהקשר הפעולה.
   * @returns void — הפלט בהתאם לחתימה.
   */
  const selectWorkspaceTab = (tab: WorkspaceTab): void => {
    // nextParams — הנתון nextParams בהקשר הפעולה.
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('tab', tab);
    setSearchParams(nextParams, { replace: true });
  };

  /**
   * פעולה openAnnouncementComposer: פתיחת הודעות מנהל.
   * @returns void — הפלט בהתאם לחתימה.
   */
  const openAnnouncementComposer = (): void => {
    setAnnouncementSuccess(null);
    setIsAnnouncementComposerOpen(true);
  };

  /**
   * פעולה closeAnnouncementComposer: סגירת הודעות מנהל.
   * @returns void — הפלט בהתאם לחתימה.
   */
  const closeAnnouncementComposer = (): void => {
    setIsAnnouncementComposerOpen(false);
    if (searchParams.get('tab') === 'send') {
      // nextParams — הנתון nextParams בהקשר הפעולה.
      const nextParams = new URLSearchParams(searchParams);
      nextParams.set('tab', canViewNotifications ? 'notifications' : 'requests');
      setSearchParams(nextParams, { replace: true });
    }
  };

  // ערך מחושב filteredNotifications — התראות; נשמר בין רינדורים עד שינוי התלויות.
  const filteredNotifications = useMemo(() => {
    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר activeFilter === 'unread'.
    if (activeFilter === 'unread') {
      return state.notifications.filter((notification) => !notification.isRead);
    }
    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר activeFilter === 'read'.
    if (activeFilter === 'read') {
      return state.notifications.filter((notification) => notification.isRead);
    }
    return state.notifications;
  }, [activeFilter, state.notifications]);

  // readCount — כמות.
  const readCount = state.notifications.length - unreadCount;

  // focusedNotificationId — התראות / מזהה.
  const focusedNotificationId = searchParams.get('notification');

  // תופעת לוואי לאחר רינדור בהתאם לתלויות [focusedNotificationId, state.isLoading, state.notifications].
  useEffect(() => {
    if (!focusedNotificationId || state.isLoading) return;

    setActiveFilter('all');

    const frame = window.requestAnimationFrame(() => {
      const element = document.getElementById(
        `notification-${focusedNotificationId}`,
      );

      element?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [focusedNotificationId, state.isLoading, state.notifications]);

  /**
   * פעולה אסינכרונית handleNotificationClick: טיפול באירוע עבור התראות.
   * @param notification — התראות.
   * @returns Promise<void> — הפלט בהתאם לחתימה.
   */
  const handleNotificationClick = async (notification: MyNotification): Promise<void> => {
    if (!notification.isRead) {
      await markAsRead(notification.recipientId);
    }

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר notification.source === 'daily_report'.
    if (notification.source === 'daily_report') {
      // reportId — דוח / מזהה.
      const reportId = typeof notification.data?.reportId === 'string'
        ? notification.data.reportId
        : null;
      if (!reportId) return;
      setDailyReportDetail(null);
      setDailyReportDetailError(null);
      setDailyReportDetailLoading(true);
      // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
      try {
        setDailyReportDetail(await dailyReportService.getDetail(reportId));
      } catch (error) {
        setDailyReportDetailError(getErrorMessage(error));
      } finally {
        setDailyReportDetailLoading(false);
      }
      return;
    }

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר canApproveSwaps && notification.type === 'shift_swap'.
    if (
      canApproveSwaps &&
      notification.type === 'shift_swap'
    ) {
      navigate('/notifications?tab=requests');
      return;
    }

    if (notification.url) {
      navigate(notification.url);
    }
  };

  /**
   * פעולה אסינכרונית refreshRequests: רענון הנתון refreshRequests בהקשר הפעולה.
   * @returns Promise<void> — הפלט בהתאם לחתימה.
   */
  const refreshRequests = async (): Promise<void> => {
    setRequestsLoading(true);
    setRequestsError(null);
    // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
    try {
      const [legacyData, dynamicData] = await Promise.all([
        shiftSwapService.getRequests(),
        dynamicSchedulingService.getDynamicShiftExchangeRequests(),
      ]);
      setSwapRequests(legacyData);
      setDynamicSwapRequests(dynamicData);
    } catch (error) {
      setRequestsError(getErrorMessage(error));
    } finally {
      setRequestsLoading(false);
    }
  };

  /**
   * פעולה אסינכרונית reviewDynamicSwap: דינמי.
   * @param requestId — מזהה הבקשה.
   * @param approve — הנתון approve בהקשר הפעולה.
   * @returns Promise<void> — הפלט בהתאם לחתימה.
   */
  const reviewDynamicSwap = async (requestId: string, approve: boolean): Promise<void> => {
    setBusyRequestId(`dynamic:${requestId}`);
    setRequestsError(null);
    setRequestsSuccess(null);
    // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
    try {
      await dynamicSchedulingService.reviewDynamicShiftExchangeRequest(requestId, approve);
      setRequestsSuccess(
        approve
          ? 'החילוף הדינמי אושר ולוח השיבוצים עודכן.'
          : 'בקשת החילוף הדינמית נדחתה.',
      );
      await Promise.all([refreshRequests(), refreshActivity()]);
    } catch (error) {
      setRequestsError(getErrorMessage(error));
    } finally {
      setBusyRequestId(null);
    }
  };

  /**
   * פעולה formatDynamicSwapShift: עיצוב ערך לתצוגה עבור דינמי / משמרת.
   * @param date — תאריך.
   * @param shiftName — משמרת / שם.
   * @param startTime — שעת התחלה.
   * @param endTime — שעת סיום.
   * @returns string — הפלט בהתאם לחתימה.
   */
  const formatDynamicSwapShift = (
    date: string | null,
    shiftName: string | null,
    startTime: string | null,
    endTime: string | null,
  ): string => {
    if (!date || !startTime || !endTime) return '—';
    const [year, month, day] = date.slice(0, 10).split('-');
    // displayName — שם תצוגה.
    const displayName = shiftName ? dynamicShiftDisplayName(shiftName, '') : '';
    // name — שם.
    const name = displayName ? `${displayName} · ` : '';
    return `${name}${day}/${month}/${year} · \u2066${startTime.slice(0, 5)}–${endTime.slice(0, 5)}\u2069`;
  };

  /**
   * פעולה אסינכרונית reviewSwap: הנתון reviewSwap בהקשר הפעולה.
   * @param requestId — מזהה הבקשה.
   * @param approve — הנתון approve בהקשר הפעולה.
   * @returns Promise<void> — הפלט בהתאם לחתימה.
   */
  const reviewSwap = async (requestId: string, approve: boolean): Promise<void> => {
    setBusyRequestId(requestId);
    setRequestsError(null);
    setRequestsSuccess(null);
    // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
    try {
      await shiftSwapService.reviewRequest(requestId, approve);
      setRequestsSuccess(
        approve
          ? 'ההחלפה אושרה ולוח השיבוצים עודכן.'
          : 'בקשת ההחלפה נדחתה.',
      );
      await Promise.all([
        refreshRequests(),
        refreshActivity(),
      ]);
    } catch (error) {
      setRequestsError(getErrorMessage(error));
    } finally {
      setBusyRequestId(null);
    }
  };

  return (
    <section className="notifications-page">
      <header className="notifications-page-header">
        <div>
          <h1>
            {canApproveSwaps
              ? 'התראות ובקשות'
              : 'התראות'}
          </h1>
          <p>
            {canApproveSwaps
              ? 'מרכז אחד להתראות מערכת ולבקשות שממתינות לטיפול.'
              : 'כל העדכונים, התזכורות והודעות המערכת במקום אחד.'}
          </p>
        </div>
      </header>

      <div
        className="notifications-workspace-navigation"
        role="tablist"
        aria-label={canApproveSwaps ? 'התראות ובקשות' : 'התראות'}
      >
        {canViewNotifications ? (
          <button
            type="button"
            className={activeTab === 'notifications' ? 'active' : ''}
            onClick={() => selectWorkspaceTab('notifications')}
          >
            התראות
            <span>{unreadCount}</span>
          </button>
        ) : null}
        {canApproveSwaps ? (
          <button
            type="button"
            className={activeTab === 'requests' ? 'active' : ''}
            onClick={() => selectWorkspaceTab('requests')}
          >
            בקשות
            <span>{pendingManagerRequests.length + pendingDynamicManagerRequests.length}</span>
          </button>
        ) : null}
        {canSendAnnouncements ? (
          <button
            type="button"
            className="notifications-send-announcement-button"
            onClick={openAnnouncementComposer}
          >
            <Megaphone size={18} aria-hidden="true" />
            שליחת עדכון
          </button>
        ) : null}
      </div>

      {announcementSuccess ? (
        <div className="notifications-page-message notifications-page-success" role="status">
          {announcementSuccess}
        </div>
      ) : null}

      {activeTab === 'notifications' && canViewNotifications ? (
        <>
          <div className="notifications-toolbar">
            <div className="notifications-filters" role="group" aria-label="סינון התראות">
              {(['all', 'unread', 'read'] as const).map((filter) => (
                <button
                  key={filter}
                  type="button"
                  className={`notifications-filter-button ${activeFilter === filter ? 'notifications-filter-button-active' : ''}`}
                  onClick={() => setActiveFilter(filter)}
                >
                  {filter === 'all' ? 'הכול' : filter === 'unread' ? 'לא נקראו' : 'נקראו'}
                  <span>{filter === 'all' ? state.notifications.length : filter === 'unread' ? unreadCount : readCount}</span>
                </button>
              ))}
            </div>
            <div className="notifications-toolbar-actions">
              <button type="button" className="notifications-toolbar-button" disabled={state.isLoading || state.isUpdating} onClick={() => void loadNotifications()}>
                <RefreshCw size={17} aria-hidden="true" /> רענון
              </button>
              <button type="button" className="notifications-toolbar-button notifications-toolbar-primary" disabled={unreadCount === 0 || state.isUpdating} onClick={() => void markAllAsRead()}>
                <CheckCheck size={17} aria-hidden="true" /> סמן הכול כנקרא
              </button>
            </div>
          </div>

          {state.error ? <div className="notifications-page-message notifications-page-error">{state.error}</div> : null}
          {state.isLoading ? <div className="notifications-page-state"><RefreshCw className="notifications-page-spinner" size={24} aria-hidden="true" />טוען התראות...</div> : null}
          {!state.isLoading && !state.error && filteredNotifications.length === 0 ? (
            <div className="notifications-empty-state"><Bell size={34} aria-hidden="true" /><h2>אין התראות להצגה</h2><p>אין כרגע התראות בסינון שנבחר.</p></div>
          ) : null}
          {!state.isLoading && !state.error && filteredNotifications.length > 0 ? (
            <div className="notifications-list">
              {filteredNotifications.map((notification) => {
                const Icon = getNotificationIcon(notification);
                return (
                  <button
                    key={notification.recipientId}
                    id={`notification-${notification.notificationId}`}
                    type="button"
                    className={`notification-list-item ${notification.isRead ? 'notification-list-item-read' : 'notification-list-item-unread'} ${notification.url ? 'notification-list-item-clickable' : ''} ${focusedNotificationId === notification.notificationId ? 'notification-list-item-focused' : ''}`}
                    disabled={state.isUpdating}
                    onClick={() => void handleNotificationClick(notification)}
                  >
                    <span className="notification-list-icon"><Icon size={21} aria-hidden="true" /></span>
                    <span className="notification-list-content">
                      <span className="notification-list-heading"><strong>{notification.title}</strong>{!notification.isRead ? <span className="notification-list-unread-indicator">חדשה</span> : null}</span>
                      <span className="notification-list-body">{notification.body}</span>
                      {notification.source === 'daily_report' && Number(notification.data?.attachmentCount ?? 0) > 0 ? (
                        <span className="notification-list-attachment"><Paperclip size={14} /> {Number(notification.data.attachmentCount)} קבצים מצורפים</span>
                      ) : null}
                      <span className="notification-list-meta"><Clock3 size={14} aria-hidden="true" />{formatNotificationDate(notification.createdAt)}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          ) : null}
        </>
      ) : null}

      <Modal
        isOpen={isAnnouncementComposerOpen && canSendAnnouncements}
        title="שליחת עדכון"
        onClose={closeAnnouncementComposer}
        className="announcement-composer-modal"
      >
        <AnnouncementComposer
          onSent={(count) => {
            setAnnouncementSuccess(`העדכון נשלח ל־${count} משתמשים.`);
            closeAnnouncementComposer();
          }}
        />
      </Modal>

      <Modal
        isOpen={dailyReportDetailLoading || Boolean(dailyReportDetail) || Boolean(dailyReportDetailError)}
        title="דיווח עבודה יומי"
        onClose={() => {
          setDailyReportDetail(null);
          setDailyReportDetailError(null);
          setDailyReportDetailLoading(false);
        }}
        className="daily-report-detail-modal"
      >
        {dailyReportDetailLoading ? <div className="notifications-page-state"><RefreshCw className="notifications-page-spinner" size={22} />טוען דיווח...</div> : null}
        {dailyReportDetailError ? <div className="notifications-page-message notifications-page-error">{dailyReportDetailError}</div> : null}
        {dailyReportDetail ? (
          <div className="daily-report-detail">
            <header>
              <div><strong>{dailyReportDetail.displayName}</strong><span>{dailyReportDetail.jobTypeName}</span></div>
              <div><span>{dailyReportDetail.reportDate}</span><small>{formatNotificationDate(dailyReportDetail.submittedAt)}</small></div>
            </header>
            <div className="daily-report-detail-items">
              {dailyReportDetail.items.map((item, index) => (
                <section key={item.id}>
                  <h3>פעילות {index + 1} · {item.subjectName}</h3>
                  {item.customerName ? <div className="daily-report-detail-customer">לקוח: <strong>{item.customerName}</strong></div> : null}
                  <p>{item.details}</p>
                </section>
              ))}
            </div>
            <section className="daily-report-detail-attachments">
              <h3><Paperclip size={17} /> קבצים מצורפים <span>{dailyReportDetail.attachments.length}</span></h3>
              {dailyReportDetail.attachments.length ? dailyReportDetail.attachments.map((attachment) => (
                <button key={attachment.id} type="button" onClick={() => void dailyReportService.openAttachment(attachment.id)}>
                  <FileText size={18} />
                  <span><strong>{attachment.fileName}</strong><small>{(attachment.fileSize / 1024 / 1024).toFixed(1)}MB</small></span>
                  <Download size={17} />
                </button>
              )) : <p>לא צורפו קבצים לדיווח.</p>}
            </section>
          </div>
        ) : null}
      </Modal>

      {activeTab === 'requests' && canApproveSwaps ? (
        <>
          <div className="notifications-requests-toolbar">
            <div><strong>בקשות שממתינות לאישור</strong><span>{pendingManagerRequests.length + pendingDynamicManagerRequests.length} בקשות</span></div>
            <button type="button" className="notifications-toolbar-button" disabled={requestsLoading} onClick={() => void refreshRequests()}><RefreshCw size={17} aria-hidden="true" />רענון</button>
          </div>
          {requestsError ? <div className="notifications-page-message notifications-page-error">{requestsError}</div> : null}
          {requestsSuccess ? <div className="notifications-page-message notifications-page-success">{requestsSuccess}</div> : null}
          {requestsLoading ? <div className="notifications-page-state"><RefreshCw className="notifications-page-spinner" size={24} aria-hidden="true" />טוען בקשות...</div> : null}
          {!requestsLoading && pendingManagerRequests.length === 0 && pendingDynamicManagerRequests.length === 0 ? (
            <div className="notifications-empty-state"><ArrowLeftRight size={34} aria-hidden="true" /><h2>אין בקשות שממתינות לאישור</h2><p>בקשות חדשות שאושרו על ידי המוקדן השני יופיעו כאן.</p></div>
          ) : null}
          {!requestsLoading && (pendingManagerRequests.length > 0 || pendingDynamicManagerRequests.length > 0) ? (
            <div className="notifications-requests-list">
              {pendingDynamicManagerRequests.map((request) => (
                <article key={`dynamic:${request.id}`} className="notifications-request-card">
                  <header>
                    <div>
                      <strong>{request.swapType === 'one_way' ? 'חילוף דינמי חד-כיווני' : 'חילוף דינמי דו-כיווני'}</strong>
                      <span>{request.jobTypeName} · {request.requesterName} ↔ {request.counterpartyName}</span>
                    </div>
                    <ArrowLeftRight size={21} aria-hidden="true" />
                  </header>
                  <div className="notifications-request-flow">
                    <div>
                      <span>{request.requesterName}</span>
                      <strong>{formatDynamicSwapShift(request.requesterShiftDate, request.requesterShiftName, request.requesterStartTime, request.requesterEndTime)}</strong>
                    </div>
                    <ArrowLeftRight size={18} aria-hidden="true" />
                    <div>
                      <span>{request.counterpartyName}</span>
                      <strong>{request.swapType === 'two_way'
                        ? formatDynamicSwapShift(request.counterpartyShiftDate, request.counterpartyShiftName, request.counterpartyStartTime, request.counterpartyEndTime)
                        : 'מקבל/ת את המשמרת'}</strong>
                    </div>
                  </div>
                  <div className="notifications-request-actions">
                    <button type="button" className="notifications-request-approve" disabled={busyRequestId === `dynamic:${request.id}`} onClick={() => void reviewDynamicSwap(request.id, true)}><Check size={17} aria-hidden="true" />אישור</button>
                    <button type="button" className="notifications-request-reject" disabled={busyRequestId === `dynamic:${request.id}`} onClick={() => void reviewDynamicSwap(request.id, false)}><X size={17} aria-hidden="true" />דחייה</button>
                  </div>
                </article>
              ))}
              {pendingManagerRequests.map((request) => (
                <article key={request.id} className="notifications-request-card">
                  <header><div><strong>{request.swapType === 'one_way' ? 'חילוף חד-כיווני' : 'חילוף דו-כיווני'}</strong><span>{request.requesterName} ↔ {request.counterpartyName}</span></div><ArrowLeftRight size={21} aria-hidden="true" /></header>
                  <div className="notifications-request-flow">
                    <div><span>{request.requesterName}</span><strong>{formatSwapShift(request.requesterShiftDate, request.requesterStartsAt, request.requesterEndsAt)}</strong></div>
                    <ArrowLeftRight size={18} aria-hidden="true" />
                    <div><span>{request.counterpartyName}</span><strong>{request.swapType === 'two_way' ? formatSwapShift(request.counterpartyShiftDate, request.counterpartyStartsAt, request.counterpartyEndsAt) : 'מקבל את המשמרת'}</strong></div>
                  </div>
                  <div className="notifications-request-actions">
                    <button type="button" className="notifications-request-approve" disabled={busyRequestId === request.id} onClick={() => void reviewSwap(request.id, true)}><Check size={17} aria-hidden="true" />אישור</button>
                    <button type="button" className="notifications-request-reject" disabled={busyRequestId === request.id} onClick={() => void reviewSwap(request.id, false)}><X size={17} aria-hidden="true" />דחייה</button>
                  </div>
                </article>
              ))}
            </div>
          ) : null}

          <button
            type="button"
            className={`notifications-request-history-heading ${
              isRequestHistoryOpen
                ? 'notifications-request-history-heading-open'
                : ''
            }`}
            aria-expanded={isRequestHistoryOpen}
            onClick={() => {
              setIsRequestHistoryOpen((current) => !current);
            }}
          >
            <div>
              <strong>היסטוריית בקשות</strong>
              <span>בקשות שכבר התקבלה לגביהן החלטה</span>
            </div>
            <div className="notifications-request-history-heading-actions">
              <span>{reviewedManagerRequests.length + reviewedDynamicManagerRequests.length}</span>
              <ChevronDown
                size={20}
                aria-hidden="true"
                className="notifications-request-history-chevron"
              />
            </div>
          </button>

          {isRequestHistoryOpen &&
          !requestsLoading &&
          reviewedManagerRequests.length === 0 && reviewedDynamicManagerRequests.length === 0 ? (
            <div className="notifications-request-history-empty">
              עדיין אין בקשות שטופלו.
            </div>
          ) : null}

          {isRequestHistoryOpen &&
          !requestsLoading &&
          (reviewedManagerRequests.length > 0 || reviewedDynamicManagerRequests.length > 0) ? (
            <div className="notifications-requests-list notifications-request-history-list">
              {reviewedDynamicManagerRequests.map((request) => {
                const approved = request.status === 'approved';
                return (
                  <article key={`dynamic:${request.id}`} className="notifications-request-card notifications-request-history-card">
                    <header>
                      <div>
                        <strong>{request.swapType === 'one_way' ? 'חילוף דינמי חד-כיווני' : 'חילוף דינמי דו-כיווני'}</strong>
                        <span>{request.jobTypeName} · {request.requesterName} ↔ {request.counterpartyName}</span>
                      </div>
                      <span className={approved ? 'notifications-request-decision notifications-request-decision-approved' : 'notifications-request-decision notifications-request-decision-rejected'}>{approved ? 'אושר' : 'נדחה'}</span>
                    </header>
                    <div className="notifications-request-flow">
                      <div><span>{request.requesterName}</span><strong>{formatDynamicSwapShift(request.requesterShiftDate, request.requesterShiftName, request.requesterStartTime, request.requesterEndTime)}</strong></div>
                      <ArrowLeftRight size={18} aria-hidden="true" />
                      <div><span>{request.counterpartyName}</span><strong>{request.swapType === 'two_way' ? formatDynamicSwapShift(request.counterpartyShiftDate, request.counterpartyShiftName, request.counterpartyStartTime, request.counterpartyEndTime) : 'מקבל/ת את המשמרת'}</strong></div>
                    </div>
                    <div className="notifications-request-history-meta"><Clock3 size={14} aria-hidden="true" />{request.managerReviewedAt ? `החלטה: ${formatNotificationDate(request.managerReviewedAt)}` : 'הבקשה טופלה'}{request.rejectionReason ? ` · סיבה: ${request.rejectionReason}` : ''}</div>
                  </article>
                );
              })}
              {reviewedManagerRequests.map((request) => {
                const approved = request.status === 'approved';

                return (
                  <article
                    key={request.id}
                    className="notifications-request-card notifications-request-history-card"
                  >
                    <header>
                      <div>
                        <strong>
                          {request.swapType === 'one_way'
                            ? 'חילוף חד-כיווני'
                            : 'חילוף דו-כיווני'}
                        </strong>
                        <span>
                          {request.requesterName} ↔ {request.counterpartyName}
                        </span>
                      </div>
                      <span
                        className={
                          approved
                            ? 'notifications-request-decision notifications-request-decision-approved'
                            : 'notifications-request-decision notifications-request-decision-rejected'
                        }
                      >
                        {approved ? 'אושר' : 'נדחה'}
                      </span>
                    </header>

                    <div className="notifications-request-flow">
                      <div>
                        <span>{request.requesterName}</span>
                        <strong>
                          {formatSwapShift(
                            request.requesterShiftDate,
                            request.requesterStartsAt,
                            request.requesterEndsAt,
                          )}
                        </strong>
                      </div>
                      <ArrowLeftRight size={18} aria-hidden="true" />
                      <div>
                        <span>{request.counterpartyName}</span>
                        <strong>
                          {request.swapType === 'two_way'
                            ? formatSwapShift(
                                request.counterpartyShiftDate,
                                request.counterpartyStartsAt,
                                request.counterpartyEndsAt,
                              )
                            : 'מקבל את המשמרת'}
                        </strong>
                      </div>
                    </div>

                    <div className="notifications-request-history-meta">
                      <Clock3 size={14} aria-hidden="true" />
                      {request.managerReviewedAt
                        ? `החלטה: ${formatNotificationDate(request.managerReviewedAt)}`
                        : 'הבקשה טופלה'}
                      {request.rejectionReason
                        ? ` · סיבה: ${request.rejectionReason}`
                        : ''}
                    </div>
                  </article>
                );
              })}
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}

export default NotificationsPage;
