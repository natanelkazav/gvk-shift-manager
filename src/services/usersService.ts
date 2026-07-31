import { supabase } from '../lib/supabase';
import type {
  UserProfile,
  UserRole,
} from '../types/auth';
import type {
  UpdateUserProfileInput,
} from '../types/users';

interface ProfileDatabaseRow {
  id: string;
  email: string;
  display_name: string;
  schedule_name: string | null;
  role: UserRole;
  is_active: boolean;
  must_change_password: boolean;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

interface ProfileDatabaseUpdate {
  display_name?: string;
  schedule_name?: string | null;
  role?: UserRole;
  is_active?: boolean;
  must_change_password?: boolean;
  updated_at?: string;
}

const PROFILE_COLUMNS = `
  id,
  email,
  display_name,
  schedule_name,
  role,
  is_active,
  must_change_password,
  last_login_at,
  created_at,
  updated_at
`;

function mapProfileRow(
  profileRow: ProfileDatabaseRow,
): UserProfile {
  return {
    id: profileRow.id,
    email: profileRow.email,
    displayName: profileRow.display_name,
    scheduleName: profileRow.schedule_name,
    role: profileRow.role,
    isActive: profileRow.is_active,
    mustChangePassword:
      profileRow.must_change_password,
    lastLoginAt: profileRow.last_login_at,
    createdAt: profileRow.created_at,
    updatedAt: profileRow.updated_at,
  };
}

function buildProfileUpdate(
  input: UpdateUserProfileInput,
): ProfileDatabaseUpdate {
  const updateData: ProfileDatabaseUpdate = {
    updated_at: new Date().toISOString(),
  };

  if (input.displayName !== undefined) {
    updateData.display_name =
      input.displayName.trim();
  }

  if (input.scheduleName !== undefined) {
    const normalizedScheduleName =
      input.scheduleName?.trim() ?? '';

    updateData.schedule_name =
      normalizedScheduleName || null;
  }

  if (input.role !== undefined) {
    updateData.role = input.role;
  }

  if (input.isActive !== undefined) {
    updateData.is_active = input.isActive;
  }

  if (
    input.mustChangePassword !== undefined
  ) {
    updateData.must_change_password =
      input.mustChangePassword;
  }

  return updateData;
}

async function getUsers(): Promise<UserProfile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .order('display_name', {
      ascending: true,
    });

  if (error) {
    throw new Error(
      'לא ניתן היה לטעון את רשימת המשתמשים.',
    );
  }

  return (
    (data as ProfileDatabaseRow[] | null) ?? []
  ).map(mapProfileRow);
}

async function updateUser(
  userId: string,
  input: UpdateUserProfileInput,
): Promise<UserProfile> {
  const updateData =
    buildProfileUpdate(input);

  const { data, error } = await supabase
    .from('profiles')
    .update(updateData)
    .eq('id', userId)
    .select(PROFILE_COLUMNS)
    .single();

  if (error) {
    throw new Error(
      'לא ניתן היה לעדכן את המשתמש.',
    );
  }

  return mapProfileRow(
    data as ProfileDatabaseRow,
  );
}

async function setUserActiveStatus(
  userId: string,
  isActive: boolean,
): Promise<UserProfile> {
  return updateUser(userId, {
    isActive,
  });
}

export const usersService = {
  getUsers,
  updateUser,
  setUserActiveStatus,
};