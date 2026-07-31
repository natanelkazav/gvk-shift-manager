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
    displayName:
      profileRow.display_name,
    scheduleName:
      profileRow.schedule_name,
    role: profileRow.role,
    isActive:
      profileRow.is_active,
    mustChangePassword:
      profileRow.must_change_password,
    lastLoginAt:
      profileRow.last_login_at,
    createdAt:
      profileRow.created_at,
    updatedAt:
      profileRow.updated_at,
  };
}

async function signIn({
  email,
  password,
}: SignInCredentials): Promise<Session> {
  const normalizedEmail =
    email.trim().toLowerCase();

  const { data, error } =
    await supabase.auth
      .signInWithPassword({
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
  const { error } =
    await supabase.auth.signOut();

  if (error) {
    throw new Error(
      'לא ניתן היה להתנתק מהמערכת.',
    );
  }
}

async function getCurrentSession():
  Promise<Session | null> {
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
  const { data, error } =
    await supabase
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

  return mapProfileRow(data);
}
async function recordLogin():
  Promise<string> {
  const {
    data,
    error,
  } = await supabase.rpc(
    'record_user_login',
  );

  if (error) {
    console.error(
      'RECORD USER LOGIN ERROR:',
      error,
    );

    throw new Error(
      'לא ניתן היה לעדכן את זמן ההתחברות האחרון.',
    );
  }

  if (
    typeof data !== 'string' ||
    !data
  ) {
    throw new Error(
      'השרת לא החזיר זמן התחברות תקין.',
    );
  }

  return data;
}
async function changePassword(
  userId: string,
  newPassword: string,
): Promise<void> {
  const normalizedPassword =
    newPassword.trim();

  if (normalizedPassword.length < 8) {
    throw new Error(
      'הסיסמה החדשה חייבת להכיל לפחות שמונה תווים.',
    );
  }

  const {
    data: {
      user: authenticatedUser,
    },
    error: getUserError,
  } = await supabase.auth.getUser();

  if (
    getUserError ||
    !authenticatedUser
  ) {
    throw new Error(
      'לא נמצאה התחברות פעילה. יש להתחבר מחדש.',
    );
  }

  if (
    authenticatedUser.id !== userId
  ) {
    throw new Error(
      'לא ניתן לעדכן סיסמה עבור משתמש אחר.',
    );
  }

  const {
    error: passwordUpdateError,
  } = await supabase.auth.updateUser({
    password: normalizedPassword,
  });

  if (passwordUpdateError) {
    console.error(
      'PASSWORD UPDATE ERROR:',
      passwordUpdateError,
    );

    throw new Error(
      'לא ניתן היה לעדכן את הסיסמה. ודא שהסיסמה עומדת בדרישות המערכת.',
    );
  }

  const {
    data: completionResult,
    error: completionError,
  } = await supabase.rpc(
    'complete_initial_password_change',
  );

  if (
    completionError ||
    completionResult !== true
  ) {
    console.error(
      'PASSWORD CHANGE COMPLETION ERROR:',
      completionError,
    );

    throw new Error(
      'הסיסמה עודכנה, אך לא ניתן היה להשלים את תהליך שינוי הסיסמה.',
    );
  }

  const {
    data: updatedProfile,
    error: verificationError,
  } = await supabase
    .from('profiles')
    .select('must_change_password')
    .eq('id', userId)
    .single<{
      must_change_password: boolean;
    }>();

  if (
    verificationError ||
    !updatedProfile
  ) {
    console.error(
      'PROFILE VERIFICATION ERROR:',
      verificationError,
    );

    throw new Error(
      'הסיסמה עודכנה, אך לא ניתן היה לאמת את פרופיל המשתמש.',
    );
  }

  if (
    updatedProfile.must_change_password
  ) {
    throw new Error(
      'הסיסמה עודכנה, אך המשתמש עדיין מסומן כמי שנדרש לשנות סיסמה.',
    );
  }
}

export const authService = {
  signIn,
  signOut,
  getCurrentSession,
  getProfile,
  recordLogin,
  changePassword,
};