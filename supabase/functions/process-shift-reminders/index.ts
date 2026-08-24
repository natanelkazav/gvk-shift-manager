import {
  createClient,
} from 'npm:@supabase/supabase-js@2';

const JERUSALEM_TIME_ZONE =
  'Asia/Jerusalem';

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

function getJerusalemDateTimeParts(
  value: Date,
): {
  date: string;
  time: string;
  minutesOfDay: number;
} {
  const parts =
    new Intl.DateTimeFormat(
      'en-CA',
      {
        timeZone:
          JERUSALEM_TIME_ZONE,
        year:
          'numeric',
        month:
          '2-digit',
        day:
          '2-digit',
        hour:
          '2-digit',
        minute:
          '2-digit',
        hourCycle:
          'h23',
      },
    ).formatToParts(
      value,
    );

  const valueFor =
    (
      type: string,
    ): string =>
      parts.find(
        (
          part,
        ) =>
          part.type ===
          type,
      )?.value ??
      '';

  const year =
    valueFor(
      'year',
    );
  const month =
    valueFor(
      'month',
    );
  const day =
    valueFor(
      'day',
    );
  const hour =
    Number(
      valueFor(
        'hour',
      ),
    );
  const minute =
    Number(
      valueFor(
        'minute',
      ),
    );

  return {
    date:
      `${year}-${month}-${day}`,
    time:
      `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
    minutesOfDay:
      hour * 60 +
      minute,
  };
}

function addDaysToIsoDate(
  isoDate: string,
  days: number,
): string {
  const [
    year,
    month,
    day,
  ] =
    isoDate
      .split('-')
      .map(Number);

  const value =
    new Date(
      Date.UTC(
        year,
        month - 1,
        day + days,
      ),
    );

  return [
    value.getUTCFullYear(),
    String(
      value.getUTCMonth() + 1,
    ).padStart(
      2,
      '0',
    ),
    String(
      value.getUTCDate(),
    ).padStart(
      2,
      '0',
    ),
  ].join('-');
}

function getTimeZoneOffsetMs(
  instant: Date,
): number {
  const parts =
    new Intl.DateTimeFormat(
      'en-US',
      {
        timeZone:
          JERUSALEM_TIME_ZONE,
        year:
          'numeric',
        month:
          '2-digit',
        day:
          '2-digit',
        hour:
          '2-digit',
        minute:
          '2-digit',
        second:
          '2-digit',
        hourCycle:
          'h23',
      },
    ).formatToParts(
      instant,
    );

  const numberFor =
    (
      type: string,
    ): number =>
      Number(
        parts.find(
          (
            part,
          ) =>
            part.type ===
            type,
        )?.value ??
        0,
      );

  const asUtc =
    Date.UTC(
      numberFor('year'),
      numberFor('month') - 1,
      numberFor('day'),
      numberFor('hour'),
      numberFor('minute'),
      numberFor('second'),
    );

  return asUtc -
    instant.getTime();
}

function jerusalemLocalToUtc(
  isoDate: string,
  timeValue: string,
): Date {
  const [
    year,
    month,
    day,
  ] =
    isoDate
      .split('-')
      .map(Number);

  const [
    hour,
    minute,
    second = 0,
  ] =
    timeValue
      .split(':')
      .map(Number);

  const localAsUtc =
    Date.UTC(
      year,
      month - 1,
      day,
      hour,
      minute,
      second,
    );

  let guess =
    localAsUtc;

  for (
    let index = 0;
    index < 2;
    index += 1
  ) {
    const offset =
      getTimeZoneOffsetMs(
        new Date(
          guess,
        ),
      );

    guess =
      localAsUtc -
      offset;
  }

  return new Date(
    guess,
  );
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
            JERUSALEM_TIME_ZONE,
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
            JERUSALEM_TIME_ZONE,
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

function parseTimeToMinutes(
  value: string,
): number | null {
  const match =
    /^(\d{2}):(\d{2})/.exec(
      value,
    );

  if (!match) {
    return null;
  }

  const hour =
    Number(
      match[1],
    );
  const minute =
    Number(
      match[2],
    );

  if (
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return null;
  }

  return hour * 60 +
    minute;
}

Deno.serve(
  async (
    request: Request,
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
      const jerusalemNow =
        getJerusalemDateTimeParts(
          now,
        );
      const latestStart =
        new Date(
          now.getTime() +
          1443 * 60_000,
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
              'driver_duty_reminders_enabled',
              'driver_duty_reminder_time',
            ].join(','),
          )
          .eq(
            'push_enabled',
            true,
          );

      if (
        preferencesError
      ) {
        throw preferencesError;
      }

      const shiftPreferenceMap =
        new Map<
          string,
          number
        >();
      const driverDutyPreferenceMap =
        new Map<
          string,
          string
        >();

      for (
        const preference
        of preferences ?? []
      ) {
        if (
          typeof preference.user_id !==
          'string'
        ) {
          continue;
        }

        if (
          preference.shift_reminders_enabled ===
            true &&
          typeof preference.shift_reminder_minutes_before ===
            'number'
        ) {
          shiftPreferenceMap.set(
            preference.user_id,
            preference.shift_reminder_minutes_before,
          );
        }

        if (
          preference.driver_duty_reminders_enabled ===
            true &&
          typeof preference.driver_duty_reminder_time ===
            'string'
        ) {
          driverDutyPreferenceMap.set(
            preference.user_id,
            preference.driver_duty_reminder_time,
          );
        }
      }

      let checked =
        0;
      let created =
        0;
      let delivered =
        0;
      const errors:
        string[] = [];

      const deliverNotification =
        async (
          input: {
            userId: string;
            title: string;
            body: string;
            url: string;
            data: Record<string, unknown>;
            expiresAt: string;
          },
        ): Promise<{
          notificationId: string | null;
          delivered: boolean;
        }> => {
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
                  input.title,
                body:
                  input.body,
                url:
                  input.url,
                data:
                  input.data,
                created_by:
                  null,
                expires_at:
                  input.expiresAt,
              })
              .select(
                'id',
              )
              .single();

          if (
            notificationError ||
            !notification ||
            typeof notification.id !==
              'string'
          ) {
            errors.push(
              `notification: ${notificationError?.message ?? 'unknown error'}`,
            );
            return {
              notificationId:
                null,
              delivered:
                false,
            };
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
                  input.userId,
              });

          if (
            recipientError
          ) {
            errors.push(
              `recipient ${notification.id}: ${recipientError.message}`,
            );
            return {
              notificationId:
                notification.id,
              delivered:
                false,
            };
          }

          created += 1;

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
            delivered += 1;
            return {
              notificationId:
                notification.id,
              delivered:
                true,
            };
          }

          const responseText =
            await deliveryResponse
              .text()
              .catch(
                () =>
                  '',
              );

          errors.push(
            `push ${notification.id}: ${deliveryResponse.status} ${responseText}`,
          );

          return {
            notificationId:
              notification.id,
            delivered:
              false,
          };
        };

      if (
        shiftPreferenceMap.size >
        0
      ) {
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
                'shift_date',
                'starts_at',
                'ends_at',
                'assigned_user_id',
              ].join(','),
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
          errors.push(
            `dispatcher shifts: ${shiftsError.message}`,
          );
        } else {
          checked +=
            shifts?.length ??
            0;

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
              shiftPreferenceMap.get(
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
            const ageMs =
              now.getTime() -
              reminderAt.getTime();

            if (
              ageMs < 0 ||
              ageMs > 2 * 60_000
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
              if (
                claimError.code ===
                '23505'
              ) {
                continue;
              }
              errors.push(
                `dispatcher claim ${shift.id}: ${claimError.message}`,
              );
              continue;
            }

            if (!claimed) {
              continue;
            }

            const formatted =
              formatJerusalemDateTime(
                shift.starts_at,
              );

            const result =
              await deliverNotification({
                userId:
                  shift.assigned_user_id,
                title:
                  'תזכורת למשמרת',
                body:
                  minutesBefore === 0
                    ? `המשמרת שלך מתחילה עכשיו (${formatted.date} בשעה ${formatted.time}).`
                    : `המשמרת שלך מתחילה בעוד ${minutesBefore} דקות (${formatted.date} בשעה ${formatted.time}).`,
                url:
                  '/',
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
                expiresAt:
                  new Date(
                    startsAt.getTime() +
                    24 * 60 * 60_000,
                  ).toISOString(),
              });

            if (
              result.notificationId
            ) {
              await adminClient
                .from(
                  'shift_reminder_deliveries',
                )
                .update({
                  notification_id:
                    result.notificationId,
                  delivered_at:
                    result.delivered
                      ? new Date().toISOString()
                      : null,
                })
                .eq(
                  'id',
                  claimed.id,
                );
            } else {
              await adminClient
                .from(
                  'shift_reminder_deliveries',
                )
                .delete()
                .eq(
                  'id',
                  claimed.id,
                );
            }
          }
        }

        const startDate =
          jerusalemNow.date;
        const endDate =
          addDaysToIsoDate(
            startDate,
            2,
          );

        const {
          data:
            morningShifts,
          error:
            morningShiftsError,
        } =
          await adminClient
            .from(
              'morning_driver_availability_shifts',
            )
            .select(
              'id,shift_date,start_time,end_time',
            )
            .gte(
              'shift_date',
              startDate,
            )
            .lte(
              'shift_date',
              endDate,
            );

        if (
          morningShiftsError
        ) {
          errors.push(
            `morning shifts: ${morningShiftsError.message}`,
          );
        } else if (
          morningShifts &&
          morningShifts.length > 0
        ) {
          const shiftMap =
            new Map<
              string,
              {
                shiftDate: string;
                startTime: string;
                endTime: string;
              }
            >();

          for (
            const shift
            of morningShifts
          ) {
            if (
              typeof shift.id ===
                'string' &&
              typeof shift.shift_date ===
                'string' &&
              typeof shift.start_time ===
                'string' &&
              typeof shift.end_time ===
                'string'
            ) {
              shiftMap.set(
                shift.id,
                {
                  shiftDate:
                    shift.shift_date,
                  startTime:
                    shift.start_time,
                  endTime:
                    shift.end_time,
                },
              );
            }
          }

          const {
            data:
              publishedPeriods,
            error:
              periodError,
          } =
            await adminClient
              .from(
                'morning_driver_schedule_periods',
              )
              .select(
                'id',
              )
              .eq(
                'status',
                'published',
              );

          if (
            periodError
          ) {
            errors.push(
              `morning periods: ${periodError.message}`,
            );
          } else {
            const periodIds =
              (publishedPeriods ?? [])
                .map(
                  (
                    period,
                  ) =>
                    typeof period.id ===
                      'string'
                      ? period.id
                      : null,
                )
                .filter(
                  (
                    id,
                  ): id is string =>
                    Boolean(id),
                );

            if (
              periodIds.length > 0 &&
              shiftMap.size > 0
            ) {
              const {
                data:
                  assignments,
                error:
                  assignmentsError,
              } =
                await adminClient
                  .from(
                    'morning_driver_schedule_assignments',
                  )
                  .select(
                    'id,schedule_period_id,availability_shift_id,assigned_user_id',
                  )
                  .in(
                    'schedule_period_id',
                    periodIds,
                  )
                  .in(
                    'availability_shift_id',
                    Array.from(
                      shiftMap.keys(),
                    ),
                  )
                  .not(
                    'assigned_user_id',
                    'is',
                    null,
                  );

              if (
                assignmentsError
              ) {
                errors.push(
                  `morning assignments: ${assignmentsError.message}`,
                );
              } else {
                checked +=
                  assignments?.length ??
                  0;

                for (
                  const assignment
                  of assignments ?? []
                ) {
                  if (
                    typeof assignment.id !==
                      'string' ||
                    typeof assignment.availability_shift_id !==
                      'string' ||
                    typeof assignment.assigned_user_id !==
                      'string'
                  ) {
                    continue;
                  }

                  const minutesBefore =
                    shiftPreferenceMap.get(
                      assignment.assigned_user_id,
                    );
                  const shift =
                    shiftMap.get(
                      assignment.availability_shift_id,
                    );

                  if (
                    minutesBefore ===
                      undefined ||
                    !shift
                  ) {
                    continue;
                  }

                  const startsAt =
                    jerusalemLocalToUtc(
                      shift.shiftDate,
                      shift.startTime,
                    );
                  const reminderAt =
                    new Date(
                      startsAt.getTime() -
                      minutesBefore *
                      60_000,
                    );
                  const ageMs =
                    now.getTime() -
                    reminderAt.getTime();

                  if (
                    ageMs < 0 ||
                    ageMs > 2 * 60_000
                  ) {
                    continue;
                  }

                  const reminderKey =
                    `${assignment.id}:${minutesBefore}`;

                  const {
                    data:
                      claimed,
                    error:
                      claimError,
                  } =
                    await adminClient
                      .from(
                        'scheduled_reminder_deliveries',
                      )
                      .insert({
                        user_id:
                          assignment.assigned_user_id,
                        reminder_type:
                          'morning_driver_shift',
                        reminder_key:
                          reminderKey,
                        source_id:
                          assignment.id,
                      })
                      .select(
                        'id',
                      )
                      .maybeSingle();

                  if (
                    claimError
                  ) {
                    if (
                      claimError.code ===
                      '23505'
                    ) {
                      continue;
                    }
                    errors.push(
                      `morning claim ${assignment.id}: ${claimError.message}`,
                    );
                    continue;
                  }

                  if (!claimed) {
                    continue;
                  }

                  const formatted =
                    formatJerusalemDateTime(
                      startsAt.toISOString(),
                    );

                  const result =
                    await deliverNotification({
                      userId:
                        assignment.assigned_user_id,
                      title:
                        'תזכורת לכוננות בוקר',
                      body:
                        minutesBefore === 0
                          ? `כוננות הבוקר שלך מתחילה עכשיו (${formatted.date} בשעה ${formatted.time}).`
                          : `כוננות הבוקר שלך מתחילה בעוד ${minutesBefore} דקות (${formatted.date} בשעה ${formatted.time}).`,
                      url:
                        '/morning-driver-schedule',
                      data: {
                        workflow:
                          'shift_reminder',
                        event:
                          'morning_driver_shift_reminder',
                        assignmentId:
                          assignment.id,
                        startsAt:
                          startsAt.toISOString(),
                        minutesBefore,
                      },
                      expiresAt:
                        new Date(
                          startsAt.getTime() +
                          24 * 60 * 60_000,
                        ).toISOString(),
                    });

                  if (
                    result.notificationId
                  ) {
                    await adminClient
                      .from(
                        'scheduled_reminder_deliveries',
                      )
                      .update({
                        notification_id:
                          result.notificationId,
                        delivered_at:
                          result.delivered
                            ? new Date().toISOString()
                            : null,
                      })
                      .eq(
                        'id',
                        claimed.id,
                      );
                  } else {
                    await adminClient
                      .from(
                        'scheduled_reminder_deliveries',
                      )
                      .delete()
                      .eq(
                        'id',
                        claimed.id,
                      );
                  }
                }
              }
            }
          }
        }
      }

      if (
        driverDutyPreferenceMap.size >
        0
      ) {
        const eligibleDriverIds =
          Array.from(
            driverDutyPreferenceMap.keys(),
          ).filter(
            (
              userId,
            ) => {
              const reminderTime =
                driverDutyPreferenceMap.get(
                  userId,
                );
              const reminderMinutes =
                reminderTime
                  ? parseTimeToMinutes(
                      reminderTime,
                    )
                  : null;

              if (
                reminderMinutes ===
                null
              ) {
                return false;
              }

              const ageMinutes =
                jerusalemNow.minutesOfDay -
                reminderMinutes;

              return ageMinutes >= 0 &&
                ageMinutes <= 5;
            },
          );

        if (
          eligibleDriverIds.length >
          0
        ) {
          const {
            data:
              publishedDriverPeriods,
            error:
              driverPeriodsError,
          } =
            await adminClient
              .from(
                'driver_schedule_periods',
              )
              .select(
                'id',
              )
              .eq(
                'status',
                'published',
              );

          if (
            driverPeriodsError
          ) {
            errors.push(
              `driver periods: ${driverPeriodsError.message}`,
            );
          } else {
            const periodIds =
              (publishedDriverPeriods ?? [])
                .map(
                  (
                    period,
                  ) =>
                    typeof period.id ===
                      'string'
                      ? period.id
                      : null,
                )
                .filter(
                  (
                    id,
                  ): id is string =>
                    Boolean(id),
                );

            if (
              periodIds.length > 0
            ) {
              const {
                data:
                  dutyDays,
                error:
                  dutyDaysError,
              } =
                await adminClient
                  .from(
                    'driver_schedule_days',
                  )
                  .select(
                    'id,period_id,duty_date,assigned_user_id',
                  )
                  .in(
                    'period_id',
                    periodIds,
                  )
                  .eq(
                    'duty_date',
                    jerusalemNow.date,
                  )
                  .in(
                    'assigned_user_id',
                    eligibleDriverIds,
                  );

              if (
                dutyDaysError
              ) {
                errors.push(
                  `driver duty days: ${dutyDaysError.message}`,
                );
              } else {
                checked +=
                  dutyDays?.length ??
                  0;

                for (
                  const dutyDay
                  of dutyDays ?? []
                ) {
                  if (
                    typeof dutyDay.id !==
                      'string' ||
                    typeof dutyDay.assigned_user_id !==
                      'string' ||
                    typeof dutyDay.duty_date !==
                      'string'
                  ) {
                    continue;
                  }

                  const reminderTime =
                    driverDutyPreferenceMap.get(
                      dutyDay.assigned_user_id,
                    );

                  if (!reminderTime) {
                    continue;
                  }

                  const reminderKey =
                    `${dutyDay.duty_date}:${reminderTime.slice(0, 5)}`;

                  const {
                    data:
                      claimed,
                    error:
                      claimError,
                  } =
                    await adminClient
                      .from(
                        'scheduled_reminder_deliveries',
                      )
                      .insert({
                        user_id:
                          dutyDay.assigned_user_id,
                        reminder_type:
                          'driver_duty_day',
                        reminder_key:
                          reminderKey,
                        source_id:
                          dutyDay.id,
                      })
                      .select(
                        'id',
                      )
                      .maybeSingle();

                  if (
                    claimError
                  ) {
                    if (
                      claimError.code ===
                      '23505'
                    ) {
                      continue;
                    }
                    errors.push(
                      `driver claim ${dutyDay.id}: ${claimError.message}`,
                    );
                    continue;
                  }

                  if (!claimed) {
                    continue;
                  }

                  const result =
                    await deliverNotification({
                      userId:
                        dutyDay.assigned_user_id,
                      title:
                        'תזכורת לכוננות היום',
                      body:
                        'היום אתה הכונן המשובץ. כדאי לוודא שאתה זמין ומוכן לכוננות.',
                      url:
                        '/driver-schedule',
                      data: {
                        workflow:
                          'shift_reminder',
                        event:
                          'driver_duty_day_reminder',
                        dutyDayId:
                          dutyDay.id,
                        dutyDate:
                          dutyDay.duty_date,
                        reminderTime:
                          reminderTime.slice(0, 5),
                      },
                      expiresAt:
                        jerusalemLocalToUtc(
                          addDaysToIsoDate(
                            dutyDay.duty_date,
                            1,
                          ),
                          '03:00',
                        ).toISOString(),
                    });

                  if (
                    result.notificationId
                  ) {
                    await adminClient
                      .from(
                        'scheduled_reminder_deliveries',
                      )
                      .update({
                        notification_id:
                          result.notificationId,
                        delivered_at:
                          result.delivered
                            ? new Date().toISOString()
                            : null,
                      })
                      .eq(
                        'id',
                        claimed.id,
                      );
                  } else {
                    await adminClient
                      .from(
                        'scheduled_reminder_deliveries',
                      )
                      .delete()
                      .eq(
                        'id',
                        claimed.id,
                      );
                  }
                }
              }
            }
          }
        }
      }

      return jsonResponse({
        checked,
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
            error instanceof Error
              ? error.message
              : 'Unexpected shift reminder error.',
        },
        500,
      );
    }
  },
);
