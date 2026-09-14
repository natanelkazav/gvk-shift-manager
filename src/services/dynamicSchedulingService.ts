import { supabase } from '../lib/supabase';
import { PerformanceDebugService } from './performanceDebugService';
import type {
  DynamicAvailabilityShadowSummary,
  DynamicAvailabilityWorkspace,
  DynamicAvailabilityLegacyComparison,
  SaveDynamicAvailabilityShadowSubmissionInput,
  DynamicFeasibilityAnalysis,
  DynamicShadowDraftResult,
  DynamicShadowDiagnostics,
  DynamicShadowValidation,
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
  DynamicPeriodWorkflowState,
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

const throwSupabaseError = (
  context: string,
  error: { message: string; code?: string | null },
): never => {
  console.error(`${context} Supabase error:`, error);

  throw new Error(`${error.message}${error.code ? ` | Code: ${error.code}` : ''}`);
};

export const dynamicSchedulingService = {
  async getScheduleCalendarWorkspace(year: number, month: number): Promise<DynamicScheduleCalendarWorkspace> {
    return PerformanceDebugService.measureAsync('dynamic-scheduling.phase10.5.8.schedule-calendar', async () => {
      const { data, error } = await supabase.rpc('get_dynamic_schedule_calendar_workspace', {
        requested_year: year,
        requested_month: month,
      });
      if (error) throwSupabaseError('Dynamic schedule calendar workspace', error);
      return data as DynamicScheduleCalendarWorkspace;
    });
  },

  async hasMyDynamicJobTypePermission(permissionKey: string, jobTypeId: string): Promise<boolean> {
    const { data, error } = await supabase.rpc('has_dynamic_job_type_permission', {
      requested_permission_key: permissionKey,
      requested_job_type_id: jobTypeId,
    });
    if (error) throwSupabaseError('Dynamic job type permission check', error);
    return Boolean(data);
  },

  async getHistoricalSlotEditor(input: {
    historicalPeriodId: string;
    workDate: string;
    shiftCode: string;
    startTime: string;
    endTime: string;
  }): Promise<DynamicHistoricalSlotEditorWorkspace> {
    return PerformanceDebugService.measureAsync('dynamic-scheduling.phase10.5.15.history-editor', async () => {
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

  async setHistoricalAssignment(input: {
    historicalPeriodId: string;
    assignmentId: string;
    userId: string | null;
    reason: string | null;
  }): Promise<void> {
    await PerformanceDebugService.measureAsync('dynamic-scheduling.phase10.5.15.history-edit', async () => {
      const { error } = await supabase.rpc('set_dynamic_historical_assignment', {
        requested_historical_period_id: input.historicalPeriodId,
        requested_assignment_id: input.assignmentId,
        requested_user_id: input.userId,
        requested_reason: input.reason?.trim() || null,
      });
      if (error) throwSupabaseError('Set dynamic historical assignment', error);
    });
  },

  async getShiftsManagementWorkspace(year: number, month: number): Promise<DynamicShiftsManagementWorkspace> {
    return PerformanceDebugService.measureAsync('dynamic-scheduling.phase10.1.shifts-workspace', async () => {
      const { data, error } = await supabase.rpc('get_dynamic_shifts_management_workspace', {
        requested_year: year,
        requested_month: month,
      });
      if (error) throwSupabaseError('Dynamic shifts management workspace', error);
      return data as DynamicShiftsManagementWorkspace;
    });
  },

  async setDynamicPeriodSubmissionDeadline(
    jobTypeId: string,
    year: number,
    month: number,
    deadline: string | null,
  ): Promise<void> {
    await PerformanceDebugService.measureAsync('dynamic-scheduling.phase10.1.period-deadline', async () => {
      const { error } = await supabase.rpc('set_dynamic_period_submission_deadline', {
        requested_job_type_id: jobTypeId,
        requested_year: year,
        requested_month: month,
        requested_deadline: deadline,
      });
      if (error) throwSupabaseError('Dynamic period submission deadline', error);
    });
  },
  async getMyDynamicShiftExchangeOptions(): Promise<DynamicShiftExchangeOptions> {
    return PerformanceDebugService.measureAsync('dynamic-scheduling.phase8.3e2.exchange-options', async () => {
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

  async getDynamicShiftExchangeRequests(): Promise<DynamicShiftExchangeRequest[]> {
    const { data, error } = await supabase.rpc('get_dynamic_shift_exchange_requests');
    if (error) throwSupabaseError('Dynamic shift exchange requests', error);
    return Array.isArray(data) ? data as DynamicShiftExchangeRequest[] : [];
  },

  async createDynamicShiftExchangeRequest(input: {
    swapType: DynamicShiftExchangeType; requesterAssignmentId: string; counterpartyUserId: string; counterpartyAssignmentId?: string | null;
  }): Promise<void> {
    const { error } = await supabase.rpc('create_dynamic_shift_exchange_request', {
      requested_swap_type: input.swapType,
      requested_requester_assignment_id: input.requesterAssignmentId,
      requested_counterparty_user_id: input.counterpartyUserId,
      requested_counterparty_assignment_id: input.counterpartyAssignmentId ?? null,
    });
    if (error) throwSupabaseError('Create dynamic shift exchange request', error);
  },

  async respondToDynamicShiftExchangeRequest(requestId: string, approve: boolean, rejectionReason?: string): Promise<void> {
    const { error } = await supabase.rpc('respond_to_dynamic_shift_exchange_request', {
      requested_request_id: requestId, requested_approve: approve, requested_rejection_reason: rejectionReason?.trim() || null,
    });
    if (error) throwSupabaseError('Respond dynamic shift exchange request', error);
  },

  async reviewDynamicShiftExchangeRequest(requestId: string, approve: boolean, rejectionReason?: string): Promise<void> {
    const { error } = await supabase.rpc('review_dynamic_shift_exchange_request', {
      requested_request_id: requestId, requested_approve: approve, requested_rejection_reason: rejectionReason?.trim() || null,
    });
    if (error) throwSupabaseError('Review dynamic shift exchange request', error);
  },

  async cancelDynamicShiftExchangeRequest(requestId: string): Promise<void> {
    const { error } = await supabase.rpc('cancel_dynamic_shift_exchange_request', { requested_request_id: requestId });
    if (error) throwSupabaseError('Cancel dynamic shift exchange request', error);
  },
  async getPublishedScheduleEditor(publicationId: string): Promise<DynamicPublishedEditorWorkspace> {
    return PerformanceDebugService.measureAsync('dynamic-scheduling.phase9.1.3.published-editor', async () => {
      const { data, error } = await supabase.rpc('get_dynamic_published_schedule_editor', {
        requested_publication_id: publicationId,
      });
      if (error) throwSupabaseError('Dynamic published schedule editor', error);
      return data as DynamicPublishedEditorWorkspace;
    });
  },

  async setPublishedScheduleAssignment(input: {
    publicationId: string;
    slotId: string;
    assignmentId: string | null;
    userId: string | null;
    reason: string | null;
  }): Promise<void> {
    await PerformanceDebugService.measureAsync('dynamic-scheduling.phase9.1.3.published-edit', async () => {
      const { error } = await supabase.rpc('set_dynamic_published_schedule_assignment', {
        requested_publication_id: input.publicationId,
        requested_slot_id: input.slotId,
        requested_assignment_id: input.assignmentId,
        requested_user_id: input.userId,
        requested_reason: input.reason?.trim() || null,
      });
      if (error) throwSupabaseError('Set dynamic published schedule assignment', error);
    });
  },

  async getMyDynamicSchedulePeriods(): Promise<MyDynamicSchedulePeriod[]> {
    return PerformanceDebugService.measureAsync('dynamic-scheduling.phase8.3d.my-schedule-periods', async () => {
      const { data, error } = await supabase.rpc('get_my_dynamic_schedule_periods');
      if (error) throwSupabaseError('My dynamic schedule periods', error);
      return (data ?? []) as MyDynamicSchedulePeriod[];
    });
  },

  async getMyDynamicScheduleWorkspace(publicationId: string): Promise<MyDynamicScheduleWorkspace> {
    return PerformanceDebugService.measureAsync('dynamic-scheduling.phase8.3d.my-schedule-workspace', async () => {
      const { data, error } = await supabase.rpc('get_my_dynamic_schedule_workspace', {
        requested_publication_id: publicationId,
      });
      if (error) throwSupabaseError('My dynamic schedule workspace', error);
      return data as MyDynamicScheduleWorkspace;
    });
  },

  async getMyDynamicSelfEditWorkspace(publicationId: string): Promise<DynamicSelfEditWorkspace> {
    return PerformanceDebugService.measureAsync('dynamic-scheduling.phase8.3e1.self-edit-workspace', async () => {
      const { data, error } = await supabase.rpc('get_my_dynamic_self_edit_workspace', {
        requested_publication_id: publicationId,
      });
      if (error) throwSupabaseError('My dynamic self edit workspace', error);
      return data as DynamicSelfEditWorkspace;
    });
  },

  async updateMyDynamicPublishedAssignment(
    publicationId: string,
    assignmentId: string,
    userId: string,
  ): Promise<void> {
    await PerformanceDebugService.measureAsync('dynamic-scheduling.phase8.3e1.self-edit-assignment', async () => {
      const { error } = await supabase.rpc('update_my_dynamic_published_assignment', {
        requested_publication_id: publicationId,
        requested_assignment_id: assignmentId,
        requested_user_id: userId,
      });
      if (error) throwSupabaseError('Update my dynamic published assignment', error);
    });
  },
  async getMyDynamicAvailabilityPeriods(): Promise<MyDynamicAvailabilityPeriod[]> {
    return PerformanceDebugService.measureAsync('dynamic-scheduling.phase8.3b4.my-periods', async () => {
      const { data, error } = await supabase.rpc('get_my_dynamic_availability_periods');
      if (error) throwSupabaseError('My dynamic availability periods', error);
      return (data ?? []) as MyDynamicAvailabilityPeriod[];
    });
  },

  async getMyDynamicAvailabilityWorkspace(
    jobTypeId: string,
    year: number,
    month: number,
  ): Promise<DynamicAvailabilityWorkspace> {
    return PerformanceDebugService.measureAsync('dynamic-scheduling.phase8.3b4.my-workspace', async () => {
      const { data, error } = await supabase.rpc('get_my_dynamic_availability_workspace', {
        requested_job_type_id: jobTypeId,
        requested_year: year,
        requested_month: month,
      });
      if (error) throwSupabaseError('My dynamic availability workspace', error);
      return data as DynamicAvailabilityWorkspace;
    });
  },

  async saveMyDynamicAvailabilitySubmission(
    jobTypeId: string,
    year: number,
    month: number,
    payload: SaveDynamicAvailabilityShadowSubmissionInput,
  ): Promise<void> {
    await PerformanceDebugService.measureAsync('dynamic-scheduling.phase8.3b4.save-my-submission', async () => {
      const { error } = await supabase.rpc('save_my_dynamic_availability_submission', {
        requested_job_type_id: jobTypeId,
        requested_year: year,
        requested_month: month,
        requested_payload: payload,
      });
      if (error) throwSupabaseError('Save my dynamic availability submission', error);
    });
  },
  async getAdminData(): Promise<DynamicSchedulingAdminData> {
    const { data, error } = await supabase.rpc('get_dynamic_scheduling_admin');

    if (error) {
      throwSupabaseError('Dynamic scheduling admin', error);
    }

    return data as DynamicSchedulingAdminData;
  },

  async saveJobType(input: SaveDynamicJobTypeInput): Promise<string> {
    return PerformanceDebugService.measureAsync('dynamic-scheduling.phase8.1.save-job-type', async () => {
      const { data, error } = await supabase.rpc('save_dynamic_job_type', {
        requested_payload: input,
      });

      if (error) {
        throwSupabaseError('Save dynamic job type', error);
      }

      return String(data);
    });
  },

  async getEffectiveJobType(
    jobTypeId: string,
    year: number,
    month: number,
  ): Promise<DynamicJobType> {
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

  async setJobTypeActive(jobTypeId: string, isActive: boolean): Promise<void> {
    await PerformanceDebugService.measureAsync('dynamic-scheduling.phase8.2b.set-job-type-active', async () => {
      const { error } = await supabase.rpc('set_dynamic_job_type_active', {
        requested_job_type_id: jobTypeId,
        requested_is_active: isActive,
      });

      if (error) {
        throwSupabaseError(isActive ? 'Reactivate dynamic job type' : 'Freeze dynamic job type', error);
      }
    });
  },

  async deleteJobType(jobTypeId: string): Promise<void> {
    await PerformanceDebugService.measureAsync('dynamic-scheduling.phase8.2b.delete-job-type', async () => {
      const { error } = await supabase.rpc('delete_dynamic_job_type', {
        requested_job_type_id: jobTypeId,
      });

      if (error) {
        throwSupabaseError('Delete dynamic job type', error);
      }
    });
  },

  async getPeriodWorkflow(jobTypeId: string, year: number, month: number): Promise<DynamicPeriodWorkflowState> {
    return PerformanceDebugService.measureAsync('dynamic-scheduling.phase8.3b.get-period-workflow', async () => {
      const { data, error } = await supabase.rpc('get_dynamic_period_workflow', {
        requested_job_type_id: jobTypeId,
        requested_year: year,
        requested_month: month,
      });
      if (error) throwSupabaseError('Dynamic period workflow', error);
      return data as DynamicPeriodWorkflowState;
    });
  },

  async setPeriodStatus(
    jobTypeId: string,
    year: number,
    month: number,
    action: 'open' | 'close' | 'archive',
  ): Promise<{ periodId: string; status: string; action: string }> {
    return PerformanceDebugService.measureAsync('dynamic-scheduling.phase8.3b.set-period-status', async () => {
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

  async getDraftEditor(draftId: string): Promise<import('../types/dynamicScheduling').DynamicDraftEditorWorkspace> {
    return PerformanceDebugService.measureAsync('dynamic-scheduling.phase8.3c.draft-editor', async () => {
      const { data, error } = await supabase.rpc('get_dynamic_schedule_draft_editor', { requested_draft_id: draftId });
      if (error) throwSupabaseError('Dynamic schedule draft editor', error);
      return data as import('../types/dynamicScheduling').DynamicDraftEditorWorkspace;
    });
  },

  async setDraftAssignment(draftId: string, slotId: string, assignmentId: string | null, userId: string, note?: string | null): Promise<void> {
    await PerformanceDebugService.measureAsync('dynamic-scheduling.phase8.3c.set-assignment', async () => {
      const { error } = await supabase.rpc('set_dynamic_schedule_draft_assignment', {
        requested_draft_id: draftId, requested_slot_id: slotId, requested_assignment_id: assignmentId,
        requested_user_id: userId, requested_note: note ?? null,
      });
      if (error) throwSupabaseError('Set dynamic draft assignment', error);
    });
  },

  async removeDraftAssignment(draftId: string, assignmentId: string): Promise<void> {
    const { error } = await supabase.rpc('remove_dynamic_schedule_draft_assignment', {
      requested_draft_id: draftId, requested_assignment_id: assignmentId,
    });
    if (error) throwSupabaseError('Remove dynamic draft assignment', error);
  },

  async setDraftIntentionallyUnassigned(draftId: string, slotId: string, count: number, note?: string | null): Promise<void> {
    const { error } = await supabase.rpc('set_dynamic_schedule_slot_intentionally_unassigned', {
      requested_draft_id: draftId, requested_slot_id: slotId, requested_count: count, requested_note: note ?? null,
    });
    if (error) throwSupabaseError('Set intentionally unassigned slot', error);
  },

  async publishSchedulingDraft(draftId: string): Promise<DynamicSchedulePublicationResult> {
    return PerformanceDebugService.measureAsync('dynamic-scheduling.phase8.3b.publish-draft', async () => {
      const { data, error } = await supabase.rpc('publish_dynamic_schedule_draft', {
        requested_draft_id: draftId,
      });
      if (error) throwSupabaseError('Publish dynamic schedule draft', error);
      return data as DynamicSchedulePublicationResult;
    });
  },

  async getRoleWorkspace(jobTypeId: string): Promise<DynamicRoleWorkspace> {
    return PerformanceDebugService.measureAsync('dynamic-scheduling.phase8.3a.role-workspace', async () => {
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

  async getJobTypeMembershipAdmin(jobTypeId: string): Promise<DynamicMembershipAdminData> {
    const { data, error } = await supabase.rpc('get_dynamic_job_type_membership_admin', {
      requested_job_type_id: jobTypeId,
    });
    if (error) throwSupabaseError('Dynamic job type memberships', error);
    return data as DynamicMembershipAdminData;
  },

  async saveJobTypeMembership(
    jobTypeId: string,
    userId: string,
    isMember: boolean,
    employmentScope: DynamicMemberEmploymentScope | null,
    partTimeDefinition: Partial<DynamicPartTimeDefinition> = {},
  ): Promise<void> {
    await PerformanceDebugService.measureAsync('dynamic-scheduling.phase8.2c.save-membership', async () => {
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

  async previewLegacyImport(jobTypeId: string, sourceKind: DynamicLegacySourceKind): Promise<DynamicLegacyImportPreview> {
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

  async importLegacyHistory(jobTypeId: string, sourceKind: DynamicLegacySourceKind): Promise<DynamicLegacyImportResult> {
    return PerformanceDebugService.measureAsync('dynamic-scheduling.phase8.2c.import-legacy-history', async () => {
      const { data, error } = await supabase.rpc('import_dynamic_legacy_history', {
        requested_job_type_id: jobTypeId,
        requested_source_kind: sourceKind,
      });
      if (error) throwSupabaseError('Import legacy history', error);
      return data as DynamicLegacyImportResult;
    });
  },

  async saveScheduleGroup(input: SaveDynamicScheduleGroupInput): Promise<number> {
    const { data, error } = await supabase.rpc('save_dynamic_schedule_group', {
      requested_payload: input,
    });

    if (error) {
      throwSupabaseError('Save dynamic schedule group', error);
    }

    return Number(data);
  },

  async previewScheduleGroup(
    groupId: string,
    year: number,
    month: number,
  ): Promise<DynamicSchedulePreview> {
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
  async createAvailabilityShadowPeriod(
    jobTypeId: string,
    year: number,
    month: number,
  ): Promise<{ periodId: string; createdSlots: number; mode: 'shadow' }> {
    const { data, error } = await supabase.rpc('create_dynamic_availability_shadow_period', {
      requested_job_type_id: jobTypeId,
      requested_year: year,
      requested_month: month,
    });
    if (error) throwSupabaseError('Create dynamic availability shadow period', error);
    return data as { periodId: string; createdSlots: number; mode: 'shadow' };
  },

  async getAvailabilityShadowSummary(
    jobTypeId: string,
    year: number,
    month: number,
  ): Promise<DynamicAvailabilityShadowSummary> {
    const { data, error } = await supabase.rpc('get_dynamic_availability_shadow_summary', {
      requested_job_type_id: jobTypeId,
      requested_year: year,
      requested_month: month,
    });
    if (error) throwSupabaseError('Dynamic availability shadow summary', error);
    return data as DynamicAvailabilityShadowSummary;
  },

  async getAvailabilityShadowWorkspace(
    jobTypeId: string,
    year: number,
    month: number,
  ): Promise<DynamicAvailabilityWorkspace> {
    const { data, error } = await supabase.rpc('get_dynamic_availability_shadow_workspace', {
      requested_job_type_id: jobTypeId,
      requested_year: year,
      requested_month: month,
    });
    if (error) throwSupabaseError('Dynamic availability workspace', error);
    return data as DynamicAvailabilityWorkspace;
  },

  async saveAvailabilityShadowSubmission(
    jobTypeId: string,
    year: number,
    month: number,
    userId: string,
    input: SaveDynamicAvailabilityShadowSubmissionInput,
  ): Promise<{ saved: boolean; mode: 'shadow'; submissionId: string }> {
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

  async compareAvailabilityShadowToLegacy(
    jobTypeId: string,
    year: number,
    month: number,
  ): Promise<DynamicAvailabilityLegacyComparison> {
    const { data, error } = await supabase.rpc('compare_dynamic_availability_shadow_to_legacy', {
      requested_job_type_id: jobTypeId,
      requested_year: year,
      requested_month: month,
    });
    if (error) throwSupabaseError('Dynamic availability legacy comparison', error);
    return data as DynamicAvailabilityLegacyComparison;
  },

  async analyzeSchedulingFeasibility(
    jobTypeId: string,
    year: number,
    month: number,
  ): Promise<DynamicFeasibilityAnalysis> {
    const { data, error } = await supabase.rpc('analyze_dynamic_schedule_feasibility', {
      requested_job_type_id: jobTypeId,
      requested_year: year,
      requested_month: month,
    });
    if (error) throwSupabaseError('Dynamic scheduling feasibility', error);
    return data as DynamicFeasibilityAnalysis;
  },

  async createMonthlyRotationDraft(
    jobTypeId: string,
    year: number,
    month: number,
  ): Promise<DynamicShadowDraftResult> {
    return PerformanceDebugService.measureAsync(
      'dynamic-scheduling.phase8.4.create-monthly-rotation-draft',
      async () => {
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

  async createSchedulingShadowDraft(
    jobTypeId: string,
    year: number,
    month: number,
  ): Promise<DynamicShadowDraftResult> {
    return PerformanceDebugService.measureAsync(
      'dynamic-scheduling.phase7.create-shadow-draft',
      async () => {
        const { data, error } = await supabase.rpc('create_dynamic_schedule_shadow_draft', {
          requested_job_type_id: jobTypeId,
          requested_year: year,
          requested_month: month,
        });
        if (error) throwSupabaseError('Create dynamic schedule shadow draft', error);
        return data as DynamicShadowDraftResult;
      },
    );
  },

  async getSchedulingShadowDiagnostics(draftId: string): Promise<DynamicShadowDiagnostics> {
    return PerformanceDebugService.measureAsync(
      'dynamic-scheduling.phase7.1.shadow-diagnostics',
      async () => {
        const { data, error } = await supabase.rpc('get_dynamic_schedule_shadow_diagnostics', {
          requested_draft_id: draftId,
        });
        if (error) throwSupabaseError('Dynamic Shadow diagnostics', error);
        return data as DynamicShadowDiagnostics;
      },
    );
  },

  async getSchedulingShadowValidation(draftId: string): Promise<DynamicShadowValidation> {
    return PerformanceDebugService.measureAsync(
      'dynamic-scheduling.phase8.shadow-validation',
      async () => {
        const { data, error } = await supabase.rpc('get_dynamic_schedule_shadow_validation', {
          requested_draft_id: draftId,
        });
        if (error) throwSupabaseError('Dynamic Shadow validation', error);
        return data as DynamicShadowValidation;
      },
    );
  },

  async saveJobTypeMemberEmploymentScope(
    jobTypeId: string,
    userId: string,
    employmentScope: 'full_time' | 'part_time' | null,
  ): Promise<void> {
    const { error } = await supabase.rpc('save_dynamic_job_type_member_employment_scope', {
      requested_job_type_id: jobTypeId,
      requested_user_id: userId,
      requested_employment_scope: employmentScope ?? '',
    });
    if (error) throwSupabaseError('Save member employment scope', error);
  },

  async submitSchedulingRuleProposal(jobTypeId: string, text: string): Promise<string> {
    const { data, error } = await supabase.rpc('submit_dynamic_scheduling_rule_proposal', {
      requested_job_type_id: jobTypeId,
      requested_text: text,
    });
    if (error) throwSupabaseError('Scheduling rule proposal', error);
    return String(data);
  },
};
