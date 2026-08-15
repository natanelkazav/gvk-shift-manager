import type {
  PushPayload,
  SendNotificationRequest,
} from './types.ts';

import {
  authenticateNotificationManager,
} from './services/permissionService.ts';

import {
  deactivateSubscription,
  loadNotificationDeliveryData,
  markRecipientDelivered,
  recordPushDelivery,
  updateSubscriptionLastUsed,
} from './services/notificationService.ts';

import {
  configurePushService,
  sendPushNotification,
} from './services/pushService.ts';

import {
  getRequiredEnvironmentVariable,
} from './utils/errors.ts';

import {
  corsHeaders,
  createJsonResponse,
} from './utils/responses.ts';

interface DeliverySummary {
  totalRecipients:
    number;

  recipientsWithDevices:
    number;

  recipientsDelivered:
    number;

  recipientsWithoutDevices:
    number;

  totalDevices:
    number;

  sent:
    number;

  failed:
    number;
}

function parseRequestBody(
  value: unknown,
): SendNotificationRequest {
  if (
    typeof value !==
      'object' ||
    value ===
      null
  ) {
    throw new Error(
      'גוף הבקשה אינו תקין.',
    );
  }

  const body =
    value as
      Partial<SendNotificationRequest>;

  const notificationId =
    body.notificationId
      ?.trim();

  if (
    !notificationId
  ) {
    throw new Error(
      'לא התקבל מזהה התראה.',
    );
  }

  return {
    notificationId,
  };
}

async function readRequestBody(
  request:
    Request,
): Promise<SendNotificationRequest> {
  let rawBody:
    unknown;

  try {
    rawBody =
      await request.json();
  } catch {
    throw new Error(
      'גוף הבקשה אינו JSON תקין.',
    );
  }

  return parseRequestBody(
    rawBody,
  );
}

function createPushPayload(
  notification: {
    id: string;

    type: string;

    priority: string;

    title: string;

    body: string;

    url:
      string | null;

    data:
      Record<string, unknown>;
  },

  recipientId:
    string,

  userId:
    string,
): PushPayload {
  return {
    title:
      notification.title,

    body:
      notification.body,

    icon:
      '/icon-192.png',

    badge:
      '/icon-192.png',

    tag:
      `notification-${notification.id}`,

    url:
      notification.url ??
      '/notifications',

    data: {
      ...notification.data,

      notificationId:
        notification.id,

      recipientId,

      userId,

      type:
        notification.type,

      priority:
        notification.priority,
    },
  };
}

Deno.serve(
  async (
    request:
      Request,
  ): Promise<Response> => {
    if (
      request.method ===
      'OPTIONS'
    ) {
      return new Response(
        'ok',
        {
          headers:
            corsHeaders,
        },
      );
    }

    if (
      request.method !==
      'POST'
    ) {
      return createJsonResponse(
        {
          error:
            'Method not allowed.',
        },
        405,
      );
    }

    try {
      const supabaseUrl =
        getRequiredEnvironmentVariable(
          'SUPABASE_URL',
        );

      const supabaseAnonKey =
        getRequiredEnvironmentVariable(
          'SUPABASE_ANON_KEY',
        );

      const serviceRoleKey =
        getRequiredEnvironmentVariable(
          'SUPABASE_SERVICE_ROLE_KEY',
        );

      const vapidPublicKey =
        getRequiredEnvironmentVariable(
          'VAPID_PUBLIC_KEY',
        );

      const vapidPrivateKey =
        getRequiredEnvironmentVariable(
          'VAPID_PRIVATE_KEY',
        );

      const vapidSubject =
        getRequiredEnvironmentVariable(
          'VAPID_SUBJECT',
        );

      const requestBody =
        await readRequestBody(
          request,
        );

      const {
        userId:
          authenticatedUserId,

        adminClient,
      } =
        await authenticateNotificationManager(
          request,
          {
            supabaseUrl,

            supabaseAnonKey,

            serviceRoleKey,
          },
          requestBody.notificationId,
        );

      configurePushService({
        vapidSubject,

        vapidPublicKey,

        vapidPrivateKey,
      });

      const {
        notification,
        targets,
      } =
        await loadNotificationDeliveryData(
          adminClient,
          requestBody.notificationId,
        );

      const summary:
        DeliverySummary = {
          totalRecipients:
            targets.length,

          recipientsWithDevices:
            0,

          recipientsDelivered:
            0,

          recipientsWithoutDevices:
            0,

          totalDevices:
            0,

          sent:
            0,

          failed:
            0,
        };

      for (
        const target
        of targets
      ) {
        const {
          recipient,
          subscriptions,
        } =
          target;

        if (
          subscriptions.length ===
          0
        ) {
          summary
            .recipientsWithoutDevices +=
            1;

          continue;
        }

        summary
          .recipientsWithDevices +=
          1;

        summary.totalDevices +=
          subscriptions.length;

        const payload =
          createPushPayload(
            notification,
            recipient.id,
            recipient.user_id,
          );

        let recipientSentCount =
          0;

        for (
          const subscription
          of subscriptions
        ) {
          const result =
            await sendPushNotification(
              subscription,
              payload,
            );

          await recordPushDelivery(
            adminClient,
            {
              recipientId:
                recipient.id,

              subscriptionId:
                subscription.id,

              result,
            },
          );

          if (
            result.success
          ) {
            recipientSentCount +=
              1;

            summary.sent +=
              1;

            await updateSubscriptionLastUsed(
              adminClient,
              subscription.id,
            );

            continue;
          }

          summary.failed +=
            1;

          if (
            result.isExpired
          ) {
            await deactivateSubscription(
              adminClient,
              subscription.id,
            );
          }
        }

        if (
          recipientSentCount >
          0
        ) {
          await markRecipientDelivered(
            adminClient,
            recipient.id,
          );

          summary
            .recipientsDelivered +=
            1;
        }
      }

      console.log(
        'Notification delivery completed:',
        {
          notificationId:
            notification.id,

          sentBy:
            authenticatedUserId,

          summary,
        },
      );

      return createJsonResponse(
        {
          success:
            summary.sent > 0,

          notificationId:
            notification.id,

          sentBy:
            authenticatedUserId,

          ...summary,
        },
      );
    } catch (
      error
    ) {
      console.error(
        'send-notification failed:',
        error,
      );

      return createJsonResponse(
        {
          error:
            error instanceof Error
              ? error.message
              : 'אירעה שגיאה בלתי צפויה בשליחת ההתראה.',
        },
        500,
      );
    }
  },
);