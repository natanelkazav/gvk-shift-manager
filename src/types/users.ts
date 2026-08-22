import type {
  UserProfile,
  UserRole,
} from './auth';

export interface UsersFilters {
  searchTerm: string;
  role: UserRole | 'all';
  status: 'all' | 'active' | 'inactive';
}

export interface UpdateUserProfileInput {
  email?: string;
  displayName?: string;
  scheduleName?: string | null;
  role?: UserRole;
  isActive?: boolean;
  mustChangePassword?: boolean;
  hourlyRate?: number | null;
  dailyDutyRate?: number | null;
}

export interface CreateUserInput {
  email: string;
  password: string;
  displayName: string;
  scheduleName: string | null;
  role: UserRole;
  isActive: boolean;
  mustChangePassword: boolean;
}

export interface CreateUserResponse {
  user: UserProfile;
}

export interface DeleteUserInput {
  userId: string;
  reason: string | null;
}

export interface DeletedUserSummary {
  id: string;
  email: string;
  displayName: string;
}

export interface DeleteUserResponse {
  success: boolean;
  deletedUser: DeletedUserSummary;
  auditLogged: boolean;
}

export interface UsersState {
  users: UserProfile[];
  isLoading: boolean;
  error: string | null;
}

export interface ResetUserPasswordInput {
  userId: string;
}

export interface ResetUserPasswordResult {
  userId: string;
  email: string;
  displayName: string;
  emailSent: true;
}

export interface ResetUserPasswordResponse {
  success: boolean;
  user: ResetUserPasswordResult;
  auditLogged: boolean;
}
