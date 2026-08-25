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
  hourly_rate: number | null;
  daily_duty_rate: number | null;
  morning_shift_rate: number | null;
}

interface ProfileDatabaseUpdate {
  display_name?: string;
  schedule_name?: string | null;
  role?: UserRole;
  is_active?: boolean;
  must_change_password?: boolean;
  updated_at?: string;
}

interface FunctionErrorResponse {
  error?: string;
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
  updated_at,
  hourly_rate,
  daily_duty_rate,
  morning_shift_rate
`;

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

function buildProfileUpdate(
  input: UpdateUserProfileInput,
): ProfileDatabaseUpdate {
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
      try {
        const body =
          (await context.json()) as
            FunctionErrorResponse;

        if (body.error) {
          return body.error;
        }
      } catch {
        return 'לא ניתן היה לקרוא את תגובת השרת.';
      }
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'אירעה שגיאה בלתי צפויה.';
}

async function getUsers():
  Promise<UserProfile[]> {
  const { data, error } =
    await supabase
      .from('profiles')
      .select(PROFILE_COLUMNS)
      .order('display_name', {
        ascending: true,
      });

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

async function createUser(
  input: CreateUserInput,
): Promise<UserProfile> {
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

  if (error) {
    const errorMessage =
      await getFunctionErrorMessage(
        error,
      );

    throw new Error(errorMessage);
  }

  if (!data?.user) {
    throw new Error(
      'המשתמש נוצר ללא נתוני פרופיל תקינים.',
    );
  }

  return data.user;
}

async function updateUserEmail(
  userId: string,
  email: string,
): Promise<void> {
  const normalizedEmail =
    email
      .trim()
      .toLowerCase();

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

  const {
    data,
    error,
  } =
    await supabase.functions
      .invoke<{
        success: boolean;
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

  if (
    error
  ) {
    throw new Error(
      await getFunctionErrorMessage(
        error,
      ),
    );
  }

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

async function updateUser(
  userId: string,
  input: UpdateUserProfileInput,
): Promise<UserProfile> {
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

  const { data, error } =
    await supabase
      .from('profiles')
      .update(updateData)
      .eq('id', userId)
      .select(PROFILE_COLUMNS)
      .single();

  if (error) {
    console.error(
      'UPDATE USER ERROR:',
      error,
    );

    throw new Error(
      'לא ניתן היה לעדכן את המשתמש.',
    );
  }

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

    const {
      data: refreshedProfile,
      error: refreshedProfileError,
    } = await supabase
      .from('profiles')
      .select(PROFILE_COLUMNS)
      .eq('id', userId)
      .single();

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

async function setUserActiveStatus(
  userId: string,
  isActive: boolean,
): Promise<UserProfile> {
  return updateUser(userId, {
    isActive,
  });
}

async function getUserPermissions(
  userId: string,
): Promise<PermissionKey[]> {
  if (!userId.trim()) {
    throw new Error(
      'לא התקבל מזהה משתמש תקין לטעינת הרשאות.',
    );
  }

  return permissionsService
    .getUserPermissions(userId);
}

async function setUserPermissions(
  userId: string,
  permissions: PermissionKey[],
): Promise<PermissionKey[]> {
  if (!userId.trim()) {
    throw new Error(
      'לא התקבל מזהה משתמש תקין לשמירת הרשאות.',
    );
  }

  const uniquePermissions = [
    ...new Set(permissions),
  ];

  return permissionsService
    .setUserPermissions(
      userId,
      uniquePermissions,
    );
}

async function updateUserCompensation(
  userId: string,
  hourlyRate: number | null,
  dailyDutyRate: number | null,
  morningShiftRate: number | null,
): Promise<void> {
  const normalizedUserId =
    userId.trim();

  if (!normalizedUserId) {
    throw new Error(
      'לא התקבל מזהה משתמש לעדכון השכר.',
    );
  }

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

async function deleteUser(
  input: DeleteUserInput,
): Promise<DeletedUserSummary> {
  const normalizedUserId =
    input.userId.trim();

  if (!normalizedUserId) {
    throw new Error(
      'לא התקבל מזהה משתמש למחיקה.',
    );
  }

  const normalizedReason =
    input.reason?.trim() || null;

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


  if (error) {
    const errorMessage =
      await getFunctionErrorMessage(
        error,
      );

    throw new Error(errorMessage);
  }

  if (!data) {
    throw new Error(
      'פונקציית המחיקה לא החזירה נתונים.',
    );
  }

  if (data.success !== true) {
    throw new Error(
      'השרת לא אישר שמחיקת המשתמש הצליחה.',
    );
  }

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

async function resetUserPassword(
  input:
    ResetUserPasswordInput,
): Promise<ResetUserPasswordResult> {
  const normalizedUserId =
    input.userId.trim();

  if (!normalizedUserId) {
    throw new Error(
      'לא התקבל מזהה משתמש לאיפוס הסיסמה.',
    );
  }

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

  if (error) {
    const errorMessage =
      await getFunctionErrorMessage(
        error,
      );

    throw new Error(
      errorMessage,
    );
  }

  if (!data) {
    throw new Error(
      'פונקציית שליחת קישור האיפוס לא החזירה נתונים.',
    );
  }

  if (data.success !== true) {
    throw new Error(
      'השרת לא אישר ששליחת קישור האיפוס הצליחה.',
    );
  }

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