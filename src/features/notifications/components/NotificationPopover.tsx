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

function formatNotificationDate(
  value:
    string,
): string {
  const date =
    new Date(
      value,
    );

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

function NotificationPopover() {
  const navigate =
    useNavigate();

  const {
    hasPermission,
  } = useAuth();

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

  const visibleNotifications =
    state.notifications
      .slice(
        0,
        6,
      );

const handleNotificationClick =
  async (
    recipientId:
      string,

    url:
      string | null,

    type:
      string,
  ): Promise<void> => {
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