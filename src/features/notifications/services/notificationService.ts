import {
  FunctionsHttpError,
} from '@supabase/supabase-js';

import {
  supabase,
} from '../../../lib/supabase';

import type {
  NotificationPriority,
  NotificationType,
} from '../types/notificationTypes';

export interface CreateNotificationRequest {
  userIds:
    string[];

  type:
    NotificationType;

  priority:
    NotificationPriority;

  title:
    string;

  body:
    string;

  url?:
    string;

  data?:
    Record<string, unknown>;

  source?:
    string;

  expiresAt?:
    string;
}

export interface NotificationDeliveryResult {
  success:
    boolean;

  notificationId:
    string;

  sentBy:
    string;

  totalRecipients:
    number;

  recipientsWithDevices:
    number;

  recipientsDelivered:
    number;

  recipientsWithoutDevices:
    number;

  totalDevices:
    number;

  sent:
    number;

  failed:
    number;
}

export interface MyNotification {
  recipientId:
    string;

  notificationId:
    string;

  type:
    string;

  priority:
    string;

  source:
    string;

  title:
    string;

  body:
    string;

  url:
    string | null;

  data:
    Record<string, unknown>;

  isRead:
    boolean;

  readAt:
    string | null;

  delivered:
    boolean;

  deliveredAt:
    string | null;

  createdAt:
    string;

  expiresAt:
    string;
}

interface NotificationInsertRow {
  id:
    string;
}

interface NotificationDatabaseRow {
  id:
    string;

  type:
    string;

  priority:
    string;

  source:
    string;

  title:
    string;

  body:
    string;

  url:
    string | null;

  data:
    Record<string, unknown> | null;

  created_at:
    string;

  expires_at:
    string;
}

interface NotificationRecipientDatabaseRow {
  id:
    string;

  notification_id:
    string;

  is_read:
    boolean;

  read_at:
    string | null;

  delivered:
    boolean;

  delivered_at:
    string | null;

  notification:
    NotificationDatabaseRow |
    NotificationDatabaseRow[] |
    null;
}

interface ValidatedCreateRequest {
  userIds:
    string[];

  title:
    string;

  body:
    string;

  url:
    string | null;

  source:
    string;

  expiresAt:
    string | null;
}

function validateCreateRequest(
  request:
    CreateNotificationRequest,
): ValidatedCreateRequest {
  const userIds =
    Array.from(
      new Set(
        request.userIds
          .map(
            (
              userId,
            ) =>
              userId.trim(),
          )
          .filter(
            Boolean,
          ),
      ),
    );

  if (
    userIds.length ===
    0
  ) {
    throw new Error(
      'יש לבחור לפחות משתמש אחד לקבלת ההתראה.',
    );
  }

  const title =
    request.title.trim();

  if (
    !title
  ) {
    throw new Error(
      'יש להזין כותרת להתראה.',
    );
  }

  if (
    title.length >
    120
  ) {
    throw new Error(
      'כותרת ההתראה יכולה להכיל עד 120 תווים.',
    );
  }

  const body =
    request.body.trim();

  if (
    !body
  ) {
    throw new Error(
      'יש להזין תוכן להתראה.',
    );
  }

  if (
    body.length >
    500
  ) {
    throw new Error(
      'תוכן ההתראה יכול להכיל עד 500 תווים.',
    );
  }

  const url =
    request.url
      ?.trim() ||
    null;

  if (
    url &&
    !url.startsWith('/')
  ) {
    throw new Error(
      'כתובת הפתיחה חייבת להיות נתיב פנימי שמתחיל ב־/.',
    );
  }

  const source =
    request.source
      ?.trim() ||
    'manager';

  const expiresAt =
    request.expiresAt
      ?.trim() ||
    null;

  if (
    expiresAt
  ) {
    const parsedExpiration =
      new Date(
        expiresAt,
      );

    if (
      Number.isNaN(
        parsedExpiration.getTime(),
      )
    ) {
      throw new Error(
        'תאריך התפוגה של ההתראה אינו תקין.',
      );
    }

    if (
      parsedExpiration.getTime() <=
      Date.now()
    ) {
      throw new Error(
        'תאריך התפוגה חייב להיות בעתיד.',
      );
    }
  }

  return {
    userIds,

    title,

    body,

    url,

    source,

    expiresAt,
  };
}

function parseNotificationInsertRow(
  value:
    unknown,
): NotificationInsertRow {
  if (
    typeof value !==
      'object' ||
    value ===
      null
  ) {
    throw new Error(
      'התקבלה תשובה לא תקינה בעת יצירת ההתראה.',
    );
  }

  const row =
    value as {
      id?: unknown;
    };

  if (
    typeof row.id !==
      'string'
  ) {
    throw new Error(
      'מזהה ההתראה לא התקבל מהשרת.',
    );
  }

  return {
    id:
      row.id,
  };
}

function parseDeliveryResult(
  value:
    unknown,
): NotificationDeliveryResult {
  if (
    typeof value !==
      'object' ||
    value ===
      null
  ) {
    throw new Error(
      'התקבלה תשובה לא תקינה ממנגנון שליחת ההתראות.',
    );
  }

  const result =
    value as
      Partial<NotificationDeliveryResult> & {
        error?: unknown;
      };

  if (
    typeof result.error ===
      'string' &&
    result.error.trim()
  ) {
    throw new Error(
      result.error,
    );
  }

  if (
    typeof result.success !==
      'boolean' ||
    typeof result.notificationId !==
      'string' ||
    typeof result.sentBy !==
      'string' ||
    typeof result.totalRecipients !==
      'number' ||
    typeof result.recipientsWithDevices !==
      'number' ||
    typeof result.recipientsDelivered !==
      'number' ||
    typeof result.recipientsWithoutDevices !==
      'number' ||
    typeof result.totalDevices !==
      'number' ||
    typeof result.sent !==
      'number' ||
    typeof result.failed !==
      'number'
  ) {
    throw new Error(
      'סיכום שליחת ההתראה חסר או אינו תקין.',
    );
  }

  return {
    success:
      result.success,

    notificationId:
      result.notificationId,

    sentBy:
      result.sentBy,

    totalRecipients:
      result.totalRecipients,

    recipientsWithDevices:
      result.recipientsWithDevices,

    recipientsDelivered:
      result.recipientsDelivered,

    recipientsWithoutDevices:
      result.recipientsWithoutDevices,

    totalDevices:
      result.totalDevices,

    sent:
      result.sent,

    failed:
      result.failed,
  };
}

async function getFunctionErrorMessage(
  error:
    FunctionsHttpError,
): Promise<string> {
  try {
    const responseBody =
      await error.context
        .json() as {
          error?: unknown;
        };

    if (
      typeof responseBody.error ===
        'string' &&
      responseBody.error.trim()
    ) {
      return responseBody.error;
    }
  } catch {
    // נחזיר את הודעת ברירת המחדל.
  }

  return (
    error.message ||
    'שליחת ההתראה נכשלה.'
  );
}

async function getAuthenticatedUserId():
  Promise<string> {
  const {
    data,
    error,
  } =
    await supabase.auth
      .getUser();

  if (
    error
  ) {
    throw error;
  }

  if (
    !data.user
  ) {
    throw new Error(
      'לא נמצא משתמש מחובר.',
    );
  }

  return data.user.id;
}

function extractNotificationRow(
  value:
    NotificationRecipientDatabaseRow[
      'notification'
    ],
): NotificationDatabaseRow | null {
  if (
    Array.isArray(
      value,
    )
  ) {
    return (
      value[0] ??
      null
    );
  }

  return value;
}

function mapMyNotification(
  row:
    NotificationRecipientDatabaseRow,
): MyNotification | null {
  const notification =
    extractNotificationRow(
      row.notification,
    );

  if (
    !notification
  ) {
    return null;
  }

  return {
    recipientId:
      row.id,

    notificationId:
      notification.id,

    type:
      notification.type,

    priority:
      notification.priority,

    source:
      notification.source,

    title:
      notification.title,

    body:
      notification.body,

    url:
      notification.url,

    data:
      notification.data ??
      {},

    isRead:
      row.is_read,

    readAt:
      row.read_at,

    delivered:
      row.delivered,

    deliveredAt:
      row.delivered_at,

    createdAt:
      notification.created_at,

    expiresAt:
      notification.expires_at,
  };
}

function isNotificationActive(
  notification:
    MyNotification,
): boolean {
  const expiresAt =
    new Date(
      notification.expiresAt,
    );

  return (
    !Number.isNaN(
      expiresAt.getTime(),
    ) &&
    expiresAt.getTime() >
      Date.now()
  );
}

class NotificationService {
  async createNotification(
    request:
      CreateNotificationRequest,
  ): Promise<NotificationDeliveryResult> {
    const validatedRequest =
      validateCreateRequest(
        request,
      );

    const authenticatedUserId =
      await getAuthenticatedUserId();

    const notificationInsert = {
      type:
        request.type,

      priority:
        request.priority,

      source:
        validatedRequest.source,

      title:
        validatedRequest.title,

      body:
        validatedRequest.body,

      url:
        validatedRequest.url,

      data:
        request.data ??
        {},

      created_by:
        authenticatedUserId,

      ...(
        validatedRequest.expiresAt
          ? {
              expires_at:
                validatedRequest
                  .expiresAt,
            }
          : {}
      ),
    };

    const {
      data:
        notificationData,

      error:
        notificationError,
    } =
      await supabase
        .from(
          'notifications',
        )
        .insert(
          notificationInsert,
        )
        .select(
          'id',
        )
        .single();

    if (
      notificationError
    ) {
      throw notificationError;
    }

    const notification =
      parseNotificationInsertRow(
        notificationData,
      );

    const recipients =
      validatedRequest.userIds
        .map(
          (
            userId,
          ) => ({
            notification_id:
              notification.id,

            user_id:
              userId,
          }),
        );

    const {
      error:
        recipientsError,
    } =
      await supabase
        .from(
          'notification_recipients',
        )
        .insert(
          recipients,
        );

    if (
      recipientsError
    ) {
      const {
        error:
          cleanupError,
      } =
        await supabase
          .from(
            'notifications',
          )
          .delete()
          .eq(
            'id',
            notification.id,
          );

      if (
        cleanupError
      ) {
        console.error(
          'Failed to remove notification after recipient creation failure:',
          {
            notificationId:
              notification.id,

            cleanupError,
          },
        );
      }

      throw recipientsError;
    }

    const {
      data:
        deliveryData,

      error:
        deliveryError,
    } =
      await supabase.functions
        .invoke(
          'send-notification',
          {
            body: {
              notificationId:
                notification.id,
            },
          },
        );

    if (
      deliveryError
    ) {
      if (
        deliveryError instanceof
          FunctionsHttpError
      ) {
        throw new Error(
          await getFunctionErrorMessage(
            deliveryError,
          ),
        );
      }

      throw new Error(
        deliveryError.message ||
          'שליחת ההתראה נכשלה.',
      );
    }

    return parseDeliveryResult(
      deliveryData,
    );
  }

  async getMyNotifications():
    Promise<MyNotification[]> {
    const authenticatedUserId =
      await getAuthenticatedUserId();

    const {
      data,
      error,
    } =
      await supabase
        .from(
          'notification_recipients',
        )
        .select(
          `
            id,
            notification_id,
            is_read,
            read_at,
            delivered,
            delivered_at,
            notification:notifications (
              id,
              type,
              priority,
              source,
              title,
              body,
              url,
              data,
              created_at,
              expires_at
            )
          `,
        )
        .eq(
          'user_id',
          authenticatedUserId,
        );

    if (
      error
    ) {
      throw error;
    }

    return (
      data ??
      []
    )
      .map(
        (
          row,
        ) =>
          mapMyNotification(
            row as unknown as
              NotificationRecipientDatabaseRow,
          ),
      )
      .filter(
        (
          notification,
        ): notification is MyNotification =>
          notification !==
            null &&
          isNotificationActive(
            notification,
          ),
      )
      .sort(
        (
          first,
          second,
        ) =>
          new Date(
            second.createdAt,
          ).getTime() -
          new Date(
            first.createdAt,
          ).getTime(),
      );
  }

  async getUnreadCount():
    Promise<number> {
    const notifications =
      await this
        .getMyNotifications();

    return notifications.filter(
      (
        notification,
      ) =>
        !notification.isRead,
    ).length;
  }

  async markAsRead(
    recipientId:
      string,
  ): Promise<void> {
    const normalizedRecipientId =
      recipientId.trim();

    if (
      !normalizedRecipientId
    ) {
      throw new Error(
        'לא התקבל מזהה נמען התראה.',
      );
    }

    const {
      error,
    } =
      await supabase
        .from(
          'notification_recipients',
        )
        .update({
          is_read:
            true,

          read_at:
            new Date()
              .toISOString(),
        })
        .eq(
          'id',
          normalizedRecipientId,
        )
        .eq(
          'is_read',
          false,
        );

    if (
      error
    ) {
      throw error;
    }
  }

  async markAllAsRead():
    Promise<void> {
    const authenticatedUserId =
      await getAuthenticatedUserId();

    const {
      error,
    } =
      await supabase
        .from(
          'notification_recipients',
        )
        .update({
          is_read:
            true,

          read_at:
            new Date()
              .toISOString(),
        })
        .eq(
          'user_id',
          authenticatedUserId,
        )
        .eq(
          'is_read',
          false,
        );

    if (
      error
    ) {
      throw error;
    }
  }
}

export const notificationService =
  new NotificationService();