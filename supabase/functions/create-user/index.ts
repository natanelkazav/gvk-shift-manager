import {
  createClient,
  type User,
} from 'npm:@supabase/supabase-js@2';

interface CreateUserRequest {
  email: string;
  password: string;
  displayName: string;
  scheduleName?: string | null;
  role:
    | 'admin'
    | 'manager'
    | 'dispatcher'
    | 'on_call'
    | 'viewer';
  isActive?: boolean;
  mustChangePassword?: boolean;
}

interface ProfileDatabaseRow {
  id: string;
  email: string;
  display_name: string;
  schedule_name: string | null;
  role:
    | 'admin'
    | 'manager'
    | 'dispatcher'
    | 'on_call'
    | 'viewer';
  is_active: boolean;
  must_change_password: boolean;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

const allowedRoles = new Set<
  CreateUserRequest['role']
>([
  'admin',
  'manager',
  'dispatcher',
  'on_call',
  'viewer',
]);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods':
    'POST, OPTIONS',
  'Content-Type': 'application/json',
};

function createJsonResponse(
  body: unknown,
  status: number,
): Response {
  return new Response(
    JSON.stringify(body),
    {
      status,
      headers: corsHeaders,
    },
  );
}

function getRequiredEnvironmentVariable(
  variableName: string,
): string {
  const value =
    Deno.env.get(variableName);

  if (!value) {
    throw new Error(
      `Missing environment variable: ${variableName}`,
    );
  }

  return value;
}

function normalizeEmail(
  email: string,
): string {
  return email
    .trim()
    .toLowerCase();
}

function validateRequest(
  requestBody:
    Partial<CreateUserRequest>,
): string | null {
  const normalizedEmail =
    normalizeEmail(
      requestBody.email ?? '',
    );

  if (!normalizedEmail) {
    return 'יש להזין כתובת אימייל.';
  }

  if (
    !normalizedEmail.includes('@')
  ) {
    return 'כתובת האימייל אינה תקינה.';
  }

  if (!requestBody.password) {
    return 'יש להזין סיסמה זמנית.';
  }

  if (
    requestBody.password.length < 8
  ) {
    return 'הסיסמה חייבת להכיל לפחות שמונה תווים.';
  }

  if (
    !requestBody.displayName?.trim()
  ) {
    return 'יש להזין שם תצוגה.';
  }

  if (
    !requestBody.role ||
    !allowedRoles.has(
      requestBody.role,
    )
  ) {
    return 'תפקיד המשתמש אינו תקין.';
  }

  return null;
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
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );

  const {
    data: { user },
    error,
  } =
    await authenticationClient
      .auth
      .getUser(accessToken);

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
    request: Request,
  ) => {
    if (
      request.method === 'OPTIONS'
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
      request.method !== 'POST'
    ) {
      return createJsonResponse(
        {
          error:
            'Method not allowed.',
        },
        405,
      );
    }

    let createdAuthUserId:
      string | null = null;

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
  data: requestingProfile,
  error: requestingProfileError,
} = await adminClient
  .from('profiles')
  .select(`
    id,
    email,
    display_name,
    role,
    is_active
  `)
  .eq('id', authenticatedUser.id)
  .maybeSingle<{
    id: string;
    email: string;
    display_name: string;
    role: string;
    is_active: boolean;
  }>();

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
              'אין לך הרשאה ליצור משתמשים.',
          },
          403,
        );
      }

      let requestBody:
        Partial<CreateUserRequest>;

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

      const validationError =
        validateRequest(
          requestBody,
        );

      if (
        validationError
      ) {
        return createJsonResponse(
          {
            error:
              validationError,
          },
          400,
        );
      }

      const normalizedEmail =
        normalizeEmail(
          requestBody.email!,
        );

      const normalizedDisplayName =
        requestBody
          .displayName!
          .trim();

      const normalizedScheduleName =
        requestBody
          .scheduleName
          ?.trim() ||
        null;

      const {
        data:
          existingProfile,

        error:
          existingProfileError,
      } =
        await adminClient
          .from('profiles')
          .select('id')
          .eq(
            'email',
            normalizedEmail,
          )
          .maybeSingle<{
            id: string;
          }>();

      if (
        existingProfileError
      ) {
        throw new Error(
          'לא ניתן היה לבדוק אם המשתמש כבר קיים.',
        );
      }

      if (
        existingProfile
      ) {
        return createJsonResponse(
          {
            error:
              'כבר קיים משתמש עם כתובת האימייל הזאת.',
          },
          409,
        );
      }

      const {
        data:
          createUserData,

        error:
          createUserError,
      } =
        await adminClient
          .auth
          .admin
          .createUser({
            email:
              normalizedEmail,

            password:
              requestBody
                .password!,

            email_confirm:
              true,

            user_metadata: {
              display_name:
                normalizedDisplayName,
            },
          });

      if (
        createUserError ||
        !createUserData.user
      ) {
        const isExistingEmail =
          createUserError
            ?.message
            .toLowerCase()
            .includes(
              'already',
            );

        return createJsonResponse(
          {
            error:
              isExistingEmail
                ? 'כבר קיים משתמש עם כתובת האימייל הזאת.'
                : 'לא ניתן היה ליצור את חשבון המשתמש.',
          },
          isExistingEmail
            ? 409
            : 400,
        );
      }

      createdAuthUserId =
        createUserData.user.id;

      const now =
        new Date()
          .toISOString();

      const {
        data:
          createdProfile,

        error:
          createProfileError,
      } =
        await adminClient
          .from('profiles')
          .upsert(
            {
              id:
                createdAuthUserId,

              email:
                normalizedEmail,

              display_name:
                normalizedDisplayName,

              schedule_name:
                normalizedScheduleName,

              role:
                requestBody.role!,

              is_active:
                requestBody
                  .isActive ??
                true,

              must_change_password:
                requestBody
                  .mustChangePassword ??
                true,

              last_login_at:
                null,

              updated_at:
                now,
            },
            {
              onConflict:
                'id',
            },
          )
          .select(`
            id,
            email,
            display_name,
            schedule_name,
            role,
            is_active,
            must_change_password,
            last_login_at,
            created_at,
            updated_at
          `)
          .single<
            ProfileDatabaseRow
          >();

      if (
        createProfileError ||
        !createdProfile
      ) {
        console.error(
          'CREATE PROFILE ERROR:',
          createProfileError,
        );

        await adminClient
          .auth
          .admin
          .deleteUser(
            createdAuthUserId,
          );

        createdAuthUserId =
          null;

        throw new Error(
          'חשבון ההתחברות נוצר, אך יצירת פרופיל המשתמש נכשלה.',
        );
      }

const {
  error: auditLogError,
} = await adminClient
  .from('audit_logs')
  .insert({
    action: 'user_created',

    actor_user_id:
      requestingProfile.id,

    actor_email:
      requestingProfile.email,

    actor_display_name:
      requestingProfile.display_name,

    target_user_id:
      createdProfile.id,

    target_email:
      createdProfile.email,

    target_display_name:
      createdProfile.display_name,

    entity_type: 'user',

    summary:
      `נוצר משתמש חדש: ${createdProfile.display_name}`,

    old_values: null,

    new_values: {
      email:
        createdProfile.email,

      display_name:
        createdProfile.display_name,

      schedule_name:
        createdProfile.schedule_name,

      role:
        createdProfile.role,

      is_active:
        createdProfile.is_active,

      must_change_password:
        createdProfile
          .must_change_password,
    },

    metadata: {
      source:
        'create-user-edge-function',
    },
  });

if (auditLogError) {
  console.error(
    'CREATE USER AUDIT LOG ERROR:',
    auditLogError,
  );

  // כשל ביומן אינו מבטל יצירת משתמש.
}

      return createJsonResponse(
        {
          user: {
            id:
              createdProfile.id,

            email:
              createdProfile.email,

            displayName:
              createdProfile
                .display_name,

            scheduleName:
              createdProfile
                .schedule_name,

            role:
              createdProfile.role,

            isActive:
              createdProfile
                .is_active,

            mustChangePassword:
              createdProfile
                .must_change_password,

            lastLoginAt:
              createdProfile
                .last_login_at,

            createdAt:
              createdProfile
                .created_at,

            updatedAt:
              createdProfile
                .updated_at,
          },
        },
        201,
      );
    } catch (error) {
      return createJsonResponse(
        {
          error:
            error instanceof Error
              ? error.message
              : 'אירעה שגיאה בלתי צפויה ביצירת המשתמש.',
        },
        500,
      );
    }
  },
);