/**
 * קובץ: src/services/pushNotificationService.ts
 * מטרה: ניהול הרשמה להתראות Push וחיבור הדפדפן לשירות ההתראות.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: PushPermissionState, PushSubscriptionStatus, urlBase64ToUint8Array, isPushSupported, getDeviceName, getAuthenticatedUserId, saveSubscription, PushNotificationService.
 * - קריאות RPC המופעלות בקובץ: register_push_subscription.
 * - מקורות נתונים הנזכרים בקריאות from: push_subscriptions, notification_preferences.
 * - ריכוז הפנייה למקור הנתונים ועיבוד התשובה בהתאם לפונקציות להלן.
 */
import {
  supabase,
} from '../lib/supabase';

import {
  pushConfig,
} from '../config/push';

/**
 * טיפוס PushPermissionState: התראות Push / הרשאות / מצב.
 */
export type PushPermissionState =
  | NotificationPermission
  | 'unsupported';

/**
 * חוזה הנתונים PushSubscriptionStatus: התראות Push / סטטוס.
 */
export interface PushSubscriptionStatus {
  isSupported: boolean;

  // permission — הרשאות.
  permission:
    PushPermissionState;

  isSubscribed: boolean;

  subscription:
    PushSubscription | null;
}

/**
 * פעולה urlBase64ToUint8Array: כתובת יעד.
 * @param value — ערך.
 * @returns Uint8Array<ArrayBuffer> — הפלט בהתאם לחתימה.
 */
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

  // rawData — נתונים.
  const rawData =
    window.atob(
      base64,
    );

  // output — פלט.
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

/**
 * פעולה isPushSupported: בדיקת תנאי עבור התראות Push.
 * @returns boolean — הפלט בהתאם לחתימה.
 */
function isPushSupported(): boolean {
  return (
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

/**
 * פעולה getDeviceName: שליפה או חישוב של שם.
 * @returns string — הפלט בהתאם לחתימה.
 */
function getDeviceName(): string {
  // userAgent — משתמש.
  const userAgent =
    navigator.userAgent;

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר /android/i.test( userAgent, ).
  if (
    /android/i.test(
      userAgent,
    )
  ) {
    return 'מכשיר Android';
  }

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר /iphone|ipad|ipod/i.test( userAgent, ).
  if (
    /iphone|ipad|ipod/i.test(
      userAgent,
    )
  ) {
    return 'מכשיר iPhone או iPad';
  }

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר /windows/i.test( userAgent, ).
  if (
    /windows/i.test(
      userAgent,
    )
  ) {
    return 'מחשב Windows';
  }

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר /macintosh|mac os x/i.test( userAgent, ).
  if (
    /macintosh|mac os x/i.test(
      userAgent,
    )
  ) {
    return 'מחשב Mac';
  }

  return 'דפדפן';
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
  if (error) {
    throw error;
  }

  // עצירת הפעולה עם שגיאה כאשר !data.user.
  if (!data.user) {
    throw new Error(
      'לא נמצא משתמש מחובר.',
    );
  }

  return data.user.id;
}

/**
 * פעולה אסינכרונית saveSubscription: שמירת הנתון saveSubscription בהקשר הפעולה.
 * הפעולה פונה ל־RPC: register_push_subscription.
 * @param subscription — הנתון subscription בהקשר הפעולה.
 * @returns Promise<void> — הפלט בהתאם לחתימה.
 */
async function saveSubscription(
  subscription:
    PushSubscription,
): Promise<void> {
  const serializedSubscription =
    subscription.toJSON();

  // p256dhKey — מפתח.
  const p256dhKey =
    serializedSubscription
      .keys
      ?.p256dh;

  // authKey — אימות משתמשים / מפתח.
  const authKey =
    serializedSubscription
      .keys
      ?.auth;

  // עצירת הפעולה עם שגיאה כאשר !p256dhKey || !authKey.
  if (
    !p256dhKey ||
    !authKey
  ) {
    throw new Error(
      'מפתחות ההרשמה להתראות חסרים.',
    );
  }

  // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
  const {
    error,
  } =
    await supabase.rpc(
      'register_push_subscription',
      {
        requested_endpoint:
          subscription.endpoint,

        requested_p256dh_key:
          p256dhKey,

        requested_auth_key:
          authKey,

        requested_user_agent:
          navigator.userAgent,

        requested_device_name:
          getDeviceName(),
      },
    );

  // עצירת הפעולה עם שגיאה כאשר error.
  if (
    error
  ) {
    console.error(
      'REGISTER PUSH SUBSCRIPTION ERROR:',
      error,
    );

    throw error;
  }
}

/**
 * איגוד פעולות התראות Push / התראות / שירות במחלקה PushNotificationService.
 */
class PushNotificationService {
  /**
   * פעולה isSupported: בדיקת תנאי עבור הנתון isSupported בהקשר הפעולה.
   * @returns boolean — הפלט בהתאם לחתימה.
   */
  isSupported(): boolean {
    return isPushSupported();
  }

  /**
   * פעולה getPermission: שליפה או חישוב של הרשאות.
   * @returns PushPermissionState — הפלט בהתאם לחתימה.
   */
  getPermission():
    PushPermissionState {
    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !isPushSupported().
    if (
      !isPushSupported()
    ) {
      return 'unsupported';
    }

    return Notification.permission;
  }

  /**
   * פעולה אסינכרונית getSubscription: שליפה או חישוב של הנתון getSubscription בהקשר הפעולה.
   * @returns Promise<PushSubscription | null> — הפלט בהתאם לחתימה.
   */
  async getSubscription():
    Promise<PushSubscription | null> {
    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !isPushSupported().
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

  /**
   * פעולה אסינכרונית getStatus: שליפה או חישוב של סטטוס.
   * @returns Promise<PushSubscriptionStatus> — הפלט בהתאם לחתימה.
   */
  async getStatus():
    Promise<PushSubscriptionStatus> {
    const supported =
      isPushSupported();

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !supported.
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

  /**
   * פעולה אסינכרונית enablePush: התראות Push.
   * @returns Promise<PushSubscription> — הפלט בהתאם לחתימה.
   */
  async enablePush():
    Promise<PushSubscription> {
    // עצירת הפעולה עם שגיאה כאשר !isPushSupported().
    if (
      !isPushSupported()
    ) {
      throw new Error(
        'הדפדפן או המכשיר אינם תומכים בהתראות Push.',
      );
    }

    // permission — הרשאות.
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

    // עצירת הפעולה עם שגיאה כאשר permission !== 'granted'.
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
              // עצירת הפעולה עם שגיאה כאשר !pushConfig.vapidPublicKey.
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

  /**
   * פעולה אסינכרונית disablePush: התראות Push.
   * @returns Promise<void> — הפלט בהתאם לחתימה.
   */
  async disablePush():
    Promise<void> {
    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !isPushSupported().
    if (
      !isPushSupported()
    ) {
      return;
    }

    const subscription =
      await this.getSubscription();

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !subscription.
    if (
      !subscription
    ) {
      return;
    }

    // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
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

    // עצירת הפעולה עם שגיאה כאשר error.
    if (error) {
      throw error;
    }

    const unsubscribed =
      await subscription
        .unsubscribe();

    // עצירת הפעולה עם שגיאה כאשר !unsubscribed.
    if (
      !unsubscribed
    ) {
      throw new Error(
        'לא ניתן היה לבטל את הרשמת המכשיר להתראות.',
      );
    }
  }

  /**
   * פעולה אסינכרונית refreshSubscription: רענון הנתון refreshSubscription בהקשר הפעולה.
   * @returns Promise<PushSubscription | null> — הפלט בהתאם לחתימה.
   */
  async refreshSubscription():
    Promise<PushSubscription | null> {
    const subscription =
      await this.getSubscription();

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !subscription.
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

  /**
   * פעולה אסינכרונית ensurePreferences: הבטחת תנאי מקדים עבור הנתון ensurePreferences בהקשר הפעולה.
   * @returns Promise<void> — הפלט בהתאם לחתימה.
   */
  async ensurePreferences():
    Promise<void> {
    // userId — מזהה משתמש.
    const userId =
      await getAuthenticatedUserId();

    // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
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

    // עצירת הפעולה עם שגיאה כאשר error.
    if (error) {
      throw error;
    }
  }
}

// pushNotificationService — התראות Push / התראות / שירות.
export const pushNotificationService =
  new PushNotificationService();