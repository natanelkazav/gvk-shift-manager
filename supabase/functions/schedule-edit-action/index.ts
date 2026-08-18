import {
  createClient,
} from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',

  'Access-Control-Allow-Headers': [
    'authorization',
    'x-client-info',
    'apikey',
    'content-type',
  ].join(', '),

  'Access-Control-Allow-Methods':
    'POST, OPTIONS',
};

function createJsonResponse(
  body: unknown,
  status = 200,
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
      .get(
        name,
      )
      ?.trim();

  if (
    !value
  ) {
    throw new Error(
      `Missing required environment variable: ${name}`,
    );
  }

  return value;
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

  return (
    value.trim() ||
    null
  );
}

async function deliverNotification(
  supabaseUrl: string,
  supabaseAnonKey: string,
  authorizationHeader: string,
  notificationId: string,
): Promise<void> {
  const response =
    await fetch(
      `${supabaseUrl}/functions/v1/send-notification`,
      {
        method:
          'POST',

        headers: {
          Authorization:
            authorizationHeader,

          apikey:
            supabaseAnonKey,

          'Content-Type':
            'application/json',
        },

        body:
          JSON.stringify({
            notificationId,
          }),
      },
    );

  if (
    response.ok
  ) {
    return;
  }

  const responseBody =
    await response
      .text()
      .catch(
        () => '',
      );

  throw new Error(
    [
      `Push delivery failed with status ${response.status}.`,
      responseBody,
    ]
      .filter(
        Boolean,
      )
      .join(
        ' ',
      ),
  );
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

      const authorizationHeader =
        request.headers
          .get(
            'Authorization',
          )
          ?.trim();

      if (
        !authorizationHeader
      ) {
        throw new Error(
          'לא נמצאה התחברות פעילה.',
        );
      }

      let rawBody: {
        shiftId?: unknown;
        newUserId?: unknown;
        reason?: unknown;
      };

      try {
        rawBody =
          await request
            .json() as {
              shiftId?: unknown;
              newUserId?: unknown;
              reason?: unknown;
            };
      } catch {
        return createJsonResponse(
          {
            error:
              'גוף הבקשה אינו תקין.',
          },
          400,
        );
      }

      const shiftId =
        getStringValue(
          rawBody.shiftId,
        );

      const newUserId =
        getStringValue(
          rawBody.newUserId,
        );

      const reason =
        getStringValue(
          rawBody.reason,
        );

      if (
        !shiftId ||
        !newUserId
      ) {
        return createJsonResponse(
          {
            error:
              'נתוני שינוי השיבוץ חסרים.',
          },
          400,
        );
      }

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

      const {
        data:
          userData,

        error:
          userError,
      } =
        await userClient.auth
          .getUser();

      if (
        userError ||
        !userData.user
      ) {
        return createJsonResponse(
          {
            error:
              'ההתחברות אינה תקינה או שפג תוקפה.',
          },
          401,
        );
      }

      const {
        data,
        error,
      } =
        await userClient.rpc(
          'update_current_schedule_shift',
          {
            requested_shift_id:
              shiftId,

            requested_new_user_id:
              newUserId,

            requested_reason:
              reason,
          },
        );

      if (
        error
      ) {
        throw error;
      }

      if (
        !data ||
        typeof data !==
          'object'
      ) {
        throw new Error(
          'לא התקבלה תשובה תקינה לאחר שינוי השיבוץ.',
        );
      }

      const result =
        data as {
          notificationIds?: unknown;

          previousUserId?: unknown;

          previousUserName?: unknown;

          newUserId?: unknown;

          newUserName?: unknown;

          shiftDate?: unknown;

          startsAt?: unknown;

          endsAt?: unknown;

          [
            key:
              string
          ]:
            unknown;
        };

      const notificationIds =
        Array.isArray(
          result.notificationIds,
        )
          ? result.notificationIds
              .filter(
                (
                  notificationId,
                ): notificationId is string =>
                  typeof notificationId ===
                    'string' &&
                  Boolean(
                    notificationId.trim(),
                  ),
              )
          : [];

      const deliveries =
        await Promise.allSettled(
          notificationIds.map(
            (
              notificationId,
            ) =>
              deliverNotification(
                supabaseUrl,
                supabaseAnonKey,
                authorizationHeader,
                notificationId,
              ),
          ),
        );

      deliveries.forEach(
        (
          delivery,
          index,
        ) => {
          if (
            delivery.status ===
              'rejected'
          ) {
            console.error(
              'Schedule edit Push delivery failed:',
              {
                notificationId:
                  notificationIds[
                    index
                  ],

                error:
                  delivery.reason,
              },
            );
          }
        },
      );

      return createJsonResponse(
        result,
      );
    } catch (
      error
    ) {
      console.error(
        'schedule-edit-action failed:',
        error,
      );

      return createJsonResponse(
        {
          error:
            error instanceof Error
              ? error.message
              : 'אירעה שגיאה בלתי צפויה בעדכון השיבוץ.',
        },
        500,
      );
    }
  },
);