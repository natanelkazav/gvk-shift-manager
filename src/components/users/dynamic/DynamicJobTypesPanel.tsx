import {
  Bot,
  BriefcaseBusiness,
  DatabaseBackup,
  ChevronDown,
  ChevronUp,
  LoaderCircle,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Snowflake,
  PlayCircle,
  Trash2,
  Settings2,
  FlaskConical,
  ShieldCheck,
  LayoutDashboard,
  UsersRound,
} from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { dynamicSchedulingService } from '../../../services/dynamicSchedulingService';
import { dynamicPermissionEngineService } from '../../../services/dynamicPermissionEngineService';
import type {
  DynamicJobType,
  DynamicSchedulingAdminData,
  EmploymentScope,
  JobPayModel,
  SaveDynamicJobTypeInput,
  DynamicSchedulingConfig,
  DynamicSchedulingStrategy,
  DynamicShiftPatternDefinition,
  DynamicWorkDayDefinition,
  DynamicWorkStructureMode,
  DynamicScheduleChangeMode,
  DynamicMembershipAdminData,
  DynamicMembershipAdminUser,
  DynamicMemberEmploymentScope,
  DynamicLegacySourceKind,
  DynamicLegacyImportPreview,
} from '../../../types/dynamicScheduling';
import DynamicSchedulingShadowTester from './DynamicSchedulingShadowTester';
import DynamicRoleWorkspaceModal from './DynamicRoleWorkspaceModal';
import { dailyReportService } from '../../../services/dailyReportService';
import type { DailyReportAdminUser } from '../../../types/dailyReports';
import { Button, Input, Modal, Textarea } from '../../ui';

interface DynamicJobTypesPanelProps {
  canManage: boolean;
}



const employmentScopeLabels: Record<EmploymentScope, string> = {
  full_time: 'משרה מלאה',
  part_time: 'משרה חלקית',
  flexible: 'גמיש',
};

const payModelLabels: Record<JobPayModel, string> = {
  hourly: 'שעתי',
  per_shift: 'פר משמרת',
  per_day: 'פר יום / כוננות',
  mixed: 'משולב',
  none: 'ללא חישוב',
};

const schedulingStrategyLabels: Record<DynamicSchedulingStrategy, string> = {
  none: 'ללא שיבוצים',
  availability_optimizer: 'אילוצים + אופטימיזציה חודשית',
  monthly_rotation_constraints: 'סבב חודשי + אילוצים',
};

const getIsraelMonth = (offsetMonths = 0): { year: number; month: number } => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jerusalem',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(new Date());
  const year = Number(parts.find((part) => part.type === 'year')?.value);
  const month = Number(parts.find((part) => part.type === 'month')?.value);
  const shifted = new Date(Date.UTC(year, month - 1 + offsetMonths, 1));
  return { year: shifted.getUTCFullYear(), month: shifted.getUTCMonth() + 1 };
};

const defaultSchedulingConfig = (): DynamicSchedulingConfig => ({
  scheduleChangeMode: 'none',
  attendance: { enabled: false, requireLocation: true, workplaceName: '', latitude: null, longitude: null, radiusMeters: 150, outsidePolicy: 'flag', allowUnscheduled: false },
  dailyReports: { enabled: false, recipientUserIds: [], allowAddSubjects: true, allowAddCustomers: true, allowAttachments: true },
  minimumMode: 'soft',
  maximumMode: 'hard',
  proportionalFairness: true,
  rules: {
    noOverlap: { enabled: true, severity: 'hard' },
    noConsecutive: { enabled: true, severity: 'hard' },
    minimumRestMinutes: { enabled: false, severity: 'hard', value: 0 },
    maxShiftsPerDay: { enabled: true, severity: 'hard', value: 1 },
    balanceNights: { enabled: true, severity: 'soft', weight: 60 },
    balanceWeekends: { enabled: true, severity: 'soft', weight: 50 },
    balanceHolidays: { enabled: true, severity: 'soft', weight: 50 },
  },
  employmentDefinition: {
    fullTimeDays: [0, 1, 2, 3, 4],
    partTimeDays: [],
    partTimeStartTime: '08:00',
    partTimeEndTime: '17:00',
  },
  shiftPattern: {
    enabled: true,
    workMode: 'shifts',
    dailyOnCallWindow: { startTime: '00:00', endTime: '00:00' },
    weekday: { works: true, shifts: [{ id: 'weekday-1', name: 'משמרת 1', startTime: '08:00', endTime: '17:00', contains200Percent: false, premium200Hours: 0 }] },
    friday: { works: true, shifts: [{ id: 'friday-1', name: 'משמרת 1', startTime: '08:00', endTime: '14:00', contains200Percent: false, premium200Hours: 0 }], applyToHolidayEve: false },
    saturday: { works: false, shifts: [], applyToHolidayEnd: false },
    holiday: { works: false, shifts: [] },
  },
  weights: { coverage: 1000, proportionalFairness: 100, preference: 30, targetOptional: 15 },
});

const makeWorkShift = (prefix: string, index: number) => ({
  id: `${prefix}-${Date.now()}-${index}`,
  name: `משמרת ${index + 1}`,
  startTime: '08:00',
  endTime: '17:00',
  contains200Percent: false,
  premium200Hours: 0,
});

const getShiftDurationHours = (startTime: string, endTime: string): number => {
  const [startHour = 0, startMinute = 0] = startTime.split(':').map(Number);
  const [endHour = 0, endMinute = 0] = endTime.split(':').map(Number);
  const start = startHour * 60 + startMinute;
  let end = endHour * 60 + endMinute;
  if (end <= start) end += 24 * 60;
  return Math.max(0, (end - start) / 60);
};

const normalizeWorkDay = (
  dayKey: 'weekday' | 'friday' | 'saturday' | 'holiday',
  value: unknown,
): DynamicWorkDayDefinition => {
  const source = (value ?? {}) as Record<string, unknown>;
  if (typeof source.works === 'boolean' && Array.isArray(source.shifts)) {
    return {
      works: source.works,
      applyToHolidayEve: dayKey === 'friday' ? source.applyToHolidayEve === true : undefined,
      applyToHolidayEnd: dayKey === 'saturday' ? source.applyToHolidayEnd === true : undefined,
      shifts: source.shifts.map((item, index) => {
        const shift = (item ?? {}) as Record<string, unknown>;
        return {
          id: String(shift.id ?? `${dayKey}-${index + 1}`),
          name: String(shift.name ?? `משמרת ${index + 1}`),
          startTime: String(shift.startTime ?? '08:00'),
          endTime: String(shift.endTime ?? '17:00'),
          contains200Percent: shift.contains200Percent === true,
          premium200Hours: Number.isFinite(Number(shift.premium200Hours)) ? Math.max(0, Number(shift.premium200Hours)) : 0,
        };
      }),
    };
  }

  // Backward compatibility with Phase 8.2A, which stored one start/end range per day.
  if (source.startTime || source.endTime) {
    return {
      works: true,
      shifts: [{
        id: `${dayKey}-1`,
        name: 'משמרת 1',
        startTime: String(source.startTime ?? '08:00'),
        endTime: String(source.endTime ?? '17:00'),
        contains200Percent: false,
        premium200Hours: 0,
      }],
    };
  }

  return {
    works: dayKey === 'weekday' || dayKey === 'friday',
    shifts: [],
    applyToHolidayEve: dayKey === 'friday' ? false : undefined,
    applyToHolidayEnd: dayKey === 'saturday' ? false : undefined,
  };
};

const normalizeShiftPattern = (value: unknown): DynamicShiftPatternDefinition => {
  const source = (value ?? {}) as Record<string, unknown>;
  return {
    enabled: source.enabled !== false,
    workMode:
      source.workMode === 'on_call_daily'
        ? 'on_call_daily'
        : source.workMode === 'on_call_hourly' || source.workMode === 'on_call'
          ? 'on_call_hourly'
          : 'shifts',
    dailyOnCallWindow: {
      startTime:
        typeof (source.dailyOnCallWindow as Record<string, unknown> | undefined)?.startTime === 'string'
          ? String((source.dailyOnCallWindow as Record<string, unknown>).startTime)
          : '00:00',
      endTime:
        typeof (source.dailyOnCallWindow as Record<string, unknown> | undefined)?.endTime === 'string'
          ? String((source.dailyOnCallWindow as Record<string, unknown>).endTime)
          : '00:00',
    },
    weekday: normalizeWorkDay('weekday', source.weekday),
    friday: normalizeWorkDay('friday', source.friday),
    saturday: normalizeWorkDay('saturday', source.saturday),
    holiday: normalizeWorkDay('holiday', source.holiday),
  };
};

const emptyForm = (scheduleGroupId: string): SaveDynamicJobTypeInput => ({
  scheduleGroupId,
  code: '',
  name: '',
  description: '',
  isActive: true,
  employmentScope: 'flexible',
  payModel: 'none',
  payConfig: {},
  availabilityConfig: {
    enabled: false,
    statuses: ['available', 'unavailable'],
    allowNotes: true,
    monthlyCapacity: {
      enabled: false,
      minEnabled: false,
      targetEnabled: true,
      maxEnabled: true,
      defaultMin: null,
      defaultTarget: null,
      defaultMax: null,
    },
    limits: {
      maxNightsEnabled: false,
      defaultMaxNights: null,
      maxWeekendsEnabled: false,
      defaultMaxWeekends: null,
      maxHolidaysEnabled: false,
      defaultMaxHolidays: null,
    },
  },
  schedulingStrategy: 'availability_optimizer',
  schedulingConfig: defaultSchedulingConfig(),
  statisticsConfig: {
    enabled: true,
  },
  capabilities: ['statistics'],
  defaultPermissions: [],
});

const toForm = (jobType: DynamicJobType): SaveDynamicJobTypeInput => ({
  id: jobType.id,
  legacyRole: jobType.legacyRole,
  scheduleGroupId: jobType.scheduleGroupId,
  code: jobType.code,
  name: jobType.name,
  description: jobType.description,
  isActive: jobType.isActive,
  employmentScope: jobType.employmentScope,
  payModel: jobType.payModel,
  payConfig: jobType.payConfig,
  availabilityConfig: {
    enabled: Boolean(jobType.availabilityConfig?.enabled),
    statuses: jobType.availabilityConfig?.statuses?.length
      ? jobType.availabilityConfig.statuses
      : ['available', 'unavailable'],
    allowNotes: jobType.availabilityConfig?.allowNotes ?? true,
    monthlyCapacity: {
      enabled: jobType.availabilityConfig?.monthlyCapacity?.enabled ?? false,
      minEnabled: jobType.availabilityConfig?.monthlyCapacity?.minEnabled ?? false,
      targetEnabled: jobType.availabilityConfig?.monthlyCapacity?.targetEnabled ?? true,
      maxEnabled: jobType.availabilityConfig?.monthlyCapacity?.maxEnabled ?? true,
      defaultMin: jobType.availabilityConfig?.monthlyCapacity?.defaultMin ?? null,
      defaultTarget: jobType.availabilityConfig?.monthlyCapacity?.defaultTarget ?? null,
      defaultMax: jobType.availabilityConfig?.monthlyCapacity?.defaultMax ?? null,
    },
    limits: {
      maxNightsEnabled: jobType.availabilityConfig?.limits?.maxNightsEnabled ?? false,
      defaultMaxNights: jobType.availabilityConfig?.limits?.defaultMaxNights ?? null,
      maxWeekendsEnabled: jobType.availabilityConfig?.limits?.maxWeekendsEnabled ?? false,
      defaultMaxWeekends: jobType.availabilityConfig?.limits?.defaultMaxWeekends ?? null,
      maxHolidaysEnabled: jobType.availabilityConfig?.limits?.maxHolidaysEnabled ?? false,
      defaultMaxHolidays: jobType.availabilityConfig?.limits?.defaultMaxHolidays ?? null,
    },
  },
  schedulingStrategy: jobType.schedulingStrategy ?? 'availability_optimizer',
  schedulingConfig: {
    ...(jobType.schedulingConfig ?? defaultSchedulingConfig()),
    scheduleChangeMode: jobType.schedulingConfig?.scheduleChangeMode ?? 'none',
    shiftPattern: normalizeShiftPattern(jobType.schedulingConfig?.shiftPattern),
  },
  statisticsConfig: jobType.statisticsConfig,
  capabilities: jobType.capabilities,
  defaultPermissions: jobType.defaultPermissions,
});

const deriveAutomaticCapabilities = (input: SaveDynamicJobTypeInput): string[] => {
  const capabilities = new Set(input.capabilities);

  if (input.schedulingStrategy !== 'none') {
    capabilities.add('schedule');
    if (input.availabilityConfig.enabled) capabilities.add('availability');
  } else {
    capabilities.delete('schedule');
    capabilities.delete('availability');
    capabilities.delete('shift_exchange');
    capabilities.delete('self_edit');
    capabilities.delete('self_schedule_edit');
    capabilities.delete('monthly_rotation');
    capabilities.delete('schedule_publication_notifications');
  }

  if (input.statisticsConfig.enabled) capabilities.add('statistics');
  if (input.schedulingConfig.dailyReports?.enabled) capabilities.add('daily_reports');
  else capabilities.delete('daily_reports');
  if (input.schedulingConfig.attendance?.enabled) capabilities.add('attendance');
  else capabilities.delete('attendance');
  if (input.payModel !== 'none') capabilities.add('payroll');
  if (input.schedulingStrategy !== 'none' && input.availabilityConfig.monthlyCapacity.enabled) capabilities.add('monthly_shift_capacity');
  if (input.schedulingStrategy !== 'none') capabilities.add('schedule_publication_notifications');
  else {
    capabilities.delete('monthly_shift_capacity');
    capabilities.delete('schedule_publication_notifications');
  }

  // Operational schedule-change capabilities are mutually exclusive and role-driven.
  capabilities.delete('shift_exchange');
  capabilities.delete('self_schedule_edit');
  if (input.schedulingConfig.scheduleChangeMode === 'shift_exchange') capabilities.add('shift_exchange');
  if (input.schedulingConfig.scheduleChangeMode === 'self_edit') capabilities.add('self_schedule_edit');

  return Array.from(capabilities);
};


type PermissionBlueprintItem = {
  permissionKey: string;
  featureKey: string;
  audience: 'member' | 'manager';
  label: string;
  description: string;
  defaultEnabled?: boolean;
};

const permissionFeatureLabels: Record<string, string> = {
  schedule: 'שיבוץ ולוחות',
  availability: 'אילוצים',
  shift_exchange: 'חילופי משמרות',
  self_edit: 'עריכה עצמית',
  monthly_rotation: 'סבב חודשי',
  statistics: 'סטטיסטיקות',
  payroll: 'שכר',
  daily_reports: 'דיווח עבודה יומי',
  attendance: 'נוכחות ושעון עבודה',
};

const permissionBlueprint: PermissionBlueprintItem[] = [
  { permissionKey: 'schedule.view_own', featureKey: 'schedule', audience: 'member', label: 'צפייה במשמרות שלי', description: 'צפייה בלוח האישי של התפקיד.' },
  { permissionKey: 'schedule.view_others', featureKey: 'schedule', audience: 'member', label: 'הצגת משמרות/כוננויות של משתמשים אחרים', description: 'מאפשר לעובד לראות בלוח החודשי וברשימה את השיבוצים של עובדים אחרים באותו תפקיד.', defaultEnabled: false },
  { permissionKey: 'schedule.edit_all', featureKey: 'schedule', audience: 'member', label: 'עריכת כל המשמרות/כוננויות בתפקיד', description: 'מאפשר לעובד לערוך שיבוץ של כל עובד בתפקיד. עריכת שיבוץ אישי בלבד נשלטת בנפרד על ידי „עריכת השיבוץ שלי”.', defaultEnabled: false },
  { permissionKey: 'schedule.view_team', featureKey: 'schedule', audience: 'manager', label: 'צפייה בלוח התפקיד', description: 'צפייה בכל השיבוצים של התפקיד.' },
  { permissionKey: 'schedule.create_draft', featureKey: 'schedule', audience: 'manager', label: 'יצירת טיוטת שיבוץ', description: 'יצירת טיוטה חדשה לתקופה.' },
  { permissionKey: 'schedule.edit_draft', featureKey: 'schedule', audience: 'manager', label: 'עריכת טיוטת שיבוץ', description: 'עריכת הקצאות לפני פרסום.' },
  { permissionKey: 'schedule.publish', featureKey: 'schedule', audience: 'manager', label: 'פרסום שיבוץ', description: 'פרסום הלוח לעובדי התפקיד.' },
  { permissionKey: 'schedule.edit_published', featureKey: 'schedule', audience: 'manager', label: 'עריכת לוח שפורסם', description: 'תיקון שיבוץ לאחר פרסום.' },
  { permissionKey: 'schedule.edit_history', featureKey: 'schedule', audience: 'manager', label: 'עריכת שיבוצי עבר', description: 'תיקון שיבוצים בחודשים היסטוריים שיובאו, תוך שמירת תיעוד מלא ביומן המערכת.', defaultEnabled: false },
  { permissionKey: 'availability.view_own', featureKey: 'availability', audience: 'member', label: 'צפייה באילוצים שלי', description: 'צפייה באילוצים האישיים.' },
  { permissionKey: 'availability.submit_own', featureKey: 'availability', audience: 'member', label: 'הגשת אילוצים', description: 'הגשת אילוצים לתקופה פתוחה.' },
  { permissionKey: 'availability.edit_own', featureKey: 'availability', audience: 'member', label: 'עריכת אילוצים בזמן פתוח', description: 'שינוי אילוצים כל עוד התקופה פתוחה.' },
  { permissionKey: 'availability.view_team', featureKey: 'availability', audience: 'manager', label: 'צפייה באילוצי התפקיד', description: 'צפייה בהגשות של עובדי התפקיד.' },
  { permissionKey: 'availability.open_period', featureKey: 'availability', audience: 'manager', label: 'פתיחת תקופת אילוצים', description: 'פתיחת איסוף אילוצים.' },
  { permissionKey: 'availability.close_period', featureKey: 'availability', audience: 'manager', label: 'סגירת תקופת אילוצים', description: 'סגירת התקופה לפני שיבוץ.' },
  { permissionKey: 'availability.manage_submissions', featureKey: 'availability', audience: 'manager', label: 'ניהול הגשות אילוצים', description: 'טיפול בהגשות וחוסרים.' },
  { permissionKey: 'shift_exchange.request', featureKey: 'shift_exchange', audience: 'member', label: 'בקשת חילוף משמרת', description: 'פתיחת בקשת חילוף.' },
  { permissionKey: 'shift_exchange.respond', featureKey: 'shift_exchange', audience: 'member', label: 'תגובה לבקשת חילוף', description: 'אישור או דחייה כצד שני.' },
  { permissionKey: 'shift_exchange.review', featureKey: 'shift_exchange', audience: 'manager', label: 'צפייה בבקשות חילוף', description: 'צפייה בבקשות שממתינות לאישור.' },
  { permissionKey: 'shift_exchange.approve', featureKey: 'shift_exchange', audience: 'manager', label: 'אישור חילופי משמרות', description: 'אישור או דחייה סופיים.' },
  { permissionKey: 'schedule.self_edit', featureKey: 'self_edit', audience: 'member', label: 'עריכת השיבוץ שלי', description: 'שינוי שיבוץ אישי לפי מדיניות התפקיד.' },
  { permissionKey: 'rotation.generate', featureKey: 'monthly_rotation', audience: 'manager', label: 'יצירת סבב חודשי', description: 'יצירת טיוטה לפי מנגנון הסבב.' },
  { permissionKey: 'statistics.view_job_type', featureKey: 'statistics', audience: 'manager', label: 'צפייה בסטטיסטיקות התפקיד', description: 'צפייה בדוחות התפקיד.' },
  { permissionKey: 'payroll.view_job_type', featureKey: 'payroll', audience: 'manager', label: 'צפייה בנתוני שכר התפקיד', description: 'צפייה בנתוני השכר של התפקיד.' },
  { permissionKey: 'attendance.clock', featureKey: 'attendance', audience: 'member', label: 'דיווח כניסה ויציאה', description: 'דיווח נוכחות עם מיקום בעת הלחיצה.', defaultEnabled: true },
  { permissionKey: 'attendance.view_team', featureKey: 'attendance', audience: 'manager', label: 'צפייה בנוכחות התפקיד', description: 'צפייה בדוחות נוכחות, שעות ומיקומי כניסה/יציאה.', defaultEnabled: true },
  { permissionKey: 'attendance.edit_team', featureKey: 'attendance', audience: 'manager', label: 'עריכת נוכחות התפקיד', description: 'תיקון זמני כניסה ויציאה של עובדי התפקיד עם Audit Log.', defaultEnabled: false },
  { permissionKey: 'attendance.edit_archived', featureKey: 'attendance', audience: 'manager', label: 'עריכת נוכחות בארכיון', description: 'תיקון חריג של דיווחי נוכחות מחודשים קודמים.', defaultEnabled: false },
];

const derivePermissionFeatures = (input: SaveDynamicJobTypeInput): string[] => {
  const features = new Set<string>();
  if (input.schedulingStrategy !== 'none') {
    features.add('schedule');
    if (input.availabilityConfig.enabled) features.add('availability');
  }
  if (input.schedulingConfig.scheduleChangeMode === 'shift_exchange') features.add('shift_exchange');
  if (input.schedulingConfig.scheduleChangeMode === 'self_edit') features.add('self_edit');
  if (input.schedulingStrategy === 'monthly_rotation_constraints') features.add('monthly_rotation');
  if (input.statisticsConfig.enabled) features.add('statistics');
  if (input.payModel !== 'none') features.add('payroll');
  if (input.schedulingConfig.dailyReports?.enabled) features.add('daily_reports');
  return Array.from(features);
};

const derivePermissionBlueprint = (input: SaveDynamicJobTypeInput): PermissionBlueprintItem[] => {
  const features = new Set(derivePermissionFeatures(input));
  return permissionBlueprint.filter((item) => features.has(item.featureKey));
};

function DynamicJobTypesPanel({ canManage }: DynamicJobTypesPanelProps) {
  const [state, setState] = useState<{
    isLoading: boolean;
    data: DynamicSchedulingAdminData | null;
    error: string | null;
  }>({
    isLoading: true,
    data: null,
    error: null,
  });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState<SaveDynamicJobTypeInput | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [effectiveTiming, setEffectiveTiming] = useState<'current' | 'next'>('current');
  const [isLoadingEffectiveConfig, setIsLoadingEffectiveConfig] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [testingJobType, setTestingJobType] = useState<DynamicJobType | null>(null);
  const [workspaceJobType, setWorkspaceJobType] = useState<DynamicJobType | null>(null);
  const [ruleProposal, setRuleProposal] = useState('');
  const [ruleProposalStatus, setRuleProposalStatus] = useState<string | null>(null);
  const [showAdvancedSchedulingRules, setShowAdvancedSchedulingRules] = useState(false);
  const [jobTypeActionId, setJobTypeActionId] = useState<string | null>(null);
  const [jobTypeActionError, setJobTypeActionError] = useState<string | null>(null);
  const [membershipJobType, setMembershipJobType] = useState<DynamicJobType | null>(null);
  const [membershipData, setMembershipData] = useState<DynamicMembershipAdminData | null>(null);
  const [membershipLoading, setMembershipLoading] = useState(false);
  const [membershipSavingUserId, setMembershipSavingUserId] = useState<string | null>(null);
  const [membershipError, setMembershipError] = useState<string | null>(null);
  const [showMembershipPicker, setShowMembershipPicker] = useState(false);
  const [permissionEditorLoading, setPermissionEditorLoading] = useState(false);
  const [permissionEditorError, setPermissionEditorError] = useState<string | null>(null);
  const [memberPermissionKeys, setMemberPermissionKeys] = useState<string[]>([]);
  const [managerPermissionKeys, setManagerPermissionKeys] = useState<string[]>([]);
  const [dashboardContextJobTypeIds, setDashboardContextJobTypeIds] = useState<string[]>([]);
  const [managerSavingUserId, setManagerSavingUserId] = useState<string | null>(null);
  const [selectedMembershipUserIds, setSelectedMembershipUserIds] = useState<string[]>([]);
  const [membershipBulkSaving, setMembershipBulkSaving] = useState(false);
  const [legacySourceKind, setLegacySourceKind] = useState<DynamicLegacySourceKind>('dispatcher');
  const [legacyPreview, setLegacyPreview] = useState<DynamicLegacyImportPreview | null>(null);
  const [legacyImporting, setLegacyImporting] = useState(false);
  const [legacyImportMessage, setLegacyImportMessage] = useState<string | null>(null);
  const [dailyReportAdminUsers, setDailyReportAdminUsers] = useState<DailyReportAdminUser[]>([]);

  const loadData = async (): Promise<void> => {
    setState((current) => ({
      ...current,
      isLoading: true,
      error: null,
    }));

    try {
      const data = await dynamicSchedulingService.getAdminData();
      setState({ isLoading: false, data, error: null });
    } catch (error) {
      setState({
        isLoading: false,
        data: null,
        error: error instanceof Error ? error.message : 'טעינת סוגי התפקידים נכשלה.',
      });
    }
  };

  useEffect(() => {
    let isCancelled = false;

    void dynamicSchedulingService
      .getAdminData()
      .then((data) => {
        if (isCancelled) {
          return;
        }

        setState({
          isLoading: false,
          data,
          error: null,
        });
      })
      .catch((error: unknown) => {
        if (isCancelled) {
          return;
        }

        setState({
          isLoading: false,
          data: null,
          error: error instanceof Error ? error.message : 'טעינת סוגי התפקידים נכשלה.',
        });
      });

    return () => {
      isCancelled = true;
    };
  }, []);

  const loadPermissionEditor = async (jobTypeId: string): Promise<void> => {
    setPermissionEditorLoading(true);
    setPermissionEditorError(null);
    try {
      const [editor, dashboardContextPolicy] = await Promise.all([
        dynamicPermissionEngineService.getJobTypeEditor(jobTypeId),
        dynamicPermissionEngineService.getDashboardContextPolicy(jobTypeId),
      ]);
      setMemberPermissionKeys(editor.memberPermissions.filter((item) => item.enabled).map((item) => item.permissionKey));
      setManagerPermissionKeys(editor.managerPermissions.filter((item) => item.enabled).map((item) => item.permissionKey));
      setDashboardContextJobTypeIds(dashboardContextPolicy.targetJobTypeIds);
    } catch (error) {
      setPermissionEditorError(error instanceof Error ? error.message : 'טעינת הרשאות התפקיד נכשלה.');
    } finally {
      setPermissionEditorLoading(false);
    }
  };

  const openCreate = (): void => {
    if (!canManage) return;
    const nextForm = emptyForm('');
    const defaults = permissionBlueprint;
    setEffectiveTiming('current');
    setForm(nextForm);
    setPermissionEditorError(null);
    setMemberPermissionKeys(defaults.filter((item) => item.audience === 'member' && item.defaultEnabled !== false).map((item) => item.permissionKey));
    setManagerPermissionKeys(defaults.filter((item) => item.audience === 'manager' && item.defaultEnabled !== false).map((item) => item.permissionKey));
    setDashboardContextJobTypeIds([]);
    setFormError(null);
    setIsModalOpen(true);
    void dailyReportService.getAdminOptions().then((data) => setDailyReportAdminUsers(data.users)).catch(() => setDailyReportAdminUsers([]));
  };

  const openEdit = (jobType: DynamicJobType): void => {
    if (!canManage) return;
    setEffectiveTiming('current');
    setForm(toForm(jobType));
    setPermissionEditorError(null);
    setFormError(null);
    setIsModalOpen(true);
    void dailyReportService.getAdminOptions().then((data) => setDailyReportAdminUsers(data.users)).catch(() => setDailyReportAdminUsers([]));
    void loadPermissionEditor(jobType.id);
  };

  const submitRuleProposal = async (): Promise<void> => {
    if (!form?.id || !ruleProposal.trim() || !canManage) return;
    setRuleProposalStatus(null);
    try {
      await dynamicSchedulingService.submitSchedulingRuleProposal(form.id, ruleProposal.trim());
      setRuleProposal('');
      setRuleProposalStatus('החוק נשמר בתור הצעת AI לבדיקה. הוא אינו פעיל ואינו משפיע על שיבוצים.');
    } catch (error) {
      setRuleProposalStatus(error instanceof Error ? error.message : 'שמירת הצעת החוק נכשלה.');
    }
  };

  const switchEffectiveTiming = async (timing: 'current' | 'next'): Promise<void> => {
    setEffectiveTiming(timing);
    if (!form?.id) return;

    const target = getIsraelMonth(timing === 'next' ? 1 : 0);
    setIsLoadingEffectiveConfig(true);
    setFormError(null);
    try {
      const effectiveJobType = await dynamicSchedulingService.getEffectiveJobType(
        form.id,
        target.year,
        target.month,
      );
      setForm(toForm(effectiveJobType));
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : 'טעינת הגדרת התפקיד לחודש המבוקש נכשלה.',
      );
    } finally {
      setIsLoadingEffectiveConfig(false);
    }
  };

  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    if (!form || !canManage) return;

    if (!form.name.trim()) {
      setFormError('יש להזין שם לתפקיד.');
      return;
    }

    if (!form.code.trim()) {
      setFormError('יש להזין קוד פנימי לתפקיד.');
      return;
    }

    setIsSaving(true);
    setFormError(null);

    try {
      const effectiveTarget = getIsraelMonth(form.id && effectiveTiming === 'next' ? 1 : 0);
      const savedJobTypeId = await dynamicSchedulingService.saveJobType({
        ...form,
        capabilities: deriveAutomaticCapabilities(form),
        name: form.name.trim(),
        code: form.code.trim().toLowerCase().replace(/\s+/g, '_'),
        description: form.description?.trim() || null,
        effectiveYear: effectiveTarget.year,
        effectiveMonth: effectiveTarget.month,
        changeSummary: form.id
          ? `עריכת תפקיד · תחולה ${effectiveTiming === 'next' ? 'מהחודש הבא' : 'מהחודש הנוכחי'}`
          : 'יצירת תפקיד',
      });

      const relevantBlueprint = derivePermissionBlueprint(form);
      const relevantMemberKeys = new Set(relevantBlueprint.filter((item) => item.audience === 'member').map((item) => item.permissionKey));
      const relevantManagerKeys = new Set(relevantBlueprint.filter((item) => item.audience === 'manager').map((item) => item.permissionKey));
      await dynamicPermissionEngineService.saveJobTypePolicy(
        savedJobTypeId,
        memberPermissionKeys.filter((key) => relevantMemberKeys.has(key)),
        managerPermissionKeys.filter((key) => relevantManagerKeys.has(key)),
      );
      await dynamicPermissionEngineService.saveDashboardContextPolicy(
        savedJobTypeId,
        dashboardContextJobTypeIds.filter((jobTypeId) => jobTypeId !== savedJobTypeId),
      );

      setIsModalOpen(false);
      setForm(null);
      await loadData();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'שמירת התפקיד נכשלה.');
    } finally {
      setIsSaving(false);
    }
  };

  const setJobTypeActive = async (jobType: DynamicJobType, isActive: boolean): Promise<void> => {
    if (!canManage || jobTypeActionId) return;

    const actionLabel = isActive ? 'להפעיל מחדש' : 'להקפיא';
    const confirmed = window.confirm(
      isActive
        ? `להפעיל מחדש את התפקיד "${jobType.name}"?`
        : `להקפיא את התפקיד "${jobType.name}"?\n\nעובדים והיסטוריה נשמרים, אך התפקיד לא ישמש ליצירת תקופות ושיבוצים חדשים עד להפעלה מחדש.`,
    );
    if (!confirmed) return;

    setJobTypeActionId(jobType.id);
    setJobTypeActionError(null);
    try {
      await dynamicSchedulingService.setJobTypeActive(jobType.id, isActive);
      await loadData();
    } catch (error) {
      setJobTypeActionError(
        error instanceof Error ? error.message : `לא ניתן ${actionLabel} את התפקיד.`,
      );
    } finally {
      setJobTypeActionId(null);
    }
  };

  const deleteJobType = async (jobType: DynamicJobType): Promise<void> => {
    if (!canManage || jobTypeActionId) return;

    const confirmed = window.confirm(
      `למחוק לצמיתות את התפקיד "${jobType.name}"?\n\nמחיקה מותרת רק לתפקיד חדש שעדיין אין לו עובדים, תקופות אילוצים או היסטוריית שיבוץ. אם כבר נעשה בו שימוש, יש להקפיא אותו במקום למחוק.`,
    );
    if (!confirmed) return;

    setJobTypeActionId(jobType.id);
    setJobTypeActionError(null);
    try {
      await dynamicSchedulingService.deleteJobType(jobType.id);
      await loadData();
    } catch (error) {
      setJobTypeActionError(error instanceof Error ? error.message : 'מחיקת התפקיד נכשלה.');
    } finally {
      setJobTypeActionId(null);
    }
  };

  const openMemberships = async (jobType: DynamicJobType): Promise<void> => {
    setMembershipJobType(jobType);
    setMembershipLoading(true);
    setMembershipError(null);
    setLegacyPreview(null);
    setLegacyImportMessage(null);
    setShowMembershipPicker(false);
    setSelectedMembershipUserIds([]);
    try {
      const data = await dynamicSchedulingService.getJobTypeMembershipAdmin(jobType.id);
      setMembershipData(data);
    } catch (error) {
      setMembershipError(error instanceof Error ? error.message : 'טעינת העובדים נכשלה.');
    } finally {
      setMembershipLoading(false);
    }
  };

  const saveMembership = async (user: DynamicMembershipAdminUser, patch: {
    isMember?: boolean; employmentScope?: DynamicMemberEmploymentScope | null;
    partTimeDefinition?: DynamicMembershipAdminUser['partTimeDefinition'];
  }): Promise<void> => {
    if (!membershipJobType) return;
    const isMember = patch.isMember ?? user.isMember;
    const scope = patch.employmentScope ?? user.employmentScope ?? (membershipJobType.employmentScope === 'flexible' ? 'full_time' : membershipJobType.employmentScope);
    setMembershipSavingUserId(user.userId);
    setMembershipError(null);
    try {
      await dynamicSchedulingService.saveJobTypeMembership(
        membershipJobType.id, user.userId, isMember, scope as DynamicMemberEmploymentScope, patch.partTimeDefinition ?? user.partTimeDefinition ?? {},
      );
      const [membership, admin] = await Promise.all([
        dynamicSchedulingService.getJobTypeMembershipAdmin(membershipJobType.id),
        dynamicSchedulingService.getAdminData(),
      ]);
      setMembershipData(membership);
      setState({ isLoading: false, data: admin, error: null });
      setMembershipJobType(admin.jobTypes.find((item) => item.id === membershipJobType.id) ?? membershipJobType);
    } catch (error) {
      setMembershipError(error instanceof Error ? error.message : 'שמירת השיוך נכשלה.');
    } finally {
      setMembershipSavingUserId(null);
    }
  };


  const toggleJobTypeManager = async (user: DynamicMembershipAdminUser): Promise<void> => {
    if (!membershipJobType || !canManage) return;
    setManagerSavingUserId(user.userId);
    setMembershipError(null);
    try {
      await dynamicPermissionEngineService.setJobTypeManager(
        membershipJobType.id,
        user.userId,
        !user.isJobTypeManager,
      );
      const membership = await dynamicSchedulingService.getJobTypeMembershipAdmin(membershipJobType.id);
      setMembershipData(membership);
    } catch (error) {
      setMembershipError(error instanceof Error ? error.message : 'שמירת מנהל התפקיד נכשלה.');
    } finally {
      setManagerSavingUserId(null);
    }
  };

  const addSelectedMemberships = async (): Promise<void> => {
    if (!membershipJobType || selectedMembershipUserIds.length === 0) return;

    const selectedUsers = (membershipData?.users ?? []).filter(
      (user) => selectedMembershipUserIds.includes(user.userId) && !user.isMember,
    );
    if (!selectedUsers.length) return;

    setMembershipBulkSaving(true);
    setMembershipError(null);
    try {
      const defaultScope: DynamicMemberEmploymentScope =
        membershipJobType.employmentScope === 'flexible'
          ? 'full_time'
          : (membershipJobType.employmentScope as DynamicMemberEmploymentScope);

      for (const user of selectedUsers) {
        await dynamicSchedulingService.saveJobTypeMembership(
          membershipJobType.id,
          user.userId,
          true,
          defaultScope,
          {},
        );
      }

      const [membership, admin] = await Promise.all([
        dynamicSchedulingService.getJobTypeMembershipAdmin(membershipJobType.id),
        dynamicSchedulingService.getAdminData(),
      ]);
      setMembershipData(membership);
      setState({ isLoading: false, data: admin, error: null });
      setMembershipJobType(
        admin.jobTypes.find((item) => item.id === membershipJobType.id) ?? membershipJobType,
      );
      setSelectedMembershipUserIds([]);
      setShowMembershipPicker(false);
    } catch (error) {
      setMembershipError(error instanceof Error ? error.message : 'שיוך העובדים נכשל.');
    } finally {
      setMembershipBulkSaving(false);
    }
  };

  const previewLegacyImport = async (): Promise<void> => {
    if (!membershipJobType) return;
    setLegacyImporting(true);
    setMembershipError(null);
    setLegacyImportMessage(null);
    try {
      setLegacyPreview(await dynamicSchedulingService.previewLegacyImport(membershipJobType.id, legacySourceKind));
    } catch (error) {
      setMembershipError(error instanceof Error ? error.message : 'בדיקת נתוני הארכיון נכשלה.');
    } finally {
      setLegacyImporting(false);
    }
  };

  const runLegacyImport = async (): Promise<void> => {
    if (!membershipJobType || !legacyPreview) return;
    const confirmed = window.confirm('הייבוא יעתיק את נתוני העבר למערכת הדינמית. נתוני המערכת הישנה לא יימחקו או ישתנו. להמשיך?');
    if (!confirmed) return;
    setLegacyImporting(true);
    setMembershipError(null);
    try {
      const result = await dynamicSchedulingService.importLegacyHistory(membershipJobType.id, legacySourceKind);
      setLegacyImportMessage(`הייבוא הושלם: ${result.periodsImported} תקופות, ${result.assignmentsImported} שיבוצים ו-${result.availabilityImported} רשומות אילוצים חדשות.`);
      setLegacyPreview(await dynamicSchedulingService.previewLegacyImport(membershipJobType.id, legacySourceKind));
    } catch (error) {
      setMembershipError(error instanceof Error ? error.message : 'ייבוא הארכיון נכשל.');
    } finally {
      setLegacyImporting(false);
    }
  };

  if (state.isLoading) {
    return (
      <div className="dynamic-job-types-loading">
        <LoaderCircle className="spin" size={22} />
        טוען סוגי תפקידים…
      </div>
    );
  }

  if (state.error || !state.data) {
    return (
      <div className="users-error" role="alert">
        {state.error ?? 'לא ניתן לטעון את המודל החדש.'}
        <Button variant="secondary" onClick={() => void loadData()}>
          <RefreshCw size={16} /> נסה שוב
        </Button>
      </div>
    );
  }

  return (
    <section className="dynamic-job-types-panel">
      <div className="dynamic-job-types-intro">
        <div>
          <div className="dynamic-job-types-kicker">
            <Bot size={18} /> Dynamic Scheduling Foundation
          </div>
          <h2>סוגי תפקידים דינמיים</h2>
          <p>
            המודל החדש נמצא כרגע ב־Shadow Mode. ניתן להגדיר ולערוך אותו, אבל הוא עדיין לא משנה את
            מנוע השיבוץ הפעיל.
          </p>
        </div>

        <div className="dynamic-job-types-intro-actions">
          <span className={`dynamic-feature-status ${state.data.featureEnabled ? 'is-on' : ''}`}>
            {state.data.featureEnabled ? 'פעיל' : `כבוי · ${state.data.featureMode}`}
          </span>
          {canManage ? (
            <Button onClick={openCreate}>
              <Plus size={17} /> סוג תפקיד חדש
            </Button>
          ) : null}
        </div>
      </div>

      {jobTypeActionError ? (
        <div className="users-error dynamic-job-type-action-error" role="alert">
          {jobTypeActionError}
        </div>
      ) : null}

      <div className="dynamic-role-cards-grid">
        {state.data.jobTypes.map((jobType) => (
          <article
            className={`dynamic-role-card ${!jobType.isActive ? 'is-frozen' : ''}`}
            key={jobType.id}
          >
            <div className="dynamic-role-card-main">
              <div className="dynamic-role-card-icon">
                <BriefcaseBusiness size={20} />
              </div>
              <div className="dynamic-role-card-copy">
                <div className="dynamic-job-type-title-line">
                  <h3>{jobType.name}</h3>
                  {!jobType.isActive ? <span className="dynamic-job-type-frozen-badge">מוקפא</span> : null}
                </div>
                <p>{jobType.description ?? 'ללא תיאור'}</p>
                <div className="dynamic-role-card-tags">
                  <span>{employmentScopeLabels[jobType.employmentScope]}</span>
                  <span>{payModelLabels[jobType.payModel]}</span>
                  <span>{schedulingStrategyLabels[jobType.schedulingStrategy ?? 'availability_optimizer']}</span>
                </div>
              </div>
            </div>

            <div className="dynamic-role-card-members">
              <UsersRound size={17} />
              <strong>{jobType.memberCount}</strong>
              <span>עובדים משויכים</span>
            </div>

            {canManage ? (
              <div className="dynamic-role-card-actions">
                <Button variant="secondary" onClick={() => setWorkspaceJobType(jobType)}>
                  <DatabaseBackup size={16} /> סביבת תפקיד
                </Button>
                <Button variant="secondary" onClick={() => void openMemberships(jobType)}>
                  <UsersRound size={16} /> ניהול עובדים
                </Button>
                <button
                  type="button"
                  onClick={() => setTestingJobType(jobType)}
                  aria-label={`בדיקת מנוע ${jobType.name}`}
                  title="בדיקת מנוע"
                >
                  <FlaskConical size={16} />
                </button>
                <button
                  type="button"
                  disabled={jobTypeActionId === jobType.id}
                  onClick={() => void setJobTypeActive(jobType, !jobType.isActive)}
                  aria-label={jobType.isActive ? `הקפאת ${jobType.name}` : `הפעלת ${jobType.name}`}
                  title={jobType.isActive ? 'הקפאת תפקיד' : 'הפעלת תפקיד מחדש'}
                  className={jobType.isActive ? 'dynamic-freeze-role-button' : 'dynamic-reactivate-role-button'}
                >
                  {jobType.isActive ? <Snowflake size={16} /> : <PlayCircle size={16} />}
                </button>
                <button
                  type="button"
                  disabled={jobTypeActionId === jobType.id}
                  onClick={() => void deleteJobType(jobType)}
                  aria-label={`מחיקת ${jobType.name}`}
                  title="מחיקת תפקיד"
                  className="dynamic-delete-role-button"
                >
                  <Trash2 size={16} />
                </button>
                <button type="button" onClick={() => openEdit(jobType)} aria-label={`עריכת ${jobType.name}`} title="עריכת תפקיד">
                  <Pencil size={16} />
                </button>
              </div>
            ) : null}
          </article>
        ))}
      </div>

      <div className="dynamic-phase-note">
        <strong>מבנה פשוט: תפקיד ← עובדים ← הגדרות.</strong>
        המערך הטכני של כל תפקיד נוצר ונשמר מאחורי הקלעים בלבד. אין צורך ליצור, לבחור או לערוך מערך ידנית.
        שיוך לתפקיד דינמי אינו משנה את role הישן של המשתמש בתקופת המעבר.
      </div>

      {membershipJobType ? (
        <Modal
          isOpen
          title={`ניהול עובדים · ${membershipJobType.name}`}
          className="dynamic-membership-modal"
          onClose={() => !membershipSavingUserId && !membershipBulkSaving && !legacyImporting && setMembershipJobType(null)}
          footer={<Button variant="secondary" onClick={() => setMembershipJobType(null)} disabled={Boolean(membershipSavingUserId) || membershipBulkSaving || legacyImporting}>סגור</Button>}
        >
          <div className="dynamic-membership-workspace">
            <section className="dynamic-membership-section">
              <div className="dynamic-membership-heading">
                <div>
                  <h4><UsersRound size={18} /> עובדים בתפקיד</h4>
                  <p className="dynamic-empty-note">משתמש קיים נשאר אותו משתמש. השיוך כאן מוסיף אותו לתפקיד הדינמי ואינו משנה את ה־role הישן שלו.</p>
                </div>
                {canManage ? (
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setShowMembershipPicker((current) => !current);
                      setSelectedMembershipUserIds([]);
                    }}
                    disabled={membershipLoading || membershipBulkSaving}
                  >
                    <Plus size={16} /> {showMembershipPicker ? 'סגור בחירה' : 'שייך משתמשים'}
                  </Button>
                ) : null}
              </div>

              {membershipLoading ? <div className="dynamic-job-types-loading"><LoaderCircle className="spin" size={18}/> טוען עובדים…</div> : null}
              {membershipError ? <div className="users-error" role="alert">{membershipError}</div> : null}

              {showMembershipPicker && !membershipLoading ? (
                <div className="dynamic-membership-picker">
                  <div className="dynamic-membership-picker-title">
                    <strong>בחר משתמשים קיימים לשיוך</strong>
                    <span>ניתן לבחור כמה משתמשים יחד.</span>
                  </div>
                  {(membershipData?.users ?? []).filter((user) => !user.isMember && user.isActive).length ? (
                    <div className="dynamic-membership-picker-list">
                      {(membershipData?.users ?? [])
                        .filter((user) => !user.isMember && user.isActive)
                        .map((user) => (
                          <label className="dynamic-membership-picker-user" key={user.userId}>
                            <input
                              type="checkbox"
                              checked={selectedMembershipUserIds.includes(user.userId)}
                              disabled={membershipBulkSaving}
                              onChange={(event) =>
                                setSelectedMembershipUserIds((current) =>
                                  event.target.checked
                                    ? [...current, user.userId]
                                    : current.filter((id) => id !== user.userId),
                                )
                              }
                            />
                            <span><strong>{user.displayName}</strong><small>{user.email} · תפקיד ישן: {user.legacyRole}</small></span>
                          </label>
                        ))}
                    </div>
                  ) : (
                    <p className="dynamic-empty-note">כל המשתמשים הפעילים כבר משויכים לתפקיד הזה.</p>
                  )}
                  <div className="dynamic-membership-picker-actions">
                    <span>{selectedMembershipUserIds.length} נבחרו</span>
                    <Button
                      onClick={() => void addSelectedMemberships()}
                      disabled={membershipBulkSaving || selectedMembershipUserIds.length === 0}
                    >
                      {membershipBulkSaving ? <LoaderCircle className="spin" size={16}/> : <Plus size={16}/>}
                      שייך לתפקיד
                    </Button>
                  </div>
                </div>
              ) : null}

              {!membershipLoading ? (membershipData?.users ?? []).filter((user) => user.isMember).length ? (
                (membershipData?.users ?? []).filter((user) => user.isMember).map((user) => (
                  <div className="dynamic-membership-user-row" key={user.userId}>
                    <div className="dynamic-membership-user-main">
                      <span><strong>{user.displayName}</strong><small>{user.email}{user.isPrimary ? ' · תפקיד ראשי' : ''}{!user.isActive ? ' · מושבת' : ''}</small></span>
                    </div>
                    <div className="dynamic-membership-user-controls">
                      {membershipJobType.employmentScope === 'flexible' ? (
                        <select
                          value={user.employmentScope ?? 'full_time'}
                          disabled={membershipSavingUserId === user.userId}
                          onChange={(event) => void saveMembership(user,{employmentScope:event.target.value as DynamicMemberEmploymentScope})}
                        >
                          <option value="full_time">משרה מלאה</option>
                          <option value="part_time">משרה חלקית</option>
                          <option value="as_much_as_possible">כמה שיותר</option>
                        </select>
                      ) : (
                        <span className="dynamic-membership-fixed-scope">{employmentScopeLabels[membershipJobType.employmentScope]}</span>
                      )}
                      <Button
                        variant="secondary"
                        disabled={membershipSavingUserId === user.userId}
                        onClick={() => void saveMembership(user,{isMember:false})}
                      >
                        הסר מהתפקיד
                      </Button>
                    </div>
                    {membershipJobType.employmentScope === 'flexible' && user.employmentScope === 'part_time' ? (
                      <div className="dynamic-membership-part-time">
                        <div className="dynamic-part-time-days">
                          {['א׳','ב׳','ג׳','ד׳','ה׳','ו׳','ש׳'].map((label,index)=>{
                            const days = user.partTimeDefinition?.days ?? [];
                            return <label key={label}><input type="checkbox" checked={days.includes(index)} disabled={membershipSavingUserId===user.userId}
                              onChange={(event)=>void saveMembership(user,{partTimeDefinition:{...user.partTimeDefinition,days:event.target.checked?[...days,index]:days.filter((day)=>day!==index)}})}/>{label}</label>;
                          })}
                        </div>
                        <label>משעה<input type="time" value={user.partTimeDefinition?.startTime ?? '08:00'} disabled={membershipSavingUserId===user.userId}
                          onChange={(event)=>void saveMembership(user,{partTimeDefinition:{...user.partTimeDefinition,startTime:event.target.value}})}/></label>
                        <label>עד שעה<input type="time" value={user.partTimeDefinition?.endTime ?? '17:00'} disabled={membershipSavingUserId===user.userId}
                          onChange={(event)=>void saveMembership(user,{partTimeDefinition:{...user.partTimeDefinition,endTime:event.target.value}})}/></label>
                      </div>
                    ) : null}
                  </div>
                ))
              ) : (
                <div className="dynamic-membership-empty-state">
                  <UsersRound size={24} />
                  <strong>עדיין אין עובדים בתפקיד</strong>
                  <span>לחץ על “שייך משתמשים” ובחר משתמשים קיימים במערכת.</span>
                </div>
              ) : null}
            </section>

            <section className="dynamic-membership-section dynamic-job-type-managers-section">
              <div className="dynamic-membership-heading">
                <div>
                  <h4><ShieldCheck size={18} /> מנהלי התפקיד</h4>
                  <p className="dynamic-empty-note">מנהל תפקיד מקבל רק את הרשאות הניהול שהוגדרו לתפקיד הזה. הוא לא חייב להיות עובד בתפקיד.</p>
                </div>
              </div>
              <div className="dynamic-job-type-manager-list">
                {(membershipData?.users ?? []).filter((user) => user.isActive || user.isJobTypeManager).map((user) => (
                  <label className="dynamic-job-type-manager-row" key={`manager-${user.userId}`}>
                    <input
                      type="checkbox"
                      checked={user.isJobTypeManager}
                      disabled={!canManage || managerSavingUserId === user.userId}
                      onChange={() => void toggleJobTypeManager(user)}
                    />
                    <span>
                      <strong>{user.displayName}</strong>
                      <small>{user.email}{user.isMember ? ' · גם בעל התפקיד' : ''}{!user.isActive ? ' · משתמש מושבת' : ''}</small>
                    </span>
                    {managerSavingUserId === user.userId ? <LoaderCircle className="spin" size={15} /> : null}
                  </label>
                ))}
              </div>
            </section>

            <section className="dynamic-membership-section dynamic-legacy-bridge">
              <h4><DatabaseBackup size={18} /> כלי מעבר זמני מהמערכת הישנה</h4>
              <p>הכלי מעתיק היסטוריה בלבד. הוא אינו מוחק, מעביר או משנה שום רשומה במערכת הישנה, וניתן להריץ אותו שוב בלי ליצור כפילויות.</p>
              <div className="dynamic-legacy-controls">
                <label>מקור היסטורי
                  <select value={legacySourceKind} disabled={legacyImporting} onChange={(event)=>{setLegacySourceKind(event.target.value as DynamicLegacySourceKind);setLegacyPreview(null);setLegacyImportMessage(null);}}>
                    <option value="dispatcher">מוקדנים</option>
                    <option value="on_call">כוננים</option>
                    <option value="morning_driver">כונני בוקר</option>
                  </select>
                </label>
                <Button variant="secondary" onClick={() => void previewLegacyImport()} disabled={legacyImporting}>בדיקת נתונים</Button>
              </div>
              {legacyPreview ? (
                <>
                  <div className="dynamic-legacy-preview">
                    <div><strong>{legacyPreview.periods}</strong><span>תקופות מקור</span></div>
                    <div><strong>{legacyPreview.assignments}</strong><span>שיבוצים</span></div>
                    <div><strong>{legacyPreview.availability}</strong><span>אילוצים</span></div>
                    <div><strong>{legacyPreview.referencedUsers}</strong><span>משתמשים שנמצאו בהיסטוריה</span></div>
                    <div><strong>{legacyPreview.newAssignments}</strong><span>שיבוצים חדשים לייבוא</span></div>
                    <div><strong>{legacyPreview.alreadyImportedAssignments}</strong><span>שיבוצים שכבר יובאו</span></div>
                  </div>

                  <div className="dynamic-legacy-review-grid">
                    <section className="dynamic-legacy-review-card">
                      <h5>תקופות שייכללו במעבר</h5>
                      <div className="dynamic-legacy-review-list">
                        {(legacyPreview.periodDetails ?? []).length ? (legacyPreview.periodDetails ?? []).map((period) => (
                          <div key={period.sourcePeriodId} className="dynamic-legacy-review-row">
                            <span>
                              <strong>{period.label}</strong>
                              <small>{period.status === 'archived' ? 'ארכיון' : 'פורסם'} · {period.assignments} שיבוצים · {period.availability} אילוצים</small>
                            </span>
                            <b className={period.alreadyImported ? 'is-imported' : 'is-new'}>{period.alreadyImported ? 'כבר יובא' : 'חדש'}</b>
                          </div>
                        )) : <div className="dynamic-legacy-review-empty">לא נמצאו תקופות מתאימות.</div>}
                      </div>
                    </section>

                    <section className="dynamic-legacy-review-card">
                      <h5>משתמשים שזוהו בהיסטוריה</h5>
                      <div className="dynamic-legacy-review-list">
                        {(legacyPreview.userDetails ?? []).length ? (legacyPreview.userDetails ?? []).map((user) => (
                          <div key={user.userId} className="dynamic-legacy-review-row">
                            <span>
                              <strong>{user.displayName}</strong>
                              <small>{user.email ?? user.userId}</small>
                            </span>
                            <b className={user.status === 'matched' ? 'is-ok' : user.status === 'missing_profile' ? 'is-error' : 'is-warning'}>
                              {user.status === 'matched' ? (user.isAlreadyMember ? 'תואם · כבר משויך' : 'תואם') : user.status === 'missing_profile' ? 'משתמש חסר' : 'role השתנה'}
                            </b>
                          </div>
                        )) : <div className="dynamic-legacy-review-empty">לא נמצאו משתמשים בהיסטוריה.</div>}
                      </div>
                    </section>
                  </div>

                  {(legacyPreview.issues ?? []).length ? (
                    <div className="dynamic-legacy-issues" role="alert">
                      {(legacyPreview.issues ?? []).map((issue) => (
                        <div key={`${issue.code}-${issue.message}`} className={issue.severity === 'error' ? 'is-error' : 'is-warning'}>
                          <strong>{issue.severity === 'error' ? 'שגיאה' : 'שים לב'}</strong>
                          <span>{issue.message}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="dynamic-legacy-ready">הבדיקה הושלמה ללא בעיות חוסמות. הנתונים מוכנים לייבוא.</div>
                  )}
                </>
              ) : null}
              {legacyPreview ? (
                <Button
                  onClick={() => void runLegacyImport()}
                  disabled={legacyImporting || !legacyPreview.canImport || (legacyPreview.newPeriods + legacyPreview.newAssignments + legacyPreview.newAvailability === 0)}
                >
                  {legacyImporting
                    ? 'מייבא…'
                    : `ייבוא ${legacyPreview.newPeriods} תקופות ו-${legacyPreview.newAssignments} שיבוצים`}
                </Button>
              ) : null}
              {legacyImportMessage ? <div className="dynamic-legacy-success">{legacyImportMessage}</div> : null}
            </section>
          </div>
        </Modal>
      ) : null}

      {workspaceJobType ? (
        <DynamicRoleWorkspaceModal
          jobType={workspaceJobType}
          onClose={() => setWorkspaceJobType(null)}
        />
      ) : null}

      {testingJobType ? (
        <DynamicSchedulingShadowTester
          jobType={testingJobType}
          isOpen
          onClose={() => setTestingJobType(null)}
        />
      ) : null}

      {form ? (
        <Modal
          isOpen={isModalOpen}
          title={form.id ? 'עריכת סוג תפקיד' : 'יצירת סוג תפקיד'}
          className="dynamic-job-type-modal"
          onClose={() => !isSaving && setIsModalOpen(false)}
          footer={
            <>
              <Button variant="secondary" onClick={() => setIsModalOpen(false)} disabled={isSaving}>
                ביטול
              </Button>
              <Button type="submit" form="dynamic-job-type-form" disabled={isSaving}>
                {isSaving ? <LoaderCircle className="spin" size={17} /> : <Save size={17} />}
                שמור תפקיד
              </Button>
            </>
          }
        >
          <form id="dynamic-job-type-form" className="dynamic-job-type-form" onSubmit={submit}>
            {formError ? (
              <div className="users-error" role="alert">
                {formError}
              </div>
            ) : null}

            {form.id ? (
              <div className="dynamic-config-section">
                <h3>תחולת השינוי</h3>
                <p>
                  בחר מאיזה חודש ההגדרה החדשה תיכנס לתוקף. שינוי לחודש הבא נשמר כגרסה עתידית ואינו
                  משנה את הגדרת החודש הנוכחי.
                </p>
                <div className="dynamic-choice-grid">
                  <label className="dynamic-choice-chip">
                    <input
                      type="radio"
                      name="effective-timing"
                      checked={effectiveTiming === 'current'}
                      disabled={isLoadingEffectiveConfig}
                      onChange={() => void switchEffectiveTiming('current')}
                    />
                    <span>החל מהחודש הנוכחי</span>
                  </label>
                  <label className="dynamic-choice-chip">
                    <input
                      type="radio"
                      name="effective-timing"
                      checked={effectiveTiming === 'next'}
                      disabled={isLoadingEffectiveConfig}
                      onChange={() => void switchEffectiveTiming('next')}
                    />
                    <span>החל מהחודש הבא</span>
                  </label>
                </div>
                {isLoadingEffectiveConfig ? (
                  <div className="dynamic-job-types-loading">
                    <LoaderCircle className="spin" size={16} /> טוען את ההגדרה שתהיה פעילה בחודש הזה…
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="dynamic-form-grid">
              <Input
                label="שם התפקיד"
                value={form.name}
                required
                onChange={(event) => setForm({ ...form, name: event.target.value })}
              />
              <Input
                label="קוד פנימי"
                value={form.code}
                required
                disabled={Boolean(form.legacyRole)}
                helperText={
                  form.legacyRole
                    ? 'בתפקידי legacy הקוד נשמר לצורכי תאימות.'
                    : 'אותיות באנגלית, מספרים וקו תחתון.'
                }
                onChange={(event) => setForm({ ...form, code: event.target.value })}
              />
            </div>

            <Textarea
              label="תיאור"
              value={form.description ?? ''}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
            />

            <div className="dynamic-config-section dynamic-form-section dynamic-scheduling-basics">
              <div className="dynamic-section-heading"><span>3</span><div><h3>שיטת שיבוץ ושכר</h3><small>בחר כיצד נבנה הלוח ומהו מודל השכר של התפקיד.</small></div></div>
              <div className="dynamic-form-grid">
              <label className="dynamic-select-field">
                <span>שיטת יצירת שיבוץ</span>
                <select
                  value={form.schedulingStrategy}
                  onChange={(event) => {
                    const schedulingStrategy = event.target.value as DynamicSchedulingStrategy;
                    const hasScheduling = schedulingStrategy !== 'none';
                    const schedulingCapabilities = new Set(form.capabilities);
                    if (hasScheduling) {
                      schedulingCapabilities.add('availability');
                      schedulingCapabilities.add('schedule');
                    } else {
                      schedulingCapabilities.delete('availability');
                      schedulingCapabilities.delete('schedule');
                      schedulingCapabilities.delete('shift_exchange');
                      schedulingCapabilities.delete('self_edit');
                      schedulingCapabilities.delete('monthly_rotation');
                    }
                    setForm({
                      ...form,
                      schedulingStrategy,
                      availabilityConfig: { ...form.availabilityConfig, enabled: hasScheduling },
                      schedulingConfig: hasScheduling
                        ? form.schedulingConfig
                        : { ...form.schedulingConfig, scheduleChangeMode: 'none' },
                      capabilities: Array.from(schedulingCapabilities),
                    });
                  }}
                >
                  {Object.entries(schedulingStrategyLabels).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
                <small>
                  {form.schedulingStrategy === 'none'
                    ? 'לתפקיד אין לוח שיבוצים, תקופות אילוצים או מנגנון איזון. יכולות אחרות של התפקיד ממשיכות לעבוד כרגיל.'
                    : form.schedulingStrategy === 'monthly_rotation_constraints'
                      ? 'הסבב החודשי יהיה נקודת המוצא, והאילוצים ישמשו להתאמת הסבב. מנוע הסבב עצמו יחובר בשלב הבא.'
                      : 'המנוע בונה את החודש מתוך האילוצים, יעדי האיזון והחוקים שהוגדרו.'}
                </small>
              </label>
              <label className="dynamic-select-field">
                <span>היקף משרה</span>
                <select
                  value={form.employmentScope}
                  onChange={(event) =>
                    setForm({ ...form, employmentScope: event.target.value as EmploymentScope })
                  }
                >
                  {Object.entries(employmentScopeLabels).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="dynamic-select-field">
                <span>מודל שכר</span>
                <select
                  value={form.payModel}
                  onChange={(event) =>
                    setForm({ ...form, payModel: event.target.value as JobPayModel })
                  }
                >
                  {Object.entries(payModelLabels).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="dynamic-choice-chip">
                <input
                  type="checkbox"
                  checked={form.statisticsConfig.enabled !== false}
                  onChange={(event) => setForm({
                    ...form,
                    statisticsConfig: {
                      ...form.statisticsConfig,
                      enabled: event.target.checked,
                    },
                  })}
                />
                <span>הפעל סטטיסטיקות לתפקיד</span>
              </label>
              </div>
              <div className="dynamic-employment-inline">
                {form.employmentScope === 'full_time' ? (
                  <small><strong>משרה מלאה:</strong> ראשון–חמישי, 5 ימי עבודה בשבוע.</small>
                ) : null}
                {form.employmentScope === 'flexible' ? (
                  <small><strong>גמיש:</strong> בעת שיוך עובד לתפקיד ייקבע לו מלאה, חלקית או כמה שיותר.</small>
                ) : null}
                {form.employmentScope === 'part_time' ? (
                  <div className="dynamic-part-time-inline">
                    <strong>הגדרת משרה חלקית</strong>
                    <div className="dynamic-choice-grid">
                      {['א׳','ב׳','ג׳','ד׳','ה׳','ו׳','שבת'].map((label, index) => (
                        <label className="dynamic-choice-chip" key={label}>
                          <input type="checkbox" checked={(form.schedulingConfig.employmentDefinition?.partTimeDays ?? []).includes(index)} onChange={(event) => {
                            const current = form.schedulingConfig.employmentDefinition ?? { fullTimeDays:[0,1,2,3,4], partTimeDays:[], partTimeStartTime:'08:00', partTimeEndTime:'17:00' };
                            const days = event.target.checked ? [...current.partTimeDays, index] : current.partTimeDays.filter((day) => day !== index);
                            setForm({ ...form, schedulingConfig: { ...form.schedulingConfig, employmentDefinition: { ...current, partTimeDays: days } } });
                          }} />
                          <span>{label}</span>
                        </label>
                      ))}
                    </div>
                    <div className="dynamic-form-grid">
                      <Input label="משעה" type="time" value={form.schedulingConfig.employmentDefinition?.partTimeStartTime ?? '08:00'} onChange={(event) => { const current=form.schedulingConfig.employmentDefinition ?? {fullTimeDays:[0,1,2,3,4],partTimeDays:[],partTimeStartTime:'08:00',partTimeEndTime:'17:00'}; setForm({...form,schedulingConfig:{...form.schedulingConfig,employmentDefinition:{...current,partTimeStartTime:event.target.value}}}); }} />
                      <Input label="עד שעה" type="time" value={form.schedulingConfig.employmentDefinition?.partTimeEndTime ?? '17:00'} onChange={(event) => { const current=form.schedulingConfig.employmentDefinition ?? {fullTimeDays:[0,1,2,3,4],partTimeDays:[],partTimeStartTime:'08:00',partTimeEndTime:'17:00'}; setForm({...form,schedulingConfig:{...form.schedulingConfig,employmentDefinition:{...current,partTimeEndTime:event.target.value}}}); }} />
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="dynamic-config-section dynamic-form-section dynamic-work-structure-section">
              <div className="dynamic-section-heading"><span>1</span><div><h3>מבנה העבודה</h3><small>בחר משמרות, כוננות שעתית או כוננות יומית והגדר את ימי הפעילות.</small></div></div>
              <p>
                בחר קודם אם התפקיד עובד במבנה של משמרות או כוננות. לאחר מכן הגדר בנפרד את ימי
                החול, שישי, שבת והחגים.
              </p>

              {(() => {
                const pattern = normalizeShiftPattern(form.schedulingConfig.shiftPattern);
                const dayDefinitions: Array<{
                  key: 'weekday' | 'friday' | 'saturday' | 'holiday';
                  label: string;
                  noWorkLabel: string;
                }> = [
                  { key: 'weekday', label: 'ימי חול', noWorkLabel: 'לא עובד בימי חול' },
                  { key: 'friday', label: 'שישי', noWorkLabel: 'לא עובד בשישי' },
                  { key: 'saturday', label: 'שבת', noWorkLabel: 'לא עובד בשבת' },
                  { key: 'holiday', label: 'חגים', noWorkLabel: 'לא עובד בחגים' },
                ];

                const updatePattern = (nextPattern: DynamicShiftPatternDefinition): void => {
                  setForm({
                    ...form,
                    schedulingConfig: {
                      ...form.schedulingConfig,
                      shiftPattern: nextPattern,
                    },
                  });
                };

                const updateDay = (
                  dayKey: 'weekday' | 'friday' | 'saturday' | 'holiday',
                  nextDay: DynamicWorkDayDefinition,
                ): void => updatePattern({ ...pattern, [dayKey]: nextDay });

                return (
                  <>
                    <div className="dynamic-choice-grid">
                      {([
                        ['shifts', 'משמרות'],
                        ['on_call_hourly', 'כוננות שעתית'],
                        ['on_call_daily', 'כוננות יומית'],
                      ] as Array<[DynamicWorkStructureMode, string]>).map(([key, label]) => (
                        <label className="dynamic-choice-chip" key={key}>
                          <input
                            type="radio"
                            name="work-structure-mode"
                            checked={pattern.workMode === key}
                            onChange={() => updatePattern({ ...pattern, workMode: key })}
                          />
                          <span>{label}</span>
                        </label>
                      ))}
                    </div>

                    <small>
                      {pattern.workMode === 'on_call_hourly'
                        ? 'בכוננות שעתית מגדירים חלון כוננות אחד או יותר לכל סוג יום, למשל א׳–ה׳ 06:00–16:00 ושישי 06:00–14:00.'
                        : pattern.workMode === 'on_call_daily'
                          ? 'בכוננות יומית העובד משובץ לכוננות של יום שלם. בוחרים רק באילו סוגי ימים התפקיד פעיל, ללא שעות התחלה וסיום.'
                          : 'במשמרות כל חלון הוא משמרת נפרדת. ניתן להוסיף כמה משמרות לכל סוג יום ולתת לכל אחת שם ושעות.'}
                    </small>

                    {pattern.workMode === 'on_call_daily' ? (
                      <div className="dynamic-daily-on-call-window">
                        <div>
                          <strong>טווח תפעולי לכוננות יומית</strong>
                          <small>
                            השעות אינן מוצגות לעובדים ואינן הופכות את הכוננות לשעתית. הן משמשות את המערכת
                            לחישוב חפיפה בין תפקידים, למשל כדי להציג למוקדן את הכונן שעובד במקביל אליו.
                            כאשר שעת הסיום מוקדמת או זהה לשעת ההתחלה, הסיום נחשב ליום הבא.
                          </small>
                        </div>
                        <div className="dynamic-daily-on-call-window-fields">
                          <Input
                            label="שעת התחלה"
                            type="time"
                            value={pattern.dailyOnCallWindow?.startTime ?? '00:00'}
                            onChange={(event) => updatePattern({
                              ...pattern,
                              dailyOnCallWindow: {
                                startTime: event.target.value,
                                endTime: pattern.dailyOnCallWindow?.endTime ?? '00:00',
                              },
                            })}
                          />
                          <Input
                            label="שעת סיום"
                            type="time"
                            value={pattern.dailyOnCallWindow?.endTime ?? '00:00'}
                            onChange={(event) => updatePattern({
                              ...pattern,
                              dailyOnCallWindow: {
                                startTime: pattern.dailyOnCallWindow?.startTime ?? '00:00',
                                endTime: event.target.value,
                              },
                            })}
                          />
                        </div>
                      </div>
                    ) : null}

                    <div className="dynamic-schedule-change-mode">
                      <div>
                        <strong>ניהול שינויים בשיבוץ</strong>
                        <small>בחר איזה workflow יהיה זמין לעובדי התפקיד לאחר פרסום הלוח.</small>
                      </div>
                      <div className="dynamic-choice-grid">
                        {([
                          ['none', 'ללא שינוי עצמי', 'רק בעלי הרשאת ניהול יוכלו לשנות את השיבוץ.'],
                          ['shift_exchange', 'מערכת חילופי משמרות', 'העובדים מגישים בקשת החלפה/חילוף לפי תהליך אישורים.'],
                          ['self_edit', 'שינוי שיבוץ עצמי', 'העובדים יכולים לערוך את השיבוץ שלהם לפי כללי התפקיד והתקופה.'],
                        ] as Array<[DynamicScheduleChangeMode, string, string]>).map(([mode, label, description]) => (
                          <label className="dynamic-choice-chip dynamic-operational-capability-choice" key={mode}>
                            <input
                              type="radio"
                              name="schedule-change-mode"
                              checked={(form.schedulingConfig.scheduleChangeMode ?? 'none') === mode}
                              onChange={() => setForm({
                                ...form,
                                schedulingConfig: { ...form.schedulingConfig, scheduleChangeMode: mode },
                              })}
                            />
                            <span><strong>{label}</strong><small>{description}</small></span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="dynamic-work-pattern-days">
                      {dayDefinitions.map(({ key, label, noWorkLabel }) => {
                        const day = pattern[key];
                        return (
                          <div className={`dynamic-work-day-card${day.works ? ' is-active' : ''}`} key={key}>
                            <div className="dynamic-work-day-header">
                              <div>
                                <strong>{label}</strong>
                                <span>
                                  {day.works
                                    ? pattern.workMode === 'on_call_daily'
                                      ? 'כוננות ליום מלא'
                                      : `${day.shifts.length} ${day.shifts.length === 1 ? 'חלון עבודה' : 'חלונות עבודה'}`
                                    : 'אין עבודה'}
                                </span>
                              </div>
                              <label className={`dynamic-choice-chip ${pattern.workMode === 'on_call_daily' ? 'dynamic-day-active-toggle' : ''}`}>
                                <input
                                  type="checkbox"
                                  checked={pattern.workMode === 'on_call_daily' ? day.works : !day.works}
                                  onChange={(event) => {
                                    const works = pattern.workMode === 'on_call_daily'
                                      ? event.target.checked
                                      : !event.target.checked;
                                    updateDay(key, {
                                      works,
                                      shifts:
                                        works && pattern.workMode !== 'on_call_daily' && day.shifts.length === 0
                                          ? [makeWorkShift(key, 0)]
                                          : pattern.workMode === 'on_call_daily'
                                            ? []
                                            : day.shifts,
                                    });
                                  }}
                                />
                                <span>{pattern.workMode === 'on_call_daily' ? `עובד ב${label}` : noWorkLabel}</span>
                              </label>
                            </div>

                            {key === 'friday' ? (
                              <label className="dynamic-choice-chip dynamic-day-template-link">
                                <input
                                  type="checkbox"
                                  checked={day.applyToHolidayEve === true}
                                  onChange={(event) => updateDay(key, { ...day, applyToHolidayEve: event.target.checked })}
                                />
                                <span>החל על ימים של כניסת החג</span>
                              </label>
                            ) : null}

                            {key === 'saturday' ? (
                              <label className="dynamic-choice-chip dynamic-day-template-link">
                                <input
                                  type="checkbox"
                                  checked={day.applyToHolidayEnd === true}
                                  onChange={(event) => updateDay(key, { ...day, applyToHolidayEnd: event.target.checked })}
                                />
                                <span>החל על מוצאי חג</span>
                              </label>
                            ) : null}

                            {day.works && pattern.workMode !== 'on_call_daily' ? (
                              <>
                                <div className="dynamic-shift-template-list">
                                  {day.shifts.map((shift, shiftIndex) => (
                                    <div className="dynamic-shift-editor-card" key={shift.id}>
                                      <div className="dynamic-job-type-row">
                                        <strong>
                                          {pattern.workMode === 'on_call_hourly'
                                            ? `חלון כוננות ${shiftIndex + 1}`
                                            : shift.name || `משמרת ${shiftIndex + 1}`}
                                        </strong>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            updateDay(key, {
                                              ...day,
                                              shifts: day.shifts.filter((item) => item.id !== shift.id),
                                            })
                                          }
                                          aria-label={`מחיקת ${pattern.workMode === 'on_call_hourly' ? 'חלון כוננות' : 'משמרת'} ${shiftIndex + 1}`}
                                          title="מחק"
                                        >
                                          <Trash2 size={16} />
                                        </button>
                                      </div>

                                      <div className="dynamic-form-grid">
                                        {pattern.workMode === 'shifts' ? (
                                          <Input
                                            label="שם המשמרת"
                                            value={shift.name}
                                            placeholder={`משמרת ${shiftIndex + 1}`}
                                            onChange={(event) =>
                                              updateDay(key, {
                                                ...day,
                                                shifts: day.shifts.map((item) =>
                                                  item.id === shift.id
                                                    ? { ...item, name: event.target.value }
                                                    : item,
                                                ),
                                              })
                                            }
                                          />
                                        ) : null}
                                        <Input
                                          label="התחלה"
                                          type="time"
                                          value={shift.startTime}
                                          onChange={(event) =>
                                            updateDay(key, {
                                              ...day,
                                              shifts: day.shifts.map((item) =>
                                                item.id === shift.id
                                                  ? { ...item, startTime: event.target.value }
                                                  : item,
                                              ),
                                            })
                                          }
                                        />
                                        <Input
                                          label="סיום"
                                          type="time"
                                          value={shift.endTime}
                                          onChange={(event) =>
                                            updateDay(key, {
                                              ...day,
                                              shifts: day.shifts.map((item) =>
                                                item.id === shift.id
                                                  ? { ...item, endTime: event.target.value }
                                                  : item,
                                              ),
                                            })
                                          }
                                        />
                                      </div>

                                      <div className="dynamic-shift-premium-row">
                                        <label className="dynamic-choice-chip dynamic-premium-toggle">
                                          <input
                                            type="checkbox"
                                            checked={shift.contains200Percent}
                                            onChange={(event) =>
                                              updateDay(key, {
                                                ...day,
                                                shifts: day.shifts.map((item) =>
                                                  item.id === shift.id
                                                    ? {
                                                        ...item,
                                                        contains200Percent: event.target.checked,
                                                        premium200Hours: event.target.checked
                                                          ? Math.min(
                                                              item.premium200Hours > 0 ? item.premium200Hours : 1,
                                                              getShiftDurationHours(item.startTime, item.endTime),
                                                            )
                                                          : 0,
                                                      }
                                                    : item,
                                                ),
                                              })
                                            }
                                          />
                                          <span>מכיל רכיב 200%</span>
                                        </label>

                                        {shift.contains200Percent ? (
                                          <label className="dynamic-premium-hours-field">
                                            <span>כמה שעות מהמשמרת הן 200%</span>
                                            <input
                                              type="number"
                                              min="0.25"
                                              max={getShiftDurationHours(shift.startTime, shift.endTime)}
                                              step="0.25"
                                              value={shift.premium200Hours || ''}
                                              onChange={(event) => {
                                                const duration = getShiftDurationHours(shift.startTime, shift.endTime);
                                                const requested = Number(event.target.value);
                                                const premium200Hours = Number.isFinite(requested)
                                                  ? Math.min(Math.max(0, requested), duration)
                                                  : 0;
                                                updateDay(key, {
                                                  ...day,
                                                  shifts: day.shifts.map((item) =>
                                                    item.id === shift.id ? { ...item, premium200Hours } : item,
                                                  ),
                                                });
                                              }}
                                            />
                                            <small>מתוך {getShiftDurationHours(shift.startTime, shift.endTime).toFixed(2)} שעות במשמרת</small>
                                          </label>
                                        ) : null}
                                      </div>
                                    </div>
                                  ))}
                                </div>

                                <Button
                                  type="button"
                                  variant="secondary"
                                  onClick={() =>
                                    updateDay(key, {
                                      ...day,
                                      shifts: [...day.shifts, makeWorkShift(key, day.shifts.length)],
                                    })
                                  }
                                >
                                  <Plus size={16} />
                                  {pattern.workMode === 'on_call_hourly' ? 'הוסף חלון כוננות' : 'הוסף משמרת'}
                                </Button>
                              </>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </>
                );
              })()}
            </div>

            <div className="dynamic-config-section dynamic-availability-config dynamic-form-section" style={{ display: form.schedulingStrategy === 'none' ? 'none' : undefined }}>
              <div className="dynamic-section-heading"><span>4</span><div><h3>מערכת אילוצים דינמית</h3><small>הגדר אילו תשובות וחוקי קיבולת זמינים לעובדים.</small></div></div>
              <p>
                ההגדרות נשמרות ב־Shadow Mode בלבד. הן עדיין לא מחליפות את מסכי האילוצים הפעילים.
              </p>
              <label className="dynamic-choice-chip dynamic-availability-master">
                <input
                  type="checkbox"
                  checked={form.availabilityConfig.enabled}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      availabilityConfig: {
                        ...form.availabilityConfig,
                        enabled: event.target.checked,
                      },
                      capabilities: event.target.checked
                        ? Array.from(new Set([...form.capabilities, 'availability']))
                        : form.capabilities,
                    })
                  }
                />
                <span>התפקיד משתמש במערכת אילוצים</span>
              </label>

              {form.availabilityConfig.enabled ? (
                <>
                  <div className="dynamic-availability-subsection">
                    <strong>אפשרויות תשובה לכל משמרת</strong>
                    <div className="dynamic-choice-grid">
                      {[
                        ['available', 'זמין'],
                        ['unavailable', 'לא זמין'],
                        ['preferred', 'מעדיף'],
                        ['avoid', 'מעדיף שלא'],
                      ].map(([key, label]) => {
                        const status = key as 'available' | 'unavailable' | 'preferred' | 'avoid';
                        const checked = form.availabilityConfig.statuses.includes(status);
                        return (
                          <label className="dynamic-choice-chip" key={key}>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() =>
                                setForm({
                                  ...form,
                                  availabilityConfig: {
                                    ...form.availabilityConfig,
                                    statuses: checked
                                      ? form.availabilityConfig.statuses.filter(
                                          (item) => item !== status,
                                        )
                                      : [...form.availabilityConfig.statuses, status],
                                  },
                                })
                              }
                            />
                            <span>{label}</span>
                          </label>
                        );
                      })}
                      <label className="dynamic-choice-chip">
                        <input
                          type="checkbox"
                          checked={form.availabilityConfig.allowNotes}
                          onChange={(event) =>
                            setForm({
                              ...form,
                              availabilityConfig: {
                                ...form.availabilityConfig,
                                allowNotes: event.target.checked,
                              },
                            })
                          }
                        />
                        <span>הערה למשמרת</span>
                      </label>
                    </div>
                  </div>

                  <div className="dynamic-availability-subsection">
                    <label className="dynamic-choice-chip dynamic-availability-master">
                      <input
                        type="checkbox"
                        checked={form.availabilityConfig.monthlyCapacity.enabled}
                        onChange={(event) =>
                          setForm({
                            ...form,
                            availabilityConfig: {
                              ...form.availabilityConfig,
                              monthlyCapacity: {
                                ...form.availabilityConfig.monthlyCapacity,
                                enabled: event.target.checked,
                              },
                            },
                          })
                        }
                      />
                      <span>מכסת משמרות חודשית</span>
                    </label>
                    {form.availabilityConfig.monthlyCapacity.enabled ? (
                      <div className="dynamic-capacity-grid">
                        {[
                          ['minEnabled', 'defaultMin', 'מינימום'],
                          ['targetEnabled', 'defaultTarget', 'יעד'],
                          ['maxEnabled', 'defaultMax', 'מקסימום'],
                        ].map(([enabledKey, valueKey, label]) => {
                          const capacity = form.availabilityConfig.monthlyCapacity;
                          const enabled =
                            capacity[enabledKey as 'minEnabled' | 'targetEnabled' | 'maxEnabled'];
                          const value =
                            capacity[valueKey as 'defaultMin' | 'defaultTarget' | 'defaultMax'];
                          return (
                            <div className="dynamic-capacity-item" key={enabledKey}>
                              <label>
                                <input
                                  type="checkbox"
                                  checked={enabled}
                                  onChange={(event) =>
                                    setForm({
                                      ...form,
                                      availabilityConfig: {
                                        ...form.availabilityConfig,
                                        monthlyCapacity: {
                                          ...capacity,
                                          [enabledKey]: event.target.checked,
                                        },
                                      },
                                    })
                                  }
                                />{' '}
                                {label}
                              </label>
                              <input
                                type="number"
                                min="0"
                                disabled={!enabled}
                                value={value ?? ''}
                                placeholder="ללא ברירת מחדל"
                                onChange={(event) =>
                                  setForm({
                                    ...form,
                                    availabilityConfig: {
                                      ...form.availabilityConfig,
                                      monthlyCapacity: {
                                        ...capacity,
                                        [valueKey]:
                                          event.target.value === ''
                                            ? null
                                            : Number(event.target.value),
                                      },
                                    },
                                  })
                                }
                              />
                            </div>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>

                  <div className="dynamic-availability-subsection">
                    <strong>מגבלות חודשיות אופציונליות</strong>
                    <div className="dynamic-capacity-grid">
                      {[
                        ['maxNightsEnabled', 'defaultMaxNights', 'מקסימום לילות'],
                        ['maxWeekendsEnabled', 'defaultMaxWeekends', 'מקסימום סופי שבוע'],
                        ['maxHolidaysEnabled', 'defaultMaxHolidays', 'מקסימום חגים'],
                      ].map(([enabledKey, valueKey, label]) => {
                        const limits = form.availabilityConfig.limits;
                        const enabled =
                          limits[
                            enabledKey as
                              'maxNightsEnabled' | 'maxWeekendsEnabled' | 'maxHolidaysEnabled'
                          ];
                        const value =
                          limits[
                            valueKey as
                              'defaultMaxNights' | 'defaultMaxWeekends' | 'defaultMaxHolidays'
                          ];
                        return (
                          <div className="dynamic-capacity-item" key={enabledKey}>
                            <label>
                              <input
                                type="checkbox"
                                checked={enabled}
                                onChange={(event) =>
                                  setForm({
                                    ...form,
                                    availabilityConfig: {
                                      ...form.availabilityConfig,
                                      limits: { ...limits, [enabledKey]: event.target.checked },
                                    },
                                  })
                                }
                              />{' '}
                              {label}
                            </label>
                            <input
                              type="number"
                              min="0"
                              disabled={!enabled}
                              value={value ?? ''}
                              placeholder="ללא ברירת מחדל"
                              onChange={(event) =>
                                setForm({
                                  ...form,
                                  availabilityConfig: {
                                    ...form.availabilityConfig,
                                    limits: {
                                      ...limits,
                                      [valueKey]:
                                        event.target.value === ''
                                          ? null
                                          : Number(event.target.value),
                                    },
                                  },
                                })
                              }
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              ) : null}
            </div>

            
            {form.schedulingConfig.shiftPattern?.workMode === 'shifts' ? (
              <div className="dynamic-config-section dynamic-form-section">
                <div className="dynamic-section-heading"><span>4</span><div><h3>נוכחות ושעון עבודה</h3><small>מודול אופציונלי לדיווח כניסה/יציאה. המיקום נלקח רק ברגע הלחיצה ואין מעקב ברקע.</small></div></div>
                <label className="dynamic-choice-chip">
                  <input type="checkbox" checked={form.schedulingConfig.attendance?.enabled ?? false} onChange={(event) => setForm({...form,schedulingConfig:{...form.schedulingConfig,attendance:{...(form.schedulingConfig.attendance ?? {requireLocation:true,workplaceName:'',latitude:null,longitude:null,radiusMeters:150,outsidePolicy:'flag',allowUnscheduled:false}),enabled:event.target.checked}}})} />
                  <span>הפעל כפתורי כניסה ויציאה לתפקיד</span>
                </label>
                {form.schedulingConfig.attendance?.enabled ? (
                  <div className="dynamic-attendance-settings">
                    <div className="dynamic-form-grid">
                      <Input label="שם מקום העבודה" value={form.schedulingConfig.attendance.workplaceName} placeholder="לדוגמה: סניף ראשי" onChange={(event)=>setForm({...form,schedulingConfig:{...form.schedulingConfig,attendance:{...form.schedulingConfig.attendance!,workplaceName:event.target.value}}})} />
                      <Input label="רדיוס מותר (מטרים)" type="number" min="20" max="5000" value={String(form.schedulingConfig.attendance.radiusMeters)} onChange={(event)=>setForm({...form,schedulingConfig:{...form.schedulingConfig,attendance:{...form.schedulingConfig.attendance!,radiusMeters:Math.max(20,Number(event.target.value)||150)}}})} />
                      <Input label="קו רוחב" type="number" step="any" value={form.schedulingConfig.attendance.latitude ?? ''} onChange={(event)=>setForm({...form,schedulingConfig:{...form.schedulingConfig,attendance:{...form.schedulingConfig.attendance!,latitude:event.target.value===''?null:Number(event.target.value)}}})} />
                      <Input label="קו אורך" type="number" step="any" value={form.schedulingConfig.attendance.longitude ?? ''} onChange={(event)=>setForm({...form,schedulingConfig:{...form.schedulingConfig,attendance:{...form.schedulingConfig.attendance!,longitude:event.target.value===''?null:Number(event.target.value)}}})} />
                    </div>
                    <Button type="button" variant="secondary" onClick={()=>{navigator.geolocation.getCurrentPosition((position)=>setForm({...form,schedulingConfig:{...form.schedulingConfig,attendance:{...form.schedulingConfig.attendance!,latitude:position.coords.latitude,longitude:position.coords.longitude}}}),()=>setFormError('לא ניתן לקבל את המיקום. יש לאפשר הרשאת מיקום לדפדפן.'));}}>השתמש במיקום הנוכחי כמקום העבודה</Button>
                    {form.schedulingConfig.attendance.latitude !== null && form.schedulingConfig.attendance.longitude !== null ? <Button type="button" variant="secondary" onClick={()=>window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${form.schedulingConfig.attendance!.latitude},${form.schedulingConfig.attendance!.longitude}`)}`,'_blank','noopener,noreferrer')}>הצג את מקום העבודה ב-Google Maps</Button> : null}
                    <div className="dynamic-choice-grid">
                      <label className="dynamic-choice-chip"><input type="checkbox" checked={form.schedulingConfig.attendance.requireLocation} onChange={(e)=>setForm({...form,schedulingConfig:{...form.schedulingConfig,attendance:{...form.schedulingConfig.attendance!,requireLocation:e.target.checked}}})}/><span>דרוש מיקום בדיווח</span></label>
                      <label className="dynamic-choice-chip"><input type="checkbox" checked={form.schedulingConfig.attendance.allowUnscheduled} onChange={(e)=>setForm({...form,schedulingConfig:{...form.schedulingConfig,attendance:{...form.schedulingConfig.attendance!,allowUnscheduled:e.target.checked}}})}/><span>אפשר כניסה גם ללא משמרת מתוכננת</span></label>
                    </div>
                    <label className="dynamic-select-field"><span>דיווח מחוץ לרדיוס</span><select value={form.schedulingConfig.attendance.outsidePolicy} onChange={(e)=>setForm({...form,schedulingConfig:{...form.schedulingConfig,attendance:{...form.schedulingConfig.attendance!,outsidePolicy:e.target.value as 'flag'|'block'}}})}><option value="flag">אפשר וסמן חריגה</option><option value="block">חסום את הדיווח</option></select></label>
                  </div>
                ) : null}
              </div>
            ) : null}
<div className="dynamic-config-section dynamic-scheduling-rules-config dynamic-simple-rules" style={{ display: form.schedulingStrategy === 'none' ? 'none' : undefined }}>
              <div className="dynamic-section-title-row">
                <div>
                  <h3>אילוצים ואיזון</h3>
                  <p>ברירת המחדל מתאימה לרוב התפקידים. פתח הגדרות מתקדמות רק כשצריך חוק חריג.</p>
                </div>
                <button
                  className="dynamic-advanced-toggle"
                  type="button"
                  onClick={() => setShowAdvancedSchedulingRules((current) => !current)}
                >
                  <Settings2 size={16} />
                  {showAdvancedSchedulingRules ? 'הסתר הגדרות מתקדמות' : 'הגדרות מתקדמות'}
                  {showAdvancedSchedulingRules ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
              </div>

              <div className="dynamic-simple-rule-grid">
                <label className="dynamic-choice-chip">
                  <input
                    type="checkbox"
                    checked={form.schedulingConfig.rules.noConsecutive.enabled}
                    onChange={(event) => setForm({ ...form, schedulingConfig: { ...form.schedulingConfig, rules: { ...form.schedulingConfig.rules, noConsecutive: { ...form.schedulingConfig.rules.noConsecutive, enabled: event.target.checked } } } })}
                  />
                  <span>למנוע משמרות רצופות</span>
                </label>
                <label className="dynamic-choice-chip">
                  <input
                    type="checkbox"
                    checked={form.schedulingConfig.proportionalFairness}
                    onChange={(event) => setForm({ ...form, schedulingConfig: { ...form.schedulingConfig, proportionalFairness: event.target.checked } })}
                  />
                  <span>איזון לפי היקף משרה וזמינות</span>
                </label>
                <label className="dynamic-choice-chip">
                  <input
                    type="checkbox"
                    checked={form.schedulingConfig.rules.balanceNights.enabled && form.schedulingConfig.rules.balanceWeekends.enabled && form.schedulingConfig.rules.balanceHolidays.enabled}
                    onChange={(event) => {
                      const enabled = event.target.checked;
                      setForm({ ...form, schedulingConfig: { ...form.schedulingConfig, rules: { ...form.schedulingConfig.rules, balanceNights: { ...form.schedulingConfig.rules.balanceNights, enabled }, balanceWeekends: { ...form.schedulingConfig.rules.balanceWeekends, enabled }, balanceHolidays: { ...form.schedulingConfig.rules.balanceHolidays, enabled } } } });
                    }}
                  />
                  <span>איזון לילות, סופי שבוע וחגים</span>
                </label>
              </div>

              <div className="dynamic-rest-simple">
                <label>
                  <input
                    type="checkbox"
                    checked={form.schedulingConfig.rules.minimumRestMinutes.enabled}
                    onChange={(event) => setForm({ ...form, schedulingConfig: { ...form.schedulingConfig, rules: { ...form.schedulingConfig.rules, minimumRestMinutes: { ...form.schedulingConfig.rules.minimumRestMinutes, enabled: event.target.checked } } } })}
                  />
                  <span>מנוחה מינימלית בין משמרות</span>
                </label>
                {form.schedulingConfig.rules.minimumRestMinutes.enabled ? (
                  <label className="dynamic-inline-number">
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={form.schedulingConfig.rules.minimumRestMinutes.value / 60}
                      onChange={(event) => setForm({ ...form, schedulingConfig: { ...form.schedulingConfig, rules: { ...form.schedulingConfig.rules, minimumRestMinutes: { ...form.schedulingConfig.rules.minimumRestMinutes, value: Math.round(Number(event.target.value) * 60) } } } })}
                    />
                    <span>שעות</span>
                  </label>
                ) : null}
              </div>

              {showAdvancedSchedulingRules ? (
                <div className="dynamic-advanced-rules-panel">
                  <div className="dynamic-rule-mode-grid">
                    <label className="dynamic-select-field">
                      <span>מינימום חודשי</span>
                      <select value={form.schedulingConfig.minimumMode} onChange={(event) => setForm({ ...form, schedulingConfig: { ...form.schedulingConfig, minimumMode: event.target.value as 'hard' | 'soft' } })}>
                        <option value="soft">יעד יחסי / רך</option>
                        <option value="hard">חובה קשיחה</option>
                      </select>
                    </label>
                    <label className="dynamic-select-field">
                      <span>מקסימום חודשי</span>
                      <select value={form.schedulingConfig.maximumMode} onChange={(event) => setForm({ ...form, schedulingConfig: { ...form.schedulingConfig, maximumMode: event.target.value as 'hard' | 'soft' } })}>
                        <option value="hard">חובה קשיחה</option>
                        <option value="soft">העדפה</option>
                      </select>
                    </label>
                  </div>

                  <div className="dynamic-rule-list">
                    <label className="dynamic-choice-chip">
                      <input type="checkbox" checked={form.schedulingConfig.rules.noOverlap.enabled} onChange={(event) => setForm({ ...form, schedulingConfig: { ...form.schedulingConfig, rules: { ...form.schedulingConfig.rules, noOverlap: { ...form.schedulingConfig.rules.noOverlap, enabled: event.target.checked } } } })} />
                      <span>מניעת חפיפת משמרות</span>
                    </label>
                    <label className="dynamic-choice-chip">
                      <input type="checkbox" checked={form.schedulingConfig.rules.maxShiftsPerDay.enabled} onChange={(event) => setForm({ ...form, schedulingConfig: { ...form.schedulingConfig, rules: { ...form.schedulingConfig.rules, maxShiftsPerDay: { ...form.schedulingConfig.rules.maxShiftsPerDay, enabled: event.target.checked } } } })} />
                      <span>הגבלת מספר משמרות ביום</span>
                    </label>
                  </div>
                  {form.schedulingConfig.rules.maxShiftsPerDay.enabled ? (
                    <label className="dynamic-inline-number dynamic-max-shifts-inline">
                      <span>מקסימום משמרות ביום</span>
                      <input type="number" min="1" value={form.schedulingConfig.rules.maxShiftsPerDay.value} onChange={(event) => setForm({ ...form, schedulingConfig: { ...form.schedulingConfig, rules: { ...form.schedulingConfig.rules, maxShiftsPerDay: { ...form.schedulingConfig.rules.maxShiftsPerDay, value: Number(event.target.value) } } } })} />
                    </label>
                  ) : null}

                  <div className="dynamic-advanced-balance-grid">
                    {[
                      ['balanceNights', 'איזון לילות'],
                      ['balanceWeekends', 'איזון סופי שבוע'],
                      ['balanceHolidays', 'איזון חגים'],
                    ].map(([key, label]) => {
                      const rule = form.schedulingConfig.rules[key as 'balanceNights' | 'balanceWeekends' | 'balanceHolidays'];
                      return (
                        <label className="dynamic-choice-chip" key={key}>
                          <input type="checkbox" checked={rule.enabled} onChange={(event) => setForm({ ...form, schedulingConfig: { ...form.schedulingConfig, rules: { ...form.schedulingConfig.rules, [key]: { ...rule, enabled: event.target.checked } } } })} />
                          <span>{label}</span>
                        </label>
                      );
                    })}
                  </div>

                  {form.id ? (
                    <div className="dynamic-custom-rule-proposal">
                      <Textarea label="חוק נוסף בשפה חופשית" value={ruleProposal} helperText="נשמר כהצעת AI לבדיקה בלבד ואינו מוחל אוטומטית." onChange={(event) => setRuleProposal(event.target.value)} />
                      <Button type="button" variant="secondary" disabled={!ruleProposal.trim()} onClick={() => void submitRuleProposal()}>
                        <Bot size={16} /> שמור להצעת AI
                      </Button>
                      {ruleProposalStatus ? <small>{ruleProposalStatus}</small> : null}
                    </div>
                  ) : null}

                  <div className="dynamic-engine-priority-note">
                    <strong>סדר העדיפויות של המנוע</strong>
                    <span>כיסוי משמרות → חוקים קשיחים → חלוקה לפי היקף משרה → העדפות ואיזון → השלמת יעד.</span>
                  </div>
                </div>
              ) : null}

            </div>

              <div className="dynamic-config-section dynamic-daily-report-config" data-independent-workflow="true">
                <div className="dynamic-section-heading"><span>+</span><div><h3>דיווחים וטפסי עבודה</h3><small>Workflow תפעולי עצמאי — זמין גם לתפקידים ללא שיבוצים.</small></div></div>
                <label className="dynamic-choice-chip">
                  <input type="checkbox" checked={form.schedulingConfig.dailyReports?.enabled === true}
                    onChange={(event) => setForm({ ...form, schedulingConfig: { ...form.schedulingConfig, dailyReports: {
                      enabled: event.target.checked,
                      recipientUserIds: form.schedulingConfig.dailyReports?.recipientUserIds ?? [],
                      allowAddSubjects: form.schedulingConfig.dailyReports?.allowAddSubjects ?? true,
                      allowAddCustomers: form.schedulingConfig.dailyReports?.allowAddCustomers ?? true,
                      allowAttachments: form.schedulingConfig.dailyReports?.allowAttachments ?? true,
                    } } })} />
                  <span>דיווח עבודה יומי</span>
                </label>
                {form.schedulingConfig.dailyReports?.enabled ? (
                  <div className="dynamic-daily-report-settings">
                    <div><strong>למי נשלח הדיווח?</strong><small>הנמענים יקבלו התראה ו-Push בכל שליחה.</small>
                      <div className="dynamic-dashboard-context-options">
                        {dailyReportAdminUsers.map((user) => {
                          const checked = form.schedulingConfig.dailyReports?.recipientUserIds.includes(user.userId) ?? false;
                          return <label className="dynamic-dashboard-context-option" key={user.userId}>
                            <input type="checkbox" checked={checked} onChange={(event) => {
                              const current = form.schedulingConfig.dailyReports?.recipientUserIds ?? [];
                              const recipientUserIds = event.target.checked ? Array.from(new Set([...current, user.userId])) : current.filter((id) => id !== user.userId);
                              setForm({ ...form, schedulingConfig: { ...form.schedulingConfig, dailyReports: { ...form.schedulingConfig.dailyReports!, recipientUserIds } } });
                            }} />
                            <span><strong>{user.displayName}</strong><small>{user.email}</small></span>
                          </label>;
                        })}
                      </div>
                    </div>
                    <label className="dynamic-choice-chip"><input type="checkbox" checked={form.schedulingConfig.dailyReports.allowAddSubjects}
                      onChange={(event) => setForm({ ...form, schedulingConfig: { ...form.schedulingConfig, dailyReports: { ...form.schedulingConfig.dailyReports!, allowAddSubjects: event.target.checked } } })} />
                      <span>עובדים יכולים להוסיף נושאים חדשים</span></label>
                    <label className="dynamic-choice-chip"><input type="checkbox" checked={form.schedulingConfig.dailyReports.allowAddCustomers}
                      onChange={(event) => setForm({ ...form, schedulingConfig: { ...form.schedulingConfig, dailyReports: { ...form.schedulingConfig.dailyReports!, allowAddCustomers: event.target.checked } } })} />
                      <span>עובדים יכולים להוסיף לקוחות חדשים</span></label>
                    <label className="dynamic-choice-chip"><input type="checkbox" checked={form.schedulingConfig.dailyReports.allowAttachments !== false}
                      onChange={(event) => setForm({ ...form, schedulingConfig: { ...form.schedulingConfig, dailyReports: { ...form.schedulingConfig.dailyReports!, allowAttachments: event.target.checked } } })} />
                      <span>אפשר צירוף טפסים וקבצים לדיווח</span></label>
                  </div>
                ) : null}
              </div>

              <div className="dynamic-permission-builder">
                <div className="dynamic-permission-builder-heading">
                  <ShieldCheck size={18} />
                  <div>
                    <strong>הרשאות שנגזרות מהתפקיד</strong>
                    <span>המערכת מציגה רק הרשאות שרלוונטיות ליכולות שבחרת. ניתן לשנות את ברירת המחדל לבעלי התפקיד ולמנהלי התפקיד.</span>
                  </div>
                </div>

                {permissionEditorLoading ? (
                  <div className="dynamic-empty-note"><LoaderCircle className="spin" size={16} /> טוען הרשאות תפקיד…</div>
                ) : null}
                {permissionEditorError ? <div className="users-error" role="alert">{permissionEditorError}</div> : null}

                <div className="dynamic-permission-features">
                  {derivePermissionFeatures(form).map((feature) => (
                    <span key={feature}>{permissionFeatureLabels[feature] ?? feature}</span>
                  ))}
                </div>

                <div className="dynamic-permission-columns">
                  {(['member', 'manager'] as const).map((audience) => {
                    const items = derivePermissionBlueprint(form).filter((item) => item.audience === audience);
                    const selected = audience === 'member' ? memberPermissionKeys : managerPermissionKeys;
                    const setSelected = audience === 'member' ? setMemberPermissionKeys : setManagerPermissionKeys;
                    return (
                      <section key={audience} className="dynamic-permission-column">
                        <h5>{audience === 'member' ? 'לבעלי התפקיד' : 'למנהלי התפקיד'}</h5>
                        {items.length ? items.map((item) => {
                          const checked = selected.includes(item.permissionKey);
                          return (
                            <label key={`${audience}-${item.permissionKey}`} className="dynamic-permission-option">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(event) => setSelected((current) => event.target.checked
                                  ? Array.from(new Set([...current, item.permissionKey]))
                                  : current.filter((key) => key !== item.permissionKey))}
                              />
                              <span><strong>{item.label}</strong><small>{item.description}</small></span>
                            </label>
                          );
                        }) : <span className="dynamic-empty-note">אין הרשאות רלוונטיות בצד הזה.</span>}
                      </section>
                    );
                  })}
                </div>


                <div className="dynamic-dashboard-context-policy">
                  <div className="dynamic-dashboard-context-policy-heading">
                    <LayoutDashboard size={18} aria-hidden="true" />
                    <div>
                      <strong>מידע נוסף בלוח הבקרה</strong>
                      <span>בחר אילו תפקידים יוצגו לבעלי התפקיד כאשר השיבוץ שלהם מתרחש במקביל למשמרת או לכוננות של התפקיד הנוכחי.</span>
                    </div>
                  </div>

                  <div className="dynamic-dashboard-context-options">
                    {(state.data?.jobTypes ?? [])
                      .filter((jobType) => jobType.isActive && jobType.legacyRole === null && jobType.id !== form.id)
                      .map((jobType) => {
                        const checked = dashboardContextJobTypeIds.includes(jobType.id);
                        return (
                          <label key={jobType.id} className="dynamic-dashboard-context-option">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(event) => setDashboardContextJobTypeIds((current) => event.target.checked
                                ? Array.from(new Set([...current, jobType.id]))
                                : current.filter((id) => id !== jobType.id))}
                            />
                            <span>
                              <strong>הצג שיבוצים של {jobType.name}</strong>
                              <small>רק כאשר קיימת חפיפה בפועל עם המשמרת/כוננות הנוכחית או הבאה של בעל התפקיד.</small>
                            </span>
                          </label>
                        );
                      })}
                    {(state.data?.jobTypes ?? []).filter((jobType) => jobType.isActive && jobType.legacyRole === null && jobType.id !== form.id).length === 0 ? (
                      <span className="dynamic-empty-note">אין כרגע תפקיד דינמי נוסף שניתן להציג.</span>
                    ) : null}
                  </div>

                  <small className="dynamic-permission-footnote">ההגדרה חד-כיוונית. לדוגמה, אפשר להציג לכונן את המוקדנים בלי להציג אוטומטית למוקדנים את הכונן; את הכיוון ההפוך מגדירים בתפקיד השני.</small>
                </div>

                <small className="dynamic-permission-footnote">הרשאות מערכת כלליות כגון ניהול משתמשים, הגדרות ויומן מערכת נשארות נפרדות ואינן תלויות בתפקיד עבודה.</small>
              </div>

            <div className="dynamic-config-section dynamic-ai-preview">
              <Bot size={20} />
              <div>
                <strong>AI Configurator — מוכן לשלב הבא</strong>
                <p>
                  שכבת הנתונים כבר יכולה לשמור הצעות AI, אבל בשלב הזה אין עדיין קריאה למודל ואין
                  החלה אוטומטית.
                </p>
              </div>
            </div>
          </form>
        </Modal>
      ) : null}
    </section>
  );
}

export default DynamicJobTypesPanel;
