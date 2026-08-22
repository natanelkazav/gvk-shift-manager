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

function normalizeEmail(
  value: unknown,
): string | null {
  if (
    typeof value !==
      'string'
  ) {
    return null;
  }

  const email =
    value
      .trim()
      .toLowerCase();

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

      const authorization =
        request.headers
          .get(
            'Authorization',
          )
          ?.trim();

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
          actorData,

        error:
          actorError,
      } =
        await userClient.auth
          .getUser();

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

      const {
        data:
          permissions,

        error:
          permissionsError,
      } =
        await userClient.rpc(
          'get_my_permissions',
        );

      if (
        permissionsError
      ) {
        throw permissionsError;
      }

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

      const requestBody =
        await request
          .json() as {
            userId?: unknown;
            email?: unknown;
          };

      const userId =
        typeof requestBody
          .userId ===
          'string'
          ? requestBody
              .userId
              .trim()
          : '';

      const email =
        normalizeEmail(
          requestBody.email,
        );

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

      if (
        targetProfileError
      ) {
        throw targetProfileError;
      }

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

      const oldEmail =
        String(
          targetProfile.email,
        )
          .trim()
          .toLowerCase();

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

      if (
        duplicateProfileError
      ) {
        throw duplicateProfileError;
      }

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
