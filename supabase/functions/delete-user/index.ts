/**
 * קובץ: supabase/functions/delete-user/index.ts
 * מטרה: טיפול בבקשות HTTP לפעולת השרת delete-user.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: DeleteUserRequest, ProfileDatabaseRow, RequestingProfileRow, PermissionRow, createJsonResponse, getRequiredEnvironmentVariable, isValidUuid, normalizeReason, validateRequest, getAuthenticatedUser.
 * - מקורות נתונים הנזכרים בקריאות from: profiles, user_permissions, audit_logs.
 * - ריכוז ההגדרות והלוגיקה המפורטות בהמשך הקובץ.
 */
import {
  createClient,
  type User,
} from 'npm:@supabase/supabase-js@2';

/**
 * חוזה הנתונים DeleteUserRequest: משתמש / נתוני הבקשה.
 */
interface DeleteUserRequest {
  // userId — מזהה משתמש.
  userId: string;
  reason?: string | null;
}

/**
 * חוזה הנתונים ProfileDatabaseRow: פרופיל / שורה.
 */
interface ProfileDatabaseRow {
  // id — מזהה.
  id: string;
  // email — כתובת דוא״ל.
  email: string;
  // display_name — שם תצוגה.
  display_name: string;
  // schedule_name — שיבוץ / שם.
  schedule_name: string | null;
  role:
    | 'admin'
    | 'manager'
    | 'dispatcher'
    | 'on_call'
    | 'viewer';
  // is_active — האם הרשומה פעילה.
  is_active: boolean;
  // must_change_password — סיסמה.
  must_change_password: boolean;
  last_login_at: string | null;
  // created_at — מועד יצירה.
  created_at: string;
  // updated_at — מועד עדכון.
  updated_at: string;
}

/**
 * חוזה הנתונים RequestingProfileRow: פרופיל / שורה.
 */
interface RequestingProfileRow {
  // id — מזהה.
  id: string;
  // email — כתובת דוא״ל.
  email: string;
  // display_name — שם תצוגה.
  display_name: string;
  role: string;
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
  'Access-Control-Allow-Origin': '*',

  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',

  'Access-Control-Allow-Methods':
    'POST, OPTIONS',

  'Content-Type': 'application/json',
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
    JSON.stringify(body),
    {
      status,
      headers: corsHeaders,
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
    Deno.env.get(variableName);

  // עצירת הפעולה עם שגיאה כאשר !value.
  if (!value) {
    throw new Error(
      `Missing environment variable: ${variableName}`,
    );
  }

  return value;
}

/**
 * פעולה isValidUuid: בדיקת תנאי עבור הנתון isValidUuid בהקשר הפעולה.
 * @param value — ערך.
 * @returns boolean — הפלט בהתאם לחתימה.
 */
function isValidUuid(
  value: string,
): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    .test(value);
}

/**
 * פעולה normalizeReason: נרמול הנתון normalizeReason בהקשר הפעולה.
 * @param reason — הנתון reason בהקשר הפעולה.
 * @returns string | null — הפלט בהתאם לחתימה.
 */
function normalizeReason(
  reason: string | null | undefined,
): string | null {
  // normalizedReason — הנתון normalizedReason בהקשר הפעולה.
  const normalizedReason =
    reason?.trim() ?? '';

  return normalizedReason || null;
}

/**
 * פעולה validateRequest: בדיקת תקינות של נתוני הבקשה.
 * @param requestBody — נתוני הבקשה / תוכן.
 * @returns string | null — הפלט בהתאם לחתימה.
 */
function validateRequest(
  requestBody:
    Partial<DeleteUserRequest>,
): string | null {
  // userId — מזהה משתמש.
  const userId =
    requestBody.userId?.trim() ?? '';

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !userId.
  if (!userId) {
    return 'לא התקבל מזהה משתמש למחיקה.';
  }

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !isValidUuid(userId).
  if (!isValidUuid(userId)) {
    return 'מזהה המשתמש למחיקה אינו תקין.';
  }

  const reason =
    normalizeReason(
      requestBody.reason,
    );

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר reason && reason.length > 500.
  if (
    reason &&
    reason.length > 500
  ) {
    return 'סיבת המחיקה יכולה להכיל עד 500 תווים.';
  }

  return null;
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
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );

  // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
  const {
    data: { user },
    error,
  } =
    await authenticationClient
      .auth
      .getUser(accessToken);

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
    request: Request,
  ) => {
    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר request.method === 'OPTIONS'.
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

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר request.method !== 'POST'.
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

      const authorizationHeader =
        request.headers.get(
          'Authorization',
        );

      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !authorizationHeader.
      if (!authorizationHeader) {
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
      if (!authenticatedUser) {
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

      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !requestingProfile.is_active.
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

      // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
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

      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר permissionError || !managementPermission.
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

      // requestBody — נתוני הבקשה / תוכן.
      let requestBody:
        Partial<DeleteUserRequest>;

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

      // validationError — אימות נתונים / שגיאה.
      const validationError =
        validateRequest(
          requestBody,
        );

      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר validationError.
      if (validationError) {
        return createJsonResponse(
          {
            error:
              validationError,
          },
          400,
        );
      }

      // targetUserId — מזהה משתמש היעד.
      const targetUserId =
        requestBody.userId!.trim();

      const deletionReason =
        normalizeReason(
          requestBody.reason,
        );

      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר targetUserId === authenticatedUser.id.
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

      // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
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

      // עצירת הפעולה עם שגיאה כאשר targetProfileError.
      if (targetProfileError) {
        console.error(
          'GET DELETE TARGET ERROR:',
          targetProfileError,
        );

        throw new Error(
          'לא ניתן היה לטעון את המשתמש המיועד למחיקה.',
        );
      }

      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !targetProfile.
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
        // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
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

        // עצירת הפעולה עם שגיאה כאשר activeAdminCountError.
        if (activeAdminCountError) {
          console.error(
            'COUNT ACTIVE ADMINS ERROR:',
            activeAdminCountError,
          );

          throw new Error(
            'לא ניתן היה לבדוק את מספר מנהלי המערכת הפעילים.',
          );
        }

        // טיפול במקרה מיוחד ויציאה מוקדמת כאשר targetProfile.is_active && ( activeAdminCount ?? 0 ) <= 1.
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

      // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
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

      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר targetAuthUserError || !targetAuthUser.user.
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

      // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
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

      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר deleteAuthUserError.
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
      // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
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
      // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
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