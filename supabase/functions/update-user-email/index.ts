/**
 * קובץ: supabase/functions/update-user-email/index.ts
 * מטרה: טיפול בבקשות HTTP לפעולת השרת update-user-email.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: jsonResponse, requiredEnv, normalizeEmail.
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
 * פעולה normalizeEmail: נרמול כתובת דוא״ל.
 * @param value — ערך.
 * @returns string | null — הפלט בהתאם לחתימה.
 */
function normalizeEmail(
  value: unknown,
): string | null {
  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר typeof value !== 'string'.
  if (
    typeof value !==
      'string'
  ) {
    return null;
  }

  // email — כתובת דוא״ל.
  const email =
    value
      .trim()
      .toLowerCase();

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !email || !email.includes( '@', ).
  if (
    !email ||
    !email.includes(
      '@',
    )
  ) {
    return null;
  }

  return email;
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

      const authorization =
        request.headers
          .get(
            'Authorization',
          )
          ?.trim();

      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !authorization.
      if (
        !authorization
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
                  authorization,
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
          actorData,

        error:
          actorError,
      } =
        await userClient.auth
          .getUser();

      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר actorError || !actorData.user.
      if (
        actorError ||
        !actorData.user
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
          permissions,

        error:
          permissionsError,
      } =
        await userClient.rpc(
          'get_my_permissions',
        );

      // עצירת הפעולה עם שגיאה כאשר permissionsError.
      if (
        permissionsError
      ) {
        throw permissionsError;
      }

      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !Array.isArray( permissions, ) || !permissions.includes( 'users.manage', ).
      if (
        !Array.isArray(
          permissions,
        ) ||
        !permissions.includes(
          'users.manage',
        )
      ) {
        return jsonResponse(
          {
            error:
              'אין לך הרשאה לערוך כתובות אימייל של משתמשים.',
          },
          403,
        );
      }

      // requestBody — נתוני הבקשה / תוכן.
      const requestBody =
        await request
          .json() as {
            // userId — מזהה משתמש (אופציונלי).
            userId?: unknown;
            // email — כתובת דוא״ל (אופציונלי).
            email?: unknown;
          };

      // userId — מזהה משתמש.
      const userId =
        typeof requestBody
          .userId ===
          'string'
          ? requestBody
              .userId
              .trim()
          : '';

      // email — כתובת דוא״ל.
      const email =
        normalizeEmail(
          requestBody.email,
        );

      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !userId || !email.
      if (
        !userId ||
        !email
      ) {
        return jsonResponse(
          {
            error:
              'מזהה המשתמש או כתובת האימייל אינם תקינים.',
          },
          400,
        );
      }

      // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
      const {
        data:
          targetProfile,

        error:
          targetProfileError,
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
            userId,
          )
          .maybeSingle();

      // עצירת הפעולה עם שגיאה כאשר targetProfileError.
      if (
        targetProfileError
      ) {
        throw targetProfileError;
      }

      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !targetProfile.
      if (
        !targetProfile
      ) {
        return jsonResponse(
          {
            error:
              'המשתמש לא נמצא.',
          },
          404,
        );
      }

      // oldEmail — כתובת דוא״ל.
      const oldEmail =
        String(
          targetProfile.email,
        )
          .trim()
          .toLowerCase();

      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר oldEmail === email.
      if (
        oldEmail ===
          email
      ) {
        return jsonResponse({
          success:
            true,

          email,
          auditLogged:
            true,

          changed:
            false,
        });
      }

      // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
      const {
        data:
          duplicateProfile,

        error:
          duplicateProfileError,
      } =
        await adminClient
          .from(
            'profiles',
          )
          .select(
            'id',
          )
          .eq(
            'email',
            email,
          )
          .neq(
            'id',
            userId,
          )
          .maybeSingle();

      // עצירת הפעולה עם שגיאה כאשר duplicateProfileError.
      if (
        duplicateProfileError
      ) {
        throw duplicateProfileError;
      }

      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר duplicateProfile.
      if (
        duplicateProfile
      ) {
        return jsonResponse(
          {
            error:
              'כתובת האימייל כבר משויכת למשתמש אחר.',
          },
          409,
        );
      }

      // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
      const {
        error:
          authUpdateError,
      } =
        await adminClient.auth
          .admin
          .updateUserById(
            userId,
            {
              email,
            },
          );

      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר authUpdateError.
      if (
        authUpdateError
      ) {
        console.error(
          'UPDATE AUTH EMAIL ERROR:',
          authUpdateError,
        );

        return jsonResponse(
          {
            error:
              'לא ניתן היה לעדכן את כתובת האימייל בחשבון ההתחברות.',
          },
          400,
        );
      }

      // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
      const {
        error:
          profileUpdateError,
      } =
        await adminClient
          .from(
            'profiles',
          )
          .update({
            email,

            updated_at:
              new Date()
                .toISOString(),
          })
          .eq(
            'id',
            userId,
          );

      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר profileUpdateError.
      if (
        profileUpdateError
      ) {
        console.error(
          'UPDATE PROFILE EMAIL ERROR:',
          profileUpdateError,
        );

        /*
         * ניסיון rollback כדי לשמור התאמה
         * בין auth.users ל-profiles.
         */
        // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
        const {
          error:
            rollbackError,
        } =
          await adminClient.auth
            .admin
            .updateUserById(
              userId,
              {
                email:
                  oldEmail,
              },
            );

        if (
          rollbackError
        ) {
          console.error(
            'ROLLBACK AUTH EMAIL ERROR:',
            rollbackError,
          );
        }

        return jsonResponse(
          {
            error:
              'עדכון כתובת האימייל לא הושלם. לא בוצע שינוי בפרופיל.',
          },
          500,
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
            actorData.user.id,
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
              actorData.user.id,

            action:
              'user.email.updated',

            entity_type:
              'user',

            entity_id:
              userId,

            summary:
              `כתובת האימייל של ${targetProfile.display_name} שונתה`,

            actor_user_id:
              actorData.user.id,

            actor_email:
              actorProfile
                ?.email ??
              actorData.user
                .email ??
              null,

            actor_display_name:
              actorProfile
                ?.display_name ??
              null,

            target_user_id:
              userId,

            target_email:
              email,

            target_display_name:
              targetProfile
                .display_name,

            old_values: {
              email:
                oldEmail,
            },

            new_values: {
              email,
            },

            metadata: {
              source:
                'update-user-email',
            },
          });

      if (
        auditError
      ) {
        console.error(
          'UPDATE USER EMAIL AUDIT ERROR:',
          auditError,
        );
      }

      return jsonResponse({
        success:
          true,

        email,

        changed:
          true,

        auditLogged:
          !auditError,
      });
    } catch (
      error
    ) {
      console.error(
        'update-user-email failed:',
        error,
      );

      return jsonResponse(
        {
          error:
            error instanceof
              Error
              ? error.message
              : 'אירעה שגיאה בלתי צפויה בעדכון כתובת האימייל.',
        },
        500,
      );
    }
  },
);
