import type { PermissionKey } from './auth';

export type EmploymentScope = 'full_time' | 'part_time' | 'flexible';

export interface DynamicEmploymentDefinition {
  fullTimeDays: number[];
  partTimeDays: number[];
  partTimeStartTime: string;
  partTimeEndTime: string;
}

export type DynamicWorkStructureMode = 'shifts' | 'on_call_hourly' | 'on_call_daily';

export type DynamicScheduleChangeMode = 'none' | 'shift_exchange' | 'self_edit';

export interface DynamicWorkShiftDefinition {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  contains200Percent: boolean;
  premium200Hours: number;
}

export interface DynamicWorkDayDefinition {
  works: boolean;
  shifts: DynamicWorkShiftDefinition[];
  applyToHolidayEve?: boolean;
  applyToHolidayEnd?: boolean;
}

export interface DynamicShiftPatternDefinition {
  enabled: boolean;
  workMode: DynamicWorkStructureMode;
  weekday: DynamicWorkDayDefinition;
  friday: DynamicWorkDayDefinition;
  saturday: DynamicWorkDayDefinition;
  holiday: DynamicWorkDayDefinition;
}

export type JobPayModel = 'hourly' | 'per_shift' | 'per_day' | 'mixed' | 'none';

export type DynamicSchedulingStrategy =
  | 'availability_optimizer'
  | 'monthly_rotation_constraints';

export interface DynamicJobTypeConfigurationVersion {
  effectiveYear: number;
  effectiveMonth: number;
  effectiveMonthDate: string;
  schedulingStrategy: DynamicSchedulingStrategy;
  changeSummary: string | null;
  createdAt: string;
}

export type DynamicDayKind =
  | 'weekday'
  | 'friday'
  | 'saturday'
  | 'holiday_eve'
  | 'holiday_full'
  | 'holiday_end'
  | 'chol_hamoed'
  | 'custom';

export interface DynamicPaySegment {
  id?: string;
  startTime: string;
  endTime: string;
  multiplier: number;
  label: string | null;
  sortOrder: number;
}

export interface DynamicShiftTemplate {
  id: string;
  code: string;
  name: string;
  dayKind: DynamicDayKind;
  startTime: string;
  endTime: string;
  minWorkers: number;
  targetWorkers: number;
  maxWorkers: number;
  sortOrder: number;
  isActive: boolean;
  metadata: Record<string, unknown>;
  paySegments: DynamicPaySegment[];
}

export interface DynamicDayRule {
  dayKind: DynamicDayKind;
  behavior: 'own_templates' | 'inherit' | 'no_work';
  inheritDayKind: DynamicDayKind | null;
  metadata: Record<string, unknown>;
}

export interface DynamicScheduleGroup {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isActive: boolean;
  legacyKind: string | null;
  config: Record<string, unknown>;
  shiftTemplates: DynamicShiftTemplate[];
  dayRules: DynamicDayRule[];
  versionCount: number;
  currentVersion: number;
}

export interface DynamicAvailabilityConfig {
  enabled: boolean;
  statuses: Array<'available' | 'unavailable' | 'preferred' | 'avoid'>;
  allowNotes: boolean;
  monthlyCapacity: {
    enabled: boolean;
    minEnabled: boolean;
    targetEnabled: boolean;
    maxEnabled: boolean;
    defaultMin: number | null;
    defaultTarget: number | null;
    defaultMax: number | null;
  };
  limits: {
    maxNightsEnabled: boolean;
    defaultMaxNights: number | null;
    maxWeekendsEnabled: boolean;
    defaultMaxWeekends: number | null;
    maxHolidaysEnabled: boolean;
    defaultMaxHolidays: number | null;
  };
}

export interface DynamicJobTypeMember {
  userId: string;
  displayName: string;
  isActive: boolean;
  employmentScope: 'full_time' | 'part_time' | null;
  recommendationFactor: number;
}

export interface DynamicJobType {
  id: string;
  scheduleGroupId: string;
  code: string;
  name: string;
  description: string | null;
  isActive: boolean;
  legacyRole: string | null;
  employmentScope: EmploymentScope;
  payModel: JobPayModel;
  payConfig: Record<string, unknown>;
  availabilityConfig: DynamicAvailabilityConfig;
  schedulingStrategy: DynamicSchedulingStrategy;
  schedulingConfig: DynamicSchedulingConfig;
  statisticsConfig: Record<string, unknown>;
  aiConfig: Record<string, unknown>;
  capabilities: string[];
  defaultPermissions: PermissionKey[];
  memberCount: number;
  members: DynamicJobTypeMember[];
  configurationVersions: DynamicJobTypeConfigurationVersion[];
}

export interface DynamicSchedulingAdminData {
  featureEnabled: boolean;
  featureMode: string;
  scheduleGroups: DynamicScheduleGroup[];
  jobTypes: DynamicJobType[];
  ruleRegistry: DynamicSchedulingRuleRegistryItem[];
}

export type DynamicMemberEmploymentScope = 'full_time' | 'part_time' | 'as_much_as_possible';

export interface DynamicPartTimeDefinition {
  days: number[];
  startTime: string;
  endTime: string;
}

export interface DynamicMembershipAdminUser {
  userId: string;
  displayName: string;
  email: string;
  legacyRole: string;
  isActive: boolean;
  isMember: boolean;
  isPrimary: boolean;
  isJobTypeManager: boolean;
  employmentScope: DynamicMemberEmploymentScope | null;
  partTimeDefinition: Partial<DynamicPartTimeDefinition>;
}

export interface DynamicMembershipAdminData {
  users: DynamicMembershipAdminUser[];
}

export type DynamicLegacySourceKind = 'dispatcher' | 'on_call' | 'morning_driver';

export interface DynamicLegacyImportPeriodDetail {
  sourcePeriodId: string;
  year: number;
  month: number;
  label: string;
  status: string;
  assignments: number;
  availability: number;
  alreadyImported: boolean;
}

export type DynamicLegacyImportUserStatus = 'matched' | 'missing_profile' | 'role_mismatch';

export interface DynamicLegacyImportUserDetail {
  userId: string;
  displayName: string;
  email: string | null;
  legacyRole: string | null;
  expectedLegacyRole: string;
  isActive: boolean;
  isAlreadyMember: boolean;
  status: DynamicLegacyImportUserStatus;
}

export interface DynamicLegacyImportIssue {
  severity: 'warning' | 'error';
  code: string;
  message: string;
}

export interface DynamicLegacyImportPreview {
  sourceKind: DynamicLegacySourceKind;
  expectedLegacyRole: string;
  periods: number;
  assignments: number;
  availability: number;
  alreadyImportedPeriods: number;
  alreadyImportedAssignments: number;
  alreadyImportedAvailability: number;
  newPeriods: number;
  newAssignments: number;
  newAvailability: number;
  matchingUsers: number;
  referencedUsers: number;
  missingProfiles: number;
  roleMismatches: number;
  periodDetails: DynamicLegacyImportPeriodDetail[];
  userDetails: DynamicLegacyImportUserDetail[];
  issues: DynamicLegacyImportIssue[];
  canImport: boolean;
  warning: string;
}

export interface DynamicLegacyImportResult {
  batchId: string;
  periodsImported: number;
  assignmentsImported: number;
  availabilityImported: number;
  idempotent: boolean;
}


export interface DynamicRoleWorkspacePeriodUser {
  userId: string;
  displayName: string;
}

export interface DynamicRoleWorkspacePeriod {
  id: string;
  year: number;
  month: number;
  sourceKind: DynamicLegacySourceKind;
  sourceStatus: string | null;
  importedAt: string;
  assignments: number;
  availability: number;
  assignedUsers: DynamicRoleWorkspacePeriodUser[];
}

export interface DynamicRoleWorkspace {
  jobTypeId: string;
  jobTypeName: string;
  isActive: boolean;
  schedulingStrategy: DynamicSchedulingStrategy;
  memberCount: number;
  materializationCount: number;
  historicalTotals: {
    periods: number;
    assignments: number;
    availability: number;
  };
  periods: DynamicRoleWorkspacePeriod[];
}

export interface SaveDynamicJobTypeInput {
  id?: string | null;
  legacyRole?: string | null;
  scheduleGroupId: string;
  code: string;
  name: string;
  description?: string | null;
  isActive: boolean;
  employmentScope: EmploymentScope;
  payModel: JobPayModel;
  payConfig: Record<string, unknown>;
  availabilityConfig: DynamicAvailabilityConfig;
  schedulingStrategy: DynamicSchedulingStrategy;
  schedulingConfig: DynamicSchedulingConfig;
  statisticsConfig: Record<string, unknown>;
  capabilities: string[];
  defaultPermissions: PermissionKey[];
  effectiveYear?: number;
  effectiveMonth?: number;
  changeSummary?: string | null;
}

export interface SaveDynamicShiftTemplateInput {
  id?: string;
  code: string;
  name: string;
  dayKind: DynamicDayKind;
  startTime: string;
  endTime: string;
  minWorkers: number;
  targetWorkers: number;
  maxWorkers: number;
  sortOrder: number;
  isActive: boolean;
  metadata: Record<string, unknown>;
  paySegments: DynamicPaySegment[];
}

export interface SaveDynamicScheduleGroupInput {
  id: string;
  name: string;
  description?: string | null;
  isActive: boolean;
  changeSummary?: string | null;
  shiftTemplates: SaveDynamicShiftTemplateInput[];
  dayRules: DynamicDayRule[];
}

export interface DynamicSchedulePreviewShift {
  templateId: string;
  code: string;
  name: string;
  startTime: string;
  endTime: string;
  minWorkers: number;
  targetWorkers: number;
  maxWorkers: number;
  paySegments: DynamicPaySegment[];
}

export interface DynamicSchedulePreviewDay {
  date: string;
  weekdayName: string;
  sourceDayKind: DynamicDayKind;
  effectiveDayKind: DynamicDayKind | null;
  holidayName: string | null;
  isNoWork: boolean;
  shifts: DynamicSchedulePreviewShift[];
}

export interface DynamicSchedulePreview {
  year: number;
  month: number;
  groupId: string;
  days: DynamicSchedulePreviewDay[];
}

export type DynamicRuleSeverity = 'hard' | 'soft';

export interface DynamicSchedulingConfig {
  scheduleChangeMode: DynamicScheduleChangeMode;
  minimumMode: DynamicRuleSeverity;
  maximumMode: DynamicRuleSeverity;
  proportionalFairness: boolean;
  rules: {
    noOverlap: { enabled: boolean; severity: DynamicRuleSeverity };
    noConsecutive: { enabled: boolean; severity: DynamicRuleSeverity };
    minimumRestMinutes: { enabled: boolean; severity: DynamicRuleSeverity; value: number };
    maxShiftsPerDay: { enabled: boolean; severity: DynamicRuleSeverity; value: number };
    balanceNights: { enabled: boolean; severity: 'soft'; weight: number };
    balanceWeekends: { enabled: boolean; severity: 'soft'; weight: number };
    balanceHolidays: { enabled: boolean; severity: 'soft'; weight: number };
  };
  employmentDefinition?: DynamicEmploymentDefinition;
  shiftPattern?: DynamicShiftPatternDefinition;
  weights: {
    coverage: number;
    proportionalFairness: number;
    preference: number;
    targetOptional: number;
  };
}

export interface DynamicSchedulingRuleRegistryItem {
  key: string;
  name: string;
  description: string | null;
  category: string;
  supportedSeverities: DynamicRuleSeverity[];
  parameterSchema: Record<string, unknown>;
}

export interface DynamicFeasibilityMember {
  userId: string;
  displayName: string;
  minimum: number;
  target: number;
  maximum: number | null;
  availableSlots: number;
  weight: number;
  rawProportionalTarget: number;
  capacityCap: number;
  proportionalTarget: number;
  employmentScope?: 'full_time' | 'part_time' | null;
  employmentFactor?: number;
}

export interface DynamicFeasibilityAnalysis {
  materialized: boolean;
  mode: 'shadow';
  periodId?: string;
  jobTypeId?: string;
  year?: number;
  month?: number;
  message?: string;
  requiredAssignments?: number;
  targetAssignments?: number;
  aggregateMinimum?: number;
  aggregateTarget?: number;
  aggregateMaximum?: number;
  minimumDemandExcess?: number;
  maximumCapacityShortage?: number;
  slotsWithoutEnoughCandidates?: number;
  slotsRequiringAvoidCandidates?: number;
  canMeetAllMinimums?: boolean;
  canCoverRequiredByMaximums?: boolean;
  hasCandidateShortages?: boolean;
  members?: DynamicFeasibilityMember[];
  warnings?: Record<string, string>;
}

export interface DynamicShadowDraftResult {
  draftId: string;
  mode: 'shadow';
  requiredAssignmentsCreated: number;
  optionalAssignmentsCreated: number;
  unfilledRequiredPositions: number;
  avoidAssignments?: number;
  aboveTargetAssignments?: number;
  algorithm?: string;
  wholePeriodScarcity?: boolean;
  targetIsEligibilityCutoff?: boolean;
  employmentScopeIsEligibilityCutoff?: boolean;
  partTimeRecommendationFactor?: number;
  feasibility: DynamicFeasibilityAnalysis;
}

export interface DynamicShadowDiagnosticCandidate {
  userId: string;
  displayName: string;
  availabilityStatus: 'available' | 'unavailable' | 'preferred' | 'avoid' | null;
  assigned: number;
  maximum: number | null;
  employmentScope: 'full_time' | 'part_time' | null;
  employmentFactor: number;
  eligible: boolean;
  reason: string;
}

export interface DynamicShadowDiagnosticSlot {
  slotId: string;
  date: string;
  shiftName: string;
  startTime: string;
  endTime: string;
  requiredWorkers: number;
  assignedWorkers: number;
  unfilledPositions: number;
  assignedNames: string[];
  candidates: DynamicShadowDiagnosticCandidate[];
}

export interface DynamicShadowDiagnostics {
  draftId: string;
  mode: 'shadow';
  unfilledSlots: DynamicShadowDiagnosticSlot[];
}


export interface DynamicShadowValidationAssignment {
  userId: string;
  displayName: string;
  tier: 'required' | 'target_optional';
  score: number;
  reasons: string[];
  availabilityStatus: 'available' | 'unavailable' | 'preferred' | 'avoid' | null;
}

export interface DynamicShadowValidationLegacyAssignment {
  shiftId: string;
  userId: string | null;
  displayName: string | null;
  isIntentionallyUnassigned: boolean;
}

export interface DynamicShadowValidationSlot {
  slotId: string;
  date: string;
  shiftCode: string;
  shiftName: string;
  startTime: string;
  endTime: string;
  requiredWorkers: number;
  targetWorkers: number;
  dynamicAssignments: DynamicShadowValidationAssignment[];
  legacyAssignment: DynamicShadowValidationLegacyAssignment | null;
  comparisonStatus: 'match' | 'different' | 'legacy_missing_shift' | 'unsupported';
}

export interface DynamicShadowValidationWorker {
  userId: string;
  displayName: string;
  minimum: number | null;
  target: number | null;
  maximum: number | null;
  proportionalTarget: number;
  assigned: number;
  preferredAssignments: number;
  avoidAssignments: number;
  underMinimum: boolean;
  aboveTarget: boolean;
  atOrAboveMaximum: boolean;
  employmentScope: 'full_time' | 'part_time' | null;
}

export interface DynamicShadowValidationMetrics {
  totalSlots: number;
  coveredRequiredSlots: number;
  unfilledSlots: number;
  comparableSlots: number;
  matchingSlots: number;
  differentSlots: number;
  matchPercent: number | null;
  preferredAssignments: number;
  avoidAssignments: number;
  underMinimumWorkers: number;
  aboveTargetWorkers: number;
}

export interface DynamicShadowValidation {
  draftId: string;
  mode: 'shadow';
  jobTypeId: string;
  jobTypeName: string;
  year: number;
  month: number;
  algorithm: string | null;
  legacySupported: boolean;
  legacyAvailable: boolean;
  legacyNote: string | null;
  metrics: DynamicShadowValidationMetrics;
  workers: DynamicShadowValidationWorker[];
  slots: DynamicShadowValidationSlot[];
}

export interface DynamicAvailabilityShadowSummary {
  jobTypeId: string;
  jobTypeName: string;
  availabilityConfig: DynamicAvailabilityConfig;
  periodId: string | null;
  materialized: boolean;
  slotCount: number;
  memberCount: number;
  submissionCount: number;
  mode: 'shadow';
}

export interface DynamicAvailabilityWorkspaceSlot {
  id: string;
  date: string;
  shiftCode: string;
  shiftName: string;
  startTime: string;
  endTime: string;
  holidayName: string | null;
  sourceDayKind: string;
  effectiveDayKind: string | null;
  minWorkers: number;
  targetWorkers: number;
  maxWorkers: number;
}

export interface DynamicAvailabilityWorkspaceEntry {
  status: 'available' | 'unavailable' | 'preferred' | 'avoid';
  note: string | null;
}

export interface DynamicAvailabilityWorkspaceMember {
  userId: string;
  displayName: string;
  isActive: boolean;
  submissionId: string | null;
  status: 'draft' | 'submitted' | 'reopened';
  minimum: number | null;
  target: number | null;
  maximum: number | null;
  maxNights: number | null;
  maxWeekends: number | null;
  maxHolidays: number | null;
  note: string | null;
  entries: Record<string, DynamicAvailabilityWorkspaceEntry>;
}

export interface DynamicAvailabilityWorkspace {
  materialized: boolean;
  mode: 'shadow';
  periodId: string | null;
  jobTypeId: string;
  jobTypeName: string;
  availabilityConfig: DynamicAvailabilityConfig;
  slots: DynamicAvailabilityWorkspaceSlot[];
  members: DynamicAvailabilityWorkspaceMember[];
}

export interface SaveDynamicAvailabilityShadowSubmissionInput {
  submissionStatus: 'draft' | 'submitted' | 'reopened';
  minimum: number | null;
  target: number | null;
  maximum: number | null;
  maxNights: number | null;
  maxWeekends: number | null;
  maxHolidays: number | null;
  note: string | null;
  entries: Array<{
    slotId: string;
    status: 'available' | 'unavailable' | 'preferred' | 'avoid';
    note?: string | null;
  }>;
}


export interface DynamicPeriodWorkflowState {
  jobTypeId: string;
  jobTypeName: string;
  year: number;
  month: number;
  memberCount: number;
  availabilityEnabled: boolean;
  schedulingStrategy: string;
  permissions: Record<string, boolean>;
  period: null | {
    id: string;
    status: 'shadow' | 'draft' | 'open' | 'closed' | 'archived';
    title: string;
    submissionDeadline: string | null;
    slotCount: number;
    submissionCount: number;
    submittedCount: number;
  };
  draft: null | {
    id: string;
    status: 'shadow' | 'generated' | 'incomplete' | 'failed';
    metrics: Record<string, unknown>;
    createdAt: string;
    updatedAt: string;
  };
  publication: null | {
    id: string;
    status: 'published' | 'archived';
    publishedAt: string;
    assignmentCount: number;
  };
}


export interface DynamicPublishedEditorMember {
  userId: string;
  displayName: string;
}

export interface DynamicPublishedEditorAssignment {
  id: string;
  userId: string;
  displayName: string;
  userIsActive: boolean;
  originalUserId: string | null;
  originalDisplayName: string | null;
  managerEdited: boolean;
  managerOverrideNote: string | null;
}

export interface DynamicPublishedEditorSlot {
  slotId: string;
  shiftDate: string;
  shiftCode: string;
  shiftName: string;
  startTime: string;
  endTime: string;
  intentionallyUnassignedCount: number;
  assignments: DynamicPublishedEditorAssignment[];
}

export interface DynamicPublishedEditorWorkspace {
  publicationId: string;
  jobTypeId: string;
  jobTypeName: string;
  year: number;
  month: number;
  editable: boolean;
  editabilityReason: string | null;
  members: DynamicPublishedEditorMember[];
  slots: DynamicPublishedEditorSlot[];
}

export interface DynamicHistoricalEditorAssignment {
  id: string;
  userId: string | null;
  displayName: string | null;
  originalUserId: string | null;
  originalDisplayName: string | null;
  isIntentionallyUnassigned: boolean;
}

export interface DynamicHistoricalSlotEditorWorkspace {
  historicalPeriodId: string;
  jobTypeId: string;
  jobTypeName: string;
  year: number;
  month: number;
  editable: boolean;
  editabilityReason: string | null;
  members: DynamicPublishedEditorMember[];
  assignments: DynamicHistoricalEditorAssignment[];
}

export interface DynamicSchedulePublicationResult {
  publicationId: string;
  published: boolean;
  assignmentCount: number;
}

export interface DynamicAvailabilityLegacyComparison {
  mode: 'shadow';
  supported: boolean;
  legacyRole: string | null;
  note: string | null;
  dynamic: { slots: number; members: number; entries: number };
  legacy: { slots: number; members: number; entries: number };
  slotDelta: number;
  memberDelta: number;
  entryDelta: number;
}


export interface MyDynamicSchedulePeriod {
  publicationId: string;
  periodSource: 'publication' | 'history';
  jobTypeId: string;
  jobTypeName: string;
  year: number;
  month: number;
  status: 'published' | 'archived';
  publishedAt: string;
  assignmentCount: number;
  workMode: DynamicWorkStructureMode;
  scheduleChangeMode: DynamicScheduleChangeMode;
}

export interface MyDynamicScheduleAssignment {
  id: string;
  shiftDate: string;
  shiftCode: string;
  shiftName: string;
  startTime: string;
  endTime: string;
  assignmentTier: string;
  managerEdited: boolean;
  managerOverrideNote: string | null;
  holidayName: string | null;
  sourceDayKind: string | null;
  contains200Percent: boolean;
  premium200Hours: number;
  userId: string | null;
  displayName: string | null;
  isMine: boolean;
}

export interface MyDynamicScheduleWorkspace {
  publicationId: string;
  periodSource: 'publication' | 'history';
  readOnly: boolean;
  jobTypeId: string;
  jobTypeName: string;
  year: number;
  month: number;
  status: 'published' | 'archived';
  publishedAt: string;
  workMode: DynamicWorkStructureMode;
  scheduleChangeMode: DynamicScheduleChangeMode;
  canViewOthers: boolean;
  assignments: MyDynamicScheduleAssignment[];
}

export interface DynamicSelfEditMember {
  userId: string;
  displayName: string;
}

export interface DynamicSelfEditAssignment {
  id: string;
  shiftDate: string;
  shiftCode: string;
  shiftName: string;
  startTime: string;
  endTime: string;
  userId: string;
  displayName: string;
  isMine: boolean;
  userEditedBy: string | null;
  userEditedAt: string | null;
}

export interface DynamicSelfEditWorkspace {
  publicationId: string;
  jobTypeId: string;
  jobTypeName: string;
  year: number;
  month: number;
  editable: boolean;
  editabilityReason: string | null;
  canViewOthers: boolean;
  canEditAll: boolean;
  members: DynamicSelfEditMember[];
  assignments: DynamicSelfEditAssignment[];
}
export interface MyDynamicAvailabilityPeriod {
  jobTypeId: string;
  jobTypeName: string;
  year: number;
  month: number;
  periodId: string;
  periodStatus: 'open' | 'closed' | 'archived' | 'shadow' | 'draft';
  submissionDeadline: string | null;
  slotCount: number;
  submissionStatus: 'draft' | 'submitted' | 'reopened' | null;
  submittedAt: string | null;
  filledCount: number;
}

export interface DynamicDraftEditorCandidate {
  userId: string;
  displayName: string;
  availabilityStatus: 'available' | 'unavailable' | 'preferred' | 'avoid' | null;
  assignedCount: number;
  maximum: number | null;
  isAssignedHere: boolean;
}

export interface DynamicDraftEditorAssignment {
  id: string;
  userId: string;
  displayName: string;
  engineUserId: string | null;
  engineDisplayName: string | null;
  tier: 'required' | 'target_optional';
  score: number;
  reasons: unknown[];
  managerEdited: boolean;
  managerOverrideNote: string | null;
}

export interface DynamicDraftEditorSlot {
  slotId: string;
  date: string;
  shiftCode: string;
  shiftName: string;
  startTime: string;
  endTime: string;
  minWorkers: number;
  targetWorkers: number;
  maxWorkers: number;
  intentionallyUnassignedCount: number;
  overrideNote: string | null;
  assignments: DynamicDraftEditorAssignment[];
  candidates: DynamicDraftEditorCandidate[];
}

export interface DynamicDraftEditorWorkspace {
  draftId: string;
  jobTypeId: string;
  jobTypeName: string;
  year: number;
  month: number;
  status: 'generated' | 'incomplete';
  metrics: Record<string, unknown>;
  slots: DynamicDraftEditorSlot[];
}

export type DynamicShiftExchangeType = 'one_way' | 'two_way';
export type DynamicShiftExchangeStatus =
  | 'pending_counterparty'
  | 'pending_manager'
  | 'approved'
  | 'rejected_by_counterparty'
  | 'rejected_by_manager'
  | 'cancelled'
  | 'expired';

export interface DynamicShiftExchangeShiftOption {
  id: string;
  publicationId: string;
  jobTypeId: string;
  jobTypeName: string;
  assignedUserId?: string;
  shiftDate: string;
  shiftCode: string;
  shiftName: string;
  startTime: string;
  endTime: string;
  year: number;
  month: number;
}

export interface DynamicShiftExchangeMemberOption {
  userId: string;
  displayName: string;
  jobTypeId: string;
}

export interface DynamicShiftExchangeOptions {
  hasDynamicShiftExchange: boolean;
  publications: Array<{
    publicationId: string;
    jobTypeId: string;
    jobTypeName: string;
    year: number;
    month: number;
  }>;
  myShifts: DynamicShiftExchangeShiftOption[];
  members: DynamicShiftExchangeMemberOption[];
  counterpartyShifts: DynamicShiftExchangeShiftOption[];
}

export interface DynamicShiftExchangeRequest {
  id: string;
  publicationId: string;
  jobTypeId: string;
  jobTypeName: string;
  swapType: DynamicShiftExchangeType;
  status: DynamicShiftExchangeStatus;
  requesterUserId: string;
  requesterName: string;
  counterpartyUserId: string;
  counterpartyName: string;
  requesterAssignmentId: string;
  requesterShiftDate: string;
  requesterShiftName: string;
  requesterStartTime: string;
  requesterEndTime: string;
  counterpartyAssignmentId: string | null;
  counterpartyShiftDate: string | null;
  counterpartyShiftName: string | null;
  counterpartyStartTime: string | null;
  counterpartyEndTime: string | null;
  rejectionReason: string | null;
  counterpartyRespondedAt: string | null;
  managerReviewedAt: string | null;
  managerUserId: string | null;
  createdAt: string;
  updatedAt: string;
}
