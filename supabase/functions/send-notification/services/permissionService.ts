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

async function validatePermission(
  adminClient:
    SupabaseClient,

  userId:
    string,

  permissionKey:
    string,
): Promise<void> {
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

  if (
    !permission
  ) {
    throw new Error(
      'אין לך הרשאה לבצע פעולה זו.',
    );
  }
}

export async function authenticateNotificationManager(
  request:
    Request,

  configuration:
    PermissionServiceConfiguration,
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

  await validatePermission(
    adminClient,
    userId,
    'notifications.manage',
  );

  return {
    userId,

    adminClient,
  };
}