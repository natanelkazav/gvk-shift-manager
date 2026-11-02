/**
 * קובץ: supabase/functions/reset-user-password/index.ts
 * מטרה: טיפול בבקשות HTTP לפעולת השרת reset-user-password.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: ResetUserPasswordRequest, RequestingProfile, TargetProfile, PermissionRow, createJsonResponse, getRequiredEnvironmentVariable, getAuthenticatedUser.
 * - מקורות נתונים הנזכרים בקריאות from: profiles, user_permissions, audit_logs.
 * - ריכוז ההגדרות והלוגיקה המפורטות בהמשך הקובץ.
 */
import {
  createClient,
  type User,
} from 'npm:@supabase/supabase-js@2';

/**
 * חוזה הנתונים ResetUserPasswordRequest: משתמש / סיסמה / נתוני הבקשה.
 */
interface ResetUserPasswordRequest {
  // userId — מזהה משתמש.
  userId: string;
}

/**
 * חוזה הנתונים RequestingProfile: פרופיל.
 */
interface RequestingProfile {
  // id — מזהה.
  id: string;
  // email — כתובת דוא״ל.
  email: string;
  // display_name — שם תצוגה.
  display_name: string;
  // is_active — האם הרשומה פעילה.
  is_active: boolean;
}

/**
 * חוזה הנתונים TargetProfile: יעד / פרופיל.
 */
interface TargetProfile {
  // id — מזהה.
  id: string;
  // email — כתובת דוא״ל.
  email: string;
  // display_name — שם תצוגה.
  display_name: string;
  // is_active — האם הרשומה פעילה.
  is_active: boolean;
}

/**
 * חוזה הנתונים PermissionRow: הרשאות / שורה.
 */
interface PermissionRow {
  // permission_key — מפתח ההרשאה.
  permission_key: string;
}

// corsHeaders — הנתון corsHeaders בהקשר הפעולה.
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

/**
 * פעולה createJsonResponse: יצירת תוצאת הפעולה.
 * @param body — תוכן.
 * @param status — סטטוס.
 * @returns Response — הפלט בהתאם לחתימה.
 */
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

/**
 * פעולה getRequiredEnvironmentVariable: שליפה או חישוב של הנתון getRequiredEnvironmentVariable בהקשר הפעולה.
 * @param variableName — שם.
 * @returns string — הפלט בהתאם לחתימה.
 */
function getRequiredEnvironmentVariable(
  variableName: string,
): string {
  // value — ערך.
  const value =
    Deno.env.get(
      variableName,
    )?.trim();

  // עצירת הפעולה עם שגיאה כאשר !value.
  if (!value) {
    throw new Error(
      `Missing environment variable: ${variableName}`,
    );
  }

  return value;
}

/**
 * פעולה אסינכרונית getAuthenticatedUser: שליפה או חישוב של משתמש.
 * @param authorizationHeader — הנתון authorizationHeader בהקשר הפעולה.
 * @param supabaseUrl — כתובת יעד.
 * @param publishableKey — מפתח.
 * @returns Promise<User | null> — הפלט בהתאם לחתימה.
 */
async function getAuthenticatedUser(
  authorizationHeader: string,
  supabaseUrl: string,
  publishableKey: string,
): Promise<User | null> {
  // accessToken — אסימון גישה.
  const accessToken =
    authorizationHeader.replace(
      /^Bearer\s+/i,
      '',
    );

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !accessToken.
  if (!accessToken) {
    return null;
  }

  // authenticationClient — אימות משתמשים / לקוח.
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

  // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
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

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר error || !user.
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

      // publishableKey — מפתח.
      const publishableKey =
        Deno.env.get(
          'SUPABASE_ANON_KEY',
        ) ??
        Deno.env.get(
          'SUPABASE_PUBLISHABLE_KEY',
        );

      // עצירת הפעולה עם שגיאה כאשר !publishableKey.
      if (!publishableKey) {
        throw new Error(
          'Missing Supabase public API key.',
        );
      }

      // serviceRoleKey — שירות / מפתח.
      const serviceRoleKey =
        getRequiredEnvironmentVariable(
          'SUPABASE_SERVICE_ROLE_KEY',
        );

      // passwordResetRedirectUrl — סיסמה / כתובת יעד.
      const passwordResetRedirectUrl =
        getRequiredEnvironmentVariable(
          'PASSWORD_RESET_REDIRECT_URL',
        );

      const authorizationHeader =
        request.headers.get(
          'Authorization',
        );

      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !authorizationHeader.
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

      // authenticatedUser — משתמש.
      const authenticatedUser =
        await getAuthenticatedUser(
          authorizationHeader,
          supabaseUrl,
          publishableKey,
        );

      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !authenticatedUser.
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

      // adminClient — לקוח.
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

      // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
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

      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר requestingProfileError || !requestingProfile.
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

      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !requestingProfile .is_active.
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

      // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
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

      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר permissionError || !managementPermission.
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

      // requestBody — נתוני הבקשה / תוכן.
      let requestBody:
        Partial<
          ResetUserPasswordRequest
        >;

      // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
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

      // targetUserId — מזהה משתמש היעד.
      const targetUserId =
        requestBody.userId
          ?.trim() ??
        '';

      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !targetUserId.
      if (!targetUserId) {
        return createJsonResponse(
          {
            error:
              'לא התקבל מזהה משתמש לאיפוס הסיסמה.',
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

      // עצירת הפעולה עם שגיאה כאשר targetProfileError.
      if (
        targetProfileError
      ) {
        throw new Error(
          'לא ניתן היה לטעון את פרטי המשתמש.',
        );
      }

      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !targetProfile.
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

      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !targetProfile .is_active.
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

      // recoveryClient — לקוח.
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

      // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
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

      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר recoveryError.
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

      // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
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

      // auditLogged — יומן שינויים.
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
