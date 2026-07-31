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
  displayName?: string;
  scheduleName?: string | null;
  role?: UserRole;
  isActive?: boolean;
  mustChangePassword?: boolean;
}

export interface UsersState {
  users: UserProfile[];
  isLoading: boolean;
  error: string | null;
}