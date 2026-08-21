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
    'x-cron-secret',
  ].join(', '),
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(
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

function env(
  name: string,
): string {
  const value =
    Deno.env.get(name)?.trim();

  if (!value) {
    throw new Error(
      `Missing environment variable: ${name}`,
    );
  }

  return value;
}

function formatJerusalemDateTime(
  value: string,
): {
  date: string;
  time: string;
} {
  const date =
    new Date(value);

  return {
    date:
      new Intl.DateTimeFormat(
        'he-IL',
        {
          timeZone:
            'Asia/Jerusalem',
          day:
            '2-digit',
          month:
            '2-digit',
          year:
            'numeric',
        },
      ).format(date),

    time:
      new Intl.DateTimeFormat(
        'he-IL',
        {
          timeZone:
            'Asia/Jerusalem',
          hour:
            '2-digit',
          minute:
            '2-digit',
          hourCycle:
            'h23',
        },
      ).format(date),
  };
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
      return jsonResponse(
        {
          error:
            'Method not allowed.',
        },
        405,
      );
    }

    try {
      const cronSecret =
        env(
          'SHIFT_REMINDER_CRON_SECRET',
        );

      if (
        request.headers
          .get(
            'x-cron-secret',
          )
          ?.trim() !==
        cronSecret
      ) {
        return jsonResponse(
          {
            error:
              'Unauthorized.',
          },
          401,
        );
      }

      const supabaseUrl =
        env(
          'SUPABASE_URL',
        );

      const serviceRoleKey =
        env(
          'SUPABASE_SERVICE_ROLE_KEY',
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

      const now =
        new Date();

      /*
       * ההגדרה מאפשרת עד 1440 דקות מראש.
       * אנו טוענים רק משמרות שיכולות להפוך
       * לרלוונטיות במהלך הריצה הנוכחית.
       */
      const latestStart =
        new Date(
          now.getTime() +
          (
            1440 + 3
          ) *
          60_000,
        );

      const {
        data:
          preferences,

        error:
          preferencesError,
      } =
        await adminClient
          .from(
            'notification_preferences',
          )
          .select(
            [
              'user_id',
              'push_enabled',
              'shift_reminders_enabled',
              'shift_reminder_minutes_before',
            ].join(
              ',',
            ),
          )
          .eq(
            'push_enabled',
            true,
          )
          .eq(
            'shift_reminders_enabled',
            true,
          );

      if (
        preferencesError
      ) {
        throw preferencesError;
      }

      const preferenceMap =
        new Map<
          string,
          number
        >();

      for (
        const preference
        of preferences ?? []
      ) {
        if (
          typeof preference.user_id !==
            'string' ||
          typeof preference.shift_reminder_minutes_before !==
            'number'
        ) {
          continue;
        }

        preferenceMap.set(
          preference.user_id,
          preference.shift_reminder_minutes_before,
        );
      }

      if (
        preferenceMap.size ===
        0
      ) {
        return jsonResponse({
          checked:
            0,
          created:
            0,
          delivered:
            0,
        });
      }

      const {
        data:
          shifts,

        error:
          shiftsError,
      } =
        await adminClient
          .from(
            'schedule_shifts',
          )
          .select(
            [
              'id',
              'period_id',
              'shift_date',
              'starts_at',
              'ends_at',
              'assigned_user_id',
            ].join(
              ',',
            ),
          )
          .not(
            'assigned_user_id',
            'is',
            null,
          )
          .gte(
            'starts_at',
            now.toISOString(),
          )
          .lte(
            'starts_at',
            latestStart.toISOString(),
          );

      if (
        shiftsError
      ) {
        throw shiftsError;
      }

      let created =
        0;

      let delivered =
        0;

      const errors:
        string[] = [];

      for (
        const shift
        of shifts ?? []
      ) {
        if (
          typeof shift.id !==
            'string' ||
          typeof shift.assigned_user_id !==
            'string' ||
          typeof shift.starts_at !==
            'string'
        ) {
          continue;
        }

        const minutesBefore =
          preferenceMap.get(
            shift.assigned_user_id,
          );

        if (
          minutesBefore ===
            undefined
        ) {
          continue;
        }

        const startsAt =
          new Date(
            shift.starts_at,
          );

        const reminderAt =
          new Date(
            startsAt.getTime() -
            minutesBefore *
            60_000,
          );

        /*
         * Cron רץ כל דקה. חלון של 2 דקות
         * מגן מפני סטייה קטנה בזמן הריצה.
         * טבלת ה-dedup מונעת שליחה כפולה.
         */
        const ageMs =
          now.getTime() -
          reminderAt.getTime();

        if (
          ageMs <
            0 ||
          ageMs >
            2 * 60_000
        ) {
          continue;
        }

        const {
          data:
            claimed,

          error:
            claimError,
        } =
          await adminClient
            .from(
              'shift_reminder_deliveries',
            )
            .insert({
              shift_id:
                shift.id,

              user_id:
                shift.assigned_user_id,

              minutes_before:
                minutesBefore,
            })
            .select(
              'id',
            )
            .maybeSingle();

        if (
          claimError
        ) {
          /*
           * 23505 = כבר נשלחה/נתפסה תזכורת
           * עבור אותה משמרת, משתמש והגדרה.
           */
          if (
            claimError.code ===
              '23505'
          ) {
            continue;
          }

          errors.push(
            `claim ${shift.id}: ${claimError.message}`,
          );

          continue;
        }

        if (
          !claimed
        ) {
          continue;
        }

        const formatted =
          formatJerusalemDateTime(
            shift.starts_at,
          );

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
                'shift_reminder',

              priority:
                'important',

              source:
                'shift_reminder',

              title:
                'תזכורת למשמרת',

              body:
                minutesBefore ===
                  0
                  ? `המשמרת שלך מתחילה עכשיו (${formatted.date} בשעה ${formatted.time}).`
                  : `המשמרת שלך מתחילה בעוד ${minutesBefore} דקות (${formatted.date} בשעה ${formatted.time}).`,

              url:
                '/my-schedule',

              data: {
                workflow:
                  'shift_reminder',

                event:
                  'shift_start_reminder',

                shiftId:
                  shift.id,

                startsAt:
                  shift.starts_at,

                minutesBefore,
              },

              created_by:
                null,

              expires_at:
                new Date(
                  startsAt.getTime() +
                  24 *
                  60 *
                  60_000,
                ).toISOString(),
            })
            .select(
              'id',
            )
            .single();

        if (
          notificationError ||
          !notification
        ) {
          await adminClient
            .from(
              'shift_reminder_deliveries',
            )
            .delete()
            .eq(
              'id',
              claimed.id,
            );

          errors.push(
            `notification ${shift.id}: ${notificationError?.message ?? 'unknown error'}`,
          );

          continue;
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
                shift.assigned_user_id,
            });

        if (
          recipientError
        ) {
          errors.push(
            `recipient ${shift.id}: ${recipientError.message}`,
          );

          continue;
        }

        created +=
          1;

        const deliveryResponse =
          await fetch(
            `${supabaseUrl}/functions/v1/send-notification`,
            {
              method:
                'POST',

              headers: {
                Authorization:
                  `Bearer ${serviceRoleKey}`,

                apikey:
                  serviceRoleKey,

                'Content-Type':
                  'application/json',

                'x-cron-secret':
                  cronSecret,
              },

              body:
                JSON.stringify({
                  notificationId:
                    notification.id,
                }),
            },
          );

        if (
          deliveryResponse.ok
        ) {
          delivered +=
            1;

          await adminClient
            .from(
              'shift_reminder_deliveries',
            )
            .update({
              notification_id:
                notification.id,

              delivered_at:
                new Date()
                  .toISOString(),
            })
            .eq(
              'id',
              claimed.id,
            );
        } else {
          const responseText =
            await deliveryResponse
              .text()
              .catch(
                () =>
                  '',
              );

          errors.push(
            `push ${shift.id}: ${deliveryResponse.status} ${responseText}`,
          );
        }
      }

      return jsonResponse({
        checked:
          shifts?.length ??
          0,

        created,

        delivered,

        errors,
      });
    } catch (
      error
    ) {
      console.error(
        'process-shift-reminders failed:',
        error,
      );

      return jsonResponse(
        {
          error:
            error instanceof
              Error
              ? error.message
              : 'Unexpected shift reminder error.',
        },
        500,
      );
    }
  },
);
