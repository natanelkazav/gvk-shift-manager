/**
 * קובץ: src/hooks/useUsers.ts
 * מטרה: ניהול מצב ותופעות לוואי באמצעות React עבור משתמשים.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: UsersStatisticsData, UserPermissionsState, UseUsersOptions, UseUsersResult, getErrorMessage, sortUsersByDisplayName, useUsers.
 * - ריכוז ההגדרות והלוגיקה המפורטות בהמשך הקובץ.
 */
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { usersService } from '../services/usersService';
import { accountTypeFromLegacyRole } from '../config/systemAccountTypes';
import type {
  PermissionKey,
  UserProfile,
} from '../types/auth';
import type {
  CreateUserInput,
  DeleteUserInput,
  UpdateUserProfileInput,
  UsersFilters,
  UsersState,
  ResetUserPasswordResult,
} from '../types/users';

/**
 * חוזה הנתונים UsersStatisticsData: משתמשים / סטטיסטיקה / נתונים.
 */
interface UsersStatisticsData {
  // total — סך הכול.
  total: number;
  // active — פעיל.
  active: number;
  inactive: number;
  admins: number;
}

/**
 * חוזה הנתונים UserPermissionsState: משתמש / הרשאות / מצב.
 */
interface UserPermissionsState {
  // userId — מזהה משתמש.
  userId: string | null;
  // permissions — הרשאות.
  permissions: PermissionKey[];
  // isLoading — האם טעינה מתבצעת.
  isLoading: boolean;
  // isSaving — האם שמירה מתבצעת.
  isSaving: boolean;
  // error — שגיאה.
  error: string | null;
}

/**
 * חוזה הנתונים UseUsersOptions: משתמשים / אפשרויות בחירה.
 */
interface UseUsersOptions {
  // authenticatedUserId — מזהה משתמש.
  authenticatedUserId: string | null;

  // refreshAuthenticatedProfile — פרופיל.
  refreshAuthenticatedProfile:
    () => Promise<void>;

  // refreshAuthenticatedPermissions — הרשאות (אופציונלי).
  refreshAuthenticatedPermissions?:
    () => Promise<void>;

  // filters — מסננים.
  filters: UsersFilters;
}

/**
 * חוזה הנתונים UseUsersResult: משתמשים / תוצאה.
 */
interface UseUsersResult {
  // usersState — משתמשים / מצב.
  usersState: UsersState;
  // filteredUsers — משתמשים.
  filteredUsers: UserProfile[];
  // statistics — סטטיסטיקה.
  statistics: UsersStatisticsData;
  // updatingUserId — מזהה משתמש.
  updatingUserId: string | null;
  // deletingUserId — מזהה משתמש.
  deletingUserId: string | null;
  // resettingPasswordUserId — מזהה משתמש.
  resettingPasswordUserId:
    string | null;
  // isCreatingUser — משתמש.
  isCreatingUser: boolean;

  // lastResetPasswordResult — סיסמה / תוצאה.
  lastResetPasswordResult:
    ResetUserPasswordResult | null;

  // userPermissionsState — משתמש / הרשאות / מצב.
  userPermissionsState:
    UserPermissionsState;

  // loadUsers — משתמשים.
  loadUsers: () => Promise<void>;

  // createUser — משתמש.
  createUser: (
    input: CreateUserInput,
  ) => Promise<UserProfile>;

  // updateUser — משתמש.
  updateUser: (
    userId: string,
    input: UpdateUserProfileInput,
  ) => Promise<UserProfile>;

  // toggleActiveStatus — פעיל / סטטוס.
  toggleActiveStatus: (
    profile: UserProfile,
  ) => Promise<void>;

  // deleteUser — משתמש.
  deleteUser: (
    input: DeleteUserInput,
  ) => Promise<void>;

  // resetUserPassword — משתמש / סיסמה.
  resetUserPassword: (
    userId: string,
  ) => Promise<ResetUserPasswordResult>;

  // loadUserPermissions — משתמש / הרשאות.
  loadUserPermissions: (
    userId: string,
  ) => Promise<PermissionKey[]>;

  // saveUserPermissions — משתמש / הרשאות.
  saveUserPermissions: (
    userId: string,
    permissions: PermissionKey[],
  ) => Promise<PermissionKey[]>;

  // resetUserPermissionsState — משתמש / הרשאות / מצב.
  resetUserPermissionsState:
    () => void;

  // clearError — שגיאה.
  clearError: () => void;
}

// initialUsersState — משתמשים / מצב.
const initialUsersState: UsersState = {
  users: [],
  isLoading: true,
  error: null,
};

// initialUserPermissionsState — משתמש / הרשאות / מצב.
const initialUserPermissionsState:
  UserPermissionsState = {
    userId: null,
    permissions: [],
    isLoading: false,
    isSaving: false,
    error: null,
  };

/**
 * פעולה getErrorMessage: שליפה או חישוב של הודעת שגיאה.
 * @param error — שגיאה.
 * @param fallbackMessage — הודעה.
 * @returns string — הפלט בהתאם לחתימה.
 */
function getErrorMessage(
  error: unknown,
  fallbackMessage: string,
): string {
  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר error instanceof Error.
  if (error instanceof Error) {
    return error.message;
  }

  return fallbackMessage;
}

/**
 * פעולה sortUsersByDisplayName: מיון שם תצוגה.
 * @param users — משתמשים.
 * @returns UserProfile[] — הפלט בהתאם לחתימה.
 */
function sortUsersByDisplayName(
  users: UserProfile[],
): UserProfile[] {
  return [...users].sort(
    (
      firstUser,
      secondUser,
    ) =>
      firstUser.displayName
        .localeCompare(
          secondUser.displayName,
          'he',
        ),
  );
}

/**
 * פעולה useUsers: חיבור מצב או הקשר עבור משתמשים.
 * פרמטר מפורק — שדות הקלט נגישים מקומית בשמות המוגדרים בחתימה.
 * @returns UseUsersResult — הפלט בהתאם לחתימה.
 */
export function useUsers({
  authenticatedUserId,
  refreshAuthenticatedProfile,
  refreshAuthenticatedPermissions,
  filters,
}: UseUsersOptions): UseUsersResult {
  // מצב מקומי: usersState — משתמשים / מצב; setUsersState מעדכנת אותו ומפעילה רינדור לפי React.
  const [
    usersState,
    setUsersState,
  ] = useState<UsersState>(
    initialUsersState,
  );

  // מצב מקומי: updatingUserId — מזהה משתמש; setUpdatingUserId מעדכנת אותו ומפעילה רינדור לפי React.
  const [
    updatingUserId,
    setUpdatingUserId,
  ] = useState<string | null>(null);

  // מצב מקומי: deletingUserId — מזהה משתמש; setDeletingUserId מעדכנת אותו ומפעילה רינדור לפי React.
  const [
    deletingUserId,
    setDeletingUserId,
  ] = useState<string | null>(null);

  // מצב מקומי: isCreatingUser — משתמש; setIsCreatingUser מעדכנת אותו ומפעילה רינדור לפי React.
  const [
    isCreatingUser,
    setIsCreatingUser,
  ] = useState(false);

  // מצב מקומי: resettingPasswordUserId — מזהה משתמש; setResettingPasswordUserId מעדכנת אותו ומפעילה רינדור לפי React.
  const [
    resettingPasswordUserId,
    setResettingPasswordUserId,
  ] =
    useState<string | null>(
      null,
    );

  // מצב מקומי: lastResetPasswordResult — סיסמה / תוצאה; setLastResetPasswordResult מעדכנת אותו ומפעילה רינדור לפי React.
  const [
    lastResetPasswordResult,
    setLastResetPasswordResult,
  ] =
    useState<ResetUserPasswordResult | null>(
      null,
    );

  // מצב מקומי: userPermissionsState — משתמש / הרשאות / מצב; setUserPermissionsState מעדכנת אותו ומפעילה רינדור לפי React.
  const [
    userPermissionsState,
    setUserPermissionsState,
  ] =
    useState<UserPermissionsState>(
      initialUserPermissionsState,
    );

  // הפניה יציבה permissionsRequestIdRef בין רינדורים; שינוי current אינו מפעיל רינדור בפני עצמו.
  const permissionsRequestIdRef =
    useRef(0);

  // clearError — שגיאה.
  const clearError =
    useCallback((): void => {
      setUsersState(
        (currentState) => ({
          ...currentState,
          error: null,
        }),
      );
    }, []);

  // resetUserPermissionsState — משתמש / הרשאות / מצב.
  const resetUserPermissionsState =
    useCallback((): void => {
      permissionsRequestIdRef.current +=
        1;

      setUserPermissionsState(
        initialUserPermissionsState,
      );
    }, []);

  // updateLocalUser — משתמש.
  const updateLocalUser =
    useCallback(
      (
        updatedProfile: UserProfile,
      ): void => {
        setUsersState(
          (currentState) => ({
            ...currentState,

            users:
              currentState.users.map(
                (existingProfile) =>
                  existingProfile.id ===
                  updatedProfile.id
                    ? updatedProfile
                    : existingProfile,
              ),

            error: null,
          }),
        );
      },
      [],
    );

  // addLocalUser — משתמש.
  const addLocalUser =
    useCallback(
      (
        createdProfile: UserProfile,
      ): void => {
        setUsersState(
          (currentState) => ({
            ...currentState,

            users:
              sortUsersByDisplayName([
                ...currentState.users,
                createdProfile,
              ]),

            error: null,
          }),
        );
      },
      [],
    );

  // removeLocalUser — משתמש.
  const removeLocalUser =
    useCallback(
      (
        deletedUserId: string,
      ): void => {
        setUsersState(
          (currentState) => ({
            ...currentState,

            users:
              currentState.users.filter(
                (profile) =>
                  profile.id !==
                  deletedUserId,
              ),

            error: null,
          }),
        );
      },
      [],
    );

  // loadUsers — משתמשים.
  const loadUsers =
    useCallback(
      async (): Promise<void> => {
        setUsersState(
          (currentState) => ({
            ...currentState,
            isLoading: true,
            error: null,
          }),
        );

        // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
        try {
          // users — משתמשים.
          const users =
            await usersService
              .getUsers();

          setUsersState({
            users,
            isLoading: false,
            error: null,
          });
        } catch (error) {
          setUsersState(
            (currentState) => ({
              ...currentState,

              isLoading: false,

              error:
                getErrorMessage(
                  error,
                  'אירעה שגיאה בטעינת המשתמשים.',
                ),
            }),
          );
        }
      },
      [],
    );

  // תופעת לוואי לאחר רינדור בהתאם לתלויות [loadUsers].
  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  // createUser — משתמש.
  const createUser =
    useCallback(
      async (
        input: CreateUserInput,
      ): Promise<UserProfile> => {
        setIsCreatingUser(true);
        clearError();

        // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
        try {
          // createdProfile — פרופיל.
          const createdProfile =
            await usersService
              .createUser(input);

          addLocalUser(
            createdProfile,
          );

          return createdProfile;
        } catch (error) {
          // errorMessage — הודעת שגיאה.
          const errorMessage =
            getErrorMessage(
              error,
              'לא ניתן היה ליצור את המשתמש.',
            );

          setUsersState(
            (currentState) => ({
              ...currentState,
              error: errorMessage,
            }),
          );

          throw error;
        } finally {
          setIsCreatingUser(false);
        }
      },
      [
        addLocalUser,
        clearError,
      ],
    );

  // updateUser — משתמש.
  const updateUser =
    useCallback(
      async (
        userId: string,
        input:
          UpdateUserProfileInput,
      ): Promise<UserProfile> => {
        setUpdatingUserId(userId);
        clearError();

        // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
        try {
          // עצירת הפעולה עם שגיאה כאשר userId === authenticatedUserId && input.isActive === false.
          if (
            userId ===
              authenticatedUserId &&
            input.isActive === false
          ) {
            throw new Error(
              'לא ניתן להשבית את המשתמש המחובר כעת.',
            );
          }

          // updatedProfile — פרופיל.
          const updatedProfile =
            await usersService
              .updateUser(
                userId,
                input,
              );

          updateLocalUser(
            updatedProfile,
          );

          if (
            updatedProfile.id ===
            authenticatedUserId
          ) {
            await refreshAuthenticatedProfile();
          }

          return updatedProfile;
        } catch (error) {
          // errorMessage — הודעת שגיאה.
          const errorMessage =
            getErrorMessage(
              error,
              'לא ניתן היה לעדכן את המשתמש.',
            );

          setUsersState(
            (currentState) => ({
              ...currentState,
              error: errorMessage,
            }),
          );

          throw error;
        } finally {
          setUpdatingUserId(null);
        }
      },
      [
        authenticatedUserId,
        clearError,
        refreshAuthenticatedProfile,
        updateLocalUser,
      ],
    );

  // toggleActiveStatus — פעיל / סטטוס.
  const toggleActiveStatus =
    useCallback(
      async (
        profile: UserProfile,
      ): Promise<void> => {
        // טיפול במקרה מיוחד ויציאה מוקדמת כאשר profile.id === authenticatedUserId.
        if (
          profile.id ===
          authenticatedUserId
        ) {
          setUsersState(
            (currentState) => ({
              ...currentState,

              error:
                'לא ניתן להשבית את המשתמש המחובר כעת.',
            }),
          );

          return;
        }

        // actionLabel — תווית.
        const actionLabel =
          profile.isActive
            ? 'להשבית'
            : 'להפעיל';

        const confirmed =
          window.confirm(
            `האם אתה בטוח שברצונך ${actionLabel} את המשתמש ${profile.displayName}?`,
          );

        // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !confirmed.
        if (!confirmed) {
          return;
        }

        setUpdatingUserId(
          profile.id,
        );

        clearError();

        // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
        try {
          // updatedProfile — פרופיל.
          const updatedProfile =
            await usersService
              .setUserActiveStatus(
                profile.id,
                !profile.isActive,
              );

          updateLocalUser(
            updatedProfile,
          );
        } catch (error) {
          setUsersState(
            (currentState) => ({
              ...currentState,

              error:
                getErrorMessage(
                  error,
                  'לא ניתן היה לעדכן את המשתמש.',
                ),
            }),
          );
        } finally {
          setUpdatingUserId(null);
        }
      },
      [
        authenticatedUserId,
        clearError,
        updateLocalUser,
      ],
    );

  // deleteUser — משתמש.
  const deleteUser =
    useCallback(
      async (
        input: DeleteUserInput,
      ): Promise<void> => {
        // עצירת הפעולה עם שגיאה כאשר input.userId === authenticatedUserId.
        if (
          input.userId ===
          authenticatedUserId
        ) {
          throw new Error(
            'לא ניתן למחוק את המשתמש המחובר כעת.',
          );
        }

        setDeletingUserId(
          input.userId,
        );

        clearError();

        // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
        try {
          // deletedUser — משתמש.
          const deletedUser =
            await usersService
              .deleteUser(input);

          removeLocalUser(
            deletedUser.id,
          );
        } catch (error) {
          // errorMessage — הודעת שגיאה.
          const errorMessage =
            getErrorMessage(
              error,
              'לא ניתן היה למחוק את המשתמש.',
            );

          setUsersState(
            (currentState) => ({
              ...currentState,
              error: errorMessage,
            }),
          );

          throw error;
        } finally {
          setDeletingUserId(null);
        }
      },
      [
        authenticatedUserId,
        clearError,
        removeLocalUser,
      ],
    );


  // resetUserPassword — משתמש / סיסמה.
  const resetUserPassword =
    useCallback(
      async (
        userId: string,
      ): Promise<ResetUserPasswordResult> => {
        // normalizedUserId — מזהה משתמש.
        const normalizedUserId =
          userId.trim();

        // עצירת הפעולה עם שגיאה כאשר !normalizedUserId.
        if (!normalizedUserId) {
          throw new Error(
            'לא התקבל מזהה משתמש לאיפוס הסיסמה.',
          );
        }

        setResettingPasswordUserId(
          normalizedUserId,
        );

        setLastResetPasswordResult(
          null,
        );

        clearError();

        // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
        try {
          // result — תוצאה.
          const result =
            await usersService
              .resetUserPassword({
                userId:
                  normalizedUserId,
              });

          setLastResetPasswordResult(
            result,
          );

          setUsersState(
            (
              currentState,
            ) => ({
              ...currentState,

              users:
                currentState.users.map(
                  (
                    profile,
                  ) =>
                    profile.id ===
                    result.userId
                      ? {
                          ...profile,

                          mustChangePassword:
                            true,
                        }
                      : profile,
                ),

              error:
                null,
            }),
          );

          return result;
        } catch (error) {
          // errorMessage — הודעת שגיאה.
          const errorMessage =
            getErrorMessage(
              error,
              'לא ניתן היה לאפס את סיסמת המשתמש.',
            );

          setUsersState(
            (
              currentState,
            ) => ({
              ...currentState,

              error:
                errorMessage,
            }),
          );

          throw error;
        } finally {
          setResettingPasswordUserId(
            null,
          );
        }
      },
      [
        clearError,
      ],
    );

  // loadUserPermissions — משתמש / הרשאות.
  const loadUserPermissions =
    useCallback(
      async (
        userId: string,
      ): Promise<PermissionKey[]> => {
        // requestId — מזהה הבקשה.
        const requestId =
          permissionsRequestIdRef
            .current + 1;

        permissionsRequestIdRef.current =
          requestId;

        setUserPermissionsState({
          userId,
          permissions: [],
          isLoading: true,
          isSaving: false,
          error: null,
        });

        // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
        try {
          // permissions — הרשאות.
          const permissions =
            await usersService
              .getUserPermissions(
                userId,
              );

          // טיפול במקרה מיוחד ויציאה מוקדמת כאשר permissionsRequestIdRef .current !== requestId.
          if (
            permissionsRequestIdRef
              .current !== requestId
          ) {
            return permissions;
          }

          setUserPermissionsState({
            userId,
            permissions,
            isLoading: false,
            isSaving: false,
            error: null,
          });

          return permissions;
        } catch (error) {
          // errorMessage — הודעת שגיאה.
          const errorMessage =
            getErrorMessage(
              error,
              'לא ניתן היה לטעון את הרשאות המשתמש.',
            );

          if (
            permissionsRequestIdRef
              .current === requestId
          ) {
            setUserPermissionsState({
              userId,
              permissions: [],
              isLoading: false,
              isSaving: false,
              error: errorMessage,
            });
          }

          throw error;
        }
      },
      [],
    );

  // saveUserPermissions — משתמש / הרשאות.
  const saveUserPermissions =
    useCallback(
      async (
        userId: string,
        permissions:
          PermissionKey[],
      ): Promise<PermissionKey[]> => {
        setUserPermissionsState(
          (currentState) => ({
            userId,

            permissions:
              currentState.userId ===
              userId
                ? currentState.permissions
                : permissions,

            isLoading: false,
            isSaving: true,
            error: null,
          }),
        );

        // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
        try {
          // savedPermissions — הרשאות.
          const savedPermissions =
            await usersService
              .setUserPermissions(
                userId,
                permissions,
              );

          setUserPermissionsState({
            userId,
            permissions:
              savedPermissions,
            isLoading: false,
            isSaving: false,
            error: null,
          });

          if (
            userId ===
              authenticatedUserId &&
            refreshAuthenticatedPermissions
          ) {
            await refreshAuthenticatedPermissions();
          }

          return savedPermissions;
        } catch (error) {
          // errorMessage — הודעת שגיאה.
          const errorMessage =
            getErrorMessage(
              error,
              'לא ניתן היה לשמור את הרשאות המשתמש.',
            );

          setUserPermissionsState(
            (currentState) => ({
              ...currentState,
              userId,
              isLoading: false,
              isSaving: false,
              error: errorMessage,
            }),
          );

          throw error;
        }
      },
      [
        authenticatedUserId,
        refreshAuthenticatedPermissions,
      ],
    );

  // ערך מחושב filteredUsers — משתמשים; נשמר בין רינדורים עד שינוי התלויות.
  const filteredUsers =
    useMemo(() => {
      // normalizedSearchTerm — הנתון normalizedSearchTerm בהקשר הפעולה.
      const normalizedSearchTerm =
        filters.searchTerm
          .trim()
          .toLowerCase();

      return usersState.users.filter(
        (profile) => {
          const matchesSearch =
            !normalizedSearchTerm ||
            profile.displayName
              .toLowerCase()
              .includes(
                normalizedSearchTerm,
              ) ||
            profile.email
              .toLowerCase()
              .includes(
                normalizedSearchTerm,
              ) ||
            (
              profile.scheduleName ??
              ''
            )
              .toLowerCase()
              .includes(
                normalizedSearchTerm,
              );

          const matchesRole =
            filters.role === 'all' ||
            accountTypeFromLegacyRole(profile.role) === filters.role;

          // matchesStatus — סטטוס.
          const matchesStatus =
            filters.status ===
              'all' ||
            (
              filters.status ===
                'active' &&
              profile.isActive
            ) ||
            (
              filters.status ===
                'inactive' &&
              !profile.isActive
            );

          return (
            matchesSearch &&
            matchesRole &&
            matchesStatus
          );
        },
      );
    }, [
      filters,
      usersState.users,
    ]);

  // ערך מחושב statistics — סטטיסטיקה; נשמר בין רינדורים עד שינוי התלויות.
  const statistics =
    useMemo<UsersStatisticsData>(
      () => {
        // activeUsers — פעיל / משתמשים.
        const activeUsers =
          usersState.users.filter(
            (profile) =>
              profile.isActive,
          ).length;

        // inactiveUsers — משתמשים.
        const inactiveUsers =
          usersState.users.length -
          activeUsers;

        // adminUsers — משתמשים.
        const adminUsers =
          usersState.users.filter(
            (profile) =>
              profile.role ===
              'admin',
          ).length;

        return {
          total:
            usersState.users.length,

          active:
            activeUsers,

          inactive:
            inactiveUsers,

          admins:
            adminUsers,
        };
      },
      [usersState.users],
    );

  return {
    usersState,
    filteredUsers,
    statistics,
    updatingUserId,
    deletingUserId,
    resettingPasswordUserId,
    isCreatingUser,
    lastResetPasswordResult,
    userPermissionsState,
    loadUsers,
    createUser,
    updateUser,
    toggleActiveStatus,
    deleteUser,
    resetUserPassword,
    loadUserPermissions,
    saveUserPermissions,
    resetUserPermissionsState,
    clearError,
  };
}