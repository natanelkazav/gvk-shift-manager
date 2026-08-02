import type {
  Session,
  User,
} from '@supabase/supabase-js';

export type UserRole =
  | 'admin'
  | 'manager'
  | 'dispatcher'
  | 'on_call'
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

  | 'notifications.view'
  | 'notifications.manage'

  | 'statistics.view'

  | 'shift_swaps.view'
  | 'shift_swaps.approve'

  | 'archive.view'

  | 'audit.view'

  | 'users.view'
  | 'users.manage'

  | 'settings.view'
  | 'settings.manage';

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
}

export interface AuthState {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  permissions: PermissionKey[];
  isLoading: boolean;
  error: string | null;
}

export interface SignInCredentials {
  email: string;
  password: string;
}