/**
 * קובץ: src/services/pushTestService.ts
 * מטרה: שליחת בקשת בדיקה להתראות Push והצגת תוצאת הבדיקה.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: SendTestPushRequest, SendTestPushResponse, validateRequest, mapDeliveryResult, PushTestService.
 * - ריכוז פעולות העיבוד והחישוב בהתאם לפונקציות להלן.
 */
import {
  notificationService,
  type NotificationDeliveryResult,
} from '../features/notifications/services/notificationService';

import {
  NotificationPriority,
  NotificationType,
} from '../features/notifications/types/notificationTypes';

/**
 * חוזה הנתונים SendTestPushRequest: התראות Push / נתוני הבקשה.
 */
export interface SendTestPushRequest {
  // targetUserId — מזהה משתמש היעד.
  targetUserId:
    string;

  // title — כותרת.
  title:
    string;

  // body — תוכן.
  body:
    string;

  // url — כתובת יעד (אופציונלי).
  url?:
    string;
}

/**
 * חוזה הנתונים SendTestPushResponse: התראות Push / תוצאת הפעולה.
 */
export interface SendTestPushResponse {
  success:
    boolean;

  // targetUserId — מזהה משתמש היעד.
  targetUserId:
    string;

  // notificationId — התראות / מזהה.
  notificationId:
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
 * פעולה validateRequest: בדיקת תקינות של נתוני הבקשה.
 * @param request — נתוני הבקשה.
 * @returns { targetUserId: string; title: string; body: string; url: string; } — הפלט בהתאם לחתימה.
 */
function validateRequest(
  request:
    SendTestPushRequest,
): {
  // targetUserId — מזהה משתמש היעד.
  targetUserId:
    string;

  // title — כותרת.
  title:
    string;

  // body — תוכן.
  body:
    string;

  // url — כתובת יעד.
  url:
    string;
} {
  // targetUserId — מזהה משתמש היעד.
  const targetUserId =
    request.targetUserId
      .trim();

  // עצירת הפעולה עם שגיאה כאשר !targetUserId.
  if (
    !targetUserId
  ) {
    throw new Error(
      'יש לבחור משתמש לקבלת ההתראה.',
    );
  }

  // title — כותרת.
  const title =
    request.title
      .trim();

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
    request.body
      .trim();

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
    '/';

  // עצירת הפעולה עם שגיאה כאשר !url.startsWith( '/', ).
  if (
    !url.startsWith(
      '/',
    )
  ) {
    throw new Error(
      'כתובת הפתיחה חייבת להיות נתיב פנימי שמתחיל ב־/.',
    );
  }

  return {
    targetUserId,

    title,

    body,

    url,
  };
}

/**
 * פעולה mapDeliveryResult: מיפוי מפת התאמה / תוצאה.
 * @param targetUserId — מזהה משתמש היעד.
 * @param result — תוצאה.
 * @returns SendTestPushResponse — הפלט בהתאם לחתימה.
 */
function mapDeliveryResult(
  targetUserId:
    string,

  result:
    NotificationDeliveryResult,
): SendTestPushResponse {
  return {
    success:
      result.success,

    targetUserId,

    notificationId:
      result.notificationId,

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
 * איגוד פעולות התראות Push / שירות במחלקה PushTestService.
 */
class PushTestService {
  /**
   * פעולה אסינכרונית sendTestPush: שליחת התראות Push.
   * @param request — נתוני הבקשה.
   * @returns Promise<SendTestPushResponse> — הפלט בהתאם לחתימה.
   */
  async sendTestPush(
    request:
      SendTestPushRequest,
  ): Promise<SendTestPushResponse> {
    // validatedRequest — נתוני הבקשה.
    const validatedRequest =
      validateRequest(
        request,
      );

    // deliveryResult — תוצאה.
    const deliveryResult =
      await notificationService
        .createNotification({
          userIds: [
            validatedRequest
              .targetUserId,
          ],

          type:
            NotificationType.TEST,

          priority:
            NotificationPriority.NORMAL,

          title:
            validatedRequest.title,

          body:
            validatedRequest.body,

          url:
            validatedRequest.url,

          source:
            'manager',

          data: {
            isTest:
              true,

            targetUserId:
              validatedRequest
                .targetUserId,
          },
        });

    return mapDeliveryResult(
      validatedRequest.targetUserId,
      deliveryResult,
    );
  }
}

// pushTestService — התראות Push / שירות.
export const pushTestService =
  new PushTestService();