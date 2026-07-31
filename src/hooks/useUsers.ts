import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { usersService } from '../services/usersService';
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
} from '../types/users';

interface UsersStatisticsData {
  total: number;
  active: number;
  inactive: number;
  admins: number;
}

interface UserPermissionsState {
  userId: string | null;
  permissions: PermissionKey[];
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
}

interface UseUsersOptions {
  authenticatedUserId: string | null;

  refreshAuthenticatedProfile:
    () => Promise<void>;

  refreshAuthenticatedPermissions?:
    () => Promise<void>;

  filters: UsersFilters;
}

interface UseUsersResult {
  usersState: UsersState;
  filteredUsers: UserProfile[];
  statistics: UsersStatisticsData;
  updatingUserId: string | null;
  deletingUserId: string | null;
  isCreatingUser: boolean;

  userPermissionsState:
    UserPermissionsState;

  loadUsers: () => Promise<void>;

  createUser: (
    input: CreateUserInput,
  ) => Promise<UserProfile>;

  updateUser: (
    userId: string,
    input: UpdateUserProfileInput,
  ) => Promise<UserProfile>;

  toggleActiveStatus: (
    profile: UserProfile,
  ) => Promise<void>;

  deleteUser: (
    input: DeleteUserInput,
  ) => Promise<void>;

  loadUserPermissions: (
    userId: string,
  ) => Promise<PermissionKey[]>;

  saveUserPermissions: (
    userId: string,
    permissions: PermissionKey[],
  ) => Promise<PermissionKey[]>;

  resetUserPermissionsState:
    () => void;

  clearError: () => void;
}

const initialUsersState: UsersState = {
  users: [],
  isLoading: true,
  error: null,
};

const initialUserPermissionsState:
  UserPermissionsState = {
    userId: null,
    permissions: [],
    isLoading: false,
    isSaving: false,
    error: null,
  };

function getErrorMessage(
  error: unknown,
  fallbackMessage: string,
): string {
  if (error instanceof Error) {
    return error.message;
  }

  return fallbackMessage;
}

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

export function useUsers({
  authenticatedUserId,
  refreshAuthenticatedProfile,
  refreshAuthenticatedPermissions,
  filters,
}: UseUsersOptions): UseUsersResult {
  const [
    usersState,
    setUsersState,
  ] = useState<UsersState>(
    initialUsersState,
  );

  const [
    updatingUserId,
    setUpdatingUserId,
  ] = useState<string | null>(null);

  const [
    deletingUserId,
    setDeletingUserId,
  ] = useState<string | null>(null);

  const [
    isCreatingUser,
    setIsCreatingUser,
  ] = useState(false);

  const [
    userPermissionsState,
    setUserPermissionsState,
  ] =
    useState<UserPermissionsState>(
      initialUserPermissionsState,
    );

  const permissionsRequestIdRef =
    useRef(0);

  const clearError =
    useCallback((): void => {
      setUsersState(
        (currentState) => ({
          ...currentState,
          error: null,
        }),
      );
    }, []);

  const resetUserPermissionsState =
    useCallback((): void => {
      permissionsRequestIdRef.current +=
        1;

      setUserPermissionsState(
        initialUserPermissionsState,
      );
    }, []);

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

        try {
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

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const createUser =
    useCallback(
      async (
        input: CreateUserInput,
      ): Promise<UserProfile> => {
        setIsCreatingUser(true);
        clearError();

        try {
          const createdProfile =
            await usersService
              .createUser(input);

          addLocalUser(
            createdProfile,
          );

          return createdProfile;
        } catch (error) {
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

  const updateUser =
    useCallback(
      async (
        userId: string,
        input:
          UpdateUserProfileInput,
      ): Promise<UserProfile> => {
        setUpdatingUserId(userId);
        clearError();

        try {
          if (
            userId ===
              authenticatedUserId &&
            input.isActive === false
          ) {
            throw new Error(
              'לא ניתן להשבית את המשתמש המחובר כעת.',
            );
          }

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

  const toggleActiveStatus =
    useCallback(
      async (
        profile: UserProfile,
      ): Promise<void> => {
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

        const actionLabel =
          profile.isActive
            ? 'להשבית'
            : 'להפעיל';

        const confirmed =
          window.confirm(
            `האם אתה בטוח שברצונך ${actionLabel} את המשתמש ${profile.displayName}?`,
          );

        if (!confirmed) {
          return;
        }

        setUpdatingUserId(
          profile.id,
        );

        clearError();

        try {
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

  const deleteUser =
    useCallback(
      async (
        input: DeleteUserInput,
      ): Promise<void> => {
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

        try {
          const deletedUser =
            await usersService
              .deleteUser(input);

          removeLocalUser(
            deletedUser.id,
          );
        } catch (error) {
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

  const loadUserPermissions =
    useCallback(
      async (
        userId: string,
      ): Promise<PermissionKey[]> => {
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

        try {
          const permissions =
            await usersService
              .getUserPermissions(
                userId,
              );

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

        try {
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

  const filteredUsers =
    useMemo(() => {
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
            profile.role ===
              filters.role;

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

  const statistics =
    useMemo<UsersStatisticsData>(
      () => {
        const activeUsers =
          usersState.users.filter(
            (profile) =>
              profile.isActive,
          ).length;

        const inactiveUsers =
          usersState.users.length -
          activeUsers;

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
    isCreatingUser,
    userPermissionsState,
    loadUsers,
    createUser,
    updateUser,
    toggleActiveStatus,
    deleteUser,
    loadUserPermissions,
    saveUserPermissions,
    resetUserPermissionsState,
    clearError,
  };
}