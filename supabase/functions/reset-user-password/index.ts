import {
  createClient,
  type User,
} from 'npm:@supabase/supabase-js@2';

interface ResetUserPasswordRequest {
  userId: string;
}

interface RequestingProfile {
  id: string;
  email: string;
  display_name: string;
  role: string;
  is_active: boolean;
}

interface TargetProfile {
  id: string;
  email: string;
  display_name: string;
  must_change_password: boolean;
}

const TEMPORARY_PASSWORD =
  '12345678';

const corsHeaders = {
  'Access-Control-Allow-Origin':
    '*',

  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',

  'Access-Control-Allow-Methods':
    'POST, OPTIONS',

  'Content-Type':
    'application/json',
};

function createJsonResponse(
  body: unknown,
  status: number,
): Response {
  return new Response(
    JSON.stringify(
      body,
    ),
    {
      status,
      headers:
        corsHeaders,
    },
  );
}

function getRequiredEnvironmentVariable(
  variableName: string,
): string {
  const value =
    Deno.env.get(
      variableName,
    );

  if (!value) {
    throw new Error(
      `Missing environment variable: ${variableName}`,
    );
  }

  return value;
}

async function getAuthenticatedUser(
  authorizationHeader: string,
  supabaseUrl: string,
  publishableKey: string,
): Promise<User | null> {
  const accessToken =
    authorizationHeader.replace(
      /^Bearer\s+/i,
      '',
    );

  if (!accessToken) {
    return null;
  }

  const authenticationClient =
    createClient(
      supabaseUrl,
      publishableKey,
      {
        auth: {
          autoRefreshToken:
            false,

          persistSession:
            false,
        },
      },
    );

  const {
    data: {
      user,
    },

    error,
  } =
    await authenticationClient
      .auth
      .getUser(
        accessToken,
      );

  if (
    error ||
    !user
  ) {
    return null;
  }

  return user;
}

Deno.serve(
  async (
    request:
      Request,
  ) => {
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

      const publishableKey =
        Deno.env.get(
          'SUPABASE_ANON_KEY',
        ) ??
        Deno.env.get(
          'SUPABASE_PUBLISHABLE_KEY',
        );

      if (!publishableKey) {
        throw new Error(
          'Missing Supabase public API key.',
        );
      }

      const serviceRoleKey =
        getRequiredEnvironmentVariable(
          'SUPABASE_SERVICE_ROLE_KEY',
        );

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
              'לא התקבלה הרשאת משתמש.',
          },
          401,
        );
      }

      const authenticatedUser =
        await getAuthenticatedUser(
          authorizationHeader,
          supabaseUrl,
          publishableKey,
        );

      if (
        !authenticatedUser
      ) {
        return createJsonResponse(
          {
            error:
              'ההתחברות אינה תקפה או שפג תוקפה.',
          },
          401,
        );
      }

      const adminClient =
        createClient(
          supabaseUrl,
          serviceRoleKey,
          {
            auth: {
              autoRefreshToken:
                false,

              persistSession:
                false,
            },
          },
        );

      const {
        data:
          requestingProfile,

        error:
          requestingProfileError,
      } =
        await adminClient
          .from(
            'profiles',
          )
          .select(`
            id,
            email,
            display_name,
            role,
            is_active
          `)
          .eq(
            'id',
            authenticatedUser.id,
          )
          .maybeSingle<
            RequestingProfile
          >();

      if (
        requestingProfileError ||
        !requestingProfile
      ) {
        return createJsonResponse(
          {
            error:
              'לא נמצא פרופיל עבור המשתמש המחובר.',
          },
          403,
        );
      }

      if (
        requestingProfile.role !==
          'admin' ||
        !requestingProfile
          .is_active
      ) {
        return createJsonResponse(
          {
            error:
              'אין לך הרשאה לאפס סיסמאות של משתמשים.',
          },
          403,
        );
      }

      let requestBody:
        Partial<
          ResetUserPasswordRequest
        >;

      try {
        requestBody =
          await request.json();
      } catch {
        return createJsonResponse(
          {
            error:
              'גוף הבקשה אינו תקין.',
          },
          400,
        );
      }

      const targetUserId =
        requestBody.userId
          ?.trim() ??
        '';

      if (!targetUserId) {
        return createJsonResponse(
          {
            error:
              'לא התקבל מזהה משתמש לאיפוס הסיסמה.',
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
          .select(`
            id,
            email,
            display_name,
            must_change_password
          `)
          .eq(
            'id',
            targetUserId,
          )
          .maybeSingle<
            TargetProfile
          >();

      if (
        targetProfileError
      ) {
        throw new Error(
          'לא ניתן היה לטעון את פרטי המשתמש.',
        );
      }

      if (
        !targetProfile
      ) {
        return createJsonResponse(
          {
            error:
              'המשתמש שנבחר לא נמצא.',
          },
          404,
        );
      }

      const previousMustChangePassword =
        targetProfile
          .must_change_password;

      const {
        error:
          profileUpdateError,
      } =
        await adminClient
          .from(
            'profiles',
          )
          .update({
            must_change_password:
              true,

            updated_at:
              new Date()
                .toISOString(),
          })
          .eq(
            'id',
            targetUserId,
          );

      if (
        profileUpdateError
      ) {
        throw new Error(
          'לא ניתן היה לסמן שהמשתמש חייב להחליף סיסמה.',
        );
      }

      const {
        error:
          passwordUpdateError,
      } =
        await adminClient
          .auth
          .admin
          .updateUserById(
            targetUserId,
            {
              password:
                TEMPORARY_PASSWORD,
            },
          );

      if (
        passwordUpdateError
      ) {
        const {
          error:
            rollbackError,
        } =
          await adminClient
            .from(
              'profiles',
            )
            .update({
              must_change_password:
                previousMustChangePassword,

              updated_at:
                new Date()
                  .toISOString(),
            })
            .eq(
              'id',
              targetUserId,
            );

        if (
          rollbackError
        ) {
          console.error(
            'RESET PASSWORD PROFILE ROLLBACK ERROR:',
            rollbackError,
          );
        }

        return createJsonResponse(
          {
            error:
              'לא ניתן היה לאפס את סיסמת המשתמש.',
          },
          400,
        );
      }

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
              'user_password_reset',

            actor_user_id:
              requestingProfile.id,

            actor_email:
              requestingProfile.email,

            actor_display_name:
              requestingProfile
                .display_name,

            target_user_id:
              targetProfile.id,

            target_email:
              targetProfile.email,

            target_display_name:
              targetProfile
                .display_name,

            entity_type:
              'user',

            summary:
              `אופסה הסיסמה של ${targetProfile.display_name}`,

            old_values: {
              must_change_password:
                previousMustChangePassword,
            },

            new_values: {
              must_change_password:
                true,
            },

            metadata: {
              source:
                'reset-user-password-edge-function',

              temporary_password:
                false,
            },
          });

      const auditLogged =
        !auditLogError;

      if (
        auditLogError
      ) {
        console.error(
          'RESET PASSWORD AUDIT LOG ERROR:',
          auditLogError,
        );
      }

      return createJsonResponse(
        {
          success:
            true,

          temporaryPassword:
            TEMPORARY_PASSWORD,

          user: {
            userId:
              targetProfile.id,

            email:
              targetProfile.email,

            displayName:
              targetProfile
                .display_name,

            mustChangePassword:
              true,
          },

          auditLogged,
        },
        200,
      );
    } catch (
      error
    ) {
      console.error(
        'RESET USER PASSWORD ERROR:',
        error,
      );

      return createJsonResponse(
        {
          error:
            error instanceof Error
              ? error.message
              : 'אירעה שגיאה בלתי צפויה באיפוס הסיסמה.',
        },
        500,
      );
    }
  },
);