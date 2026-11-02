/**
 * קובץ: src/features/notifications/components/NotificationPopover.tsx
 * מטרה: מימוש רכיב תצוגה ואינטראקציה עבור התראות.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: formatNotificationDate, NotificationPopover.
 * - קישור מאפיינים ומצב מקומי לתצוגה ולטיפול בפעולות המשתמש.
 */
import {
  CheckCheck,
  LoaderCircle,
} from 'lucide-react';

import {
  useNavigate,
} from 'react-router-dom';

import {
  useAuth,
} from '../../../auth/AuthContext';

import {
  useNotificationContext,
} from '../context/useNotificationContext';

import {
  NotificationType,
} from '../types/notificationTypes';

/**
 * פעולה formatNotificationDate: עיצוב ערך לתצוגה עבור התראות / תאריך.
 * @param value — ערך.
 * @returns string — הפלט בהתאם לחתימה.
 */
function formatNotificationDate(
  value:
    string,
): string {
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
    return '';
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
 * פעולה NotificationPopover: התראות.
 */
function NotificationPopover() {
  const navigate =
    useNavigate();

  const {
    hasPermission,
  } = useAuth();

  // canApproveShiftSwaps — החלפת משמרות.
  const canApproveShiftSwaps =
    hasPermission(
      'shift_swaps.approve',
    );

  const {
    state,
    unreadCount,
    markAsRead,
    markAllAsRead,
  } =
    useNotificationContext();

  // visibleNotifications — התראות.
  const visibleNotifications =
    state.notifications
      .slice(
        0,
        6,
      );

/**
 * פעולה אסינכרונית handleNotificationClick: טיפול באירוע עבור התראות.
 * @param recipientId — מזהה.
 * @param url — כתובת יעד.
 * @param type — הנתון type בהקשר הפעולה.
 * @returns Promise<void> — הפלט בהתאם לחתימה.
 */
const handleNotificationClick =
  async (
    recipientId:
      string,

    url:
      string | null,

    type:
      string,
  ): Promise<void> => {
    // targetUrl — יעד / כתובת יעד.
    const targetUrl =
      canApproveShiftSwaps &&
      type ===
        NotificationType.SHIFT_SWAP
        ? '/notifications?tab=requests'
        : url ||
          '/notifications';

    try {
      await markAsRead(
        recipientId,
      );
    } finally {
      navigate(
        targetUrl,
      );
    }
  };

  /**
   * פעולה אסינכרונית handleMarkAllAsRead: טיפול באירוע עבור הנתון handleMarkAllAsRead בהקשר הפעולה.
   * @returns Promise<void> — הפלט בהתאם לחתימה.
   */
  const handleMarkAllAsRead =
    async (): Promise<void> => {
      await markAllAsRead();
    };

  return (
    <div className="notification-popover">
      <div className="notification-popover-header">
        <div>
          <strong>
            התראות
          </strong>

          <span>
            {
              unreadCount >
              0
                ? `${unreadCount} לא נקראו`
                : 'אין התראות חדשות'
            }
          </span>
        </div>

        {unreadCount >
        0 ? (
          <button
            type="button"
            className="notification-popover-mark-all"
            disabled={
              state.isUpdating
            }
            onClick={() => {
              void handleMarkAllAsRead();
            }}
          >
            <CheckCheck
              size={
                16
              }
              aria-hidden="true"
            />

            סמן הכול כנקרא
          </button>
        ) : null}
      </div>

      <div className="notification-popover-content">
        {state.isLoading ? (
          <div className="notification-popover-state">
            <LoaderCircle
              className="notification-popover-spinner"
              size={
                22
              }
              aria-hidden="true"
            />

            טוען התראות...
          </div>
        ) : null}

        {!state.isLoading &&
        state.error ? (
          <div
            className="notification-popover-state notification-popover-error"
            role="alert"
          >
            {
              state.error
            }
          </div>
        ) : null}

        {!state.isLoading &&
        !state.error &&
        visibleNotifications.length ===
          0 ? (
          <div className="notification-popover-state">
            אין התראות להצגה.
          </div>
        ) : null}

        {!state.isLoading &&
        !state.error
          ? visibleNotifications.map(
              (
                notification,
              ) => (
                <button
                  key={
                    notification
                      .recipientId
                  }
                  type="button"
                  className={[
                    'notification-popover-item',

                    notification
                      .isRead
                      ? ''
                      : 'notification-popover-item-unread',
                  ]
                    .filter(
                      Boolean,
                    )
                    .join(
                      ' ',
                    )}
                  onClick={() => {
                    void handleNotificationClick(
                      notification
                        .recipientId,

                      notification.url,

                      notification.type,
                    );
                  }}
                >
                  <span className="notification-popover-item-title">
                    {
                      notification
                        .title
                    }
                  </span>

                  <span className="notification-popover-item-body">
                    {
                      notification
                        .body
                    }
                  </span>

                  <span className="notification-popover-item-date">
                    {
                      formatNotificationDate(
                        notification
                          .createdAt,
                      )
                    }
                  </span>
                </button>
              ),
            )
          : null}
      </div>

      <button
        type="button"
        className="notification-popover-footer"
        onClick={() => {
          navigate(
            '/notifications',
          );
        }}
      >
        הצגת כל ההתראות
      </button>
    </div>
  );
}

export default NotificationPopover;