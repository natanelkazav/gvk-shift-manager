import {
  Bell,
  CheckCheck,
  CircleCheck,
  Clock3,
  RefreshCw,
} from 'lucide-react';

import {
  useMemo,
  useState,
} from 'react';

import {
  useNavigate,
} from 'react-router-dom';

import {
  useNotificationContext,
} from '../features/notifications/context/useNotificationContext';

import type {
  MyNotification,
} from '../features/notifications/services/notificationService';

import '../styles/notifications.css';

type NotificationFilter =
  | 'all'
  | 'unread'
  | 'read';

function formatNotificationDate(
  value: string,
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
        'medium',

      timeStyle:
        'short',
    },
  ).format(
    date,
  );
}

function getNotificationIcon(
  notification:
    MyNotification,
) {
  if (
    notification.isRead
  ) {
    return CircleCheck;
  }

  return Bell;
}

function NotificationsPage() {
  const navigate =
    useNavigate();

  const {
    state,
    unreadCount,
    loadNotifications,
    markAsRead,
    markAllAsRead,
  } =
    useNotificationContext();

  const [
    activeFilter,
    setActiveFilter,
  ] =
    useState<NotificationFilter>(
      'all',
    );

  const filteredNotifications =
    useMemo(
      () => {
        if (
          activeFilter ===
          'unread'
        ) {
          return state.notifications
            .filter(
              (
                notification,
              ) =>
                !notification
                  .isRead,
            );
        }

        if (
          activeFilter ===
          'read'
        ) {
          return state.notifications
            .filter(
              (
                notification,
              ) =>
                notification
                  .isRead,
            );
        }

        return state.notifications;
      },
      [
        activeFilter,
        state.notifications,
      ],
    );

  const readCount =
    state.notifications
      .length -
    unreadCount;

  const handleRefresh =
    async (): Promise<void> => {
      await loadNotifications();
    };

  const handleMarkAllAsRead =
    async (): Promise<void> => {
      await markAllAsRead();
    };

  const handleNotificationClick =
    async (
      notification:
        MyNotification,
    ): Promise<void> => {
      if (
        !notification.isRead
      ) {
        await markAsRead(
          notification.recipientId,
        );
      }

      if (
        notification.url
      ) {
        navigate(
          notification.url,
        );
      }
    };

  return (
    <section className="notifications-page">
      <header className="notifications-page-header">
        <div>
          <h1>
            התראות
          </h1>

          <p>
            כל העדכונים, התזכורות והודעות המערכת במקום אחד.
          </p>
        </div>

        <div className="notifications-page-summary">
          <span>
            {
              state.notifications
                .length
            }{' '}
            התראות
          </span>

          <span className="notifications-page-unread-summary">
            {
              unreadCount
            }{' '}
            לא נקראו
          </span>
        </div>
      </header>

      <div className="notifications-toolbar">
        <div
          className="notifications-filters"
          role="group"
          aria-label="סינון התראות"
        >
          <button
            type="button"
            className={[
              'notifications-filter-button',

              activeFilter ===
                'all'
                ? 'notifications-filter-button-active'
                : '',
            ]
              .filter(
                Boolean,
              )
              .join(
                ' ',
              )}
            onClick={() => {
              setActiveFilter(
                'all',
              );
            }}
          >
            הכול

            <span>
              {
                state
                  .notifications
                  .length
              }
            </span>
          </button>

          <button
            type="button"
            className={[
              'notifications-filter-button',

              activeFilter ===
                'unread'
                ? 'notifications-filter-button-active'
                : '',
            ]
              .filter(
                Boolean,
              )
              .join(
                ' ',
              )}
            onClick={() => {
              setActiveFilter(
                'unread',
              );
            }}
          >
            לא נקראו

            <span>
              {
                unreadCount
              }
            </span>
          </button>

          <button
            type="button"
            className={[
              'notifications-filter-button',

              activeFilter ===
                'read'
                ? 'notifications-filter-button-active'
                : '',
            ]
              .filter(
                Boolean,
              )
              .join(
                ' ',
              )}
            onClick={() => {
              setActiveFilter(
                'read',
              );
            }}
          >
            נקראו

            <span>
              {
                readCount
              }
            </span>
          </button>
        </div>

        <div className="notifications-toolbar-actions">
          <button
            type="button"
            className="notifications-toolbar-button"
            disabled={
              state.isLoading ||
              state.isUpdating
            }
            onClick={() => {
              void handleRefresh();
            }}
          >
            <RefreshCw
              size={
                17
              }
              aria-hidden="true"
            />

            רענון
          </button>

          <button
            type="button"
            className="notifications-toolbar-button notifications-toolbar-primary"
            disabled={
              unreadCount ===
                0 ||
              state.isUpdating
            }
            onClick={() => {
              void handleMarkAllAsRead();
            }}
          >
            <CheckCheck
              size={
                17
              }
              aria-hidden="true"
            />

            סמן הכול כנקרא
          </button>
        </div>
      </div>

      {state.error ? (
        <div
          className="notifications-page-message notifications-page-error"
          role="alert"
        >
          {
            state.error
          }
        </div>
      ) : null}

      {state.isLoading ? (
        <div className="notifications-page-state">
          <RefreshCw
            className="notifications-page-spinner"
            size={
              24
            }
            aria-hidden="true"
          />

          טוען התראות...
        </div>
      ) : null}

      {!state.isLoading &&
      !state.error &&
      filteredNotifications
        .length ===
        0 ? (
        <div className="notifications-empty-state">
          <Bell
            size={
              34
            }
            aria-hidden="true"
          />

          <h2>
            אין התראות להצגה
          </h2>

          <p>
            {
              activeFilter ===
                'unread'
                ? 'אין כרגע התראות שלא נקראו.'
                : activeFilter ===
                    'read'
                  ? 'אין כרגע התראות שסומנו כנקראו.'
                  : 'התראות חדשות שייווצרו במערכת יופיעו כאן.'
            }
          </p>
        </div>
      ) : null}

      {!state.isLoading &&
      !state.error &&
      filteredNotifications
        .length >
        0 ? (
        <div className="notifications-list">
          {filteredNotifications.map(
            (
              notification,
            ) => {
              const Icon =
                getNotificationIcon(
                  notification,
                );

              return (
                <button
                  key={
                    notification
                      .recipientId
                  }
                  type="button"
                  className={[
                    'notification-list-item',

                    notification
                      .isRead
                      ? 'notification-list-item-read'
                      : 'notification-list-item-unread',

                    notification
                      .url
                      ? 'notification-list-item-clickable'
                      : '',
                  ]
                    .filter(
                      Boolean,
                    )
                    .join(
                      ' ',
                    )}
                  disabled={
                    state.isUpdating
                  }
                  onClick={() => {
                    void handleNotificationClick(
                      notification,
                    );
                  }}
                >
                  <span className="notification-list-icon">
                    <Icon
                      size={
                        21
                      }
                      aria-hidden="true"
                    />
                  </span>

                  <span className="notification-list-content">
                    <span className="notification-list-heading">
                      <strong>
                        {
                          notification
                            .title
                        }
                      </strong>

                      {!notification
                        .isRead ? (
                        <span className="notification-list-unread-indicator">
                          חדשה
                        </span>
                      ) : null}
                    </span>

                    <span className="notification-list-body">
                      {
                        notification
                          .body
                      }
                    </span>

                    <span className="notification-list-meta">
                      <Clock3
                        size={
                          14
                        }
                        aria-hidden="true"
                      />

                      {
                        formatNotificationDate(
                          notification
                            .createdAt,
                        )
                      }
                    </span>
                  </span>
                </button>
              );
            },
          )}
        </div>
      ) : null}
    </section>
  );
}

export default NotificationsPage;