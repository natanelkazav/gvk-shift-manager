/**
 * קובץ: supabase/functions/shift-swap-action/index.ts
 * מטרה: טיפול בבקשות HTTP לפעולת השרת shift-swap-action.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: ShiftSwapMutationResult, ShiftSwapAction, ShiftSwapActionRequest, createJsonResponse, getRequiredEnvironmentVariable, getAuthorizationHeader, createUserClient, createAdminClient, recordShiftSwapAudit, parseActionRequest ועוד.
 * - קריאות RPC המופעלות בקובץ: create_shift_swap_request, cancel_shift_swap_request.
 * - מקורות נתונים הנזכרים בקריאות from: profiles, audit_logs.
 * - ריכוז ההגדרות והלוגיקה המפורטות בהמשך הקובץ.
 */
import {
  createClient,
  type SupabaseClient,
} from 'npm:@supabase/supabase-js@2';

/**
 * חוזה הנתונים ShiftSwapMutationResult: החלפת משמרות.
 */
interface ShiftSwapMutationResult {
  // notificationIds — התראות (אופציונלי).
  notificationIds?: unknown;
  [key: string]: unknown;
}

/**
 * טיפוס ShiftSwapAction: החלפת משמרות.
 */
type ShiftSwapAction =
  | 'create'
  | 'respond'
  | 'review'
  | 'cancel';

/**
 * חוזה הנתונים ShiftSwapActionRequest: החלפת משמרות.
 */
interface ShiftSwapActionRequest {
  action?: unknown;
  payload?: unknown;
}

// corsHeaders — הנתון corsHeaders בהקשר הפעולה.
const corsHeaders = {
  'Access-Control-Allow-Origin':
    '*',

  'Access-Control-Allow-Headers':
    [
      'authorization',
      'x-client-info',
      'apikey',
      'content-type',
    ].join(', '),

  'Access-Control-Allow-Methods':
    'POST, OPTIONS',
};

/**
 * פעולה createJsonResponse: יצירת תוצאת הפעולה.
 * @param body — תוכן.
 * @param status — סטטוס.
 * @returns Response — הפלט בהתאם לחתימה.
 */
function createJsonResponse(
  body: unknown,
  status = 200,
): Response {
  return new Response(
    JSON.stringify(body),
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
 * פעולה getRequiredEnvironmentVariable: שליפה או חישוב של הנתון getRequiredEnvironmentVariable בהקשר הפעולה.
 * @param name — שם.
 * @returns string — הפלט בהתאם לחתימה.
 */
function getRequiredEnvironmentVariable(
  name: string,
): string {
  // value — ערך.
  const value =
    Deno.env
      .get(name)
      ?.trim();

  // עצירת הפעולה עם שגיאה כאשר !value.
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}`,
    );
  }

  return value;
}

/**
 * פעולה getAuthorizationHeader: שליפה או חישוב של הנתון getAuthorizationHeader בהקשר הפעולה.
 * @param request — נתוני הבקשה.
 * @returns string — הפלט בהתאם לחתימה.
 */
function getAuthorizationHeader(
  request: Request,
): string {
  const authorizationHeader =
    request.headers
      .get('Authorization')
      ?.trim();

  // עצירת הפעולה עם שגיאה כאשר !authorizationHeader.
  if (!authorizationHeader) {
    throw new Error(
      'לא נמצאה התחברות פעילה.',
    );
  }

  return authorizationHeader;
}

/**
 * פעולה createUserClient: יצירת לקוח Supabase עם כותרת Authorization של המשתמש וללא שמירת סשן בצד השרת.
 * @param supabaseUrl — כתובת יעד.
 * @param supabaseAnonKey — מפתח.
 * @param authorizationHeader — הנתון authorizationHeader בהקשר הפעולה.
 * @returns SupabaseClient — הפלט בהתאם לחתימה.
 */
function createUserClient(
  supabaseUrl: string,
  supabaseAnonKey: string,
  authorizationHeader: string,
): SupabaseClient {
  return createClient(
    supabaseUrl,
    supabaseAnonKey,
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
 * @param supabaseUrl — כתובת יעד.
 * @param serviceRoleKey — שירות / מפתח.
 * @returns SupabaseClient — הפלט בהתאם לחתימה.
 */
function createAdminClient(
  supabaseUrl: string,
  serviceRoleKey: string,
): SupabaseClient {
  return createClient(
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
}

/**
 * פעולה אסינכרונית recordShiftSwapAudit: החלפת משמרות.
 * @param adminClient — לקוח.
 * @param actorUserId — מזהה משתמש.
 * @param actorEmail — כתובת דוא״ל.
 * @param action — הנתון action בהקשר הפעולה.
 * @param payload — הנתון payload בהקשר הפעולה.
 * @param result — תוצאה.
 * @returns Promise<void> — הפלט בהתאם לחתימה.
 */
async function recordShiftSwapAudit(
  adminClient:
    SupabaseClient,
  actorUserId:
    string,
  actorEmail:
    string | null,
  action:
    ShiftSwapAction,
  payload:
    Record<string, unknown>,
  result:
    ShiftSwapMutationResult,
): Promise<void> {
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
        'id, email, display_name',
      )
      .eq(
        'id',
        actorUserId,
      )
      .maybeSingle();

  const approve =
    typeof payload.approve ===
      'boolean'
      ? payload.approve
      : null;

  // auditAction — יומן שינויים.
  let auditAction:
    string;

  // summary — סיכום.
  let summary:
    string;

  if (
    action ===
      'create'
  ) {
    auditAction =
      'shift_swap_created';

    summary =
      'נוצרה בקשת החלפת משמרת';
  } else if (
    action ===
      'respond'
  ) {
    auditAction =
      approve
        ? 'shift_swap_counterparty_approved'
        : 'shift_swap_counterparty_rejected';

    summary =
      approve
        ? 'המוקדן השני אישר בקשת החלפת משמרת'
        : 'המוקדן השני דחה בקשת החלפת משמרת';
  } else if (
    action ===
      'review'
  ) {
    auditAction =
      approve
        ? 'shift_swap_manager_approved'
        : 'shift_swap_manager_rejected';

    summary =
      approve
        ? 'בקשת החלפת משמרת אושרה סופית'
        : 'בקשת החלפת משמרת נדחתה סופית';
  } else {
    auditAction =
      'shift_swap_cancelled';

    summary =
      'בקשת החלפת משמרת בוטלה';
  }

  // requestId — מזהה הבקשה.
  const requestId =
    typeof result.id ===
      'string'
      ? result.id
      : (
          typeof payload.requestId ===
            'string'
            ? payload.requestId
            : null
        );

  // targetUserId — מזהה משתמש היעד.
  const targetUserId =
    typeof result.counterpartyUserId ===
      'string'
      ? result.counterpartyUserId
      : null;

  // targetProfile — יעד / פרופיל.
  let targetProfile:
    {
      // email — כתובת דוא״ל (אופציונלי).
      email?: string | null;
      // display_name — שם תצוגה (אופציונלי).
      display_name?: string | null;
    } | null =
    null;

  if (
    targetUserId
  ) {
    // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
    const {
      data,
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
          targetUserId,
        )
        .maybeSingle();

    targetProfile =
      data;
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
          auditAction,

        actor_user_id:
          actorUserId,

        actor_email:
          actorProfile?.email ??
          actorEmail,

        actor_display_name:
          actorProfile
            ?.display_name ??
          null,

        target_user_id:
          targetUserId,

        target_email:
          targetProfile?.email ??
          null,

        target_display_name:
          targetProfile
            ?.display_name ??
          null,

        entity_type:
          'shift_swap_request',

        entity_id:
          requestId,

        summary,

        old_values:
          null,

        new_values: {
          status:
            typeof result.status ===
              'string'
              ? result.status
              : null,
        },

        metadata: {
          source:
            'shift-swap-action',

          workflow_action:
            action,

          approve,

          swap_type:
            typeof result.swapType ===
              'string'
              ? result.swapType
              : null,
        },
      });

  if (
    auditLogError
  ) {
    console.error(
      'SHIFT SWAP AUDIT LOG ERROR:',
      auditLogError,
    );
  }
}

/**
 * פעולה parseActionRequest: פענוח קלט עבור נתוני הבקשה.
 * @param value — ערך.
 * @returns { action: ShiftSwapAction; payload: Record<string, unknown>; } — הפלט בהתאם לחתימה.
 */
function parseActionRequest(
  value: unknown,
): {
  action: ShiftSwapAction;
  payload: Record<string, unknown>;
} {
  // עצירת הפעולה עם שגיאה כאשר typeof value !== 'object' || value === null.
  if (
    typeof value !==
      'object' ||
    value ===
      null
  ) {
    throw new Error(
      'גוף הבקשה אינו תקין.',
    );
  }

  // request — נתוני הבקשה.
  const request =
    value as
      ShiftSwapActionRequest;

  // עצירת הפעולה עם שגיאה כאשר request.action !== 'create' && request.action !== 'respond' && request.action !== 'review' && request.action !== 'cancel'.
  if (
    request.action !==
      'create' &&
    request.action !==
      'respond' &&
    request.action !==
      'review' &&
    request.action !==
      'cancel'
  ) {
    throw new Error(
      'פעולת החלפת המשמרת אינה תקינה.',
    );
  }

  const payload =
    typeof request.payload ===
        'object' &&
      request.payload !==
        null
      ? request.payload as
          Record<string, unknown>
      : {};

  return {
    action:
      request.action,
    payload,
  };
}

/**
 * פעולה getString: שליפה או חישוב של הנתון getString בהקשר הפעולה.
 * @param value — ערך.
 * @returns string | null — הפלט בהתאם לחתימה.
 */
function getString(
  value: unknown,
): string | null {
  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר typeof value !== 'string'.
  if (
    typeof value !==
      'string'
  ) {
    return null;
  }

  // normalizedValue — ערך.
  const normalizedValue =
    value.trim();

  return normalizedValue ||
    null;
}

/**
 * פעולה getBoolean: שליפה או חישוב של הנתון getBoolean בהקשר הפעולה.
 * @param value — ערך.
 * @returns boolean | null — הפלט בהתאם לחתימה.
 */
function getBoolean(
  value: unknown,
): boolean | null {
  return typeof value ===
    'boolean'
    ? value
    : null;
}

/**
 * פעולה אסינכרונית executeShiftSwapAction: החלפת משמרות.
 * הפעולה פונה ל־RPC: create_shift_swap_request, cancel_shift_swap_request.
 * @param userClient — משתמש / לקוח.
 * @param action — הנתון action בהקשר הפעולה.
 * @param payload — הנתון payload בהקשר הפעולה.
 * @returns Promise<ShiftSwapMutationResult> — הפלט בהתאם לחתימה.
 */
async function executeShiftSwapAction(
  userClient: SupabaseClient,
  action: ShiftSwapAction,
  payload: Record<string, unknown>,
): Promise<ShiftSwapMutationResult> {
  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר action === 'create'.
  if (
    action ===
      'create'
  ) {
    const swapType =
      getString(
        payload.swapType,
      );

    // requesterShiftId — מזהה המשמרת.
    const requesterShiftId =
      getString(
        payload.requesterShiftId,
      );

    // counterpartyUserId — מזהה משתמש.
    const counterpartyUserId =
      getString(
        payload.counterpartyUserId,
      );

    // counterpartyShiftId — מזהה המשמרת.
    const counterpartyShiftId =
      getString(
        payload.counterpartyShiftId,
      );

    // עצירת הפעולה עם שגיאה כאשר swapType !== 'one_way' && swapType !== 'two_way'.
    if (
      swapType !==
        'one_way' &&
      swapType !==
        'two_way'
    ) {
      throw new Error(
        'סוג ההחלפה אינו תקין.',
      );
    }

    // עצירת הפעולה עם שגיאה כאשר !requesterShiftId.
    if (
      !requesterShiftId
    ) {
      throw new Error(
        'יש לבחור משמרת להחלפה.',
      );
    }

    // עצירת הפעולה עם שגיאה כאשר !counterpartyUserId.
    if (
      !counterpartyUserId
    ) {
      throw new Error(
        'יש לבחור מוקדן מחליף.',
      );
    }

    // עצירת הפעולה עם שגיאה כאשר swapType === 'two_way' && !counterpartyShiftId.
    if (
      swapType ===
        'two_way' &&
      !counterpartyShiftId
    ) {
      throw new Error(
        'בהחלפה דו-כיוונית יש לבחור גם את המשמרת של המוקדן השני.',
      );
    }

    // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
    const {
      data,
      error,
    } =
      await userClient
        .rpc(
          'create_shift_swap_request',
          {
            requested_swap_type:
              swapType,
            requested_requester_shift_id:
              requesterShiftId,
            requested_counterparty_user_id:
              counterpartyUserId,
            requested_counterparty_shift_id:
              counterpartyShiftId,
          },
        );

    // עצירת הפעולה עם שגיאה כאשר error.
    if (error) {
      throw error;
    }

    // עצירת הפעולה עם שגיאה כאשר !data.
    if (!data) {
      throw new Error(
        'לא התקבלה תשובה בעת יצירת בקשת ההחלפה.',
      );
    }

    return data as
      ShiftSwapMutationResult;
  }

  // requestId — מזהה הבקשה.
  const requestId =
    getString(
      payload.requestId,
    );

  // עצירת הפעולה עם שגיאה כאשר !requestId.
  if (!requestId) {
    throw new Error(
      'לא התקבל מזהה בקשת החלפה.',
    );
  }

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר action === 'cancel'.
  if (
    action ===
      'cancel'
  ) {
    // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
    const {
      data,
      error,
    } =
      await userClient
        .rpc(
          'cancel_shift_swap_request',
          {
            requested_request_id:
              requestId,
          },
        );

    // עצירת הפעולה עם שגיאה כאשר error.
    if (error) {
      throw error;
    }

    // עצירת הפעולה עם שגיאה כאשר !data.
    if (!data) {
      throw new Error(
        'לא התקבלה תשובה בעת ביטול בקשת ההחלפה.',
      );
    }

    return data as
      ShiftSwapMutationResult;
  }

  const approve =
    getBoolean(
      payload.approve,
    );

  // עצירת הפעולה עם שגיאה כאשר approve === null.
  if (
    approve ===
      null
  ) {
    throw new Error(
      'לא התקבלה החלטה תקינה עבור בקשת ההחלפה.',
    );
  }

  const rejectionReason =
    getString(
      payload.rejectionReason,
    );

  // rpcName — שם.
  const rpcName =
    action ===
      'respond'
      ? 'respond_to_shift_swap_request'
      : 'review_shift_swap_request';

  // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
  const {
    data,
    error,
  } =
    await userClient
      .rpc(
        rpcName,
        {
          requested_request_id:
            requestId,
          requested_approve:
            approve,
          requested_rejection_reason:
            rejectionReason,
        },
      );

  // עצירת הפעולה עם שגיאה כאשר error.
  if (error) {
    throw error;
  }

  // עצירת הפעולה עם שגיאה כאשר !data.
  if (!data) {
    throw new Error(
      action ===
        'respond'
        ? 'לא התקבלה תשובה בעת עדכון בקשת ההחלפה.'
        : 'לא התקבלה תשובה בעת אישור בקשת ההחלפה.',
    );
  }

  return data as
    ShiftSwapMutationResult;
}

/**
 * פעולה getNotificationIds: שליפה או חישוב של התראות.
 * @param result — תוצאה.
 * @returns string[] — הפלט בהתאם לחתימה.
 */
function getNotificationIds(
  result: ShiftSwapMutationResult,
): string[] {
  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !Array.isArray( result.notificationIds, ).
  if (
    !Array.isArray(
      result.notificationIds,
    )
  ) {
    return [];
  }

  return result.notificationIds
    .filter(
      (
        notificationId,
      ): notificationId is string =>
        typeof notificationId ===
          'string' &&
        Boolean(
          notificationId.trim(),
        ),
    )
    .map(
      (
        notificationId,
      ) =>
        notificationId.trim(),
    );
}

/**
 * פעולה אסינכרונית deliverNotification: התראות.
 * @param supabaseUrl — כתובת יעד.
 * @param supabaseAnonKey — מפתח.
 * @param authorizationHeader — הנתון authorizationHeader בהקשר הפעולה.
 * @param notificationId — התראות / מזהה.
 * @returns Promise<void> — הפלט בהתאם לחתימה.
 */
async function deliverNotification(
  supabaseUrl: string,
  supabaseAnonKey: string,
  authorizationHeader: string,
  notificationId: string,
): Promise<void> {
  // response — תוצאת הפעולה.
  const response =
    await fetch(
      `${supabaseUrl}/functions/v1/send-notification`,
      {
        method:
          'POST',

        headers: {
          Authorization:
            authorizationHeader,

          apikey:
            supabaseAnonKey,

          'Content-Type':
            'application/json',
        },

        body:
          JSON.stringify({
            notificationId,
          }),
      },
    );

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר response.ok.
  if (
    response.ok
  ) {
    return;
  }

  // responseBody — תוצאת הפעולה / תוכן.
  const responseBody =
    await response
      .text()
      .catch(
        () => '',
      );

  throw new Error(
    [
      `Push delivery failed with status ${response.status}.`,

      responseBody,
    ]
      .filter(
        Boolean,
      )
      .join(
        ' ',
      ),
  );
}

/**
 * פעולה אסינכרונית deliverWorkflowNotifications: תהליך עבודה / התראות.
 * @param supabaseUrl — כתובת יעד.
 * @param supabaseAnonKey — מפתח.
 * @param authorizationHeader — הנתון authorizationHeader בהקשר הפעולה.
 * @param result — תוצאה.
 * @returns Promise<void> — הפלט בהתאם לחתימה.
 */
async function deliverWorkflowNotifications(
  supabaseUrl: string,
  supabaseAnonKey: string,
  authorizationHeader: string,
  result: ShiftSwapMutationResult,
): Promise<void> {
  // notificationIds — התראות.
  const notificationIds =
    getNotificationIds(
      result,
    );

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר notificationIds.length === 0.
  if (
    notificationIds.length ===
      0
  ) {
    return;
  }

  const deliveries =
    await Promise.allSettled(
      notificationIds.map(
        (
          notificationId,
        ) =>
          deliverNotification(
            supabaseUrl,
            supabaseAnonKey,
            authorizationHeader,
            notificationId,
          ),
      ),
    );

  deliveries.forEach(
    (
      delivery,
      index,
    ) => {
      if (
        delivery.status ===
          'rejected'
      ) {
        console.error(
          'Shift swap Push delivery failed:',
          {
            notificationId:
              notificationIds[
                index
              ],
            error:
              delivery.reason,
          },
        );
      }
    },
  );
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

      // supabaseAnonKey — מפתח.
      const supabaseAnonKey =
        getRequiredEnvironmentVariable(
          'SUPABASE_ANON_KEY',
        );

      // serviceRoleKey — שירות / מפתח.
      const serviceRoleKey =
        getRequiredEnvironmentVariable(
          'SUPABASE_SERVICE_ROLE_KEY',
        );

      const authorizationHeader =
        getAuthorizationHeader(
          request,
        );

      // userClient — משתמש / לקוח.
      const userClient =
        createUserClient(
          supabaseUrl,
          supabaseAnonKey,
          authorizationHeader,
        );

      // adminClient — לקוח.
      const adminClient =
        createAdminClient(
          supabaseUrl,
          serviceRoleKey,
        );

      // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
      const {
        data:
          userData,
        error:
          userError,
      } =
        await userClient.auth
          .getUser();

      // עצירת הפעולה עם שגיאה כאשר userError || !userData.user.
      if (
        userError ||
        !userData.user
      ) {
        throw new Error(
          'ההתחברות אינה תקינה או שפג תוקפה.',
        );
      }

      // rawBody — תוכן.
      let rawBody:
        unknown;

      // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
      try {
        rawBody =
          await request.json();
      } catch {
        throw new Error(
          'גוף הבקשה אינו JSON תקין.',
        );
      }

      const {
        action,
        payload,
      } =
        parseActionRequest(
          rawBody,
        );

      // result — תוצאה.
      const result =
        await executeShiftSwapAction(
          userClient,
          action,
          payload,
        );

      await recordShiftSwapAudit(
        adminClient,
        userData.user.id,
        userData.user.email ??
          null,
        action,
        payload,
        result,
      );

      await deliverWorkflowNotifications(
        supabaseUrl,
        supabaseAnonKey,
        authorizationHeader,
        result,
      );

      return createJsonResponse(
        result,
      );
    } catch (
      error
    ) {
      console.error(
        'shift-swap-action failed:',
        error,
      );

      return createJsonResponse(
        {
          error:
            error instanceof Error
              ? error.message
              : 'אירעה שגיאה בלתי צפויה במערכת החלפות המשמרת.',
        },
        500,
      );
    }
  },
);
