import {
  useEffect,
} from 'react';

import {
  useLocation,
  useNavigate,
} from 'react-router-dom';

import {
  useNotificationContext,
} from '../context/useNotificationContext';

interface NotificationClickMessage {
  type:
    string;

  recipientId?:
    unknown;

  notificationId?:
    unknown;

  url?:
    unknown;
}

const notificationClickMessageType =
  'GVK_NOTIFICATION_CLICKED';

const recipientQueryParameter =
  'notificationRecipientId';

function getRecipientId(
  value: unknown,
): string | null {
  if (
    typeof value !==
      'string'
  ) {
    return null;
  }

  const normalizedValue =
    value.trim();

  return normalizedValue ||
    null;
}

function NotificationClickHandler() {
  const location =
    useLocation();

  const navigate =
    useNavigate();

  const {
    markAsRead,
  } =
    useNotificationContext();

  /*
   * טיפול במקרה שבו האפליקציה כבר הייתה
   * פתוחה וה־Service Worker שלח postMessage.
   */
  useEffect(
    () => {
      if (
        !(
          'serviceWorker' in
          navigator
        )
      ) {
        return;
      }

      const handleMessage =
        (
          event:
            MessageEvent<unknown>,
        ): void => {
          if (
            typeof event.data !==
              'object' ||
            event.data ===
              null
          ) {
            return;
          }

          const message =
            event.data as
              NotificationClickMessage;

          if (
            message.type !==
              notificationClickMessageType
          ) {
            return;
          }

          const recipientId =
            getRecipientId(
              message.recipientId,
            );

          if (
            !recipientId
          ) {
            return;
          }

          void markAsRead(
            recipientId,
          );
        };

      navigator.serviceWorker
        .addEventListener(
          'message',
          handleMessage,
        );

      return () => {
        navigator.serviceWorker
          .removeEventListener(
            'message',
            handleMessage,
          );
      };
    },
    [
      markAsRead,
    ],
  );

  /*
   * טיפול במקרה שבו האפליקציה הייתה סגורה
   * ונפתחה דרך כתובת הכוללת recipientId.
   */
  useEffect(
    () => {
      const searchParameters =
        new URLSearchParams(
          location.search,
        );

      const recipientId =
        getRecipientId(
          searchParameters.get(
            recipientQueryParameter,
          ),
        );

      if (
        !recipientId
      ) {
        return;
      }

      const markNotification =
        async (): Promise<void> => {
          try {
            await markAsRead(
              recipientId,
            );
          } finally {
            searchParameters.delete(
              recipientQueryParameter,
            );

            const nextSearch =
              searchParameters
                .toString();

            navigate(
              {
                pathname:
                  location.pathname,

                search:
                  nextSearch
                    ? `?${nextSearch}`
                    : '',

                hash:
                  location.hash,
              },
              {
                replace:
                  true,
              },
            );
          }
        };

      void markNotification();
    },
    [
      location.hash,
      location.pathname,
      location.search,
      markAsRead,
      navigate,
    ],
  );

  return null;
}

export default NotificationClickHandler;