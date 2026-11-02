/**
 * קובץ: src/services/authService.ts
 * מטרה: התחברות והתנתקות, טעינת סשן ופרופיל והמרת שגיאות אימות להודעות יישום.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: ProfileDatabaseRow, mapProfileRow, signIn, signOut, getCurrentSession, getProfile, recordLogin, changePassword, requestPasswordReset.
 * - קריאות RPC המופעלות בקובץ: record_user_login, complete_initial_password_change.
 * - מקורות נתונים הנזכרים בקריאות from: profiles.
 * - ריכוז הפנייה למקור הנתונים ועיבוד התשובה בהתאם לפונקציות להלן.
 */
import type { Session } from '@supabase/supabase-js';
import {
  setRememberMePreference,
  supabase,
} from '../lib/supabase';
import type {
  SignInCredentials,
  UserProfile,
  UserRole,
} from '../types/auth';

/**
 * חוזה הנתונים ProfileDatabaseRow: פרופיל / שורה.
 */
interface ProfileDatabaseRow {
  // id — מזהה.
  id: string;
  // email — כתובת דוא״ל.
  email: string;
  // display_name — שם תצוגה.
  display_name: string;
  // schedule_name — שיבוץ / שם.
  schedule_name: string | null;
  role: UserRole;
  // is_active — האם הרשומה פעילה.
  is_active: boolean;
  // must_change_password — סיסמה.
  must_change_password: boolean;
  last_login_at: string | null;
  // created_at — מועד יצירה.
  created_at: string;
  // updated_at — מועד עדכון.
  updated_at: string;
}

/**
 * פעולה mapProfileRow: המרת שמות עמודות snake_case של הפרופיל למאפייני camelCase של היישום.
 * @param profileRow — פרופיל / שורה.
 * @returns UserProfile — הפלט בהתאם לחתימה.
 */
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

/**
 * פעולה אסינכרונית signIn: שמירת העדפת זכירת התחברות, נרמול כתובת הדוא״ל ובקשת סשן באמצעות סיסמה.
 * פרמטר מפורק — שדות הקלט נגישים מקומית בשמות המוגדרים בחתימה.
 * @returns Promise<Session> — הפלט בהתאם לחתימה.
 */
async function signIn({
  email,
  password,
  rememberMe,
}: SignInCredentials): Promise<Session> {
  setRememberMePreference(
    rememberMe,
  );
  // normalizedEmail — כתובת דוא״ל.
  const normalizedEmail =
    email.trim().toLowerCase();

  // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
  const { data, error } =
    await supabase.auth
      .signInWithPassword({
        email: normalizedEmail,
        password,
      });

  // עצירת הפעולה עם שגיאה כאשר error.
  if (error) {
    throw new Error(
      'כתובת האימייל או הסיסמה אינם נכונים.',
    );
  }

  // עצירת הפעולה עם שגיאה כאשר !data.session.
  if (!data.session) {
    throw new Error(
      'ההתחברות הצליחה, אך לא התקבלה התחברות פעילה.',
    );
  }

  return data.session;
}

/**
 * פעולה אסינכרונית signOut: בקשת התנתקות מ־Supabase והמרת כשל להודעת שגיאה בעברית.
 * @returns Promise<void> — הפלט בהתאם לחתימה.
 */
async function signOut(): Promise<void> {
  // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
  const { error } =
    await supabase.auth.signOut();

  // עצירת הפעולה עם שגיאה כאשר error.
  if (error) {
    throw new Error(
      'לא ניתן היה להתנתק מהמערכת.',
    );
  }
}

/**
 * פעולה אסינכרונית getCurrentSession: שליפת הסשן הנוכחי והחזרת null כאשר אין סשן.
 * @returns Promise<Session | null> — הפלט בהתאם לחתימה.
 */
async function getCurrentSession():
  Promise<Session | null> {
  // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
  const { data, error } =
    await supabase.auth.getSession();

  // עצירת הפעולה עם שגיאה כאשר error.
  if (error) {
    throw new Error(
      'לא ניתן היה לבדוק את מצב ההתחברות.',
    );
  }

  return data.session;
}

/**
 * פעולה אסינכרונית getProfile: שליפה או חישוב של פרופיל.
 * @param userId — מזהה משתמש.
 * @returns Promise<UserProfile> — הפלט בהתאם לחתימה.
 */
async function getProfile(
  userId: string,
): Promise<UserProfile> {
  // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
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

  // עצירת הפעולה עם שגיאה כאשר error.
  if (error) {
    throw new Error(
      'לא ניתן היה לטעון את פרטי המשתמש.',
    );
  }

  return mapProfileRow(data);
}
/**
 * פעולה אסינכרונית recordLogin: הנתון recordLogin בהקשר הפעולה.
 * הפעולה פונה ל־RPC: record_user_login.
 * @returns Promise<string> — הפלט בהתאם לחתימה.
 */
async function recordLogin():
  Promise<string> {
  // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
  const {
    data,
    error,
  } = await supabase.rpc(
    'record_user_login',
  );

  // עצירת הפעולה עם שגיאה כאשר error.
  if (error) {
    console.error(
      'RECORD USER LOGIN ERROR:',
      error,
    );

    throw new Error(
      'לא ניתן היה לעדכן את זמן ההתחברות האחרון.',
    );
  }

  // עצירת הפעולה עם שגיאה כאשר typeof data !== 'string' || !data.
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
/**
 * פעולה אסינכרונית changePassword: סיסמה.
 * הפעולה פונה ל־RPC: complete_initial_password_change.
 * @param userId — מזהה משתמש.
 * @param newPassword — סיסמה.
 * @returns Promise<void> — הפלט בהתאם לחתימה.
 */
async function changePassword(
  userId: string,
  newPassword: string,
): Promise<void> {
  // normalizedPassword — סיסמה.
  const normalizedPassword =
    newPassword.trim();

  // עצירת הפעולה עם שגיאה כאשר normalizedPassword.length < 8.
  if (normalizedPassword.length < 8) {
    throw new Error(
      'הסיסמה החדשה חייבת להכיל לפחות שמונה תווים.',
    );
  }

  // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
  const {
    data: {
      user: authenticatedUser,
    },
    error: getUserError,
  } = await supabase.auth.getUser();

  // עצירת הפעולה עם שגיאה כאשר getUserError || !authenticatedUser.
  if (
    getUserError ||
    !authenticatedUser
  ) {
    throw new Error(
      'לא נמצאה התחברות פעילה. יש להתחבר מחדש.',
    );
  }

  // עצירת הפעולה עם שגיאה כאשר authenticatedUser.id !== userId.
  if (
    authenticatedUser.id !== userId
  ) {
    throw new Error(
      'לא ניתן לעדכן סיסמה עבור משתמש אחר.',
    );
  }

  // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
  const {
    error: passwordUpdateError,
  } = await supabase.auth.updateUser({
    password: normalizedPassword,
  });

  // עצירת הפעולה עם שגיאה כאשר passwordUpdateError.
  if (passwordUpdateError) {
    console.error(
      'PASSWORD UPDATE ERROR:',
      passwordUpdateError,
    );

    throw new Error(
      'לא ניתן היה לעדכן את הסיסמה. ודא שהסיסמה עומדת בדרישות המערכת.',
    );
  }

  // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
  const {
    data: completionResult,
    error: completionError,
  } = await supabase.rpc(
    'complete_initial_password_change',
  );

  // עצירת הפעולה עם שגיאה כאשר completionError || completionResult !== true.
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

  // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
  const {
    data: updatedProfile,
    error: verificationError,
  } = await supabase
    .from('profiles')
    .select('must_change_password')
    .eq('id', userId)
    .single<{
      // must_change_password — סיסמה.
      must_change_password: boolean;
    }>();

  // עצירת הפעולה עם שגיאה כאשר verificationError || !updatedProfile.
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

  // עצירת הפעולה עם שגיאה כאשר updatedProfile.must_change_password.
  if (
    updatedProfile.must_change_password
  ) {
    throw new Error(
      'הסיסמה עודכנה, אך המשתמש עדיין מסומן כמי שנדרש לשנות סיסמה.',
    );
  }
}


/**
 * פעולה אסינכרונית requestPasswordReset: נתוני הבקשה / סיסמה.
 * @param email — כתובת דוא״ל.
 * @returns Promise<void> — הפלט בהתאם לחתימה.
 */
async function requestPasswordReset(
  email: string,
): Promise<void> {
  // normalizedEmail — כתובת דוא״ל.
  const normalizedEmail =
    email
      .trim()
      .toLowerCase();

  // עצירת הפעולה עם שגיאה כאשר !normalizedEmail || !normalizedEmail.includes( '@', ).
  if (
    !normalizedEmail ||
    !normalizedEmail.includes(
      '@',
    )
  ) {
    throw new Error(
      'יש להזין כתובת אימייל תקינה.',
    );
  }

  // redirectUrl — כתובת יעד.
  const redirectUrl =
    `${window.location.origin}/reset-password`;

  // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
  const {
    error,
  } =
    await supabase.auth
      .resetPasswordForEmail(
        normalizedEmail,
        {
          redirectTo:
            redirectUrl,
        },
      );

  // עצירת הפעולה עם שגיאה כאשר error.
  if (
    error
  ) {
    console.error(
      'PASSWORD RESET REQUEST ERROR:',
      error,
    );

    /*
     * בכוונה לא חושפים למשתמש האם
     * כתובת האימייל קיימת במערכת.
     */
    throw new Error(
      'לא ניתן היה לשלוח כרגע את בקשת האיפוס. נסה שוב מאוחר יותר.',
    );
  }
}

// authService — אימות משתמשים / שירות.
export const authService = {
  signIn,
  signOut,
  getCurrentSession,
  getProfile,
  recordLogin,
  changePassword,
  requestPasswordReset,
};