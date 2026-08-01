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
  updated_at
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

async function updateUser(
  userId: string,
  input: UpdateUserProfileInput,
): Promise<UserProfile> {
  const updateData =
    buildProfileUpdate(input);

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
export const usersService = {
  getUsers,
  createUser,
  updateUser,
  setUserActiveStatus,
  getUserPermissions,
  setUserPermissions,
  deleteUser,
};