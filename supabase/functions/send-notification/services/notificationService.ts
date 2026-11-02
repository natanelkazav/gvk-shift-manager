/**
 * קובץ: supabase/functions/send-notification/services/notificationService.ts
 * מטרה: מימוש שכבת השירות עבור התראות / שירות.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: NotificationDeliveryTarget, NotificationDeliveryData, RecordPushDeliveryRequest, parseNotificationRow, parseNotificationRecipientRow, parsePushSubscriptionRow, getNotification, getRecipients, getSubscriptionsByUserIds, loadNotificationDeliveryData ועוד.
 * - מקורות נתונים הנזכרים בקריאות from: notifications, notification_recipients, push_subscriptions, push_delivery_log.
 * - ריכוז הפנייה למקור הנתונים ועיבוד התשובה בהתאם לפונקציות להלן.
 */
import type {
  SupabaseClient,
} from 'npm:@supabase/supabase-js@2';

import type {
  NotificationRecipientRow,
  NotificationRow,
  PushSendResult,
  PushSubscriptionRow,
} from '../types.ts';

/**
 * חוזה הנתונים NotificationDeliveryTarget: התראות / יעד.
 */
export interface NotificationDeliveryTarget {
  recipient:
    NotificationRecipientRow;

  subscriptions:
    PushSubscriptionRow[];
}

/**
 * חוזה הנתונים NotificationDeliveryData: התראות / נתונים.
 */
export interface NotificationDeliveryData {
  // notification — התראות.
  notification:
    NotificationRow;

  targets:
    NotificationDeliveryTarget[];
}

/**
 * חוזה הנתונים RecordPushDeliveryRequest: התראות Push / נתוני הבקשה.
 */
interface RecordPushDeliveryRequest {
  // recipientId — מזהה.
  recipientId:
    string;

  // subscriptionId — מזהה.
  subscriptionId:
    string;

  // result — תוצאה.
  result:
    PushSendResult;
}

/**
 * פעולה parseNotificationRow: פענוח קלט עבור התראות / שורה.
 * @param value — ערך.
 * @returns NotificationRow — הפלט בהתאם לחתימה.
 */
function parseNotificationRow(
  value: unknown,
): NotificationRow {
  // עצירת הפעולה עם שגיאה כאשר typeof value !== 'object' || value === null.
  if (
    typeof value !==
      'object' ||
    value ===
      null
  ) {
    throw new Error(
      'נתוני ההתראה שהתקבלו מהמסד אינם תקינים.',
    );
  }

  // row — שורה.
  const row =
    value as
      Partial<NotificationRow>;

  // עצירת הפעולה עם שגיאה כאשר typeof row.id !== 'string' || typeof row.type !== 'string' || typeof row.priority !== 'string' || typeof row.source !== 'string' || typeof r.
  if (
    typeof row.id !==
      'string' ||
    typeof row.type !==
      'string' ||
    typeof row.priority !==
      'string' ||
    typeof row.source !==
      'string' ||
    typeof row.title !==
      'string' ||
    typeof row.body !==
      'string' ||
    typeof row.created_at !==
      'string' ||
    typeof row.expires_at !==
      'string'
  ) {
    throw new Error(
      'רשומת ההתראה חסרה או שאינה תקינה.',
    );
  }

  return {
    id:
      row.id,

    type:
      row.type,

    priority:
      row.priority,

    source:
      row.source,

    title:
      row.title,

    body:
      row.body,

    url:
      typeof row.url ===
        'string'
        ? row.url
        : null,

    data:
      typeof row.data ===
        'object' &&
      row.data !==
        null
        ? row.data as
            Record<
              string,
              unknown
            >
        : {},

    created_by:
      typeof row.created_by ===
        'string'
        ? row.created_by
        : null,

    created_at:
      row.created_at,

    expires_at:
      row.expires_at,
  };
}

/**
 * פעולה parseNotificationRecipientRow: פענוח קלט עבור התראות / שורה.
 * @param value — ערך.
 * @returns NotificationRecipientRow — הפלט בהתאם לחתימה.
 */
function parseNotificationRecipientRow(
  value: unknown,
): NotificationRecipientRow {
  // עצירת הפעולה עם שגיאה כאשר typeof value !== 'object' || value === null.
  if (
    typeof value !==
      'object' ||
    value ===
      null
  ) {
    throw new Error(
      'נתוני נמען ההתראה שהתקבלו מהמסד אינם תקינים.',
    );
  }

  // row — שורה.
  const row =
    value as
      Partial<NotificationRecipientRow>;

  // עצירת הפעולה עם שגיאה כאשר typeof row.id !== 'string' || typeof row.notification_id !== 'string' || typeof row.user_id !== 'string' || typeof row.is_read !== 'boolean'.
  if (
    typeof row.id !==
      'string' ||
    typeof row.notification_id !==
      'string' ||
    typeof row.user_id !==
      'string' ||
    typeof row.is_read !==
      'boolean' ||
    typeof row.delivered !==
      'boolean' ||
    typeof row.created_at !==
      'string'
  ) {
    throw new Error(
      'רשומת נמען ההתראה חסרה או שאינה תקינה.',
    );
  }

  return {
    id:
      row.id,

    notification_id:
      row.notification_id,

    user_id:
      row.user_id,

    is_read:
      row.is_read,

    delivered:
      row.delivered,

    read_at:
      typeof row.read_at ===
        'string'
        ? row.read_at
        : null,

    delivered_at:
      typeof row.delivered_at ===
        'string'
        ? row.delivered_at
        : null,

    created_at:
      row.created_at,
  };
}

/**
 * פעולה parsePushSubscriptionRow: פענוח קלט עבור התראות Push / שורה.
 * @param value — ערך.
 * @returns PushSubscriptionRow — הפלט בהתאם לחתימה.
 */
function parsePushSubscriptionRow(
  value: unknown,
): PushSubscriptionRow {
  // עצירת הפעולה עם שגיאה כאשר typeof value !== 'object' || value === null.
  if (
    typeof value !==
      'object' ||
    value ===
      null
  ) {
    throw new Error(
      'נתוני מכשיר ה־Push שהתקבלו מהמסד אינם תקינים.',
    );
  }

  // row — שורה.
  const row =
    value as
      Partial<PushSubscriptionRow>;

  // עצירת הפעולה עם שגיאה כאשר typeof row.id !== 'string' || typeof row.user_id !== 'string' || typeof row.endpoint !== 'string' || typeof row.p256dh_key !== 'string' || t.
  if (
    typeof row.id !==
      'string' ||
    typeof row.user_id !==
      'string' ||
    typeof row.endpoint !==
      'string' ||
    typeof row.p256dh_key !==
      'string' ||
    typeof row.auth_key !==
      'string' ||
    typeof row.is_active !==
      'boolean'
  ) {
    throw new Error(
      'רשומת מכשיר ה־Push חסרה או שאינה תקינה.',
    );
  }

  return {
    id:
      row.id,

    user_id:
      row.user_id,

    endpoint:
      row.endpoint,

    p256dh_key:
      row.p256dh_key,

    auth_key:
      row.auth_key,

    is_active:
      row.is_active,

    device_name:
      typeof row.device_name ===
        'string'
        ? row.device_name
        : null,

    last_used_at:
      typeof row.last_used_at ===
        'string'
        ? row.last_used_at
        : null,
  };
}

/**
 * פעולה אסינכרונית getNotification: שליפה או חישוב של התראות.
 * @param adminClient — לקוח.
 * @param notificationId — התראות / מזהה.
 * @returns Promise<NotificationRow> — הפלט בהתאם לחתימה.
 */
async function getNotification(
  adminClient:
    SupabaseClient,

  notificationId:
    string,
): Promise<NotificationRow> {
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
        [
          'id',
          'type',
          'priority',
          'source',
          'title',
          'body',
          'url',
          'data',
          'created_by',
          'created_at',
          'expires_at',
        ].join(','),
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

  // עצירת הפעולה עם שגיאה כאשר !data.
  if (
    !data
  ) {
    throw new Error(
      'ההתראה המבוקשת לא נמצאה.',
    );
  }

  // notification — התראות.
  const notification =
    parseNotificationRow(
      data,
    );

  const expiresAt =
    new Date(
      notification.expires_at,
    );

  // עצירת הפעולה עם שגיאה כאשר Number.isNaN( expiresAt.getTime(), ).
  if (
    Number.isNaN(
      expiresAt.getTime(),
    )
  ) {
    throw new Error(
      'תאריך התפוגה של ההתראה אינו תקין.',
    );
  }

  // עצירת הפעולה עם שגיאה כאשר expiresAt.getTime() <= Date.now().
  if (
    expiresAt.getTime() <=
    Date.now()
  ) {
    throw new Error(
      'תוקף ההתראה פג ולא ניתן לשלוח אותה.',
    );
  }

  return notification;
}

/**
 * פעולה אסינכרונית getRecipients: שליפה או חישוב של הנתון getRecipients בהקשר הפעולה.
 * @param adminClient — לקוח.
 * @param notificationId — התראות / מזהה.
 * @returns Promise< NotificationRecipientRow[] > — הפלט בהתאם לחתימה.
 */
async function getRecipients(
  adminClient:
    SupabaseClient,

  notificationId:
    string,
): Promise<
  NotificationRecipientRow[]
> {
  // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
  const {
    data,
    error,
  } =
    await adminClient
      .from(
        'notification_recipients',
      )
      .select(
        [
          'id',
          'notification_id',
          'user_id',
          'is_read',
          'delivered',
          'read_at',
          'delivered_at',
          'created_at',
        ].join(','),
      )
      .eq(
        'notification_id',
        notificationId,
      );

  // עצירת הפעולה עם שגיאה כאשר error.
  if (
    error
  ) {
    throw error;
  }

  return (
    data ??
    []
  ).map(
    (
      row,
    ) =>
      parseNotificationRecipientRow(
        row,
      ),
  );
}

/**
 * פעולה אסינכרונית getSubscriptionsByUserIds: שליפה או חישוב של מזהה משתמש.
 * @param adminClient — לקוח.
 * @param userIds — מזהה משתמש.
 * @returns Promise< PushSubscriptionRow[] > — הפלט בהתאם לחתימה.
 */
async function getSubscriptionsByUserIds(
  adminClient:
    SupabaseClient,

  userIds:
    string[],
): Promise<
  PushSubscriptionRow[]
> {
  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר userIds.length === 0.
  if (
    userIds.length ===
    0
  ) {
    return [];
  }

  // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
  const {
    data,
    error,
  } =
    await adminClient
      .from(
        'push_subscriptions',
      )
      .select(
        [
          'id',
          'user_id',
          'endpoint',
          'p256dh_key',
          'auth_key',
          'is_active',
          'device_name',
          'last_used_at',
        ].join(','),
      )
      .in(
        'user_id',
        userIds,
      )
      .eq(
        'is_active',
        true,
      );

  // עצירת הפעולה עם שגיאה כאשר error.
  if (
    error
  ) {
    throw error;
  }

  return (
    data ??
    []
  ).map(
    (
      row,
    ) =>
      parsePushSubscriptionRow(
        row,
      ),
  );
}

/**
 * פעולה אסינכרונית loadNotificationDeliveryData: טעינת התראות / נתונים.
 * @param adminClient — לקוח.
 * @param notificationId — התראות / מזהה.
 * @returns Promise<NotificationDeliveryData> — הפלט בהתאם לחתימה.
 */
export async function loadNotificationDeliveryData(
  adminClient:
    SupabaseClient,

  notificationId:
    string,
): Promise<NotificationDeliveryData> {
  // notification — התראות.
  const notification =
    await getNotification(
      adminClient,
      notificationId,
    );

  const recipients =
    await getRecipients(
      adminClient,
      notificationId,
    );

  // עצירת הפעולה עם שגיאה כאשר recipients.length === 0.
  if (
    recipients.length ===
    0
  ) {
    throw new Error(
      'לא נמצאו נמענים להתראה.',
    );
  }

  // userIds — מזהה משתמש.
  const userIds =
    Array.from(
      new Set(
        recipients.map(
          (
            recipient,
          ) =>
            recipient.user_id,
        ),
      ),
    );

  const subscriptions =
    await getSubscriptionsByUserIds(
      adminClient,
      userIds,
    );

  // subscriptionsByUserId — מזהה משתמש; מיפוי לחיפוש לפי מפתח.
  const subscriptionsByUserId =
    new Map<
      string,
      PushSubscriptionRow[]
    >();

  // עיבוד כל פריט מתוך subscriptions בנפרד.
  for (
    const subscription
    of subscriptions
  ) {
    const existingSubscriptions =
      subscriptionsByUserId.get(
        subscription.user_id,
      ) ??
      [];

    existingSubscriptions.push(
      subscription,
    );

    subscriptionsByUserId.set(
      subscription.user_id,
      existingSubscriptions,
    );
  }

  const targets =
    recipients.map(
      (
        recipient,
      ): NotificationDeliveryTarget => ({
        recipient,

        subscriptions:
          subscriptionsByUserId.get(
            recipient.user_id,
          ) ??
          [],
      }),
    );

  return {
    notification,

    targets,
  };
}

/**
 * פעולה אסינכרונית markRecipientDelivered: הנתון markRecipientDelivered בהקשר הפעולה.
 * @param adminClient — לקוח.
 * @param recipientId — מזהה.
 * @returns Promise<void> — הפלט בהתאם לחתימה.
 */
export async function markRecipientDelivered(
  adminClient:
    SupabaseClient,

  recipientId:
    string,
): Promise<void> {
  // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
  const {
    error,
  } =
    await adminClient
      .from(
        'notification_recipients',
      )
      .update({
        delivered:
          true,

        delivered_at:
          new Date()
            .toISOString(),
      })
      .eq(
        'id',
        recipientId,
      );

  // עצירת הפעולה עם שגיאה כאשר error.
  if (
    error
  ) {
    throw error;
  }
}

/**
 * פעולה אסינכרונית updateSubscriptionLastUsed: עדכון הנתון updateSubscriptionLastUsed בהקשר הפעולה.
 * @param adminClient — לקוח.
 * @param subscriptionId — מזהה.
 * @returns Promise<void> — הפלט בהתאם לחתימה.
 */
export async function updateSubscriptionLastUsed(
  adminClient:
    SupabaseClient,

  subscriptionId:
    string,
): Promise<void> {
  // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
  const {
    error,
  } =
    await adminClient
      .from(
        'push_subscriptions',
      )
      .update({
        last_used_at:
          new Date()
            .toISOString(),
      })
      .eq(
        'id',
        subscriptionId,
      );

  if (
    error
  ) {
    console.error(
      'Failed to update subscription last_used_at:',
      {
        subscriptionId,

        error,
      },
    );
  }
}

/**
 * פעולה אסינכרונית deactivateSubscription: הנתון deactivateSubscription בהקשר הפעולה.
 * @param adminClient — לקוח.
 * @param subscriptionId — מזהה.
 * @returns Promise<void> — הפלט בהתאם לחתימה.
 */
export async function deactivateSubscription(
  adminClient:
    SupabaseClient,

  subscriptionId:
    string,
): Promise<void> {
  // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
  const {
    error,
  } =
    await adminClient
      .from(
        'push_subscriptions',
      )
      .update({
        is_active:
          false,
      })
      .eq(
        'id',
        subscriptionId,
      );

  if (
    error
  ) {
    console.error(
      'Failed to deactivate push subscription:',
      {
        subscriptionId,

        error,
      },
    );
  }
}

/**
 * פעולה אסינכרונית recordPushDelivery: התראות Push.
 * @param adminClient — לקוח.
 * @param request — נתוני הבקשה.
 * @returns Promise<void> — הפלט בהתאם לחתימה.
 */
export async function recordPushDelivery(
  adminClient:
    SupabaseClient,

  request:
    RecordPushDeliveryRequest,
): Promise<void> {
  // status — סטטוס.
  const status =
    request.result.success
      ? 'sent'
      : 'failed';

  // response — תוצאת הפעולה.
  const response =
    request.result.success
      ? {
          success:
            true,
        }
      : {
          success:
            false,

          statusCode:
            request.result
              .statusCode,

          message:
            request.result
              .message,

          isExpired:
            request.result
              .isExpired,
        };

  // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
  const {
    error,
  } =
    await adminClient
      .from(
        'push_delivery_log',
      )
      .insert({
        recipient_id:
          request.recipientId,

        subscription_id:
          request.subscriptionId,

        status,

        response,
      });

  if (
    error
  ) {
    console.error(
      'Failed to write push delivery log:',
      {
        recipientId:
          request.recipientId,

        subscriptionId:
          request.subscriptionId,

        error,
      },
    );
  }
}