import type {
  UserRole,
} from './auth';

export interface DashboardPerson {
  id: string;
  displayName: string | null;
  scheduleName: string | null;
}

export interface DashboardMonthlyProgress {
  year: number;
  month: number;
  completed: number;
  total: number;
  percentage: number;
}

export interface DashboardDispatcherShift {
  id: string;
  shiftDate: string;
  startsAt: string;
  endsAt: string;
  shiftCode: string;
  scheduleType: string;
  isPremium: boolean;
  holidayName: string | null;
  driver: DashboardPerson | null;
}

export interface DispatcherDashboardData {
  currentShift: DashboardDispatcherShift | null;
  nextShift: DashboardDispatcherShift | null;
  monthlyProgress: DashboardMonthlyProgress;
}

export interface DashboardDutyDispatcherShift {
  id: string;
  startsAt: string;
  endsAt: string;
  displayName: string | null;
  scheduleName: string | null;
}

export interface DashboardDriverDuty {
  id: string;
  dutyDate: string;
  weekdayNumber: number;
  weekdayName: string;
  notes: string | null;
  dispatcherShifts: DashboardDutyDispatcherShift[];
}

export interface DriverDashboardData {
  currentDuty: DashboardDriverDuty | null;
  nextDuty: DashboardDriverDuty | null;
  monthlyProgress: DashboardMonthlyProgress;
}

export interface ManagerCurrentDispatcher {
  shiftId: string;
  startsAt: string;
  endsAt: string;
  userId: string | null;
  displayName: string | null;
  scheduleName: string | null;
}

export interface ManagerCurrentDriver {
  dutyId: string;
  dutyDate: string;
  userId: string | null;
  displayName: string | null;
  scheduleName: string | null;
}

export interface ManagerDashboardSummaryItem {
  completed: number;
  total: number;
  unassigned: number;
  percentage: number;
}

export interface ManagerDashboardData {
  currentDispatcher: ManagerCurrentDispatcher | null;
  currentDriver: ManagerCurrentDriver | null;
  monthlySummary: {
    year: number;
    month: number;
    dispatcherShifts: ManagerDashboardSummaryItem;
    driverDuties: ManagerDashboardSummaryItem;
  };
}

export interface DashboardResponse {
  user: {
    id: string;
    role: UserRole;
  };
  dispatcher: DispatcherDashboardData | null;
  driver: DriverDashboardData | null;
  manager: ManagerDashboardData | null;
  generatedAt: string;
}