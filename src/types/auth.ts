import type {
  Session,
  User,
} from '@supabase/supabase-js';

export type UserRole =
  | 'admin'
  | 'manager'
  | 'dispatcher'
  | 'on_call'
  | 'morning_driver'
  | 'viewer';

export type PermissionKey =
  | 'dashboard.view'

  | 'schedule.view'
  | 'schedule.view_team'
  | 'schedule.edit'

  | 'availability.view'
  | 'availability.manage'

| 'driver_availability.view'
| 'driver_availability.manage'

| 'driver_schedule.view'
| 'driver_schedule.view_team'
| 'driver_schedule.edit'

  | 'morning_driver_availability.view'
  | 'morning_driver_availability.manage'

  | 'morning_driver_schedule.view'
  | 'morning_driver_schedule.view_team'
  | 'morning_driver_schedule.edit'

  | 'notifications.view'
  | 'notifications.manage'

  | 'statistics.view'

  | 'payroll.view'
  | 'payroll.manage'
  | 'attendance.view'
  | 'attendance.manage'

  | 'shift_swaps.view'
  | 'shift_swaps.approve'

  | 'archive.view'

  | 'audit.view'

  | 'users.view'
  | 'users.manage'

  | 'settings.view'
  | 'settings.manage'

  | 'schedule_import.manage';

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  scheduleName: string | null;
  role: UserRole;
  isActive: boolean;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
  hourlyRate?: number | null;
  dailyDutyRate?: number | null;
}

export interface AuthState {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  permissions: PermissionKey[];
  isLoading: boolean;
  permissionsLoaded: boolean;
  error: string | null;
}

export interface SignInCredentials {
  email: string;
  password: string;
  rememberMe: boolean;
}