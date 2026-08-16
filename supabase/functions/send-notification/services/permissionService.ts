import {
  createClient,
  type SupabaseClient,
} from 'npm:@supabase/supabase-js@2';

interface PermissionServiceConfiguration {
  supabaseUrl: string;

  supabaseAnonKey: string;

  serviceRoleKey: string;
}

interface AuthenticatedUserResult {
  userId: string;

  adminClient:
    SupabaseClient;
}

interface ShiftSwapNotificationAuthorizationRow {
  type?: unknown;

  source?: unknown;

  created_by?: unknown;

  data?: unknown;
}

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

async function getAuthenticatedUserId(
  userClient:
    SupabaseClient,
): Promise<string> {
  const {
    data,
    error,
  } =
    await userClient.auth
      .getUser();

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

async function validateActiveProfile(
  adminClient:
    SupabaseClient,

  userId:
    string,
): Promise<void> {
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

  if (
    error
  ) {
    throw error;
  }

  if (
    !profile ||
    !profile.is_active
  ) {
    throw new Error(
      'המשתמש אינו פעיל.',
    );
  }
}

async function hasPermission(
  adminClient:
    SupabaseClient,

  userId:
    string,

  permissionKey:
    string,
): Promise<boolean> {
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

  if (
    error
  ) {
    throw error;
  }

  return Boolean(
    permission,
  );
}

async function validateShiftSwapWorkflowNotification(
  adminClient:
    SupabaseClient,

  userId:
    string,

  notificationId:
    string,
): Promise<boolean> {
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

  if (
    error
  ) {
    throw error;
  }

  if (
    !data
  ) {
    return false;
  }

  const notification =
    data as
      ShiftSwapNotificationAuthorizationRow;

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


async function validateScheduleEditWorkflowNotification(
  adminClient:
    SupabaseClient,

  userId:
    string,

  notificationId:
    string,
): Promise<boolean> {
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

  if (error) {
    throw error;
  }

  if (!data) {
    return false;
  }

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

export async function authenticateNotificationManager(
  request:
    Request,

  configuration:
    PermissionServiceConfiguration,

  notificationId:
    string,
): Promise<AuthenticatedUserResult> {
  const authorizationHeader =
    request.headers.get(
      'Authorization',
    );

  if (
    !authorizationHeader
  ) {
    throw new Error(
      'לא נמצאה התחברות פעילה.',
    );
  }

  const userClient =
    createUserClient(
      configuration,
      authorizationHeader,
    );

  const userId =
    await getAuthenticatedUserId(
      userClient,
    );

  const adminClient =
    createAdminClient(
      configuration,
    );

  await validateActiveProfile(
    adminClient,
    userId,
  );

  const canManageNotifications =
    await hasPermission(
      adminClient,
      userId,
      'notifications.manage',
    );

  if (
    !canManageNotifications
  ) {
    const isAuthorizedShiftSwapDelivery =
      await validateShiftSwapWorkflowNotification(
        adminClient,
        userId,
        notificationId,
      );

    const isAuthorizedScheduleEditDelivery =
      isAuthorizedShiftSwapDelivery
        ? false
        : await validateScheduleEditWorkflowNotification(
            adminClient,
            userId,
            notificationId,
          );

    if (
      !isAuthorizedShiftSwapDelivery &&
      !isAuthorizedScheduleEditDelivery
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
