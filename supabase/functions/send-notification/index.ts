/**
 * קובץ: supabase/functions/send-notification/index.ts
 * מטרה: טיפול בבקשות HTTP לפעולת השרת send-notification.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: DeliverySummary, parseRequestBody, readRequestBody, createPushPayload.
 * - מקורות נתונים הנזכרים בקריאות from: profiles, audit_logs.
 * - ריכוז ההגדרות והלוגיקה המפורטות בהמשך הקובץ.
 */
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

/**
 * חוזה הנתונים DeliverySummary: סיכום.
 */
interface DeliverySummary {
  // totalRecipients — סך הכול.
  totalRecipients:
    number;

  recipientsWithDevices:
    number;

  recipientsDelivered:
    number;

  recipientsWithoutDevices:
    number;

  // totalDevices — סך הכול.
  totalDevices:
    number;

  sent:
    number;

  failed:
    number;
}

/**
 * פעולה parseRequestBody: פענוח קלט עבור נתוני הבקשה / תוכן.
 * @param value — ערך.
 * @returns SendNotificationRequest — הפלט בהתאם לחתימה.
 */
function parseRequestBody(
  value: unknown,
): SendNotificationRequest {
  // עצירת הפעולה עם שגיאה כאשר typeof value !== 'object' || value === null.
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

  // body — תוכן.
  const body =
    value as
      Partial<SendNotificationRequest>;

  // notificationId — התראות / מזהה.
  const notificationId =
    body.notificationId
      ?.trim();

  // עצירת הפעולה עם שגיאה כאשר !notificationId.
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

/**
 * פעולה אסינכרונית readRequestBody: נתוני הבקשה / תוכן.
 * @param request — נתוני הבקשה.
 * @returns Promise<SendNotificationRequest> — הפלט בהתאם לחתימה.
 */
async function readRequestBody(
  request:
    Request,
): Promise<SendNotificationRequest> {
  // rawBody — תוכן.
  let rawBody:
    unknown;

  // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
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

/**
 * פעולה createPushPayload: יצירת התראות Push.
 * @param notification — התראות.
 * @param recipientId — מזהה.
 * @param userId — מזהה משתמש.
 * @returns PushPayload — הפלט בהתאם לחתימה.
 */
function createPushPayload(
  notification: {
    // id — מזהה.
    id: string;

    type: string;

    priority: string;

    // title — כותרת.
    title: string;

    // body — תוכן.
    body: string;

    // url — כתובת יעד.
    url:
      string | null;

    // data — נתונים.
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
    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר request.method === 'OPTIONS'.
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

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר request.method !== 'POST'.
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

    // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
    try {
      // supabaseUrl — כתובת יעד.
      const supabaseUrl =
        getRequiredEnvironmentVariable(
          'SUPABASE_URL',
        );

      // supabaseAnonKey — מפתח.
      const supabaseAnonKey =
        getRequiredEnvironmentVariable(
          'SUPABASE_ANON_KEY',
        );

      // serviceRoleKey — שירות / מפתח.
      const serviceRoleKey =
        getRequiredEnvironmentVariable(
          'SUPABASE_SERVICE_ROLE_KEY',
        );

      // vapidPublicKey — מפתח.
      const vapidPublicKey =
        getRequiredEnvironmentVariable(
          'VAPID_PUBLIC_KEY',
        );

      // vapidPrivateKey — מפתח.
      const vapidPrivateKey =
        getRequiredEnvironmentVariable(
          'VAPID_PRIVATE_KEY',
        );

      const vapidSubject =
        getRequiredEnvironmentVariable(
          'VAPID_SUBJECT',
        );

      // requestBody — נתוני הבקשה / תוכן.
      const requestBody =
        await readRequestBody(
          request,
        );

      // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
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

      // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
      const {
        notification,
        targets,
      } =
        await loadNotificationDeliveryData(
          adminClient,
          requestBody.notificationId,
        );

      // summary — סיכום.
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

      // עיבוד כל פריט מתוך targets בנפרד.
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

        // recipientSentCount — כמות.
        let recipientSentCount =
          0;

        // עיבוד כל פריט מתוך subscriptions בנפרד.
        for (
          const subscription
          of subscriptions
        ) {
          // result — תוצאה.
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

      if (
        notification.source ===
          'manager'
      ) {
        // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
        const {
          data:
            actorProfile,
        } =
          await adminClient
            .from(
              'profiles',
            )
            .select(
              'id, email, display_name',
            )
            .eq(
              'id',
              authenticatedUserId,
            )
            .maybeSingle();

        // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
        const {
          error:
            auditLogError,
        } =
          await adminClient
            .from(
              'audit_logs',
            )
            .insert({
              action:
                'notification_sent',

              actor_user_id:
                authenticatedUserId,

              actor_email:
                actorProfile?.email ??
                null,

              actor_display_name:
                actorProfile
                  ?.display_name ??
                null,

              target_user_id:
                null,

              target_email:
                null,

              target_display_name:
                null,

              entity_type:
                'notification',

              entity_id:
                notification.id,

              summary:
                `נשלחה התראה: ${notification.title}`,

              old_values:
                null,

              new_values: {
                title:
                  notification.title,

                type:
                  notification.type,

                priority:
                  notification.priority,
              },

              metadata: {
                source:
                  'send-notification-edge-function',

                total_recipients:
                  summary.totalRecipients,

                recipients_delivered:
                  summary.recipientsDelivered,

                sent:
                  summary.sent,

                failed:
                  summary.failed,
              },
            });

        if (
          auditLogError
        ) {
          console.error(
            'NOTIFICATION AUDIT LOG ERROR:',
            auditLogError,
          );
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