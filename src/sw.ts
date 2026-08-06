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

const defaultNotificationTitle =
  'GVK Shift Manager';

const defaultNotificationBody =
  'התקבלה התראה חדשה.';

const defaultNotificationUrl =
  '/';

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
    event.notification.close();

    const notificationData =
      event.notification.data as
        | {
            url?: unknown;
          }
        | undefined;

    const requestedUrl =
      typeof notificationData?.url ===
        'string'
        ? notificationData.url
        : defaultNotificationUrl;

    const targetUrl =
      new URL(
        requestedUrl,
        self.location.origin,
      ).href;

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
                clientUrl.origin ===
                self.location.origin
              ) {
                await windowClient
                  .navigate(
                    targetUrl,
                  );

                await windowClient
                  .focus();

                return;
              }
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