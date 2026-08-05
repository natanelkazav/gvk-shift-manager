export type UnifiedScheduleCategory =
  | 'dispatcher'
  | 'morning_driver'
  | 'on_call';

export interface UnifiedScheduleEntry {
  id: string;

  date: string;

  category:
    UnifiedScheduleCategory;

  assignedUserId:
    string | null;

  assignedUserName:
    string | null;

  startTime:
    string | null;

  endTime:
    string | null;

  isLocked: boolean;

  notes:
    string | null;
}

export interface UnifiedScheduleFilters {
  dispatcher: boolean;

  morningDriver: boolean;

  onCall: boolean;
}

export interface UnifiedScheduleMonth {
  year: number;

  month: number;
}

export interface UnifiedScheduleLoadWarnings {
  dispatcher:
    string | null;

  morningDriver:
    string | null;

  onCall:
    string | null;
}

export interface UnifiedScheduleData {
  entries:
    UnifiedScheduleEntry[];

  warnings:
    UnifiedScheduleLoadWarnings;
}
export interface DispatcherScheduleMonthPeriod {
  id: string;

  year: number;

  month: number;

  status: string;

  publishedAt:
    string | null;

  createdAt: string;

  updatedAt: string;
}

export interface DispatcherScheduleMonthShift {
  id: string;

  periodId: string;

  shiftDate: string;

  startsAt: string;

  endsAt: string;

  shiftCode: string;

  scheduleType: string;

  isPremium: boolean;

  holidayName:
    string | null;

  assignedUserId:
    string | null;

  assignedUserName:
    string | null;

  isLocked: boolean;

  notes:
    string | null;
}

export interface DispatcherScheduleMonthData {
  period:
    DispatcherScheduleMonthPeriod | null;

  shifts:
    DispatcherScheduleMonthShift[];
}