import {
  notificationService,
  type NotificationDeliveryResult,
} from '../features/notifications/services/notificationService';

import {
  NotificationPriority,
  NotificationType,
} from '../features/notifications/types/notificationTypes';

export interface SendTestPushRequest {
  targetUserId:
    string;

  title:
    string;

  body:
    string;

  url?:
    string;
}

export interface SendTestPushResponse {
  success:
    boolean;

  targetUserId:
    string;

  notificationId:
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

function validateRequest(
  request:
    SendTestPushRequest,
): {
  targetUserId:
    string;

  title:
    string;

  body:
    string;

  url:
    string;
} {
  const targetUserId =
    request.targetUserId
      .trim();

  if (
    !targetUserId
  ) {
    throw new Error(
      'יש לבחור משתמש לקבלת ההתראה.',
    );
  }

  const title =
    request.title
      .trim();

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
    request.body
      .trim();

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
    '/';

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

class PushTestService {
  async sendTestPush(
    request:
      SendTestPushRequest,
  ): Promise<SendTestPushResponse> {
    const validatedRequest =
      validateRequest(
        request,
      );

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

export const pushTestService =
  new PushTestService();