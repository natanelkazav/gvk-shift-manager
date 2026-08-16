import {
  createClient,
  type SupabaseClient,
} from 'npm:@supabase/supabase-js@2';

type EditableCategory =
  | 'on_call'
  | 'morning_driver';

interface EditRequest {
  category?: unknown;
  sourceId?: unknown;
  year?: unknown;
  month?: unknown;
  newUserId?: unknown;
  reason?: unknown;
}

interface NotificationContext {
  category:
    EditableCategory;
  sourceId:
    string;
  date:
    string;
  timeLabel:
    string | null;
  oldUserId:
    string | null;
  oldUserName:
    string | null;
  newUserId:
    string;
  newUserName:
    string | null;
  reason:
    string | null;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': [
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

function getString(
  value: unknown,
): string | null {
  if (
    typeof value !==
      'string'
  ) {
    return null;
  }

  return value.trim() ||
    null;
}

function getInteger(
  value: unknown,
): number | null {
  return (
    typeof value ===
      'number' &&
    Number.isInteger(value)
  )
    ? value
    : null;
}

function getJerusalemCurrentMonth(): {
  year: number;
  month: number;
} {
  const parts =
    new Intl.DateTimeFormat(
      'en-US',
      {
        timeZone:
          'Asia/Jerusalem',
        year:
          'numeric',
        month:
          'numeric',
      },
    ).formatToParts(
      new Date(),
    );

  const year =
    Number(
      parts.find(
        (part) =>
          part.type ===
            'year',
      )?.value,
    );

  const month =
    Number(
      parts.find(
        (part) =>
          part.type ===
            'month',
      )?.value,
    );

  return {
    year,
    month,
  };
}

async function hasPermission(
  adminClient:
    SupabaseClient,
  userId: string,
  permissionKey: string,
): Promise<boolean> {
  const {
    data,
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

  if (error) {
    throw error;
  }

  return Boolean(data);
}

async function createNotification(
  adminClient:
    SupabaseClient,
  actorUserId: string,
  context:
    NotificationContext,
  targetUserId: string,
  title: string,
  body: string,
): Promise<string> {
  const expiresAt =
    new Date(
      Date.now() +
        90 *
        24 *
        60 *
        60 *
        1000,
    ).toISOString();

  const {
    data:
      notification,
    error:
      notificationError,
  } =
    await adminClient
      .from(
        'notifications',
      )
      .insert({
        type:
          'system',
        priority:
          'important',
        source:
          'schedule_edit',
        title,
        body,
        url:
          '/shifts?tab=calendar',
        data: {
          workflow:
            'schedule_edit',
          event:
            'assignment_changed',
          actorUserId,
          category:
            context.category,
          shiftId:
            context.sourceId,
          reason:
            context.reason,
        },
        created_by:
          actorUserId,
        expires_at:
          expiresAt,
      })
      .select('id')
      .single();

  if (
    notificationError ||
    !notification
  ) {
    throw (
      notificationError ??
      new Error(
        'Notification creation failed.',
      )
    );
  }

  const {
    error:
      recipientError,
  } =
    await adminClient
      .from(
        'notification_recipients',
      )
      .insert({
        notification_id:
          notification.id,
        user_id:
          targetUserId,
      });

  if (recipientError) {
    throw recipientError;
  }

  return notification.id as
    string;
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

  if (response.ok) {
    return;
  }

  const body =
    await response
      .text()
      .catch(() => '');

  throw new Error(
    `Push delivery failed (${response.status}). ${body}`,
  );
}

function buildDateLabel(
  date: string,
  timeLabel:
    string | null,
): string {
  return timeLabel
    ? `${date}, ${timeLabel}`
    : date;
}

async function createChangeNotifications(
  adminClient:
    SupabaseClient,
  actorUserId: string,
  context:
    NotificationContext,
): Promise<string[]> {
  const notificationIds:
    string[] = [];

  if (
    context.oldUserId &&
    context.oldUserId !==
      context.newUserId
  ) {
    notificationIds.push(
      await createNotification(
        adminClient,
        actorUserId,
        context,
        context.oldUserId,
        'שינוי בשיבוץ שלך',
        `הוסרת מהשיבוץ בתאריך ${buildDateLabel(
          context.date,
          context.timeLabel,
        )}.`,
      ),
    );
  }

  if (
    context.newUserId !==
      context.oldUserId
  ) {
    notificationIds.push(
      await createNotification(
        adminClient,
        actorUserId,
        context,
        context.newUserId,
        'שובצת למשמרת',
        `שובצת בתאריך ${buildDateLabel(
          context.date,
          context.timeLabel,
        )}.`,
      ),
    );
  }

  return notificationIds;
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
        request.headers
          .get('Authorization')
          ?.trim();

      if (!authorizationHeader) {
        throw new Error(
          'לא נמצאה התחברות פעילה.',
        );
      }

      const rawBody =
        await request.json() as
          EditRequest;

      const category =
        getString(
          rawBody.category,
        );
      const sourceId =
        getString(
          rawBody.sourceId,
        );
      const year =
        getInteger(
          rawBody.year,
        );
      const month =
        getInteger(
          rawBody.month,
        );
      const newUserId =
        getString(
          rawBody.newUserId,
        );
      const reason =
        getString(
          rawBody.reason,
        );

      if (
        (
          category !==
            'on_call' &&
          category !==
            'morning_driver'
        ) ||
        !sourceId ||
        !year ||
        !month ||
        !newUserId
      ) {
        throw new Error(
          'נתוני שינוי השיבוץ חסרים או אינם תקינים.',
        );
      }

      const currentMonth =
        getJerusalemCurrentMonth();

      if (
        currentMonth.year !==
          year ||
        currentMonth.month !==
          month
      ) {
        throw new Error(
          'ניתן לערוך במסך זה רק את החודש הנוכחי.',
        );
      }

      const userClient =
        createClient(
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

      const adminClient =
        createClient(
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

      const actorUserId =
        userData.user.id;

      const permissionKey =
        category ===
          'on_call'
          ? 'driver_schedule.edit'
          : 'morning_driver_schedule.edit';

      if (
        !await hasPermission(
          adminClient,
          actorUserId,
          permissionKey,
        )
      ) {
        throw new Error(
          'אין לך הרשאה לערוך שיבוץ מסוג זה.',
        );
      }

      let context:
        NotificationContext;
      let result:
        Record<string, unknown>;

      if (
        category ===
          'on_call'
      ) {
        const {
          data:
            scheduleData,
          error:
            scheduleError,
        } =
          await userClient.rpc(
            'get_driver_schedule_draft',
            {
              requested_schedule_period_id:
                null,
              requested_year:
                year,
              requested_month:
                month,
            },
          );

        if (scheduleError) {
          throw scheduleError;
        }

        const schedule =
          scheduleData as {
            period?: {
              status?: unknown;
            };
            days?: Array<{
              id?: unknown;
              dutyDate?: unknown;
              assignedUserId?: unknown;
              assignedUserName?: unknown;
              isLocked?: unknown;
              notes?: unknown;
            }>;
          } | null;

        if (
          schedule?.period?.status !==
            'published'
        ) {
          throw new Error(
            'ניתן לערוך כאן רק לוח כוננים שפורסם.',
          );
        }

        const day =
          schedule.days?.find(
            (candidate) =>
              candidate.id ===
                sourceId,
          );

        if (!day) {
          throw new Error(
            'יום הכוננות לא נמצא.',
          );
        }

        const {
          data:
            updateData,
          error:
            updateError,
        } =
          await userClient.rpc(
            'update_driver_schedule_day',
            {
              requested_schedule_day_id:
                sourceId,
              requested_assigned_user_id:
                newUserId,
              requested_is_locked:
                Boolean(
                  day.isLocked,
                ),
              requested_note:
                getString(
                  day.notes,
                ),
            },
          );

        if (updateError) {
          throw updateError;
        }

        result =
          updateData as
            Record<string, unknown>;

        context = {
          category,
          sourceId,
          date:
            getString(
              day.dutyDate,
            ) ?? '',
          timeLabel:
            null,
          oldUserId:
            getString(
              day.assignedUserId,
            ),
          oldUserName:
            getString(
              day.assignedUserName,
            ),
          newUserId,
          newUserName:
            getString(
              result.assignedUserName,
            ),
          reason,
        };
      } else {
        const {
          data:
            scheduleData,
          error:
            scheduleError,
        } =
          await userClient.rpc(
            'get_morning_driver_schedule',
            {
              requested_schedule_period_id:
                null,
              requested_year:
                year,
              requested_month:
                month,
            },
          );

        if (scheduleError) {
          throw scheduleError;
        }

        const schedule =
          scheduleData as {
            period?: {
              status?: unknown;
            };
            assignments?: Array<{
              id?: unknown;
              shiftDate?: unknown;
              startTime?: unknown;
              endTime?: unknown;
              assignedUserId?: unknown;
              assignedUserName?: unknown;
              isLocked?: unknown;
              notes?: unknown;
            }>;
          } | null;

        if (
          schedule?.period?.status !==
            'published'
        ) {
          throw new Error(
            'ניתן לערוך כאן רק לוח כונני בוקר שפורסם.',
          );
        }

        const assignment =
          schedule.assignments?.find(
            (candidate) =>
              candidate.id ===
                sourceId,
          );

        if (!assignment) {
          throw new Error(
            'משמרת כונן הבוקר לא נמצאה.',
          );
        }

        const {
          data:
            updateData,
          error:
            updateError,
        } =
          await userClient.rpc(
            'update_morning_driver_schedule_assignment',
            {
              requested_assignment_id:
                sourceId,
              requested_assigned_user_id:
                newUserId,
              requested_is_locked:
                Boolean(
                  assignment.isLocked,
                ),
              requested_note:
                getString(
                  assignment.notes,
                ),
            },
          );

        if (updateError) {
          throw updateError;
        }

        result =
          updateData as
            Record<string, unknown>;

        const startTime =
          getString(
            assignment.startTime,
          );
        const endTime =
          getString(
            assignment.endTime,
          );

        context = {
          category,
          sourceId,
          date:
            getString(
              assignment.shiftDate,
            ) ?? '',
          timeLabel:
            startTime &&
            endTime
              ? `${startTime}–${endTime}`
              : null,
          oldUserId:
            getString(
              assignment.assignedUserId,
            ),
          oldUserName:
            getString(
              assignment.assignedUserName,
            ),
          newUserId,
          newUserName:
            getString(
              result.assignedUserName,
            ),
          reason,
        };
      }

      const notificationIds =
        await createChangeNotifications(
          adminClient,
          actorUserId,
          context,
        );

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
              'Unified schedule Push delivery failed:',
              {
                notificationId:
                  notificationIds[index],
                error:
                  delivery.reason,
              },
            );
          }
        },
      );

      return createJsonResponse({
        category,
        sourceId,
        newUserId:
          context.newUserId,
        newUserName:
          context.newUserName,
        notificationIds,
        result,
      });
    } catch (error) {
      console.error(
        'unified-schedule-edit-action failed:',
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
