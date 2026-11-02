/**
 * קובץ: supabase/functions/unified-schedule-edit-action/index.ts
 * מטרה: טיפול בבקשות HTTP לפעולת השרת unified-schedule-edit-action.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: EditableCategory, EditRequest, NotificationContext, createJsonResponse, getRequiredEnvironmentVariable, getString, getInteger, getJerusalemCurrentMonth, hasPermission, createNotification ועוד.
 * - קריאות RPC המופעלות בקובץ: get_driver_schedule_draft, update_current_driver_schedule_day, get_morning_driver_schedule, update_morning_driver_schedule_assignment.
 * - מקורות נתונים הנזכרים בקריאות from: user_permissions, notifications, notification_recipients, profiles, audit_logs.
 * - ריכוז ההגדרות והלוגיקה המפורטות בהמשך הקובץ.
 */
import {
  createClient,
  type SupabaseClient,
} from 'npm:@supabase/supabase-js@2';

/**
 * טיפוס EditableCategory: הנתון EditableCategory בהקשר הפעולה.
 */
type EditableCategory =
  | 'on_call'
  | 'morning_driver';

/**
 * חוזה הנתונים EditRequest: נתוני הבקשה.
 */
interface EditRequest {
  category?: unknown;
  // sourceId — מקור / מזהה (אופציונלי).
  sourceId?: unknown;
  // year — שנה (אופציונלי).
  year?: unknown;
  // month — חודש (אופציונלי).
  month?: unknown;
  // newUserId — מזהה העובד לאחר השינוי (אופציונלי).
  newUserId?: unknown;
  reason?: unknown;
}

/**
 * חוזה הנתונים NotificationContext: התראות.
 */
interface NotificationContext {
  category:
    EditableCategory;
  // sourceId — מקור / מזהה.
  sourceId:
    string;
  // date — תאריך.
  date:
    string;
  // timeLabel — זמן / תווית.
  timeLabel:
    string | null;
  // oldUserId — מזהה משתמש.
  oldUserId:
    string | null;
  // oldUserName — משתמש / שם.
  oldUserName:
    string | null;
  // newUserId — מזהה העובד לאחר השינוי.
  newUserId:
    string;
  // newUserName — משתמש / שם.
  newUserName:
    string | null;
  reason:
    string | null;
}

// corsHeaders — הנתון corsHeaders בהקשר הפעולה.
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

  return value.trim() ||
    null;
}

/**
 * פעולה getInteger: שליפה או חישוב של הנתון getInteger בהקשר הפעולה.
 * @param value — ערך.
 * @returns number | null — הפלט בהתאם לחתימה.
 */
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

/**
 * פעולה getJerusalemCurrentMonth: שליפה או חישוב של חודש.
 * @returns { year: number; month: number; } — הפלט בהתאם לחתימה.
 */
function getJerusalemCurrentMonth(): {
  // year — שנה.
  year: number;
  // month — חודש.
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

  // year — שנה.
  const year =
    Number(
      parts.find(
        (part) =>
          part.type ===
            'year',
      )?.value,
    );

  // month — חודש.
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
  userId: string,
  permissionKey: string,
): Promise<boolean> {
  // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
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

  // עצירת הפעולה עם שגיאה כאשר error.
  if (error) {
    throw error;
  }

  return Boolean(data);
}

/**
 * פעולה אסינכרונית createNotification: יצירת התראות.
 * @param adminClient — לקוח.
 * @param actorUserId — מזהה משתמש.
 * @param context — הנתון context בהקשר הפעולה.
 * @param targetUserId — מזהה משתמש היעד.
 * @param title — כותרת.
 * @param body — תוכן.
 * @returns Promise<string> — הפלט בהתאם לחתימה.
 */
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

  // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
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

  // עצירת הפעולה עם שגיאה כאשר notificationError || !notification.
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

  // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
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

  // עצירת הפעולה עם שגיאה כאשר recipientError.
  if (recipientError) {
    throw recipientError;
  }

  return notification.id as
    string;
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
  if (response.ok) {
    return;
  }

  // body — תוכן.
  const body =
    await response
      .text()
      .catch(() => '');

  throw new Error(
    `Push delivery failed (${response.status}). ${body}`,
  );
}

/**
 * פעולה buildDateLabel: הרכבת תאריך / תווית.
 * @param date — תאריך.
 * @param timeLabel — זמן / תווית.
 * @returns string — הפלט בהתאם לחתימה.
 */
function buildDateLabel(
  date: string,
  timeLabel:
    string | null,
): string {
  return timeLabel
    ? `${date}, ${timeLabel}`
    : date;
}

/**
 * פעולה אסינכרונית createChangeNotifications: יצירת התראות.
 * @param adminClient — לקוח.
 * @param actorUserId — מזהה משתמש.
 * @param context — הנתון context בהקשר הפעולה.
 * @returns Promise<string[]> — הפלט בהתאם לחתימה.
 */
async function createChangeNotifications(
  adminClient:
    SupabaseClient,
  actorUserId: string,
  context:
    NotificationContext,
): Promise<string[]> {
  // notificationIds — התראות.
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
        request.headers
          .get('Authorization')
          ?.trim();

      // עצירת הפעולה עם שגיאה כאשר !authorizationHeader.
      if (!authorizationHeader) {
        throw new Error(
          'לא נמצאה התחברות פעילה.',
        );
      }

      // rawBody — תוכן.
      const rawBody =
        await request.json() as
          EditRequest;

      const category =
        getString(
          rawBody.category,
        );
      // sourceId — מקור / מזהה.
      const sourceId =
        getString(
          rawBody.sourceId,
        );
      // year — שנה.
      const year =
        getInteger(
          rawBody.year,
        );
      // month — חודש.
      const month =
        getInteger(
          rawBody.month,
        );
      // newUserId — מזהה העובד לאחר השינוי.
      const newUserId =
        getString(
          rawBody.newUserId,
        );
      const reason =
        getString(
          rawBody.reason,
        );

      // עצירת הפעולה עם שגיאה כאשר ( category !== 'on_call' && category !== 'morning_driver' ) || !sourceId || !year || !month || !newUserId.
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

      // currentMonth — חודש.
      const currentMonth =
        getJerusalemCurrentMonth();

      // currentPeriodValue — תקופה / ערך.
      const currentPeriodValue =
        currentMonth.year * 12 +
        currentMonth.month - 1;

      // requestedPeriodValue — תקופה / ערך.
      const requestedPeriodValue =
        year * 12 +
        month - 1;

      // עצירת הפעולה עם שגיאה כאשר requestedPeriodValue !== currentPeriodValue && requestedPeriodValue !== currentPeriodValue + 1.
      if (
        requestedPeriodValue !==
          currentPeriodValue &&
        requestedPeriodValue !==
          currentPeriodValue + 1
      ) {
        throw new Error(
          'ניתן לערוך כוננים וכונני בוקר רק בחודש הנוכחי או בחודש הבא.',
        );
      }

      // userClient — משתמש / לקוח.
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

      // adminClient — לקוח.
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

      // actorUserId — מזהה משתמש.
      const actorUserId =
        userData.user.id;

      // permissionKey — מפתח ההרשאה.
      const permissionKey =
        category ===
          'on_call'
          ? 'driver_schedule.edit_any'
          : 'morning_driver_schedule.edit_any';

      // עצירת הפעולה עם שגיאה כאשר !await hasPermission( adminClient, actorUserId, permissionKey, ).
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
      // result — תוצאה.
      let result:
        Record<string, unknown>;

      if (
        category ===
          'on_call'
      ) {
        // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
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

        // עצירת הפעולה עם שגיאה כאשר scheduleError.
        if (scheduleError) {
          throw scheduleError;
        }

        // schedule — שיבוץ.
        const schedule =
          scheduleData as {
            // period — תקופה (אופציונלי).
            period?: {
              // status — סטטוס (אופציונלי).
              status?: unknown;
            };
            // days — ימים (אופציונלי).
            days?: Array<{
              // id — מזהה (אופציונלי).
              id?: unknown;
              // dutyDate — תאריך (אופציונלי).
              dutyDate?: unknown;
              // assignedUserId — מזהה העובד המשובץ (אופציונלי).
              assignedUserId?: unknown;
              // assignedUserName — משתמש / שם (אופציונלי).
              assignedUserName?: unknown;
              // isLocked — האם הרשומה נעולה (אופציונלי).
              isLocked?: unknown;
              // notes — הערות (אופציונלי).
              notes?: unknown;
            }>;
          } | null;

        // עצירת הפעולה עם שגיאה כאשר schedule?.period?.status !== 'published'.
        if (
          schedule?.period?.status !==
            'published'
        ) {
          throw new Error(
            'ניתן לערוך כאן רק לוח כוננים שפורסם.',
          );
        }

        // day — יום.
        const day =
          schedule.days?.find(
            (candidate) =>
              candidate.id ===
                sourceId,
          );

        // עצירת הפעולה עם שגיאה כאשר !day.
        if (!day) {
          throw new Error(
            'יום הכוננות לא נמצא.',
          );
        }

        // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
        const {
          data:
            updateData,
          error:
            updateError,
        } =
          await userClient.rpc(
            'update_current_driver_schedule_day',
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

        // עצירת הפעולה עם שגיאה כאשר updateError.
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
        // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
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

        // עצירת הפעולה עם שגיאה כאשר scheduleError.
        if (scheduleError) {
          throw scheduleError;
        }

        // schedule — שיבוץ.
        const schedule =
          scheduleData as {
            // period — תקופה (אופציונלי).
            period?: {
              // status — סטטוס (אופציונלי).
              status?: unknown;
            };
            // assignments — הקצאות (אופציונלי).
            assignments?: Array<{
              // id — מזהה (אופציונלי).
              id?: unknown;
              // shiftDate — תאריך המשמרת (אופציונלי).
              shiftDate?: unknown;
              // startTime — שעת התחלה (אופציונלי).
              startTime?: unknown;
              // endTime — שעת סיום (אופציונלי).
              endTime?: unknown;
              // assignedUserId — מזהה העובד המשובץ (אופציונלי).
              assignedUserId?: unknown;
              // assignedUserName — משתמש / שם (אופציונלי).
              assignedUserName?: unknown;
              // isLocked — האם הרשומה נעולה (אופציונלי).
              isLocked?: unknown;
              // notes — הערות (אופציונלי).
              notes?: unknown;
            }>;
          } | null;

        // עצירת הפעולה עם שגיאה כאשר schedule?.period?.status !== 'published'.
        if (
          schedule?.period?.status !==
            'published'
        ) {
          throw new Error(
            'ניתן לערוך כאן רק לוח כונני בוקר שפורסם.',
          );
        }

        // assignment — הקצאה.
        const assignment =
          schedule.assignments?.find(
            (candidate) =>
              candidate.id ===
                sourceId,
          );

        // עצירת הפעולה עם שגיאה כאשר !assignment.
        if (!assignment) {
          throw new Error(
            'משמרת כונן הבוקר לא נמצאה.',
          );
        }

        // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
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

        // עצירת הפעולה עם שגיאה כאשר updateError.
        if (updateError) {
          throw updateError;
        }

        result =
          updateData as
            Record<string, unknown>;

        // startTime — שעת התחלה.
        const startTime =
          getString(
            assignment.startTime,
          );
        // endTime — שעת סיום.
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

      // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
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
            context.newUserId,
          )
          .maybeSingle();

      // auditAction — יומן שינויים.
      const auditAction =
        context.category ===
          'on_call'
          ? 'driver_schedule_updated'
          : 'morning_driver_schedule_updated';

      const entityType =
        context.category ===
          'on_call'
          ? 'driver_schedule_day'
          : 'morning_driver_schedule_assignment';

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
              userData.user.email ??
              null,

            actor_display_name:
              actorProfile
                ?.display_name ??
              null,

            target_user_id:
              context.newUserId,

            target_email:
              targetProfile?.email ??
              null,

            target_display_name:
              targetProfile
                ?.display_name ??
              context.newUserName,

            entity_type:
              entityType,

            entity_id:
              context.sourceId,

            summary:
              context.category ===
                'on_call'
                ? `שונה שיבוץ כונן בתאריך ${context.date}`
                : `שונה שיבוץ כונן בוקר בתאריך ${context.date}`,

            old_values: {
              assigned_user_id:
                context.oldUserId,

              assigned_user_name:
                context.oldUserName,
            },

            new_values: {
              assigned_user_id:
                context.newUserId,

              assigned_user_name:
                context.newUserName,
            },

            metadata: {
              source:
                'unified-schedule-edit-action',

              category:
                context.category,

              date:
                context.date,

              time_label:
                context.timeLabel,

              reason:
                context.reason,
            },
          });

      if (
        auditLogError
      ) {
        console.error(
          'UNIFIED SCHEDULE EDIT AUDIT LOG ERROR:',
          auditLogError,
        );
      }

      // notificationIds — התראות.
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
