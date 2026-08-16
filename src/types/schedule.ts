export type SchedulePeriodStatus =
  | 'draft'
  | 'collecting_availability'
  | 'scheduling'
  | 'published'
  | 'archived';

export type ScheduleShiftType =
  | 'weekday'
  | 'friday'
  | 'saturday'
  | 'holiday_eve'
  | 'holiday_full'
  | 'holiday_end'
  | 'chol_hamoed';

export type ScheduleAssignmentSource =
  | 'manual'
  | 'automatic'
  | 'shift_swap'
  | 'import';

export type ScheduleViewerRole =
  | 'admin'
  | 'manager'
  | 'dispatcher'
  | 'on_call'
  | 'viewer';

export type ScheduleViewMode =
  | 'personal'
  | 'team';

export type ScheduleShiftProgressState =
  | 'completed'
  | 'current'
  | 'upcoming';

export interface SchedulePeriodSummary {
  id: string;

  availabilityPeriodId:
    string | null;

  year: number;
  month: number;

  title:
    string | null;

  status:
    SchedulePeriodStatus;

  publishedAt:
    string | null;

  approvedAt:
    string | null;

  createdAt: string;
  updatedAt: string;
}

export interface ScheduleAssignedUser {
  id: string;

  displayName: string;

  scheduleName:
    string | null;

  role:
    ScheduleViewerRole;
}

export interface ScheduleShift {
  id: string;

  periodId: string;

  availabilityShiftSlotId:
    string | null;

  shiftDate: string;

  startsAt: string;
  endsAt: string;

  shiftCode: string;

  scheduleType:
    ScheduleShiftType;

  isPremium: boolean;

  holidayName:
    string | null;

  assignedUser:
    ScheduleAssignedUser | null;

  assignmentSource:
    ScheduleAssignmentSource | null;

  assignmentScore:
    number | null;

  assignmentReasons:
    string[];

  isLocked: boolean;

  notes:
    string | null;

  progressState:
    ScheduleShiftProgressState;
}

export interface DispatcherMonthlyStatistics {
  userId: string;

  displayName: string;

  scheduleName:
    string | null;

  totalShifts: number;

  completedShifts: number;

  remainingShifts: number;

  completionPercentage: number;

  totalScheduledHours: number;

  completedHours: number;

  remainingHours: number;

  weekdayEveningShifts: number;

  weekdayNightShifts: number;

  fridayMorningShifts: number;

  fridayAfternoonShifts: number;

  fridayNightShifts: number;

  saturdayMorningShifts: number;

  saturdayAfternoonShifts: number;

  saturdayNightShifts: number;

  premiumShifts: number;

  holidayShifts: number;

  manualAssignments: number;

  automaticAssignments: number;
}

export interface ScheduleTeamStatistics {
  totalShifts: number;

  completedShifts: number;

  remainingShifts: number;

  completionPercentage: number;

  assignedDispatchers: number;

  premiumShifts: number;

  holidayShifts: number;

  manualAssignments: number;

  automaticAssignments: number;
}

export interface CurrentScheduleAccess {
  userId: string;

  role:
    ScheduleViewerRole;

  canViewSchedule: boolean;

  canEditSchedule: boolean;

  canViewTeamSchedule: boolean;

  defaultViewMode:
    ScheduleViewMode;
}

export interface CurrentScheduleData {
  access:
    CurrentScheduleAccess;

  period:
    SchedulePeriodSummary | null;

  shifts:
    ScheduleShift[];

  visibleShifts:
    ScheduleShift[];

  personalStatistics:
    DispatcherMonthlyStatistics | null;

  dispatcherStatistics:
    DispatcherMonthlyStatistics[];

  teamStatistics:
    ScheduleTeamStatistics;

  generatedAt: string;
}

export interface CurrentScheduleFilters {
  viewMode:
    ScheduleViewMode;

  selectedUserId:
    string | null;

  includeCompleted:
    boolean;

  includeUpcoming:
    boolean;

  includePremiumOnly:
    boolean;
}
export interface ScheduleEditDispatcher {
  id: string;

  displayName: string;

  scheduleName:
    string | null;
}

export interface CurrentScheduleEditOptions {
  dispatchers:
    ScheduleEditDispatcher[];
}

export interface UpdateCurrentScheduleShiftRequest {
  shiftId: string;

  newUserId: string;

  reason:
    string | null;
}

export interface UpdateCurrentScheduleShiftResponse {
  shiftId: string;

  previousUserId:
    string | null;

  previousUserName:
    string | null;

  newUserId: string;

  newUserName: string;

  shiftDate: string;

  startsAt: string;

  endsAt: string;

  notificationIds:
    string[];
}
