/**
 * קובץ: src/services/dailyReportService.ts
 * מטרה: שליפה, יצירה וניהול של דוחות יומיים והפריטים והקבצים המשויכים אליהם.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: errorMessage.
 * - קריאות RPC המופעלות בקובץ: get_daily_report_admin_options, get_my_daily_report_workspace, add_daily_report_subject, add_daily_report_customer, prepare_my_daily_report_upload, register_my_daily_report_attachment, get_daily_report_attachment_download, submit_my_daily_report, get_daily_report_notification_detail.
 * - מקורות נתונים הנזכרים בקריאות from: daily-report-attachments.
 * - ריכוז הפנייה למקור הנתונים ועיבוד התשובה בהתאם לפונקציות להלן.
 */
import { supabase } from '../lib/supabase';
import type {
  DailyReportAdminOptions,
  DailyReportDetail,
  DailyReportItemInput,
  DailyReportOption,
  DailyReportWorkspace,
} from '../types/dailyReports';

/**
 * פעולה errorMessage: הודעת שגיאה.
 * @param prefix — הנתון prefix בהקשר הפעולה.
 * @param error — שגיאה.
 * @returns Error — הפלט בהתאם לחתימה.
 */
function errorMessage(prefix: string, error: unknown): Error {
  // message — הודעה.
  const message = error && typeof error === 'object' && 'message' in error
    ? String((error as { message?: unknown }).message ?? '')
    : String(error ?? '');
  return new Error(`${prefix}: ${message}`);
}

// dailyReportService — דוחות פעילות יומיים.
export const dailyReportService = {
  /**
   * פעולה אסינכרונית getAdminOptions: שליפה או חישוב של אפשרויות בחירה.
   * הפעולה פונה ל־RPC: get_daily_report_admin_options.
   * @returns Promise<DailyReportAdminOptions> — הפלט בהתאם לחתימה.
   */
  async getAdminOptions(): Promise<DailyReportAdminOptions> {
    // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
    const { data, error } = await supabase.rpc('get_daily_report_admin_options');
    if (error) throw errorMessage('טעינת אפשרויות דיווח יומי נכשלה', error);
    const payload = (data ?? {}) as Partial<DailyReportAdminOptions>;
    return { users: Array.isArray(payload.users) ? payload.users : [] };
  },

  /**
   * פעולה אסינכרונית getMyWorkspace: שליפה או חישוב של הנתון getMyWorkspace בהקשר הפעולה.
   * הפעולה פונה ל־RPC: get_my_daily_report_workspace.
   * @returns Promise<DailyReportWorkspace> — הפלט בהתאם לחתימה.
   */
  async getMyWorkspace(): Promise<DailyReportWorkspace> {
    // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
    const { data, error } = await supabase.rpc('get_my_daily_report_workspace');
    if (error) throw errorMessage('טעינת הדיווח היומי נכשלה', error);
    const payload = (data ?? {}) as Partial<DailyReportWorkspace>;
    return {
      today: String(payload.today ?? ''),
      customers: Array.isArray(payload.customers) ? payload.customers : [],
      roles: Array.isArray(payload.roles) ? payload.roles : [],
    };
  },

  /**
   * פעולה אסינכרונית addSubject: הוספת הנתון addSubject בהקשר הפעולה.
   * הפעולה פונה ל־RPC: add_daily_report_subject.
   * @param jobTypeId — מזהה סוג התפקיד.
   * @param name — שם.
   * @returns Promise<DailyReportOption> — הפלט בהתאם לחתימה.
   */
  async addSubject(jobTypeId: string, name: string): Promise<DailyReportOption> {
    // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
    const { data, error } = await supabase.rpc('add_daily_report_subject', {
      requested_job_type_id: jobTypeId,
      requested_name: name,
    });
    if (error) throw errorMessage('הוספת הנושא נכשלה', error);
    return data as DailyReportOption;
  },

  /**
   * פעולה אסינכרונית addCustomer: הוספת הנתון addCustomer בהקשר הפעולה.
   * הפעולה פונה ל־RPC: add_daily_report_customer.
   * @param name — שם.
   * @returns Promise<DailyReportOption> — הפלט בהתאם לחתימה.
   */
  async addCustomer(name: string): Promise<DailyReportOption> {
    // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
    const { data, error } = await supabase.rpc('add_daily_report_customer', {
      requested_name: name,
    });
    if (error) throw errorMessage('הוספת הלקוח נכשלה', error);
    return data as DailyReportOption;
  },

  /**
   * פעולה אסינכרונית prepareUpload: הנתון prepareUpload בהקשר הפעולה.
   * הפעולה פונה ל־RPC: prepare_my_daily_report_upload.
   * @param jobTypeId — מזהה סוג התפקיד.
   * @returns Promise<string> — הפלט בהתאם לחתימה.
   */
  async prepareUpload(jobTypeId: string): Promise<string> {
    // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
    const { data, error } = await supabase.rpc('prepare_my_daily_report_upload', {
      requested_job_type_id: jobTypeId,
    });
    if (error) throw errorMessage('הכנת העלאת הקבצים נכשלה', error);
    return String((data as { reportId?: unknown } | null)?.reportId ?? '');
  },

  /**
   * פעולה אסינכרונית uploadAttachment: הנתון uploadAttachment בהקשר הפעולה.
   * הפעולה פונה ל־RPC: register_my_daily_report_attachment.
   * @param reportId — דוח / מזהה.
   * @param file — קובץ.
   * @returns Promise<void> — הפלט בהתאם לחתימה.
   */
  async uploadAttachment(reportId: string, file: File): Promise<void> {
    // Storage object keys are deliberately ASCII-only. The original Hebrew
    // filename is preserved separately in daily_report_attachments.file_name.
    const extensionMatch = file.name.match(/\.([a-zA-Z0-9]{1,10})$/);
    const safeExtension = extensionMatch ? `.${extensionMatch[1].toLowerCase()}` : '';
    // path — נתיב.
    const path = `${reportId}/${crypto.randomUUID()}${safeExtension}`;
    // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
    const { error: uploadError } = await supabase.storage
      .from('daily-report-attachments')
      .upload(path, file, { contentType: file.type || 'application/octet-stream', upsert: false });
    if (uploadError) throw errorMessage(`העלאת ${file.name} נכשלה`, uploadError);

    // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
    const { error } = await supabase.rpc('register_my_daily_report_attachment', {
      requested_report_id: reportId,
      requested_storage_path: path,
      requested_file_name: file.name,
      requested_mime_type: file.type || null,
      requested_file_size: file.size,
    });
    // עצירת הפעולה עם שגיאה כאשר error.
    if (error) {
      await supabase.storage.from('daily-report-attachments').remove([path]);
      throw errorMessage(`שמירת ${file.name} נכשלה`, error);
    }
  },

  /**
   * פעולה אסינכרונית openAttachment: פתיחת הנתון openAttachment בהקשר הפעולה.
   * הפעולה פונה ל־RPC: get_daily_report_attachment_download.
   * @param attachmentId — מזהה.
   * @returns Promise<void> — הפלט בהתאם לחתימה.
   */
  async openAttachment(attachmentId: string): Promise<void> {
    // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
    const { data, error } = await supabase.rpc('get_daily_report_attachment_download', {
      requested_attachment_id: attachmentId,
    });
    if (error) throw errorMessage('פתיחת הקובץ נכשלה', error);
    // storagePath — נתיב.
    const storagePath = String((data as { storagePath?: unknown } | null)?.storagePath ?? '');
    // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
    const { data: signed, error: signedError } = await supabase.storage
      .from('daily-report-attachments')
      .createSignedUrl(storagePath, 120);
    if (signedError) throw errorMessage('יצירת קישור לקובץ נכשלה', signedError);
    window.open(signed.signedUrl, '_blank', 'noopener,noreferrer');
  },

  /**
   * פעולה אסינכרונית submit: הגשת הנתון submit בהקשר הפעולה.
   * הפעולה פונה ל־RPC: submit_my_daily_report.
   * @param jobTypeId — מזהה סוג התפקיד.
   * @param items — פריטים.
   * @param preparedReportId — דוח / מזהה.
   * @returns Promise<void> — הפלט בהתאם לחתימה.
   */
  async submit(jobTypeId: string, items: DailyReportItemInput[], preparedReportId?: string): Promise<void> {
    // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
    const { data, error } = await supabase.rpc('submit_my_daily_report', {
      requested_job_type_id: jobTypeId,
      requested_items: items,
      requested_report_id: preparedReportId ?? null,
    });
    if (error) throw errorMessage('שליחת הדיווח נכשלה', error);

    // notificationIds — התראות.
    const notificationIds = Array.isArray((data as { notificationIds?: unknown } | null)?.notificationIds)
      ? ((data as { notificationIds: unknown[] }).notificationIds.filter((id): id is string => typeof id === 'string'))
      : [];

    // עיבוד כל פריט מתוך notificationIds בנפרד.
    for (const notificationId of notificationIds) {
      // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
      const { error: pushError } = await supabase.functions.invoke('send-notification', {
        body: { notificationId },
      });
      if (pushError) {
        console.error('Daily report Push delivery failed:', { notificationId, pushError });
      }
    }
  },

  /**
   * פעולה אסינכרונית getDetail: שליפה או חישוב של הנתון getDetail בהקשר הפעולה.
   * הפעולה פונה ל־RPC: get_daily_report_notification_detail.
   * @param reportId — דוח / מזהה.
   * @returns Promise<DailyReportDetail> — הפלט בהתאם לחתימה.
   */
  async getDetail(reportId: string): Promise<DailyReportDetail> {
    // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
    const { data, error } = await supabase.rpc('get_daily_report_notification_detail', {
      requested_report_id: reportId,
    });
    if (error) throw errorMessage('טעינת הדיווח נכשלה', error);
    return data as DailyReportDetail;
  },
};
