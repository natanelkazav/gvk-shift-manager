import { supabase } from '../../../lib/supabase';

export interface AnnouncementUser { id: string; name: string; scheduleName: string | null }
export interface AnnouncementJobType { id: string; name: string; userIds: string[] }
export interface AnnouncementRecipientCatalog { users: AnnouncementUser[]; jobTypes: AnnouncementJobType[] }

function message(error: unknown): string {
  return error instanceof Error ? error.message : 'אירעה שגיאה בשליחת העדכון.';
}

export const announcementService = {
  async getRecipientCatalog(): Promise<AnnouncementRecipientCatalog> {
    const { data, error } = await supabase.rpc('get_announcement_recipient_catalog');
    if (error) throw new Error(error.message);
    const value = (data ?? {}) as Partial<AnnouncementRecipientCatalog>;
    return { users: Array.isArray(value.users) ? value.users : [], jobTypes: Array.isArray(value.jobTypes) ? value.jobTypes : [] };
  },

  async send(input: { userIds: string[]; title: string; body: string; priority: string; expiresAt: string }): Promise<number> {
    const { data, error } = await supabase.rpc('create_operational_announcement', {
      requested_user_ids: input.userIds,
      requested_title: input.title,
      requested_body: input.body,
      requested_priority: input.priority,
      requested_expires_at: input.expiresAt,
    });
    if (error) throw new Error(error.message);
    const result = (data ?? {}) as { notificationId?: string; recipientCount?: number };
    if (!result.notificationId) throw new Error('העדכון נוצר ללא מזהה התראה.');
    const { error: pushError } = await supabase.functions.invoke('send-notification', { body: { notificationId: result.notificationId } });
    if (pushError) console.error('Announcement push delivery failed:', message(pushError));
    return result.recipientCount ?? input.userIds.length;
  },
};
