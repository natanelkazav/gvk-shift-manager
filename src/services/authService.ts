import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type {
  SignInCredentials,
  UserProfile,
  UserRole,
} from '../types/auth';

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
    mustChangePassword: profileRow.must_change_password,
    lastLoginAt: profileRow.last_login_at,
    createdAt: profileRow.created_at,
    updatedAt: profileRow.updated_at,
  };
}

async function signIn({
  email,
  password,
}: SignInCredentials): Promise<Session> {
  const normalizedEmail = email.trim().toLowerCase();

  const { data, error } =
    await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

  if (error) {
    throw new Error(
      'כתובת האימייל או הסיסמה אינם נכונים.',
    );
  }

  if (!data.session) {
    throw new Error(
      'ההתחברות הצליחה, אך לא התקבלה התחברות פעילה.',
    );
  }

  return data.session;
}

async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();

  if (error) {
    throw new Error('לא ניתן היה להתנתק מהמערכת.');
  }
}

async function getCurrentSession(): Promise<Session | null> {
  const { data, error } =
    await supabase.auth.getSession();

  if (error) {
    throw new Error(
      'לא ניתן היה לבדוק את מצב ההתחברות.',
    );
  }

  return data.session;
}

async function getProfile(
  userId: string,
): Promise<UserProfile> {
  const { data, error } = await supabase
    .from('profiles')
    .select(`
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
    `)
    .eq('id', userId)
    .single<ProfileDatabaseRow>();

  if (error) {
    throw new Error(
      'לא ניתן היה לטעון את פרטי המשתמש.',
    );
  }

  const profile = mapProfileRow(data);

  if (!profile.isActive) {
    await supabase.auth.signOut();

    throw new Error(
      'המשתמש אינו פעיל. יש לפנות למנהל המערכת.',
    );
  }

  return profile;
}

export const authService = {
  signIn,
  signOut,
  getCurrentSession,
  getProfile,
};