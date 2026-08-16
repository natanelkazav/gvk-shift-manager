import {
  createClient,
} from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': [
    'authorization',
    'x-client-info',
    'apikey',
    'content-type',
  ].join(', '),
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
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
    Deno.env.get(name)?.trim();

  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}`,
    );
  }

  return value;
}

function getStringValue(
  value: unknown,
): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  return value.trim() || null;
}

async function deliverNotification(
  supabaseUrl: string,
  supabaseAnonKey: string,
  authorizationHeader: string,
  notificationId: string,
): Promise<void> {
  const response = await fetch(
    `${supabaseUrl}/functions/v1/send-notification`,
    {
      method: 'POST',
      headers: {
        Authorization: authorizationHeader,
        apikey: supabaseAnonKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        notificationId,
      }),
    },
  );

  if (response.ok) {
    return;
  }

  const responseBody =
    await response.text().catch(() => '');

  throw new Error(
    [
      `Push delivery failed with status ${response.status}.`,
      responseBody,
    ]
      .filter(Boolean)
      .join(' '),
  );
}

Deno.serve(
  async (request: Request): Promise<Response> => {
    if (request.method === 'OPTIONS') {
      return new Response('ok', {
        headers: corsHeaders,
      });
    }

    if (request.method !== 'POST') {
      return createJsonResponse(
        { error: 'Method not allowed.' },
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
        request.headers
          .get('Authorization')
          ?.trim();

      if (!authorizationHeader) {
        throw new Error(
          'לא נמצאה התחברות פעילה.',
        );
      }

      const rawBody =
        await request.json() as {
          shiftId?: unknown;
          newUserId?: unknown;
          reason?: unknown;
        };

      const shiftId =
        getStringValue(rawBody.shiftId);
      const newUserId =
        getStringValue(rawBody.newUserId);
      const reason =
        getStringValue(rawBody.reason);

      if (!shiftId || !newUserId) {
        throw new Error(
          'נתוני שינוי השיבוץ חסרים.',
        );
      }

      const userClient = createClient(
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
            persistSession: false,
            autoRefreshToken: false,
          },
        },
      );

      const adminClient = createClient(
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

      const {
        data: userData,
        error: userError,
      } = await userClient.auth.getUser();

      if (userError || !userData.user) {
        throw new Error(
          'ההתחברות אינה תקינה או שפג תוקפה.',
        );
      }

      const {
        data,
        error,
      } = await userClient.rpc(
        'update_current_schedule_shift',
        {
          requested_shift_id: shiftId,
          requested_new_user_id: newUserId,
          requested_reason: reason,
        },
      );

      if (error) {
        throw error;
      }

      if (!data || typeof data !== 'object') {
        throw new Error(
          'לא התקבלה תשובה תקינה לאחר שינוי השיבוץ.',
        );
      }

      const result = data as {
        notificationIds?: unknown;
        previousUserId?: unknown;
        previousUserName?: unknown;
        newUserId?: unknown;
        newUserName?: unknown;
        shiftDate?: unknown;
        startsAt?: unknown;
        endsAt?: unknown;
        [key: string]: unknown;
      };

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
            userData.user.id,
          )
          .maybeSingle();

      const {
        data:
          targetProfile,
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
            newUserId,
          )
          .maybeSingle();

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
              'schedule_shift_updated',

            actor_user_id:
              userData.user.id,

            actor_email:
              actorProfile?.email ??
              userData.user.email ??
              null,

            actor_display_name:
              actorProfile
                ?.display_name ??
              null,

            target_user_id:
              newUserId,

            target_email:
              targetProfile?.email ??
              null,

            target_display_name:
              targetProfile
                ?.display_name ??
              (
                typeof result.newUserName ===
                  'string'
                  ? result.newUserName
                  : null
              ),

            entity_type:
              'schedule_shift',

            entity_id:
              shiftId,

            summary:
              `שונה שיבוץ מוקדן${reason ? `: ${reason}` : ''}`,

            old_values: {
              assigned_user_id:
                typeof result.previousUserId ===
                  'string'
                  ? result.previousUserId
                  : null,

              assigned_user_name:
                typeof result.previousUserName ===
                  'string'
                  ? result.previousUserName
                  : null,
            },

            new_values: {
              assigned_user_id:
                newUserId,

              assigned_user_name:
                typeof result.newUserName ===
                  'string'
                  ? result.newUserName
                  : null,
            },

            metadata: {
              source:
                'schedule-edit-action',

              shift_date:
                typeof result.shiftDate ===
                  'string'
                  ? result.shiftDate
                  : null,

              starts_at:
                typeof result.startsAt ===
                  'string'
                  ? result.startsAt
                  : null,

              ends_at:
                typeof result.endsAt ===
                  'string'
                  ? result.endsAt
                  : null,

              reason,
            },
          });

      if (
        auditLogError
      ) {
        console.error(
          'SCHEDULE EDIT AUDIT LOG ERROR:',
          auditLogError,
        );
      }

      const notificationIds =
        Array.isArray(result.notificationIds)
          ? result.notificationIds.filter(
              (
                notificationId,
              ): notificationId is string =>
                typeof notificationId ===
                  'string' &&
                Boolean(
                  notificationId.trim(),
                ),
            )
          : [];

      const deliveries =
        await Promise.allSettled(
          notificationIds.map(
            (notificationId) =>
              deliverNotification(
                supabaseUrl,
                supabaseAnonKey,
                authorizationHeader,
                notificationId,
              ),
          ),
        );

      deliveries.forEach(
        (delivery, index) => {
          if (
            delivery.status ===
              'rejected'
          ) {
            console.error(
              'Schedule edit Push delivery failed:',
              {
                notificationId:
                  notificationIds[index],
                error: delivery.reason,
              },
            );
          }
        },
      );

      return createJsonResponse(result);
    } catch (error) {
      console.error(
        'schedule-edit-action failed:',
        error,
      );

      return createJsonResponse(
        {
          error:
            error instanceof Error
              ? error.message
              : 'אירעה שגיאה בלתי צפויה בעדכון השיבוץ.',
        },
        500,
      );
    }
  },
);
