import {
  supabase,
} from '../lib/supabase';

import {
  pushConfig,
} from '../config/push';

export type PushPermissionState =
  | NotificationPermission
  | 'unsupported';

export interface PushSubscriptionStatus {
  isSupported: boolean;

  permission:
    PushPermissionState;

  isSubscribed: boolean;

  subscription:
    PushSubscription | null;
}

function urlBase64ToUint8Array(
  value: string,
): Uint8Array<ArrayBuffer> {
  const padding =
    '='.repeat(
      (
        4 -
        value.length % 4
      ) % 4,
    );

  const base64 =
    (
      value +
      padding
    )
      .replace(
        /-/g,
        '+',
      )
      .replace(
        /_/g,
        '/',
      );

  const rawData =
    window.atob(
      base64,
    );

  const output =
    new Uint8Array(
      rawData.length,
    );

  for (
    let index = 0;
    index < rawData.length;
    index += 1
  ) {
    output[index] =
      rawData.charCodeAt(
        index,
      );
  }

  return output;
}

function isPushSupported(): boolean {
  return (
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

function getDeviceName(): string {
  const userAgent =
    navigator.userAgent;

  if (
    /android/i.test(
      userAgent,
    )
  ) {
    return 'מכשיר Android';
  }

  if (
    /iphone|ipad|ipod/i.test(
      userAgent,
    )
  ) {
    return 'מכשיר iPhone או iPad';
  }

  if (
    /windows/i.test(
      userAgent,
    )
  ) {
    return 'מחשב Windows';
  }

  if (
    /macintosh|mac os x/i.test(
      userAgent,
    )
  ) {
    return 'מחשב Mac';
  }

  return 'דפדפן';
}

async function getAuthenticatedUserId():
  Promise<string> {
  const {
    data,
    error,
  } =
    await supabase.auth
      .getUser();

  if (error) {
    throw error;
  }

  if (!data.user) {
    throw new Error(
      'לא נמצא משתמש מחובר.',
    );
  }

  return data.user.id;
}

async function saveSubscription(
  subscription:
    PushSubscription,
): Promise<void> {
  const userId =
    await getAuthenticatedUserId();

  const serializedSubscription =
    subscription.toJSON();

  const p256dhKey =
    serializedSubscription
      .keys
      ?.p256dh;

  const authKey =
    serializedSubscription
      .keys
      ?.auth;

  if (
    !p256dhKey ||
    !authKey
  ) {
    throw new Error(
      'מפתחות ההרשמה להתראות חסרים.',
    );
  }

  const {
    error,
  } =
    await supabase
      .from(
        'push_subscriptions',
      )
      .upsert(
        {
          user_id:
            userId,

          endpoint:
            subscription.endpoint,

          p256dh_key:
            p256dhKey,

          auth_key:
            authKey,

          user_agent:
            navigator.userAgent,

          device_name:
            getDeviceName(),

          is_active:
            true,

          last_used_at:
            new Date()
              .toISOString(),
        },
        {
          onConflict:
            'endpoint',
        },
      );

  if (error) {
    throw error;
  }
}

class PushNotificationService {
  isSupported(): boolean {
    return isPushSupported();
  }

  getPermission():
    PushPermissionState {
    if (
      !isPushSupported()
    ) {
      return 'unsupported';
    }

    return Notification.permission;
  }

  async getSubscription():
    Promise<PushSubscription | null> {
    if (
      !isPushSupported()
    ) {
      return null;
    }

    const registration =
      await navigator
        .serviceWorker
        .ready;

    return registration
      .pushManager
      .getSubscription();
  }

  async getStatus():
    Promise<PushSubscriptionStatus> {
    const supported =
      isPushSupported();

    if (
      !supported
    ) {
      return {
        isSupported:
          false,

        permission:
          'unsupported',

        isSubscribed:
          false,

        subscription:
          null,
      };
    }

    const subscription =
      await this.getSubscription();

    return {
      isSupported:
        true,

      permission:
        Notification.permission,

      isSubscribed:
        subscription !==
        null,

      subscription,
    };
  }

  async enablePush():
    Promise<PushSubscription> {
    if (
      !isPushSupported()
    ) {
      throw new Error(
        'הדפדפן או המכשיר אינם תומכים בהתראות Push.',
      );
    }

    let permission =
      Notification.permission;

    if (
      permission ===
      'default'
    ) {
      permission =
        await Notification
          .requestPermission();
    }

    if (
      permission !==
      'granted'
    ) {
      throw new Error(
        permission ===
          'denied'
          ? 'הרשאת ההתראות נחסמה בדפדפן. יש לאפשר אותה דרך הגדרות האתר.'
          : 'לא ניתנה הרשאה להצגת התראות.',
      );
    }

    const registration =
      await navigator
        .serviceWorker
        .ready;

    let subscription =
      await registration
        .pushManager
        .getSubscription();

    if (
      !subscription
    ) {
              if (
          !pushConfig.vapidPublicKey
        ) {
          throw new Error(
            'מפתח ההתראות הציבורי אינו מוגדר במערכת.',
          );
        }
      subscription =
        await registration
          .pushManager
          .subscribe({
            userVisibleOnly:
              true,

            applicationServerKey:
              urlBase64ToUint8Array(
                pushConfig
                  .vapidPublicKey,
              ),
          });
    }

    await saveSubscription(
      subscription,
    );

    await this.ensurePreferences();

    return subscription;
  }

  async disablePush():
    Promise<void> {
    if (
      !isPushSupported()
    ) {
      return;
    }

    const subscription =
      await this.getSubscription();

    if (
      !subscription
    ) {
      return;
    }

    const {
      error,
    } =
      await supabase
        .from(
          'push_subscriptions',
        )
        .update({
          is_active:
            false,
        })
        .eq(
          'endpoint',
          subscription.endpoint,
        );

    if (error) {
      throw error;
    }

    const unsubscribed =
      await subscription
        .unsubscribe();

    if (
      !unsubscribed
    ) {
      throw new Error(
        'לא ניתן היה לבטל את הרשמת המכשיר להתראות.',
      );
    }
  }

  async refreshSubscription():
    Promise<PushSubscription | null> {
    const subscription =
      await this.getSubscription();

    if (
      !subscription
    ) {
      return null;
    }

    await saveSubscription(
      subscription,
    );

    return subscription;
  }

  async ensurePreferences():
    Promise<void> {
    const userId =
      await getAuthenticatedUserId();

    const {
      error,
    } =
      await supabase
        .from(
          'notification_preferences',
        )
        .upsert(
          {
            user_id:
              userId,
          },
          {
            onConflict:
              'user_id',

            ignoreDuplicates:
              true,
          },
        );

    if (error) {
      throw error;
    }
  }
}

export const pushNotificationService =
  new PushNotificationService();