/**
 * קובץ: supabase/functions/schedule-edit-action/index.ts
 * מטרה: טיפול בבקשות HTTP לפעולת השרת schedule-edit-action.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: createJsonResponse, getRequiredEnvironmentVariable, getStringValue, deliverNotification.
 * - קריאות RPC המופעלות בקובץ: update_current_schedule_shift.
 * - ריכוז ההגדרות והלוגיקה המפורטות בהמשך הקובץ.
 */
import {
  createClient,
} from 'npm:@supabase/supabase-js@2';

// corsHeaders — הנתון corsHeaders בהקשר הפעולה.
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

/**
 * פעולה createJsonResponse: יצירת תוצאת הפעולה.
 * @param body — תוכן.
 * @param status — סטטוס.
 * @returns Response — הפלט בהתאם לחתימה.
 */
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

/**
 * פעולה getRequiredEnvironmentVariable: שליפה או חישוב של הנתון getRequiredEnvironmentVariable בהקשר הפעולה.
 * @param name — שם.
 * @returns string — הפלט בהתאם לחתימה.
 */
function getRequiredEnvironmentVariable(
  name: string,
): string {
  // value — ערך.
  const value =
    Deno.env
      .get(
        name,
      )
      ?.trim();

  // עצירת הפעולה עם שגיאה כאשר !value.
  if (
    !value
  ) {
    throw new Error(
      `Missing required environment variable: ${name}`,
    );
  }

  return value;
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

  return (
    value.trim() ||
    null
  );
}

/**
 * פעולה אסינכרונית deliverNotification: התראות.
 * @param supabaseUrl — כתובת יעד.
 * @param supabaseAnonKey — מפתח.
 * @param authorizationHeader — הנתון authorizationHeader בהקשר הפעולה.
 * @param notificationId — התראות / מזהה.
 * @returns Promise<void> — הפלט בהתאם לחתימה.
 */
async function deliverNotification(
  supabaseUrl: string,
  supabaseAnonKey: string,
  authorizationHeader: string,
  notificationId: string,
): Promise<void> {
  // response — תוצאת הפעולה.
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

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר response.ok.
  if (
    response.ok
  ) {
    return;
  }

  // responseBody — תוצאת הפעולה / תוכן.
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

      const authorizationHeader =
        request.headers
          .get(
            'Authorization',
          )
          ?.trim();

      // עצירת הפעולה עם שגיאה כאשר !authorizationHeader.
      if (
        !authorizationHeader
      ) {
        throw new Error(
          'לא נמצאה התחברות פעילה.',
        );
      }

      // rawBody — תוכן.
      let rawBody: {
        // shiftId — מזהה המשמרת (אופציונלי).
        shiftId?: unknown;
        // newUserId — מזהה העובד לאחר השינוי (אופציונלי).
        newUserId?: unknown;
        reason?: unknown;
      };

      // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
      try {
        rawBody =
          await request
            .json() as {
              // shiftId — מזהה המשמרת (אופציונלי).
              shiftId?: unknown;
              // newUserId — מזהה העובד לאחר השינוי (אופציונלי).
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

      // shiftId — מזהה המשמרת.
      const shiftId =
        getStringValue(
          rawBody.shiftId,
        );

      // newUserId — מזהה העובד לאחר השינוי.
      const newUserId =
        getStringValue(
          rawBody.newUserId,
        );

      const reason =
        getStringValue(
          rawBody.reason,
        );

      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !shiftId || !newUserId.
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

      // userClient — משתמש / לקוח.
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

      // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
      const {
        data:
          userData,

        error:
          userError,
      } =
        await userClient.auth
          .getUser();

      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר userError || !userData.user.
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

      // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
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

      // עצירת הפעולה עם שגיאה כאשר error.
      if (
        error
      ) {
        throw error;
      }

      // עצירת הפעולה עם שגיאה כאשר !data || typeof data !== 'object'.
      if (
        !data ||
        typeof data !==
          'object'
      ) {
        throw new Error(
          'לא התקבלה תשובה תקינה לאחר שינוי השיבוץ.',
        );
      }

      // result — תוצאה.
      const result =
        data as {
          // notificationIds — התראות (אופציונלי).
          notificationIds?: unknown;

          // previousUserId — מזהה העובד לפני השינוי (אופציונלי).
          previousUserId?: unknown;

          // previousUserName — משתמש / שם (אופציונלי).
          previousUserName?: unknown;

          // newUserId — מזהה העובד לאחר השינוי (אופציונלי).
          newUserId?: unknown;

          // newUserName — משתמש / שם (אופציונלי).
          newUserName?: unknown;

          // shiftDate — תאריך המשמרת (אופציונלי).
          shiftDate?: unknown;

          // startsAt — מועד התחלה (אופציונלי).
          startsAt?: unknown;

          // endsAt — מועד סיום (אופציונלי).
          endsAt?: unknown;

          [
            key:
              string
          ]:
            unknown;
        };

      // notificationIds — התראות.
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