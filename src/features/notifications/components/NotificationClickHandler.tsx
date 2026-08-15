import {
  useCallback,
  useEffect,
} from 'react';

import {
  useLocation,
  useNavigate,
} from 'react-router-dom';

import {
  useAuth,
} from '../../../auth/AuthContext';

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

function getStringValue(
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
    permissionsLoaded,
    hasPermission,
  } =
    useAuth();

  const {
    markAsRead,
  } =
    useNotificationContext();

  const getNotificationTarget =
    useCallback(
      (
        rawUrl:
          unknown,
      ): string => {
        const url =
          getStringValue(
            rawUrl,
          ) ??
          '/notifications';

        let parsedUrl:
          URL;

        try {
          parsedUrl =
            new URL(
              url,
              window.location.origin,
            );
        } catch {
          return '/notifications';
        }

        const pathname =
          parsedUrl.pathname;

        /*
         * בקשות להחלפת משמרת:
         *
         * מי שיכול לאשר בקשות יגיע ישירות
         * לתת-הטאב "בקשות" במסך ההתראות.
         *
         * מוקדן רגיל יגיע למסך חילופי
         * המשמרות שלו.
         */
        if (
          pathname ===
            '/shift-swaps' ||
          (
            pathname ===
              '/notifications' &&
            parsedUrl.searchParams.get(
              'tab',
            ) ===
              'requests'
          )
        ) {
          if (
            hasPermission(
              'shift_swaps.approve',
            )
          ) {
            return '/notifications?tab=requests';
          }

          if (
            hasPermission(
              'shift_swaps.view',
            )
          ) {
            return '/shift-swaps';
          }

          return '/notifications';
        }

        /*
         * התראות אילוצים.
         *
         * בעל הרשאת ניהול/עריכת שיבוץ
         * יגיע למרחב המשמרות המאוחד.
         *
         * משתמש שרשאי לצפות באילוצים
         * האישיים שלו יגיע למסך האילוצים.
         */
        if (
          pathname ===
            '/availability'
        ) {
          if (
            hasPermission(
              'availability.manage',
            ) ||
            hasPermission(
              'schedule.edit',
            )
          ) {
            return '/shifts?tab=availability';
          }

          if (
            hasPermission(
              'availability.view',
            )
          ) {
            return '/availability';
          }

          return '/';
        }

        /*
         * עבור כל התראה אחרת נשמור
         * את היעד שהוגדר בהתראה עצמה.
         */
        return `${parsedUrl.pathname}${parsedUrl.search}${parsedUrl.hash}`;
      },
      [
        hasPermission,
      ],
    );

  /*
   * טיפול במקרה שבו האפליקציה כבר פתוחה
   * וה-Service Worker שולח postMessage.
   */
  useEffect(
    () => {
      if (
        !permissionsLoaded ||
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
            getStringValue(
              message.recipientId,
            );

          if (
            recipientId
          ) {
            void markAsRead(
              recipientId,
            );
          }

          navigate(
            getNotificationTarget(
              message.url,
            ),
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
      getNotificationTarget,
      markAsRead,
      navigate,
      permissionsLoaded,
    ],
  );

  /*
   * טיפול במקרה שבו ה-PWA הייתה סגורה
   * ונפתחה כתוצאה מלחיצה על Push.
   *
   * ה-Service Worker כבר פתח את ה-URL
   * של ההתראה והוסיף recipientId.
   *
   * אנחנו מחכים לטעינת ההרשאות לפני
   * שמחליטים אם צריך לשנות את היעד.
   */
  useEffect(
    () => {
      if (
        !permissionsLoaded
      ) {
        return;
      }

      const searchParameters =
        new URLSearchParams(
          location.search,
        );

      const recipientId =
        getStringValue(
          searchParameters.get(
            recipientQueryParameter,
          ),
        );

      if (
        !recipientId
      ) {
        return;
      }

      const originalSearchParameters =
        new URLSearchParams(
          location.search,
        );

      originalSearchParameters.delete(
        recipientQueryParameter,
      );

      const originalSearch =
        originalSearchParameters
          .toString();

      const originalUrl =
        `${location.pathname}${
          originalSearch
            ? `?${originalSearch}`
            : ''
        }${location.hash}`;

      const handleNotificationOpen =
        async (): Promise<void> => {
          try {
            await markAsRead(
              recipientId,
            );
          } catch (
            error
          ) {
            console.error(
              'Failed to mark opened notification as read:',
              error,
            );
          }

          navigate(
            getNotificationTarget(
              originalUrl,
            ),
            {
              replace:
                true,
            },
          );
        };

      void handleNotificationOpen();
    },
    [
      getNotificationTarget,
      location.hash,
      location.pathname,
      location.search,
      markAsRead,
      navigate,
      permissionsLoaded,
    ],
  );

  return null;
}

export default NotificationClickHandler;