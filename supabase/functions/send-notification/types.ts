export interface SendNotificationRequest {
  notificationId: string;
}

export interface NotificationRow {
  id: string;

  type: string;

  priority: string;

  source: string;

  title: string;

  body: string;

  url: string | null;

  data:
    Record<string, unknown>;

  created_by:
    string | null;

  created_at: string;

  expires_at: string;
}

export interface NotificationRecipientRow {
  id: string;

  notification_id: string;

  user_id: string;

  is_read: boolean;

  delivered: boolean;

  read_at: string | null;

  delivered_at: string | null;

  created_at: string;
}

export interface PushSubscriptionRow {
  id: string;

  user_id: string;

  endpoint: string;

  p256dh_key: string;

  auth_key: string;

  is_active: boolean;

  device_name:
    string | null;

  last_used_at:
    string | null;
}

export interface PushPayload {
  title: string;

  body: string;

  icon: string;

  badge: string;

  tag: string;

  url: string;

  data:
    Record<string, unknown>;
}

export interface PushSendSuccess {
  success: true;

  subscriptionId: string;
}

export interface PushSendFailure {
  success: false;

  subscriptionId: string;

  statusCode:
    number | null;

  message: string;

  isExpired:
    boolean;
}

export type PushSendResult =
  | PushSendSuccess
  | PushSendFailure;