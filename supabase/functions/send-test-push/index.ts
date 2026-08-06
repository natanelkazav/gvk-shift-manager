import {
  createClient,
} from 'npm:@supabase/supabase-js@2';

import webPush
  from 'npm:web-push@3.6.7';

const corsHeaders = {
  'Access-Control-Allow-Origin':
    '*',

  'Access-Control-Allow-Headers':
    [
      'authorization',
      'x-client-info',
      'apikey',
      'content-type',
    ].join(', '),

  'Access-Control-Allow-Methods':
    'POST, OPTIONS',
};

interface SendTestPushRequest {
  targetUserId: string;

  title?: string;

  body?: string;

  url?: string;
}

interface PushSubscriptionRow {
  id: string;

  user_id: string;

  endpoint: string;

  p256dh_key: string;

  auth_key: string;

  is_active: boolean;
}

interface PushSendFailure {
  subscriptionId: string;

  statusCode:
    number | null;

  message: string;
}

function createJsonResponse(
  body:
    Record<string, unknown>,

  status =
    200,
): Response {
  return new Response(
    JSON.stringify(
      body,
    ),
    {
      status,

      headers: {
        ...corsHeaders,

        'Content-Type':
          'application/json; charset=utf-8',
      },
    },
  );
}

function getRequiredEnvironmentVariable(
  name: string,
): string {
  const value =
    Deno.env
      .get(name)
      ?.trim();

  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}`,
    );
  }

  return value;
}

function parseRequestBody(
  value: unknown,
): SendTestPushRequest {
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
      Partial<SendTestPushRequest>;

  const targetUserId =
    body.targetUserId
      ?.trim();

  if (!targetUserId) {
    throw new Error(
      'לא נבחר משתמש לקבלת ההתראה.',
    );
  }

  const title =
    body.title
      ?.trim() ||
    'בדיקת התראות GVK';

  const notificationBody =
    body.body
      ?.trim() ||
    'זוהי התראת Push לבדיקה.';

  const url =
    body.url
      ?.trim() ||
    '/';

  if (
    title.length >
    120
  ) {
    throw new Error(
      'כותרת ההתראה ארוכה מדי.',
    );
  }

  if (
    notificationBody.length >
    500
  ) {
    throw new Error(
      'תוכן ההתראה ארוך מדי.',
    );
  }

  if (
    !url.startsWith(
      '/',
    )
  ) {
    throw new Error(
      'כתובת הפתיחה חייבת להיות נתיב פנימי באפליקציה.',
    );
  }

  return {
    targetUserId,

    title,

    body:
      notificationBody,

    url,
  };
}

function getPushErrorDetails(
  error: unknown,
): {
  statusCode:
    number | null;

  message: string;
} {
  if (
    error instanceof Error
  ) {
    const pushError =
      error as Error & {
        statusCode?: unknown;

        body?: unknown;
      };

    const statusCode =
      typeof pushError.statusCode ===
        'number'
        ? pushError.statusCode
        : null;

    const messageParts = [
      pushError.message
        .trim() ||
      null,

      typeof pushError.body ===
        'string' &&
      pushError.body.trim()
        ? pushError.body
        : null,
    ].filter(
      (
        part,
      ): part is string =>
        Boolean(
          part,
        ),
    );

    return {
      statusCode,

      message:
        messageParts.join(
          ' | ',
        ) ||
        'שליחת ה־Push נכשלה.',
    };
  }

  if (
    typeof error ===
      'object' &&
    error !==
      null
  ) {
    const pushError =
      error as {
        statusCode?: unknown;

        message?: unknown;

        body?: unknown;
      };

    const statusCode =
      typeof pushError.statusCode ===
        'number'
        ? pushError.statusCode
        : null;

    const messageParts = [
      typeof pushError.message ===
        'string' &&
      pushError.message.trim()
        ? pushError.message
        : null,

      typeof pushError.body ===
        'string' &&
      pushError.body.trim()
        ? pushError.body
        : null,
    ].filter(
      (
        part,
      ): part is string =>
        Boolean(
          part,
        ),
    );

    return {
      statusCode,

      message:
        messageParts.join(
          ' | ',
        ) ||
        'שליחת ה־Push נכשלה.',
    };
  }

  return {
    statusCode:
      null,

    message:
      'שליחת ה־Push נכשלה.',
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
      /*
       * טעינת משתני הסביבה.
       */
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

      /*
       * אימות שהבקשה כוללת Token.
       */
      const authorizationHeader =
        request.headers.get(
          'Authorization',
        );

      if (
        !authorizationHeader
      ) {
        return createJsonResponse(
          {
            error:
              'לא נמצאה התחברות פעילה.',
          },
          401,
        );
      }

      /*
       * יצירת Client שמייצג את
       * המשתמש המחובר.
       */
      const userClient =
        createClient(
          supabaseUrl,
          supabaseAnonKey,
          {
            global: {
              headers: {
                Authorization:
                  authorizationHeader,
              },
            },

            auth: {
              persistSession:
                false,

              autoRefreshToken:
                false,
            },
          },
        );

      /*
       * אימות המשתמש המחובר מול
       * Supabase Auth.
       */
      const {
        data:
          authenticatedUserData,

        error:
          authenticatedUserError,
      } =
        await userClient.auth
          .getUser();

      if (
        authenticatedUserError ||
        !authenticatedUserData
          .user
      ) {
        return createJsonResponse(
          {
            error:
              'ההתחברות אינה תקינה או שפג תוקפה.',
          },
          401,
        );
      }

      const authenticatedUserId =
        authenticatedUserData
          .user
          .id;

      /*
       * יצירת Client ניהולי.
       * הוא נוצר רק לאחר אימות
       * המשתמש המחובר.
       */
      const adminClient =
        createClient(
          supabaseUrl,
          serviceRoleKey,
          {
            auth: {
              persistSession:
                false,

              autoRefreshToken:
                false,
            },
          },
        );

      /*
       * בדיקת פרופיל המשתמש השולח.
       */
      const {
        data:
          senderProfile,

        error:
          senderProfileError,
      } =
        await adminClient
          .from(
            'profiles',
          )
          .select(
            'id, is_active',
          )
          .eq(
            'id',
            authenticatedUserId,
          )
          .maybeSingle();

      if (
        senderProfileError
      ) {
        throw senderProfileError;
      }

      if (
        !senderProfile ||
        !senderProfile.is_active
      ) {
        return createJsonResponse(
          {
            error:
              'המשתמש אינו פעיל.',
          },
          403,
        );
      }

      /*
       * בדיקת הרשאה מפורשת מתוך
       * user_permissions.
       */
      const {
        data:
          notificationPermission,

        error:
          notificationPermissionError,
      } =
        await adminClient
          .from(
            'user_permissions',
          )
          .select(
            'permission_key',
          )
          .eq(
            'user_id',
            authenticatedUserId,
          )
          .eq(
            'permission_key',
            'notifications.manage',
          )
          .maybeSingle();

      if (
        notificationPermissionError
      ) {
        throw notificationPermissionError;
      }

      if (
        !notificationPermission
      ) {
        return createJsonResponse(
          {
            error:
              'אין לך הרשאה לשלוח התראות בדיקה.',
          },
          403,
        );
      }

      /*
       * קריאת נתוני הבקשה.
       */
      let rawRequestBody:
        unknown;

      try {
        rawRequestBody =
          await request.json();
      } catch {
        return createJsonResponse(
          {
            error:
              'גוף הבקשה אינו JSON תקין.',
          },
          400,
        );
      }

      let requestBody:
        SendTestPushRequest;

      try {
        requestBody =
          parseRequestBody(
            rawRequestBody,
          );
      } catch (
        error
      ) {
        return createJsonResponse(
          {
            error:
              error instanceof Error
                ? error.message
                : 'נתוני הבקשה אינם תקינים.',
          },
          400,
        );
      }

      /*
       * בדיקת משתמש היעד.
       */
      const {
        data:
          targetUserData,

        error:
          targetUserError,
      } =
        await adminClient
          .from(
            'profiles',
          )
          .select(
            'id, is_active',
          )
          .eq(
            'id',
            requestBody
              .targetUserId,
          )
          .maybeSingle();

      if (
        targetUserError
      ) {
        throw targetUserError;
      }

      if (
        !targetUserData ||
        !targetUserData
          .is_active
      ) {
        return createJsonResponse(
          {
            error:
              'משתמש היעד לא נמצא או שאינו פעיל.',
          },
          404,
        );
      }

      /*
       * טעינת כל המכשירים הפעילים
       * של משתמש היעד.
       */
      const {
        data:
          subscriptionData,

        error:
          subscriptionsError,
      } =
        await adminClient
          .from(
            'push_subscriptions',
          )
          .select(
            [
              'id',
              'user_id',
              'endpoint',
              'p256dh_key',
              'auth_key',
              'is_active',
            ].join(','),
          )
          .eq(
            'user_id',
            requestBody
              .targetUserId,
          )
          .eq(
            'is_active',
            true,
          );

      if (
        subscriptionsError
      ) {
        throw subscriptionsError;
      }

      const subscriptions =
        (
          subscriptionData ??
          []
        ) as
          PushSubscriptionRow[];

      if (
        subscriptions.length ===
        0
      ) {
        return createJsonResponse(
          {
            error:
              'למשתמש שנבחר אין מכשירים פעילים הרשומים ל־Push.',

            targetUserId:
              requestBody
                .targetUserId,

            totalDevices:
              0,

            sent:
              0,

            failed:
              0,

            failures:
              [],
          },
          409,
        );
      }

      /*
       * הגדרת מפתחות VAPID.
       */
      webPush
        .setVapidDetails(
          vapidSubject,
          vapidPublicKey,
          vapidPrivateKey,
        );

      /*
       * יצירת תוכן ההתראה.
       */
      const payload =
        JSON.stringify({
          title:
            requestBody.title,

          body:
            requestBody.body,

          icon:
            '/icon-192.png',

          badge:
            '/icon-192.png',

          tag:
            `test-push-${Date.now()}`,

          url:
            requestBody.url,

          data: {
            type:
              'test',

            targetUserId:
              requestBody
                .targetUserId,

            sentBy:
              authenticatedUserId,
          },
        });

      let sentCount =
        0;

      const failures:
        PushSendFailure[] = [];

      /*
       * שליחת ההתראה לכל מכשיר
       * פעיל של משתמש היעד.
       */
      for (
        const subscription
        of subscriptions
      ) {
        try {
          await webPush
            .sendNotification(
              {
                endpoint:
                  subscription.endpoint,

                keys: {
                  p256dh:
                    subscription
                      .p256dh_key,

                  auth:
                    subscription
                      .auth_key,
                },
              },
              payload,
              {
                TTL:
                  60,
              },
            );

          sentCount +=
            1;

          const {
            error:
              updateLastUsedError,
          } =
            await adminClient
              .from(
                'push_subscriptions',
              )
              .update({
                last_used_at:
                  new Date()
                    .toISOString(),
              })
              .eq(
                'id',
                subscription.id,
              );

          if (
            updateLastUsedError
          ) {
            console.error(
              'Failed to update push subscription last_used_at:',
              {
                subscriptionId:
                  subscription.id,

                error:
                  updateLastUsedError,
              },
            );
          }
        } catch (
          error
        ) {
          const details =
            getPushErrorDetails(
              error,
            );

          failures.push({
            subscriptionId:
              subscription.id,

            statusCode:
              details
                .statusCode,

            message:
              details.message,
          });

          /*
           * 404 או 410 מעידים בדרך כלל
           * שה־Subscription כבר אינו תקף.
           */
          if (
            details.statusCode ===
              404 ||
            details.statusCode ===
              410
          ) {
            const {
              error:
                deactivateError,
            } =
              await adminClient
                .from(
                  'push_subscriptions',
                )
                .update({
                  is_active:
                    false,
                })
                .eq(
                  'id',
                  subscription.id,
                );

            if (
              deactivateError
            ) {
              console.error(
                'Failed to deactivate expired push subscription:',
                {
                  subscriptionId:
                    subscription.id,

                  error:
                    deactivateError,
                },
              );
            }
          }
        }
      }

      const failedCount =
        failures.length;

      return createJsonResponse(
        {
          success:
            sentCount > 0,

          targetUserId:
            requestBody
              .targetUserId,

          totalDevices:
            subscriptions.length,

          sent:
            sentCount,

          failed:
            failedCount,

          failures,
        },
        sentCount > 0
          ? 200
          : 502,
      );
    } catch (
      error
    ) {
      console.error(
        'send-test-push failed:',
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