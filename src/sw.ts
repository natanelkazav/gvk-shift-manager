/// <reference lib="webworker" />

import {
  cleanupOutdatedCaches,
  precacheAndRoute,
} from 'workbox-precaching';

declare const self:
  ServiceWorkerGlobalScope & {
    __WB_MANIFEST:
      Array<{
        url: string;
        revision:
          string | null;
      }>;
  };

interface PushNotificationPayload {
  title?: string;

  body?: string;

  icon?: string;

  badge?: string;

  tag?: string;

  url?: string;

  data?: Record<
    string,
    unknown
  >;
}

interface NotificationClickData {
  url:
    string;

  notificationId:
    string | null;

  recipientId:
    string | null;
}

const defaultNotificationTitle =
  'GVK Shift Manager';

const defaultNotificationBody =
  'התקבלה התראה חדשה.';

const defaultNotificationUrl =
  '/';

const notificationClickMessageType =
  'GVK_NOTIFICATION_CLICKED';

precacheAndRoute(
  self.__WB_MANIFEST,
);

cleanupOutdatedCaches();

function parsePushPayload(
  event:
    PushEvent,
): PushNotificationPayload {
  if (
    !event.data
  ) {
    return {};
  }

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

function parseNotificationClickData(
  value: unknown,
): NotificationClickData {
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

function createTargetUrl(
  clickData:
    NotificationClickData,
): string {
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
    clickData.recipientId
  ) {
    targetUrl.searchParams.set(
      'notificationRecipientId',
      clickData.recipientId,
    );
  }

  return targetUrl.href;
}

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
      clickData.url,
  });
}

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

    const title =
      payload.title?.trim() ||
      defaultNotificationTitle;

    const notificationUrl =
      payload.url?.trim() ||
      defaultNotificationUrl;

    const options:
      NotificationOptions = {
        body:
          payload.body?.trim() ||
          defaultNotificationBody,

        icon:
          payload.icon?.trim() ||
          '/icon-192.png',

        badge:
          payload.badge?.trim() ||
          '/icon-192.png',

        tag:
          payload.tag?.trim() ||
          undefined,

        dir:
          'rtl',

        lang:
          'he',

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

    const clickData =
      parseNotificationClickData(
        event.notification.data,
      );

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
            for (
              const client
              of clients
            ) {
              const windowClient =
                client as
                  WindowClient;

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