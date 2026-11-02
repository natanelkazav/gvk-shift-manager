/**
 * קובץ: supabase/functions/send-notification/services/pushService.ts
 * מטרה: מימוש שכבת השירות עבור התראות Push / שירות.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: PushServiceConfiguration, PushErrorDetails, getPushErrorDetails, configurePushService, sendPushNotification.
 * - ריכוז פעולות העיבוד והחישוב בהתאם לפונקציות להלן.
 */
import webPush
  from 'npm:web-push@3.6.7';

import type {
  PushPayload,
  PushSendResult,
  PushSubscriptionRow,
} from '../types.ts';

/**
 * חוזה הנתונים PushServiceConfiguration: התראות Push / שירות / תצורה.
 */
interface PushServiceConfiguration {
  vapidSubject: string;

  // vapidPublicKey — מפתח.
  vapidPublicKey: string;

  // vapidPrivateKey — מפתח.
  vapidPrivateKey: string;
}

/**
 * חוזה הנתונים PushErrorDetails: התראות Push / שגיאה.
 */
interface PushErrorDetails {
  // statusCode — סטטוס.
  statusCode:
    number | null;

  // message — הודעה.
  message: string;
}

// isConfigured — הנתון isConfigured בהקשר הפעולה.
let isConfigured =
  false;

/**
 * פעולה getPushErrorDetails: שליפה או חישוב של התראות Push / שגיאה.
 * @param error — שגיאה.
 * @returns PushErrorDetails — הפלט בהתאם לחתימה.
 */
function getPushErrorDetails(
  error: unknown,
): PushErrorDetails {
  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר error instanceof Error.
  if (
    error instanceof Error
  ) {
    // pushError — התראות Push / שגיאה.
    const pushError =
      error as Error & {
        // statusCode — סטטוס (אופציונלי).
        statusCode?: unknown;

        // body — תוכן (אופציונלי).
        body?: unknown;
      };

    // statusCode — סטטוס.
    const statusCode =
      typeof pushError.statusCode ===
        'number'
        ? pushError.statusCode
        : null;

    // messageParts — הודעה.
    const messageParts = [
      pushError.message.trim()
        ? pushError.message
        : null,

      typeof pushError.body ===
        'string' &&
      pushError.body.trim()
        ? pushError.body
        : null,
    ].filter(
      (
        value,
      ): value is string =>
        Boolean(
          value,
        ),
    );

    return {
      statusCode,

      message:
        messageParts.join(
          ' | ',
        ) ||
        'שליחת ה־Push נכשלה.',
    };
  }

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר typeof error === 'object' && error !== null.
  if (
    typeof error ===
      'object' &&
    error !==
      null
  ) {
    // pushError — התראות Push / שגיאה.
    const pushError =
      error as {
        // statusCode — סטטוס (אופציונלי).
        statusCode?: unknown;

        // message — הודעה (אופציונלי).
        message?: unknown;

        // body — תוכן (אופציונלי).
        body?: unknown;
      };

    // statusCode — סטטוס.
    const statusCode =
      typeof pushError.statusCode ===
        'number'
        ? pushError.statusCode
        : null;

    // messageParts — הודעה.
    const messageParts = [
      typeof pushError.message ===
        'string' &&
      pushError.message.trim()
        ? pushError.message
        : null,

      typeof pushError.body ===
        'string' &&
      pushError.body.trim()
        ? pushError.body
        : null,
    ].filter(
      (
        value,
      ): value is string =>
        Boolean(
          value,
        ),
    );

    return {
      statusCode,

      message:
        messageParts.join(
          ' | ',
        ) ||
        'שליחת ה־Push נכשלה.',
    };
  }

  return {
    statusCode:
      null,

    message:
      'שליחת ה־Push נכשלה.',
  };
}

/**
 * פעולה configurePushService: התראות Push / שירות.
 * @param configuration — תצורה.
 * @returns void — הפלט בהתאם לחתימה.
 */
export function configurePushService(
  configuration:
    PushServiceConfiguration,
): void {
  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר isConfigured.
  if (
    isConfigured
  ) {
    return;
  }

  webPush.setVapidDetails(
    configuration.vapidSubject,
    configuration.vapidPublicKey,
    configuration.vapidPrivateKey,
  );

  isConfigured =
    true;
}

/**
 * פעולה אסינכרונית sendPushNotification: שליחת התראות Push / התראות.
 * @param subscription — הנתון subscription בהקשר הפעולה.
 * @param payload — הנתון payload בהקשר הפעולה.
 * @returns Promise<PushSendResult> — הפלט בהתאם לחתימה.
 */
export async function sendPushNotification(
  subscription:
    PushSubscriptionRow,

  payload:
    PushPayload,
): Promise<PushSendResult> {
  // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
  try {
    await webPush.sendNotification(
      {
        endpoint:
          subscription.endpoint,

        keys: {
          p256dh:
            subscription.p256dh_key,

          auth:
            subscription.auth_key,
        },
      },
      JSON.stringify(
        payload,
      ),
        {
          TTL: 86400,
          urgency: 'high',
        }
    );

    return {
      success:
        true,

      subscriptionId:
        subscription.id,
    };
  } catch (
    error
  ) {
    const details =
      getPushErrorDetails(
        error,
      );

    // isExpired — הנתון isExpired בהקשר הפעולה.
    const isExpired =
      details.statusCode ===
        404 ||
      details.statusCode ===
        410;

    return {
      success:
        false,

      subscriptionId:
        subscription.id,

      statusCode:
        details.statusCode,

      message:
        details.message,

      isExpired,
    };
  }
}