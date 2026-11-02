/**
 * קובץ: supabase/functions/send-schedule-archive/index.ts
 * מטרה: טיפול בבקשות HTTP לפעולת השרת send-schedule-archive.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: jsonResponse, requiredEnv, stringValue.
 * - קריאות RPC המופעלות בקובץ: get_my_permissions.
 * - מקורות נתונים הנזכרים בקריאות from: profiles, audit_logs.
 * - ריכוז ההגדרות והלוגיקה המפורטות בהמשך הקובץ.
 */
import {
  createClient,
} from 'npm:@supabase/supabase-js@2';

// corsHeaders — הנתון corsHeaders בהקשר הפעולה.
const corsHeaders = {
  'Access-Control-Allow-Origin':
    '*',

  'Access-Control-Allow-Headers': [
    'authorization',
    'x-client-info',
    'apikey',
    'content-type',
  ].join(
    ', ',
  ),

  'Access-Control-Allow-Methods':
    'POST, OPTIONS',
};

// archiveSubject — ארכיון.
const archiveSubject =
  'GVK_MONTHLY_TEAMS_ARCHIVE';

// maxBase64Length — הנתון maxBase64Length בהקשר הפעולה.
const maxBase64Length =
  12 *
  1024 *
  1024;

/**
 * פעולה jsonResponse: תוצאת הפעולה.
 * @param body — תוכן.
 * @param status — סטטוס.
 * @returns Response — הפלט בהתאם לחתימה.
 */
function jsonResponse(
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
 * פעולה requiredEnv: הנתון requiredEnv בהקשר הפעולה.
 * @param name — שם.
 * @returns string — הפלט בהתאם לחתימה.
 */
function requiredEnv(
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
      `Missing environment variable: ${name}`,
    );
  }

  return value;
}

/**
 * פעולה stringValue: ערך.
 * @param value — ערך.
 * @returns string | null — הפלט בהתאם לחתימה.
 */
function stringValue(
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
      return jsonResponse(
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
        requiredEnv(
          'SUPABASE_URL',
        );

      // anonKey — מפתח.
      const anonKey =
        requiredEnv(
          'SUPABASE_ANON_KEY',
        );

      // serviceRoleKey — שירות / מפתח.
      const serviceRoleKey =
        requiredEnv(
          'SUPABASE_SERVICE_ROLE_KEY',
        );

      // resendApiKey — מפתח.
      const resendApiKey =
        requiredEnv(
          'RESEND_API_KEY',
        );

      // fromEmail — כתובת דוא״ל.
      const fromEmail =
        requiredEnv(
          'RESEND_FROM_EMAIL',
        );

      // recipientEmail — כתובת דוא״ל.
      const recipientEmail =
        requiredEnv(
          'SCHEDULE_ARCHIVE_RECIPIENT_EMAIL',
        );

      const authorizationHeader =
        request.headers
          .get(
            'Authorization',
          )
          ?.trim();

      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !authorizationHeader.
      if (
        !authorizationHeader
      ) {
        return jsonResponse(
          {
            error:
              'לא נמצאה התחברות פעילה.',
          },
          401,
        );
      }

      // userClient — משתמש / לקוח.
      const userClient =
        createClient(
          supabaseUrl,
          anonKey,
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

      // adminClient — לקוח.
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
        return jsonResponse(
          {
            error:
              'ההתחברות אינה תקינה או שפג תוקפה.',
          },
          401,
        );
      }

      // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
      const {
        data:
          permissionData,

        error:
          permissionError,
      } =
        await userClient.rpc(
          'get_my_permissions',
        );

      // עצירת הפעולה עם שגיאה כאשר permissionError.
      if (
        permissionError
      ) {
        throw permissionError;
      }

      // permissions — הרשאות.
      const permissions =
        Array.isArray(
          permissionData,
        )
          ? permissionData
          : [];

      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !permissions.includes( 'schedule_export.manage', ).
      if (
        !permissions.includes(
          'schedule_export.manage',
        )
      ) {
        return jsonResponse(
          {
            error:
              'אין לך הרשאה לשלוח קובצי שיבוצים.',
          },
          403,
        );
      }

      // body — תוכן.
      const body =
        await request
          .json() as
          Record<
            string,
            unknown
          >;

      // fileName — קובץ / שם.
      const fileName =
        stringValue(
          body.fileName,
        );

      // fileBase64 — קובץ.
      const fileBase64 =
        stringValue(
          body.fileBase64,
        );

      // year — שנה.
      const year =
        typeof body.year ===
          'number'
          ? body.year
          : Number.NaN;

      // month — חודש.
      const month =
        typeof body.month ===
          'number'
          ? body.month
          : Number.NaN;

      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !fileName || !fileBase64 || !Number.isInteger( year, ) || !Number.isInteger( month, ) || month < 1 || month > 12.
      if (
        !fileName ||
        !fileBase64 ||
        !Number.isInteger(
          year,
        ) ||
        !Number.isInteger(
          month,
        ) ||
        month < 1 ||
        month > 12
      ) {
        return jsonResponse(
          {
            error:
              'נתוני קובץ השיבוצים אינם תקינים.',
          },
          400,
        );
      }

      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !fileName .toLowerCase() .endsWith( '.xlsx', ).
      if (
        !fileName
          .toLowerCase()
          .endsWith(
            '.xlsx',
          )
      ) {
        return jsonResponse(
          {
            error:
              'ניתן לשלוח רק קובצי XLSX.',
          },
          400,
        );
      }

      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר fileBase64.length > maxBase64Length.
      if (
        fileBase64.length >
          maxBase64Length
      ) {
        return jsonResponse(
          {
            error:
              'קובץ השיבוצים גדול מדי לשליחה.',
          },
          413,
        );
      }

      // resendResponse — תוצאת הפעולה.
      const resendResponse =
        await fetch(
          'https://api.resend.com/emails',
          {
            method:
              'POST',

            headers: {
              Authorization:
                `Bearer ${resendApiKey}`,

              'Content-Type':
                'application/json',
            },

            body:
              JSON.stringify({
                from:
                  fromEmail,

                to: [
                  recipientEmail,
                ],

                subject:
                  archiveSubject,

                text:
                  [
                    'קובץ שיבוצים חודשי שנשלח מ-צוות GVK.',
                    `תקופה: ${String(month).padStart(2, '0')}/${year}`,
                    '',
                    'הודעה זו מיועדת להפעלת תהליך הארכיון הקיים ב-Power Automate.',
                  ].join(
                    '\n',
                  ),

                attachments: [
                  {
                    filename:
                      fileName,

                    content:
                      fileBase64,

                    content_type:
                      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                  },
                ],
              }),
          },
        );

      const resendText =
        await resendResponse
          .text();

      // resendBody — תוכן.
      let resendBody:
        Record<
          string,
          unknown
        > | null =
          null;

      // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
      try {
        resendBody =
          JSON.parse(
            resendText,
          ) as
            Record<
              string,
              unknown
            >;
      } catch {
        resendBody =
          null;
      }

      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !resendResponse.ok.
      if (
        !resendResponse.ok
      ) {
        console.error(
          'RESEND SCHEDULE ARCHIVE ERROR:',
          {
            status:
              resendResponse
                .status,

            body:
              resendText,
          },
        );

        return jsonResponse(
          {
            error:
              'המייל עם קובץ השיבוצים לא נשלח. בדוק את הגדרות שירות המייל.',
          },
          502,
        );
      }

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
            'email, display_name',
          )
          .eq(
            'id',
            userData.user.id,
          )
          .maybeSingle();

      // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
      const {
        error:
          auditError,
      } =
        await adminClient
          .from(
            'audit_logs',
          )
          .insert({
            user_id:
              userData.user.id,

            action:
              'schedule.archive.sent',

            entity_type:
              'schedule_export',

            entity_id:
              null,

            summary:
              `קובץ השיבוצים ${fileName} נשלח במייל לארכיון Teams`,

            actor_user_id:
              userData.user.id,

            actor_email:
              actorProfile
                ?.email ??
              userData.user
                .email ??
              null,

            actor_display_name:
              actorProfile
                ?.display_name ??
              null,

            metadata: {
              source:
                'send-schedule-archive',

              year,

              month,

              fileName,

              subject:
                archiveSubject,

              recipientEmail,
            },
          });

      if (
        auditError
      ) {
        console.error(
          'SCHEDULE ARCHIVE AUDIT ERROR:',
          auditError,
        );
      }

      return jsonResponse({
        success:
          true,

        emailId:
          stringValue(
            resendBody?.id,
          ),

        auditLogged:
          !auditError,
      });
    } catch (
      error
    ) {
      console.error(
        'send-schedule-archive failed:',
        error,
      );

      return jsonResponse(
        {
          error:
            error instanceof
              Error
              ? error.message
              : 'אירעה שגיאה בלתי צפויה בשליחת קובץ השיבוצים.',
        },
        500,
      );
    }
  },
);
