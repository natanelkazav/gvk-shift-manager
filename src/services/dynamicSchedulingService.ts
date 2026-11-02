/**
 * קובץ: src/services/dynamicSchedulingService.ts
 * מטרה: ניהול סוגי תפקידים, תצורה ופעולות השיבוץ הדינמי.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: DynamicExchangeCommitment, flushPendingOperationalPushNotifications.
 * - קריאות RPC המופעלות בקובץ: get_my_pending_operational_push_notifications, mark_my_operational_push_dispatched, get_dynamic_schedule_export_workspace, get_dynamic_schedule_calendar_workspace, has_dynamic_job_type_permission, get_dynamic_historical_slot_editor, set_dynamic_historical_assignment, get_dynamic_shifts_management_workspace, get_dynamic_availability_reminder_settings, set_dynamic_availability_reminder_settings, set_dynamic_period_submission_deadline, get_my_dynamic_shift_exchange_options.
 * - ריכוז הפנייה למקור הנתונים ועיבוד התשובה בהתאם לפונקציות להלן.
 */
/**
 * חוזה הנתונים DynamicExchangeCommitment: דינמי.
 */
export interface DynamicExchangeCommitment {
  // id — מזהה.
  id: string;
  // jobTypeId — מזהה סוג התפקיד.
  jobTypeId: string;
  // debtorUserId — מזהה משתמש.
  debtorUserId: string;
  // creditorUserId — מזהה משתמש.
  creditorUserId: string;
  // returnGroup — קבוצה.
  returnGroup: 'weekday' | 'weekend';
  // dueMonth — חודש.
  dueMonth: string;
  // status — סטטוס.
  status: 'open' | 'fulfilled';
  // sourceRequestId — מזהה הבקשה.
  sourceRequestId: string;
  // fulfillmentRequestId — מזהה הבקשה.
  fulfillmentRequestId: string | null;
  fulfilledAt: string | null;
}

import { supabase } from '../lib/supabase';
import type { MyOnCallCoverageConflict } from '../types/dynamicScheduling';
import { PerformanceDebugService } from './performanceDebugService';
import { schedulePublicationNotificationService } from './schedulePublicationNotificationService';

/**
 * פעולה אסינכרונית flushPendingOperationalPushNotifications: ממתין / התראות Push / התראות.
 * הפעולה פונה ל־RPC: get_my_pending_operational_push_notifications, mark_my_operational_push_dispatched.
 * @returns Promise<void> — הפלט בהתאם לחתימה.
 */
async function flushPendingOperationalPushNotifications(): Promise<void> {
  // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
  try {
    // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
    const { data, error } = await supabase.rpc('get_my_pending_operational_push_notifications');
    if (error) throw error;

    // notificationIds — התראות.
    const notificationIds = Array.isArray(data)
      ? data.filter((value): value is string => typeof value === 'string')
      : [];

    // עיבוד כל פריט מתוך notificationIds בנפרד.
    for (const notificationId of notificationIds) {
      // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
      const { error: deliveryError } = await supabase.functions.invoke('send-notification', {
        body: { notificationId },
      });
      if (deliveryError) {
        console.error('Operational Push delivery failed:', { notificationId, deliveryError });
        continue;
      }

      // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
      const { error: markError } = await supabase.rpc('mark_my_operational_push_dispatched', {
        requested_notification_id: notificationId,
      });
      if (markError) {
        console.error('Failed to mark operational Push as dispatched:', { notificationId, markError });
      }
    }
  } catch (error) {
    // The scheduling action itself must remain successful even if Push delivery fails.
    console.error('Failed to flush operational Push notifications:', error);
  }
}

import type {
  DynamicAvailabilityShadowSummary,
  DynamicAvailabilityWorkspace,
  DynamicAvailabilityLegacyComparison,
  SaveDynamicAvailabilityShadowSubmissionInput,
  DynamicFeasibilityAnalysis,
  DynamicShadowDraftResult,
  DynamicShadowDiagnostics,
  DynamicShadowValidation,
  DynamicWeeklyRestValidation,
  DynamicSchedulePreview,
  DynamicSchedulingAdminData,
  DynamicJobType,
  SaveDynamicJobTypeInput,
  SaveDynamicScheduleGroupInput,
  DynamicMembershipAdminData,
  DynamicMemberEmploymentScope,
  DynamicPartTimeDefinition,
  DynamicLegacySourceKind,
  DynamicLegacyImportPreview,
  DynamicLegacyImportResult,
  DynamicRoleWorkspace,
  DynamicRotationWorkspace,
  DynamicPeriodWorkflowState,
  DynamicAvailabilityReminderSettings,
  DynamicPublishedEditorWorkspace,
  DynamicHistoricalSlotEditorWorkspace,
  DynamicSchedulePublicationResult,
  MyDynamicAvailabilityPeriod,
  MyDynamicSchedulePeriod,
  MyDynamicScheduleWorkspace,
  DynamicSelfEditWorkspace,
  DynamicShiftExchangeOptions,
  DynamicShiftExchangeRequest,
  DynamicShiftExchangeType,
} from '../types/dynamicScheduling';
import type {
  DynamicScheduleCalendarWorkspace,
  DynamicShiftsManagementWorkspace,
} from '../types/dynamicShiftsWorkspace';

/**
 * פעולה throwSupabaseError: שגיאה.
 * @param context — הנתון context בהקשר הפעולה.
 * @param error — שגיאה.
 * @returns never — הפלט בהתאם לחתימה.
 */
const throwSupabaseError = (
  context: string,
  error: { message: string; code?: string | null },
): never => {
  console.error(`${context} Supabase error:`, error);

  throw new Error(`${error.message}${error.code ? ` | Code: ${error.code}` : ''}`);
};

// dynamicSchedulingService — דינמי / שירות.
export const dynamicSchedulingService = {
  /**
   * פעולה אסינכרונית getScheduleExportWorkspace: שליפה או חישוב של שיבוץ / ייצוא.
   * @param year — שנה.
   * @param month — חודש.
   * @param jobTypeIds — מזהה סוג התפקיד.
   * @returns Promise<DynamicScheduleCalendarWorkspace> — הפלט בהתאם לחתימה.
   */
  async getScheduleExportWorkspace(
    year: number,
    month: number,
    jobTypeIds: string[],
  ): Promise<DynamicScheduleCalendarWorkspace> {
    return PerformanceDebugService.measureAsync('dynamic-scheduling.phase10.8.1.5.schedule-export-workspace', async () => {
      // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
      const { data, error } = await supabase.rpc('get_dynamic_schedule_export_workspace', {
        requested_year: year,
        requested_month: month,
        requested_job_type_ids: jobTypeIds,
      });
      if (error) throwSupabaseError('Dynamic schedule export workspace', error);
      return data as DynamicScheduleCalendarWorkspace;
    });
  },

  /**
   * פעולה אסינכרונית getScheduleCalendarWorkspace: שליפה או חישוב של שיבוץ / לוח שנה.
   * @param year — שנה.
   * @param month — חודש.
   * @returns Promise<DynamicScheduleCalendarWorkspace> — הפלט בהתאם לחתימה.
   */
  async getScheduleCalendarWorkspace(year: number, month: number): Promise<DynamicScheduleCalendarWorkspace> {
    return PerformanceDebugService.measureAsync('dynamic-scheduling.phase10.5.8.schedule-calendar', async () => {
      // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
      const { data, error } = await supabase.rpc('get_dynamic_schedule_calendar_workspace', {
        requested_year: year,
        requested_month: month,
      });
      if (error) throwSupabaseError('Dynamic schedule calendar workspace', error);
      return data as DynamicScheduleCalendarWorkspace;
    });
  },

  /**
   * פעולה אסינכרונית hasMyDynamicJobTypePermission: בדיקת קיום עבור סוג תפקיד.
   * הפעולה פונה ל־RPC: has_dynamic_job_type_permission.
   * @param permissionKey — מפתח ההרשאה.
   * @param jobTypeId — מזהה סוג התפקיד.
   * @returns Promise<boolean> — הפלט בהתאם לחתימה.
   */
  async hasMyDynamicJobTypePermission(permissionKey: string, jobTypeId: string): Promise<boolean> {
    // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
    const { data, error } = await supabase.rpc('has_dynamic_job_type_permission', {
      requested_permission_key: permissionKey,
      requested_job_type_id: jobTypeId,
    });
    if (error) throwSupabaseError('Dynamic job type permission check', error);
    return Boolean(data);
  },

  /**
   * פעולה אסינכרונית getHistoricalSlotEditor: שליפה או חישוב של נתונים היסטוריים.
   * @param input — קלט.
   * @returns Promise<DynamicHistoricalSlotEditorWorkspace> — הפלט בהתאם לחתימה.
   */
  async getHistoricalSlotEditor(input: {
    // historicalPeriodId — מזהה התקופה.
    historicalPeriodId: string;
    // workDate — תאריך העבודה.
    workDate: string;
    // shiftCode — משמרת.
    shiftCode: string;
    // startTime — שעת התחלה.
    startTime: string;
    // endTime — שעת סיום.
    endTime: string;
  }): Promise<DynamicHistoricalSlotEditorWorkspace> {
    return PerformanceDebugService.measureAsync('dynamic-scheduling.phase10.5.15.history-editor', async () => {
      // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
      const { data, error } = await supabase.rpc('get_dynamic_historical_slot_editor', {
        requested_historical_period_id: input.historicalPeriodId,
        requested_work_date: input.workDate,
        requested_shift_code: input.shiftCode,
        requested_start_time: input.startTime,
        requested_end_time: input.endTime,
      });
      if (error) throwSupabaseError('Dynamic historical slot editor', error);
      return data as DynamicHistoricalSlotEditorWorkspace;
    });
  },

  /**
   * פעולה אסינכרונית setHistoricalAssignment: קביעת קבוצה ייחודית / נתונים היסטוריים / הקצאה.
   * @param input — קלט.
   * @returns Promise<void> — הפלט בהתאם לחתימה.
   */
  async setHistoricalAssignment(input: {
    // historicalPeriodId — מזהה התקופה.
    historicalPeriodId: string;
    // assignmentId — הקצאה / מזהה.
    assignmentId: string;
    // userId — מזהה משתמש.
    userId: string | null;
    reason: string | null;
  }): Promise<void> {
    await PerformanceDebugService.measureAsync('dynamic-scheduling.phase10.5.15.history-edit', async () => {
      // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
      const { error } = await supabase.rpc('set_dynamic_historical_assignment', {
        requested_historical_period_id: input.historicalPeriodId,
        requested_assignment_id: input.assignmentId,
        requested_user_id: input.userId,
        requested_reason: input.reason?.trim() || null,
      });
      if (error) throwSupabaseError('Set dynamic historical assignment', error);
    });
  },

  /**
   * פעולה אסינכרונית getShiftsManagementWorkspace: שליפה או חישוב של משמרות.
   * @param year — שנה.
   * @param month — חודש.
   * @returns Promise<DynamicShiftsManagementWorkspace> — הפלט בהתאם לחתימה.
   */
  async getShiftsManagementWorkspace(year: number, month: number): Promise<DynamicShiftsManagementWorkspace> {
    return PerformanceDebugService.measureAsync('dynamic-scheduling.phase10.1.shifts-workspace', async () => {
      // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
      const { data, error } = await supabase.rpc('get_dynamic_shifts_management_workspace', {
        requested_year: year,
        requested_month: month,
      });
      if (error) throwSupabaseError('Dynamic shifts management workspace', error);
      return data as DynamicShiftsManagementWorkspace;
    });
  },

  /**
   * פעולה אסינכרונית getDynamicAvailabilityReminderSettings: שליפה או חישוב של דינמי / אילוצים וזמינות / תזכורות / הגדרות.
   * @param jobTypeId — מזהה סוג התפקיד.
   * @param year — שנה.
   * @param month — חודש.
   * @returns Promise<DynamicAvailabilityReminderSettings> — הפלט בהתאם לחתימה.
   */
  async getDynamicAvailabilityReminderSettings(jobTypeId: string, year: number, month: number): Promise<DynamicAvailabilityReminderSettings> {
    return PerformanceDebugService.measureAsync('dynamic-scheduling.availability-reminders.get', async () => {
      // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
      const { data, error } = await supabase.rpc('get_dynamic_availability_reminder_settings', {
        requested_job_type_id: jobTypeId, requested_year: year, requested_month: month,
      });
      if (error) throwSupabaseError('Get dynamic availability reminder settings', error);
      return data as DynamicAvailabilityReminderSettings;
    });
  },

  /**
   * פעולה אסינכרונית setDynamicAvailabilityReminderSettings: קביעת קבוצה ייחודית / דינמי / אילוצים וזמינות / תזכורות.
   * @param jobTypeId — מזהה סוג התפקיד.
   * @param days — ימים.
   * @returns Promise<void> — הפלט בהתאם לחתימה.
   */
  async setDynamicAvailabilityReminderSettings(jobTypeId: string, days: number[]): Promise<void> {
    await PerformanceDebugService.measureAsync('dynamic-scheduling.availability-reminders.save', async () => {
      // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
      const { error } = await supabase.rpc('set_dynamic_availability_reminder_settings', {
        requested_job_type_id: jobTypeId, requested_days: days,
      });
      if (error) throwSupabaseError('Set dynamic availability reminder settings', error);
    });
  },

  /**
   * פעולה אסינכרונית setDynamicPeriodSubmissionDeadline: קביעת מועד אחרון להגשת אילוצים.
   * @param jobTypeId — מזהה סוג התפקיד.
   * @param year — שנה.
   * @param month — חודש.
   * @param deadline — הנתון deadline בהקשר הפעולה.
   * @returns Promise<void> — הפלט בהתאם לחתימה.
   */
  async setDynamicPeriodSubmissionDeadline(
    jobTypeId: string,
    year: number,
    month: number,
    deadline: string | null,
  ): Promise<void> {
    await PerformanceDebugService.measureAsync('dynamic-scheduling.phase10.1.period-deadline', async () => {
      // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
      const { error } = await supabase.rpc('set_dynamic_period_submission_deadline', {
        requested_job_type_id: jobTypeId,
        requested_year: year,
        requested_month: month,
        requested_deadline: deadline,
      });
      if (error) throwSupabaseError('Dynamic period submission deadline', error);
    });
  },
  /**
   * פעולה אסינכרונית getMyDynamicShiftExchangeOptions: שליפה או חישוב של החלפת משמרות.
   * @returns Promise<DynamicShiftExchangeOptions> — הפלט בהתאם לחתימה.
   */
  async getMyDynamicShiftExchangeOptions(): Promise<DynamicShiftExchangeOptions> {
    return PerformanceDebugService.measureAsync('dynamic-scheduling.phase8.3e2.exchange-options', async () => {
      // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
      const { data, error } = await supabase.rpc('get_my_dynamic_shift_exchange_options');
      if (error) throwSupabaseError('Dynamic shift exchange options', error);
      const payload = (data ?? {}) as Partial<DynamicShiftExchangeOptions>;
      return {
        hasDynamicShiftExchange: Boolean(payload.hasDynamicShiftExchange),
        publications: Array.isArray(payload.publications) ? payload.publications : [],
        myShifts: Array.isArray(payload.myShifts) ? payload.myShifts : [],
        members: Array.isArray(payload.members) ? payload.members : [],
        counterpartyShifts: Array.isArray(payload.counterpartyShifts) ? payload.counterpartyShifts : [],
      };
    });
  },

  /**
   * פעולה אסינכרונית getMyDynamicExchangeCommitments: שליפה או חישוב של דינמי.
   * @returns Promise<DynamicExchangeCommitment[]> — הפלט בהתאם לחתימה.
   */
  async getMyDynamicExchangeCommitments(): Promise<DynamicExchangeCommitment[]> {
    return PerformanceDebugService.measureAsync('dynamic-scheduling.exchange-commitments', async () => {
      // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
      const { data, error } = await supabase.rpc('get_my_dynamic_exchange_commitments');
      if (error) throwSupabaseError('Dynamic exchange commitments', error);
      return Array.isArray(data) ? data as DynamicExchangeCommitment[] : [];
    });
  },

  /**
   * פעולה אסינכרונית getDynamicShiftExchangeRequests: שליפה או חישוב של החלפת משמרות.
   * הפעולה פונה ל־RPC: get_dynamic_shift_exchange_requests.
   * @returns Promise<DynamicShiftExchangeRequest[]> — הפלט בהתאם לחתימה.
   */
  async getDynamicShiftExchangeRequests(): Promise<DynamicShiftExchangeRequest[]> {
    // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
    const { data, error } = await supabase.rpc('get_dynamic_shift_exchange_requests');
    if (error) throwSupabaseError('Dynamic shift exchange requests', error);
    return Array.isArray(data) ? data as DynamicShiftExchangeRequest[] : [];
  },

  /**
   * פעולה אסינכרונית createDynamicShiftExchangeRequest: יצירת החלפת משמרות.
   * הפעולה פונה ל־RPC: create_dynamic_shift_exchange_request.
   * @param input — קלט.
   * @returns Promise<void> — הפלט בהתאם לחתימה.
   */
  async createDynamicShiftExchangeRequest(input: {
    swapType: DynamicShiftExchangeType; requesterAssignmentId: string; counterpartyUserId: string; counterpartyAssignmentId?: string | null;
  }): Promise<void> {
    // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
    const { error } = await supabase.rpc('create_dynamic_shift_exchange_request', {
      requested_swap_type: input.swapType,
      requested_requester_assignment_id: input.requesterAssignmentId,
      requested_counterparty_user_id: input.counterpartyUserId,
      requested_counterparty_assignment_id: input.counterpartyAssignmentId ?? null,
    });
    if (error) throwSupabaseError('Create dynamic shift exchange request', error);
  },

  /**
   * פעולה אסינכרונית requestDynamicExchangeReturnCommitment: נתוני הבקשה / דינמי.
   * הפעולה פונה ל־RPC: request_dynamic_exchange_return_commitment.
   * @param requestId — מזהה הבקשה.
   * @returns Promise<void> — הפלט בהתאם לחתימה.
   */
  async requestDynamicExchangeReturnCommitment(requestId: string): Promise<void> {
    // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
    const { error } = await supabase.rpc('request_dynamic_exchange_return_commitment', { requested_request_id: requestId });
    if (error) throwSupabaseError('Request exchange return commitment', error);
  },

  /**
   * פעולה אסינכרונית consentDynamicExchangeReturnCommitment: דינמי.
   * הפעולה פונה ל־RPC: consent_dynamic_exchange_return_commitment.
   * @param requestId — מזהה הבקשה.
   * @param accept — הנתון accept בהקשר הפעולה.
   * @returns Promise<void> — הפלט בהתאם לחתימה.
   */
  async consentDynamicExchangeReturnCommitment(requestId: string, accept: boolean): Promise<void> {
    // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
    const { error } = await supabase.rpc('consent_dynamic_exchange_return_commitment', {
      requested_request_id: requestId, requested_accept: accept,
    });
    if (error) throwSupabaseError('Consent to exchange return commitment', error);
  },

  /**
   * פעולה אסינכרונית respondToDynamicShiftExchangeRequest: החלפת משמרות.
   * הפעולה פונה ל־RPC: respond_to_dynamic_shift_exchange_request.
   * @param requestId — מזהה הבקשה.
   * @param approve — הנתון approve בהקשר הפעולה.
   * @param rejectionReason — הנתון rejectionReason בהקשר הפעולה.
   * @returns Promise<void> — הפלט בהתאם לחתימה.
   */
  async respondToDynamicShiftExchangeRequest(requestId: string, approve: boolean, rejectionReason?: string): Promise<void> {
    // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
    const { error } = await supabase.rpc('respond_to_dynamic_shift_exchange_request', {
      requested_request_id: requestId, requested_approve: approve, requested_rejection_reason: rejectionReason?.trim() || null,
    });
    if (error) throwSupabaseError('Respond dynamic shift exchange request', error);
  },

  /**
   * פעולה אסינכרונית reviewDynamicShiftExchangeRequest: החלפת משמרות.
   * הפעולה פונה ל־RPC: review_dynamic_shift_exchange_request.
   * @param requestId — מזהה הבקשה.
   * @param approve — הנתון approve בהקשר הפעולה.
   * @param rejectionReason — הנתון rejectionReason בהקשר הפעולה.
   * @returns Promise<void> — הפלט בהתאם לחתימה.
   */
  async reviewDynamicShiftExchangeRequest(requestId: string, approve: boolean, rejectionReason?: string): Promise<void> {
    // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
    const { error } = await supabase.rpc('review_dynamic_shift_exchange_request', {
      requested_request_id: requestId, requested_approve: approve, requested_rejection_reason: rejectionReason?.trim() || null,
    });
    if (error) throwSupabaseError('Review dynamic shift exchange request', error);
    if (approve) await flushPendingOperationalPushNotifications();
  },

  /**
   * פעולה אסינכרונית cancelDynamicShiftExchangeRequest: ביטול החלפת משמרות.
   * הפעולה פונה ל־RPC: cancel_dynamic_shift_exchange_request.
   * @param requestId — מזהה הבקשה.
   * @returns Promise<void> — הפלט בהתאם לחתימה.
   */
  async cancelDynamicShiftExchangeRequest(requestId: string): Promise<void> {
    // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
    const { error } = await supabase.rpc('cancel_dynamic_shift_exchange_request', { requested_request_id: requestId });
    if (error) throwSupabaseError('Cancel dynamic shift exchange request', error);
  },
  /**
   * פעולה אסינכרונית getPublishedScheduleEditor: שליפה או חישוב של פורסם / שיבוץ.
   * @param publicationId — מזהה.
   * @returns Promise<DynamicPublishedEditorWorkspace> — הפלט בהתאם לחתימה.
   */
  async getPublishedScheduleEditor(publicationId: string): Promise<DynamicPublishedEditorWorkspace> {
    return PerformanceDebugService.measureAsync('dynamic-scheduling.phase9.1.3.published-editor', async () => {
      // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
      const { data, error } = await supabase.rpc('get_dynamic_published_schedule_editor', {
        requested_publication_id: publicationId,
      });
      if (error) throwSupabaseError('Dynamic published schedule editor', error);
      return data as DynamicPublishedEditorWorkspace;
    });
  },

  /**
   * פעולה אסינכרונית setPublishedScheduleAssignment: קביעת קבוצה ייחודית / פורסם / שיבוץ / הקצאה.
   * @param input — קלט.
   * @returns Promise<void> — הפלט בהתאם לחתימה.
   */
  async setPublishedScheduleAssignment(input: {
    // publicationId — מזהה.
    publicationId: string;
    // slotId — מזהה.
    slotId: string;
    // assignmentId — הקצאה / מזהה.
    assignmentId: string | null;
    // userId — מזהה משתמש.
    userId: string | null;
    reason: string | null;
  }): Promise<void> {
    await PerformanceDebugService.measureAsync('dynamic-scheduling.phase9.1.3.published-edit', async () => {
      // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
      const { error } = await supabase.rpc('set_dynamic_published_schedule_assignment', {
        requested_publication_id: input.publicationId,
        requested_slot_id: input.slotId,
        requested_assignment_id: input.assignmentId,
        requested_user_id: input.userId,
        requested_reason: input.reason?.trim() || null,
      });
      if (error) throwSupabaseError('Set dynamic published schedule assignment', error);
      await flushPendingOperationalPushNotifications();
    });
  },

  /**
   * פעולה אסינכרונית getMyOnCallCoverageConflicts: שליפה או חישוב של הנתון getMyOnCallCoverageConflicts בהקשר הפעולה.
   * @returns Promise<MyOnCallCoverageConflict[]> — הפלט בהתאם לחתימה.
   */
  async getMyOnCallCoverageConflicts(): Promise<MyOnCallCoverageConflict[]> {
    return PerformanceDebugService.measureAsync('dynamic-scheduling.oncall.coverage-conflicts', async () => {
      // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
      const { data, error } = await supabase.rpc('get_my_oncall_coverage_conflicts');
      if (error) throwSupabaseError('My on-call coverage conflicts', error);
      return (Array.isArray(data) ? data : []) as MyOnCallCoverageConflict[];
    });
  },

  /**
   * פעולה אסינכרונית getMyDynamicSchedulePeriods: שליפה או חישוב של תקופות שיבוץ.
   * @returns Promise<MyDynamicSchedulePeriod[]> — הפלט בהתאם לחתימה.
   */
  async getMyDynamicSchedulePeriods(): Promise<MyDynamicSchedulePeriod[]> {
    return PerformanceDebugService.measureAsync('dynamic-scheduling.phase8.3d.my-schedule-periods', async () => {
      // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
      const { data, error } = await supabase.rpc('get_my_dynamic_schedule_periods');
      if (error) throwSupabaseError('My dynamic schedule periods', error);
      return (data ?? []) as MyDynamicSchedulePeriod[];
    });
  },

  /**
   * פעולה אסינכרונית getMyDynamicScheduleWorkspace: שליפה או חישוב של דינמי / שיבוץ.
   * @param publicationId — מזהה.
   * @returns Promise<MyDynamicScheduleWorkspace> — הפלט בהתאם לחתימה.
   */
  async getMyDynamicScheduleWorkspace(publicationId: string): Promise<MyDynamicScheduleWorkspace> {
    return PerformanceDebugService.measureAsync('dynamic-scheduling.phase8.3d.my-schedule-workspace', async () => {
      // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
      const { data, error } = await supabase.rpc('get_my_dynamic_schedule_workspace', {
        requested_publication_id: publicationId,
      });
      if (error) throwSupabaseError('My dynamic schedule workspace', error);
      return data as MyDynamicScheduleWorkspace;
    });
  },

  /**
   * פעולה אסינכרונית getMyDynamicSelfEditWorkspace: שליפה או חישוב של דינמי.
   * @param publicationId — מזהה.
   * @returns Promise<DynamicSelfEditWorkspace> — הפלט בהתאם לחתימה.
   */
  async getMyDynamicSelfEditWorkspace(publicationId: string): Promise<DynamicSelfEditWorkspace> {
    return PerformanceDebugService.measureAsync('dynamic-scheduling.phase8.3e1.self-edit-workspace', async () => {
      // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
      const { data, error } = await supabase.rpc('get_my_dynamic_self_edit_workspace', {
        requested_publication_id: publicationId,
      });
      if (error) throwSupabaseError('My dynamic self edit workspace', error);
      return data as DynamicSelfEditWorkspace;
    });
  },

  /**
   * פעולה אסינכרונית updateMyDynamicPublishedAssignment: עדכון דינמי / פורסם / הקצאה.
   * @param publicationId — מזהה.
   * @param assignmentId — הקצאה / מזהה.
   * @param userId — מזהה משתמש.
   * @returns Promise<void> — הפלט בהתאם לחתימה.
   */
  async updateMyDynamicPublishedAssignment(
    publicationId: string,
    assignmentId: string,
    userId: string,
  ): Promise<void> {
    await PerformanceDebugService.measureAsync('dynamic-scheduling.phase8.3e1.self-edit-assignment', async () => {
      // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
      const { error } = await supabase.rpc('update_my_dynamic_published_assignment', {
        requested_publication_id: publicationId,
        requested_assignment_id: assignmentId,
        requested_user_id: userId,
      });
      if (error) throwSupabaseError('Update my dynamic published assignment', error);
      await flushPendingOperationalPushNotifications();
    });
  },
  /**
   * פעולה אסינכרונית getMyDynamicAvailabilityPeriods: שליפה או חישוב של תקופות אילוצים.
   * @returns Promise<MyDynamicAvailabilityPeriod[]> — הפלט בהתאם לחתימה.
   */
  async getMyDynamicAvailabilityPeriods(): Promise<MyDynamicAvailabilityPeriod[]> {
    return PerformanceDebugService.measureAsync('dynamic-scheduling.phase8.3b4.my-periods', async () => {
      // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
      const { data, error } = await supabase.rpc('get_my_dynamic_availability_periods');
      if (error) throwSupabaseError('My dynamic availability periods', error);
      return (data ?? []) as MyDynamicAvailabilityPeriod[];
    });
  },

  /**
   * פעולה אסינכרונית getMyDynamicAvailabilityWorkspace: שליפה או חישוב של דינמי / אילוצים וזמינות.
   * @param jobTypeId — מזהה סוג התפקיד.
   * @param year — שנה.
   * @param month — חודש.
   * @returns Promise<DynamicAvailabilityWorkspace> — הפלט בהתאם לחתימה.
   */
  async getMyDynamicAvailabilityWorkspace(
    jobTypeId: string,
    year: number,
    month: number,
  ): Promise<DynamicAvailabilityWorkspace> {
    return PerformanceDebugService.measureAsync('dynamic-scheduling.phase8.3b4.my-workspace', async () => {
      // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
      const { data, error } = await supabase.rpc('get_my_dynamic_availability_workspace', {
        requested_job_type_id: jobTypeId,
        requested_year: year,
        requested_month: month,
      });
      if (error) throwSupabaseError('My dynamic availability workspace', error);
      return data as DynamicAvailabilityWorkspace;
    });
  },

  /**
   * פעולה אסינכרונית saveMyDynamicAvailabilitySubmission: שמירת דינמי / אילוצים וזמינות.
   * @param jobTypeId — מזהה סוג התפקיד.
   * @param year — שנה.
   * @param month — חודש.
   * @param payload — הנתון payload בהקשר הפעולה.
   * @returns Promise<void> — הפלט בהתאם לחתימה.
   */
  async saveMyDynamicAvailabilitySubmission(
    jobTypeId: string,
    year: number,
    month: number,
    payload: SaveDynamicAvailabilityShadowSubmissionInput,
  ): Promise<void> {
    await PerformanceDebugService.measureAsync('dynamic-scheduling.phase8.3b4.save-my-submission', async () => {
      // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
      const { error } = await supabase.rpc('save_my_dynamic_availability_submission', {
        requested_job_type_id: jobTypeId,
        requested_year: year,
        requested_month: month,
        requested_payload: payload,
      });
      if (error) throwSupabaseError('Save my dynamic availability submission', error);
    });
  },
  /**
   * פעולה אסינכרונית getAdminData: שליפה או חישוב של נתונים.
   * הפעולה פונה ל־RPC: get_dynamic_scheduling_admin.
   * @returns Promise<DynamicSchedulingAdminData> — הפלט בהתאם לחתימה.
   */
  async getAdminData(): Promise<DynamicSchedulingAdminData> {
    // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
    const { data, error } = await supabase.rpc('get_dynamic_scheduling_admin');

    if (error) {
      throwSupabaseError('Dynamic scheduling admin', error);
    }

    return data as DynamicSchedulingAdminData;
  },

  /**
   * פעולה אסינכרונית saveJobType: שמירת סוג תפקיד.
   * @param input — קלט.
   * @returns Promise<string> — הפלט בהתאם לחתימה.
   */
  async saveJobType(input: SaveDynamicJobTypeInput): Promise<string> {
    return PerformanceDebugService.measureAsync('dynamic-scheduling.phase8.1.save-job-type', async () => {
      // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
      const { data, error } = await supabase.rpc('save_dynamic_job_type', {
        requested_payload: input,
      });

      if (error) {
        throwSupabaseError('Save dynamic job type', error);
      }

      return String(data);
    });
  },

  /**
   * פעולה אסינכרונית getEffectiveJobType: שליפה או חישוב של סוג תפקיד.
   * הפעולה פונה ל־RPC: get_dynamic_job_type_effective_config.
   * @param jobTypeId — מזהה סוג התפקיד.
   * @param year — שנה.
   * @param month — חודש.
   * @returns Promise<DynamicJobType> — הפלט בהתאם לחתימה.
   */
  async getEffectiveJobType(
    jobTypeId: string,
    year: number,
    month: number,
  ): Promise<DynamicJobType> {
    // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
    const { data, error } = await supabase.rpc('get_dynamic_job_type_effective_config', {
      requested_job_type_id: jobTypeId,
      requested_year: year,
      requested_month: month,
    });

    if (error) {
      throwSupabaseError('Get effective dynamic job type', error);
    }

    return data as DynamicJobType;
  },

  /**
   * פעולה אסינכרונית setJobTypeActive: קביעת סוג תפקיד.
   * @param jobTypeId — מזהה סוג התפקיד.
   * @param isActive — האם הרשומה פעילה.
   * @returns Promise<void> — הפלט בהתאם לחתימה.
   */
  async setJobTypeActive(jobTypeId: string, isActive: boolean): Promise<void> {
    await PerformanceDebugService.measureAsync('dynamic-scheduling.phase8.2b.set-job-type-active', async () => {
      // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
      const { error } = await supabase.rpc('set_dynamic_job_type_active', {
        requested_job_type_id: jobTypeId,
        requested_is_active: isActive,
      });

      if (error) {
        throwSupabaseError(isActive ? 'Reactivate dynamic job type' : 'Freeze dynamic job type', error);
      }
    });
  },

  /**
   * פעולה אסינכרונית deleteJobType: מחיקת סוג תפקיד.
   * @param jobTypeId — מזהה סוג התפקיד.
   * @returns Promise<void> — הפלט בהתאם לחתימה.
   */
  async deleteJobType(jobTypeId: string): Promise<void> {
    await PerformanceDebugService.measureAsync('dynamic-scheduling.phase8.2b.delete-job-type', async () => {
      // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
      const { error } = await supabase.rpc('delete_dynamic_job_type', {
        requested_job_type_id: jobTypeId,
      });

      if (error) {
        throwSupabaseError('Delete dynamic job type', error);
      }
    });
  },

  /**
   * פעולה אסינכרונית getPeriodWorkflow: שליפה או חישוב של תקופה / תהליך עבודה.
   * @param jobTypeId — מזהה סוג התפקיד.
   * @param year — שנה.
   * @param month — חודש.
   * @returns Promise<DynamicPeriodWorkflowState> — הפלט בהתאם לחתימה.
   */
  async getPeriodWorkflow(jobTypeId: string, year: number, month: number): Promise<DynamicPeriodWorkflowState> {
    return PerformanceDebugService.measureAsync('dynamic-scheduling.phase8.3b.get-period-workflow', async () => {
      // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
      const { data, error } = await supabase.rpc('get_dynamic_period_workflow', {
        requested_job_type_id: jobTypeId,
        requested_year: year,
        requested_month: month,
      });
      if (error) throwSupabaseError('Dynamic period workflow', error);
      return data as DynamicPeriodWorkflowState;
    });
  },

  /**
   * פעולה אסינכרונית setPeriodStatus: קביעת קבוצה ייחודית / תקופה / סטטוס.
   * @param jobTypeId — מזהה סוג התפקיד.
   * @param year — שנה.
   * @param month — חודש.
   * @param action — הנתון action בהקשר הפעולה.
   * @returns Promise<{ periodId: string; status: string; action: string }> — הפלט בהתאם לחתימה.
   */
  async setPeriodStatus(
    jobTypeId: string,
    year: number,
    month: number,
    action: 'open' | 'close' | 'archive',
  ): Promise<{ periodId: string; status: string; action: string }> {
    return PerformanceDebugService.measureAsync('dynamic-scheduling.phase8.3b.set-period-status', async () => {
      // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
      const { data, error } = await supabase.rpc('set_dynamic_period_status', {
        requested_job_type_id: jobTypeId,
        requested_year: year,
        requested_month: month,
        requested_action: action,
      });
      if (error) throwSupabaseError('Dynamic period status', error);
      return data as { periodId: string; status: string; action: string };
    });
  },

  /**
   * פעולה אסינכרונית getDraftMemberPreferences: שליפה או חישוב של טיוטה.
   * @param draftId — טיוטה / מזהה.
   * @returns Promise<import('../types/dynamicScheduling').DynamicDraftMemberPreference[]> — הפלט בהתאם לחתימה.
   */
  async getDraftMemberPreferences(draftId: string): Promise<import('../types/dynamicScheduling').DynamicDraftMemberPreference[]> {
    return PerformanceDebugService.measureAsync('dynamic-scheduling.draft-member-preferences', async () => {
      // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
      const { data, error } = await supabase.rpc('get_dynamic_draft_member_preferences', { requested_draft_id: draftId });
      if (error) throwSupabaseError('Dynamic draft member preferences', error);
      return data as import('../types/dynamicScheduling').DynamicDraftMemberPreference[];
    });
  },

  /**
   * פעולה אסינכרונית getDraftWeeklyRestValidation: שליפה או חישוב של טיוטה / שבועי / מנוחה / אימות נתונים.
   * @param draftId — טיוטה / מזהה.
   * @returns Promise<import('../types/dynamicScheduling').DynamicWeeklyRestValidation> — הפלט בהתאם לחתימה.
   */
  async getDraftWeeklyRestValidation(draftId: string): Promise<import('../types/dynamicScheduling').DynamicWeeklyRestValidation> {
    return PerformanceDebugService.measureAsync('dynamic-scheduling.draft-weekly-rest-validation', async () => {
      // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
      const { data, error } = await supabase.rpc('get_dynamic_schedule_weekly_rest_validation', {
        requested_draft_id: draftId,
      });
      if (error) throwSupabaseError('Validate edited dynamic draft weekly rest', error);
      return data as import('../types/dynamicScheduling').DynamicWeeklyRestValidation;
    });
  },

  /**
   * פעולה אסינכרונית getDraftEditor: שליפה או חישוב של טיוטה.
   * @param draftId — טיוטה / מזהה.
   * @returns Promise<import('../types/dynamicScheduling').DynamicDraftEditorWorkspace> — הפלט בהתאם לחתימה.
   */
  async getDraftEditor(draftId: string): Promise<import('../types/dynamicScheduling').DynamicDraftEditorWorkspace> {
    return PerformanceDebugService.measureAsync('dynamic-scheduling.phase8.3c.draft-editor', async () => {
      // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
      const { data, error } = await supabase.rpc('get_dynamic_schedule_draft_editor', { requested_draft_id: draftId });
      if (error) throwSupabaseError('Dynamic schedule draft editor', error);
      return data as import('../types/dynamicScheduling').DynamicDraftEditorWorkspace;
    });
  },

  /**
   * פעולה אסינכרונית setDraftAssignment: קביעת קבוצה ייחודית / טיוטה / הקצאה.
   * @param draftId — טיוטה / מזהה.
   * @param slotId — מזהה.
   * @param assignmentId — הקצאה / מזהה.
   * @param userId — מזהה משתמש.
   * @param note — הערה.
   * @returns Promise<void> — הפלט בהתאם לחתימה.
   */
  async setDraftAssignment(draftId: string, slotId: string, assignmentId: string | null, userId: string, note?: string | null): Promise<void> {
    await PerformanceDebugService.measureAsync('dynamic-scheduling.phase8.3c.set-assignment', async () => {
      // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
      const { error } = await supabase.rpc('set_dynamic_schedule_draft_assignment', {
        requested_draft_id: draftId, requested_slot_id: slotId, requested_assignment_id: assignmentId,
        requested_user_id: userId, requested_note: note ?? null,
      });
      if (error) throwSupabaseError('Set dynamic draft assignment', error);
    });
  },

  /**
   * פעולה אסינכרונית removeDraftAssignment: הסרת טיוטה / הקצאה.
   * הפעולה פונה ל־RPC: remove_dynamic_schedule_draft_assignment.
   * @param draftId — טיוטה / מזהה.
   * @param assignmentId — הקצאה / מזהה.
   * @returns Promise<void> — הפלט בהתאם לחתימה.
   */
  async removeDraftAssignment(draftId: string, assignmentId: string): Promise<void> {
    // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
    const { error } = await supabase.rpc('remove_dynamic_schedule_draft_assignment', {
      requested_draft_id: draftId, requested_assignment_id: assignmentId,
    });
    if (error) throwSupabaseError('Remove dynamic draft assignment', error);
  },

  /**
   * פעולה אסינכרונית setDraftIntentionallyUnassigned: קביעת קבוצה ייחודית / טיוטה.
   * הפעולה פונה ל־RPC: set_dynamic_schedule_slot_intentionally_unassigned.
   * @param draftId — טיוטה / מזהה.
   * @param slotId — מזהה.
   * @param count — כמות.
   * @param note — הערה.
   * @returns Promise<void> — הפלט בהתאם לחתימה.
   */
  async setDraftIntentionallyUnassigned(draftId: string, slotId: string, count: number, note?: string | null): Promise<void> {
    // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
    const { error } = await supabase.rpc('set_dynamic_schedule_slot_intentionally_unassigned', {
      requested_draft_id: draftId, requested_slot_id: slotId, requested_count: count, requested_note: note ?? null,
    });
    if (error) throwSupabaseError('Set intentionally unassigned slot', error);
  },

  /**
   * פעולה אסינכרונית publishSchedulingDraft: פרסום טיוטה.
   * @param draftId — טיוטה / מזהה.
   * @returns Promise<DynamicSchedulePublicationResult> — הפלט בהתאם לחתימה.
   */
  async publishSchedulingDraft(draftId: string): Promise<DynamicSchedulePublicationResult> {
    return PerformanceDebugService.measureAsync('dynamic-scheduling.phase8.3b.publish-draft', async () => {
      // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
      const { data, error } = await supabase.rpc('publish_dynamic_schedule_draft', {
        requested_draft_id: draftId,
      });
      if (error) throwSupabaseError('Publish dynamic schedule draft', error);
      // result — תוצאה.
      const result = data as DynamicSchedulePublicationResult;
      if (result?.publicationId) {
        await schedulePublicationNotificationService.notifyDynamicPublished(
          result.publicationId,
        );
      }
      return result;
    });
  },


  /**
   * פעולה אסינכרונית getMyRotationDates: שליפה או חישוב של סבב כוננויות / תאריכים.
   * הפעולה פונה ל־RPC: get_my_dynamic_rotation_dates.
   * @param jobTypeId — מזהה סוג התפקיד.
   * @param year — שנה.
   * @param month — חודש.
   * @returns Promise<Array<{date:string; planned:boolean; published:boolean; hasPublishedAssignment:boolean}>> — הפלט בהתאם לחתימה.
   */
  async getMyRotationDates(jobTypeId: string, year: number, month: number): Promise<Array<{date:string; planned:boolean; published:boolean; hasPublishedAssignment:boolean}>> {
    // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
    const { data, error } = await supabase.rpc('get_my_dynamic_rotation_dates', {
      requested_job_type_id: jobTypeId, requested_year: year, requested_month: month,
    });
    if (error) throwSupabaseError('Personal rotation dates', error);
    return (data ?? []) as Array<{date:string; planned:boolean; published:boolean; hasPublishedAssignment:boolean}>;
  },

  /**
   * פעולה אסינכרונית getRotationWorkspace: שליפה או חישוב של סבב כוננויות.
   * הפעולה פונה ל־RPC: get_dynamic_job_type_rotation_workspace.
   * @param jobTypeId — מזהה סוג התפקיד.
   * @param startDate — תאריך.
   * @param days — ימים.
   * @returns Promise<DynamicRotationWorkspace> — הפלט בהתאם לחתימה.
   */
  async getRotationWorkspace(
    jobTypeId: string,
    startDate?: string,
    days = 35,
  ): Promise<DynamicRotationWorkspace> {
    // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
    const { data, error } = await supabase.rpc('get_dynamic_job_type_rotation_workspace', {
      requested_job_type_id: jobTypeId,
      requested_start_date: startDate ?? null,
      requested_days: days,
    });
    if (error) throwSupabaseError('Dynamic rotation workspace', error);
    return data as DynamicRotationWorkspace;
  },

  /**
   * פעולה אסינכרונית initializeRotation: סבב כוננויות.
   * הפעולה פונה ל־RPC: initialize_dynamic_job_type_rotation_state.
   * @param jobTypeId — מזהה סוג התפקיד.
   * @returns Promise<DynamicRotationWorkspace> — הפלט בהתאם לחתימה.
   */
  async initializeRotation(jobTypeId: string): Promise<DynamicRotationWorkspace> {
    // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
    const { data, error } = await supabase.rpc('initialize_dynamic_job_type_rotation_state', {
      requested_job_type_id: jobTypeId,
    });
    if (error) throwSupabaseError('Initialize dynamic rotation', error);
    return data as DynamicRotationWorkspace;
  },

  /**
   * פעולה אסינכרונית updateRotation: עדכון סבב כוננויות.
   * הפעולה פונה ל־RPC: update_dynamic_job_type_rotation_state.
   * @param jobTypeId — מזהה סוג התפקיד.
   * @param rotationUserIds — מזהה משתמש.
   * @param anchorDate — תאריך.
   * @param reason — הנתון reason בהקשר הפעולה.
   * @returns Promise<DynamicRotationWorkspace> — הפלט בהתאם לחתימה.
   */
  async updateRotation(
    jobTypeId: string,
    rotationUserIds: string[],
    anchorDate: string,
    reason?: string,
  ): Promise<DynamicRotationWorkspace> {
    // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
    const { data, error } = await supabase.rpc('update_dynamic_job_type_rotation_state', {
      requested_job_type_id: jobTypeId,
      requested_rotation_user_ids: rotationUserIds,
      requested_anchor_date: anchorDate,
      requested_reason: reason ?? null,
    });
    if (error) throwSupabaseError('Update dynamic rotation', error);
    return data as DynamicRotationWorkspace;
  },

  /**
   * פעולה אסינכרונית getRoleWorkspace: שליפה או חישוב של הנתון getRoleWorkspace בהקשר הפעולה.
   * @param jobTypeId — מזהה סוג התפקיד.
   * @returns Promise<DynamicRoleWorkspace> — הפלט בהתאם לחתימה.
   */
  async getRoleWorkspace(jobTypeId: string): Promise<DynamicRoleWorkspace> {
    return PerformanceDebugService.measureAsync('dynamic-scheduling.phase8.3a.role-workspace', async () => {
      // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
      const { data, error } = await supabase.rpc('get_dynamic_role_workspace', {
        requested_job_type_id: jobTypeId,
      });
      if (error) throwSupabaseError('Dynamic role workspace', error);
      const workspace = (data ?? {}) as Partial<DynamicRoleWorkspace>;
      return {
        ...workspace,
        periods: Array.isArray(workspace.periods) ? workspace.periods : [],
        historicalTotals: workspace.historicalTotals ?? { periods: 0, assignments: 0, availability: 0 },
      } as DynamicRoleWorkspace;
    });
  },

  /**
   * פעולה אסינכרונית getJobTypeMembershipAdmin: שליפה או חישוב של סוג תפקיד.
   * הפעולה פונה ל־RPC: get_dynamic_job_type_membership_admin.
   * @param jobTypeId — מזהה סוג התפקיד.
   * @returns Promise<DynamicMembershipAdminData> — הפלט בהתאם לחתימה.
   */
  async getJobTypeMembershipAdmin(jobTypeId: string): Promise<DynamicMembershipAdminData> {
    // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
    const { data, error } = await supabase.rpc('get_dynamic_job_type_membership_admin', {
      requested_job_type_id: jobTypeId,
    });
    if (error) throwSupabaseError('Dynamic job type memberships', error);
    return data as DynamicMembershipAdminData;
  },

  /**
   * פעולה אסינכרונית saveJobTypeMembership: שמירת סוג תפקיד.
   * @param jobTypeId — מזהה סוג התפקיד.
   * @param userId — מזהה משתמש.
   * @param isMember — הנתון isMember בהקשר הפעולה.
   * @param employmentScope — הנתון employmentScope בהקשר הפעולה.
   * @param partTimeDefinition — זמן.
   * @returns Promise<void> — הפלט בהתאם לחתימה.
   */
  async saveJobTypeMembership(
    jobTypeId: string,
    userId: string,
    isMember: boolean,
    employmentScope: DynamicMemberEmploymentScope | null,
    partTimeDefinition: Partial<DynamicPartTimeDefinition> = {},
  ): Promise<void> {
    await PerformanceDebugService.measureAsync('dynamic-scheduling.phase8.2c.save-membership', async () => {
      // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
      const { error } = await supabase.rpc('save_dynamic_job_type_membership', {
        requested_job_type_id: jobTypeId,
        requested_user_id: userId,
        requested_is_member: isMember,
        requested_employment_scope: employmentScope,
        requested_part_time_definition: partTimeDefinition,
      });
      if (error) throwSupabaseError('Save dynamic job type membership', error);
    });
  },

  /**
   * פעולה אסינכרונית previewLegacyImport: ייבוא.
   * הפעולה פונה ל־RPC: preview_dynamic_legacy_import.
   * @param jobTypeId — מזהה סוג התפקיד.
   * @param sourceKind — מקור.
   * @returns Promise<DynamicLegacyImportPreview> — הפלט בהתאם לחתימה.
   */
  async previewLegacyImport(jobTypeId: string, sourceKind: DynamicLegacySourceKind): Promise<DynamicLegacyImportPreview> {
    // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
    const { data, error } = await supabase.rpc('preview_dynamic_legacy_import', {
      requested_job_type_id: jobTypeId,
      requested_source_kind: sourceKind,
    });
    if (error) throwSupabaseError('Preview legacy import', error);
    const preview = (data ?? {}) as Partial<DynamicLegacyImportPreview>;
    return {
      ...preview,
      periodDetails: Array.isArray(preview.periodDetails) ? preview.periodDetails : [],
      userDetails: Array.isArray(preview.userDetails) ? preview.userDetails : [],
      issues: Array.isArray(preview.issues) ? preview.issues : [],
    } as DynamicLegacyImportPreview;
  },

  /**
   * פעולה אסינכרונית importLegacyHistory: ייבוא ייבוא / היסטוריה.
   * @param jobTypeId — מזהה סוג התפקיד.
   * @param sourceKind — מקור.
   * @returns Promise<DynamicLegacyImportResult> — הפלט בהתאם לחתימה.
   */
  async importLegacyHistory(jobTypeId: string, sourceKind: DynamicLegacySourceKind): Promise<DynamicLegacyImportResult> {
    return PerformanceDebugService.measureAsync('dynamic-scheduling.phase8.2c.import-legacy-history', async () => {
      // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
      const { data, error } = await supabase.rpc('import_dynamic_legacy_history', {
        requested_job_type_id: jobTypeId,
        requested_source_kind: sourceKind,
      });
      if (error) throwSupabaseError('Import legacy history', error);
      return data as DynamicLegacyImportResult;
    });
  },

  /**
   * פעולה אסינכרונית saveScheduleGroup: שמירת שיבוץ / קבוצה.
   * הפעולה פונה ל־RPC: save_dynamic_schedule_group.
   * @param input — קלט.
   * @returns Promise<number> — הפלט בהתאם לחתימה.
   */
  async saveScheduleGroup(input: SaveDynamicScheduleGroupInput): Promise<number> {
    // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
    const { data, error } = await supabase.rpc('save_dynamic_schedule_group', {
      requested_payload: input,
    });

    if (error) {
      throwSupabaseError('Save dynamic schedule group', error);
    }

    return Number(data);
  },

  /**
   * פעולה אסינכרונית previewScheduleGroup: שיבוץ / קבוצה.
   * הפעולה פונה ל־RPC: preview_dynamic_schedule_group.
   * @param groupId — קבוצה / מזהה.
   * @param year — שנה.
   * @param month — חודש.
   * @returns Promise<DynamicSchedulePreview> — הפלט בהתאם לחתימה.
   */
  async previewScheduleGroup(
    groupId: string,
    year: number,
    month: number,
  ): Promise<DynamicSchedulePreview> {
    // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
    const { data, error } = await supabase.rpc('preview_dynamic_schedule_group', {
      requested_group_id: groupId,
      requested_year: year,
      requested_month: month,
    });

    if (error) {
      throwSupabaseError('Preview dynamic schedule group', error);
    }

    return data as DynamicSchedulePreview;
  },
  /**
   * פעולה אסינכרונית createAvailabilityShadowPeriod: יצירת אילוצים וזמינות / טיוטות שיבוץ במנגנון הדינמי / תקופה.
   * הפעולה פונה ל־RPC: create_dynamic_availability_shadow_period.
   * @param jobTypeId — מזהה סוג התפקיד.
   * @param year — שנה.
   * @param month — חודש.
   * @returns Promise<{ periodId: string; createdSlots: number; mode: 'shadow' }> — הפלט בהתאם לחתימה.
   */
  async createAvailabilityShadowPeriod(
    jobTypeId: string,
    year: number,
    month: number,
  ): Promise<{ periodId: string; createdSlots: number; mode: 'shadow' }> {
    // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
    const { data, error } = await supabase.rpc('create_dynamic_availability_shadow_period', {
      requested_job_type_id: jobTypeId,
      requested_year: year,
      requested_month: month,
    });
    if (error) throwSupabaseError('Create dynamic availability shadow period', error);
    return data as { periodId: string; createdSlots: number; mode: 'shadow' };
  },

  /**
   * פעולה אסינכרונית getAvailabilityShadowSummary: שליפה או חישוב של אילוצים וזמינות / טיוטות שיבוץ במנגנון הדינמי / סיכום.
   * הפעולה פונה ל־RPC: get_dynamic_availability_shadow_summary.
   * @param jobTypeId — מזהה סוג התפקיד.
   * @param year — שנה.
   * @param month — חודש.
   * @returns Promise<DynamicAvailabilityShadowSummary> — הפלט בהתאם לחתימה.
   */
  async getAvailabilityShadowSummary(
    jobTypeId: string,
    year: number,
    month: number,
  ): Promise<DynamicAvailabilityShadowSummary> {
    // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
    const { data, error } = await supabase.rpc('get_dynamic_availability_shadow_summary', {
      requested_job_type_id: jobTypeId,
      requested_year: year,
      requested_month: month,
    });
    if (error) throwSupabaseError('Dynamic availability shadow summary', error);
    return data as DynamicAvailabilityShadowSummary;
  },

  /**
   * פעולה אסינכרונית getAvailabilityShadowWorkspace: שליפה או חישוב של אילוצים וזמינות / טיוטות שיבוץ במנגנון הדינמי.
   * הפעולה פונה ל־RPC: get_dynamic_availability_shadow_workspace.
   * @param jobTypeId — מזהה סוג התפקיד.
   * @param year — שנה.
   * @param month — חודש.
   * @returns Promise<DynamicAvailabilityWorkspace> — הפלט בהתאם לחתימה.
   */
  async getAvailabilityShadowWorkspace(
    jobTypeId: string,
    year: number,
    month: number,
  ): Promise<DynamicAvailabilityWorkspace> {
    // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
    const { data, error } = await supabase.rpc('get_dynamic_availability_shadow_workspace', {
      requested_job_type_id: jobTypeId,
      requested_year: year,
      requested_month: month,
    });
    if (error) throwSupabaseError('Dynamic availability workspace', error);
    return data as DynamicAvailabilityWorkspace;
  },

  /**
   * פעולה אסינכרונית saveAvailabilityShadowSubmission: שמירת אילוצים וזמינות / טיוטות שיבוץ במנגנון הדינמי.
   * הפעולה פונה ל־RPC: save_dynamic_availability_shadow_submission.
   * @param jobTypeId — מזהה סוג התפקיד.
   * @param year — שנה.
   * @param month — חודש.
   * @param userId — מזהה משתמש.
   * @param input — קלט.
   * @returns Promise<{ saved: boolean; mode: 'shadow'; submissionId: string }> — הפלט בהתאם לחתימה.
   */
  async saveAvailabilityShadowSubmission(
    jobTypeId: string,
    year: number,
    month: number,
    userId: string,
    input: SaveDynamicAvailabilityShadowSubmissionInput,
  ): Promise<{ saved: boolean; mode: 'shadow'; submissionId: string }> {
    // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
    const { data, error } = await supabase.rpc('save_dynamic_availability_shadow_submission', {
      requested_job_type_id: jobTypeId,
      requested_year: year,
      requested_month: month,
      requested_user_id: userId,
      requested_payload: input,
    });
    if (error) throwSupabaseError('Save dynamic availability shadow submission', error);
    return data as { saved: boolean; mode: 'shadow'; submissionId: string };
  },

  /**
   * פעולה אסינכרונית compareAvailabilityShadowToLegacy: השוואת אילוצים וזמינות / טיוטות שיבוץ במנגנון הדינמי.
   * הפעולה פונה ל־RPC: compare_dynamic_availability_shadow_to_legacy.
   * @param jobTypeId — מזהה סוג התפקיד.
   * @param year — שנה.
   * @param month — חודש.
   * @returns Promise<DynamicAvailabilityLegacyComparison> — הפלט בהתאם לחתימה.
   */
  async compareAvailabilityShadowToLegacy(
    jobTypeId: string,
    year: number,
    month: number,
  ): Promise<DynamicAvailabilityLegacyComparison> {
    // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
    const { data, error } = await supabase.rpc('compare_dynamic_availability_shadow_to_legacy', {
      requested_job_type_id: jobTypeId,
      requested_year: year,
      requested_month: month,
    });
    if (error) throwSupabaseError('Dynamic availability legacy comparison', error);
    return data as DynamicAvailabilityLegacyComparison;
  },

  /**
   * פעולה אסינכרונית analyzeSchedulingFeasibility: בדיקת היתכנות שיבוץ.
   * הפעולה פונה ל־RPC: analyze_dynamic_schedule_feasibility.
   * @param jobTypeId — מזהה סוג התפקיד.
   * @param year — שנה.
   * @param month — חודש.
   * @returns Promise<DynamicFeasibilityAnalysis> — הפלט בהתאם לחתימה.
   */
  async analyzeSchedulingFeasibility(
    jobTypeId: string,
    year: number,
    month: number,
  ): Promise<DynamicFeasibilityAnalysis> {
    // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
    const { data, error } = await supabase.rpc('analyze_dynamic_schedule_feasibility', {
      requested_job_type_id: jobTypeId,
      requested_year: year,
      requested_month: month,
    });
    if (error) throwSupabaseError('Dynamic scheduling feasibility', error);
    return data as DynamicFeasibilityAnalysis;
  },

  /**
   * פעולה אסינכרונית createMonthlyRotationDraft: יצירת סבב כוננויות / טיוטה.
   * @param jobTypeId — מזהה סוג התפקיד.
   * @param year — שנה.
   * @param month — חודש.
   * @returns Promise<DynamicShadowDraftResult> — הפלט בהתאם לחתימה.
   */
  async createMonthlyRotationDraft(
    jobTypeId: string,
    year: number,
    month: number,
  ): Promise<DynamicShadowDraftResult> {
    return PerformanceDebugService.measureAsync(
      'dynamic-scheduling.phase8.4.create-monthly-rotation-draft',
      async () => {
        // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
        const { data, error } = await supabase.rpc('create_dynamic_monthly_rotation_draft', {
          requested_job_type_id: jobTypeId,
          requested_year: year,
          requested_month: month,
        });
        if (error) throwSupabaseError('Create dynamic monthly rotation draft', error);
        return data as DynamicShadowDraftResult;
      },
    );
  },

  /**
   * פעולה אסינכרונית createSchedulingShadowDraft: יצירת טיוטות שיבוץ במנגנון הדינמי / טיוטה.
   * @param jobTypeId — מזהה סוג התפקיד.
   * @param year — שנה.
   * @param month — חודש.
   * @returns Promise<DynamicShadowDraftResult> — הפלט בהתאם לחתימה.
   */
  async createSchedulingShadowDraft(
    jobTypeId: string,
    year: number,
    month: number,
  ): Promise<DynamicShadowDraftResult> {
    return PerformanceDebugService.measureAsync(
      'dynamic-scheduling.weekly-rest-retry',
      async () => {
        const maxAttempts = 12;
        let best: { result: DynamicShadowDraftResult; validation: DynamicWeeklyRestValidation; attempt: number } | null = null;

        /**
         * פעולה אסינכרונית discard: הנתון discard בהקשר הפעולה.
         * הפעולה פונה ל־RPC: discard_dynamic_schedule_shadow_draft.
         * @param draftId — טיוטה / מזהה.
         * @returns Promise<void> — הפלט בהתאם לחתימה.
         */
        const discard = async (draftId: string): Promise<void> => {
          // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
          const { error } = await supabase.rpc('discard_dynamic_schedule_shadow_draft', { requested_draft_id: draftId });
          if (error) throwSupabaseError('Discard dynamic schedule retry draft', error);
        };

        for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
          // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
          const { data, error } = await supabase.rpc('create_dynamic_schedule_shadow_draft_attempt', {
            requested_job_type_id: jobTypeId,
            requested_year: year,
            requested_month: month,
            requested_attempt: attempt,
          });
          if (error) throwSupabaseError('Create dynamic schedule shadow draft attempt', error);
          // result — תוצאה.
          const result = data as DynamicShadowDraftResult;

          // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
          const { data: validationData, error: validationError } = await supabase.rpc(
            'get_dynamic_schedule_weekly_rest_validation',
            { requested_draft_id: result.draftId },
          );
          if (validationError) throwSupabaseError('Validate weekly rest rule', validationError);
          // validation — אימות נתונים.
          const validation = validationData as DynamicWeeklyRestValidation;

          // currentRank — הנתון currentRank בהקשר הפעולה.
          const currentRank = [
            validation.violationCount,
            result.unfilledRequiredPositions,
            result.avoidAssignments ?? 0,
          ];
          const bestRank = best ? [
            best.validation.violationCount,
            best.result.unfilledRequiredPositions,
            best.result.avoidAssignments ?? 0,
          ] : null;
          // isBetter — הנתון isBetter בהקשר הפעולה.
          const isBetter = !bestRank || currentRank.some((value, index) =>
            value < bestRank[index] && currentRank.slice(0, index).every((prior, priorIndex) => prior === bestRank[priorIndex]),
          );

          if (isBetter) {
            if (best) await discard(best.result.draftId);
            best = { result, validation, attempt: attempt + 1 };
          } else {
            await discard(result.draftId);
          }

          if (validation.valid) break;
        }

        if (!best) throw new Error('לא נוצרה טיוטת שיבוץ.');
        return {
          ...best.result,
          weeklyRest: best.validation,
          generationAttempts: best.attempt,
        };
      },
    );
  },

  /**
   * פעולה אסינכרונית getSchedulingShadowDiagnostics: שליפה או חישוב של טיוטות שיבוץ במנגנון הדינמי.
   * @param draftId — טיוטה / מזהה.
   * @returns Promise<DynamicShadowDiagnostics> — הפלט בהתאם לחתימה.
   */
  async getSchedulingShadowDiagnostics(draftId: string): Promise<DynamicShadowDiagnostics> {
    return PerformanceDebugService.measureAsync(
      'dynamic-scheduling.phase7.1.shadow-diagnostics',
      async () => {
        // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
        const { data, error } = await supabase.rpc('get_dynamic_schedule_shadow_diagnostics', {
          requested_draft_id: draftId,
        });
        if (error) throwSupabaseError('Dynamic Shadow diagnostics', error);
        return data as DynamicShadowDiagnostics;
      },
    );
  },

  /**
   * פעולה אסינכרונית getSchedulingShadowValidation: שליפה או חישוב של טיוטות שיבוץ במנגנון הדינמי / אימות נתונים.
   * @param draftId — טיוטה / מזהה.
   * @returns Promise<DynamicShadowValidation> — הפלט בהתאם לחתימה.
   */
  async getSchedulingShadowValidation(draftId: string): Promise<DynamicShadowValidation> {
    return PerformanceDebugService.measureAsync(
      'dynamic-scheduling.phase8.shadow-validation',
      async () => {
        // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
        const { data, error } = await supabase.rpc('get_dynamic_schedule_shadow_validation', {
          requested_draft_id: draftId,
        });
        if (error) throwSupabaseError('Dynamic Shadow validation', error);
        return data as DynamicShadowValidation;
      },
    );
  },

  /**
   * פעולה אסינכרונית saveJobTypeMemberEmploymentScope: שמירת סוג תפקיד.
   * הפעולה פונה ל־RPC: save_dynamic_job_type_member_employment_scope.
   * @param jobTypeId — מזהה סוג התפקיד.
   * @param userId — מזהה משתמש.
   * @param employmentScope — הנתון employmentScope בהקשר הפעולה.
   * @returns Promise<void> — הפלט בהתאם לחתימה.
   */
  async saveJobTypeMemberEmploymentScope(
    jobTypeId: string,
    userId: string,
    employmentScope: 'full_time' | 'part_time' | null,
  ): Promise<void> {
    // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
    const { error } = await supabase.rpc('save_dynamic_job_type_member_employment_scope', {
      requested_job_type_id: jobTypeId,
      requested_user_id: userId,
      requested_employment_scope: employmentScope ?? '',
    });
    if (error) throwSupabaseError('Save member employment scope', error);
  },

  /**
   * פעולה אסינכרונית submitSchedulingRuleProposal: הגשת כלל.
   * הפעולה פונה ל־RPC: submit_dynamic_scheduling_rule_proposal.
   * @param jobTypeId — מזהה סוג התפקיד.
   * @param text — הנתון text בהקשר הפעולה.
   * @returns Promise<string> — הפלט בהתאם לחתימה.
   */
  async submitSchedulingRuleProposal(jobTypeId: string, text: string): Promise<string> {
    // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
    const { data, error } = await supabase.rpc('submit_dynamic_scheduling_rule_proposal', {
      requested_job_type_id: jobTypeId,
      requested_text: text,
    });
    if (error) throwSupabaseError('Scheduling rule proposal', error);
    return String(data);
  },
};
