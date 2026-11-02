/**
 * קובץ: src/features/notifications/services/announcementService.ts
 * מטרה: מימוש שכבת השירות עבור הודעות מנהל / שירות.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: AnnouncementUser, AnnouncementJobType, AnnouncementRecipientCatalog, message.
 * - קריאות RPC המופעלות בקובץ: get_announcement_recipient_catalog, create_operational_announcement.
 * - ריכוז הפנייה למקור הנתונים ועיבוד התשובה בהתאם לפונקציות להלן.
 */
import { supabase } from '../../../lib/supabase';

/**
 * חוזה הנתונים AnnouncementUser: הודעות מנהל / משתמש.
 */
export interface AnnouncementUser { id: string; name: string; scheduleName: string | null }
/**
 * חוזה הנתונים AnnouncementJobType: סוג תפקיד.
 */
export interface AnnouncementJobType { id: string; name: string; userIds: string[] }
/**
 * חוזה הנתונים AnnouncementRecipientCatalog: הודעות מנהל.
 */
export interface AnnouncementRecipientCatalog { users: AnnouncementUser[]; jobTypes: AnnouncementJobType[] }

/**
 * פעולה message: הודעה.
 * @param error — שגיאה.
 * @returns string — הפלט בהתאם לחתימה.
 */
function message(error: unknown): string {
  return error instanceof Error ? error.message : 'אירעה שגיאה בשליחת העדכון.';
}

// announcementService — הודעות מנהל / שירות.
export const announcementService = {
  /**
   * פעולה אסינכרונית getRecipientCatalog: שליפה או חישוב של הנתון getRecipientCatalog בהקשר הפעולה.
   * הפעולה פונה ל־RPC: get_announcement_recipient_catalog.
   * @returns Promise<AnnouncementRecipientCatalog> — הפלט בהתאם לחתימה.
   */
  async getRecipientCatalog(): Promise<AnnouncementRecipientCatalog> {
    // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
    const { data, error } = await supabase.rpc('get_announcement_recipient_catalog');
    if (error) throw new Error(error.message);
    // value — ערך.
    const value = (data ?? {}) as Partial<AnnouncementRecipientCatalog>;
    return { users: Array.isArray(value.users) ? value.users : [], jobTypes: Array.isArray(value.jobTypes) ? value.jobTypes : [] };
  },

  /**
   * פעולה אסינכרונית send: שליחת הנתון send בהקשר הפעולה.
   * הפעולה פונה ל־RPC: create_operational_announcement.
   * @param input — קלט.
   * @returns Promise<number> — הפלט בהתאם לחתימה.
   */
  async send(input: { userIds: string[]; title: string; body: string; priority: string; expiresAt: string }): Promise<number> {
    // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
    const { data, error } = await supabase.rpc('create_operational_announcement', {
      requested_user_ids: input.userIds,
      requested_title: input.title,
      requested_body: input.body,
      requested_priority: input.priority,
      requested_expires_at: input.expiresAt,
    });
    if (error) throw new Error(error.message);
    // result — תוצאה.
    const result = (data ?? {}) as { notificationId?: string; recipientCount?: number };
    if (!result.notificationId) throw new Error('העדכון נוצר ללא מזהה התראה.');
    // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
    const { error: pushError } = await supabase.functions.invoke('send-notification', { body: { notificationId: result.notificationId } });
    if (pushError) console.error('Announcement push delivery failed:', message(pushError));
    return result.recipientCount ?? input.userIds.length;
  },
};
