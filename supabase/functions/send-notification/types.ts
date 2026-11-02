/**
 * קובץ: supabase/functions/send-notification/types.ts
 * מטרה: הגדרת טיפוסי בקשות ותוכן התראות עבור שירות השליחה.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: SendNotificationRequest, NotificationRow, NotificationRecipientRow, PushSubscriptionRow, PushPayload, PushSendSuccess, PushSendFailure, PushSendResult.
 * - ריכוז ההגדרות והלוגיקה המפורטות בהמשך הקובץ.
 */
/**
 * חוזה הנתונים SendNotificationRequest: התראות / נתוני הבקשה.
 */
export interface SendNotificationRequest {
  // notificationId — התראות / מזהה.
  notificationId: string;
}

/**
 * חוזה הנתונים NotificationRow: התראות / שורה.
 */
export interface NotificationRow {
  // id — מזהה.
  id: string;

  type: string;

  priority: string;

  // source — מקור.
  source: string;

  // title — כותרת.
  title: string;

  // body — תוכן.
  body: string;

  // url — כתובת יעד.
  url: string | null;

  // data — נתונים.
  data:
    Record<string, unknown>;

  created_by:
    string | null;

  // created_at — מועד יצירה.
  created_at: string;

  expires_at: string;
}

/**
 * חוזה הנתונים NotificationRecipientRow: התראות / שורה.
 */
export interface NotificationRecipientRow {
  // id — מזהה.
  id: string;

  // notification_id — התראות / מזהה.
  notification_id: string;

  // user_id — מזהה משתמש.
  user_id: string;

  is_read: boolean;

  delivered: boolean;

  read_at: string | null;

  delivered_at: string | null;

  // created_at — מועד יצירה.
  created_at: string;
}

/**
 * חוזה הנתונים PushSubscriptionRow: התראות Push / שורה.
 */
export interface PushSubscriptionRow {
  // id — מזהה.
  id: string;

  // user_id — מזהה משתמש.
  user_id: string;

  endpoint: string;

  // p256dh_key — מפתח.
  p256dh_key: string;

  // auth_key — אימות משתמשים / מפתח.
  auth_key: string;

  // is_active — האם הרשומה פעילה.
  is_active: boolean;

  // device_name — שם.
  device_name:
    string | null;

  last_used_at:
    string | null;
}

/**
 * חוזה הנתונים PushPayload: התראות Push.
 */
export interface PushPayload {
  // title — כותרת.
  title: string;

  // body — תוכן.
  body: string;

  icon: string;

  badge: string;

  tag: string;

  // url — כתובת יעד.
  url: string;

  // data — נתונים.
  data:
    Record<string, unknown>;
}

/**
 * חוזה הנתונים PushSendSuccess: התראות Push.
 */
export interface PushSendSuccess {
  success: true;

  // subscriptionId — מזהה.
  subscriptionId: string;
}

/**
 * חוזה הנתונים PushSendFailure: התראות Push.
 */
export interface PushSendFailure {
  success: false;

  // subscriptionId — מזהה.
  subscriptionId: string;

  // statusCode — סטטוס.
  statusCode:
    number | null;

  // message — הודעה.
  message: string;

  isExpired:
    boolean;
}

/**
 * טיפוס PushSendResult: התראות Push / תוצאה.
 */
export type PushSendResult =
  | PushSendSuccess
  | PushSendFailure;