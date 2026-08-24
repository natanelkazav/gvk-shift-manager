import {
  supabase,
} from '../lib/supabase';

type SchedulePublicationKind =
  | 'dispatcher'
  | 'driver'
  | 'morning_driver';

interface PublicationNotificationResponse {
  notificationId: string | null;
  recipientCount: number;
}

class SchedulePublicationNotificationService {
  async notifyPublished(
    kind: SchedulePublicationKind,
    periodId: string,
  ): Promise<void> {
    try {
      const { data, error } = await supabase.rpc(
        'create_schedule_publication_notification',
        {
          requested_schedule_kind: kind,
          requested_period_id: periodId,
        },
      );

      if (error) {
        throw error;
      }

      const response = data as PublicationNotificationResponse | null;
      if (!response?.notificationId || response.recipientCount <= 0) {
        return;
      }

      const { error: deliveryError } = await supabase.functions.invoke(
        'send-notification',
        {
          body: {
            notificationId: response.notificationId,
          },
        },
      );

      if (deliveryError) {
        console.warn(
          'Schedule was published, but push delivery failed:',
          deliveryError,
        );
      }
    } catch (error) {
      // Publication already succeeded. Notification delivery must never
      // make the user think the schedule publication itself failed.
      console.warn(
        'Schedule was published, but publication notification creation failed:',
        error,
      );
    }
  }
}

export const schedulePublicationNotificationService =
  new SchedulePublicationNotificationService();
