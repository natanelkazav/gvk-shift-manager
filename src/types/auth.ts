import type { Session, User } from '@supabase/supabase-js';

export type UserRole =
  | 'admin'
  | 'manager'
  | 'dispatcher'
  | 'on_call'
  | 'viewer';

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
  isLoading: boolean;
  error: string | null;
}

export interface SignInCredentials {
  email: string;
  password: string;
}