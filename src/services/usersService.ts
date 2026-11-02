/**
 * קובץ: src/services/usersService.ts
 * מטרה: שליפה וניהול משתמשים דרך שירותי מסד ופעולות צד השרת.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: ProfileDatabaseRow, ProfileDatabaseUpdate, FunctionErrorResponse, mapProfileRow, buildProfileUpdate, getFunctionErrorMessage, getUsers, createUser, updateUserEmail, updateUser ועוד.
 * - קריאות RPC המופעלות בקובץ: update_user_compensation.
 * - מקורות נתונים הנזכרים בקריאות from: profiles.
 * - ריכוז הפנייה למקור הנתונים ועיבוד התשובה בהתאם לפונקציות להלן.
 */
import { supabase } from '../lib/supabase';
import { permissionsService } from './permissionsService';
import type {
  PermissionKey,
  UserProfile,
  UserRole,
} from '../types/auth';
import type {
  CreateUserInput,
  CreateUserResponse,
  DeletedUserSummary,
  DeleteUserInput,
  DeleteUserResponse,
  UpdateUserProfileInput,
  ResetUserPasswordInput,
  ResetUserPasswordResponse,
  ResetUserPasswordResult,
} from '../types/users';

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
  hourly_rate: number | null;
  daily_duty_rate: number | null;
  // morning_shift_rate — משמרת.
  morning_shift_rate: number | null;
}

/**
 * חוזה הנתונים ProfileDatabaseUpdate: פרופיל.
 */
interface ProfileDatabaseUpdate {
  // display_name — שם תצוגה (אופציונלי).
  display_name?: string;
  // schedule_name — שיבוץ / שם (אופציונלי).
  schedule_name?: string | null;
  role?: UserRole;
  // is_active — האם הרשומה פעילה (אופציונלי).
  is_active?: boolean;
  // must_change_password — סיסמה (אופציונלי).
  must_change_password?: boolean;
  // updated_at — מועד עדכון (אופציונלי).
  updated_at?: string;
}

/**
 * חוזה הנתונים FunctionErrorResponse: שגיאה / תוצאת הפעולה.
 */
interface FunctionErrorResponse {
  // error — שגיאה (אופציונלי).
  error?: string;
}

// PROFILE_COLUMNS — פרופיל.
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
  updated_at,
  hourly_rate,
  daily_duty_rate,
  morning_shift_rate
`;

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
    hourlyRate:
      profileRow.hourly_rate,
    dailyDutyRate:
      profileRow.daily_duty_rate,
    morningShiftRate:
      profileRow.morning_shift_rate,
  };
}

/**
 * פעולה buildProfileUpdate: הרכבת פרופיל.
 * @param input — קלט.
 * @returns ProfileDatabaseUpdate — הפלט בהתאם לחתימה.
 */
function buildProfileUpdate(
  input: UpdateUserProfileInput,
): ProfileDatabaseUpdate {
  // updateData — נתונים.
  const updateData:
    ProfileDatabaseUpdate = {
      updated_at:
        new Date().toISOString(),
    };

  if (
    input.displayName !== undefined
  ) {
    updateData.display_name =
      input.displayName.trim();
  }

  if (
    input.scheduleName !== undefined
  ) {
    // normalizedScheduleName — שיבוץ / שם.
    const normalizedScheduleName =
      input.scheduleName?.trim() ?? '';

    updateData.schedule_name =
      normalizedScheduleName || null;
  }

  if (input.role !== undefined) {
    updateData.role = input.role;
  }

  if (
    input.isActive !== undefined
  ) {
    updateData.is_active =
      input.isActive;
  }

  if (
    input.mustChangePassword !==
    undefined
  ) {
    updateData.must_change_password =
      input.mustChangePassword;
  }

  return updateData;
}

/**
 * פעולה אסינכרונית getFunctionErrorMessage: שליפה או חישוב של הודעת שגיאה.
 * @param error — שגיאה.
 * @returns Promise<string> — הפלט בהתאם לחתימה.
 */
async function getFunctionErrorMessage(
  error: unknown,
): Promise<string> {
  if (
    typeof error === 'object' &&
    error !== null &&
    'context' in error
  ) {
    const context = (
      error as {
        context?: Response;
      }
    ).context;

    if (
      context instanceof Response
    ) {
      // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
      try {
        // body — תוכן.
        const body =
          (await context.json()) as
            FunctionErrorResponse;

        // טיפול במקרה מיוחד ויציאה מוקדמת כאשר body.error.
        if (body.error) {
          return body.error;
        }
      } catch {
        return 'לא ניתן היה לקרוא את תגובת השרת.';
      }
    }
  }

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר error instanceof Error.
  if (error instanceof Error) {
    return error.message;
  }

  return 'אירעה שגיאה בלתי צפויה.';
}

/**
 * פעולה אסינכרונית getUsers: שליפה או חישוב של משתמשים.
 * @returns Promise<UserProfile[]> — הפלט בהתאם לחתימה.
 */
async function getUsers():
  Promise<UserProfile[]> {
  // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
  const { data, error } =
    await supabase
      .from('profiles')
      .select(PROFILE_COLUMNS)
      .order('display_name', {
        ascending: true,
      });

  // עצירת הפעולה עם שגיאה כאשר error.
  if (error) {
    console.error(
      'GET USERS ERROR:',
      error,
    );

    throw new Error(
      'לא ניתן היה לטעון את רשימת המשתמשים.',
    );
  }

  return (
    (
      data as
        | ProfileDatabaseRow[]
        | null
    ) ?? []
  ).map(mapProfileRow);
}

/**
 * פעולה אסינכרונית createUser: יצירת משתמש.
 * @param input — קלט.
 * @returns Promise<UserProfile> — הפלט בהתאם לחתימה.
 */
async function createUser(
  input: CreateUserInput,
): Promise<UserProfile> {
  // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
  const { data, error } =
    await supabase.functions.invoke<
      CreateUserResponse
    >('create-user', {
      body: {
        email: input.email
          .trim()
          .toLowerCase(),

        password: input.password,

        displayName:
          input.displayName.trim(),

        scheduleName:
          input.scheduleName?.trim() ||
          null,

        role: input.role,

        isActive:
          input.isActive,

        mustChangePassword:
          input.mustChangePassword,
      },
    });

  // עצירת הפעולה עם שגיאה כאשר error.
  if (error) {
    // errorMessage — הודעת שגיאה.
    const errorMessage =
      await getFunctionErrorMessage(
        error,
      );

    throw new Error(errorMessage);
  }

  // עצירת הפעולה עם שגיאה כאשר !data?.user.
  if (!data?.user) {
    throw new Error(
      'המשתמש נוצר ללא נתוני פרופיל תקינים.',
    );
  }

  return data.user;
}

/**
 * פעולה אסינכרונית updateUserEmail: עדכון משתמש / כתובת דוא״ל.
 * @param userId — מזהה משתמש.
 * @param email — כתובת דוא״ל.
 * @returns Promise<void> — הפלט בהתאם לחתימה.
 */
async function updateUserEmail(
  userId: string,
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
      'כתובת האימייל אינה תקינה.',
    );
  }

  // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
  const {
    data,
    error,
  } =
    await supabase.functions
      .invoke<{
        success: boolean;
        // email — כתובת דוא״ל.
        email: string;
      }>(
        'update-user-email',
        {
          body: {
            userId,
            email:
              normalizedEmail,
          },
        },
      );

  // עצירת הפעולה עם שגיאה כאשר error.
  if (
    error
  ) {
    throw new Error(
      await getFunctionErrorMessage(
        error,
      ),
    );
  }

  // עצירת הפעולה עם שגיאה כאשר !data || data.success !== true.
  if (
    !data ||
    data.success !==
      true
  ) {
    throw new Error(
      'השרת לא אישר את עדכון כתובת האימייל.',
    );
  }
}

/**
 * פעולה אסינכרונית updateUser: עדכון משתמש.
 * @param userId — מזהה משתמש.
 * @param input — קלט.
 * @returns Promise<UserProfile> — הפלט בהתאם לחתימה.
 */
async function updateUser(
  userId: string,
  input: UpdateUserProfileInput,
): Promise<UserProfile> {
  // updateData — נתונים.
  const updateData =
    buildProfileUpdate(input);

  if (
    input.email !==
      undefined
  ) {
    await updateUserEmail(
      userId,
      input.email,
    );
  }

  // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
  const { data, error } =
    await supabase
      .from('profiles')
      .update(updateData)
      .eq('id', userId)
      .select(PROFILE_COLUMNS)
      .single();

  // עצירת הפעולה עם שגיאה כאשר error.
  if (error) {
    console.error(
      'UPDATE USER ERROR:',
      error,
    );

    throw new Error(
      'לא ניתן היה לעדכן את המשתמש.',
    );
  }

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר input.hourlyRate !== undefined || input.dailyDutyRate !== undefined || input.morningShiftRate !== undefined.
  if (
    input.hourlyRate !== undefined ||
    input.dailyDutyRate !== undefined ||
    input.morningShiftRate !== undefined
  ) {
    await updateUserCompensation(
      userId,
      input.hourlyRate ?? null,
      input.dailyDutyRate ?? null,
      input.morningShiftRate ?? null,
    );

    // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
    const {
      data: refreshedProfile,
      error: refreshedProfileError,
    } = await supabase
      .from('profiles')
      .select(PROFILE_COLUMNS)
      .eq('id', userId)
      .single();

    // עצירת הפעולה עם שגיאה כאשר refreshedProfileError || !refreshedProfile.
    if (
      refreshedProfileError ||
      !refreshedProfile
    ) {
      throw new Error(
        'השכר נשמר, אך לא ניתן היה לרענן את נתוני המשתמש.',
      );
    }

    return mapProfileRow(
      refreshedProfile as ProfileDatabaseRow,
    );
  }

  return mapProfileRow(
    data as ProfileDatabaseRow,
  );
}

/**
 * פעולה אסינכרונית setUserActiveStatus: קביעת קבוצה ייחודית / משתמש / פעיל / סטטוס.
 * @param userId — מזהה משתמש.
 * @param isActive — האם הרשומה פעילה.
 * @returns Promise<UserProfile> — הפלט בהתאם לחתימה.
 */
async function setUserActiveStatus(
  userId: string,
  isActive: boolean,
): Promise<UserProfile> {
  return updateUser(userId, {
    isActive,
  });
}

/**
 * פעולה אסינכרונית getUserPermissions: שליפה או חישוב של משתמש / הרשאות.
 * @param userId — מזהה משתמש.
 * @returns Promise<PermissionKey[]> — הפלט בהתאם לחתימה.
 */
async function getUserPermissions(
  userId: string,
): Promise<PermissionKey[]> {
  // עצירת הפעולה עם שגיאה כאשר !userId.trim().
  if (!userId.trim()) {
    throw new Error(
      'לא התקבל מזהה משתמש תקין לטעינת הרשאות.',
    );
  }

  return permissionsService
    .getUserPermissions(userId);
}

/**
 * פעולה אסינכרונית setUserPermissions: קביעת קבוצה ייחודית / משתמש / הרשאות.
 * @param userId — מזהה משתמש.
 * @param permissions — הרשאות.
 * @returns Promise<PermissionKey[]> — הפלט בהתאם לחתימה.
 */
async function setUserPermissions(
  userId: string,
  permissions: PermissionKey[],
): Promise<PermissionKey[]> {
  // עצירת הפעולה עם שגיאה כאשר !userId.trim().
  if (!userId.trim()) {
    throw new Error(
      'לא התקבל מזהה משתמש תקין לשמירת הרשאות.',
    );
  }

  // uniquePermissions — הרשאות.
  const uniquePermissions = [
    ...new Set(permissions),
  ];

  return permissionsService
    .setUserPermissions(
      userId,
      uniquePermissions,
    );
}

/**
 * פעולה אסינכרונית updateUserCompensation: עדכון משתמש.
 * הפעולה פונה ל־RPC: update_user_compensation.
 * @param userId — מזהה משתמש.
 * @param hourlyRate — הנתון hourlyRate בהקשר הפעולה.
 * @param dailyDutyRate — הנתון dailyDutyRate בהקשר הפעולה.
 * @param morningShiftRate — משמרת.
 * @returns Promise<void> — הפלט בהתאם לחתימה.
 */
async function updateUserCompensation(
  userId: string,
  hourlyRate: number | null,
  dailyDutyRate: number | null,
  morningShiftRate: number | null,
): Promise<void> {
  // normalizedUserId — מזהה משתמש.
  const normalizedUserId =
    userId.trim();

  // עצירת הפעולה עם שגיאה כאשר !normalizedUserId.
  if (!normalizedUserId) {
    throw new Error(
      'לא התקבל מזהה משתמש לעדכון השכר.',
    );
  }

  // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
  const {
    error,
  } = await supabase.rpc(
    'update_user_compensation',
    {
      target_user_id:
        normalizedUserId,
      requested_hourly_rate:
        hourlyRate,
      requested_daily_duty_rate:
        dailyDutyRate,
      requested_morning_shift_rate:
        morningShiftRate,
    },
  );

  // עצירת הפעולה עם שגיאה כאשר error.
  if (error) {
    console.error(
      'UPDATE USER COMPENSATION ERROR:',
      error,
    );

    throw new Error(
      'לא ניתן היה לשמור את תעריף השכר של המשתמש.',
    );
  }
}

/**
 * פעולה אסינכרונית deleteUser: מחיקת משתמש.
 * @param input — קלט.
 * @returns Promise<DeletedUserSummary> — הפלט בהתאם לחתימה.
 */
async function deleteUser(
  input: DeleteUserInput,
): Promise<DeletedUserSummary> {
  // normalizedUserId — מזהה משתמש.
  const normalizedUserId =
    input.userId.trim();

  // עצירת הפעולה עם שגיאה כאשר !normalizedUserId.
  if (!normalizedUserId) {
    throw new Error(
      'לא התקבל מזהה משתמש למחיקה.',
    );
  }

  // normalizedReason — הנתון normalizedReason בהקשר הפעולה.
  const normalizedReason =
    input.reason?.trim() || null;

  // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
  const { data, error } =
    await supabase.functions.invoke<
      DeleteUserResponse
    >('delete-user', {
      body: {
        userId:
          normalizedUserId,

        reason:
          normalizedReason,
      },
    });


  // עצירת הפעולה עם שגיאה כאשר error.
  if (error) {
    // errorMessage — הודעת שגיאה.
    const errorMessage =
      await getFunctionErrorMessage(
        error,
      );

    throw new Error(errorMessage);
  }

  // עצירת הפעולה עם שגיאה כאשר !data.
  if (!data) {
    throw new Error(
      'פונקציית המחיקה לא החזירה נתונים.',
    );
  }

  // עצירת הפעולה עם שגיאה כאשר data.success !== true.
  if (data.success !== true) {
    throw new Error(
      'השרת לא אישר שמחיקת המשתמש הצליחה.',
    );
  }

  // עצירת הפעולה עם שגיאה כאשר !data.deletedUser.
  if (!data.deletedUser) {
    throw new Error(
      'המשתמש נמחק, אך פרטי המשתמש שנמחק לא הוחזרו מהשרת.',
    );
  }

  if (!data.auditLogged) {
    console.warn(
      'המשתמש נמחק, אך רישום הפעולה ביומן המערכת נכשל.',
    );
  }

  return data.deletedUser;
}

/**
 * פעולה אסינכרונית resetUserPassword: איפוס משתמש / סיסמה.
 * @param input — קלט.
 * @returns Promise<ResetUserPasswordResult> — הפלט בהתאם לחתימה.
 */
async function resetUserPassword(
  input:
    ResetUserPasswordInput,
): Promise<ResetUserPasswordResult> {
  // normalizedUserId — מזהה משתמש.
  const normalizedUserId =
    input.userId.trim();

  // עצירת הפעולה עם שגיאה כאשר !normalizedUserId.
  if (!normalizedUserId) {
    throw new Error(
      'לא התקבל מזהה משתמש לאיפוס הסיסמה.',
    );
  }

  // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
  const {
    data,
    error,
  } =
    await supabase.functions.invoke<
      ResetUserPasswordResponse
    >(
      'reset-user-password',
      {
        body: {
          userId:
            normalizedUserId,
        },
      },
    );

  // עצירת הפעולה עם שגיאה כאשר error.
  if (error) {
    // errorMessage — הודעת שגיאה.
    const errorMessage =
      await getFunctionErrorMessage(
        error,
      );

    throw new Error(
      errorMessage,
    );
  }

  // עצירת הפעולה עם שגיאה כאשר !data.
  if (!data) {
    throw new Error(
      'פונקציית שליחת קישור האיפוס לא החזירה נתונים.',
    );
  }

  // עצירת הפעולה עם שגיאה כאשר data.success !== true.
  if (data.success !== true) {
    throw new Error(
      'השרת לא אישר ששליחת קישור האיפוס הצליחה.',
    );
  }

  // עצירת הפעולה עם שגיאה כאשר !data.user.
  if (!data.user) {
    throw new Error(
      'קישור האיפוס נשלח, אך נתוני המשתמש לא הוחזרו מהשרת.',
    );
  }

  if (!data.auditLogged) {
    console.warn(
      'קישור האיפוס נשלח, אך רישום הפעולה ביומן המערכת נכשל.',
    );
  }

  return data.user;
}

// usersService — משתמשים / שירות.
export const usersService = {
  getUsers,
  createUser,
  updateUser,
  setUserActiveStatus,
  getUserPermissions,
  setUserPermissions,
  updateUserCompensation,
  deleteUser,
  resetUserPassword,
};