/**
 * קובץ: supabase/functions/send-notification/services/permissionService.ts
 * מטרה: אימות זהות המבקש ובדיקת הרשאה לפני פעולות שירות ההתראות בצד השרת.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: PermissionServiceConfiguration, AuthenticatedUserResult, ShiftSwapNotificationAuthorizationRow, isAuthorizedInternalReminderDelivery, createUserClient, createAdminClient, getAuthenticatedUserId, validateActiveProfile, hasPermission, validateShiftSwapWorkflowNotification ועוד.
 * - קריאות RPC המופעלות בקובץ: has_dynamic_job_type_permission.
 * - מקורות נתונים הנזכרים בקריאות from: profiles, user_permissions, notifications.
 * - ריכוז הפנייה למקור הנתונים ועיבוד התשובה בהתאם לפונקציות להלן.
 */
import {
  createClient,
  type SupabaseClient,
} from 'npm:@supabase/supabase-js@2';

/**
 * חוזה הנתונים PermissionServiceConfiguration: הרשאות / שירות / תצורה.
 */
interface PermissionServiceConfiguration {
  // supabaseUrl — כתובת יעד.
  supabaseUrl: string;

  // supabaseAnonKey — מפתח.
  supabaseAnonKey: string;

  // serviceRoleKey — שירות / מפתח.
  serviceRoleKey: string;
}

/**
 * חוזה הנתונים AuthenticatedUserResult: משתמש / תוצאה.
 */
interface AuthenticatedUserResult {
  // userId — מזהה משתמש.
  userId: string;

  // adminClient — לקוח.
  adminClient:
    SupabaseClient;
}

/**
 * חוזה הנתונים ShiftSwapNotificationAuthorizationRow: החלפת משמרות.
 */
interface ShiftSwapNotificationAuthorizationRow {
  type?: unknown;

  // source — מקור (אופציונלי).
  source?: unknown;

  created_by?: unknown;

  // data — נתונים (אופציונלי).
  data?: unknown;
}
/**
 * פעולה isAuthorizedInternalReminderDelivery: השוואת סוד תזכורות ה־cron מהסביבה לערך הכותרת x-cron-secret.
 * @param request — נתוני הבקשה.
 * @returns boolean — הפלט בהתאם לחתימה.
 */
function isAuthorizedInternalReminderDelivery(
  request:
    Request,
): boolean {
  const expectedSecret =
    Deno.env.get(
      'SHIFT_REMINDER_CRON_SECRET',
    )?.trim();

  const providedSecret =
    request.headers.get(
      'x-cron-secret',
    )?.trim();

  return Boolean(
    expectedSecret &&
    providedSecret &&
    expectedSecret ===
      providedSecret
  );
}
/**
 * פעולה createUserClient: יצירת לקוח Supabase עם כותרת Authorization של המשתמש וללא שמירת סשן בצד השרת.
 * @param configuration — תצורה.
 * @param authorizationHeader — הנתון authorizationHeader בהקשר הפעולה.
 * @returns SupabaseClient — הפלט בהתאם לחתימה.
 */
function createUserClient(
  configuration:
    PermissionServiceConfiguration,

  authorizationHeader:
    string,
): SupabaseClient {
  return createClient(
    configuration.supabaseUrl,
    configuration.supabaseAnonKey,
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
}

/**
 * פעולה createAdminClient: יצירת לקוח צד שרת עם service-role key; בדיקות הסמכות של המבקש מטופלות בנפרד.
 * @param configuration — תצורה.
 * @returns SupabaseClient — הפלט בהתאם לחתימה.
 */
function createAdminClient(
  configuration:
    PermissionServiceConfiguration,
): SupabaseClient {
  return createClient(
    configuration.supabaseUrl,
    configuration.serviceRoleKey,
    {
      auth: {
        persistSession:
          false,

        autoRefreshToken:
          false,
      },
    },
  );
}

/**
 * פעולה אסינכרונית getAuthenticatedUserId: אימות המשתמש באמצעות auth.getUser ושליפת מזהה המשתמש מהתשובה.
 * @param userClient — משתמש / לקוח.
 * @returns Promise<string> — הפלט בהתאם לחתימה.
 */
async function getAuthenticatedUserId(
  userClient:
    SupabaseClient,
): Promise<string> {
  // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
  const {
    data,
    error,
  } =
    await userClient.auth
      .getUser();

  // עצירת הפעולה עם שגיאה כאשר error || !data.user.
  if (
    error ||
    !data.user
  ) {
    throw new Error(
      'ההתחברות אינה תקינה או שפג תוקפה.',
    );
  }

  return data.user.id;
}

/**
 * פעולה אסינכרונית validateActiveProfile: בדיקת תקינות של פעיל / פרופיל.
 * @param adminClient — לקוח.
 * @param userId — מזהה משתמש.
 * @returns Promise<void> — הפלט בהתאם לחתימה.
 */
async function validateActiveProfile(
  adminClient:
    SupabaseClient,

  userId:
    string,
): Promise<void> {
  // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
  const {
    data:
      profile,

    error,
  } =
    await adminClient
      .from(
        'profiles',
      )
      .select(
        'id, is_active',
      )
      .eq(
        'id',
        userId,
      )
      .maybeSingle();

  // עצירת הפעולה עם שגיאה כאשר error.
  if (
    error
  ) {
    throw error;
  }

  // עצירת הפעולה עם שגיאה כאשר !profile || !profile.is_active.
  if (
    !profile ||
    !profile.is_active
  ) {
    throw new Error(
      'המשתמש אינו פעיל.',
    );
  }
}

/**
 * פעולה אסינכרונית hasPermission: בדיקת קיום עבור הרשאות.
 * @param adminClient — לקוח.
 * @param userId — מזהה משתמש.
 * @param permissionKey — מפתח ההרשאה.
 * @returns Promise<boolean> — הפלט בהתאם לחתימה.
 */
async function hasPermission(
  adminClient:
    SupabaseClient,

  userId:
    string,

  permissionKey:
    string,
): Promise<boolean> {
  // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
  const {
    data:
      permission,

    error,
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
        userId,
      )
      .eq(
        'permission_key',
        permissionKey,
      )
      .maybeSingle();

  // עצירת הפעולה עם שגיאה כאשר error.
  if (
    error
  ) {
    throw error;
  }

  return Boolean(
    permission,
  );
}

/**
 * פעולה אסינכרונית validateShiftSwapWorkflowNotification: בדיקת תקינות של החלפת משמרות.
 * @param adminClient — לקוח.
 * @param userId — מזהה משתמש.
 * @param notificationId — התראות / מזהה.
 * @returns Promise<boolean> — הפלט בהתאם לחתימה.
 */
async function validateShiftSwapWorkflowNotification(
  adminClient:
    SupabaseClient,

  userId:
    string,

  notificationId:
    string,
): Promise<boolean> {
  // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
  const {
    data,
    error,
  } =
    await adminClient
      .from(
        'notifications',
      )
      .select(
        'type, source, created_by, data',
      )
      .eq(
        'id',
        notificationId,
      )
      .maybeSingle();

  // עצירת הפעולה עם שגיאה כאשר error.
  if (
    error
  ) {
    throw error;
  }

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !data.
  if (
    !data
  ) {
    return false;
  }

  // notification — התראות.
  const notification =
    data as
      ShiftSwapNotificationAuthorizationRow;

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר notification.type !== 'shift_swap' || notification.source !== 'shift_swap' || notification.created_by !== userId || typeof notification.data.
  if (
    notification.type !==
      'shift_swap' ||
    notification.source !==
      'shift_swap' ||
    notification.created_by !==
      userId ||
    typeof notification.data !==
      'object' ||
    notification.data ===
      null
  ) {
    return false;
  }

  const metadata =
    notification.data as
      Record<string, unknown>;

  return (
    metadata.workflow ===
      'shift_swap' &&
    metadata.actorUserId ===
      userId &&
    typeof metadata.shiftSwapRequestId ===
      'string' &&
    typeof metadata.event ===
      'string'
  );
}


/**
 * פעולה אסינכרונית validateScheduleEditWorkflowNotification: בדיקת תקינות של שיבוץ / תהליך עבודה / התראות.
 * @param adminClient — לקוח.
 * @param userId — מזהה משתמש.
 * @param notificationId — התראות / מזהה.
 * @returns Promise<boolean> — הפלט בהתאם לחתימה.
 */
async function validateScheduleEditWorkflowNotification(
  adminClient:
    SupabaseClient,

  userId:
    string,

  notificationId:
    string,
): Promise<boolean> {
  // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
  const {
    data,
    error,
  } =
    await adminClient
      .from(
        'notifications',
      )
      .select(
        'type, source, created_by, data',
      )
      .eq(
        'id',
        notificationId,
      )
      .maybeSingle();

  // עצירת הפעולה עם שגיאה כאשר error.
  if (error) {
    throw error;
  }

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !data.
  if (!data) {
    return false;
  }

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר data.type !== 'system' || data.source !== 'schedule_edit' || data.created_by !== userId || typeof data.data !== 'object' || data.data === nu.
  if (
    data.type !==
      'system' ||
    data.source !==
      'schedule_edit' ||
    data.created_by !==
      userId ||
    typeof data.data !==
      'object' ||
    data.data ===
      null
  ) {
    return false;
  }

  const metadata =
    data.data as
      Record<string, unknown>;

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר metadata.workflow !== 'schedule_edit' || metadata.actorUserId !== userId || metadata.event !== 'assignment_changed' || typeof metadata.shift.
  if (
    metadata.workflow !==
      'schedule_edit' ||
    metadata.actorUserId !==
      userId ||
    metadata.event !==
      'assignment_changed' ||
    typeof metadata.shiftId !==
      'string'
  ) {
    return false;
  }

  const category =
    metadata.category;

  // permissionKey — מפתח ההרשאה.
  const permissionKey =
    category ===
      'on_call'
      ? 'driver_schedule.edit'
      : category ===
          'morning_driver'
        ? 'morning_driver_schedule.edit'
        : 'schedule.edit';

  return hasPermission(
    adminClient,
    userId,
    permissionKey,
  );
}


/**
 * פעולה אסינכרונית validateDailyReportNotification: בדיקת תקינות של דוחות פעילות יומיים.
 * @param adminClient — לקוח.
 * @param userId — מזהה משתמש.
 * @param notificationId — התראות / מזהה.
 * @returns Promise<boolean> — הפלט בהתאם לחתימה.
 */
async function validateDailyReportNotification(
  adminClient: SupabaseClient,
  userId: string,
  notificationId: string,
): Promise<boolean> {
  // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
  const { data, error } = await adminClient
    .from('notifications')
    .select('type, source, created_by, data')
    .eq('id', notificationId)
    .maybeSingle();
  if (error) throw error;
  if (!data || data.type !== 'manager_message' || data.source !== 'daily_report' || data.created_by !== userId) return false;
  const metadata = data.data as Record<string, unknown> | null;
  return Boolean(metadata && metadata.workflow === 'daily_report' && metadata.event === 'submitted' && metadata.actorUserId === userId && typeof metadata.reportId === 'string');
}

/**
 * פעולה אסינכרונית validateDynamicSchedulePublicationNotification: בדיקת תקינות של דינמי / שיבוץ / התראות.
 * הפעולה פונה ל־RPC: has_dynamic_job_type_permission.
 * @param adminClient — לקוח.
 * @param userId — מזהה משתמש.
 * @param notificationId — התראות / מזהה.
 * @returns Promise<boolean> — הפלט בהתאם לחתימה.
 */
async function validateDynamicSchedulePublicationNotification(
  adminClient: SupabaseClient,
  userId: string,
  notificationId: string,
): Promise<boolean> {
  // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
  const { data, error } = await adminClient
    .from('notifications')
    .select('type, source, created_by, data')
    .eq('id', notificationId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return false;

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר data.type !== 'schedule_published' || data.source !== 'dynamic_schedule_publish' || data.created_by !== userId || typeof data.data !== 'obje.
  if (
    data.type !== 'schedule_published' ||
    data.source !== 'dynamic_schedule_publish' ||
    data.created_by !== userId ||
    typeof data.data !== 'object' ||
    data.data === null
  ) {
    return false;
  }

  const metadata = data.data as Record<string, unknown>;
  // jobTypeId — מזהה סוג התפקיד.
  const jobTypeId = metadata.jobTypeId;
  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר metadata.workflow !== 'dynamic_schedule' || metadata.event !== 'publication_published' || typeof jobTypeId !== 'string'.
  if (
    metadata.workflow !== 'dynamic_schedule' ||
    metadata.event !== 'publication_published' ||
    typeof jobTypeId !== 'string'
  ) {
    return false;
  }

  // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
  const { data: allowed, error: permissionError } = await adminClient.rpc(
    'has_dynamic_job_type_permission',
    {
      requested_permission_key: 'schedule.publish',
      requested_job_type_id: jobTypeId,
      requested_user_id: userId,
    },
  );

  if (permissionError) throw permissionError;
  return allowed === true;
}

/**
 * פעולה אסינכרונית authenticateNotificationManager: התראות.
 * @param request — נתוני הבקשה.
 * @param configuration — תצורה.
 * @param notificationId — התראות / מזהה.
 * @returns Promise<AuthenticatedUserResult> — הפלט בהתאם לחתימה.
 */
export async function authenticateNotificationManager(
  request:
    Request,

  configuration:
    PermissionServiceConfiguration,

  notificationId:
    string,
): Promise<AuthenticatedUserResult> {

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר isAuthorizedInternalReminderDelivery(request).
  if (isAuthorizedInternalReminderDelivery(request)) {
     return {
      userId: 'system',adminClient: createAdminClient(configuration), };
    }
  const authorizationHeader =
    request.headers.get(
      'Authorization',
    );

  // עצירת הפעולה עם שגיאה כאשר !authorizationHeader.
  if (
    !authorizationHeader
  ) {
    throw new Error(
      'לא נמצאה התחברות פעילה.',
    );
  }

  // userClient — משתמש / לקוח.
  const userClient =
    createUserClient(
      configuration,
      authorizationHeader,
    );

  // userId — מזהה משתמש.
  const userId =
    await getAuthenticatedUserId(
      userClient,
    );

  // adminClient — לקוח.
  const adminClient =
    createAdminClient(
      configuration,
    );

  await validateActiveProfile(
    adminClient,
    userId,
  );

  // canManageNotifications — האם פעולת ניהול מותרת.
  const canManageNotifications =
    await hasPermission(
      adminClient,
      userId,
      'notifications.manage',
    );

  if (
    !canManageNotifications
  ) {
    // isAuthorizedShiftSwapDelivery — החלפת משמרות.
    const isAuthorizedShiftSwapDelivery =
      await validateShiftSwapWorkflowNotification(
        adminClient,
        userId,
        notificationId,
      );

    // isAuthorizedScheduleEditDelivery — שיבוץ.
    const isAuthorizedScheduleEditDelivery =
      isAuthorizedShiftSwapDelivery
        ? false
        : await validateScheduleEditWorkflowNotification(
            adminClient,
            userId,
            notificationId,
          );

    // isAuthorizedDailyReportDelivery — דוחות פעילות יומיים.
    const isAuthorizedDailyReportDelivery =
      isAuthorizedShiftSwapDelivery || isAuthorizedScheduleEditDelivery
        ? false
        : await validateDailyReportNotification(adminClient, userId, notificationId);

    // isAuthorizedDynamicPublicationDelivery — דינמי.
    const isAuthorizedDynamicPublicationDelivery =
      isAuthorizedShiftSwapDelivery || isAuthorizedScheduleEditDelivery || isAuthorizedDailyReportDelivery
        ? false
        : await validateDynamicSchedulePublicationNotification(
            adminClient,
            userId,
            notificationId,
          );

    // עצירת הפעולה עם שגיאה כאשר !isAuthorizedShiftSwapDelivery && !isAuthorizedScheduleEditDelivery && !isAuthorizedDailyReportDelivery && !isAuthorizedDynamicPublicationDe.
    if (
      !isAuthorizedShiftSwapDelivery &&
      !isAuthorizedScheduleEditDelivery &&
      !isAuthorizedDailyReportDelivery &&
      !isAuthorizedDynamicPublicationDelivery
    ) {
      throw new Error(
        'אין לך הרשאה לבצע פעולה זו.',
      );
    }
  }

  return {
    userId,

    adminClient,
  };
}
