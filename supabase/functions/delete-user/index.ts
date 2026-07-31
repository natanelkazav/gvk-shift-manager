import {
  createClient,
  type User,
} from 'npm:@supabase/supabase-js@2';

interface DeleteUserRequest {
  userId: string;
  reason?: string | null;
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

interface RequestingProfileRow {
  id: string;
  email: string;
  display_name: string;
  role: string;
  is_active: boolean;
}

interface PermissionRow {
  permission_key: string;
}

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

function isValidUuid(
  value: string,
): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    .test(value);
}

function normalizeReason(
  reason: string | null | undefined,
): string | null {
  const normalizedReason =
    reason?.trim() ?? '';

  return normalizedReason || null;
}

function validateRequest(
  requestBody:
    Partial<DeleteUserRequest>,
): string | null {
  const userId =
    requestBody.userId?.trim() ?? '';

  if (!userId) {
    return 'לא התקבל מזהה משתמש למחיקה.';
  }

  if (!isValidUuid(userId)) {
    return 'מזהה המשתמש למחיקה אינו תקין.';
  }

  const reason =
    normalizeReason(
      requestBody.reason,
    );

  if (
    reason &&
    reason.length > 500
  ) {
    return 'סיבת המחיקה יכולה להכיל עד 500 תווים.';
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
          headers: corsHeaders,
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

      if (!authorizationHeader) {
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

      if (!authenticatedUser) {
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
        .eq(
          'id',
          authenticatedUser.id,
        )
        .maybeSingle<
          RequestingProfileRow
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
        !requestingProfile.is_active
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
        data: managementPermission,
        error: permissionError,
      } = await adminClient
        .from('user_permissions')
        .select('permission_key')
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
              'אין לך הרשאה למחוק משתמשים.',
          },
          403,
        );
      }

      let requestBody:
        Partial<DeleteUserRequest>;

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

      if (validationError) {
        return createJsonResponse(
          {
            error:
              validationError,
          },
          400,
        );
      }

      const targetUserId =
        requestBody.userId!.trim();

      const deletionReason =
        normalizeReason(
          requestBody.reason,
        );

      if (
        targetUserId ===
        authenticatedUser.id
      ) {
        return createJsonResponse(
          {
            error:
              'לא ניתן למחוק את המשתמש המחובר כעת.',
          },
          400,
        );
      }

      const {
        data: targetProfile,
        error: targetProfileError,
      } = await adminClient
        .from('profiles')
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
        .eq(
          'id',
          targetUserId,
        )
        .maybeSingle<
          ProfileDatabaseRow
        >();

      if (targetProfileError) {
        console.error(
          'GET DELETE TARGET ERROR:',
          targetProfileError,
        );

        throw new Error(
          'לא ניתן היה לטעון את המשתמש המיועד למחיקה.',
        );
      }

      if (!targetProfile) {
        return createJsonResponse(
          {
            error:
              'המשתמש המיועד למחיקה אינו קיים.',
          },
          404,
        );
      }

      if (
        targetProfile.role ===
        'admin'
      ) {
        const {
          count: activeAdminCount,
          error: activeAdminCountError,
        } = await adminClient
          .from('profiles')
          .select(
            'id',
            {
              count: 'exact',
              head: true,
            },
          )
          .eq(
            'role',
            'admin',
          )
          .eq(
            'is_active',
            true,
          );

        if (activeAdminCountError) {
          console.error(
            'COUNT ACTIVE ADMINS ERROR:',
            activeAdminCountError,
          );

          throw new Error(
            'לא ניתן היה לבדוק את מספר מנהלי המערכת הפעילים.',
          );
        }

        if (
          targetProfile.is_active &&
          (
            activeAdminCount ??
            0
          ) <= 1
        ) {
          return createJsonResponse(
            {
              error:
                'לא ניתן למחוק את מנהל המערכת הפעיל האחרון.',
            },
            400,
          );
        }
      }

      const {
        data: targetAuthUser,
        error: targetAuthUserError,
      } =
        await adminClient
          .auth
          .admin
          .getUserById(
            targetUserId,
          );

      if (
        targetAuthUserError ||
        !targetAuthUser.user
      ) {
        console.error(
          'GET AUTH USER BEFORE DELETE ERROR:',
          targetAuthUserError,
        );

        return createJsonResponse(
          {
            error:
              'חשבון ההתחברות של המשתמש אינו קיים או שאינו תקין.',
          },
          404,
        );
      }

      const {
        error: deleteAuthUserError,
      } =
        await adminClient
          .auth
          .admin
          .deleteUser(
            targetUserId,
            false,
          );

      if (deleteAuthUserError) {
        console.error(
          'DELETE AUTH USER ERROR:',
          deleteAuthUserError,
        );

        return createJsonResponse(
          {
            error:
              'לא ניתן היה למחוק את חשבון המשתמש.',
          },
          500,
        );
      }

      /*
       * אם profiles מוגדרת עם
       * ON DELETE CASCADE, הרשומה כבר
       * נמחקה. אם לא, הקריאה הבאה
       * מנקה אותה ידנית.
       */
      const {
        error: profileCleanupError,
      } = await adminClient
        .from('profiles')
        .delete()
        .eq(
          'id',
          targetUserId,
        );

      if (profileCleanupError) {
        console.error(
          'DELETE PROFILE CLEANUP ERROR:',
          profileCleanupError,
        );
      }

      /*
       * ה-Audit נכתב לאחר שהמחיקה
       * הצליחה. target_user_id נשאר
       * null כדי לא להפר את ה-FK לאחר
       * מחיקת הפרופיל. המזהה המקורי
       * נשמר בתוך metadata.
       */
      const {
        error: auditLogError,
      } = await adminClient
        .from('audit_logs')
        .insert({
          action:
            'user_deleted',

          actor_user_id:
            requestingProfile.id,

          actor_email:
            requestingProfile.email,

          actor_display_name:
            requestingProfile
              .display_name,

          target_user_id:
            null,

          target_email:
            targetProfile.email,

          target_display_name:
            targetProfile
              .display_name,

          entity_type:
            'user',

          summary:
            `נמחק המשתמש: ${targetProfile.display_name}`,

          old_values: {
            id:
              targetProfile.id,

            email:
              targetProfile.email,

            display_name:
              targetProfile
                .display_name,

            schedule_name:
              targetProfile
                .schedule_name,

            role:
              targetProfile.role,

            is_active:
              targetProfile
                .is_active,

            must_change_password:
              targetProfile
                .must_change_password,

            last_login_at:
              targetProfile
                .last_login_at,

            created_at:
              targetProfile
                .created_at,
          },

          new_values:
            null,

          metadata: {
            source:
              'delete-user-edge-function',

            deleted_user_id:
              targetProfile.id,

            reason:
              deletionReason,
          },
        });

      if (auditLogError) {
        console.error(
          'DELETE USER AUDIT LOG ERROR:',
          auditLogError,
        );
      }

      return createJsonResponse(
        {
          success: true,

          deletedUser: {
            id:
              targetProfile.id,

            email:
              targetProfile.email,

            displayName:
              targetProfile
                .display_name,
          },

          auditLogged:
            !auditLogError,
        },
        200,
      );
    } catch (error) {
      console.error(
        'DELETE USER UNEXPECTED ERROR:',
        error,
      );

      return createJsonResponse(
        {
          error:
            error instanceof Error
              ? error.message
              : 'אירעה שגיאה בלתי צפויה במחיקת המשתמש.',
        },
        500,
      );
    }
  },
);