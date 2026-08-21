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
  is_active: boolean;
}

interface TargetProfile {
  id: string;
  email: string;
  display_name: string;
  is_active: boolean;
}

interface PermissionRow {
  permission_key: string;
}

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
    )?.trim();

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

      const passwordResetRedirectUrl =
        getRequiredEnvironmentVariable(
          'PASSWORD_RESET_REDIRECT_URL',
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
        !requestingProfile
          .is_active
      ) {
        return createJsonResponse(
          {
            error:
              'המשתמש המחובר אינו פעיל.',
          },
          403,
        );
      }

      const {
        data:
          managementPermission,
        error:
          permissionError,
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
            requestingProfile.id,
          )
          .eq(
            'permission_key',
            'users.manage',
          )
          .maybeSingle<
            PermissionRow
          >();

      if (
        permissionError ||
        !managementPermission
      ) {
        return createJsonResponse(
          {
            error:
              'אין לך הרשאה לשלוח קישורי איפוס סיסמה.',
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
            is_active
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

      if (
        !targetProfile
          .is_active
      ) {
        return createJsonResponse(
          {
            error:
              'לא ניתן לשלוח קישור איפוס למשתמש שאינו פעיל.',
          },
          400,
        );
      }

      const recoveryClient =
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
        error:
          recoveryError,
      } =
        await recoveryClient
          .auth
          .resetPasswordForEmail(
            targetProfile.email,
            {
              redirectTo:
                passwordResetRedirectUrl,
            },
          );

      if (
        recoveryError
      ) {
        console.error(
          'SEND PASSWORD RECOVERY EMAIL ERROR:',
          recoveryError,
        );

        return createJsonResponse(
          {
            error:
              'לא ניתן היה לשלוח את קישור איפוס הסיסמה. נסה שוב מאוחר יותר.',
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
              `נשלח קישור איפוס סיסמה ל${targetProfile.display_name}`,

            old_values:
              null,

            new_values:
              null,

            metadata: {
              source:
                'reset-user-password-edge-function',

              mode:
                'recovery_email',

              redirect_url:
                passwordResetRedirectUrl,
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

          user: {
            userId:
              targetProfile.id,

            email:
              targetProfile.email,

            displayName:
              targetProfile
                .display_name,

            emailSent:
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
              : 'אירעה שגיאה בלתי צפויה בשליחת קישור איפוס הסיסמה.',
        },
        500,
      );
    }
  },
);
