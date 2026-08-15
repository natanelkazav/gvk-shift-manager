import {
  ArrowLeftRight,
  Bell,
  Check,
  CheckCheck,
  CircleCheck,
  Clock3,
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
import { shiftSwapService } from '../services/shiftSwapService';
import type { ShiftSwapRequest } from '../types/shiftSwap';
import '../styles/notifications.css';

type NotificationFilter = 'all' | 'unread' | 'read';
type WorkspaceTab = 'notifications' | 'requests';

function formatNotificationDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('he-IL', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function formatSwapShift(
  date: string | null,
  startsAt: string | null,
  endsAt: string | null,
): string {
  if (!date || !startsAt || !endsAt) return '—';
  const baseDate = new Date(`${date}T12:00:00`);
  const weekday = new Intl.DateTimeFormat('he-IL', {
    weekday: 'long',
    timeZone: 'Asia/Jerusalem',
  }).format(baseDate);
  const formattedDate = new Intl.DateTimeFormat('he-IL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'Asia/Jerusalem',
  }).format(baseDate);
  const timeFormatter = new Intl.DateTimeFormat('he-IL', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Jerusalem',
  });
  return `${weekday} · ${formattedDate} · ${timeFormatter.format(new Date(startsAt))}–${timeFormatter.format(new Date(endsAt))}`;
}

function getNotificationIcon(notification: MyNotification) {
  return notification.isRead ? CircleCheck : Bell;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'אירעה שגיאה לא צפויה.';
}

function NotificationsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { hasPermission } = useAuth();
  const canViewNotifications =
    hasPermission('notifications.view') || hasPermission('notifications.manage');
  const canApproveSwaps = hasPermission('shift_swaps.approve');
  const requestedTab = searchParams.get('tab');
  const activeTab: WorkspaceTab =
    requestedTab === 'requests' && canApproveSwaps
      ? 'requests'
      : canViewNotifications
        ? 'notifications'
        : 'requests';
  const [activeFilter, setActiveFilter] = useState<NotificationFilter>('all');
  const [swapRequests, setSwapRequests] = useState<ShiftSwapRequest[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(canApproveSwaps);
  const [requestsError, setRequestsError] = useState<string | null>(null);
  const [requestsSuccess, setRequestsSuccess] = useState<string | null>(null);
  const [busyRequestId, setBusyRequestId] = useState<string | null>(null);

  const {
    state,
    unreadCount,
    loadNotifications,
    markAsRead,
    markAllAsRead,
  } = useNotificationContext();

  useEffect(() => {
    if (!canApproveSwaps) return;
    let cancelled = false;
    const load = async (): Promise<void> => {
      try {
        const data = await shiftSwapService.getRequests();
        if (!cancelled) setSwapRequests(data);
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

  const pendingManagerRequests = useMemo(
    () => swapRequests.filter((request) => request.status === 'pending_manager'),
    [swapRequests],
  );

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

  const selectWorkspaceTab = (tab: WorkspaceTab): void => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('tab', tab);
    setSearchParams(nextParams, { replace: true });
  };

  const filteredNotifications = useMemo(() => {
    if (activeFilter === 'unread') {
      return state.notifications.filter((notification) => !notification.isRead);
    }
    if (activeFilter === 'read') {
      return state.notifications.filter((notification) => notification.isRead);
    }
    return state.notifications;
  }, [activeFilter, state.notifications]);

  const readCount = state.notifications.length - unreadCount;

  const handleNotificationClick = async (notification: MyNotification): Promise<void> => {
    if (!notification.isRead) {
      await markAsRead(notification.recipientId);
    }

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

  const refreshRequests = async (): Promise<void> => {
    setRequestsLoading(true);
    setRequestsError(null);
    try {
      setSwapRequests(await shiftSwapService.getRequests());
    } catch (error) {
      setRequestsError(getErrorMessage(error));
    } finally {
      setRequestsLoading(false);
    }
  };

  const reviewSwap = async (requestId: string, approve: boolean): Promise<void> => {
    setBusyRequestId(requestId);
    setRequestsError(null);
    setRequestsSuccess(null);
    try {
      await shiftSwapService.reviewRequest(requestId, approve);
      setRequestsSuccess(
        approve
          ? 'ההחלפה אושרה ולוח השיבוצים עודכן.'
          : 'בקשת ההחלפה נדחתה.',
      );
      await refreshRequests();
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
          <h1>התראות ובקשות</h1>
          <p>מרכז אחד להתראות מערכת ולבקשות שממתינות לטיפול.</p>
        </div>
      </header>

      <div className="notifications-workspace-tabs" role="tablist" aria-label="התראות ובקשות">
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
            <span>{pendingManagerRequests.length}</span>
          </button>
        ) : null}
      </div>

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
                    type="button"
                    className={`notification-list-item ${notification.isRead ? 'notification-list-item-read' : 'notification-list-item-unread'} ${notification.url ? 'notification-list-item-clickable' : ''}`}
                    disabled={state.isUpdating}
                    onClick={() => void handleNotificationClick(notification)}
                  >
                    <span className="notification-list-icon"><Icon size={21} aria-hidden="true" /></span>
                    <span className="notification-list-content">
                      <span className="notification-list-heading"><strong>{notification.title}</strong>{!notification.isRead ? <span className="notification-list-unread-indicator">חדשה</span> : null}</span>
                      <span className="notification-list-body">{notification.body}</span>
                      <span className="notification-list-meta"><Clock3 size={14} aria-hidden="true" />{formatNotificationDate(notification.createdAt)}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          ) : null}
        </>
      ) : null}

      {activeTab === 'requests' && canApproveSwaps ? (
        <>
          <div className="notifications-requests-toolbar">
            <div><strong>בקשות שממתינות לאישור</strong><span>{pendingManagerRequests.length} בקשות</span></div>
            <button type="button" className="notifications-toolbar-button" disabled={requestsLoading} onClick={() => void refreshRequests()}><RefreshCw size={17} aria-hidden="true" />רענון</button>
          </div>
          {requestsError ? <div className="notifications-page-message notifications-page-error">{requestsError}</div> : null}
          {requestsSuccess ? <div className="notifications-page-message notifications-page-success">{requestsSuccess}</div> : null}
          {requestsLoading ? <div className="notifications-page-state"><RefreshCw className="notifications-page-spinner" size={24} aria-hidden="true" />טוען בקשות...</div> : null}
          {!requestsLoading && pendingManagerRequests.length === 0 ? (
            <div className="notifications-empty-state"><ArrowLeftRight size={34} aria-hidden="true" /><h2>אין בקשות שממתינות לאישור</h2><p>בקשות חדשות שאושרו על ידי המוקדן השני יופיעו כאן.</p></div>
          ) : null}
          {!requestsLoading && pendingManagerRequests.length > 0 ? (
            <div className="notifications-requests-list">
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

          <div className="notifications-request-history-heading">
            <div>
              <strong>היסטוריית בקשות</strong>
              <span>בקשות שכבר התקבלה לגביהן החלטה</span>
            </div>
            <span>{reviewedManagerRequests.length}</span>
          </div>

          {!requestsLoading && reviewedManagerRequests.length === 0 ? (
            <div className="notifications-request-history-empty">
              עדיין אין בקשות שטופלו.
            </div>
          ) : null}

          {!requestsLoading && reviewedManagerRequests.length > 0 ? (
            <div className="notifications-requests-list notifications-request-history-list">
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
