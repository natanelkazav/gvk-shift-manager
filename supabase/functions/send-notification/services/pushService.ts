import webPush
  from 'npm:web-push@3.6.7';

import type {
  PushPayload,
  PushSendResult,
  PushSubscriptionRow,
} from '../types.ts';

interface PushServiceConfiguration {
  vapidSubject: string;

  vapidPublicKey: string;

  vapidPrivateKey: string;
}

interface PushErrorDetails {
  statusCode:
    number | null;

  message: string;
}

let isConfigured =
  false;

function getPushErrorDetails(
  error: unknown,
): PushErrorDetails {
  if (
    error instanceof Error
  ) {
    const pushError =
      error as Error & {
        statusCode?: unknown;

        body?: unknown;
      };

    const statusCode =
      typeof pushError.statusCode ===
        'number'
        ? pushError.statusCode
        : null;

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

  if (
    typeof error ===
      'object' &&
    error !==
      null
  ) {
    const pushError =
      error as {
        statusCode?: unknown;

        message?: unknown;

        body?: unknown;
      };

    const statusCode =
      typeof pushError.statusCode ===
        'number'
        ? pushError.statusCode
        : null;

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

export function configurePushService(
  configuration:
    PushServiceConfiguration,
): void {
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

export async function sendPushNotification(
  subscription:
    PushSubscriptionRow,

  payload:
    PushPayload,
): Promise<PushSendResult> {
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
        TTL:
          60,
      },
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