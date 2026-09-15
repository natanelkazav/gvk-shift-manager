import { supabase } from '../lib/supabase';
import type {
  DailyReportAdminOptions,
  DailyReportDetail,
  DailyReportItemInput,
  DailyReportOption,
  DailyReportWorkspace,
} from '../types/dailyReports';

function errorMessage(prefix: string, error: unknown): Error {
  const message = error && typeof error === 'object' && 'message' in error
    ? String((error as { message?: unknown }).message ?? '')
    : String(error ?? '');
  return new Error(`${prefix}: ${message}`);
}

export const dailyReportService = {
  async getAdminOptions(): Promise<DailyReportAdminOptions> {
    const { data, error } = await supabase.rpc('get_daily_report_admin_options');
    if (error) throw errorMessage('טעינת אפשרויות דיווח יומי נכשלה', error);
    const payload = (data ?? {}) as Partial<DailyReportAdminOptions>;
    return { users: Array.isArray(payload.users) ? payload.users : [] };
  },

  async getMyWorkspace(): Promise<DailyReportWorkspace> {
    const { data, error } = await supabase.rpc('get_my_daily_report_workspace');
    if (error) throw errorMessage('טעינת הדיווח היומי נכשלה', error);
    const payload = (data ?? {}) as Partial<DailyReportWorkspace>;
    return {
      today: String(payload.today ?? ''),
      customers: Array.isArray(payload.customers) ? payload.customers : [],
      roles: Array.isArray(payload.roles) ? payload.roles : [],
    };
  },

  async addSubject(jobTypeId: string, name: string): Promise<DailyReportOption> {
    const { data, error } = await supabase.rpc('add_daily_report_subject', {
      requested_job_type_id: jobTypeId,
      requested_name: name,
    });
    if (error) throw errorMessage('הוספת הנושא נכשלה', error);
    return data as DailyReportOption;
  },

  async addCustomer(name: string): Promise<DailyReportOption> {
    const { data, error } = await supabase.rpc('add_daily_report_customer', {
      requested_name: name,
    });
    if (error) throw errorMessage('הוספת הלקוח נכשלה', error);
    return data as DailyReportOption;
  },

  async prepareUpload(jobTypeId: string): Promise<string> {
    const { data, error } = await supabase.rpc('prepare_my_daily_report_upload', {
      requested_job_type_id: jobTypeId,
    });
    if (error) throw errorMessage('הכנת העלאת הקבצים נכשלה', error);
    return String((data as { reportId?: unknown } | null)?.reportId ?? '');
  },

  async uploadAttachment(reportId: string, file: File): Promise<void> {
    const safeName = file.name.replace(/[^a-zA-Z0-9._()\-\u0590-\u05FF ]/g, '_');
    const path = `${reportId}/${crypto.randomUUID()}-${safeName}`;
    const { error: uploadError } = await supabase.storage
      .from('daily-report-attachments')
      .upload(path, file, { contentType: file.type || 'application/octet-stream', upsert: false });
    if (uploadError) throw errorMessage(`העלאת ${file.name} נכשלה`, uploadError);

    const { error } = await supabase.rpc('register_my_daily_report_attachment', {
      requested_report_id: reportId,
      requested_storage_path: path,
      requested_file_name: file.name,
      requested_mime_type: file.type || null,
      requested_file_size: file.size,
    });
    if (error) {
      await supabase.storage.from('daily-report-attachments').remove([path]);
      throw errorMessage(`שמירת ${file.name} נכשלה`, error);
    }
  },

  async openAttachment(attachmentId: string): Promise<void> {
    const { data, error } = await supabase.rpc('get_daily_report_attachment_download', {
      requested_attachment_id: attachmentId,
    });
    if (error) throw errorMessage('פתיחת הקובץ נכשלה', error);
    const storagePath = String((data as { storagePath?: unknown } | null)?.storagePath ?? '');
    const { data: signed, error: signedError } = await supabase.storage
      .from('daily-report-attachments')
      .createSignedUrl(storagePath, 120);
    if (signedError) throw errorMessage('יצירת קישור לקובץ נכשלה', signedError);
    window.open(signed.signedUrl, '_blank', 'noopener,noreferrer');
  },

  async submit(jobTypeId: string, items: DailyReportItemInput[], preparedReportId?: string): Promise<void> {
    const { data, error } = await supabase.rpc('submit_my_daily_report', {
      requested_job_type_id: jobTypeId,
      requested_items: items,
      requested_report_id: preparedReportId ?? null,
    });
    if (error) throw errorMessage('שליחת הדיווח נכשלה', error);

    const notificationIds = Array.isArray((data as { notificationIds?: unknown } | null)?.notificationIds)
      ? ((data as { notificationIds: unknown[] }).notificationIds.filter((id): id is string => typeof id === 'string'))
      : [];

    for (const notificationId of notificationIds) {
      const { error: pushError } = await supabase.functions.invoke('send-notification', {
        body: { notificationId },
      });
      if (pushError) {
        console.error('Daily report Push delivery failed:', { notificationId, pushError });
      }
    }
  },

  async getDetail(reportId: string): Promise<DailyReportDetail> {
    const { data, error } = await supabase.rpc('get_daily_report_notification_detail', {
      requested_report_id: reportId,
    });
    if (error) throw errorMessage('טעינת הדיווח נכשלה', error);
    return data as DailyReportDetail;
  },
};
