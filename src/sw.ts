/**
 * קובץ: src/sw.ts
 * מטרה: הפעלת Service Worker עבור מטמון PWA וטיפול באירועי התראות Push.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: PushNotificationPayload, NotificationClickData, parsePushPayload, getStringValue, parseNotificationClickData, createTargetUrl, sendClickMessageToClient, ExtendedNotificationOptions.
 * - ריכוז ההגדרות והלוגיקה המפורטות בהמשך הקובץ.
 */
/// <reference lib="webworker" />

import {
  cleanupOutdatedCaches,
  precacheAndRoute,
} from 'workbox-precaching';

// self — הנתון self בהקשר הפעולה.
declare const self:
  ServiceWorkerGlobalScope & {
    // __WB_MANIFEST — מפת יכולות והרשאות.
    __WB_MANIFEST:
      Array<{
        // url — כתובת יעד.
        url: string;
        revision:
          string | null;
      }>;
  };

/**
 * חוזה הנתונים PushNotificationPayload: התראות Push / התראות.
 */
interface PushNotificationPayload {
  // title — כותרת (אופציונלי).
  title?: string;

  // body — תוכן (אופציונלי).
  body?: string;

  icon?: string;

  badge?: string;

  tag?: string;

  // url — כתובת יעד (אופציונלי).
  url?: string;

  // data — נתונים (אופציונלי).
  data?: Record<
    string,
    unknown
  >;
}

/**
 * חוזה הנתונים NotificationClickData: התראות / נתונים.
 */
interface NotificationClickData {
  // url — כתובת יעד.
  url:
    string;

  // notificationId — התראות / מזהה.
  notificationId:
    string | null;

  // recipientId — מזהה.
  recipientId:
    string | null;
}

// defaultNotificationTitle — התראות / כותרת.
const defaultNotificationTitle =
  'צוות GVK';

// defaultNotificationBody — התראות / תוכן.
const defaultNotificationBody =
  'התקבלה התראה חדשה.';

// defaultNotificationUrl — התראות / כתובת יעד.
const defaultNotificationUrl =
  '/';

// notificationClickMessageType — התראות / הודעה.
const notificationClickMessageType =
  'GVK_NOTIFICATION_CLICKED';

precacheAndRoute(
  self.__WB_MANIFEST,
);

cleanupOutdatedCaches();

/**
 * פעולה parsePushPayload: פענוח קלט עבור התראות Push.
 * @param event — אירוע.
 * @returns PushNotificationPayload — הפלט בהתאם לחתימה.
 */
function parsePushPayload(
  event:
    PushEvent,
): PushNotificationPayload {
  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !event.data.
  if (
    !event.data
  ) {
    return {};
  }

  // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
  try {
    return event.data
      .json() as
      PushNotificationPayload;
  } catch {
    const text =
      event.data.text();

    return {
      body:
        text ||
        defaultNotificationBody,
    };
  }
}

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
 * פעולה parseNotificationClickData: פענוח קלט עבור התראות / נתונים.
 * @param value — ערך.
 * @returns NotificationClickData — הפלט בהתאם לחתימה.
 */
function parseNotificationClickData(
  value: unknown,
): NotificationClickData {
  // data — נתונים.
  const data =
    typeof value ===
        'object' &&
      value !==
        null
      ? value as
          Record<
            string,
            unknown
          >
      : {};

  return {
    url:
      getStringValue(
        data.url,
      ) ??
      defaultNotificationUrl,

    notificationId:
      getStringValue(
        data.notificationId,
      ),

    recipientId:
      getStringValue(
        data.recipientId,
      ),
  };
}

/**
 * פעולה createTargetUrl: יצירת יעד / כתובת יעד.
 * @param clickData — נתונים.
 * @returns string — הפלט בהתאם לחתימה.
 */
function createTargetUrl(
  clickData:
    NotificationClickData,
): string {
  // targetUrl — יעד / כתובת יעד.
  const targetUrl =
    new URL(
      clickData.url,
      self.location.origin,
    );

  /*
   * אם האפליקציה הייתה סגורה, React יקרא
   * את הפרמטר ויסמן את ההתראה כנקראה
   * לאחר עליית האפליקציה.
   */
  if (
    clickData.notificationId &&
    targetUrl.pathname === '/notifications'
  ) {
    targetUrl.searchParams.set(
      'notification',
      clickData.notificationId,
    );
  }

  if (
    clickData.recipientId
  ) {
    targetUrl.searchParams.set(
      'notificationRecipientId',
      clickData.recipientId,
    );
  }

  return targetUrl.href;
}

/**
 * פעולה אסינכרונית sendClickMessageToClient: שליחת הודעה / לקוח.
 * @param client — לקוח.
 * @param clickData — נתונים.
 * @returns Promise<void> — הפלט בהתאם לחתימה.
 */
async function sendClickMessageToClient(
  client:
    WindowClient,

  clickData:
    NotificationClickData,
): Promise<void> {
  client.postMessage({
    type:
      notificationClickMessageType,

    notificationId:
      clickData.notificationId,

    recipientId:
      clickData.recipientId,

    url:
      createTargetUrl(
        clickData,
      ),
  });
}
/**
 * חוזה הנתונים ExtendedNotificationOptions: התראות / אפשרויות בחירה.
 */
interface ExtendedNotificationOptions
  extends NotificationOptions {
  vibrate?: number[];
}

// skipWaitingMessageType — הודעה.
const skipWaitingMessageType =
  'SKIP_WAITING';

self.addEventListener(
  'message',
  (
    event:
      ExtendableMessageEvent,
  ) => {
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
      event.data as {
        type?: unknown;
      };

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר message.type !== skipWaitingMessageType.
    if (
      message.type !==
        skipWaitingMessageType
    ) {
      return;
    }

    event.waitUntil(
      self.skipWaiting(),
    );
  },
);

self.addEventListener(
  'activate',
  (
    event:
      ExtendableEvent,
  ) => {
    event.waitUntil(
      self.clients.claim(),
    );
  },
);
self.addEventListener(
  'push',
  (
    event:
      PushEvent,
  ) => {
    const payload =
      parsePushPayload(
        event,
      );

    // title — כותרת.
    const title =
      payload.title?.trim() ||
      defaultNotificationTitle;

    // notificationUrl — התראות / כתובת יעד.
    const notificationUrl =
      payload.url?.trim() ||
      defaultNotificationUrl;

    // options — אפשרויות בחירה.
    const options:
      ExtendedNotificationOptions = {
        body:
          payload.body?.trim() ||
          defaultNotificationBody,

        icon:
          payload.icon?.trim() ||
          '/icon-192.png',

        badge:
          payload.badge?.trim() ||
          '/icon-96.png',

        tag:
          payload.tag?.trim() ||
          undefined,

        dir:
          'rtl',

        lang:
          'he',

        silent:
          false,

        vibrate: [
          200,
          100,
          200,
        ],

        data: {
          ...payload.data,

          url:
            notificationUrl,
        },
      };

    event.waitUntil(
      self.registration
        .showNotification(
          title,
          options,
        ),
    );
  },
);

self.addEventListener(
  'notificationclick',
  (
    event:
      NotificationEvent,
  ) => {
    /*
     * סגירת ההתראה שנלחצה מסירה אותה
     * ממגש ההתראות של המכשיר.
     */
    event.notification.close();

    // clickData — נתונים.
    const clickData =
      parseNotificationClickData(
        event.notification.data,
      );

    // targetUrl — יעד / כתובת יעד.
    const targetUrl =
      createTargetUrl(
        clickData,
      );

    event.waitUntil(
      self.clients
        .matchAll({
          type:
            'window',

          includeUncontrolled:
            true,
        })
        .then(
          async (
            clients,
          ) => {
            // עיבוד כל פריט מתוך clients בנפרד.
            for (
              const client
              of clients
            ) {
              // windowClient — לקוח.
              const windowClient =
                client as
                  WindowClient;

              // clientUrl — לקוח / כתובת יעד.
              const clientUrl =
                new URL(
                  windowClient.url,
                );

              if (
                clientUrl.origin !==
                self.location.origin
              ) {
                continue;
              }

              await sendClickMessageToClient(
                windowClient,
                clickData,
              );

              await windowClient
                .navigate(
                  targetUrl,
                );

              await windowClient
                .focus();

              return;
            }

            await self.clients
              .openWindow(
                targetUrl,
              );
          },
        ),
    );
  },
);