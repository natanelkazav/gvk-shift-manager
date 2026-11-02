/**
 * קובץ: src/types/dynamicScheduling.ts
 * מטרה: הגדרת טיפוסים וחוזי נתונים עבור דינמי.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: EmploymentScope, DynamicEmploymentDefinition, DynamicWorkStructureMode, DynamicScheduleChangeMode, DynamicWorkShiftDefinition, DynamicWorkDayDefinition, DynamicShiftPatternDefinition, JobPayModel, DynamicSchedulingStrategy, DynamicJobTypeConfigurationVersion ועוד.
 * - תיאור מבנה הקלט והפלט לבדיקת טיפוסים בזמן פיתוח.
 */
import type { PermissionKey } from './auth';

/**
 * טיפוס EmploymentScope: הנתון EmploymentScope בהקשר הפעולה.
 */
export type EmploymentScope = 'full_time' | 'part_time' | 'flexible';

/**
 * חוזה הנתונים DynamicEmploymentDefinition: דינמי.
 */
export interface DynamicEmploymentDefinition {
  // fullTimeDays — זמן / ימים.
  fullTimeDays: number[];
  // partTimeDays — זמן / ימים.
  partTimeDays: number[];
  // partTimeStartTime — שעת התחלה.
  partTimeStartTime: string;
  // partTimeEndTime — שעת סיום.
  partTimeEndTime: string;
}

/**
 * טיפוס DynamicWorkStructureMode: דינמי / מצב פעולה.
 */
export type DynamicWorkStructureMode = 'none' | 'shifts' | 'on_call_hourly' | 'on_call_daily';

/**
 * טיפוס DynamicScheduleChangeMode: דינמי / שיבוץ / מצב פעולה.
 */
export type DynamicScheduleChangeMode = 'none' | 'shift_exchange' | 'self_edit';

/**
 * חוזה הנתונים DynamicWorkShiftDefinition: דינמי / משמרת.
 */
export interface DynamicWorkShiftDefinition {
  // id — מזהה.
  id: string;
  // name — שם.
  name: string;
  // startTime — שעת התחלה.
  startTime: string;
  // endTime — שעת סיום.
  endTime: string;
  contains200Percent: boolean;
  // premium200Hours — שעות.
  premium200Hours: number;
}

/**
 * חוזה הנתונים DynamicWorkDayDefinition: דינמי / יום.
 */
export interface DynamicWorkDayDefinition {
  works: boolean;
  // shifts — משמרות.
  shifts: DynamicWorkShiftDefinition[];
  // applyToHolidayEve — חג (אופציונלי).
  applyToHolidayEve?: boolean;
  // applyToHolidayEnd — חג (אופציונלי).
  applyToHolidayEnd?: boolean;
}

/**
 * חוזה הנתונים DynamicShiftPatternDefinition: דינמי / משמרת.
 */
export interface DynamicShiftPatternDefinition {
  // enabled — האם האפשרות מופעלת.
  enabled: boolean;
  // workMode — מצב פעולה.
  workMode: DynamicWorkStructureMode;
  /**
   * Operational coverage window for daily on-call roles.
   * This does not turn the assignment into an hourly shift and is not shown to employees.
   * It is used when the system needs a real interval, e.g. cross-role dashboard overlap.
   */
  dailyOnCallWindow?: {
    // startTime — שעת התחלה.
    startTime: string;
    // endTime — שעת סיום.
    endTime: string;
  };
  weekday: DynamicWorkDayDefinition;
  friday: DynamicWorkDayDefinition;
  saturday: DynamicWorkDayDefinition;
  // holiday — חג.
  holiday: DynamicWorkDayDefinition;
}

/**
 * טיפוס JobPayModel: הנתון JobPayModel בהקשר הפעולה.
 */
export type JobPayModel = 'hourly' | 'per_shift' | 'per_day' | 'mixed' | 'none';

/**
 * טיפוס DynamicSchedulingStrategy: דינמי / שיטת שיבוץ.
 */
export type DynamicSchedulingStrategy =
  | 'none'
  | 'availability_optimizer'
  | 'monthly_rotation_constraints';

/**
 * חוזה הנתונים DynamicJobTypeConfigurationVersion: סוג תפקיד.
 */
export interface DynamicJobTypeConfigurationVersion {
  // effectiveYear — שנה.
  effectiveYear: number;
  // effectiveMonth — חודש.
  effectiveMonth: number;
  // effectiveMonthDate — חודש / תאריך.
  effectiveMonthDate: string;
  // schedulingStrategy — שיטת שיבוץ.
  schedulingStrategy: DynamicSchedulingStrategy;
  // changeSummary — סיכום.
  changeSummary: string | null;
  // createdAt — מועד יצירה.
  createdAt: string;
}

/**
 * טיפוס DynamicDayKind: דינמי / יום.
 */
export type DynamicDayKind =
  | 'weekday'
  | 'friday'
  | 'saturday'
  | 'holiday_eve'
  | 'holiday_full'
  | 'holiday_end'
  | 'chol_hamoed'
  | 'custom';

/**
 * חוזה הנתונים DynamicPaySegment: דינמי.
 */
export interface DynamicPaySegment {
  // id — מזהה (אופציונלי).
  id?: string;
  // startTime — שעת התחלה.
  startTime: string;
  // endTime — שעת סיום.
  endTime: string;
  multiplier: number;
  // label — תווית.
  label: string | null;
  // sortOrder — סדר המיון.
  sortOrder: number;
}

/**
 * חוזה הנתונים DynamicShiftTemplate: דינמי / משמרת / תבנית.
 */
export interface DynamicShiftTemplate {
  // id — מזהה.
  id: string;
  code: string;
  // name — שם.
  name: string;
  // dayKind — יום.
  dayKind: DynamicDayKind;
  // startTime — שעת התחלה.
  startTime: string;
  // endTime — שעת סיום.
  endTime: string;
  hours200Percent: number;
  minWorkers: number;
  // targetWorkers — יעד.
  targetWorkers: number;
  maxWorkers: number;
  // sortOrder — סדר המיון.
  sortOrder: number;
  // isActive — האם הרשומה פעילה.
  isActive: boolean;
  metadata: Record<string, unknown>;
  paySegments: DynamicPaySegment[];
}

/**
 * חוזה הנתונים DynamicDayRule: דינמי / יום / כלל.
 */
export interface DynamicDayRule {
  // dayKind — יום.
  dayKind: DynamicDayKind;
  behavior: 'own_templates' | 'inherit' | 'no_work';
  // inheritDayKind — יום.
  inheritDayKind: DynamicDayKind | null;
  metadata: Record<string, unknown>;
}

/**
 * חוזה הנתונים DynamicScheduleGroup: דינמי / שיבוץ / קבוצה.
 */
export interface DynamicScheduleGroup {
  // id — מזהה.
  id: string;
  code: string;
  // name — שם.
  name: string;
  description: string | null;
  // isActive — האם הרשומה פעילה.
  isActive: boolean;
  legacyKind: string | null;
  // config — תצורה.
  config: Record<string, unknown>;
  // shiftTemplates — משמרת / תבניות.
  shiftTemplates: DynamicShiftTemplate[];
  // dayRules — יום / כללים.
  dayRules: DynamicDayRule[];
  // versionCount — גרסה / כמות.
  versionCount: number;
  // currentVersion — גרסה.
  currentVersion: number;
}

/**
 * חוזה הנתונים DynamicAvailabilityConfig: דינמי / אילוצים וזמינות / תצורה.
 */
export interface DynamicAvailabilityConfig {
  /** Optional for backward compatibility: existing roles keep their current preferences UI. */
  showEmployeePreferences?: boolean;
  // showWeeklyShiftLimit — שבועי / משמרת / מגבלת תוצאות (אופציונלי).
  showWeeklyShiftLimit?: boolean;
  // enabled — האם האפשרות מופעלת.
  enabled: boolean;
  statuses: Array<'available' | 'unavailable' | 'preferred' | 'avoid'>;
  // allowNotes — הערות.
  allowNotes: boolean;
  monthlyCapacity: {
    // enabled — האם האפשרות מופעלת.
    enabled: boolean;
    // minEnabled — האם האפשרות מופעלת.
    minEnabled: boolean;
    // targetEnabled — יעד / האם האפשרות מופעלת.
    targetEnabled: boolean;
    // maxEnabled — האם האפשרות מופעלת.
    maxEnabled: boolean;
    defaultMin: number | null;
    // defaultTarget — יעד.
    defaultTarget: number | null;
    defaultMax: number | null;
  };
  limits: {
    // maxNightsEnabled — האם האפשרות מופעלת.
    maxNightsEnabled: boolean;
    defaultMaxNights: number | null;
    // maxWeekendsEnabled — האם האפשרות מופעלת.
    maxWeekendsEnabled: boolean;
    defaultMaxWeekends: number | null;
    // maxHolidaysEnabled — חגים / האם האפשרות מופעלת.
    maxHolidaysEnabled: boolean;
    // defaultMaxHolidays — חגים.
    defaultMaxHolidays: number | null;
  };
}

/**
 * חוזה הנתונים DynamicJobTypeMember: סוג תפקיד.
 */
export interface DynamicJobTypeMember {
  // userId — מזהה משתמש.
  userId: string;
  // displayName — שם תצוגה.
  displayName: string;
  // isActive — האם הרשומה פעילה.
  isActive: boolean;
  employmentScope: 'full_time' | 'part_time' | null;
  recommendationFactor: number;
}

/**
 * חוזה הנתונים DynamicJobType: סוג תפקיד.
 */
export interface DynamicJobType {
  // id — מזהה.
  id: string;
  // scheduleGroupId — שיבוץ / קבוצה / מזהה.
  scheduleGroupId: string;
  code: string;
  // name — שם.
  name: string;
  description: string | null;
  // isActive — האם הרשומה פעילה.
  isActive: boolean;
  legacyRole: string | null;
  employmentScope: EmploymentScope;
  payModel: JobPayModel;
  // payConfig — תצורה.
  payConfig: Record<string, unknown>;
  // availabilityConfig — אילוצים וזמינות / תצורה.
  availabilityConfig: DynamicAvailabilityConfig;
  // schedulingStrategy — שיטת שיבוץ.
  schedulingStrategy: DynamicSchedulingStrategy;
  // schedulingConfig — תצורה.
  schedulingConfig: DynamicSchedulingConfig;
  // statisticsConfig — סטטיסטיקה / תצורה.
  statisticsConfig: Record<string, unknown>;
  // aiConfig — תצורה.
  aiConfig: Record<string, unknown>;
  // capabilities — יכולות תפקיד.
  capabilities: string[];
  // defaultPermissions — הרשאות.
  defaultPermissions: PermissionKey[];
  // memberCount — כמות.
  memberCount: number;
  // members — חברי התפקיד.
  members: DynamicJobTypeMember[];
  // configurationVersions — תצורה / גרסאות.
  configurationVersions: DynamicJobTypeConfigurationVersion[];
}

/**
 * חוזה הנתונים DynamicSchedulingAdminData: דינמי / נתונים.
 */
export interface DynamicSchedulingAdminData {
  // featureEnabled — האם האפשרות מופעלת.
  featureEnabled: boolean;
  // featureMode — מצב פעולה.
  featureMode: string;
  // scheduleGroups — שיבוץ / קבוצות.
  scheduleGroups: DynamicScheduleGroup[];
  // jobTypes — סוגי תפקידים.
  jobTypes: DynamicJobType[];
  // ruleRegistry — כלל.
  ruleRegistry: DynamicSchedulingRuleRegistryItem[];
}

/**
 * טיפוס DynamicMemberEmploymentScope: דינמי.
 */
export type DynamicMemberEmploymentScope = 'full_time' | 'part_time' | 'as_much_as_possible';

/**
 * חוזה הנתונים DynamicPartTimeDefinition: דינמי / זמן.
 */
export interface DynamicPartTimeDefinition {
  // days — ימים.
  days: number[];
  // startTime — שעת התחלה.
  startTime: string;
  // endTime — שעת סיום.
  endTime: string;
}

/**
 * חוזה הנתונים DynamicMembershipAdminUser: דינמי / שיוך לתפקיד / משתמש.
 */
export interface DynamicMembershipAdminUser {
  // userId — מזהה משתמש.
  userId: string;
  // displayName — שם תצוגה.
  displayName: string;
  // email — כתובת דוא״ל.
  email: string;
  legacyRole: string;
  // isActive — האם הרשומה פעילה.
  isActive: boolean;
  isMember: boolean;
  isPrimary: boolean;
  // isJobTypeManager — סוג תפקיד.
  isJobTypeManager: boolean;
  employmentScope: DynamicMemberEmploymentScope | null;
  // partTimeDefinition — זמן.
  partTimeDefinition: Partial<DynamicPartTimeDefinition>;
}

/**
 * חוזה הנתונים DynamicMembershipAdminData: דינמי / שיוך לתפקיד / נתונים.
 */
export interface DynamicMembershipAdminData {
  // users — משתמשים.
  users: DynamicMembershipAdminUser[];
}

/**
 * טיפוס DynamicLegacySourceKind: דינמי / מקור.
 */
export type DynamicLegacySourceKind = 'dispatcher' | 'on_call' | 'morning_driver';

/**
 * חוזה הנתונים DynamicLegacyImportPeriodDetail: דינמי / ייבוא / תקופה.
 */
export interface DynamicLegacyImportPeriodDetail {
  // sourcePeriodId — מזהה התקופה.
  sourcePeriodId: string;
  // year — שנה.
  year: number;
  // month — חודש.
  month: number;
  // label — תווית.
  label: string;
  // status — סטטוס.
  status: string;
  // assignments — הקצאות.
  assignments: number;
  // availability — אילוצים וזמינות.
  availability: number;
  alreadyImported: boolean;
}

/**
 * טיפוס DynamicLegacyImportUserStatus: דינמי / ייבוא / משתמש / סטטוס.
 */
export type DynamicLegacyImportUserStatus = 'matched' | 'missing_profile' | 'role_mismatch';

/**
 * חוזה הנתונים DynamicLegacyImportUserDetail: דינמי / ייבוא / משתמש.
 */
export interface DynamicLegacyImportUserDetail {
  // userId — מזהה משתמש.
  userId: string;
  // displayName — שם תצוגה.
  displayName: string;
  // email — כתובת דוא״ל.
  email: string | null;
  legacyRole: string | null;
  expectedLegacyRole: string;
  // isActive — האם הרשומה פעילה.
  isActive: boolean;
  isAlreadyMember: boolean;
  // status — סטטוס.
  status: DynamicLegacyImportUserStatus;
}

/**
 * חוזה הנתונים DynamicLegacyImportIssue: דינמי / ייבוא.
 */
export interface DynamicLegacyImportIssue {
  severity: 'warning' | 'error';
  code: string;
  // message — הודעה.
  message: string;
}

/**
 * חוזה הנתונים DynamicLegacyImportPreview: דינמי / ייבוא.
 */
export interface DynamicLegacyImportPreview {
  // sourceKind — מקור.
  sourceKind: DynamicLegacySourceKind;
  expectedLegacyRole: string;
  // periods — תקופות.
  periods: number;
  // assignments — הקצאות.
  assignments: number;
  // availability — אילוצים וזמינות.
  availability: number;
  // alreadyImportedPeriods — תקופות.
  alreadyImportedPeriods: number;
  // alreadyImportedAssignments — הקצאות.
  alreadyImportedAssignments: number;
  // alreadyImportedAvailability — אילוצים וזמינות.
  alreadyImportedAvailability: number;
  // newPeriods — תקופות.
  newPeriods: number;
  // newAssignments — הקצאות.
  newAssignments: number;
  // newAvailability — אילוצים וזמינות.
  newAvailability: number;
  // matchingUsers — משתמשים.
  matchingUsers: number;
  // referencedUsers — משתמשים.
  referencedUsers: number;
  // missingProfiles — פרופילים.
  missingProfiles: number;
  roleMismatches: number;
  // periodDetails — תקופה.
  periodDetails: DynamicLegacyImportPeriodDetail[];
  // userDetails — משתמש.
  userDetails: DynamicLegacyImportUserDetail[];
  issues: DynamicLegacyImportIssue[];
  // canImport — ייבוא.
  canImport: boolean;
  warning: string;
}

/**
 * חוזה הנתונים DynamicLegacyImportResult: דינמי / ייבוא / תוצאה.
 */
export interface DynamicLegacyImportResult {
  // batchId — מזהה.
  batchId: string;
  // periodsImported — תקופות.
  periodsImported: number;
  // assignmentsImported — הקצאות.
  assignmentsImported: number;
  // availabilityImported — אילוצים וזמינות.
  availabilityImported: number;
  idempotent: boolean;
}



/**
 * חוזה הנתונים DynamicRotationMember: דינמי / סבב כוננויות.
 */
export interface DynamicRotationMember {
  // userId — מזהה משתמש.
  userId: string;
  // displayName — שם תצוגה.
  displayName: string;
  // isActive — האם הרשומה פעילה.
  isActive: boolean;
  // rotationIndex — סבב כוננויות / מיקום באוסף.
  rotationIndex: number | null;
}

/**
 * חוזה הנתונים DynamicRotationPreviewDay: דינמי / סבב כוננויות / יום.
 */
export interface DynamicRotationPreviewDay {
  // date — תאריך.
  date: string;
  // originalUserId — מזהה משתמש.
  originalUserId: string;
  // originalDisplayName — שם תצוגה.
  originalDisplayName: string;
  // actualUserId — מזהה משתמש.
  actualUserId: string | null;
  // actualDisplayName — שם תצוגה.
  actualDisplayName: string | null;
  isSubstitution: boolean;
}

/**
 * חוזה הנתונים DynamicRotationWorkspace: דינמי / סבב כוננויות.
 */
export interface DynamicRotationWorkspace {
  // jobTypeId — מזהה סוג התפקיד.
  jobTypeId: string;
  // jobTypeName — סוג תפקיד.
  jobTypeName: string;
  initialized: boolean;
  // rotationUserIds — מזהה משתמש.
  rotationUserIds: string[];
  // anchorDate — תאריך.
  anchorDate: string | null;
  // source — מקור.
  source: 'historical_best_window' | 'membership_fallback' | 'manual' | null;
  // sourceMetadata — מקור.
  sourceMetadata: Record<string, unknown>;
  // members — חברי התפקיד.
  members: DynamicRotationMember[];
  preview: DynamicRotationPreviewDay[];
}

/**
 * חוזה הנתונים DynamicRoleWorkspacePeriodUser: דינמי / תקופה / משתמש.
 */
export interface DynamicRoleWorkspacePeriodUser {
  // userId — מזהה משתמש.
  userId: string;
  // displayName — שם תצוגה.
  displayName: string;
}

/**
 * חוזה הנתונים DynamicRoleWorkspacePeriod: דינמי / תקופה.
 */
export interface DynamicRoleWorkspacePeriod {
  // id — מזהה.
  id: string;
  // year — שנה.
  year: number;
  // month — חודש.
  month: number;
  // sourceKind — מקור.
  sourceKind: DynamicLegacySourceKind;
  // sourceStatus — מקור / סטטוס.
  sourceStatus: string | null;
  importedAt: string;
  // assignments — הקצאות.
  assignments: number;
  // availability — אילוצים וזמינות.
  availability: number;
  // assignedUsers — משתמשים.
  assignedUsers: DynamicRoleWorkspacePeriodUser[];
}

/**
 * חוזה הנתונים DynamicRoleWorkspace: דינמי.
 */
export interface DynamicRoleWorkspace {
  // jobTypeId — מזהה סוג התפקיד.
  jobTypeId: string;
  // jobTypeName — סוג תפקיד.
  jobTypeName: string;
  // isActive — האם הרשומה פעילה.
  isActive: boolean;
  // schedulingStrategy — שיטת שיבוץ.
  schedulingStrategy: DynamicSchedulingStrategy;
  // memberCount — כמות.
  memberCount: number;
  // materializationCount — מימוש תצורת השיבוץ לחודש / כמות.
  materializationCount: number;
  // historicalTotals — נתונים היסטוריים.
  historicalTotals: {
    // periods — תקופות.
    periods: number;
    // assignments — הקצאות.
    assignments: number;
    // availability — אילוצים וזמינות.
    availability: number;
  };
  // periods — תקופות.
  periods: DynamicRoleWorkspacePeriod[];
}

/**
 * חוזה הנתונים SaveDynamicJobTypeInput: סוג תפקיד.
 */
export interface SaveDynamicJobTypeInput {
  // id — מזהה (אופציונלי).
  id?: string | null;
  legacyRole?: string | null;
  // scheduleGroupId — שיבוץ / קבוצה / מזהה.
  scheduleGroupId: string;
  code: string;
  // name — שם.
  name: string;
  description?: string | null;
  // isActive — האם הרשומה פעילה.
  isActive: boolean;
  employmentScope: EmploymentScope;
  payModel: JobPayModel;
  // payConfig — תצורה.
  payConfig: Record<string, unknown>;
  // availabilityConfig — אילוצים וזמינות / תצורה.
  availabilityConfig: DynamicAvailabilityConfig;
  // schedulingStrategy — שיטת שיבוץ.
  schedulingStrategy: DynamicSchedulingStrategy;
  // schedulingConfig — תצורה.
  schedulingConfig: DynamicSchedulingConfig;
  // statisticsConfig — סטטיסטיקה / תצורה.
  statisticsConfig: Record<string, unknown>;
  // capabilities — יכולות תפקיד.
  capabilities: string[];
  // defaultPermissions — הרשאות.
  defaultPermissions: PermissionKey[];
  // effectiveYear — שנה (אופציונלי).
  effectiveYear?: number;
  // effectiveMonth — חודש (אופציונלי).
  effectiveMonth?: number;
  // changeSummary — סיכום (אופציונלי).
  changeSummary?: string | null;
}

/**
 * חוזה הנתונים SaveDynamicShiftTemplateInput: דינמי / משמרת / תבנית / קלט.
 */
export interface SaveDynamicShiftTemplateInput {
  // id — מזהה (אופציונלי).
  id?: string;
  code: string;
  // name — שם.
  name: string;
  // dayKind — יום.
  dayKind: DynamicDayKind;
  // startTime — שעת התחלה.
  startTime: string;
  // endTime — שעת סיום.
  endTime: string;
  hours200Percent: number;
  minWorkers: number;
  // targetWorkers — יעד.
  targetWorkers: number;
  maxWorkers: number;
  // sortOrder — סדר המיון.
  sortOrder: number;
  // isActive — האם הרשומה פעילה.
  isActive: boolean;
  metadata: Record<string, unknown>;
  paySegments: DynamicPaySegment[];
}

/**
 * חוזה הנתונים SaveDynamicScheduleGroupInput: דינמי / שיבוץ / קבוצה / קלט.
 */
export interface SaveDynamicScheduleGroupInput {
  // id — מזהה.
  id: string;
  // name — שם.
  name: string;
  description?: string | null;
  // isActive — האם הרשומה פעילה.
  isActive: boolean;
  // changeSummary — סיכום (אופציונלי).
  changeSummary?: string | null;
  // shiftTemplates — משמרת / תבניות.
  shiftTemplates: SaveDynamicShiftTemplateInput[];
  // dayRules — יום / כללים.
  dayRules: DynamicDayRule[];
}

/**
 * חוזה הנתונים DynamicSchedulePreviewShift: דינמי / שיבוץ / משמרת.
 */
export interface DynamicSchedulePreviewShift {
  // templateId — תבנית / מזהה.
  templateId: string;
  code: string;
  // name — שם.
  name: string;
  // startTime — שעת התחלה.
  startTime: string;
  // endTime — שעת סיום.
  endTime: string;
  hours200Percent: number;
  minWorkers: number;
  // targetWorkers — יעד.
  targetWorkers: number;
  maxWorkers: number;
  paySegments: DynamicPaySegment[];
}

/**
 * חוזה הנתונים DynamicSchedulePreviewDay: דינמי / שיבוץ / יום.
 */
export interface DynamicSchedulePreviewDay {
  // date — תאריך.
  date: string;
  // weekdayName — שם.
  weekdayName: string;
  // sourceDayKind — מקור / יום.
  sourceDayKind: DynamicDayKind;
  // effectiveDayKind — יום.
  effectiveDayKind: DynamicDayKind | null;
  // holidayName — חג / שם.
  holidayName: string | null;
  isNoWork: boolean;
  // shifts — משמרות.
  shifts: DynamicSchedulePreviewShift[];
}

/**
 * חוזה הנתונים DynamicSchedulePreview: דינמי / שיבוץ.
 */
export interface DynamicSchedulePreview {
  // year — שנה.
  year: number;
  // month — חודש.
  month: number;
  // groupId — קבוצה / מזהה.
  groupId: string;
  // days — ימים.
  days: DynamicSchedulePreviewDay[];
}

/**
 * טיפוס DynamicRuleSeverity: דינמי / כלל.
 */
export type DynamicRuleSeverity = 'hard' | 'soft';

/**
 * חוזה הנתונים DynamicDailyReportConfig: דוחות פעילות יומיים.
 */
export interface DynamicDailyReportConfig {
  // enabled — האם האפשרות מופעלת.
  enabled: boolean;
  // recipientUserIds — מזהי נמעני ההודעה.
  recipientUserIds: string[];
  allowAddSubjects: boolean;
  allowAddCustomers: boolean;
  allowAttachments?: boolean;
}

/**
 * חוזה הנתונים DynamicAttendanceConfig: דינמי / נוכחות / תצורה.
 */
export interface DynamicAttendanceConfig {
  // enabled — האם האפשרות מופעלת.
  enabled: boolean;
  requireLocation: boolean;
  // workplaceName — שם.
  workplaceName: string;
  latitude: number | null;
  longitude: number | null;
  radiusMeters: number;
  // outsidePolicy — מדיניות.
  outsidePolicy: 'flag' | 'block';
  allowUnscheduled: boolean;
}

/**
 * חוזה הנתונים DynamicActivityTrackingConfig: מעקב פעילות וזמני עבודה.
 */
export interface DynamicActivityTrackingConfig {
  // enabled — האם האפשרות מופעלת.
  enabled: boolean;
  activities: Array<{ key: string; label: string }>;
  // reminderEnabled — תזכורות / האם האפשרות מופעלת.
  reminderEnabled: boolean;
  // reminderTime — תזכורות / זמן.
  reminderTime: string;
  // autoEndEnabled — האם האפשרות מופעלת (אופציונלי).
  autoEndEnabled?: boolean;
  // autoEndTime — שעת סיום (אופציונלי).
  autoEndTime?: string;
  // endReminderEnabled — תזכורות / האם האפשרות מופעלת (אופציונלי).
  endReminderEnabled?: boolean;
  // endReminderMinutesBefore — תזכורות / דקות (אופציונלי).
  endReminderMinutesBefore?: number;
  // continuousReminderEnabled — תזכורות / האם האפשרות מופעלת (אופציונלי).
  continuousReminderEnabled?: boolean;
  // continuousReminderMinutes — תזכורות / דקות (אופציונלי).
  continuousReminderMinutes?: number;
}

/**
 * חוזה הנתונים DynamicSchedulingConfig: דינמי / תצורה.
 */
export interface DynamicSchedulingConfig {
  /** Versioned with job-type effective month; reuses the monthly rotation engine. */
  // rotationExchangeEnabled — סבב כוננויות / האם האפשרות מופעלת (אופציונלי).
  rotationExchangeEnabled?: boolean;
  // activityTracking — מעקב פעילות וזמני עבודה (אופציונלי).
  activityTracking?: DynamicActivityTrackingConfig;
  // attendance — נוכחות (אופציונלי).
  attendance?: DynamicAttendanceConfig;
  // dailyReports — דוחות פעילות יומיים (אופציונלי).
  dailyReports?: DynamicDailyReportConfig;
  // scheduleChangeMode — שיבוץ / מצב פעולה.
  scheduleChangeMode: DynamicScheduleChangeMode;
  // minimumMode — מצב פעולה.
  minimumMode: DynamicRuleSeverity;
  // maximumMode — מצב פעולה.
  maximumMode: DynamicRuleSeverity;
  // proportionalFairness — איזון בין עובדים.
  proportionalFairness: boolean;
  // rules — כללים.
  rules: {
    noOverlap: { enabled: boolean; severity: DynamicRuleSeverity };
    noConsecutive: { enabled: boolean; severity: DynamicRuleSeverity };
    // minimumRestMinutes — מנוחה / דקות.
    minimumRestMinutes: { enabled: boolean; severity: DynamicRuleSeverity; value: number };
    // maxShiftsPerDay — משמרות / יום.
    maxShiftsPerDay: { enabled: boolean; severity: DynamicRuleSeverity; value: number };
    balanceNights: { enabled: boolean; severity: 'soft'; weight: number };
    balanceWeekends: { enabled: boolean; severity: 'soft'; weight: number };
    // balanceHolidays — חגים.
    balanceHolidays: { enabled: boolean; severity: 'soft'; weight: number };
  };
  employmentDefinition?: DynamicEmploymentDefinition;
  // shiftPattern — משמרת (אופציונלי).
  shiftPattern?: DynamicShiftPatternDefinition;
  // weights — משקלים בחישוב.
  weights: {
    coverage: number;
    // proportionalFairness — איזון בין עובדים.
    proportionalFairness: number;
    preference: number;
    // targetOptional — יעד.
    targetOptional: number;
  };
}

/**
 * חוזה הנתונים DynamicSchedulingRuleRegistryItem: דינמי / כלל / פריט.
 */
export interface DynamicSchedulingRuleRegistryItem {
  // key — מפתח.
  key: string;
  // name — שם.
  name: string;
  description: string | null;
  category: string;
  supportedSeverities: DynamicRuleSeverity[];
  parameterSchema: Record<string, unknown>;
}

/**
 * חוזה הנתונים DynamicFeasibilityMember: דינמי / בדיקת היתכנות שיבוץ.
 */
export interface DynamicFeasibilityMember {
  // userId — מזהה משתמש.
  userId: string;
  // displayName — שם תצוגה.
  displayName: string;
  minimum: number;
  // target — יעד.
  target: number;
  maximum: number | null;
  availableSlots: number;
  // weight — משקל בחישוב.
  weight: number;
  // rawProportionalTarget — יעד.
  rawProportionalTarget: number;
  capacityCap: number;
  // proportionalTarget — יעד.
  proportionalTarget: number;
  employmentScope?: 'full_time' | 'part_time' | null;
  employmentFactor?: number;
}

/**
 * חוזה הנתונים DynamicFeasibilityAnalysis: דינמי / בדיקת היתכנות שיבוץ.
 */
export interface DynamicFeasibilityAnalysis {
  materialized: boolean;
  // mode — מצב פעולה.
  mode: 'shadow';
  // periodId — מזהה התקופה (אופציונלי).
  periodId?: string;
  // jobTypeId — מזהה סוג התפקיד (אופציונלי).
  jobTypeId?: string;
  // year — שנה (אופציונלי).
  year?: number;
  // month — חודש (אופציונלי).
  month?: number;
  // message — הודעה (אופציונלי).
  message?: string;
  // requiredAssignments — הקצאות (אופציונלי).
  requiredAssignments?: number;
  // targetAssignments — יעד / הקצאות (אופציונלי).
  targetAssignments?: number;
  aggregateMinimum?: number;
  // aggregateTarget — יעד (אופציונלי).
  aggregateTarget?: number;
  aggregateMaximum?: number;
  minimumDemandExcess?: number;
  maximumCapacityShortage?: number;
  slotsWithoutEnoughCandidates?: number;
  slotsRequiringAvoidCandidates?: number;
  canMeetAllMinimums?: boolean;
  canCoverRequiredByMaximums?: boolean;
  hasCandidateShortages?: boolean;
  // members — חברי התפקיד (אופציונלי).
  members?: DynamicFeasibilityMember[];
  warnings?: Record<string, string>;
}

/**
 * חוזה הנתונים DynamicWeeklyRestViolation: דינמי / שבועי / מנוחה.
 */
export interface DynamicWeeklyRestViolation {
  // userId — מזהה משתמש.
  userId: string;
  // displayName — שם תצוגה.
  displayName: string;
  weekStart: string;
  weekEnd: string;
  // calendarWeekStart — לוח שנה.
  calendarWeekStart: string;
  // workedDays — ימים.
  workedDays: number;
  // daysInPeriod — ימים / תקופה.
  daysInPeriod: number;
}

/**
 * חוזה הנתונים DynamicWeeklyRestValidation: דינמי / שבועי / מנוחה / אימות נתונים.
 */
export interface DynamicWeeklyRestValidation {
  valid: boolean;
  // violationCount — כמות.
  violationCount: number;
  violations: DynamicWeeklyRestViolation[];
}

/**
 * חוזה הנתונים DynamicShadowDraftResult: דינמי / טיוטות שיבוץ במנגנון הדינמי / טיוטה / תוצאה.
 */
export interface DynamicShadowDraftResult {
  // draftId — טיוטה / מזהה.
  draftId: string;
  // mode — מצב פעולה.
  mode: 'shadow';
  // requiredAssignmentsCreated — הקצאות.
  requiredAssignmentsCreated: number;
  // optionalAssignmentsCreated — הקצאות.
  optionalAssignmentsCreated: number;
  unfilledRequiredPositions: number;
  // avoidAssignments — הקצאות (אופציונלי).
  avoidAssignments?: number;
  // aboveTargetAssignments — יעד / הקצאות (אופציונלי).
  aboveTargetAssignments?: number;
  algorithm?: string;
  // wholePeriodScarcity — תקופה (אופציונלי).
  wholePeriodScarcity?: boolean;
  // targetIsEligibilityCutoff — יעד / כשירות לשיבוץ (אופציונלי).
  targetIsEligibilityCutoff?: boolean;
  // employmentScopeIsEligibilityCutoff — כשירות לשיבוץ (אופציונלי).
  employmentScopeIsEligibilityCutoff?: boolean;
  // partTimeRecommendationFactor — זמן (אופציונלי).
  partTimeRecommendationFactor?: number;
  // feasibility — בדיקת היתכנות שיבוץ.
  feasibility: DynamicFeasibilityAnalysis;
  // weeklyRest — שבועי / מנוחה (אופציונלי).
  weeklyRest?: DynamicWeeklyRestValidation;
  generationAttempts?: number;
}

/**
 * חוזה הנתונים DynamicShadowDiagnosticCandidate: דינמי / טיוטות שיבוץ במנגנון הדינמי.
 */
export interface DynamicShadowDiagnosticCandidate {
  // userId — מזהה משתמש.
  userId: string;
  // displayName — שם תצוגה.
  displayName: string;
  // availabilityStatus — מצב הזמינות.
  availabilityStatus: 'available' | 'unavailable' | 'preferred' | 'avoid' | null;
  assigned: number;
  maximum: number | null;
  employmentScope: 'full_time' | 'part_time' | null;
  employmentFactor: number;
  eligible: boolean;
  reason: string;
}

/**
 * חוזה הנתונים DynamicShadowDiagnosticSlot: דינמי / טיוטות שיבוץ במנגנון הדינמי.
 */
export interface DynamicShadowDiagnosticSlot {
  // slotId — מזהה.
  slotId: string;
  // date — תאריך.
  date: string;
  // shiftName — משמרת / שם.
  shiftName: string;
  // startTime — שעת התחלה.
  startTime: string;
  // endTime — שעת סיום.
  endTime: string;
  // requiredWorkers — מספר העובדים הנדרש.
  requiredWorkers: number;
  assignedWorkers: number;
  unfilledPositions: number;
  assignedNames: string[];
  candidates: DynamicShadowDiagnosticCandidate[];
}

/**
 * חוזה הנתונים DynamicShadowDiagnostics: דינמי / טיוטות שיבוץ במנגנון הדינמי.
 */
export interface DynamicShadowDiagnostics {
  // draftId — טיוטה / מזהה.
  draftId: string;
  // mode — מצב פעולה.
  mode: 'shadow';
  unfilledSlots: DynamicShadowDiagnosticSlot[];
}


/**
 * חוזה הנתונים DynamicShadowValidationAssignment: דינמי / טיוטות שיבוץ במנגנון הדינמי / אימות נתונים / הקצאה.
 */
export interface DynamicShadowValidationAssignment {
  // userId — מזהה משתמש.
  userId: string;
  // displayName — שם תצוגה.
  displayName: string;
  tier: 'required' | 'target_optional';
  // score — ניקוד.
  score: number;
  reasons: string[];
  // availabilityStatus — מצב הזמינות.
  availabilityStatus: 'available' | 'unavailable' | 'preferred' | 'avoid' | null;
}

/**
 * חוזה הנתונים DynamicShadowValidationLegacyAssignment: דינמי / טיוטות שיבוץ במנגנון הדינמי / אימות נתונים / הקצאה.
 */
export interface DynamicShadowValidationLegacyAssignment {
  // shiftId — מזהה המשמרת.
  shiftId: string;
  // userId — מזהה משתמש.
  userId: string | null;
  // displayName — שם תצוגה.
  displayName: string | null;
  isIntentionallyUnassigned: boolean;
}

/**
 * חוזה הנתונים DynamicShadowValidationSlot: דינמי / טיוטות שיבוץ במנגנון הדינמי / אימות נתונים.
 */
export interface DynamicShadowValidationSlot {
  // slotId — מזהה.
  slotId: string;
  // date — תאריך.
  date: string;
  // shiftCode — משמרת.
  shiftCode: string;
  // shiftName — משמרת / שם.
  shiftName: string;
  // startTime — שעת התחלה.
  startTime: string;
  // endTime — שעת סיום.
  endTime: string;
  // requiredWorkers — מספר העובדים הנדרש.
  requiredWorkers: number;
  // targetWorkers — יעד.
  targetWorkers: number;
  // dynamicAssignments — דינמי / הקצאות.
  dynamicAssignments: DynamicShadowValidationAssignment[];
  // legacyAssignment — הקצאה.
  legacyAssignment: DynamicShadowValidationLegacyAssignment | null;
  // comparisonStatus — סטטוס.
  comparisonStatus: 'match' | 'different' | 'legacy_missing_shift' | 'unsupported';
}

/**
 * חוזה הנתונים DynamicShadowValidationWorker: דינמי / טיוטות שיבוץ במנגנון הדינמי / אימות נתונים.
 */
export interface DynamicShadowValidationWorker {
  // userId — מזהה משתמש.
  userId: string;
  // displayName — שם תצוגה.
  displayName: string;
  minimum: number | null;
  // target — יעד.
  target: number | null;
  maximum: number | null;
  // proportionalTarget — יעד.
  proportionalTarget: number;
  assigned: number;
  // preferredAssignments — הקצאות.
  preferredAssignments: number;
  // avoidAssignments — הקצאות.
  avoidAssignments: number;
  underMinimum: boolean;
  // aboveTarget — יעד.
  aboveTarget: boolean;
  atOrAboveMaximum: boolean;
  employmentScope: 'full_time' | 'part_time' | null;
}

/**
 * חוזה הנתונים DynamicShadowValidationMetrics: דינמי / טיוטות שיבוץ במנגנון הדינמי / אימות נתונים.
 */
export interface DynamicShadowValidationMetrics {
  // totalSlots — סך הכול.
  totalSlots: number;
  coveredRequiredSlots: number;
  unfilledSlots: number;
  comparableSlots: number;
  matchingSlots: number;
  differentSlots: number;
  matchPercent: number | null;
  // preferredAssignments — הקצאות.
  preferredAssignments: number;
  // avoidAssignments — הקצאות.
  avoidAssignments: number;
  // underMinimumWorkers — מספר העובדים המזערי.
  underMinimumWorkers: number;
  // aboveTargetWorkers — יעד.
  aboveTargetWorkers: number;
}

/**
 * חוזה הנתונים DynamicShadowValidation: דינמי / טיוטות שיבוץ במנגנון הדינמי / אימות נתונים.
 */
export interface DynamicShadowValidation {
  // draftId — טיוטה / מזהה.
  draftId: string;
  // mode — מצב פעולה.
  mode: 'shadow';
  // jobTypeId — מזהה סוג התפקיד.
  jobTypeId: string;
  // jobTypeName — סוג תפקיד.
  jobTypeName: string;
  // year — שנה.
  year: number;
  // month — חודש.
  month: number;
  algorithm: string | null;
  legacySupported: boolean;
  legacyAvailable: boolean;
  // legacyNote — הערה.
  legacyNote: string | null;
  metrics: DynamicShadowValidationMetrics;
  workers: DynamicShadowValidationWorker[];
  slots: DynamicShadowValidationSlot[];
}

/**
 * חוזה הנתונים DynamicAvailabilityShadowSummary: דינמי / אילוצים וזמינות / טיוטות שיבוץ במנגנון הדינמי / סיכום.
 */
export interface DynamicAvailabilityShadowSummary {
  // jobTypeId — מזהה סוג התפקיד.
  jobTypeId: string;
  // jobTypeName — סוג תפקיד.
  jobTypeName: string;
  // availabilityConfig — אילוצים וזמינות / תצורה.
  availabilityConfig: DynamicAvailabilityConfig;
  // periodId — מזהה התקופה.
  periodId: string | null;
  materialized: boolean;
  // slotCount — כמות.
  slotCount: number;
  // memberCount — כמות.
  memberCount: number;
  // submissionCount — כמות.
  submissionCount: number;
  // mode — מצב פעולה.
  mode: 'shadow';
}

/**
 * חוזה הנתונים DynamicAvailabilityWorkspaceSlot: דינמי / אילוצים וזמינות.
 */
export interface DynamicAvailabilityWorkspaceSlot {
  // id — מזהה.
  id: string;
  // date — תאריך.
  date: string;
  // shiftCode — משמרת.
  shiftCode: string;
  // shiftName — משמרת / שם.
  shiftName: string;
  // startTime — שעת התחלה.
  startTime: string;
  // endTime — שעת סיום.
  endTime: string;
  // holidayName — חג / שם.
  holidayName: string | null;
  // sourceDayKind — מקור / יום.
  sourceDayKind: string;
  // effectiveDayKind — יום.
  effectiveDayKind: string | null;
  minWorkers: number;
  // targetWorkers — יעד.
  targetWorkers: number;
  maxWorkers: number;
}

/**
 * חוזה הנתונים DynamicAvailabilityWorkspaceEntry: דינמי / אילוצים וזמינות / רשומה.
 */
export interface DynamicAvailabilityWorkspaceEntry {
  // status — סטטוס.
  status: 'available' | 'unavailable' | 'preferred' | 'avoid';
  // note — הערה.
  note: string | null;
}

/**
 * חוזה הנתונים DynamicAvailabilityWorkspaceMember: דינמי / אילוצים וזמינות.
 */
export interface DynamicAvailabilityWorkspaceMember {
  // userId — מזהה משתמש.
  userId: string;
  // displayName — שם תצוגה.
  displayName: string;
  // isActive — האם הרשומה פעילה.
  isActive: boolean;
  // submissionId — מזהה.
  submissionId: string | null;
  // status — סטטוס.
  status: 'draft' | 'submitted' | 'reopened';
  minimum: number | null;
  // target — יעד.
  target: number | null;
  maximum: number | null;
  // targetUnlimited — יעד (אופציונלי).
  targetUnlimited?: boolean;
  // maxWeeklyShifts — שבועי / משמרות (אופציונלי).
  maxWeeklyShifts?: number | null;
  maxNights: number | null;
  maxWeekends: number | null;
  // maxHolidays — חגים.
  maxHolidays: number | null;
  // note — הערה.
  note: string | null;
  // entries — רשומות.
  entries: Record<string, DynamicAvailabilityWorkspaceEntry>;
}

/**
 * חוזה הנתונים DynamicAvailabilityWorkspace: דינמי / אילוצים וזמינות.
 */
export interface DynamicAvailabilityWorkspace {
  materialized: boolean;
  // mode — מצב פעולה.
  mode: 'shadow';
  // periodId — מזהה התקופה.
  periodId: string | null;
  // jobTypeId — מזהה סוג התפקיד.
  jobTypeId: string;
  // jobTypeName — סוג תפקיד.
  jobTypeName: string;
  // availabilityConfig — אילוצים וזמינות / תצורה.
  availabilityConfig: DynamicAvailabilityConfig;
  // schedulingConfig — תצורה (אופציונלי).
  schedulingConfig?: DynamicSchedulingConfig;
  slots: DynamicAvailabilityWorkspaceSlot[];
  // members — חברי התפקיד.
  members: DynamicAvailabilityWorkspaceMember[];
}

/**
 * חוזה הנתונים SaveDynamicAvailabilityShadowSubmissionInput: דינמי / אילוצים וזמינות / טיוטות שיבוץ במנגנון הדינמי / קלט.
 */
export interface SaveDynamicAvailabilityShadowSubmissionInput {
  // submissionStatus — מצב ההגשה.
  submissionStatus: 'draft' | 'submitted' | 'reopened';
  minimum: number | null;
  // target — יעד.
  target: number | null;
  maximum: number | null;
  // targetUnlimited — יעד (אופציונלי).
  targetUnlimited?: boolean;
  // maxWeeklyShifts — שבועי / משמרות (אופציונלי).
  maxWeeklyShifts?: number | null;
  maxNights: number | null;
  maxWeekends: number | null;
  // maxHolidays — חגים.
  maxHolidays: number | null;
  // note — הערה.
  note: string | null;
  // entries — רשומות.
  entries: Array<{
    // slotId — מזהה.
    slotId: string;
    // status — סטטוס.
    status: 'available' | 'unavailable' | 'preferred' | 'avoid';
    // note — הערה (אופציונלי).
    note?: string | null;
  }>;
}



/**
 * חוזה הנתונים DynamicAvailabilityReminderDelivery: דינמי / אילוצים וזמינות / תזכורות.
 */
export interface DynamicAvailabilityReminderDelivery {
  // daysBefore — ימים.
  daysBefore: number;
  sentAt: string | null;
  // recipientCount — כמות.
  recipientCount: number;
}

/**
 * חוזה הנתונים DynamicAvailabilityReminderSettings: דינמי / אילוצים וזמינות / תזכורות / הגדרות.
 */
export interface DynamicAvailabilityReminderSettings {
  // days — ימים.
  days: number[];
  deliveries: DynamicAvailabilityReminderDelivery[];
}

/**
 * חוזה הנתונים DynamicPeriodWorkflowState: דינמי / תקופה / תהליך עבודה / מצב.
 */
export interface DynamicPeriodWorkflowState {
  // jobTypeId — מזהה סוג התפקיד.
  jobTypeId: string;
  // jobTypeName — סוג תפקיד.
  jobTypeName: string;
  // year — שנה.
  year: number;
  // month — חודש.
  month: number;
  // memberCount — כמות.
  memberCount: number;
  // availabilityEnabled — אילוצים וזמינות / האם האפשרות מופעלת.
  availabilityEnabled: boolean;
  // schedulingStrategy — שיטת שיבוץ.
  schedulingStrategy: string;
  // permissions — הרשאות.
  permissions: Record<string, boolean>;
  // period — תקופה.
  period: null | {
    // id — מזהה.
    id: string;
    // status — סטטוס.
    status: 'shadow' | 'draft' | 'open' | 'closed' | 'archived';
    // title — כותרת.
    title: string;
    // submissionDeadline — מועד אחרון להגשת אילוצים.
    submissionDeadline: string | null;
    // slotCount — כמות.
    slotCount: number;
    // submissionCount — כמות.
    submissionCount: number;
    // submittedCount — הוגש / כמות.
    submittedCount: number;
  };
  // draft — טיוטה.
  draft: null | {
    // id — מזהה.
    id: string;
    // status — סטטוס.
    status: 'shadow' | 'generated' | 'incomplete' | 'failed';
    metrics: Record<string, unknown>;
    // createdAt — מועד יצירה.
    createdAt: string;
    // updatedAt — מועד עדכון.
    updatedAt: string;
  };
  publication: null | {
    // id — מזהה.
    id: string;
    // status — סטטוס.
    status: 'published' | 'archived';
    // publishedAt — פורסם.
    publishedAt: string;
    // assignmentCount — הקצאה / כמות.
    assignmentCount: number;
  };
}


/**
 * חוזה הנתונים DynamicPublishedEditorMember: דינמי / פורסם.
 */
export interface DynamicPublishedEditorMember {
  // userId — מזהה משתמש.
  userId: string;
  // displayName — שם תצוגה.
  displayName: string;
}

/**
 * חוזה הנתונים DynamicPublishedEditorCandidate: דינמי / פורסם.
 */
export interface DynamicPublishedEditorCandidate extends DynamicPublishedEditorMember {
  // availabilityStatus — מצב הזמינות.
  availabilityStatus: 'available' | 'unavailable' | 'preferred' | 'avoid' | null;
}

/**
 * חוזה הנתונים DynamicPublishedEditorAssignment: דינמי / פורסם / הקצאה.
 */
export interface DynamicPublishedEditorAssignment {
  // id — מזהה.
  id: string;
  // userId — מזהה משתמש.
  userId: string;
  // displayName — שם תצוגה.
  displayName: string;
  // userIsActive — האם הרשומה פעילה.
  userIsActive: boolean;
  // originalUserId — מזהה משתמש.
  originalUserId: string | null;
  // originalDisplayName — שם תצוגה.
  originalDisplayName: string | null;
  managerEdited: boolean;
  // managerOverrideNote — הערה.
  managerOverrideNote: string | null;
}

/**
 * חוזה הנתונים DynamicPublishedEditorSlot: דינמי / פורסם.
 */
export interface DynamicPublishedEditorSlot {
  // slotId — מזהה.
  slotId: string;
  // shiftDate — תאריך המשמרת.
  shiftDate: string;
  // shiftCode — משמרת.
  shiftCode: string;
  // shiftName — משמרת / שם.
  shiftName: string;
  // startTime — שעת התחלה.
  startTime: string;
  // endTime — שעת סיום.
  endTime: string;
  // intentionallyUnassignedCount — כמות.
  intentionallyUnassignedCount: number;
  // assignments — הקצאות.
  assignments: DynamicPublishedEditorAssignment[];
  candidates: DynamicPublishedEditorCandidate[];
}

/**
 * חוזה הנתונים DynamicPublishedEditorWorkspace: דינמי / פורסם.
 */
export interface DynamicPublishedEditorWorkspace {
  // publicationId — מזהה.
  publicationId: string;
  // jobTypeId — מזהה סוג התפקיד.
  jobTypeId: string;
  // jobTypeName — סוג תפקיד.
  jobTypeName: string;
  // year — שנה.
  year: number;
  // month — חודש.
  month: number;
  editable: boolean;
  editabilityReason: string | null;
  // members — חברי התפקיד.
  members: DynamicPublishedEditorMember[];
  slots: DynamicPublishedEditorSlot[];
}

/**
 * חוזה הנתונים DynamicHistoricalEditorAssignment: דינמי / נתונים היסטוריים / הקצאה.
 */
export interface DynamicHistoricalEditorAssignment {
  // id — מזהה.
  id: string;
  // userId — מזהה משתמש.
  userId: string | null;
  // displayName — שם תצוגה.
  displayName: string | null;
  // originalUserId — מזהה משתמש.
  originalUserId: string | null;
  // originalDisplayName — שם תצוגה.
  originalDisplayName: string | null;
  isIntentionallyUnassigned: boolean;
}

/**
 * חוזה הנתונים DynamicHistoricalSlotEditorWorkspace: דינמי / נתונים היסטוריים.
 */
export interface DynamicHistoricalSlotEditorWorkspace {
  // historicalPeriodId — מזהה התקופה.
  historicalPeriodId: string;
  // jobTypeId — מזהה סוג התפקיד.
  jobTypeId: string;
  // jobTypeName — סוג תפקיד.
  jobTypeName: string;
  // year — שנה.
  year: number;
  // month — חודש.
  month: number;
  editable: boolean;
  editabilityReason: string | null;
  // members — חברי התפקיד.
  members: DynamicPublishedEditorMember[];
  // assignments — הקצאות.
  assignments: DynamicHistoricalEditorAssignment[];
}

/**
 * חוזה הנתונים DynamicSchedulePublicationResult: דינמי / שיבוץ / תוצאה.
 */
export interface DynamicSchedulePublicationResult {
  // publicationId — מזהה.
  publicationId: string;
  // published — פורסם.
  published: boolean;
  // assignmentCount — הקצאה / כמות.
  assignmentCount: number;
}

/**
 * חוזה הנתונים DynamicAvailabilityLegacyComparison: דינמי / אילוצים וזמינות.
 */
export interface DynamicAvailabilityLegacyComparison {
  // mode — מצב פעולה.
  mode: 'shadow';
  supported: boolean;
  legacyRole: string | null;
  // note — הערה.
  note: string | null;
  // dynamic — דינמי.
  dynamic: { slots: number; members: number; entries: number };
  legacy: { slots: number; members: number; entries: number };
  slotDelta: number;
  memberDelta: number;
  // entryDelta — רשומה.
  entryDelta: number;
}


/**
 * חוזה הנתונים MyOnCallCoverageConflict: הנתון MyOnCallCoverageConflict בהקשר הפעולה.
 */
export interface MyOnCallCoverageConflict {
  // assignmentId — הקצאה / מזהה.
  assignmentId: string;
  // publicationId — מזהה.
  publicationId: string;
  // jobTypeId — מזהה סוג התפקיד.
  jobTypeId: string;
  // jobTypeName — סוג תפקיד.
  jobTypeName: string;
  // shiftDate — תאריך המשמרת.
  shiftDate: string;
  // shiftName — משמרת / שם.
  shiftName: string;
}

/**
 * חוזה הנתונים MyDynamicSchedulePeriod: תקופת שיבוץ.
 */
export interface MyDynamicSchedulePeriod {
  // publicationId — מזהה.
  publicationId: string;
  // periodSource — תקופה / מקור.
  periodSource: 'publication' | 'history';
  // jobTypeId — מזהה סוג התפקיד.
  jobTypeId: string;
  // jobTypeName — סוג תפקיד.
  jobTypeName: string;
  // year — שנה.
  year: number;
  // month — חודש.
  month: number;
  // status — סטטוס.
  status: 'published' | 'archived';
  // publishedAt — פורסם.
  publishedAt: string;
  // assignmentCount — הקצאה / כמות.
  assignmentCount: number;
  // workMode — מצב פעולה.
  workMode: DynamicWorkStructureMode;
  // scheduleChangeMode — שיבוץ / מצב פעולה.
  scheduleChangeMode: DynamicScheduleChangeMode;
}

/**
 * חוזה הנתונים MyDynamicScheduleAssignment: דינמי / שיבוץ / הקצאה.
 */
export interface MyDynamicScheduleAssignment {
  // id — מזהה.
  id: string;
  // shiftDate — תאריך המשמרת.
  shiftDate: string;
  // shiftCode — משמרת.
  shiftCode: string;
  // shiftName — משמרת / שם.
  shiftName: string;
  // startTime — שעת התחלה.
  startTime: string;
  // endTime — שעת סיום.
  endTime: string;
  // assignmentTier — הקצאה.
  assignmentTier: string;
  managerEdited: boolean;
  // managerOverrideNote — הערה.
  managerOverrideNote: string | null;
  // holidayName — חג / שם.
  holidayName: string | null;
  // sourceDayKind — מקור / יום.
  sourceDayKind: string | null;
  contains200Percent: boolean;
  // premium200Hours — שעות.
  premium200Hours: number;
  // userId — מזהה משתמש.
  userId: string | null;
  // displayName — שם תצוגה.
  displayName: string | null;
  isMine: boolean;
}

/**
 * חוזה הנתונים MyDynamicScheduleWorkspace: דינמי / שיבוץ.
 */
export interface MyDynamicScheduleWorkspace {
  // publicationId — מזהה.
  publicationId: string;
  // periodSource — תקופה / מקור.
  periodSource: 'publication' | 'history';
  readOnly: boolean;
  // jobTypeId — מזהה סוג התפקיד.
  jobTypeId: string;
  // jobTypeName — סוג תפקיד.
  jobTypeName: string;
  // year — שנה.
  year: number;
  // month — חודש.
  month: number;
  // status — סטטוס.
  status: 'published' | 'archived';
  // publishedAt — פורסם.
  publishedAt: string;
  // workMode — מצב פעולה.
  workMode: DynamicWorkStructureMode;
  // scheduleChangeMode — שיבוץ / מצב פעולה.
  scheduleChangeMode: DynamicScheduleChangeMode;
  // canViewOthers — האם צפייה מותרת.
  canViewOthers: boolean;
  // assignments — הקצאות.
  assignments: MyDynamicScheduleAssignment[];
}

/**
 * חוזה הנתונים DynamicSelfEditMember: דינמי.
 */
export interface DynamicSelfEditMember {
  // userId — מזהה משתמש.
  userId: string;
  // displayName — שם תצוגה.
  displayName: string;
}

/**
 * חוזה הנתונים DynamicSelfEditCandidate: דינמי.
 */
export interface DynamicSelfEditCandidate extends DynamicSelfEditMember {
  // availabilityStatus — מצב הזמינות.
  availabilityStatus: 'available' | 'unavailable' | 'preferred' | 'avoid' | null;
}

/**
 * חוזה הנתונים DynamicSelfEditAssignment: דינמי / הקצאה.
 */
export interface DynamicSelfEditAssignment {
  // id — מזהה.
  id: string;
  // shiftDate — תאריך המשמרת.
  shiftDate: string;
  // shiftCode — משמרת.
  shiftCode: string;
  // shiftName — משמרת / שם.
  shiftName: string;
  // startTime — שעת התחלה.
  startTime: string;
  // endTime — שעת סיום.
  endTime: string;
  // userId — מזהה משתמש.
  userId: string;
  // displayName — שם תצוגה.
  displayName: string;
  isMine: boolean;
  // userEditedBy — משתמש.
  userEditedBy: string | null;
  // userEditedAt — משתמש.
  userEditedAt: string | null;
  candidates: DynamicSelfEditCandidate[];
}

/**
 * חוזה הנתונים DynamicSelfEditWorkspace: דינמי.
 */
export interface DynamicSelfEditWorkspace {
  // publicationId — מזהה.
  publicationId: string;
  // jobTypeId — מזהה סוג התפקיד.
  jobTypeId: string;
  // jobTypeName — סוג תפקיד.
  jobTypeName: string;
  // year — שנה.
  year: number;
  // month — חודש.
  month: number;
  editable: boolean;
  editabilityReason: string | null;
  // canViewOthers — האם צפייה מותרת.
  canViewOthers: boolean;
  // canEditAll — האם עריכה מותרת.
  canEditAll: boolean;
  // members — חברי התפקיד.
  members: DynamicSelfEditMember[];
  // assignments — הקצאות.
  assignments: DynamicSelfEditAssignment[];
}
/**
 * חוזה הנתונים MyDynamicAvailabilityPeriod: תקופת אילוצים.
 */
export interface MyDynamicAvailabilityPeriod {
  // jobTypeId — מזהה סוג התפקיד.
  jobTypeId: string;
  // jobTypeName — סוג תפקיד.
  jobTypeName: string;
  // year — שנה.
  year: number;
  // month — חודש.
  month: number;
  // periodId — מזהה התקופה.
  periodId: string;
  // periodStatus — תקופה / סטטוס.
  periodStatus: 'open' | 'closed' | 'archived' | 'shadow' | 'draft';
  // submissionDeadline — מועד אחרון להגשת אילוצים.
  submissionDeadline: string | null;
  // slotCount — כמות.
  slotCount: number;
  // submissionStatus — מצב ההגשה.
  submissionStatus: 'draft' | 'submitted' | 'reopened' | null;
  // submittedAt — הוגש.
  submittedAt: string | null;
  // filledCount — כמות.
  filledCount: number;
}

/**
 * חוזה הנתונים DynamicDraftEditorCandidate: דינמי / טיוטה.
 */
export interface DynamicDraftEditorCandidate {
  // userId — מזהה משתמש.
  userId: string;
  // displayName — שם תצוגה.
  displayName: string;
  // availabilityStatus — מצב הזמינות.
  availabilityStatus: 'available' | 'unavailable' | 'preferred' | 'avoid' | null;
  // assignedCount — כמות.
  assignedCount: number;
  maximum: number | null;
  isAssignedHere: boolean;
}

/**
 * חוזה הנתונים DynamicDraftEditorAssignment: דינמי / טיוטה / הקצאה.
 */
export interface DynamicDraftEditorAssignment {
  // id — מזהה.
  id: string;
  // userId — מזהה משתמש.
  userId: string;
  // displayName — שם תצוגה.
  displayName: string;
  // engineUserId — מזהה משתמש.
  engineUserId: string | null;
  // engineDisplayName — שם תצוגה.
  engineDisplayName: string | null;
  tier: 'required' | 'target_optional';
  // score — ניקוד.
  score: number;
  reasons: unknown[];
  managerEdited: boolean;
  // managerOverrideNote — הערה.
  managerOverrideNote: string | null;
}

/**
 * חוזה הנתונים DynamicDraftEditorSlot: דינמי / טיוטה.
 */
export interface DynamicDraftEditorSlot {
  // slotId — מזהה.
  slotId: string;
  // date — תאריך.
  date: string;
  // shiftCode — משמרת.
  shiftCode: string;
  // shiftName — משמרת / שם.
  shiftName: string;
  // startTime — שעת התחלה.
  startTime: string;
  // endTime — שעת סיום.
  endTime: string;
  hours200Percent: number;
  minWorkers: number;
  // targetWorkers — יעד.
  targetWorkers: number;
  maxWorkers: number;
  // intentionallyUnassignedCount — כמות.
  intentionallyUnassignedCount: number;
  // overrideNote — הערה.
  overrideNote: string | null;
  // assignments — הקצאות.
  assignments: DynamicDraftEditorAssignment[];
  candidates: DynamicDraftEditorCandidate[];
}

/**
 * חוזה הנתונים DynamicDraftMemberPreference: דינמי / טיוטה.
 */
export interface DynamicDraftMemberPreference {
  // userId — מזהה משתמש.
  userId: string;
  // monthlyTarget — יעד.
  monthlyTarget: number | null;
  monthlyUnlimited?: boolean;
  // weeklyMaximum — שבועי.
  weeklyMaximum: number | null;
  // monthlyEnabled — האם האפשרות מופעלת.
  monthlyEnabled: boolean;
  // weeklyEnabled — שבועי / האם האפשרות מופעלת.
  weeklyEnabled: boolean;
  hasSubmission: boolean;
}

/**
 * חוזה הנתונים DynamicDraftEditorWorkspace: דינמי / טיוטה.
 */
export interface DynamicDraftEditorWorkspace {
  // draftId — טיוטה / מזהה.
  draftId: string;
  // jobTypeId — מזהה סוג התפקיד.
  jobTypeId: string;
  // jobTypeName — סוג תפקיד.
  jobTypeName: string;
  // year — שנה.
  year: number;
  // month — חודש.
  month: number;
  // status — סטטוס.
  status: 'generated' | 'incomplete';
  metrics: Record<string, unknown>;
  slots: DynamicDraftEditorSlot[];
}

/**
 * טיפוס DynamicShiftExchangeType: החלפת משמרות.
 */
export type DynamicShiftExchangeType = 'one_way' | 'two_way';
/**
 * טיפוס DynamicShiftExchangeStatus: החלפת משמרות.
 */
export type DynamicShiftExchangeStatus =
  | 'pending_counterparty'
  | 'pending_manager'
  | 'approved'
  | 'rejected_by_counterparty'
  | 'rejected_by_manager'
  | 'cancelled'
  | 'expired';

/**
 * חוזה הנתונים DynamicShiftExchangeShiftOption: החלפת משמרות.
 */
export interface DynamicShiftExchangeShiftOption {
  // id — מזהה.
  id: string;
  // publicationId — מזהה.
  publicationId: string;
  // jobTypeId — מזהה סוג התפקיד.
  jobTypeId: string;
  // jobTypeName — סוג תפקיד.
  jobTypeName: string;
  // assignedUserId — מזהה העובד המשובץ (אופציונלי).
  assignedUserId?: string;
  // shiftDate — תאריך המשמרת.
  shiftDate: string;
  // shiftCode — משמרת.
  shiftCode: string;
  // shiftName — משמרת / שם.
  shiftName: string;
  // startTime — שעת התחלה.
  startTime: string;
  // endTime — שעת סיום.
  endTime: string;
  // year — שנה.
  year: number;
  // month — חודש.
  month: number;
}

/**
 * חוזה הנתונים DynamicShiftExchangeMemberOption: החלפת משמרות.
 */
export interface DynamicShiftExchangeMemberOption {
  // userId — מזהה משתמש.
  userId: string;
  // displayName — שם תצוגה.
  displayName: string;
  // jobTypeId — מזהה סוג התפקיד.
  jobTypeId: string;
}

/**
 * חוזה הנתונים DynamicShiftExchangeOptions: החלפת משמרות.
 */
export interface DynamicShiftExchangeOptions {
  // hasDynamicShiftExchange — החלפת משמרות.
  hasDynamicShiftExchange: boolean;
  publications: Array<{
    // publicationId — מזהה.
    publicationId: string;
    // jobTypeId — מזהה סוג התפקיד.
    jobTypeId: string;
    // jobTypeName — סוג תפקיד.
    jobTypeName: string;
    // year — שנה.
    year: number;
    // month — חודש.
    month: number;
  }>;
  // myShifts — משמרות.
  myShifts: DynamicShiftExchangeShiftOption[];
  // members — חברי התפקיד.
  members: DynamicShiftExchangeMemberOption[];
  // counterpartyShifts — משמרות.
  counterpartyShifts: DynamicShiftExchangeShiftOption[];
}

/**
 * חוזה הנתונים DynamicShiftExchangeRequest: החלפת משמרות.
 */
export interface DynamicShiftExchangeRequest {
  // id — מזהה.
  id: string;
  // publicationId — מזהה.
  publicationId: string;
  // jobTypeId — מזהה סוג התפקיד.
  jobTypeId: string;
  // jobTypeName — סוג תפקיד.
  jobTypeName: string;
  swapType: DynamicShiftExchangeType;
  // status — סטטוס.
  status: DynamicShiftExchangeStatus;
  // requesterUserId — מזהה משתמש.
  requesterUserId: string;
  // requesterName — שם.
  requesterName: string;
  // counterpartyUserId — מזהה משתמש.
  counterpartyUserId: string;
  // counterpartyName — שם.
  counterpartyName: string;
  // requesterAssignmentId — הקצאה / מזהה.
  requesterAssignmentId: string;
  // requesterShiftDate — תאריך המשמרת.
  requesterShiftDate: string;
  // requesterShiftName — משמרת / שם.
  requesterShiftName: string;
  // requesterStartTime — שעת התחלה.
  requesterStartTime: string;
  // requesterEndTime — שעת סיום.
  requesterEndTime: string;
  // counterpartyAssignmentId — הקצאה / מזהה.
  counterpartyAssignmentId: string | null;
  // counterpartyShiftDate — תאריך המשמרת.
  counterpartyShiftDate: string | null;
  // counterpartyShiftName — משמרת / שם.
  counterpartyShiftName: string | null;
  // counterpartyStartTime — שעת התחלה.
  counterpartyStartTime: string | null;
  // counterpartyEndTime — שעת סיום.
  counterpartyEndTime: string | null;
  rejectionReason: string | null;
  counterpartyRespondedAt: string | null;
  managerReviewedAt: string | null;
  // managerUserId — מזהה משתמש.
  managerUserId: string | null;
  // createdAt — מועד יצירה.
  createdAt: string;
  // updatedAt — מועד עדכון.
  updatedAt: string;
}
