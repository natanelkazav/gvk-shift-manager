/**
 * קובץ: src/features/notifications/services/notificationService.ts
 * מטרה: מימוש שכבת השירות עבור התראות / שירות.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: CreateNotificationRequest, NotificationDeliveryResult, MyNotification, NotificationInsertRow, NotificationDatabaseRow, NotificationRecipientDatabaseRow, ValidatedCreateRequest, validateCreateRequest, parseNotificationInsertRow, parseDeliveryResult ועוד.
 * - מקורות נתונים הנזכרים בקריאות from: notifications, notification_recipients.
 * - ריכוז הפנייה למקור הנתונים ועיבוד התשובה בהתאם לפונקציות להלן.
 */
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

/**
 * חוזה הנתונים CreateNotificationRequest: התראות / נתוני הבקשה.
 */
export interface CreateNotificationRequest {
  // userIds — מזהה משתמש.
  userIds:
    string[];

  type:
    NotificationType;

  priority:
    NotificationPriority;

  // title — כותרת.
  title:
    string;

  // body — תוכן.
  body:
    string;

  // url — כתובת יעד (אופציונלי).
  url?:
    string;

  // data — נתונים (אופציונלי).
  data?:
    Record<string, unknown>;

  // source — מקור (אופציונלי).
  source?:
    string;

  expiresAt?:
    string;
}

/**
 * חוזה הנתונים NotificationDeliveryResult: התראות / תוצאה.
 */
export interface NotificationDeliveryResult {
  success:
    boolean;

  // notificationId — התראות / מזהה.
  notificationId:
    string;

  sentBy:
    string;

  // totalRecipients — סך הכול.
  totalRecipients:
    number;

  recipientsWithDevices:
    number;

  recipientsDelivered:
    number;

  recipientsWithoutDevices:
    number;

  // totalDevices — סך הכול.
  totalDevices:
    number;

  sent:
    number;

  failed:
    number;
}

/**
 * חוזה הנתונים MyNotification: התראות.
 */
export interface MyNotification {
  // recipientId — מזהה.
  recipientId:
    string;

  // notificationId — התראות / מזהה.
  notificationId:
    string;

  type:
    string;

  priority:
    string;

  // source — מקור.
  source:
    string;

  // title — כותרת.
  title:
    string;

  // body — תוכן.
  body:
    string;

  // url — כתובת יעד.
  url:
    string | null;

  // data — נתונים.
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

  // createdAt — מועד יצירה.
  createdAt:
    string;

  expiresAt:
    string;
}

/**
 * חוזה הנתונים NotificationInsertRow: התראות / שורה.
 */
interface NotificationInsertRow {
  // id — מזהה.
  id:
    string;
}

/**
 * חוזה הנתונים NotificationDatabaseRow: התראות / שורה.
 */
interface NotificationDatabaseRow {
  // id — מזהה.
  id:
    string;

  type:
    string;

  priority:
    string;

  // source — מקור.
  source:
    string;

  // title — כותרת.
  title:
    string;

  // body — תוכן.
  body:
    string;

  // url — כתובת יעד.
  url:
    string | null;

  // data — נתונים.
  data:
    Record<string, unknown> | null;

  // created_at — מועד יצירה.
  created_at:
    string;

  expires_at:
    string;
}

/**
 * חוזה הנתונים NotificationRecipientDatabaseRow: התראות / שורה.
 */
interface NotificationRecipientDatabaseRow {
  // id — מזהה.
  id:
    string;

  // notification_id — התראות / מזהה.
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

  // notification — התראות.
  notification:
    NotificationDatabaseRow |
    NotificationDatabaseRow[] |
    null;
}

/**
 * חוזה הנתונים ValidatedCreateRequest: נתוני הבקשה.
 */
interface ValidatedCreateRequest {
  // userIds — מזהה משתמש.
  userIds:
    string[];

  // title — כותרת.
  title:
    string;

  // body — תוכן.
  body:
    string;

  // url — כתובת יעד.
  url:
    string | null;

  // source — מקור.
  source:
    string;

  expiresAt:
    string | null;
}

/**
 * פעולה validateCreateRequest: בדיקת תקינות של נתוני הבקשה.
 * @param request — נתוני הבקשה.
 * @returns ValidatedCreateRequest — הפלט בהתאם לחתימה.
 */
function validateCreateRequest(
  request:
    CreateNotificationRequest,
): ValidatedCreateRequest {
  // userIds — מזהה משתמש.
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

  // עצירת הפעולה עם שגיאה כאשר userIds.length === 0.
  if (
    userIds.length ===
    0
  ) {
    throw new Error(
      'יש לבחור לפחות משתמש אחד לקבלת ההתראה.',
    );
  }

  // title — כותרת.
  const title =
    request.title.trim();

  // עצירת הפעולה עם שגיאה כאשר !title.
  if (
    !title
  ) {
    throw new Error(
      'יש להזין כותרת להתראה.',
    );
  }

  // עצירת הפעולה עם שגיאה כאשר title.length > 120.
  if (
    title.length >
    120
  ) {
    throw new Error(
      'כותרת ההתראה יכולה להכיל עד 120 תווים.',
    );
  }

  // body — תוכן.
  const body =
    request.body.trim();

  // עצירת הפעולה עם שגיאה כאשר !body.
  if (
    !body
  ) {
    throw new Error(
      'יש להזין תוכן להתראה.',
    );
  }

  // עצירת הפעולה עם שגיאה כאשר body.length > 500.
  if (
    body.length >
    500
  ) {
    throw new Error(
      'תוכן ההתראה יכול להכיל עד 500 תווים.',
    );
  }

  // url — כתובת יעד.
  const url =
    request.url
      ?.trim() ||
    null;

  // עצירת הפעולה עם שגיאה כאשר url && !url.startsWith('/').
  if (
    url &&
    !url.startsWith('/')
  ) {
    throw new Error(
      'כתובת הפתיחה חייבת להיות נתיב פנימי שמתחיל ב־/.',
    );
  }

  // source — מקור.
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

    // עצירת הפעולה עם שגיאה כאשר Number.isNaN( parsedExpiration.getTime(), ).
    if (
      Number.isNaN(
        parsedExpiration.getTime(),
      )
    ) {
      throw new Error(
        'תאריך התפוגה של ההתראה אינו תקין.',
      );
    }

    // עצירת הפעולה עם שגיאה כאשר parsedExpiration.getTime() <= Date.now().
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

/**
 * פעולה parseNotificationInsertRow: פענוח קלט עבור התראות / שורה.
 * @param value — ערך.
 * @returns NotificationInsertRow — הפלט בהתאם לחתימה.
 */
function parseNotificationInsertRow(
  value:
    unknown,
): NotificationInsertRow {
  // עצירת הפעולה עם שגיאה כאשר typeof value !== 'object' || value === null.
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

  // row — שורה.
  const row =
    value as {
      // id — מזהה (אופציונלי).
      id?: unknown;
    };

  // עצירת הפעולה עם שגיאה כאשר typeof row.id !== 'string'.
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

/**
 * פעולה parseDeliveryResult: פענוח קלט עבור תוצאה.
 * @param value — ערך.
 * @returns NotificationDeliveryResult — הפלט בהתאם לחתימה.
 */
function parseDeliveryResult(
  value:
    unknown,
): NotificationDeliveryResult {
  // עצירת הפעולה עם שגיאה כאשר typeof value !== 'object' || value === null.
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

  // result — תוצאה.
  const result =
    value as
      Partial<NotificationDeliveryResult> & {
        // error — שגיאה (אופציונלי).
        error?: unknown;
      };

  // עצירת הפעולה עם שגיאה כאשר typeof result.error === 'string' && result.error.trim().
  if (
    typeof result.error ===
      'string' &&
    result.error.trim()
  ) {
    throw new Error(
      result.error,
    );
  }

  // עצירת הפעולה עם שגיאה כאשר typeof result.success !== 'boolean' || typeof result.notificationId !== 'string' || typeof result.sentBy !== 'string' || typeof result.total.
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

/**
 * פעולה אסינכרונית getFunctionErrorMessage: שליפה או חישוב של הודעת שגיאה.
 * @param error — שגיאה.
 * @returns Promise<string> — הפלט בהתאם לחתימה.
 */
async function getFunctionErrorMessage(
  error:
    FunctionsHttpError,
): Promise<string> {
  // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
  try {
    // responseBody — תוצאת הפעולה / תוכן.
    const responseBody =
      await error.context
        .json() as {
          // error — שגיאה (אופציונלי).
          error?: unknown;
        };

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר typeof responseBody.error === 'string' && responseBody.error.trim().
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

/**
 * פעולה אסינכרונית getAuthenticatedUserId: אימות המשתמש באמצעות auth.getUser ושליפת מזהה המשתמש מהתשובה.
 * @returns Promise<string> — הפלט בהתאם לחתימה.
 */
async function getAuthenticatedUserId():
  Promise<string> {
  // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
  const {
    data,
    error,
  } =
    await supabase.auth
      .getUser();

  // עצירת הפעולה עם שגיאה כאשר error.
  if (
    error
  ) {
    throw error;
  }

  // עצירת הפעולה עם שגיאה כאשר !data.user.
  if (
    !data.user
  ) {
    throw new Error(
      'לא נמצא משתמש מחובר.',
    );
  }

  return data.user.id;
}

/**
 * פעולה extractNotificationRow: התראות / שורה.
 * @param value — ערך.
 * @returns NotificationDatabaseRow | null — הפלט בהתאם לחתימה.
 */
function extractNotificationRow(
  value:
    NotificationRecipientDatabaseRow[
      'notification'
    ],
): NotificationDatabaseRow | null {
  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר Array.isArray( value, ).
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

/**
 * פעולה mapMyNotification: מיפוי מפת התאמה / התראות.
 * @param row — שורה.
 * @returns MyNotification | null — הפלט בהתאם לחתימה.
 */
function mapMyNotification(
  row:
    NotificationRecipientDatabaseRow,
): MyNotification | null {
  // notification — התראות.
  const notification =
    extractNotificationRow(
      row.notification,
    );

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !notification.
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

/**
 * פעולה isNotificationActive: בדיקת תנאי עבור התראות / פעיל.
 * @param notification — התראות.
 * @returns boolean — הפלט בהתאם לחתימה.
 */
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

/**
 * איגוד פעולות התראות / שירות במחלקה NotificationService.
 */
class NotificationService {
  /**
   * פעולה אסינכרונית createNotification: יצירת התראות.
   * @param request — נתוני הבקשה.
   * @returns Promise<NotificationDeliveryResult> — הפלט בהתאם לחתימה.
   */
  async createNotification(
    request:
      CreateNotificationRequest,
  ): Promise<NotificationDeliveryResult> {
    // validatedRequest — נתוני הבקשה.
    const validatedRequest =
      validateCreateRequest(
        request,
      );

    // authenticatedUserId — מזהה משתמש.
    const authenticatedUserId =
      await getAuthenticatedUserId();

    // notificationInsert — התראות.
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

    // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
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

    // עצירת הפעולה עם שגיאה כאשר notificationError.
    if (
      notificationError
    ) {
      throw notificationError;
    }

    // notification — התראות.
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

    // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
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

    // עצירת הפעולה עם שגיאה כאשר recipientsError.
    if (
      recipientsError
    ) {
      // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
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

    // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
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

    // עצירת הפעולה עם שגיאה כאשר deliveryError.
    if (
      deliveryError
    ) {
      // עצירת הפעולה עם שגיאה כאשר deliveryError instanceof FunctionsHttpError.
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

  /**
   * פעולה אסינכרונית getMyNotifications: שליפה או חישוב של התראות.
   * @returns Promise<MyNotification[]> — הפלט בהתאם לחתימה.
   */
  async getMyNotifications():
    Promise<MyNotification[]> {
    // authenticatedUserId — מזהה משתמש.
    const authenticatedUserId =
      await getAuthenticatedUserId();

    // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
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

    // עצירת הפעולה עם שגיאה כאשר error.
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

  /**
   * פעולה אסינכרונית getUnreadCount: שליפה או חישוב של כמות.
   * @returns Promise<number> — הפלט בהתאם לחתימה.
   */
  async getUnreadCount():
    Promise<number> {
    // notifications — התראות.
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

  /**
   * פעולה אסינכרונית markAsRead: הנתון markAsRead בהקשר הפעולה.
   * @param recipientId — מזהה.
   * @returns Promise<void> — הפלט בהתאם לחתימה.
   */
  async markAsRead(
    recipientId:
      string,
  ): Promise<void> {
    // normalizedRecipientId — מזהה.
    const normalizedRecipientId =
      recipientId.trim();

    // עצירת הפעולה עם שגיאה כאשר !normalizedRecipientId.
    if (
      !normalizedRecipientId
    ) {
      throw new Error(
        'לא התקבל מזהה נמען התראה.',
      );
    }

    // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
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

    // עצירת הפעולה עם שגיאה כאשר error.
    if (
      error
    ) {
      throw error;
    }
  }

  /**
   * פעולה אסינכרונית markAllAsRead: הנתון markAllAsRead בהקשר הפעולה.
   * @returns Promise<void> — הפלט בהתאם לחתימה.
   */
  async markAllAsRead():
    Promise<void> {
    // authenticatedUserId — מזהה משתמש.
    const authenticatedUserId =
      await getAuthenticatedUserId();

    // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
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

    // עצירת הפעולה עם שגיאה כאשר error.
    if (
      error
    ) {
      throw error;
    }
  }
}

// notificationService — התראות / שירות.
export const notificationService =
  new NotificationService();