import {
  createClient,
  type SupabaseClient,
} from 'npm:@supabase/supabase-js@2';

interface ShiftSwapMutationResult {
  notificationIds?: unknown;
  [key: string]: unknown;
}

type ShiftSwapAction =
  | 'create'
  | 'respond'
  | 'review'
  | 'cancel';

interface ShiftSwapActionRequest {
  action?: unknown;
  payload?: unknown;
}

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

function getRequiredEnvironmentVariable(
  name: string,
): string {
  const value =
    Deno.env
      .get(name)
      ?.trim();

  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}`,
    );
  }

  return value;
}

function getAuthorizationHeader(
  request: Request,
): string {
  const authorizationHeader =
    request.headers
      .get('Authorization')
      ?.trim();

  if (!authorizationHeader) {
    throw new Error(
      'לא נמצאה התחברות פעילה.',
    );
  }

  return authorizationHeader;
}

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

  let auditAction:
    string;

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

  const targetUserId =
    typeof result.counterpartyUserId ===
      'string'
      ? result.counterpartyUserId
      : null;

  let targetProfile:
    {
      email?: string | null;
      display_name?: string | null;
    } | null =
    null;

  if (
    targetUserId
  ) {
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

function parseActionRequest(
  value: unknown,
): {
  action: ShiftSwapAction;
  payload: Record<string, unknown>;
} {
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

  const request =
    value as
      ShiftSwapActionRequest;

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

function getString(
  value: unknown,
): string | null {
  if (
    typeof value !==
      'string'
  ) {
    return null;
  }

  const normalizedValue =
    value.trim();

  return normalizedValue ||
    null;
}

function getBoolean(
  value: unknown,
): boolean | null {
  return typeof value ===
    'boolean'
    ? value
    : null;
}

async function executeShiftSwapAction(
  userClient: SupabaseClient,
  action: ShiftSwapAction,
  payload: Record<string, unknown>,
): Promise<ShiftSwapMutationResult> {
  if (
    action ===
      'create'
  ) {
    const swapType =
      getString(
        payload.swapType,
      );

    const requesterShiftId =
      getString(
        payload.requesterShiftId,
      );

    const counterpartyUserId =
      getString(
        payload.counterpartyUserId,
      );

    const counterpartyShiftId =
      getString(
        payload.counterpartyShiftId,
      );

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

    if (
      !requesterShiftId
    ) {
      throw new Error(
        'יש לבחור משמרת להחלפה.',
      );
    }

    if (
      !counterpartyUserId
    ) {
      throw new Error(
        'יש לבחור מוקדן מחליף.',
      );
    }

    if (
      swapType ===
        'two_way' &&
      !counterpartyShiftId
    ) {
      throw new Error(
        'בהחלפה דו-כיוונית יש לבחור גם את המשמרת של המוקדן השני.',
      );
    }

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

    if (error) {
      throw error;
    }

    if (!data) {
      throw new Error(
        'לא התקבלה תשובה בעת יצירת בקשת ההחלפה.',
      );
    }

    return data as
      ShiftSwapMutationResult;
  }

  const requestId =
    getString(
      payload.requestId,
    );

  if (!requestId) {
    throw new Error(
      'לא התקבל מזהה בקשת החלפה.',
    );
  }

  if (
    action ===
      'cancel'
  ) {
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

    if (error) {
      throw error;
    }

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

  const rpcName =
    action ===
      'respond'
      ? 'respond_to_shift_swap_request'
      : 'review_shift_swap_request';

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

  if (error) {
    throw error;
  }

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

function getNotificationIds(
  result: ShiftSwapMutationResult,
): string[] {
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

async function deliverNotification(
  supabaseUrl: string,
  supabaseAnonKey: string,
  authorizationHeader: string,
  notificationId: string,
): Promise<void> {
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

  if (
    response.ok
  ) {
    return;
  }

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

async function deliverWorkflowNotifications(
  supabaseUrl: string,
  supabaseAnonKey: string,
  authorizationHeader: string,
  result: ShiftSwapMutationResult,
): Promise<void> {
  const notificationIds =
    getNotificationIds(
      result,
    );

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

      const supabaseAnonKey =
        getRequiredEnvironmentVariable(
          'SUPABASE_ANON_KEY',
        );

      const serviceRoleKey =
        getRequiredEnvironmentVariable(
          'SUPABASE_SERVICE_ROLE_KEY',
        );

      const authorizationHeader =
        getAuthorizationHeader(
          request,
        );

      const userClient =
        createUserClient(
          supabaseUrl,
          supabaseAnonKey,
          authorizationHeader,
        );

      const adminClient =
        createAdminClient(
          supabaseUrl,
          serviceRoleKey,
        );

      const {
        data:
          userData,
        error:
          userError,
      } =
        await userClient.auth
          .getUser();

      if (
        userError ||
        !userData.user
      ) {
        throw new Error(
          'ההתחברות אינה תקינה או שפג תוקפה.',
        );
      }

      let rawBody:
        unknown;

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
