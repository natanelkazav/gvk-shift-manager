/**
 * קובץ: src/services/schedulePublicationNotificationService.ts
 * מטרה: הפעלת יצירת התראות לעובדים בעקבות פרסום לוח שיבוצים.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: SchedulePublicationKind, PublicationNotificationResponse, SchedulePublicationNotificationService.
 * - קריאות RPC המופעלות בקובץ: create_schedule_publication_notification, create_dynamic_schedule_publication_notification.
 * - ריכוז הפנייה למקור הנתונים ועיבוד התשובה בהתאם לפונקציות להלן.
 */
import {
  supabase,
} from '../lib/supabase';

/**
 * טיפוס SchedulePublicationKind: שיבוץ.
 */
type SchedulePublicationKind =
  | 'dispatcher'
  | 'driver'
  | 'morning_driver';

/**
 * חוזה הנתונים PublicationNotificationResponse: התראות / תוצאת הפעולה.
 */
interface PublicationNotificationResponse {
  // notificationId — התראות / מזהה.
  notificationId: string | null;
  // recipientCount — כמות.
  recipientCount: number;
}

/**
 * איגוד פעולות שיבוץ / התראות / שירות במחלקה SchedulePublicationNotificationService.
 */
class SchedulePublicationNotificationService {
  /**
   * פעולה אסינכרונית notifyPublished: פורסם.
   * הפעולה פונה ל־RPC: create_schedule_publication_notification.
   * @param kind — הנתון kind בהקשר הפעולה.
   * @param periodId — מזהה התקופה.
   * @returns Promise<void> — הפלט בהתאם לחתימה.
   */
  async notifyPublished(
    kind: SchedulePublicationKind,
    periodId: string,
  ): Promise<void> {
    // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
    try {
      // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
      const { data, error } = await supabase.rpc(
        'create_schedule_publication_notification',
        {
          requested_schedule_kind: kind,
          requested_period_id: periodId,
        },
      );

      // עצירת הפעולה עם שגיאה כאשר error.
      if (error) {
        throw error;
      }

      // response — תוצאת הפעולה.
      const response = data as PublicationNotificationResponse | null;
      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !response?.notificationId || response.recipientCount <= 0.
      if (!response?.notificationId || response.recipientCount <= 0) {
        return;
      }

      // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
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
  /**
   * פעולה אסינכרונית notifyDynamicPublished: דינמי / פורסם.
   * הפעולה פונה ל־RPC: create_dynamic_schedule_publication_notification.
   * @param publicationId — מזהה.
   * @returns Promise<void> — הפלט בהתאם לחתימה.
   */
  async notifyDynamicPublished(
    publicationId: string,
  ): Promise<void> {
    // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
    try {
      // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
      const { data, error } = await supabase.rpc(
        'create_dynamic_schedule_publication_notification',
        {
          requested_publication_id: publicationId,
        },
      );

      // עצירת הפעולה עם שגיאה כאשר error.
      if (error) {
        throw error;
      }

      // response — תוצאת הפעולה.
      const response = data as PublicationNotificationResponse | null;
      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !response?.notificationId || response.recipientCount <= 0.
      if (!response?.notificationId || response.recipientCount <= 0) {
        return;
      }

      // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
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
          'Dynamic schedule was published, but push delivery failed:',
          deliveryError,
        );
      }
    } catch (error) {
      console.warn(
        'Dynamic schedule was published, but publication notification creation failed:',
        error,
      );
    }
  }

}

// schedulePublicationNotificationService — שיבוץ / התראות / שירות.
export const schedulePublicationNotificationService =
  new SchedulePublicationNotificationService();
