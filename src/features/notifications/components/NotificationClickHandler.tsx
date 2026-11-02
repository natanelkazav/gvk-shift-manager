/**
 * קובץ: src/features/notifications/components/NotificationClickHandler.tsx
 * מטרה: מימוש רכיב תצוגה ואינטראקציה עבור התראות / פונקציית טיפול.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: NotificationClickMessage, getStringValue, NotificationClickHandler.
 * - קישור מאפיינים ומצב מקומי לתצוגה ולטיפול בפעולות המשתמש.
 */
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

/**
 * חוזה הנתונים NotificationClickMessage: התראות / הודעה.
 */
interface NotificationClickMessage {
  type:
    string;

  // recipientId — מזהה (אופציונלי).
  recipientId?:
    unknown;

  // notificationId — התראות / מזהה (אופציונלי).
  notificationId?:
    unknown;

  // url — כתובת יעד (אופציונלי).
  url?:
    unknown;
}

// notificationClickMessageType — התראות / הודעה.
const notificationClickMessageType =
  'GVK_NOTIFICATION_CLICKED';

// recipientQueryParameter — הנתון recipientQueryParameter בהקשר הפעולה.
const recipientQueryParameter =
  'notificationRecipientId';

/**
 * פעולה getStringValue: שליפה או חישוב של ערך.
 * @param value — ערך.
 * @returns string | null — הפלט בהתאם לחתימה.
 */
function getStringValue(
  value: unknown,
): string | null {
  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר typeof value !== 'string'.
  if (
    typeof value !==
      'string'
  ) {
    return null;
  }

  // normalizedValue — ערך.
  const normalizedValue =
    value.trim();

  return normalizedValue ||
    null;
}

/**
 * פעולה NotificationClickHandler: התראות / פונקציית טיפול.
 */
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

  // getNotificationTarget — התראות / יעד.
  const getNotificationTarget =
    useCallback(
      (
        rawUrl:
          unknown,
      ): string => {
        // url — כתובת יעד.
        const url =
          getStringValue(
            rawUrl,
          ) ??
          '/notifications';

        // parsedUrl — כתובת יעד.
        let parsedUrl:
          URL;

        // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
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
        // טיפול במקרה מיוחד ויציאה מוקדמת כאשר pathname === '/shift-swaps' || ( pathname === '/notifications' && parsedUrl.searchParams.get( 'tab', ) === 'requests' ).
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
          // טיפול במקרה מיוחד ויציאה מוקדמת כאשר hasPermission( 'shift_swaps.approve', ).
          if (
            hasPermission(
              'shift_swaps.approve',
            )
          ) {
            return '/notifications?tab=requests';
          }

          // טיפול במקרה מיוחד ויציאה מוקדמת כאשר hasPermission( 'shift_swaps.view', ).
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
        // טיפול במקרה מיוחד ויציאה מוקדמת כאשר pathname === '/availability'.
        if (
          pathname ===
            '/availability'
        ) {
          // טיפול במקרה מיוחד ויציאה מוקדמת כאשר hasPermission( 'availability.manage', ) || hasPermission( 'schedule.edit', ).
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

          // טיפול במקרה מיוחד ויציאה מוקדמת כאשר hasPermission( 'availability.view', ).
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
  // תופעת לוואי לאחר רינדור בהתאם לתלויות [ getNotificationTarget, markAsRead, navigate, permissionsLoaded, ].
  useEffect(
    () => {
      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !permissionsLoaded || !( 'serviceWorker' in navigator ).
      if (
        !permissionsLoaded ||
        !(
          'serviceWorker' in
          navigator
        )
      ) {
        return;
      }

      /**
       * פעולה handleMessage: טיפול באירוע עבור הודעה.
       * @param event — אירוע.
       * @returns void — הפלט בהתאם לחתימה.
       */
      const handleMessage =
        (
          event:
            MessageEvent<unknown>,
        ): void => {
          // טיפול במקרה מיוחד ויציאה מוקדמת כאשר typeof event.data !== 'object' || event.data === null.
          if (
            typeof event.data !==
              'object' ||
            event.data ===
              null
          ) {
            return;
          }

          // message — הודעה.
          const message =
            event.data as
              NotificationClickMessage;

          // טיפול במקרה מיוחד ויציאה מוקדמת כאשר message.type !== notificationClickMessageType.
          if (
            message.type !==
              notificationClickMessageType
          ) {
            return;
          }

          // recipientId — מזהה.
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
  // תופעת לוואי לאחר רינדור בהתאם לתלויות [ getNotificationTarget, location.hash, location.pathname, location.search, markAsRead, navigate, permissionsLoaded, ].
  useEffect(
    () => {
      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !permissionsLoaded.
      if (
        !permissionsLoaded
      ) {
        return;
      }

      const searchParameters =
        new URLSearchParams(
          location.search,
        );

      // recipientId — מזהה.
      const recipientId =
        getStringValue(
          searchParameters.get(
            recipientQueryParameter,
          ),
        );

      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !recipientId.
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

      // originalUrl — כתובת יעד.
      const originalUrl =
        `${location.pathname}${
          originalSearch
            ? `?${originalSearch}`
            : ''
        }${location.hash}`;

      /**
       * פעולה אסינכרונית handleNotificationOpen: טיפול באירוע עבור התראות.
       * @returns Promise<void> — הפלט בהתאם לחתימה.
       */
      const handleNotificationOpen =
        async (): Promise<void> => {
          // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
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