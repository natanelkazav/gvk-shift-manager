import type {
  SupabaseClient,
} from 'npm:@supabase/supabase-js@2';

import type {
  NotificationRecipientRow,
  NotificationRow,
  PushSendResult,
  PushSubscriptionRow,
} from '../types.ts';

export interface NotificationDeliveryTarget {
  recipient:
    NotificationRecipientRow;

  subscriptions:
    PushSubscriptionRow[];
}

export interface NotificationDeliveryData {
  notification:
    NotificationRow;

  targets:
    NotificationDeliveryTarget[];
}

interface RecordPushDeliveryRequest {
  recipientId:
    string;

  subscriptionId:
    string;

  result:
    PushSendResult;
}

function parseNotificationRow(
  value: unknown,
): NotificationRow {
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

  const row =
    value as
      Partial<NotificationRow>;

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

function parseNotificationRecipientRow(
  value: unknown,
): NotificationRecipientRow {
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

  const row =
    value as
      Partial<NotificationRecipientRow>;

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

function parsePushSubscriptionRow(
  value: unknown,
): PushSubscriptionRow {
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

  const row =
    value as
      Partial<PushSubscriptionRow>;

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

async function getNotification(
  adminClient:
    SupabaseClient,

  notificationId:
    string,
): Promise<NotificationRow> {
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

  if (
    error
  ) {
    throw error;
  }

  if (
    !data
  ) {
    throw new Error(
      'ההתראה המבוקשת לא נמצאה.',
    );
  }

  const notification =
    parseNotificationRow(
      data,
    );

  const expiresAt =
    new Date(
      notification.expires_at,
    );

  if (
    Number.isNaN(
      expiresAt.getTime(),
    )
  ) {
    throw new Error(
      'תאריך התפוגה של ההתראה אינו תקין.',
    );
  }

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

async function getRecipients(
  adminClient:
    SupabaseClient,

  notificationId:
    string,
): Promise<
  NotificationRecipientRow[]
> {
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

async function getSubscriptionsByUserIds(
  adminClient:
    SupabaseClient,

  userIds:
    string[],
): Promise<
  PushSubscriptionRow[]
> {
  if (
    userIds.length ===
    0
  ) {
    return [];
  }

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

export async function loadNotificationDeliveryData(
  adminClient:
    SupabaseClient,

  notificationId:
    string,
): Promise<NotificationDeliveryData> {
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

  if (
    recipients.length ===
    0
  ) {
    throw new Error(
      'לא נמצאו נמענים להתראה.',
    );
  }

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

  const subscriptionsByUserId =
    new Map<
      string,
      PushSubscriptionRow[]
    >();

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

export async function markRecipientDelivered(
  adminClient:
    SupabaseClient,

  recipientId:
    string,
): Promise<void> {
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

  if (
    error
  ) {
    throw error;
  }
}

export async function updateSubscriptionLastUsed(
  adminClient:
    SupabaseClient,

  subscriptionId:
    string,
): Promise<void> {
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

export async function deactivateSubscription(
  adminClient:
    SupabaseClient,

  subscriptionId:
    string,
): Promise<void> {
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

export async function recordPushDelivery(
  adminClient:
    SupabaseClient,

  request:
    RecordPushDeliveryRequest,
): Promise<void> {
  const status =
    request.result.success
      ? 'sent'
      : 'failed';

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