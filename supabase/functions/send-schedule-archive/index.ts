import {
  createClient,
} from 'npm:@supabase/supabase-js@2';

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

const archiveSubject =
  'GVK_MONTHLY_TEAMS_ARCHIVE';

const maxBase64Length =
  12 *
  1024 *
  1024;

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

function requiredEnv(
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
      `Missing environment variable: ${name}`,
    );
  }

  return value;
}

function stringValue(
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
      return jsonResponse(
        {
          error:
            'Method not allowed.',
        },
        405,
      );
    }

    try {
      const supabaseUrl =
        requiredEnv(
          'SUPABASE_URL',
        );

      const anonKey =
        requiredEnv(
          'SUPABASE_ANON_KEY',
        );

      const serviceRoleKey =
        requiredEnv(
          'SUPABASE_SERVICE_ROLE_KEY',
        );

      const resendApiKey =
        requiredEnv(
          'RESEND_API_KEY',
        );

      const fromEmail =
        requiredEnv(
          'RESEND_FROM_EMAIL',
        );

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
        return jsonResponse(
          {
            error:
              'ההתחברות אינה תקינה או שפג תוקפה.',
          },
          401,
        );
      }

      const {
        data:
          permissionData,

        error:
          permissionError,
      } =
        await userClient.rpc(
          'get_my_permissions',
        );

      if (
        permissionError
      ) {
        throw permissionError;
      }

      const permissions =
        Array.isArray(
          permissionData,
        )
          ? permissionData
          : [];

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

      const body =
        await request
          .json() as
          Record<
            string,
            unknown
          >;

      const fileName =
        stringValue(
          body.fileName,
        );

      const fileBase64 =
        stringValue(
          body.fileBase64,
        );

      const year =
        typeof body.year ===
          'number'
          ? body.year
          : Number.NaN;

      const month =
        typeof body.month ===
          'number'
          ? body.month
          : Number.NaN;

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
                    'קובץ שיבוצים חודשי שנשלח מ-GVK Shift Manager.',
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

      let resendBody:
        Record<
          string,
          unknown
        > | null =
          null;

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
